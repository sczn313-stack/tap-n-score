/* ============================================================
   index.js (FULL REPLACEMENT)
   Page Flow:
   1) Landing (picker)
   2) Tap (bull → holes)
   3) SEC Card (final page)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  /* ------------------ ELEMENTS ------------------ */
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

  /* SEC PAGE ELEMENTS (must exist in HTML) */
  const elSecPage = $("secPage");
  const elSecUp = $("secUp");
  const elSecDown = $("secDown");
  const elSecLeft = $("secLeft");
  const elSecRight = $("secRight");
  const elSecScore = $("secScore");
  const elSecSession = $("secSession");

  /* ------------------ STATE ------------------ */
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;
  let holes = [];
  let phase = "idle";

  /* ------------------ HELPERS ------------------ */
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function getLocalPoint(evt, el) {
    const r = el.getBoundingClientRect();
    return {
      x: evt.clientX - r.left,
      y: evt.clientY - r.top,
      w: r.width,
      h: r.height,
    };
  }

  function clearDots() {
    elDots.innerHTML = "";
  }

  function drawDot(x, y, kind = "hole", n = null) {
    const d = document.createElement("div");
    d.className = kind === "bull" ? "dot dotBull" : "dot";
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    if (n !== null) d.textContent = n;
    elDots.appendChild(d);
  }

  function redraw() {
    clearDots();
    if (bull) drawDot(bull.x, bull.y, "bull");
    holes.forEach((p, i) => drawDot(p.x, p.y, "hole", i + 1));
    elTapCount.textContent = `Taps: ${(bull ? 1 : 0) + holes.length}`;
  }

  function setBullPhase() {
    phase = "bull";
    bull = null;
    holes = [];
    elInstruction.textContent = "Tap bull’s-eye to center";
    elCtaRow.hidden = true;
    redraw();
  }

  function setHolePhase() {
    phase = "holes";
    elInstruction.textContent = "Tap bullet holes to be scored";
    elCtaRow.hidden = false;
  }

  function genSessionId() {
    return "SEC-" + crypto.randomUUID().split("-")[0].toUpperCase();
  }

  /* ------------------ FILE PICKER ------------------ */
  elFile.addEventListener("change", () => {
    selectedFile = elFile.files?.[0];
    if (!selectedFile) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(selectedFile);

    elImg.onload = () => {
      elWork.hidden = false;
      setBullPhase();
    };

    elImg.src = objectUrl;
  });

  /* ------------------ TAP HANDLER ------------------ */
  elWrap.addEventListener("click", (evt) => {
    if (phase !== "bull" && phase !== "holes") return;

    const p = getLocalPoint(evt, elWrap);
    const x = clamp01(p.x / p.w) * p.w;
    const y = clamp01(p.y / p.h) * p.h;

    if (phase === "bull") {
      bull = { x, y };
      redraw();
      setHolePhase();
      return;
    }

    holes.push({ x, y });
    redraw();
  });

  /* ------------------ CONTROLS ------------------ */
  elUndo.onclick = () => {
    if (holes.length) {
      holes.pop();
      redraw();
    } else if (bull) {
      setBullPhase();
    }
  };

  elClear.onclick = () => setBullPhase();

  /* ------------------ SHOW RESULTS → SEC PAGE ------------------ */
  elShow.onclick = () => {
    if (!bull || holes.length === 0) return;

    /* MOCK CALC (placeholder until backend) */
    const dx = (bull.x - avg(holes.map(h => h.x))) / 100;
    const dy = (bull.y - avg(holes.map(h => h.y))) / 100;

    const up = dy < 0 ? Math.abs(dy) : 0;
    const down = dy > 0 ? dy : 0;
    const left = dx > 0 ? dx : 0;
    const right = dx < 0 ? Math.abs(dx) : 0;

    const score = Math.max(0, Math.round(100 - (Math.abs(dx) + Math.abs(dy)) * 10));
    const sessionId = genSessionId();

    /* Inject SEC */
    elSecUp.textContent = up.toFixed(2);
    elSecDown.textContent = down.toFixed(2);
    elSecLeft.textContent = left.toFixed(2);
    elSecRight.textContent = right.toFixed(2);
    elSecScore.textContent = score;
    elSecSession.textContent = sessionId;

    /* Switch pages */
    elWork.hidden = true;
    elSecPage.hidden = false;
    window.scrollTo(0, 0);
  };

  function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
})();
