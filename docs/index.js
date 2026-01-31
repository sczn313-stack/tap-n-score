/* ============================================================
   index.js (FULL REPLACEMENT) — vTAP-LOCK-SEC-1
   Fixes:
   1) iOS "Load failed" recovery:
      - try objectURL first
      - if img.onerror, fallback to FileReader dataURL
   2) Controls bar appears ONLY after first tap (anchor or hit)
   3) Dots remain correct on resize/orientation changes
   4) Keeps thumbnail on landing, but hides it once target is shown
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

  const elControls = $("controlsBar");
  const elClear = $("clearBtn");
  const elUndo = $("undoBtn");
  const elResults = $("resultsBtn");

  // State
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized
  let hits = [];     // [{x,y}...]

  let hasFirstTap = false; // controls bar gate

  // ---------- Helpers ----------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function enableControlsVisibility() {
    if (!hasFirstTap) return;
    elControls.classList.remove("hidden");
  }

  function hideControlsVisibility() {
    elControls.classList.add("hidden");
  }

  function clearDots() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  function drawDot(norm, kind) {
    const dot = document.createElement("div");
    dot.className = `tapDot ${kind === "anchor" ? "tapDotAnchor" : "tapDotHit"}`;

    dot.style.left = `${(norm.x * 100).toFixed(4)}%`;
    dot.style.top  = `${(norm.y * 100).toFixed(4)}%`;

    elDots.appendChild(dot);
  }

  function redrawAll() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));

    // Buttons
    elClear.disabled = (!anchor && hits.length === 0);
    elUndo.disabled = (!anchor && hits.length === 0);
    elResults.disabled = (!anchor || hits.length === 0);

    // Controls appear only after first tap
    if (hasFirstTap) enableControlsVisibility();
    else hideControlsVisibility();
  }

  function setThumb(file) {
    elThumbBox.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Selected thumbnail";
    img.src = URL.createObjectURL(file);
    elThumbBox.appendChild(img);
  }

  function hideThumbnailArea() {
    // when the target is on screen, we remove the thumbnail box content to reclaim space
    // (keeps landing layout stable but eliminates the visual clutter)
    elThumbBox.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "thumbEmpty";
    msg.textContent = "Photo loaded.";
    elThumbBox.appendChild(msg);
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
    const dy = anchorPt.y - poibPt.y; // screen space

    // NOTE: These are correction directions in screen truth
    const horizDir = dx >= 0 ? "R" : "L";
    const vertDir  = dy >= 0 ? "D" : "U";

    return { dx, dy, horizDir, vertDir };
  }

  function showSECModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const dist = Number(elDistance.value) || 100;
    const clickVal = Number(elClick.value) || 0.25;

    // Placeholder conversion for now (your backend will own all math later)
    const dir = directionText(anchor, poib);
    const wind = Math.abs(dir.dx) * 100; // placeholder
    const elev = Math.abs(dir.dy) * 100; // placeholder

    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    const card = document.createElement("div");
    card.className = "secCard";

    const title = document.createElement("div");
    title.className = "secTitle";
    title.textContent = "SEC";

    const shots = document.createElement("div");
    shots.className = "secShots";
    shots.textContent = `Shots: ${hits.length}`;

    const row1 = document.createElement("div");
    row1.className = "secRow";
    row1.innerHTML = `
      <div class="secLabel">Windage</div>
      <div class="secValue">
        <span class="secArrow">${dir.horizDir === "R" ? "→" : "←"}</span>
        <span class="secNum">${wind.toFixed(2)}</span>
        <span class="secDir">${dir.horizDir}</span>
      </div>
    `;

    const row2 = document.createElement("div");
    row2.className = "secRow";
    row2.innerHTML = `
      <div class="secLabel">Elevation</div>
      <div class="secValue">
        <span class="secArrow">${dir.vertDir === "U" ? "↑" : "↓"}</span>
        <span class="secNum">${elev.toFixed(2)}</span>
        <span class="secDir">${dir.vertDir}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "secActions";

    const buyBtn = document.createElement("button");
    buyBtn.className = "secActionBtn";
    buyBtn.type = "button";
    buyBtn.textContent = "Buy more targets";
    buyBtn.addEventListener("click", () => {
      // placeholder hook (you’ll wire Baker URL later)
      window.open("https://bakertargets.com", "_blank");
    });

    const surveyBtn = document.createElement("button");
    surveyBtn.className = "secActionBtn";
    surveyBtn.type = "button";
    surveyBtn.textContent = "Survey";
    surveyBtn.addEventListener("click", () => {
      // placeholder hook (you’ll wire survey later)
      alert("Survey link coming next.");
    });

    actions.appendChild(buyBtn);
    actions.appendChild(surveyBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "secCloseBtn";
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => overlay.remove());

    card.appendChild(title);
    card.appendChild(shots);
    card.appendChild(row1);
    card.appendChild(row2);
    card.appendChild(actions);
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // ---------- Image Load (iOS fix) ----------
  function loadImageFile(file) {
    // Try objectURL first (fast)
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    let didFallback = false;

    elImg.onload = () => {
      // success
    };

    elImg.onerror = async () => {
      if (didFallback) return;
      didFallback = true;

      // Fallback: FileReader -> dataURL
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        elImg.src = dataUrl;
      } catch (e) {
        alert("Load failed");
      }
    };

    elImg.src = objectUrl;
  }

  // ---------- Events ----------
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    setThumb(f);

    // Reset taps
    anchor = null;
    hits = [];
    hasFirstTap = false;
    redrawAll();

    // Show image box
    elImgBox.classList.remove("hidden");
    hideControlsVisibility(); // stays hidden until first tap

    // Load image with iOS-safe fallback
    loadImageFile(f);

    // Hide thumbnail visual once the target is shown
    hideThumbnailArea();

    // Scroll to image
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });

    // Allow re-selecting the same photo again later
    elFile.value = "";
  });

  // Tap handling
  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    if (!hasFirstTap) hasFirstTap = true; // SHOW controls after first tap

    if (!anchor) {
      anchor = norm;
    } else {
      hits.push(norm);
    }

    redrawAll();
  }, { passive: false });

  elClear.addEventListener("click", () => {
    anchor = null;
    hits = [];
    // keep hasFirstTap true once user begins; controls stay available
    redrawAll();
  });

  elUndo.addEventListener("click", () => {
    if (hits.length > 0) {
      hits.pop();
    } else if (anchor) {
      anchor = null;
    }
    redrawAll();
  });

  elResults.addEventListener("click", () => showSECModal());

  // Recenter on rotation / resize (keeps tap rect accurate, and recenters view)
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      if (!elImgBox.classList.contains("hidden")) {
        elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 250);
  });

  window.addEventListener("resize", () => {
    // nothing to recompute because we store normalized coords,
    // but we redraw for safety (and to ensure dots stay crisp).
    redrawAll();
  });

  // Initial
  redrawAll();
})();
