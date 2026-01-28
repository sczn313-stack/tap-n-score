/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Baker 23×35 1" Grid Pilot
   What this version does:
   - LOCKED inches authority from printed 1" grid (auto-detect px/in)
   - MOMA block (top-right) controls:
       * Units: IN ⇄ M (session-only; resets on Clear + New Upload)
       * Distance (default 100 yds)
       * Click value (default 0.25 MOA/click)
     Updates are live (re-renders SEC).
   - 2-finger pinch/zoom + pan
   - 1-finger taps: bull first, then hits
   - Canonical directions:
       ΔX = bullX − POIBx  (+ RIGHT, − LEFT)
       ΔY = bullY − POIBy  (+ UP,    − DOWN)
   - SEC placed under image, compact + expandable
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ----- DOM
  const elFile = $("photoInput");
  const uploadBtn = $("uploadBtn");
  const viewport = $("targetWrap");
  const img = $("targetImg");
  const dotsLayer = $("dotsLayer");

  const tapCountEl = $("tapCount");
  const undoBtn = $("undoTapsBtn");
  const clearBtn = $("clearTapsBtn");
  const showBtn = $("showResultsBtn");
  const instructionLine = $("instructionLine");

  const secPanel = $("secPanel");
  const vendorLink = $("vendorLink");

  // MOMA
  const unitToggle = $("unitToggle");
  const unitLabel = $("unitLabel");
  const distanceInput = $("distanceInput");
  const clickInput = $("clickInput");
  const distanceUnit = $("distanceUnit");
  const momaApplyBtn = $("momaApplyBtn");

  // ----- Inject dot styles (keeps this self-contained)
  const DOT_PX = 10; // locked dot size
  const style = document.createElement("style");
  style.textContent = `
    .dot{
      position:absolute;
      width:${DOT_PX}px;
      height:${DOT_PX}px;
      border-radius:999px;
      transform: translate(-50%, -50%);
      box-shadow: 0 8px 18px rgba(0,0,0,0.45);
      border: 1px solid rgba(255,255,255,0.35);
    }
    .dot.bull{ background: rgba(255, 165, 0, 0.95); }
    .dot.hit{ background: rgba(0, 170, 255, 0.95); }
  `;
  document.head.appendChild(style);

  // ----- Constants
  const TRUE_MOA_IN_PER_100Y = 1.047;
  const IN_PER_METER = 39.37007874015748;
  const YARDS_PER_METER = 1.0936132983377078;

  const fmt2 = (n) => Number(n).toFixed(2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampNum = (n, fallback = 0) => {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  };

  // ----- Session (pilot defaults)
  const session = {
    unit: "in",          // "in" | "m" (display only)
    distanceYds: 100,    // pilot default
    clickMoa: 0.25,      // pilot default
    isTrueMoa: true,     // pilot uses True MOA
  };

  function resetSessionToPilotDefaults() {
    session.unit = "in";
    session.distanceYds = 100;
    session.clickMoa = 0.25;
    session.isTrueMoa = true;
  }

  function inchesToSessionUnits(inches) {
    return session.unit === "m" ? (inches / IN_PER_METER) : inches;
  }

  function sessionDistanceLabel() {
    return session.unit === "m"
      ? `${fmt2(session.distanceYds / YARDS_PER_METER)} m`
      : `${fmt2(session.distanceYds)} yds`;
  }

  function inchesPerMoaAtDistance() {
    return TRUE_MOA_IN_PER_100Y * (session.distanceYds / 100);
  }

  function directionsFromDelta(dxIn, dyIn) {
    const horiz = dxIn > 0 ? "RIGHT" : dxIn < 0 ? "LEFT" : "—";
    const vert  = dyIn > 0 ? "UP"    : dyIn < 0 ? "DOWN" : "—";
    return { horiz, vert };
  }

  // ----- State
  let objectUrl = null;

  // image-local taps (pixels)
  let bullPx = null;
  let hitsPx = [];

  // view transform
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const MIN_SCALE = 1;
  const MAX_SCALE = 6;

  // grid detection result (px per 1 inch)
  let pxPerInchX = null;
  let pxPerInchY = null;

  // current computed results (for live re-render when MOMA changes)
  let lastResult = null;

  // ----- Vendor link (Baker only for now)
  function wireVendor() {
    // Keep simple: show vendor link but don’t auto-redirect.
    vendorLink.style.display = "inline-flex";
    vendorLink.textContent = "BakerTargets.com";
    vendorLink.href = "https://bakertargets.com";
  }

  // ----- Transform apply
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
  }

  // ----- Coordinate helpers
  function getViewportPointFromClient(clientX, clientY) {
    const r = viewport.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, r };
  }

  function viewportToImageLocal(pt) {
    return { x: (pt.x - tx) / scale, y: (pt.y - ty) / scale };
  }

  // ----- Dots render
  function addDot(kind, pt) {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${pt.x}px`;
    d.style.top = `${pt.y}px`;
    dotsLayer.appendChild(d);
  }

  function renderDots() {
    dotsLayer.innerHTML = "";
    if (bullPx) addDot("bull", bullPx);
    for (const h of hitsPx) addDot("hit", h);
  }

  // ----- UI state
  function setUi() {
    const totalTaps = (bullPx ? 1 : 0) + hitsPx.length;
    tapCountEl.textContent = String(totalTaps);

    undoBtn.disabled = totalTaps === 0;
    clearBtn.disabled = totalTaps === 0;

    const gridReady = !!(pxPerInchX && pxPerInchY);
    showBtn.disabled = !(bullPx && hitsPx.length > 0 && gridReady);

    if (!img.src) {
      instructionLine.textContent = "Upload your Baker 23×35 1-inch grid target photo to begin.";
      return;
    }
    if (!gridReady) {
      instructionLine.textContent = "Photo loaded. Detecting 1-inch grid… (Tip: keep photo straight & full-frame)";
      return;
    }
    if (!bullPx) {
      instructionLine.textContent = "Tap the bull once. (2 fingers: zoom/pan)";
      return;
    }
    instructionLine.textContent = "Tap bullet holes. Then press Show Results.";
  }

  // ----- Grid spacing detection (px per 1 inch)
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
      if (dx > 4) d.push(dx);
    }
    return d;
  }

  function findPeaks(signal, threshold) {
    const peaks = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > threshold && signal[i] >= signal[i - 1] && signal[i] >= signal[i + 1]) {
        peaks.push(i);
      }
    }
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

    const maxW = 1200;
    const scaleDown = Math.min(1, maxW / w);
    const cw = Math.round(w * scaleDown);
    const ch = Math.round(h * scaleDown);

    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cw, ch);

    function scanHorizontal(y) {
      const data = ctx.getImageData(0, y, cw, 1).data;
      const edge = new Float32Array(cw);
      for (let x = 1; x < cw - 1; x++) {
        const i = x * 4;
        const iL = (x - 1) * 4;
        const iR = (x + 1) * 4;
        const g  = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const gL = (data[iL] + data[iL + 1] + data[iL + 2]) / 3;
        const gR = (data[iR] + data[iR + 1] + data[iR + 2]) / 3;
        edge[x] = Math.abs(gR - gL);
      }
      return edge;
    }

    function scanVertical(x) {
      const data = ctx.getImageData(x, 0, 1, ch).data;
      const edge = new Float32Array(ch);
      for (let y = 1; y < ch - 1; y++) {
        const i = y * 4;
        const iU = (y - 1) * 4;
        const iD = (y + 1) * 4;
        const g  = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const gU = (data[iU] + data[iU + 1] + data[iU + 2]) / 3;
        const gD = (data[iD] + data[iD + 1] + data[iD + 2]) / 3;
        edge[y] = Math.abs(gD - gU);
      }
      return edge;
    }

    const ys = [Math.round(ch * 0.20), Math.round(ch * 0.30), Math.round(ch * 0.75)];
    const xs = [Math.round(cw * 0.20), Math.round(cw * 0.50), Math.round(cw * 0.80)];

    const spacingsX = [];
    for (const y of ys) {
      const edge = scanHorizontal(y);
      let max = 0;
      for (let i = 0; i < edge.length; i++) if (edge[i] > max) max = edge[i];
      const th = max * 0.55;
      const peaks = findPeaks(edge, th);
      const diffs = diffsSorted(peaks);
      for (const d of diffs) if (d >= 12 && d <= 120) spacingsX.push(d);
    }

    const spacingsY = [];
    for (const x of xs) {
      const edge = scanVertical(x);
      let max = 0;
      for (let i = 0; i < edge.length; i++) if (edge[i] > max) max = edge[i];
      const th = max * 0.55;
      const peaks = findPeaks(edge, th);
      const diffs = diffsSorted(peaks);
      for (const d of diffs) if (d >= 12 && d <= 120) spacingsY.push(d);
    }

    const medX = median(spacingsX);
    const medY = median(spacingsY);
    if (!medX || !medY) return false;

    pxPerInchX = medX / scaleDown;
    pxPerInchY = medY / scaleDown;

    return true;
  }

  // ----- Compute POIB
  function meanPoint(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }

  // Canonical compute: uses grid authority (pxPerInchX/Y)
  function computeResult() {
    const poibPx = meanPoint(hitsPx);

    // Convert pixels → inches (physical authority)
    const bullInX = bullPx.x / pxPerInchX;
    const bullInY = bullPx.y / pxPerInchY;
    const poibInX = poibPx.x / pxPerInchX;
    const poibInY = poibPx.y / pxPerInchY;

    // Correction deltas in INCHES (bull - poib)
    const dxIn = bullInX - poibInX;
    const dyIn = bullInY - poibInY;

    const { horiz, vert } = directionsFromDelta(dxIn, dyIn);

    // MOA + clicks
    const inPerMoa = inchesPerMoaAtDistance();
    const moaX = Math.abs(dxIn) / inPerMoa;
    const moaY = Math.abs(dyIn) / inPerMoa;

    const clicksX = moaX / session.clickMoa;
    const clicksY = moaY / session.clickMoa;

    // POIB offset relative to bull (intuitive):
    // POIB - Bull (signed)
    const poibRelInX = poibInX - bullInX;
    const poibRelInY = poibInY - bullInY;

    return {
      hits: hitsPx.length,
      poibPx,
      // inches truth
      dxIn, dyIn,
      poibRelInX, poibRelInY,
      // directions
      horiz, vert,
      // moa/clicks
      moaX, moaY,
      clicksX, clicksY,
      // display units
      unit: session.unit,
      distanceLabel: sessionDistanceLabel(),
      clickMoa: session.clickMoa,
      // grid detect
      pxPerInchX,
      pxPerInchY,
    };
  }

  // ----- SEC UI (compact + expandable)
  let secExpanded = true;

  function renderSEC(result) {
    const unitLabel = (result.unit === "m") ? "m" : "in";

    // display conversions (session only)
    const dxDisp = inchesToSessionUnits(result.dxIn);
    const dyDisp = inchesToSessionUnits(result.dyIn);
    const poibRelXDisp = inchesToSessionUnits(result.poibRelInX);
    const poibRelYDisp = inchesToSessionUnits(result.poibRelInY);

    // “Score” (pilot): hits count (clean + honest for now)
    const score = result.hits;

    secPanel.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="font-weight:900; letter-spacing:0.4px;">SEC</div>
          <div style="font-size:12px; opacity:0.70;">
            Score: <span style="font-weight:900; opacity:0.95;">${score}</span>
            • Hits: <span style="font-weight:900; opacity:0.95;">${result.hits}</span>
          </div>
        </div>
        <button id="secToggleBtn" class="btn" type="button" style="height:34px; padding:0 12px; border-radius:12px; font-size:12px;">
          ${secExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div id="secBody" style="margin-top:12px; display:${secExpanded ? "block" : "none"};">
        <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
          <div style="padding:12px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03);">
            <div style="font-size:12px; opacity:0.70; font-weight:800;">Correction (Bull − POIB)</div>
            <div style="margin-top:6px; font-weight:900; font-size:16px;">
              ${result.horiz} • ${result.vert}
            </div>
            <div style="margin-top:6px; font-size:13px; opacity:0.90;">
              ΔX ${fmt2(dxDisp)} ${unitLabel} • ΔY ${fmt2(dyDisp)} ${unitLabel}
            </div>
          </div>

          <div style="padding:12px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03);">
            <div style="font-size:12px; opacity:0.70; font-weight:800;">True MOA → Clicks</div>
            <div style="margin-top:6px; font-weight:900; font-size:14px;">
              X ${fmt2(result.clicksX)} • Y ${fmt2(result.clicksY)} <span style="opacity:0.75;">clicks</span>
            </div>
            <div style="margin-top:6px; font-size:12px; opacity:0.75;">
              MOA X ${fmt2(result.moaX)} • MOA Y ${fmt2(result.moaY)} • Distance ${result.distanceLabel} • ${fmt2(result.clickMoa)} MOA/click
            </div>
          </div>

          <div style="padding:12px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03);">
            <div style="font-size:12px; opacity:0.70; font-weight:800;">POIB Offset (POIB − Bull)</div>
            <div style="margin-top:6px; font-size:13px; opacity:0.90;">
              X ${fmt2(poibRelXDisp)} ${unitLabel} • Y ${fmt2(poibRelYDisp)} ${unitLabel}
            </div>
            <div style="margin-top:6px; font-size:12px; opacity:0.70;">
              Grid lock: ${fmt2(result.pxPerInchX)} px/in (X) • ${fmt2(result.pxPerInchY)} px/in (Y)
            </div>
          </div>
        </div>
      </div>
    `;

    const toggleBtn = $("secToggleBtn");
    toggleBtn.addEventListener("click", () => {
      secExpanded = !secExpanded;
      if (lastResult) renderSEC(lastResult);
    });
  }

  function clearSEC() {
    lastResult = null;
    secPanel.innerHTML = "";
  }

  // ----- MOMA wiring
  function syncMomaUIFromSession() {
    const isMetric = session.unit === "m";
    unitToggle.checked = isMetric;
    unitLabel.textContent = isMetric ? "M" : "IN";
    distanceUnit.textContent = isMetric ? "m" : "yd";

    distanceInput.value = isMetric
      ? fmt2(session.distanceYds / YARDS_PER_METER)
      : fmt2(session.distanceYds);

    clickInput.value = fmt2(session.clickMoa);
  }

  function applyMoma() {
    const isMetric = unitToggle.checked;

    // unit
    session.unit = isMetric ? "m" : "in";
    unitLabel.textContent = isMetric ? "M" : "IN";
    distanceUnit.textContent = isMetric ? "m" : "yd";

    // distance
    const distRaw = (distanceInput.value || "").trim();
    const distNum = clampNum(distRaw, isMetric ? (100 / YARDS_PER_METER) : 100);

    if (isMetric) {
      session.distanceYds = distNum * YARDS_PER_METER;
    } else {
      session.distanceYds = distNum;
    }
    if (session.distanceYds <= 0) session.distanceYds = 100;

    // click moa
    const clickRaw = (clickInput.value || "").trim();
    const clickNum = clampNum(clickRaw, 0.25);
    session.clickMoa = clickNum > 0 ? clickNum : 0.25;

    // reflect normalized values back into inputs (clean)
    syncMomaUIFromSession();

    // live re-render if we already have results
    if (bullPx && hitsPx.length > 0 && pxPerInchX && pxPerInchY) {
      lastResult = computeResult();
      renderSEC(lastResult);
    }
  }

  unitToggle.addEventListener("change", () => {
    // session-only; allow flip, but require Update to apply distance conversion cleanly
    // (We still update the small label instantly so user sees it.)
    unitLabel.textContent = unitToggle.checked ? "M" : "IN";
  });

  momaApplyBtn.addEventListener("click", applyMoma);

  // ----- Upload handling
  uploadBtn.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    // new upload resets everything (including unit back to IN)
    resetSessionToPilotDefaults();
    syncMomaUIFromSession();

    bullPx = null;
    hitsPx = [];
    renderDots();
    clearSEC();
    resetView();

    pxPerInchX = null;
    pxPerInchY = null;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      resetView();

      const ok = detectGridSpacing();
      // if grid fails, we keep show disabled until a better photo is used
      setUi();
      if (!ok) {
        instructionLine.textContent =
          "Grid not detected. Re-take photo: straight, full-frame, clear grid lines.";
      }
    };

    img.src = objectUrl;
    setUi();
  });

  // ----- Undo / Clear / Show
  undoBtn.addEventListener("click", () => {
    if (hitsPx.length > 0) hitsPx.pop();
    else bullPx = null;

    renderDots();
    clearSEC();
    setUi();
  });

  clearBtn.addEventListener("click", () => {
    bullPx = null;
    hitsPx = [];
    renderDots();
    clearSEC();
    resetSessionToPilotDefaults();
    syncMomaUIFromSession();
    setUi();
  });

  showBtn.addEventListener("click", () => {
    if (!(bullPx && hitsPx.length > 0 && pxPerInchX && pxPerInchY)) return;
    lastResult = computeResult();
    secExpanded = true; // open by default when computed
    renderSEC(lastResult);
  });

  // ----- Gestures
  ["gesturestart", "gesturechange", "gestureend"].forEach((evt) => {
    viewport.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });

  let mode = "none"; // "tap" | "pinch" | "pan"
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

  function clampPan() {
    const r = viewport.getBoundingClientRect();
    const slack = 120;

    const baseW = r.width;
    const baseH = r.height;

    const minTx = -(baseW * (scale - 1)) - slack;
    const maxTx = slack;
    const minTy = -(baseH * (scale - 1)) - slack;
    const maxTy = slack;

    tx = clamp(tx, minTx, maxTx);
    ty = clamp(ty, minTy, maxTy);
  }

  viewport.addEventListener("touchstart", (e) => {
    if (!img.src) return;
    e.preventDefault();

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);

      mode = "tap";
      downPt = pt;
      downWasPinch = false;
      panStart = { x: pt.x, y: pt.y, tx, ty }; // allow 1-finger micro-pan if user drags
      pinchStart = null;
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

      downWasPinch = true;
      downPt = null;
      panStart = null;
    }
  }, { passive: false });

  viewport.addEventListener("touchmove", (e) => {
    if (!img.src) return;
    e.preventDefault();

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

    // 1-finger drag pans (still allows taps if you don’t move much)
    if (mode === "tap" && e.touches.length === 1 && panStart) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);

      tx = panStart.tx + (pt.x - panStart.x);
      ty = panStart.ty + (pt.y - panStart.y);

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
          // double tap resets view
          resetView();
          lastTapTime = 0;
        } else {
          lastTapTime = now;

          const imgLocal = viewportToImageLocal(upPt);
          if (!Number.isFinite(imgLocal.x) || !Number.isFinite(imgLocal.y)) return;

          if (!bullPx) bullPx = imgLocal;
          else hitsPx.push(imgLocal);

          renderDots();
          clearSEC();
          setUi();
        }
      }
    }

    if (e.touches.length === 0) {
      mode = "none";
      panStart = null;
      pinchStart = null;
      downPt = null;
      downWasPinch = false;
    }
  }, { passive: false });

  // ----- Init
  wireVendor();
  resetSessionToPilotDefaults();
  syncMomaUIFromSession();
  setUi();
})();
