/* ============================================================
   Tap-n-Score™ — index.js (FULL REPLACEMENT)
   - Bull is FIRST tap (no Set Bull button)
   - Scroll-safe tap filtering
   - Normalized dot placement (stable)
   - True MOA click math (pilot baseline 8.5x11)
   - Results lock + SEC PNG generation
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
  const elChangeBull = $("changeBullBtn"); // keep as hidden “Change bull” if you want

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
  // If finger moves more than this, we treat it as scroll, not tap.
  const TAP_MOVE_PX = 14;
  // If press lasts too long, treat as non-tap (prevents press/drag weirdness)
  const TAP_TIME_MS = 380;
  let ptrDown = null;

  // ---------- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target.";
      return;
    }
    if (!bull) {
      elInstruction.textContent = "Tap bull / aim point first, then tap bullet holes.";
      return;
    }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus() {
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    if (elChangeBull) elChangeBull.hidden = !bull;

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

    // Bull first (so it’s always present)
    if (bull) {
      const d = document.createElement("div");
      d.className = "dot bullDot";
      d.style.left = `${bull.nx * 100}%`;
      d.style.top = `${bull.ny * 100}%`;
      elDots.appendChild(d);
    }

    // Holes
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

  // Direction truth rules
  // dxIn > 0 => RIGHT, dxIn < 0 => LEFT
  // dyIn < 0 => UP,   dyIn > 0 => DOWN   (screen Y grows downward)
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

      const vName = vendor?.name || "Printer";
      elVendorName.textContent = vName;
      if (elVendorNameMini) elVendorNameMini.textContent = vName;

      if (vendor?.logoPath) {
        elVendorLogo.src = vendor.logoPath;
        elVendorLogo.alt = `${vName} logo`;
        elVendorLogo.style.display = "block";

        if (elVendorLogoMini) {
          elVendorLogoMini.src = vendor.logoPath;
          elVendorLogoMini.alt = `${vName} logo`;
          elVendorLogoMini.style.display = "block";
        }

        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      } else {
        elVendorLogo.style.display = "none";
        if (elVendorLogoMini) elVendorLogoMini.style.display = "none";
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
    } catch (_) {
      // silent
    }
  }

  // ---------- Tap logic: first tap sets bull, then holes
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
      elTapLayer.classList.add("active");
      resetAllState();
      setInstruction();
      setStatus();
    };

    elImg.src = objectUrl;
  }

  // ---------- Undo / Clear / Change bull
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

  // ---------- Compute + Render
  function computeAndRender() {
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);

    // correction = bull - POIB
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    // inches (pilot baseline)
    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    // directions derived ONLY from signed inches
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

  // ---------- SEC PNG builder
  async function buildSecPng(payload) {
    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Header (closer + clean)
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.fillText("SHOOTER", 60, 82);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(" EXPERIENCE ", 315, 82);
    ctx.fillStyle = "#1f6feb";
    ctx.fillText("CARD", 720, 82);

    ctx.font = "1000 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.fillText("S", 60, 122);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText("E", 92, 122);
    ctx.fillStyle = "#1f6feb";
    ctx.fillText("C", 124, 122);

    // Vendor (top-right)
    const vName = vendor?.name || "Printer";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.textAlign = "right";
    ctx.fillText(vName, W - 70, 118);
    ctx.textAlign = "left";

    if (vendorLogoImg && vendorLogoImg.complete) {
      const size = 70;
      const x = W - 70 - size;
      const y = 28;

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
    const px = 60, py = 155, pw = 1080, ph = 460;
    roundRect(ctx, px, py, pw, ph, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "950 36px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", px + 34, py + 80);

    ctx.font = "900 32px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Windage: ${payload.windDir} → ${fmt2(payload.windClicks)} clicks`, px + 34, py + 155);
    ctx.fillText(`Elevation: ${payload.elevDir} → ${fmt2(payload.elevClicks)} clicks`, px + 34, py + 225);

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

  // Download helper
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

    // Wait briefly for logo load
    if (vendorLogoImg && !vendorLogoImg.complete) {
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 250);
        vendorLogoImg.onload = () => { clearTimeout(t); resolve(); };
        vendorLogoImg.onerror = () => { clearTimeout(t); resolve(); };
      });
    }

    const dataUrl = await buildSecPng({ windDir, windClicks, elevDir, elevClicks });

    // NOTE: iOS Safari controls the “View / Download” prompt. We can’t remove “View”.
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
    computeAndRender();
  });

  elDownloadSEC.addEventListener("click", () => {
    downloadSec();
  });

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
