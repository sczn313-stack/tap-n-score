/* ============================================================
   Tap-n-Score™ — docs/index.js (FULL REPLACEMENT)
   Brick D:
   - Prevent double-tap zoom / gesture zoom from shifting geometry
   - Tap points map to image reliably (nx/ny anchored to img rect)
   - Bull first, then holes (no “Bull set” UI)
   - Lock results after successful show
   - Vendor pill wired from vendor.json
   - True MOA, 100y, 0.25 MOA/click baseline
   - HARD Truth Gate (direction can’t lie)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // DOM
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

  // Vendor UI
  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");

  const elVendorPillMini = $("vendorPillMini");
  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // Pilot constants (locked baseline)
  const PAPER_W_IN = 8.5;
  const PAPER_H_IN = 11.0;

  const DISTANCE_YDS = 100;
  const CLICK_MOA = 0.25; // 1/4 MOA per click
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // State
  let objectUrl = null;
  let bull = null;     // {nx, ny}
  let holes = [];      // [{nx, ny}...]
  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // Tap filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;
  let ptrDown = null;

  // Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target to begin.";
      return;
    }
    if (!bull) {
      elInstruction.textContent = "Tap bull (aim point) first, then tap bullet holes.";
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

    elDownloadSEC.disabled = true;
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

  function meanPointNorm(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.nx; sy += p.ny; }
    return { nx: sx / points.length, ny: sy / points.length };
  }

  // Direction truth gate (paranoid)
  // dxIn > 0 => RIGHT, dxIn < 0 => LEFT
  // dyIn < 0 => UP,   dyIn > 0 => DOWN (screen Y increases downward)
  function truthGate(dxIn, dyIn, windDir, elevDir) {
    const wantWind = dxIn >= 0 ? "RIGHT" : "LEFT";
    const wantElev = dyIn <= 0 ? "UP" : "DOWN";
    return { ok: (windDir === wantWind) && (elevDir === wantElev) };
  }

  function clientToNorm(clientX, clientY) {
    const rect = elImg.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    return { nx, ny };
  }

  // Brick D: stop Safari zoom gestures from firing during tap workflow
  function installNoZoomGuards() {
    // Prevent “gesture” zoom (pinch) in Safari
    document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive:false });
    document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive:false });
    document.addEventListener("gestureend", (e) => e.preventDefault(), { passive:false });

    // Prevent double click zoom
    elTapLayer.addEventListener("dblclick", (e) => e.preventDefault(), { passive:false });

    // Extra guard: iOS sometimes treats quick double-tap as zoom
    let lastTouchEnd = 0;
    elTapLayer.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive:false });
  }

  // Vendor load
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
        elVendorLogo.alt = `${name} logo`;
        elVendorLogo.style.display = "block";

        elVendorLogoMini.src = vendor.logoPath;
        elVendorLogoMini.alt = `${name} logo`;
        elVendorLogoMini.style.display = "block";

        vendorLogoImg = new Image();
        vendorLogoImg.src = vendor.logoPath;
      }

      const site = vendor?.website || "";
      const wire = (pill) => {
        if (!pill) return;
        if (site) {
          pill.style.cursor = "pointer";
          pill.title = site;
          pill.onclick = () => window.open(site, "_blank", "noopener,noreferrer");
        } else {
          pill.style.cursor = "default";
          pill.title = "";
          pill.onclick = null;
        }
      };

      wire(elVendorPill);
      wire(elVendorPillMini);
    } catch (_) {
      // silent
    }
  }

  // Tap pipeline
  function addTap(pt) {
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

  function onPointerDown(e) {
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    ptrDown = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), moved:false };
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

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetAll() {
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
      resetAll();
      setInstruction();
      setStatus();
    };

    elImg.src = objectUrl;
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

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    if (!truthGate(dxIn, dyIn, windDir, elevDir).ok) {
      resetResultsUI();
      elWindDir.textContent = "DIRECTION ERROR";
      elWindVal.textContent = "LOCKED";
      elElevDir.textContent = "DIRECTION ERROR";
      elElevVal.textContent = "LOCKED";
      unlockResults();
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

  async function buildSecPng(payload) {
    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // "Shooter Experience Card" (no Tap-n-Score on SEC)
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("CARD", 720, 86);

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

    // Vendor logo
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
    const px = 60, py = 170, pw = 1080, ph = 440;
    roundRect(ctx, px, py, pw, ph, 22);
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 2; ctx.stroke();

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
    if (!bull || holes.length === 0) return;

    const poib = meanPointNorm(holes);
    const dx01 = bull.nx - poib.nx;
    const dy01 = bull.ny - poib.ny;

    const dxIn = dx01 * PAPER_W_IN;
    const dyIn = dy01 * PAPER_H_IN;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    if (!truthGate(dxIn, dyIn, windDir, elevDir).ok) return;

    const ipm = inchesPerMOA(DISTANCE_YDS);
    const windClicks = (Math.abs(dxIn) / ipm) / CLICK_MOA;
    const elevClicks = (Math.abs(dyIn) / ipm) / CLICK_MOA;

    // wait briefly for logo
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

  // Wire up
  elFile.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
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
  installNoZoomGuards();
  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
