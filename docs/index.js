/* ============================================================
   index.js (FULL REPLACEMENT)
   Fixes:
   - iOS/iPad picker reliably shows Photo Library + Take Photo
     by using <label for="photoInput"> as the CTA (NOT JS click).
   - Stores selected file immediately on change (iOS safe).
   - Minimal tap flow scaffolding:
       1) Load image
       2) Tap bull once
       3) Tap holes
       4) Undo / Clear / Show Results buttons appear AFTER bull tap
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements
  const elFile = $("photoInput");
  const elWork = $("workArea");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elInstruction = $("instructionLine");
  const elTapCount = $("tapCount");
  const elCtaRow = $("ctaRow");
  const elUndo = $("undoBtn");
  const elClear = $("clearBtn");
  const elShow = $("showResultsBtn");
  const elReady = $("jsReady");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;     // {x,y} in image display coords
  let holes = [];      // [{x,y}...]
  let phase = "idle";  // idle | bull | holes

  // --- Helpers
  function setReadyPill() {
    if (!elReady) return;
    elReady.style.display = "inline-flex";
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function getLocalPoint(evt, refEl) {
    const r = refEl.getBoundingClientRect();
    const x = evt.clientX - r.left;
    const y = evt.clientY - r.top;
    return { x, y, w: r.width, h: r.height };
  }

  function clearDots() {
    elDots.innerHTML = "";
  }

  function drawDot(x, y, kind = "hole", n = null) {
    const d = document.createElement("div");
    d.className = kind === "bull" ? "dot dotBull" : "dot dotHole";
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;

    if (n != null) {
      const t = document.createElement("div");
      t.className = "dotNum";
      t.textContent = String(n);
      d.appendChild(t);
    }

    elDots.appendChild(d);
  }

  function redrawAll() {
    clearDots();

    if (bull) drawDot(bull.x, bull.y, "bull");

    holes.forEach((p, i) => {
      drawDot(p.x, p.y, "hole", i + 1);
    });

    const tapsTotal = (bull ? 1 : 0) + holes.length;
    elTapCount.textContent = `Taps: ${tapsTotal}`;
  }

  function setPhaseBull() {
    phase = "bull";
    bull = null;
    holes = [];
    elInstruction.textContent = "Tap bull’s-eye to center";
    elCtaRow.hidden = true; // IMPORTANT: CTAs appear AFTER bull tap
    redrawAll();
  }

  function setPhaseHoles() {
    phase = "holes";
    elInstruction.textContent = "Tap bullet holes to be scored";
    elCtaRow.hidden = false; // show Undo/Clear/Show Results
  }

  function releaseObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  // --- iOS-safe file selection
  // NOTE: We do NOT do elFile.click() anywhere.
  // The <label for="photoInput"> handles opening the picker.
  elFile.addEventListener("change", () => {
    selectedFile = elFile.files && elFile.files[0] ? elFile.files[0] : null;
    if (!selectedFile) return;

    releaseObjectUrl();
    objectUrl = URL.createObjectURL(selectedFile);

    // Show image
    elImg.onload = () => {
      // Ensure dots layer matches the displayed image size
      requestAnimationFrame(() => {
        elWork.hidden = false;
        setPhaseBull();
      });
    };

    elImg.src = objectUrl;
  });

  // --- Tap handler
  // We attach to the WRAP so taps land consistently even if image has padding.
  elWrap.addEventListener("click", (evt) => {
    if (phase !== "bull" && phase !== "holes") return;

    const pt = getLocalPoint(evt, elWrap);

    // Bounds guard
    const x = clamp01(pt.x / pt.w) * pt.w;
    const y = clamp01(pt.y / pt.h) * pt.h;

    if (phase === "bull") {
      bull = { x, y };
      redrawAll();
      setPhaseHoles();
      return;
    }

    // phase === holes
    holes.push({ x, y });
    redrawAll();
  });

  // --- Undo / Clear
  elUndo.addEventListener("click", () => {
    if (phase !== "holes") return;
    if (holes.length > 0) {
      holes.pop();
      redrawAll();
      return;
    }
    // If no holes, undo bull puts you back to bull phase
    if (bull) {
      setPhaseBull();
    }
  });

  elClear.addEventListener("click", () => {
    if (phase !== "holes" && phase !== "bull") return;
    setPhaseBull();
  });

  // --- Show Results (placeholder hook)
  elShow.addEventListener("click", () => {
    if (!bull || holes.length === 0) {
      alert("Tap bull’s-eye once, then tap at least one bullet hole.");
      return;
    }

    // TODO: Replace with your backend call / SEC page routing.
    // For now, just confirm the flow works.
    alert(`Bull set + ${holes.length} holes captured. Ready for results.`);
  });

  // --- Boot
  setReadyPill();

  // Safety: ensure input is NOT capture-only
  // (If your HTML had capture before, this confirms it's gone.)
  elFile.removeAttribute("capture");
})();
