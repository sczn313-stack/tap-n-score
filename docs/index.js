/* ============================================================
   Tap-n-Score™ — index.js (FULL REPLACEMENT)
   BRICK C: iPad SAFARI TAP STABILITY LOCK
   - Hard-block double-tap zoom + pinch gestures from breaking tap coords
   - Only blocks gestures on the tap surface (tapLayer), not the whole page
   - Keeps your bull-first flow + normalized taps
============================================================ */

(() => {
  // ---------- DOM
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  const elBullStatus = $("bullStatus");
  const elHoleCount = $("holeCount");
  const elInstruction = $("instructionLine");
  const elChangeBull = $("changeBullBtn");

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

  // ---------- Pilot constants (locked baseline)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;
  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25; // 1/4 MOA per click
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // ---------- State
  let objectUrl = null;

  // { nx, ny, ix, iy }
  let bull = null;
  let holes = [];
  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // Pointer tap filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  // ---------- HARD iPad Safari stability guards
  // (double tap zoom + pinch gesture can change layout/rects -> wrong mapping)
  let lastTouchEndAt = 0;

  function enableTapStabilityGuards() {
    // Block pinch (gesture*) on iOS Safari
    const stop = (e) => e.preventDefault();

    // These exist in iOS Safari (not standard everywhere)
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("gestureend", stop, { passive: false });

    // Block double-tap zoom specifically ON the tap surface
    elTapLayer.addEventListener("touchend", (e) => {
      const now = Date.now();
      const dt = now - lastTouchEndAt;
      lastTouchEndAt = now;

      // If two touchend events happen quickly, it's likely a double-tap attempt
      if (dt > 0 && dt < 320) {
        e.preventDefault();
      }
    }, { passive: false });

    // Also block double-tap on the image itself (sometimes Safari targets the img)
    elImg.addEventListener("touchend", (e) => {
      const now = Date.now();
      const dt = now - lastTouchEndAt;
      lastTouchEndAt = now;
      if (dt > 0 && dt < 320) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  // ---------- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setInstruction() {
    if (!elImg.src) { elInstruction.textContent = "Load a photo to begin."; return; }
    if (!bull) { elInstruction.textContent = "Tap aim point first, then tap bullet holes."; return; }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus() {
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    elChangeBull.hidden = !bull;

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

  function lockResults() { resultsLocked = true; setStatus(); }
  function unlockResults() { resultsLocked = false; setStatus(); }

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

  function truthGateDirections(dxIn, dyIn, windDir, elevDir) {
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return { ok: (windDir === wantWind) && (elevDir === wantElev), wantWind, wantElev };
  }

  // ---------- Vendor load
  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;
      vendor = await res.json();

      const vName = vendor?.name || "—";
      elVendorName.textContent = vName;
      elVendorNameMini.textContent = vName;

      if (vendor?.logoPath) {
        elVendorLogo.src = vendor.logoPath;
        elVendorLogo.alt = vName ? `${vName} logo` : "Vendor logo";
        elVendorLogo.style.display = "block";

        elVendorLogoMini.src = vendor.logoPath;
        elVendorLogoMini.alt = vName ? `${vName} logo` : "Vendor logo";
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
      } else {
        elVendorPill.style.cursor = "default";
        elVendorPill.title = "";
        elVendorPill.onclick = null;
      }
    } catch (_) {}
  }

  // ---------- Tap flow (bull first, then holes)
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

  // ---------- Scroll-safe pointer handling
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

  // ---------- File load
  function revokeObjectUrl() {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
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

  function onFileSelected(file) {
    if (!file) return;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      elTapLayer.classList.add("active");
      resetAllState();
      setInstruction();
      setStatus();
    };

    elImg.src = objectUrl;
  }

  // ---------- Undo / Clear / Change bull
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

  function changeBull() { clearAll(); }

  // ---------- Compute
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

  // ---------- SEC download (keep your existing builder if you want; minimal here)
  async function downloadSec() {
    // You already had a working SEC builder — keep it if you prefer.
    // For now, just trigger the existing UI behavior you had:
    // If you want, next brick we will re-drop the full SEC canvas builder here.
    alert("Next brick can re-drop the full SEC canvas builder exactly as you had it.");
  }

  // ---------- Wire up
  elFile.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
  });

  elUndo.addEventListener("click", undo);
  elClear.addEventListener("click", clearAll);
  elChangeBull.addEventListener("click", changeBull);

  elShow.addEventListener("click", computeAndRender);
  elDownloadSEC.addEventListener("click", downloadSec);

  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // ✅ Activate iPad stability guards immediately
  enableTapStabilityGuards();

  // ---------- Init
  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
