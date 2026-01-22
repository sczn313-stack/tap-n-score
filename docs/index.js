/* docs/index.js (FULL REPLACEMENT) — remove “target” from ALL UI text except the button */
(() => {
  const $ = (id) => document.getElementById(id);

  // --- UI
  const elChooseRow = $("chooseTargetRow");
  const elDetailsBtn = $("detailsBtn");
  const elFile = $("photoInput");
  const elFileName = $("fileName");

  const elModeRifle = $("modeRifle");
  const elModePistol = $("modePistol");
  const elDistance = $("distanceYds");
  const elClickValue = $("clickValue");
  const elInstruction = $("instructionLine");

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

  const elConfidenceChip = $("confidenceChip");
  const rConfidence = $("rConfidence");

  const elReceiptLink = $("downloadReceiptLink");

  // Bottom sheet
  const elBackdrop = $("sheetBackdrop");
  const elSheet = $("bottomSheet");
  const elSheetClose = $("sheetClose");
  const tabWhat = $("tabWhat");
  const tabHow = $("tabHow");
  const tabPrinters = $("tabPrinters");
  const panelWhat = $("panelWhat");
  const panelHow = $("panelHow");
  const panelPrinters = $("panelPrinters");

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

  // Internal size proxy until QR payload replaces it (not displayed)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmtClicks = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setInstruction(s){ elInstruction.textContent = s; }

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

  function resetSession(keepImage){
    bull = null;
    holes = [];
    clearDots();
    updateStatus();

    elResults.classList.add("hidden");
    elReceiptLink.classList.add("hidden");
    elReceiptLink.href = "#";

    elConfidenceChip.classList.add("hidden");
    rConfidence.textContent = "—";

    if (!keepImage) elImg.src = "";

    // No “target” here
    setInstruction(selectedFile ? "Tap bull first → then tap each hole." : "Choose a photo to begin.");
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

  function normDeltaToInches(dx01, dy01){
    return { dxIn: dx01 * PAPER_W_IN, dyIn: dy01 * PAPER_H_IN };
  }

  function inchesPerMOA(distanceYds){
    return 1.047 * (distanceYds / 100); // True MOA
  }

  function meanPoint(points){
    let sx = 0, sy = 0;
    for (const p of points){ sx += p.x01; sy += p.y01; }
    return { x01: sx / points.length, y01: sy / points.length };
  }

  function confidenceLabel(offsetIn, meanRadIn){
    const tight = meanRadIn <= 0.60;
    const close = offsetIn <= 2.00;
    if (tight && close) return "HIGH";
    if (tight || close) return "MEDIUM";
    return "LOW";
  }

  function hideChooseUIAfterLoad(){
    elChooseRow.style.display = "none";
    elDetailsBtn.classList.remove("hidden");
  }

  function showChooseUIOnClear(){
    elChooseRow.style.display = "";
    elDetailsBtn.classList.add("hidden");
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
      hideChooseUIAfterLoad();
      resetSession(true);
      setInstruction("Tap bull first → then tap each hole.");
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
      setInstruction("Bull set ✅ Now tap each bullet hole.");
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
      setInstruction("Tap bull first → then tap each hole.");
    }
  });

  elClear.addEventListener("click", () => {
    showChooseUIOnClear();
    elFile.value = "";
    elFileName.textContent = "No photo selected";

    if (objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }
    selectedFile = null;

    resetSession(false);
  });

  elShow.addEventListener("click", async () => {
    if (!bull || holes.length < 1) return;

    const distance = Math.max(1, Number(elDistance.value || 100));
    const click = Number(elClickValue.value || 0.25);

    const poib = meanPoint(holes);

    // correction vector = bull - poib
    const dx01 = bull.x01 - poib.x01;
    const dy01 = bull.y01 - poib.y01;

    const { dxIn, dyIn } = normDeltaToInches(dx01, dy01);

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

    // Confidence word only
    const offsetMagIn = Math.hypot(dxIn, dyIn);

    let meanRadIn = 0;
    {
      let sum = 0;
      for (const p of holes){
        const ddx = (p.x01 - poib.x01) * PAPER_W_IN;
        const ddy = (p.y01 - poib.y01) * PAPER_H_IN;
        sum += Math.hypot(ddx, ddy);
      }
      meanRadIn = sum / holes.length;
    }

    rConfidence.textContent = confidenceLabel(offsetMagIn, meanRadIn);
    elConfidenceChip.classList.remove("hidden");

    elResults.classList.remove("hidden");

    try {
      const png = await buildReceiptPng({
        mode: getMode(),
        distance,
        holesUsed: holes.length,
        windDir,
        windClicks,
        elevDir,
        elevClicks
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

  // --- Bottom sheet behavior
  function openSheet(){
    elBackdrop.classList.remove("hidden");
    elSheet.classList.remove("hidden");
    elBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeSheet(){
    elBackdrop.classList.add("hidden");
    elSheet.classList.add("hidden");
    elBackdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function activateTab(which){
    tabWhat.classList.toggle("active", which === "what");
    tabHow.classList.toggle("active", which === "how");
    tabPrinters.classList.toggle("active", which === "printers");

    panelWhat.classList.toggle("hidden", which !== "what");
    panelHow.classList.toggle("hidden", which !== "how");
    panelPrinters.classList.toggle("hidden", which !== "printers");
  }

  elDetailsBtn.addEventListener("click", openSheet);
  elSheetClose.addEventListener("click", closeSheet);
  elBackdrop.addEventListener("click", closeSheet);

  tabWhat.addEventListener("click", () => activateTab("what"));
  tabHow.addEventListener("click", () => activateTab("how"));
  tabPrinters.addEventListener("click", () => activateTab("printers"));

  // Swipe-down to close
  let sheetStartY = null;
  elSheet.addEventListener("touchstart", (e) => {
    sheetStartY = e.touches && e.touches[0] ? e.touches[0].clientY : null;
  }, { passive: true });
  elSheet.addEventListener("touchend", (e) => {
    if (sheetStartY == null) return;
    const endY = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : sheetStartY;
    const dy = endY - sheetStartY;
    sheetStartY = null;
    if (dy > 90) closeSheet();
  }, { passive: true });

  // Receipt PNG builder (Clicks-only numbers)
  async function buildReceiptPng(s) {
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
    ctx.fillText("After-Shot Intelligence Receipt", 60, 128);

    // Left panel
    const lx=60, ly=170, lw=520, lh=430;
    roundRect(ctx, lx, ly, lw, lh, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth=2; ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Session", lx+24, ly+52);

    ctx.font = "650 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    let y = ly+95;

    lineKV(ctx, lx+24, y, "Mode:", s.mode); y+=38;
    lineKV(ctx, lx+24, y, "Distance:", String(s.distance)); y+=38;
    lineKV(ctx, lx+24, y, "Holes:", String(s.holesUsed)); y+=52;

    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText("Corrections", lx+24, y); y+=42;

    ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${s.windDir} → ${fmtClicks(s.windClicks)} clicks`, lx+24, y); y+=42;
    ctx.fillText(`Elevation: ${s.elevDir} → ${fmtClicks(s.elevClicks)} clicks`, lx+24, y); y+=60;

    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "750 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Next: confirm with a follow-up group.", lx+24, y);

    // Right image box
    const rx=620, ry=170, rw=520, rh=430;
    roundRect(ctx, rx, ry, rw, rh, 22);
    ctx.fillStyle = "rgba(255,255,255,.03)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.stroke();

    try {
      ctx.save();
      ctx.beginPath(); roundRect(ctx, rx, ry, rw, rh, 22); ctx.clip();

      const bmp = await createImageBitmap(selectedFile);
      const arImg = bmp.width / bmp.height;
      const arBox = rw / rh;

      let dw, dh, dx, dy;
      if (arImg > arBox){ dw = rw; dh = rw / arImg; dx = rx; dy = ry + (rh - dh)/2; }
      else { dh = rh; dw = rh * arImg; dx = rx + (rw - dw)/2; dy = ry; }

      ctx.drawImage(bmp, dx, dy, dw, dh);

      const drawDot = (p, color) => {
        const px = dx + p.x01 * dw;
        const py = dy + p.y01 * dh;
        ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
      };

      if (bull) drawDot(bull, "rgba(255,215,0,.95)");
      for (const h of holes) drawDot(h, "rgba(0,255,160,.92)");

      ctx.restore();
    } catch {}

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

  function lineKV(ctx, x, y, k, v){
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.fillText(k, x, y);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(v, x+200, y);
  }

  // --- init
  setMode(getMode());
  activateTab("what");
  resetSession(false);
  elDetailsBtn.classList.add("hidden");
})();
