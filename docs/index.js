/* docs/index.js (FULL REPLACEMENT)
   Goals:
   - "Choose Target Photo" is FIRST and DISAPPEARS after the image loads.
   - No Target Size field anywhere.
   - No "MOA" wording anywhere (UI labels are "per click").
   - iPad-safe: only taps create dots; scroll/drag does NOT.
   - Bull must be set BEFORE holes can be added.
   - Results computed in inches + clicks (1.047" per MOA @ 100y).
   - Includes SEC PNG download (simple screenshot-style card).
*/
(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements
  const elChooseRow = $("chooseTargetRow");
  const elFile = $("photoInput");
  const elFileName = $("fileName");

  const elMode = $("modeSel");
  const elDistance = $("distanceYds");
  const elClickValue = $("clickValue");

  const elInstruction = $("instructionLine");

  const elWrap = $("targetWrap");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");

  const elBullState = $("bullState");
  const elHoleCount = $("holeCount");

  const elBullBtn = $("bullSetBtn");
  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showBtn");

  const elResults = $("resultsCard");

  const rMode = $("rMode");
  const rDist = $("rDist");
  const rClick = $("rClick");
  const rTapped = $("rTapped");
  const rUsed = $("rUsed");

  const rWindDir = $("rWindDir");
  const rWindIn = $("rWindIn");
  const rWindClk = $("rWindClk");
  const rElevDir = $("rElevDir");
  const rElevIn = $("rElevIn");
  const rElevClk = $("rElevClk");

  const rMag = $("rMag");
  const rMr = $("rMr");
  const rScore = $("rScore");

  const elDownload = $("downloadSecLink");

  // --- State (normalized 0..1 relative to image content box)
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;             // {x,y} normalized
  let holes = [];              // array of {x,y}
  let lastTapTs = 0;

  // Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const distYds = () => Math.max(1, Number(elDistance.value || 100));
  const clickVal = () => Number(elClickValue.value || 0.25);

  function clickLabel(v) {
    const n = Number(v);
    if (n === 0.25) return "1/4 per click";
    if (n === 0.5) return "1/2 per click";
    if (n === 0.125) return "1/8 per click";
    return `${n.toFixed(3)} per click`;
  }

  function setInstruction(msg) {
    elInstruction.textContent = msg;
  }

  function resetAll() {
    bull = null;
    holes = [];
    renderDots();
    updateCounters();
    elResults.classList.add("hidden");
    elDownload.classList.add("hidden");
    elDownload.href = "#";
    setInstruction("Choose a target photo to begin.");
    elBullState.textContent = "not set";
    elShow.disabled = true;
  }

  function updateCounters() {
    elHoleCount.textContent = String(holes.length);
    elBullState.textContent = bull ? "set" : "not set";
    elShow.disabled = !(bull && holes.length >= 1);
  }

  function clearDotsLayer() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  function addDot(x, y, isBull = false) {
    const d = document.createElement("div");
    d.className = "dot" + (isBull ? " bull" : "");
    d.style.left = `${(x * 100).toFixed(4)}%`;
    d.style.top = `${(y * 100).toFixed(4)}%`;
    elDots.appendChild(d);
  }

  function renderDots() {
    clearDotsLayer();
    if (bull) addDot(bull.x, bull.y, true);
    for (const h of holes) addDot(h.x, h.y, false);
  }

  // Convert normalized delta to inches using the displayed image content box
  function normToInches(dxNorm, dyNorm) {
    // We assume "target size" is unknown; we use the PHOTO frame as the reference.
    // For now, treat the *visible image width* as 8.5" and height as 11" for conversion?
    // NO — you told me target size is not needed because QR will supply it later.
    // So this app uses PHOTO-SPACE inches based on a fixed "8.5×11" proxy is wrong.
    //
    // ✅ Instead: compute inches from MOA geometry at distance using the POIB offset in normalized %
    // But that still needs the real-world size scaling.
    //
    // Since you're already getting correct inches on your earlier build,
    // we’ll do it properly: infer inches from the image’s *assumed paper ratio* 8.5×11
    // ONLY as a temporary visual tool. When QR is wired, replace with QR-provided width/height.
    //
    // To respect your rule "Target size is not important to show":
    // - We do NOT show it.
    // - We keep this internal constant until QR wiring replaces it.

    const PAPER_W_IN = 8.5;
    const PAPER_H_IN = 11.0;

    return {
      dxIn: dxNorm * PAPER_W_IN,
      dyIn: dyNorm * PAPER_H_IN
    };
  }

  // True MOA inches at given distance (yards): 1.047" at 100 yards
  function inchesPerMOA(distanceYards) {
    return 1.047 * (distanceYards / 100);
  }

  function computePOIB(points) {
    if (!points.length) return null;
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }

  function meanRadius(points, center) {
    if (!points.length || !center) return 0;
    let sum = 0;
    for (const p of points) {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      sum += Math.hypot(dx, dy);
    }
    return sum / points.length;
  }

  function score100(offsetIn, meanRadIn) {
    // Simple pilot scoring:
    // OffsetScore = max(0, 100 - (offsetIn * 20))
    // ConsistencyScore = max(0, 100 - (meanRadIn * 80))
    // Score100 = 0.6*Offset + 0.4*Consistency
    const offsetScore = Math.max(0, 100 - (offsetIn * 20));
    const consScore = Math.max(0, 100 - (meanRadIn * 80));
    return {
      offsetScore,
      consScore,
      score: (0.6 * offsetScore) + (0.4 * consScore)
    };
  }

  // iPad-safe: we only create dots on a "tap-like" pointer sequence.
  // Also: no dots until bull set (for holes).
  function getNormFromEvent(e) {
    const rect = elWrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: clamp01(x), y: clamp01(y) };
  }

  // --- File load
  function loadFile(file) {
    selectedFile = file;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      // Hide chooser AFTER image actually loads (fixes iPad “stuck chooser”)
      if (elChooseRow) elChooseRow.style.display = "none";

      // Reset session state
      resetAll();

      // Now prompt for bull
      setInstruction("Tap the bull center first.");
    };

    elImg.src = objectUrl;
  }

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;
    elFileName.textContent = f.name || "Photo selected";
    loadFile(f);
  });

  // --- Tap handling on wrapper
  // We use pointer events so Apple Pencil/finger works.
  // We block dot-creation on scroll/drag by requiring minimal movement.
  let downPt = null;

  elWrap.addEventListener("pointerdown", (e) => {
    // Must have an image loaded
    if (!elImg.src) return;
    downPt = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, { passive: true });

  elWrap.addEventListener("pointerup", (e) => {
    if (!elImg.src) return;
    if (!downPt) return;

    const up = { x: e.clientX, y: e.clientY, t: Date.now() };
    const dt = up.t - downPt.t;
    const dist = Math.hypot(up.x - downPt.x, up.y - downPt.y);

    downPt = null;

    // Tap-like: short time + low movement
    if (dt > 450) return;
    if (dist > 12) return;

    // De-bounce double-fires
    const now = Date.now();
    if (now - lastTapTs < 120) return;
    lastTapTs = now;

    const p = getNormFromEvent(e);

    if (!bull) {
      bull = p;
      renderDots();
      updateCounters();
      setInstruction("Bull set ✅ Now tap each bullet hole. (Undo removes last hole, or bull if no holes.)");
      return;
    }

    holes.push(p);
    renderDots();
    updateCounters();
  }, { passive: true });

  // --- Buttons
  elUndo.addEventListener("click", () => {
    if (holes.length > 0) {
      holes.pop();
      renderDots();
      updateCounters();
      if (holes.length === 0) {
        setInstruction("Bull set ✅ Now tap each bullet hole. (Undo removes last hole, or bull if no holes.)");
      }
      return;
    }
    if (bull) {
      bull = null;
      renderDots();
      updateCounters();
      setInstruction("Tap the bull center first.");
      return;
    }
  });

  elClear.addEventListener("click", () => {
    // Show chooser again + clear file input (so user can pick a new photo)
    if (elChooseRow) elChooseRow.style.display = "";
    elFile.value = "";
    elFileName.textContent = "No file selected";
    elImg.src = "";
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    selectedFile = null;
    resetAll();
  });

  elBullBtn.addEventListener("click", () => {
    if (!elImg.src) return;
    if (!bull) {
      setInstruction("Tap the bull center first.");
    } else {
      setInstruction("Bull set ✅ Now tap each bullet hole. (Undo removes last hole, or bull if no holes.)");
    }
  });

  elMode.addEventListener("change", () => {
    // Mode is important, but it doesn't change core math in this pilot
    if (!elImg.src) return;
    elResults.classList.add("hidden");
  });

  elDistance.addEventListener("input", () => {
    if (!elImg.src) return;
    elResults.classList.add("hidden");
  });

  elClickValue.addEventListener("change", () => {
    if (!elImg.src) return;
    elResults.classList.add("hidden");
  });

  // --- Results + SEC
  function buildSecPng(summary) {
    // Creates a simple canvas card with key info (no headers/footers/watermarks).
    const w = 1200;
    const h = 675;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    // background
    ctx.fillStyle = "#0b0e0f";
    ctx.fillRect(0, 0, w, h);

    // title (brand colors in text; still clean)
    ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff3b30";
    ctx.fillText("TAP", 60, 90);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("-N-", 170, 90);
    ctx.fillStyle = "#1f6feb";
    ctx.fillText("SCORE", 270, 90);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("™", 470, 78);

    ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.fillText("After-Shot Intelligence Receipt", 60, 128);

    // left panel
    const boxX = 60, boxY = 170, boxW = 520, boxH = 430;
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Session", boxX + 24, boxY + 52);

    ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.78)";
    let y = boxY + 95;
    const line = (k, v) => {
      ctx.fillStyle = "rgba(255,255,255,.62)";
      ctx.fillText(k, boxX + 24, y);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.fillText(v, boxX + 230, y);
      y += 38;
    };

    line("Mode:", summary.mode);
    line("Distance:", `${summary.distance} yards`);
    line("Click value:", clickLabel(summary.clickValue));
    line("Holes used:", String(summary.holesUsed));
    y += 10;

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections", boxX + 24, y);
    y += 45;

    ctx.font = "800 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillText(`Windage: ${summary.windDir} ${summary.windIn}" → ${summary.windClicks} clicks`, boxX + 24, y);
    y += 38;
    ctx.fillText(`Elevation: ${summary.elevDir} ${summary.elevIn}" → ${summary.elevClicks} clicks`, boxX + 24, y);
    y += 55;

    ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillText(`Offset magnitude: ${summary.mag}"`, boxX + 24, y);
    y += 34;
    ctx.fillText(`Mean radius: ${summary.meanRadius}"`, boxX + 24, y);
    y += 34;
    ctx.fillText(`Score100: ${summary.score}`, boxX + 24, y);

    // right panel: thumbnail of target + dots (simple)
    const imgX = 620, imgY = 170, imgW = 520, imgH = 430;
    roundRect(ctx, imgX, imgY, imgW, imgH, 22);
    ctx.fillStyle = "rgba(255,255,255,.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.stroke();

    // draw target image if possible
    try {
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, imgX, imgY, imgW, imgH, 22);
      ctx.clip();

      // fit image contain
      const iw = elImg.naturalWidth || 1;
      const ih = elImg.naturalHeight || 1;
      const scale = Math.min(imgW / iw, imgH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = imgX + (imgW - dw) / 2;
      const dy = imgY + (imgH - dh) / 2;
      ctx.drawImage(elImg, dx, dy, dw, dh);

      // overlay dots
      const drawDot = (nx, ny, color) => {
        const px = dx + nx * dw;
        const py = dy + ny * dh;
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      };

      if (bull) drawDot(bull.x, bull.y, "rgba(255,215,0,.95)");
      for (const hpt of holes) drawDot(hpt.x, hpt.y, "rgba(0,255,160,.92)");

      ctx.restore();
    } catch (_) {
      // ignore
    }

    // next line
    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Next: Shoot a 5-shot group, tap, confirm the new zero.", 60, 645);

    return c.toDataURL("image/png");
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  elShow.addEventListener("click", () => {
    if (!bull || holes.length < 1) return;

    const mode = elMode.value || "rifle";
    const dY = distYds();
    const cv = clickVal();

    // POIB
    const poib = computePOIB(holes);

    // Offset vector = (bull - poib)
    const dx = bull.x - poib.x;          // + means bull is to the RIGHT of POIB => move RIGHT
    const dy = bull.y - poib.y;          // + means bull is BELOW POIB in screen space => move DOWN

    // Convert to inches (internal proxy until QR provides paper size)
    const { dxIn, dyIn } = normToInches(dx, dy);

    // Direction strings (screen truth: right is right; down is down)
    const windDir = dxIn >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dyIn >= 0 ? "DOWN" : "UP";

    const windAbsIn = Math.abs(dxIn);
    const elevAbsIn = Math.abs(dyIn);

    // Clicks: inches -> MOA -> clicks
    const ipm = inchesPerMOA(dY);
    const windMOA = windAbsIn / ipm;
    const elevMOA = elevAbsIn / ipm;

    const windClicks = windMOA / cv;
    const elevClicks = elevMOA / cv;

    // Metrics
    const magIn = Math.hypot(dxIn, dyIn);
    const mrNorm = meanRadius(holes, poib);
    const mrIn = normToInches(mrNorm, 0).dxIn; // approximate radius using width scale

    const sc = score100(magIn, mrIn);

    // Render
    rMode.textContent = mode;
    rDist.textContent = `${dY} yards`;
    rClick.textContent = clickLabel(cv);

    rTapped.textContent = String(holes.length);
    rUsed.textContent = String(holes.length);

    rWindDir.textContent = windDir;
    rWindIn.textContent = `${windAbsIn.toFixed(2)}"`;
    rWindClk.textContent = `${windClicks.toFixed(2)} clicks`;

    rElevDir.textContent = elevDir;
    rElevIn.textContent = `${elevAbsIn.toFixed(2)}"`;
    rElevClk.textContent = `${elevClicks.toFixed(2)} clicks`;

    rMag.textContent = `${magIn.toFixed(2)}"`;
    rMr.textContent = `${mrIn.toFixed(2)}"`;
    rScore.textContent = `${sc.score.toFixed(2)}`;

    elResults.classList.remove("hidden");

    // Build SEC PNG
    const sec = buildSecPng({
      mode,
      distance: dY,
      clickValue: cv,
      holesUsed: holes.length,
      windDir,
      windIn: windAbsIn.toFixed(2),
      windClicks: windClicks.toFixed(2),
      elevDir,
      elevIn: elevAbsIn.toFixed(2),
      elevClicks: elevClicks.toFixed(2),
      mag: magIn.toFixed(2),
      meanRadius: mrIn.toFixed(2),
      score: sc.score.toFixed(2),
    });

    elDownload.href = sec;
    elDownload.classList.remove("hidden");

    // Smooth scroll to results on iPad
    setTimeout(() => elResults.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  });

  // Start state
  resetAll();

  // If Safari restores state weirdly, keep UI honest
  window.addEventListener("pageshow", () => {
    updateCounters();
  });
})();
