/* ============================================================
   frontend/index.js (FULL REPLACEMENT) — Tap-n-Score UI
   Purpose:
   - Keeps your current “hook ready” alerts
   - Adds Survey button (loose)
   - Shows SEC card + fills fields (demo fill if backend not wired)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elSeeResults = $("seeResultsBtn");

  const elSecCard = $("secCard");
  const elSession = $("secSessionId");
  const elUp = $("clickUp");
  const elDown = $("clickDown");
  const elLeft = $("clickLeft");
  const elRight = $("clickRight");
  const elScoreBig = $("scoreBig");
  const elScoreCur = $("scoreCurrent");
  const elScorePrev = $("scorePrev");
  const elScoreCum = $("scoreCum");

  const btnDownloadImage = $("downloadSecImageBtn");
  const btnSurvey = $("surveyBtn");

  // State
  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // {x:0..1, y:0..1}

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(taps.length);
  }

  function clearDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
  }

  function addDot(xNorm, yNorm) {
    if (!elDots) return;
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = `${xNorm * 100}%`;
    dot.style.top = `${yNorm * 100}%`;
    elDots.appendChild(dot);
  }

  function resetAll() {
    taps = [];
    setTapCount();
    clearDots();
    if (elInstruction) elInstruction.textContent = "Tap bull, then tap holes.";
  }

  function showSecCard(data) {
    if (!elSecCard) return;
    elSecCard.hidden = false;

    // Fill fields safely
    const sid = data?.sessionId || "SEC-00000000-0000";
    const clicks = data?.clicks || {};
    const score = data?.score || {};

    if (elSession) elSession.textContent = sid;

    if (elUp) elUp.textContent = (clicks.up ?? "0.00");
    if (elDown) elDown.textContent = (clicks.down ?? "0.00");
    if (elLeft) elLeft.textContent = (clicks.left ?? "0.00");
    if (elRight) elRight.textContent = (clicks.right ?? "0.00");

    const cur = score.current ?? "—";
    if (elScoreBig) elScoreBig.textContent = String(cur);
    if (elScoreCur) elScoreCur.textContent = String(cur);

    // Demo placeholders (until you wire aggregation)
    if (elScorePrev) elScorePrev.textContent = "—";
    if (elScoreCum) elScoreCum.textContent = String(cur);
  }

  // Photo load
  function handleFile(file) {
    if (!file) return;
    selectedFile = file;

    // revoke last URL
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    objectUrl = URL.createObjectURL(file);
    if (elImg) elImg.src = objectUrl;

    // reset taps each time you choose a new image
    resetAll();

    // hide SEC card until results
    if (elSecCard) elSecCard.hidden = true;
  }

  // Tap capture (on the image wrapper)
  function onTap(e) {
    if (!elWrap) return;
    if (!elImg || !elImg.src) return; // must have image loaded

    const rect = elWrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // clamp
    const xN = Math.max(0, Math.min(1, x));
    const yN = Math.max(0, Math.min(1, y));

    taps.push({ x: xN, y: yN });
    setTapCount();
    addDot(xN, yN);

    if (elInstruction) {
      if (taps.length === 1) elInstruction.textContent = "Bull anchored. Now tap holes.";
      else elInstruction.textContent = `Holes tapped: ${taps.length - 1}. Tap more holes or press Show Results.`;
    }
  }

  // Results (demo)
  async function onSeeResults() {
    if (!selectedFile) {
      alert("Pick a target photo first.");
      return;
    }
    if (taps.length < 2) {
      alert("Tap bull first, then at least one hole.");
      return;
    }

    // Bull is first tap; remaining taps are holes
    const bull = taps[0];
    const holes = taps.slice(1);

    // TODO: wire to backend endpoint later
    // For now: show demo-ish output so UI can be tested.
    const demo = {
      ok: true,
      sessionId: `SEC-${Math.random().toString(16).slice(2, 10).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
      clicks: {
        up: "0.00",
        down: "1.23",
        left: "0.00",
        right: "0.82"
      },
      score: { current: 75 },
      debug: { bull, holes }
    };

    showSecCard(demo);
    // scroll SEC into view
    elSecCard?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Hooks
  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      handleFile(f);
    });
  }

  if (elWrap) {
    // Touch + click
    elWrap.addEventListener("touchstart", onTap, { passive: true });
    elWrap.addEventListener("click", onTap);
  }

  if (elClear) {
    elClear.addEventListener("click", () => resetAll());
  }

  if (elSeeResults) {
    elSeeResults.addEventListener("click", onSeeResults);
  }

  // ✅ Download Image hook (still not wired)
  if (btnDownloadImage) {
    btnDownloadImage.addEventListener("click", () => {
      alert("Download SEC (Image) — hook ready. Next we wire the actual export.");
    });
  }

  // ✅ Survey button (loose)
  if (btnSurvey) {
    btnSurvey.addEventListener("click", () => {
      alert("10-Second Survey coming next — after we finish wiring everything else.");
    });
  }
})();
