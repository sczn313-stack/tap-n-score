/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Baker 23×35 1" Grid Pilot
   Adds:
   - Guided tap workflow: Bull → Grid X → Grid Y → Hits
   - 1" grid lock => px/in (X & Y)
   - POIB + correction in inches
   - True MOA + Clicks (2 decimals)
   - Direction mapping locked: Top=Up, Right=Right
   - Collapsible SEC (doesn't hog screen)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elUndo = $("undoTapsBtn");
  const elClear = $("clearTapsBtn");
  const elResults = $("showResultsBtn");
  const elInstruction = $("instructionLine");
  const elSec = $("secPanel");

  const elUnitToggle = $("unitToggle");
  const elUnitLabel = $("unitLabel");
  const elDistance = $("distanceInput");
  const elDistanceUnit = $("distanceUnit");
  const elClick = $("clickInput");
  const elApply = $("momaApplyBtn");

  const elCatalog = $("bakerCatalogBtn");
  const elProduct = $("bakerProductBtn");

  // ---- Required
  const must = [elFile, elImg, elWrap, elDots, elTapCount, elUndo, elClear, elResults, elInstruction, elSec, elDistance, elClick, elApply];
  if (must.some((x) => !x)) {
    console.error("Missing required DOM IDs. Check index.html IDs.");
    return;
  }

  // ---- Quick badge (proves this file is running)
  (function badge() {
    const b = document.createElement("div");
    b.textContent = "INDEX.JS READY";
    b.style.position = "fixed";
    b.style.left = "10px";
    b.style.bottom = "10px";
    b.style.zIndex = "999999";
    b.style.padding = "8px 10px";
    b.style.borderRadius = "12px";
    b.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
    b.style.fontSize = "12px";
    b.style.fontWeight = "900";
    b.style.background = "rgba(0,90,200,0.85)";
    b.style.color = "#fff";
    b.style.boxShadow = "0 18px 45px rgba(0,0,0,0.55)";
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2200);
  })();

  // ---- Baker links (replace later if you want deep links)
  if (elCatalog) elCatalog.href = "https://bakertargets.com/";
  if (elProduct) elProduct.href = "https://bakertargets.com/";

  // ------------------------------------------------------------
  // Constants + formatting
  // ------------------------------------------------------------
  const INCHES_PER_METER = 39.37007874015748;
  const YARDS_PER_METER = 1.0936132983377078;

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  // True MOA inches per 100yd = 1.047
  function inchesPerMoa(distanceYds) {
    return 1.047 * (distanceYds / 100);
  }

  // ------------------------------------------------------------
  // Session (pilot defaults)
  // ------------------------------------------------------------
  const session = {
    unit: "in",        // "in" or "m" (display mode for this run only)
    distanceYds: 100,  // pilot default
    moaPerClick: 0.25  // pilot default
  };

  function refreshMomaUI() {
    // top-right block only (NOT in SEC)
    if (elUnitLabel) elUnitLabel.textContent = session.unit === "m" ? "M" : "IN";
    if (elDistanceUnit) elDistanceUnit.textContent = session.unit === "m" ? "m" : "yd";

    elDistance.value = session.unit === "m"
      ? fmt2(session.distanceYds / YARDS_PER_METER) // yds -> m
      : fmt2(session.distanceYds);

    elClick.value = fmt2(session.moaPerClick);
  }

  if (elUnitToggle) {
    elUnitToggle.addEventListener("change", () => {
      session.unit = elUnitToggle.checked ? "m" : "in";
      refreshMomaUI();
      // per your rule: session-only; clearing resets later anyway
      renderInstruction();
      clearSec();
    });
  }

  elApply.addEventListener("click", () => {
    const d = Number(elDistance.value);
    const c = Number(elClick.value);

    if (Number.isFinite(d) && d > 0) {
      session.distanceYds = session.unit === "m" ? (d * YARDS_PER_METER) : d;
    }
    if (Number.isFinite(c) && c > 0) {
      session.moaPerClick = c;
    }

    renderInstruction(`Updated: ${distanceLabel()} • ${fmt2(session.moaPerClick)} MOA/click`);
    clearSec();
  });

  function distanceLabel() {
    return session.unit === "m"
      ? `${fmt2(session.distanceYds / YARDS_PER_METER)} m`
      : `${fmt2(session.distanceYds)} yd`;
  }

  refreshMomaUI();

  // ------------------------------------------------------------
  // Image load (ObjectURL + FileReader fallback)
  // ------------------------------------------------------------
  let objectUrl = null;
  let imageLoaded = false;

  function revokeOldUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  async function loadFileToImage(file) {
    imageLoaded = false;
    resetAllForNewPhoto();

    setInstruction("Loading photo…");

    revokeOldUrl();

    // Try ObjectURL first
    try {
      objectUrl = URL.createObjectURL(file);
      elImg.src = objectUrl;
    } catch (_) {
      objectUrl = null;
    }

    // If ObjectURL failed, use FileReader
    if (!elImg.src) {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error("FileReader failed"));
        fr.onload = () => resolve(fr.result);
        fr.readAsDataURL(file);
      });
      elImg.src = String(dataUrl);
    }

    // wait load
    await new Promise((resolve, reject) => {
      const done = () => resolve();
      const fail = () => reject(new Error("Image failed to load"));
      elImg.onload = done;
      elImg.onerror = fail;
      if (elImg.complete && elImg.naturalWidth > 0) resolve();
    });

    if (elImg.decode) {
      try { await elImg.decode(); } catch (_) {}
    }

    imageLoaded = true;

    // dots layer in image pixel space
    elDots.style.left = "0px";
    elDots.style.top = "0px";

    resetViewToFit();

    renderInstruction();
  }

  elFile.addEventListener("change", async () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    try {
      await loadFileToImage(f);
    } catch (err) {
      console.error(err);
      setInstruction("Could not load that image. Try a different photo or screenshot.");
    }
  });

  // ------------------------------------------------------------
  // Pan/zoom transform (image + dots together)
  // ------------------------------------------------------------
  const view = {
    scale: 1,
    tx: 0,
    ty: 0,
    minScale: 0.25,
    maxScale: 8
  };

  function applyTransform() {
    const t = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    elImg.style.transformOrigin = "0 0";
    elDots.style.transformOrigin = "0 0";
    elImg.style.transform = t;
    elDots.style.transform = t;
    redrawDots();
  }

  function resetViewToFit() {
    const w = elImg.naturalWidth || 0;
    const h = elImg.naturalHeight || 0;
    const wrapW = elWrap.clientWidth || 1;
    const wrapH = elWrap.clientHeight || 1;

    if (!w || !h) return;

    const s = Math.min(wrapW / w, wrapH / h);
    view.scale = Math.max(view.minScale, Math.min(view.maxScale, s));

    const scaledW = w * view.scale;
    const scaledH = h * view.scale;

    view.tx = (wrapW - scaledW) / 2;
    view.ty = (wrapH - scaledH) / 2;

    applyTransform();
  }

  function screenToImagePx(clientX, clientY) {
    const rect = elWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ix = (x - view.tx) / view.scale;
    const iy = (y - view.ty) / view.scale;

    return { ix, iy };
  }

  // ------------------------------------------------------------
  // Tap Workflow State
  // ------------------------------------------------------------
  // Bull + Grid lock taps are NOT "hits"
  let bull = null;              // {xPx, yPx}
  let gridX = { a: null, b: null }; // two points 1" apart horizontally
  let gridY = { a: null, b: null }; // two points 1" apart vertically
  let pxPerInchX = null;
  let pxPerInchY = null;
  let hits = [];                // [{xPx,yPx},...]

  function gridLocked() {
    return Number.isFinite(pxPerInchX) && pxPerInchX > 0 && Number.isFinite(pxPerInchY) && pxPerInchY > 0;
  }

  function currentStep() {
    if (!bull) return "BULL";
    if (!gridX.a) return "GRIDX_A";
    if (!gridX.b) return "GRIDX_B";
    if (!gridY.a) return "GRIDY_A";
    if (!gridY.b) return "GRIDY_B";
    if (!gridLocked()) return "LOCKING";
    return "HITS";
  }

  function setInstruction(msg) {
    elInstruction.textContent = msg;
  }

  function renderInstruction(extra = "") {
    if (!imageLoaded) {
      setInstruction("Upload your Baker 23×35 1-inch grid target photo to begin.");
      return;
    }

    const step = currentStep();
    const lockText = gridLocked()
      ? `Grid Lock: ON (${fmt2(pxPerInchX)} px/in X • ${fmt2(pxPerInchY)} px/in Y)`
      : `Grid Lock: OFF`;

    let line = "";
    if (step === "BULL") {
      line = `Step 1: Tap the bull center.  (${lockText})`;
    } else if (step === "GRIDX_A") {
      line = `Step 2: Tap a grid intersection (X cal point A). 1" square target. (${lockText})`;
    } else if (step === "GRIDX_B") {
      line = `Step 2: Tap the next grid intersection exactly 1 square to the RIGHT of A (X cal point B). (${lockText})`;
    } else if (step === "GRIDY_A") {
      line = `Step 3: Tap a grid intersection (Y cal point A). (${lockText})`;
    } else if (step === "GRIDY_B") {
      line = `Step 3: Tap the next grid intersection exactly 1 square DOWN from A (Y cal point B). (${lockText})`;
    } else {
      line = `Now tap your hits. (Hits: ${hits.length}) • ${lockText}`;
    }

    if (extra) line += ` — ${extra}`;
    setInstruction(line);
  }

  function setHitCount() {
    elTapCount.textContent = String(hits.length);
  }

  function clearSec() {
    elSec.innerHTML = "";
  }

  function resetAllForNewPhoto() {
    bull = null;
    gridX = { a: null, b: null };
    gridY = { a: null, b: null };
    pxPerInchX = null;
    pxPerInchY = null;
    hits = [];
    setHitCount();
    clearSec();
    elDots.innerHTML = "";
    renderInstruction();
  }

  // ------------------------------------------------------------
  // Dot drawing (locked sizes)
  // ------------------------------------------------------------
  function redrawDots() {
    if (!imageLoaded || !elImg.naturalWidth || !elImg.naturalHeight) {
      elDots.innerHTML = "";
      return;
    }

    const w = elImg.naturalWidth;
    const h = elImg.naturalHeight;

    elDots.style.width = `${w}px`;
    elDots.style.height = `${h}px`;

    const dotPx = 10; // locked at 10
    const r = dotPx / 2;

    const parts = [];

    // Bull (blue with B)
    if (bull) {
      parts.push(`
        <div style="
          position:absolute;
          left:${bull.xPx - r}px; top:${bull.yPx - r}px;
          width:${dotPx}px; height:${dotPx}px; border-radius:999px;
          background: rgba(90,170,255,0.95);
          box-shadow: 0 0 0 2px rgba(0,0,0,0.55);
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:10px; color:#001425;
          pointer-events:none;
        ">B</div>
      `);
    }

    // Grid cal points (yellow)
    const calPoints = [
      { p: gridX.a, label: "X1" },
      { p: gridX.b, label: "X2" },
      { p: gridY.a, label: "Y1" },
      { p: gridY.b, label: "Y2" }
    ];
    for (const c of calPoints) {
      if (!c.p) continue;
      parts.push(`
        <div style="
          position:absolute;
          left:${c.p.xPx - r}px; top:${c.p.yPx - r}px;
          width:${dotPx}px; height:${dotPx}px; border-radius:999px;
          background: rgba(255,220,90,0.95);
          box-shadow: 0 0 0 2px rgba(0,0,0,0.55);
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:9px; color:#2a1c00;
          pointer-events:none;
        ">${c.label}</div>
      `);
    }

    // Hits (red numbered)
    for (let i = 0; i < hits.length; i++) {
      const p = hits[i];
      const n = i + 1;
      parts.push(`
        <div style="
          position:absolute;
          left:${p.xPx - r}px; top:${p.yPx - r}px;
          width:${dotPx}px; height:${dotPx}px; border-radius:999px;
          background: rgba(255,80,80,0.95);
          box-shadow: 0 0 0 2px rgba(0,0,0,0.55);
          display:flex; align-items:center; justify-content:center;
          font-weight:900; font-size:10px; color:#120000;
          pointer-events:none;
        ">${n}</div>
      `);
    }

    elDots.innerHTML = parts.join("");
  }

  // ------------------------------------------------------------
  // Pointer handling (tap vs pan vs pinch)
  // ------------------------------------------------------------
  let activePointers = new Map();
  let isPanning = false;
  let panStart = null;
  let lastTapTime = 0;

  elWrap.addEventListener("pointerdown", (e) => {
    elWrap.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    } else {
      isPanning = false;
      panStart = null;
    }
  });

  elWrap.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pan (1 pointer)
    if (activePointers.size === 1 && isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      view.tx = panStart.tx + dx;
      view.ty = panStart.ty + dy;
      applyTransform();
    }

    // Pinch (2 pointers)
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

      if (!elWrap._pinch) {
        elWrap._pinch = {
          startDist: d,
          startScale: view.scale,
          startTx: view.tx,
          startTy: view.ty,
          cx: (pts[0].x + pts[1].x) / 2,
          cy: (pts[0].y + pts[1].y) / 2
        };
      } else {
        const p = elWrap._pinch;
        const factor = d / (p.startDist || 1);
        const newScale = Math.max(view.minScale, Math.min(view.maxScale, p.startScale * factor));

        const rect = elWrap.getBoundingClientRect();
        const cx = p.cx - rect.left;
        const cy = p.cy - rect.top;

        // keep point under center stable
        const ix = (cx - p.startTx) / p.startScale;
        const iy = (cy - p.startTy) / p.startScale;

        view.scale = newScale;
        view.tx = cx - ix * view.scale;
        view.ty = cy - iy * view.scale;

        applyTransform();
      }
    }
  });

  elWrap.addEventListener("pointerup", (e) => {
    const down = activePointers.get(e.pointerId);
    const wasSingle = activePointers.size === 1;

    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) elWrap._pinch = null;

    if (!imageLoaded) return;
    if (!wasSingle || !down) return;

    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 10) return; // treat as pan

    // Double-tap reset view
    const now = Date.now();
    if (now - lastTapTime < 280) {
      resetViewToFit();
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;

    // Record tap in image pixels
    const { ix, iy } = screenToImagePx(e.clientX, e.clientY);
    if (ix < 0 || iy < 0 || ix > elImg.naturalWidth || iy > elImg.naturalHeight) return;

    handleWorkflowTap({ xPx: ix, yPx: iy });
  });

  elWrap.addEventListener("pointercancel", (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) elWrap._pinch = null;
  });

  // ------------------------------------------------------------
  // Workflow tap handler (Bull → Grid X → Grid Y → Hits)
  // ------------------------------------------------------------
  function handleWorkflowTap(p) {
    clearSec(); // any new tap invalidates old SEC (until Show Results)

    const step = currentStep();

    if (step === "BULL") {
      bull = p;
    } else if (step === "GRIDX_A") {
      gridX.a = p;
    } else if (step === "GRIDX_B") {
      gridX.b = p;
      // px/in X: expect exactly 1 square to the right (1")
      pxPerInchX = Math.abs(gridX.b.xPx - gridX.a.xPx);
    } else if (step === "GRIDY_A") {
      gridY.a = p;
    } else if (step === "GRIDY_B") {
      gridY.b = p;
      // px/in Y: expect exactly 1 square down (1")
      pxPerInchY = Math.abs(gridY.b.yPx - gridY.a.yPx);
    } else {
      // HITS
      hits.push(p);
      setHitCount();
    }

    // Validate lock reasonableness (avoid 0 or tiny)
    if ((step === "GRIDX_B" || step === "GRIDY_B") && gridLocked()) {
      if (pxPerInchX < 5 || pxPerInchY < 5) {
        // clearly wrong taps
        pxPerInchX = null;
        pxPerInchY = null;
        gridX = { a: null, b: null };
        gridY = { a: null, b: null };
        renderInstruction("Grid lock failed — tap two points exactly 1 square apart.");
      }
    }

    redrawDots();
    renderInstruction();
  }

  // ------------------------------------------------------------
  // Undo / Clear
  // Undo reverses the most recent step (including bull/cal/hit)
  // Clear = clears everything (bull + lock + hits) but keeps photo
  // Grid lock only truly resets by uploading a new photo OR Clear.
  // ------------------------------------------------------------
  function undoLast() {
    clearSec();

    // Priority: hits -> gridY -> gridX -> bull
    if (hits.length) {
      hits.pop();
      setHitCount();
      redrawDots();
      renderInstruction();
      return;
    }

    if (gridY.b) { gridY.b = null; pxPerInchY = null; redrawDots(); renderInstruction(); return; }
    if (gridY.a) { gridY.a = null; redrawDots(); renderInstruction(); return; }

    if (gridX.b) { gridX.b = null; pxPerInchX = null; redrawDots(); renderInstruction(); return; }
    if (gridX.a) { gridX.a = null; redrawDots(); renderInstruction(); return; }

    if (bull) { bull = null; redrawDots(); renderInstruction(); return; }
  }

  elUndo.addEventListener("click", undoLast);

  elClear.addEventListener("click", () => {
    bull = null;
    gridX = { a: null, b: null };
    gridY = { a: null, b: null };
    pxPerInchX = null;
    pxPerInchY = null;
    hits = [];
    setHitCount();
    redrawDots();
    clearSec();
    renderInstruction("Cleared. Start again: tap bull, then grid lock, then hits.");
  });

  // ------------------------------------------------------------
  // Math: POIB, correction inches, MOA, clicks, directions
  // ------------------------------------------------------------
  function computePOIB() {
    if (!hits.length) return null;
    let sx = 0, sy = 0;
    for (const p of hits) { sx += p.xPx; sy += p.yPx; }
    return { xPx: sx / hits.length, yPx: sy / hits.length };
  }

  function toInchesFromBull(p) {
    // returns offset from bull in inches: (+x right, +y down)
    const dxPx = p.xPx - bull.xPx;
    const dyPx = p.yPx - bull.yPx;
    return { xIn: dxPx / pxPerInchX, yIn: dyPx / pxPerInchY };
  }

  function correctionInches(poib) {
    // Correction vector = Bull - POIB (inches)
    // bull - poib in pixel, divide by px/in
    const dxIn = (bull.xPx - poib.xPx) / pxPerInchX;
    const dyIn = (bull.yPx - poib.yPx) / pxPerInchY;
    return { dxIn, dyIn };
  }

  function directionsFromCorrection(dxIn, dyIn) {
    // dxIn > 0 => RIGHT, dxIn < 0 => LEFT
    // dyIn is screen-space: positive means bull is BELOW POIB => need DOWN
    // dyIn negative means bull is ABOVE POIB => need UP
    const wind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elev = dyIn >= 0 ? "DOWN" : "UP";
    return { wind, elev };
  }

  function moaFromInches(inches, distanceYds) {
    const ipm = inchesPerMoa(distanceYds);
    return inches / ipm;
  }

  function clicksFromMoa(moa, moaPerClick) {
    return moa / moaPerClick;
  }

  function convertDisplayLengthInches(valIn) {
    // display either inches or meters (meters throughout for that run)
    if (session.unit === "m") {
      const meters = valIn / INCHES_PER_METER;
      return { value: meters, unit: "m" };
    }
    return { value: valIn, unit: "in" };
  }

  // ------------------------------------------------------------
  // SEC render (collapsible)
  // ------------------------------------------------------------
  function renderSEC(result) {
    const {
      verifiedHits,
      poibOffIn,      // POIB relative to bull (inches)
      corrIn,         // correction (bull - poib) inches
      moa,
      clicks,
      dir,
      grid
    } = result;

    // Display conversions
    const poibX = convertDisplayLengthInches(poibOffIn.xIn);
    const poibY = convertDisplayLengthInches(poibOffIn.yIn);

    const corrX = convertDisplayLengthInches(corrIn.dxIn);
    const corrY = convertDisplayLengthInches(corrIn.dyIn);

    const gridX = convertDisplayLengthInches(1); // 1 inch in current units (for label only)
    const unitLabel = session.unit === "m" ? "m" : "in";

    elSec.innerHTML = `
      <details open style="margin-top:8px;">
        <summary style="
          cursor:pointer;
          list-style:none;
          font-weight:900;
          letter-spacing:0.2px;
          padding:10px 12px;
          border-radius:14px;
          border:1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.25);
          color: rgba(255,255,255,0.92);
          user-select:none;
        ">Shooter Experience Card</summary>

        <div style="
          margin-top:10px;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          padding: 12px;
        ">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
              <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">Verified Hits</div>
              <div style="font-size:26px; font-weight:900;">${verifiedHits}</div>
            </div>

            <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
              <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">POIB (${unitLabel})</div>
              <div style="font-size:22px; font-weight:900;">X ${fmt2(poibX.value)} • Y ${fmt2(poibY.value)}</div>
            </div>

            <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
              <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">Correction (Bull − POIB) (${unitLabel})</div>
              <div style="font-size:22px; font-weight:900;">ΔX ${fmt2(corrX.value)} • ΔY ${fmt2(corrY.value)}</div>
            </div>

            <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
              <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">Directions</div>
              <div style="font-size:22px; font-weight:900;">${dir.wind} • ${dir.elev}</div>
            </div>

            <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
              <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">MOA</div>
              <div style="font-size:22px; font-weight:900;">X ${fmt2(moa.x)} • Y ${fmt2(moa.y)}</div>
            </div>

            <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
              <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">Clicks</div>
              <div style="font-size:22px; font-weight:900;">X ${fmt2(clicks.x)} • Y ${fmt2(clicks.y)}</div>
            </div>
          </div>

          <div style="margin-top:10px; color:rgba(255,255,255,0.60); font-weight:800; font-size:12px;">
            1" grid detected: ${fmt2(grid.pxPerInchX)} px/in (X) • ${fmt2(grid.pxPerInchY)} px/in (Y) • ${distanceLabel()} • ${fmt2(session.moaPerClick)} MOA/click
          </div>
        </div>
      </details>
    `;
  }

  // ------------------------------------------------------------
  // Show Results
  // ------------------------------------------------------------
  elResults.addEventListener("click", () => {
    if (!imageLoaded) {
      renderInstruction("Upload a target photo first.");
      return;
    }
    if (!bull) {
      renderInstruction("Tap the bull center first.");
      return;
    }
    if (!gridLocked()) {
      renderInstruction("Grid lock required: do the 1-inch X + Y calibration taps.");
      return;
    }
    if (hits.length < 1) {
      renderInstruction("Tap at least 1 hit.");
      return;
    }

    const poib = computePOIB();

    // POIB relative to bull (inches)
    const poibOff = toInchesFromBull(poib); // +x right, +y down

    // Correction (bull - poib) inches
    const corr = correctionInches(poib);

    // Directions from correction (locked mapping)
    const dir = directionsFromCorrection(corr.dxIn, corr.dyIn);

    // MOA from ABS inches (magnitude)
    const moaX = Math.abs(moaFromInches(corr.dxIn, session.distanceYds));
    const moaY = Math.abs(moaFromInches(corr.dyIn, session.distanceYds));

    // Clicks from MOA
    const clkX = clicksFromMoa(moaX, session.moaPerClick);
    const clkY = clicksFromMoa(moaY, session.moaPerClick);

    renderSEC({
      verifiedHits: hits.length,
      poibOffIn: { xIn: poibOff.xIn, yIn: poibOff.yIn },
      corrIn: { dxIn: corr.dxIn, dyIn: corr.dyIn },
      moa: { x: moaX, y: moaY },
      clicks: { x: clkX, y: clkY },
      dir,
      grid: { pxPerInchX, pxPerInchY }
    });

    renderInstruction("SEC ready. Undo/Clear stays available. Uploading a new photo resets grid lock.");
  });

  // ------------------------------------------------------------
  // Set baseline UI
  // ------------------------------------------------------------
  function setInstruction(msg) { elInstruction.textContent = msg; }
  function clearSec() { elSec.innerHTML = ""; }
  function setHitCount() { elTapCount.textContent = String(hits.length); }

  // Initial message
  renderInstruction();
})();
