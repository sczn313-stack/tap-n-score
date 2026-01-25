/* ============================================================
   /docs/index.js  (FULL REPLACEMENT)
   STABILITY BRICK v3 — TAP vs SCROLL FIX
   - Bull dot / hole dots still work
   - No “tap capture” while scrolling (drag threshold)
   - Uses pointerdown/move/up + touch fallback
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements
  const elFile = $("photoInput");
  const elChoose = $("choosePhotoBtn");

  const elImg  = $("targetImg");     // tap surface
  const elDots = $("dotsLayer");     // overlay (pointer-events:none in CSS)

  const elInstruction = $("instructionLine");
  const elBullStatus  = $("bullStatus");
  const elTapCount    = $("tapCount");

  const elSetBull = $("setBullBtn");
  const elUndo    = $("undoBtn");
  const elClear   = $("clearTapsBtn");
  const elShow    = $("showResultsBtn");

  const elDownloadSecBtn = $("downloadSecBtn") || $("downloadSecLink");

  // ---- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;      // {x,y} in natural pixels
  let holes = [];       // [{x,y},...]
  let reanchorMode = false;

  // Tap-vs-scroll tracking
  const DRAG_PX = 12;        // movement threshold to treat as scroll/drag
  const TAP_MAX_MS = 800;    // optional: ignore very long presses

  let down = null;           // {x,y,t, id}

  // ---- Helpers
  function setText(el, txt) { if (el) el.textContent = txt; }
  function setInstruction(txt) { setText(elInstruction, txt); }

  function updateStatus() {
    setText(elBullStatus, bull ? "Bull: set" : "Bull: not set");
    setText(elTapCount, `Holes: ${holes.length}`);

    const ready = !!bull && holes.length >= 1;
    if (elShow) elShow.disabled = !ready;
    if (elDownloadSecBtn) elDownloadSecBtn.disabled = !ready;

    if (!elImg || !elImg.src) {
      setInstruction("Choose a photo, then tap the bull once, then tap each confirmed hole.");
      return;
    }
    if (reanchorMode) { setInstruction("Tap the bull now to re-anchor."); return; }
    if (!bull) { setInstruction("Tap the bull once to set it."); return; }
    setInstruction("Tap each confirmed hole.");
  }

  function clearAll() {
    bull = null;
    holes = [];
    reanchorMode = false;
    redrawDots();
    updateStatus();
  }

  function undoLast() {
    if (holes.length > 0) {
      holes.pop();
      redrawDots();
      updateStatus();
      return;
    }
    if (bull) {
      bull = null;
      reanchorMode = false;
      redrawDots();
      updateStatus();
    }
  }

  // Convert client coords -> natural image pixels
  function clientToNatural(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const relX = clientX - r.left;
    const relY = clientY - r.top;

    if (relX < 0 || relY < 0 || relX > r.width || relY > r.height) return null;

    const nx = (relX / r.width)  * elImg.naturalWidth;
    const ny = (relY / r.height) * elImg.naturalHeight;

    return { x: nx, y: ny };
  }

  function addDotDisplay(natX, natY, kind) {
    const r = elImg.getBoundingClientRect();
    const xDisp = (natX / elImg.naturalWidth)  * r.width;
    const yDisp = (natY / elImg.naturalHeight) * r.height;

    const dot = document.createElement("div");
    dot.className = kind === "bull" ? "dot dotBull" : "dot dotHole";
    dot.style.left = `${xDisp}px`;
    dot.style.top  = `${yDisp}px`;
    elDots.appendChild(dot);
  }

  function redrawDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
    if (!elImg || !elImg.src) return;

    if (bull) addDotDisplay(bull.x, bull.y, "bull");
    for (const h of holes) addDotDisplay(h.x, h.y, "hole");
  }

  // ---- Photo handling
  function setPhotoFromFile(file) {
    selectedFile = file || null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;

    clearAll();

    if (!selectedFile) {
      elImg.removeAttribute("src");
      return;
    }

    objectUrl = URL.createObjectURL(selectedFile);
    elImg.src = objectUrl;
  }

  if (elImg) {
    elImg.addEventListener("load", () => {
      redrawDots();
      updateStatus();
    });
  }

  // ---- Choose photo
  if (elChoose && elFile) elChoose.addEventListener("click", () => elFile.click());

  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      setPhotoFromFile(f);
    });
  }

  // ---- Core tap action
  function applyTap(clientX, clientY) {
    if (!elImg || !elImg.src) return;
    const pt = clientToNatural(clientX, clientY);
    if (!pt) return;

    if (reanchorMode || !bull) {
      bull = { x: pt.x, y: pt.y };
      reanchorMode = false;
      redrawDots();
      updateStatus();
      return;
    }

    holes.push({ x: pt.x, y: pt.y });
    redrawDots();
    updateStatus();
  }

  // ---- Tap vs Scroll logic
  function beginDown(x, y, id = "mouse") {
    down = { x, y, t: Date.now(), id };
  }

  function movedTooFar(x, y) {
    if (!down) return true;
    const dx = x - down.x;
    const dy = y - down.y;
    return (dx*dx + dy*dy) >= (DRAG_PX * DRAG_PX);
  }

  function endUp(x, y, id = "mouse") {
    if (!down || down.id !== id) { down = null; return; }

    const dt = Date.now() - down.t;
    const dragged = movedTooFar(x, y);

    const shouldTap = !dragged && dt <= TAP_MAX_MS;
    down = null;

    if (shouldTap) applyTap(x, y);
  }

  // ---- Pointer events (preferred)
  if (elImg) {
    elImg.addEventListener("pointerdown", (ev) => {
      // Do NOT preventDefault => allows scroll
      beginDown(ev.clientX, ev.clientY, ev.pointerId);
    });

    elImg.addEventListener("pointermove", (ev) => {
      // nothing needed; movement measured on pointerup
    });

    elImg.addEventListener("pointerup", (ev) => {
      endUp(ev.clientX, ev.clientY, ev.pointerId);
    });

    elImg.addEventListener("pointercancel", () => { down = null; });
  }

  // ---- Touch fallback (some iOS Safari combos)
  if (elImg) {
    elImg.addEventListener("touchstart", (ev) => {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      beginDown(t.clientX, t.clientY, "touch");
    }, { passive: true });

    elImg.addEventListener("touchend", (ev) => {
      const t = ev.changedTouches && ev.changedTouches[0];
      if (!t) return;
      endUp(t.clientX, t.clientY, "touch");
    }, { passive: true });

    elImg.addEventListener("touchcancel", () => { down = null; }, { passive: true });
  }

  // ---- Buttons
  if (elSetBull) {
    elSetBull.addEventListener("click", () => {
      if (!elImg || !elImg.src) return;
      reanchorMode = true;
      updateStatus();
    });
  }

  if (elUndo)  elUndo.addEventListener("click", undoLast);
  if (elClear) elClear.addEventListener("click", clearAll);

  function requireReadyOrNudge() {
    if (!!bull && holes.length >= 1) return true;
    if (!bull) setInstruction("Set bull first (tap bull once).");
    else setInstruction("Tap at least 1 hole.");
    return false;
  }

  if (elShow) {
    elShow.addEventListener("click", () => {
      if (!requireReadyOrNudge()) return;
      if (typeof window.onSeeResults === "function") window.onSeeResults({ bull, holes });
      else window.__SCZN3_TAP_STATE__ = { bull, holes };
    });
  }

  if (elDownloadSecBtn) {
    elDownloadSecBtn.addEventListener("click", () => {
      if (!requireReadyOrNudge()) return;
      if (typeof window.downloadSEC === "function") window.downloadSEC({ bull, holes });
      else if (typeof window.onSeeResults === "function") window.onSeeResults({ bull, holes });
    });
  }

  // ---- Init
  updateStatus();
})();
