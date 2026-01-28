/* ===========================
   BRICK 1 — SESSION + CANONICAL MATH (INCHES AUTHORITY)
   - Default: 100 yards, True MOA, 0.25 MOA/click, units = INCHES
   - Units toggle: IN ⇄ M (session-only; reset on Clear/New Upload)
   - Canonical directions:
       ΔX = bullX − poibX   ( + => RIGHT, − => LEFT )
       ΔY = bullY − poibY   ( + => UP,    − => DOWN )
=========================== */

// ---- Constants
const TRUE_MOA_IN_PER_100Y = 1.047;
const IN_PER_METER = 39.37007874015748;
const YARDS_PER_METER = 1.0936132983377078;

// ---- Default pilot session (Baker)
const session = {
  unit: "in",          // "in" or "m" (display + output only)
  distanceYds: 100,    // default pilot standard
  clickMoa: 0.25,      // default pilot standard
  isTrueMoa: true,     // always true MOA for pilot
};

// ---- Formatting
const fmt2 = (n) => Number(n).toFixed(2);
const clampNum = (n, fallback = 0) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
};

// ---- Unit conversions (display/output only)
// NOTE: Grid authority remains INCHES internally.
function inchesToSessionUnits(inches) {
  if (session.unit === "m") return inches / IN_PER_METER;
  return inches;
}

function sessionDistanceLabel() {
  if (session.unit === "m") return `${fmt2(session.distanceYds / YARDS_PER_METER)} m`;
  return `${fmt2(session.distanceYds)} yds`;
}

// ---- True MOA inches-per-MOA at current distance
function inchesPerMoaAtDistance() {
  // 1 MOA = 1.047" at 100 yards (True MOA)
  return TRUE_MOA_IN_PER_100Y * (session.distanceYds / 100);
}

// ---- Canonical direction from signed inch deltas
function directionsFromDelta(dxIn, dyIn) {
  const horiz = dxIn > 0 ? "RIGHT" : dxIn < 0 ? "LEFT" : "—";
  const vert  = dyIn > 0 ? "UP"    : dyIn < 0 ? "DOWN" : "—";
  return { horiz, vert };
}

// ---- Compute corrections from bull/poib in PIXELS given pxPerInchX/Y
// Returns inches (internal), plus session-unit display values.
function computeCorrectionFromPixels({ bullPx, poibPx, pxPerInchX, pxPerInchY }) {
  // Convert px → inches (grid authority)
  const bullInX = bullPx.x / pxPerInchX;
  const bullInY = bullPx.y / pxPerInchY;
  const poibInX = poibPx.x / pxPerInchX;
  const poibInY = poibPx.y / pxPerInchY;

  // Signed deltas in INCHES (canonical)
  const dxIn = bullInX - poibInX; // + RIGHT
  const dyIn = bullInY - poibInY; // + UP

  const { horiz, vert } = directionsFromDelta(dxIn, dyIn);

  // MOA per axis
  const inPerMoa = inchesPerMoaAtDistance();
  const moaX = Math.abs(dxIn) / inPerMoa;
  const moaY = Math.abs(dyIn) / inPerMoa;

  // Clicks
  const clicksX = moaX / session.clickMoa;
  const clicksY = moaY / session.clickMoa;

  // Session-unit display values (either inches or meters)
  const poibDispX = inchesToSessionUnits(poibInX);
  const poibDispY = inchesToSessionUnits(poibInY);
  const dxDisp = inchesToSessionUnits(dxIn);
  const dyDisp = inchesToSessionUnits(dyIn);

  return {
    // Internal inches truth
    bullInX, bullInY,
    poibInX, poibInY,
    dxIn, dyIn,

    // Display values in selected unit
    poibDispX, poibDispY,
    dxDisp, dyDisp,

    // Outputs
    horiz, vert,
    moaX, moaY,
    clicksX, clicksY,
  };
}

// ---- Reset session to pilot defaults (call on Clear + new Upload)
function resetSessionToPilotDefaults() {
  session.unit = "in";
  session.distanceYds = 100;
  session.clickMoa = 0.25;
  session.isTrueMoa = true;
}

// ---- Mutators we will wire to the top-right MOMA block in BRICK 2/3
function setUnit(nextUnit /* "in"|"m" */) {
  session.unit = (nextUnit === "m") ? "m" : "in";
}
function setDistanceYds(nextYds) {
  session.distanceYds = clampNum(nextYds, 100);
  if (session.distanceYds <= 0) session.distanceYds = 100;
}
function setClickMoa(nextClickMoa) {
  session.clickMoa = clampNum(nextClickMoa, 0.25);
  if (session.clickMoa <= 0) session.clickMoa = 0.25;
}
