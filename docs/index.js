/* ============================================================
   index.js (FULL REPLACEMENT) — Tap-n-Score™
   Fixes in this build:
   - Photo selection ALWAYS shows a controlled mini-thumbnail
   - iOS Safari “selected but didn’t stick” mitigation (store File immediately)
   - Landing -> Tap screen transition on successful selection
   - Tap dots render correctly on top of the image
   - Undo / Clear / Reset View wiring (safe defaults)
   - Show Results moves to SEC (optional backend calc if available)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ----------------------------
  // Elements (Landing)
  // ----------------------------
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSec = $("pageSec");

  const photoInput = $("photoInput");
  const tipLine = $("tipLine");

  const photoConfirm = $("photoConfirm");
  const photoThumb = $("photoThumb");
  const photoStatus = $("photoStatus");
  const promoSlot = $("promoSlot");

  // ----------------------------
  // Elements (Tap Screen)
  // ----------------------------
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

  // ----------------------------
  // Elements (SEC)
  // ----------------------------
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

  // Tap state
  let bull = null;          // { xPct, yPct }
  let taps = [];            // [{ xPct, yPct }]
  let dots = [];            // DOM nodes

  // View state (simple transform)
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
      if (photoThumb) photoThumb.removeAttribute("src");
      if (photoStatus) photoStatus.textContent = "No photo selected yet.";
      if (promoSlot) promoSlot.hidden = true;
      return;
    }

    objectUrl = URL.createObjectURL(file);

    // Controlled mini-thumbnail (Landing)
    if (photoThumb) photoThumb.src = objectUrl;
    if (photoStatus) photoStatus.textContent = "Photo locked ✅";
    if (photoConfirm) photoConfirm.classList.add("hasPhoto");
    if (promoSlot) promoSlot.hidden = false;

    // Main image for Tap page
    if (targetImg) targetImg.src = objectUrl;
  }

  function resetTapState() {
    bull = null;
    taps = [];
    tapCountEl && (tapCountEl.textContent = "0");
    if (instructionLine) instructionLine.textContent = "Tap bull’s-eye to center";

    // Hide CTAs until bull is set
    setHidden(ctaRow, true);

    // Clear dots
    if (dotsLayer) dotsLayer.innerHTML = "";
    dots = [];
  }

  function resetView() {
    view = { scale: 1, tx: 0, ty: 0 };
    applyView();
  }

  function applyView() {
    // Keep it simple & safe: apply transform to the WRAP so dots+img stay aligned
    if (!targetWrap) return;
    const t = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    targetWrap.style.transformOrigin = "center center";
    targetWrap.style.transform = t;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function getWrapPointPct(evt) {
    // Return point in % (0..1) inside the displayed wrap bounds
    if (!targetWrap) return null;
    const r = targetWrap.getBoundingClientRect();
    const x = (evt.clientX - r.left) / r.width;
    const y = (evt.clientY - r.top) / r.height;
    return { xPct: clamp(x, 0, 1), yPct: clamp(y, 0, 1) };
  }

  function addDot(xPct, yPct, kind) {
    if (!dotsLayer) return;

    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.dataset.kind = kind || "hit";

    // position in px relative to wrap
    const r = targetWrap.getBoundingClientRect();
    const x = xPct * r.width;
    const y = yPct * r.height;

    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;

    dotsLayer.appendChild(dot);
    dots.push(dot);
  }

  function redrawDots() {
    if (!dotsLayer || !targetWrap) return;
    dotsLayer.innerHTML = "";
    dots = [];

    if (bull) addDot(bull.xPct, bull.yPct, "bull");
    for (const t of taps) addDot(t.xPct, t.yPct, "hit");
  }

  function updateTapCount() {
    if (tapCountEl) tapCountEl.textContent = String(taps.length);
  }

  function ensureDotCss() {
    // If your CSS already styles .tapDot, this is harmless.
    // If not, it ensures dots are visible.
    const id = "tapdot-css-fallback";
    if (document.getElementById(id)) return;

    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      .dotsLayer{ position:absolute; inset:0; pointer-events:none; }
      .tapDot{
        position:absolute;
        width:14px; height:14px;
        border-radius:50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 6px 18px rgba(0,0,0,0.45);
        border: 1px solid rgba(255,255,255,0.55);
        background: rgba(255,255,255,0.85);
      }
      .tapDot[data-kind="bull"]{
        width:18px; height:18px;
        border-radius: 6px;
        background: rgba(0,140,255,0.9);
      }
      .tapDot[data-kind="hit"]{
        background: rgba(255,255,255,0.90);
      }
      .targetWrap{ position:relative; }
      .targetImg{ display:block; width:100%; height:auto; }
    `;
    document.head.appendChild(s);
  }

  function genSessionId() {
    // Not crypto — just a readable short session id.
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `SEC-${t}-${r}`;
  }

  function safeNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  // ----------------------------
  // Optional backend calc
  // ----------------------------
  async function tryBackendCalc(payload) {
    // If backend exists, great. If not, we fall back safely.
    // You can change this endpoint later.
    const url = "/api/calc";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function fallbackCalc() {
    // Minimal safe fallback: compute POIB as average of hit taps (in % space),
    // then just show zero clicks (since inches/MOA depend on target calibration).
    if (!bull || taps.length === 0) {
      return {
        clicks: { up: 0, down: 0, left: 0, right: 0 },
        score: { big: "—", current: "—", prev: "—", cum: "—" },
      };
    }
    const avg = taps.reduce(
      (a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }),
      { x: 0, y: 0 }
    );
    avg.x /= taps.length;
    avg.y /= taps.length;

    // direction ONLY (not magnitude)
    const dx = bull.xPct - avg.x; // + => need RIGHT (POIB left of bull)
    const dy = bull.yPct - avg.y; // + => need DOWN? careful: y grows downward on screen
    // We will not output directional clicks here — keep it neutral.
    return {
      clicks: { up: 0, down: 0, left: 0, right: 0 },
      score: { big: "—", current: "—", prev: "—", cum: "—" },
    };
  }

  function setSecValues(out) {
    const c = out?.clicks || {};
    const s = out?.score || {};

    if (clickUp) clickUp.textContent = (safeNum(c.up)).toFixed(2);
    if (clickDown) clickDown.textContent = (safeNum(c.down)).toFixed(2);
    if (clickLeft) clickLeft.textContent = (safeNum(c.left)).toFixed(2);
    if (clickRight) clickRight.textContent = (safeNum(c.right)).toFixed(2);

    if (scoreBig) scoreBig.textContent = s.big ?? "—";
    if (scoreCurrent) scoreCurrent.textContent = s.current ?? "—";
    if (scorePrev) scorePrev.textContent = s.prev ?? "—";
    if (scoreCum) scoreCum.textContent = s.cum ?? "—";
  }

  // ----------------------------
  // Events
  // ----------------------------
  function onPhotoSelected(e) {
    // iOS Safari reliability: store immediately from change event
    const f = e?.target?.files?.[0] || null;
    selectedFile = f;

    setPhotoSelectedUI(selectedFile);

    if (!selectedFile) return;

    ensureDotCss();
    resetTapState();
    resetView();

    // Advance to Tap screen
    gotoTap();

    // Helpful instruction
    if (instructionLine) instructionLine.textContent = "Tap bull’s-eye to center";
  }

  function onTargetTap(evt) {
    // Only respond to taps inside the stage
    // Important: dotsLayer has pointer-events:none, so tap hits wrap/image.
    const p = getWrapPointPct(evt);
    if (!p) return;

    // First tap is bull
    if (!bull) {
      bull = { xPct: p.xPct, yPct: p.yPct };
      if (instructionLine) instructionLine.textContent = "Now tap each confirmed hit";
      setHidden(ctaRow, false);
      redrawDots();
      return;
    }

    // Additional taps are hits
    taps.push({ xPct: p.xPct, yPct: p.yPct });
    updateTapCount();
    redrawDots();
  }

  function onUndo() {
    if (!bull) return;

    if (taps.length > 0) {
      taps.pop();
      updateTapCount();
      redrawDots();
      return;
    }

    // If no taps left, undo bull
    bull = null;
    resetTapState();
    redrawDots();
  }

  function onClear() {
    resetTapState();
    redrawDots();
  }

  async function onShowResults() {
    // Move to SEC regardless; fill values from backend if available
    const sid = genSessionId();
    if (secSessionId) secSessionId.textContent = sid;

    // Prepare payload (percent coords + image size)
    const payload = {
      sessionId: sid,
      bull,
      taps,
      image: {
        naturalWidth: targetImg?.naturalWidth || null,
        naturalHeight: targetImg?.naturalHeight || null,
      },
      // add more fields later (distance, moaPerClick, targetType, etc.)
    };

    let out = await tryBackendCalc(payload);
    if (!out) out = fallbackCalc();

    setSecValues(out);
    gotoSec();
  }

  function onDownloadSec() {
    // Placeholder: you likely generate SEC image elsewhere.
    // For now: download the current screen as a simple fallback? (Not implemented.)
    alert("Download SEC is wired. Next: connect to your SEC image generator.");
  }

  function onSurvey() {
    // Placeholder: replace with your survey link/modal
    alert("Survey is wired. Next: open your 10-second survey link.");
  }

  function onBuyMore() {
    // Placeholder: replace with vendor link
    alert("Buy More is wired. Next: route to printer store / landing page.");
  }

  // Reset View (simple)
  resetViewBtn?.addEventListener("click", resetView);

  // Undo/Clear/Results
  undoBtn?.addEventListener("click", onUndo);
  clearBtn?.addEventListener("click", onClear);
  showResultsBtn?.addEventListener("click", onShowResults);

  // SEC actions
  downloadSecImageBtn?.addEventListener("click", onDownloadSec);
  surveyBtn?.addEventListener("click", onSurvey);
  buyMoreBtn?.addEventListener("click", onBuyMore);

  // Tap handler
  // We attach to targetWrap so it works even if image hasn’t fully loaded yet.
  targetWrap?.addEventListener("click", onTargetTap);

  // File select
  photoInput?.addEventListener("change", onPhotoSelected);

  // ----------------------------
  // Boot
  // ----------------------------
  function boot() {
    // Start on landing
    gotoLanding();
    resetTapState();
    resetView();

    // Landing UI defaults
    if (promoSlot) promoSlot.hidden = true;
    if (photoStatus) photoStatus.textContent = "No photo selected yet.";
    if (photoConfirm) photoConfirm.classList.remove("hasPhoto");

    // NOTE: thumbnail stays hidden until a photo is selected (CSS does that)
  }

  // Ensure dots are visible even if CSS misses it
  ensureDotCss();

  boot();
})();
