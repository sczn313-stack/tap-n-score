/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   BRICK 2 — Photo Picker Stability (Camera + Photos/Files)
   - Two inputs:
     - photoInputCamera (capture=environment)
     - photoInputLibrary (no capture)
   - Resets input value each click so re-selecting same photo works
   - Keeps Brick 1 tap accuracy + double-tap zoom kill
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Inputs (TWO pickers)
  const elCam = $("photoInputCamera");
  const elLib = $("photoInputLibrary");

  // --- Image + Layers
  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  // --- Status
  const elBullStatus = $("bullStatus");
  const elHoleCount = $("holeCount");
  const elInstruction = $("instructionLine");
  const elChangeBull = $("changeBullBtn");

  // --- Buttons
  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elLockBanner = $("lockBanner");
  const elDownloadSEC = $("downloadSecBtn");

  // --- Results
  const elWindDir = $("windageDir");
  const elWindVal = $("windageVal");
  const elElevDir = $("elevDir");
  const elElevVal = $("elevVal");

  // --- Vendor (both places)
  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");
  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // --- Pilot constants
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;
  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25;
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // --- State
  let objectUrl = null;
  let bull = null;   // {nx,ny,ix,iy}
  let holes = [];    // [{nx,ny,ix,iy}...]
  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // --- Tap gates (scroll wins)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 400;
  let ptr = null;

  // --- Double-tap zoom kill
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  const DOUBLE_TAP_MS = 320;
  const DOUBLE_TAP_DIST = 22;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function resetResultsUI(){
    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";
    elDownloadSEC.disabled = true;
  }

  function setInstruction(){
    if (!elImg.src){
      elInstruction.textContent = "Take a photo of your target.";
      return;
    }
    if (!bull){
      elInstruction.textContent = "Tap aim point first, then tap bullet holes.";
      return;
    }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus(){
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    if (elChangeBull) elChangeBull.hidden = true; // per your new UX: no bull button

    elUndo.disabled = !(bull || holes.length);
    elClear.disabled = !(bull || holes.length);

    const ready = !!bull && holes.length > 0;
    elShow.disabled = !(ready && !resultsLocked);

    elLockBanner.hidden = !resultsLocked;
  }

  function renderDots(){
    elDots.innerHTML = "";

    if (bull){
      const d = document.createElement("div");
      d.className = "dot bullDot";
      d.style.left = `${bull.nx * 100}%`;
      d.style.top  = `${bull.ny * 100}%`;
      elDots.appendChild(d);
    }

    for (const p of holes){
      const d = document.createElement("div");
      d.className = "dot holeDot";
      d.style.left = `${p.nx * 100}%`;
      d.style.top  = `${p.ny * 100}%`;
      elDots.appendChild(d);
    }
  }

  function lockResults(){ resultsLocked = true; setStatus(); }
  function unlockResults(){ resultsLocked = false; setStatus(); }

  function clientToPoint(clientX, clientY){
    const rect = elTapLayer.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    return { nx, ny, ix: nx * iw, iy: ny * ih };
  }

  function meanPointNorm(points){
    let sx = 0, sy = 0;
    for (const p of points){ sx += p.nx; sy += p.ny; }
    return { nx: sx / points.length, ny: sy / points.length };
  }

  function truthGate(dxIn, dyIn, windDir, elevDir){
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return { ok: (windDir === wantWind) && (elevDir === wantElev), wantWind, wantElev };
  }

  function addTapPoint(pt){
    if (!elImg.src) return;
    if (resultsLocked) return;

    if (!bull){
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

  function isDoubleTapLike(x, y){
    const now = Date.now();
    const dt = now - lastTapTime;
    const dist = Math.hypot(x - lastTapX, y - lastTapY);
    const dbl = (dt > 0 && dt < DOUBLE_TAP_MS && dist < DOUBLE_TAP_DIST);
    lastTapTime = now;
    lastTapX = x;
    lastTapY = y;
    return dbl;
  }

  function onPointerDown(e){
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), moved:false };
  }

  function onPointerMove(e){
    if (!ptr) return;
    if (e.pointerId !== ptr.id) return;

    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) ptr.moved = true;
  }

  function onPointerUp(e){
    if (!ptr) return;
    if (e.pointerId !== ptr.id) return;

    const elapsed = Date.now() - ptr.t;
    const moved = ptr.moved;
    const x = e.clientX;
    const y = e.clientY;
    ptr = null;

    // hard cancel double-tap zoom behavior
    if (isDoubleTapLike(x, y)){
      e.preventDefault?.();
      return;
    }

    if (moved) return;
    if (elapsed > TAP_TIME_MS) return;

    addTapPoint(clientToPoint(x, y));
  }

  function onPointerCancel(e){
    if (!ptr) return;
    if (e.pointerId !== ptr.id) return;
    ptr = null;
  }

  function revokeObjectUrl(){
    if (objectUrl){
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetAll(){
    bull = null;
    holes = [];
    resultsLocked = false;
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function onFileSelected(file){
    if (!file) return;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      elTapLayer.classList.add("active");
      resetAll();
    };

    elImg.src = objectUrl;
  }

  function undo(){
    if (holes.length) holes.pop();
    else if (bull) bull = null;

    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearAll(){
    bull = null;
    holes = [];
    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function computeAndRender(){
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const gate = truthGate(dxIn, dyIn, windDir, elevDir);
    if (!gate.ok){
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

  async function loadVendor(){
    try{
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;

      vendor = await res.json();

      const nm = vendor?.name || "—";
      elVendorName.textContent = nm;
      elVendorNameMini.textContent = nm;

      if (vendor?.logoPath){
        elVendorLogo.src = vendor.logoPath;
        elVendorLogo.alt = `${nm} logo`;
        elVendorLogo.style.display = "block";

        elVendorLogoMini.src = vendor.logoPath;
        elVendorLogoMini.alt = `${nm} logo`;
        elVendorLogoMini.style.display = "block";

        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      } else {
        elVendorLogo.style.display = "none";
        elVendorLogoMini.style.display = "none";
      }

      if (vendor?.website){
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

  // Minimal SEC download for now (View/Download button)
  async function downloadSec(){
    // (kept as-is for Brick 2 — we’re not changing SEC layout in this brick)
    // If you already have your SEC builder hooked, keep that file; otherwise this button can stay disabled.
    // For now: just trigger download of the rendered card later in Brick 3+.
    // You told me you’re good with View/Download, so we’re leaving it enabled only after results compute.
    alert("SEC download wiring is next brick (we locked Camera/Photos/Files first).");
  }

  // ---------- Wire: reset input value on click so same photo can be selected twice
  function prepInput(input){
    input.addEventListener("click", () => { input.value = ""; });
    input.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      onFileSelected(f);
    });
  }

  prepInput(elCam);
  prepInput(elLib);

  elUndo.addEventListener("click", () => undo());
  elClear.addEventListener("click", () => clearAll());
  elShow.addEventListener("click", () => computeAndRender());
  elDownloadSEC.addEventListener("click", () => downloadSec());

  // Pointer on tapLayer only
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: false });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  elTapLayer.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });

  // Init
  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
