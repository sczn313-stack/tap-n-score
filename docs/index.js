/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vLOAD+TAP-HARDLOCK-2
   Fixes:
   - “Target does not load” after selecting a photo
   - iOS Safari HEIC/JPG decode weirdness (ObjectURL -> FileReader fallback)
   - Always transitions to TAP screen only AFTER image successfully loads
   - Bulletproof tap capture on top-layer canvas (tapCanvas)
   - Draws a dot + increments Taps on every tap (proof)

   Requires your existing IDs (from your 3-screen HTML):
   pageLanding, pageTap, pageSec
   photoInput
   targetWrap, targetImg, dotsLayer
   tapCount, instructionLine
   undoBtn (optional), clearBtn (optional), resetViewBtn (optional)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Screens
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSec = $("pageSec");

  // Input
  const elFile = $("photoInput");

  // Tap stage
  const elWrap = $("targetWrap");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elInstruction = $("instructionLine");

  const elUndo = $("undoBtn");        // optional
  const elClear = $("clearBtn");      // optional
  const elResetView = $("resetViewBtn"); // optional

  // State
  let selectedFile = null;
  let objectUrl = null;

  let taps = []; // {nx, ny, kind:'anchor'|'hit'}
  let tapCanvas = null;

  // -------------------------
  // Screen control
  // -------------------------
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

  // -------------------------
  // Tap surface
  // -------------------------
  function ensureTapSurface() {
    if (!elWrap) throw new Error("Missing #targetWrap");
    if (!elImg) throw new Error("Missing #targetImg");
    if (!elDots) throw new Error("Missing #dotsLayer");

    // Wrap must be a stable stacking context
    elWrap.style.position = "relative";
    elWrap.style.touchAction = "none";
    elWrap.style.webkitUserSelect = "none";
    elWrap.style.userSelect = "none";
    elWrap.style.webkitTouchCallout = "none";

    // Image never blocks taps
    elImg.style.pointerEvents = "none";

    // dotsLayer is visual only
    elDots.style.position = "absolute";
    elDots.style.inset = "0";
    elDots.style.zIndex = "40";
    elDots.style.pointerEvents = "none";

    // Create/force canvas
    tapCanvas = $("tapCanvas");
    if (!tapCanvas) {
      tapCanvas = document.createElement("canvas");
      tapCanvas.id = "tapCanvas";
      elWrap.appendChild(tapCanvas);
    }

    tapCanvas.style.position = "absolute";
    tapCanvas.style.inset = "0";
    tapCanvas.style.width = "100%";
    tapCanvas.style.height = "100%";
    tapCanvas.style.zIndex = "30";
    tapCanvas.style.pointerEvents = "auto";
    tapCanvas.style.touchAction = "none";
    tapCanvas.style.background = "transparent";

    syncCanvasToWrap();
  }

  function syncCanvasToWrap() {
    if (!tapCanvas || !elWrap) return;
    const r = elWrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (tapCanvas.width !== w) tapCanvas.width = w;
    if (tapCanvas.height !== h) tapCanvas.height = h;
  }

  // -------------------------
  // Dots
  // -------------------------
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
      // Uses your CSS .tapDot + .anchorDot if present
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

  // -------------------------
  // Tap capture (bulletproof)
  // -------------------------
  function getClientPoint(evt) {
    if (evt.touches && evt.touches.length) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    if (typeof evt.clientX === "number" && typeof evt.clientY === "number") {
      return { x: evt.clientX, y: evt.clientY };
    }
    return null;
  }

  function onTap(evt) {
    if (evt.cancelable) evt.preventDefault();
    evt.stopPropagation();

    if (!elWrap) return;
    const pt = getClientPoint(evt);
    if (!pt) return;

    const r = elWrap.getBoundingClientRect();
    const localX = pt.x - r.left;
    const localY = pt.y - r.top;

    const nx = Math.max(0, Math.min(1, localX / r.width));
    const ny = Math.max(0, Math.min(1, localY / r.height));

    pushTap(nx, ny);
  }

  function bindTapEvents() {
    if (!tapCanvas) return;

    // Prevent iOS from swallowing touches
    tapCanvas.addEventListener("pointerdown", onTap, { passive: false });
    tapCanvas.addEventListener("touchstart", onTap, { passive: false });
    tapCanvas.addEventListener("click", onTap);

    tapCanvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // -------------------------
  // Image load (ObjectURL + FileReader fallback)
  // -------------------------
  function loadImgSrcWithObjectUrl(file) {
    return new Promise((resolve, reject) => {
      revokeUrl();
      objectUrl = URL.createObjectURL(file);

      const onLoad = () => cleanup(resolve);
      const onError = () => cleanup(() => reject(new Error("ObjectURL decode failed")));

      const cleanup = (done) => {
        elImg.removeEventListener("load", onLoad);
        elImg.removeEventListener("error", onError);
        done();
      };

      elImg.addEventListener("load", onLoad, { once: true });
      elImg.addEventListener("error", onError, { once: true });

      elImg.src = objectUrl;
    });
  }

  function loadImgSrcWithDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("FileReader failed"));
      fr.onload = () => {
        const dataUrl = fr.result;
        if (!dataUrl || typeof dataUrl !== "string") {
          return reject(new Error("Invalid dataURL"));
        }

        const onLoad = () => cleanup(resolve);
        const onError = () => cleanup(() => reject(new Error("dataURL decode failed")));

        const cleanup = (done) => {
          elImg.removeEventListener("load", onLoad);
          elImg.removeEventListener("error", onError);
          done();
        };

        elImg.addEventListener("load", onLoad, { once: true });
        elImg.addEventListener("error", onError, { once: true });

        // If objectURL exists, release it
        revokeUrl();
        elImg.src = dataUrl;
      };
      fr.readAsDataURL(file);
    });
  }

  async function goToTapWithFile(file) {
    if (!file) return;

    selectedFile = file;

    // Make sure our tap surface exists even though pageTap is hidden
    ensureTapSurface();
    bindTapEvents();

    // Reset taps for a fresh run
    clearTaps();

    // IMPORTANT: switch to tap screen now, but only “commit” once image loads
    showOnly("tap");
    setInstruction();
    setTapCount();

    // Try objectURL first, then fallback
    try {
      await loadImgSrcWithObjectUrl(selectedFile);
    } catch (_) {
      try {
        await loadImgSrcWithDataUrl(selectedFile);
      } catch (e2) {
        showOnly("landing");
        alert("Couldn’t load image. Try a different photo.");
        return;
      }
    }

    // Once loaded, sync canvas to actual rendered wrap size
    requestAnimationFrame(() => {
      syncCanvasToWrap();
      renderDots();
    });
  }

  // -------------------------
  // Init
  // -------------------------
  function init() {
    // Hard guards (no silent failure)
    if (!elFile) { alert("Missing #photoInput"); return; }
    if (!elWrap) { alert("Missing #targetWrap"); return; }
    if (!elImg) { alert("Missing #targetImg"); return; }
    if (!elDots) { alert("Missing #dotsLayer"); return; }

    showOnly("landing");

    elFile.addEventListener("change", (e) => {
      const f = e.target?.files?.[0] || null;
      if (!f) return;
      // Store immediately (iOS stability) then load
      goToTapWithFile(f);
    });

    if (elUndo) elUndo.addEventListener("click", undoTap);
    if (elClear) elClear.addEventListener("click", clearTaps);

    if (elResetView) {
      elResetView.addEventListener("click", () => {
        syncCanvasToWrap();
        renderDots();
      });
    }

    window.addEventListener("resize", () => {
      syncCanvasToWrap();
      renderDots();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
