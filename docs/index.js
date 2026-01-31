/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-1g
   Adds:
   - SEC modal includes:
     1) Buy more targets like this (primary)
     2) Survey (primary)
     3) Download SEC (Image) (secondary, full-width)
   Includes built-in PNG generator via Canvas (no libraries)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ===== Vendor Hooks (EDIT THESE) =====
  const VENDOR_BUY_URL = "https://bakertargets.com/";
  const SURVEY_URL = "https://example.com/survey";

  // Elements
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");
  const elFileName = $("fileName");
  const elThumbBox = $("thumbBox");

  const elImgBox = $("imgBox");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");

  const elDistance = $("distanceYds");
  const elClick = $("clickValue");

  const elHUDLeft = $("instructionLine");
  const elHUDRight = $("tapCount");

  const elControls = $("controlsBar");
  const elClear = $("clearBtn");
  const elUndo = $("undoBtn");
  const elResults = $("resultsBtn");

  // State
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized
  let hits = [];     // [{x,y}...]

  // ===== Helpers =====
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setHUD() {
    elHUDRight.textContent = `Taps: ${(anchor ? 1 : 0) + hits.length} (hits: ${hits.length})`;
  }

  function setInstruction(msg) {
    elHUDLeft.textContent = msg;
  }

  function clearDots() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  function drawDot(norm, kind) {
    const dot = document.createElement("div");
    dot.className = "tapDot";

    const size = kind === "anchor" ? 18 : 16;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;

    dot.style.left = `${(norm.x * 100).toFixed(4)}%`;
    dot.style.top  = `${(norm.y * 100).toFixed(4)}%`;

    dot.style.background = (kind === "anchor")
      ? "rgba(255, 196, 0, 0.95)"
      : "rgba(0, 220, 130, 0.95)";

    elDots.appendChild(dot);
  }

  function redrawAll() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));

    setHUD();

    elClear.disabled = (!anchor && hits.length === 0);
    elUndo.disabled = (!anchor && hits.length === 0);
    elResults.disabled = (!anchor || hits.length === 0);
  }

  function setThumb(file) {
    elThumbBox.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Selected thumbnail";
    img.src = URL.createObjectURL(file);
    elThumbBox.appendChild(img);
  }

  function hideThumb() { elThumbBox.classList.add("thumbHidden"); }
  function showThumb() { elThumbBox.classList.remove("thumbHidden"); }

  function getNormFromEvent(evt) {
    const rect = elDots.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: clamp01(x), y: clamp01(y) };
  }

  function computePOIB() {
    if (hits.length === 0) return null;
    const sum = hits.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / hits.length, y: sum.y / hits.length };
  }

  // Convert normalized delta -> inches (paper-based)
  function normDeltaToInches(dxNorm, dyNorm) {
    const PAPER_W_IN = 8.5;
    const PAPER_H_IN = 11.0;
    return { xIn: dxNorm * PAPER_W_IN, yIn: dyNorm * PAPER_H_IN };
  }

  function moaAtDistanceInches(distYds) {
    return (distYds / 100) * 1.047;
  }

  function clicksFromInches(inches, oneMOAin, clickVal) {
    const inchesPerClick = oneMOAin * clickVal;
    if (!Number.isFinite(inchesPerClick) || inchesPerClick <= 0) return 0;
    return inches / inchesPerClick;
  }

  function computeTurretInstructions(anchorPt, poibPt) {
    // POIB -> Anchor (bull - poib)
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y; // screen truth: +dy means DOWN

    const inch = normDeltaToInches(dx, dy);

    const dist = Number(elDistance.value) || 100;
    const clickVal = Number(elClick.value) || 0.25;
    const oneMOAin = moaAtDistanceInches(dist);

    const windClicks = Math.abs(clicksFromInches(inch.xIn, oneMOAin, clickVal));
    const elevClicks = Math.abs(clicksFromInches(inch.yIn, oneMOAin, clickVal));

    const windDir = dx >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dy >= 0 ? "DOWN" : "UP";

    const windArrow = dx >= 0 ? "→" : "←";
    const elevArrow = dy >= 0 ? "↓" : "↑";

    return { windDir, elevDir, windArrow, elevArrow, windClicks, elevClicks, dist, clickVal };
  }

  // ===== Performance color logic (LOCKED: 3 / 6) =====
  const GREEN_MAX = 3.0;
  const YELLOW_MAX = 6.0;

  function perfColor(clicks) {
    const v = Number(clicks);
    if (!Number.isFinite(v)) return "rgba(255,255,255,0.94)";
    if (v <= GREEN_MAX)  return "rgba(0, 235, 150, 0.96)"; // green
    if (v <= YELLOW_MAX) return "rgba(255, 196, 0, 0.96)"; // yellow
    return "rgba(255, 90, 90, 0.96)";                      // red
  }

  function openUrl(url) {
    if (!url) return;
    try {
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) window.location.href = url;
    } catch {
      window.location.href = url;
    }
  }

  // ===== Download SEC as PNG (no libraries) =====
  function downloadSECPng(sec, shotCount) {
    // Canvas size: phone-friendly, crisp
    const W = 1200;
    const H = 700;

    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    // Background
    ctx.fillStyle = "rgba(10,12,11,1)";
    ctx.fillRect(0, 0, W, H);

    // Soft border card
    const pad = 40;
    const r = 32;
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, r);
    ctx.fillStyle = "rgba(18, 24, 22, 0.95)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();

    // Top label: SHOOTER EXPERIENCE CARD (R/W/B)
    ctx.font = "900 42px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "top";
    let x = pad + 36;
    let y = pad + 28;

    x = drawPill(ctx, x, y, "SHOOTER", "rgba(255, 90, 90, 0.96)");
    x += 16;
    x = drawPill(ctx, x, y, "EXPERIENCE", "rgba(255,255,255,0.96)");
    x += 16;
    drawPill(ctx, x, y, "CARD", "rgba(120, 170, 255, 0.96)");

    // Title SEC
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "1000 86px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SEC", pad + 36, y + 92);

    // Meta
    ctx.font = "800 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText(`Shots: ${shotCount}`, pad + 36, y + 192);

    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText(`Distance: ${sec.dist} yd   •   Click: ${sec.clickVal} MOA`, pad + 36, y + 232);

    // Two rows (Windage / Elevation)
    const boxW = (W - pad * 2) - 72;
    const rowH = 170;
    const rowY1 = y + 290;
    const rowY2 = rowY1 + rowH + 24;

    drawRow(ctx, pad + 36, rowY1, boxW, rowH, "Windage", sec.windArrow, sec.windClicks.toFixed(2), sec.windDir, perfColor(sec.windClicks));
    drawRow(ctx, pad + 36, rowY2, boxW, rowH, "Elevation", sec.elevArrow, sec.elevClicks.toFixed(2), sec.elevDir, perfColor(sec.elevClicks));

    // Export
    const a = document.createElement("a");
    a.download = `SEC_${sec.dist}yd_${shotCount}shots.png`;
    a.href = c.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPill(ctx, x, y, text, color) {
    const padX = 18;
    const padY = 10;

    ctx.font = "1000 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const m = ctx.measureText(text);
    const w = m.width + padX * 2;
    const h = 58;

    roundRect(ctx, x, y, w, h, 999);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(text, x + padX, y + padY - 2);
    return x + w;
  }

  function drawRow(ctx, x, y, w, h, label, arrow, num, dir, color) {
    roundRect(ctx, x, y, w, h, 28);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    ctx.textBaseline = "middle";

    // Label
    ctx.font = "950 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText(label, x + 28, y + h / 2);

    // Right side big number
    const rightX = x + w - 28;

    ctx.font = "1000 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const arrowW = ctx.measureText(arrow).width;

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(arrow, rightX - 420, y + h / 2);

    ctx.fillStyle = color;
    ctx.font = "1000 84px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(num, rightX - 360, y + h / 2 + 2);

    // Dir small + close
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "950 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(dir, rightX - 120, y + h / 2 + 6);
  }

  function showSECModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const sec = computeTurretInstructions(anchor, poib);

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "999999";
    overlay.style.background = "rgba(0,0,0,0.60)";
    overlay.style.backdropFilter = "blur(10px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "18px";

    const card = document.createElement("div");
    card.className = "secCard";
    card.style.color = "rgba(255,255,255,0.94)";

    // Top label
    const topLabel = document.createElement("div");
    topLabel.className = "secTopLabel";
    topLabel.innerHTML = `
      <span class="secTri red">SHOOTER</span>
      <span class="secTri white">EXPERIENCE</span>
      <span class="secTri blue">CARD</span>
    `;

    const title = document.createElement("div");
    title.textContent = "SEC";
    title.className = "secTitle";

    const sub = document.createElement("div");
    sub.textContent = `Shots: ${hits.length}`;
    sub.className = "secSub";

    const meta = document.createElement("div");
    meta.textContent = `Distance: ${sec.dist} yd  •  Click: ${sec.clickVal} MOA`;
    meta.className = "secMeta";

    const rowWrap = document.createElement("div");
    rowWrap.className = "secRows";

    function makeRow(label, arrow, valueText, dirText, valueColor) {
      const row = document.createElement("div");
      row.className = "secRow";

      const left = document.createElement("div");
      left.textContent = label;
      left.className = "secRowLabel";

      const right = document.createElement("div");
      right.className = "secRowRight";

      const big = document.createElement("div");
      big.className = "secBig";
      big.style.color = valueColor;

      big.innerHTML = `
        <span class="secArrow">${arrow}</span>
        <span class="secNum">${valueText}</span>
        <span class="secDirInline">${dirText}</span>
      `;

      right.appendChild(big);
      row.appendChild(left);
      row.appendChild(right);
      return row;
    }

    const windVal = sec.windClicks.toFixed(2);
    const elevVal = sec.elevClicks.toFixed(2);

    rowWrap.appendChild(makeRow("Windage", sec.windArrow, windVal, sec.windDir, perfColor(sec.windClicks)));
    rowWrap.appendChild(makeRow("Elevation", sec.elevArrow, elevVal, sec.elevDir, perfColor(sec.elevClicks)));

    // Actions (two equal buttons)
    const actions = document.createElement("div");
    actions.className = "secActions";

    const btnBuy = document.createElement("button");
    btnBuy.type = "button";
    btnBuy.className = "secActionBtn";
    btnBuy.textContent = "Buy more targets like this";
    btnBuy.addEventListener("click", () => openUrl(VENDOR_BUY_URL));

    const btnSurvey = document.createElement("button");
    btnSurvey.type = "button";
    btnSurvey.className = "secActionBtn";
    btnSurvey.textContent = "Survey";
    btnSurvey.addEventListener("click", () => openUrl(SURVEY_URL));

    actions.appendChild(btnBuy);
    actions.appendChild(btnSurvey);

    // NEW: Download SEC image (secondary, full width)
    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "secActionBtn secActionBtnSecondary";
    dl.textContent = "Download SEC (Image)";
    dl.addEventListener("click", () => downloadSECPng(sec, hits.length));

    const btnClose = document.createElement("button");
    btnClose.textContent = "Close";
    btnClose.className = "btnResults";
    btnClose.style.width = "100%";
    btnClose.style.marginTop = "12px";

    btnClose.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    card.appendChild(topLabel);
    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(meta);
    card.appendChild(rowWrap);
    card.appendChild(actions);
    card.appendChild(dl);
    card.appendChild(btnClose);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ===== Events =====
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    setThumb(f);
    showThumb();

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    anchor = null;
    hits = [];
    redrawAll();

    elImgBox.classList.remove("hidden");
    elControls.classList.remove("hidden");
    hideThumb();

    setInstruction("Tap bull’s-eye (anchor)");
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    if (!anchor) {
      anchor = norm;
      setInstruction("Now tap each confirmed hit");
    } else {
      hits.push(norm);
    }
    redrawAll();
  }, { passive: false });

  elClear.addEventListener("click", () => {
    anchor = null;
    hits = [];
    setInstruction("Tap bull’s-eye (anchor)");
    redrawAll();
  });

  elUndo.addEventListener("click", () => {
    if (hits.length > 0) {
      hits.pop();
    } else if (anchor) {
      anchor = null;
      setInstruction("Tap bull’s-eye (anchor)");
    }
    redrawAll();
  });

  elResults.addEventListener("click", () => showSECModal());

  setHUD();
  redrawAll();
})();
