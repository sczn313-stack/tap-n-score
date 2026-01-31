/* ============================================================
   index.js (FULL REPLACEMENT) — LOCK-20260130-01
   Pilot lock:
   - Photo loads -> tap works immediately (no Start)
   - Anchor first, then hits
   - Clear / Undo / Results always available (when appropriate)
   - Results show:
       1) HIT POSITION truth (POIB relative to Anchor)
       2) CORRECTION truth (Dial direction = opposite)
   - No % shown (no fake "click math" without scale)
============================================================ */

(() => {
  const BUILD = "LOCK-20260130-01";
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

  // ---------- Helpers ----------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setInstruction(msg) {
    elHUDLeft.textContent = `${msg}  •  BUILD ${BUILD}`;
  }

  function setHUD() {
    elHUDRight.textContent = `Taps: ${(anchor ? 1 : 0) + hits.length} (hits: ${hits.length})`;
  }

  function clearDots() {
    elDots.innerHTML = "";
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
    const any = (!!anchor || hits.length > 0);
    elClear.disabled = !any;
    elUndo.disabled = !any;
    elResults.disabled = (!anchor || hits.length === 0);
  }

  function computePOIB() {
    if (hits.length === 0) return null;
    const sum = hits.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / hits.length, y: sum.y / hits.length };
  }

  // HIT POSITION truth: POIB relative to Anchor (what the paper says)
  function hitTruth(anchorPt, poibPt) {
    // screen coords: +y is down
    const dx = poibPt.x - anchorPt.x; // + means hits RIGHT
    const dy = poibPt.y - anchorPt.y; // + means hits DOWN (low)

    const horiz = dx >= 0 ? "RIGHT" : "LEFT";
    const vert  = dy >= 0 ? "DOWN" : "UP";
    return { horiz, vert };
  }

  // CORRECTION truth: Dial direction (opposite of hit displacement)
  function correctionTruth(anchorPt, poibPt) {
    const dxC = anchorPt.x - poibPt.x;
    const dyC = anchorPt.y - poibPt.y;

    const horiz = dxC >= 0 ? "RIGHT" : "LEFT";
    const vert  = dyC >= 0 ? "DOWN" : "UP";
    return { horiz, vert };
  }

  function getNormFromEvent(evt) {
    const rect = elDots.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: clamp01(x), y: clamp01(y) };
  }

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  async function loadImgSrc(src) {
    await new Promise((resolve, reject) => {
      const ok = () => cleanup(resolve);
      const bad = () => cleanup(() => reject(new Error("Image load error")));
      const cleanup = (done) => {
        elImg.removeEventListener("load", ok);
        elImg.removeEventListener("error", bad);
        done();
      };
      elImg.addEventListener("load", ok, { once: true });
      elImg.addEventListener("error", bad, { once: true });
      elImg.src = src;
    });

    if (elImg.decode) {
      try { await elImg.decode(); } catch (_) {}
    }
  }

  async function loadFileToMainImage(file) {
    revokeUrl();

    // Try ObjectURL first
    try {
      objectUrl = URL.createObjectURL(file);
      await loadImgSrc(objectUrl);
      return;
    } catch (_) {
      revokeUrl();
    }

    // Fallback to FileReader (iOS reliability)
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(file);
    });

    await loadImgSrc(dataUrl);
  }

  function setThumb(file) {
    elThumbBox.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Selected thumbnail";
    img.src = URL.createObjectURL(file);
    elThumbBox.appendChild(img);
  }

  function showResultsModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const hit = hitTruth(anchor, poib);
    const dial = correctionTruth(anchor, poib);

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

HITS ARE: ${hit.vert} ${hit.horiz}
DIAL:     ${dial.vert} ${dial.horiz}

(Clicks require scale calibration. This pilot view locks direction truth first.)`;

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

  elFile.addEventListener("change", async () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    setInstruction("Loading image…");
    setThumb(f);

    // reset taps
    anchor = null;
    hits = [];
    redrawAll();

    try {
      elImgBox.classList.remove("hidden");
      elControls.classList.remove("hidden");

      await loadFileToMainImage(f);

      setInstruction("Tap bull’s-eye (anchor)");
      elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (e) {
      setInstruction("Image load failed");
      alert("Couldn’t load image. Try a different photo.");
    } finally {
      // allow re-selecting the same photo on iOS
      elFile.value = "";
    }
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

  elResults.addEventListener("click", showResultsModal);

  // Initial
  setInstruction("Choose a photo to begin");
  setHUD();
  redrawAll();
})();
