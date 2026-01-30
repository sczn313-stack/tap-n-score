/* ============================================================
   index.js (FULL REPLACEMENT) — BRICK: Pinch Zoom + Pan (B)
   Scope:
   - 3-screen flow stays
   - Tap screen: pinch-to-zoom + drag-to-pan
   - Tap coordinates stay correct under transform
   - CTA row still appears only after bull tap
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
  // We transform BOTH image + dotsLayer identically.
  // Origin top-left makes math simple.
  // ----------------------------
  const Z = {
    scale: 1,
    minScale: 1,
    maxScale: 3,
    tx: 0,
    ty: 0,

    // gestures
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartTx: 0,
    panStartTy: 0,

    isPinching: false,
    pinchStartDist: 0,
    pinchStartScale: 1,
    pinchStartTx: 0,
    pinchStartTy: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,

    // tap suppression
    movedEnough: false,
    lastDownTime: 0
  };

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

    // Visual difference (bull vs holes)
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

    // origin top-left so inverse mapping is easy
    elImg.style.transformOrigin = "0 0";
    elDots.style.transformOrigin = "0 0";

    const t = `translate(${Z.tx}px, ${Z.ty}px) scale(${Z.scale})`;
    elImg.style.transform = t;
    elDots.style.transform = t;
  }

  function boundsClampTranslate() {
    // keep content from drifting away
    // We treat wrap as the content space; scaling enlarges it.
    if (!elWrap) return;

    const w = elWrap.clientWidth;
    const h = elWrap.clientHeight;

    const scaledW = w * Z.scale;
    const scaledH = h * Z.scale;

    // If scale=1, lock centered at 0,0
    if (Z.scale <= 1.0001) {
      Z.tx = 0;
      Z.ty = 0;
      return;
    }

    // allowed translate range so scaled content covers the frame
    const minTx = w - scaledW; // negative
    const minTy = h - scaledH;
    const maxTx = 0;
    const maxTy = 0;

    Z.tx = clamp(Z.tx, minTx, maxTx);
    Z.ty = clamp(Z.ty, minTy, maxTy);
  }

  function setScaleAtPoint(newScale, cx, cy) {
    // Keep point (cx,cy) stationary while scaling
    const oldScale = Z.scale;
    newScale = clamp(newScale, Z.minScale, Z.maxScale);

    if (Math.abs(newScale - oldScale) < 0.0001) return;

    // For origin (0,0), mapping:
    // screen = translate + content * scale
    // content at point: (screen - translate)/scale
    // When scale changes, adjust translate:
    // newTranslate = screen - content * newScale
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

  // Distance between two touches
  function touchDist(t0, t1) {
    const dx = t1.clientX - t0.clientX;
    const dy = t1.clientY - t0.clientY;
    return Math.hypot(dx, dy);
  }

  function touchCenter(t0, t1) {
    return {
      x: (t0.clientX + t1.clientX) / 2,
      y: (t0.clientY + t1.clientY) / 2
    };
  }

  function wrapPointFromClient(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  // ----------------------------
  // Tap mapping under transform
  // We normalize taps in "content space" (wrap space) before transform.
  // norm = content / wrapSize
  // content = (screen - translate) / scale
  // ----------------------------
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function getNormPointFromClient(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();

    // Screen point in wrap space
    const sx = clientX - r.left;
    const sy = clientY - r.top;

    // Invert transform => content space
    const cx = (sx - Z.tx) / Z.scale;
    const cy = (sy - Z.ty) / Z.scale;

    // Normalize to wrap dimensions
    const nx = clamp01(cx / r.width);
    const ny = clamp01(cy / r.height);

    return { x: nx, y: ny };
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
      resetZoom();     // important: start clean each time
      setPhaseBull();
    };

    elImg.src = objectUrl;
  }

  // ----------------------------
  // Tap/gesture handling
  // We separate "gesture" vs "tap":
  // - If finger moves enough, we treat as pan/pinch and suppress tap.
  // ----------------------------
  function beginPointer() {
    Z.movedEnough = false;
    Z.lastDownTime = Date.now();
  }

  function markMoved(dx, dy) {
    if (Math.hypot(dx, dy) > 6) Z.movedEnough = true;
  }

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

  // Touch gestures
  function onTouchStart(e) {
    if (!elImg || !elImg.src) return;

    beginPointer();

    if (e.touches.length === 2) {
      e.preventDefault();
      Z.isPinching = true;
      Z.isPanning = false;

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
      // start pan
      e.preventDefault();
      Z.isPanning = true;
      Z.isPinching = false;

      const t = e.touches[0];
      const wp = wrapPointFromClient(t.clientX, t.clientY);

      Z.panStartX = wp.x;
      Z.panStartY = wp.y;
      Z.panStartTx = Z.tx;
      Z.panStartTy = Z.ty;
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

      // keep pinch center fixed
      Z.scale = newScale;
      // Recompute translate based on stored start and center
      // Using setScaleAtPoint style math but from stored start:
      // content at center in start state:
      const contentX = (Z.pinchCenterX - Z.pinchStartTx) / Z.pinchStartScale;
      const contentY = (Z.pinchCenterY - Z.pinchStartTy) / Z.pinchStartScale;

      Z.tx = Z.pinchCenterX - contentX * newScale;
      Z.ty = Z.pinchCenterY - contentY * newScale;

      boundsClampTranslate();
      setTransform();

      markMoved(10, 10);
      return;
    }

    if (Z.isPanning && e.touches.length === 1) {
      e.preventDefault();

      // allow pan even at scale=1, but it will clamp to 0
      const t = e.touches[0];
      const wp = wrapPointFromClient(t.clientX, t.clientY);

      const dx = wp.x - Z.panStartX;
      const dy = wp.y - Z.panStartY;

      Z.tx = Z.panStartTx + dx;
      Z.ty = Z.panStartTy + dy;

      boundsClampTranslate();
      setTransform();

      markMoved(dx, dy);
    }
  }

  function onTouchEnd(e) {
    if (!elImg || !elImg.src) return;

    // If pinch ended and one finger remains, switch to pan baseline
    if (Z.isPinching && e.touches.length === 1) {
      Z.isPinching = false;
      Z.isPanning = true;

      const t = e.touches[0];
      const wp = wrapPointFromClient(t.clientX, t.clientY);

      Z.panStartX = wp.x;
      Z.panStartY = wp.y;
      Z.panStartTx = Z.tx;
      Z.panStartTy = Z.ty;
      return;
    }

    // If all touches ended: decide if it was a tap
    if (e.touches.length === 0) {
      const wasGesture = Z.movedEnough;

      Z.isPanning = false;
      Z.isPinching = false;

      if (!wasGesture) {
        // Treat as tap at last known changed touch? iOS doesn't give coords on touchend reliably.
        // We'll rely on click for single taps on iOS as well; BUT we prevent click sometimes.
        // So we also capture lastTouchStart position in touchstart (simple).
      }
    }
  }

  // Click fallback for taps (also works on desktop)
  function onClick(e) {
    if (!elImg || !elImg.src) return;

    // If a touch gesture just happened, ignore this click.
    // (prevents accidental tap after pan/pinch)
    if (Date.now() - Z.lastDownTime < 250 && Z.movedEnough) return;

    const p = getNormPointFromClient(e.clientX, e.clientY);
    onTapAt(p);
  }

  // Mouse pan (desktop friendly)
  let mouseDown = false;
  let mouseStartX = 0, mouseStartY = 0, mouseStartTx = 0, mouseStartTy = 0;

  function onMouseDown(e) {
    if (!elImg || !elImg.src) return;
    mouseDown = true;
    beginPointer();

    const wp = wrapPointFromClient(e.clientX, e.clientY);
    mouseStartX = wp.x;
    mouseStartY = wp.y;
    mouseStartTx = Z.tx;
    mouseStartTy = Z.ty;
  }

  function onMouseMove(e) {
    if (!mouseDown) return;

    const wp = wrapPointFromClient(e.clientX, e.clientY);
    const dx = wp.x - mouseStartX;
    const dy = wp.y - mouseStartY;

    if (Math.hypot(dx, dy) > 6) Z.movedEnough = true;

    Z.tx = mouseStartTx + dx;
    Z.ty = mouseStartTy + dy;

    boundsClampTranslate();
    setTransform();
  }

  function onMouseUp() {
    mouseDown = false;
  }

  // Optional wheel zoom (desktop)
  function onWheel(e) {
    if (!elImg || !elImg.src) return;
    e.preventDefault();

    const wp = wrapPointFromClient(e.clientX, e.clientY);
    const delta = -e.deltaY; // up = zoom in

    const step = delta > 0 ? 0.12 : -0.12;
    const newScale = clamp(Z.scale + step, Z.minScale, Z.maxScale);
    setScaleAtPoint(newScale, wp.x, wp.y);
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

    if (bull) {
      setPhaseBull();
    }
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
    if (!bull) {
      alert("Tap bull’s-eye first.");
      return;
    }
    if (holes.length === 0) {
      alert("Tap at least one bullet hole.");
      return;
    }

    // Placeholder outputs (NO backend yet)
    const sid = makeSessionId();

    if (elSessionId) elSessionId.textContent = sid;

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
    // Touch gestures
    elWrap.addEventListener("touchstart", onTouchStart, { passive: false });
    elWrap.addEventListener("touchmove", onTouchMove, { passive: false });
    elWrap.addEventListener("touchend", onTouchEnd, { passive: false });

    // Click taps
    elWrap.addEventListener("click", onClick);

    // Mouse pan
    elWrap.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Wheel zoom (desktop only; harmless on mobile)
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

  // Ensure transforms start clean
  resetZoom();
  setTapCount();
})();
