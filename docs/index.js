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

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  // Bull-first workflow:
  // - bull = {xPct, yPct} or null
  // - holes = array of {xPct, yPct}
  let bull = null;
  let holes = [];

  // --- Persist last mode
  const MODE_KEY = "tns_last_mode";
  try {
    const last = localStorage.getItem(MODE_KEY);
    if (last) elMode.value = last;
  } catch {}
  elMode.addEventListener("change", () => {
    try { localStorage.setItem(MODE_KEY, elMode.value); } catch {}
  });

  function setHint(msg) { elInstruction.textContent = msg; }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function setButtons() {
    elHoleCount.textContent = String(holes.length);
    elBullStatus.textContent = bull ? "set" : "not set";

    const hasAny = !!bull || holes.length > 0;

    elUndo.disabled = !hasAny;
    elClear.disabled = !hasAny;
    elSee.disabled = !selectedFile || !bull || holes.length === 0;
  }

  function clearDots() {
    elDots.innerHTML = "";
  }

  function drawDots() {
    clearDots();

    // draw bull first (yellow)
    if (bull) {
      const b = document.createElement("div");
      b.className = "dotBull";
      b.style.left = `${bull.xPct}%`;
      b.style.top = `${bull.yPct}%`;
      elDots.appendChild(b);
    }

    // draw holes (green)
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

  // --- Coordinate helper (returns {xPct,yPct} or null if not on image)
  function getPctFromEvent(ev) {
    if (!selectedFile || elImg.style.display === "none") return null;

    const rect = elImg.getBoundingClientRect();

    // unify touch + mouse
    const t = ev.touches && ev.touches[0] ? ev.touches[0] : null;
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    // must be inside image
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

  // --- SINGLE EVENT PIPELINE (fixes 1 tap = 2 dots)
  // Use Pointer Events if available; otherwise Touch.
  const supportsPointer = "PointerEvent" in window;

  function handleTap(ev) {
    const pt = getPctFromEvent(ev);
    if (!pt) return;

    // Bull-first: first tap sets bull, then holes
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
    // Only pointerdown (no touchstart listener at all)
    elWrap.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") e.preventDefault();
      handleTap(e);
    }, { passive: false });
  } else {
    // Touch-only fallback
    elWrap.addEventListener("touchstart", (e) => {
      e.preventDefault();
      handleTap(e);
    }, { passive: false });

    // Optional mouse fallback for desktops w/out pointer events
    elWrap.addEventListener("mousedown", (e) => {
      handleTap(e);
    });
  }

  elUndo.addEventListener("click", () => {
    // Undo last hole first; if none, undo bull
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

  elSee.addEventListener("click", () => {
    if (!selectedFile || !bull || holes.length === 0) return;

    const mode = elMode.value;

    // POIB (avg of holes)
    const sum = holes.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
    const poibX = sum.x / holes.length;
    const poibY = sum.y / holes.length;

    // Offset vector (bull - poib) in image %
    const dx = (bull.xPct - poibX);
    const dy = (bull.yPct - poibY);

    elResults.style.display = "block";
    elResults.innerHTML = `
      <div style="font-weight:900; font-size:16px; margin-bottom:8px;">Session Summary</div>
      <div><b>Mode:</b> ${mode}</div>
      <div><b>Bull (image %):</b> X ${bull.xPct.toFixed(2)}% • Y ${bull.yPct.toFixed(2)}%</div>
      <div><b>Holes:</b> ${holes.length}</div>
      <div><b>POIB (image %):</b> X ${poibX.toFixed(2)}% • Y ${poibY.toFixed(2)}%</div>
      <div><b>Offset (bull - POIB):</b> ΔX ${dx.toFixed(2)}% • ΔY ${dy.toFixed(2)}%</div>
      <div style="margin-top:10px; color:#b9b9b9;">
        Next: convert % → inches using target size & calibration, then clicks + Score100.
      </div>
    `;
  });

  // init
  setButtons();
  setHint("Choose a target photo to begin.");
})();
