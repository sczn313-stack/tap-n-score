/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-iPHONE-LOCK-1
   - NO Start button
   - Photo loads -> image shows -> tapping works
   - ControlsBar (Clear/Undo/Results) ONLY appears after first tap
   - iPhone-friendly SEC modal classes (uses CSS)
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

  let controlsArmed = false; // becomes true after first tap

  // Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

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

    // Buttons enablement (only matters once controls are visible)
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

  // Direction + arrows for SEC display
  // dx/dy are POIB -> Anchor (bull - poib). screen-space: down is +
  function computeDirections(anchorPt, poibPt) {
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y;

    const windDir = dx >= 0 ? "R" : "L";
    const elevDir = dy >= 0 ? "D" : "U";

    const windArrow = dx >= 0 ? "→" : "←";
    const elevArrow = dy >= 0 ? "↓" : "↑";

    return { windDir, elevDir, windArrow, elevArrow };
  }

  // NOTE: This demo modal uses placeholder click numbers unless your backend is already feeding real clicks.
  // If you already have real click values in your current build, plug them into windClicks / elevClicks below.
  function showSECModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    // Placeholder numbers: replace these with your real computed click outputs if already available
    // (If your backend returns clicks, put them here.)
    const windClicks = 33.68;
    const elevClicks = 35.33;

    const dirs = computeDirections(anchor, poib);

    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    const card = document.createElement("div");
    card.className = "secCard";

    const title = document.createElement("div");
    title.className = "secTitle";
    title.textContent = "SHOOTER EXPERIENCE CARD";

    const shots = document.createElement("div");
    shots.className = "secMeta";
    shots.textContent = `Shots: ${hits.length}`;

    // Windage row
    const windRow = document.createElement("div");
    windRow.className = "secRow";

    const windLabel = document.createElement("div");
    windLabel.className = "secLabel";
    windLabel.textContent = "Windage Clicks";

    const windValWrap = document.createElement("div");
    windValWrap.className = "secValueWrap";

    const windArrow = document.createElement("div");
    windArrow.className = "secArrow";
    windArrow.textContent = dirs.windArrow;

    const windValue = document.createElement("div");
    windValue.className = "secValue";
    windValue.textContent = windClicks.toFixed(2);

    const windMini = document.createElement("div");
    windMini.className = "secDirMini";
    windMini.textContent = dirs.windDir;

    windValWrap.appendChild(windArrow);
    windValWrap.appendChild(windValue);
    windValWrap.appendChild(windMini);

    windRow.appendChild(windLabel);
    windRow.appendChild(windValWrap);

    // Elev row
    const elevRow = document.createElement("div");
    elevRow.className = "secRow";

    const elevLabel = document.createElement("div");
    elevLabel.className = "secLabel";
    elevLabel.textContent = "Elevation Clicks";

    const elevValWrap = document.createElement("div");
    elevValWrap.className = "secValueWrap";

    const elevArrow = document.createElement("div");
    elevArrow.className = "secArrow";
    elevArrow.textContent = dirs.elevArrow;

    const elevValue = document.createElement("div");
    elevValue.className = "secValue";
    elevValue.textContent = elevClicks.toFixed(2);

    const elevMini = document.createElement("div");
    elevMini.className = "secDirMini";
    elevMini.textContent = dirs.elevDir;

    elevValWrap.appendChild(elevArrow);
    elevValWrap.appendChild(elevValue);
    elevValWrap.appendChild(elevMini);

    elevRow.appendChild(elevLabel);
    elevRow.appendChild(elevValWrap);

    // Actions (two buttons)
    const actions = document.createElement("div");
    actions.className = "secActions";

    const btnBuy = document.createElement("button");
    btnBuy.className = "secBtn";
    btnBuy.type = "button";
    btnBuy.textContent = "Buy more targets";
    btnBuy.addEventListener("click", () => {
      // TODO: set Baker link here when ready
      // window.location.href = "https://...";
      overlay.remove();
    });

    const btnSurvey = document.createElement("button");
    btnSurvey.className = "secBtn";
    btnSurvey.type = "button";
    btnSurvey.textContent = "Survey";
    btnSurvey.addEventListener("click", () => {
      // TODO: set survey link here when ready
      // window.location.href = "https://...";
      overlay.remove();
    });

    actions.appendChild(btnBuy);
    actions.appendChild(btnSurvey);

    const close = document.createElement("button");
    close.className = "secClose";
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => overlay.remove());

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    card.appendChild(title);
    card.appendChild(shots);
    card.appendChild(windRow);
    card.appendChild(elevRow);
    card.appendChild(actions);
    card.appendChild(close);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function hideControlsUntilFirstTap() {
    controlsArmed = false;
    elControls.classList.remove("show");
  }

  function showControlsAfterFirstTap() {
    if (controlsArmed) return;
    controlsArmed = true;
    elControls.classList.add("show");
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

    // reset
    anchor = null;
    hits = [];
    redrawAll();

    // show image immediately
    elImgBox.classList.remove("hidden");

    // IMPORTANT: controls stay hidden until first tap
    hideControlsUntilFirstTap();

    setInstruction("Tap bull’s-eye (anchor)");

    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Tap handling
  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return; // only after photo chosen
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    // first tap => show control buttons
    showControlsAfterFirstTap();

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
    // controls stay visible after first tap (by design)
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

  // Initial
  setHUD();
  hideControlsUntilFirstTap();
  redrawAll();
})();
