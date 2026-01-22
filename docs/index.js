/* ============================================================
   tap-n-score/docs/index.js  (FULL REPLACEMENT) — iPad Finger Fix
   Fixes:
   - Prevents “flyer taps” caused by scroll / drag on iPad
   - 1 gesture = 1 tap (no double dots)
   - Bull-first workflow (bull then holes)
   - Undo / Clear / Show Results
   - iOS-safe file handling (store File immediately)

   Notes:
   - Uses POINTER EVENTS only (with strict tap gating)
   - Cancels tap if movement > TAP_SLOP_PX OR duration > TAP_MAX_MS
   - Cancels tap if page scroll changed during the gesture (iPad finger)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements (must exist)
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

  // bull-first
  let bull = null;   // {xPct,yPct}
  let holes = [];    // [{xPct,yPct}, ...]

  // --- Persist last mode
  const MODE_KEY = "tns_last_mode";
  try {
    const last = localStorage.getItem(MODE_KEY);
    if (last && elMode) elMode.value = last;
  } catch {}
  if (elMode) {
    elMode.addEventListener("change", () => {
      try { localStorage.setItem(MODE_KEY, elMode.value); } catch {}
    });
  }

  function setHint(msg) {
    if (elInstruction) elInstruction.textContent = msg;
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function setButtons() {
    if (elHoleCount) elHoleCount.textContent = String(holes.length);
    if (elBullStatus) elBullStatus.textContent = bull ? "set" : "not set";

    const hasAny = !!bull || holes.length > 0;

    if (elUndo) elUndo.disabled = !hasAny;
    if (elClear) elClear.disabled = !hasAny;
    if (elSee) elSee.disabled = !selectedFile || !bull || holes.length === 0;
  }

  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function drawDots() {
    clearDots();

    // bull (yellow)
    if (bull && elDots) {
      const b = document.createElement("div");
      b.className = "dotBull";
      b.style.left = `${bull.xPct}%`;
      b.style.top = `${bull.yPct}%`;
      elDots.appendChild(b);
    }

    // holes (green)
    if (elDots) {
      for (const h of holes) {
        const d = document.createElement("div");
        d.className = "dot";
        d.style.left = `${h.xPct}%`;
        d.style.top = `${h.yPct}%`;
        elDots.appendChild(d);
      }
    }
  }

  function resetSession() {
    bull = null;
    holes = [];
    drawDots();
    setButtons();
    if (elResults) {
      elResults.style.display = "none";
      elResults.innerHTML = "";
    }
  }

  // --- iOS-safe: store File immediately on change
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      selectedFile = f;
      resetSession();

      revokeObjectUrl();
      objectUrl = URL.createObjectURL(f);

      if (elImg) {
        elImg.src = objectUrl;
        elImg.style.display = "block";
      }

      setHint("Tap the bull (center) once. Then tap each bullet hole. Undo/Clear as needed.");
      setButtons();
    });
  }

  // --- Convert a screen coordinate to image-relative %
  function getPctFromClientXY(clientX, clientY) {
    if (!selectedFile || !elImg || elImg.style.display === "none") return null;

    const rect = elImg.getBoundingClientRect();

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

  function commitTap(clientX, clientY) {
    const pt = getPctFromClientXY(clientX, clientY);
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
    if (elResults) {
      elResults.style.display = "none";
      elResults.innerHTML = "";
    }
  }

  // ============================================================
  // iPad finger “flyer tap” prevention
  // - Only accept a tap if:
  //   * movement <= TAP_SLOP_PX
  //   * duration <= TAP_MAX_MS
  //   * scrollY did not change during gesture
  // - Use POINTER EVENTS only to avoid double-firing
  // ============================================================

  const TAP_SLOP_PX = 5;   // tighter = fewer accidental taps on iPad
  const TAP_MAX_MS = 300;  // long press / scroll won’t count

  let gesture = null; // {id,startX,startY,startT,startScrollY,moved}

  function startGesture(e) {
    // We only care about touch/pen/mouse, but iPad will be "touch"
    gesture = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startT: performance.now(),
      startScrollY: window.scrollY,
      moved: false,
    };
  }

  function updateGesture(e) {
    if (!gesture || e.pointerId !== gesture.id) return;

    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    if (Math.hypot(dx, dy) > TAP_SLOP_PX) {
      gesture.moved = true;
    }
  }

  function endGesture(e) {
    if (!gesture || e.pointerId !== gesture.id) return;

    const elapsed = performance.now() - gesture.startT;
    const moved = gesture.moved;
    const startScrollY = gesture.startScrollY;

    const endX = e.clientX;
    const endY = e.clientY;

    // clear
    gesture = null;

    if (moved) return;
    if (elapsed > TAP_MAX_MS) return;

    // If the page scrolled even a little, this was not an intentional tap
    if (Math.abs(window.scrollY - startScrollY) > 1) return;

    commitTap(endX, endY);
  }

  function cancelGesture(e) {
    if (!gesture) return;
    // If pointer cancels, drop it
    gesture = null;
  }

  if (elWrap) {
    // pointerdown: start (passive false so we can preventDefault on iOS)
    elWrap.addEventListener(
      "pointerdown",
      (e) => {
        if (!selectedFile) return;

        // prevent iOS “ghost click” / text selection / double-fire behavior
        if (e.pointerType === "touch") e.preventDefault();

        // capture pointer to keep consistent move/up
        try { elWrap.setPointerCapture(e.pointerId); } catch {}

        startGesture(e);
      },
      { passive: false }
    );

    // pointermove: mark moved if exceeded slop
    elWrap.addEventListener(
      "pointermove",
      (e) => {
        if (!gesture) return;
        updateGesture(e);
      },
      { passive: true }
    );

    // pointerup: accept only if it’s a true tap
    elWrap.addEventListener(
      "pointerup",
      (e) => {
        endGesture(e);
      },
      { passive: true }
    );

    elWrap.addEventListener("pointercancel", cancelGesture, { passive: true });

    // Optional: reduce browser touch behaviors inside the wrap (CSS can also do this)
    // If your CSS already sets touch-action, this is fine to leave.
    elWrap.style.touchAction = "manipulation";
  }

  // --- Undo / Clear / Results
  if (elUndo) {
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
      if (elResults) {
        elResults.style.display = "none";
        elResults.innerHTML = "";
      }
    });
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      resetSession();
      setHint("Cleared. Tap the bull (center) first, then bullet holes.");
    });
  }

  if (elSee) {
    elSee.addEventListener("click", () => {
      if (!selectedFile || !bull || holes.length === 0 || !elResults) return;

      const mode = elMode ? elMode.value : "rifle";

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
  }

  // init
  setButtons();
  setHint("Choose a target photo to begin.");
})();
