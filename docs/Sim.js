(() => {
  const MIN_SHOTS = 3;
  const TRUE_MOA_INCHES_AT_100 = 1.047;
  const TRACK_ENDPOINT = "https://tap-n-score-backend.onrender.com/api/track";
  const DEBUG_ANALYTICS = true;
  const INCHES_PER_PERCENT = 0.75;
  const SEC_PAYLOAD_KEY = "SCZN3_SEC_PAYLOAD_V1";

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get("mode") === "demo";

  const vendor = (params.get("v") || "unknown").toLowerCase();
  const sku = (params.get("sku") || "unknown").toLowerCase();
  const mode = params.get("mode") || "live";
  const batch = params.get("batch") || "";

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  const storedActiveTarget =
    (sessionStorage.getItem("sczn3_active_target") || "").toLowerCase();

  const storedB2BEntryContext = safeJsonParse(
    sessionStorage.getItem("sczn3_b2b_entry_context"),
    null
  );

  const targetKey =
    (
      params.get("target") ||
      params.get("target_key") ||
      storedActiveTarget ||
      sku ||
      "st100"
    ).toLowerCase();

  const isB2B =
    targetKey === "b2b" ||
    sku === "b2b" ||
    storedActiveTarget === "b2b" ||
    !!storedB2BEntryContext;

  const targetSurface = document.getElementById("targetSurface");
  const tapLayer = document.getElementById("tapLayer");
  const secCard = document.getElementById("secCard");
  const targetImage = document.getElementById("targetImage");

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

  const targetNameTag = document.getElementById("targetNameTag");

  if (!targetSurface || !tapLayer || !secCard) {
    console.warn("SCZN3 Sim init aborted: required DOM nodes missing.");
    return;
  }

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
        value =
          "sim_" +
          Math.random().toString(36).slice(2) +
          Date.now().toString(36);
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

  function nowIso() {
    return new Date().toISOString();
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
    return Math.max(raw, MIN_SHOTS);
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
      target_key: isB2B ? "b2b" : "st100"
    };
  }

  function getVendorUrl() {
    if (!vendor || !vendorMap[vendor]) return "https://baker-targets.com/";
    const vendorObj = vendorMap[vendor];
    if (sku && vendorObj.sku[sku]) return vendorObj.sku[sku];
    return vendorObj.sku.default || vendorObj.base;
  }

  function getTargetMeta() {
    if (isB2B) {
      return {
        key: "b2b",
        name: "Back to Basics",
        wIn: 23,
        hIn: 35
      };
    }

    return {
      key: "st100",
      name: "ST100",
      wIn: 23,
      hIn: 35
    };
  }

  function clearStaleTargetContext() {
    try {
      sessionStorage.removeItem("sczn3_b2b_context");
      if (!isB2B) {
        sessionStorage.removeItem("sczn3_b2b_entry_context");
      }
    } catch {}

    try {
      localStorage.removeItem(SEC_PAYLOAD_KEY);
    } catch {}
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
      status === "OK"
        ? "OK"
        : status === "ERR" || String(status).startsWith("ERR")
        ? status
        : status;
    right.style.color =
      status === "OK"
        ? "#67f3a4"
        : status === "ERR" || String(status).startsWith("ERR")
        ? "#ff7b7b"
        : "#ffd166";

    top.appendChild(left);
    top.appendChild(right);

    const meta = document.createElement("div");
    meta.style.marginTop = "3px";
    meta.style.color = "rgba(255,255,255,0.72)";
    meta.textContent = `shots=${payload?.shots ?? "-"} | aim=${
      payload?.has_aim ? "Y" : "N"
    } | results=${payload?.results_viewed ? "Y" : "N"} | target=${
      payload?.target_key ?? "-"
    }`;

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

  function applyEntryImageIfPresent() {
    if (!targetImage) return;

    if (isB2B && storedB2BEntryContext?.imageDataUrl) {
      targetImage.src = storedB2BEntryContext.imageDataUrl;
      targetImage.alt = "Baker Back-to-Basics Target";
      return;
    }

    if (isB2B) {
      targetImage.alt = "Baker Back-to-Basics Target";
    } else {
      targetImage.alt = "Baker ST100 Smart Target";
    }
  }

  function setPageCopy() {
    if (isB2B) {
      document.title = "Tap-n-Score™ — B2B";

      if (controlsHeading) controlsHeading.textContent = "B2B Target Scoring";
      if (controlsSubhead) {
        controlsSubhead.textContent = "Tap Aim Point • Tap Shots • Get Results";
      }
      if (targetNameTag) {
        targetNameTag.textContent = "Baker Back-to-Basics Target";
      }
    } else {
      document.title = "Tap-n-Score™ Optic Zero Trainer";

      if (controlsHeading) controlsHeading.textContent = "Optic Zero Trainer";
      if (controlsSubhead) {
        controlsSubhead.textContent =
          "Tap Aim Point • Tap 3–5 Shots • Get Scope Adjustments";
      }
      if (targetNameTag) {
        targetNameTag.textContent = "Baker ST100 Smart Target";
      }
    }

    if (isDemoMode && demoModeTag) {
      demoModeTag.hidden = false;
    }

    if (isDemoMode && setupFields) {
      setupFields.classList.add("demo-hidden");
    }

    applyEntryImageIfPresent();
  }

  function setInstruction(text, stateClass) {
    if (!simInstructionTop) return;
    simInstructionTop.textContent = text;
    simInstructionTop.classList.remove("state-aim", "state-shots", "state-results");
    if (stateClass) {
      simInstructionTop.classList.add(stateClass, "state-bump");
      window.setTimeout(() => {
        simInstructionTop.classList.remove("state-bump");
      }, 240);
    }
  }

  function setStepBar(active) {
    if (!stepAimBar || !stepShotsBar || !stepResultsBar) return;

    stepAimBar.className = "step-chip";
    stepShotsBar.className = "step-chip";
    stepResultsBar.className = "step-chip";

    if (active === "aim") stepAimBar.classList.add("is-active");
    if (active === "shots") stepShotsBar.classList.add("is-active");
    if (active === "results") stepResultsBar.classList.add("is-active");
  }

  function enableResultsButtons(enable) {
    if (resultsBtn) resultsBtn.disabled = !enable;
    if (inlineResultsBtn) inlineResultsBtn.disabled = !enable;
  }

  function syncModeUI() {
    if (state.mode === "aim") {
      if (modePill) modePill.textContent = "Mode: Aim Point";
      if (statusText) statusText.textContent = "Tap Aim Point";
      setInstruction("TAP AIM POINT", "state-aim");
      setStepBar("aim");
      enableResultsButtons(false);
      setQrLive(false);
      return;
    }

    if (state.mode === "shots") {
      if (modePill) modePill.textContent = "Mode: Shots";
      if (statusText) {
        statusText.textContent = isB2B
          ? `Shots: ${state.shots.length} • Results ready at ${MIN_SHOTS}+`
          : `Tap 3–5 Shots (${state.shots.length}/${getShotGoal()} goal)`;
      }
      setInstruction(isB2B ? "TAP SHOTS" : "TAP 3–5 SHOTS", "state-shots");
      setStepBar("shots");
      enableResultsButtons(false);
      setQrLive(false);
      return;
    }

    if (state.mode === "ready") {
      if (modePill) modePill.textContent = "Mode: Ready";
      if (statusText) {
        statusText.textContent = isB2B
          ? `Ready (${state.shots.length} shots set)`
          : `Get Scope Adjustments (${state.shots.length}/${getShotGoal()} shots set)`;
      }
      setInstruction(
        isB2B ? "GET RESULTS" : "GET SCOPE ADJUSTMENTS",
        "state-results"
      );
      setStepBar("results");
      enableResultsButtons(true);
      setQrLive(false);
      return;
    }

    if (state.mode === "results") {
      if (modePill) {
        modePill.textContent = isB2B ? "Mode: Results Ready" : "Mode: Adjustments Ready";
      }
      if (statusText) {
        statusText.textContent = isB2B ? "Results ready" : "Scope adjustments ready";
      }
      setInstruction(
        isB2B ? "RESULTS READY" : "SCOPE ADJUSTMENTS READY",
        "state-results"
      );
      setStepBar("results");
      enableResultsButtons(true);
      setQrLive(true);
    }
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
      <div class="sec-title">Results</div>

      <div class="sec-empty">
        Results will appear after you tap an aim point,
        tap ${isB2B ? "at least 3 shots" : "3–5 shots"},
        and ${isB2B ? "get results" : "get scope adjustments"}.
      </div>
    `;
  }

  function handleTap(e) {
    if (state.mode === "results") return;

    markActivity();

    const pos = getRelativeCoords(e);

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

      state.mode = "shots";
      redrawAll();
      syncModeUI();
      return;
    }

    state.shots.push(pos);
    state.groupCenter = null;
    state.resultsViewed = false;

    if (!analytics.firstShotAtMs) {
      analytics.firstShotAtMs = Date.now();
    }

    trackEvent("shot_added", {
      shot_index: state.shots.length,
      shot_x_pct: Number(pos.xPct.toFixed(2)),
      shot_y_pct: Number(pos.yPct.toFixed(2))
    });

    state.mode = state.shots.length >= MIN_SHOTS ? "ready" : "shots";

    redrawAll();
    syncModeUI();
  }

  function undoLast() {
    markActivity();

    if (state.mode === "results") {
      state.groupCenter = null;
      state.resultsViewed = false;
      analytics.resultsAtMs = null;
      state.mode = state.shots.length >= MIN_SHOTS ? "ready" : "shots";
      redrawAll();
      resetSEC();
      syncModeUI();
      trackEvent("undo_last", { undo_type: "results" });
      return;
    }

    if (state.shots.length > 0) {
      state.shots.pop();
      state.groupCenter = null;
      state.resultsViewed = false;
      state.mode = state.shots.length >= MIN_SHOTS ? "ready" : "shots";
      redrawAll();
      resetSEC();
      syncModeUI();
      trackEvent("undo_last", { undo_type: "shot", shots_remaining: state.shots.length });
      return;
    }

    if (state.aim) {
      state.aim = null;
      state.groupCenter = null;
      state.resultsViewed = false;
      state.mode = "aim";
      redrawAll();
      resetSEC();
      syncModeUI();
      trackEvent("undo_last", { undo_type: "aim" });
    }
  }

  function computeGroupCenter() {
    const avgX =
      state.shots.reduce((s, p) => s + p.xPct, 0) / state.shots.length;
    const avgY =
      state.shots.reduce((s, p) => s + p.yPct, 0) / state.shots.length;
    return { xPct: avgX, yPct: avgY };
  }

  function buildSecPayload({
    windDir,
    elevDir,
    windClicks,
    elevClicks,
    dxIn,
    dyIn
  }) {
    const meta = getTargetMeta();
    const radius = Math.sqrt(dxIn * dxIn + dyIn * dyIn);

    return {
      sessionId: analytics.sessionId,
      score: 50,
      shots: state.shots.length,
      windage: {
        dir: windDir,
        clicks: Number(windClicks.toFixed(2))
      },
      elevation: {
        dir: elevDir,
        clicks: Number(elevClicks.toFixed(2))
      },
      dial: {
        unit: "MOA",
        clickValue: Number(getClickValueMOA().toFixed(2))
      },
      target: {
        key: meta.key,
        name: meta.name,
        wIn: meta.wIn,
        hIn: meta.hIn
      },
      debug: {
        distanceYds: Number(getDistanceYards().toFixed(2)),
        inches: {
          x: Number(dxIn.toFixed(2)),
          y: Number(dyIn.toFixed(2)),
          r: Number(radius.toFixed(2))
        }
      }
    };
  }

  function openSecPage(payload) {
    try {
      localStorage.setItem(SEC_PAYLOAD_KEY, JSON.stringify(payload));
    } catch {}

    window.location.href = "./sec.html";
  }

  function calculateResults() {
    if (!state.aim || state.shots.length < MIN_SHOTS) return;

    markActivity();

    state.groupCenter = computeGroupCenter();
    state.mode = "results";
    state.resultsViewed = true;

    if (!analytics.resultsAtMs) {
      analytics.resultsAtMs = Date.now();
    }

    const dx = state.groupCenter.xPct - state.aim.xPct;
    const dy = state.groupCenter.yPct - state.aim.yPct;

    const dxIn = dx * INCHES_PER_PERCENT;
    const dyIn = dy * INCHES_PER_PERCENT;

    const distance = getDistanceYards();
    const click = getClickValueMOA();
    const scale = TRUE_MOA_INCHES_AT_100 * (distance / 100);

    const windMOA = Math.abs(dxIn / scale);
    const elevMOA = Math.abs(dyIn / scale);

    const windClicks = windMOA / click;
    const elevClicks = elevMOA / click;

    const windDir = dx > 0 ? "LEFT" : dx < 0 ? "RIGHT" : "NONE";
    const elevDir = dy > 0 ? "UP" : dy < 0 ? "DOWN" : "NONE";

    redrawAll();
    syncModeUI();

    trackEvent("results_viewed", {
      group_center_x_pct: Number(state.groupCenter.xPct.toFixed(2)),
      group_center_y_pct: Number(state.groupCenter.yPct.toFixed(2)),
      dx_pct: Number(dx.toFixed(2)),
      dy_pct: Number(dy.toFixed(2)),
      dx_inches: Number(dxIn.toFixed(2)),
      dy_inches: Number(dyIn.toFixed(2)),
      windage_clicks: Number(windClicks.toFixed(2)),
      elevation_clicks: Number(elevClicks.toFixed(2)),
      windage_direction: windDir,
      elevation_direction: elevDir
    });

    const secPayload = buildSecPayload({
      windDir,
      elevDir,
      windClicks,
      elevClicks,
      dxIn,
      dyIn
    });

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="sec-title">Results</div>

      <div class="metric">
        Elevation: ${elevDir} ${elevClicks.toFixed(2)} clicks
      </div>

      <div class="metric">
        Windage: ${windDir} ${windClicks.toFixed(2)} clicks
      </div>

      <div class="sec-actions">
        <button id="secTryAgainBtn">Try Again</button>
        <button id="secOpenSecBtn">Open SEC</button>
      </div>
    `;

    document.getElementById("secTryAgainBtn")?.addEventListener("click", () => {
      resetSimulator(true);
    });

    document.getElementById("secOpenSecBtn")?.addEventListener("click", () => {
      openSecPage(secPayload);
    });
  }

  function resetSimulator(track = true) {
    const hadAim = !!state.aim;
    const priorShots = state.shots.length;
    const hadResults = !!state.resultsViewed;

    state.aim = null;
    state.shots = [];
    state.groupCenter = null;
    state.mode = "aim";
    state.resultsViewed = false;
    analytics.resultsAtMs = null;

    try {
      localStorage.removeItem(SEC_PAYLOAD_KEY);
    } catch {}

    redrawAll();
    resetSEC();
    syncModeUI();

    if (track) {
      trackEvent("reset_clicked", {
        had_aim: hadAim,
        prior_shots: priorShots,
        had_results: hadResults
      });
    }
  }

  tapLayer.addEventListener("click", handleTap);

  resultsBtn?.addEventListener("click", calculateResults);
  inlineResultsBtn?.addEventListener("click", calculateResults);

  undoBtn?.addEventListener("click", undoLast);
  inlineUndoBtn?.addEventListener("click", undoLast);

  resetBtn?.addEventListener("click", () => resetSimulator(true));
  inlineResetBtn?.addEventListener("click", () => resetSimulator(true));

  distanceYardsEl?.addEventListener("change", () => trackSettingsChanged("distance"));
  clickValueMOAEl?.addEventListener("change", () => trackSettingsChanged("click_value"));
  shotGoalEl?.addEventListener("change", () => trackSettingsChanged("shot_goal"));

  window.addEventListener("beforeunload", () => {
    trackEvent(
      "page_exit",
      {
        exit_state: state.mode,
        had_aim: !!state.aim,
        shots_taken: state.shots.length,
        had_results: !!state.resultsViewed
      },
      { beacon: true }
    );
  });

  clearStaleTargetContext();
  setPageCopy();
  addQrHotspot();
  resetSimulator(false);
  syncModeUI();
  analytics.lastSettingsSignature = signatureForSettings(getSettingsSnapshot());

  trackEvent("scan", { target: isB2B ? "b2b" : "st100" });
})();
