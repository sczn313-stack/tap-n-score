/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-LOCK-1
   - SEC title: "SHOOTER EXPERIENCE CARD" (R/W/B via CSS spans)
   - Labels: "Windage Clicks" + "Elevation Clicks"
   - Direction: arrow + single-letter (L/R/U/D) near number
   - Shows 0.00 when extremely tiny values
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

  // Direction for turret move (POIB -> Anchor)
  function direction(anchorPt, poibPt) {
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y; // screen: down is +

    const horiz = dx >= 0 ? "R" : "L";
    const vert  = dy >= 0 ? "D" : "U";

    return { dx, dy, horiz, vert };
  }

  // NOTE:
  // This pilot version outputs "clicks" as a derived magnitude from image-space %
  // You already know your real pipeline converts to inches via grid. For now we keep the UI clean:
  // clicks = (abs(delta) * 100) just to drive layout, then formatted to 2 decimals.
  function toDisplayNumber(n) {
    // show "0.00" if extremely tiny
    if (!Number.isFinite(n) || Math.abs(n) < 0.0005) return "0.00";
    return n.toFixed(2);
  }

  function scoreColorClass(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return "scoreRed";
    if (s <= 60) return "scoreRed";
    if (s <= 79) return "scoreYellow";
    return "scoreGreen";
  }

  function showSECModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    // Placeholder “score” for now: based on tightness (demo)
    // Replace later with your real scoring. Keeps 0–100.
    const dx = poib.x - anchor.x;
    const dy = poib.y - anchor.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const score = Math.max(0, Math.min(100, Math.round(100 - dist * 160)));

    const d = direction(anchor, poib);

    // “Clicks” placeholder driven by image-space magnitude (for UI only)
    const windClicks = Math.abs(d.dx) * 100;
    const elevClicks = Math.abs(d.dy) * 100;

    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    const card = document.createElement("div");
    card.className = "secCard";

    // Title (R/W/B)
    const title = document.createElement("div");
    title.className = "secTitle";
    title.innerHTML =
      `<span class="tRed">SHOOTER</span> ` +
      `<span class="tWhite">EXPERIENCE</span> ` +
      `<span class="tBlue">CARD</span>`;

    const shots = document.createElement("div");
    shots.className = "secShots";
    shots.textContent = `Shots: ${hits.length}`;

    // Rows
    const rows = document.createElement("div");
    rows.className = "secRows";

    // Score row (ONLY NUMBER on right)
    const rScore = document.createElement("div");
    rScore.className = "secRow";

    const lScore = document.createElement("div");
    lScore.className = "secLabel";
    lScore.textContent = "Score";

    const vScore = document.createElement("div");
    vScore.className = `secScoreNum ${scoreColorClass(score)}`;
    vScore.textContent = String(score);

    rScore.appendChild(lScore);
    rScore.appendChild(vScore);

    // Windage Clicks row
    const rW = document.createElement("div");
    rW.className = "secRow";

    const lW = document.createElement("div");
    lW.className = "secLabel";
    lW.textContent = "Windage Clicks";

    const vW = document.createElement("div");
    vW.className = "secValueBox";
    vW.innerHTML =
      `<span class="secArrow">${d.horiz === "L" ? "←" : "→"}</span>` +
      `<span class="secNum">${toDisplayNumber(windClicks)}</span>` +
      `<span class="secDir">${d.horiz}</span>`;

    rW.appendChild(lW);
    rW.appendChild(vW);

    // Elevation Clicks row
    const rE = document.createElement("div");
    rE.className = "secRow";

    const lE = document.createElement("div");
    lE.className = "secLabel";
    lE.textContent = "Elevation Clicks";

    const vE = document.createElement("div");
    vE.className = "secValueBox";
    vE.innerHTML =
      `<span class="secArrow">${d.vert === "U" ? "↑" : "↓"}</span>` +
      `<span class="secNum">${toDisplayNumber(elevClicks)}</span>` +
      `<span class="secDir">${d.vert}</span>`;

    rE.appendChild(lE);
    rE.appendChild(vE);

    rows.appendChild(rScore);
    rows.appendChild(rW);
    rows.appendChild(rE);

    // CTA Row (two buttons)
    const ctas = document.createElement("div");
    ctas.className = "secCTAs";

    const btnBuy = document.createElement("button");
    btnBuy.className = "secActionBtn";
    btnBuy.type = "button";
    btnBuy.textContent = "Buy more targets";
    btnBuy.addEventListener("click", () => {
      // TODO: replace with Baker URL
      window.open("https://bakertargets.com", "_blank", "noopener,noreferrer");
    });

    const btnSurvey = document.createElement("button");
    btnSurvey.className = "secActionBtn";
    btnSurvey.type = "button";
    btnSurvey.textContent = "Survey";
    btnSurvey.addEventListener("click", () => {
      // TODO: replace with your survey URL
      window.open("https://example.com/survey", "_blank", "noopener,noreferrer");
    });

    ctas.appendChild(btnBuy);
    ctas.appendChild(btnSurvey);

    // Close
    const close = document.createElement("button");
    close.className = "secCloseBtn";
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => overlay.remove());

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    card.appendChild(title);
    card.appendChild(shots);
    card.appendChild(rows);
    card.appendChild(ctas);
    card.appendChild(close);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
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

    // show image & controls immediately (NO Start)
    elImgBox.classList.remove("hidden");
    elControls.classList.remove("hidden");
    setInstruction("Tap bull’s-eye (anchor)");

    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
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
    }
    redrawAll();
  });

  elResults.addEventListener("click", () => showSECModal());

  // Initial
  setHUD();
  redrawAll();
})();
