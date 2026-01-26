/* ============================================================
   Tap-n-Score™ — docs/index.js (FULL REPLACEMENT)
   Brick: Vendor calling card in BOTH places (INPUT + RESULTS)
   - Mirrors vendor name/logo into results pill
   - Optional click-through on BOTH pills
   - Keeps accurate tap dots (nx/ny), scroll-safe tap filter
   - True MOA click math (8.5x11 baseline)
   - HARD Truth Gate: never emit direction unless provably correct
   - Generates SEC PNG with vendor logo (if available)
============================================================ */

(() => {
  // ---------- DOM
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  const elBullStatus = $("bullStatus"); // hidden in HTML but kept for stability
  const elHoleCount = $("holeCount");
  const elInstruction = $("instructionLine");
  const elChangeBull = $("changeBullBtn"); // hidden button

  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elLockBanner = $("lockBanner");

  const elWindDir = $("windageDir");
  const elWindVal = $("windageVal");
  const elElevDir = $("elevDir");
  const elElevVal = $("elevVal");
  const elDownloadSEC = $("downloadSecBtn");

  // Vendor (INPUT pill)
  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");

  // Vendor (RESULTS pill)
  const elVendorPillMini = $("vendorPillMini");
  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // ---------- Pilot constants (locked baseline)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  // Pilot defaults (hidden for now)
  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25; // 1/4 MOA per click

  // True MOA inches per MOA at distance
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // ---------- State
  let objectUrl = null;

  // Points store: normalized within image + natural px
  // { nx, ny, ix, iy }
  let bull = null;
  let holes = [];
  let resultsLocked = false;

  // Vendor
  let vendor = null;         // vendor.json contents
  let vendorLogoImg = null;  // Image() for SEC canvas

  // Pointer tap filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  // ---------- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setInstruction() {
    // Shooter-facing: ONLY these two lines of truth.
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target.";
      return;
    }
    if (!bull) {
      elInstruction.textContent = "Tap aim point first, then tap bullet holes.";
      return;
    }
    elInstruction.textContent = "Tap bullet holes.";
  }

  function setStatus() {
    // Hidden/debug
    if (elBullStatus) elBullStatus.textContent = bull ? "set" : "not set";

    elHoleCount.textContent = String(holes.length);

    // change bull hidden anyway, but keep correct state
    if (elChangeBull) elChangeBull.hidden = !bull;

    elUndo.disabled = !(bull || holes.length);
    elClear.disabled = !(bull || holes.length);

    // Show Results disabled if not ready OR locked
    const ready = !!bull && holes.length > 0;
    elShow.disabled = !(ready && !resultsLocked);

    if (elLockBanner) elLockBanner.hidden = !resultsLocked;
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

  function lockResults() {
    resultsLocked = true;
    setStatus();
  }

  function unlockResults() {
    resultsLocked = false;
    setStatus();
  }

  // Convert client coords to normalized + natural px
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

  // ---------- HARD Truth Gate
  // dxIn > 0 => RIGHT, dxIn < 0 => LEFT
  // dyIn < 0 => UP,   dyIn > 0 => DOWN   (screen Y increases downward)
  function truthGateDirections(dxIn, dyIn, windDir, elevDir) {
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return { ok: windDir === wantWind && elevDir === wantElev, wantWind, wantElev };
  }

  // ---------- Vendor load + mirror into BOTH pills
  function applyVendorToUI(v) {
    const name = v?.name || "—";
    const logoPath = v?.logoPath || "";

    // INPUT pill
    if (elVendorName) elVendorName.textContent = name;
    if (elVendorLogo) {
      if (logoPath) {
        elVendorLogo.src = logoPath;
        elVendorLogo.alt = `${name} logo`;
        elVendorLogo.style.display = "block";
      } else {
        elVendorLogo.style.display = "none";
      }
    }

    // RESULTS pill
    if (elVendorNameMini) elVendorNameMini.textContent = name;
    if (elVendorLogoMini) {
      if (logoPath) {
        elVendorLogoMini.src = logoPath;
        elVendorLogoMini.alt = `${name} logo`;
        elVendorLogoMini.style.display = "block";
      } else {
        elVendorLogoMini.style.display = "none";
      }
    }

    // Click-through on BOTH (if website provided)
    const site = v?.website || "";
    const wireClick = (el) => {
      if (!el) return;
      if (site) {
        el.style.cursor = "pointer";
        el.title = site;
        el.onclick = () => window.open(site, "_blank", "noopener,noreferrer");
      } else {
        el.style.cursor = "default";
        el.title = "";
        el.onclick = null;
      }
    };

    wireClick(elVendorPill);
    wireClick(elVendorPillMini);

    // Preload for SEC canvas
    if (logoPath) {
      vendorLogoImg = new Image();
      vendorLogoImg.src = logoPath;
    } else {
      vendorLogoImg = null;
    }
  }

  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;
      vendor = await res.json();
      applyVendorToUI(vendor);
    } catch (_) {
      // silent
    }
  }

  // ---------- Tap logic (aim point first, then holes)
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

  function onFileSelected(file) {
    if (!file) return;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      // Tap layer is always present; make sure it’s active once image is loaded
      elTapLayer.classList.add("active");
      resetAllState();
    };

    elImg.src = objectUrl;
  }

  // ---------- Undo / Clear / Change aim point
  function undo() {
    if (holes.length) {
      holes.pop();
      unlockResults();
      resetResultsUI();
    } else if (bull) {
      bull = null;
      unlockResults();
      resetResultsUI();
    }
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

  function changeBull() {
    bull = null;
    holes = [];
    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---------- Compute + Render (True MOA clicks)
  function computeAndRender() {
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);

    // correction vector = bull - poib (normalized)
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    // Convert to inches using pilot baseline paper dimensions
    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    // Direction labels derived ONLY from signed inches
    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN"; // screen-space truth

    // Truth gate (paranoid by design)
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

    const windAbsIn = Math.abs(dxIn);
    const elevAbsIn = Math.abs(dyIn);

    const ipm = inchesPerMOA(DISTANCE_YDS);
    const windMOA = windAbsIn / ipm;
    const elevMOA = elevAbsIn / ipm;

    const windClicks = windMOA / CLICK_MOA;
    const elevClicks = elevMOA / CLICK_MOA;

    elWindDir.textContent = windDir;
    elWindVal.textContent = `${fmt2(windClicks)} clicks`;
    elElevDir.textContent = elevDir;
    elElevVal.textContent = `${fmt2(elevClicks)} clicks`;

    elDownloadSEC.disabled = false;

    // LOCK after first successful show
    lockResults();
  }

  // ---------- SEC PNG builder (Shooter Experience Card)
  async function buildSecPng(payload) {
    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Header: Shooter Experience Card (red/white/blue)
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb";
    ctx.fillText("CARD", 720, 86);

    // "SEC" (R/W/B)
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

    // Vendor logo (circle) top-right
    if (vendorLogoImg && vendorLogoImg.complete) {
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

    // Main panel
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

    // Footer (quiet)
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "750 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`True MOA • ${DISTANCE_YDS} yards • ${CLICK_MOA} MOA/click`, px + 34, py + ph - 34);

    return canvas.toDataURL("image/png");

    function roundRect(c, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }
  }

  // ---------- Download SEC (View / Download)
  async function downloadSec() {
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

    // Wait briefly for logo load (non-blocking hard stop)
    if (vendorLogoImg && !vendorLogoImg.complete) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 250);
        vendorLogoImg.onload = () => { clearTimeout(t); resolve(); };
        vendorLogoImg.onerror = () => { clearTimeout(t); resolve(); };
      });
    }

    const dataUrl = await buildSecPng({ windDir, windClicks, elevDir, elevClicks });

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
    onFileSelected(file);
  });

  elUndo.addEventListener("click", () => {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }
    undo();
  });

  elClear.addEventListener("click", () => {
    if (resultsLocked) { unlockResults(); resetResultsUI(); }
    clearAll();
  });

  if (elChangeBull) {
    elChangeBull.addEventListener("click", () => {
      if (resultsLocked) { unlockResults(); resetResultsUI(); }
      changeBull();
    });
  }

  elShow.addEventListener("click", () => {
    // LOCK happens only after a successful compute
    computeAndRender();
  });

  elDownloadSEC.addEventListener("click", () => {
    downloadSec();
  });

  // Pointer events on overlay
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // ---------- Init
  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
