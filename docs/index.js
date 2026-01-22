/* ============================================================
   tap-n-score/docs/index.js  (FULL REPLACEMENT)
   Fixes:
   - 1 tap = 1 dot (single pipeline)
   - Prevents accidental "flyer" taps from scrolling/dragging
     (tap only counts if movement <= TAP_SLOP_PX)
   - Bull-first workflow
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

  // If these exist in your HTML, we'll use them; if not, we fall back safely.
  const elTargetSize = $("targetSize");
  const elDistance = $("distanceYds");
  const elClickValue = $("clickValue");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  // Bull-first workflow:
  // bull = {xPct, yPct} or null
  // holes = array of {xPct, yPct}
  let bull = null;
  let holes = [];

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
    if (!elDots) return;

    // draw bull (yellow)
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
    });
  }

  // --- Coordinate helper (returns {xPct,yPct} or null if not on image)
  function getPctFromClientXY(clientX, clientY) {
    if (!selectedFile || !elImg || elImg.style.display === "none") return null;

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

  // --- TAP FILTER (prevents scroll/drag "flyers")
  const TAP_SLOP_PX = 10;      // movement threshold to still count as a tap
  const TAP_MAX_MS = 650;      // optional time guard (long drags won't count)

  let gesture = null;
  // gesture = { id, startX, startY, startT, moved }

  function isInteractiveTarget(evTarget) {
    if (!evTarget || !evTarget.closest) return false;
    return !!evTarget.closest("button, a, input, select, textarea, label");
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

  // Prefer Pointer Events (best single-pipeline fix)
  const supportsPointer = "PointerEvent" in window;

  if (elWrap) {
    if (supportsPointer) {
      elWrap.addEventListener("pointerdown", (e) => {
        if (!selectedFile) return;
        if (isInteractiveTarget(e.target)) return;

        // only track primary pointer
        if (gesture) return;

        gesture = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startT: performance.now(),
          moved: false,
        };
      }, { passive: true });

      elWrap.addEventListener("pointermove", (e) => {
        if (!gesture || e.pointerId !== gesture.id) return;

        const dx = e.clientX - gesture.startX;
        const dy = e.clientY - gesture.startY;
        if ((dx * dx + dy * dy) > (TAP_SLOP_PX * TAP_SLOP_PX)) {
          gesture.moved = true; // user is dragging/scrolling → do NOT tap
        }
      }, { passive: true });

      elWrap.addEventListener("pointerup", (e) => {
        if (!gesture || e.pointerId !== gesture.id) return;

        const elapsed = performance.now() - gesture.startT;
        const moved = gesture.moved;

        // clear gesture first
        const endX = e.clientX;
        const endY = e.clientY;
        gesture = null;

        if (moved) return;
        if (elapsed > TAP_MAX_MS) return;

        commitTap(endX, endY);
      }, { passive: true });

      elWrap.addEventListener("pointercancel", (e) => {
        if (gesture && e.pointerId === gesture.id) gesture = null;
      }, { passive: true });
    } else {
      // Touch fallback (no double binding!)
      let tGesture = null;

      elWrap.addEventListener("touchstart", (e) => {
        if (!selectedFile) return;
        if (isInteractiveTarget(e.target)) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        tGesture = {
          startX: t.clientX,
          startY: t.clientY,
          startT: performance.now(),
          moved: false,
        };
      }, { passive: true });

      elWrap.addEventListener("touchmove", (e) => {
        if (!tGesture) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const dx = t.clientX - tGesture.startX;
        const dy = t.clientY - tGesture.startY;
        if ((dx * dx + dy * dy) > (TAP_SLOP_PX * TAP_SLOP_PX)) {
          tGesture.moved = true;
        }
      }, { passive: true });

      elWrap.addEventListener("touchend", (e) => {
        if (!tGesture) return;
        const elapsed = performance.now() - tGesture.startT;
        const moved = tGesture.moved;
        const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
        const endX = t ? t.clientX : null;
        const endY = t ? t.clientY : null;

        tGesture = null;

        if (moved) return;
        if (elapsed > TAP_MAX_MS) return;
        if (endX == null || endY == null) return;

        commitTap(endX, endY);
      }, { passive: true });

      // Desktop mouse fallback
      elWrap.addEventListener("mousedown", (e) => {
        if (!selectedFile) return;
        if (isInteractiveTarget(e.target)) return;
        commitTap(e.clientX, e.clientY);
      });
    }
  }

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
      if (!selectedFile || !bull || holes.length === 0) return;

      const mode = elMode ? elMode.value : "rifle";

      // POIB (avg of holes)
      const sum = holes.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
      const poibX = sum.x / holes.length;
      const poibY = sum.y / holes.length;

      // Offset vector (bull - poib) in image %
      const dx = (bull.xPct - poibX);
      const dy = (bull.yPct - poibY);

      if (!elResults) return;
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
