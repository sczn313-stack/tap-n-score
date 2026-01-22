/* ============================================================
   tap-n-score/docs/index.js  (FULL REPLACEMENT)
   Fixes:
   - iPad/iOS finger scroll creating accidental dots (“flyers”)
     ✅ Tap only registers if finger movement stays under threshold
     ✅ Scroll/drag cancels tap (no dot)
   - Bull-first workflow (bull then holes)
   - Single event pipeline (no double-dots)
============================================================ */

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
    try {
      localStorage.setItem(MODE_KEY, elMode.value);
    } catch {}
  });

  function setHint(msg) {
    elInstruction.textContent = msg;
  }

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

    // bull (yellow)
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

  // --- Coordinate helper (returns {xPct,yPct} or null if not on image)
  function getPctFromPoint(clientX, clientY) {
    if (!selectedFile || elImg.style.display === "none") return null;

    const rect = elImg.getBoundingClientRect();

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

  // ============================================================
  // iPad “scroll = accidental dots” prevention
  // We treat a dot as a TAP only if movement stays tiny.
  // Any drag/scroll cancels the tap.
  // ============================================================

  // Movement threshold in CSS pixels (tuned for iPad finger)
  const TAP_MOVE_PX = 10;

  let isDown = false;
  let moved = false;
  let startX = 0;
  let startY = 0;

  function beginGesture(clientX, clientY) {
    isDown = true;
    moved = false;
    startX = clientX;
    startY = clientY;
  }

  function trackMove(clientX, clientY) {
    if (!isDown) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) moved = true;
  }

  function endGesture(clientX, clientY) {
    if (!isDown) return;
    isDown = false;

    // If finger moved (scroll/drag), DO NOT place a dot.
    if (moved) return;

    const pt = getPctFromPoint(clientX, clientY);
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

  // --- Event wiring (Pointer Events preferred)
  const supportsPointer = "PointerEvent" in window;

  if (supportsPointer) {
    // IMPORTANT: do not block scrolling globally.
    // We only prevent default on pointerdown if it’s touch AND we’re over the IMAGE.
    elWrap.addEventListener(
      "pointerdown",
      (e) => {
        if (!selectedFile) return;

        // Only start if the pointer is on the image
        const rect = elImg.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

        if (!inside) return;

        // Start gesture
        beginGesture(e.clientX, e.clientY);

        // Keep receiving move/up even if finger drifts
        try {
          e.target.setPointerCapture(e.pointerId);
        } catch {}

        // Prevent iOS from turning this into a scroll when we're actually tapping the image
        if (e.pointerType === "touch") e.preventDefault();
      },
      { passive: false }
    );

    elWrap.addEventListener(
      "pointermove",
      (e) => {
        if (!isDown) return;
        trackMove(e.clientX, e.clientY);
      },
      { passive: true }
    );

    elWrap.addEventListener(
      "pointerup",
      (e) => {
        endGesture(e.clientX, e.clientY);
      },
      { passive: true }
    );

    elWrap.addEventListener(
      "pointercancel",
      () => {
        isDown = false;
        moved = false;
      },
      { passive: true }
    );
  } else {
    // Touch fallback
    elWrap.addEventListener(
      "touchstart",
      (e) => {
        if (!selectedFile) return;
        const t = e.touches && e.touches[0];
        if (!t) return;

        // Only start if touch begins on the image
        const rect = elImg.getBoundingClientRect();
        const inside = t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom;
        if (!inside) return;

        beginGesture(t.clientX, t.clientY);
        e.preventDefault();
      },
      { passive: false }
    );

    elWrap.addEventListener(
      "touchmove",
      (e) => {
        if (!isDown) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        trackMove(t.clientX, t.clientY);
      },
      { passive: true }
    );

    elWrap.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) {
          isDown = false;
          return;
        }
        endGesture(t.clientX, t.clientY);
      },
      { passive: true }
    );

    elWrap.addEventListener(
      "touchcancel",
      () => {
        isDown = false;
        moved = false;
      },
      { passive: true }
    );

    // Mouse fallback
    elWrap.addEventListener("mousedown", (e) => {
      if (!selectedFile) return;

      const rect = elImg.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;

      beginGesture(e.clientX, e.clientY);
    });
    window.addEventListener("mousemove", (e) => trackMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", (e) => endGesture(e.clientX, e.clientY));
  }

  // --- Controls
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

  elSee.addEventListener("click", () => {
    if (!selectedFile || !bull || holes.length === 0) return;

    const mode = elMode.value;

    // POIB (avg of holes)
    const sum = holes.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
    const poibX = sum.x / holes.length;
    const poibY = sum.y / holes.length;

    // Offset vector (bull - poib) in image %
    const dx = bull.xPct - poibX;
    const dy = bull.yPct - poibY;

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
