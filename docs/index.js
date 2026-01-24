/* ============================================================
   Tap-n-Score™ (docs/index.js) — FULL REPLACEMENT
   - Adds Vendor B (vendor.json) to:
     1) Input UI (vendor logo/link)
     2) SEC PNG (stamped logo)
   - Keeps basic flow:
     Choose photo -> tap bull once -> tap holes -> show results -> download SEC
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elUndo = $("undoBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elBullStatus = $("bullStatus");
  const elShowResults = $("showResultsBtn");

  const elWindDir = $("windDir");
  const elElevDir = $("elevDir");
  const elWindClicks = $("windClicks");
  const elElevClicks = $("elevClicks");

  const elVendorLink = $("vendorLink");
  const elVendorLogo = $("vendorLogo");

  const elDownloadSEC = $("downloadSecBtn");
  const secCanvas = $("secCanvas");
  const secCtx = secCanvas.getContext("2d");

  // --- State
  let objectUrl = null;
  let imageReady = false;

  let bull = null;     // {x,y} in image-space (0..1)
  let taps = [];       // holes: [{x,y} in image-space]

  // Vendor B
  let VENDOR = null;

  // --- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt;
  }

  function setInstruction(txt) {
    if (elInstruction) elInstruction.textContent = txt;
  }

  function setBullStatus() {
    setText(elBullStatus, bull ? "set" : "not set");
  }

  function setTapCount() {
    setText(elTapCount, String(taps.length));
  }

  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function dotAtNorm(x, y) {
    // Dot positioned over image, using wrapper sizing.
    // x,y are normalized to the displayed image area.
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x * 100}%`;
    dot.style.top = `${y * 100}%`;
    elDots.appendChild(dot);
  }

  function bullAtNorm(x, y) {
    const dot = document.createElement("div");
    dot.className = "bullDot";
    dot.style.left = `${x * 100}%`;
    dot.style.top = `${y * 100}%`;
    elDots.appendChild(dot);
  }

  function redrawDots() {
    clearDots();
    if (!imageReady) return;

    if (bull) bullAtNorm(bull.x, bull.y);
    taps.forEach(p => dotAtNorm(p.x, p.y));
  }

  function getNormFromEvent(evt) {
    const rect = elWrap.getBoundingClientRect();
    const x = clamp01((evt.clientX - rect.left) / rect.width);
    const y = clamp01((evt.clientY - rect.top) / rect.height);
    return { x, y };
  }

  function round2(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  // --- Vendor (B) loader (vendor.json is in docs root)
  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) throw new Error("vendor.json not found");
      const data = await res.json();

      const id = data.activeVendorId;
      const v = data.vendors && data.vendors[id];
      if (!v) throw new Error("activeVendorId not in vendors");

      VENDOR = {
        id,
        name: String(v.name || ""),
        website: String(v.website || ""),
        logo: String(v.logo || "")
      };
    } catch (e) {
      VENDOR = null;
    }

    applyVendorToUI();
  }

  function applyVendorToUI() {
    if (!elVendorLink || !elVendorLogo) return;

    if (!VENDOR || !VENDOR.logo) {
      elVendorLink.style.display = "none";
      return;
    }

    elVendorLogo.src = VENDOR.logo;
    elVendorLogo.alt = VENDOR.name ? `${VENDOR.name} logo` : "Vendor logo";

    if (VENDOR.website) {
      elVendorLink.href = VENDOR.website;
      elVendorLink.style.pointerEvents = "auto";
    } else {
      elVendorLink.href = "#";
      elVendorLink.style.pointerEvents = "none";
    }

    elVendorLink.style.display = "inline-flex";
  }

  // --- Math (simple, stable, click output already “fine” per you)
  // Treat image-space taps as points; compute POI mean vector from bull.
  function computeCorrections() {
    if (!bull || taps.length === 0) {
      return null;
    }

    const mean = taps.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const poi = { x: mean.x / taps.length, y: mean.y / taps.length };

    // Vector bull - poi (move impacts to bull)
    const dx = bull.x - poi.x; // + = move right
    const dy = bull.y - poi.y; // + = move down in screen space

    // Convert normalized deltas into "clicks" using a simple scale.
    // (Your backend/calc may override; this is UI-only here.)
    const clicksPerNorm = 40; // stable constant, tune later
    const windClicks = dx * clicksPerNorm;
    const elevClicks = dy * clicksPerNorm;

    const windDir = windClicks >= 0 ? "RIGHT" : "LEFT";
    const elevDir = elevClicks >= 0 ? "DOWN" : "UP";

    return {
      windDir,
      elevDir,
      windClicksAbs: Math.abs(windClicks),
      elevClicksAbs: Math.abs(elevClicks),
      poi,
      dx,
      dy
    };
  }

  function showResults() {
    const r = computeCorrections();
    if (!r) {
      setText(elWindDir, "—");
      setText(elElevDir, "—");
      setText(elWindClicks, "—");
      setText(elElevClicks, "—");
      return;
    }

    setText(elWindDir, r.windDir);
    setText(elElevDir, r.elevDir);
    setText(elWindClicks, round2(r.windClicksAbs));
    setText(elElevClicks, round2(r.elevClicksAbs));
  }

  // --- SEC generator (with vendor stamp)
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function drawVendorOnSEC(ctx, W, H) {
    if (!VENDOR || !VENDOR.logo) return;

    try {
      const logo = await loadImage(VENDOR.logo);

      const pad = 36;
      const maxH = 70;
      const scale = maxH / logo.height;
      const w = logo.width * scale;
      const h = logo.height * scale;

      const x = W - w - pad;
      const y = pad;

      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(logo, x, y, w, h);
      ctx.restore();
    } catch (e) {
      // ignore
    }
  }

  async function downloadSEC() {
    const r = computeCorrections();
    if (!r) return;

    const W = secCanvas.width;
    const H = secCanvas.height;

    // Background
    secCtx.clearRect(0, 0, W, H);
    secCtx.fillStyle = "#0b0f14";
    secCtx.fillRect(0, 0, W, H);

    // Title
    secCtx.fillStyle = "#e6eefc";
    secCtx.font = "bold 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    secCtx.fillText("Shooter Experience Card", 60, 110);

    // Vendor name line (optional)
    if (VENDOR && VENDOR.name) {
      secCtx.fillStyle = "#9db2d6";
      secCtx.font = "28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      secCtx.fillText(VENDOR.name, 60, 160);
    }

    // Corrections
    secCtx.fillStyle = "#e6eefc";
    secCtx.font = "bold 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    secCtx.fillText("Corrections (Scope)", 60, 260);

    secCtx.font = "34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    secCtx.fillText(`Windage:  ${r.windDir}  →  ${round2(r.windClicksAbs)} clicks`, 60, 340);
    secCtx.fillText(`Elevation: ${r.elevDir}  →  ${round2(r.elevClicksAbs)} clicks`, 60, 400);

    // Stamp vendor logo (top-right)
    await drawVendorOnSEC(secCtx, W, H);

    // Export
    const a = document.createElement("a");
    a.download = "SEC.png";
    a.href = secCanvas.toDataURL("image/png");
    a.click();
  }

  // --- Events
  function onPickFile(file) {
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    elImg.src = objectUrl;
    imageReady = true;

    bull = null;
    taps = [];
    setBullStatus();
    setTapCount();
    redrawDots();

    setInstruction("Tap the bull (center) once. Then tap each hole.");
  }

  function onTap(evt) {
    if (!imageReady) return;

    const p = getNormFromEvent(evt);

    if (!bull) {
      bull = p;
      setBullStatus();
      redrawDots();
      setInstruction("Now tap each hole.");
      return;
    }

    taps.push(p);
    setTapCount();
    redrawDots();
  }

  // Wire input
  elFile.addEventListener("change", (e) => onPickFile(e.target.files && e.target.files[0]));

  // Tap handling (pointer)
  elWrap.addEventListener("pointerdown", (e) => {
    // Prevent iOS “double tap to zoom” weirdness
    e.preventDefault();
    onTap(e);
  }, { passive: false });

  elClear.addEventListener("click", () => {
    bull = null;
    taps = [];
    setBullStatus();
    setTapCount();
    redrawDots();
    setInstruction("Tap the bull (center) once. Then tap each hole.");
    showResults();
  });

  elUndo.addEventListener("click", () => {
    if (taps.length > 0) {
      taps.pop();
      setTapCount();
      redrawDots();
      showResults();
      return;
    }
    if (bull) {
      bull = null;
      setBullStatus();
      redrawDots();
      setInstruction("Tap the bull (center) once. Then tap each hole.");
      showResults();
    }
  });

  elShowResults.addEventListener("click", () => showResults());
  elDownloadSEC.addEventListener("click", () => downloadSEC());

  // --- Init
  setBullStatus();
  setTapCount();
  setInstruction("Choose a photo. Then tap the bull (center) once, then tap each hole.");
  loadVendor();
})();
