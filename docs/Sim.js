(() => {
  const MIN_SHOTS = 3;
  const MAX_SHOTS = 5;
  const TRUE_MOA_INCHES_AT_100 = 1.047;
  const TRACK_ENDPOINT = "https://tap-n-score-backend.onrender.com/api/track";
  const DEBUG_ANALYTICS = true;
  const INCHES_PER_PERCENT = 0.75;

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get("mode") === "demo";

  const vendor = (params.get("v") || "unknown").toLowerCase();
  const sku = (params.get("sku") || "unknown").toLowerCase();
  const mode = params.get("mode") || "live";
  const batch = params.get("batch") || "";
  const targetKey =
    params.get("target") ||
    params.get("target_key") ||
    sku ||
    "unknown";

  const targetSurface = document.getElementById("targetSurface");
  const tapLayer = document.getElementById("tapLayer");
  const secCard = document.getElementById("secCard");

  const modePill = document.getElementById("modePill");
  const statusText = document.getElementById("statusText");

  const resultsBtn = document.getElementById("resultsBtn");
  const inlineResultsBtn = document.getElementById("inlineResultsBtn");

  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const inlineUndoBtn = document.getElementById("inlineUndoBtn");
  const inlineResetBtn = document.getElementById("inlineResetBtn");

  const demoModeTag = document.getElementById("demoModeTag");
  const controlsHeading = document.getElementById("controlsHeading");
  const controlsSubhead = document.getElementById("controlsSubhead");
  const setupFields = document.getElementById("setupFields");

  const simInstructionTop = document.getElementById("simInstructionTop");

  const stepAimBar = document.getElementById("stepAimBar");
  const stepShotsBar = document.getElementById("stepShotsBar");
  const stepResultsBar = document.getElementById("stepResultsBar");

  const distanceYardsEl = document.getElementById("distanceYards");
  const clickValueMOAEl = document.getElementById("clickValueMOA");
  const shotGoalEl = document.getElementById("shotGoal");

  const state = {
    aim: null,
    shots: [],
    mode: "aim",
    groupCenter: null,
    qrLive: false,
    resultsViewed: false,
    sessionStarted: false
  };

  const analytics = {
    sessionId: (() => {
      const key = "sczn3_sim_session_id";
      let value = sessionStorage.getItem(key);
      if (!value) {
        value = "sim_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem(key, value);
      }
      return value;
    })(),
    startedAtMs: Date.now(),
    firstInteractionAtMs: null,
    aimSetAtMs: null,
    firstShotAtMs: null,
    resultsAtMs: null,
    lastActivityAtMs: Date.now(),
    completionSent: false,
    lastSettingsSignature: ""
  };

  let qrHotspot = null;
  let debugOverlay = null;
  let debugBody = null;
  let debugCount = 0;

  const vendorMap = {
    baker: {
      base: "https://baker-targets.com/",
      sku: {
        st100: "https://baker-targets.com/",
        b2b: "https://baker-targets.com/",
        default: "https://baker-targets.com/"
      }
    }
  };

  function round1(v) {
    return Number(v).toFixed(1);
  }

  function round2(v) {
    return Number(v).toFixed(2);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function markActivity() {
    analytics.lastActivityAtMs = Date.now();
    if (!analytics.firstInteractionAtMs) {
      analytics.firstInteractionAtMs = analytics.lastActivityAtMs;
    }
  }

  function msSince(startMs) {
    if (!startMs) return null;
    const diff = Date.now() - startMs;
    return Number.isFinite(diff) && diff >= 0 ? diff : null;
  }

  function getShotGoal() {
    const raw = Number(shotGoalEl?.value || 5);
    return Math.min(Math.max(raw, MIN_SHOTS), MAX_SHOTS);
  }

  function getDistanceYards() {
    return Number(distanceYardsEl?.value || 100);
  }

  function getClickValueMOA() {
    return Number(clickValueMOAEl?.value || 0.25);
  }

  function getDialUnit() {
    return "MOA";
  }

  function getSettingsSnapshot() {
    return {
      distance_yards: getDistanceYards(),
      click_value_moa: getClickValueMOA(),
      click_value: getClickValueMOA(),
      dial_unit: getDialUnit(),
      shot_goal: getShotGoal(),
      target_key: targetKey
    };
  }

  function getVendorUrl() {
    if (!vendor || !vendorMap[vendor]) return "https://baker-targets.com/";
    const vendorObj = vendorMap[vendor];
    if (sku && vendorObj.sku[sku]) return vendorObj.sku[sku];
    return vendorObj.sku.default || vendorObj.base;
  }

  function ensureDebugOverlay() {
    if (!DEBUG_ANALYTICS) return;
    if (debugOverlay) return;

    debugOverlay = document.createElement("div");
    debugOverlay.id = "sczn3-debug-overlay";
    debugOverlay.style.position = "fixed";
    debugOverlay.style.right = "10px";
    debugOverlay.style.bottom = "10px";
    debugOverlay.style.width = "320px";
    debugOverlay.style.maxWidth = "calc(100vw - 20px)";
    debugOverlay.style.maxHeight = "42vh";
    debugOverlay.style.background = "rgba(0,0,0,0.88)";
    debugOverlay.style.color = "#67f3a4";
    debugOverlay.style.border = "1px solid rgba(103,243,164,0.35)";
    debugOverlay.style.borderRadius = "12px";
    debugOverlay.style.boxShadow = "0 10px 28px rgba(0,0,0,0.35)";
    debugOverlay.style.zIndex = "99999";
    debugOverlay.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
    debugOverlay.style.fontSize = "11px";
    debugOverlay.style.lineHeight = "1.35";
    debugOverlay.style.overflow = "hidden";
    debugOverlay.style.backdropFilter = "blur(6px)";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "8px 10px";
    header.style.background = "rgba(255,255,255,0.05)";
    header.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

    const title = document.createElement("div");
    title.textContent = "SCZN3 Analytics Debug";
    title.style.fontWeight = "700";
    title.style.letterSpacing = "0.2px";

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "6px";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Clear";
    clearBtn.style.background = "rgba(255,255,255,0.08)";
    clearBtn.style.color = "#fff";
    clearBtn.style.border = "1px solid rgba(255,255,255,0.12)";
    clearBtn.style.borderRadius = "8px";
    clearBtn.style.padding = "4px 8px";
    clearBtn.style.fontSize = "10px";
    clearBtn.style.cursor = "pointer";
    clearBtn.addEventListener("click", () => {
      if (debugBody) debugBody.innerHTML = "";
      debugCount = 0;
    });

    const hideBtn = document.createElement("button");
    hideBtn.type = "button";
    hideBtn.textContent = "Hide";
    hideBtn.style.background = "rgba(255,255,255,0.08)";
    hideBtn.style.color = "#fff";
    hideBtn.style.border = "1px solid rgba(255,255,255,0.12)";
    hideBtn.style.borderRadius = "8px";
    hideBtn.style.padding = "4px 8px";
    hideBtn.style.fontSize = "10px";
    hideBtn.style.cursor = "pointer";
    hideBtn.addEventListener("click", () => {
      debugOverlay.style.display = "none";
      showDebugReopenPill();
    });

    controls.appendChild(clearBtn);
    controls.appendChild(hideBtn);

    header.appendChild(title);
    header.appendChild(controls);

    debugBody = document.createElement("div");
    debugBody.style.padding = "8px 10px";
    debugBody.style.overflowY = "auto";
    debugBody.style.maxHeight = "calc(42vh - 42px)";
    debugBody.style.wordBreak = "break-word";

    debugOverlay.appendChild(header);
    debugOverlay.appendChild(debugBody);
    document.body.appendChild(debugOverlay);
  }

  function showDebugReopenPill() {
    if (!DEBUG_ANALYTICS) return;

    let pill = document.getElementById("sczn3-debug-pill");
    if (!pill) {
      pill = document.createElement("button");
      pill.id = "sczn3-debug-pill";
      pill.type = "button";
      pill.textContent = "Debug";
      pill.style.position = "fixed";
      pill.style.right = "10px";
      pill.style.bottom = "10px";
      pill.style.zIndex = "100000";
      pill.style.border = "1px solid rgba(103,243,164,0.35)";
      pill.style.background = "rgba(0,0,0,0.88)";
      pill.style.color = "#67f3a4";
      pill.style.borderRadius = "999px";
      pill.style.padding = "8px 12px";
      pill.style.fontSize = "11px";
      pill.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      pill.style.cursor = "pointer";
      pill.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
      pill.addEventListener("click", () => {
        ensureDebugOverlay();
        if (debugOverlay) debugOverlay.style.display = "block";
        pill.remove();
      });
      document.body.appendChild(pill);
    }
  }

  function debugLog(eventName, payload, status = "SEND") {
    if (!DEBUG_ANALYTICS) return;
    ensureDebugOverlay();
    if (!debugBody) return;

    debugCount += 1;

    const row = document.createElement("div");
    row.style.padding = "6px 0";
    row.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.gap = "8px";

    const left = document.createElement("div");
    left.innerHTML = `<strong style="color:#fff">${debugCount}. ${eventName}</strong>`;

    const right = document.createElement("div");
    right.textContent =
      status === "OK" ? "OK" :
      status === "ERR" || String(status).startsWith("ERR") ? status : status;
    right.style.color =
      status === "OK" ? "#67f3a4" :
      status === "ERR" || String(status).startsWith("ERR") ? "#ff7b7b" :
      "#ffd166";

    top.appendChild(left);
    top.appendChild(right);

    const meta = document.createElement("div");
    meta.style.marginTop = "3px";
    meta.style.color = "rgba(255,255,255,0.72)";
    meta.textContent =
      `shots=${payload?.shots ?? "-"} | aim=${payload?.has_aim ? "Y" : "N"} | results=${payload?.results_viewed ? "Y" : "N"}`;

    const pre = document.createElement("pre");
    pre.style.margin = "5px 0 0 0";
    pre.style.whiteSpace = "pre-wrap";
    pre.style.color = "#9ad1ff";
    pre.textContent = JSON.stringify(payload, null, 2);

    row.appendChild(top);
    row.appendChild(meta);
    row.appendChild(pre);

    debugBody.prepend(row);
  }

  function buildTrackPayload(eventName, extra = {}) {
    const settings = getSettingsSnapshot();

    return {
      event: eventName,
      vendor,
      sku,
      batch,
      mode,
      session_id: analytics.sessionId,
      page: "Sim",
      ts: nowIso(),
      shots: state.shots.length,
      has_aim: !!state.aim,
      results_viewed: !!state.resultsViewed,
      session_started_at: new Date(analytics.startedAtMs).toISOString(),
      session_duration_ms: msSince(analytics.startedAtMs),
      time_to_first_interaction_ms: analytics.firstInteractionAtMs
        ? analytics.firstInteractionAtMs - analytics.startedAtMs
        : null,
      time_to_aim_ms: analytics.aimSetAtMs
        ? analytics.aimSetAtMs - analytics.startedAtMs
        : null,
      time_to_first_shot_ms: analytics.firstShotAtMs
        ? analytics.firstShotAtMs - analytics.startedAtMs
        : null,
      time_to_results_ms: analytics.resultsAtMs
        ? analytics.resultsAtMs - analytics.startedAtMs
        : null,
      ...settings,
      ...extra
    };
  }

  function sendTrackPayload(payload, useBeacon = false) {
    try {
      if (useBeacon && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json"
        });
        const ok = navigator.sendBeacon(TRACK_ENDPOINT, blob);
        debugLog(payload.event, payload, ok ? "OK" : "ERR");
        return;
      }

      debugLog(payload.event, payload, "SEND");

      fetch(TRACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      })
        .then((res) => {
          debugLog(payload.event, payload, res.ok ? "OK" : `ERR ${res.status}`);
        })
        .catch(() => {
          debugLog(payload.event, payload, "ERR");
        });
    } catch (_) {
      debugLog(payload.event || "unknown", payload, "ERR");
    }
  }

  function trackEvent(eventName, extra = {}, options = {}) {
    const payload = buildTrackPayload(eventName, extra);
    sendTrackPayload(payload, !!options.beacon);
  }

  function signatureForSettings(settings) {
    return [
      settings.distance_yards,
      settings.click_value_moa,
      settings.shot_goal,
      settings.target_key,
      settings.dial_unit
    ].join("|");
  }

  function trackSettingsChanged(source) {
    const settings = getSettingsSnapshot();
    const signature = signatureForSettings(settings);

    if (signature === analytics.lastSettingsSignature) return;
    analytics.lastSettingsSignature = signature;

    trackEvent("settings_changed", {
      source,
      ...settings
    });
  }

  function deriveDirectionTruth(aim, groupCenter) {
    const dx = groupCenter.xPct - aim.xPct;
    const dy = groupCenter.yPct - aim.yPct;

    return {
      dx,
      dy,
      horizontalPosition: dx > 0 ? "right" : dx < 0 ? "left" : "centered",
      verticalPosition: dy > 0 ? "low" : dy < 0 ? "high" : "centered",
      windageDirection: dx > 0 ? "LEFT" : dx < 0 ? "RIGHT" : "NONE",
      elevationDirection: dy > 0 ? "UP" : dy < 0 ? "DOWN" : "NONE"
    };
  }

  function setPageCopy() {
    document.title = "Tap-n-Score™ Optic Zero Trainer";

    if (controlsHeading) {
      controlsHeading.textContent = "Optic Zero Trainer";
    }

    if (controlsSubhead) {
      controlsSubhead.textContent = "Tap Aim Point • Tap 3–5 Shots • Get Scope Adjustments";
    }

    if (isDemoMode && demoModeTag) {
      demoModeTag.hidden = false;
    }

    if (isDemoMode && setupFields) {
      setupFields.classList.add("demo-hidden");
    }
  }

  function setInstruction(text, stateClass) {
    if (!simInstructionTop) return;
    simInstructionTop.textContent = text;
    simInstructionTop.classList.remove("state-aim", "state-shots", "state-results");
    simInstructionTop.classList.add(stateClass, "state-bump");

    window.setTimeout(() => {
      simInstructionTop.classList.remove("state-bump");
    }, 240);
  }

  function setStepBar(active) {
    if (!stepAimBar || !stepShotsBar || !stepResultsBar) return;

    stepAimBar.className = "step-chip aim";
    stepShotsBar.className = "step-chip shots";
    stepResultsBar.className = "step-chip results";

    if (active === "aim") stepAimBar.classList.add("is-active");
    if (active === "shots") stepShotsBar.classList.add("is-active");
    if (active === "results") stepResultsBar.classList.add("is-active");
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
      setInstruction("TAP AIM POINT", "state-aim");
      setStepBar("aim");
      enableResultsButtons(false);
      return;
    }

    if (state.mode === "shots") {
      modePill.textContent = "Mode: Shots";
      statusText.textContent = `Tap 3–5 Shots (${state.shots.length}/${getShotGoal()})`;
      setInstruction("TAP 3–5 SHOTS", "state-shots");
      setStepBar("shots");
      enableResultsButtons(false);
      return;
    }

    if (state.mode === "ready") {
      modePill.textContent = "Mode: Ready";
      statusText.textContent = `Get Scope Adjustments (${state.shots.length}/${getShotGoal()} shots set)`;
      setInstruction("GET SCOPE ADJUSTMENTS", "state-results");
      setStepBar("results");
      enableResultsButtons(true);
      return;
    }

    modePill.textContent = "Mode: Adjustments Ready";
    statusText.textContent = "Scope adjustments ready";
    setInstruction("SCOPE ADJUSTMENTS READY", "state-results");
    setStepBar("results");
    enableResultsButtons(true);
  }

  function createAimMarker(xPct, yPct) {
    const node = document.createElement("div");
    node.className = "marker aim";
    node.style.left = `${xPct}%`;
    node.style.top = `${yPct}%`;

    const center = document.createElement("div");
    center.className = "aim-center";
    node.appendChild(center);

    tapLayer.appendChild(node);
  }

  function createMarker(xPct, yPct, className) {
    const node = document.createElement("div");
    node.className = `marker ${className}`;
    node.style.left = `${xPct}%`;
    node.style.top = `${yPct}%`;
    tapLayer.appendChild(node);
    return node;
  }

  function clearMarkers() {
    tapLayer.querySelectorAll(".marker").forEach((node) => node.remove());
  }

  function redrawAll() {
    clearMarkers();

    if (state.aim) {
      createAimMarker(state.aim.xPct, state.aim.yPct);
    }

    state.shots.forEach((shot) => {
      createMarker(shot.xPct, shot.yPct, "hit");
    });

    if (state.groupCenter) {
      createMarker(state.groupCenter.xPct, state.groupCenter.yPct, "group-center-halo");
      createMarker(state.groupCenter.xPct, state.groupCenter.yPct, "group-center-core");
    }
  }

  function getRelativeCoords(e) {
    const rect = targetSurface.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    return {
      xPct: Math.max(0, Math.min(100, x)),
      yPct: Math.max(0, Math.min(100, y))
    };
  }

  function setQrLive(isLive) {
    state.qrLive = isLive;
    if (!qrHotspot) return;
    qrHotspot.classList.toggle("qr-live", isLive);
    qrHotspot.style.cursor = isLive ? "pointer" : "default";
  }

  function handleQrClick(e) {
    e.stopPropagation();
    if (!state.qrLive) return;

    markActivity();

    const destination = getVendorUrl();

    trackEvent("vendor_click", {
      source: "qr_hotspot",
      destination
    });

    window.open(destination, "_blank", "noopener,noreferrer");
  }

  function addQrHotspot() {
    if (qrHotspot || !targetSurface) return;

    qrHotspot = document.createElement("div");
    qrHotspot.className = "qr-hotspot";
    qrHotspot.style.left = "78.8%";
    qrHotspot.style.top = "1.6%";
    qrHotspot.style.width = "16.2%";
    qrHotspot.style.height = "11.6%";

    qrHotspot.addEventListener("click", handleQrClick);
    targetSurface.appendChild(qrHotspot);
    setQrLive(false);
  }

  function resetSEC() {
    if (!secCard) return;
    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="sec-empty">
        Results will appear after you tap an aim point,
        tap 3–5 shots, and get scope adjustments.
      </div>
    `;
  }

  function resetSimulator(track = true) {
    if (track) {
      trackEvent("reset", {
        reset_from: state.resultsViewed ? "results" : state.aim ? "in_progress" : "empty"
      });
    }

    state.aim = null;
    state.shots = [];
    state.mode = "aim";
    state.groupCenter = null;
    state.qrLive = false;
    state.resultsViewed = false;
    state.sessionStarted = false;

    clearMarkers();
    resetSEC();
    setQrLive(false);
    syncModeUI();
  }

  function recomputeModeFromState() {
    if (!state.aim) {
      state.mode = "aim";
      return;
    }

    if (state.groupCenter) {
      state.mode = "results";
      return;
    }

    if (state.shots.length >= Math.min(getShotGoal(), MAX_SHOTS)) {
      state.mode = "ready";
      return;
    }

    state.mode = "shots";
  }

  function handleTap(e) {
    if (state.mode === "results") return;

    markActivity();

    const pos = getRelativeCoords(e);

    if (!state.sessionStarted) {
      state.sessionStarted = true;
      trackEvent("demo_start", {
        source: isDemoMode ? "demo" : "sim"
      });
    }

    if (!state.aim) {
      state.aim = pos;
      state.groupCenter = null;

      if (!analytics.aimSetAtMs) {
        analytics.aimSetAtMs = Date.now();
      }

      trackEvent("aim_set", {
        aim_x_pct: Number(pos.xPct.toFixed(2)),
        aim_y_pct: Number(pos.yPct.toFixed(2))
      });

      recomputeModeFromState();
      redrawAll();
      syncModeUI();
      return;
    }

    if (state.shots.length >= Math.min(getShotGoal(), MAX_SHOTS)) return;

    state.shots.push(pos);
    state.groupCenter = null;

    if (!analytics.firstShotAtMs) {
      analytics.firstShotAtMs = Date.now();
    }

    trackEvent("shot_added", {
      shot_index: state.shots.length,
      shot_x_pct: Number(pos.xPct.toFixed(2)),
      shot_y_pct: Number(pos.yPct.toFixed(2)),
      shot_goal: getShotGoal()
    });

    recomputeModeFromState();
    redrawAll();
    syncModeUI();
  }

  function undoLast() {
    markActivity();

    if (state.mode === "results") {
      trackEvent("undo", {
        undo_type: "results"
      });

      state.groupCenter = null;
      state.resultsViewed = false;
      analytics.resultsAtMs = null;
      setQrLive(false);
      recomputeModeFromState();
      redrawAll();
      resetSEC();
      syncModeUI();
      return;
    }

    if (state.shots.length > 0) {
      trackEvent("undo", {
        undo_type: "shot",
        remaining_shots: state.shots.length - 1
      });

      state.shots.pop();
      state.groupCenter = null;
      setQrLive(false);
      recomputeModeFromState();
      redrawAll();
      syncModeUI();
      return;
    }

    if (state.aim) {
      trackEvent("undo", {
        undo_type: "aim"
      });

      state.aim = null;
      state.groupCenter = null;
      analytics.aimSetAtMs = null;
      analytics.firstShotAtMs = null;
      analytics.resultsAtMs = null;
      setQrLive(false);
      recomputeModeFromState();
      redrawAll();
      resetSEC();
      syncModeUI();
    }
  }

  function computeGroupCenter() {
    const avgX = state.shots.reduce((sum, shot) => sum + shot.xPct, 0) / state.shots.length;
    const avgY = state.shots.reduce((sum, shot) => sum + shot.yPct, 0) / state.shots.length;
    return { xPct: avgX, yPct: avgY };
  }

  function inchesPerMOAAtDistance(distanceYards) {
    return TRUE_MOA_INCHES_AT_100 * (distanceYards / 100);
  }

  function calculateGroupSizeInches(inchesPerPercent) {
    if (state.shots.length < 2) return 0;

    let maxDistance = 0;

    for (let i = 0; i < state.shots.length; i++) {
      for (let j = i + 1; j < state.shots.length; j++) {
        const dx = (state.shots[j].xPct - state.shots[i].xPct) * inchesPerPercent;
        const dy = (state.shots[j].yPct - state.shots[i].yPct) * inchesPerPercent;
        const d = Math.hypot(dx, dy);
        if (d > maxDistance) maxDistance = d;
      }
    }

    return maxDistance;
  }

  function calculateOffsetInches(dxInches, dyInches) {
    return Math.hypot(dxInches, dyInches);
  }

  function calculateSmartScore(groupSizeInches, offsetInches) {
    const MAX_ALLOWED_SPREAD = 6.0;
    const MAX_ALLOWED_OFFSET = 4.0;

    const tightnessScore = 50 * (1 - (groupSizeInches / MAX_ALLOWED_SPREAD));
    const proximityScore = 50 * (1 - (offsetInches / MAX_ALLOWED_OFFSET));

    const total = clamp(tightnessScore, 0, 50) + clamp(proximityScore, 0, 50);
    return Math.round(clamp(total, 0, 100));
  }

  function storeB2BSecPayload(payload) {
    try {
      sessionStorage.setItem("sczn3_active_target", "b2b");
      sessionStorage.setItem("sczn3_b2b_context", JSON.stringify(payload));
    } catch (err) {
      console.warn("Unable to store B2B SEC payload.", err);
    }
  }

  function moveArrow(verticalDir, horizontalDir) {
    if (verticalDir !== "NONE" && horizontalDir !== "NONE") {
      if (verticalDir === "UP" && horizontalDir === "LEFT") return "↖";
      if (verticalDir === "UP" && horizontalDir === "RIGHT") return "↗";
      if (verticalDir === "DOWN" && horizontalDir === "LEFT") return "↙";
      return "↘";
    }

    if (verticalDir !== "NONE") return verticalDir === "UP" ? "↑" : "↓";
    if (horizontalDir !== "NONE") return horizontalDir === "LEFT" ? "←" : "→";
    return "•";
  }

  function metricText(direction, moa, clicks) {
    if (direction === "NONE") return "No change";
    return `
      ${direction} ${round2(moa)} MOA
      <span class="clicks">(${round1(clicks)} clicks)</span>
    `;
  }

  function calculateResults() {
    markActivity();

    if (!state.aim || state.shots.length < MIN_SHOTS) return;

    trackEvent("results_clicked", {
      shots: state.shots.length,
      distance_yards: getDistanceYards(),
      click_value_moa: getClickValueMOA()
    });

    state.groupCenter = computeGroupCenter();
    state.mode = "results";
    state.resultsViewed = true;

    if (!analytics.resultsAtMs) {
      analytics.resultsAtMs = Date.now();
    }

    const truth = deriveDirectionTruth(state.aim, state.groupCenter);

    const dxInches = truth.dx * INCHES_PER_PERCENT;
    const dyInches = truth.dy * INCHES_PER_PERCENT;
    const offsetInches = calculateOffsetInches(dxInches, dyInches);

    const distance = getDistanceYards();
    const clickValue = getClickValueMOA();
    const moaScale = inchesPerMOAAtDistance(distance);

    const windageMOA = Math.abs(dxInches / moaScale);
    const elevationMOA = Math.abs(dyInches / moaScale);

    const clicksX = windageMOA / clickValue;
    const clicksY = elevationMOA / clickValue;

    const groupSizeInches = calculateGroupSizeInches(INCHES_PER_PERCENT);
    const smartScore = calculateSmartScore(groupSizeInches, offsetInches);
    const arrow = moveArrow(truth.elevationDirection, truth.windageDirection);

    redrawAll();
    syncModeUI();
    setQrLive(true);

    const b2bPayload = {
      target: "b2b",
      shots: state.shots.length,
      imageDataUrl: "",
      score: smartScore,
      windageClicks: Number(round2(clicksX)),
      windageDirection: truth.windageDirection,
      elevationClicks: Number(round2(clicksY)),
      elevationDirection: truth.elevationDirection,
      groupSizeInches: Number(round2(groupSizeInches)),
      offsetInches: Number(round2(offsetInches)),
      windageMOA: Number(round2(windageMOA)),
      elevationMOA: Number(round2(elevationMOA)),
      dxInches: Number(round2(dxInches)),
      dyInches: Number(round2(dyInches)),
      distanceYards: distance,
      clickValueMOA: clickValue,
      createdAt: Date.now(),
      source: "b2b-score"
    };

    storeB2BSecPayload(b2bPayload);

    trackEvent("results_ready", {
      shots: state.shots.length,
      distance_yards: distance,
      click_value_moa: clickValue,
      click_value: clickValue,
      dial_unit: getDialUnit(),
      smart_score: smartScore,
      group_size_inches: Number(round2(groupSizeInches)),
      offset_inches: Number(round2(offsetInches)),
      windage_direction: truth.windageDirection,
      elevation_direction: truth.elevationDirection,
      dx_inches: Number(round2(dxInches)),
      dy_inches: Number(round2(dyInches)),
      windage_moa: Number(round2(windageMOA)),
      elevation_moa: Number(round2(elevationMOA)),
      windage_clicks: Number(round2(clicksX)),
      elevation_clicks: Number(round2(clicksY))
    });

    trackEvent("results_viewed", {
      shots: state.shots.length,
      distance_yards: distance,
      click_value_moa: clickValue,
      click_value: clickValue,
      dial_unit: getDialUnit(),
      smart_score: smartScore,
      group_size_inches: Number(round2(groupSizeInches)),
      offset_inches: Number(round2(offsetInches)),
      windage_direction: truth.windageDirection,
      elevation_direction: truth.elevationDirection,
      time_to_results_ms: analytics.resultsAtMs - analytics.startedAtMs
    });

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>

      <div class="sec-title">Smart Score</div>
      <div class="sec-score-big">${smartScore}</div>
      <div class="sec-sub">Tighter group + closer to aim point = higher score</div>

      <div class="sec-title" style="margin-top:14px;">Scope Adjustments</div>
      <div class="sec-sub">Based on your ${state.shots.length}-shot group</div>

      <div class="sec-visual">
        <div class="move-label">Move Group</div>
        <div class="move-graphic">
          <div class="group-dot"></div>
          <div class="move-arrow">${arrow}</div>
          <div class="bull-dot"></div>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <div class="metric-label">Elevation</div>
          <div class="metric-value">${metricText(truth.elevationDirection, elevationMOA, clicksY)}</div>
        </div>

        <div class="metric">
          <div class="metric-label">Windage</div>
          <div class="metric-value">${metricText(truth.windageDirection, windageMOA, clicksX)}</div>
        </div>
      </div>

      <div class="sec-support">
        Group size: ${round2(groupSizeInches)}"<br>
        Offset from aim: ${round2(offsetInches)}"<br>
        Distance: ${distance} yd • ${clickValue} MOA/click
      </div>

      <div class="sec-actions">
        <button type="button" class="primary" id="secTryAgainBtn">Try Again</button>
        <button type="button" id="secOpenB2BSecBtn">Open B2B SEC</button>
        <button type="button" id="secBuyMoreBtn">Buy More Targets Like This</button>
      </div>

      <div class="sec-footer">Powered by SCZN3 Precision</div>
    `;

    const secTryAgainBtn = document.getElementById("secTryAgainBtn");
    const secOpenB2BSecBtn = document.getElementById("secOpenB2BSecBtn");
    const secBuyMoreBtn = document.getElementById("secBuyMoreBtn");

    if (secTryAgainBtn) {
      secTryAgainBtn.addEventListener("click", () => {
        markActivity();
        trackEvent("try_again", {
          source: "sec"
        });
        resetSimulator(false);
      });
    }

    if (secOpenB2BSecBtn) {
      secOpenB2BSecBtn.addEventListener("click", () => {
        markActivity();
        trackEvent("sec_opened", {
          source: "sim",
          smart_score: smartScore
        });
        window.location.href = "./b2b-sec.html";
      });
    }

    if (secBuyMoreBtn) {
      secBuyMoreBtn.addEventListener("click", () => {
        markActivity();
        const destination = getVendorUrl();

        trackEvent("vendor_click", {
          source: "buy_more_button",
          destination
        });

        window.open(destination, "_blank", "noopener,noreferrer");
      });
    }

    secCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function wireSettingsListeners() {
    [distanceYardsEl, clickValueMOAEl, shotGoalEl].forEach((el) => {
      if (!el) return;

      const handler = () => {
        markActivity();
        trackSettingsChanged(el.id || "settings_control");
        recomputeModeFromState();
        syncModeUI();
      };

      el.addEventListener("change", handler);
      el.addEventListener("input", handler);
    });
  }

  function finalizeSession(reason) {
    if (analytics.completionSent) return;
    analytics.completionSent = true;

    const eventName = state.resultsViewed ? "session_completed" : "session_abandoned";

    trackEvent(
      eventName,
      {
        reason,
        completed: state.resultsViewed,
        final_mode: state.mode,
        total_shots: state.shots.length,
        had_aim: !!state.aim,
        had_results: !!state.resultsViewed,
        inactivity_ms: msSince(analytics.lastActivityAtMs)
      },
      { beacon: true }
    );
  }

  function installSessionFinalizers() {
    window.addEventListener("pagehide", () => finalizeSession("pagehide"));
    window.addEventListener("beforeunload", () => finalizeSession("beforeunload"));

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        finalizeSession("hidden");
      }
    });
  }

  if (!targetSurface || !tapLayer || !secCard) {
    console.warn("Sim.js: required DOM elements are missing.");
    return;
  }

  tapLayer.addEventListener("click", handleTap);

  if (undoBtn) undoBtn.addEventListener("click", undoLast);
  if (inlineUndoBtn) inlineUndoBtn.addEventListener("click", undoLast);

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      markActivity();
      resetSimulator(true);
    });
  }

  if (inlineResetBtn) {
    inlineResetBtn.addEventListener("click", () => {
      markActivity();
      resetSimulator(true);
    });
  }

  if (resultsBtn) resultsBtn.addEventListener("click", calculateResults);
  if (inlineResultsBtn) inlineResultsBtn.addEventListener("click", calculateResults);

  setPageCopy();
  addQrHotspot();
  resetSimulator(false);
  wireSettingsListeners();
  installSessionFinalizers();
  ensureDebugOverlay();

  analytics.lastSettingsSignature = signatureForSettings(getSettingsSnapshot());

  trackEvent("scan", {
    source: isDemoMode ? "demo" : "sim"
  });

  trackEvent("page_view", {
    source: isDemoMode ? "demo" : "sim"
  });

  trackEvent("settings_initialized", {
    source: "init",
    ...getSettingsSnapshot()
  });
})();
