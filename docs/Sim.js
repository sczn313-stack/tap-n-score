(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const VIEWBOX = 800;
  const MIN_SHOTS = 3;
  const MAX_SHOTS = 5;

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get('mode') === 'demo';

  const targetSurface = document.getElementById('targetSurface');
  const overlayLayer = document.getElementById('overlayLayer');
  const ringLayer = document.getElementById('ringLayer');
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

  const state = {
    aim: null,
    shots: [],
    mode: 'aim', // aim | shots | ready | results
    groupCenter: null
  };

  let qrGroup = null;
  let qrHitArea = null;
  let qrLive = false;

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
  //
  // Never derive direction anywhere else.
  function deriveDirectionTruth(aim, groupCenter) {
    const dx = groupCenter.x - aim.x;
    const dy = groupCenter.y - aim.y;

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
        <span class="copy-pulse">Tap Aim Point</span>
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
        <span class="copy-pulse">Tap Aim Point</span>
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

  function setInstruction(text, mode = 'pulse', subtext = '') {
    if (simInstructionTop) {
      simInstructionTop.textContent = text;
      simInstructionTop.classList.remove('instruction-pulse', 'instruction-steady', 'instruction-hidden');
      simInstructionTop.classList.add(mode === 'pulse' ? 'instruction-pulse' : 'instruction-steady');
    }

    if (simInstructionSub) {
      if (subtext) {
        simInstructionSub.textContent = subtext;
        simInstructionSub.classList.remove('instruction-hidden');
      } else {
        simInstructionSub.textContent = '';
        simInstructionSub.classList.add('instruction-hidden');
      }
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
      inlineResultsBtn.classList.remove('hidden-until-ready');
      inlineResultsBtn.classList.add('results-live');
      resultsBtn.classList.add('results-live');
    } else {
      inlineResultsBtn.classList.add('hidden-until-ready');
      inlineResultsBtn.classList.remove('results-live');
      resultsBtn.classList.remove('results-live');
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
      statusText.textContent = `Tap 3–5 Impacts (${state.shots.length}/${MAX_SHOTS})`;
      setInstruction('TAP 3–5 IMPACTS', 'pulse');
      enableResultsButtons(false);
      return;
    }

    if (state.mode === 'ready') {
      modePill.textContent = 'Mode: Results';
      statusText.textContent = `Tap Results (${state.shots.length}/${MAX_SHOTS} impacts set)`;
      setInstruction('TAP RESULTS', 'pulse');
      enableResultsButtons(true);
      return;
    }

    modePill.textContent = 'Mode: Results Ready';
    statusText.textContent = 'Results Ready';
    setInstruction('RESULTS READY', 'steady');
    enableResultsButtons(true);
  }

  function clearOverlay() {
    overlayLayer.innerHTML = '';
  }

  function drawCircle(x, y, radius, fill, opacity = 1) {
    const node = document.createElementNS(NS, 'circle');
    node.setAttribute('cx', x);
    node.setAttribute('cy', y);
    node.setAttribute('r', radius);
    node.setAttribute('fill', fill);
    node.setAttribute('opacity', opacity);
    overlayLayer.appendChild(node);
    return node;
  }

  function drawAimPoint(x, y) {
    drawCircle(x, y, 7, '#111111', 1);
  }

  function drawFrayedHit(x, y) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);

    const outer = document.createElementNS(NS, 'circle');
    outer.setAttribute('r', '4.6');
    outer.setAttribute('fill', '#2a2a2a');
    outer.setAttribute('opacity', '0.16');

    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', '3.3');
    ring.setAttribute('fill', '#332b29');
    ring.setAttribute('opacity', '0.96');

    const core = document.createElementNS(NS, 'circle');
    core.setAttribute('r', '2.1');
    core.setAttribute('fill', '#111111');

    g.appendChild(outer);
    g.appendChild(ring);
    g.appendChild(core);
    overlayLayer.appendChild(g);
    return g;
  }

  function drawGroupCenter(x, y) {
    const halo = drawCircle(x, y, 10, '#16a34a', 0.18);
    halo.classList.add('group-center-halo');

    const core = drawCircle(x, y, 5.5, '#16a34a', 1);
    core.classList.add('group-center-core');
  }

  function setQrLive(isLive) {
    qrLive = isLive;
    if (!qrGroup || !qrHitArea) return;

    if (isLive) {
      qrGroup.classList.add('qr-live');
      qrHitArea.style.cursor = 'pointer';
    } else {
      qrGroup.classList.remove('qr-live');
      qrHitArea.style.cursor = 'default';
    }
  }

  function handleQrClick() {
    if (!qrLive) return;

    // Placeholder destination — swap this later for your real logistics / matrix demo path.
    const destination = 'https://tap-n-score.com/';
    window.open(destination, '_blank', 'noopener,noreferrer');
  }

  function drawMockQRAboveTarget() {
    if (qrGroup) return;

    qrGroup = document.createElementNS(NS, 'g');
    qrGroup.setAttribute('class', 'mock-qr-group');
    qrGroup.setAttribute('transform', 'translate(620 22) scale(0.78)');

    const outer = document.createElementNS(NS, 'rect');
    outer.setAttribute('x', '0');
    outer.setAttribute('y', '0');
    outer.setAttribute('width', '150');
    outer.setAttribute('height', '150');
    outer.setAttribute('rx', '12');
    outer.setAttribute('fill', '#ffffff');
    outer.setAttribute('stroke', '#1f2937');
    outer.setAttribute('stroke-width', '3');

    const topBand = document.createElementNS(NS, 'rect');
    topBand.setAttribute('x', '6');
    topBand.setAttribute('y', '6');
    topBand.setAttribute('width', '138');
    topBand.setAttribute('height', '18');
    topBand.setAttribute('rx', '6');
    topBand.setAttribute('fill', '#dc2626');

    const bottomBand = document.createElementNS(NS, 'rect');
    bottomBand.setAttribute('x', '6');
    bottomBand.setAttribute('y', '126');
    bottomBand.setAttribute('width', '138');
    bottomBand.setAttribute('height', '18');
    bottomBand.setAttribute('rx', '6');
    bottomBand.setAttribute('fill', '#2563eb');

    const topText = document.createElementNS(NS, 'text');
    topText.setAttribute('x', '75');
    topText.setAttribute('y', '19');
    topText.setAttribute('text-anchor', 'middle');
    topText.setAttribute('font-size', '10');
    topText.setAttribute('font-weight', '900');
    topText.setAttribute('fill', '#ffffff');
    topText.textContent = 'SCAN';

    const bottomText = document.createElementNS(NS, 'text');
    bottomText.setAttribute('x', '75');
    bottomText.setAttribute('y', '139');
    bottomText.setAttribute('text-anchor', 'middle');
    bottomText.setAttribute('font-size', '7.2');
    bottomText.setAttribute('font-weight', '800');
    bottomText.setAttribute('fill', '#ffffff');
    bottomText.textContent = 'SHOOT • SCAN • IMPROVE • SAVE';

    const qrBg = document.createElementNS(NS, 'rect');
    qrBg.setAttribute('x', '12');
    qrBg.setAttribute('y', '28');
    qrBg.setAttribute('width', '126');
    qrBg.setAttribute('height', '94');
    qrBg.setAttribute('rx', '8');
    qrBg.setAttribute('fill', '#ffffff');

    const modules = [
      [18, 36, 22, 22], [110, 36, 22, 22], [18, 92, 22, 22],
      [48, 36, 8, 8], [58, 36, 8, 8], [68, 36, 8, 8], [88, 36, 8, 8],
      [48, 46, 8, 8], [68, 46, 8, 8], [78, 46, 8, 8], [98, 46, 8, 8],
      [38, 56, 8, 8], [48, 56, 8, 8], [58, 56, 8, 8], [78, 56, 8, 8], [88, 56, 8, 8],
      [38, 66, 8, 8], [58, 66, 8, 8], [68, 66, 8, 8], [88, 66, 8, 8], [98, 66, 8, 8],
      [48, 76, 8, 8], [68, 76, 8, 8], [78, 76, 8, 8], [98, 76, 8, 8],
      [48, 86, 8, 8], [58, 86, 8, 8], [78, 86, 8, 8], [88, 86, 8, 8],
      [68, 96, 8, 8], [88, 96, 8, 8], [98, 96, 8, 8], [108, 96, 8, 8]
    ];

    modules.forEach(([x, y, w, h]) => {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', String(w));
      r.setAttribute('height', String(h));
      r.setAttribute('rx', '2');
      r.setAttribute('fill', '#111827');
      qrGroup.appendChild(r);
    });

    const badge = document.createElementNS(NS, 'rect');
    badge.setAttribute('x', '44');
    badge.setAttribute('y', '58');
    badge.setAttribute('width', '62');
    badge.setAttribute('height', '34');
    badge.setAttribute('rx', '6');
    badge.setAttribute('fill', '#111827');
    badge.setAttribute('stroke', '#374151');
    badge.setAttribute('stroke-width', '2');

    const smart1 = document.createElementNS(NS, 'text');
    smart1.setAttribute('x', '75');
    smart1.setAttribute('y', '71');
    smart1.setAttribute('text-anchor', 'middle');
    smart1.setAttribute('font-size', '7');
    smart1.setAttribute('font-weight', '900');
    smart1.setAttribute('fill', '#ef4444');
    smart1.textContent = 'THE';

    const smart2 = document.createElementNS(NS, 'text');
    smart2.setAttribute('x', '75');
    smart2.setAttribute('y', '81');
    smart2.setAttribute('text-anchor', 'middle');
    smart2.setAttribute('font-size', '8');
    smart2.setAttribute('font-weight', '900');
    smart2.setAttribute('fill', '#ffffff');
    smart2.textContent = 'SMART';

    const smart3 = document.createElementNS(NS, 'text');
    smart3.setAttribute('x', '75');
    smart3.setAttribute('y', '91');
    smart3.setAttribute('text-anchor', 'middle');
    smart3.setAttribute('font-size', '8');
    smart3.setAttribute('font-weight', '900');
    smart3.setAttribute('fill', '#2563eb');
    smart3.textContent = 'TARGET';

    qrHitArea = document.createElementNS(NS, 'rect');
    qrHitArea.setAttribute('x', '0');
    qrHitArea.setAttribute('y', '0');
    qrHitArea.setAttribute('width', '150');
    qrHitArea.setAttribute('height', '150');
    qrHitArea.setAttribute('rx', '12');
    qrHitArea.setAttribute('fill', 'transparent');
    qrHitArea.style.pointerEvents = 'all';
    qrHitArea.style.cursor = 'default';
    qrHitArea.addEventListener('click', handleQrClick);

    qrGroup.appendChild(outer);
    qrGroup.appendChild(topBand);
    qrGroup.appendChild(bottomBand);
    qrGroup.appendChild(qrBg);
    qrGroup.appendChild(badge);
    qrGroup.appendChild(topText);
    qrGroup.appendChild(bottomText);
    qrGroup.appendChild(smart1);
    qrGroup.appendChild(smart2);
    qrGroup.appendChild(smart3);
    qrGroup.appendChild(qrHitArea);

    ringLayer.appendChild(qrGroup);
    setQrLive(false);
  }

  function redrawAll() {
    clearOverlay();

    if (state.aim) {
      drawAimPoint(state.aim.x, state.aim.y);
    }

    state.shots.forEach((shot) => {
      drawFrayedHit(shot.x, shot.y);
    });

    if (state.groupCenter) {
      drawGroupCenter(state.groupCenter.x, state.groupCenter.y);
    }
  }

  function getCoords(e) {
    const rect = targetSurface.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEWBOX,
      y: ((e.clientY - rect.top) / rect.height) * VIEWBOX
    };
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

    clearOverlay();
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

    if (state.shots.length >= MIN_SHOTS) {
      state.mode = 'ready';
      return;
    }

    state.mode = 'shots';
  }

  function handleTap(e) {
    const { x, y } = getCoords(e);

    if (state.mode === 'results') return;

    if (!state.aim) {
      state.aim = { x, y };
      state.groupCenter = null;
      recomputeModeFromState();
      redrawAll();
      syncModeUI();
      return;
    }

    if (state.shots.length >= MAX_SHOTS) return;

    state.shots.push({ x, y });
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
    const avgX = state.shots.reduce((sum, shot) => sum + shot.x, 0) / state.shots.length;
    const avgY = state.shots.reduce((sum, shot) => sum + shot.y, 0) / state.shots.length;
    return { x: avgX, y: avgY };
  }

  function buildPositionText(verticalPosition, horizontalPosition) {
    const vertical = verticalPosition === 'centered' ? '' : verticalPosition;
    const horizontal = horizontalPosition === 'centered' ? '' : horizontalPosition;

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
    if (!state.aim || state.shots.length < MIN_SHOTS) return;

    state.groupCenter = computeGroupCenter();
    state.mode = 'results';

    const truth = deriveDirectionTruth(state.aim, state.groupCenter);
    const positionText = buildPositionText(truth.verticalPosition, truth.horizontalPosition);

    const clicksX = Math.abs(truth.dx / 10);
    const clicksY = Math.abs(truth.dy / 10);

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

  function injectQrStyles() {
    if (document.getElementById('sczn3-qr-style')) return;

    const style = document.createElement('style');
    style.id = 'sczn3-qr-style';
    style.textContent = `
      .mock-qr-group {
        opacity: 0.92;
        filter: contrast(0.95) brightness(0.98);
        transform-box: fill-box;
        transform-origin: center;
      }

      .mock-qr-group.qr-live {
        animation: qrPulse 1.6s ease-in-out infinite;
      }

      @keyframes qrPulse {
        0%   { filter: contrast(0.95) brightness(0.98) drop-shadow(0 0 0px rgba(34,197,94,0)); }
        50%  { filter: contrast(0.98) brightness(1) drop-shadow(0 0 10px rgba(34,197,94,0.45)); }
        100% { filter: contrast(0.95) brightness(0.98) drop-shadow(0 0 0px rgba(34,197,94,0)); }
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

  setPageCopy();
  injectQrStyles();
  drawMockQRAboveTarget();
  resetSimulator();
})();
