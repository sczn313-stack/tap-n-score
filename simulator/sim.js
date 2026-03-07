let aim = null;
let hits = [];

const PIXELS_PER_INCH = 100;
const DISTANCE_YARDS = 100;
const TRUE_MOA_INCHES_AT_100 = 1.047;
const CLICK_VALUE_MOA = 0.25;

const target = document.getElementById("target");
const result = document.getElementById("result");

target.addEventListener("click", (e) => {
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (!aim) {
    aim = { x, y };
    drawDot(x, y, "aim");
    setResult("Aim point set. Tap bullet hits, then press Calculate POIB.");
    return;
  }

  hits.push({ x, y });
  drawDot(x, y, "hit");
  setResult(`${hits.length} hit${hits.length === 1 ? "" : "s"} recorded. Press Calculate POIB when ready.`);
});

function drawDot(x, y, type) {
  const dot = document.createElement("div");
  dot.className = "hit " + type;
  dot.style.left = x + "px";
  dot.style.top = y + "px";
  target.appendChild(dot);
}

function drawPOIB(x, y) {
  const wrap = document.createElement("div");
  wrap.className = "poib-marker";
  wrap.style.left = x + "px";
  wrap.style.top = y + "px";

  const h = document.createElement("div");
  h.className = "poib-h";

  const v = document.createElement("div");
  v.className = "poib-v";

  wrap.appendChild(h);
  wrap.appendChild(v);
  target.appendChild(wrap);
}

function clearPOIB() {
  document.querySelectorAll(".poib-marker").forEach((node) => node.remove());
}

function pxToInches(px) {
  return px / PIXELS_PER_INCH;
}

function inchesPerMOAAtDistance(distanceYards) {
  return TRUE_MOA_INCHES_AT_100 * (distanceYards / 100);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function calculateGroupSizeInches() {
  if (hits.length < 2) return 0;

  let maxDistancePx = 0;

  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const dx = hits[j].x - hits[i].x;
      const dy = hits[j].y - hits[i].y;
      const d = Math.hypot(dx, dy);
      if (d > maxDistancePx) maxDistancePx = d;
    }
  }

  return pxToInches(maxDistancePx);
}

function calculate() {
  if (!aim) {
    setResult("Set an AIM point first.");
    return;
  }

  if (hits.length < 1) {
    setResult("Add at least one hit before calculating.");
    return;
  }

  clearPOIB();

  let sumX = 0;
  let sumY = 0;

  hits.forEach((hit) => {
    sumX += hit.x;
    sumY += hit.y;
  });

  const poibX = sumX / hits.length;
  const poibY = sumY / hits.length;

  drawPOIB(poibX, poibY);

  const dxPx = poibX - aim.x;
  const dyPx = poibY - aim.y;

  const dxIn = pxToInches(dxPx);
  const dyIn = pxToInches(dyPx);

  const moaScale = inchesPerMOAAtDistance(DISTANCE_YARDS);
  const windageMOA = dxIn / moaScale;
  const elevationMOA = dyIn / moaScale;

  const windageClicks = Math.abs(windageMOA / CLICK_VALUE_MOA);
  const elevationClicks = Math.abs(elevationMOA / CLICK_VALUE_MOA);

  const windageDirection = dxIn > 0 ? "LEFT" : dxIn < 0 ? "RIGHT" : "NONE";
  const elevationDirection = dyIn > 0 ? "UP" : dyIn < 0 ? "DOWN" : "NONE";

  const groupSizeInches = calculateGroupSizeInches();

  const summary = [
    `POIB Offset: X ${round2(dxIn)}" , Y ${round2(dyIn)}"`,
    `Group Size: ${round2(groupSizeInches)}"`,
    `Windage: ${windageDirection === "NONE" ? "No correction" : `${round2(Math.abs(windageMOA))} MOA / ${round2(windageClicks)} clicks ${windageDirection}`}`,
    `Elevation: ${elevationDirection === "NONE" ? "No correction" : `${round2(Math.abs(elevationMOA))} MOA / ${round2(elevationClicks)} clicks ${elevationDirection}`}`,
    `SCZN3 Precision Engine • True MOA • Inch Verified`
  ];

  setResult(summary.join("\n"));
}

function resetSim() {
  aim = null;
  hits = [];
  target.innerHTML = "";
  setResult("");
}

function setResult(text) {
  result.textContent = text;
}
