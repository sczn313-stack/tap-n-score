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

  // -------------------------
  // Locked defaults (v1.2-ish)
  // -------------------------
  const TARGET_W_IN = 8.5;
  const TARGET_H_IN = 11.0;
  const DIST_YDS = 100;

  // True MOA: 1.047" at 100y
  const TRUE_MOA_AT_100 = 1.047;
  const CLICK_MOA = 0.25;

  // Outlier reject (conservative)
  const OUTLIER_RATIO = 2.25;     // maxDist > medianDist * ratio
  const OUTLIER_MIN_IN = 0.75;    // also must exceed this absolute distance to reject

  // Tap filtering (prevents scroll/drag mis-taps)
  const MOVE_SLOP = 10;           // "screen units" allowed before we treat it as a drag
  const TAP_MAX_MS = 650;         // long press tends to be scroll/gesture

  // -------------------------
  // State
  // -------------------------
  let selectedFile = null;
  let objectUrl = null;

  // Bull-first workflow:
  // bull = {xPct, yPct} or null
  // holes = array of {xPct, yPct}
  let bull = null;
  let holes = [];

  // Pointer gesture tracking
  let activePointerId = null;
  let downPt = null; // {x,y,t}
  let suppressNextTap = false;

  // Optional overlay canvas
  let overlayCanvas = null;
  let overlayCtx = null;

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
    if (!elDots) return;

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

  function ensureOverlayCanvas() {
    if (!elWrap) return;

    if (!overlayCanvas) {
      overlayCanvas = document.createElement("canvas");
      overlayCanvas.id = "overlayCanvasAuto";
      overlayCanvas.style.position = "absolute";
      overlayCanvas.style.left = "0";
      overlayCanvas.style.top = "0";
      overlayCanvas.style.width = "100%";
      overlayCanvas.style.height = "100%";
      overlayCanvas.style.pointerEvents = "none";
      overlayCanvas.style.zIndex = "20";

      // Make sure wrap can host absolute children
      const st = window.getComputedStyle(elWrap);
      if (st.position === "static") elWrap.style.position = "relative";

      elWrap.appendChild(overlayCanvas);
      overlayCtx = overlayCanvas.getContext("2d");
    }

    // Match canvas pixel buffer to rendered size
    const r = elWrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
    }
  }

  function clearOverlay() {
    if (!overlayCanvas || !overlayCtx) return;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  function pctToWrapXY(ptPct) {
    // ptPct is in image percent (relative to displayed image rect).
    // We map to wrap space using the image element's on-screen rect.
    if (!elImg) return null;

    const wrapRect = elWrap.getBoundingClientRect();
    const imgRect = elImg.getBoundingClientRect();

    // Image may not fully fill wrap; compute point in screen coords then to wrap coords
    const xScreen = imgRect.left + (ptPct.xPct / 100) * imgRect.width;
    const yScreen = imgRect.top + (ptPct.yPct / 100) * imgRect.height;

    return {
      x: xScreen - wrapRect.left,
      y: yScreen - wrapRect.top
    };
  }

  function drawPOIBAndArrow(poibPct) {
    if (!bull || !poibPct) return;

    ensureOverlayCanvas();
    if (!overlayCtx) return;

    clearOverlay();

    const bullXY = pctToWrapXY(bull);
    const poibXY = pctToWrapXY(poibPct);
    if (!bullXY || !poibXY) return;

    const ctx = overlayCtx;

    // POIB dot (white)
    ctx.save();
    ctx.beginPath();
    ctx.arc(poibXY.x, poibXY.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.stroke();

    // Arrow (POIB -> bull)
    const dx = bullXY.x - poibXY.x;
    const dy = bullXY.y - poibXY.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const ux = dx / len;
    const uy = dy / len;

    // Start slightly away from POIB dot
    const startX = poibXY.x + ux * 10;
    const startY = poibXY.y + uy * 10;

    // End slightly before bull (so it doesn't cover bull)
    const endX = bullXY.x - ux * 10;
    const endY = bullXY.y - uy * 10;

    // Shaft
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke();

    // Arrow head
    const headLen = 18;
    const leftX = endX - ux * headLen + (-uy) * (headLen * 0.6);
    const leftY = endY - uy * headLen + (ux) * (headLen * 0.6);

    const rightX = endX - ux * headLen + (uy) * (headLen * 0.6);
    const rightY = endY - uy * headLen + (-ux) * (headLen * 0.6);

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();

    ctx.restore();
  }

  function resetSession() {
    bull = null;
    holes = [];
    drawDots();
    clearOverlay();
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

      setHint("Tap the bull (center) once. Then tap each bullet hole. Drag/scroll won’t add taps now.");
    });
  }

  // --- Coordinate helper (returns {xPct,yPct} or null if not on image)
  function getPctFromEventClientXY(clientX, clientY) {
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

  function addTapPoint(pt) {
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

    if (elResults) {
      elResults.style.display = "none";
      elResults.innerHTML = "";
    }

    clearOverlay();
  }

  // --- Robust single pipeline:
  // pointerdown + pointerup
  // - we IGNORE if finger moved too much (scroll/drag)
  // - we IGNORE long presses
  // - fixes "1 tap = 2 dots" by owning the sequence
  const supportsPointer = "PointerEvent" in window;

  function onPointerDown(e) {
    if (!selectedFile) return;

    // Only track one active pointer at a time
    if (activePointerId !== null) return;

    activePointerId = e.pointerId;
    downPt = { x: e.clientX, y: e.clientY, t: Date.now() };
    suppressNextTap = false;

    // Prevent page from treating it as scroll/zoom gesture
    if (e.pointerType === "touch") e.preventDefault();
  }

  function onPointerMove(e) {
    if (activePointerId === null || e.pointerId !== activePointerId || !downPt) return;

    const dx = e.clientX - downPt.x;
    const dy = e.clientY - downPt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > MOVE_SLOP) {
      suppressNextTap = true; // treat as drag/scroll motion
    }
  }

  function onPointerUp(e) {
    if (activePointerId === null || e.pointerId !== activePointerId || !downPt) return;

    const dt = Date.now() - downPt.t;

    const dx = e.clientX - downPt.x;
    const dy = e.clientY - downPt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const isTap = !suppressNextTap && dist <= MOVE_SLOP && dt <= TAP_MAX_MS;

    if (isTap) {
      const pt = getPctFromEventClientXY(e.clientX, e.clientY);
      addTapPoint(pt);
    }

    // reset
    activePointerId = null;
    downPt = null;
    suppressNextTap = false;

    if (e.pointerType === "touch") e.preventDefault();
  }

  function attachInputHandlers() {
    if (!elWrap) return;

    // Strongly hint: don't let browser handle touch gestures on this layer
    try { elWrap.style.touchAction = "none"; } catch {}

    if (supportsPointer) {
      elWrap.addEventListener("pointerdown", onPointerDown, { passive: false });
      elWrap.addEventListener("pointermove", onPointerMove, { passive: false });
      elWrap.addEventListener("pointerup", onPointerUp, { passive: false });
      elWrap.addEventListener("pointercancel", () => {
        activePointerId = null;
        downPt = null;
        suppressNextTap = false;
      });
    } else {
      // Touch fallback
      elWrap.addEventListener("touchstart", (e) => {
        if (!selectedFile) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        downPt = { x: t.clientX, y: t.clientY, t: Date.now() };
        suppressNextTap = false;
        e.preventDefault();
      }, { passive: false });

      elWrap.addEventListener("touchmove", (e) => {
        const t = e.touches && e.touches[0];
        if (!t || !downPt) return;
        const dx = t.clientX - downPt.x;
        const dy = t.clientY - downPt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > MOVE_SLOP) suppressNextTap = true;
        e.preventDefault();
      }, { passive: false });

      elWrap.addEventListener("touchend", (e) => {
        const t = e.changedTouches && e.changedTouches[0];
        if (!t || !downPt) return;

        const dt = Date.now() - downPt.t;
        const dx = t.clientX - downPt.x;
        const dy = t.clientY - downPt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const isTap = !suppressNextTap && dist <= MOVE_SLOP && dt <= TAP_MAX_MS;
        if (isTap) {
          const pt = getPctFromEventClientXY(t.clientX, t.clientY);
          addTapPoint(pt);
        }

        downPt = null;
        suppressNextTap = false;
        e.preventDefault();
      }, { passive: false });

      // Mouse for desktop
      elWrap.addEventListener("mousedown", (e) => {
        if (!selectedFile) return;
        const pt = getPctFromEventClientXY(e.clientX, e.clientY);
        addTapPoint(pt);
      });
    }
  }

  attachInputHandlers();

  if (elUndo) {
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
      clearOverlay();
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

  function pctToInches(ptPct) {
    return {
      xIn: (ptPct.xPct / 100) * TARGET_W_IN,
      yIn: (ptPct.yPct / 100) * TARGET_H_IN
    };
  }

  function distInches(aIn, bIn) {
    const dx = aIn.xIn - bIn.xIn;
    const dy = aIn.yIn - bIn.yIn;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    const n = a.length;
    if (n === 0) return 0;
    const mid = Math.floor(n / 2);
    return n % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function computePOIB(ptsPct) {
    const sum = ptsPct.reduce((acc, p) => {
      acc.x += p.xPct;
      acc.y += p.yPct;
      return acc;
    }, { x: 0, y: 0 });

    return {
      xPct: sum.x / ptsPct.length,
      yPct: sum.y / ptsPct.length
    };
  }

  function maybeRejectOneOutlier(holesPct) {
    // Keep it conservative; only reject if:
    // - 4+ holes
    // - farthest distance from mean is > medianDist * OUTLIER_RATIO
    // - and > OUTLIER_MIN_IN
    if (holesPct.length < 4) {
      return { used: holesPct.slice(), rejectedIndex: -1 };
    }

    const meanPct = computePOIB(holesPct); // mean in %
    const meanIn = pctToInches(meanPct);

    const dists = holesPct.map((p) => {
      const pIn = pctToInches(p);
      return distInches(pIn, meanIn);
    });

    const med = median(dists);
    let max = -1;
    let maxIdx = -1;
    for (let i = 0; i < dists.length; i++) {
      if (dists[i] > max) {
        max = dists[i];
        maxIdx = i;
      }
    }

    const shouldReject = (maxIdx >= 0) && (max > Math.max(OUTLIER_MIN_IN, med * OUTLIER_RATIO));

    if (!shouldReject) {
      return { used: holesPct.slice(), rejectedIndex: -1 };
    }

    const used = holesPct.filter((_, i) => i !== maxIdx);

    // Never go below 3
    if (used.length < 3) {
      return { used: holesPct.slice(), rejectedIndex: -1 };
    }

    return { used, rejectedIndex: maxIdx };
  }

  function trueMoaInchesAtDistance(distanceYds) {
    // True MOA scales linearly with distance
    return TRUE_MOA_AT_100 * (distanceYds / 100);
  }

  function clicksFromInches(inches, distanceYds) {
    const moaIn = trueMoaInchesAtDistance(distanceYds);
    const moa = inches / moaIn;
    const clicks = moa / CLICK_MOA;
    return clicks;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function scoreOffset100(offsetMagIn) {
    // 0" => 100, 6" => 0 (clamped)
    const MAX_OFFSET = 6.0;
    const s = 1 - (offsetMagIn / MAX_OFFSET);
    return 100 * clamp01(s);
  }

  function scoreConsistency100(meanRadiusIn) {
    // 0" => 100, 3" => 0 (clamped)
    const MAX_R = 3.0;
    const s = 1 - (meanRadiusIn / MAX_R);
    return 100 * clamp01(s);
  }

  if (elSee) {
    elSee.addEventListener("click", () => {
      if (!selectedFile || !bull || holes.length === 0) return;

      const mode = elMode ? elMode.value : "rifle";

      // Outlier reject (conservative)
      const { used, rejectedIndex } = maybeRejectOneOutlier(holes);

      // POIB from USED holes
      const poibPct = computePOIB(used);

      // Convert bull/poib to inches
      const bullIn = pctToInches(bull);
      const poibIn = pctToInches(poibPct);

      // Offset vector (bull - POIB) in inches
      const dxIn = bullIn.xIn - poibIn.xIn;
      const dyIn = bullIn.yIn - poibIn.yIn;

      const offsetMagIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);

      // Mean radius (tightness) from POIB
      const radii = used.map((p) => distInches(pctToInches(p), poibIn));
      const meanRadiusIn = radii.reduce((a, v) => a + v, 0) / radii.length;

      // Directions (image Y increases downward)
      const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
      const elevDir = dyIn >= 0 ? "DOWN" : "UP";

      const windInAbs = Math.abs(dxIn);
      const elevInAbs = Math.abs(dyIn);

      const windClicks = clicksFromInches(windInAbs, DIST_YDS);
      const elevClicks = clicksFromInches(elevInAbs, DIST_YDS);

      // Scores (two decimals)
      const offsetScore = scoreOffset100(offsetMagIn);
      const consistencyScore = scoreConsistency100(meanRadiusIn);
      const smartScore = (0.60 * offsetScore) + (0.40 * consistencyScore);

      // Draw overlay (POIB + arrow POIB -> bull)
      drawPOIBAndArrow(poibPct);

      if (elResults) {
        elResults.style.display = "block";
        elResults.innerHTML = `
          <div style="font-weight:900; font-size:16px; margin-bottom:8px;">Session Summary</div>

          <div><b>Mode:</b> ${mode}</div>
          <div><b>Target:</b> ${TARGET_W_IN.toFixed(2)}" × ${TARGET_H_IN.toFixed(2)}"</div>
          <div><b>Distance:</b> ${DIST_YDS} yards</div>

          <div style="margin-top:10px;">
            <div><b>Holes tapped:</b> ${holes.length}</div>
            <div><b>Holes used:</b> ${used.length}${rejectedIndex >= 0 ? ` <span style="color:#cfcfcf;">(1 rejected)</span>` : ""}</div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:800;">POIB Offset</div>
            <div>ΔX: ${dxIn.toFixed(2)}" • ΔY: ${dyIn.toFixed(2)}"</div>
            <div>Offset Magnitude: ${offsetMagIn.toFixed(2)}"</div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:800;">Consistency</div>
            <div>Mean Radius: ${meanRadiusIn.toFixed(2)}"</div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:800;">Output</div>
            <div>Wind: ${windDir} ${windInAbs.toFixed(2)}" → ${windClicks.toFixed(2)} clicks (${CLICK_MOA.toFixed(2)} MOA)</div>
            <div>Elev: ${elevDir} ${elevInAbs.toFixed(2)}" → ${elevClicks.toFixed(2)} clicks (${CLICK_MOA.toFixed(2)} MOA)</div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:800;">Score100</div>
            <div>OffsetScore: ${offsetScore.toFixed(2)}</div>
            <div>ConsistencyScore: ${consistencyScore.toFixed(2)}</div>
            <div style="font-size:18px; font-weight:900;">SmartScore: ${smartScore.toFixed(2)}</div>
          </div>

          <div style="margin-top:10px; color:#b9b9b9;">
            On-image overlay shows POIB (white) and correction arrow (POIB → bull).
          </div>
        `;
      }
    });
  }

  // If image resizes (rotation), keep overlay synced
  window.addEventListener("resize", () => {
    if (!overlayCanvas) return;
    ensureOverlayCanvas();
  });

  // init
  setButtons();
  setHint("Choose a target photo to begin.");
})();
