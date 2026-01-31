/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-LOCK-1

   Changes:
   - Thumbnail disappears when target shows
   - SEC modal:
       * Title "Shooter Experience Card" (RWB styling in CSS)
       * Click rows smaller
       * Directions: arrows + single-letter (R/L/U/D)
       * Score bands 0-60 / 61-79 / 80-100
       * Numbers only are colored (no color words displayed)
       * Hide MOA + Distance in SEC
   - Recenter after rotation IF pinched (visualViewport.scale !== 1)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");
  const elFileName = $("fileName");

  const elThumbField = $("thumbField");
  const elThumbBox = $("thumbBox");
  const elWhatNext = $("whatNext");

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

  // Vector from POIB -> Anchor (bull - poib)
  function correctionVector(anchorPt, poibPt) {
    const dx = anchorPt.x - poibPt.x; // + means move right
    const dy = anchorPt.y - poibPt.y; // + means move down (screen truth)
    return { dx, dy };
  }

  function dirForDx(dx) {
    if (dx >= 0) return { letter: "R", arrow: "→" };
    return { letter: "L", arrow: "←" };
  }

  function dirForDy(dy) {
    // screen truth: down is +, up is -
    if (dy >= 0) return { letter: "D", arrow: "↓" };
    return { letter: "U", arrow: "↑" };
  }

  // ------------------------------------------------------------
  // CLICK MATH NOTE:
  // We do NOT show MOA/distance in SEC.
  // We still compute clicks using a simple field-scale so the UI works now.
  // Later you can swap this with your true grid calibration.
  // ------------------------------------------------------------
  const FIELD_INCHES_REF = 12.0; // placeholder scale for now

  function clicksFromDelta(deltaNorm, distYds, clickValMOA) {
    // Convert normalized delta -> inches using a constant field reference
    const inches = Math.abs(deltaNorm) * FIELD_INCHES_REF;

    // Convert inches -> MOA at distance
    const oneMOAin = (distYds / 100) * 1.047;
    const moa = oneMOAin > 0 ? (inches / oneMOAin) : 0;

    // MOA -> clicks
    const clicks = clickValMOA > 0 ? (moa / clickValMOA) : 0;
    return clicks;
  }

  // Score is a simple mapping for now (swap later if you have your real score)
  function computeScoreFromGroup(poib, anchorPt) {
    // smaller error => higher score
    const v = correctionVector(anchorPt, poib);
    const mag = Math.sqrt(v.dx*v.dx + v.dy*v.dy); // 0..~1.4
    // map to 0..100
    const s = Math.max(0, Math.min(100, Math.round(100 - (mag * 100))));
    return s;
  }

  function scoreBandClass(score) {
    // 0-60 / 61-79 / 80-100
    if (score <= 60) return "bandA";
    if (score <= 79) return "bandB";
    return "bandC";
  }

  function showSECModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const dist = Number(elDistance.value) || 100;
    const clickVal = Number(elClick.value) || 0.25;

    const v = correctionVector(anchor, poib);

    // clicks
    const windClicks = clicksFromDelta(v.dx, dist, clickVal);
    const elevClicks = clicksFromDelta(v.dy, dist, clickVal);

    const wDir = dirForDx(v.dx);
    const eDir = dirForDy(v.dy);

    const shots = hits.length;

    const score = computeScoreFromGroup(poib, anchor);
    const band = scoreBandClass(score);

    // Overlay
    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    // Card
    const card = document.createElement("div");
    card.className = "secCard";

    // Header
    const header = document.createElement("div");
    header.className = "secHeader";

    const title = document.createElement("div");
    title.className = "secTitleRWB";
    title.textContent = "SHOOTER EXPERIENCE CARD";

    const meta = document.createElement("div");
    meta.className = "secMeta";
    meta.textContent = `Shots: ${shots}`;

    header.appendChild(title);
    header.appendChild(meta);

    // Score row (numbers only colored)
    const scoreRow = document.createElement("div");
    scoreRow.className = "secScoreRow";

    const scoreLabel = document.createElement("div");
    scoreLabel.className = "secScoreLabel";
    scoreLabel.textContent = "Score";

    const scoreValue = document.createElement("div");
    scoreValue.className = `secScoreValue ${band}`;
    scoreValue.textContent = String(score);

    scoreRow.appendChild(scoreLabel);
    scoreRow.appendChild(scoreValue);

    // Click rows (small)
    function makeClickRow(labelText, arrowChar, dirLetter, valueNum) {
      const row = document.createElement("div");
      row.className = "secClickRow";

      const left = document.createElement("div");
      left.className = "secClickLabel";
      left.textContent = labelText;

      const mid = document.createElement("div");
      mid.className = "secClickMid";

      const arrow = document.createElement("div");
      arrow.className = "secArrow";
      arrow.textContent = arrowChar;

      const val = document.createElement("div");
      val.className = `secValue ${band}`; // numbers only colored
      val.textContent = valueNum.toFixed(2);

      const dir = document.createElement("div");
      dir.className = "secDir";
      dir.textContent = dirLetter;

      mid.appendChild(arrow);
      mid.appendChild(val);
      mid.appendChild(dir);

      row.appendChild(left);
      row.appendChild(mid);
      return row;
    }

    const windRow = makeClickRow("Windage", wDir.arrow, wDir.letter, windClicks);
    const elevRow = makeClickRow("Elevation", eDir.arrow, eDir.letter, elevClicks);

    // Actions row (2 equal buttons)
    const actions = document.createElement("div");
    actions.className = "secActions";

    const buyBtn = document.createElement("button");
    buyBtn.className = "secActionBtn";
    buyBtn.type = "button";
    buyBtn.textContent = "Buy more targets";
    buyBtn.addEventListener("click", () => {
      // placeholder hook - swap to Baker link when ready
      window.open("https://bakertargets.com", "_blank");
    });

    const surveyBtn = document.createElement("button");
    surveyBtn.className = "secActionBtn";
    surveyBtn.type = "button";
    surveyBtn.textContent = "Survey";
    surveyBtn.addEventListener("click", () => {
      // placeholder - swap to your survey URL
      window.open("https://example.com", "_blank");
    });

    actions.appendChild(buyBtn);
    actions.appendChild(surveyBtn);

    // Close
    const closeBtn = document.createElement("button");
    closeBtn.className = "btnResults";
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => overlay.remove());

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Build card
    card.appendChild(header);
    card.appendChild(scoreRow);
    card.appendChild(windRow);
    card.appendChild(elevRow);
    card.appendChild(actions);
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function showTargetUI() {
    elImgBox.classList.remove("hidden");
    elControls.classList.remove("hidden");

    // Hide thumbnail + “what next” once target is up
    if (elThumbField) elThumbField.classList.add("hidden");
    if (elWhatNext) elWhatNext.classList.add("hidden");

    setInstruction("Tap bull’s-eye (anchor)");
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Pinch + rotation recenter
  function recenterIfPinched() {
    const vv = window.visualViewport;
    if (!vv) return;
    if (vv.scale && vv.scale !== 1) {
      // if user pinched, keep the image area centered after rotation/resize
      if (!elImgBox.classList.contains("hidden")) {
        elImgBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  window.addEventListener("orientationchange", () => {
    setTimeout(recenterIfPinched, 350);
  });

  window.addEventListener("resize", () => {
    // iOS fires resize on rotation AND sometimes zoom
    setTimeout(recenterIfPinched, 150);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      setTimeout(recenterIfPinched, 120);
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

    // main image
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    // reset taps
    anchor = null;
    hits = [];
    redrawAll();

    showTargetUI();
  });

  // Tap handling
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
    }s
    redrawAll();
  });

  elResults.addEventListener("click", () => showSECModal());

  // Initial
  setHUD();
  redrawAll();
})();
