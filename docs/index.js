/* ============================================================
   Tap-n-Score™ — docs/index.js (FULL REPLACEMENT)
   Brick: Tap stability + anti iOS double-tap zoom
   - Uses tapLayer rect as ONLY coordinate reference (perfect alignment)
   - Prevents double-tap zoom on the tap surface
   - Keeps bull-first then holes
   - Keeps Truth Gate + True MOA math (baseline pilot)
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
  const elDownloadSEC = $("downloadSecBtn");

  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");
  const elVendorPillMini = $("vendorPillMini");
  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // -------- Pilot constants
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;
  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25;
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // -------- State
  let objectUrl = null;
  let bull = null;    // {nx, ny}
  let holes = [];     // [{nx, ny}...]
  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // Tap filters
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  // Double-tap zoom blocker
  let lastTouchEndTs = 0;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setInstruction() {
    if (!elImg.src) elInstruction.textContent = "Take a photo of your target.";
    else if (!bull) elInstruction.textContent = "Tap aim point first, then tap bullet holes.";
    else elInstruction.textContent = "Tap each confirmed bullet hole.";
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
    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";
    elDownloadSEC.disabled = true;
  }

  function renderDots() {
    elDots.innerHTML = "";
    if (bull) {
      const d = document.createElement("div");
      d.className = "dot bullDot";
      d.style.left = `${(bull.nx * 100).toFixed(4)}%`;
      d.style.top = `${(bull.ny * 100).toFixed(4)}%`;
      elDots.appendChild(d);
    }
    for (const p of holes) {
      const d = document.createElement("div");
      d.className = "dot holeDot";
      d.style.left = `${(p.nx * 100).toFixed(4)}%`;
      d.style.top = `${(p.ny * 100).toFixed(4)}%`;
      elDots.appendChild(d);
    }
  }

  function lockResults() { resultsLocked = true; setStatus(); }
  function unlockResults() { resultsLocked = false; setStatus(); }

  function meanPointNorm(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.nx; sy += p.ny; }
    return { nx: sx / points.length, ny: sy / points.length };
  }

  function truthGateDirections(dxIn, dyIn, windDir, elevDir) {
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return { ok: (windDir === wantWind) && (elevDir === wantElev) };
  }

  // ✅ KEY FIX: use tapLayer rect (not image rect) so dots land exactly
  function clientToLayerPoint(clientX, clientY) {
    const rect = elTapLayer.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    return { nx, ny };
  }

  function addTapPoint(pt) {
    if (!elImg.src) return;
    if (resultsLocked) return;

    if (!bull) {
      bull = pt;
      holes = [];
    } else {
      holes.push(pt);
    }

    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  function computeAndRender() {
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);

    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

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

    const ipm = inchesPerMOA(DISTANCE_YDS);
    const windClicks = (Math.abs(dxIn) / ipm) / CLICK_MOA;
    const elevClicks = (Math.abs(dyIn) / ipm) / CLICK_MOA;

    elWindDir.textContent = windDir;
    elWindVal.textContent = `${fmt2(windClicks)} clicks`;
    elElevDir.textContent = elevDir;
    elElevVal.textContent = `${fmt2(elevClicks)} clicks`;

    elDownloadSEC.disabled = false;
    lockResults();
  }

  function undo() {
    if (holes.length) holes.pop();
    else bull = null;

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

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function onFileSelected(file) {
    if (!file) return;
    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
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

      const wireLink = (pill) => {
        if (vendor?.website) {
          pill.style.cursor = "pointer";
          pill.title = vendor.website;
          pill.onclick = () => window.open(vendor.website, "_blank", "noopener,noreferrer");
        } else {
          pill.style.cursor = "default";
          pill.title = "";
          pill.onclick = null;
        }
      };
      wireLink(elVendorPill);
      wireLink(elVendorPillMini);
    } catch {}
  }

  // -------- Pointer handling (scroll-safe)
  function onPointerDown(e) {
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptrDown = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
  }

  function onPointerMove(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    if (Math.hypot(e.clientX - ptrDown.x, e.clientY - ptrDown.y) > TAP_MOVE_PX) ptrDown.moved = true;
  }

  function onPointerUp(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;

    const elapsed = Date.now() - ptrDown.t;
    const moved = ptrDown.moved;
    ptrDown = null;

    if (moved) return;
    if (elapsed > TAP_TIME_MS) return;

    addTapPoint(clientToLayerPoint(e.clientX, e.clientY));
  }

  function onPointerCancel(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    ptrDown = null;
  }

  // ✅ iOS double-tap zoom blocker on tap surface
  function blockDoubleTapZoom(e) {
    const now = Date.now();
    if (now - lastTouchEndTs <= 300) {
      e.preventDefault();
    }
    lastTouchEndTs = now;
  }

  // -------- Wire up
  elFile.addEventListener("change", (e) => onFileSelected(e.target.files && e.target.files[0]));

  elUndo.addEventListener("click", undo);
  elClear.addEventListener("click", clearAll);

  elShow.addEventListener("click", computeAndRender);

  // Tap layer events
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // Non-passive to allow preventDefault
  elTapLayer.addEventListener("touchend", blockDoubleTapZoom, { passive: false });

  // Init
  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
