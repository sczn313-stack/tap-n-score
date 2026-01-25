/* ============================================================
   /docs/index.js  (FULL REPLACEMENT)
   STABILITY BRICK v2 — ANCHOR FIX
   - Listen on targetImg (not wrap) so coords are always correct
   - Use pointerdown + touchstart fallback for iOS Safari reliability
   - Bull auto-sets on first tap if not set
   - Set Bull button forces re-anchor (next tap sets bull)
   - Holes only record after bull is set
   - Results/SEC hard-gated: bull set + holes>=1
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements (IDs must exist; if one is missing you’ll feel it immediately)
  const elFile = $("photoInput");
  const elChoose = $("choosePhotoBtn");

  const elWrap = $("targetWrap");      // container (for layout only)
  const elImg  = $("targetImg");       // IMPORTANT: tap surface
  const elDots = $("dotsLayer");       // overlay (must be pointer-events:none via CSS)

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

  let bull = null;      // {x,y} in image natural pixels
  let holes = [];       // [{x,y},...]
  let reanchorMode = false;

  // ---- Helpers
  function setText(el, txt) { if (el) el.textContent = txt; }

  function setInstruction(txt) { setText(elInstruction, txt); }

  function updateStatus() {
    setText(elBullStatus, bull ? "Bull: set" : "Bull: not set");
    setText(elTapCount, `Holes: ${holes.length}`);

    const ready = !!bull && holes.length >= 1;
    if (elShow) elShow.disabled = !ready;
    if (elDownloadSecBtn) elDownloadSecBtn.disabled = !ready;

    if (!elImg.src) {
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

  // Convert a client (page) point to IMAGE NATURAL PIXELS
  function clientToNatural(clientX, clientY) {
    const imgRect = elImg.getBoundingClientRect();
    const relX = clientX - imgRect.left;
    const relY = clientY - imgRect.top;

    // Ignore taps outside image (prevents “padding clicks”)
    if (relX < 0 || relY < 0 || relX > imgRect.width || relY > imgRect.height) return null;

    const nx = (relX / imgRect.width)  * elImg.naturalWidth;
    const ny = (relY / imgRect.height) * elImg.naturalHeight;

    return { x: nx, y: ny };
  }

  function addDotDisplay(natX, natY, kind) {
    const imgRect = elImg.getBoundingClientRect();
    const xDisp = (natX / elImg.naturalWidth)  * imgRect.width;
    const yDisp = (natY / elImg.naturalHeight) * imgRect.height;

    const dot = document.createElement("div");
    dot.className = kind === "bull" ? "dot dotBull" : "dot dotHole";
    dot.style.left = `${xDisp}px`;
    dot.style.top  = `${yDisp}px`;
    elDots.appendChild(dot);
  }

  function redrawDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
    if (!elImg.src) return;

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

  elImg.addEventListener("load", () => {
    // Make sure overlay redraws after image layout is known
    redrawDots();
    updateStatus();
  });

  // ---- Choose photo
  if (elChoose && elFile) elChoose.addEventListener("click", () => elFile.click());

  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      setPhotoFromFile(f);
    });
  }

  // ---- Tap logic (ANCHOR FIX)
  function handleTap(clientX, clientY) {
    if (!elImg.src) return;
    const pt = clientToNatural(clientX, clientY);
    if (!pt) return;

    // If reanchor OR no bull -> set bull
    if (reanchorMode || !bull) {
      bull = { x: pt.x, y: pt.y };
      reanchorMode = false;
      redrawDots();
      updateStatus();
      return;
    }

    // Otherwise record hole
    holes.push({ x: pt.x, y: pt.y });
    redrawDots();
    updateStatus();
  }

  // Pointer events (best)
  elImg.addEventListener("pointerdown", (ev) => {
    // Important for iOS Safari: don’t let it “turn into a scroll/zoom gesture”
    ev.preventDefault();
    handleTap(ev.clientX, ev.clientY);
  }, { passive: false });

  // Touch fallback (older iOS behaviors)
  elImg.addEventListener("touchstart", (ev) => {
    ev.preventDefault();
    const t = ev.touches && ev.touches[0];
    if (!t) return;
    handleTap(t.clientX, t.clientY);
  }, { passive: false });

  // ---- Buttons
  if (elSetBull) {
    elSetBull.addEventListener("click", () => {
      if (!elImg.src) return;
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
