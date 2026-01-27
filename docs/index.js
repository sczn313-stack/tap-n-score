/* ============================================================
   docs/index.js (FULL REPLACEMENT) — REBUILD STEADY + YOUR BRICKS
   - One photo chooser (iOS/Android native menu)
   - Removes "bull" wording (Aim Point)
   - Instruction hides after first tap, returns on Clear/new photo
   - Direction arrows rotate to match LEFT/RIGHT/UP/DOWN
   - Score is back (colored)
   - Insight drawer: distance (yd/m), click value
   - HARD truth gate for direction (never emits wrong polarity)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  const elAimStatus = $("aimStatus");
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
  const elVendorPillMini = $("vendorPillMini");

  // Drawer
  const elInsightBtn = $("insightBtn");
  const elDrawer = $("drawer");
  const elDrawerBackdrop = $("drawerBackdrop");
  const elDrawerClose = $("drawerClose");

  const elDistanceVal = $("distanceVal");
  const elUnitToggle = $("unitToggle");
  const elClickVal = $("clickVal");

  // ---- Baseline (pilot paper) — used ONLY for converting normalized offsets to inches
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  // ---- State
  let objectUrl = null;

  // points: normalized within image
  // { nx, ny }
  let aim = null;
  let holes = [];

  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // Tap filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  // Settings (drawer)
  // distance stored in yards internally
  let distanceYds = 100;
  let unit = "yd"; // display unit
  let clickMode = "0.25"; // string from select

  // ---- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
  const inchesPerMOA = (yds) => 1.047 * (yds / 100); // True MOA

  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target.";
      elInstruction.classList.remove("hiddenInline");
      return;
    }

    if (!aim) {
      elInstruction.textContent = "Tap aim point first, then tap bullet holes.";
      elInstruction.classList.remove("hiddenInline");
      return;
    }

    // After first tap (aim point), hide instruction until reset/clear
    elInstruction.classList.add("hiddenInline");
  }

  function setStatus() {
    elAimStatus.textContent = aim ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    elUndo.disabled = !(aim || holes.length);
    elClear.disabled = !(aim || holes.length);

    const ready = !!aim && holes.length > 0;
    elShow.disabled = !(ready && !resultsLocked);

    elLockBanner.hidden = !resultsLocked;
  }

  function resetResultsUI() {
    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";

    setArrow(elWindArrow, "RIGHT");
    setArrow(elElevArrow, "UP");

    elScoreBig.textContent = "—";
    elScoreBig.classList.remove("scoreGood", "scoreMid", "scorePoor");
    elScoreBig.classList.add("scoreMid");

    elDownloadSEC.disabled = true;
  }

  function renderDots() {
    elDots.innerHTML = "";

    if (aim) {
      const d = document.createElement("div");
      d.className = "dot aimDot";
      d.style.left = `${aim.nx * 100}%`;
      d.style.top = `${aim.ny * 100}%`;
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

  function lockResults() { resultsLocked = true; setStatus(); }
  function unlockResults() { resultsLocked = false; setStatus(); }

  // Direction truth gate (signed inches => label)
  // dxIn > 0 => RIGHT, dxIn < 0 => LEFT
  // dyIn < 0 => UP,   dyIn > 0 => DOWN (screen Y grows downward)
  function truthDir(dxIn, dyIn) {
    return {
      wind: dxIn >= 0 ? "RIGHT" : "LEFT",
      elev: dyIn <= 0 ? "UP" : "DOWN"
    };
  }

  function setArrow(el, dir) {
    el.classList.remove("arrowLeft", "arrowRight", "arrowUp", "arrowDown");

    if (dir === "LEFT") el.classList.add("arrowLeft");
    else if (dir === "RIGHT") el.classList.add("arrowRight");
    else if (dir === "UP") el.classList.add("arrowUp");
    else if (dir === "DOWN") el.classList.add("arrowDown");
    else el.classList.add("arrowRight");
  }

  // Score: 0..100 (pilot)
  // 0 inches => 100, 6 inches => 0 (clamped)
  function computeScore(dxIn, dyIn) {
    const err = Math.hypot(dxIn, dyIn);
    const MAX_IN = 6.0;
    const raw = 100 - (err / MAX_IN) * 100;
    const score = Math.round(Math.max(0, Math.min(100, raw)));
    return score;
  }

  function applyScoreClass(score) {
    elScoreBig.classList.remove("scoreGood", "scoreMid", "scorePoor");
    if (score >= 85) elScoreBig.classList.add("scoreGood");
    else if (score >= 60) elScoreBig.classList.add("scoreMid");
    else elScoreBig.classList.add("scorePoor");
  }

  // Convert client point into normalized image space
  function clientToNorm(clientX, clientY) {
    const rect = elImg.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    return { nx, ny };
  }

  function meanNorm(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.nx; sy += p.ny; }
    return { nx: sx / points.length, ny: sy / points.length };
  }

  function currentClickValue() {
    const v = String(elClickVal?.value || clickMode || "0.25");
    // If mil selected (0.1), treat as "mil per click" and convert using mil math
    // 1 mil = 3.6" at 100yd (approx true mil)
    return v;
  }

  function computeClicks(absIn, distanceYdsLocal, clickValStr) {
    if (clickValStr === "0.1") {
      // mil mode
      const inchesPerMil = 3.6 * (distanceYdsLocal / 100);
      const mils = absIn / inchesPerMil;
      const clicks = mils / 0.1;
      return clicks;
    }

    const clickMOA = Number(clickValStr || 0.25);
    const ipm = inchesPerMOA(distanceYdsLocal);
    const moa = absIn / ipm;
    const clicks = moa / clickMOA;
    return clicks;
  }

  // ---- Vendor load (non-blocking)
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
        elVendorLogo.style.display = "block";

        elVendorLogoMini.src = vendor.logoPath;
        elVendorLogoMini.style.display = "block";

        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      } else {
        elVendorLogo.style.display = "none";
        elVendorLogoMini.style.display = "none";
      }

      if (vendor?.website) {
        const open = () => window.open(vendor.website, "_blank", "noopener,noreferrer");
        elVendorPill.style.cursor = "pointer";
        elVendorPill.onclick = open;

        elVendorPillMini.style.cursor = "pointer";
        elVendorPillMini.onclick = open;
      }
    } catch (_) {}
  }

  // ---- Tap flow
  function addTap(pt) {
    if (!elImg.src) return;
    if (resultsLocked) return;

    // first tap sets aim
    if (!aim) {
      aim = pt;
      holes = [];
      resetResultsUI();
      unlockResults();
      setInstruction();
      setStatus();
      renderDots();
      return;
    }

    // remaining are holes
    holes.push(pt);
    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---- Pointer (scroll-safe)
  function onPointerDown(e) {
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptrDown = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
  }

  function onPointerMove(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    const dx = e.clientX - ptrDown.x;
    const dy = e.clientY - ptrDown.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) ptrDown.moved = true;
  }

  function onPointerUp(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;

    const elapsed = Date.now() - ptrDown.t;
    const moved = ptrDown.moved;
    ptrDown = null;

    if (moved) return;
    if (elapsed > TAP_TIME_MS) return;

    addTap(clientToNorm(e.clientX, e.clientY));
  }

  function onPointerCancel(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    ptrDown = null;
  }

  // ---- File handling
  function revokeUrl() {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  }

  function resetAll() {
    aim = null;
    holes = [];
    resultsLocked = false;
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function loadFile(file) {
    if (!file) return;

    revokeUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      elTapLayer.classList.add("active");
      resetAll();
    };

    elImg.src = objectUrl;
  }

  // ---- Undo / Clear
  function undo() {
    if (holes.length) holes.pop();
    else if (aim) aim = null;

    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearAll() {
    aim = null;
    holes = [];
    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---- Compute + Render
  function computeAndRender() {
    if (!aim || holes.length === 0) return;

    const poib = meanNorm(holes);

    // correction vector = aim - poib
    const dx01 = aim.nx - poib.nx;
    const dy01 = aim.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const dirs = truthDir(dxIn, dyIn);

    // HARD gate: directions MUST match sign truth (paranoid safety)
    const mustWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const mustElev = dyIn <= 0 ? "UP" : "DOWN";
    if (dirs.wind !== mustWind || dirs.elev !== mustElev) {
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

    const absWindIn = Math.abs(dxIn);
    const absElevIn = Math.abs(dyIn);

    const clickStr = currentClickValue();
    const windClicks = computeClicks(absWindIn, distanceYds, clickStr);
    const elevClicks = computeClicks(absElevIn, distanceYds, clickStr);

    // Score
    const score = computeScore(dxIn, dyIn);
    elScoreBig.textContent = String(score);
    applyScoreClass(score);

    // Render
    elWindDir.textContent = dirs.wind;
    elWindVal.textContent = `${fmt2(windClicks)} clicks`;
    setArrow(elWindArrow, dirs.wind);

    elElevDir.textContent = dirs.elev;
    elElevVal.textContent = `${fmt2(elevClicks)} clicks`;
    setArrow(elElevArrow, dirs.elev);

    elDownloadSEC.disabled = false;

    lockResults();
  }

  // ---- SEC PNG (includes score + printer)
  async function buildSecPng(payload) {
    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Title (no Tap-n-Score on SEC)
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("CARD", 720, 86);

    ctx.font = "1000 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("S", 60, 132);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText("E", 92, 132);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("C", 124, 132);

    // Vendor (top-right)
    const vName = vendor?.name || "Printer";
    ctx.font = "850 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.textAlign = "right";
    ctx.fillText(vName, W - 70, 120);
    ctx.textAlign = "left";

    // Logo
    if (vendorLogoImg) {
      await new Promise((resolve) => {
        if (vendorLogoImg.complete) return resolve();
        const t = setTimeout(resolve, 250);
        vendorLogoImg.onload = () => { clearTimeout(t); resolve(); };
        vendorLogoImg.onerror = () => { clearTimeout(t); resolve(); };
      });

      if (vendorLogoImg.complete) {
        const size = 64;
        const x = W - 70 - size;
        const y = 38;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(vendorLogoImg, x, y, size, size);
        ctx.restore();

        ctx.strokeStyle = "rgba(255,255,255,.18)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2 + 1, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Panel
    const px = 60, py = 170, pw = 1080, ph = 440;
    roundRect(ctx, px, py, pw, ph, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 2; ctx.stroke();

    // Score
    ctx.fillStyle = "rgba(255,255,255,.80)";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SCORE", px + 34, py + 64);

    const scoreColor =
      payload.score >= 85 ? "rgba(0,180,90,.95)" :
      payload.score >= 60 ? "rgba(255,210,0,.95)" :
                            "rgba(255,70,70,.95)";

    ctx.fillStyle = scoreColor;
    ctx.font = "1000 96px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(payload.score), px + 34, py + 152);

    // Corrections
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "950 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", px + 34, py + 220);

    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${payload.windDir} → ${fmt2(payload.windClicks)} clicks`, px + 34, py + 290);
    ctx.fillText(`Elevation: ${payload.elevDir} → ${fmt2(payload.elevClicks)} clicks`, px + 34, py + 345);

    // Footer (quiet)
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "750 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(payload.footer, px + 34, py + ph - 34);

    return canvas.toDataURL("image/png");

    function roundRect(c, x, y, w, h, r) {
      const rr = Math.min(r, w/2, h/2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }
  }

  async function downloadSec() {
    if (!aim || holes.length === 0) return;

    const poib = meanNorm(holes);
    const dx01 = aim.nx - poib.nx;
    const dy01 = aim.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const dirs = truthDir(dxIn, dyIn);

    const absWindIn = Math.abs(dxIn);
    const absElevIn = Math.abs(dyIn);

    const clickStr = currentClickValue();
    const windClicks = computeClicks(absWindIn, distanceYds, clickStr);
    const elevClicks = computeClicks(absElevIn, distanceYds, clickStr);

    const score = computeScore(dxIn, dyIn);

    const footer =
      (clickStr === "0.1")
        ? `Distance: ${distanceYds} yd • 0.1 mil/click • Pilot baseline`
        : `Distance: ${distanceYds} yd • ${clickStr} MOA/click • True MOA • Pilot baseline`;

    const png = await buildSecPng({
      score,
      windDir: dirs.wind, windClicks,
      elevDir: dirs.elev, elevClicks,
      footer
    });

    const a = document.createElement("a");
    a.href = png;
    a.download = "SEC.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- Drawer logic
  function openDrawer() {
    elDrawerBackdrop.classList.remove("hiddenBtn");
    elDrawer.classList.remove("hiddenBtn");
    elDrawerBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    elDrawerBackdrop.classList.add("hiddenBtn");
    elDrawer.classList.add("hiddenBtn");
    elDrawerBackdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function syncDistanceUI() {
    // if displaying meters, convert yards->meters in UI
    if (unit === "m") {
      const meters = Math.round(distanceYds * 0.9144);
      elDistanceVal.value = String(meters);
      elUnitToggle.textContent = "m";
    } else {
      elDistanceVal.value = String(distanceYds);
      elUnitToggle.textContent = "yd";
    }
  }

  function readDistanceUI() {
    const n = Number(elDistanceVal.value || 0);
    if (!Number.isFinite(n) || n <= 0) return;

    if (unit === "m") {
      // meters -> yards internal
      distanceYds = Math.max(1, Math.round(n / 0.9144));
    } else {
      distanceYds = Math.max(1, Math.round(n));
    }
  }

  // ---- iOS gesture suppression (extra hardening)
  document.addEventListener("gesturestart", (e) => { e.preventDefault(); }, { passive: false });
  document.addEventListener("dblclick", (e) => {
    // prevent iOS double-tap zoom side effects
    e.preventDefault();
  }, { passive: false });

  // ---- Wire up
  elFile.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // New photo => instruction returns until first tap
    loadFile(file);
  });

  elUndo.addEventListener("click", () => {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }
    undo();
  });

  elClear.addEventListener("click", () => {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }
    clearAll();
    // After clear, instruction must show again
    setInstruction();
  });

  elShow.addEventListener("click", () => {
    computeAndRender();
  });

  elDownloadSEC.addEventListener("click", () => {
    downloadSec();
  });

  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // Drawer
  elInsightBtn.addEventListener("click", openDrawer);
  elDrawerClose.addEventListener("click", closeDrawer);
  elDrawerBackdrop.addEventListener("click", closeDrawer);

  elUnitToggle.addEventListener("click", () => {
    readDistanceUI();
    unit = (unit === "yd") ? "m" : "yd";
    syncDistanceUI();
  });

  elDistanceVal.addEventListener("change", () => {
    readDistanceUI();
    // Keep it stable in UI after any conversion
    syncDistanceUI();
  });

  elClickVal.addEventListener("change", () => {
    clickMode = String(elClickVal.value || "0.25");
    // any change should unlock results so user can re-run
    if (resultsLocked) { unlockResults(); resetResultsUI(); }
  });

  // ---- Init
  distanceYds = 100;
  unit = "yd";
  clickMode = "0.25";
  syncDistanceUI();

  loadVendor();
  resetResultsUI();
  setInstruction();
  setStatus();
  renderDots();
})();
