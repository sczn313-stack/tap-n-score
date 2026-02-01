/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   - iPad/iOS-safe photo picker (store File immediately)
   - Tap bull (blue) then shots (red)
   - POIB = MEAN of shots (dx,dy in inches relative to bull)
   - POST https://sczn3-backend-new.onrender.com/api/calc
   - y axis: down is +, up is -  (top=up)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements
  const chooseBtn   = $("chooseBtn");
  const clearBtn    = $("clearBtn");
  const resultsBtn  = $("resultsBtn");

  const photoInput  = $("photoInput");
  const statusLine  = $("statusLine");
  const outBox      = $("outBox");

  const stage       = $("stage");
  const targetImg   = $("targetImg");
  const tapLayer    = $("tapLayer");

  const bullPill    = $("bullPill");
  const shotsPill   = $("shotsPill");

  const distanceYds = $("distanceYds");
  const moaPerClick = $("moaPerClick");
  const gridAcross  = $("gridAcross");
  const inPerSquare = $("inPerSquare");

  // --- Config
  const API_BASE = "https://sczn3-backend-new.onrender.com";

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  // bull + shots stored as DISPLAY-PIXEL coordinates inside the stage
  let bull = null;      // {x,y}
  let shots = [];       // [{x,y}, ...]
  let dots = [];        // DOM elements for shots
  let bullDot = null;

  function setStatus(msg) {
    statusLine.textContent = msg;
  }

  function setOut(obj) {
    outBox.style.display = "block";
    outBox.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function clearOut() {
    outBox.style.display = "none";
    outBox.textContent = "";
  }

  function updatePills() {
    bullPill.innerHTML = `Bull: <b>${bull ? "set ✅" : "not set"}</b>`;
    shotsPill.innerHTML = `Shots: <b>${shots.length}</b>`;
    resultsBtn.disabled = !(bull && shots.length > 0);
  }

  function clearDots() {
    if (bullDot) bullDot.remove();
    bullDot = null;

    dots.forEach((d) => d.remove());
    dots = [];

    bull = null;
    shots = [];
    updatePills();
  }

  function clearAll() {
    clearDots();
    clearOut();

    selectedFile = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;

    targetImg.removeAttribute("src");
    stage.style.display = "none";
    setStatus("Cleared ✅");
  }

  // Create a dot on the stage (relative positioning)
  function addDot(x, y, kind) {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    stage.appendChild(d);
    return d;
  }

  function stagePointFromEvent(ev) {
    const rect = stage.getBoundingClientRect();

    // Use clientX/clientY for touch + mouse + pointer
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Clamp inside stage
    const cx = Math.max(0, Math.min(rect.width, x));
    const cy = Math.max(0, Math.min(rect.height, y));
    return { x: cx, y: cy };
  }

  function inchesPerPixel() {
    // inchesPerPx = (gridAcross * inchesPerSquare) / displayedWidthPx
    const squares = Number(gridAcross.value);
    const inSq = Number(inPerSquare.value);

    const rect = stage.getBoundingClientRect();
    const w = rect.width;

    if (!Number.isFinite(squares) || squares <= 0) return null;
    if (!Number.isFinite(inSq) || inSq <= 0) return null;
    if (!Number.isFinite(w) || w <= 0) return null;

    const totalInchesAcross = squares * inSq;
    return totalInchesAcross / w;
  }

  function computeMeanPOIBInches() {
    // Returns {x,y} where x right is +, y down is +
    // bull is the origin {0,0}
    const ipp = inchesPerPixel();
    if (!ipp) return null;

    let sumX = 0;
    let sumY = 0;

    for (const s of shots) {
      const dxPx = s.x - bull.x;
      const dyPx = s.y - bull.y;
      sumX += dxPx * ipp;
      sumY += dyPx * ipp;
    }

    return {
      x: sumX / shots.length,
      y: sumY / shots.length,
    };
  }

  async function postCalc() {
    clearOut();

    if (!bull || shots.length === 0) {
      setStatus("Set bull + add at least 1 shot.");
      return;
    }

    const poib = computeMeanPOIBInches();
    if (!poib) {
      setStatus("Calibration missing. Check Grid squares across + Inches/square.");
      return;
    }

    const dist = Number(distanceYds.value);
    const mpc = Number(moaPerClick.value);

    if (!Number.isFinite(dist) || dist <= 0) {
      setStatus("Distance must be a positive number.");
      return;
    }
    if (!Number.isFinite(mpc) || mpc <= 0) {
      setStatus("MOA/click must be a positive number.");
      return;
    }

    const body = {
      distanceYds: dist,
      moaPerClick: mpc,
      bull: { x: 0, y: 0 },
      poib: { x: poib.x, y: poib.y },
    };

    setStatus("Posting to backend…");

    try {
      const res = await fetch(`${API_BASE}/api/calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(`Backend error (${res.status})`);
        setOut({ status: res.status, bodySent: body, response: json ?? "No JSON body" });
        return;
      }

      setStatus("Results ✅");
      setOut({ bodySent: body, backendResponse: json });
    } catch (err) {
      setStatus("Network error talking to backend.");
      setOut(String(err?.message || err));
    }
  }

  // ---- iOS-safe Choose Photo
  chooseBtn.addEventListener("click", () => {
    // Must be called directly inside a user gesture
    photoInput.click();
  });

  // IMPORTANT: store File immediately on change (iOS Safari quirk)
  photoInput.addEventListener("change", () => {
    const f = photoInput.files && photoInput.files[0];
    if (!f) return;

    selectedFile = f;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    // Reset taps whenever a new image loads
    clearDots();
    clearOut();

    // Show image
    targetImg.onload = () => {
      stage.style.display = "block";
      setStatus(`Loaded ✅ ${f.name}`);
      updatePills();
    };

    targetImg.src = objectUrl;
  });

  clearBtn.addEventListener("click", clearAll);
  resultsBtn.addEventListener("click", postCalc);

  // ---- Tap handling (bull first, then shots)
  // Use pointerdown so iPad + mouse both work
  tapLayer.addEventListener("pointerdown", (ev) => {
    if (!targetImg.src) {
      setStatus("Choose a photo first.");
      return;
    }

    // prevent iOS double events / scroll weirdness
    ev.preventDefault();

    const pt = stagePointFromEvent(ev);

    if (!bull) {
      bull = pt;
      bullDot = addDot(pt.x, pt.y, "bull");
      setStatus("Bull: set ✅  Now tap shots.");
      updatePills();
      return;
    }

    shots.push(pt);
    const d = addDot(pt.x, pt.y, "shot");
    dots.push(d);

    setStatus(`Shot added ✅ (${shots.length})`);
    updatePills();
  }, { passive: false });

  // ---- Boot
  setStatus("FRONTEND IOS FIX LOADED ✅");
  updatePills();
})();
