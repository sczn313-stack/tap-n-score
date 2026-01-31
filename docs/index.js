/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-LOCK-3
   - No banner
   - Hide thumbnail + "what next" once target shows
   - SEC: score number ONLY gets red/yellow/green
   - Wind/Elev numbers white, arrow tight to number, tiny dir letter
   - Recenter after rotation IF pinched (iOS visualViewport scale)
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

  // Hidden inputs (kept for later if you want)
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

  // Vendor hooks
  const VENDOR_BUY_URL = "https://bakertargets.com";
  const SURVEY_URL = "https://example.com"; // swap when ready

  // Placeholder scale until grid calibration is wired
  const FIELD_INCHES_REF = 12.0;

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

    elClear.disabled = (!anchor && hits.length === 0);
    elUndo.disabled = (!anchor && hits.length === 0);
    elResults.disabled = (!anchor || hits.length === 0);
  }

  function setThumb(file) {
    if (!elThumbBox) return;
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
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y; // screen truth: down is +
    return { dx, dy };
  }

  function dirForDx(dx) {
    return dx >= 0 ? { letter: "R", arrow: "→" } : { letter: "L", arrow: "←" };
  }
  function dirForDy(dy) {
    return dy >= 0 ? { letter: "D", arrow: "↓" } : { letter: "U", arrow: "↑" };
  }

  function clicksFromDelta(deltaNorm, distYds, clickValMOA) {
    const inches = Math.abs(deltaNorm) * FIELD_INCHES_REF;
    const oneMOAin = (distYds / 100) * 1.047;
    const moa = oneMOAin > 0 ? (inches / oneMOAin) : 0;
    const clicks = clickValMOA > 0 ? (moa / clickValMOA) : 0;
    return clicks;
  }

  // Placeholder score (swap later to your real scoring logic)
  function computeScoreFromGroup(poib, anchorPt) {
    const v = correctionVector(anchorPt, poib);
    const mag = Math.sqrt(v.dx*v.dx + v.dy*v.dy);
    const s = Math.max(0, Math.min(100, Math.round(100 - (mag * 100))));
    return s;
  }

  // Score band: 0–60 A, 61–79 B, 80–100 C
  function scoreBandClass(score) {
    if (score <= 60) return "bandA";
    if (score <= 79) return "bandB";
    return "bandC";
  }

  function showSECModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const dist = Number(elDistance?.value) || 100;
    const clickVal = Number(elClick?.value) || 0.25;

    const v = correctionVector(anchor, poib);

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

    const card = document.createElement("div");
    card.className = "secCard";

    // Title line
    const title = document.createElement("div");
    title.className = "secTitleRWB";
    title.textContent = "SHOOTER EXPERIENCE CARD";

    const meta = document.createElement("div");
    meta.className = "secMeta";
    meta.textContent = `Shots: ${shots}`;

    // Row builder (tight right cluster)
    function makeRow(labelText, arrowTxt, valueTxt, dirLetter, valueClass) {
      const row = document.createElement("div");
      row.className = "secRow";

      const left = document.createElement("div");
      left.className = "secRowLabel";
      left.textContent = labelText;

      const right = document.createElement("div");
      right.className = "secRowRight";

      const arrow = document.createElement("div");
      arrow.className = "secArrow";
      arrow.textContent = arrowTxt;

      const val = document.createElement("div");
      val.className = `secBigNumber ${valueClass || ""}`.trim();
      val.textContent = valueTxt;

      const dir = document.createElement("div");
      dir.className = "secDirTiny";
      dir.textContent = dirLetter;

      right.appendChild(arrow);
      right.appendChild(val);
      right.appendChild(dir);

      row.appendChild(left);
      row.appendChild(right);
      return row;
    }

    // SCORE row: number ONLY colored (band class applied ONLY here)
    const scoreRow = makeRow("Score", "", String(score), "", band);
    scoreRow.querySelector(".secArrow").textContent = "";
    scoreRow.querySelector(".secDirTiny").textContent = "";
    scoreRow.querySelector(".secRowRight").classList.add("scoreRight");

    // Wind/Elev: numbers stay white (no band class)
    const windRow = makeRow("Windage", wDir.arrow, windClicks.toFixed(2), wDir.letter, "");
    const elevRow = makeRow("Elevation", eDir.arrow, elevClicks.toFixed(2), eDir.letter, "");

    // Actions
    const actions = document.createElement("div");
    actions.className = "secActions";

    const buyBtn = document.createElement("button");
    buyBtn.className = "secActionBtn secActionBtnGreen";
    buyBtn.type = "button";
    buyBtn.textContent = "Buy more targets";
    buyBtn.addEventListener("click", () => window.open(VENDOR_BUY_URL, "_blank"));

    const surveyBtn = document.createElement("button");
    surveyBtn.className = "secActionBtn secActionBtnGreen";
    surveyBtn.type = "button";
    surveyBtn.textContent = "Survey";
    surveyBtn.addEventListener("click", () => window.open(SURVEY_URL, "_blank"));

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

    card.appendChild(title);
    card.appendChild(meta);
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

    if (elThumbField) elThumbField.classList.add("hidden");
    if (elWhatNext) elWhatNext.classList.add("hidden");

    setInstruction("Tap bull’s-eye (anchor)");
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Recenter after rotation IF pinched
  function recenterIfPinched() {
    const vv = window.visualViewport;
    if (!vv) return;
    if (vv.scale && vv.scale !== 1) {
      if (!elImgBox.classList.contains("hidden")) {
        elImgBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  window.addEventListener("orientationchange", () => setTimeout(recenterIfPinched, 350));
  window.addEventListener("resize", () => setTimeout(recenterIfPinched, 150));
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => setTimeout(recenterIfPinched, 120));
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

    showTargetUI();
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

  // Initial
  setHUD();
  redrawAll();
})();
