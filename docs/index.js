/* ============================================================
   index.js (FULL REPLACEMENT) — 3-Screen Flow (NO BACKEND YET)
   - Screen 1: Landing (pick photo)
   - Screen 2: Tap (bull first, then holes)
     * CTA row appears ONLY after bull tapped
   - Screen 3: SEC (placeholder values)
   - Download Image: hook only
   - Survey: loose only
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

  // State
  let objectUrl = null;
  let bull = null;      // {x:0..1,y:0..1}
  let holes = [];       // [{x,y}...]
  let phase = "idle";   // idle | bull | holes

  // ---------------------------------
  // Screen control
  // ---------------------------------
  function showScreen(which) {
    if (pageLanding) pageLanding.hidden = (which !== "landing");
    if (pageTap) pageTap.hidden = (which !== "tap");
    if (pageSec) pageSec.hidden = (which !== "sec");
  }

  // ---------------------------------
  // Dots
  // ---------------------------------
  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function drawDot(p, kind) {
    if (!elDots || !p) return;

    const d = document.createElement("div");
    d.className = "dot";
    d.style.left = `${p.x * 100}%`;
    d.style.top = `${p.y * 100}%`;

    // Make bull visually different even if CSS is same
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

  // ---------------------------------
  // Phase / instruction / CTA timing
  // ---------------------------------
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

  // ---------------------------------
  // Tap coordinate
  // ---------------------------------
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function getNormPoint(evt) {
    const r = elWrap.getBoundingClientRect();
    const cx = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const cy = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const x = clamp01((cx - r.left) / r.width);
    const y = clamp01((cy - r.top) / r.height);
    return { x, y };
  }

  // ---------------------------------
  // File load
  // ---------------------------------
  function revokeUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function onFilePicked() {
    const f = elFile.files && elFile.files[0] ? elFile.files[0] : null;
    if (!f) return;

    revokeUrl();
    objectUrl = URL.createObjectURL(f);

    elImg.onload = () => {
      showScreen("tap");
      setPhaseBull();
    };

    elImg.src = objectUrl;
  }

  // ---------------------------------
  // Tap handler
  // ---------------------------------
  function onTap(evt) {
    if (phase !== "bull" && phase !== "holes") return;
    if (!elImg || !elImg.src) return;

    if (evt.type === "touchstart") evt.preventDefault();

    const p = getNormPoint(evt);

    if (phase === "bull") {
      bull = p;
      setTapCount();
      redrawDots();
      setPhaseHoles();
      return;
    }

    // holes
    holes.push(p);
    setTapCount();
    redrawDots();
  }

  // ---------------------------------
  // Undo / Clear / Show Results
  // ---------------------------------
  function onUndo() {
    if (phase !== "holes") return;

    if (holes.length > 0) {
      holes.pop();
      setTapCount();
      redrawDots();
      return;
    }

    // If no holes, undo bull => back to bull phase
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

    // Demo placeholder values (stable looking)
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

  // ---------------------------------
  // SEC buttons (hooks only)
  // ---------------------------------
  function onDownloadImageHook() {
    alert("Download SEC (Image) — hook only for now. Wiring comes at the end.");
  }

  function onSurveyHook() {
    alert("Survey coming next — after everything else is wired.");
  }

  // ---------------------------------
  // Bind
  // ---------------------------------
  if (elFile) elFile.addEventListener("change", onFilePicked);

  if (elWrap) {
    elWrap.addEventListener("click", onTap);
    elWrap.addEventListener("touchstart", onTap, { passive: false });
  }

  if (btnUndo) btnUndo.addEventListener("click", onUndo);
  if (btnClear) btnClear.addEventListener("click", onClear);
  if (btnShow) btnShow.addEventListener("click", onShowResults);

  if (btnDlImg) btnDlImg.addEventListener("click", onDownloadImageHook);
  if (btnSurvey) btnSurvey.addEventListener("click", onSurveyHook);

  // ---------------------------------
  // Boot
  // ---------------------------------
  showScreen("landing");
  if (elTipLine) {
    // ensure Tip is uniform formatting (same brightness)
    elTipLine.style.opacity = "0.92";
  }
})();
