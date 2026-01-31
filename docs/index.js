/* ============================================================
   index.js (FULL REPLACEMENT) — vTAP-LAYER-LOCK-7
   Fixes:
   - Restores Clear / Undo / Results
   - Tap layer locked to rendered image box (uses dotsLayer rect)
   - Prevent taps outside image
   - Anchor first (yellow), hits next (green)
   - Direction authority: TOP = UP, RIGHT = RIGHT (screen truth)
   - Green banner always shows when correct JS is running
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");
  const elFileName = $("fileName");
  const elThumbBox = $("thumbBox");
  const elStart = $("startBtn");

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
  let tapMode = false;

  // anchor: {x,y} in normalized [0..1]
  let anchor = null;

  // hits: array of {x,y} normalized
  let hits = [];

  // ---------- Banner (debug that correct JS loaded) ----------
  function showBanner(text) {
    const b = document.createElement("div");
    b.textContent = text;
    b.style.position = "fixed";
    b.style.left = "12px";
    b.style.right = "12px";
    b.style.bottom = "12px";
    b.style.zIndex = "999999";
    b.style.padding = "10px 12px";
    b.style.borderRadius = "12px";
    b.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    b.style.fontSize = "14px";
    b.style.fontWeight = "900";
    b.style.background = "rgba(0,140,0,0.88)";
    b.style.color = "white";
    b.style.boxShadow = "0 12px 34px rgba(0,0,0,0.45)";
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2600);
  }
  showBanner("INDEX.JS LOADED ✅ vTAP-LAYER-LOCK-7");

  // ---------- Helpers ----------
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
    // norm: {x,y} normalized; kind: "anchor"|"hit"
    const dot = document.createElement("div");
    dot.className = "tapDot";

    const size = kind === "anchor" ? 18 : 16;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;

    dot.style.left = `${(norm.x * 100).toFixed(4)}%`;
    dot.style.top  = `${(norm.y * 100).toFixed(4)}%`;

    if (kind === "anchor") {
      dot.style.background = "rgba(255, 196, 0, 0.95)";
    } else {
      dot.style.background = "rgba(0, 220, 130, 0.95)";
    }

    elDots.appendChild(dot);
  }

  function redrawAll() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));
    setHUD();

    // buttons
    elClear.disabled = (!anchor && hits.length === 0);
    elUndo.disabled = (!anchor && hits.length === 0);
    elResults.disabled = (!anchor || hits.length === 0);
  }

  function setThumb(file) {
    // replace thumb content
    elThumbBox.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Selected thumbnail";
    img.src = URL.createObjectURL(file);
    elThumbBox.appendChild(img);
  }

  function enterTapMode() {
    tapMode = true;
    elImgBox.classList.remove("hidden");
    elControls.classList.remove("hidden");
    setInstruction("Tap bull’s-eye (anchor)");
    redrawAll();

    // scroll to image
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exitTapMode() {
    tapMode = false;
    elControls.classList.add("hidden");
    setInstruction("Press Start to enter tap mode");
  }

  // Convert a pointer event into normalized coordinates inside dotsLayer
  function getNormFromEvent(evt) {
    const rect = elDots.getBoundingClientRect();

    // clientX/Y relative to overlay box
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;

    // Reject outside
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;

    return { x: clamp01(x), y: clamp01(y) };
  }

  function computePOIB() {
    if (hits.length === 0) return null;
    const sum = hits.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / hits.length, y: sum.y / hits.length };
  }

  function directionText(anchorPt, poibPt) {
    // We want vector POIB -> Anchor (bull - poib)
    // dx > 0 means anchor is RIGHT of poib => need move POI RIGHT => dial RIGHT
    // dy > 0 means anchor is DOWN of poib (screen y+) => need move POI DOWN => dial DOWN
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y; // screen truth: down is +

    const horizDir = dx >= 0 ? "RIGHT" : "LEFT";
    const vertDir  = dy >= 0 ? "DOWN" : "UP";

    const horizPct = Math.abs(dx) * 100;
    const vertPct  = Math.abs(dy) * 100;

    return { horizDir, vertDir, horizPct, vertPct };
  }

  function showResultsModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const dist = Number(elDistance.value) || 100;
    const clickVal = Number(elClick.value) || 0.25;

    const oneMOAin = (dist / 100) * 1.047; // inches per MOA at distance (approx)
    const dir = directionText(anchor, poib);

    const shots = hits.length;

    // Modal
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
`Shots: ${shots}

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

  // ---------- Events ----------
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    // set thumbnail
    setThumb(f);

    // set main image
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    // reset taps
    anchor = null;
    hits = [];
    tapMode = false;
    redrawAll();
    exitTapMode();

    // enable start
    elStart.disabled = false;
    setInstruction("Press Start to enter tap mode");
  });

  elStart.addEventListener("click", () => {
    if (!selectedFile) return;
    enterTapMode();
  });

  // Tap handling — use pointerdown + preventDefault to stop iOS gesture conflicts
  elDots.addEventListener("pointerdown", (evt) => {
    if (!tapMode) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    // Anchor first, then hits
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

  elResults.addEventListener("click", () => {
    showResultsModal();
  });

  // Initial state
  setHUD();
})();
