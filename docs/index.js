/* docs/index.js (FULL REPLACEMENT) — Pilot clean: hides choose card after load; SEC naming; removes extra tip copy */
(() => {
  const $ = (id) => document.getElementById(id);

  // --- UI
  const elDetailsBtn = $("detailsBtn");

  const elChooseCard = $("chooseCard");
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

  const elBullState = $("bullState");
  const elHoleCount = $("holeCount");

  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showBtn");

  const elResults = $("resultsCard");
  const rWindDir = $("rWindDir");
  const rWindClk = $("rWindClk");
  const rElevDir = $("rElevDir");
  const rElevClk = $("rElevClk");

  const elSecLink = $("downloadSecLink");

  // Bottom sheet
  const elBackdrop = $("sheetBackdrop");
  const elSheet = $("bottomSheet");
  const elSheetClose = $("sheetClose");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;   // {x01,y01}
  let holes = [];    // [{x01,y01}...]

  // Tap intent
  let down = null;
  const TAP_MAX_MOVE_PX = 12;
  const TAP_MAX_MS = 450;
  let lastTapTs = 0;

  // Internal size proxy until QR payload replaces it (NOT displayed)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
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

  function updateStatus(){
    elBullState.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);
    elShow.disabled = !(bull && holes.length >= 1);
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

  function resetSession(keepImage){
    bull = null;
    holes = [];
    clearDots();
    updateStatus();

    elResults.classList.add("hidden");
    elSecLink.classList.add("hidden");
    elSecLink.href = "#";

    if (!keepImage) elImg.src = "";
  }

  function showDetailsBtn(){
    elDetailsBtn.classList.remove("hidden");
  }

  function hideChooseCard(){
    // You requested: once target photo is on screen, "choose photo" should disappear.
    if (elChooseCard) elChooseCard.classList.add("hidden");
  }

  function showChooseCard(){
    if (elChooseCard) elChooseCard.classList.remove("hidden");
  }

  // --- File load
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name || "Photo selected";

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    elImg.onload = () => {
      resetSession(true);
      showDetailsBtn();
      hideChooseCard();
    };

    elImg.src = objectUrl;
  });

  // --- Tap intent pipeline
  elWrap.addEventListener("pointerdown", (e) => {
    if (!elImg.src) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  }, { passive: true });

  elWrap.addEventListener("pointerup", (e) => {
    if (!elImg.src || !down) return;

    const up = { x: e.clientX, y: e.clientY, t: performance.now() };
    const dt = up.t - down.t;
    const dist = Math.hypot(up.x - down.x, up.y - down.y);
    down = null;

    const now = Date.now();
    if (now - lastTapTs < 120) return;
    lastTapTs = now;

    if (dt > TAP_MAX_MS) return;
    if (dist > TAP_MAX_MOVE_PX) return;
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
    // Fully reset back to start state
    elFile.value = "";
    elFileName.textContent = "No photo selected";

    if (objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }
    selectedFile = null;

    resetSession(false);
    elDetailsBtn.classList.add("hidden");
    showChooseCard();
  });

  // --- Show results
  elShow.addEventListener("click", async () => {
    if (!bull || holes.length < 1) return;

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

    rWindDir.textContent = windDir;
    rWindClk.textContent = `${fmtClicks(windClicks)} clicks`;

    rElevDir.textContent = elevDir;
    rElevClk.textContent = `${fmtClicks(elevClicks)} clicks`;

    elResults.classList.remove("hidden");

    try {
      const png = await buildSecPng({
        mode: getMode(),
        windDir, windClicks,
        elevDir, elevClicks
      });
      elSecLink.href = png;
      elSecLink.classList.remove("hidden");
    } catch {
      elSecLink.classList.add("hidden");
    }

    setTimeout(() => elResults.scrollIntoView({ behavior:"smooth", block:"start" }), 30);
  });

  // Mode toggle
  elModeRifle.addEventListener("click", () => setMode("rifle"));
  elModePistol.addEventListener("click", () => setMode("pistol"));

  // --- Bottom sheet (Details)
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

  // --- SEC PNG builder (Clicks-only numbers; 2 decimals)
  async function buildSecPng(s) {
    const W = 1200, H = 675;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("TAP", 60, 90);
    ctx.fillStyle = "#ffffff"; ctx.fillText("-N-", 170, 90);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("SCORE", 270, 90);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("™", 470, 78);

    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = "650 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Shooter Experience Card (SEC)", 60, 128);

    // Panel
    const x=60, y=180, w=1080, h=420;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth=2; ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections (Scope)", x+34, y+70);

    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${s.windDir} → ${fmtClicks(s.windClicks)} clicks`, x+34, y+140);
    ctx.fillText(`Elevation: ${s.elevDir} → ${fmtClicks(s.elevClicks)} clicks`, x+34, y+195);

    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "750 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Mode: ${s.mode}`, x+34, y+270);

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
})();
