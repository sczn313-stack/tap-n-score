(() => {
  const MIN_SHOTS = 3;
  const MAX_SHOTS = 5;
  const TRUE_MOA_INCHES_AT_100 = 1.047;

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get('mode') === 'demo';

  const vendor = params.get('v') || 'unknown';
  const sku = params.get('sku') || 'unknown';
  const mode = params.get('mode') || 'live';

  const TRACK_ENDPOINT = '/api/track';

  const sessionId = (() => {
    const key = 'sczn3_sim_session_id';
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = 'sim_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, value);
    }
    return value;
  })();

  const targetSurface = document.getElementById('targetSurface');
  const tapLayer = document.getElementById('tapLayer');
  const secCard = document.getElementById('secCard');

  const modePill = document.getElementById('modePill');
  const statusText = document.getElementById('statusText');

  const resultsBtn = document.getElementById('resultsBtn');
  const inlineResultsBtn = document.getElementById('inlineResultsBtn');

  const undoBtn = document.getElementById('undoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const inlineUndoBtn = document.getElementById('inlineUndoBtn');
  const inlineResetBtn = document.getElementById('inlineResetBtn');

  const demoModeTag = document.getElementById('demoModeTag');
  const controlsHeading = document.getElementById('controlsHeading');
  const controlsSubhead = document.getElementById('controlsSubhead');
  const setupFields = document.getElementById('setupFields');

  const simInstructionTop = document.getElementById('simInstructionTop');

  const stepAimBar = document.getElementById('stepAimBar');
  const stepShotsBar = document.getElementById('stepShotsBar');
  const stepResultsBar = document.getElementById('stepResultsBar');

  const distanceYardsEl = document.getElementById('distanceYards');
  const clickValueMOAEl = document.getElementById('clickValueMOA');
  const shotGoalEl = document.getElementById('shotGoal');

  const state = {
    aim: null,
    shots: [],
    mode: 'aim',
    groupCenter: null,
    qrLive: false
  };

  let qrHotspot = null;

  const vendorMap = {
    baker: {
      base: 'https://baker-targets.com/',
      sku: {
        st100: 'https://baker-targets.com/',
        default: 'https://baker-targets.com/'
      }
    }
  };

  function getVendorUrl() {
    if (!vendor || !vendorMap[vendor]) return 'https://baker-targets.com/';
    const vendorObj = vendorMap[vendor];
    if (sku && vendorObj.sku[sku]) return vendorObj.sku[sku];
    return vendorObj.sku.default || vendorObj.base;
  }

  function buildTrackPayload(eventName, extra = {}) {
    return {
      event: eventName,
      vendor,
      sku,
      mode,
      session_id: sessionId,
      page: 'Sim',
      ts: new Date().toISOString(),
      ...extra
    };
  }

  function trackEvent(eventName, extra = {}) {
    const payload = buildTrackPayload(eventName, extra);

    fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }

  function deriveDirectionTruth(aim, groupCenter) {
    const dx = groupCenter.xPct - aim.xPct;
    const dy = groupCenter.yPct - aim.yPct;

    return {
      dx,
      dy,
      horizontalPosition: dx > 0 ? 'right' : dx < 0 ? 'left' : 'centered',
      verticalPosition: dy > 0 ? 'low' : dy < 0 ? 'high' : 'centered',
      windageDirection: dx > 0 ? 'LEFT' : dx < 0 ? 'RIGHT' : 'NONE',
      elevationDirection: dy > 0 ? 'UP' : dy < 0 ? 'DOWN' : 'NONE'
    };
  }

  function setPageCopy() {
    document.title = 'Tap-n-Score™ Optic Zero Trainer';

    if (controlsHeading) {
      controlsHeading.textContent = 'Optic Zero Trainer';
    }

    if (controlsSubhead) {
      controlsSubhead.textContent = 'Tap Aim Point • Tap 3–5 Shots • Get Scope Adjustments';
    }

    if (isDemoMode && demoModeTag) {
      demoModeTag.hidden = false;
    }

    if (isDemoMode && setupFields) {
      setupFields.classList.add('demo-hidden');
    }
  }

  function setInstruction(text, stateClass) {
    simInstructionTop.textContent = text;
    simInstructionTop.classList.remove('state-aim', 'state-shots', 'state-results');
    simInstructionTop.classList.add(stateClass, 'state-bump');

    window.setTimeout(() => {
      simInstructionTop.classList.remove('state-bump');
    }, 240);
  }

  function setStepBar(active) {
    stepAimBar.className = 'step-chip aim';
    stepShotsBar.className = 'step-chip shots';
    stepResultsBar.className = 'step-chip results';

    if (active === 'aim') stepAimBar.classList.add('is-active');
    if (active === 'shots') stepShotsBar.classList.add('is-active');
    if (active === 'results') stepResultsBar.classList.add('is-active');
  }

  function enableResultsButtons(enable) {
    resultsBtn.disabled = !enable;
    inlineResultsBtn.disabled = !enable;
  }

  function syncModeUI() {
    if (state.mode === 'aim') {
      modePill.textContent = 'Mode: Aim Point';
      statusText.textContent = 'Tap Aim Point';
      setInstruction('TAP AIM POINT', 'state-aim');
      setStepBar('aim');
      enableResultsButtons(false);
      return;
    }

    if (state.mode === 'shots') {
      modePill.textContent = 'Mode: Shots';
      statusText.textContent = `Tap 3–5 Shots (${state.shots.length}/${getShotGoal()})`;
      setInstruction('TAP 3–5 SHOTS', 'state-shots');
      setStepBar('shots');
      enableResultsButtons(false);
      return;
    }

    if (state.mode === 'ready') {
      modePill.textContent = 'Mode: Ready';
      statusText.textContent = `Get Scope Adjustments (${state.shots.length}/${getShotGoal()} shots set)`;
      setInstruction('GET SCOPE ADJUSTMENTS', 'state-results');
      setStepBar('results');
      enableResultsButtons(true);
      return;
    }

    modePill.textContent = 'Mode: Adjustments Ready';
    statusText.textContent = 'Scope adjustments ready';
    setInstruction('SCOPE ADJUSTMENTS READY', 'state-results');
    setStepBar('results');
    enableResultsButtons(true);
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

  function createAimMarker(xPct, yPct) {
    const node = document.createElement('div');
    node.className = 'marker aim';
    node.style.left = `${xPct}%`;
    node.style.top = `${yPct}%`;

    const center = document.createElement('div');
    center.className = 'aim-center';
    node.appendChild(center);

    tapLayer.appendChild(node);
  }

  function createMarker(xPct, yPct, className) {
    const node = document.createElement('div');
    node.className = `marker ${className}`;
    node.style.left = `${xPct}%`;
    node.style.top = `${yPct}%`;
    tapLayer.appendChild(node);
    return node;
  }

  function clearMarkers() {
    tapLayer.querySelectorAll('.marker').forEach((node) => node.remove());
  }

  function redrawAll() {
    clearMarkers();

    if (state.aim) {
      createAimMarker(state.aim.xPct, state.aim.yPct);
    }

    state.shots.forEach((shot) => {
      createMarker(shot.xPct, shot.yPct, 'hit');
    });

    if (state.groupCenter) {
      createMarker(state.groupCenter.xPct, state.groupCenter.yPct, 'group-center-halo');
      createMarker(state.groupCenter.xPct, state.groupCenter.yPct, 'group-center-core');
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
    qrHotspot.classList.toggle('qr-live', isLive);
    qrHotspot.style.cursor = isLive ? 'pointer' : 'default';
  }

  function handleQrClick(e) {
    e.stopPropagation();
    if (!state.qrLive) return;

    const destination = getVendorUrl();

    trackEvent('vendor_click', {
      source: 'qr_hotspot',
      destination
    });

    window.open(destination, '_blank', 'noopener,noreferrer');
  }

  function addQrHotspot() {
    if (qrHotspot) return;

    qrHotspot = document.createElement('div');
    qrHotspot.className = 'qr-hotspot';

    qrHotspot.style.left = '78.8%';
    qrHotspot.style.top = '1.6%';
    qrHotspot.style.width = '16.2%';
    qrHotspot.style.height = '11.6%';

    qrHotspot.addEventListener('click', handleQrClick);
    targetSurface.appendChild(qrHotspot);
    setQrLive(false);
  }

  function resetSEC() {
    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="sec-empty">
        Results will appear after you tap an aim point,
        tap 3–5 shots, and get scope adjustments.
      </div>
    `;
  }

  function resetSimulator() {
    state.aim = null;
    state.shots = [];
    state.mode = 'aim';
    state.groupCenter = null;

    clearMarkers();
    resetSEC();
    setQrLive(false);
    syncModeUI();
  }

  function recomputeModeFromState() {
    if (!state.aim) {
      state.mode = 'aim';
      return;
    }

    if (state.groupCenter) {
      state.mode = 'results';
      return;
    }

    if (state.shots.length >= Math.min(getShotGoal(), MAX_SHOTS)) {
      state.mode = 'ready';
      return;
    }

    state.mode = 'shots';
  }

  function handleTap(e) {
    if (state.mode === 'results') return;

    const pos = getRelativeCoords(e);

    if (!state.aim) {
      state.aim = pos;
      state.groupCenter = null;
      recomputeModeFromState();
      redrawAll();
      syncModeUI();
      return;
    }

    if (state.shots.length >= Math.min(getShotGoal(), MAX_SHOTS)) return;

    state.shots.push(pos);
    state.groupCenter = null;
    recomputeModeFromState();
    redrawAll();
    syncModeUI();
  }

  function undoLast() {
    if (state.mode === 'results') {
      state.groupCenter = null;
      setQrLive(false);
      recomputeModeFromState();
      redrawAll();
      resetSEC();
      syncModeUI();
      return;
    }

    if (state.shots.length > 0) {
      state.shots.pop();
      state.groupCenter = null;
      setQrLive(false);
      recomputeModeFromState();
      redrawAll();
      syncModeUI();
      return;
    }

    if (state.aim) {
      state.aim = null;
      state.groupCenter = null;
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

  function calculateGroupSizeInches(scaleInchesPerPercent) {
    if (state.shots.length < 2) return 0;

    let maxDistance = 0;

    for (let i = 0; i < state.shots.length; i++) {
      for (let j = i + 1; j < state.shots.length; j++) {
        const dx = (state.shots[j].xPct - state.shots[i].xPct) * scaleInchesPerPercent;
        const dy = (state.shots[j].yPct - state.shots[i].yPct) * scaleInchesPerPercent;
        const d = Math.hypot(dx, dy);
        if (d > maxDistance) maxDistance = d;
      }
    }

    return maxDistance;
  }

  function round1(v) {
    return Number(v).toFixed(1);
  }

  function round2(v) {
    return Number(v).toFixed(2);
  }

  function moveArrow(verticalDir, horizontalDir) {
    if (verticalDir !== 'NONE' && horizontalDir !== 'NONE') {
      if (verticalDir === 'UP' && horizontalDir === 'LEFT') return '↖';
      if (verticalDir === 'UP' && horizontalDir === 'RIGHT') return '↗';
      if (verticalDir === 'DOWN' && horizontalDir === 'LEFT') return '↙';
      return '↘';
    }

    if (verticalDir !== 'NONE') return verticalDir === 'UP' ? '↑' : '↓';
    if (horizontalDir !== 'NONE') return horizontalDir === 'LEFT' ? '←' : '→';
    return '•';
  }

  function metricText(direction, moa, clicks) {
    if (direction === 'NONE') return 'No change';
    return `
      ${direction} ${round2(moa)} MOA
      <span class="clicks">(${round1(clicks)} clicks)</span>
    `;
  }

  function calculateResults() {
    if (!state.aim || state.shots.length < MIN_SHOTS) return;

    state.groupCenter = computeGroupCenter();
    state.mode = 'results';

    const truth = deriveDirectionTruth(state.aim, state.groupCenter);

    const scaleInchesPerPercent = 0.75;
    const dxInches = truth.dx * scaleInchesPerPercent;
    const dyInches = truth.dy * scaleInchesPerPercent;

    const distance = getDistanceYards();
    const clickValue = getClickValueMOA();
    const moaScale = inchesPerMOAAtDistance(distance);

    const windageMOA = Math.abs(dxInches / moaScale);
    const elevationMOA = Math.abs(dyInches / moaScale);

    const clicksX = windageMOA / clickValue;
    const clicksY = elevationMOA / clickValue;

    const groupSizeInches = calculateGroupSizeInches(scaleInchesPerPercent);
    const arrow = moveArrow(truth.elevationDirection, truth.windageDirection);

    redrawAll();
    syncModeUI();
    setQrLive(true);

    trackEvent('results_ready', {
      shots: state.shots.length,
      distance_yards: distance,
      click_value_moa: clickValue
    });

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>

      <div class="sec-title">Scope Adjustments</div>
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
        Distance: ${distance} yd • ${clickValue} MOA/click
      </div>

      <div class="sec-actions">
        <button type="button" class="primary" id="secTryAgainBtn">Try Again</button>
        <button type="button" id="secBuyMoreBtn">Buy More Targets Like This</button>
      </div>

      <div class="sec-footer">Powered by SCZN3 Precision</div>
    `;

    const secTryAgainBtn = document.getElementById('secTryAgainBtn');
    const secBuyMoreBtn = document.getElementById('secBuyMoreBtn');

    if (secTryAgainBtn) {
      secTryAgainBtn.addEventListener('click', resetSimulator);
    }

    if (secBuyMoreBtn) {
      secBuyMoreBtn.addEventListener('click', () => {
        const destination = getVendorUrl();

        trackEvent('vendor_click', {
          source: 'buy_more_button',
          destination
        });

        window.open(destination, '_blank', 'noopener,noreferrer');
      });
    }

    secCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  tapLayer.addEventListener('click', handleTap);

  undoBtn.addEventListener('click', undoLast);
  inlineUndoBtn.addEventListener('click', undoLast);

  resetBtn.addEventListener('click', resetSimulator);
  inlineResetBtn.addEventListener('click', resetSimulator);

  resultsBtn.addEventListener('click', calculateResults);
  inlineResultsBtn.addEventListener('click', calculateResults);

  setPageCopy();
  addQrHotspot();
  resetSimulator();
  trackEvent('scan', { source: 'sim' });
})();
