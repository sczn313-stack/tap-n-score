/* ============================================================
   docs/index.js (FULL REPLACEMENT) — BRICK: Grid-anchored scale
   Fixes:
   - Eliminates iPhone vs iPad output drift by calibrating px-per-inch
     from the *actual target image* (2 taps on 1-inch grid spacing).
   - Adds small settings "gear" (distance, yards/meters, MOA/click).
   - Makes SEC arrows point the true direction (← → ↑ ↓).
   - Restores a simple score that improves with tighter group (color shifts).
   - Renames "Bull" to "Aim" without touching HTML.
============================================================ */

(() => {
  // ---------- DOM
  const $ = (id) => document.getElementById(id);

  // Inputs
  const elFileCam = $("photoInputCamera");
  const elFileLib = $("photoInputLibrary");

  // Target stage
  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");
  const elInstruction = $("instructionLine");

  // Status + buttons
  const elBullStatus = $("bullStatus");
  const elHoleCount = $("holeCount");
  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elLockBanner = $("lockBanner");

  // Results
  const elWindDir = $("windageDir");
  const elWindVal = $("windageVal");
  const elElevDir = $("elevDir");
  const elElevVal = $("elevVal");
  const elDownloadSEC = $("downloadSecBtn");

  // Vendor
  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");
  const elVendorLogoMini = $("vendorLogoMini");
  const elVendorNameMini = $("vendorNameMini");

  // Arrow spans (exist in HTML as class .arrow)
  const elWindArrow = (() => {
    const v = elWindDir?.closest(".corrValue");
    return v ? v.querySelector(".arrow") : null;
  })();
  const elElevArrow = (() => {
    const v = elElevDir?.closest(".corrValue");
    return v ? v.querySelector(".arrow") : null;
  })();

  // ---------- Constants
  const CLICK_MOA_DEFAULT = 0.25; // 1/4 MOA
  const DIST_DEFAULT_YDS = 100;

  // Tap filtering (scroll-safe)
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 450;

  // ---------- State
  let objectUrl = null;

  // points: { nx, ny, ix, iy } where nx/ny are 0..1 within image rect,
  // and ix/iy are in natural pixels
  let aim = null;
  let holes = [];

  // Scale calibration:
  // pxPerInch = pixels corresponding to 1.00 inch on target grid
  let pxPerInch = null;
  let scalePts = []; // two points used to calibrate 1 inch

  // Results lock
  let resultsLocked = false;

  // Vendor
  let vendor = null;
  let vendorLogoImg = null;

  // Pointer tap capture
  let ptrDown = null;

  // Settings (persisted)
  const SETTINGS_KEY = "tns_settings_v1";
  let settings = loadSettings();

  // ---------- Utils
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

  // True MOA inches per MOA at distance (yards)
  const inchesPerMOA = (yds) => 1.047 * (yds / 100);

  // direction arrows
  const dirArrow = (dir) => {
    switch (dir) {
      case "LEFT": return "←";
      case "RIGHT": return "→";
      case "UP": return "↑";
      case "DOWN": return "↓";
      default: return "→";
    }
  };

  // Convert client coordinate → { nx, ny, ix, iy }
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

  // px distance between two points (natural pixels)
  function distPx(a, b) {
    const dx = a.ix - b.ix;
    const dy = a.iy - b.iy;
    return Math.hypot(dx, dy);
  }

  // Score: tighter group => higher score (0..100)
  // Defined (pilot): score = 100 - (avgRadiusIn * 12), clamped
  // avgRadiusIn uses calibrated pxPerInch.
  function computeScore() {
    if (!aim || holes.length === 0 || !pxPerInch) return null;

    const radii = holes.map((h) => {
      const dxIn = (h.ix - aim.ix) / pxPerInch;
      const dyIn = (h.iy - aim.iy) / pxPerInch;
      return Math.hypot(dxIn, dyIn);
    });

    const avg = radii.reduce((a, b) => a + b, 0) / radii.length;
    const raw = 100 - (avg * 12);
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    return score;
  }

  function scoreColor(score) {
    if (!Number.isFinite(score)) return "rgba(255,255,255,.82)";
    if (score >= 80) return "var(--blue)";
    if (score >= 55) return "rgba(255,255,255,.88)";
    return "var(--red)";
  }

  // ---------- UI helpers
  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Take a photo of your target.";
      return;
    }
    if (!aim) {
      elInstruction.textContent = "Tap aim point first.";
      return;
    }
    if (!pxPerInch) {
      elInstruction.textContent = "Tap two grid points exactly 1 inch apart to set scale.";
      return;
    }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus() {
    elBullStatus.textContent = aim ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    elUndo.disabled = !(aim || holes.length || scalePts.length || pxPerInch);
    elClear.disabled = !(aim || holes.length || scalePts.length || pxPerInch);

    // Show results enabled ONLY when we have aim + holes + scale
    const ready = !!aim && holes.length > 0 && !!pxPerInch;
    elShow.disabled = !(ready && !resultsLocked);

    elLockBanner.hidden = !resultsLocked;

    // Download SEC enabled only after compute (we gate by resultsLocked)
    elDownloadSEC.disabled = !resultsLocked;
  }

  function resetResultsUI() {
    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";

    if (elWindArrow) elWindArrow.textContent = "→";
    if (elElevArrow) elElevArrow.textContent = "→";

    elDownloadSEC.disabled = true;

    // Score line is injected; clear it if present
    const scoreEl = document.getElementById("scoreVal");
    if (scoreEl) scoreEl.textContent = "—";
  }

  function renderDots() {
    elDots.innerHTML = "";

    // Aim dot
    if (aim) {
      const d = document.createElement("div");
      d.className = "dot bullDot";
      d.style.left = `${aim.nx * 100}%`;
      d.style.top = `${aim.ny * 100}%`;
      elDots.appendChild(d);
    }

    // Scale calibration dots (yellow ring)
    for (const p of scalePts) {
      const d = document.createElement("div");
      d.className = "dot scaleDot";
      d.style.left = `${p.nx * 100}%`;
      d.style.top = `${p.ny * 100}%`;
      elDots.appendChild(d);
    }

    // Hole dots
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

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetAllState() {
    aim = null;
    holes = [];
    scalePts = [];
    pxPerInch = null;

    resultsLocked = false;
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  // Rename "Bull:" label to "Aim:" without editing HTML
  function renameBullToAim() {
    try {
      const chips = document.querySelectorAll(".chip");
      chips.forEach((c) => {
        if (c.textContent.trim().startsWith("Bull:")) {
          c.innerHTML = c.innerHTML.replace("Bull:", "Aim:");
        }
      });
    } catch (_) {}
  }

  // ---------- Scale calibration
  function addScalePoint(pt) {
    scalePts.push(pt);

    if (scalePts.length === 2) {
      const d = distPx(scalePts[0], scalePts[1]);
      // sanity: ignore nonsense taps too close
      if (d < 10) {
        scalePts = [];
        pxPerInch = null;
      } else {
        pxPerInch = d; // because user taps 1-inch spacing
      }
    }

    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearScale() {
    scalePts = [];
    pxPerInch = null;
    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---------- Tap logic
  function addTapPoint(pt) {
    if (!elImg.src) return;
    if (resultsLocked) return;

    // First tap sets AIM
    if (!aim) {
      aim = pt;
      holes = [];
      scalePts = [];
      pxPerInch = null;

      resetResultsUI();
      unlockResults();
      setInstruction();
      setStatus();
      renderDots();
      return;
    }

    // Next: require scale calibration before accepting holes
    if (!pxPerInch) {
      addScalePoint(pt);
      return;
    }

    // Remaining taps are holes
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

  // ---------- Undo/Clear
  function undo() {
    if (holes.length) {
      holes.pop();
      unlockResults();
      resetResultsUI();
    } else if (pxPerInch || scalePts.length) {
      // undo scale step
      if (scalePts.length) scalePts.pop();
      pxPerInch = (scalePts.length === 2) ? distPx(scalePts[0], scalePts[1]) : null;
      unlockResults();
      resetResultsUI();
    } else if (aim) {
      aim = null;
      unlockResults();
      resetResultsUI();
    }
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearAll() {
    aim = null;
    holes = [];
    scalePts = [];
    pxPerInch = null;

    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---------- Compute + Render (GRID-ANCHORED)
  function computeAndRender() {
    if (!aim || holes.length === 0 || !pxPerInch) return;

    // POIB in normalized space
    const poibN = meanPointNorm(holes);

    // Convert to natural pixels for stable inch conversion
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    const poib = { ix: poibN.nx * iw, iy: poibN.ny * ih };

    // correction vector = aim - poib (pixels)
    const dxPx = aim.ix - poib.ix;
    const dyPx = aim.iy - poib.iy;

    // Convert to inches (grid anchored)
    const dxIn = dxPx / pxPerInch;
    const dyIn = dyPx / pxPerInch;

    // Directions from signed inches (screen y increases downward)
    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    // Magnitudes
    const windAbsIn = Math.abs(dxIn);
    const elevAbsIn = Math.abs(dyIn);

    // True MOA math
    const yds = settings.unit === "m" ? (settings.distance * 1.0936133) : settings.distance;
    const ipm = inchesPerMOA(yds);
    const windMOA = windAbsIn / ipm;
    const elevMOA = elevAbsIn / ipm;

    const clickMoa = settings.clickMoa;
    const windClicks = windMOA / clickMoa;
    const elevClicks = elevMOA / clickMoa;

    // Render UI (two decimals)
    elWindDir.textContent = windDir;
    elWindVal.textContent = `${fmt2(windClicks)} clicks`;

    elElevDir.textContent = elevDir;
    elElevVal.textContent = `${fmt2(elevClicks)} clicks`;

    // Arrows that match direction
    if (elWindArrow) elWindArrow.textContent = dirArrow(windDir);
    if (elElevArrow) elElevArrow.textContent = dirArrow(elevDir);

    // Score
    const s = computeScore();
    const scoreEl = document.getElementById("scoreVal");
    if (scoreEl && s !== null) {
      scoreEl.textContent = String(s);
      scoreEl.style.color = scoreColor(s);
    }

    // LOCK after successful compute
    lockResults();
  }

  // ---------- SEC PNG builder
  async function buildSecPng(payload) {
    const W = 1200, H = 675;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "1000 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.fillText("SHOOTER", 60, 86);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(" EXPERIENCE ", 315, 86);
    ctx.fillStyle = "#1f6feb";
    ctx.fillText("CARD", 720, 86);

    ctx.font = "1000 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30"; ctx.fillText("S", 60, 132);
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillText("E", 92, 132);
    ctx.fillStyle = "#1f6feb"; ctx.fillText("C", 124, 132);

    // Vendor block top-right
    const vName = vendor?.name || "Printer";
    ctx.font = "850 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.textAlign = "right";
    ctx.fillText(vName, W - 70, 120);
    ctx.textAlign = "left";

    // Logo
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
    ctx.fillText(`Windage: ${payload.windDir} ${dirArrow(payload.windDir)} ${fmt2(payload.windClicks)} clicks`, px + 34, py + 140);
    ctx.fillText(`Elevation: ${payload.elevDir} ${dirArrow(payload.elevDir)} ${fmt2(payload.elevClicks)} clicks`, px + 34, py + 200);

    // Footer line
    const yds = settings.unit === "m" ? (settings.distance * 1.0936133) : settings.distance;
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "750 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(
      `True MOA • ${settings.distance} ${settings.unit} • ${fmt2(settings.clickMoa)} MOA/click • Grid-anchored scale`,
      px + 34, py + ph - 34
    );

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

  async function downloadSec() {
    if (!aim || holes.length === 0 || !pxPerInch) return;

    // Recompute exactly as UI (from current taps)
    const poibN = meanPointNorm(holes);
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    const poib = { ix: poibN.nx * iw, iy: poibN.ny * ih };

    const dxPx = aim.ix - poib.ix;
    const dyPx = aim.iy - poib.iy;

    const dxIn = dxPx / pxPerInch;
    const dyIn = dyPx / pxPerInch;

    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn <= 0 ? "UP" : "DOWN";

    const yds = settings.unit === "m" ? (settings.distance * 1.0936133) : settings.distance;
    const ipm = inchesPerMOA(yds);
    const windClicks = (Math.abs(dxIn) / ipm) / settings.clickMoa;
    const elevClicks = (Math.abs(dyIn) / ipm) / settings.clickMoa;

    // Wait briefly for logo
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

  // ---------- Vendor load
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

        // canvas preload
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
      }
    } catch (_) {
      // silent fail
    }
  }

  // ---------- File load
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

  // ---------- Settings gear (injected, no HTML edit)
  function injectGearUI() {
    const gearBtn = document.createElement("button");
    gearBtn.id = "gearBtn";
    gearBtn.type = "button";
    gearBtn.textContent = "⚙︎";
    gearBtn.setAttribute("aria-label", "Settings");
    document.body.appendChild(gearBtn);

    const panel = document.createElement("div");
    panel.id = "gearPanel";
    panel.innerHTML = `
      <div class="gearHdr">
        <div class="gearTitle">Details</div>
        <button id="gearClose" type="button" class="gearClose">✕</button>
      </div>

      <div class="gearRow">
        <div class="gearLabel">Distance</div>
        <div class="gearField">
          <input id="distVal" class="gearInput" inputmode="decimal" />
          <select id="distUnit" class="gearSelect">
            <option value="yd">yd</option>
            <option value="m">m</option>
          </select>
        </div>
      </div>

      <div class="gearRow">
        <div class="gearLabel">MOA per click</div>
        <div class="gearField">
          <input id="clickMoa" class="gearInput" inputmode="decimal" />
        </div>
      </div>

      <div class="gearRow">
        <div class="gearLabel">Scale</div>
        <div class="gearField">
          <button id="recalBtn" type="button" class="gearBtn">Recalibrate (1 inch)</button>
        </div>
      </div>

      <div class="gearRow gearNote">
        After Aim is set, tap two grid points exactly 1 inch apart.
      </div>
    `;
    document.body.appendChild(panel);

    const close = () => panel.classList.remove("open");
    const open = () => panel.classList.add("open");

    gearBtn.addEventListener("click", () => {
      if (panel.classList.contains("open")) close();
      else open();
    });

    panel.querySelector("#gearClose").addEventListener("click", close);

    // populate
    const distVal = panel.querySelector("#distVal");
    const distUnit = panel.querySelector("#distUnit");
    const clickMoa = panel.querySelector("#clickMoa");

    distVal.value = String(settings.distance);
    distUnit.value = settings.unit === "m" ? "m" : "yd";
    clickMoa.value = String(settings.clickMoa);

    const persist = () => {
      const d = Number(distVal.value);
      const c = Number(clickMoa.value);
      settings.distance = Number.isFinite(d) && d > 0 ? d : DIST_DEFAULT_YDS;
      settings.unit = distUnit.value === "m" ? "m" : "yd";
      settings.clickMoa = Number.isFinite(c) && c > 0 ? c : CLICK_MOA_DEFAULT;
      saveSettings(settings);

      // any setting change should unlock + require re-show
      if (resultsLocked) { unlockResults(); resetResultsUI(); }
      setStatus();
    };

    distVal.addEventListener("change", persist);
    distUnit.addEventListener("change", persist);
    clickMoa.addEventListener("change", persist);

    panel.querySelector("#recalBtn").addEventListener("click", () => {
      // allow recal even mid-session (forces re-show results)
      if (resultsLocked) { unlockResults(); resetResultsUI(); }
      clearScale();
      setInstruction();
    });
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return { distance: DIST_DEFAULT_YDS, unit: "yd", clickMoa: CLICK_MOA_DEFAULT };
      }
      const o = JSON.parse(raw);
      const dist = Number(o.distance);
      const click = Number(o.clickMoa);
      const unit = o.unit === "m" ? "m" : "yd";
      return {
        distance: Number.isFinite(dist) && dist > 0 ? dist : DIST_DEFAULT_YDS,
        unit,
        clickMoa: Number.isFinite(click) && click > 0 ? click : CLICK_MOA_DEFAULT
      };
    } catch (_) {
      return { distance: DIST_DEFAULT_YDS, unit: "yd", clickMoa: CLICK_MOA_DEFAULT };
    }
  }

  function saveSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  // ---------- Inject Score line into results (no HTML edit)
  function injectScoreRow() {
    const resultsCard = document.querySelector(".resultsCard");
    if (!resultsCard) return;
    if (document.getElementById("scoreVal")) return;

    const hdr = resultsCard.querySelector(".resultsHdr");
    const scoreWrap = document.createElement("div");
    scoreWrap.className = "scoreLine";
    scoreWrap.innerHTML = `
      <div class="scoreLabel">Score</div>
      <div id="scoreVal" class="scoreVal">—</div>
    `;

    // Insert just under header
    hdr.insertAdjacentElement("afterend", scoreWrap);
  }

  // ---------- Wire up
  elFileCam.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
  });

  elFileLib.addEventListener("change", (e) => {
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

  elShow.addEventListener("click", () => {
    computeAndRender();
  });

  elDownloadSEC.addEventListener("click", () => {
    downloadSec();
  });

  // Pointer events on tap layer
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // ---------- Init
  renameBullToAim();
  injectGearUI();
  injectScoreRow();

  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
