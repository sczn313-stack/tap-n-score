let aim = null;
let hits = [];

const PIXELS_PER_INCH = 100;
const DISTANCE_YARDS = 100;
const TRUE_MOA_INCHES_AT_100 = 1.047;
const CLICK_VALUE_MOA = 0.25;

const target = document.getElementById("target");
const result = document.getElementById("result");
const gridToggle = document.getElementById("gridToggle");

if (gridToggle.checked) {
  target.classList.add("show-grid");
}

gridToggle.addEventListener("change", () => {
  if (gridToggle.checked) {
    target.classList.add("show-grid");
  } else {
    target.classList.remove("show-grid");
  }
});

target.addEventListener("click", (e) => {
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (!aim) {
    aim = { x, y };
    drawDot(x, y, "aim");
    setResult("Aim point set. Tap bullet holes, then press Calculate POIB.");
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
  clearPOIB();

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

function drawCorrectionArrow(fromX, fromY, toX, toY) {
  clearCorrectionArrow();

  const arrow = document.createElement("div");
  arrow.className = "correction-arrow";

  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  arrow.style.width = length + "px";
  arrow.style.left = fromX + "px";
  arrow.style.top = fromY + "px";
  arrow.style.transform = `translateY(-50%) rotate(${angle}deg)`;

  const head = document.createElement("div");
  head.className = "correction-arrow-head";
  arrow.appendChild(head);

  target.appendChild(arrow);
}

function clearCorrectionArrow() {
  document.querySelectorAll(".correction-arrow").forEach((node) => node.remove());
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

  let sumX = 0;
  let sumY = 0;

  hits.forEach((hit) => {
    sumX += hit.x;
    sumY += hit.y;
  });

  const poibX = sumX / hits.length;
  const poibY = sumY / hits.length;

  drawPOIB(poibX, poibY);
  drawCorrectionArrow(poibX, poibY, aim.x, aim.y);

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
  clearPOIB();
  clearCorrectionArrow();
  setResult("");
}

function setResult(text) {
  result.textContent = text;
}
