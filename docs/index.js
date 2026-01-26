/* ============================================================
   Tap-n-Score™ — docs/index.js (FULL REPLACEMENT)
   BRICK 7:
   - iOS/iPadOS reliable file pick:
       • Separate inputs: Camera + Library
       • Store File immediately (iOS "selection doesn’t stick" fix)
       • Reset input.value after each pick so the same photo can be re-picked
   - Bull first, then holes (no "Bull set" UI wording)
   - Accurate taps (overlay shares image rect)
   - HARD Truth Gate: never emit direction unless sign-truth passes
   - Vendor pill + SEC vendor pill wired from vendor.json
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // -------- DOM
  const elFileCam = $("photoInputCamera");
  const elFileLib = $("photoInputLibrary");

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
  const elDownloadSEC = $("downloadSecBtn");

  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");

  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // -------- Pilot constants (locked baseline)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25; // 1/4 MOA per click
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // -------- State
  let objectUrl = null;
  let selectedFile = null;

  // points: { nx, ny, ix, iy }
  let bull = null;
  let holes = [];

  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // Tap filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  // -------- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetResultsUI() {
    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";
    elDownloadSEC.disabled = true;
  }

  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target.";
      return;
    }
    if (!bull) {
      elInstruction.textContent = "Tap aim point first, then tap bullet holes.";
      return;
    }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus() {
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    const canEdit = !!bull || holes.length > 0;
    elUndo.disabled = !canEdit;
    elClear.disabled = !canEdit;

    const ready = !!bull && holes.length > 0;
    elShow.disabled = !(ready && !resultsLocked);

    elLockBanner.hidden = !resultsLocked;
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

  // Convert client coords → normalized + natural px
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

  // HARD truth gate
  // dxIn > 0 => RIGHT, dxIn < 0 => LEFT
  // dyIn < 0 => UP,   dyIn > 0 => DOWN (screen-space Y grows downward)
  function truthGate(dxIn, dyIn, windDir, elevDir) {
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return {
      ok: (windDir === wantWind) && (elevDir === wantElev),
      wantWind,
      wantElev
    };
  }

  // -------- Vendor load
  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;

      vendor = await res.json();

      const name = vendor?.name || "—";
      elVendorName.textContent = name;
      elVendorNameMini.textContent = name;

      if (vendor?.logoPath) {
        // input pill
        elVendorLogo.src = vendor.logoPath;
        elVendorLogo.style.display = "block";

        // mini pill
        elVendorLogoMini.src = vendor.logoPath;
        elVendorLogoMini.style.display = "block";

        // preload for SEC canvas
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
      } else {
        elVendorPill.style.cursor = "default";
        elVendorPill.title = "";
        elVendorPill.onclick = null;
      }
    } catch {
      // silent fail
    }
  }

  // -------- Taps (bull first, then holes)
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

  // -------- Scroll-safe pointer pipeline (on tapLayer only)
  function onPointerDown(e) {
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptrDown = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      moved: false,
    };
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

    addTapPoint(clientToImagePoint(e.clientX, e.clientY));
  }

  function onPointerCancel(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    ptrDown = null;
  }

  // -------- File load (iOS-safe)
  function onFileSelected(file) {
    if (!file) return;

    // iOS fix: store immediately
    selectedFile = file;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      // activate tap layer only after image is fully in DOM + laid out
      elTapLayer.classList.add("active");

      // reset session
      bull = null;
      holes = [];
      resultsLocked = false;
      resetResultsUI();
      setInstruction();
      setStatus();
      renderDots();
    };

    elImg.src = objectUrl;
  }

  // allow re-picking the same file (important on iOS)
  function resetInput(el) {
    try { el.value = ""; } catch {}
  }

  elFileCam.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    onFileSelected(f);
    resetInput(elFileCam);
  });

  elFileLib.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    onFileSelected(f);
    resetInput(elFileLib);
  });

  // -------- Undo / Clear
  function undo() {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }

    if (holes.length) {
      holes.pop();
    } else if (bull) {
      bull = null;
    }
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearAll() {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }

    bull = null;
    holes = [];
    setInstruction();
    setStatus();
    renderDots();
    resetResultsUI();

    // keep image loaded (fast retry) — you can refresh if you want to clear image too
  }

  elUndo.addEventListener("click", undo);
  elClear.addEventListener("click", clearAll);

  // -------- Compute + Render (True MOA, clicks only)
  function computeAndRender() {
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);

    // correction vector = bull - poib
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    // Truth gate (never emit direction if it fails)
    const gate = truthGate(dxIn, dyIn, windDir, elevDir);
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

    const ipm = inchesPerMOA(DISTANCE_YDS);

    const windClicks = (Math.abs(dxIn) / ipm) / CLICK_MOA;
    const elevClicks = (Math.abs(dyIn) / ipm) / CLICK_MOA;

    elWindDir.textContent = windDir;
    elWindVal.textContent = `${fmt2(windClicks)} clicks`;

    elElevDir.textContent = elevDir;
    elElevVal.textContent = `${fmt2(elevClicks)} clicks`;

    elDownloadSEC.disabled = false;

    // Lock after first successful results
    lockResults();
  }

  elShow.addEventListener("click", () => {
    if (resultsLocked) return;
    computeAndRender();
  });

  // -------- SEC PNG builder (Shooter Experience Card)
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  async function ensureLogoLoaded() {
    if (!vendorLogoImg) return;
    if (vendorLogoImg.complete) return;
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 250);
      vendorLogoImg.onload = () => { clearTimeout(t); resolve(); };
      vendorLogoImg.onerror = () => { clearTimeout(t); resolve(); };
    });
  }

  async function buildSecPng(payload) {
    const W = 1200, H = 675;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Header: Shooter Experience Card (R/W/B)
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("CARD", 720, 86);

    // SEC letters (R/W/B)
    ctx.font = "1000 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("S", 60, 132);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText("E", 92, 132);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("C", 124, 132);

    // Vendor top-right
    const vName = vendor?.name || "Printer";
    ctx.textAlign = "right";
    ctx.font = "850 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillText(vName, W - 70, 120);
    ctx.textAlign = "left";

    // Vendor logo
    await ensureLogoLoaded();
    if (vendorLogoImg && vendorLogoImg.complete && vendorLogoImg.naturalWidth > 0) {
      const size = 64;
      const x = W - 70 - size;
      const y = 38;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(vendorLogoImg, x, y, size, size);
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 + 1, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Panel
    const px = 60, py = 170, pw = 1080, ph = 440;
    roundRect(ctx, px, py, pw, ph, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "950 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", px + 34, py + 72);

    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${payload.windDir} → ${fmt2(payload.windClicks)} clicks`, px + 34, py + 140);
    ctx.fillText(`Elevation: ${payload.elevDir} → ${fmt2(payload.elevClicks)} clicks`, px + 34, py + 200);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "750 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`True MOA • ${DISTANCE_YDS} yards • ${CLICK_MOA} MOA/click`, px + 34, py + ph - 34);

    return c.toDataURL("image/png");
  }

  async function downloadSec() {
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const gate = truthGate(dxIn, dyIn, windDir, elevDir);
    if (!gate.ok) return;

    const ipm = inchesPerMOA(DISTANCE_YDS);
    const windClicks = (Math.abs(dxIn) / ipm) / CLICK_MOA;
    const elevClicks = (Math.abs(dyIn) / ipm) / CLICK_MOA;

    const dataUrl = await buildSecPng({ windDir, windClicks, elevDir, elevClicks });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "SEC.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  elDownloadSEC.addEventListener("click", downloadSec);

  // -------- Pointer events
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // -------- Init
  loadVendor();
  resetResultsUI();
  setInstruction();
  setStatus();
  renderDots();
})();
