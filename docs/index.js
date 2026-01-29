/* ============================================================
   index.js (FULL REPLACEMENT)
   Fixes:
   - iOS/iPad: Photo Library + Take Photo reliably via label[for]
   - Stores selected file immediately on change (iOS safe)
   - Tap flow:
       1) Choose image -> show target stage
       2) Tap bull once (CTAs still hidden)
       3) After bull tap: instruction changes + CTAs appear
       4) Tap holes, Undo/Clear work
   - Uses pointer events (prevents weird double-count)
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
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

  // State
  let objectUrl = null;

  let bull = null;     // {x,y} in wrap coords
  let holes = [];      // [{x,y}...]
  let phase = "idle";  // idle | bull | holes

  function setReadyPill() {
    if (!elReady) return;
    elReady.style.display = "inline-flex";
  }

  function releaseObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function clearDots() {
    elDots.innerHTML = "";
  }

  function drawDot(x, y, kind = "hole", n = null) {
    const d = document.createElement("div");
    d.className = kind === "bull" ? "dot dotBull" : "dot";
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    if (n != null) d.textContent = String(n);
    elDots.appendChild(d);
  }

  function redrawAll() {
    clearDots();
    if (bull) drawDot(bull.x, bull.y, "bull");
    holes.forEach((p, i) => drawDot(p.x, p.y, "hole", i + 1));
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
    elCtaRow.hidden = false;
  }

  function pointInWrap(e) {
    const r = elWrap.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return {
      x: Math.max(0, Math.min(r.width, x)),
      y: Math.max(0, Math.min(r.height, y))
    };
  }

  // File selection (iOS safe). No .click() anywhere.
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0] ? elFile.files[0] : null;
    if (!f) return;

    releaseObjectUrl();
    objectUrl = URL.createObjectURL(f);

    elImg.onload = () => {
      // Show work area after image is ready
      elWork.hidden = false;
      setPhaseBull();
    };

    elImg.src = objectUrl;
  });

  // Tap handler: pointerup for stability
  elWrap.addEventListener("pointerup", (e) => {
    if (phase !== "bull" && phase !== "holes") return;

    // Prevent “ghost” behaviors
    e.preventDefault();

    const pt = pointInWrap(e);

    if (phase === "bull") {
      bull = { x: pt.x, y: pt.y };
      redrawAll();
      setPhaseHoles();
      return;
    }

    // phase === holes
    holes.push({ x: pt.x, y: pt.y });
    redrawAll();
  }, { passive: false });

  // Undo / Clear
  elUndo.addEventListener("click", () => {
    if (phase !== "holes") return;

    if (holes.length > 0) {
      holes.pop();
      redrawAll();
      return;
    }

    if (bull) setPhaseBull();
  });

  elClear.addEventListener("click", () => {
    if (phase !== "bull" && phase !== "holes") return;
    setPhaseBull();
  });

  // Show Results (placeholder)
  elShow.addEventListener("click", () => {
    if (!bull || holes.length === 0) {
      alert("Tap bull’s-eye once, then tap at least one bullet hole.");
      return;
    }
    alert(`Bull set + ${holes.length} holes captured. Ready for results.`);
  });

  // Boot
  setReadyPill();

  // Ensure not capture-only
  elFile.removeAttribute("capture");
})();
