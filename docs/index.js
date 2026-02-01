
(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const chooseBtn  = $("chooseBtn");
  const clearBtn   = $("clearBtn");
  const resultsBtn = $("resultsBtn");
  const fileInput  = $("photoInput");

  const statusLine = $("statusLine");
  const hintLine   = $("hintLine");

  const stage = $("stage");
  const img   = $("targetImg");
  const layer = $("tapLayer");

  const sec        = $("sec");
  const smartScore = $("smartScore");

  const elevWord   = $("elevWord");
  const windWord   = $("windWord");
  const elevClicks = $("elevClicks");
  const windClicks = $("windClicks");

  const shotsLine = $("shotsLine");
  const distLine  = $("distLine");
  const clickLine = $("clickLine");

  const diagOut = $("diagOut");

  // Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const CALC_URL = `${API_BASE}/api/calc`;

  // Pilot constants
  const DIST_YDS = 100;
  const MOA_PER_CLICK = 0.25;

  // State
  let objectUrl = null;
  let bull = null;   // {nx, ny}
  let shots = [];    // [{nx, ny}, ...]

  function setStatus(msg) { statusLine.textContent = msg; }
  function showSec(show) { sec.style.display = show ? "block" : "none"; }

  function clearDots() { layer.innerHTML = ""; }

  function addDot(nx, ny, kind) {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${nx * 100}%`;
    d.style.top  = `${ny * 100}%`;
    layer.appendChild(d);
  }

  function redraw() {
    clearDots();
    if (bull) addDot(bull.nx, bull.ny, "bull");
    for (const s of shots) addDot(s.nx, s.ny, "shot");
  }

  function meanPoint(list) {
    let sx = 0, sy = 0;
    for (const p of list) { sx += p.nx; sy += p.ny; }
    return { nx: sx / list.length, ny: sy / list.length };
  }

  // Placeholder mapping (swap later for real inches mapping)
  function normalizedToInches(dxN, dyN) {
    const W_IN = 20;
    const H_IN = 20;
    return { x: dxN * W_IN, y: dyN * H_IN };
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return Math.abs(x).toFixed(2); // never show negatives
  }

  function dirWordsFromDelta(delta) {
    // Backend delta = (bull - poib) inches (backend sign conventions)
    // Windage: delta.x > 0 => RIGHT, else LEFT (fine)
    const wind = delta.x === 0 ? "—" : (delta.x > 0 ? "RIGHT" : "LEFT");

    // ✅ ELEVATION FIX:
    // Your observed behavior indicates delta.y sign is opposite of what we assumed.
    // So: delta.y < 0 => DOWN, delta.y > 0 => UP
    const elev = delta.y === 0 ? "—" : (delta.y < 0 ? "DOWN" : "UP");

    return { wind, elev };
  }

  // iOS-safe open
  chooseBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      stage.style.display = "block";
      showSec(false);

      bull = null;
      shots = [];
      redraw();

      setStatus(`Loaded ✅ ${f.name}`);
      hintLine.textContent = "Tap the bull (blue). Then tap shots (red).";
    };

    img.onerror = () => setStatus("Could not load image ❌");

    img.src = objectUrl;
  });

  // Tap math
  function getTapNormalized(ev) {
    const rect = layer.getBoundingClientRect();
    const touch = ev.touches && ev.touches[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top)  / rect.height;

    return {
      nx: Math.max(0, Math.min(1, x)),
      ny: Math.max(0, Math.min(1, y))
    };
  }

  function onTap(ev) {
    if (!img.src) return;
    ev.preventDefault();

    const p = getTapNormalized(ev);

    if (!bull) {
      bull = p;
      setStatus("Bull set ✅");
      redraw();
      return;
    }

    shots.push(p);
    setStatus(`Shot added ✅ (${shots.length})`);
    redraw();
  }

  layer.addEventListener("touchstart", onTap, { passive:false });
  layer.addEventListener("click", onTap);

  // Clear
  clearBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    redraw();
    showSec(false);
    diagOut.textContent = "(none)";
    setStatus("Cleared ✅");
    hintLine.textContent = "Tap the bull (blue). Then tap shots (red).";
  });

  // Results
  resultsBtn.addEventListener("click", async () => {
    if (!img.src) { setStatus("Choose a photo first."); return; }
    if (!bull) { setStatus("Tap the bull first (blue)."); return; }
    if (shots.length < 1) { setStatus("Tap at least 1 shot (red)."); return; }

    setStatus("Calculating…");
    showSec(false);

    const poibN = meanPoint(shots);

    const dxN = (poibN.nx - bull.nx); // right +
    const dyN = (poibN.ny - bull.ny); // down +

    const poibInScreen = normalizedToInches(dxN, dyN);
    const poib = { x: poibInScreen.x, y: -poibInScreen.y }; // y up +

    const body = {
      distanceYds: DIST_YDS,
      moaPerClick: MOA_PER_CLICK,
      bull: { x: 0, y: 0 },
      poib
    };

    try {
      const res = await fetch(CALC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      diagOut.textContent = JSON.stringify({ bodySent: body, backendResponse: data }, null, 2);

      if (!data || data.ok !== true) {
        setStatus("Backend error ❌ (see Diagnostics)");
        return;
      }

      const delta = data.delta; // correction vector
      const dir = dirWordsFromDelta(delta);

      const w = (data.clicks && (data.clicks.windage ?? data.clicks.x)) ?? data.windageClicks ?? data.clickX ?? null;
      const e = (data.clicks && (data.clicks.elevation ?? data.clicks.y)) ?? data.elevationClicks ?? data.clickY ?? null;

      windWord.textContent = dir.wind;
      elevWord.textContent = dir.elev;

      windClicks.textContent = w == null ? "—" : fmt2(w);
      elevClicks.textContent = e == null ? "—" : fmt2(e);

      shotsLine.textContent = `Shots: ${shots.length}`;
      distLine.textContent  = `Distance: ${data.distanceYds} yds`;
      clickLine.textContent = `Click: ${data.moaPerClick} MOA`;

      smartScore.textContent = "—"; // pilot

      showSec(true);
      setStatus("Results ready ✅");

    } catch (err) {
      diagOut.textContent = String(err);
      setStatus("Network error ❌ (see Diagnostics)");
    }
  });

  // Boot
  setStatus("Tap-n-Score loaded ✅");
  showSec(false);
})();
