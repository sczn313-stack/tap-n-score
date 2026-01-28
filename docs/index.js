/* ============================================================
   docs/index.js (FULL REPLACEMENT) — GRID-LOCK MATH (INCHES)
   Target: Baker 23×35 1" grid (pilot)
   Goal:
   - Auto-detect grid spacing in pixels (px per 1.00 inch square)
   - Convert taps → inches using detected grid spacing
   - SEC outputs true inches → True MOA @ 50y → clicks (0.25 MOA/click)
   - No calibration UI, no user typing

   Notes:
   - Works best when the photo is fairly straight (minimal tilt).
   - If grid spacing cannot be detected, Show Results stays disabled.
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const viewport = $("targetViewport");
  const img = $("targetImg");
  const haloLayer = $("haloLayer");
  const dotsLayer = $("dotsLayer");

  const loupe = $("loupe");
  const loupeCtx = loupe.getContext("2d");

  const toastEl = $("toast");
  let toastTimer = null;

  const tapCountEl = $("tapCount");
  const undoBtn = $("undoBtn");
  const clearBtn = $("clearBtn");
  const showBtn = $("showResultsBtn");

  const instructionLine = $("instructionLine");

  const outputBox = $("outputBox");
  const secHits = $("secHits");
  const secPoib = $("secPoib");
  const secDelta = $("secDelta");
  const secDir = $("secDir");
  const secMoa = $("secMoa");
  const secClicks = $("secClicks");
  const secNote = $("secNote");

  const vendorLink = $("vendorLink");
  const bakerCtas = $("bakerCtas");
  const bakerCatalogBtn = $("bakerCatalogBtn");
  const bakerProductBtn = $("bakerProductBtn");

  // Tap Precision toggle UI
  const tapPrecisionToggle = $("tapPrecisionToggle");
  const tapPrecisionState = $("tapPrecisionState");

  // LOCKED Baker tags (safe defaults)
  const BAKER_TAG_CATALOG = "catalog";
  const BAKER_TAG_PRODUCT = "product";
  const DEFAULT_DEST = BAKER_TAG_CATALOG;

  const BAKER_DESTINATION_MAP = {
    [BAKER_TAG_CATALOG]: "",
    [BAKER_TAG_PRODUCT]: "",
  };

  // ---- Constants (SEC math)
  const DIST_YDS = 50;
  const CLICK_MOA = 0.25;
  const TRUE_MOA_IN_PER_100Y = 1.047; // inches per MOA at 100y
  const IN_PER_MOA_AT_50Y = TRUE_MOA_IN_PER_100Y * (DIST_YDS / 100); // 0.5235

  const fmt2 = (n) => Number(n).toFixed(2);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function getSessionParams() {
    const qs = new URLSearchParams(window.location.search);
    const vendor = (qs.get("vendor") || "").toLowerCase();
    const dest = (qs.get("dest") || DEFAULT_DEST).toLowerCase();
    return { vendor, dest };
  }

  // ------------ Toast + Haptic ------------
  function hapticLight() {
    try { if ("vibrate" in navigator) navigator.vibrate(12); } catch {}
  }

  function showToast(msg) {
    if (!toastEl) return;
    if (toastTimer) clearTimeout(toastTimer);

    toastEl.textContent = msg;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");

    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 980);
  }

  // ------------ Halo ------------
  function pulseHalo(viewPt, kind /* "bull" | "hit" */) {
    if (!haloLayer) return;

    const d = document.createElement("div");
    d.className = `halo ${kind === "bull" ? "bullHalo" : "hitHalo"}`;
    d.style.left = `${viewPt.x}px`;
    d.style.top = `${viewPt.y}px`;

    haloLayer.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 260);
  }

  // Image URL
  let objectUrl = null;

  // Tap data stored in IMAGE-LOCAL coords (pixels in image space)
  let bullPx = null;
  let hitsPx = [];

  // DONE state
  let done = false;

  // Tap Precision (default ON) persisted
  const PRECISION_KEY = "tap_precision_on";
  let tapPrecisionOn = true;

  function loadPrecisionSetting() {
    const raw = localStorage.getItem(PRECISION_KEY);
    tapPrecisionOn = (raw === null) ? true : (raw === "1");
    tapPrecisionToggle.checked = tapPrecisionOn;
    tapPrecisionState.textContent = tapPrecisionOn ? "ON" : "OFF";
  }

  function savePrecisionSetting(next) {
    tapPrecisionOn = !!next;
    localStorage.setItem(PRECISION_KEY, tapPrecisionOn ? "1" : "0");
    tapPrecisionToggle.checked = tapPrecisionOn;
    tapPrecisionState.textContent = tapPrecisionOn ? "ON" : "OFF";
    hideLoupe();
    showToast(tapPrecisionOn ? "Tap Precision ON ✅" : "Tap Precision OFF ✅");
    setUi();
  }

  tapPrecisionToggle.addEventListener("change", () => {
    savePrecisionSetting(tapPrecisionToggle.checked);
  });

  // View transform
  let scale = 1;
  let tx = 0;
  let ty = 0;

  const MIN_SCALE = 1;
  const MAX_SCALE = 6;

  // RAF-throttled transforms
  let rafPending = false;
  function applyTransform() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const t = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      img.style.transform = t;
      dotsLayer.style.transform = t;
    });
  }

  function resetView() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
    showToast("View reset ✅");
  }

  function showSEC() { outputBox.classList.remove("hidden"); }
  function hideSEC() {
    outputBox.classList.add("hidden");
    done = false;
  }

  // ---------------- Grid Spacing Detection ----------------
  // We estimate:
  //   pxPerInchX = typical distance between vertical grid lines in pixels
  //   pxPerInchY = typical distance between horizontal grid lines in pixels
  //
  // Strategy (fast + robust enough for pilot):
  // - Draw image to an offscreen canvas
  // - Take 2–3 horizontal scanlines and 2–3 vertical scanlines away from the bull,
  //   compute edge peaks (line positions) and take median spacing.
  //
  // If detection fails, we keep Show Results disabled.
  let pxPerInchX = null;
  let pxPerInchY = null;

  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return (a.length % 2) ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function diffsSorted(peaks) {
    const d = [];
    for (let i = 1; i < peaks.length; i++) {
      const dx = peaks[i] - peaks[i - 1];
      if (dx > 4) d.push(dx); // ignore tiny jitter
    }
    return d;
  }

  // Find peaks in a 1D signal using derivative magnitude threshold and local maxima.
  function findPeaks(signal, threshold) {
    const peaks = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > threshold && signal[i] >= signal[i - 1] && signal[i] >= signal[i + 1]) {
        peaks.push(i);
      }
    }
    // Simple thinning: remove peaks that are too close together
    const thinned = [];
    const minSep = 6;
    for (const p of peaks) {
      if (!thinned.length || (p - thinned[thinned.length - 1]) >= minSep) thinned.push(p);
    }
    return thinned;
  }

  function detectGridSpacing() {
    pxPerInchX = null;
    pxPerInchY = null;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return false;

    // Downscale for speed (keep enough detail)
    const maxW = 1200;
    const scaleDown = Math.min(1, maxW / w);
    const cw = Math.round(w * scaleDown);
    const ch = Math.round(h * scaleDown);

    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cw, ch);

    // Helper to sample a horizontal scanline (y) and compute edge strength across x
    function scanHorizontal(y) {
      const imgData = ctx.getImageData(0, y, cw, 1).data;
      const edge = new Float32Array(cw);
      for (let x = 1; x < cw - 1; x++) {
        const i = x * 4;
        const iL = (x - 1) * 4;
        const iR = (x + 1) * 4;

        const g  = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
        const gL = (imgData[iL] + imgData[iL + 1] + imgData[iL + 2]) / 3;
        const gR = (imgData[iR] + imgData[iR + 1] + imgData[iR + 2]) / 3;

        edge[x] = Math.abs(gR - gL);
      }
      return edge;
    }

    // Helper to sample a vertical scanline (x) and compute edge strength across y
    function scanVertical(x) {
      const imgData = ctx.getImageData(x, 0, 1, ch).data;
      const edge = new Float32Array(ch);
      for (let y = 1; y < ch - 1; y++) {
        const i = y * 4;
        const iU = (y - 1) * 4;
        const iD = (y + 1) * 4;

        const g  = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
        const gU = (imgData[iU] + imgData[iU + 1] + imgData[iU + 2]) / 3;
        const gD = (imgData[iD] + imgData[iD + 1] + imgData[iD + 2]) / 3;

        edge[y] = Math.abs(gD - gU);
      }
      return edge;
    }

    // Choose scanlines away from the orange bull to avoid the thick circle/cross:
    // Use upper quarter and lower quarter
    const ys = [
      Math.round(ch * 0.20),
      Math.round(ch * 0.30),
      Math.round(ch * 0.75),
    ];
    const xs = [
      Math.round(cw * 0.20),
      Math.round(cw * 0.80),
      Math.round(cw * 0.50),
    ];

    const spacingsX = [];
    for (const y of ys) {
      const edge = scanHorizontal(y);
      // Threshold based on signal percentile-ish
      let max = 0;
      for (let i = 0; i < edge.length; i++) if (edge[i] > max) max = edge[i];
      const th = max * 0.55;
      const peaks = findPeaks(edge, th);
      const diffs = diffsSorted(peaks);

      // We expect many repeated diffs ~ grid spacing
      // Keep diffs within a reasonable range (after downscale):
      for (const d of diffs) {
        if (d >= 12 && d <= 120) spacingsX.push(d);
      }
    }

    const spacingsY = [];
    for (const x of xs) {
      const edge = scanVertical(x);
      let max = 0;
      for (let i = 0; i < edge.length; i++) if (edge[i] > max) max = edge[i];
      const th = max * 0.55;
      const peaks = findPeaks(edge, th);
      const diffs = diffsSorted(peaks);
      for (const d of diffs) {
        if (d >= 12 && d <= 120) spacingsY.push(d);
      }
    }

    const medX = median(spacingsX);
    const medY = median(spacingsY);

    if (!medX || !medY) return false;

    // Convert back to full-res pixels per inch
    pxPerInchX = medX / scaleDown;
    pxPerInchY = medY / scaleDown;

    // Sanity: they should be similar
    const ratio = pxPerInchX / pxPerInchY;
    if (ratio < 0.80 || ratio > 1.25) {
      // Still accept, but warn
      console.warn("Grid spacing ratio looks off:", { pxPerInchX, pxPerInchY, ratio });
    }

    console.log("Detected grid spacing (px per 1 inch):", { pxPerInchX, pxPerInchY });
    return true;
  }

  // ------------ UI state ------------
  function setUi() {
    const totalTaps = (bullPx ? 1 : 0) + hitsPx.length;
    tapCountEl.textContent = String(totalTaps);

    undoBtn.disabled = totalTaps === 0;
    clearBtn.disabled = totalTaps === 0;

    const gridReady = !!(pxPerInchX && pxPerInchY);
    // Must have bull + at least 1 hit + detected grid spacing
    showBtn.disabled = !(bullPx && hitsPx.length > 0 && gridReady);

    if (!img.src) {
      instructionLine.textContent = "Upload your Baker 23×35 1-inch grid photo to begin.";
      return;
    }
    if (!gridReady) {
      instructionLine.textContent =
        "Photo loaded. Detecting 1-inch grid… (Tip: use a straight, full-frame photo).";
      return;
    }
    if (done) {
      instructionLine.textContent = "SEC ready (inches). You can Undo/Clear or upload a new photo.";
      return;
    }

    instructionLine.textContent = !bullPx
      ? "Tap the bull once. Use TWO fingers to zoom/pan if needed."
      : "Tap bullet holes. Then press Show Results (true inches).";
  }

  function getViewportPointFromClient(clientX, clientY) {
    const r = viewport.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, r };
  }

  function viewportToImageLocal(pt) {
    // image-local pixel coords
    return { x: (pt.x - tx) / scale, y: (pt.y - ty) / scale };
  }

  function addDot(kind, pt, labelText = "") {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${pt.x}px`;
    d.style.top = `${pt.y}px`;

    if (labelText) {
      const s = document.createElement("span");
      s.className = "dotLabel";
      s.textContent = labelText;
      d.appendChild(s);
    }

    dotsLayer.appendChild(d);
  }

  function renderDots() {
    dotsLayer.innerHTML = "";
    if (bullPx) addDot("bull", bullPx, "B");
    for (let i = 0; i < hitsPx.length; i++) addDot("hit", hitsPx[i], String(i + 1));
  }

  // keep pan from drifting too far
  function clampPan() {
    const r = viewport.getBoundingClientRect();
    const slack = 90;
    const baseW = r.width;

    const imgRect = img.getBoundingClientRect();
    const baseH = (imgRect.height / scale) || (r.width * 0.75);

    const minTx = -(baseW * scale - baseW) - slack;
    const maxTx = slack;
    const minTy = -(baseH * scale - baseH) - slack;
    const maxTy = slack;

    tx = clamp(tx, minTx, maxTx);
    ty = clamp(ty, minTy, maxTy);
  }

  // Vendor wiring (Baker only)
  function wireVendor() {
    const { vendor, dest } = getSessionParams();

    vendorLink.style.display = "none";
    bakerCtas.style.display = "none";

    if (vendor !== "baker") return;

    vendorLink.style.display = "inline-flex";
    vendorLink.textContent = "BakerTargets.com";
    vendorLink.href = "https://bakertargets.com";

    bakerCtas.style.display = "flex";
    bakerCatalogBtn.textContent = "Buy Baker Targets";
    bakerProductBtn.textContent = "Learn More About Baker Targets";

    bakerCatalogBtn.onclick = () => {
      window.location.href = `${window.location.pathname}?vendor=baker&dest=${BAKER_TAG_CATALOG}`;
    };
    bakerProductBtn.onclick = () => {
      window.location.href = `${window.location.pathname}?vendor=baker&dest=${BAKER_TAG_PRODUCT}`;
    };

    const targetUrl = BAKER_DESTINATION_MAP[dest] || "";
    if (dest && (dest === BAKER_TAG_CATALOG || dest === BAKER_TAG_PRODUCT)) {
      if (targetUrl) window.location.href = targetUrl;
    }
  }

  // ---------- Loupe ----------
  const LOUPE_W = 140;
  const LOUPE_H = 140;
  const LOUPE_SRC = 50;

  function hideLoupe() { loupe.style.display = "none"; }

  function drawLoupeAt(viewPt) {
    if (!img.src) return;
    if (!tapPrecisionOn) return;
    if (!img.naturalWidth || !img.naturalHeight) return;

    const imgLocal = viewportToImageLocal(viewPt);

    const sx = Math.round(imgLocal.x - LOUPE_SRC);
    const sy = Math.round(imgLocal.y - LOUPE_SRC);
    const sw = LOUPE_SRC * 2;
    const sh = LOUPE_SRC * 2;

    const csx = Math.max(0, Math.min(img.naturalWidth - sw, sx));
    const csy = Math.max(0, Math.min(img.naturalHeight - sh, sy));

    const r = viewPt.r;
    let lx = viewPt.x + 18;
    let ly = viewPt.y - (LOUPE_H + 18);

    lx = clamp(lx, 8, r.width - LOUPE_W - 8);
    ly = clamp(ly, 8, r.height - LOUPE_H - 8);

    loupe.style.left = `${lx}px`;
    loupe.style.top = `${ly}px`;
    loupe.style.display = "block";

    loupeCtx.clearRect(0, 0, LOUPE_W, LOUPE_H);
    loupeCtx.imageSmoothingEnabled = false;

    loupeCtx.drawImage(img, csx, csy, sw, sh, 0, 0, LOUPE_W, LOUPE_H);

    loupeCtx.beginPath();
    loupeCtx.strokeStyle = "rgba(255,255,255,0.85)";
    loupeCtx.lineWidth = 1;
    loupeCtx.moveTo(LOUPE_W / 2, 8);
    loupeCtx.lineTo(LOUPE_W / 2, LOUPE_H - 8);
    loupeCtx.moveTo(8, LOUPE_H / 2);
    loupeCtx.lineTo(LOUPE_W - 8, LOUPE_H / 2);
    loupeCtx.stroke();

    loupeCtx.beginPath();
    loupeCtx.fillStyle = "rgba(255,43,43,0.9)";
    loupeCtx.arc(LOUPE_W / 2, LOUPE_H / 2, 2.2, 0, Math.PI * 2);
    loupeCtx.fill();
  }

  // ---------- SEC MATH (PIXELS → INCHES → MOA/CLICKS) ----------
  function meanPoint(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }

  function dirFromDelta(dxIn, dyIn) {
    const horiz = dxIn > 0 ? "RIGHT" : (dxIn < 0 ? "LEFT" : "—");
    const vert  = dyIn > 0 ? "UP"    : (dyIn < 0 ? "DOWN" : "—");
    return { horiz, vert };
  }

  function secComputeInches(bull, hitPts) {
    const poibPx = meanPoint(hitPts);

    // delta in pixels (bull - poib)
    const dxPx = bull.x - poibPx.x;
    const dyPx = bull.y - poibPx.y;

    // convert px → inches using detected grid spacing
    const dxIn = dxPx / pxPerInchX;
    const dyIn = dyPx / pxPerInchY;

    const { horiz, vert } = dirFromDelta(dxIn, dyIn);

    // True MOA (per axis)
    const moaX = Math.abs(dxIn) / IN_PER_MOA_AT_50Y;
    const moaY = Math.abs(dyIn) / IN_PER_MOA_AT_50Y;

    // clicks
    const clicksX = moaX / CLICK_MOA;
    const clicksY = moaY / CLICK_MOA;

    // POIB inches (relative to bull at 0,0 is not meaningful; still show absolute inches-from-image origin)
    // We’ll show POIB in inches from image origin for now (consistent), and show correction deltas clearly.
    const poibIn = { x: poibPx.x / pxPerInchX, y: poibPx.y / pxPerInchY };

    return { poibIn, dxIn, dyIn, horiz, vert, moaX, moaY, clicksX, clicksY };
  }

  function renderSEC() {
    const out = secComputeInches(bullPx, hitsPx);

    secHits.textContent = String(hitsPx.length);

    secPoib.textContent = `X ${fmt2(out.poibIn.x)} • Y ${fmt2(out.poibIn.y)}`;
    secDelta.textContent = `ΔX ${fmt2(out.dxIn)} • ΔY ${fmt2(out.dyIn)}`;
    secDir.textContent = `${out.horiz} • ${out.vert}`;

    secMoa.textContent = `X ${fmt2(out.moaX)} • Y ${fmt2(out.moaY)}`;
    secClicks.textContent = `X ${fmt2(out.clicksX)} • Y ${fmt2(out.clicksY)}`;

    secNote.textContent =
      `1″ grid detected: ${fmt2(pxPerInchX)} px/in (X) • ${fmt2(pxPerInchY)} px/in (Y).`;

    showSEC();
  }

  // ---------- File load ----------
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      scale = 1; tx = 0; ty = 0;
      applyTransform();

      bullPx = null;
      hitsPx = [];
      dotsLayer.innerHTML = "";
      hideSEC();
      hideLoupe();

      // Detect grid spacing now (auto-inches)
      showToast("Detecting 1-inch grid…");
      const ok = detectGridSpacing();
      if (ok) {
        showToast("1-inch grid locked ✅");
      } else {
        showToast("Grid not detected ❗ Try a straighter photo");
      }

      setUi();
    };

    img.src = objectUrl;
    setUi();
  });

  // iOS: stop gesture hijack
  ["gesturestart", "gesturechange", "gestureend"].forEach((evt) => {
    viewport.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });

  // Touch state
  let mode = "none";     // "tap" | "pinch" | "pan" | "none"
  let panStart = null;
  let pinchStart = null;

  function tDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }
  function tMid(t1, t2) {
    const r = viewport.getBoundingClientRect();
    return {
      x: ((t1.clientX + t2.clientX) / 2) - r.left,
      y: ((t1.clientY + t2.clientY) / 2) - r.top,
      r
    };
  }

  const TAP_SLOP = 10;
  let downPt = null;
  let downWasPinch = false;
  let lastTapTime = 0;

  viewport.addEventListener("touchstart", (e) => {
    if (!img.src) return;
    e.preventDefault();

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);
      downWasPinch = false;
      downPt = pt;

      if (tapPrecisionOn) {
        mode = "tap";
        panStart = null;
        pinchStart = null;
        drawLoupeAt(pt);
      } else {
        mode = "pan";
        panStart = { x: pt.x, y: pt.y, tx, ty };
        pinchStart = null;
        hideLoupe();
      }
    }

    if (e.touches.length === 2) {
      mode = "pinch";
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const m = tMid(t1, t2);

      pinchStart = {
        dist: tDist(t1, t2),
        midX: m.x,
        midY: m.y,
        scale,
        tx,
        ty
      };

      panStart = null;
      downWasPinch = true;
      downPt = null;
      hideLoupe();
    }
  }, { passive: false });

  viewport.addEventListener("touchmove", (e) => {
    if (!img.src) return;
    e.preventDefault();

    if (mode === "tap" && e.touches.length === 1 && tapPrecisionOn) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);
      drawLoupeAt(pt);
      return;
    }

    if (mode === "pan" && e.touches.length === 1 && panStart) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);
      tx = panStart.tx + (pt.x - panStart.x);
      ty = panStart.ty + (pt.y - panStart.y);
      clampPan();
      applyTransform();
      return;
    }

    if (mode === "pinch" && e.touches.length === 2 && pinchStart) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const m = tMid(t1, t2);
      const d = tDist(t1, t2);

      const nextScale = clamp(pinchStart.scale * (d / pinchStart.dist), MIN_SCALE, MAX_SCALE);

      const imgLocalAtStartMid = {
        x: (pinchStart.midX - pinchStart.tx) / pinchStart.scale,
        y: (pinchStart.midY - pinchStart.ty) / pinchStart.scale
      };

      scale = nextScale;
      tx = m.x - imgLocalAtStartMid.x * scale;
      ty = m.y - imgLocalAtStartMid.y * scale;

      clampPan();
      applyTransform();
      return;
    }
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (!img.src) return;
    e.preventDefault();

    if (!downWasPinch && e.changedTouches.length === 1 && downPt) {
      const t = e.changedTouches[0];
      const upPt = getViewportPointFromClient(t.clientX, t.clientY);
      const moved = Math.hypot(upPt.x - downPt.x, upPt.y - downPt.y);

      if (moved <= TAP_SLOP) {
        const now = Date.now();

        if (now - lastTapTime < 300) {
          resetView();
          lastTapTime = 0;
        } else {
          lastTapTime = now;

          const imgLocal = viewportToImageLocal(upPt);
          if (Number.isFinite(imgLocal.x) && Number.isFinite(imgLocal.y)) {
            if (!bullPx) {
              bullPx = imgLocal;
              pulseHalo(upPt, "bull");
              showToast("Bull set ✅");
            } else {
              hitsPx.push(imgLocal);
              pulseHalo(upPt, "hit");
              showToast(`Hit #${hitsPx.length} added ✅`);
            }

            hapticLight();
            renderDots();
            hideSEC();
            done = false;
            setUi();
          }
        }
      }
    }

    hideLoupe();

    if (e.touches.length === 0) {
      mode = "none";
      panStart = null;
      pinchStart = null;
      downPt = null;
      downWasPinch = false;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);
      downWasPinch = false;
      downPt = pt;

      if (tapPrecisionOn) {
        mode = "tap";
        panStart = null;
        pinchStart = null;
        drawLoupeAt(pt);
      } else {
        mode = "pan";
        panStart = { x: pt.x, y: pt.y, tx, ty };
        pinchStart = null;
      }
    }
  }, { passive: false });

  // Buttons
  undoBtn.addEventListener("click", () => {
    if (hitsPx.length > 0) {
      hitsPx.pop();
      showToast("Hit removed ✅");
    } else if (bullPx) {
      bullPx = null;
      showToast("Bull cleared ✅");
    }
    renderDots();
    hideSEC();
    hideLoupe();
    done = false;
    setUi();
    hapticLight();
  });

  clearBtn.addEventListener("click", () => {
    bullPx = null;
    hitsPx = [];
    dotsLayer.innerHTML = "";
    hideSEC();
    hideLoupe();
    done = false;
    setUi();
    hapticLight();
    showToast("Cleared ✅");
  });

  showBtn.addEventListener("click", () => {
    if (!(bullPx && hitsPx.length > 0)) return;
    if (!(pxPerInchX && pxPerInchY)) {
      showToast("Grid not detected ❗");
      return;
    }

    done = true;
    renderSEC();
    showToast("SEC ready ✅");
    hapticLight();
    setUi();
  });

  // Init
  loadPrecisionSetting();
  wireVendor();
  setUi();
})();
