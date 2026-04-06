(() => {
  const MIN_SHOTS = 3;
  const TRUE_MOA_INCHES_AT_100 = 1.047;
  const TRACK_ENDPOINT = "https://tap-n-score-backend.onrender.com/api/track";
  const DEBUG_ANALYTICS = true;
  const INCHES_PER_PERCENT = 0.75;
  const SEC_PAYLOAD_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const SEC_TARGET_KEY = "SCZN3_SEC_TARGET_KEY_V1";

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

  const inferredVendor =
    vendor !== "unknown"
      ? vendor
      : storedActiveTarget === "bkr-b2b" || storedB2BEntryContext?.vendor === "baker"
      ? "baker"
      : "unknown";

  const inferredSku =
    sku !== "unknown"
      ? sku
      : storedActiveTarget || storedB2BEntryContext?.sku || "unknown";

  const targetKey = `${inferredVendor}:${inferredSku}:${mode || "live"}:${batch || ""}`;

  const targetSurface = document.getElementById("targetSurface");
  const overlayLayer = document.getElementById("overlayLayer");
  const ringLayer = document.getElementById("ringLayer");
  const secCard = document.getElementById("secCard");
  const modePill = document.getElementById("modePill");
  const statusText = document.getElementById("statusText");
  const distanceYardsEl = document.getElementById("distanceYards");
  const clickValueMOAEl = document.getElementById("clickValueMOA");
  const shotGoalEl = document.getElementById("shotGoal");
  const ringSpacingInchesEl = document.getElementById("ringSpacingInches");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const resultsBtn = document.getElementById("resultsBtn");

  const controlsPanel = document.getElementById("controlsPanel");
  const controlsHeading = document.getElementById("controlsHeading");
  const demoModeTag = document.getElementById("demoModeTag");
  const simInstructionTop = document.getElementById("simInstructionTop");

  if (!targetSurface || !overlayLayer || !ringLayer || !resultsBtn) return;

  let aimPoint = null;
  let shots = [];
  let distanceYards = Number(distanceYardsEl?.value || 100);
  let clickValueMOA = Number(clickValueMOAEl?.value || 0.25);
  let ringSpacingInches = Number(ringSpacingInchesEl?.value || 1.0);

  function setStatus(msg) {
    if (statusText) statusText.textContent = msg;
  }

  function updateButtons() {
    if (undoBtn) undoBtn.disabled = !aimPoint && shots.length === 0;
    if (resetBtn) resetBtn.disabled = !aimPoint && shots.length === 0;
    if (resultsBtn) resultsBtn.disabled = !aimPoint || shots.length < MIN_SHOTS;
  }

  function clearOverlay() {
    overlayLayer.innerHTML = "";
    ringLayer.innerHTML = "";
  }

  function drawCircle(x, y, r, cls) {
    const el = document.createElement("div");
    el.className = cls;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    overlayLayer.appendChild(el);
    return el;
  }

  function drawLine(x1, y1, x2, y2, cls = "sim-line") {
    const line = document.createElement("div");
    line.className = cls;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    line.style.left = `${x1}px`;
    line.style.top = `${y1}px`;
    line.style.width = `${len}px`;
    line.style.transform = `rotate(${angle}deg)`;
    overlayLayer.appendChild(line);
    return line;
  }

  function getRelativePoint(evt) {
    const rect = targetSurface.getBoundingClientRect();
    const clientX = evt.clientX ?? (evt.touches && evt.touches[0]?.clientX);
    const clientY = evt.clientY ?? (evt.touches && evt.touches[0]?.clientY);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      w: rect.width,
      h: rect.height
    };
  }

  function render() {
    clearOverlay();

    if (aimPoint) {
      drawCircle(aimPoint.x, aimPoint.y, 8, "aim-point");
    }

    shots.forEach((shot) => {
      drawCircle(shot.x, shot.y, 6, "shot-point");
    });

    if (aimPoint && shots.length >= 1) {
      const cx = shots.reduce((sum, s) => sum + s.x, 0) / shots.length;
      const cy = shots.reduce((sum, s) => sum + s.y, 0) / shots.length;
      drawCircle(cx, cy, 10, "poib-point");
      drawLine(aimPoint.x, aimPoint.y, cx, cy);
    }

    updateButtons();
  }

  function percentToInches(dxPercent, dyPercent) {
    return {
      x: dxPercent * INCHES_PER_PERCENT,
      y: dyPercent * INCHES_PER_PERCENT
    };
  }

  function inchesPerMOA(distance) {
    return TRUE_MOA_INCHES_AT_100 * (distance / 100);
  }

  function computeResults() {
    if (!aimPoint || shots.length < MIN_SHOTS) return null;

    const cx = shots.reduce((sum, s) => sum + s.x, 0) / shots.length;
    const cy = shots.reduce((sum, s) => sum + s.y, 0) / shots.length;

    const rect = targetSurface.getBoundingClientRect();
    const dxPercent = ((cx - aimPoint.x) / rect.width) * 100;
    const dyPercent = ((cy - aimPoint.y) / rect.height) * 100;

    const offsetInches = percentToInches(dxPercent, dyPercent);
    const moaPerInch = inchesPerMOA(distanceYards);

    const windageMOA = Math.abs(offsetInches.x) / moaPerInch;
    const elevationMOA = Math.abs(offsetInches.y) / moaPerInch;

    const windageClicks = windageMOA / clickValueMOA;
    const elevationClicks = elevationMOA / clickValueMOA;

    const windageDir = offsetInches.x > 0 ? "LEFT" : offsetInches.x < 0 ? "RIGHT" : "—";
    const elevationDir = offsetInches.y > 0 ? "UP" : offsetInches.y < 0 ? "DOWN" : "—";

    const spread = Math.max(
      ...shots.map((a) =>
        Math.max(
          ...shots.map((b) => Math.hypot(a.x - b.x, a.y - b.y))
        )
      )
    );

    const scoreValue = Math.max(
      0,
      Math.round(
        100 -
          Math.min(60, Math.hypot(offsetInches.x, offsetInches.y) * 8) -
          Math.min(40, (spread / rect.width) * 100)
      )
    );

    return {
      score: scoreValue,
      shots: shots.length,
      distance_yards: distanceYards,
      click_value_moa: clickValueMOA,
      offset_inches: {
        x: Number(offsetInches.x.toFixed(2)),
        y: Number(offsetInches.y.toFixed(2))
      },
      windage_clicks: Number(windageClicks.toFixed(2)),
      elevation_clicks: Number(elevationClicks.toFixed(2)),
      windage_dir: windageDir,
      elevation_dir: elevationDir,
      vendor: inferredVendor,
      sku: inferredSku,
      mode,
      batch,
      target_key: targetKey,
      timestamp: Date.now()
    };
  }

  async function trackAnalytics(payload) {
    if (!TRACK_ENDPOINT) return;
    try {
      if (DEBUG_ANALYTICS) console.log("TRACK PAYLOAD", payload);
      await fetch(TRACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Analytics tracking failed", err);
    }
  }

  targetSurface.addEventListener("click", (evt) => {
    const point = getRelativePoint(evt);

    if (!aimPoint) {
      aimPoint = point;
      setStatus("Aim point set. Add at least 3 shots.");
      render();
      return;
    }

    shots.push(point);
    setStatus(`Shots added: ${shots.length}`);
    render();
  });

  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      if (shots.length > 0) {
        shots.pop();
      } else if (aimPoint) {
        aimPoint = null;
      }
      render();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      aimPoint = null;
      shots = [];
      setStatus("Reset. Tap aim point first.");
      render();
    });
  }

  if (distanceYardsEl) {
    distanceYardsEl.addEventListener("change", () => {
      distanceYards = Number(distanceYardsEl.value || 100);
    });
  }

  if (clickValueMOAEl) {
    clickValueMOAEl.addEventListener("change", () => {
      clickValueMOA = Number(clickValueMOAEl.value || 0.25);
    });
  }

  if (ringSpacingInchesEl) {
    ringSpacingInchesEl.addEventListener("change", () => {
      ringSpacingInches = Number(ringSpacingInchesEl.value || 1.0);
    });
  }

  resultsBtn.addEventListener("click", async () => {
    const payload = computeResults();
    if (!payload) {
      alert("Set aim point and add at least 3 shots.");
      return;
    }

    sessionStorage.setItem(SEC_PAYLOAD_KEY, JSON.stringify(payload));
    sessionStorage.setItem(SEC_TARGET_KEY, targetKey);
    sessionStorage.setItem("sczn3_last_result", JSON.stringify(payload));

    await trackAnalytics({
      event: "show_results",
      vendor: inferredVendor,
      sku: inferredSku,
      mode,
      batch,
      target_key: targetKey,
      shots: payload.shots,
      score: payload.score
    });

    window.location.href = "sec.html?cb=" + Date.now();
  });

  if (modePill) {
    modePill.textContent = isDemoMode ? "DEMO MODE" : "LIVE MODE";
  }

  if (demoModeTag) {
    demoModeTag.hidden = !isDemoMode;
  }

  if (simInstructionTop) {
    simInstructionTop.textContent = "Tap aim point first, then tap bullet holes.";
  }

  setStatus("Tap aim point first.");
  render();
})();
