/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   BRICK 1 — Tap Accuracy & Stability
   - Hard prevents double-tap zoom behavior
   - Tap vs Scroll separation (movement + time gates)
   - Single coordinate space (tapLayer rect + natural px mapping)
   - Dots rendered ONLY from normalized coords (%), so resize-safe
   - Does NOT change your direction/click math beyond using stable coords
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- DOM (must exist in your HTML)
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

  // --- Pilot constants
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;
  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25;

  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // --- State
  let objectUrl = null;

  // Stored points are normalized (0..1) + natural px
  // { nx, ny, ix, iy }
  let bull = null;
  let holes = [];

  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // --- TAP SAFETY GATES (scroll wins)
  const TAP_MOVE_PX = 10;    // movement threshold
  const TAP_TIME_MS = 400;   // time threshold

  let ptr = null;

  // --- DOUBLE-TAP ZOOM KILL (hard)
  // Many browsers double-tap zoom on fast taps. We block it deterministically.
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

    if (elChangeBull) elChangeBull.hidden = !bull;

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
      d.style.left = `${(bull.nx * 100)}%`;
      d.style.top  = `${(bull.ny * 100)}%`;
      elDots.appendChild(d);
    }

    for (const p of holes){
      const d = document.createElement("div");
      d.className = "dot holeDot";
      d.style.left = `${(p.nx * 100)}%`;
      d.style.top  = `${(p.ny * 100)}%`;
      elDots.appendChild(d);
    }
  }

  function lockResults(){
    resultsLocked = true;
    setStatus();
  }
  function unlockResults(){
    resultsLocked = false;
    setStatus();
  }

  // --------- Coordinate mapping (ONE authority)
  // We map against tapLayer rect because it exactly overlays the image frame.
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

  // HARD Truth Gate: directions must match signed inches
  function truthGate(dxIn, dyIn, windDir, elevDir){
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN"; // screen-y down is positive
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

  // --------- Double-tap zoom killer
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

  // --------- Pointer handlers (scroll-safe)
  function onPointerDown(e){
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptr = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      moved: false,
    };
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

    // If it looks like a double-tap, hard-cancel (prevents zoom behavior)
    if (isDoubleTapLike(x, y)){
      // Prevent any follow-up click/gesture behavior
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

  // Extra insurance: block dblclick events that some browsers emit
  function onDblClick(e){
    e.preventDefault();
  }

  // --------- File load
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

  // --------- Undo / Clear / Change bull
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

  function changeBull(){
    bull = null;
    holes = [];
    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  // --------- Compute + Render (uses stable normalized coords)
  function computeAndRender(){
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);

    // correction vector = bull - poib
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    // inches (pilot baseline)
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

  // --------- Vendor load (non-blocking)
  async function loadVendor(){
    try{
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;

      vendor = await res.json();

      if (vendor?.name) elVendorName.textContent = vendor.name;

      if (vendor?.logoPath){
        elVendorLogo.src = vendor.logoPath;
        elVendorLogo.alt = vendor.name ? `${vendor.name} logo` : "Printer logo";
        elVendorLogo.style.display = "block";

        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      } else {
        elVendorLogo.style.display = "none";
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
    } catch(_){
      // silent
    }
  }

  // --------- SEC download (unchanged from your logic, stable coords)
  async function buildSecPng(payload){
    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0,0,W,H);

    // Header: SHOOTER EXPERIENCE CARD (no Tap-n-Score on SEC)
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("CARD", 720, 86);

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

    // Vendor logo if available
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

    return canvas.toDataURL("image/png");

    function roundRect(c,x,y,w,h,r){
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

  // --------- Wire up
  elFile.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
  });

  elUndo.addEventListener("click", () => undo());
  elClear.addEventListener("click", () => clearAll());
  elChangeBull?.addEventListener("click", () => changeBull());

  elShow.addEventListener("click", () => computeAndRender());
  elDownloadSEC.addEventListener("click", () => downloadSec());

  // Pointer events ONLY on tapLayer
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: false });   // allow preventDefault in dbl-like cases
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // Extra dblclick block
  elTapLayer.addEventListener("dblclick", onDblClick, { passive: false });

  // Init
  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
