let aim = null;
let hits = [];

const target = document.getElementById("target");

target.addEventListener("click", (e) => {
  const rect = target.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (!aim) {
    aim = { x, y };
    drawDot(x, y, "aim");
  } else {
    hits.push({ x, y });
    drawDot(x, y, "hit");
  }
});

function drawDot(x, y, type) {
  const dot = document.createElement("div");
  dot.className = "hit " + type;
  dot.style.left = x + "px";
  dot.style.top = y + "px";
  target.appendChild(dot);
}

function calculate() {
  if (!aim || hits.length === 0) {
    document.getElementById("result").innerText =
      "Set an AIM point and add at least one hit.";
    return;
  }

  let sumX = 0;
  let sumY = 0;

  hits.forEach((hit) => {
    sumX += hit.x;
    sumY += hit.y;
  });

  const avgX = sumX / hits.length;
  const avgY = sumY / hits.length;

  const dx = avgX - aim.x;
  const dy = avgY - aim.y;

  document.getElementById("result").innerText =
    "POI Offset: X " + dx.toFixed(1) + " , Y " + dy.toFixed(1);
}

function resetSim() {
  aim = null;
  hits = [];
  target.innerHTML = "";
  document.getElementById("result").innerText = "";
}
