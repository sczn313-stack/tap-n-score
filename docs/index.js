/* ============================================================
   /docs/index.js  (FULL REPLACEMENT)
   - Vendor pill shows logo + name (stable even without website)
   - All action buttons are blue via CSS (Download SEC stays patriotic)
   - Tap-n-Score header hides while SEC overlay is up (secMode)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements
  const elFile = $("photoInput");
  const elChoose = $("choosePhotoBtn");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elInstruction = $("instructionLine");

  const elBullStatus = $("bullStatus");
  const elTapCount = $("tapCount");

  const elSetBull = $("setBullBtn");
  const elUndo = $("undoBtn");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");

  const elWindDir = $("windDir");
  const elWindClicks = $("windClicks");
  const elElevDir = $("elevDir");
  const elElevClicks = $("elevClicks");

  const elDownloadSecBtn = $("downloadSecBtn");

  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");
  const elVendorLink = $("vendorLink");

  const elSecOverlay = $("secOverlay");
  const elSecCanvas = $("secCanvas");
  const elCloseSec = $("closeSecBtn");
  const elSaveSec = $("saveSecBtn");

  // --- State
  let objectUrl = null;
  let imgLoaded = false;

  let mode = "holes"; // "bull" or "holes"
  let bull = null;    // {x,y} in image pixel space
  let holes = [];     // [{x,y}, ...]

  let vendor = {
    id: "",
    name: "Vendor",
    website: "",
    logoPath: ""
  };

  // --- Constants (pilot defaults)
  const DISTANCE_YARDS = 50;
  const CLICK_MOA = 0.25;

  function inchesPerMOA(yards) {
    return 1.047 * (yards / 100);
  }

  function to2(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function resetAll() {
    bull = null;
    holes = [];
    mode = "holes";
    renderDots();
    updatePills();
    clearResultsUI();
  }

  function clearResultsUI() {
    elWindDir.textContent = "—";
    elWindClicks.textContent = "—";
    elElevDir.textContent = "—";
    elElevClicks.textContent = "—";
  }

  function updatePills() {
    elBullStatus.textContent = bull ? "Bull: set" : "Bull: not set";
    elTapCount.textContent = `Holes: ${holes.length}`;
  }

  function getImagePointFromTap(clientX, clientY) {
    const rect = elWrap.getBoundingClientRect();
    const xN = clamp01((clientX - rect.left) / rect.width);
    const yN = clamp01((clientY - rect.top) / rect.height);

    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;

    return { x: xN * iw, y: yN * ih };
  }

  function renderDots() {
    elDots.innerHTML = "";
    if (!imgLoaded) return;

    const rect = elWrap.getBoundingClientRect();
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;

    const placeDot = (pt, cls) => {
      const xN = pt.x / iw;
      const yN = pt.y / ih;

      const dot = document.createElement("div");
      dot.className = `dot ${cls || ""}`.trim();
      dot.style.left = `${xN * rect.width}px`;
      dot.style.top = `${yN * rect.height}px`;
      elDots.appendChild(dot);
    };

    if (bull) placeDot(bull, "bull");
    holes.forEach((h) => placeDot(h, ""));
  }

  function computePOIB() {
    if (!holes.length) return null;
    let sx = 0, sy = 0;
    for (const h of holes) { sx += h.x; sy += h.y; }
    return { x: sx / holes.length, y: sy / holes.length };
  }

  function computeCorrections() {
    if (!bull || holes.length < 1) return null;

    const poib = computePOIB();
    if (!poib) return null;

    // correction = bull - POIB
    const dxPx = bull.x - poib.x;
    const dyPx = bull.y - poib.y;

    const iw = elImg.naturalWidth || 1;
    const pxPerUnit = iw / 12;

    const dxIn = dxPx / pxPerUnit;
    const dyIn = dyPx / pxPerUnit;

    const ipm = inchesPerMOA(DISTANCE_YARDS);

    const windMOA = Math.abs(dxIn) / ipm;
    const elevMOA = Math.abs(dyIn) / ipm;

    const windClicks = windMOA / CLICK_MOA;
    const elevClicks = elevMOA / CLICK_MOA;

    const windDir = dxIn > 0 ? "RIGHT" : (dxIn < 0 ? "LEFT" : "—");
    const elevDir = dyIn < 0 ? "UP" : (dyIn > 0 ? "DOWN" : "—");

    return { windDir, elevDir, windClicks, elevClicks };
  }

  function showResults() {
    const r = computeCorrections();
    if (!r) return;

    elWindDir.textContent = r.windDir;
    elElevDir.textContent = r.elevDir;

    elWindClicks.textContent = `${to2(r.windClicks)} clicks`;
    elElevClicks.textContent = `${to2(r.elevClicks)} clicks`;
  }

  // ===== Vendor =====
  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();

      vendor = {
        id: String(data.id || ""),
        name: String(data.name || "Vendor"),
        website: String(data.website || ""),
        logoPath: String(data.logoPath || "")
      };

      // Name
      elVendorName.textContent = vendor.name || "Vendor";

      // Website (optional)
      if (vendor.website) {
        elVendorLink.href = vendor.website;
        elVendorLink.target = "_blank";
        elVendorLink.rel = "noopener";
        elVendorLink.style.opacity = "1";
        elVendorLink.style.pointerEvents = "auto";
      } else {
        elVendorLink.href = "#";
        elVendorLink.removeAttribute("target");
        elVendorLink.removeAttribute("rel");
        elVendorLink.style.opacity = "0.95";
        elVendorLink.style.pointerEvents = "none";
      }

      // Logo
      if (vendor.logoPath) {
        const url = new URL(vendor.logoPath, window.location.href).toString();
        elVendorLogo.src = url;
        elVendorLogo.style.display = "block";
      }
    } catch (e) {
      // silent
    }
  }

  // ===== SEC overlay =====
  function openSecOverlay() {
    document.body.classList.add("secMode");
    elSecOverlay.classList.add("show");
    elSecOverlay.setAttribute("aria-hidden", "false");
  }

  function closeSecOverlay() {
    elSecOverlay.classList.remove("show");
    elSecOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("secMode");
  }

  function roundRect(ctx, x, y, w, h, r, fill) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  async function drawSecToCanvas() {
    const r = computeCorrections();
    if (!r) return;

    const ctx = elSecCanvas.getContext("2d");
    const W = elSecCanvas.width;
    const H = elSecCanvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0c10";
    ctx.fillRect(0, 0, W, H);

    // Patriot header
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, W, 190);

    ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("SHOOTER EXPERIENCE CARD", 44, 92);

    // SEC letters (R/W/B)
    ctx.font = "900 84px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#dc2626"; ctx.fillText("S", 44, 165);
    ctx.fillStyle = "#ffffff"; ctx.fillText("E", 104, 165);
    ctx.fillStyle = "#2563eb"; ctx.fillText("C", 170, 165);

    // Vendor name (top-right)
    ctx.font = "850 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "right";
    ctx.fillText(vendor.name || "", W - 44, 175);
    ctx.textAlign = "left";

    // Target panel
    const imgX = 44, imgY = 230, imgW = W - 88, imgH = 760;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, imgX, imgY, imgW, imgH, 22, true);

    // Draw the current photo (best effort)
    if (elImg && elImg.src) {
      try {
        const tmp = new Image();
        tmp.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          tmp.onload = resolve;
          tmp.onerror = reject;
          tmp.src = elImg.src;
        });

        const pad = 18;
        const drawX = imgX + pad, drawY = imgY + pad;
        const drawW = imgW - pad * 2, drawH = imgH - pad * 2;

        const ratio = Math.min(drawW / tmp.width, drawH / tmp.height);
        const rw = tmp.width * ratio;
        const rh = tmp.height * ratio;

        const cx = drawX + (drawW - rw) / 2;
        const cy = drawY + (drawH - rh) / 2;

        ctx.drawImage(tmp, cx, cy, rw, rh);
      } catch {}
    }

    // Results panel
    const cardX = 44, cardY = 1010, cardW = W - 88, cardH = 300;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 22, true);

    ctx.font = "900 36px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("Corrections (Scope)", cardX + 28, cardY + 60);

    ctx.font = "800 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText("Windage:", cardX + 28, cardY + 125);
    ctx.fillText("Elevation:", cardX + 28, cardY + 195);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "950 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${r.windDir}`, cardX + 240, cardY + 125);
    ctx.fillText(`${r.elevDir}`, cardX + 240, cardY + 195);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "850 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${to2(r.windClicks)} clicks`, cardX + cardW - 28, cardY + 125);
    ctx.fillText(`${to2(r.elevClicks)} clicks`, cardX + cardW - 28, cardY + 195);
    ctx.textAlign = "left";

    ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(`Distance: ${DISTANCE_YARDS} yd   •   Click: ${CLICK_MOA} MOA/click   •   True MOA`, cardX + 28, cardY + 265);
  }

  function saveCanvasAsPng() {
    const a = document.createElement("a");
    a.download = "SEC.png";
    a.href = elSecCanvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ===== Events =====
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    elImg.onload = () => {
      imgLoaded = true;
      resetAll();
      renderDots();
      elInstruction.textContent = "Tap bull once (Set Bull), then tap each confirmed hole.";
    };

    elImg.src = objectUrl;
  });

  elSetBull.addEventListener("click", () => {
    mode = "bull";
    elInstruction.textContent = "Tap the bull once.";
  });

  elUndo.addEventListener("click", () => {
    if (mode === "bull") {
      mode = "holes";
      elInstruction.textContent = "Tap each confirmed hole.";
      return;
    }
    if (holes.length) holes.pop();
    renderDots();
    updatePills();
    clearResultsUI();
  });

  elClear.addEventListener("click", () => {
    resetAll();
    elInstruction.textContent = "Tap bull once (Set Bull), then tap each confirmed hole.";
  });

  elWrap.addEventListener("click", (ev) => {
    if (!imgLoaded) return;

    const pt = getImagePointFromTap(ev.clientX, ev.clientY);

    if (mode === "bull") {
      bull = { x: pt.x, y: pt.y };
      mode = "holes";
      elInstruction.textContent = "Bull set. Now tap each confirmed hole.";
    } else {
      holes.push({ x: pt.x, y: pt.y });
    }

    renderDots();
    updatePills();
    clearResultsUI();
  });

  elShow.addEventListener("click", () => {
    if (!bull) {
      elInstruction.textContent = "Set the bull first (tap Set Bull, then tap the bull).";
      return;
    }
    if (holes.length < 1) {
      elInstruction.textContent = "Tap at least 1 confirmed hole.";
      return;
    }
    showResults();
  });

  elDownloadSecBtn.addEventListener("click", async () => {
    if (!bull || holes.length < 1) {
      elInstruction.textContent = "Set bull + tap at least 1 hole before generating SEC.";
      return;
    }
    await drawSecToCanvas();
    openSecOverlay();
  });

  elCloseSec.addEventListener("click", () => closeSecOverlay());
  elSaveSec.addEventListener("click", () => saveCanvasAsPng());

  elSecOverlay.addEventListener("click", (ev) => {
    if (ev.target === elSecOverlay) closeSecOverlay();
  });

  window.addEventListener("resize", () => renderDots());

  // Init
  loadVendor();
  updatePills();
})();
