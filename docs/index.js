/* ============================================================
   index.js (FULL REPLACEMENT) — Baker Grid Pilot
   CROP-SAFE GRID MATH (1"×1" boxes) — no grid lock taps

   Changes in this version:
   - Distance is WHOLE NUMBER ONLY (no decimals) in input + SEC.
   - Click stays decimal-capable.
   - One Baker button in header (Catalog).
   - Other Baker button is rendered inside the SEC (Product).
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

  // URLs (single source of truth)
  const BAKER_CATALOG_URL = "https://bakertargets.com/";
  const BAKER_PRODUCT_URL = "https://bakertargets.com/";

  // Constants
  const DOT_PX = 10;
  const YARDS_PER_METER = 1.0936132983;
  const DEFAULT_DISTANCE_YDS = 100; // whole
  const DEFAULT_CLICK_MOA = 0.25;

  // Grid detection tuning
  const GRID_LAG_MIN = 10;    // px
  const GRID_LAG_MAX = 220;   // px
  const GRID_LAG_STEP = 1;
  const GRID_TOP_K = 3;       // average top K autocorr peaks

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
    unit: "in", // "in" or "m" (display for distance)
    distanceYds: DEFAULT_DISTANCE_YDS, // stored in yds
    clickMoa: DEFAULT_CLICK_MOA,

    // AUTO GRID SCALE (px per 1" box)
    pxPerBoxX: null,
    pxPerBoxY: null,
    gridStatus: "GRID: not measured",
  };

  // Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
  const fmtDist = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return String(Math.round(x)); // WHOLE NUMBER ONLY
  };

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
        d.style.background = "rgba(80,170,255,0.95)";
      } else {
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
    if (!state.pxPerBoxX || !state.pxPerBoxY) return "Measuring grid… (upload a clear grid photo).";
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
    const dRaw = Number(elDistanceInput.value);
    const c = Number(elClickInput.value);

    if (Number.isFinite(c) && c > 0) state.clickMoa = c;

    if (Number.isFinite(dRaw) && dRaw > 0) {
      const dWhole = Math.round(dRaw); // WHOLE NUMBER ONLY
      state.distanceYds = (state.unit === "m") ? dWhole * YARDS_PER_METER : dWhole;
    }
  }

  function writeStateToMomaInputs() {
    const distDisplay =
      state.unit === "m"
        ? state.distanceYds / YARDS_PER_METER
        : state.distanceYds;

    elDistanceInput.value = fmtDist(distDisplay); // WHOLE ONLY
    elClickInput.value = fmt2(state.clickMoa);
  }

  function inchesPerMOA(distanceYds) {
    return (distanceYds * 1.047) / 100;
  }

  /* ============================
     GRID AUTO-DETECTION
     ============================ */

  function computeEdgeMap(imageData, w, h) {
    const data = imageData.data;
    const gray = new Uint8ClampedArray(w * h);

    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      const r = data[p], g = data[p + 1], b = data[p + 2];
      gray[i] = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
    }

    const edge = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const dx = gray[i + 1] - gray[i - 1];
        const dy = gray[i + w] - gray[i - w];
        edge[i] = Math.abs(dx) + Math.abs(dy);
      }
    }
    return edge;
  }

  function buildProfileX(edge, w, h) {
    const prof = new Float32Array(w);
    const y0 = Math.floor(h * 0.15);
    const y1 = Math.floor(h * 0.85);

    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = y0; y < y1; y++) s += edge[y * w + x];
      prof[x] = s;
    }

    let mean = 0;
    for (let x = 0; x < w; x++) mean += prof[x];
    mean /= w;
    for (let x = 0; x < w; x++) prof[x] = prof[x] - mean;

    return prof;
  }

  function buildProfileY(edge, w, h) {
    const prof = new Float32Array(h);
    const x0 = Math.floor(w * 0.15);
    const x1 = Math.floor(w * 0.85);

    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let x = x0; x < x1; x++) s += edge[y * w + x];
      prof[y] = s;
    }

    let mean = 0;
    for (let y = 0; y < h; y++) mean += prof[y];
    mean /= h;
    for (let y = 0; y < h; y++) prof[y] = prof[y] - mean;

    return prof;
  }

  function refineLagTopK(signal, lagMin, lagMax, k) {
    const n = signal.length;
    const scores = [];
    for (let lag = lagMin; lag <= lagMax; lag += GRID_LAG_STEP) {
      let s = 0;
      for (let i = 0; i < n - lag; i++) s += signal[i] * signal[i + lag];
      scores.push({ lag, s });
    }
    scores.sort((a, b) => b.s - a.s);
    const top = scores.slice(0, Math.max(1, k));
    const avgLag = top.reduce((a, o) => a + o.lag, 0) / top.length;
    return { lag: avgLag, score: top[0].s };
  }

  function measureGridPxPerBox() {
    const w = elImg.naturalWidth || 0;
    const h = elImg.naturalHeight || 0;
    if (w < 200 || h < 200) return false;

    const maxW = 900;
    const scaleDown = w > maxW ? (maxW / w) : 1;
    const ww = Math.round(w * scaleDown);
    const hh = Math.round(h * scaleDown);

    const cnv2 = document.createElement("canvas");
    cnv2.width = ww;
    cnv2.height = hh;
    const ctx2 = cnv2.getContext("2d", { willReadFrequently: true });
    ctx2.drawImage(elImg, 0, 0, ww, hh);

    const imgData = ctx2.getImageData(0, 0, ww, hh);
    const edge = computeEdgeMap(imgData, ww, hh);

    const profX = buildProfileX(edge, ww, hh);
    const profY = buildProfileY(edge, ww, hh);

    const rx = refineLagTopK(profX, GRID_LAG_MIN, Math.min(GRID_LAG_MAX, ww - 5), GRID_TOP_K);
    const ry = refineLagTopK(profY, GRID_LAG_MIN, Math.min(GRID_LAG_MAX, hh - 5), GRID_TOP_K);

    const pxBoxX = rx.lag / scaleDown;
    const pxBoxY = ry.lag / scaleDown;

    if (!Number.isFinite(pxBoxX) || !Number.isFinite(pxBoxY)) return false;
    if (pxBoxX < 12 || pxBoxY < 12) return false;
    if (pxBoxX > w * 0.5 || pxBoxY > h * 0.5) return false;

    state.pxPerBoxX = pxBoxX;
    state.pxPerBoxY = pxBoxY;
    state.gridStatus = `GRID: ${fmt2(pxBoxX)} px/box X • ${fmt2(pxBoxY)} px/box Y`;
    return true;
  }

  /* ============================
     SEC computation (box-based)
     ============================ */

  function computeSEC() {
    if (!state.imgLoaded) return { ok: false, err: "Upload a target photo first." };
    if (!state.pxPerBoxX || !state.pxPerBoxY) return { ok: false, err: "Grid not measured yet. Use a clearer grid photo." };
    if (state.taps.length < 2) return { ok: false, err: "Tap the bull and at least 1 bullet hole." };

    const bull = state.taps[0];
    const hits = state.taps.slice(1);

    const poibPx = hits.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    poibPx.x /= hits.length;
    poibPx.y /= hits.length;

    const dxPx = poibPx.x - bull.x; // right positive
    const dyPx = poibPx.y - bull.y; // down positive

    const poibX_in = dxPx / state.pxPerBoxX;      // right positive
    const poibY_in = -(dyPx / state.pxPerBoxY);   // up positive

    const corrX_in = -poibX_in; // Bull − POIB
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
    };
  }

  function renderSEC(res) {
    const distDisplay = state.unit === "m"
      ? state.distanceYds / YARDS_PER_METER
      : state.distanceYds;

    const distanceShown = `${fmtDist(distDisplay)} ${state.unit === "m" ? "m" : "yds"}`;
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

          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900; color:rgba(255,255,255,0.85);">True MOA</div>
            <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900;">${distanceShown}</div>
            <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:999px; font-weight:900;">${clickShown}</div>

            <!-- Baker button on the SEC -->
            <a href="${BAKER_PRODUCT_URL}" target="_blank" rel="noopener"
               style="
                 text-decoration:none;
                 padding:8px 12px;
                 border:1px solid rgba(255,255,255,0.10);
                 border-radius:999px;
                 font-weight:900;
                 color:rgba(255,255,255,0.92);
                 background: rgba(255,255,255,0.04);
               ">
              See More Baker Targets
            </a>
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
      </div>
    `;
  }

  // Touch/pointer interactions (pinch + pan + tap)
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
    state.pxPerBoxX = null;
    state.pxPerBoxY = null;
    state.gridStatus = "GRID: measuring…";
    redrawDots();
    clearSEC();

    elImg.onload = () => {
      state.imgLoaded = true;
      fitImageToWrap();

      const ok = measureGridPxPerBox();
      if (!ok) {
        state.pxPerBoxX = null;
        state.pxPerBoxY = null;
        state.gridStatus = "GRID: could not measure (use a clearer grid photo)";
      }

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
    clearSEC();

    state.unit = "in";
    elUnitToggle.checked = false;
    setUnitsUI();

    state.distanceYds = DEFAULT_DISTANCE_YDS;
    state.clickMoa = DEFAULT_CLICK_MOA;
    writeStateToMomaInputs();

    setInstruction(stepHint());
  });

  elShow.addEventListener("click", () => {
    const res = computeSEC();
    if (!res.ok) { setInstruction(res.err); return; }
    renderSEC(res);
    setInstruction("SEC ready. Undo/Clear or upload a new photo.");
  });

  elApply.addEventListener("click", () => {
    readMomaInputsToState();
    // write back to input so it snaps to whole distance immediately
    writeStateToMomaInputs();

    if (elSEC.innerHTML.trim()) {
      const res = computeSEC();
      if (res.ok) renderSEC(res);
    }
  });

  elUnitToggle.addEventListener("change", () => {
    state.unit = elUnitToggle.checked ? "m" : "in";
    setUnitsUI();

    // keep whole number behavior on toggle as well
    writeStateToMomaInputs();

    if (elSEC.innerHTML.trim()) {
      const res = computeSEC();
      if (res.ok) renderSEC(res);
    }
  });

  // Init
  function init() {
    // Header (single button)
    elBakerCatalog.href = BAKER_CATALOG_URL;

    // Distance: whole only
    elDistanceInput.placeholder = "100";
    elDistanceInput.step = "1";

    // Click: decimal ok
    elClickInput.placeholder = "0.25";
    elClickInput.step = "0.01";

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
