/* ============================================================
   index.js (FULL REPLACEMENT) — ASSEMBLY BUILD
   - iOS/iPad picker: label(for=file) => Camera + Library options
   - Flow:
       Landing -> Tap (bull then holes) -> SEC page (final)
   - CTA row + BUY MORE appear ONLY after bull is set
   - SEC page shows:
       Session ID + Target Clicks (2 decimals) + Score (big)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Landing / picker
  const elFile = $("photoInput");
  const elLanding = $("landingArea");

  // --- Tap page
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
  const elBuyPill = $("buyMorePill");

  // --- SEC page
  const elSecPage = $("secPage");
  const elSecUp = $("secUp");
  const elSecDown = $("secDown");
  const elSecLeft = $("secLeft");
  const elSecRight = $("secRight");
  const elSecScore = $("secScore");
  const elSecSession = $("secSession");

  const elSecCurrent = $("secCurrent");
  const elSecPrev3 = $("secPrev3");
  const elSecCum = $("secCum");

  const elDlImg = $("downloadImgBtn");
  const elDlTxt = $("downloadTxtBtn");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;     // {x,y} in wrap pixels
  let holes = [];      // [{x,y}...]
  let phase = "idle";  // idle | bull | holes

  // Simple score history placeholders
  let prevScores = [];

  // --- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function safeUUID() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    // fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function genSessionId() {
    return "SEC-" + safeUUID().split("-")[0].toUpperCase() + "-" + safeUUID().split("-")[1].toUpperCase();
  }

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
    elCtaRow.hidden = true;      // CTAs appear AFTER bull tap
    elBuyPill.hidden = true;     // BUY MORE appears AFTER bull tap
    redrawAll();
  }

  function setPhaseHoles() {
    phase = "holes";
    elInstruction.textContent = "Tap bullet holes to be scored";
    elCtaRow.hidden = false;
    elBuyPill.hidden = false;
  }

  function releaseObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // --- Picker: DO NOT .click() the input. Label handles it.
  elFile.removeAttribute("capture");

  elFile.addEventListener("change", () => {
    selectedFile = elFile.files?.[0] || null;
    if (!selectedFile) return;

    releaseObjectUrl();
    objectUrl = URL.createObjectURL(selectedFile);

    elImg.onload = () => {
      // Hide landing, show tap page
      elLanding.hidden = true;
      elWork.hidden = false;
      elSecPage.hidden = true;

      setPhaseBull();
      window.scrollTo(0, 0);
    };

    elImg.src = objectUrl;
  });

  // --- Tap handler
  elWrap.addEventListener("click", (evt) => {
    if (phase !== "bull" && phase !== "holes") return;

    const pt = getLocalPoint(evt, elWrap);

    // guard
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

  // --- Undo / Clear
  elUndo.addEventListener("click", () => {
    if (phase !== "holes") return;

    if (holes.length > 0) {
      holes.pop();
      redrawAll();
      return;
    }

    // If no holes, undo bull puts you back to bull phase
    if (bull) setPhaseBull();
  });

  elClear.addEventListener("click", () => {
    if (phase !== "holes" && phase !== "bull") return;
    setPhaseBull();
  });

  // --- Show Results => SEC Page (final)
  elShow.addEventListener("click", () => {
    if (!bull || holes.length === 0) return;

    // Placeholder until backend: Use bull vs hole-average in wrap pixels
    const hx = avg(holes.map(h => h.x));
    const hy = avg(holes.map(h => h.y));

    const dx = bull.x - hx; // + means holes are LEFT of bull => need LEFT? (placeholder)
    const dy = bull.y - hy; // screen-space down is +y (placeholder)

    // Convert pixels to "click-ish" placeholder so layout works
    // (Backend will replace this with true inches->MOA->click)
    const scale = 120; // bigger => smaller numbers
    const rawX = dx / scale;
    const rawY = dy / scale;

    const up = rawY < 0 ? Math.abs(rawY) : 0;
    const down = rawY > 0 ? rawY : 0;
    const left = rawX > 0 ? rawX : 0;
    const right = rawX < 0 ? Math.abs(rawX) : 0;

    // Score placeholder
    const miss = Math.abs(rawX) + Math.abs(rawY);
    const score = Math.max(0, Math.min(100, Math.round(100 - miss * 12)));

    const sessionId = genSessionId();

    // Track simple history
    prevScores.unshift(score);
    prevScores = prevScores.slice(0, 4);

    const prev3 = prevScores.slice(1, 4);
    const cum = Math.round(avg(prevScores));

    // Inject SEC values (2 decimals ALWAYS)
    elSecUp.textContent = up.toFixed(2);
    elSecDown.textContent = down.toFixed(2);
    elSecLeft.textContent = left.toFixed(2);
    elSecRight.textContent = right.toFixed(2);

    elSecScore.textContent = String(score);
    elSecSession.textContent = sessionId;

    elSecCurrent.textContent = String(score);
    elSecPrev3.textContent = prev3.length ? prev3.join(", ") : "—";
    elSecCum.textContent = String(cum);

    // Color-code score
    elSecScore.classList.remove("scoreGood", "scoreMid", "scoreBad");
    if (score >= 90) elSecScore.classList.add("scoreGood");
    else if (score >= 70) elSecScore.classList.add("scoreMid");
    else elSecScore.classList.add("scoreBad");

    // Switch pages
    elWork.hidden = true;
    elSecPage.hidden = false;
    window.scrollTo(0, 0);
  });

  // --- Download hooks (placeholders for now)
  elDlImg?.addEventListener("click", () => {
    alert("Download SEC (Image) — hook ready. Next we wire the actual export.");
  });

  elDlTxt?.addEventListener("click", () => {
    alert("Download SEC (Text) — hook ready. Next we wire the actual export.");
  });

})();
