/* ============================================================
   index.js (FULL REPLACEMENT) — vTAP-NOSTART-2
   - Thumbnail disappears when target pops up
   - NO Start button / tap immediately after photo loads
   - Clear / Undo / Results logic preserved
   - Direction text preserved (screen truth)
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

  // ---------- Thumbnail visibility ----------
  function hideThumb() {
    if (!elThumbBox) return;
    elThumbBox.classList.add("thumbHidden");
  }

  function showThumb() {
    if (!elThumbBox) return;
    elThumbBox.classList.remove("thumbHidden");
  }

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

  function directionText(anchorPt, poibPt) {
    // POIB -> Anchor (bull - poib)
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y; // screen truth: down is +

    const horizDir = dx >= 0 ? "RIGHT" : "LEFT";
    const vertDir  = dy >= 0 ? "DOWN" : "UP";

    return {
      horizDir,
      vertDir,
      horizPct: Math.abs(dx) * 100,
      vertPct:  Math.abs(dy) * 100
    };
  }

  function showResultsModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const dist = Number(elDistance.value) || 100;
    const clickVal = Number(elClick.value) || 0.25;
    const oneMOAin = (dist / 100) * 1.047;

    const dir = directionText(anchor, poib);

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "999999";
    overlay.style.background = "rgba(0,0,0,0.55)";
    overlay.style.backdropFilter = "blur(8px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "18px";

    const card = document.createElement("div");
    card.style.width = "min(860px, 96vw)";
    card.style.borderRadius = "22px";
    card.style.border = "1px solid rgba(255,255,255,0.12)";
    card.style.background = "rgba(12,14,13,0.72)";
    card.style.boxShadow = "0 26px 80px rgba(0,0,0,0.65)";
    card.style.padding = "18px 18px 16px";
    card.style.color = "rgba(255,255,255,0.92)";

    const title = document.createElement("div");
    title.textContent = "Results";
    title.style.fontSize = "28px";
    title.style.fontWeight = "900";
    title.style.marginBottom = "10px";

    const body = document.createElement("div");
    body.style.fontSize = "18px";
    body.style.fontWeight = "800";
    body.style.opacity = "0.92";
    body.style.whiteSpace = "pre-line";

    body.textContent =
`Shots: ${hits.length}

POIB vs Anchor (image-space):
Horizontal: ${dir.horizPct.toFixed(2)}% ${dir.horizDir}
Vertical:   ${dir.vertPct.toFixed(2)}% ${dir.vertDir}

Distance: ${dist} yd
Click: ${clickVal} MOA per click
1 MOA ≈ ${oneMOAin.toFixed(3)}" at this distance

Next step: add GRID calibration to convert % → inches → clicks.`;

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
    card.appendChild(body);
    card.appendChild(btn);
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

    // Set thumbnail, but we'll hide it once the big target shows
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

    // ✅ hide thumbnail now that target is live
    hideThumb();

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

    // Optional: bring thumb back when cleared out
    showThumb();
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

  elResults.addEventListener("click", () => showResultsModal());

  // Initial
  setHUD();
  redrawAll();
})();
