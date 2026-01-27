/* ============================================================
   docs/index.js (FULL REPLACEMENT) — BRICK 10s
   Adds: AUTO grid scale detect + fallback calibration (2 taps = 1 inch)
   Principle: app will NOT guess scale. If auto is low, we force Fix Scale.
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM
  const elCam = $("photoInputCamera");
  const elLib = $("photoInputLibrary");

  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  const elInstruction = $("instructionLine");
  const elBullStatus = $("bullStatus");
  const elHoleCount = $("holeCount");

  const elScaleState = $("scaleState");
  const elFixScaleBtn = $("fixScaleBtn");

  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elLockBanner = $("lockBanner");

  const elWindDir = $("windageDir");
  const elWindVal = $("windageVal");
  const elElevDir = $("elevDir");
  const elElevVal = $("elevVal");

  const elWindArrow = $("windArrow");
  const elElevArrow = $("elevArrow");

  const elDownloadSEC = $("downloadSecBtn");

  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");
  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // ---- Pilot defaults (hidden)
  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25;

  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // ---- State
  let objectUrl = null;

  // Tap points: { nx, ny, ix, iy } (normalized + natural px)
  let bull = null;
  let holes = [];
  let resultsLocked = false;

  // Scale modes:
  // - auto: detected grid px spacing
  // - cal: 2 taps = 1 inch
  // - none: unknown (we block results)
  let scale = {
    mode: "none",     // "auto" | "cal" | "none"
    inPerPxX: null,
    inPerPxY: null,
    confidence: 0
  };

  // Calibration taps (when Fix Scale engaged)
  let calMode = false;
  let calA = null; // first calibration point (natural px)

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // Pointer filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  // ---- UI helpers
  function setScaleUI() {
    if (!elScaleState) return;

    if (scale.mode === "auto") {
      elScaleState.textContent = scale.confidence >= 0.72 ? "AUTO (High)" : "AUTO (Low)";
      elFixScaleBtn.hidden = !(scale.confidence < 0.72);
      return;
    }

    if (scale.mode === "cal") {
      elScaleState.textContent = "LOCKED";
      elFixScaleBtn.hidden = true;
      return;
    }

    elScaleState.textContent = "NEEDED";
    elFixScaleBtn.hidden = false;
  }

  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target.";
      return;
    }
    if (calMode) {
      elInstruction.textContent = calA
        ? "Fix Scale: tap the next grid intersection 1 inch away."
        : "Fix Scale: tap a grid intersection.";
      return;
    }
    if (!bull) {
      elInstruction.textContent = "Tap aim point first, then tap bullet holes.";
      return;
    }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus() {
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    const ready = !!bull && holes.length > 0;
    const scaleOk = !!scale.inPerPxX && !!scale.inPerPxY;

    elUndo.disabled = !(bull || holes.length || calMode);
    elClear.disabled = !(bull || holes.length || calMode);

    elShow.disabled = !(ready && scaleOk && !resultsLocked && !calMode);

    elLockBanner.hidden = !resultsLocked;

    setScaleUI();
  }

  function resetResultsUI() {
    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";
    elDownloadSEC.disabled = true;

    if (elWindArrow) elWindArrow.textContent = "→";
    if (elElevArrow) elElevArrow.textContent = "→";
  }

  function renderDots() {
    elDots.innerHTML = "";

    // Bull
    if (bull) {
      const d = document.createElement("div");
      d.className = "dot bullDot";
      d.style.left = `${bull.nx * 100}%`;
      d.style.top = `${bull.ny * 100}%`;
      elDots.appendChild(d);
    }

    // Holes
    for (const p of holes) {
      const d = document.createElement("div");
      d.className = "dot holeDot";
      d.style.left = `${p.nx * 100}%`;
      d.style.top = `${p.ny * 100}%`;
      elDots.appendChild(d);
    }

    // Calibration marker A
    if (calMode && calA) {
      const d = document.createElement("div");
      d.className = "dot holeDot";
      d.style.left = `${calA.nx * 100}%`;
      d.style.top = `${calA.ny * 100}%`;
      d.style.opacity = "0.55";
      elDots.appendChild(d);
    }
  }

  function lockResults() {
    resultsLocked = true;
    setStatus();
  }

  function unlockResults() {
    resultsLocked = false;
    setStatus();
  }

  // ---- Coordinate conversion
  function clientToImagePoint(clientX, clientY) {
    const rect = elImg.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);

    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    const ix = nx * iw;
    const iy = ny * ih;

    return { nx, ny, ix, iy };
  }

  function meanPointNorm(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.nx; sy += p.ny; }
    return { nx: sx / points.length, ny: sy / points.length };
  }

  // ---- Truth Gate (direction must match sign)
  function truthGate(dxIn, dyIn, windDir, elevDir) {
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return (windDir === wantWind) && (elevDir === wantElev);
  }

  // ---- Auto grid scale detection (1" grid) using projection peaks
  async function detectGridScale() {
    // Default to NONE until proven
    scale = { mode: "none", inPerPxX: null, inPerPxY: null, confidence: 0 };
    setScaleUI();

    // Must have natural size
    const iw = elImg.naturalWidth || 0;
    const ih = elImg.naturalHeight || 0;
    if (iw < 300 || ih < 300) return;

    // Downscale for speed
    const maxW = 900;
    const s = Math.min(1, maxW / iw);
    const w = Math.floor(iw * s);
    const h = Math.floor(ih * s);

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(elImg, 0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;

    // Build simple grayscale & gradient projections
    const col = new Float32Array(w);
    const row = new Float32Array(h);

    // Simple gradient magnitude (Sobel-lite) by neighbor diffs
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;

        const g = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);

        const il = (y * w + (x - 1)) * 4;
        const ir = (y * w + (x + 1)) * 4;
        const iu = ((y - 1) * w + x) * 4;
        const id = ((y + 1) * w + x) * 4;

        const gl = (data[il] * 0.299 + data[il+1] * 0.587 + data[il+2] * 0.114);
        const gr = (data[ir] * 0.299 + data[ir+1] * 0.587 + data[ir+2] * 0.114);
        const gu = (data[iu] * 0.299 + data[iu+1] * 0.587 + data[iu+2] * 0.114);
        const gd = (data[id] * 0.299 + data[id+1] * 0.587 + data[id+2] * 0.114);

        const gx = Math.abs(gr - gl);
        const gy = Math.abs(gd - gu);

        // Vertical lines => gx spikes (changes across x)
        col[x] += gx;

        // Horizontal lines => gy spikes
        row[y] += gy;
      }
    }

    const pxPerInX = estimateSpacingPx(col);
    const pxPerInY = estimateSpacingPx(row);

    if (!pxPerInX || !pxPerInY) {
      // Fail -> require Fix
      scale = { mode: "none", inPerPxX: null, inPerPxY: null, confidence: 0 };
      setScaleUI();
      return;
    }

    // Convert back to natural pixels
    const pxX = pxPerInX / s;
    const pxY = pxPerInY / s;

    // Confidence = consistency of spacing estimates
    const conf = estimateConfidence(col, pxPerInX) * 0.5 + estimateConfidence(row, pxPerInY) * 0.5;

    scale = {
      mode: "auto",
      inPerPxX: 1 / pxX,
      inPerPxY: 1 / pxY,
      confidence: conf
    };

    // If low confidence, allow Fix; if high, we hide Fix
    setScaleUI();

    function estimateSpacingPx(signal) {
      // Smooth (box filter)
      const n = signal.length;
      const sm = new Float32Array(n);
      const k = 9;
      for (let i = 0; i < n; i++) {
        let s = 0, c = 0;
        for (let j = -k; j <= k; j++) {
          const idx = i + j;
          if (idx >= 0 && idx < n) { s += signal[idx]; c++; }
        }
        sm[i] = s / c;
      }

      // Find peaks above threshold
      let max = 0;
      for (let i = 0; i < n; i++) if (sm[i] > max) max = sm[i];
      if (max <= 0) return null;

      const thr = max * 0.45;
      const peaks = [];
      for (let i = 2; i < n - 2; i++) {
        if (sm[i] > thr && sm[i] > sm[i-1] && sm[i] > sm[i+1]) peaks.push(i);
      }
      if (peaks.length < 6) return null;

      // Distances between consecutive peaks
      const ds = [];
      for (let i = 1; i < peaks.length; i++) ds.push(peaks[i] - peaks[i-1]);

      // Filter plausible grid spacings (avoid tiny noise)
      const filtered = ds.filter(d => d >= 10 && d <= 180);
      if (filtered.length < 4) return null;

      // Median
      filtered.sort((a,b)=>a-b);
      return filtered[Math.floor(filtered.length / 2)];
    }

    function estimateConfidence(signal, spacingPx) {
      // Measures how “regular” the peaks are around spacingPx
      if (!spacingPx) return 0;
      const n = signal.length;

      // Build autocorr-like score: sum of signal[i]*signal[i+spacing]
      let sum = 0, sumShift = 0;
      for (let i = 0; i < n - spacingPx; i++) {
        const a = signal[i];
        const b = signal[i + spacingPx];
        sum += a * b;
        sumShift += a * a;
      }
      if (sumShift <= 0) return 0;

      // Normalize into ~0..1
      const r = sum / sumShift;
      return Math.max(0, Math.min(1, r));
    }
  }

  // ---- Fallback calibration: 2 taps = 1 inch
  function startCalibration() {
    calMode = true;
    calA = null;

    // Force scale to none until we lock it
    scale = { mode: "none", inPerPxX: null, inPerPxY: null, confidence: 0 };

    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function applyCalibration(a, b) {
    const dx = Math.abs(b.ix - a.ix);
    const dy = Math.abs(b.iy - a.iy);

    // User should tap 1 inch apart: we accept either horizontal OR vertical (whichever is larger)
    const px = Math.max(dx, dy);
    if (px < 20) return false;

    const inPerPx = 1 / px;
    scale = {
      mode: "cal",
      inPerPxX: inPerPx,
      inPerPxY: inPerPx,
      confidence: 1
    };

    calMode = false;
    calA = null;

    setInstruction();
    setStatus();
    renderDots();
    return true;
  }

  // ---- Tap pipeline
  function addTapPoint(pt) {
    if (!elImg.src) return;
    if (resultsLocked) return;

    // Calibration taps override everything
    if (calMode) {
      if (!calA) {
        calA = pt;
        setInstruction();
        renderDots();
        return;
      }
      const ok = applyCalibration(calA, pt);
      if (!ok) {
        // reset cal and keep trying
        calA = null;
        setInstruction();
        renderDots();
      }
      return;
    }

    if (!bull) {
      bull = pt;
      holes = [];
      resetResultsUI();
      unlockResults();
      setInstruction();
      setStatus();
      renderDots();
      return;
    }

    holes.push(pt);
    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---- Pointer handlers (scroll-safe)
  function onPointerDown(e) {
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptrDown = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      moved: false,
    };
  }

  function onPointerMove(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;

    const dx = e.clientX - ptrDown.x;
    const dy = e.clientY - ptrDown.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) ptrDown.moved = true;
  }

  function onPointerUp(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;

    const elapsed = Date.now() - ptrDown.t;
    const moved = ptrDown.moved;
    ptrDown = null;

    if (moved) return;
    if (elapsed > TAP_TIME_MS) return;

    addTapPoint(clientToImagePoint(e.clientX, e.clientY));
  }

  function onPointerCancel(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    ptrDown = null;
  }

  // ---- Compute + Render (using inches-per-pixel, not paper assumptions)
  function computeAndRender() {
    if (!bull || holes.length === 0) return;
    if (!scale.inPerPxX || !scale.inPerPxY) return; // never guess

    const poib = meanPointNorm(holes);

    // Use NATURAL PIXELS for inches mapping (device-proof)
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;

    const bullPxX = bull.nx * iw;
    const bullPxY = bull.ny * ih;

    const poibPxX = poib.nx * iw;
    const poibPxY = poib.ny * ih;

    // correction vector = bull - poib (pixels)
    const dxPx = bullPxX - poibPxX;
    const dyPx = bullPxY - poibPxY;

    // convert to inches using scale
    const dxIn = dxPx * scale.inPerPxX;
    const dyIn = dyPx * scale.inPerPxY;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    if (!truthGate(dxIn, dyIn, windDir, elevDir)) {
      resetResultsUI();
      elWindDir.textContent = "DIRECTION ERROR";
      elWindVal.textContent = "LOCKED";
      elElevDir.textContent = "DIRECTION ERROR";
      elElevVal.textContent = "LOCKED";
      elDownloadSEC.disabled = true;
      resultsLocked = false;
      setStatus();
      return;
    }

    const ipm = inchesPerMOA(DISTANCE_YDS);
    const windClicks = (Math.abs(dxIn) / ipm) / CLICK_MOA;
    const elevClicks = (Math.abs(dyIn) / ipm) / CLICK_MOA;

    elWindDir.textContent = windDir;
    elWindVal.textContent = `${fmt2(windClicks)} clicks`;

    elElevDir.textContent = elevDir;
    elElevVal.textContent = `${fmt2(elevClicks)} clicks`;

    // Arrow glyphs match direction
    if (elWindArrow) elWindArrow.textContent = windDir === "LEFT" ? "←" : "→";
    if (elElevArrow) elElevArrow.textContent = elevDir === "UP" ? "↑" : "↓";

    elDownloadSEC.disabled = false;
    lockResults();
  }

  // ---- Vendor load
  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;
      vendor = await res.json();

      const name = vendor?.name || "—";
      elVendorName.textContent = name;
      elVendorNameMini.textContent = name;

      if (vendor?.logoPath) {
        elVendorLogo.src = vendor.logoPath;
        elVendorLogoMini.src = vendor.logoPath;
        elVendorLogo.style.display = "block";
        elVendorLogoMini.style.display = "block";

        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      } else {
        elVendorLogo.style.display = "none";
        elVendorLogoMini.style.display = "none";
      }

      if (vendor?.website) {
        elVendorPill.style.cursor = "pointer";
        elVendorPill.title = vendor.website;
        elVendorPill.onclick = () => window.open(vendor.website, "_blank", "noopener,noreferrer");
      }
    } catch {}
  }

  // ---- File load
  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetAllState() {
    bull = null;
    holes = [];
    resultsLocked = false;

    calMode = false;
    calA = null;

    scale = { mode: "none", inPerPxX: null, inPerPxY: null, confidence: 0 };

    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function onFileSelected(file) {
    if (!file) return;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = async () => {
      elTapLayer.classList.add("active");
      resetAllState();

      // Attempt auto-detect scale
      await detectGridScale();

      // If auto is low, we allow Fix. If it fully failed, we require Fix.
      setInstruction();
      setStatus();
      renderDots();
    };

    elImg.src = objectUrl;
  }

  // ---- Undo / Clear
  function undo() {
    if (calMode) {
      // Undo calibration taps first
      if (calA) calA = null;
      else calMode = false;
      setInstruction(); setStatus(); renderDots();
      return;
    }

    if (holes.length) {
      holes.pop();
      unlockResults();
      resetResultsUI();
    } else if (bull) {
      bull = null;
      unlockResults();
      resetResultsUI();
    }
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearAll() {
    bull = null;
    holes = [];
    unlockResults();
    resetResultsUI();

    // Keep the detected scale (pilot-friendly) unless user hits Fix Scale
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---- Wires
  elCam.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
    // clear the other input so it can re-pick same file later
    try { elLib.value = ""; } catch {}
  });

  elLib.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
    try { elCam.value = ""; } catch {}
  });

  elUndo.addEventListener("click", () => {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }
    undo();
  });

  elClear.addEventListener("click", () => {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }
    clearAll();
  });

  elShow.addEventListener("click", () => {
    computeAndRender();
  });

  elFixScaleBtn?.addEventListener("click", () => {
    // Force fallback calibration
    startCalibration();
  });

  // Pointer events on tap layer
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // ---- Init
  loadVendor();
  resetAllState();
})();
