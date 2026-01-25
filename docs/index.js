/* ============================================================
   Tap-n-Score™ — index.js (FULL REPLACEMENT)
   Brick 1: Accurate taps (image-relative; store normalized + natural px)
   Brick 2: Scroll-safe tap capture (drag threshold; no accidental taps)
   Brick 3: Remove "Set Bull" (first tap = aim point, then holes)
============================================================ */

(() => {
  // ---------- DOM
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  const elBullStatus = $("bullStatus");
  const elHoleCount = $("holeCount");
  const elInstruction = $("instructionLine");
  const elChangeBull = $("changeBullBtn");

  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elLockBanner = $("lockBanner");

  const elWindDir = $("windageDir");
  const elWindVal = $("windageVal");
  const elElevDir = $("elevDir");
  const elElevVal = $("elevVal");
  const elDownloadSEC = $("downloadSecBtn");

  const elVendorPill = $("vendorPill");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");

  // ---------- State
  let objectUrl = null;

  // Aim point (bull) stored as point: { nx, ny, ix, iy }
  let bull = null;

  // Holes stored as points: { nx, ny, ix, iy }
  let holes = [];

  // Results lock (no new taps until Undo/Clear)
  let resultsLocked = false;

  // Pointer tap filtering
  const TAP_MOVE_PX = 10;     // if finger moves > 10px, treat as scroll/drag (no dot)
  const TAP_TIME_MS = 450;    // long presses won't create dots
  let ptrDown = null;         // { x, y, t, id, moved }

  // ---------- Helpers
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function setInstruction() {
    if (!elImg.src) {
      elInstruction.textContent = "Load a photo to begin.";
      return;
    }
    if (!bull) {
      elInstruction.textContent = "Tap aim point first, then tap bullet holes.";
      return;
    }
    elInstruction.textContent = "Tap each confirmed bullet hole.";
  }

  function setStatus() {
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    elChangeBull.hidden = !bull;
    elUndo.disabled = !(bull || holes.length);
    elClear.disabled = !(bull || holes.length);
    elShow.disabled = !(bull && holes.length);

    if (resultsLocked) {
      elLockBanner.hidden = false;
    } else {
      elLockBanner.hidden = true;
    }
  }

  // Convert a client point to:
  // - normalized coords within displayed image (nx, ny)
  // - natural image pixels (ix, iy) based on naturalWidth/Height
  function clientToImagePoint(clientX, clientY) {
    const rect = elImg.getBoundingClientRect();
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);

    // Natural image pixels (stable across resize/orientation)
    const iw = elImg.naturalWidth || 1;
    const ih = elImg.naturalHeight || 1;
    const ix = nx * iw;
    const iy = ny * ih;

    return { nx, ny, ix, iy };
  }

  // Render dots from normalized coords (stable across resize)
  function renderDots() {
    elDots.innerHTML = "";

    if (bull) {
      const d = document.createElement("div");
      d.className = "dot bullDot";
      d.style.left = `${bull.nx * 100}%`;
      d.style.top = `${bull.ny * 100}%`;
      elDots.appendChild(d);
    }

    for (const p of holes) {
      const d = document.createElement("div");
      d.className = "dot holeDot";
      d.style.left = `${p.nx * 100}%`;
      d.style.top = `${p.ny * 100}%`;
      elDots.appendChild(d);
    }
  }

  function lockResults() {
    resultsLocked = true;
    setStatus();
  }

  function unlockResults() {
    resultsLocked = false;
    setStatus();
  }

  function resetResultsUI() {
    elWindDir.textContent = "—";
    elWindVal.textContent = "—";
    elElevDir.textContent = "—";
    elElevVal.textContent = "—";
    elDownloadSEC.disabled = true;
  }

  // ---------- Vendor load (non-blocking)
  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) return;
      const v = await res.json();

      if (v?.name) elVendorName.textContent = v.name;

      if (v?.logoPath) {
        elVendorLogo.src = v.logoPath;
        elVendorLogo.alt = v.name ? `${v.name} logo` : "Vendor logo";
        elVendorLogo.style.display = "block";
      } else {
        elVendorLogo.style.display = "none";
      }

      // Optional: if website exists, make pill clickable
      if (v?.website) {
        elVendorPill.style.cursor = "pointer";
        elVendorPill.title = v.website;
        elVendorPill.onclick = () => window.open(v.website, "_blank", "noopener,noreferrer");
      } else {
        elVendorPill.style.cursor = "default";
        elVendorPill.title = "";
        elVendorPill.onclick = null;
      }
    } catch (_) {
      // silent fail
    }
  }

  // ---------- Core tap logic (bull first, then holes)
  function addTapPoint(pt) {
    if (!elImg.src) return;
    if (resultsLocked) return;

    if (!bull) {
      bull = pt;
      holes = [];
      resetResultsUI();
      unlockResults();
      setInstruction();
      setStatus();
      renderDots();
      return;
    }

    holes.push(pt);
    resetResultsUI();
    unlockResults();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---------- Scroll-safe pointer handling
  function onPointerDown(e) {
    // Only primary pointer (ignore second finger)
    if (!e.isPrimary) return;
    if (!elImg.src) return;
    if (resultsLocked) return;

    // Only if the down happens on the tap layer (image area)
    // (We attach to tapLayer, so this is already true)
    ptrDown = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      moved: false,
    };
  }

  function onPointerMove(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;

    const dx = e.clientX - ptrDown.x;
    const dy = e.clientY - ptrDown.y;
    const dist = Math.hypot(dx, dy);

    if (dist > TAP_MOVE_PX) {
      ptrDown.moved = true; // treat as scroll/drag
    }
  }

  function onPointerUp(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;

    const elapsed = Date.now() - ptrDown.t;

    const moved = ptrDown.moved;
    ptrDown = null;

    if (moved) return;
    if (elapsed > TAP_TIME_MS) return;

    const pt = clientToImagePoint(e.clientX, e.clientY);
    addTapPoint(pt);
  }

  function onPointerCancel(e) {
    if (!ptrDown) return;
    if (e.pointerId !== ptrDown.id) return;
    ptrDown = null;
  }

  // ---------- Image loading
  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function resetAllState() {
    bull = null;
    holes = [];
    resultsLocked = false;
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function onFileSelected(file) {
    if (!file) return;

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);

    // Load image
    elImg.onload = () => {
      // Make sure tap layer is active
      elTapLayer.classList.add("active");

      // Reset taps when new photo loads
      resetAllState();
      setInstruction();
      setStatus();
    };

    elImg.src = objectUrl;
  }

  // ---------- Undo / Clear / Change bull
  function undo() {
    if (holes.length) {
      holes.pop();
      unlockResults();
      resetResultsUI();
    } else if (bull) {
      bull = null;
      unlockResults();
      resetResultsUI();
    }
    setInstruction();
    setStatus();
    renderDots();
  }

  function clearAll() {
    bull = null;
    holes = [];
    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  function changeBull() {
    // Changing bull implies re-do everything for correctness
    bull = null;
    holes = [];
    unlockResults();
    resetResultsUI();
    setInstruction();
    setStatus();
    renderDots();
  }

  // ---------- Results (placeholder-safe)
  // This keeps your tap data *correct* (stable coordinates).
  // If you already have a calc/SEC pipeline, plug it into computeAndRender().
  function computeAndRender() {
    if (!bull || holes.length === 0) return;

    // POIB (mean of holes) in natural image pixels
    const poib = holes.reduce(
      (acc, p) => ({ x: acc.x + p.ix, y: acc.y + p.iy }),
      { x: 0, y: 0 }
    );
    poib.x /= holes.length;
    poib.y /= holes.length;

    // Correction vector = bull - poib (in natural px)
    const dx = bull.ix - poib.x; // + = needs RIGHT? (depends on your mapping)
    const dy = bull.iy - poib.y; // + = needs DOWN?  (screen-space)

    // Direction labels (screen-space):
    const windDir = dx >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dy >= 0 ? "DOWN" : "UP";

    // Values: we cannot infer inches/clicks without your scale model here.
    // So we show px deltas as a stable debug stand-in and lock results.
    const windVal = `${Math.abs(dx).toFixed(2)} px`;
    const elevVal = `${Math.abs(dy).toFixed(2)} px`;

    elWindDir.textContent = windDir;
    elWindVal.textContent = windVal;
    elElevDir.textContent = elevDir;
    elElevVal.textContent = elevVal;

    // Lock, and keep SEC disabled until your SEC pipeline plugs in
    elDownloadSEC.disabled = true;
    lockResults();
  }

  // ---------- SEC download (stub-safe)
  function downloadSecStub() {
    // Intentionally no-op until you wire your SEC canvas pipeline here.
    // Keep the button disabled by default in this brick.
  }

  // ---------- Keep overlay aligned on resize/orientation
  // We render via % positions, so dots stay aligned as long as the tapLayer tracks the image box.
  // The CSS does that; this is just a safety refresh.
  const ro = new ResizeObserver(() => {
    renderDots();
  });

  // ---------- Wire up events
  elFile.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    onFileSelected(file);
  });

  elUndo.addEventListener("click", undo);
  elClear.addEventListener("click", clearAll);
  elChangeBull.addEventListener("click", changeBull);

  elShow.addEventListener("click", () => {
    computeAndRender();
  });

  elDownloadSEC.addEventListener("click", downloadSecStub);

  // Pointer events on tapLayer
  // NOTE: do NOT preventDefault; the move threshold prevents accidental dots while scrolling.
  elTapLayer.addEventListener("pointerdown", onPointerDown, { passive: true });
  elTapLayer.addEventListener("pointermove", onPointerMove, { passive: true });
  elTapLayer.addEventListener("pointerup", onPointerUp, { passive: true });
  elTapLayer.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // Observe image element size changes
  ro.observe(elImg);

  // Initial UI state
  loadVendor();
  setInstruction();
  setStatus();
  renderDots();
})();
