/* docs/index.js (FULL REPLACEMENT) — Brick-2: Content-Rect mapping + TruthLock + Vendor + Score + ShowResults lock */
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

  const elSecLink = $("downloadSecLink");

  // Vendor UI (top + SEC)
  const elVendorTop = $("vendorCardTop");
  const elVendorLinkTop = $("vendorLinkTop");
  const elVendorLogoTop = $("vendorLogoTop");
  const elVendorNameTop = $("vendorNameTop");

  const elVendorSec = $("vendorCardSec");
  const elVendorLinkSec = $("vendorLinkSec");
  const elVendorLogoSec = $("vendorLogoSec");
  const elVendorNameSec = $("vendorNameSec");

  // Bottom sheet
  const elBackdrop = $("sheetBackdrop");
  const elSheet = $("bottomSheet");
  const elSheetClose = $("sheetClose");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;   // {x01,y01}
  let holes = [];    // [{x01,y01}...]

  // Lock state: once results shown, freeze taps until Undo/Clear edits
  let resultsLocked = false;

  // Tap intent
  let down = null;
  const TAP_MAX_MOVE_PX = 12;
  const TAP_MAX_MS = 450;
  let lastTapTs = 0;

  // Internal size proxy until QR payload replaces it (NOT displayed)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmtClicks = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  // ---------------------------
  // Mode
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

  // ---------------------------
  // Vendor (loaded from docs/vendor.json)
  const vendor = {
    name: "Baker Targets",
    url: "https://bakertargets.com",
    logo: "./assets/baker.png"
  };

  async function loadVendor(){
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return applyVendor();
      const data = await res.json();

      if (data && typeof data === "object") {
        if (typeof data.name === "string" && data.name.trim()) vendor.name = data.name.trim();
        if (typeof data.url === "string" && data.url.trim()) vendor.url = data.url.trim();
        if (typeof data.logo === "string" && data.logo.trim()) vendor.logo = data.logo.trim();
      }
    } catch {}
    applyVendor();
  }

  function applyVendor(){
    if (elVendorTop && elVendorLinkTop && elVendorLogoTop && elVendorNameTop) {
      elVendorNameTop.textContent = vendor.name || "—";
      elVendorLogoTop.src = vendor.logo || "";
      elVendorLogoTop.alt = `${vendor.name || "Printer"} logo`;
      elVendorLinkTop.href = vendor.url || "#";
      if (vendor.url) elVendorTop.classList.remove("hidden");
    }

    if (elVendorSec && elVendorLinkSec && elVendorLogoSec && elVendorNameSec) {
      elVendorNameSec.textContent = vendor.name || "—";
      elVendorLogoSec.src = vendor.logo || "";
      elVendorLogoSec.alt = `${vendor.name || "Printer"} logo`;
      elVendorLinkSec.href = vendor.url || "#";
      if (vendor.url) elVendorSec.classList.remove("hidden");
    }
  }

  // ---------------------------
  // UI helpers
  function showDetailsBtn(){ elDetailsBtn.classList.remove("hidden"); }
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

  function updateStatus(){
    elBullState.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    const ready = bull && holes.length >= 1;
    elShow.disabled = !(ready && !resultsLocked);

    if (resultsLocked) elLockHint.classList.remove("hidden");
    else elLockHint.classList.add("hidden");
  }

  function hideResults(){
    elResults.classList.add("hidden");
    elSecLink.classList.add("hidden");
    elSecLink.href = "#";
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

  function unlockEdits(){
    resultsLocked = false;
    hideResults();
    updateStatus();
  }

  // ---------------------------
  // BRICK-2: CONTENT-RECT MAPPING (object-fit: contain safe)
  // Returns the actual rectangle (in client coords) where the image pixels are drawn.
  function contentRectOfImage(){
    const r = elImg.getBoundingClientRect();

    const iw = elImg.naturalWidth || 0;
    const ih = elImg.naturalHeight || 0;

    // If no natural size yet, fall back to full rect (should be rare after load)
    if (!iw || !ih || !r.width || !r.height) return r;

    const imgAR = iw / ih;
    const boxAR = r.width / r.height;

    // object-fit: contain
    let drawW, drawH, left, top;

    if (imgAR > boxAR) {
      // constrained by width
      drawW = r.width;
      drawH = r.width / imgAR;
      left = r.left;
      top = r.top + (r.height - drawH) / 2;
    } else {
      // constrained by height
      drawH = r.height;
      drawW = r.height * imgAR;
      top = r.top;
      left = r.left + (r.width - drawW) / 2;
    }

    return {
      left,
      top,
      width: drawW,
      height: drawH,
      right: left + drawW,
      bottom: top + drawH
    };
  }

  function insideImagePixels(x, y){
    const r = contentRectOfImage();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function clientTo01(x, y){
    const r = contentRectOfImage();
    return {
      x01: clamp01((x - r.left) / r.width),
      y01: clamp01((y - r.top) / r.height),
    };
  }

  // ---------------------------
  // Math helpers
  function inchesPerMOA(distanceYds){
    return 1.047 * (distanceYds / 100); // True MOA
  }

  function meanPoint(points){
    let sx = 0, sy = 0;
    for (const p of points){ sx += p.x01; sy += p.y01; }
    return { x01: sx / points.length, y01: sy / points.length };
  }

  // Score (integer 0..100, no decimals)
  function computeScoreFromOffset(dxIn, dyIn){
    const err = Math.hypot(dxIn, dyIn);
    const MAX_IN = 6.0;
    const raw = 100 - (err / MAX_IN) * 100;
    return Math.round(clamp(raw, 0, 100));
  }

  function applyScoreClass(score){
    rScore.classList.remove("scoreGood", "scoreMid", "scorePoor");
    if (score >= 85) rScore.classList.add("scoreGood");
    else if (score >= 60) rScore.classList.add("scoreMid");
    else rScore.classList.add("scorePoor");
  }

  // ---------------------------
  // BRICK-1: TRUTH LOCK (direction only from signed deltas; refuse if zero)
  function dirFromDx(dxIn){
    if (!Number.isFinite(dxIn) || dxIn === 0) return null;
    return dxIn > 0 ? "RIGHT" : "LEFT";
  }
  function dirFromDy(dyIn){
    if (!Number.isFinite(dyIn) || dyIn === 0) return null;
    // dyIn is image space (down is +)
    return dyIn > 0 ? "DOWN" : "UP";
  }
  function truthGuardDirection(dxIn, dyIn){
    const wind = dirFromDx(dxIn);
    const elev = dirFromDy(dyIn);
    if (!wind || !elev) {
      console.warn("[TNS TruthLock] Refused direction (zero delta)", { dxIn, dyIn, wind, elev });
    }
    return { wind, elev };
  }

  // ---------------------------
  // File load
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name || "Photo selected";

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    elImg.onload = () => {
      // ensure natural sizes available before first tap
      resetSession(true);
      showDetailsBtn();
    };

    elImg.src = objectUrl;
  });

  // ---------------------------
  // Tap intent pipeline (blocked when resultsLocked)
  elWrap.addEventListener("pointerdown", (e) => {
    if (!elImg.src) return;
    if (resultsLocked) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  }, { passive: true });

  elWrap.addEventListener("pointerup", (e) => {
    if (!elImg.src || !down) return;
    if (resultsLocked) return;

    const up = { x: e.clientX, y: e.clientY, t: performance.now() };
    const dt = up.t - down.t;
    const dist = Math.hypot(up.x - down.x, up.y - down.y);
    down = null;

    const now = Date.now();
    if (now - lastTapTs < 120) return;
    lastTapTs = now;

    if (dt > TAP_MAX_MS) return;
    if (dist > TAP_MAX_MOVE_PX) return;

    // Brick-2: MUST be inside actual rendered image pixels
    if (!insideImagePixels(e.clientX, e.clientY)) return;

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

  // ---------------------------
  // Controls
  elUndo.addEventListener("click", () => {
    if (!bull && holes.length === 0) return;

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
    selectedFile = null;

    resetSession(false);
    elDetailsBtn.classList.add("hidden");
  });

  // ---------------------------
  // Show results (LOCKS after first successful run)
  elShow.addEventListener("click", async () => {
    if (resultsLocked) return;
    if (!bull || holes.length < 1) return;

    // LOCK immediately to prevent spam + poisoning
    resultsLocked = true;
    updateStatus();

    const distance = Math.max(1, Number(elDistance?.value || 100));
    const click = Number(elClickValue?.value || 0.25);

    const poib = meanPoint(holes);

    // correction vector = bull - poib
    const dx01 = bull.x01 - poib.x01;
    const dy01 = bull.y01 - poib.y01;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const { wind, elev } = truthGuardDirection(dxIn, dyIn);

    const ipm = inchesPerMOA(distance);
    const windMOA = Math.abs(dxIn) / ipm;
    const elevMOA = Math.abs(dyIn) / ipm;
    const windClicks = windMOA / click;
    const elevClicks = elevMOA / click;

    const score = computeScoreFromOffset(dxIn, dyIn);

    rScore.textContent = String(score);
    applyScoreClass(score);

    rWindDir.textContent = wind || "—";
    rWindClk.textContent = wind ? `${fmtClicks(windClicks)} clicks` : "—";

    rElevDir.textContent = elev || "—";
    rElevClk.textContent = elev ? `${fmtClicks(elevClicks)} clicks` : "—";

    elResults.classList.remove("hidden");

    try {
      const png = await buildSecPng({
        mode: getMode(),
        vendorName: vendor.name,
        vendorLogo: vendor.logo,
        score,
        windDir: wind,
        windClicks,
        elevDir: elev,
        elevClicks
      });
      elSecLink.href = png;
      elSecLink.classList.remove("hidden");
    } catch (err) {
      console.warn("[TNS] SEC PNG build failed", err);
      elSecLink.classList.add("hidden");
    }

    setTimeout(() => elResults.scrollIntoView({ behavior:"smooth", block:"start" }), 30);
  });

  // ---------------------------
  // Mode toggle
  elModeRifle.addEventListener("click", () => setMode("rifle"));
  elModePistol.addEventListener("click", () => setMode("pistol"));

  // ---------------------------
  // Bottom sheet
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

  // ---------------------------
  // SEC PNG builder (Score first + vendor strip)
  async function buildSecPng(s) {
    const W = 1200, H = 675;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Header brand
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

    // Vendor strip
    const vendX = 60, vendY = 150;
    roundRect(ctx, vendX, vendY, 1080, 64, 16);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth=2; ctx.stroke();

    // Logo
    let logoImg = null;
    try { logoImg = await loadImage(s.vendorLogo); } catch {}
    if (logoImg) {
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, vendX + 14, vendY + 10, 44, 44, 10);
      ctx.clip();
      ctx.drawImage(logoImg, vendX + 14, vendY + 10, 44, 44);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Printed by", vendX + 70, vendY + 38);

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(s.vendorName || "—"), vendX + 165, vendY + 38);

    // Main panel
    const x=60, y=230, w=1080, h=400;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth=2; ctx.stroke();

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

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", x+34, y+220);

    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const windDir = s.windDir || "—";
    const elevDir = s.elevDir || "—";

    const windLine = windDir === "—"
      ? `Windage: — → —`
      : `Windage: ${windDir} → ${fmtClicks(s.windClicks)} clicks`;

    const elevLine = elevDir === "—"
      ? `Elevation: — → —`
      : `Elevation: ${elevDir} → ${fmtClicks(s.elevClicks)} clicks`;

    ctx.fillText(windLine, x+34, y+290);
    ctx.fillText(elevLine, x+34, y+345);

    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "750 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Mode: ${String(s.mode || "rifle")}`, x+34, y+410);

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

  function loadImage(src){
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }

  // --- init
  setMode(getMode());
  resetSession(false);
  loadVendor();
})();
