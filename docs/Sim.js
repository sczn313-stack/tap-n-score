Replace docs/Sim.js with this exact full file:

(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const VIEWBOX = 800;
  const CENTER = 400;
  const DEFAULT_PIXELS_PER_INCH = 40;

  const targetSurface = document.getElementById('targetSurface');
  const overlayLayer = document.getElementById('overlayLayer');
  const ringLayer = document.getElementById('ringLayer');
  const secCard = document.getElementById('secCard');
  const modePill = document.getElementById('modePill');
  const statusText = document.getElementById('statusText');
  const distanceYardsEl = document.getElementById('distanceYards');
  const clickValueMOAEl = document.getElementById('clickValueMOA');
  const shotGoalEl = document.getElementById('shotGoal');
  const ringSpacingInchesEl = document.getElementById('ringSpacingInches');
  const undoBtn = document.getElementById('undoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const resultsBtn = document.getElementById('resultsBtn');

  const state = {
    aimPoint: null,
    shots: [],
    mode: 'aim'
  };

  function getPixelsPerInch() {
    return DEFAULT_PIXELS_PER_INCH;
  }

  function inchesToPx(inches) {
    return inches * getPixelsPerInch();
  }

  function pxToInches(px) {
    return px / getPixelsPerInch();
  }

  function yardsToInchesPerMOA(yards) {
    return 1.047 * (yards / 100);
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function createSvg(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    return node;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function renderRings() {
    clearChildren(ringLayer);
    const spacingInches = Number(ringSpacingInchesEl.value);
    const maxRadius = 340;
    let r = inchesToPx(spacingInches);

    while (r <= maxRadius) {
      ringLayer.appendChild(
        createSvg('circle', {
          cx: CENTER,
          cy: CENTER,
          r,
          fill: 'none',
          stroke: '#202020',
          'stroke-width': r % inchesToPx(spacingInches * 2) === 0 ? 1.2 : 0.8,
          opacity: 0.9
        })
      );
      r += inchesToPx(spacingInches);
    }
  }

  function addAimMarker(point) {
    const g = createSvg('g');

    g.appendChild(
      createSvg('circle', {
        cx: point.x,
        cy: point.y,
        r: 11,
        fill: 'none',
        stroke: '#136f3a',
        'stroke-width': 3
      })
    );

    g.appendChild(
      createSvg('line', {
        x1: point.x - 16,
        y1: point.y,
        x2: point.x + 16,
        y2: point.y,
        stroke: '#136f3a',
        'stroke-width': 2
      })
    );

    g.appendChild(
      createSvg('line', {
        x1: point.x,
        y1: point.y - 16,
        x2: point.x,
        y2: point.y + 16,
        stroke: '#136f3a',
        'stroke-width': 2
      })
    );

    overlayLayer.appendChild(g);
  }

  function addShotMarker(point, idx) {
    const g = createSvg('g');

    g.appendChild(
      createSvg('circle', {
        cx: point.x,
        cy: point.y,
        r: 8,
        fill: '#111827'
      })
    );

    const label = createSvg('text', {
      x: point.x + 12,
      y: point.y - 10,
      'font-size': 18,
      'font-weight': 700,
      fill: '#111827'
    });

    label.textContent = String(idx + 1);
    g.appendChild(label);
    overlayLayer.appendChild(g);
  }

  function addPoibMarker(point) {
    const g = createSvg('g');

    g.appendChild(
      createSvg('line', {
        x1: point.x - 12,
        y1: point.y - 12,
        x2: point.x + 12,
        y2: point.y + 12,
        stroke: '#c62828',
        'stroke-width': 3
      })
    );

    g.appendChild(
      createSvg('line', {
        x1: point.x - 12,
        y1: point.y + 12,
        x2: point.x + 12,
        y2: point.y - 12,
        stroke: '#c62828',
        'stroke-width': 3
      })
    );

    overlayLayer.appendChild(g);
  }

  function addCorrectionArrow(from, to) {
    const defs = createSvg('defs');
    const marker = createSvg('marker', {
      id: 'arrowHead',
      viewBox: '0 0 10 10',
      refX: 8,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto-start-reverse'
    });

    marker.appendChild(
      createSvg('path', {
        d: 'M 0 0 L 10 5 L 0 10 z',
        fill: '#0b57d0'
      })
    );

    defs.appendChild(marker);
    overlayLayer.appendChild(defs);

    overlayLayer.appendChild(
      createSvg('line', {
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        stroke: '#0b57d0',
        'stroke-width': 4,
        'marker-end': 'url(#arrowHead)'
      })
    );
  }

  function redrawOverlay(showResults = false) {
    clearChildren(overlayLayer);

    if (state.aimPoint) addAimMarker(state.aimPoint);
    state.shots.forEach((shot, idx) => addShotMarker(shot, idx));

    if (showResults && state.shots.length >= 3 && state.aimPoint) {
      const results = calculateResults();
      addPoibMarker(results.poib);
      addCorrectionArrow(results.poib, state.aimPoint);
    }
  }

  function setMode(mode) {
    state.mode = mode;

    if (mode === 'aim') {
      modePill.textContent = 'Mode: Select aim point';
      statusText.textContent = 'Tap the bull to place the aim point.';
    } else {
      const goal = Number(shotGoalEl.value);
      modePill.textContent = 'Mode: Record impacts';
      statusText.textContent = `Tap ${Math.max(3 - state.shots.length, 0)} to ${Math.max(goal - state.shots.length, 0)} more impacts, then show results.`;
    }
  }

  function getSvgCoords(evt) {
    const rect = targetSurface.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * VIEWBOX;
    const y = ((evt.clientY - rect.top) / rect.height) * VIEWBOX;
    return { x: round2(x), y: round2(y) };
  }

  function directionWords(offsetXInches, offsetYInches) {
    const horizontal =
      offsetXInches > 0 ? 'right' : offsetXInches < 0 ? 'left' : 'centered';
    const vertical =
      offsetYInches > 0 ? 'low' : offsetYInches < 0 ? 'high' : 'centered';

    return { horizontal, vertical };
  }

  function clickDirection(offsetXInches, offsetYInches) {
    return {
      windage: offsetXInches > 0 ? 'LEFT' : offsetXInches < 0 ? 'RIGHT' : 'NONE',
      elevation: offsetYInches > 0 ? 'UP' : offsetYInches < 0 ? 'DOWN' : 'NONE'
    };
  }

  function calculateGroupSize(pts) {
    let maxPx = 0;

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy);
        if (d > maxPx) maxPx = d;
      }
    }

    return pxToInches(maxPx);
  }

  function calculateResults() {
    const poibX = state.shots.reduce((sum, p) => sum + p.x, 0) / state.shots.length;
    const poibY = state.shots.reduce((sum, p) => sum + p.y, 0) / state.shots.length;
    const poib = { x: round2(poibX), y: round2(poibY) };

    const offsetXPx = poib.x - state.aimPoint.x;
    const offsetYPx = poib.y - state.aimPoint.y;

    const offsetXInches = pxToInches(offsetXPx);
    const offsetYInches = pxToInches(offsetYPx);

    const yards = Number(distanceYardsEl.value);
    const inchesPerMOA = yardsToInchesPerMOA(yards);

    const windageMOA = offsetXInches / inchesPerMOA;
    const elevationMOA = offsetYInches / inchesPerMOA;

    const clickValue = Number(clickValueMOAEl.value);
    const windageClicks = Math.round(Math.abs(windageMOA / clickValue));
    const elevationClicks = Math.round(Math.abs(elevationMOA / clickValue));

    const groupSizeInches = calculateGroupSize(state.shots);

    return {
      poib,
      offsetXInches: round2(offsetXInches),
      offsetYInches: round2(offsetYInches),
      windageMOA: round2(windageMOA),
      elevationMOA: round2(elevationMOA),
      windageClicks,
      elevationClicks,
      groupSizeInches: round2(groupSizeInches),
      shots: state.shots.length,
      directions: directionWords(offsetXInches, offsetYInches),
      clickDirections: clickDirection(offsetXInches, offsetYInches),
      distanceYards: yards,
      clickValue
    };
  }

  function renderSec(results) {
    const windageSummary =
      results.clickDirections.windage === 'NONE'
        ? 'No windage correction'
        : `${results.windageClicks} clicks ${results.clickDirections.windage}`;

    const elevationSummary =
      results.clickDirections.elevation === 'NONE'
        ? 'No elevation correction'
        : `${results.elevationClicks} clicks ${results.clickDirections.elevation}`;

    secCard.classList.remove('empty');
    secCard.innerHTML = `
      <div class="sec-brand">Shooter Experience Card</div>
      <div class="metric-grid">
        <div class="metric"><div class="metric-label">Shot count</div><div class="metric-value">${results.shots}</div></div>
        <div class="metric"><div class="metric-label">Distance</div><div class="metric-value">${results.distanceYards} yd</div></div>
        <div class="metric"><div class="metric-label">Group size</div><div class="metric-value">${results.groupSizeInches}&quot;</div></div>
        <div class="metric"><div class="metric-label">POIB X / Y</div><div class="metric-value">${results.poib.x}, ${results.poib.y}</div></div>
        <div class="metric"><div class="metric-label">Windage offset</div><div class="metric-value">${Math.abs(results.offsetXInches)}&quot; ${results.directions.horizontal}</div></div>
        <div class="metric"><div class="metric-label">Elevation offset</div><div class="metric-value">${Math.abs(results.offsetYInches)}&quot; ${results.directions.vertical}</div></div>
        <div class="metric"><div class="metric-label">Windage MOA</div><div class="metric-value">${Math.abs(results.windageMOA)}</div></div>
        <div class="metric"><div class="metric-label">Elevation MOA</div><div class="metric-value">${Math.abs(results.elevationMOA)}</div></div>
      </div>
      <div class="sec-callout"><strong>Scope correction</strong><br>${windageSummary}<br>${elevationSummary}</div>
      <div class="sec-footer">Faith • Order • Precision · Simulator v1 · POIB outward-facing terminology locked.</div>
    `;
  }

  function showResults() {
    if (!state.aimPoint || state.shots.length < 3) {
      statusText.textContent =
        'You need 1 aim point and at least 3 impacts before results can be shown.';
      return;
    }

    const results = calculateResults();
    redrawOverlay(true);
    renderSec(results);
    statusText.textContent = 'Results generated. Reset or keep practicing.';
  }

  function resetSimulator() {
    state.aimPoint = null;
    state.shots = [];
    secCard.classList.add('empty');
    secCard.innerHTML =
      '<div class="sec-brand">Shooter Experience Card</div><div class="sec-empty">Results will appear after you set an aim point and tap your shots.</div>';
    redrawOverlay(false);
    setMode('aim');
  }

  targetSurface.addEventListener('click', (evt) => {
    const point = getSvgCoords(evt);

    if (state.mode === 'aim') {
      state.aimPoint = point;
      redrawOverlay(false);
      setMode('shots');
      return;
    }

    const goal = Number(shotGoalEl.value);

    if (state.shots.length >= goal) {
      statusText.textContent = `Shot goal reached (${goal}). Tap Show Results or Reset.`;
      return;
    }

    state.shots.push(point);
    redrawOverlay(false);
    setMode('shots');
  });

  undoBtn.addEventListener('click', () => {
    if (state.shots.length > 0) {
      state.shots.pop();
      redrawOverlay(false);
      setMode('shots');
      return;
    }

    if (state.aimPoint) {
      state.aimPoint = null;
      redrawOverlay(false);
      setMode('aim');
    }
  });

  resetBtn.addEventListener('click', resetSimulator);
  resultsBtn.addEventListener('click', showResults);
  ringSpacingInchesEl.addEventListener('change', renderRings);
  shotGoalEl.addEventListener('change', () => {
    if (state.mode === 'shots') setMode('shots');
  });

  renderRings();
  resetSimulator();
})();

Then commit it and reload:

https://tapnscore.com/Sim.html

If the page still acts up after that, paste the exact filename shown in GitHub for the JS file.
