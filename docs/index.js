/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Baker 23×35 1" Grid Pilot
   Fixes:
   - Direction authority uses real-world axes:
       X: right = +, left = -
       Y: up = +, down = -
     (browser pixel Y is inverted when computing corrections)
   - Dot size fixed at 10 (no user control)
   - Stable iOS file loading + immediate image render
   - Grid lock calibration: Bull + X(A,B) + Y(A,B) then hits
============================================================ */

(() => {
  // ---------- DOM
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elUploadBtn = $("uploadBtn");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elUndo = $("undoTapsBtn");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");
  const elSEC = $("secPanel");
  const elInstruction = $("instructionLine");

  const elUnitToggle = $("unitToggle");
  const elUnitLabel = $("unitLabel");
  const elDistanceInput = $("distanceInput");
  const elDistanceUnit = $("distanceUnit");
  const elClickInput = $("clickInput");
  const elApply = $("momaApplyBtn");

  const elBakerCatalog = $("bakerCatalogBtn");
  const elBakerProduct = $("bakerProductBtn");

  // ---------- Constants
  const DOT_PX = 10; // locked
  const YARDS_PER_METER = 1.0936132983;

  // Defaults (pilot standard)
  const DEFAULT_DISTANCE_YDS = 100;
  const DEFAULT_CLICK_MOA = 0.25;

  // Tap roles
  // 0: bull
  // 1: X cal A
  // 2: X cal B (1" to the right)
  // 3: Y cal A
  // 4: Y cal B (1" down)
  // 5+: hits
  const REQUIRED_BASE_TAPS = 5;

  // ---------- State
  const state = {
    objectUrl: null,
    imgLoaded: false,

    // transforms
    scale: 1,
    minScale: 1,
    maxScale: 6,
    panX: 0,
    panY: 0,

    // touch gesture state
    touches: new Map(),
    lastPinchDist: null,
    lastPinchMid: null,
    lastPanPoint: null,

    // taps stored in IMAGE PIXEL SPACE (natural image coords)
    taps: [], // {x,y}
    // calibration
    pxPerInX: null,
    pxPerInY: null,

    // units per session
    unit: "in", // "in" or "m"
    distanceYds: DEFAULT_DISTANCE_YDS,
    clickMoa: DEFAULT_CLICK_MOA,
  };

  // ---------- Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(state.taps.length);
  }

  function clearSEC() {
    elSEC.innerHTML = "";
  }

  function safeRevokeUrl() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
  }

  function resetSessionVisuals() {
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    state.lastPinchDist = null;
    state.lastPinchMid = null;
    state.lastPanPoint = null;
    applyTransform();
    redrawDots();
    clearSEC();
  }

  // Convert screen point -> image pixel point
  function screenToImagePx(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    const xInWrap = clientX - r.left;
    const yInWrap = clientY - r.top;

    // undo pan/scale (transform origin 0,0)
    const xImg = (xInWrap - state.panX) / state.scale;
    const yImg = (yInWrap - state.panY) / state.scale;
    return { x: xImg, y: yImg };
  }

  function applyTransform() {
    elImg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
    elDots.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
  }

  function fitImageToWrap() {
    if (!state.imgLoaded) return;
    const wrapR = elWrap.getBoundingClientRect();
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;

    const sx = wrapR.width / iw;
    const sy = wrapR.height / ih;
    const s = Math.min(sx, sy);

    state.scale = clamp(s, 0.1, state.maxScale);
    state.minScale = state.scale; // lock minimum to "fit"
    state.panX = (wrapR.width - iw * state.scale) / 2;
    state.panY = (wrapR.height - ih * state.scale) / 2;
    applyTransform();
  }

  function redrawDots() {
    elDots.innerHTML = "";

    // size in screen px (not scaled), so divide by scale
    const r = DOT_PX / state.scale;

    state.taps.forEach((p, idx) => {
      const d = document.createElement("div");
      d.style.position = "absolute";
      d.style.left = `${p.x - r}px`;
      d.style.top = `${p.y - r}px`;
      d.style.width = `${r * 2}px`;
      d.style.height = `${r * 2}px`;
      d.style.borderRadius = "999px";
      d.style.pointerEvents = "none";

      // Color roles
      // bull = blue
      // cal points = yellow
      // hits = red
      if (idx === 0) {
        d.style.background = "rgba(80,170,255,0.95)";
        d.style.border = "2px solid rgba(0,0,0,0.55)";
      } else if (idx >= 1 && idx <= 4) {
        d.style.background = "rgba(255,210,0,0.92)";
        d.style.border = "2px solid rgba(0,0,0,0.55)";
      } else {
        d.style.background = "rgba(255,70,70,0.92)";
        d.style.border = "2px solid rgba(0,0,0,0.55)";

        const num = document.createElement("div");
        num.textContent = String(idx - 4);
        num.style.position = "absolute";
        num.style.left = "50%";
        num.style.top = "50%";
        num.style.transform = "translate(-50%,-52%)";
        num.style.fontSize = `${Math.max(10 / state.scale, 8)}px`;
        num.style.fontWeight = "900";
        num.style.color = "rgba(255,255,255,0.95)";
        num.style.textShadow = "0 2px 6px rgba(0,0,0,0.7)";
        d.appendChild(num);
      }

      elDots.appendChild(d);
    });

    setTapCount();
  }

  function updateCalibration() {
    state.pxPerInX = null;
    state.pxPerInY = null;

    if (state.taps.length >= REQUIRED_BASE_TAPS) {
      const xA = state.taps[1];
      const xB = state.taps[2];
      const yA = state.taps[3];
      const yB = state.taps[4];
      const pxX = dist(xA, xB);
      const pxY = dist(yA, yB);

      // Guard against junk taps
      if (pxX > 5) state.pxPerInX = pxX; // 1 inch
      if (pxY > 5) state.pxPerInY = pxY; // 1 inch
    }
  }

  function gridLockStatus() {
    const ok = Number.isFinite(state.pxPerInX) && Number.isFinite(state.pxPerInY);
    return ok ? "ON" : "OFF";
  }

  function stepHint() {
    const n = state.taps.length;
    if (!state.imgLoaded) return 'Upload your Baker 23×35 1-inch grid target photo to begin.';
    if (n === 0) return "Step 1: Tap the bull (center aim point).";
    if (n === 1) return "Step 2: Tap a grid intersection (X cal point A).";
    if (n === 2) return 'Step 3: Tap the next grid intersection exactly 1 square RIGHT from A (X cal point B).';
    if (n === 3) return "Step 4: Tap a grid intersection (Y cal point A).";
    if (n === 4) return 'Step 5: Tap the next grid intersection exactly 1 square DOWN from A (Y cal point B).';
    return `Grid Lock: ${gridLockStatus()} — Tap bullet holes, then Show Results.`;
  }

  function setUnitsUI() {
    const isMeters = state.unit === "m";
    elUnitLabel.textContent = isMeters ? "M" : "IN";
    elDistanceUnit.textContent = isMeters ? "m" : "yd";
  }

  function readMomaInputsToState() {
    const d = Number(elDistanceInput.value);
    const c = Number(elClickInput.value);

    if (Number.isFinite(c) && c > 0) state.clickMoa = c;

    if (Number.isFinite(d) && d > 0) {
      if (state.unit === "m") {
        // store internally as yards
        state.distanceYds = d * YARDS_PER_METER;
      } else {
        state.distanceYds = d;
      }
    }
  }

  function writeStateToMomaInputs() {
    if (state.unit === "m") {
      elDistanceInput.value = fmt2(state.distanceYds / YARDS_PER_METER);
    } else {
      elDistanceInput.value = fmt2(state.distanceYds);
    }
    elClickInput.value = fmt2(state.clickMoa);
  }

  function inchesPerMOA(distanceYds) {
    // 1 MOA ≈ 1.047 inches at 100 yards
    return (distanceYds * 1.047) / 100;
  }

  function computeSEC() {
    updateCalibration();

    if (!state.imgLoaded) {
      return { ok: false, err: "Upload a target photo first." };
    }
    if (gridLockStatus() !== "ON") {
      return { ok: false, err: "Grid lock required: complete the 1-inch X and Y calibration taps." };
    }
    if (state.taps.length <= REQUIRED_BASE_TAPS) {
      return { ok: false, err: "Tap at least 1 bullet hole after calibration." };
    }

    const bull = state.taps[0];
    const hits = state.taps.slice(5);

    // POIB in IMAGE PIXELS
    const poib = hits.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    poib.x /= hits.length;
    poib.y /= hits.length;

    // POIB offset from bull in inches with real-world axes:
    // X: right positive (same as pixels)
    // Y: up positive (invert pixel Y)
    const poibX_in = (poib.x - bull.x) / state.pxPerInX;
    const poibY_in = (bull.y - poib.y) / state.pxPerInY; // INVERTED so UP is +

    // Correction (Bull - POIB) in inches, same axis convention
    const corrX_in = -poibX_in;
    const corrY_in = -poibY_in;

    // Directions from correction signs
    const dirX = corrX_in >= 0 ? "RIGHT" : "LEFT";
    const dirY = corrY_in >= 0 ? "UP" : "DOWN";

    // MOA + clicks
    const ipm = inchesPerMOA(state.distanceYds);
    const moaX = Math.abs(corrX_in) / ipm;
    const moaY = Math.abs(corrY_in) / ipm;

    const clicksX = moaX / state.clickMoa;
    const clicksY = moaY / state.clickMoa;

    return {
      ok: true,
      hitsCount: hits.length,
      poibX_in,
      poibY_in,
      corrX_in,
      corrY_in,
      dirX,
      dirY,
      moaX,
      moaY,
      clicksX,
      clicksY,
      pxPerInX: state.pxPerInX,
      pxPerInY: state.pxPerInY,
    };
  }

  function renderSEC(res) {
    const distanceShown = state.unit === "m"
      ? `${fmt2(state.distanceYds / YARDS_PER_METER)} m`
      : `${fmt2(state.distanceYds)} yds`;

    const clickShown = `${fmt2(state.clickMoa)} MOA/click`;

    elSEC.innerHTML = `
      <div style="
        padding:12px;
        border:1px solid rgba(255,255,255,0.10);
        border-radius:18px;
        background: rgba(255,255,255,0.05);
        box-shadow: 0 18px 45px rgba(0,0,0,0.55);
      ">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
          <div style="font-weight:900; font-size:18px; letter-spacing:0.2px;">Shooter Experience Card</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900; color:rgba(255,255,255,0.85);">True MOA</div>
            <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900;">${distanceShown}</div>
            <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900;">${clickShown}</div>
          </div>
        </div>

        <div style="margin-top:12px; display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px;">
          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">Verified Hits</div>
            <div style="font-weight:900; font-size:28px; margin-top:6px;">${res.hitsCount}</div>
          </div>

          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">POIB (${state.unit})</div>
            <div style="font-weight:900; font-size:26px; margin-top:6px;">
              X ${fmt2(res.poibX_in)} • Y ${fmt2(res.poibY_in)}
            </div>
          </div>

          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">Correction (Bull − POIB) (${state.unit})</div>
            <div style="font-weight:900; font-size:26px; margin-top:6px;">
              ΔX ${fmt2(res.corrX_in)} • ΔY ${fmt2(res.corrY_in)}
            </div>
          </div>

          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">Directions</div>
            <div style="font-weight:900; font-size:26px; margin-top:6px;">
              ${res.dirX} • ${res.dirY}
            </div>
          </div>

          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">MOA</div>
            <div style="font-weight:900; font-size:26px; margin-top:6px;">
              X ${fmt2(res.moaX)} • Y ${fmt2(res.moaY)}
            </div>
          </div>

          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">Clicks</div>
            <div style="font-weight:900; font-size:26px; margin-top:6px;">
              X ${fmt2(res.clicksX)} • Y ${fmt2(res.clicksY)}
            </div>
          </div>
        </div>

        <div style="margin-top:10px; color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">
          1" grid detected: ${fmt2(res.pxPerInX)} px/in (X) • ${fmt2(res.pxPerInY)} px/in (Y)
        </div>
      </div>
    `;
  }

  // ---------- Touch / gesture handlers
  function onPointerDown(e) {
    // ignore if no image yet
    if (!state.imgLoaded) return;

    // Track touches for pinch/pan
    if (e.pointerType === "touch") {
      elWrap.setPointerCapture(e.pointerId);
      state.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.touches.size === 1) {
        state.lastPanPoint = { x: e.clientX, y: e.clientY };
      }
      if (state.touches.size === 2) {
        const pts = Array.from(state.touches.values());
        state.lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        state.lastPinchMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      }
      return;
    }

    // Mouse = tap
    if (e.pointerType === "mouse") {
      addTapFromEvent(e);
    }
  }

  function onPointerMove(e) {
    if (!state.imgLoaded) return;
    if (e.pointerType !== "touch") return;

    if (!state.touches.has(e.pointerId)) return;
    state.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.touches.size === 1 && state.lastPanPoint) {
      const p = Array.from(state.touches.values())[0];
      const dx = p.x - state.lastPanPoint.x;
      const dy = p.y - state.lastPanPoint.y;
      state.panX += dx;
      state.panY += dy;
      state.lastPanPoint = { x: p.x, y: p.y };
      applyTransform();
      return;
    }

    if (state.touches.size === 2 && state.lastPinchDist && state.lastPinchMid) {
      const pts = Array.from(state.touches.values());
      const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };

      const scaleFactor = d / state.lastPinchDist;
      const newScale = clamp(state.scale * scaleFactor, state.minScale, state.maxScale);

      // Zoom around midpoint
      const wrapR = elWrap.getBoundingClientRect();
      const mx = mid.x - wrapR.left;
      const my = mid.y - wrapR.top;

      const preX = (mx - state.panX) / state.scale;
      const preY = (my - state.panY) / state.scale;

      state.scale = newScale;

      const postX = preX * state.scale + state.panX;
      const postY = preY * state.scale + state.panY;

      state.panX += mx - postX;
      state.panY += my - postY;

      state.lastPinchDist = d;
      state.lastPinchMid = mid;

      applyTransform();
    }
  }

  function onPointerUp(e) {
    if (e.pointerType !== "touch") return;
    state.touches.delete(e.pointerId);
    if (state.touches.size < 2) {
      state.lastPinchDist = null;
      state.lastPinchMid = null;
    }
    if (state.touches.size === 0) {
      state.lastPanPoint = null;
    }
  }

  // Tap with touch = single finger quick tap (no move)
  let touchTapCandidate = null;

  function onTouchStart(e) {
    if (!state.imgLoaded) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchTapCandidate = { id: t.identifier, x: t.clientX, y: t.clientY, time: Date.now() };
    } else {
      touchTapCandidate = null;
    }
  }
  function onTouchEnd(e) {
    if (!state.imgLoaded) return;
    if (!touchTapCandidate) return;

    // If ended quickly and didn’t move much, count as tap
    const dt = Date.now() - touchTapCandidate.time;
    const moved = (() => {
      // best effort: use changedTouches end position
      const ct = e.changedTouches && e.changedTouches[0];
      if (!ct) return true;
      const dx = ct.clientX - touchTapCandidate.x;
      const dy = ct.clientY - touchTapCandidate.y;
      return Math.hypot(dx, dy) > 8;
    })();

    if (dt < 350 && !moved) {
      const ct = e.changedTouches[0];
      addTapFromClient(ct.clientX, ct.clientY);
    }
    touchTapCandidate = null;
  }

  function addTapFromEvent(e) {
    addTapFromClient(e.clientX, e.clientY);
  }

  function addTapFromClient(clientX, clientY) {
    // avoid tapping outside wrap
    const r = elWrap.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return;

    const p = screenToImagePx(clientX, clientY);

    // guard: must be within image bounds
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    if (p.x < 0 || p.y < 0 || p.x > iw || p.y > ih) return;

    state.taps.push(p);
    updateCalibration();
    redrawDots();
    setInstruction(stepHint());
    clearSEC();
  }

  // Double tap to reset view
  let lastTapTime = 0;
  elWrap.addEventListener("click", (e) => {
    // mouse click already adds tap in pointerdown; this click is just for double-tap reset
    const now = Date.now();
    if (now - lastTapTime < 260) {
      fitImageToWrap();
      applyTransform();
    }
    lastTapTime = now;
  });

  // ---------- File load
  function onFileChosen() {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    safeRevokeUrl();
    state.objectUrl = URL.createObjectURL(f);

    state.imgLoaded = false;
    state.taps = [];
    state.pxPerInX = null;
    state.pxPerInY = null;
    setTapCount();
    clearSEC();

    elImg.onload = () => {
      state.imgLoaded = true;
      fitImageToWrap();
      redrawDots();
      setInstruction(stepHint());
    };
    elImg.onerror = () => {
      state.imgLoaded = false;
      setInstruction("Image failed to load. Try a different photo.");
    };

    elImg.src = state.objectUrl;
  }

  // ---------- Buttons
  elUndo.addEventListener("click", () => {
    if (state.taps.length === 0) return;
    state.taps.pop();
    updateCalibration();
    redrawDots();
    setInstruction(stepHint());
    clearSEC();
  });

  elClear.addEventListener("click", () => {
    state.taps = [];
    state.pxPerInX = null;
    state.pxPerInY = null;
    redrawDots();
    setInstruction(stepHint());
    clearSEC();
  });

  elShow.addEventListener("click", () => {
    const res = computeSEC();
    if (!res.ok) {
      setInstruction(res.err);
      return;
    }
    renderSEC(res);
    setInstruction("SEC ready. You can Undo/Clear or upload a new photo.");
  });

  elApply.addEventListener("click", () => {
    readMomaInputsToState();
    // refresh SEC if already showing
    if (elSEC.innerHTML.trim()) {
      const res = computeSEC();
      if (res.ok) renderSEC(res);
    }
  });

  elUnitToggle.addEventListener("change", () => {
    // NOTE: You asked: meters applies only to this instance; clearing resets to default.
    state.unit = elUnitToggle.checked ? "m" : "in";
    setUnitsUI();
    writeStateToMomaInputs();

    if (elSEC.innerHTML.trim()) {
      const res = computeSEC();
      if (res.ok) renderSEC(res);
    }
  });

  // Reset unit back to IN when cleared (your rule)
  const originalClear = elClear.onclick;
  elClear.addEventListener("click", () => {
    state.unit = "in";
    elUnitToggle.checked = false;
    setUnitsUI();
    state.distanceYds = DEFAULT_DISTANCE_YDS;
    state.clickMoa = DEFAULT_CLICK_MOA;
    writeStateToMomaInputs();
  });

  // ---------- Vendor buttons (set your URLs)
  // Put your real Baker URLs here anytime:
  elBakerCatalog.href = "https://bakertargets.com/";
  elBakerProduct.href = "https://bakertargets.com/";

  // ---------- Init
  function init() {
    // defaults
    state.distanceYds = DEFAULT_DISTANCE_YDS;
    state.clickMoa = DEFAULT_CLICK_MOA;
    state.unit = "in";
    elUnitToggle.checked = false;
    setUnitsUI();
    writeStateToMomaInputs();

    setInstruction(stepHint());
    setTapCount();

    // file handling
    elFile.addEventListener("change", onFileChosen);

    // gestures
    elWrap.addEventListener("pointerdown", onPointerDown, { passive: true });
    elWrap.addEventListener("pointermove", onPointerMove, { passive: true });
    elWrap.addEventListener("pointerup", onPointerUp, { passive: true });
    elWrap.addEventListener("pointercancel", onPointerUp, { passive: true });

    // touch tap detection (single finger)
    elWrap.addEventListener("touchstart", onTouchStart, { passive: true });
    elWrap.addEventListener("touchend", onTouchEnd, { passive: true });

    // Prevent page scroll inside wrap
    elWrap.addEventListener("touchmove", (e) => {
      if (e.touches.length >= 2) return; // allow pinch handling
      // single finger drag should pan, so don't let page scroll
      e.preventDefault();
    }, { passive: false });
  }

  init();
})();
