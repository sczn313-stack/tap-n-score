(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const VIEWBOX = 800;

  const targetSurface = document.getElementById('targetSurface');
  const overlayLayer = document.getElementById('overlayLayer');
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
  const controlsPanel = document.getElementById('controlsPanel');
  const controlsHeading = document.getElementById('controlsHeading');
  const controlsSubhead = document.getElementById('controlsSubhead');
  const setupFields = document.getElementById('setupFields');

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get('mode') === 'demo';

  let state = {
    aim: null,
    shots: [],
    mode: 'aim',
    resultShown: false,
    avgX: null,
    avgY: null
  };

  function setDemoModeUI() {
    if (!isDemoMode) return;

    if (demoModeTag) demoModeTag.hidden = false;

    if (controlsHeading) controlsHeading.textContent = 'Demo Session';
    if (controlsSubhead) {
      controlsSubhead.textContent = 'Tap the aim point, tap your impacts, then show results.';
    }

    if (setupFields) {
      setupFields.classList.add('demo-hidden');
    }
  }

  function setMode(mode) {
    state.mode = mode;

    if (mode === 'aim') {
      modePill.textContent = 'Mode: Select aim point';
      statusText.textContent = 'Tap the bull to place the aim point.';
      if (floatingTop) floatingTop.textContent = 'TAP AIM POINT';
      if (floatingBottom) floatingBottom.textContent = 'Tap Bullet Holes';
      return;
    }

    modePill.textContent = 'Mode: Add shots';
    statusText.textContent = 'Tap your bullet holes, then show results.';
    if (floatingTop) floatingTop.textContent = 'TAP BULLET HOLES';
    if (floatingBottom) floatingBottom.textContent = 'Tap Aim Point';
  }

  function clearOverlay() {
    overlayLayer.innerHTML = '';
  }

  function drawCircle(x, y, radius, fill) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', radius);
    c.setAttribute('fill', fill);
    overlayLayer.appendChild(c);
    return c;
  }

  function drawFrayedHit(x, y) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);

    const outer = document.createElementNS(NS, 'circle');
    outer.setAttribute('r', '5');
    outer.setAttribute('fill', '#2a2a2a');
    outer.setAttribute('opacity', '0.18');

    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', '3.8');
    ring.setAttribute('fill', '#3a302d');
    ring.setAttribute('opacity', '0.95');

    const core = document.createElementNS(NS, 'circle');
    core.setAttribute('r', '2.6');
    core.setAttribute('fill', '#111');

    g.appendChild(outer);
    g.appendChild(ring);
    g.appendChild(core);
    overlayLayer.appendChild(g);
    return g;
  }

  function drawAimPoint(x, y) {
    drawCircle(x, y, 7, '#111');
  }

  function drawGroupCenter(x, y) {
    const halo = document.createElementNS(NS, 'circle');
    halo.setAttribute('cx', x);
    halo.setAttribute('cy', y);
    halo.setAttribute('r', '10');
    halo.setAttribute('fill', '#16a34a');
    halo.setAttribute('opacity', '0.16');
    overlayLayer.appendChild(halo);

    const core = document.createElementNS(NS, 'circle');
    core.setAttribute('cx', x);
    core.setAttribute('cy', y);
    core.setAttribute('r', '5.5');
    core.setAttribute('fill', '#16a34a');
    overlayLayer.appendChild(core);
  }

  function getCoords(e) {
    const rect = targetSurface.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEWBOX,
      y: ((e.clientY - rect.top) / rect.height) * VIEWBOX
    };
  }

  function enableResultsButtons(enable) {
    resultsBtn.disabled = !enable;

    if (enable) {
      inlineResultsBtn.classList.remove('hidden-until-ready');
      inlineResultsBtn.disabled = false;
    } else {
      inlineResultsBtn.classList.add('hidden-until-ready');
      inlineResultsBtn.disabled = true;
    }
  }

  function redrawAll() {
    clearOverlay();

    if (state.aim) {
      drawAimPoint(state.aim.x, state.aim.y);
    }

    state.shots.forEach((shot) => {
      drawFrayedHit(shot.x, shot.y);
    });

    if (state.resultShown && state.avgX !== null && state.avgY !== null) {
      drawGroupCenter(state.avgX, state.avgY);
    }
  }

  function resetSEC() {
    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="sec-empty">Results will appear after you set an aim point and tap your shots.</div>
    `;
  }

  function resetSimulator() {
    state = {
      aim: null,
      shots: [],
      mode: 'aim',
      resultShown: false,
      avgX: null,
      avgY: null
    };

    clearOverlay();
    enableResultsButtons(false);
    setMode('aim');
    resetSEC();
  }

  function handleTap(e) {
    const { x, y } = getCoords(e);

    if (state.mode === 'aim') {
      state.aim = { x, y };
      state.resultShown = false;
      state.avgX = null;
      state.avgY = null;
      redrawAll();
      setMode('shots');
      return;
    }

    state.shots.push({ x, y });
    state.resultShown = false;
    state.avgX = null;
    state.avgY = null;
    redrawAll();

    if (state.shots.length >= 1) {
      enableResultsButtons(true);
    }
  }

  function undoLast() {
    if (state.resultShown) {
      state.resultShown = false;
      state.avgX = null;
      state.avgY = null;
      redrawAll();
      resetSEC();
      if (state.shots.length > 0) enableResultsButtons(true);
      return;
    }

    if (state.mode === 'shots' && state.shots.length > 0) {
      state.shots.pop();
      redrawAll();
      enableResultsButtons(state.shots.length > 0);
      return;
    }

    if (state.mode === 'shots' && state.aim) {
      state.aim = null;
      setMode('aim');
      redrawAll();
      enableResultsButtons(false);
      resetSEC();
    }
  }

  function describeVertical(dy) {
    if (Math.abs(dy) < 2) return '';
    return dy > 0 ? 'high' : 'low';
  }

  function describeHorizontal(dx) {
    if (Math.abs(dx) < 2) return '';
    return dx > 0 ? 'right' : 'left';
  }

  function buildPositionText(dx, dy) {
    const vertical = describeVertical(dy);
    const horizontal = describeHorizontal(dx);

    if (!vertical && !horizontal) return 'Your impacts are centered';

    if (vertical && horizontal) return `Your impacts are ${vertical}-${horizontal}`;
    if (vertical) return `Your impacts are ${vertical}`;
    return `Your impacts are ${horizontal}`;
  }

  function clickText(rawValue, direction) {
    if (direction === 'NONE') return 'No change';
    return `${rawValue.toFixed(1)} clicks ${direction}`;
  }

  function calculateResults() {
    if (!state.aim || state.shots.length === 0) return;

    const avgX = state.shots.reduce((sum, shot) => sum + shot.x, 0) / state.shots.length;
    const avgY = state.shots.reduce((sum, shot) => sum + shot.y, 0) / state.shots.length;

    state.avgX = avgX;
    state.avgY = avgY;
    state.resultShown = true;

    redrawAll();

    const dx = avgX - state.aim.x;
    const dy = state.aim.y - avgY;

    const windDir = dx > 0 ? 'LEFT' : dx < 0 ? 'RIGHT' : 'NONE';
    const elevDir = dy > 0 ? 'UP' : dy < 0 ? 'DOWN' : 'NONE';

    const clicksX = Math.abs(dx / 10);
    const clicksY = Math.abs(dy / 10);

    const positionText = buildPositionText(dx, dy);

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>

      <div class="metric" style="margin-bottom: 12px;">
        <div class="metric-label">Pattern Read</div>
        <div class="metric-value">${positionText}</div>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <div class="metric-label">Windage</div>
          <div class="metric-value">${clickText(clicksX, windDir)}</div>
        </div>

        <div class="metric">
          <div class="metric-label">Elevation</div>
          <div class="metric-value">${clickText(clicksY, elevDir)}</div>
        </div>
      </div>

      <div class="sec-callout">
        Understand and act on your performance
      </div>

      <div class="sec-footer">
        Group center shown on target. Internal math is hidden from the shooter.
      </div>
    `;

    modePill.textContent = 'Mode: Results ready';
    statusText.textContent = 'Your results are ready below.';
    if (floatingTop) floatingTop.textContent = 'RESULTS READY';
    if (floatingBottom) floatingBottom.textContent = 'Review Your SEC';

    secCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  targetSurface.addEventListener('click', handleTap);

  undoBtn.addEventListener('click', undoLast);
  inlineUndoBtn.addEventListener('click', undoLast);

  resetBtn.addEventListener('click', resetSimulator);
  inlineResetBtn.addEventListener('click', resetSimulator);

  resultsBtn.addEventListener('click', calculateResults);
  inlineResultsBtn.addEventListener('click', calculateResults);

  setDemoModeUI();
  resetSimulator();
})();
