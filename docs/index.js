/* ============================================================
   index.js (FULL REPLACEMENT) — Frontend-only, Grid-Calibrated
   C-mode (Best): Grid-based calibration so clicks are real & stable.

   Flow:
   1) Select photo -> Tap screen
   2) Tap bull (center)
   3) Calibrate once: tap a grid point 10 squares RIGHT of bull
      - cellSizeIn = 1.00"
      - squaresRight = 10
      - pixelsPerInch computed from bull->cal point distance
   4) Tap hits
   5) Show Results -> POIB -> inches -> MOA -> clicks (locked directions)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Pages
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSec = $("pageSec");

  // Landing
  const photoInput = $("photoInput");
  const distanceYdsEl = $("distanceYds");
  const moaPerClickEl = $("moaPerClick");

  const photoConfirm = $("photoConfirm");
  const photoThumb = $("photoThumb");
  const photoStatus = $("photoStatus");
  const promoSlot = $("promoSlot");

  // Tap screen
  const instructionLine = $("instructionLine");
  const targetWrap = $("targetWrap");
  const targetImg = $("targetImg");
  const dotsLayer = $("dotsLayer");

  const tapCountEl = $("tapCount");
  const resetViewBtn = $("resetViewBtn");

  const ctaRow = $("ctaRow");
  const undoBtn = $("undoBtn");
  const clearBtn = $("clearBtn");
  const showResultsBtn = $("showResultsBtn");

  // SEC
  const secSessionId = $("secSessionId");
  const clickUp = $("clickUp");
  const clickDown = $("clickDown");
  const clickLeft = $("clickLeft");
  const clickRight = $("clickRight");
  const scoreBig = $("scoreBig");
  const scoreCurrent = $("scoreCurrent");
  const scorePrev = $("scorePrev");
  const scoreCum = $("scoreCum");

  const downloadSecImageBtn = $("downloadSecImageBtn");
  const surveyBtn = $("surveyBtn");
  const buyMoreBtn = $("buyMoreBtn");

  // ----------------------------
  // State
  // ----------------------------
  let selectedFile = null;
  let objectUrl = null;

  // Tap points in percent space (0..1 relative to targetWrap)
  let bull = null;       // {xPct,yPct}
  let cal = null;        // {xPct,yPct}
  let taps = [];         // hit taps [{xPct,yPct}]

  // Calibration constants (C-mode)
  const cellSizeIn = 1.0;
  const squaresRight = 10; // user taps a point 10 squares to the RIGHT of bull

  let pxPerIn = null;    // computed after cal tap

  // Simple view reset (keeping your button alive)
  let view = { scale: 1, tx: 0, ty: 0 };

  // ----------------------------
  // Helpers
  // ----------------------------
  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function gotoLanding() {
    setHidden(pageLanding, false);
    setHidden(pageTap, true);
    setHidden(pageSec, true);
  }

  function gotoTap() {
    setHidden(pageLanding, true);
    setHidden(pageTap, false);
    setHidden(pageSec, true);
  }

  function gotoSec() {
    setHidden(pageLanding, true);
    setHidden(pageTap, true);
    setHidden(pageSec, false);
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function safeNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function nowId() {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `SEC-${t}-${r}`;
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function setPhotoSelectedUI(file) {
    revokeObjectUrl();

    if (!file) {
      if (photoConfirm) photoConfirm.classList.remove("hasPhoto");
      if (photoThumb) {
        photoThumb.removeAttribute("src");
        photoThumb.style.visibility = "hidden";
      }
      if (photoStatus) photoStatus.textContent = "No photo selected yet.";
      if (promoSlot) promoSlot.hidden = true;
      return;
    }

    objectUrl = URL.createObjectURL(file);

    if (photoThumb) {
      photoThumb.src = objectUrl;
      photoThumb.style.visibility = "visible";
    }
    if (photoStatus) photoStatus.textContent = "Photo locked ✅";
    if (photoConfirm) photoConfirm.classList.add("hasPhoto");
    if (promoSlot) promoSlot.hidden = false;

    if (targetImg) targetImg.src = objectUrl;
  }

  function resetView() {
    view = { scale: 1, tx: 0, ty: 0 };
    applyView();
  }

  function applyView() {
    if (!targetWrap) return;
    const t = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    targetWrap.style.transformOrigin = "center center";
    targetWrap.style.transform = t;
  }

  function resetTapState() {
    bull = null;
    cal = null;
    taps = [];
    pxPerIn = null;

    if (tapCountEl) tapCountEl.textContent = "0";
    setHidden(ctaRow, true);
    if (instructionLine) instructionLine.textContent = "Tap bull’s-eye to center";

    if (dotsLayer) dotsLayer.innerHTML = "";
  }

  function getWrapPointPct(evt) {
    if (!targetWrap) return null;
    const r = targetWrap.getBoundingClientRect();
    const x = (evt.clientX - r.left) / r.width;
    const y = (evt.clientY - r.top) / r.height;
    return { xPct: clamp(x, 0, 1), yPct: clamp(y, 0, 1) };
  }

  function pctToPx(p) {
    const r = targetWrap.getBoundingClientRect();
    return { x: p.xPct * r.width, y: p.yPct * r.height };
  }

  function addDot(p, kind) {
    if (!dotsLayer || !targetWrap) return;
    const r = targetWrap.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind;

    dot.style.left = `${p.xPct * r.width}px`;
    dot.style.top = `${p.yPct * r.height}px`;

    dotsLayer.appendChild(dot);
  }

  function redrawDots() {
    if (!dotsLayer) return;
    dotsLayer.innerHTML = "";
    if (bull) addDot(bull, "bull");
    if (cal) addDot(cal, "cal");
    for (const t of taps) addDot(t, "hit");
  }

  function updateTapCount() {
    if (tapCountEl) tapCountEl.textContent = String(taps.length);
  }

  function computePxPerInch() {
    if (!bull || !cal) return null;
    const b = pctToPx(bull);
    const c = pctToPx(cal);
    const dx = c.x - b.x;
    const dy = c.y - b.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);

    const knownIn = squaresRight * cellSizeIn;
    if (knownIn <= 0 || distPx <= 0) return null;

    return distPx / knownIn;
  }

  // Inches per MOA at distance
  function inchesPerMOA(distanceYds) {
    // 1 MOA ≈ 1.047" at 100 yards
    return (distanceYds * 1.047) / 100.0;
  }

  // Locked direction truth:
  // - Vector = bull - POIB (in inches)
  // - dxIn > 0 => RIGHT, dxIn < 0 => LEFT
  // - dyIn > 0 => DOWN,  dyIn < 0 => UP   (screen y grows downward)
  function splitClicks(dxIn, dyIn, distYds, moaPerClick) {
    const ipm = inchesPerMOA(distYds);
    const windMoa = Math.abs(dxIn) / ipm;
    const elevMoa = Math.abs(dyIn) / ipm;

    const windClicks = windMoa / moaPerClick;
    const elevClicks = elevMoa / moaPerClick;

    const out = { up: 0, down: 0, left: 0, right: 0 };

    if (dxIn > 0) out.right = windClicks;
    else if (dxIn < 0) out.left = windClicks;

    if (dyIn > 0) out.down = elevClicks;
    else if (dyIn < 0) out.up = elevClicks;

    return out;
  }

  // Simple score (placeholder, but real): based on POIB distance from bull (inches)
  function scoreFromOffset(dxIn, dyIn) {
    const d = Math.sqrt(dxIn * dxIn + dyIn * dyIn); // inches
    // 100 at dead center; loses 10 points per inch; floor at 0
    const s = Math.max(0, Math.round(100 - d * 10));
    return s;
  }

  // ----------------------------
  // Events
  // ----------------------------
  function onPhotoSelected(e) {
    const f = e?.target?.files?.[0] || null;
    selectedFile = f;
    setPhotoSelectedUI(selectedFile);
    if (!selectedFile) return;

    resetTapState();
    resetView();
    gotoTap();

    if (instructionLine) instructionLine.textContent = "Tap bull’s-eye to center";
  }

  function onTargetTap(evt) {
    const p = getWrapPointPct(evt);
    if (!p) return;

    // 1) bull
    if (!bull) {
      bull = p;
      setHidden(ctaRow, true); // still hidden until calibration completed
      if (instructionLine) {
        instructionLine.textContent =
          `Calibration: tap a grid point ${squaresRight} squares RIGHT of the bull`;
      }
      redrawDots();
      return;
    }

    // 2) calibration
    if (!cal) {
      cal = p;
      pxPerIn = computePxPerInch();

      if (!pxPerIn || !Number.isFinite(pxPerIn) || pxPerIn <= 0) {
        // fail safe: reset cal only
        cal = null;
        pxPerIn = null;
        if (instructionLine) {
          instructionLine.textContent =
            `Calibration failed. Tap a grid point ${squaresRight} squares RIGHT of the bull`;
        }
        redrawDots();
        return;
      }

      // Calibration OK: enable CTAs and proceed to hits
      setHidden(ctaRow, false);
      if (instructionLine) instructionLine.textContent = "Now tap each confirmed hit";
      redrawDots();
      return;
    }

    // 3) hits
    taps.push(p);
    updateTapCount();
    redrawDots();
  }

  function onUndo() {
    if (!bull) return;

    // Undo hits first
    if (taps.length > 0) {
      taps.pop();
      updateTapCount();
      redrawDots();
      return;
    }

    // Undo calibration next
    if (cal) {
      cal = null;
      pxPerIn = null;
      setHidden(ctaRow, true);
      if (instructionLine) {
        instructionLine.textContent =
          `Calibration: tap a grid point ${squaresRight} squares RIGHT of the bull`;
      }
      redrawDots();
      return;
    }

    // Undo bull last
    resetTapState();
    redrawDots();
  }

  function onClear() {
    resetTapState();
    redrawDots();
  }

  function onShowResults() {
    const sid = nowId();
    if (secSessionId) secSessionId.textContent = sid;

    // Guardrails
    if (!bull || !cal || !pxPerIn || taps.length === 0) {
      // Show something honest
      setSecClicks({ up: 0, down: 0, left: 0, right: 0 });
      setSecScore("—", "—", "—", "—");
      gotoSec();
      return;
    }

    // Convert taps to px
    const b = pctToPx(bull);
    const hitPx = taps.map((t) => pctToPx(t));

    // POIB in px (average)
    const sum = hitPx.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
    const poibPx = { x: sum.x / hitPx.length, y: sum.y / hitPx.length };

    // Vector from POIB to bull (bull - poib), in inches
    const dxIn = (b.x - poibPx.x) / pxPerIn;
    const dyIn = (b.y - poibPx.y) / pxPerIn;

    const distYds = safeNum(distanceYdsEl?.value, 100);
    const moaPerClick = safeNum(moaPerClickEl?.value, 0.25);

    const clicks = splitClicks(dxIn, dyIn, distYds, moaPerClick);
    setSecClicks(clicks);

    const s = scoreFromOffset(dxIn, dyIn);
    setSecScore(String(s), String(s), "—", "—");

    gotoSec();
  }

  function setSecClicks(c) {
    const up = safeNum(c.up, 0).toFixed(2);
    const down = safeNum(c.down, 0).toFixed(2);
    const left = safeNum(c.left, 0).toFixed(2);
    const right = safeNum(c.right, 0).toFixed(2);

    if (clickUp) clickUp.textContent = up;
    if (clickDown) clickDown.textContent = down;
    if (clickLeft) clickLeft.textContent = left;
    if (clickRight) clickRight.textContent = right;
  }

  function setSecScore(big, cur, prev, cum) {
    if (scoreBig) scoreBig.textContent = big ?? "—";
    if (scoreCurrent) scoreCurrent.textContent = cur ?? "—";
    if (scorePrev) scorePrev.textContent = prev ?? "—";
    if (scoreCum) scoreCum.textContent = cum ?? "—";
  }

  function onDownloadSec() {
    alert("Download SEC is wired. Next: connect to SEC image generator.");
  }

  function onSurvey() {
    alert("Survey is wired. Next: open your 10-second survey link.");
  }

  function onBuyMore() {
    alert("Buy More is wired. Next: route to printer store / landing page.");
  }

  // ----------------------------
  // Wire events
  // ----------------------------
  photoInput?.addEventListener("change", onPhotoSelected);
  targetWrap?.addEventListener("click", onTargetTap);

  resetViewBtn?.addEventListener("click", resetView);

  undoBtn?.addEventListener("click", onUndo);
  clearBtn?.addEventListener("click", onClear);
  showResultsBtn?.addEventListener("click", onShowResults);

  downloadSecImageBtn?.addEventListener("click", onDownloadSec);
  surveyBtn?.addEventListener("click", onSurvey);
  buyMoreBtn?.addEventListener("click", onBuyMore);

  // ----------------------------
  // Boot
  // ----------------------------
  function boot() {
    gotoLanding();
    resetTapState();
    resetView();

    if (promoSlot) promoSlot.hidden = true;
    if (photoStatus) photoStatus.textContent = "No photo selected yet.";
    if (photoConfirm) photoConfirm.classList.remove("hasPhoto");
  }

  boot();
})();
