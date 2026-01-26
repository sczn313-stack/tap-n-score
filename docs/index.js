/* ============================================================
   Tap-n-Score™ — docs/index.js (FULL REPLACEMENT)
   BRICK 5:
   - iOS picker fix: TWO inputs (Camera + Library) wired correctly
   - Stable tap pipeline (scroll-safe) + no “tap-to-zoom” behavior
   - Bull first, then holes
   - True MOA click math (pilot 8.5x11 baseline)
   - Hard Truth Gate: app will not emit direction if sign-check fails
   - Vendor logo/name on INPUT + on SEC header area + in SEC PNG
   - Results lock after first successful Show Results
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // -------- DOM (must match docs/index.html)
  const elFileCamera  = $("photoInputCamera");
  const elFileLibrary = $("photoInputLibrary");

  const elImg      = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots     = $("dotsLayer");

  const elBullStatus  = $("bullStatus");
  const elHoleCount   = $("holeCount");
  const elInstruction = $("instructionLine");

  const elUndo  = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow  = $("showResultsBtn");
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

  // kept in DOM (hidden by CSS) so old logic doesn’t break
  const elChangeBull = $("changeBullBtn");

  // -------- Pilot constants (locked baseline for now)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  const DISTANCE_YDS = 100;
  const CLICK_MOA    = 0.25;

  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // -------- State
  let objectUrl = null;

  // normalized to displayed image + natural pixels
  // { nx, ny, ix, iy }
  let bull = null;
  let holes = [];

  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // -------- Tap filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  // extra: block rapid double-tap from acting like zoom on iOS
  let lastTapMs = 0;

  // -------- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function revokeObjectUrl(){
    if (objectUrl){
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

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

    const hasAny = !!bull || holes.length > 0;
    elUndo.disabled  = !hasAny;
    elClear.disabled = !hasAny;

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

  function resetAllState(){
    bull = null;
    holes = [];
    resultsLocked = false;
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();

    // allow tapping once an image exists
    elTapLayer.classList.toggle("active", !!elImg.src);
  }

  function lockResults(){
    resultsLocked = true;
    setStatus();
  }

  function unlockResults(){
    resultsLocked = false;
    setStatus();
  }

  // Convert a client coordinate to normalized + natural px
  function clientToImagePoint(clientX, clientY){
    const rect = elImg.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top)  / rect.height);

    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    const ix = nx * iw;
    const iy = ny * ih;

    return { nx, ny, ix, iy };
  }

  function meanPointNorm(points){
    let sx = 0, sy = 0;
    for (const p of points){ sx += p.nx; sy += p.ny; }
    return { nx: sx / points.length, ny: sy / points.length };
  }

  // HARD Truth Gate (direction must match signed deltas)
  function truthGateDirections(dxIn, dyIn, windDir, elevDir){
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN"; // screen Y grows downward
    const ok = (windDir === wantWind) && (elevDir === wantElev);
    return { ok, wantWind, wantElev };
  }

  // -------- Vendor load (docs/vendor.json)
  async function loadVendor(){
    try{
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;
      vendor = await res.json();

      const name = vendor?.name || "—";
      elVendorName.textContent = name;
      if (elVendorNameMini) elVendorNameMini.textContent = name;

      if (vendor?.logoPath){
        // INPUT logo
        elVendorLogo.src = vendor.logoPath;
        elVendorLogo.alt = name ? `${name} logo` : "Printer logo";
        elVendorLogo.style.display = "block";

        // RESULTS mini logo
        if (elVendorLogoMini){
          elVendorLogoMini.src = vendor.logoPath;
          elVendorLogoMini.alt = name ? `${name} logo` : "Printer logo";
          elVendorLogoMini.style.display = "block";
        }

        // preload for SEC PNG
        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      } else {
        elVendorLogo.style.display = "none";
        if (elVendorLogoMini) elVendorLogoMini.style.display = "none";
      }

      // click-through (optional)
      if (vendor?.website){
        elVendorPill.style.cursor = "pointer";
        elVendorPill.title = vendor.website;
        elVendorPill.onclick = () => window.open(vendor.website, "_blank", "noopener,noreferrer");
      } else {
        elVendorPill.style.cursor = "default";
        elVendorPill.title = "";
        elVendorPill.onclick = null;
      }
    } catch (_) {
      // silent fail
    }
  }

  // -------- Add tap point (bull first, then holes)
  function addTapPoint(pt){
    if (!elImg.src) return;
    if (resultsLocked) return;

    // bull first
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

    // holes
    holes.push(pt);
    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  // -------- Pointer handlers (scroll-safe)
  function onPointerDown(e){
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    // stop any iOS weird selection/zoom triggers
    // (we do NOT block scroll because touch-action is pan-y)
    ptrDown = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      moved: false,
    };
  }

  function onPointerMove(e){
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    const dx = e.clientX - ptrDown.x;
    const dy = e.clientY - ptrDown.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_PX) ptrDown.moved = true;
  }

  function onPointerUp(e){
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;

    const elapsed = Date.now() - ptrDown.t;
    const moved = ptrDown.moved;
    ptrDown = null;

    if (moved) return;
    if (elapsed > TAP_TIME_MS) return;

    // extra double-tap guard (prevents iOS zoom feel)
    const now = Date.now();
    if (now - lastTapMs < 250) return;
    lastTapMs = now;

    addTapPoint(clientToImagePoint(e.clientX, e.clientY));
  }

  function onPointerCancel(e){
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    ptrDown = null;
  }

  // -------- File selection
  function onFileSelected(file){
    if (!file) return;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      resetAllState();
      setInstruction();
      setStatus();
    };

    elImg.src = objectUrl;
  }

  // -------- Undo / Clear
  function undo(){
    if (holes.length){
      holes.pop();
    } else if (bull){
      bull = null;
    }
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

  // -------- Compute + Render (True MOA clicks)
  function computeAndRender(){
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);

    // correction vector = bull - poib
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    // inches using pilot paper baseline
    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    // direction from signed inches ONLY
    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const gate = truthGateDirections(dxIn, dyIn, windDir, elevDir);
    if (!gate.ok){
      // refuse to emit direction
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

    // lock after first successful run
    lockResults();
  }

  // -------- SEC PNG builder
  async function buildSecPng(payload){
    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Title (no Tap-n-Score on SEC)
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb";
    ctx.fillText("CARD", 720, 86);

    // SEC letters
    ctx.font = "1000 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("S", 60, 132);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText("E", 92, 132);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("C", 124, 132);

    // Vendor name top-right
    const vName = vendor?.name || "Printer";
    ctx.font = "850 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.textAlign = "right";
    ctx.fillText(vName, W - 70, 120);
    ctx.textAlign = "left";

    // Vendor logo top-right (circle)
    if (vendorLogoImg){
      if (!vendorLogoImg.complete){
        await new Promise((resolve) => {
          const t = setTimeout(resolve, 250);
          vendorLogoImg.onload = () => { clearTimeout(t); resolve(); };
          vendorLogoImg.onerror = () => { clearTimeout(t); resolve(); };
        });
      }
      if (vendorLogoImg.complete){
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
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Corrections
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "950 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", px + 34, py + 72);

    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${payload.windDir} → ${fmt2(payload.windClicks)} clicks`, px + 34, py + 140);
    ctx.fillText(`Elevation: ${payload.elevDir} → ${fmt2(payload.elevClicks)} clicks`, px + 34, py + 200);

    // Footer
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "750 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`True MOA • ${DISTANCE_YDS} yards • ${CLICK_MOA} MOA/click`, px + 34, py + ph - 34);

    return canvas.toDataURL("image/png");

    function roundRect(c, x, y, w, h, r){
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

  async function downloadSec(){
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const gate = truthGateDirections(dxIn, dyIn, windDir, elevDir);
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

  // -------- Wire up inputs (BRICK 5 핵심)
  elFileCamera.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
    // allow re-select same file
    e.target.value = "";
  });

  elFileLibrary.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
    e.target.value = "";
  });

  // Controls
  elUndo.addEventListener("click", () => {
    if (resultsLocked){ unlockResults(); resetResultsUI(); }
    undo();
  });

  elClear.addEventListener("click", () => {
    if (resultsLocked){ unlockResults(); resetResultsUI(); }
    clearAll();
  });

  // hidden button, but safe if clicked by accident
  elChangeBull?.addEventListener("click", () => {
    if (resultsLocked){ unlockResults(); resetResultsUI(); }
    bull = null; holes = [];
    setInstruction(); setStatus(); renderDots();
  });

  elShow.addEventListener("click", () => {
    computeAndRender();
  });

  elDownloadSEC.addEventListener("click", () => {
    downloadSec();
  });

  // Tap layer pointer events
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // -------- Init
  loadVendor();
  resetAllState();
})();
