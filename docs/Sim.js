(() => {
  const MIN_SHOTS = 3;
  const MAX_SHOTS = 5;
  const TRUE_MOA_INCHES_AT_100 = 1.047;

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get('mode') === 'demo';

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

  const floatingTop = document.getElementById('floatingInstructionTop');
  const floatingBottom = document.getElementById('floatingInstructionBottom');

  const demoModeTag = document.getElementById('demoModeTag');
  const controlsHeading = document.getElementById('controlsHeading');
  const controlsSubhead = document.getElementById('controlsSubhead');
  const setupFields = document.getElementById('setupFields');

  const simInstructionTop = document.getElementById('simInstructionTop');
  const simInstructionSub = document.getElementById('simInstructionSub');

  const topbarTitle = document.querySelector('.topbar h1');
  const topbarSub = document.querySelector('.topbar .sub');

  const distanceYardsEl = document.getElementById('distanceYards');
  const clickValueMOAEl = document.getElementById('clickValueMOA');
  const shotGoalEl = document.getElementById('shotGoal');

  const state = {
    aim: null,
    shots: [],
    mode: 'aim', // aim | shots | ready | results
    groupCenter: null,
    qrLive: false
  };

  let qrHotspot = null;

  // ============================================================
  // DIRECTION TRUTH LOCK
  // ============================================================
  // Screen-space truth:
  // X increases to the RIGHT
  // Y increases DOWNWARD
  //
  // Error definition:
  // dx = groupCenter.x - aim.x
  // dy = groupCenter.y - aim.y
  //
  // Therefore:
  // dx > 0 => impacts RIGHT => correction LEFT
  // dx < 0 => impacts LEFT  => correction RIGHT
  //
  // dy > 0 => impacts LOW   => correction UP
  // dy < 0 => impacts HIGH  => correction DOWN
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
    document.title = 'Tap-n-Score — Zero Target';

    if (topbarTitle) {
      topbarTitle.textContent = 'Tap-n-Score™ Zero Target';
    }

    if (topbarSub) {
      topbarSub.innerHTML = `
        <span class="copy-accent">Tap Aim Point</span>
        &nbsp;&rarr;&nbsp;
        Tap 3–5 Impacts
        &nbsp;&rarr;&nbsp;
        Tap Results
      `;
    }

    if (controlsHeading) {
      controlsHeading.textContent = 'Zero Target';
    }

    if (controlsSubhead) {
      controlsSubhead.innerHTML = `
        <span class="copy-accent">Tap Aim Point</span>
        &nbsp;&rarr;&nbsp;
        Tap 3–5 Impacts
        &nbsp;&rarr;&nbsp;
        Tap Results
      `;
    }

    if (isDemoMode && demoModeTag) {
      demoModeTag.hidden = false;
    }

    if (isDemoMode && setupFields) {
      setupFields.classList.add('demo-hidden');
    }
  }

  function setInstruction(text, mode = 'pulse') {
    if (simInstructionTop) {
      simInstructionTop.textContent = text;
      simInstructionTop.classList.remove('instruction-pulse', 'instruction-steady');
      simInstructionTop.classList.add(mode === 'pulse' ? 'instruction-pulse' : 'instruction-steady');
    }

    if (simInstructionSub) {
      simInstructionSub.textContent = '';
    }

    if (floatingTop) {
      floatingTop.textContent = text;
      floatingTop.classList.remove('instruction-pulse', 'instruction-steady', 'instruction-hidden');
      floatingTop.classList.add(mode === 'pulse' ? 'instruction-pulse' : 'instruction-steady');
    }

    if (floatingBottom) {
      floatingBottom.textContent = '';
      floatingBottom.classList.add('instruction-hidden');
    }
  }

  function enableResultsButtons(enable) {
    resultsBtn.disabled = !enable;
    inlineResultsBtn.disabled = !enable;

    if (enable) {
      resultsBtn.classList.add('results-live');
      inlineResultsBtn.classList.remove('hidden-until-ready');
      inlineResultsBtn.classList.add('results-live');
    } else {
      resultsBtn.classList.remove('results-live');
      inlineResultsBtn.classList.add('hidden-until-ready');
      inlineResultsBtn.classList.remove('results-live');
    }
  }

  function syncModeUI() {
    if (state.mode === 'aim') {
      modePill.textContent = 'Mode: Aim Point';
      statusText.textContent = 'Tap Aim Point';
      setInstruction('TAP AIM POINT', 'pulse');
      enableResultsButtons(false);
      return;
    }

    if (state.mode === 'shots') {
      modePill.textContent = 'Mode: Impacts';
      statusText.textContent = `Tap 3–5 Impacts (${state.shots.length}/${getShotGoal()})`;
      setInstruction('TAP 3–5 IMPACTS', 'pulse');
      enableResultsButtons(false);
      return;
    }

    if (state.mode === 'ready') {
      modePill.textContent = 'Mode: Results';
      statusText.textContent = `Tap Results (${state.shots.length}/${getShotGoal()} impacts set)`;
      setInstruction('TAP RESULTS', 'pulse');
      enableResultsButtons(true);
      return;
    }

    modePill.textContent = 'Mode: Results Ready';
    statusText.textContent = 'Results Ready';
    setInstruction('RESULTS READY', 'steady');
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
      createMarker(state.aim.xPct, state.aim.yPct, 'aim');
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

    // Placeholder destination. Swap later.
    window.open('https://tap-n-score.com/', '_blank', 'noopener,noreferrer');
  }

  function addQrHotspot() {
    if (qrHotspot) return;

    qrHotspot = document.createElement('div');
    qrHotspot.className = 'qr-hotspot';

    // Locked to the printed QR on IMG_4174.jpeg
    // Adjusted to cover the visible QR + words around it.
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
        Results will appear after you tap an aim point, tap 3–5 impacts, and tap Results.
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

  function buildPositionText(verticalPosition, horizontalPosition) {
    const vertical = verticalPosition === 'centered' ? '' : verticalPosition;
    const horizontal = horizontalPosition === 'centered' ? '' : horizontalPosition;

    if (!vertical && !horizontal) return 'Your impacts are centered';
    if (vertical && horizontal) return `Your impacts are ${vertical}-${horizontal}`;
    if (vertical) return `Your impacts are ${vertical}`;
    return `Your impacts are ${horizontal}`;
  }

  function inchesPerMOAAtDistance(distanceYards) {
    return TRUE_MOA_INCHES_AT_100 * (distanceYards / 100);
  }

  function clickText(rawValue, direction) {
    if (direction === 'NONE') return 'No change';
    return `${rawValue.toFixed(1)} clicks ${direction}`;
  }

  function calculateResults() {
    if (!state.aim || state.shots.length < MIN_SHOTS) return;

    state.groupCenter = computeGroupCenter();
    state.mode = 'results';

    const truth = deriveDirectionTruth(state.aim, state.groupCenter);
    const positionText = buildPositionText(truth.verticalPosition, truth.horizontalPosition);

    // Demo scaling from percent-of-image space into inch-like behavior
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

    redrawAll();
    syncModeUI();
    setQrLive(true);

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>

      <div class="metric sec-highlight" style="margin-bottom: 12px;">
        <div class="metric-label">Pattern Read</div>
        <div class="metric-value">${positionText}</div>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <div class="metric-label">Windage</div>
          <div class="metric-value">${clickText(clicksX, truth.windageDirection)}</div>
        </div>

        <div class="metric">
          <div class="metric-label">Elevation</div>
          <div class="metric-value">${clickText(clicksY, truth.elevationDirection)}</div>
        </div>
      </div>

      <div class="sec-callout">
        Understand and act on your performance
      </div>

      <div class="sec-footer">
        Scan the Smart Target QR to continue.
      </div>
    `;

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
})();
