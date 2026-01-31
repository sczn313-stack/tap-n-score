/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-CENTERPIECE-1
   SEC focus:
   - SEC title = "Shooter’s Score"
   - Score box is the centerpiece (bigger number)
   - Shots + windage/elevation moved into smaller secondary panel
   - Directions shown with arrows + 1-letter (L/R/U/D)
   - Distance/MOA hidden on SEC
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

  const elDistance = $("distanceYds"); // kept for computation elsewhere if you re-enable later
  const elClick = $("clickValue");     // kept for computation elsewhere if you re-enable later

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

  // Helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setHUD() {
    elHUDRight.textContent = `Taps: ${(anchor ? 1 : 0) + hits.length} (hits: ${hits.length})`;
  }

  function setInstruction(msg) { elHUDLeft.textContent = msg; }

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

    // Buttons
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

  // Signed deltas in screen space (right +, down +)
  // Correction vector should move POIB -> Anchor (anchor - poib)
  function getCorrectionDeltas(anchorPt, poibPt) {
    return {
      dx: anchorPt.x - poibPt.x,  // + means move RIGHT
      dy: anchorPt.y - poibPt.y   // + means move DOWN (screen truth)
    };
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  // Map score to color class:
  // 0–60 red, 61–79 yellow, 80–100 green
  function scoreClass(score0to100) {
    const s = Number(score0to100) || 0;
    if (s <= 60) return "scoreRed";
    if (s <= 79) return "scoreYellow";
    return "scoreGreen";
  }

  // Placeholder scoring (keep your real scoring if you already have it elsewhere)
  // Right now: just a simple inverse of average distance from anchor in normalized units.
  // If you already compute score elsewhere, replace computeScore() with your value.
  function computeScore(anchorPt, hitsArr) {
    if (!anchorPt || hitsArr.length === 0) return 0;
    const avgDist = hitsArr.reduce((acc, p) => {
      const dx = p.x - anchorPt.x;
      const dy = p.y - anchorPt.y;
      return acc + Math.sqrt(dx*dx + dy*dy);
    }, 0) / hitsArr.length;

    // Normalize: 0.0 => 100, 0.5-ish => lower
    let score = Math.round(100 - (avgDist * 220)); // tuned feel
    score = Math.max(0, Math.min(100, score));
    return score;
  }

  function secDirection(dx, dy) {
    // dx: + = RIGHT, - = LEFT
    // dy: + = DOWN,  - = UP
    const wind = dx >= 0 ? { arrow: "→", letter: "R" } : { arrow: "←", letter: "L" };
    const elev = dy >= 0 ? { arrow: "↓", letter: "D" } : { arrow: "↑", letter: "U" };
    return { wind, elev };
  }

  // Convert normalized deltas to "clicks"
  // NOTE: This uses a normalized scale factor as a stand-in (because grid calibration is separate).
  // If you already have true inch conversion via grid, replace NORM_TO_CLICKS below.
  function deltasToClicks(dx, dy) {
    const clickVal = Number(elClick?.value) || 0.25;

    // "Calibration" placeholder: 1.0 normalized ~= 60 clicks at 1/4 MOA (tuned for UI demo)
    // Replace this with your true: inches -> MOA -> clicks pipeline when locked.
    const NORM_TO_MOA = 15; // 1.0 norm -> 15 MOA (placeholder)
    const windClicks = (Math.abs(dx) * NORM_TO_MOA) / clickVal;
    const elevClicks = (Math.abs(dy) * NORM_TO_MOA) / clickVal;

    return { windClicks, elevClicks };
  }

  function showSEC() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const { dx, dy } = getCorrectionDeltas(anchor, poib);
    const dirs = secDirection(dx, dy);
    const { windClicks, elevClicks } = deltasToClicks(dx, dy);

    const score = computeScore(anchor, hits);
    const sClass = scoreClass(score);

    // Overlay
    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    // Card
    const card = document.createElement("div");
    card.className = "secCard";

    // Header (R/W/B title text)
    const header = document.createElement("div");
    header.className = "secHeader";

    const title = document.createElement("div");
    title.className = "secTitle";
    title.innerHTML =
      `<span class="tRed">SHOOTER</span> <span class="tWhite">SCORE</span>`;

    header.appendChild(title);

    // MAIN centerpiece: Score row
    const main = document.createElement("div");
    main.className = "secMain";

    const scoreRow = document.createElement("div");
    scoreRow.className = "secRow secScoreRow";

    const scoreLabel = document.createElement("div");
    scoreLabel.className = "secLabel";
    scoreLabel.textContent = "Score";

    const scoreVal = document.createElement("div");
    scoreVal.className = `secBigValue ${sClass}`;
    scoreVal.textContent = String(score);

    scoreRow.appendChild(scoreLabel);
    scoreRow.appendChild(scoreVal);

    main.appendChild(scoreRow);

    // Secondary panel: Shots + wind/elev compact
    const sub = document.createElement("div");
    sub.className = "secSub";

    const shotsLine = document.createElement("div");
    shotsLine.className = "secShots";
    shotsLine.innerHTML = `<span class="secShotsLabel">Shots:</span> <span class="secShotsVal">${hits.length}</span>`;
    sub.appendChild(shotsLine);

    const grid = document.createElement("div");
    grid.className = "secMiniGrid";

    const windRow = document.createElement("div");
    windRow.className = "secRow secMiniRow";
    windRow.innerHTML = `
      <div class="secLabel">Windage Clicks</div>
      <div class="secMiniValue">
        <span class="secArrow">${dirs.wind.arrow}</span>
        <span class="secNum">${fmt2(windClicks)}</span>
        <span class="secDir">${dirs.wind.letter}</span>
      </div>
    `;

    const elevRow = document.createElement("div");
    elevRow.className = "secRow secMiniRow";
    elevRow.innerHTML = `
      <div class="secLabel">Elevation Clicks</div>
      <div class="secMiniValue">
        <span class="secArrow">${dirs.elev.arrow}</span>
        <span class="secNum">${fmt2(elevClicks)}</span>
        <span class="secDir">${dirs.elev.letter}</span>
      </div>
    `;

    grid.appendChild(windRow);
    grid.appendChild(elevRow);
    sub.appendChild(grid);

    // Actions row (2 buttons)
    const actions = document.createElement("div");
    actions.className = "secActions";

    const btnBuy = document.createElement("button");
    btnBuy.className = "secActionBtn";
    btnBuy.type = "button";
    btnBuy.textContent = "Buy more targets";
    btnBuy.addEventListener("click", () => {
      // TODO: replace with Baker link
      window.open("https://bakertargets.com", "_blank");
    });

    const btnSurvey = document.createElement("button");
    btnSurvey.className = "secActionBtn";
    btnSurvey.type = "button";
    btnSurvey.textContent = "Survey";
    btnSurvey.addEventListener("click", () => {
      // TODO: replace with your survey link
      window.open("https://example.com", "_blank");
    });

    actions.appendChild(btnBuy);
    actions.appendChild(btnSurvey);

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "secCloseBtn";
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => overlay.remove());

    // Assemble
    card.appendChild(header);
    card.appendChild(main);
    card.appendChild(sub);
    card.appendChild(actions);
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Click outside closes
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Events
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    setThumb(f);

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    anchor = null;
    hits = [];
    redrawAll();

    elImgBox.classList.remove("hidden");
    elControls.classList.remove("hidden");
    setInstruction("Tap bull’s-eye (anchor)");

    // Hide thumbnail section once target is up (CSS also supports it, but do it here too)
    document.body.classList.add("targetLive");

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

  elResults.addEventListener("click", () => showSEC());

  setHUD();
  redrawAll();
})();
