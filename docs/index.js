(() => {
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elHoleCount = $("tapCount");
  const elBullStatus = $("bullStatus");
  const elUndo = $("undoBtn");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elResults = $("resultsBox");
  const elMode = $("modeSelect");

  const elTargetSize = $("targetSizeSelect");
  const elDistance = $("distanceYds");
  const elClickValue = $("clickValue");
  const elCustomRow = $("customSizeRow");
  const elCustomW = $("customWidthIn");
  const elCustomH = $("customHeightIn");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  // Bull-first workflow:
  let bull = null;        // {xPct, yPct}
  let holes = [];         // [{xPct, yPct}, ...]

  // --- Persist settings
  const MODE_KEY = "tns_last_mode";
  const SIZE_KEY = "tns_last_size";
  const DIST_KEY = "tns_last_distance";
  const CLICK_KEY = "tns_last_click";
  const CUST_W_KEY = "tns_custom_w";
  const CUST_H_KEY = "tns_custom_h";

  function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, String(val)); } catch {} }

  // load persisted
  const lastMode = safeGet(MODE_KEY);
  if (lastMode) elMode.value = lastMode;

  const lastSize = safeGet(SIZE_KEY);
  if (lastSize) elTargetSize.value = lastSize;

  const lastDist = safeGet(DIST_KEY);
  if (lastDist) elDistance.value = lastDist;

  const lastClick = safeGet(CLICK_KEY);
  if (lastClick) elClickValue.value = lastClick;

  const lastCW = safeGet(CUST_W_KEY);
  if (lastCW) elCustomW.value = lastCW;

  const lastCH = safeGet(CUST_H_KEY);
  if (lastCH) elCustomH.value = lastCH;

  function setHint(msg) { elInstruction.textContent = msg; }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function showHideCustomSize() {
    const isCustom = elTargetSize.value === "custom";
    elCustomRow.style.display = isCustom ? "flex" : "none";
  }

  showHideCustomSize();

  elMode.addEventListener("change", () => {
    safeSet(MODE_KEY, elMode.value);

    // sensible defaults
    if (elMode.value === "pistol") {
      if (!elDistance.value || Number(elDistance.value) <= 0) elDistance.value = "25";
    } else if (elMode.value === "rifle") {
      if (!elDistance.value || Number(elDistance.value) <= 0) elDistance.value = "100";
    }
    safeSet(DIST_KEY, elDistance.value);
  });

  elTargetSize.addEventListener("change", () => {
    safeSet(SIZE_KEY, elTargetSize.value);
    showHideCustomSize();
  });

  elDistance.addEventListener("change", () => safeSet(DIST_KEY, elDistance.value));
  elClickValue.addEventListener("change", () => safeSet(CLICK_KEY, elClickValue.value));
  elCustomW.addEventListener("change", () => safeSet(CUST_W_KEY, elCustomW.value));
  elCustomH.addEventListener("change", () => safeSet(CUST_H_KEY, elCustomH.value));

  function setButtons() {
    elHoleCount.textContent = String(holes.length);
    elBullStatus.textContent = bull ? "set" : "not set";

    const hasAny = !!bull || holes.length > 0;
    elUndo.disabled = !hasAny;
    elClear.disabled = !hasAny;
    elSee.disabled = !selectedFile || !bull || holes.length === 0;
  }

  function clearDots() { elDots.innerHTML = ""; }

  function computePoibPct() {
    if (!bull || holes.length === 0) return null;
    const sum = holes.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
    return { xPct: sum.x / holes.length, yPct: sum.y / holes.length };
  }

  function makeArrowSvg(x1, y1, x2, y2) {
    // svg in % viewBox space (0..100)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "overlaySvg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowHead");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("refX", "5");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", "0,0 6,3 0,6");
    poly.setAttribute("fill", "rgba(255,255,255,0.92)");
    marker.appendChild(poly);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // shadow line
    const shadow = document.createElementNS("http://www.w3.org/2000/svg", "line");
    shadow.setAttribute("x1", String(x1));
    shadow.setAttribute("y1", String(y1));
    shadow.setAttribute("x2", String(x2));
    shadow.setAttribute("y2", String(y2));
    shadow.setAttribute("class", "arrowShadow");
    shadow.setAttribute("marker-end", "url(#arrowHead)");
    svg.appendChild(shadow);

    // main line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("class", "arrowLine");
    line.setAttribute("marker-end", "url(#arrowHead)");
    svg.appendChild(line);

    return svg;
  }

  function drawDots() {
    clearDots();

    // draw correction arrow + POIB (when we have bull + at least 1 hole)
    const poib = computePoibPct();
    if (poib && bull) {
      // Arrow from POIB -> Bull (correction direction)
      const arrow = makeArrowSvg(poib.xPct, poib.yPct, bull.xPct, bull.yPct);
      elDots.appendChild(arrow);

      // POIB dot (white)
      const p = document.createElement("div");
      p.className = "dotPoib";
      p.style.left = `${poib.xPct}%`;
      p.style.top = `${poib.yPct}%`;
      elDots.appendChild(p);
    }

    // bull dot (yellow)
    if (bull) {
      const b = document.createElement("div");
      b.className = "dotBull";
      b.style.left = `${bull.xPct}%`;
      b.style.top = `${bull.yPct}%`;
      elDots.appendChild(b);
    }

    // holes (green)
    for (const h of holes) {
      const d = document.createElement("div");
      d.className = "dot";
      d.style.left = `${h.xPct}%`;
      d.style.top = `${h.yPct}%`;
      elDots.appendChild(d);
    }
  }

  function resetSession() {
    bull = null;
    holes = [];
    drawDots();
    setButtons();
    elResults.style.display = "none";
    elResults.innerHTML = "";
  }

  // --- iOS-safe: store File immediately on change
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;

    resetSession();

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;
    elImg.style.display = "block";

    setHint("Tap the bull (center) once. Then tap each bullet hole. Undo/Clear as needed.");
  });

  // --- Coordinate helper (% of image)
  function getPctFromEvent(ev) {
    if (!selectedFile || elImg.style.display === "none") return null;

    const rect = elImg.getBoundingClientRect();
    const t = ev.touches && ev.touches[0] ? ev.touches[0] : null;
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return {
      xPct: Math.max(0, Math.min(100, x)),
      yPct: Math.max(0, Math.min(100, y)),
    };
  }

  // --- SINGLE EVENT PIPELINE (prevents 1 tap = 2 dots)
  const supportsPointer = "PointerEvent" in window;

  function handleTap(ev) {
    const pt = getPctFromEvent(ev);
    if (!pt) return;

    if (!bull) {
      bull = pt;
      setHint("Bull set ✅ Now tap each bullet hole. (Undo removes last hole, or bull if no holes.)");
    } else {
      holes.push(pt);
      setHint("Keep tapping bullet holes. Use Undo for mistakes. Then Show Results.");
    }

    drawDots();
    setButtons();
    elResults.style.display = "none";
    elResults.innerHTML = "";
  }

  if (supportsPointer) {
    elWrap.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") e.preventDefault();
      handleTap(e);
    }, { passive: false });
  } else {
    elWrap.addEventListener("touchstart", (e) => {
      e.preventDefault();
      handleTap(e);
    }, { passive: false });

    elWrap.addEventListener("mousedown", (e) => {
      handleTap(e);
    });
  }

  elUndo.addEventListener("click", () => {
    if (holes.length > 0) {
      holes.pop();
      setHint(holes.length === 0 ? "No holes left. Tap bullet holes again." : "Undid last hole.");
    } else if (bull) {
      bull = null;
      setHint("Bull cleared. Tap the bull (center) again.");
    }
    drawDots();
    setButtons();
    elResults.style.display = "none";
    elResults.innerHTML = "";
  });

  elClear.addEventListener("click", () => {
    resetSession();
    setHint("Cleared. Tap the bull (center) first, then bullet holes.");
  });

  // --- Target size → inches
  function getTargetDimsIn() {
    const v = elTargetSize.value;
    if (v === "8.5x11") return { w: 8.5, h: 11 };
    if (v === "23x23") return { w: 23, h: 23 };
    if (v === "19x25") return { w: 19, h: 25 };

    // custom
    const w = Number(elCustomW.value);
    const h = Number(elCustomH.value);
    return {
      w: Number.isFinite(w) && w > 0 ? w : 23,
      h: Number.isFinite(h) && h > 0 ? h : 23,
    };
  }

  function pctToInches(ptPct) {
    const dims = getTargetDimsIn();
    return {
      xIn: (ptPct.xPct / 100) * dims.w,
      yIn: (ptPct.yPct / 100) * dims.h,
    };
  }

  // --- True MOA inches per MOA at distance (yards): 1.047" @ 100y
  function inchesPerMOA(distanceYds) {
    return 1.047 * (distanceYds / 100);
  }

  // Score100 v0: 0" = 100, 1" = 90, 2" = 80 ... floor at 0
  function score100FromOffset(offsetIn) {
    const score = 100 - (offsetIn * 10);
    return Math.max(0, Math.min(100, score));
  }

  elSee.addEventListener("click", () => {
    if (!selectedFile || !bull || holes.length === 0) return;

    const mode = elMode.value;
    const distYds = Math.max(1, Number(elDistance.value) || 100);

    // POIB (avg of holes) in % space
    const poibPct = computePoibPct();

    // Convert bull + POIB to inches
    const bullIn = pctToInches(bull);
    const poibIn = pctToInches(poibPct);

    // Offset vector (bull - POIB) in inches
    const dxIn = (bullIn.xIn - poibIn.xIn);
    const dyIn = (bullIn.yIn - poibIn.yIn);

    const offsetMagIn = Math.sqrt((dxIn * dxIn) + (dyIn * dyIn));
    const score100 = score100FromOffset(offsetMagIn);

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn >= 0 ? "DOWN" : "UP";

    const clickSetting = elClickValue.value;
    let clickLine = "";

    if (mode === "rifle") {
      if (clickSetting === "0.1mil") {
        const inchesPerMil = 3.6 * (distYds / 100);
        const milX = Math.abs(dxIn) / inchesPerMil;
        const milY = Math.abs(dyIn) / inchesPerMil;
        const clicksX = milX / 0.1;
        const clicksY = milY / 0.1;

        clickLine = `
          <div><b>Wind:</b> ${windDir} ${Math.abs(dxIn).toFixed(2)}" → ${clicksX.toFixed(2)} clicks (0.1 mil)</div>
          <div><b>Elev:</b> ${elevDir} ${Math.abs(dyIn).toFixed(2)}" → ${clicksY.toFixed(2)} clicks (0.1 mil)</div>
        `;
      } else {
        const moaPerClick = Number(clickSetting);
        const ipm = inchesPerMOA(distYds);
        const moaX = Math.abs(dxIn) / ipm;
        const moaY = Math.abs(dyIn) / ipm;
        const clicksX = moaX / moaPerClick;
        const clicksY = moaY / moaPerClick;

        clickLine = `
          <div><b>Wind:</b> ${windDir} ${Math.abs(dxIn).toFixed(2)}" → ${clicksX.toFixed(2)} clicks (${moaPerClick.toFixed(2)} MOA)</div>
          <div><b>Elev:</b> ${elevDir} ${Math.abs(dyIn).toFixed(2)}" → ${clicksY.toFixed(2)} clicks (${moaPerClick.toFixed(2)} MOA)</div>
        `;
      }
    } else if (mode === "measure") {
      clickLine = `
        <div><b>Wind:</b> ${windDir} ${Math.abs(dxIn).toFixed(2)}"</div>
        <div><b>Elev:</b> ${elevDir} ${Math.abs(dyIn).toFixed(2)}"</div>
      `;
    } else {
      clickLine = `
        <div><b>Wind:</b> ${windDir} ${Math.abs(dxIn).toFixed(2)}"</div>
        <div><b>Elev:</b> ${elevDir} ${Math.abs(dyIn).toFixed(2)}"</div>
      `;
    }

    const dims = getTargetDimsIn();

    elResults.style.display = "block";
    elResults.innerHTML = `
      <div style="font-weight:900; font-size:16px; margin-bottom:8px;">Session Summary</div>
      <div><b>Mode:</b> ${mode}</div>
      <div><b>Target:</b> ${dims.w.toFixed(2)}" × ${dims.h.toFixed(2)}"</div>
      <div><b>Distance:</b> ${distYds.toFixed(0)} yards</div>
      <div><b>Holes:</b> ${holes.length}</div>

      <div style="margin-top:10px; font-weight:900;">POIB Offset</div>
      <div><b>ΔX:</b> ${dxIn.toFixed(2)}" • <b>ΔY:</b> ${dyIn.toFixed(2)}"</div>
      <div><b>Offset Magnitude:</b> ${offsetMagIn.toFixed(2)}"</div>

      <div style="margin-top:10px; font-weight:900;">Output</div>
      ${clickLine}

      <div style="margin-top:10px;"><b>Score100:</b> ${score100.toFixed(2)}</div>

      <div style="margin-top:10px; color:#b9b9b9;">
        On-image overlay now shows POIB (white) and correction arrow (POIB → bull).
      </div>
    `;
  });

  // init
  setButtons();
  setHint("Choose a target photo to begin.");
})();
