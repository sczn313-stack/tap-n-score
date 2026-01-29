/* ============================================================
   index.js (FULL REPLACEMENT) — Baker 23×35 Grid Pilot
   Declared Geometry Mode (no grid lock taps)

   - Shooter flow: Upload → Tap bull → Tap holes → Show Results
   - Inches derived from known target dimensions mapped to image pixels
   - Direction truth: Up is up, Right is right (dial directions)
   - Dot size fixed at 10
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // DOM
  const elFile = $("photoInput");
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

  // Constants
  const DOT_PX = 10;
  const YARDS_PER_METER = 1.0936132983;

  // DECLARED TARGET DIMENSIONS (Baker Pilot)
  // Landscape vs portrait doesn’t matter as long as the photo contains the full page.
  const TARGET_W_IN = 23.0;
  const TARGET_H_IN = 35.0;

  const DEFAULT_DISTANCE_YDS = 100;
  const DEFAULT_CLICK_MOA = 0.25;

  // State
  const state = {
    objectUrl: null,
    imgLoaded: false,

    // view transform
    scale: 1,
    minScale: 1,
    maxScale: 6,
    panX: 0,
    panY: 0,

    // touch
    touches: new Map(),
    lastPinchDist: null,
    lastPinchMid: null,
    lastPanPoint: null,

    // taps in IMAGE PIXEL SPACE (natural coords)
    taps: [], // [0]=bull, [1+]=holes

    // units and MOMA
    unit: "in",      // "in" or "m" (display choice for distance only)
    distanceYds: DEFAULT_DISTANCE_YDS,
    clickMoa: DEFAULT_CLICK_MOA,
  };

  // Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setInstruction(t) { elInstruction.textContent = t; }
  function setTapCount() { elTapCount.textContent = String(state.taps.length); }
  function clearSEC() { elSEC.innerHTML = ""; }

  function safeRevokeUrl() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
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
    state.minScale = state.scale;
    state.panX = (wrapR.width - iw * state.scale) / 2;
    state.panY = (wrapR.height - ih * state.scale) / 2;
    applyTransform();
  }

  // screen -> image px
  function screenToImagePx(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    const xInWrap = clientX - r.left;
    const yInWrap = clientY - r.top;
    return {
      x: (xInWrap - state.panX) / state.scale,
      y: (yInWrap - state.panY) / state.scale,
    };
  }

  function redrawDots() {
    elDots.innerHTML = "";

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
      d.style.border = "2px solid rgba(0,0,0,0.55)";

      if (idx === 0) {
        // bull
        d.style.background = "rgba(80,170,255,0.95)";
      } else {
        // holes
        d.style.background = "rgba(255,70,70,0.92)";
        const num = document.createElement("div");
        num.textContent = String(idx);
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

  function stepHint() {
    if (!state.imgLoaded) return "Upload photo → Tap bull → Tap bullet holes → Show Results.";
    if (state.taps.length === 0) return "Step 1: Tap the bull (aim point).";
    if (state.taps.length === 1) return "Step 2: Tap your bullet holes.";
    return "Tap more holes, then Show Results.";
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
      state.distanceYds = (state.unit === "m") ? d * YARDS_PER_METER : d;
    }
  }

  function writeStateToMomaInputs() {
    elDistanceInput.value =
      state.unit === "m" ? fmt2(state.distanceYds / YARDS_PER_METER) : fmt2(state.distanceYds);
    elClickInput.value = fmt2(state.clickMoa);
  }

  function inchesPerMOA(distanceYds) {
    return (distanceYds * 1.047) / 100;
  }

  // Declared-geometry conversion: px -> inches
  function pxToInX(px) {
    const iw = elImg.naturalWidth || 1;
    return (px / iw) * TARGET_W_IN;
  }
  function pxToInY(px) {
    const ih = elImg.naturalHeight || 1;
    return (px / ih) * TARGET_H_IN;
  }

  function computeSEC() {
    if (!state.imgLoaded) return { ok: false, err: "Upload a target photo first." };
    if (state.taps.length < 2) return { ok: false, err: "Tap the bull and at least 1 bullet hole." };

    const bull = state.taps[0];
    const hits = state.taps.slice(1);

    // POIB in pixels
    const poibPx = hits.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    poibPx.x /= hits.length;
    poibPx.y /= hits.length;

    // Convert pixel deltas to inches (target-space)
    // X: right positive
    // Y: up positive (invert because screen Y down)
    const poibX_in = pxToInX(poibPx.x - bull.x);
    const poibY_in = -pxToInY(poibPx.y - bull.y);

    // Correction = bull - poib = negative of POIB offset
    const corrX_in = -poibX_in;
    const corrY_in = -poibY_in;

    const dirX = corrX_in >= 0 ? "RIGHT" : "LEFT";
    const dirY = corrY_in >= 0 ? "UP" : "DOWN";

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
      targetW: TARGET_W_IN,
      targetH: TARGET_H_IN,
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
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">POIB (in)</div>
            <div style="font-weight:900; font-size:26px; margin-top:6px;">
              X ${fmt2(res.poibX_in)} • Y ${fmt2(res.poibY_in)}
            </div>
          </div>

          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">Correction (Bull − POIB) (in)</div>
            <div style="font-weight:900; font-size:26px; margin-top:6px;">
              ΔX ${fmt2(res.corrX_in)} • ΔY ${fmt2(res.corrY_in)}
            </div>
          </div>

          <div style="padding:12px; border:1px solid rgba(255,255,255,0.10); border-radius:16px;">
            <div style="color:rgba(255,255,255,0.70); font-weight:900; font-size:12px;">Dial</div>
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
          Declared Geometry: ${fmt2(res.targetW)}" × ${fmt2(res.targetH)}"
        </div>
      </div>
    `;
  }

  // Pointer/touch interactions (pinch + pan + tap)
  function onPointerDown(e) {
    if (!state.imgLoaded) return;

    if (e.pointerType === "touch") {
      elWrap.setPointerCapture(e.pointerId);
      state.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (state.touches.size === 1) state.lastPanPoint = { x: e.clientX, y: e.clientY };

      if (state.touches.size === 2) {
        const pts = Array.from(state.touches.values());
        state.lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        state.lastPinchMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      }
      return;
    }

    if (e.pointerType === "mouse") addTapFromClient(e.clientX, e.clientY);
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
    if (state.touches.size < 2) { state.lastPinchDist = null; state.lastPinchMid = null; }
    if (state.touches.size === 0) state.lastPanPoint = null;
  }

  // Single-finger quick tap detection for touch
  let touchTapCandidate = null;

  function onTouchStart(e) {
    if (!state.imgLoaded) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchTapCandidate = { x: t.clientX, y: t.clientY, time: Date.now() };
    } else touchTapCandidate = null;
  }

  function onTouchEnd(e) {
    if (!state.imgLoaded) return;
    if (!touchTapCandidate) return;

    const dt = Date.now() - touchTapCandidate.time;
    const ct = e.changedTouches && e.changedTouches[0];
    if (!ct) return;

    const dx = ct.clientX - touchTapCandidate.x;
    const dy = ct.clientY - touchTapCandidate.y;
    const moved = Math.hypot(dx, dy) > 8;

    if (dt < 350 && !moved) addTapFromClient(ct.clientX, ct.clientY);
    touchTapCandidate = null;
  }

  function addTapFromClient(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return;

    const p = screenToImagePx(clientX, clientY);

    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    if (p.x < 0 || p.y < 0 || p.x > iw || p.y > ih) return;

    state.taps.push(p);
    redrawDots();
    setInstruction(stepHint());
    clearSEC();
  }

  // File chosen
  function onFileChosen() {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    safeRevokeUrl();
    state.objectUrl = URL.createObjectURL(f);

    state.imgLoaded = false;
    state.taps = [];
    redrawDots();
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

  // Buttons
  elUndo.addEventListener("click", () => {
    if (state.taps.length === 0) return;
    state.taps.pop();
    redrawDots();
    setInstruction(stepHint());
    clearSEC();
  });

  elClear.addEventListener("click", () => {
    state.taps = [];
    redrawDots();
    setInstruction(stepHint());
    clearSEC();

    // reset per-session units back to default (your preference)
    state.unit = "in";
    elUnitToggle.checked = false;
    setUnitsUI();
    state.distanceYds = DEFAULT_DISTANCE_YDS;
    state.clickMoa = DEFAULT_CLICK_MOA;
    writeStateToMomaInputs();
  });

  elShow.addEventListener("click", () => {
    const res = computeSEC();
    if (!res.ok) { setInstruction(res.err); return; }
    renderSEC(res);
    setInstruction("SEC ready. Undo/Clear or upload a new photo.");
  });

  elApply.addEventListener("click", () => {
    readMomaInputsToState();
    if (elSEC.innerHTML.trim()) {
      const res = computeSEC();
      if (res.ok) renderSEC(res);
    }
  });

  elUnitToggle.addEventListener("change", () => {
    state.unit = elUnitToggle.checked ? "m" : "in";
    setUnitsUI();
    writeStateToMomaInputs();

    if (elSEC.innerHTML.trim()) {
      const res = computeSEC();
      if (res.ok) renderSEC(res);
    }
  });

  // Vendor buttons (set your real URLs anytime)
  elBakerCatalog.href = "https://bakertargets.com/";
  elBakerProduct.href = "https://bakertargets.com/";

  // Init
  function init() {
    state.distanceYds = DEFAULT_DISTANCE_YDS;
    state.clickMoa = DEFAULT_CLICK_MOA;
    state.unit = "in";

    elUnitToggle.checked = false;
    setUnitsUI();
    writeStateToMomaInputs();

    setInstruction(stepHint());
    setTapCount();

    elFile.addEventListener("change", onFileChosen);

    elWrap.addEventListener("pointerdown", onPointerDown, { passive: true });
    elWrap.addEventListener("pointermove", onPointerMove, { passive: true });
    elWrap.addEventListener("pointerup", onPointerUp, { passive: true });
    elWrap.addEventListener("pointercancel", onPointerUp, { passive: true });

    elWrap.addEventListener("touchstart", onTouchStart, { passive: true });
    elWrap.addEventListener("touchend", onTouchEnd, { passive: true });

    // Stop page scroll while interacting inside viewport
    elWrap.addEventListener("touchmove", (e) => { e.preventDefault(); }, { passive: false });
  }

  init();
})();
