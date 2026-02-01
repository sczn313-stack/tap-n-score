(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const chooseBtn = $("chooseBtn");
  const clearBtn = $("clearBtn");
  const resultsBtn = $("resultsBtn");
  const fileInput = $("photoInput");

  const statusLine = $("statusLine");
  const hintLine = $("hintLine");

  const chipBull = $("chipBull");
  const chipShots = $("chipShots");
  const chipBullVal = $("chipBullVal");
  const chipShotsVal = $("chipShotsVal");

  const stage = $("stage");
  const img = $("targetImg");
  const tapLayer = $("tapLayer");

  const secWrap = $("secWrap");
  const secMetaLine = $("secMetaLine");
  const scoreNum = $("scoreNum");

  const elevDir = $("elevDir");
  const elevClicks = $("elevClicks");
  const windDir = $("windDir");
  const windClicks = $("windClicks");

  const truthPoib = $("truthPoib");
  const truthDist = $("truthDist");
  const truthClick = $("truthClick");
  const truthShots = $("truthShots");

  const diagOut = $("diagOut");

  // Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const CALC_URL = `${API_BASE}/api/calc`;

  // State
  let selectedFile = null;
  let objectUrl = null;

  // taps stored normalized to displayed image box (0..1)
  let bull = null;     // { nx, ny }
  let shots = [];      // [{ nx, ny }, ...]

  // --- helpers
  function setStatus(msg) { statusLine.textContent = msg; }

  function setChip(el, on, textEl, text) {
    el.classList.toggle("on", !!on);
    textEl.textContent = text;
  }

  function clearDots() { tapLayer.innerHTML = ""; }

  function addDot(nx, ny, kind) {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${nx * 100}%`;
    d.style.top  = `${ny * 100}%`;
    tapLayer.appendChild(d);
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

  // TEMP mapping for docs: inches are placeholders (UI flow validation).
  // Replace with your real inches mapping later.
  function normalizedToInches(deltaNx, deltaNy) {
    const ASSUMED_INCHES_W = 20;
    const ASSUMED_INCHES_H = 20;
    return {
      x: deltaNx * ASSUMED_INCHES_W,
      y: deltaNy * ASSUMED_INCHES_H
    };
  }

  function directionFromDelta(delta) {
    // delta is correction vector bull - poib in inches (backend authority)
    const wind = delta.x === 0 ? "—" : (delta.x < 0 ? "LEFT" : "RIGHT");
    const elev = delta.y === 0 ? "—" : (delta.y > 0 ? "DOWN" : "UP");
    return { wind, elev };
  }

  function showSEC() { secWrap.style.display = "block"; }
  function hideSEC() { secWrap.style.display = "none"; }

  // --- iOS-safe photo open
  chooseBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    selectedFile = f;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      stage.style.display = "block";
      hideSEC();
      bull = null;
      shots = [];
      redraw();

      setChip(chipBull, false, chipBullVal, "not set");
      setChip(chipShots, false, chipShotsVal, "0");

      setStatus(`Loaded ✅ ${f.name}`);
      hintLine.textContent = "Tap the bull (blue) once. Then tap shots (red).";
    };

    img.onerror = () => setStatus("Could not load image ❌");

    img.src = objectUrl;
  });

  // --- tap capture
  function getTapNormalized(ev) {
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

  function onTap(ev) {
    if (!img.src) return;
    ev.preventDefault();

    const p = getTapNormalized(ev);

    if (!bull) {
      bull = p;
      setStatus("Bull set ✅");
      setChip(chipBull, true, chipBullVal, "set");
      redraw();
      return;
    }

    shots.push(p);
    setStatus(`Shot added ✅ (${shots.length})`);
    setChip(chipShots, shots.length > 0, chipShotsVal, String(shots.length));
    redraw();
  }

  tapLayer.addEventListener("touchstart", onTap, { passive: false });
  tapLayer.addEventListener("click", (ev) => onTap(ev));

  // --- clear
  clearBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    redraw();
    hideSEC();

    setStatus("Cleared ✅");
    hintLine.textContent = "Tap the bull (blue) once. Then tap shots (red).";
    setChip(chipBull, false, chipBullVal, "not set");
    setChip(chipShots, false, chipShotsVal, "0");
    diagOut.textContent = "(none)";
  });

  // --- results
  resultsBtn.addEventListener("click", async () => {
    if (!img.src) { setStatus("Choose a photo first."); return; }
    if (!bull) { setStatus("Tap the bull first (blue)."); return; }
    if (shots.length < 1) { setStatus("Tap at least 1 shot (red)."); return; }

    setStatus("Calculating…");
    hideSEC();

    const poibN = meanPoint(shots); // normalized
    const poibIn = normalizedToInches(poibN.nx - bull.nx, poibN.ny - bull.ny);

    // screen y is down; POIB y should be up-positive in your math space
    const poib = { x: poibIn.x, y: -poibIn.y };

    const body = {
      distanceYds: 100,
      moaPerClick: 0.25,
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

      if (!data || data.ok !== true || !data.delta) {
        setStatus("Backend error ❌ (see Diagnostics)");
        return;
      }

      // direction from backend delta (authority)
      const dir = directionFromDelta(data.delta);

      // clicks (support either naming style)
      const w = data.clicks?.windage ?? data.windageClicks ?? null;
      const e = data.clicks?.elevation ?? data.elevationClicks ?? null;

      // SEC fill
      secMetaLine.textContent = `Session • ${data.distanceYds} yds • ${data.moaPerClick} MOA/click`;

      // pilot score placeholder (until Smart Score is wired)
      scoreNum.textContent = "92";

      elevDir.textContent = dir.elev;
      windDir.textContent = dir.wind;

      elevClicks.textContent = (e !== null && Number.isFinite(Number(e))) ? `${Number(e).toFixed(2)} clicks` : "—";
      windClicks.textContent = (w !== null && Number.isFinite(Number(w))) ? `${Number(w).toFixed(2)} clicks` : "—";

      truthPoib.textContent = `POIB: x ${Number(data.poib.x).toFixed(2)} in, y ${Number(data.poib.y).toFixed(2)} in`;
      truthDist.textContent = `Distance: ${data.distanceYds} yds`;
      truthClick.textContent = `Click: ${data.moaPerClick} MOA`;
      truthShots.textContent = `Shots: ${shots.length}`;

      showSEC();
      setStatus("Results ready ✅");
      hintLine.textContent = "If needed: Clear and re-tap with deliberate hits.";

    } catch (err) {
      diagOut.textContent = String(err);
      setStatus("Network error ❌ (see Diagnostics)");
    }
  });

  // boot
  setStatus("Tap-n-Score loaded ✅");
  setChip(chipBull, false, chipBullVal, "not set");
  setChip(chipShots, false, chipShotsVal, "0");
  hideSEC();
})();
