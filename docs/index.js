/* ============================================================
   docs/index.js (FULL REPLACEMENT) — SCORE BACK (color bands)
   - Keeps stable tap system
   - Truth Gate stays
   - Score based on radial error inches (tunable MAX_IN)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  const elBullStatus = $("bullStatus");
  const elHoleCount = $("holeCount");
  const elInstruction = $("instructionLine");

  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elLockBanner = $("lockBanner");

  const elWindDir = $("windageDir");
  const elWindVal = $("windageVal");
  const elElevDir = $("elevDir");
  const elElevVal = $("elevVal");
  const elWindArrow = $("windArrow");
  const elElevArrow = $("elevArrow");

  const elScoreBig = $("scoreBig");

  const elDownloadSEC = $("downloadSecBtn");

  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");
  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // Defaults (pilot)
  const DEFAULT_DISTANCE_YDS = 100;
  const DEFAULT_CLICK_MOA = 0.25;

  // Auto-detect + fallback (pilot)
  const SIZE_85x11 = { w: 8.5, h: 11.0, label: "8.5x11" };

  let scale = {
    paperWIn: SIZE_85x11.w,
    paperHIn: SIZE_85x11.h,
    distanceYds: DEFAULT_DISTANCE_YDS,
    clickMoa: DEFAULT_CLICK_MOA,
  };

  let objectUrl = null;
  let bull = null; // {nx,ny,ix,iy}
  let holes = [];
  let resultsLocked = false;

  let vendor = null;
  let vendorLogoImg = null;

  // Scroll-safe tap filtering
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // SCORE tuning (pilot)
  // 0" error => 100 ; MAX_IN error => 0
  const SCORE_MAX_IN = 6.0;

  function computeScore(dxIn, dyIn) {
    const err = Math.hypot(dxIn, dyIn);
    const raw = 100 - (err / SCORE_MAX_IN) * 100;
    const s = Math.round(Math.max(0, Math.min(100, raw)));
    return s;
  }

  function applyScoreClass(score) {
    elScoreBig.classList.remove("scoreGood", "scoreMid", "scorePoor");
    if (score >= 85) elScoreBig.classList.add("scoreGood");
    else if (score >= 60) elScoreBig.classList.add("scoreMid");
    else elScoreBig.classList.add("scorePoor");
  }

  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target.";
      return;
    }
    if (!bull) {
      elInstruction.textContent = "Tap bull’s-eye first, then tap bullet holes.";
      return;
    }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus() {
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    elUndo.disabled = !(bull || holes.length);
    elClear.disabled = !(bull || holes.length);

    const ready = !!bull && holes.length > 0;
    elShow.disabled = !(ready && !resultsLocked);

    elLockBanner.hidden = !resultsLocked;
  }

  function resetResultsUI() {
    elScoreBig.textContent = "—";
    elScoreBig.classList.remove("scoreGood", "scoreMid", "scorePoor");
    elScoreBig.classList.add("scoreGood");

    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";
    elWindArrow.textContent = "→";
    elElevArrow.textContent = "→";
    elDownloadSEC.disabled = true;
  }

  function renderDots() {
    elDots.innerHTML = "";

    if (bull) {
      const d = document.createElement("div");
      d.className = "dot bullDot";
      d.style.left = `${bull.nx * 100}%`;
      d.style.top = `${bull.ny * 100}%`;
      elDots.appendChild(d);
    }

    for (const p of holes) {
      const d = document.createElement("div");
      d.className = "dot holeDot";
      d.style.left = `${p.nx * 100}%`;
      d.style.top = `${p.ny * 100}%`;
      elDots.appendChild(d);
    }
  }

  function lockResults() {
    resultsLocked = true;
    setStatus();
  }
  function unlockResults() {
    resultsLocked = false;
    setStatus();
  }

  function clientToImagePoint(clientX, clientY) {
    const rect = elImg.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);

    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    const ix = nx * iw;
    const iy = ny * ih;
    return { nx, ny, ix, iy };
  }

  function meanPointNorm(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.nx; sy += p.ny; }
    return { nx: sx / points.length, ny: sy / points.length };
  }

  // Truth Gate (cannot lie)
  function truthGateDirections(dxIn, dyIn, windDir, elevDir) {
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return { ok: (windDir === wantWind) && (elevDir === wantElev) };
  }

  function arrowForDirection(dir) {
    switch (dir) {
      case "LEFT": return "←";
      case "RIGHT": return "→";
      case "UP": return "↑";
      case "DOWN": return "↓";
      default: return "→";
    }
  }

  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;
      vendor = await res.json();

      const name = vendor?.name || "—";
      elVendorName.textContent = name;
      elVendorNameMini.textContent = name;

      if (vendor?.logoPath) {
        elVendorLogo.src = vendor.logoPath;
        elVendorLogoMini.src = vendor.logoPath;
        elVendorLogo.style.display = "block";
        elVendorLogoMini.style.display = "block";

        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      } else {
        elVendorLogo.style.display = "none";
        elVendorLogoMini.style.display = "none";
      }

      if (vendor?.website) {
        elVendorPill.style.cursor = "pointer";
        elVendorPill.title = vendor.website;
        elVendorPill.onclick = () => window.open(vendor.website, "_blank", "noopener,noreferrer");
      }
    } catch {}
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetAllState() {
    bull = null;
    holes = [];
    resultsLocked = false;
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function autoDetectScale() {
    // Pilot: keep it simple for now (still stable)
    // Later: use vendor overrides + real grid detection.
    scale.paperWIn = SIZE_85x11.w;
    scale.paperHIn = SIZE_85x11.h;
    scale.distanceYds = DEFAULT_DISTANCE_YDS;
    scale.clickMoa = DEFAULT_CLICK_MOA;

    // Vendor override (if you later add these fields)
    if (vendor?.paperWIn && vendor?.paperHIn) {
      scale.paperWIn = Number(vendor.paperWIn) || scale.paperWIn;
      scale.paperHIn = Number(vendor.paperHIn) || scale.paperHIn;
    }
    if (vendor?.distanceYds) scale.distanceYds = Number(vendor.distanceYds) || scale.distanceYds;
    if (vendor?.clickMoa) scale.clickMoa = Number(vendor.clickMoa) || scale.clickMoa;
  }

  function onFileSelected(file) {
    if (!file) return;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      elTapLayer.style.pointerEvents = "auto";
      autoDetectScale();
      resetAllState();
    };

    elImg.src = objectUrl;
  }

  // Add tap
  function addTapPoint(pt) {
    if (!elImg.src) return;
    if (resultsLocked) return;

    if (!bull) {
      bull = pt;
      holes = [];
      resetResultsUI();
      unlockResults();
      setInstruction();
      setStatus();
      renderDots();
      return;
    }

    holes.push(pt);
    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  // Pointer handlers (scroll-safe)
  function onPointerDown(e) {
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptrDown = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), moved:false };
  }
  function onPointerMove(e) {
    if (!ptrDown || e.pointerId !== ptrDown.id) return;
    const dx = e.clientX - ptrDown.x;
    const dy = e.clientY - ptrDown.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) ptrDown.moved = true;
  }
  function onPointerUp(e) {
    if (!ptrDown || e.pointerId !== ptrDown.id) return;
    const elapsed = Date.now() - ptrDown.t;
    const moved = ptrDown.moved;
    ptrDown = null;
    if (moved) return;
    if (elapsed > TAP_TIME_MS) return;

    addTapPoint(clientToImagePoint(e.clientX, e.clientY));
  }
  function onPointerCancel(e) {
    if (!ptrDown || e.pointerId !== ptrDown.id) return;
    ptrDown = null;
  }

  function undo() {
    if (holes.length) holes.pop();
    else if (bull) bull = null;

    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearAll() {
    bull = null;
    holes = [];
    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function computeAndRender() {
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);

    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    const dxIn = dx01 * scale.paperWIn;
    const dyIn = dy01 * scale.paperHIn;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const gate = truthGateDirections(dxIn, dyIn, windDir, elevDir);
    if (!gate.ok) {
      resetResultsUI();
      elWindDir.textContent = "DIRECTION ERROR";
      elWindVal.textContent = "LOCKED";
      elElevDir.textContent = "DIRECTION ERROR";
      elElevVal.textContent = "LOCKED";
      elDownloadSEC.disabled = true;
      resultsLocked = false;
      setStatus();
      return;
    }

    const ipm = inchesPerMOA(scale.distanceYds);
    const windClicks = (Math.abs(dxIn) / ipm) / scale.clickMoa;
    const elevClicks = (Math.abs(dyIn) / ipm) / scale.clickMoa;

    // SCORE
    const score = computeScore(dxIn, dyIn);
    elScoreBig.textContent = String(score);
    applyScoreClass(score);

    // UI
    elWindDir.textContent = windDir;
    elWindArrow.textContent = arrowForDirection(windDir);
    elWindVal.textContent = `${fmt2(windClicks)} clicks`;

    elElevDir.textContent = elevDir;
    elElevArrow.textContent = arrowForDirection(elevDir);
    elElevVal.textContent = `${fmt2(elevClicks)} clicks`;

    elDownloadSEC.disabled = false;
    lockResults();
  }

  async function buildSecPng(payload) {
    const W = 1200, H = 675;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("CARD", 720, 86);

    // SEC letters
    ctx.font = "1000 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("S", 60, 132);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText("E", 92, 132);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("C", 124, 132);

    // Vendor top-right
    const vName = vendor?.name || "Printer";
    ctx.font = "850 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.textAlign = "right";
    ctx.fillText(vName, W - 70, 120);
    ctx.textAlign = "left";

    if (vendorLogoImg && vendorLogoImg.complete) {
      const size = 64;
      const x = W - 70 - size;
      const y = 38;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI*2);
      ctx.clip();
      ctx.drawImage(vendorLogoImg, x, y, size, size);
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 + 1, 0, Math.PI*2);
      ctx.stroke();
    }

    // Panel
    const px=60, py=170, pw=1080, ph=440;
    roundRect(ctx, px, py, pw, ph, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth=2; ctx.stroke();

    // SCORE (big + colored)
    const scoreColor =
      payload.score >= 85 ? "rgba(0,180,90,.95)" :
      payload.score >= 60 ? "rgba(255,210,0,.95)" :
                            "rgba(255,70,70,.95)";
    ctx.fillStyle = "rgba(255,255,255,.80)";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SCORE", px+34, py+64);

    ctx.fillStyle = scoreColor;
    ctx.font = "1100 96px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(payload.score), px+34, py+152);

    // Corrections
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "950 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", px+34, py+220);

    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${payload.windDir} → ${fmt2(payload.windClicks)} clicks`, px+34, py+290);
    ctx.fillText(`Elevation: ${payload.elevDir} → ${fmt2(payload.elevClicks)} clicks`, px+34, py+345);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "750 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`True MOA • ${scale.distanceYds} yards • ${scale.clickMoa} MOA/click`, px+34, py+ph-34);

    return c.toDataURL("image/png");

    function roundRect(c, x, y, w, h, r) {
      const rr = Math.min(r, w/2, h/2);
      c.beginPath();
      c.moveTo(x+rr, y);
      c.arcTo(x+w, y, x+w, y+h, rr);
      c.arcTo(x+w, y+h, x, y+h, rr);
      c.arcTo(x, y+h, x, y, rr);
      c.arcTo(x, y, x+w, y, rr);
      c.closePath();
    }
  }

  async function downloadSec() {
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);
    const dxIn = (bull.nx - poib.nx) * scale.paperWIn;
    const dyIn = (bull.ny - poib.ny) * scale.paperHIn;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const gate = truthGateDirections(dxIn, dyIn, windDir, elevDir);
    if (!gate.ok) return;

    const ipm = inchesPerMOA(scale.distanceYds);
    const windClicks = (Math.abs(dxIn) / ipm) / scale.clickMoa;
    const elevClicks = (Math.abs(dyIn) / ipm) / scale.clickMoa;

    const score = computeScore(dxIn, dyIn);

    if (vendorLogoImg && !vendorLogoImg.complete) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 250);
        vendorLogoImg.onload = () => { clearTimeout(t); resolve(); };
        vendorLogoImg.onerror = () => { clearTimeout(t); resolve(); };
      });
    }

    const dataUrl = await buildSecPng({ score, windDir, windClicks, elevDir, elevClicks });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "SEC.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- Wire up
  elFile.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) onFileSelected(file);
  });

  elUndo.addEventListener("click", () => undo());
  elClear.addEventListener("click", () => clearAll());
  elShow.addEventListener("click", () => computeAndRender());
  elDownloadSEC.addEventListener("click", () => downloadSec());

  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive:true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive:true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive:true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive:true });

  // Init
  loadVendor();
  resetResultsUI();
  setInstruction();
  setStatus();
  renderDots();
})();
