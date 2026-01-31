/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-1c
   Changes:
   1) SEC meta line (Distance/Click) is smaller + tighter
   2) Big numbers are color-coded by performance:
      - <= GOOD_MAX clicks  => green
      - <= OK_MAX clicks    => amber
      - >  OK_MAX clicks    => red
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

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

  function hideThumb() {
    elThumbBox.classList.add("thumbHidden");
  }

  function showThumb() {
    elThumbBox.classList.remove("thumbHidden");
  }

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
    return {
      xIn: dxNorm * PAPER_W_IN,
      yIn: dyNorm * PAPER_H_IN
    };
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

    return {
      windDir, elevDir,
      windArrow, elevArrow,
      windClicks, elevClicks,
      dist, clickVal
    };
  }

  // ===== Performance color logic =====
  // Adjust these thresholds to match your “performance” definition.
  // Right now: <=2 clicks is great, <=6 is okay, >6 is needs work.
  const GOOD_MAX = 2.0;
  const OK_MAX = 6.0;

  function perfColor(clicks) {
    const v = Number(clicks);
    if (!Number.isFinite(v)) return "rgba(255,255,255,0.94)";
    if (v <= GOOD_MAX) return "rgba(0, 235, 150, 0.96)";     // green
    if (v <= OK_MAX) return "rgba(255, 196, 0, 0.96)";      // amber
    return "rgba(255, 90, 90, 0.96)";                       // red
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
    card.style.width = "min(900px, 96vw)";
    card.style.borderRadius = "22px";
    card.style.border = "1px solid rgba(255,255,255,0.12)";
    card.style.background = "rgba(12,14,13,0.78)";
    card.style.boxShadow = "0 26px 90px rgba(0,0,0,0.70)";
    card.style.padding = "18px";
    card.style.color = "rgba(255,255,255,0.94)";

    const title = document.createElement("div");
    title.textContent = "SEC";
    title.style.fontSize = "34px";
    title.style.fontWeight = "950";
    title.style.marginBottom = "8px";

    const sub = document.createElement("div");
    sub.textContent = `Shots: ${hits.length}`;
    sub.style.fontSize = "18px";
    sub.style.fontWeight = "800";
    sub.style.opacity = "0.85";

    // Smaller + tighter meta line
    const meta = document.createElement("div");
    meta.textContent = `Distance: ${sec.dist} yd  •  Click: ${sec.clickVal} MOA`;
    meta.style.fontSize = "12px";
    meta.style.fontWeight = "900";
    meta.style.opacity = "0.62";
    meta.style.marginTop = "4px";
    meta.style.marginBottom = "10px";
    meta.style.letterSpacing = "0.25px";

    const rowWrap = document.createElement("div");
    rowWrap.style.display = "grid";
    rowWrap.style.gridTemplateColumns = "1fr";
    rowWrap.style.gap = "12px";

    function makeRow(label, arrow, valueText, dirText, valueColor) {
      const row = document.createElement("div");
      row.style.border = "1px solid rgba(255,255,255,0.12)";
      row.style.borderRadius = "18px";
      row.style.padding = "14px 14px";
      row.style.background = "rgba(0,0,0,0.22)";
      row.style.display = "grid";
      row.style.gridTemplateColumns = "140px 1fr";
      row.style.alignItems = "center";
      row.style.gap = "12px";

      const left = document.createElement("div");
      left.textContent = label;
      left.style.fontSize = "16px";
      left.style.fontWeight = "950";
      left.style.opacity = "0.9";

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "baseline";
      right.style.justifyContent = "space-between";
      right.style.gap = "12px";

      const big = document.createElement("div");
      big.textContent = `${arrow} ${valueText}`;
      big.style.fontSize = "34px";
      big.style.fontWeight = "950";
      big.style.letterSpacing = "0.2px";
      big.style.color = valueColor;                 // ✅ performance color
      big.style.textShadow = "0 10px 26px rgba(0,0,0,0.55)";

      const small = document.createElement("div");
      small.textContent = dirText;
      small.style.fontSize = "16px";
      small.style.fontWeight = "900";
      small.style.opacity = "0.78";
      small.style.whiteSpace = "nowrap";

      right.appendChild(big);
      right.appendChild(small);

      row.appendChild(left);
      row.appendChild(right);
      return row;
    }

    const windVal = sec.windClicks.toFixed(2);
    const elevVal = sec.elevClicks.toFixed(2);

    rowWrap.appendChild(
      makeRow("Windage", sec.windArrow, windVal, sec.windDir, perfColor(sec.windClicks))
    );
    rowWrap.appendChild(
      makeRow("Elevation", sec.elevArrow, elevVal, sec.elevDir, perfColor(sec.elevClicks))
    );

    const btn = document.createElement("button");
    btn.textContent = "Close";
    btn.className = "btnResults";
    btn.style.width = "100%";
    btn.style.marginTop = "14px";

    btn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(meta);
    card.appendChild(rowWrap);
    card.appendChild(btn);
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
