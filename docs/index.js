/* docs/index.js (FULL REPLACEMENT)
   Fixes in this version:
   - Elevation direction is derived ONLY from backend delta (bull - poib)
     Rule: delta.y > 0 => DOWN, delta.y < 0 => UP
   - No POIB displayed
   - No negative click numbers displayed (abs + direction word)
   - Cleaner SEC hierarchy + combined Elev/Wind/Shots strip
*/

(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const chooseBtn  = $("chooseBtn");
  const clearBtn   = $("clearBtn");
  const resultsBtn = $("resultsBtn");
  const fileInput  = $("photoInput");

  const statusLine = $("statusLine");
  const hintLine   = $("hintLine");

  const stage      = $("stage");
  const img        = $("targetImg");
  const tapLayer   = $("tapLayer");

  const scoreValue = $("scoreValue");

  const elevDirEl  = $("elevDir");
  const elevValEl  = $("elevVal");
  const windDirEl  = $("windDir");
  const windValEl  = $("windVal");
  const shotsValEl = $("shotsVal");

  const distanceOut = $("distanceOut");
  const clickOut    = $("clickOut");

  const diagOut    = $("diagOut");

  // Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const CALC_URL = `${API_BASE}/api/calc`;

  // State
  let objectUrl = null;

  // Tap coords normalized to displayed image (0..1)
  let bull  = null;   // { nx, ny }
  let shots = [];     // [{ nx, ny }, ...]

  // ---- Helpers
  function setStatus(msg) { statusLine.textContent = msg; }

  function clearDots(){ tapLayer.innerHTML = ""; }

  function addDot(nx, ny, kind){
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${nx * 100}%`;
    d.style.top  = `${ny * 100}%`;
    tapLayer.appendChild(d);
  }

  function redraw(){
    clearDots();
    if (bull) addDot(bull.nx, bull.ny, "bull");
    for (const s of shots) addDot(s.nx, s.ny, "shot");
    shotsValEl.textContent = String(shots.length);
  }

  function meanPoint(list){
    let sx = 0, sy = 0;
    for (const p of list){ sx += p.nx; sy += p.ny; }
    return { nx: sx / list.length, ny: sy / list.length };
  }

  // IMPORTANT:
  // This frontend is STILL using a placeholder inches mapping.
  // Your backend is the authority for directions; we only need stable sign consistency.
  // When you plug in your true mapping layer later, keep the sign conventions identical.
  function normalizedToInches(deltaNx, deltaNy){
    // placeholder: treat the displayed stage as 20" x 20"
    const W = 20;
    const H = 20;
    return { x: deltaNx * W, y: deltaNy * H };
  }

  // Direction strictly from backend delta (bull - poib), inches
  // Rule: delta.y > 0 => DOWN, delta.y < 0 => UP
  function dirsFromDelta(delta){
    const wind = delta.x === 0 ? "—" : (delta.x < 0 ? "LEFT" : "RIGHT");
    const elev = delta.y === 0 ? "—" : (delta.y > 0 ? "DOWN" : "UP");
    return { wind, elev };
  }

  function setCorrections({ elevDir, elevClicks, windDir, windClicks }){
    elevDirEl.textContent = elevDir;
    windDirEl.textContent = windDir;

    // No negative numbers shown
    elevValEl.textContent = Number(Math.abs(elevClicks)).toFixed(2);
    windValEl.textContent = Number(Math.abs(windClicks)).toFixed(2);
  }

  function resetOutputs(){
    scoreValue.textContent = "—";
    elevDirEl.textContent  = "—";
    windDirEl.textContent  = "—";
    elevValEl.textContent  = "0.00";
    windValEl.textContent  = "0.00";
    shotsValEl.textContent = "0";
    distanceOut.textContent = "100 yds";
    clickOut.textContent    = "0.25 MOA";
  }

  // ---- iOS-safe file open
  chooseBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      stage.style.display = "block";
      setStatus(`Loaded ✅ ${f.name}`);
      hintLine.textContent = "Tap the bull (blue). Then tap shots (red).";
      bull = null;
      shots = [];
      diagOut.textContent = "(none)";
      resetOutputs();
      redraw();
    };

    img.onerror = () => {
      setStatus("Could not load image ❌");
    };

    img.src = objectUrl;
  });

  // ---- Tap handling
  function getTapNormalized(ev){
    const rect = tapLayer.getBoundingClientRect();
    const touch = ev.touches && ev.touches[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return {
      nx: Math.max(0, Math.min(1, x)),
      ny: Math.max(0, Math.min(1, y))
    };
  }

  function onTap(ev){
    if (!img.src) return;
    ev.preventDefault();

    const p = getTapNormalized(ev);

    if (!bull){
      bull = p;
      setStatus("Bull set ✅");
      hintLine.textContent = "Now tap your shot holes (red).";
      redraw();
      return;
    }

    shots.push(p);
    setStatus(`Shot added ✅ (${shots.length})`);
    redraw();
  }

  tapLayer.addEventListener("touchstart", onTap, { passive: false });
  tapLayer.addEventListener("click", onTap);

  // ---- Clear
  clearBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    diagOut.textContent = "(none)";
    resetOutputs();
    redraw();
    setStatus("Cleared ✅");
    hintLine.textContent = "Tap the bull (blue). Then tap shots (red).";
  });

  // ---- Results
  resultsBtn.addEventListener("click", async () => {
    if (!img.src){ setStatus("Choose a photo first."); return; }
    if (!bull){ setStatus("Tap the bull first (blue)."); return; }
    if (shots.length < 1){ setStatus("Tap at least 1 shot (red)."); return; }

    setStatus("Calculating…");

    // Mean POIB (normalized)
    const poibN = meanPoint(shots);

    // POIB relative to bull in normalized space:
    // x: right positive
    // y: screen down positive -> convert to "up positive" by inverting later
    const relN = { nx: poibN.nx - bull.nx, ny: poibN.ny - bull.ny };

    // Convert to inches placeholder
    const relIn = normalizedToInches(relN.nx, relN.ny);

    // Convert to "math space" inches where +y is UP:
    const poib = { x: relIn.x, y: -relIn.y };

    // Fixed pilot values (matches your screenshots)
    const body = {
      distanceYds: 100,
      moaPerClick: 0.25,
      bull: { x: 0, y: 0 },
      poib
    };

    try{
      const res = await fetch(CALC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      // Diagnostics always available
      diagOut.textContent = JSON.stringify({ bodySent: body, backendResponse: data }, null, 2);

      if (!data || data.ok !== true){
        setStatus("Backend error ❌ (see Diagnostics)");
        return;
      }

      // Backend authority
      const delta = data.delta; // correction vector bull - poib in inches
      const { wind, elev } = dirsFromDelta(delta);

      // Clicks from backend (support multiple shapes)
      const windClicksRaw =
        (data.clicks && typeof data.clicks.windage === "number") ? data.clicks.windage :
        (typeof data.windageClicks === "number") ? data.windageClicks :
        (typeof data.windClicks === "number") ? data.windClicks :
        null;

      const elevClicksRaw =
        (data.clicks && typeof data.clicks.elevation === "number") ? data.clicks.elevation :
        (typeof data.elevationClicks === "number") ? data.elevationClicks :
        (typeof data.elevClicks === "number") ? data.elevClicks :
        null;

      const windClicks = (windClicksRaw ?? 0);
      const elevClicks = (elevClicksRaw ?? 0);

      // Apply outputs
      setCorrections({
        elevDir: elev,
        elevClicks,
        windDir: wind,
        windClicks
      });

      // Keep these in sync with pilot
      distanceOut.textContent = `${data.distanceYds ?? 100} yds`;
      clickOut.textContent    = `${data.moaPerClick ?? 0.25} MOA`;

      // Score placeholder (pilot)
      scoreValue.textContent = "—";

      setStatus("Results ready ✅");
      hintLine.textContent = "Adjust your optic. Then confirm with a new group.";

    }catch(err){
      diagOut.textContent = String(err);
      setStatus("Network error ❌ (see Diagnostics)");
    }
  });

  // Boot
  resetOutputs();
  setStatus("Tap-n-Score loaded ✅");
})();
