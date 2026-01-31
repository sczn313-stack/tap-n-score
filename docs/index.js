/* ============================================================
   index.js (FULL REPLACEMENT) — vTAP-MOBILE-SIZE-1
   Fixes:
   - Tap dots (hits/anchor) reduced ~50% for phones
   - HUD and controls sizing handled by CSS (mobile rules)
   - Everything else preserved
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

  function isPhone() {
    // Conservative: phones / narrow portrait
    return Math.min(window.innerWidth, window.innerHeight) <= 480;
  }

  function drawDot(norm, kind) {
    const dot = document.createElement("div");
    dot.className = "tapDot";

    // --- SIZE: cut ~50% on phones
    // (was 18 / 16)
    const phone = isPhone();
    const size = kind === "anchor"
      ? (phone ? 9 : 18)
      : (phone ? 8 : 16);

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

  function directionText(anchorPt, poibPt) {
    // POIB -> Anchor (bull - poib)
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y;

    const horizDir = dx >= 0 ? "R" : "L";
    const vertDir  = dy >= 0 ? "D" : "U";

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

    // Overlay (use CSS classes so mobile sizing can be controlled)
    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    const card = document.createElement("div");
    card.className = "secCard";

    const title = document.createElement("div");
    title.className = "secTitle";
    title.textContent = "SEC";

    const body = document.createElement("div");
    body.className = "secBody";

    body.textContent =
`Shots: ${hits.length}

Horizontal: ${dir.horizPct.toFixed(2)}% ${dir.horizDir}
Vertical:   ${dir.vertPct.toFixed(2)}% ${dir.vertDir}

Distance: ${dist} yd   Click: ${clickVal} MOA
1 MOA ≈ ${oneMOAin.toFixed(3)}"`;

    const btn = document.createElement("button");
    btn.textContent = "Close";
    btn.className = "btnResults";

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

  elResults.addEventListener("click", () => showResultsModal());

  // Recompute sizing on rotation (dots use % so they stay aligned)
  window.addEventListener("resize", () => {
    redrawAll();
  });

  // Initial
  setHUD();
  redrawAll();
})();
