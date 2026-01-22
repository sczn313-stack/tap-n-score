/* ============================================================
   tap-n-score/docs/index.js  (FULL REPLACEMENT)
   Adds:
   - SEC PNG generator (Download + iPad Share Sheet)
   - Mini target snapshot w/ bull + holes + POIB + POIB→Bull arrow
   Keeps:
   - Bull-first workflow
   - No ghost taps on iPad (single event pipeline)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Required elements (already in your page)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elHoleCount = $("tapCount");
  const elBullStatus = $("bullStatus");
  const elUndo = $("undoBtn");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elResults = $("resultsBox");
  const elMode = $("modeSelect");

  // --- Optional elements (only used if they exist on your page)
  const elTargetSize = $("targetSize");     // e.g., select
  const elDistanceYds = $("distanceYds");   // e.g., input
  const elClickValue = $("clickValue");     // e.g., select

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  // Bull-first workflow:
  // - bull = {xPct, yPct} or null
  // - holes = array of {xPct, yPct}
  let bull = null;
  let holes = [];

  // last computed results for SEC
  let lastResults = null;

  // --- Persist last mode
  const MODE_KEY = "tns_last_mode";
  try {
    const last = localStorage.getItem(MODE_KEY);
    if (last && elMode) elMode.value = last;
  } catch {}
  if (elMode) {
    elMode.addEventListener("change", () => {
      try { localStorage.setItem(MODE_KEY, elMode.value); } catch {}
    });
  }

  function setHint(msg) {
    if (elInstruction) elInstruction.textContent = msg;
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function setButtons() {
    if (elHoleCount) elHoleCount.textContent = String(holes.length);
    if (elBullStatus) elBullStatus.textContent = bull ? "set" : "not set";

    const hasAny = !!bull || holes.length > 0;

    if (elUndo) elUndo.disabled = !hasAny;
    if (elClear) elClear.disabled = !hasAny;
    if (elSee) elSee.disabled = !selectedFile || !bull || holes.length === 0;
  }

  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function drawDots() {
    clearDots();
    if (!elDots) return;

    // bull (yellow)
    if (bull) {
      const b = document.createElement("div");
      b.className = "dotBull";
      b.style.left = `${bull.xPct}%`;
      b.style.top = `${bull.yPct}%`;
      elDots.appendChild(b);
    }

    // holes (green)
    for (const h of holes) {
      const d = document.createElement("div");
      d.className = "dot";
      d.style.left = `${h.xPct}%`;
      d.style.top = `${h.yPct}%`;
      elDots.appendChild(d);
    }
  }

  function resetSession() {
    bull = null;
    holes = [];
    lastResults = null;
    drawDots();
    setButtons();
    if (elResults) {
      elResults.style.display = "none";
      elResults.innerHTML = "";
    }
  }

  // --- iOS-safe: store File immediately on change
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      selectedFile = f;
      resetSession();

      revokeObjectUrl();
      objectUrl = URL.createObjectURL(f);
      if (elImg) {
        elImg.src = objectUrl;
        elImg.style.display = "block";
      }

      setHint("Tap the bull (center) once. Then tap each bullet hole. Undo/Clear as needed.");
    });
  }

  // --- Coordinate helper (returns {xPct,yPct} or null if not on image)
  function getPctFromEvent(ev) {
    if (!selectedFile || !elImg || elImg.style.display === "none") return null;

    const rect = elImg.getBoundingClientRect();

    // unify touch + mouse
    const t = ev.touches && ev.touches[0] ? ev.touches[0] : null;
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    // must be inside image
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    return {
      xPct: Math.max(0, Math.min(100, x)),
      yPct: Math.max(0, Math.min(100, y)),
    };
  }

  // --- SINGLE EVENT PIPELINE (prevents 1 tap = 2 dots on iPad)
  const supportsPointer = "PointerEvent" in window;

  function clearResults() {
    lastResults = null;
    if (elResults) {
      elResults.style.display = "none";
      elResults.innerHTML = "";
    }
  }

  function handleTap(ev) {
    const pt = getPctFromEvent(ev);
    if (!pt) return;

    // Bull-first: first tap sets bull, then holes
    if (!bull) {
      bull = pt;
      setHint("Bull set ✅ Now tap each bullet hole. (Undo removes last hole, or bull if no holes.)");
    } else {
      holes.push(pt);
      setHint("Keep tapping bullet holes. Use Undo for mistakes. Then Show Results.");
    }

    drawDots();
    setButtons();
    clearResults();
  }

  if (elWrap) {
    if (supportsPointer) {
      elWrap.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") e.preventDefault();
        handleTap(e);
      }, { passive: false });
    } else {
      elWrap.addEventListener("touchstart", (e) => {
        e.preventDefault();
        handleTap(e);
      }, { passive: false });

      elWrap.addEventListener("mousedown", (e) => {
        handleTap(e);
      });
    }
  }

  if (elUndo) {
    elUndo.addEventListener("click", () => {
      if (holes.length > 0) {
        holes.pop();
        setHint(holes.length === 0 ? "No holes left. Tap bullet holes again." : "Undid last hole.");
      } else if (bull) {
        bull = null;
        setHint("Bull cleared. Tap the bull (center) again.");
      }
      drawDots();
      setButtons();
      clearResults();
    });
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      resetSession();
      setHint("Cleared. Tap the bull (center) first, then bullet holes.");
    });
  }

  // --- Helpers for optional settings
  function getMode() {
    return (elMode && elMode.value) ? String(elMode.value) : "unknown";
  }
  function getTargetSizeLabel() {
    if (!elTargetSize) return null;
    if ("value" in elTargetSize && elTargetSize.value) return String(elTargetSize.value);
    return null;
  }
  function getDistanceYds() {
    if (!elDistanceYds) return null;
    const v = Number(elDistanceYds.value);
    return Number.isFinite(v) ? v : null;
  }
  function getClickValueLabel() {
    if (!elClickValue) return null;
    if ("value" in elClickValue && elClickValue.value) return String(elClickValue.value);
    return null;
  }

  // --- Draw overlay snapshot onto a canvas
  function drawTargetSnapshot(ctx, x, y, w, h, results) {
    if (!elImg || !elImg.complete) return;

    // draw the image
    ctx.drawImage(elImg, x, y, w, h);

    // helpers: pct -> canvas coords
    const toX = (pct) => x + (pct / 100) * w;
    const toY = (pct) => y + (pct / 100) * h;

    // bull (yellow)
    if (results.bull) {
      const bx = toX(results.bull.xPct);
      const by = toY(results.bull.yPct);
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd54a";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.stroke();
    }

    // holes (green)
    for (const hpt of results.holes) {
      const hx = toX(hpt.xPct);
      const hy = toY(hpt.yPct);
      ctx.beginPath();
      ctx.arc(hx, hy, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#2ee59d";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.stroke();
    }

    // POIB (white) + arrow POIB -> Bull
    if (results.poib && results.bull) {
      const px = toX(results.poib.xPct);
      const py = toY(results.poib.yPct);
      const bx = toX(results.bull.xPct);
      const by = toY(results.bull.yPct);

      // POIB marker
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // arrow line
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // arrow head
      const ang = Math.atan2(by - py, bx - px);
      const headLen = 18;
      const a1 = ang + Math.PI * 0.85;
      const a2 = ang - Math.PI * 0.85;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a1) * headLen, by + Math.sin(a1) * headLen);
      ctx.lineTo(bx + Math.cos(a2) * headLen, by + Math.sin(a2) * headLen);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();
    }
  }

  // --- Build SEC PNG
  async function buildSecPng(results) {
    // canvas size (good for phone/iPad share)
    const W = 1080;
    const H = 1920;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#0b0f0e";
    ctx.fillRect(0, 0, W, H);

    // header
    ctx.fillStyle = "#2ee59d"; // green accent (your current theme)
    ctx.font = "900 72px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("TAP-N-SCORE™", 70, 130);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "500 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("After-Shot Intelligence — Shooter Experience Card", 70, 182);

    // snapshot card
    const cardX = 70;
    const cardY = 240;
    const cardW = W - 140;
    const cardH = 720;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 26, true, false);

    // snapshot area
    const snapPad = 26;
    const snapX = cardX + snapPad;
    const snapY = cardY + snapPad;
    const snapW = cardW - snapPad * 2;
    const snapH = cardH - snapPad * 2;

    // draw snapshot with overlays
    drawTargetSnapshot(ctx, snapX, snapY, snapW, snapH, results);

    // results text card
    const tX = 70;
    const tY = 1000;
    const tW = W - 140;
    const tH = 820;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, tX, tY, tW, tH, 26, true, false);

    let y = tY + 70;

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "800 48px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Results", tX + 40, y);

    y += 70;
    ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const mode = results.mode || "rifle";
    const ts = results.targetSize ? ` • Target: ${results.targetSize}` : "";
    const dist = (results.distanceYds != null) ? ` • ${results.distanceYds}y` : "";
    ctx.fillText(`Mode: ${mode}${ts}${dist}`, tX + 40, y);

    y += 56;
    ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const cv = results.clickValue ? `Click: ${results.clickValue}` : "";
    const holesUsed = `Holes: ${results.holesUsed}`;
    ctx.fillText(`${holesUsed}${cv ? " • " + cv : ""}`, tX + 40, y);

    // Corrections (two decimals)
    y += 90;
    ctx.font = "800 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("Corrections", tX + 40, y);

    y += 60;
    ctx.font = "700 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText(`Windage: ${results.windText}`, tX + 40, y);

    y += 54;
    ctx.fillText(`Elevation: ${results.elevText}`, tX + 40, y);

    // Metrics
    y += 90;
    ctx.font = "800 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Metrics", tX + 40, y);

    y += 60;
    ctx.font = "650 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    if (results.poibMagIn != null) ctx.fillText(`POIB offset magnitude: ${results.poibMagIn.toFixed(2)}"`, tX + 40, y);
    y += 48;
    if (results.meanRadiusIn != null) ctx.fillText(`Mean radius (consistency): ${results.meanRadiusIn.toFixed(2)}"`, tX + 40, y);

    // Score
    y += 90;
    ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#2ee59d";
    if (results.score100 != null) ctx.fillText(`Score100: ${results.score100.toFixed(2)}`, tX + 40, y);

    y += 70;
    ctx.font = "800 48px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    if (results.smartScore != null) ctx.fillText(`SmartScore: ${results.smartScore.toFixed(2)}`, tX + 40, y);

    // Footer
    ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    const dt = new Date();
    ctx.fillText(`Generated: ${dt.toLocaleString()}`, tX + 40, tY + tH - 48);

    // to PNG
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const radius = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + w - radius.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
    ctx.lineTo(x + w, y + h - radius.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
    ctx.lineTo(x + radius.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  async function shareOrDownloadPng(blob) {
    const fileName = `Tap-n-Score_SEC_${Date.now()}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    // iPad Share Sheet if available
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Tap-n-Score — SEC",
        text: "Shooter Experience Card",
      });
      return;
    }

    // fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // --- Results + SEC Button
  function wireSecButton() {
    const btn = $("downloadSecBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      if (!lastResults) return;
      btn.disabled = true;
      btn.textContent = "Building SEC...";
      try {
        const blob = await buildSecPng(lastResults);
        await shareOrDownloadPng(blob);
      } catch (e) {
        alert("SEC export failed. Try again.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Download SEC (PNG)";
      }
    });
  }

  // You already compute inches/clicks elsewhere on your newer builds.
  // Here we compute a clean baseline from % only, and ALSO pull optional UI settings if present.
  function computeResultsBaseline() {
    const mode = getMode();

    // POIB (avg of holes)
    const sum = holes.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
    const poibX = sum.x / holes.length;
    const poibY = sum.y / holes.length;

    // Offset vector (bull - POIB) in image %
    const dxPct = (bull.xPct - poibX);
    const dyPct = (bull.yPct - poibY);

    // If target size is known (8.5x11 etc.), we can convert % to inches
    // ONLY if we can parse it safely.
    let widthIn = null;
    let heightIn = null;

    const tsLabel = getTargetSizeLabel(); // like "8.5x11" or "8.5 × 11"
    if (tsLabel) {
      const cleaned = tsLabel.replace("×", "x").replace(/\s/g, "");
      const m = cleaned.match(/^(\d+(\.\d+)?)x(\d+(\.\d+)?)$/i);
      if (m) {
        widthIn = Number(m[1]);
        heightIn = Number(m[3]);
        if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn)) {
          widthIn = null; heightIn = null;
        }
      }
    }

    // inches (if we have dimensions)
    let dxIn = null, dyIn = null, magIn = null;
    if (widthIn != null && heightIn != null) {
      dxIn = (dxPct / 100) * widthIn;
      dyIn = (dyPct / 100) * heightIn;
      magIn = Math.hypot(dxIn, dyIn);
    }

    // direction text (screen-space: +Y is DOWN)
    const windDir = (dxIn != null ? (dxIn >= 0 ? "RIGHT" : "LEFT") : (dxPct >= 0 ? "RIGHT" : "LEFT"));
    const elevDir = (dyIn != null ? (dyIn >= 0 ? "DOWN" : "UP") : (dyPct >= 0 ? "DOWN" : "UP"));

    const absDxIn = dxIn != null ? Math.abs(dxIn) : null;
    const absDyIn = dyIn != null ? Math.abs(dyIn) : null;

    // Click calc (if we know distance + click value label)
    // Safe parse: expect something like "0.25 MOA / click" or "0.25 MOA/click"
    let clickMoa = null;
    const cvLabel = getClickValueLabel();
    if (cvLabel) {
      const mm = cvLabel.match(/(\d+(\.\d+)?)/);
      if (mm) clickMoa = Number(mm[1]);
      if (!Number.isFinite(clickMoa)) clickMoa = null;
    }

    let distanceYds = getDistanceYds();
    let inchPerMoa = null;
    if (distanceYds != null) inchPerMoa = 1.047 * (distanceYds / 100);

    let windClicks = null, elevClicks = null;
    if (absDxIn != null && absDyIn != null && inchPerMoa != null && clickMoa != null && clickMoa > 0) {
      windClicks = (absDxIn / inchPerMoa) / clickMoa;
      elevClicks = (absDyIn / inchPerMoa) / clickMoa;
    }

    // Consistency (mean radius in inches if possible; else null)
    let meanRadiusIn = null;
    if (widthIn != null && heightIn != null && holes.length > 1) {
      // convert each hole to inches using target dims
      const pts = holes.map(h => ({
        x: (h.xPct / 100) * widthIn,
        y: (h.yPct / 100) * heightIn
      }));
      const poibIn = {
        x: (poibX / 100) * widthIn,
        y: (poibY / 100) * heightIn
      };
      const radii = pts.map(p => Math.hypot(p.x - poibIn.x, p.y - poibIn.y));
      meanRadiusIn = radii.reduce((a, r) => a + r, 0) / radii.length;
    }

    // Score placeholders (only shown if you already compute them elsewhere)
    // We keep them null unless you later wire your exact Score100 / SmartScore formula in this file.
    const score100 = null;
    const smartScore = null;

    // Build human-readable strings (two decimals)
    const windText = (absDxIn != null && windClicks != null)
      ? `${windDir} ${absDxIn.toFixed(2)}" → ${windClicks.toFixed(2)} clicks`
      : `${windDir} ${Math.abs(dxPct).toFixed(2)}%`;

    const elevText = (absDyIn != null && elevClicks != null)
      ? `${elevDir} ${absDyIn.toFixed(2)}" → ${elevClicks.toFixed(2)} clicks`
      : `${elevDir} ${Math.abs(dyPct).toFixed(2)}%`;

    return {
      mode,
      targetSize: tsLabel,
      distanceYds,
      clickValue: cvLabel,

      bull: { ...bull },
      holes: holes.map(h => ({ ...h })),
      holesUsed: holes.length,

      poib: { xPct: poibX, yPct: poibY },
      dxPct,
      dyPct,

      dxIn,
      dyIn,
      poibMagIn: magIn,
      meanRadiusIn,

      windText,
      elevText,

      score100,
      smartScore,
    };
  }

  if (elSee) {
    elSee.addEventListener("click", () => {
      if (!selectedFile || !bull || holes.length === 0) return;

      lastResults = computeResultsBaseline();

      if (!elResults) return;

      elResults.style.display = "block";
      elResults.innerHTML = `
        <div style="font-weight:900; font-size:16px; margin-bottom:8px;">Tap-n-Score Results</div>

        <div><b>Mode:</b> ${lastResults.mode}</div>
        ${lastResults.targetSize ? `<div><b>Target size:</b> ${lastResults.targetSize}</div>` : ``}
        ${lastResults.distanceYds != null ? `<div><b>Distance:</b> ${lastResults.distanceYds} yards</div>` : ``}
        ${lastResults.clickValue ? `<div><b>Click value:</b> ${lastResults.clickValue}</div>` : ``}

        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.08); margin:12px 0;" />

        <div><b>Holes tapped:</b> ${holes.length}</div>
        <div><b>Holes used:</b> ${holes.length}</div>

        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.08); margin:12px 0;" />

        <div style="font-weight:800; margin-bottom:6px;">Corrections</div>
        <div>Windage: <b>${lastResults.windText}</b></div>
        <div>Elevation: <b>${lastResults.elevText}</b></div>

        ${lastResults.poibMagIn != null ? `<div style="margin-top:10px;"><b>POIB offset magnitude:</b> ${lastResults.poibMagIn.toFixed(2)}"</div>` : ``}
        ${lastResults.meanRadiusIn != null ? `<div><b>Mean radius (consistency):</b> ${lastResults.meanRadiusIn.toFixed(2)}"</div>` : ``}

        <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
          <button id="downloadSecBtn" class="btnPrimary" type="button">Download SEC (PNG)</button>
        </div>

        <div style="margin-top:10px; color:#b9b9b9;">
          Next: Shoot a 5-shot group, tap, and confirm the new zero.
        </div>
      `;

      wireSecButton();
    });
  }

  // init
  setButtons();
  setHint("Choose a target photo to begin.");
})();
