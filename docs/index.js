/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Baker 23×35 1" Grid Pilot
   Flow:
   1) Upload photo
   2) Grid Lock taps: A (origin), X (1" right), Y (1" down)
   3) Tap bull (aim point)
   4) Tap bullet holes
   5) Show Results -> SEC

   Notes:
   - Dot size fixed at 10 (no user control)
   - Show Results ALWAYS responds (toast if not ready)
   - Y axis: screen-space down is positive
   - Correction vector is (Bull - POIB)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Required IDs (from your HTML)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elUndo = $("undoTapsBtn");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");
  const elInstruction = $("instructionLine");
  const elSec = $("secPanel");

  const elUnitToggle = $("unitToggle");
  const elUnitLabel = $("unitLabel");
  const elDist = $("distanceInput");
  const elDistUnit = $("distanceUnit");
  const elClick = $("clickInput");
  const elApply = $("momaApplyBtn");

  const elCatalog = $("bakerCatalogBtn");
  const elProduct = $("bakerProductBtn");

  // ---- Constants
  const DOT_PX = 10;                 // fixed dot size
  const YARDS_PER_METER = 1.0936133;
  const INCHES_PER_MOA_100Y = 1.047; // True MOA
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");

  // ---- App State
  const state = {
    // session settings
    unit: "in",            // "in" or "m" (display unit)
    distanceYds: 100.0,    // internal base is yards
    clickMoa: 0.25,

    // image + transforms
    objectUrl: null,
    imgNaturalW: 0,
    imgNaturalH: 0,

    // pan/zoom
    scale: 1,
    minScale: 1,
    maxScale: 6,
    panX: 0,
    panY: 0,

    // pointer tracking
    pointers: new Map(),
    isPanning: false,
    lastPan: null,
    lastDist: null,

    // calibration
    gridLocked: false,
    calA: null, // origin
    calX: null, // 1" right
    calY: null, // 1" down
    pxPerInchX: null,
    pxPerInchY: null,

    // targeting
    bull: null,
    holes: [],

    // mode
    step: "upload" // upload | calA | calX | calY | bull | holes | ready
  };

  // ---- Tiny toast helper (so nothing is “silent”)
  let toastTimer = null;
  function toast(msg) {
    // re-use/attach a simple toast div inside wrap
    let t = $("__toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "__toast";
      t.style.position = "fixed";
      t.style.left = "12px";
      t.style.right = "12px";
      t.style.bottom = "70px";
      t.style.zIndex = "999999";
      t.style.padding = "10px 12px";
      t.style.borderRadius = "14px";
      t.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
      t.style.fontSize = "14px";
      t.style.fontWeight = "900";
      t.style.letterSpacing = "0.2px";
      t.style.background = "rgba(0,0,0,0.85)";
      t.style.border = "1px solid rgba(255,255,255,0.18)";
      t.style.color = "rgba(255,255,255,0.95)";
      t.style.boxShadow = "0 18px 45px rgba(0,0,0,0.55)";
      t.style.display = "none";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = "none"), 2200);
  }

  // ---- UI helpers
  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function setStep(step) {
    state.step = step;

    if (step === "upload") {
      setInstruction('Upload your Baker 23×35 1-inch grid target photo to begin.');
    } else if (step === "calA") {
      setInstruction('Step 1: Tap a grid intersection (Cal point A / origin). (Grid Lock: OFF)');
    } else if (step === "calX") {
      setInstruction('Step 2: Tap the next grid intersection exactly 1 square RIGHT from A (X cal point).');
    } else if (step === "calY") {
      setInstruction('Step 3: Tap the next grid intersection exactly 1 square DOWN from A (Y cal point).');
    } else if (step === "bull") {
      setInstruction('Grid Lock: ON. Tap the bull/aim point (center of crosshair).');
    } else if (step === "holes") {
      setInstruction('Tap bullet holes (tap all hits). Then press Show Results.');
    } else if (step === "ready") {
      setInstruction('SEC ready. You can Undo/Clear or upload a new photo.');
    }

    renderDots();
  }

  function updateTapCount() {
    const n =
      (state.calA ? 1 : 0) +
      (state.calX ? 1 : 0) +
      (state.calY ? 1 : 0) +
      (state.bull ? 1 : 0) +
      state.holes.length;
    if (elTapCount) elTapCount.textContent = String(n);
  }

  // ---- Coordinate conversions
  function applyTransform() {
    const t = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
    elImg.style.transform = t;
    elDots.style.transform = t;
  }

  function resetViewToFit() {
    // Fit image inside wrap
    const rect = elWrap.getBoundingClientRect();
    const pad = 8;

    const availW = rect.width - pad * 2;
    const availH = rect.height - pad * 2;

    const s = Math.min(availW / state.imgNaturalW, availH / state.imgNaturalH);
    state.scale = clamp(s, 0.1, state.maxScale);

    // center image
    const imgW = state.imgNaturalW * state.scale;
    const imgH = state.imgNaturalH * state.scale;
    state.panX = (rect.width - imgW) / 2;
    state.panY = (rect.height - imgH) / 2;

    // min scale = fitted scale
    state.minScale = state.scale;

    applyTransform();
  }

  function screenToImage(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    const xInWrap = clientX - r.left;
    const yInWrap = clientY - r.top;

    // reverse pan/scale
    const ix = (xInWrap - state.panX) / state.scale;
    const iy = (yInWrap - state.panY) / state.scale;

    return { x: ix, y: iy };
  }

  function isInsideImage(p) {
    return (
      p.x >= 0 &&
      p.y >= 0 &&
      p.x <= state.imgNaturalW &&
      p.y <= state.imgNaturalH
    );
  }

  // ---- Dots rendering (cal points + bull + holes)
  function dotHTML(p, label, color) {
    const d = document.createElement("div");
    d.style.position = "absolute";
    d.style.left = `${p.x}px`;
    d.style.top = `${p.y}px`;
    d.style.width = `${DOT_PX}px`;
    d.style.height = `${DOT_PX}px`;
    d.style.borderRadius = "999px";
    d.style.transform = "translate(-50%, -50%)";
    d.style.background = color;
    d.style.border = "2px solid rgba(0,0,0,0.65)";
    d.style.boxShadow = "0 8px 18px rgba(0,0,0,0.45)";
    d.style.display = "grid";
    d.style.placeItems = "center";
    d.style.fontSize = "10px";
    d.style.fontWeight = "900";
    d.style.color = "rgba(0,0,0,0.85)";
    d.textContent = label;
    return d;
  }

  function renderDots() {
    elDots.innerHTML = "";

    // Cal points
    if (state.calA) elDots.appendChild(dotHTML(state.calA, "A", "rgba(255, 215, 0, 0.95)"));
    if (state.calX) elDots.appendChild(dotHTML(state.calX, "X", "rgba(255, 215, 0, 0.95)"));
    if (state.calY) elDots.appendChild(dotHTML(state.calY, "Y", "rgba(255, 215, 0, 0.95)"));

    // Bull
    if (state.bull) elDots.appendChild(dotHTML(state.bull, "B", "rgba(0, 180, 255, 0.95)"));

    // Holes
    state.holes.forEach((h, i) => {
      elDots.appendChild(dotHTML(h, String(i + 1), "rgba(255, 70, 70, 0.92)"));
    });

    updateTapCount();
  }

  // ---- Math
  function dist(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.hypot(dx, dy);
  }

  function computeGridLock() {
    // A->X is 1 inch; A->Y is 1 inch
    const pxX = dist(state.calA, state.calX);
    const pxY = dist(state.calA, state.calY);

    if (!(pxX > 5 && pxY > 5)) return false;

    state.pxPerInchX = pxX;
    state.pxPerInchY = pxY;
    state.gridLocked = true;
    return true;
  }

  function centroid(points) {
    const n = points.length;
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / n, y: sy / n };
  }

  function inchesPerMoa(distanceYds) {
    return INCHES_PER_MOA_100Y * (distanceYds / 100.0);
  }

  // ---- SEC render (compact)
  function renderSEC(sec) {
    // compact, no huge block
    elSec.innerHTML = `
      <div style="
        margin-top:10px;
        border:1px solid rgba(255,255,255,0.10);
        border-radius:16px;
        padding:12px;
        background: rgba(0,0,0,0.25);
      ">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
          <div style="font-weight:900; letter-spacing:0.2px; font-size:16px;">Shooter Experience Card</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <span style="padding:6px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900; font-size:12px;">True MOA</span>
            <span style="padding:6px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900; font-size:12px;">${f2(sec.distanceYds)} yds</span>
            <span style="padding:6px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900; font-size:12px;">${f2(sec.clickMoa)} MOA/click</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
          <div style="padding:10px; border:1px solid rgba(255,255,255,0.10); border-radius:14px;">
            <div style="color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">Verified Hits</div>
            <div style="font-weight:900; font-size:22px;">${sec.hits}</div>
          </div>
          <div style="padding:10px; border:1px solid rgba(255,255,255,0.10); border-radius:14px;">
            <div style="color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">POIB (in)</div>
            <div style="font-weight:900; font-size:22px;">X ${f2(sec.poibInX)} • Y ${f2(sec.poibInY)}</div>
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.10); border-radius:14px;">
            <div style="color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">Correction (Bull − POIB) (in)</div>
            <div style="font-weight:900; font-size:22px;">ΔX ${f2(sec.dxIn)} • ΔY ${f2(sec.dyIn)}</div>
          </div>
          <div style="padding:10px; border:1px solid rgba(255,255,255,0.10); border-radius:14px;">
            <div style="color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">Directions</div>
            <div style="font-weight:900; font-size:22px;">${sec.dirX} • ${sec.dirY}</div>
          </div>

          <div style="padding:10px; border:1px solid rgba(255,255,255,0.10); border-radius:14px;">
            <div style="color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">MOA</div>
            <div style="font-weight:900; font-size:22px;">X ${f2(sec.moaX)} • Y ${f2(sec.moaY)}</div>
          </div>
          <div style="padding:10px; border:1px solid rgba(255,255,255,0.10); border-radius:14px;">
            <div style="color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">Clicks</div>
            <div style="font-weight:900; font-size:22px;">X ${f2(sec.clicksX)} • Y ${f2(sec.clicksY)}</div>
          </div>
        </div>

        <div style="margin-top:10px; color:rgba(255,255,255,0.65); font-weight:900; font-size:12px;">
          1" grid detected: ${f2(sec.pxPerInX)} px/in (X) • ${f2(sec.pxPerInY)} px/in (Y)
        </div>
      </div>
    `;
  }

  // ---- Results
  function showResults() {
    if (!state.gridLocked) {
      toast("Grid Lock required first: Tap A, then X (1\" right), then Y (1\" down).");
      return;
    }
    if (!state.bull) {
      toast("Tap the bull first (B).");
      return;
    }
    if (state.holes.length < 1) {
      toast("Tap at least 1 bullet hole.");
      return;
    }

    const poibPx = centroid(state.holes);

    // Inches from bull to POIB (Bull - POIB), using separate X/Y px-per-inch
    const dxIn = (state.bull.x - poibPx.x) / state.pxPerInchX;
    const dyIn = (state.bull.y - poibPx.y) / state.pxPerInchY;

    const dirX = dxIn >= 0 ? "RIGHT" : "LEFT";
    // screen-space Y: positive is DOWN
    const dirY = dyIn >= 0 ? "DOWN" : "UP";

    const inPerMoa = inchesPerMoa(state.distanceYds);
    const moaX = Math.abs(dxIn) / inPerMoa;
    const moaY = Math.abs(dyIn) / inPerMoa;

    const clicksX = moaX / state.clickMoa;
    const clicksY = moaY / state.clickMoa;

    // POIB (in) relative to bull (so it reads meaningful)
    const poibInX = (poibPx.x - state.bull.x) / state.pxPerInchX;
    const poibInY = (poibPx.y - state.bull.y) / state.pxPerInchY;

    renderSEC({
      hits: state.holes.length,
      distanceYds: state.distanceYds,
      clickMoa: state.clickMoa,
      pxPerInX: state.pxPerInchX,
      pxPerInY: state.pxPerInchY,
      poibInX,
      poibInY,
      dxIn,
      dyIn,
      dirX,
      dirY,
      moaX,
      moaY,
      clicksX,
      clicksY
    });

    setStep("ready");
    toast("SEC generated.");
  }

  // ---- Tap handling (calibration -> bull -> holes)
  function handleTap(clientX, clientY) {
    if (!state.imgNaturalW || !state.imgNaturalH) {
      toast("Upload a target photo first.");
      return;
    }
    const p = screenToImage(clientX, clientY);
    if (!isInsideImage(p)) return;

    // Calibration steps
    if (state.step === "calA") {
      state.calA = p;
      setStep("calX");
      return;
    }
    if (state.step === "calX") {
      state.calX = p;
      setStep("calY");
      return;
    }
    if (state.step === "calY") {
      state.calY = p;
      const ok = computeGridLock();
      if (!ok) {
        toast("Grid lock failed — try tapping clean grid intersections (A, X, Y).");
        state.gridLocked = false;
        state.calA = state.calX = state.calY = null;
        setStep("calA");
        return;
      }
      toast("Grid Lock ON (1\" squares).");
      setStep("bull");
      return;
    }

    // After grid lock
    if (state.step === "bull") {
      state.bull = p;
      setStep("holes");
      return;
    }

    if (state.step === "holes" || state.step === "ready") {
      state.holes.push(p);
      renderDots();
      return;
    }
  }

  // ---- Undo/Clear
  function undo() {
    // reverse order: holes -> bull -> calY -> calX -> calA
    if (state.holes.length) {
      state.holes.pop();
      renderDots();
      return;
    }
    if (state.bull) {
      state.bull = null;
      setStep("bull");
      return;
    }
    if (state.calY) {
      state.calY = null;
      state.gridLocked = false;
      setStep("calY");
      return;
    }
    if (state.calX) {
      state.calX = null;
      state.gridLocked = false;
      setStep("calX");
      return;
    }
    if (state.calA) {
      state.calA = null;
      state.gridLocked = false;
      setStep("calA");
      return;
    }
  }

  function clearAll() {
    state.gridLocked = false;
    state.calA = state.calX = state.calY = null;
    state.pxPerInchX = state.pxPerInchY = null;
    state.bull = null;
    state.holes = [];
    elSec.innerHTML = "";
    setStep(state.imgNaturalW ? "calA" : "upload");
    renderDots();
    toast("Cleared.");
  }

  // ---- Pan/Zoom (pointer events)
  function getPinchDistance() {
    const pts = Array.from(state.pointers.values());
    if (pts.length < 2) return null;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return Math.hypot(dx, dy);
  }

  function onPointerDown(e) {
    elWrap.setPointerCapture?.(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointers.size === 1) {
      state.isPanning = false;
      state.lastPan = { x: e.clientX, y: e.clientY };
    } else if (state.pointers.size === 2) {
      state.isPanning = true;
      state.lastDist = getPinchDistance();
    }
  }

  function onPointerMove(e) {
    if (!state.pointers.has(e.pointerId)) return;
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointers.size === 2) {
      const d = getPinchDistance();
      if (!d || !state.lastDist) return;

      const delta = d / state.lastDist;
      const newScale = clamp(state.scale * delta, state.minScale, state.maxScale);

      // zoom about midpoint
      const pts = Array.from(state.pointers.values());
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const r = elWrap.getBoundingClientRect();
      const mx = midX - r.left;
      const my = midY - r.top;

      // keep zoom anchored
      const preX = (mx - state.panX) / state.scale;
      const preY = (my - state.panY) / state.scale;

      state.scale = newScale;

      const postX = preX * state.scale;
      const postY = preY * state.scale;

      state.panX = mx - postX;
      state.panY = my - postY;

      state.lastDist = d;
      applyTransform();
      return;
    }

    // one-finger pan
    if (state.pointers.size === 1 && state.lastPan) {
      // if user moves finger enough, treat as pan (prevents accidental tap)
      const dx = e.clientX - state.lastPan.x;
      const dy = e.clientY - state.lastPan.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) state.isPanning = true;

      state.panX += dx;
      state.panY += dy;

      state.lastPan = { x: e.clientX, y: e.clientY };
      applyTransform();
    }
  }

  function onPointerUp(e) {
    const wasTwoFinger = state.pointers.size >= 2;
    const startCount = state.pointers.size;

    state.pointers.delete(e.pointerId);

    if (startCount === 1 && !wasTwoFinger) {
      // one-finger end: if not panning, treat as tap
      if (!state.isPanning) {
        handleTap(e.clientX, e.clientY);
      }
    }

    if (state.pointers.size === 0) {
      state.isPanning = false;
      state.lastPan = null;
      state.lastDist = null;
    }
  }

  function onDoubleClick() {
    if (!state.imgNaturalW) return;
    resetViewToFit();
    toast("View reset.");
  }

  // ---- Upload handling
  function setImageFromFile(file) {
    if (!file) return;

    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      state.imgNaturalW = elImg.naturalWidth || 0;
      state.imgNaturalH = elImg.naturalHeight || 0;

      // Reset targeting state on new image
      state.gridLocked = false;
      state.calA = state.calX = state.calY = null;
      state.pxPerInchX = state.pxPerInchY = null;
      state.bull = null;
      state.holes = [];
      elSec.innerHTML = "";

      resetViewToFit();
      renderDots();
      setStep("calA");
      toast("Photo loaded. Start Grid Lock.");
    };

    elImg.src = state.objectUrl;
  }

  // ---- Units + settings
  function syncSettingsUI() {
    // Default values
    if (elDist && !elDist.value) elDist.value = f2(state.distanceYds);
    if (elClick && !elClick.value) elClick.value = f2(state.clickMoa);

    // Units toggle (display only; base remains yards internally)
    if (state.unit === "m") {
      elUnitLabel.textContent = "M";
      elDistUnit.textContent = "m";
      const meters = state.distanceYds / YARDS_PER_METER;
      elDist.value = f2(meters);
    } else {
      elUnitLabel.textContent = "IN";
      elDistUnit.textContent = "yd";
      elDist.value = f2(state.distanceYds);
    }
    elClick.value = f2(state.clickMoa);
  }

  function applySettings() {
    const click = Number(elClick.value);
    if (Number.isFinite(click) && click > 0) state.clickMoa = click;

    const d = Number(elDist.value);
    if (Number.isFinite(d) && d > 0) {
      if (state.unit === "m") state.distanceYds = d * YARDS_PER_METER;
      else state.distanceYds = d;
    }

    syncSettingsUI();
    toast("Updated.");
  }

  // ---- Init
  function init() {
    // Baker buttons (set real URLs when ready)
    if (elCatalog) elCatalog.href = "https://bakertargets.com/";
    if (elProduct) elProduct.href = "https://bakertargets.com/";

    // defaults
    state.distanceYds = 100.0;
    state.clickMoa = 0.25;

    // listeners
    elFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      setImageFromFile(file);
    });

    elUndo.addEventListener("click", undo);
    elClear.addEventListener("click", clearAll);
    elShow.addEventListener("click", showResults);

    elApply.addEventListener("click", applySettings);

    elUnitToggle.addEventListener("change", () => {
      state.unit = elUnitToggle.checked ? "m" : "in";
      syncSettingsUI();
      toast(state.unit === "m" ? "Meters (this session)." : "Inches/Yards (this session).");
    });

    // pan/zoom/tap
    elWrap.addEventListener("pointerdown", onPointerDown);
    elWrap.addEventListener("pointermove", onPointerMove);
    elWrap.addEventListener("pointerup", onPointerUp);
    elWrap.addEventListener("pointercancel", onPointerUp);
    elWrap.addEventListener("dblclick", onDoubleClick);

    // initial UI
    setStep("upload");
    syncSettingsUI();
    renderDots();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
