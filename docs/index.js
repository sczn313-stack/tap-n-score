/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vTAP-HARDLOCK-1
   Fix:
   - Photo loads but taps do NOT respond (iPad Safari)
   What this does:
   - Creates a real tap surface (canvas) INSIDE #targetWrap (always on top)
   - Forces correct stacking: image < canvas < dotsLayer
   - Binds pointerdown + touchstart with { passive:false } + preventDefault
   - Shows a visible test dot for every tap (so you KNOW it fired)
   - Keeps your existing UI IDs (from your 3-screen HTML)

   Required HTML IDs (must exist):
   - pageLanding, pageTap (hidden), pageSec (hidden)
   - photoInput
   - targetWrap, targetImg, dotsLayer
   - tapCount
   - resetViewBtn (optional), undoBtn (optional), clearBtn (optional), showResultsBtn (optional)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Pages
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSec = $("pageSec");

  // ---------- Landing input
  const elFile = $("photoInput");

  // ---------- Tap screen
  const elWrap = $("targetWrap");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elInstruction = $("instructionLine");

  const elResetView = $("resetViewBtn"); // optional
  const elUndo = $("undoBtn");           // optional
  const elClear = $("clearBtn");         // optional
  const elShow = $("showResultsBtn");    // optional

  // ---------- State
  let selectedFile = null;
  let objectUrl = null;

  // taps stored normalized (0..1)
  // first tap = bull anchor, remaining = hit taps
  let taps = []; // { nx, ny, kind:'anchor'|'hit' }

  // A dedicated tap surface that ALWAYS receives touches
  let tapCanvas = null;

  // ---------- Utilities
  function showOnly(which) {
    if (pageLanding) pageLanding.hidden = which !== "landing";
    if (pageTap) pageTap.hidden = which !== "tap";
    if (pageSec) pageSec.hidden = which !== "sec";
  }

  function setInstruction() {
    if (!elInstruction) return;
    elInstruction.textContent =
      taps.length === 0 ? "Tap bull’s-eye to center" : "Tap each confirmed hit";
  }

  function setTapCount() {
    if (!elTapCount) return;
    elTapCount.textContent = String(taps.length);
  }

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  // ---------- Tap layer creation (THE KEY FIX)
  function ensureTapSurface() {
    if (!elWrap) throw new Error("Missing #targetWrap");
    if (!elImg) throw new Error("Missing #targetImg");
    if (!elDots) throw new Error("Missing #dotsLayer");

    // Make sure wrap is a proper stacking context
    elWrap.style.position = "relative";
    elWrap.style.touchAction = "none"; // critical for iPad Safari
    elWrap.style.webkitUserSelect = "none";
    elWrap.style.userSelect = "none";
    elWrap.style.webkitTouchCallout = "none";

    // Image should NOT block events
    elImg.style.pointerEvents = "none";

    // Dots layer is visual only
    elDots.style.position = "absolute";
    elDots.style.inset = "0";
    elDots.style.pointerEvents = "none";
    elDots.style.zIndex = "40";

    // Create canvas if missing
    tapCanvas = $("tapCanvas");
    if (!tapCanvas) {
      tapCanvas = document.createElement("canvas");
      tapCanvas.id = "tapCanvas";
      elWrap.appendChild(tapCanvas);
    }

    // Force canvas to be on top of the image
    tapCanvas.style.position = "absolute";
    tapCanvas.style.inset = "0";
    tapCanvas.style.width = "100%";
    tapCanvas.style.height = "100%";
    tapCanvas.style.zIndex = "30";
    tapCanvas.style.pointerEvents = "auto";
    tapCanvas.style.touchAction = "none";
    tapCanvas.style.background = "transparent";

    // OPTIONAL: uncomment if you want a visible proof layer
    // tapCanvas.style.outline = "3px solid hotpink";
    // tapCanvas.style.background = "rgba(255,0,255,0.06)";

    // Keep canvas internal resolution synced to rendered size
    syncCanvasToWrap();
    window.addEventListener("resize", syncCanvasToWrap);
  }

  function syncCanvasToWrap() {
    if (!tapCanvas || !elWrap) return;
    const r = elWrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (tapCanvas.width !== w) tapCanvas.width = w;
    if (tapCanvas.height !== h) tapCanvas.height = h;
  }

  // ---------- Dot rendering
  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function renderDots() {
    if (!elDots || !elWrap) return;

    clearDots();
    const r = elWrap.getBoundingClientRect();
    const w = r.width;
    const h = r.height;

    for (const t of taps) {
      const d = document.createElement("div");
      d.className = "tapDot" + (t.kind === "anchor" ? " anchorDot" : "");
      d.style.left = `${t.nx * w}px`;
      d.style.top = `${t.ny * h}px`;
      elDots.appendChild(d);
    }

    setTapCount();
    setInstruction();
  }

  function pushTap(nx, ny) {
    const kind = taps.length === 0 ? "anchor" : "hit";
    taps.push({ nx, ny, kind });
    renderDots();
  }

  function undoTap() {
    if (taps.length === 0) return;
    taps.pop();
    renderDots();
  }

  function clearTaps() {
    taps = [];
    renderDots();
  }

  // ---------- Pointer/touch capture (BULLETPROOF)
  function getClientPoint(evt) {
    // touch
    if (evt.touches && evt.touches.length) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    // pointer / mouse
    if (typeof evt.clientX === "number" && typeof evt.clientY === "number") {
      return { x: evt.clientX, y: evt.clientY };
    }
    return null;
  }

  function onTap(evt) {
    // If Safari allows, stop it from scrolling/zooming/doing weirdness
    if (evt.cancelable) evt.preventDefault();
    evt.stopPropagation();

    if (!elWrap) return;
    const pt = getClientPoint(evt);
    if (!pt) return;

    const r = elWrap.getBoundingClientRect();
    const localX = pt.x - r.left;
    const localY = pt.y - r.top;

    // Normalize & clamp (0..1)
    const nx = Math.max(0, Math.min(1, localX / r.width));
    const ny = Math.max(0, Math.min(1, localY / r.height));

    pushTap(nx, ny);
  }

  function bindTapEvents() {
    if (!tapCanvas) return;

    // IMPORTANT: passive:false so preventDefault works on iOS
    tapCanvas.addEventListener("pointerdown", onTap, { passive: false });
    tapCanvas.addEventListener("touchstart", onTap, { passive: false });

    // Extra safety: some iOS cases still like click
    tapCanvas.addEventListener("click", onTap);

    // Disable long-press menu
    tapCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ---------- File load
  function loadFileToTapScreen(file) {
    selectedFile = file || null;

    if (!selectedFile) return;

    revokeUrl();
    objectUrl = URL.createObjectURL(selectedFile);

    // ensure tap surface exists BEFORE setting src
    ensureTapSurface();

    // Move to tap page and show image
    showOnly("tap");

    // reset taps
    clearTaps();

    // load image
    elImg.onload = () => {
      // after image paints, sync canvas to actual displayed size
      // (wrap size is now final)
      syncCanvasToWrap();
      renderDots();
    };

    elImg.onerror = () => {
      alert("Couldn’t load image. Try a different photo.");
    };

    elImg.src = objectUrl;
  }

  // ---------- Init
  function init() {
    if (!elFile) throw new Error("Missing #photoInput");
    if (!pageLanding || !pageTap) {
      // still works even if those sections don’t exist, but call it out
      // (no alert; keep it quiet)
    }

    showOnly("landing");

    // File picker change → go straight to tap screen
    elFile.addEventListener("change", (e) => {
      const f = e.target?.files?.[0] || null;
      if (!f) return;
      loadFileToTapScreen(f);
    });

    // Buttons (optional)
    if (elUndo) elUndo.addEventListener("click", undoTap);
    if (elClear) elClear.addEventListener("click", clearTaps);

    if (elResetView) {
      elResetView.addEventListener("click", () => {
        // No transforms used in this hardlock version.
        // If you add zoom/pan later, reset them here.
        // For now, just re-sync.
        syncCanvasToWrap();
        renderDots();
      });
    }

    if (elShow) {
      elShow.addEventListener("click", () => {
        // Placeholder — your existing backend call can plug in here.
        // For now, prove taps exist:
        if (taps.length < 2) {
          alert("Tap bull’s-eye once, then tap at least one confirmed hit.");
          return;
        }
        alert(`Captured taps: ${taps.length} (anchor + hits).`);
      });
    }

    // If the user lands on tap page already (rare), still bind safely
    try {
      ensureTapSurface();
      bindTapEvents();
    } catch (_) {
      // only binds once you’re on tap screen with targetWrap present
    }
  }

  // Bind after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
      // Important: bind after surface exists
      if (tapCanvas) bindTapEvents();
    });
  } else {
    init();
    if (tapCanvas) bindTapEvents();
  }
})();
