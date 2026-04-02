let aim = null;
let hits = [];

const PIXELS_PER_INCH = 100;
const DISTANCE_YARDS = 100;
const TRUE_MOA_INCHES_AT_100 = 1.047;
const CLICK_VALUE_MOA = 0.25;

const target = document.getElementById("target");
const result = document.getElementById("result");

// ==============================
// INIT
// ==============================
init();

function init() {
  drawQR();
}

// ==============================
// TARGET INTERACTION
// ==============================
target.addEventListener("click", (e) => {
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (!aim) {
    aim = { x, y };
    drawDot(x, y, "aim");
    setResult("Aim set → Tap impacts");
    return;
  }

  hits.push({ x, y });
  drawDot(x, y, "hit");
});

// ==============================
// DRAW FUNCTIONS
// ==============================
function drawDot(x, y, type) {
  const dot = document.createElement("div");
  dot.className = "dot " + type;
  dot.style.left = x + "px";
  dot.style.top = y + "px";
  target.appendChild(dot);
}

// ==============================
// QR CODE (TOP RIGHT CLEAN ZONE)
// ==============================
function drawQR() {
  const qr = document.createElement("div");
  qr.className = "mock-qr";

  // POSITION — upper right clean zone
  qr.style.position = "absolute";
  qr.style.right = "20px";
  qr.style.top = "20px";

  // SIZE — smaller, not dominant
  qr.style.width = "110px";
  qr.style.height = "110px";

  // STYLE
  qr.style.border = "3px solid #111";
  qr.style.borderRadius = "10px";
  qr.style.background = "#fff";
  qr.style.boxShadow = "0 0 12px rgba(0,255,150,0.6)";
  qr.style.cursor = "pointer";

  // PULSE GLOW
  qr.style.animation = "qrGlow 1.6s infinite";

  // INNER TEXT (mock branding)
  qr.innerHTML = `
    <div style="
      font-size:10px;
      text-align:center;
      font-weight:bold;
      margin-top:6px;
    ">SCAN</div>

    <div style="
      font-size:12px;
      text-align:center;
      margin-top:18px;
      font-weight:bold;
    ">SMART TARGET</div>

    <div style="
      position:absolute;
      bottom:6px;
      width:100%;
      text-align:center;
      font-size:8px;
    ">SHOOT • SCAN • IMPROVE • SAVE</div>
  `;

  // CLICK BEHAVIOR
  qr.onclick = () => {
    alert("QR CLICKED → This will drive real scan flow later");
  };

  target.appendChild(qr);
}

// ==============================
// CALCULATE (TRUTH LOCKED)
// ==============================
function calculate() {
  if (!aim || hits.length === 0) return;

  let sumX = 0;
  let sumY = 0;

  hits.forEach((h) => {
    sumX += h.x;
    sumY += h.y;
  });

  const poibX = sumX / hits.length;
  const poibY = sumY / hits.length;

  const dxPx = poibX - aim.x;
  const dyPx = poibY - aim.y;

  const dxIn = dxPx / PIXELS_PER_INCH;
  const dyIn = dyPx / PIXELS_PER_INCH;

  const moaScale = TRUE_MOA_INCHES_AT_100 * (DISTANCE_YARDS / 100);

  const windageMOA = dxIn / moaScale;
  const elevationMOA = dyIn / moaScale;

  // LOCKED TRUTH
  const windageDir = dxIn > 0 ? "LEFT" : dxIn < 0 ? "RIGHT" : "NONE";
  const elevationDir = dyIn > 0 ? "UP" : dyIn < 0 ? "DOWN" : "NONE";

  setResult(`
Windage: ${Math.abs(windageMOA).toFixed(2)} MOA ${windageDir}
Elevation: ${Math.abs(elevationMOA).toFixed(2)} MOA ${elevationDir}
`);
}

// ==============================
// RESET
// ==============================
function resetSim() {
  aim = null;
  hits = [];
  target.innerHTML = "";
  drawQR(); // re-add QR
  setResult("");
}

// ==============================
function setResult(text) {
  result.textContent = text;
}
