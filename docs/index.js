/* ============================================================
   frontend_new/index.js  (FULL REPLACEMENT) — vNATSPACE-LOCK-1
   Fixes:
   - Tap coordinates computed in IMAGE NATURAL PIXEL SPACE
   - Stores taps as normalized (0..1) + natural px for debug
   - Prevents iOS double-fire (pointer + click) by using pointer only
   - Stable reset: clear taps + anchor + UI + overlays
   - Sends normalized coords to backend (resolution-independent)
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- REQUIRED HTML IDs (must exist)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elInstruction = $("instructionLine");

  // ---- Optional IDs (safe if missing)
  const elDistance = $("distanceYds");   // optional
  const elVendor = $("vendorLink");      // optional

  // ---- State
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // { nx, ny, px, py }
  let taps = [];     // [{ nx, ny, px, py }...]

  // ---- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const round2 = (n) => Math.round(n * 100) / 100;

  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(taps.length);
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetAll() {
    anchor = null;
    taps = [];
    clearDots();
    setTapCount();
    setInstruction("Tap bull’s-eye to center");
  }

  function clearDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
  }

  function addDot(nx, ny, kind) {
    // kind: "anchor" | "tap"
    if (!elDots || !elWrap) return;

    const dot = document.createElement("div");
    dot.className = "tapDot " + (kind === "anchor" ? "dotAnchor" : "dotHit");
    // Position using percentages so dots stay aligned on resize
    dot.style.left = `${nx * 100}%`;
    dot.style.top = `${ny * 100}%`;
    elDots.appendChild(dot);
  }

  function redrawDots() {
    clearDots();
    if (anchor) addDot(anchor.nx, anchor.ny, "anchor");
    for (const t of taps) addDot(t.nx, t.ny, "tap");
  }

  function getNaturalTapFromPointerEvent(ev) {
    // Compute normalized coords using displayed bounds, then convert to natural px.
    if (!elImg) return null;

    const rect = elImg.getBoundingClientRect();
    const cx = ev.clientX;
    const cy = ev.clientY;

    // If tapped outside the image area, ignore
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) {
      return null;
    }

    const nx = clamp01((cx - rect.left) / rect.width);
    const ny = clamp01((cy - rect.top) / rect.height);

    const nw = elImg.naturalWidth || 0;
    const nh = elImg.naturalHeight || 0;

    // If natural sizes aren’t ready yet, block (prevents bad scale math)
    if (!(nw > 0 && nh > 0)) return null;

    const px = nx * nw;
    const py = ny * nh;

    return {
      nx,
      ny,
      px,
      py,
      debug: {
        rectW: rect.width,
        rectH: rect.height,
        naturalW: nw,
        naturalH: nh,
        devicePixelRatio: window.devicePixelRatio || 1
      }
    };
  }

  function requireImageLoaded() {
    // iOS can “select file” but image not actually loaded yet
    const ok = elImg && elImg.complete && (elImg.naturalWidth > 0);
    return !!ok;
  }

  async function loadSelectedFileToImage(file) {
    selectedFile = file;
    revokeObjectUrl();

    objectUrl = URL.createObjectURL(file);
    elImg.src = objectUrl;

    // Wait for real load (naturalWidth available)
    await new Promise((resolve, reject) => {
      const onLoad = () => {
        elImg.removeEventListener("load", onLoad);
        elImg.removeEventListener("error", onErr);
        resolve();
      };
      const onErr = () => {
        elImg.removeEventListener("load", onLoad);
        elImg.removeEventListener("error", onErr);
        reject(new Error("Image failed to load"));
      };
      elImg.addEventListener("load", onLoad);
      elImg.addEventListener("error", onErr);
    });

    resetAll();
  }

  // ---- UI enable/disable (optional; safe if buttons missing)
  function setButtons() {
    if (elUndo) elUndo.disabled = taps.length === 0;
    if (elClear) elClear.disabled = !anchor && taps.length === 0;
    if (elShow) elShow.disabled = !anchor || taps.length === 0;
  }

  function afterStateChange() {
    redrawDots();
    setTapCount();
    setButtons();
  }

  // ---- Events: file picker
  if (elFile) {
    elFile.addEventListener("change", async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      try {
        await loadSelectedFileToImage(file);
      } catch (e) {
        console.error(e);
        alert("Couldn’t load image. Try a different photo.");
      }
    });
  }

  // ---- Events: tapping image (POINTER ONLY to avoid iOS double-fire)
  if (elWrap) {
    elWrap.addEventListener("pointerdown", (ev) => {
      // Only primary pointer
      if (ev.isPrimary === false) return;

      // Stop scroll/zoom taps from being treated as clicks
      ev.preventDefault();

      if (!requireImageLoaded()) {
        alert("Image not fully loaded yet. Try again in a moment.");
        return;
      }

      const hit = getNaturalTapFromPointerEvent(ev);
      if (!hit) return;

      // First tap becomes anchor
      if (!anchor) {
        anchor = { nx: hit.nx, ny: hit.ny, px: hit.px, py: hit.py };
        setInstruction("Now tap each confirmed hit (3–7). Then press Show Results.");
        afterStateChange();
        return;
      }

      // Subsequent taps are hits
      taps.push({ nx: hit.nx, ny: hit.ny, px: hit.px, py: hit.py });
      afterStateChange();
    }, { passive: false });
  }

  // ---- Undo / Clear
  if (elUndo) {
    elUndo.addEventListener("click", () => {
      if (taps.length > 0) {
        taps.pop();
        afterStateChange();
      }
    });
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      resetAll();
      afterStateChange();
    });
  }

  // ---- Show Results
  if (elShow) {
    elShow.addEventListener("click", async () => {
      if (!anchor || taps.length === 0) return;

      // Distance (optional)
      const distanceYds = elDistance ? Number(elDistance.value) : 100;

      // Payload uses normalized coords (resolution independent)
      const payload = {
        distanceYds: Number.isFinite(distanceYds) ? distanceYds : 100,
        anchor: { nx: anchor.nx, ny: anchor.ny },
        taps: taps.map(t => ({ nx: t.nx, ny: t.ny })),
        meta: {
          naturalW: elImg.naturalWidth,
          naturalH: elImg.naturalHeight,
          tapCount: taps.length
        }
      };

      try {
        // NOTE: keep your existing endpoint here if different
        const res = await fetch("/api/calc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.error("Calc error:", data);
          alert("Server calc error. Check console.");
          return;
        }

        // If your UI updates elsewhere, keep that logic there.
        // This just logs to verify scale sanity.
        console.log("CALC OK:", data);

        // Optional: if you have a function to render results, call it:
        // window.renderResults?.(data);

      } catch (e) {
        console.error(e);
        alert("Network error calling backend.");
      }
    });
  }

  // ---- Initial state
  resetAll();
  afterStateChange();
})();
