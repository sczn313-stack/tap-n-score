(() => {
  const MIN_SHOTS = 3;
  const TRUE_MOA_INCHES_AT_100 = 1.047;
  const TRACK_ENDPOINT = "https://tap-n-score-backend.onrender.com/api/track";
  const DEBUG_ANALYTICS = true;
  const INCHES_PER_PERCENT = 0.75;

  const params = new URLSearchParams(window.location.search);

  const vendor = (params.get("v") || "unknown").toLowerCase();
  const sku = (params.get("sku") || "unknown").toLowerCase();
  const targetKey =
    params.get("target") ||
    params.get("target_key") ||
    sku ||
    "unknown";

  const isB2B = targetKey === "b2b";

  const targetSurface = document.getElementById("targetSurface");
  const tapLayer = document.getElementById("tapLayer");
  const secCard = document.getElementById("secCard");

  const modePill = document.getElementById("modePill");
  const statusText = document.getElementById("statusText");

  const resultsBtn = document.getElementById("resultsBtn");
  const inlineResultsBtn = document.getElementById("inlineResultsBtn");

  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");

  const simInstructionTop = document.getElementById("simInstructionTop");

  const stepAimBar = document.getElementById("stepAimBar");
  const stepShotsBar = document.getElementById("stepShotsBar");
  const stepResultsBar = document.getElementById("stepResultsBar");

  const distanceYardsEl = document.getElementById("distanceYards");
  const clickValueMOAEl = document.getElementById("clickValueMOA");

  const controlsHeading = document.getElementById("controlsHeading");
  const controlsSubhead = document.getElementById("controlsSubhead");
  const targetNameTag = document.getElementById("targetNameTag");

  const state = {
    aim: null,
    shots: [],
    mode: "aim",
    groupCenter: null,
    resultsViewed: false
  };

  function getDistanceYards() {
    return Number(distanceYardsEl?.value || 100);
  }

  function getClickValueMOA() {
    return Number(clickValueMOAEl?.value || 0.25);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function setPageCopy() {
    if (isB2B) {
      document.title = "Tap-n-Score™ — B2B";

      if (controlsHeading) controlsHeading.textContent = "B2B Target Scoring";
      if (controlsSubhead)
        controlsSubhead.textContent =
          "Tap Aim Point • Tap Shots • Get Results";

      if (targetNameTag)
        targetNameTag.textContent = "Baker Back-to-Basics Target";
    } else {
      document.title = "Tap-n-Score™ Optic Zero Trainer";

      if (controlsHeading) controlsHeading.textContent = "Optic Zero Trainer";
      if (controlsSubhead)
        controlsSubhead.textContent =
          "Tap Aim Point • Tap 3–5 Shots • Get Scope Adjustments";
    }
  }

  function setInstruction(text) {
    if (!simInstructionTop) return;
    simInstructionTop.textContent = text;
  }

  function enableResultsButtons(enable) {
    if (resultsBtn) resultsBtn.disabled = !enable;
    if (inlineResultsBtn) inlineResultsBtn.disabled = !enable;
  }

  function syncModeUI() {
    if (!modePill || !statusText) return;

    if (state.mode === "aim") {
      modePill.textContent = "Mode: Aim Point";
      statusText.textContent = "Tap Aim Point";
      setInstruction("TAP AIM POINT");
      enableResultsButtons(false);
      return;
    }

    if (state.mode === "shots") {
      modePill.textContent = "Mode: Shots";
      statusText.textContent = `Shots: ${state.shots.length}`;
      setInstruction("TAP SHOTS");
      enableResultsButtons(false);
      return;
    }

    if (state.mode === "ready") {
      modePill.textContent = "Mode: Ready";
      statusText.textContent = `Ready (${state.shots.length} shots)`;
      setInstruction("GET RESULTS");
      enableResultsButtons(true);
      return;
    }

    modePill.textContent = "Mode: Results";
    statusText.textContent = "Results ready";
    enableResultsButtons(true);
  }

  function getRelativeCoords(e) {
    const rect = targetSurface.getBoundingClientRect();
    return {
      xPct: ((e.clientX - rect.left) / rect.width) * 100,
      yPct: ((e.clientY - rect.top) / rect.height) * 100
    };
  }

  function createMarker(xPct, yPct, className) {
    const node = document.createElement("div");
    node.className = `marker ${className}`;
    node.style.left = `${xPct}%`;
    node.style.top = `${yPct}%`;
    tapLayer.appendChild(node);
  }

  function redrawAll() {
    tapLayer.innerHTML = "";

    if (state.aim) {
      createMarker(state.aim.xPct, state.aim.yPct, "aim");
    }

    state.shots.forEach((s) => {
      createMarker(s.xPct, s.yPct, "hit");
    });

    if (state.groupCenter) {
      createMarker(state.groupCenter.xPct, state.groupCenter.yPct, "group");
    }
  }
