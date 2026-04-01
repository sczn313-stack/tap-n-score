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

  let state = {
    aim: null,
    shots: [],
    mode: 'aim'
  };

  function setMode(mode) {
    state.mode = mode;

    if (mode === 'aim') {
      modePill.textContent = 'Mode: Select aim point';
      statusText.textContent = 'Tap the bull to place the aim point.';
      floatingTop.textContent = 'TAP AIM POINT';
      floatingBottom.textContent = 'Tap Bullet Holes';
    } else {
      modePill.textContent = 'Mode: Add shots';
      statusText.textContent = 'Tap your impacts.';
      floatingTop.textContent = 'TAP BULLET HOLES';
      floatingBottom.textContent = 'Tap Aim Point';
    }
  }

  function clearOverlay() {
    overlayLayer.innerHTML = '';
  }

  function drawPoint(x, y, color, size = 6) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', size);
    c.setAttribute('fill', color);
    overlayLayer.appendChild(c);
  }

  function getCoords(e) {
    const rect = targetSurface.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEWBOX,
      y: ((e.clientY - rect.top) / rect.height) * VIEWBOX
    };
  }

  function handleTap(e) {
    const { x, y } = getCoords(e);

    if (state.mode === 'aim') {
      state.aim = { x, y };
      clearOverlay();
      drawPoint(x, y, '#111', 7);
      setMode('shots');
      return;
    }

    state.shots.push({ x, y });
    drawPoint(x, y, '#d11');

    if (state.shots.length >= 1) {
      resultsBtn.disabled = false;
      inlineResultsBtn.classList.remove('hidden-until-ready');
    }
  }

  function undoLast() {
    if (state.mode === 'shots' && state.shots.length > 0) {
      state.shots.pop();
      redrawAll();
      return;
    }

    if (state.mode === 'shots' && state.aim) {
      state.aim = null;
      setMode('aim');
      redrawAll();
    }
  }

  function redrawAll() {
    clearOverlay();

    if (state.aim) {
      drawPoint(state.aim.x, state.aim.y, '#111', 7);
    }

    state.shots.forEach(s => {
      drawPoint(s.x, s.y, '#d11');
    });
  }

  function resetSimulator() {
    state = { aim: null, shots: [], mode: 'aim' };
    clearOverlay();
    setMode('aim');

    resultsBtn.disabled = true;
    inlineResultsBtn.classList.add('hidden-until-ready');

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="sec-empty">Run a session to see results.</div>
    `;
  }

  function calculateResults() {
    if (!state.aim || state.shots.length === 0) return;

    const avgX =
      state.shots.reduce((a, s) => a + s.x, 0) / state.shots.length;
    const avgY =
      state.shots.reduce((a, s) => a + s.y, 0) / state.shots.length;

    drawPoint(avgX, avgY, '#0a0', 7);

    const dx = avgX - state.aim.x;
    const dy = state.aim.y - avgY;

    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-label">POIB X</div>
          <div class="metric-value">${dx.toFixed(1)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">POIB Y</div>
          <div class="metric-value">${dy.toFixed(1)}</div>
        </div>
      </div>
      <div class="sec-callout">
        This shows what happened — and what to do next.
      </div>
    `;
  }

  targetSurface.addEventListener('click', handleTap);

  undoBtn.addEventListener('click', undoLast);
  inlineUndoBtn.addEventListener('click', undoLast);

  resetBtn.addEventListener('click', resetSimulator);
  inlineResetBtn.addEventListener('click', resetSimulator);

  resultsBtn.addEventListener('click', calculateResults);
  inlineResultsBtn.addEventListener('click', calculateResults);

  setMode('aim');
  resetSimulator();
})();
