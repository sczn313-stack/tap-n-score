/* ============================================================
   tap-n-score/docs/index.js  (FULL REPLACEMENT)
   Locked behaviors:
   - iPad finger "ghost taps" are blocked (scroll/drag ≠ tap)
   - 1 tap = 1 dot (single pipeline; no double-binding)
   - Tap is only accepted if:
       * touch begins on the IMAGE
       * movement stays under TAP_MOVE_PX
   New:
   - Outlier (flyer) auto-filter for math (tapped vs used shown)
   - Results summary: POIB + offset (image %) + counts

   REQUIREMENTS (existing HTML IDs):
     photoInput, targetImg, dotsLayer, tapCount, bullStatus,
     undoBtn, clearTapsBtn, seeResultsBtn, instructionLine,
     targetWrap, resultsBox, modeSelect
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

  let bull = null;     // {xPct,yPct}
  let holes = [];      // [{xPct,yPct}...]

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

    // Bull (yellow)
    if (bull) {
      const b = document.createElement("div");
      b.className = "dotBull";
      b.style.left = `${bull.xPct}%`;
      b.style.top = `${bull.yPct}%`;
      elDots.appendChild(b);
    }

    // Holes (green)
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

  // --- iOS-safe file load
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

  // --- Helpers
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getPctFromPoint(clientX, clientY) {
    if (!selectedFile || !elImg || elImg.style.display === "none") return null;

    const rect = elImg.getBoundingClientRect();

    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return { xPct: clamp(x, 0, 100), yPct: clamp(y, 0, 100) };
  }

  function pointInsideImage(clientX, clientY) {
    if (!elImg || elImg.style.display === "none") return false;
    const r = elImg.getBoundingClientRect();
    return (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom);
  }

  // ============================================================
  // Outlier filter (flyer taps) — math-only
  // Robust fence: threshold = Q3 + 1.5*IQR of radial distances from centroid
  // Ensures at least 3 points remain; otherwise uses all.
  // ============================================================
  function filterOutliers(points) {
    if (!points || points.length <= 3) return { used: points.slice(), removed: [] };

    const cx = points.reduce((s, p) => s + p.xPct, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.yPct, 0) / points.length;

    const withD = points.map((p) => {
      const dx = p.xPct - cx;
      const dy = p.yPct - cy;
      return { p, d: Math.hypot(dx, dy) };
    });

    const ds = withD.map((x) => x.d).slice().sort((a, b) => a - b);

    const quantile = (arr, t) => {
      const idx = (arr.length - 1) * t;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return arr[lo];
      return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
    };

    const q1 = quantile(ds, 0.25);
    const q3 = quantile(ds, 0.75);
    const iqr = Math.max(1e-6, q3 - q1);
    const thresh = q3 + 1.5 * iqr;

    const used = withD.filter((x) => x.d <= thresh).map((x) => x.p);
    const removed = withD.filter((x) => x.d > thresh).map((x) => x.p);

    if (used.length < 3) return { used: points.slice(), removed: [] };
    return { used, removed };
  }

  // ============================================================
  // iPad finger tap gate — kills ghosts
  // - Tap starts ONLY if touch begins on image
  // - Any movement > TAP_MOVE_PX cancels
  // - Commit happens on pointerup/touchend only
  // ============================================================
  const TAP_MOVE_PX = 10;

  let isDown = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startedOnImage = false;

  function beginGesture(clientX, clientY) {
    isDown = true;
    moved = false;
    startX = clientX;
    startY = clientY;
    startedOnImage = pointInsideImage(clientX, clientY);
  }

  function trackMove(clientX, clientY) {
    if (!isDown) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) moved = true;
  }

  function commitGesture(clientX, clientY) {
    if (!isDown) return;
    isDown = false;

    // Must start on image + must not be a drag
    if (!startedOnImage) return;
    if (moved) return;

    const pt = getPctFromPoint(clientX, clientY);
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

  // --- Events (Pointer Events preferred; NO double binding)
  const supportsPointer = "PointerEvent" in window;

  if (elWrap) {
    if (supportsPointer) {
      elWrap.addEventListener("pointerdown", (e) => {
        if (!selectedFile) return;

        // iPad touch: prevent Safari from turning image taps into scroll
        if (e.pointerType === "touch") e.preventDefault();

        beginGesture(e.clientX, e.clientY);

        // Keep receiving move/up
        try { elWrap.setPointerCapture(e.pointerId); } catch {}
      }, { passive: false });

      elWrap.addEventListener("pointermove", (e) => {
        if (!isDown) return;
        trackMove(e.clientX, e.clientY);
      }, { passive: true });

      elWrap.addEventListener("pointerup", (e) => {
        commitGesture(e.clientX, e.clientY);
      }, { passive: true });

      elWrap.addEventListener("pointercancel", () => {
        isDown = false;
        moved = false;
        startedOnImage = false;
      }, { passive: true });
    } else {
      // Touch fallback
      elWrap.addEventListener("touchstart", (e) => {
        if (!selectedFile) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        beginGesture(t.clientX, t.clientY);
        e.preventDefault();
      }, { passive: false });

      elWrap.addEventListener("touchmove", (e) => {
        if (!isDown) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        trackMove(t.clientX, t.clientY);
      }, { passive: true });

      elWrap.addEventListener("touchend", (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) {
          isDown = false;
          return;
        }
        commitGesture(t.clientX, t.clientY);
      }, { passive: true });

      elWrap.addEventListener("touchcancel", () => {
        isDown = false;
        moved = false;
        startedOnImage = false;
      }, { passive: true });

      // Mouse fallback (desktop)
      elWrap.addEventListener("mousedown", (e) => {
        if (!selectedFile) return;
        beginGesture(e.clientX, e.clientY);
      });
      window.addEventListener("mousemove", (e) => trackMove(e.clientX, e.clientY));
      window.addEventListener("mouseup", (e) => commitGesture(e.clientX, e.clientY));
    }
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

      const tappedCount = holes.length;
      const { used: usedHoles, removed: removedHoles } = filterOutliers(holes);
      const usedCount = usedHoles.length;

      // POIB from USED holes
      const sum = usedHoles.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
      const poibX = sum.x / usedHoles.length;
      const poibY = sum.y / usedHoles.length;

      // Offset vector (bull - POIB) in image %
      const dx = bull.xPct - poibX;
      const dy = bull.yPct - poibY;

      elResults.style.display = "block";
      elResults.innerHTML = `
        <div style="font-weight:900; font-size:16px; margin-bottom:8px;">Session Summary</div>
        <div><b>Mode:</b> ${mode}</div>

        <div style="margin-top:10px;"><b>Holes tapped:</b> ${tappedCount}</div>
        <div><b>Holes used:</b> ${usedCount}${removedHoles.length ? ` (filtered ${removedHoles.length})` : ""}</div>

        <div style="margin-top:10px;"><b>Bull (image %):</b> X ${bull.xPct.toFixed(2)}% • Y ${bull.yPct.toFixed(2)}%</div>
        <div><b>POIB (used, image %):</b> X ${poibX.toFixed(2)}% • Y ${poibY.toFixed(2)}%</div>
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
