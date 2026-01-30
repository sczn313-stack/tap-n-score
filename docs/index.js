/* ============================================================
   index.js (FULL REPLACEMENT) — BRICK: Pinch Zoom + Pan (B) FIXED
   Fixes:
   - iOS pinch now reliable (no browser fight)
   - 1-finger: tap works (tap is committed on touchend)
   - 1-finger: pan engages ONLY after movement threshold OR scale>1
   - Tap mapping remains correct under transform
   - NO backend wiring, NO export wiring (hooks only)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Screens
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSec = $("pageSec");

  // Landing
  const elFile = $("photoInput");
  const elTipLine = $("tipLine");

  // Tap screen
  const elInstruction = $("instructionLine");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");

  const elCtaRow = $("ctaRow");
  const btnUndo = $("undoBtn");
  const btnClear = $("clearBtn");
  const btnShow = $("showResultsBtn");

  // SEC screen
  const elSessionId = $("secSessionId");
  const elUp = $("clickUp");
  const elDown = $("clickDown");
  const elLeft = $("clickLeft");
  const elRight = $("clickRight");
  const elScoreBig = $("scoreBig");
  const elScoreCur = $("scoreCurrent");
  const elScorePrev = $("scorePrev");
  const elScoreCum = $("scoreCum");

  const btnDlImg = $("downloadSecImageBtn");
  const btnSurvey = $("surveyBtn");

  // ----------------------------
  // Tap state
  // ----------------------------
  let objectUrl = null;
  let bull = null;      // {x:0..1,y:0..1}
  let holes = [];       // [{x,y}...]
  let phase = "idle";   // idle | bull | holes

  // ----------------------------
  // Zoom/Pan state
  // Transform BOTH image + dotsLayer identically.
  // ----------------------------
  const Z = {
    scale: 1,
    minScale: 1,
    maxScale: 3,
    tx: 0,
    ty: 0,

    // gestures
    isPinching: false,
    isPanning: false,

    pinchStartDist: 0,
    pinchStartScale: 1,
    pinchStartTx: 0,
    pinchStartTy: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,

    // 1-finger tracking (tap vs pan)
    touchStartX: 0,
    touchStartY: 0,
    touchStartClientX: 0,
    touchStartClientY: 0,
    touchStartTx: 0,
    touchStartTy: 0,
    moved: false
  };

  const PAN_THRESHOLD = 7; // px

  // ----------------------------
  // Screen control
  // ----------------------------
  function showScreen(which) {
    if (pageLanding) pageLanding.hidden = (which !== "landing");
    if (pageTap) pageTap.hidden = (which !== "tap");
    if (pageSec) pageSec.hidden = (which !== "sec");
  }

  // ----------------------------
  // Dots
  // ----------------------------
  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function drawDot(p, kind) {
    if (!elDots || !p) return;

    const d = document.createElement("div");
    d.className = "dot";
    d.style.left = `${p.x * 100}%`;
    d.style.top = `${p.y * 100}%`;

    // visual difference (bull vs holes) without relying on CSS
    d.style.position = "absolute";
    d.style.transform = "translate(-50%, -50%)";
    d.style.width = kind === "bull" ? "18px" : "14px";
    d.style.height = kind === "bull" ? "18px" : "14px";
    d.style.borderRadius = "999px";
    d.style.border = "2px solid rgba(255,255,255,0.9)";
    d.style.background = kind === "bull"
      ? "rgba(255,40,40,0.90)"
      : "rgba(0,160,255,0.90)";
    d.style.boxShadow = "0 10px 24px rgba(0,0,0,0.45)";

    elDots.appendChild(d);
  }

  function redrawDots() {
    clearDots();
    if (bull) drawDot(bull, "bull");
    holes.forEach(h => drawDot(h, "hole"));
  }

  function setTapCount() {
    if (!elTapCount) return;
    const total = (bull ? 1 : 0) + holes.length;
    elTapCount.textContent = String(total);
  }

  // ----------------------------
  // Phase / instruction / CTA timing
  // ----------------------------
  function setPhaseBull() {
    phase = "bull";
    bull = null;
    holes = [];
    if (elInstruction) elInstruction.textContent = "Tap bull’s-eye to center";
    if (elCtaRow) elCtaRow.hidden = true; // CTAs hidden until bull tapped
    setTapCount();
    redrawDots();
  }

  function setPhaseHoles() {
    phase = "holes";
    if (elInstruction) elInstruction.textContent = "Tap bullet holes to be scored";
    if (elCtaRow) elCtaRow.hidden = false; // CTAs appear after bull
  }

  // ----------------------------
  // URL cleanup
  // ----------------------------
  function revokeUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  // ----------------------------
  // Zoom/Pan mechanics
  // ----------------------------
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function setTransform() {
    if (!elImg || !elDots) return;

    elImg.style.transformOrigin = "0 0";
    elDots.style.transformOrigin = "0 0";

    const t = `translate(${Z.tx}px, ${Z.ty}px) scale(${Z.scale})`;
    elImg.style.transform = t;
    elDots.style.transform = t;
  }

  function boundsClampTranslate() {
    if (!elWrap) return;

    const w = elWrap.clientWidth;
    const h = elWrap.clientHeight;

    const scaledW = w * Z.scale;
    const scaledH = h * Z.scale;

    if (Z.scale <= 1.0001) {
      Z.tx = 0;
      Z.ty = 0;
      return;
    }

    const minTx = w - scaledW;
    const minTy = h - scaledH;

    Z.tx = clamp(Z.tx, minTx, 0);
    Z.ty = clamp(Z.ty, minTy, 0);
  }

  function setScaleAtPoint(newScale, cx, cy) {
    const oldScale = Z.scale;
    newScale = clamp(newScale, Z.minScale, Z.maxScale);
    if (Math.abs(newScale - oldScale) < 0.0001) return;

    const contentX = (cx - Z.tx) / oldScale;
    const contentY = (cy - Z.ty) / oldScale;

    Z.scale = newScale;
    Z.tx = cx - contentX * newScale;
    Z.ty = cy - contentY * newScale;

    boundsClampTranslate();
    setTransform();
  }

  function resetZoom() {
    Z.scale = 1;
    Z.tx = 0;
    Z.ty = 0;
    setTransform();
  }

  // distance / center for pinch
  function touchDist(t0, t1) {
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.hypot(dx, dy);
  }

  function touchCenter(t0, t1) {
    return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
  }

  function wrapPointFromClient(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  // ----------------------------
  // Tap mapping under transform
  // norm = content / wrapSize
  // content = (screen - translate) / scale
  // ----------------------------
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function normFromClient(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;

    const cx = (sx - Z.tx) / Z.scale;
    const cy = (sy - Z.ty) / Z.scale;

    return {
      x: clamp01(cx / r.width),
      y: clamp01(cy / r.height)
    };
  }

  // ----------------------------
  // Tap logic
  // ----------------------------
  function onTapAt(normPoint) {
    if (phase !== "bull" && phase !== "holes") return;
    if (!elImg || !elImg.src) return;

    if (phase === "bull") {
      bull = normPoint;
      setTapCount();
      redrawDots();
      setPhaseHoles();
      return;
    }

    holes.push(normPoint);
    setTapCount();
    redrawDots();
  }

  // ----------------------------
  // File load
  // ----------------------------
  function onFilePicked() {
    const f = elFile.files && elFile.files[0] ? elFile.files[0] : null;
    if (!f) return;

    revokeUrl();
    objectUrl = URL.createObjectURL(f);

    elImg.onload = () => {
      showScreen("tap");
      resetZoom();
      setPhaseBull();
    };

    elImg.src = objectUrl;
  }

  // ----------------------------
  // Touch gestures (FIXED)
  // ----------------------------
  function onTouchStart(e) {
    if (!elImg || !elImg.src) return;

    if (e.touches.length === 2) {
      // Pinch start
      e.preventDefault();
      Z.isPinching = true;
      Z.isPanning = false;
      Z.moved = true; // pinch counts as movement

      const t0 = e.touches[0];
      const t1 = e.touches[1];

      Z.pinchStartDist = touchDist(t0, t1);
      Z.pinchStartScale = Z.scale;
      Z.pinchStartTx = Z.tx;
      Z.pinchStartTy = Z.ty;

      const ctr = touchCenter(t0, t1);
      const wp = wrapPointFromClient(ctr.x, ctr.y);
      Z.pinchCenterX = wp.x;
      Z.pinchCenterY = wp.y;
      return;
    }

    if (e.touches.length === 1) {
      // Potential tap OR pan (do NOT preventDefault yet)
      const t = e.touches[0];
      const wp = wrapPointFromClient(t.clientX, t.clientY);

      Z.isPinching = false;
      Z.isPanning = false;
      Z.moved = false;

      Z.touchStartX = wp.x;
      Z.touchStartY = wp.y;
      Z.touchStartClientX = t.clientX;
      Z.touchStartClientY = t.clientY;

      Z.touchStartTx = Z.tx;
      Z.touchStartTy = Z.ty;
    }
  }

  function onTouchMove(e) {
    if (!elImg || !elImg.src) return;

    if (Z.isPinching && e.touches.length === 2) {
      e.preventDefault();

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = touchDist(t0, t1);

      const ratio = dist / Math.max(1, Z.pinchStartDist);
      const newScale = clamp(Z.pinchStartScale * ratio, Z.minScale, Z.maxScale);

      // keep pinch center fixed based on pinch START state
      const contentX = (Z.pinchCenterX - Z.pinchStartTx) / Z.pinchStartScale;
      const contentY = (Z.pinchCenterY - Z.pinchStartTy) / Z.pinchStartScale;

      Z.scale = newScale;
      Z.tx = Z.pinchCenterX - contentX * newScale;
      Z.ty = Z.pinchCenterY - contentY * newScale;

      boundsClampTranslate();
      setTransform();
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const wp = wrapPointFromClient(t.clientX, t.clientY);

      const dx = wp.x - Z.touchStartX;
      const dy = wp.y - Z.touchStartY;

      const movedNow = Math.hypot(dx, dy) > PAN_THRESHOLD;

      // Engage pan if user moved enough OR already zoomed in
      if (!Z.isPanning && (movedNow || Z.scale > 1.0001)) {
        Z.isPanning = true;
      }

      if (Z.isPanning) {
        e.preventDefault(); // only now we stop scroll
        Z.moved = true;

        Z.tx = Z.touchStartTx + dx;
        Z.ty = Z.touchStartTy + dy;

        boundsClampTranslate();
        setTransform();
      }
    }
  }

  function onTouchEnd(e) {
    if (!elImg || !elImg.src) return;

    // If pinch ended and one finger remains, restart single-finger baseline
    if (Z.isPinching && e.touches.length === 1) {
      Z.isPinching = false;
      const t = e.touches[0];
      const wp = wrapPointFromClient(t.clientX, t.clientY);

      Z.isPanning = false;
      Z.moved = false;

      Z.touchStartX = wp.x;
      Z.touchStartY = wp.y;
      Z.touchStartClientX = t.clientX;
      Z.touchStartClientY = t.clientY;

      Z.touchStartTx = Z.tx;
      Z.touchStartTy = Z.ty;
      return;
    }

    // All touches ended: if it was NOT a pan/pinch, treat as TAP
    if (e.touches.length === 0) {
      const wasTap = !Z.moved && !Z.isPinching && !Z.isPanning;

      Z.isPinching = false;
      Z.isPanning = false;

      if (wasTap) {
        const p = normFromClient(Z.touchStartClientX, Z.touchStartClientY);
        onTapAt(p);
      }
    }
  }

  // Desktop (optional)
  function onWheel(e) {
    if (!elImg || !elImg.src) return;
    e.preventDefault();
    const wp = wrapPointFromClient(e.clientX, e.clientY);
    const step = (-e.deltaY) > 0 ? 0.12 : -0.12;
    setScaleAtPoint(Z.scale + step, wp.x, wp.y);
  }

  // ----------------------------
  // Undo / Clear / Show Results
  // ----------------------------
  function onUndo() {
    if (phase !== "holes") return;

    if (holes.length > 0) {
      holes.pop();
      setTapCount();
      redrawDots();
      return;
    }

    if (bull) setPhaseBull();
  }

  function onClear() {
    setPhaseBull();
  }

  function makeSessionId() {
    const a = Math.random().toString(16).slice(2, 8).toUpperCase();
    const b = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `SEC-${a}-${b}`;
  }

  function onShowResults() {
    if (!bull) return alert("Tap bull’s-eye first.");
    if (holes.length === 0) return alert("Tap at least one bullet hole.");

    const sid = makeSessionId();
    if (elSessionId) elSessionId.textContent = sid;

    // Placeholder outputs (NO backend yet)
    if (elUp) elUp.textContent = "0.00";
    if (elDown) elDown.textContent = "1.25";
    if (elLeft) elLeft.textContent = "0.00";
    if (elRight) elRight.textContent = "0.75";

    const score = 78;
    if (elScoreBig) elScoreBig.textContent = String(score);
    if (elScoreCur) elScoreCur.textContent = String(score);
    if (elScorePrev) elScorePrev.textContent = "—";
    if (elScoreCum) elScoreCum.textContent = String(score);

    showScreen("sec");
    pageSec?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ----------------------------
  // SEC buttons (hooks only)
  // ----------------------------
  function onDownloadImageHook() {
    alert("Download SEC (Image) — hook only for now. Wiring comes at the end.");
  }

  function onSurveyHook() {
    alert("Survey coming next — after everything else is wired.");
  }

  // ----------------------------
  // Bind
  // ----------------------------
  if (elFile) elFile.addEventListener("change", onFilePicked);

  if (elWrap) {
    // Important: keep interactions inside the frame
    elWrap.style.overflow = "hidden";

    // Touch gestures
    elWrap.addEventListener("touchstart", onTouchStart, { passive: false });
    elWrap.addEventListener("touchmove", onTouchMove, { passive: false });
    elWrap.addEventListener("touchend", onTouchEnd, { passive: false });

    // Desktop wheel zoom
    elWrap.addEventListener("wheel", onWheel, { passive: false });
  }

  if (btnUndo) btnUndo.addEventListener("click", onUndo);
  if (btnClear) btnClear.addEventListener("click", onClear);
  if (btnShow) btnShow.addEventListener("click", onShowResults);

  if (btnDlImg) btnDlImg.addEventListener("click", onDownloadImageHook);
  if (btnSurvey) btnSurvey.addEventListener("click", onSurveyHook);

  // ----------------------------
  // Boot
  // ----------------------------
  showScreen("landing");
  if (elTipLine) elTipLine.style.opacity = "0.92";

  resetZoom();
  setTapCount();
})();
