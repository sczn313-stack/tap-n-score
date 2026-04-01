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
  const controlsHeading = document.getElementById('controlsHeading');
  const controlsSubhead = document.getElementById('controlsSubhead');
  const setupFields = document.getElementById('setupFields');

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get('mode') === 'demo';

  const state = {
    aim: null,
    shots: [],
    mode: 'aim',
    resultShown: false,
    groupCenter: null,
  };

  /**
   * ============================================================
   * DIRECTION TRUTH LOCK
   * ============================================================
   *
   * Screen-space truth:
   * - X increases to the RIGHT
   * - Y increases DOWNWARD
   *
   * Error definition:
   * - dx = impactCenter.x - aim.x
   * - dy = impactCenter.y - aim.y
   *
   * Therefore:
   * - dx > 0  => impacts are RIGHT  => correction is LEFT
   * - dx < 0  => impacts are LEFT   => correction is RIGHT
   *
   * - dy > 0  => impacts are LOW    => correction is UP
   * - dy < 0  => impacts are HIGH   => correction is DOWN
   *
   * Never infer direction anywhere else.
   * Always derive from signed deltas here.
   */
  function deriveDirectionTruth(aim, groupCenter) {
    const dx = groupCenter.x - aim.x;
    const dy = groupCenter.y - aim.y;

    const horizontalPosition =
      dx > 0 ? 'right' : dx < 0 ? 'left' : 'centered';

    const verticalPosition =
      dy > 0 ? 'low' : dy < 0 ? 'high' : 'centered';

    const windageDirection =
      dx > 0 ? 'LEFT' : dx < 0 ? 'RIGHT' : 'NONE';

    const elevationDirection =
      dy > 0 ? 'UP' : dy < 0 ? 'DOWN' : 'NONE';

    return {
      dx,
      dy,
      horizontalPosition,
      verticalPosition,
      windageDirection,
      elevationDirection,
    };
  }

  function setDemoModeUI() {
    if (controlsHeading) {
      controlsHeading.textContent = 'Zero Target';
    }

    if (controlsSubhead) {
      controlsSubhead.innerHTML = `
        <span style="color:#16a34a;font-weight:900;animation:sczn3Pulse 1.2s ease-in-out infinite;">Tap Aim Point</span>
        &nbsp;→&nbsp;
        Tap 3–5 Impacts
        &nbsp;→&nbsp;
        Tap Results
      `;
    }

    if (isDemoMode) {
      if (demoModeTag) demoModeTag.hidden = false;
      if (setupFields) setupFields.classList.add('demo-hidden');
    }
  }

  function setMode(mode) {
    state.mode = mode;

    if (mode === 'aim') {
      modePill.textContent = 'Mode: Aim Point';
      statusText.textContent = 'Tap Aim Point';
      if (floatingTop) floatingTop.textContent = 'TAP AIM POINT';
      if (floatingBottom) floatingBottom.textContent = 'Tap 3–5 Impacts';
      return;
    }

    if (mode === 'shots') {
      modePill.textContent = 'Mode: Impacts';
      statusText.textContent = 'Tap 3–5 Impacts';
      if (floatingTop) floatingTop.textContent = 'TAP 3–5 IMPACTS';
      if (floatingBottom) floatingBottom.textContent = 'Tap Results';
      return;
    }

    modePill.textContent = 'Mode: Results';
    statusText.textContent = 'Tap Results';
    if (floatingTop) floatingTop.textContent = 'TAP RESULTS';
    if (floatingBottom) floatingBottom.textContent = 'Review Your SEC';
  }

  function clearOverlay() {
    overlayLayer.innerHTML = '';
  }

  function drawCircle(x, y, radius, fill, opacity = 1) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', radius);
    c.setAttribute('fill', fill);
    c.setAttribute('opacity', opacity);
    overlayLayer.appendChild(c);
    return c;
  }

  function drawAimPoint(x, y) {
    drawCircle(x, y, 7, '#111');
  }

  function drawFrayedHit(x, y) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);

    const outer = document.createElementNS(NS, 'circle');
    outer.setAttribute('r', '4.8');
    outer.setAttribute('fill', '#2a2a2a');
    outer.setAttribute('opacity', '0.16');

    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', '3.5');
    ring.setAttribute('fill', '#352d2b');
    ring.setAttribute('opacity', '0.95');

    const core = document.createElementNS(NS, 'circle');
    core.setAttribute('r', '2.2');
    core.setAttribute('fill', '#111');

    g.appendChild(outer);
    g.appendChild(ring);
    g.appendChild(core);
    overlayLayer.appendChild(g);
    return g;
  }

  function drawGroupCenter(x, y) {
    drawCircle(x, y, 10, '#16a34a', 0.18);
    drawCircle(x, y, 5.5, '#16a34a', 1);
  }

  function getCoords(e) {
    const rect = targetSurface.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEWBOX,
      y: ((e.clientY - rect.top) / rect.height) * VIEWBOX,
    };
  }

  function enableResultsButtons(enable) {
    resultsBtn.disabled = !enable;
    inlineResultsBtn.disabled = !enable;

    if (enable) {
      inlineResultsBtn.classList.remove('hidden-until-ready');
    } else {
      inlineResultsBtn.classList.add('hidden-until-ready');
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

    if (state.resultShown && state.groupCenter) {
      drawGroupCenter(state.groupCenter.x, state.groupCenter.y);
    }
  }

  function resetSEC() {
    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="sec-empty">Results will appear after you tap an aim point, tap 3–5 impacts, and tap Results.</div>
    `;
  }

  function resetSimulator() {
    state.aim = null;
    state.shots = [];
    state.mode = 'aim';
    state.resultShown = false;
    state.groupCenter = null;

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
      state.groupCenter = null;
      redrawAll();
      setMode('shots');
      return;
    }

    state.shots.push({ x, y });
    state.resultShown = false;
    state.groupCenter = null;
    redrawAll();

    if (state.shots.length >= 1) {
      enableResultsButtons(true);
    }
  }

  function undoLast() {
    if (state.resultShown) {
      state.resultShown = false;
      state.groupCenter = null;
      redrawAll();
      resetSEC();
      setMode(state.aim ? 'shots' : 'aim');
      enableResultsButtons(state.shots.length > 0);
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

  function computeGroupCenter() {
    const avgX =
      state.shots.reduce((sum, shot) => sum + shot.x, 0) / state.shots.length;
    const avgY =
      state.shots.reduce((sum, shot) => sum + shot.y, 0) / state.shots.length;

    return { x: avgX, y: avgY };
  }

  function buildPositionText(verticalPosition, horizontalPosition) {
    const vertical =
      verticalPosition === 'centered' ? '' : verticalPosition;
    const horizontal =
      horizontalPosition === 'centered' ? '' : horizontalPosition;

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

    const groupCenter = computeGroupCenter();
    state.groupCenter = groupCenter;
    state.resultShown = true;

    const truth = deriveDirectionTruth(state.aim, groupCenter);

    redrawAll();
    setMode('results');

    const positionText = buildPositionText(
      truth.verticalPosition,
      truth.horizontalPosition
    );

    const clicksX = Math.abs(truth.dx / 10);
    const clicksY = Math.abs(truth.dy / 10);

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>

      <div class="metric" style="margin-bottom: 12px;">
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
    `;

    secCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function injectPulseKeyframes() {
    if (document.getElementById('sczn3-pulse-style')) return;

    const style = document.createElement('style');
    style.id = 'sczn3-pulse-style';
    style.textContent = `
      @keyframes sczn3Pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
    `;
    document.head.appendChild(style);
  }

  targetSurface.addEventListener('click', handleTap);

  undoBtn.addEventListener('click', undoLast);
  inlineUndoBtn.addEventListener('click', undoLast);

  resetBtn.addEventListener('click', resetSimulator);
  inlineResetBtn.addEventListener('click', resetSimulator);

  resultsBtn.addEventListener('click', calculateResults);
  inlineResultsBtn.addEventListener('click', calculateResults);

  injectPulseKeyframes();
  setDemoModeUI();
  resetSimulator();
})();
