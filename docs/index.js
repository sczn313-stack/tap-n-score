/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-iPHONE-LOCK-2
   FIX:
   - Clear/Undo/Results appear ONLY after first tap (anchor or hit)
   - Works even if controlsBar has class="hidden" in HTML
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

    // Enable/disable
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

  // --- Controls visibility (THIS IS THE FIX)
  function hideControlsUntilFirstTap() {
    controlsArmed = false;

    // remove show + force hidden to win
    elControls.classList.remove("show");
    elControls.classList.add("hidden");
  }

  function showControlsAfterFirstTap() {
    if (controlsArmed) return;
    controlsArmed = true;

    // remove hidden (it has !important) then show
    elControls.classList.remove("hidden");
    elControls.classList.add("show");
  }

  // SEC modal placeholder (kept minimal here)
  function showSECModal() {
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

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    // reset taps
    anchor = null;
    hits = [];
    redrawAll();

    // show image area
    elImgBox.classList.remove("hidden");

    // controls stay hidden until first tap
    hideControlsUntilFirstTap();

    setInstruction("Tap bull’s-eye (anchor)");
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Tap handling
  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    // FIRST TAP => show controls
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
