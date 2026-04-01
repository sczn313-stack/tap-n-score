(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const VIEWBOX = 800;
  const CENTER = 400;
  const DEFAULT_PIXELS_PER_INCH = 40;

  const KEY_PAYLOAD = 'SCZN3_SEC_PAYLOAD_V1';
  const KEY_VENDOR_URL = 'SCZN3_VENDOR_URL_V1';

  const params = new URLSearchParams(window.location.search);
  const isDemoMode = params.get('mode') === 'demo';

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

  const controlsPanel = document.getElementById('controlsPanel');
  const controlsHeading = document.getElementById('controlsHeading');
  const demoModeTag = document.getElementById('demoModeTag');
  const simInstructionTop = document.getElementById('simInstructionTop'




