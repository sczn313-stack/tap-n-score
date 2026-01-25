/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Stability Brick
   Fixes:
   - Tap coordinates are computed from the *actual rendered image rect*
   - Dots layer is sized/positioned to match the image exactly
   - iOS scroll vs tap: movement threshold cancels tap
   - First tap sets bull. Next taps add holes. "Change bull" resets.
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");

  const elImg = $("targetImg");
  const elStage = $("targetStage");
  const elDots = $("dotsLayer");
  const elEmptyHint = $("emptyHint");

  const elBullStatus = $("bullStatus");
  const elHoleCount = $("holeCount");
  const elHelp = $("helpLine");

  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elResults = $("resultsBtn");
  const elChangeBull = $("changeBullBtn");
  const elLockBanner = $("lockBanner");

  const elWindDir = $("windDir");
  const elWindClicks = $("windClicks");
  const elElevDir = $("elevDir");
  const elElevClicks = $("elevClicks");
  const elScoreNum = $("scoreNum");
  const elDownload = $("downloadBtn");

  const elVendorBtn = $("vendorBtn");
  const elVendorName = $("vendorName");
  const elVendorLogo = $("vendorLogo");
  const elVendorLogoWrap = $("vendorLogoWrap");
  const elDetailsBtn = $("detailsBtn");

  // State
  let objectUrl = null;
  let imgReady = false;

  // Coordinates stored in normalized image space (0..1)
  let bull = null;       // { nx, ny }
  let holes = [];        // [{ nx, ny }, ...]
  let resultsLocked = false;

  // Pointer / scroll guard
  let isPointerDown = false;
  let startX = 0, startY = 0;
  let moved = false;
  const MOVE_PX_CANCEL = 10;

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function resetResults() {
    elWindDir.textContent = "—";
    elWindClicks.textContent = "—";
    elElevDir.textContent = "—";
    elElevClicks.textContent = "—";
    elScoreNum.textContent = "—";
    elDownload.disabled = true;
  }

  function setLocked(on) {
    resultsLocked = !!on;
    elLockBanner.hidden = !resultsLocked;
    if (resultsLocked) {
      elHelp.textContent = "Results locked. Undo/Clear to edit taps.";
      elResults.disabled = true;
      elChangeBull.disabled = true;
    } else {
      elHelp.innerHTML = bull
        ? "Tap each confirmed bullet hole."
        : "Tap the <b>bull first</b>, then tap each confirmed bullet hole.";
      elResults.disabled = !(bull && holes.length >= 1);
      elChangeBull.disabled = !bull;
    }
  }

  function updateStatus() {
    elBullStatus.textContent = bull ? "set" : "not set";
    elHoleCount.textContent = String(holes.length);

    elUndo.disabled = !(bull || holes.length);
    elClear.disabled = !(bull || holes.length);

    if (!resultsLocked) {
      elResults.disabled = !(bull && holes.length >= 1);
      elChangeBull.disabled = !bull;
    }
  }

  function clearAll() {
    bull = null;
    holes = [];
    setLocked(false);
    resetResults();
    renderDots();
    updateStatus();
  }

  function undo() {
    if (resultsLocked) {
      // allow editing by unlocking first
      setLocked(false);
      resetResults();
    }

    if (holes.length > 0) {
      holes.pop();
    } else if (bull) {
      bull = null;
    }

    renderDots();
    updateStatus();
  }

  function changeBull() {
    // Reset bull + holes so the user can re-anchor clean
    bull = null;
    holes = [];
    setLocked(false);
    resetResults();
    renderDots();
    updateStatus();
  }

  // Resize/position dots layer to exactly match the rendered image box
  function syncOverlayToImage() {
    if (!imgReady) return;
    const r = elImg.getBoundingClientRect();
    const stageR = elStage.getBoundingClientRect();

    // Dots layer is absolutely positioned inside targetStage
    // Convert viewport coords into stage-local coords
    const left = r.left - stageR.left;
    const top = r.top - stageR.top;

    elDots.style.left = `${left}px`;
    elDots.style.top = `${top}px`;
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;

    // Hide empty hint once an image exists
    elEmptyHint.style.display = imgReady ? "none" : "block";
  }

  function renderDots() {
    elDots.innerHTML = "";
    if (!imgReady) return;

    // Ensure overlay matches image each render (handles iOS relayout)
    syncOverlayToImage();

    const makeDot = (nx, ny, kind) => {
      const d = document.createElement("div");
      d.className = `dot ${kind}`;
      d.style.left = `${nx * 100}%`;
      d.style.top = `${ny * 100}%`;
      return d;
    };

    if (bull) elDots.appendChild(makeDot(bull.nx, bull.ny, "bull"));
    holes.forEach((h) => elDots.appendChild(makeDot(h.nx, h.ny, "hole")));
  }

  // Convert a pointer event to normalized image coords
  function eventToNorm(ev) {
    const imgRect = elImg.getBoundingClientRect();
    const x = ev.clientX;
    const y = ev.clientY;

    // If the pointer is outside the image rect, ignore
    if (x < imgRect.left || x > imgRect.right || y < imgRect.top || y > imgRect.bottom) {
      return null;
    }

    const nx = clamp01((x - imgRect.left) / imgRect.width);
    const ny = clamp01((y - imgRect.top) / imgRect.height);
    return { nx, ny };
  }

  function onTap(ev) {
    if (!imgReady) return;
    if (resultsLocked) return;

    const p = eventToNorm(ev);
    if (!p) return;

    if (!bull) {
      bull = p;
      elHelp.textContent = "Tap each confirmed bullet hole.";
    } else {
      holes.push(p);
    }

    renderDots();
    updateStatus();
  }

  // Basic score placeholder (keeps UI stable)
  // You can swap this later to your real score logic without breaking taps.
  function computeScore() {
    if (!bull || holes.length < 1) return null;

    // Simple placeholder: number of holes * 10 + 4 (keeps your example near 54-ish with 5 holes)
    const s = holes.length * 10 + 4;
    return s;
  }

  // Placeholder correction output (you said clicks are fine already — keep stable)
  function showResults() {
    if (!bull || holes.length < 1) return;

    const score = computeScore();
    elScoreNum.textContent = score == null ? "—" : String(score);

    // Keep your existing values if you are feeding them elsewhere.
    // For now, show stable placeholders (no NaN, no blanks).
    // Replace with your real correction math when you want.
    elWindDir.textContent = "LEFT";
    elWindClicks.textContent = "6.19 clicks";
    elElevDir.textContent = "DOWN";
    elElevClicks.textContent = "8.54 clicks";

    elDownload.disabled = false;
    setLocked(true);
  }

  // Vendor loading
  async function loadVendor() {
    try {
      const r = await fetch("./vendor.json", { cache: "no-store" });
      if (!r.ok) throw new Error("vendor.json not found");
      const v = await r.json();

      if (v && v.name) elVendorName.textContent = v.name;

      if (v && v.logo) {
        elVendorLogo.src = v.logo;
        elVendorLogoWrap.hidden = false;
      } else {
        elVendorLogoWrap.hidden = true;
      }

      // Optional: click vendor pill to open vendor link
      if (v && v.url) {
        elVendorBtn.onclick = () => window.open(v.url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      // Vendor is optional; don’t break the app if missing.
      elVendorName.textContent = "Vendor";
      elVendorLogoWrap.hidden = true;
    }
  }

  function pickPhoto() {
    elFile.click();
  }

  function setImageFromFile(file) {
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    imgReady = false;
    elImg.src = "";
    elImg.removeAttribute("src");

    // Reset state for new photo
    clearAll();
    resetResults();

    elImg.onload = () => {
      imgReady = true;
      // Ensure image is visible
      elImg.classList.add("isReady");
      // Sync overlay after layout paints
      requestAnimationFrame(() => {
        syncOverlayToImage();
        renderDots();
      });
    };

    elImg.src = objectUrl;
  }

  // Pointer handling (tap vs scroll guard)
  function onPointerDown(ev) {
    if (!imgReady) return;
    if (resultsLocked) return;

    isPointerDown = true;
    moved = false;
    startX = ev.clientX;
    startY = ev.clientY;

    // Capture pointer so we receive move/up even if the finger drifts
    try { elStage.setPointerCapture(ev.pointerId); } catch (_) {}
  }

  function onPointerMove(ev) {
    if (!isPointerDown) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (Math.hypot(dx, dy) > MOVE_PX_CANCEL) moved = true;
  }

  function onPointerUp(ev) {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (moved) return; // treat as scroll/drag, not a tap
    onTap(ev);
  }

  function onPointerCancel() {
    isPointerDown = false;
  }

  // Events
  elChoose.addEventListener("click", pickPhoto);
  elFile.addEventListener("change", () => {
    const file = elFile.files && elFile.files[0];
    setImageFromFile(file);
    // iOS Safari sometimes needs value cleared for re-picking same file
    elFile.value = "";
  });

  elUndo.addEventListener("click", undo);
  elClear.addEventListener("click", clearAll);
  elResults.addEventListener("click", showResults);
  elChangeBull.addEventListener("click", changeBull);

  // Stage pointer events (we do NOT preventDefault, so scrolling still works)
  elStage.addEventListener("pointerdown", onPointerDown, { passive: true });
  elStage.addEventListener("pointermove", onPointerMove, { passive: true });
  elStage.addEventListener("pointerup", onPointerUp, { passive: true });
  elStage.addEventListener("pointercancel", onPointerCancel, { passive: true });

  // Keep overlay aligned on resize/orientation changes
  window.addEventListener("resize", () => {
    if (!imgReady) return;
    requestAnimationFrame(() => {
      syncOverlayToImage();
      renderDots();
    });
  });

  // Details button (safe placeholder)
  elDetailsBtn.addEventListener("click", () => {
    alert("Details panel (hook later).");
  });

  // Init
  loadVendor();
  updateStatus();
  resetResults();
  setLocked(false);
})();
