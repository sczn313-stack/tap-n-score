/* ============================================================
   /docs/index.js  (FULL REPLACEMENT)
   STABILITY BRICK:
   A) INPUT STABILITY (Bull cannot be "lost")
      - If bull is NOT set, the NEXT tap auto-sets bull.
      - Set Bull button forces "next tap sets bull" (re-anchor).
      - Holes cannot be recorded until bull is set.

   B) SEC STABILITY (Hard gate)
      - SEC download + results only allowed when:
          bull is set AND holes >= 1

   Notes:
   - Requires these IDs in index.html:
     photoInput, choosePhotoBtn, targetWrap, targetImg, dotsLayer,
     instructionLine, bullStatus, tapCount,
     setBullBtn, undoBtn, clearTapsBtn, showResultsBtn,
     downloadSecBtn (or downloadSecLink)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements (must exist)
  const elFile = $("photoInput");
  const elChoose = $("choosePhotoBtn");
  const elWrap = $("targetWrap");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elInstruction = $("instructionLine");

  const elBullStatus = $("bullStatus");
  const elTapCount = $("tapCount");

  const elSetBull = $("setBullBtn");
  const elUndo = $("undoBtn");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");

  // SEC download control can be a button or a link depending on your HTML
  const elDownloadSecBtn = $("downloadSecBtn") || $("downloadSecLink");

  // ---- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;       // { x, y } in image pixels (natural coords)
  let holes = [];        // array of { x, y }
  let reanchorMode = false; // if true, next tap sets bull (even if bull exists)

  // ---- Helpers
  function clampNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  // Convert a pointer event on wrapper to image "natural" pixel coords
  function getImageCoordsFromEvent(ev) {
    const img = elImg;
    const wrapRect = elWrap.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // click position in viewport
    const clientX = ev.clientX;
    const clientY = ev.clientY;

    // position relative to displayed image rect
    const relX = clientX - imgRect.left;
    const relY = clientY - imgRect.top;

    // if tap is outside the displayed image area, ignore
    if (relX < 0 || relY < 0 || relX > imgRect.width || relY > imgRect.height) {
      return null;
    }

    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    return {
      x: relX * scaleX,
      y: relY * scaleY,
    };
  }

  // Draw a dot on overlay in display coordinates
  function addDotDisplay(xNatural, yNatural, kind) {
    const img = elImg;
    const imgRect = img.getBoundingClientRect();

    const scaleX = imgRect.width / img.naturalWidth;
    const scaleY = imgRect.height / img.naturalHeight;

    const xDisp = xNatural * scaleX;
    const yDisp = yNatural * scaleY;

    const dot = document.createElement("div");
    dot.className = kind === "bull" ? "dot dotBull" : "dot dotHole";
    dot.style.left = `${xDisp}px`;
    dot.style.top = `${yDisp}px`;
    elDots.appendChild(dot);
  }

  function redrawDots() {
    elDots.innerHTML = "";
    if (!elImg.src) return;
    if (bull) addDotDisplay(bull.x, bull.y, "bull");
    for (const h of holes) addDotDisplay(h.x, h.y, "hole");
  }

  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function updateStatus() {
    if (elBullStatus) elBullStatus.textContent = bull ? "Bull: set" : "Bull: not set";
    if (elTapCount) elTapCount.textContent = `Holes: ${holes.length}`;

    const ready = !!bull && holes.length >= 1;

    if (elShow) elShow.disabled = !ready;
    if (elDownloadSecBtn) elDownloadSecBtn.disabled = !ready;

    // Instruction priority
    if (!elImg.src) {
      setInstruction("Choose a photo, then tap the bull once, then tap each confirmed hole.");
      return;
    }

    if (reanchorMode) {
      setInstruction("Tap the bull now to re-anchor.");
      return;
    }

    if (!bull) {
      setInstruction("Tap the bull once to set it (auto).");
      return;
    }

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
    // If no holes, undo can clear bull (optional, but stable)
    if (bull) {
      bull = null;
      reanchorMode = false;
      redrawDots();
      updateStatus();
    }
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

  // When image loads, rebuild overlay sizing + redraw dots
  elImg.addEventListener("load", () => {
    // Ensure overlay matches image displayed box
    // (CSS handles the overlay positioning; we just redraw)
    redrawDots();
    updateStatus();
  });

  // Choose photo (button triggers hidden input on iOS reliably)
  if (elChoose && elFile) {
    elChoose.addEventListener("click", () => elFile.click());
  }

  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      setPhotoFromFile(f);
    });
  }

  // ---- Tap handling (STABILITY: bull auto-capture)
  elWrap.addEventListener("click", (ev) => {
    if (!elImg.src) return;

    const pt = getImageCoordsFromEvent(ev);
    if (!pt) return;

    // If reanchor mode OR bull not set => this tap is bull
    if (reanchorMode || !bull) {
      bull = { x: pt.x, y: pt.y };
      reanchorMode = false;
      redrawDots();
      updateStatus();
      return;
    }

    // Otherwise this tap is a hole
    holes.push({ x: pt.x, y: pt.y });
    redrawDots();
    updateStatus();
  });

  // ---- Buttons
  if (elSetBull) {
    elSetBull.addEventListener("click", () => {
      if (!elImg.src) return;
      reanchorMode = true;
      updateStatus();
    });
  }

  if (elUndo) elUndo.addEventListener("click", undoLast);
  if (elClear) elClear.addEventListener("click", clearAll);

  // ---- Results / SEC (STABILITY: hard gate)
  function requireReadyOrToast() {
    const ready = !!bull && holes.length >= 1;
    if (ready) return true;

    // Minimal “toast” style message (no alerts)
    const msg = !bull ? "Set bull first (tap bull once)." : "Tap at least 1 hole.";
    setInstruction(msg);
    return false;
  }

  if (elShow) {
    elShow.addEventListener("click", () => {
      if (!requireReadyOrToast()) return;

      // Your existing results logic goes here.
      // Keep everything you already do — but now you can rely on bull+holes being valid.
      // Example placeholder:
      window.__SCZN3_TAP_STATE__ = { bull, holes };
      // If you already call onSeeResults() in your current build, keep that call instead.
      if (typeof window.onSeeResults === "function") window.onSeeResults({ bull, holes });
    });
  }

  if (elDownloadSecBtn) {
    elDownloadSecBtn.addEventListener("click", () => {
      if (!requireReadyOrToast()) return;

      // If you already generate SEC via a function, call it here.
      // This is the “hard gate” so generation never runs with missing bull.
      if (typeof window.downloadSEC === "function") {
        window.downloadSEC({ bull, holes });
        return;
      }

      // If your SEC generation is inside onSeeResults(), just trigger results first.
      if (typeof window.onSeeResults === "function") window.onSeeResults({ bull, holes });
    });
  }

  // ---- Init
  updateStatus();
})();
