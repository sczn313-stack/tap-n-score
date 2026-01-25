/* docs/index.js (FULL REPLACEMENT) — Frame instruction inside target; Change bull; scroll-vs-tap stability */
(() => {
  const $ = (id) => document.getElementById(id);

  // --- UI
  const elDetailsBtn = $("detailsBtn");
  const elFile = $("photoInput");
  const elFileName = $("fileName");

  const elModeRifle = $("modeRifle");
  const elModePistol = $("modePistol");

  // Hidden inputs (behind the scenes)
  const elDistance = $("distanceYds");
  const elClickValue = $("clickValue");

  const elWrap = $("targetWrap");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");

  const elFrameInstruction = $("frameInstruction");
  const elChangeBull = $("changeBullBtn");

  const elBullState = $("bullState");
  const elHoleCount = $("holeCount");

  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showBtn");

  const elResults = $("resultsCard");
  const elLockHint = $("lockHint");

  const rScore = $("rScore");
  const rWindDir = $("rWindDir");
  const rWindClk = $("rWindClk");
  const rElevDir = $("rElevDir");
  const rElevClk = $("rElevClk");

  const elReceiptLink = $("downloadReceiptLink");

  // Bottom sheet
  const elBackdrop = $("sheetBackdrop");
  const elSheet = $("bottomSheet");
  const elSheetClose = $("sheetClose");

  // --- State
  let objectUrl = null;

  let bull = null;   // {x01,y01}
  let holes = [];    // [{x01,y01}...]

  // Lock state: once results shown, freeze taps until Undo/Clear changes state
  let resultsLocked = false;

  // Tap intent
  let down = null;
  const TAP_MAX_MOVE_PX = 10;     // tighter to reduce accidental taps while scrolling
  const TAP_MAX_MS = 450;
  let lastTapTs = 0;

  // Internal size proxy until QR payload replaces it (NOT displayed)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmtClicks = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setMode(mode){
    const isRifle = mode === "rifle";
    elModeRifle.classList.toggle("active", isRifle);
    elModePistol.classList.toggle("active", !isRifle);
    try { localStorage.setItem("tns_mode", mode); } catch {}
  }

  function getMode(){
    try {
      const m = localStorage.getItem("tns_mode");
      return (m === "pistol" || m === "rifle") ? m : "rifle";
    } catch {
      return "rifle";
    }
  }

  function clearDots(){ elDots.innerHTML = ""; }

  function addDot(p, isBull){
    const d = document.createElement("div");
    d.className = "dot" + (isBull ? " bull" : "");
    d.style.left = `${(p.x01 * 100).toFixed(4)}%`;
    d.style.top  = `${(p.y01 * 100).toFixed(4)}%`;
    elDots.appendChild(d);
  }

  function renderDots(){
    clearDots();
    if (bull) addDot(bull, true);
    for (const h of holes) addDot(h, false);
  }

  function hideResults(){
    elResults.classList.add("hidden");
    elReceiptLink.classList.add("hidden");
    elReceiptLink.href = "#";
  }

  function unlockEdits(){
    resultsLocked = false;
    hideResults();
    updateStatus();
  }

  function updateFrameInstruction(){
    if (!elFrameInstruction) return;

    if (!elImg.src){
      elFrameInstruction.textContent = "Choose a target photo to begin.";
      return;
    }
    if (resultsLocked){
      elFrameInstruction.textContent = "Results locked. Undo/Clear to edit taps.";
      return;
    }
    if (!bull){
      elFrameInstruction.textContent = "Tap the bull first, then tap bullet holes.";
      return;
    }
    elFrameInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function updateStatus(){
    elBullState.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    const ready = bull && holes.length >= 1;
    elShow.disabled = !(ready && !resultsLocked);

    if (resultsLocked) elLockHint.classList.remove("hidden");
    else elLockHint.classList.add("hidden");

    // “Change bull” is a small link, available once bull is set
    if (bull && elImg.src) elChangeBull.classList.remove("hidden");
    else elChangeBull.classList.add("hidden");

    updateFrameInstruction();
  }

  function resetSession(keepImage){
    bull = null;
    holes = [];
    resultsLocked = false;

    clearDots();
    hideResults();
    updateStatus();

    if (!keepImage) elImg.src = "";
  }

  function rectOfImage(){ return elImg.getBoundingClientRect(); }

  function insideImage(x, y){
    const r = rectOfImage();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function clientTo01(x, y){
    const r = rectOfImage();
    return {
      x01: clamp01((x - r.left) / r.width),
      y01: clamp01((y - r.top) / r.height),
    };
  }

  function inchesPerMOA(distanceYds){
    return 1.047 * (distanceYds / 100); // True MOA
  }

  function meanPoint(points){
    let sx = 0, sy = 0;
    for (const p of points){ sx += p.x01; sy += p.y01; }
    return { x01: sx / points.length, y01: sy / points.length };
  }

  // Score: integer 0..100, no decimals.
  // Pilot scoring based on correction distance in inches (radial).
  // 0 inches => 100, 6 inches => 0 (clamped).
  function computeScoreFromOffset(dxIn, dyIn){
    const err = Math.hypot(dxIn, dyIn);
    const MAX_IN = 6.0; // pilot scale (tunable later per target profile)
    const raw = 100 - (err / MAX_IN) * 100;
    return Math.round(clamp(raw, 0, 100));
  }

  function applyScoreClass(score){
    rScore.classList.remove("scoreGood", "scoreMid", "scorePoor");
    if (score >= 85) rScore.classList.add("scoreGood");
    else if (score >= 60) rScore.classList.add("scoreMid");
    else rScore.classList.add("scorePoor");
  }

  function showDetailsBtn(){
    elDetailsBtn.classList.remove("hidden");
  }

  // --- File load
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    elFileName.textContent = f.name || "Photo selected";

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    elImg.onload = () => {
      resetSession(true);
      showDetailsBtn();
      updateFrameInstruction();
    };

    elImg.src = objectUrl;
  });

  // --- Change bull (small link)
  elChangeBull?.addEventListener("click", () => {
    if (!elImg.src) return;
    if (!bull) return;

    // Any edit unlocks results
    if (resultsLocked) unlockEdits();

    bull = null;
    holes = []; // clean reset is safest for shooter truth
    renderDots();
    hideResults();
    updateStatus();
  });

  // --- Tap intent pipeline
  // Stability rule: only register a tap if the gesture STARTS on the image area.
  // If user moves/scrolls, movement cancels the tap.
  elWrap.addEventListener("pointerdown", (e) => {
    if (!elImg.src) return;
    if (resultsLocked) return;

    // Must start on the image (not blank card space)
    if (!insideImage(e.clientX, e.clientY)) return;

    // Avoid multi-touch weirdness (pointer events handle it, but keep it strict)
    down = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      startedOnImage: true
    };
  }, { passive: true });

  elWrap.addEventListener("pointerup", (e) => {
    if (!elImg.src || !down) return;
    if (resultsLocked) { down = null; return; }

    const up = { x: e.clientX, y: e.clientY, t: performance.now() };
    const dt = up.t - down.t;
    const dist = Math.hypot(up.x - down.x, up.y - down.y);
    const startedOnImage = down.startedOnImage;
    down = null;

    const now = Date.now();
    if (now - lastTapTs < 120) return;
    lastTapTs = now;

    if (!startedOnImage) return;
    if (dt > TAP_MAX_MS) return;

    // If they moved, treat as scroll/drag (no tap)
    if (dist > TAP_MAX_MOVE_PX) return;

    // End must also be on the image
    if (!insideImage(e.clientX, e.clientY)) return;

    const p = clientTo01(e.clientX, e.clientY);

    if (!bull){
      bull = p;
      renderDots();
      updateStatus();
      return;
    }

    holes.push(p);
    renderDots();
    updateStatus();
  }, { passive: true });

  // --- Controls
  elUndo.addEventListener("click", () => {
    if (!bull && holes.length === 0) return;

    // Any edit unlocks results
    if (resultsLocked) unlockEdits();

    if (holes.length > 0){
      holes.pop();
      renderDots();
      updateStatus();
      return;
    }
    if (bull){
      bull = null;
      renderDots();
      updateStatus();
    }
  });

  elClear.addEventListener("click", () => {
    resultsLocked = false;

    elFile.value = "";
    elFileName.textContent = "No photo selected";

    if (objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }

    resetSession(false);
    elDetailsBtn.classList.add("hidden");
    updateFrameInstruction();
  });

  // --- Show results (LOCKS after first successful run)
  elShow.addEventListener("click", async () => {
    if (resultsLocked) return;
    if (!bull || holes.length < 1) return;

    // LOCK immediately to prevent spam + poisoning
    resultsLocked = true;
    updateStatus();

    // Behind-the-scenes values (UI hidden)
    const distance = Math.max(1, Number(elDistance?.value || 100));
    const click = Number(elClickValue?.value || 0.25);

    const poib = meanPoint(holes);

    // correction vector = bull - poib
    const dx01 = bull.x01 - poib.x01;
    const dy01 = bull.y01 - poib.y01;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const windAbsIn = Math.abs(dxIn);
    const elevAbsIn = Math.abs(dyIn);

    const ipm = inchesPerMOA(distance);
    const windMOA = windAbsIn / ipm;
    const elevMOA = elevAbsIn / ipm;

    const windClicks = windMOA / click;
    const elevClicks = elevMOA / click;

    // Score (integer)
    const score = computeScoreFromOffset(dxIn, dyIn);

    // Render Results (Score first)
    rScore.textContent = String(score);
    applyScoreClass(score);

    rWindDir.textContent = windDir;
    rWindClk.textContent = `${fmtClicks(windClicks)} clicks`;

    rElevDir.textContent = elevDir;
    rElevClk.textContent = `${fmtClicks(elevClicks)} clicks`;

    elResults.classList.remove("hidden");

    // Build SEC PNG (includes Score first + colored)
    try {
      const png = await buildSecPng({
        mode: getMode(),
        score,
        windDir, windClicks,
        elevDir, elevClicks
      });
      elReceiptLink.href = png;
      elReceiptLink.classList.remove("hidden");
    } catch {
      elReceiptLink.classList.add("hidden");
    }

    setTimeout(() => elResults.scrollIntoView({ behavior:"smooth", block:"start" }), 30);
  });

  // Mode toggle
  elModeRifle.addEventListener("click", () => setMode("rifle"));
  elModePistol.addEventListener("click", () => setMode("pistol"));

  // --- Bottom sheet
  function openSheet(){
    if (elBackdrop && elSheet) {
      elBackdrop.classList.remove("hidden");
      elSheet.classList.remove("hidden");
      elBackdrop.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
  }
  function closeSheet(){
    if (elBackdrop && elSheet) {
      elBackdrop.classList.add("hidden");
      elSheet.classList.add("hidden");
      elBackdrop.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  elDetailsBtn?.addEventListener("click", openSheet);
  elSheetClose?.addEventListener("click", closeSheet);
  elBackdrop?.addEventListener("click", closeSheet);

  // --- SEC PNG builder
  async function buildSecPng(s) {
    const W = 1200, H = 675;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Header brand (R/W/B)
    ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("S", 60, 90);
    ctx.fillStyle = "#ffffff"; ctx.fillText("H", 102, 90);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("O", 148, 90);

    ctx.fillStyle = "#ff3b30"; ctx.fillText("O", 210, 90);
    ctx.fillStyle = "#ffffff"; ctx.fillText("T", 254, 90);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("E", 294, 90);

    ctx.fillStyle = "#ff3b30"; ctx.fillText("R", 354, 90);

    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("™", 420, 78);

    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = "650 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Experience Card (SEC)", 60, 128);

    // Panel
    const x=60, y=170, w=1080, h=450;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth=2; ctx.stroke();

    // SCORE first, biggest
    const scoreColor =
      s.score >= 85 ? "rgba(0,180,90,.95)" :
      s.score >= 60 ? "rgba(255,210,0,.95)" :
                      "rgba(255,70,70,.95)";

    ctx.fillStyle = "rgba(255,255,255,.80)";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SCORE", x+34, y+64);

    ctx.fillStyle = scoreColor;
    ctx.font = "1000 96px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(s.score), x+34, y+152);

    // Corrections header
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", x+34, y+220);

    // Corrections lines (clicks only w/ 2 decimals)
    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${s.windDir} → ${fmtClicks(s.windClicks)} clicks`, x+34, y+290);
    ctx.fillText(`Elevation: ${s.elevDir} → ${fmtClicks(s.elevClicks)} clicks`, x+34, y+345);

    // Mode (no decimals)
    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "750 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Mode: ${s.mode}`, x+34, y+410);

    return c.toDataURL("image/png");
  }

  function roundRect(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  // --- init
  setMode(getMode());
  resetSession(false);
  updateFrameInstruction();
})();
