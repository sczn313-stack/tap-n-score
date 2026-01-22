/* ============================================================
   tap-n-score/docs/index.js  (FULL REPLACEMENT) — Shooter-Ready Results
   Keeps (LOCKED):
   - iPad ghost-tap prevention (drag/scroll ≠ tap)
   - 1 tap = 1 dot (single event pipeline)
   - Bull-first truth gate (no holes recorded until bull is set)
   - Outlier (flyer) filter (math-only) with tapped vs used counts

   Adds:
   - Shooter-ready Results panel:
       * Score100 (two decimals)
       * Wind/Elev directions + clicks (two decimals)
       * POIB offset in inches (two decimals)
       * Mean radius (two decimals)
       * Holes tapped vs used (filtered count)
       * Next 5-Shot Challenge prompt
   - Safe defaults if inputs don’t exist:
       * Target size: 8.50" × 11.00"
       * Distance: 100 yards
       * Click value: 0.25 MOA/click (True MOA math)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements expected by current page
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

  // --- Optional inputs (if you add them later, this auto-uses them)
  const elTargetSize = $("targetSize");   // e.g. "8.5x11"
  const elDistance = $("distanceYds");    // e.g. 100
  const elClickValue = $("clickValue");   // e.g. 0.25

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;      // {xPct,yPct}
  let holes = [];       // [{xPct,yPct}...]

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

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
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
    if (elResults) {
      elResults.style.display = "none";
      elResults.innerHTML = "";
    }
  }

  // --- iOS-safe: store File immediately
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

  // --- Coordinate helper (returns {xPct,yPct} or null)
  function getPctFromPoint(clientX, clientY) {
    if (!selectedFile || !elImg || elImg.style.display === "none") return null;

    const rect = elImg.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return { xPct: clamp(x, 0, 100), yPct: clamp(y, 0, 100) };
  }

  function pointInsideImage(clientX, clientY) {
    if (!elImg || elImg.style.display === "none") return false;
    const r = elImg.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  // ============================================================
  // Outlier filter (math-only)
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
  // Shooter math helpers (True MOA)
  // ============================================================
  function inchesPerMOA(distanceYds) {
    // True MOA: 1.047" @ 100 yards
    return 1.047 * (distanceYds / 100);
  }

  function getMode() {
    return elMode ? String(elMode.value || "rifle") : "rifle";
  }

  function getDistanceYds() {
    const n = elDistance ? Number(elDistance.value) : 100;
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function getClickMOA() {
    const n = elClickValue ? Number(elClickValue.value) : 0.25;
    return Number.isFinite(n) && n > 0 ? n : 0.25;
  }

  function getTargetDimsIn() {
    // Default 8.5×11
    if (!elTargetSize) return { w: 8.5, h: 11.0 };
    const v = String(elTargetSize.value || "").toLowerCase().replace(/\s/g, "");
    if (v.includes("8.5x11") || v.includes("8.5×11") || v.includes("11x8.5") || v.includes("11×8.5")) {
      return { w: 8.5, h: 11.0 };
    }
    // If someone typed "12x18"
    const m = v.match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/);
    if (m) return { w: Number(m[1]), h: Number(m[3]) };
    return { w: 8.5, h: 11.0 };
  }

  function pctToInches(ptPct, dims) {
    return { xIn: (ptPct.xPct / 100) * dims.w, yIn: (ptPct.yPct / 100) * dims.h };
  }

  function distInches(a, b) {
    const dx = a.xIn - b.xIn;
    const dy = a.yIn - b.yIn;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================================
  // iPad ghost-tap gate (drag/scroll cancels tap)
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

    // must begin on image + must not be a drag
    if (!startedOnImage) return;
    if (moved) return;

    const pt = getPctFromPoint(clientX, clientY);
    if (!pt) return;

    // Bull-first: first tap sets bull; only then do we accept holes
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

  // --- Events (Pointer Events preferred; single binding)
  const supportsPointer = "PointerEvent" in window;

  if (elWrap) {
    if (supportsPointer) {
      elWrap.addEventListener("pointerdown", (e) => {
        if (!selectedFile) return;
        if (e.pointerType === "touch") e.preventDefault();
        beginGesture(e.clientX, e.clientY);
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

      // mouse fallback
      elWrap.addEventListener("mousedown", (e) => {
        if (!selectedFile) return;
        beginGesture(e.clientX, e.clientY);
      });
      window.addEventListener("mousemove", (e) => trackMove(e.clientX, e.clientY));
      window.addEventListener("mouseup", (e) => commitGesture(e.clientX, e.clientY));
    }
  }

  // --- Undo / Clear
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

  // ============================================================
  // Shooter-ready Results
  // ============================================================
  if (elSee) {
    elSee.addEventListener("click", () => {
      if (!selectedFile || !bull || holes.length === 0 || !elResults) return;

      const mode = getMode();
      const dims = getTargetDimsIn();           // inches
      const distanceYds = getDistanceYds();     // yards
      const clickMOA = getClickMOA();           // MOA/click (default 0.25)
      const ipm = inchesPerMOA(distanceYds);    // inches per MOA (True MOA)

      const tappedCount = holes.length;
      const { used: usedHoles, removed: removedHoles } = filterOutliers(holes);
      const usedCount = usedHoles.length;

      // POIB (avg of USED holes) in %
      const sum = usedHoles.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
      const poibPct = { xPct: sum.x / usedHoles.length, yPct: sum.y / usedHoles.length };

      // Convert bull + POIB to inches
      const bullIn = pctToInches(bull, dims);
      const poibIn = pctToInches(poibPct, dims);

      // Offset inches (bull - POIB)
      // Note: y increases DOWN on screen; so +dyIn means POIB is ABOVE bull (needs DOWN correction).
      const dxIn = bullIn.xIn - poibIn.xIn;  // + = need RIGHT
      const dyIn = bullIn.yIn - poibIn.yIn;  // + = need DOWN

      const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
      const elevDir = dyIn >= 0 ? "DOWN" : "UP";

      const windMOA = Math.abs(dxIn) / ipm;
      const elevMOA = Math.abs(dyIn) / ipm;

      const windClicks = windMOA / clickMOA;
      const elevClicks = elevMOA / clickMOA;

      const offsetMagIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);

      // Consistency (mean radius) in inches using USED holes around POIB
      const radii = usedHoles.map((h) => distInches(pctToInches(h, dims), poibIn));
      const meanRadius = radii.reduce((a, r) => a + r, 0) / radii.length;

      // Score100 (pilot): OffsetScore 60% + ConsistencyScore 40%
      // Tunables (safe starting points)
      const offsetMaxIn = 5.00;   // inches where offset score bottoms out
      const consistMaxIn = 2.00;  // inches where consistency score bottoms out

      const offsetScore = clamp(100 - (offsetMagIn / offsetMaxIn) * 100, 0, 100);
      const consistencyScore = clamp(100 - (meanRadius / consistMaxIn) * 100, 0, 100);
      const score100 = (0.60 * offsetScore) + (0.40 * consistencyScore);

      // Render
      elResults.style.display = "block";
      elResults.innerHTML = `
        <div style="font-weight:900; font-size:16px; margin-bottom:10px;">Tap-n-Score Results</div>

        <div style="display:grid; gap:6px;">
          <div><b>Mode:</b> ${mode}</div>
          <div><b>Target size:</b> ${dims.w.toFixed(2)}" × ${dims.h.toFixed(2)}"</div>
          <div><b>Distance:</b> ${distanceYds} yards</div>
          <div><b>Click value:</b> ${clickMOA.toFixed(2)} MOA/click</div>
        </div>

        <hr style="border:none; border-top:1px solid rgba(255,255,255,.10); margin:12px 0;" />

        <div style="display:grid; gap:6px;">
          <div><b>Holes tapped:</b> ${tappedCount}</div>
          <div><b>Holes used:</b> ${usedCount}${removedHoles.length ? ` (filtered ${removedHoles.length})` : ""}</div>
        </div>

        <hr style="border:none; border-top:1px solid rgba(255,255,255,.10); margin:12px 0;" />

        <div style="display:grid; gap:8px;">
          <div style="font-weight:900;">Corrections</div>
          <div>Windage: <b>${windDir}</b> ${Math.abs(dxIn).toFixed(2)}" → <b>${windClicks.toFixed(2)}</b> clicks</div>
          <div>Elevation: <b>${elevDir}</b> ${Math.abs(dyIn).toFixed(2)}" → <b>${elevClicks.toFixed(2)}</b> clicks</div>
        </div>

        <div style="margin-top:10px; display:grid; gap:6px;">
          <div><b>POIB offset magnitude:</b> ${offsetMagIn.toFixed(2)}"</div>
          <div><b>Mean radius (consistency):</b> ${meanRadius.toFixed(2)}"</div>
        </div>

        <hr style="border:none; border-top:1px solid rgba(255,255,255,.10); margin:12px 0;" />

        <div style="display:grid; gap:6px;">
          <div style="font-weight:900; font-size:16px;">Score100: ${score100.toFixed(2)}</div>
          <div style="color:rgba(255,255,255,.70); font-size:13px;">
            OffsetScore: ${offsetScore.toFixed(2)} • ConsistencyScore: ${consistencyScore.toFixed(2)}
          </div>
        </div>

        <div style="margin-top:12px; color:rgba(255,255,255,.85); font-weight:850;">
          Next: Shoot a 5-shot group, tap, and confirm the new zero.
        </div>
      `;
    });
  }

  // init
  setButtons();
  setHint("Choose a target photo to begin.");
})();
