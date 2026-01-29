/* ============================================================
   index.js (FULL REPLACEMENT) — Tap-n-Score
   Fixes:
   1) Landing page not showing (CSS uses .page/.pageActive):
      - Forces .pageActive onto the main container at boot.
   2) Picker CTA reliability (iOS/iPad):
      - Uses <label for="photoInput"> (NO JS .click()).
      - Ensures capture is NOT set, so Photo Library is offered.
      - Resets input value to allow re-picking the same image.
   3) Visual overlap bug:
      - Hides the landing/hero section once a photo is chosen.
      - Shows work area only after image is ready.
   4) Tap flow:
      - Phase 1: Tap bull’s-eye to center
      - Phase 2: Tap bullet holes to be scored
      - CTA row appears ONLY after bull is set
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements (by ID)
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

  // --- Elements (by class / structure)
  const elPage = document.querySelector(".page");
  const elHero = document.querySelector(".hero"); // landing section

  // --- Guard (missing critical elements)
  if (!elFile || !elWork || !elImg || !elWrap || !elDots || !elInstruction || !elTapCount || !elCtaRow || !elUndo || !elClear || !elShow) {
    console.error("Missing required DOM elements. Check index.html IDs.");
    return;
  }

  // --- State
  let objectUrl = null;
  let bull = null;     // {x,y} within targetWrap box
  let holes = [];      // array of {x,y}
  let phase = "idle";  // idle | bull | holes

  // --- Boot visibility (fixes “No landing page opens” when CSS expects .pageActive)
  if (elPage && !elPage.classList.contains("pageActive")) {
    elPage.classList.add("pageActive");
  }

  // --- iOS / iPad: make sure Photo Library is available
  // (If capture exists, many devices show camera-only.)
  elFile.removeAttribute("capture");

  // --- Helpers
  function setReadyPill() {
    if (!elReady) return;
    elReady.style.display = "inline-flex";
    elReady.textContent = "JS READY";
  }

  function releaseObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
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

    holes.forEach((p, i) => drawDot(p.x, p.y, "hole", i + 1));

    const tapsTotal = (bull ? 1 : 0) + holes.length;
    elTapCount.textContent = `Taps: ${tapsTotal}`;
  }

  function showLanding() {
    if (elHero) elHero.hidden = false;
    elWork.hidden = true;
    // keep CTA row hidden until bull is set
    elCtaRow.hidden = true;
  }

  function showWorkArea() {
    // Hide landing so it does NOT show behind target (your screenshot issue)
    if (elHero) elHero.hidden = true;
    elWork.hidden = false;
  }

  function setPhaseBull() {
    phase = "bull";
    bull = null;
    holes = [];
    elInstruction.textContent = "Tap bull’s-eye to center";
    elCtaRow.hidden = true; // CTAs appear AFTER bull tap
    redrawAll();
  }

  function setPhaseHoles() {
    phase = "holes";
    elInstruction.textContent = "Tap bullet holes to be scored";
    elCtaRow.hidden = false;
  }

  // --- File selection (label opens picker; change loads image)
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0] ? elFile.files[0] : null;
    if (!f) return;

    // Reset the input value AFTER we read the file reference
    // so user can pick the same photo again if needed.
    // (iOS Safari is picky; do it at end of handler too.)
    releaseObjectUrl();
    objectUrl = URL.createObjectURL(f);

    // Show image
    elImg.onload = () => {
      // Swap UI mode only when the image is actually ready
      requestAnimationFrame(() => {
        showWorkArea();
        setPhaseBull();
      });
    };

    elImg.onerror = () => {
      alert("That photo couldn’t be loaded. Try again.");
      showLanding();
    };

    elImg.src = objectUrl;

    // allow same-file reselect
    elFile.value = "";
  });

  // --- Tap handler (bull first, then holes)
  elWrap.addEventListener("click", (evt) => {
    if (phase !== "bull" && phase !== "holes") return;

    const pt = getLocalPoint(evt, elWrap);

    // normalize + clamp to wrap bounds
    const x = clamp01(pt.x / pt.w) * pt.w;
    const y = clamp01(pt.y / pt.h) * pt.h;

    if (phase === "bull") {
      bull = { x, y };
      redrawAll();
      setPhaseHoles();
      return;
    }

    holes.push({ x, y });
    redrawAll();
  });

  // --- Undo / Clear / Show Results
  elUndo.addEventListener("click", () => {
    if (phase !== "holes") return;

    if (holes.length > 0) {
      holes.pop();
      redrawAll();
      return;
    }

    // No holes left -> undo bull goes back to bull phase
    if (bull) setPhaseBull();
  });

  elClear.addEventListener("click", () => {
    if (phase !== "bull" && phase !== "holes") return;
    setPhaseBull();
  });

  elShow.addEventListener("click", () => {
    if (!bull || holes.length === 0) {
      alert("Tap bull’s-eye once, then tap at least one bullet hole.");
      return;
    }

    // Placeholder hook for your final routing / backend call
    alert(`Bull set + ${holes.length} holes captured. Ready for results.`);
  });

  // --- Boot
  setReadyPill();
  showLanding();
})();
