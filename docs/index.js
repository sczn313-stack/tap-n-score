(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const chooseBtn = $("chooseBtn");
  const clearBtn = $("clearBtn");
  const undoBtn = $("undoBtn");
  const resetBullBtn = $("resetBullBtn");
  const resultsBtn = $("resultsBtn");
  const fileInput = $("photoInput");

  const statusLine = $("statusLine");
  const hintLine = $("hintLine");

  const chipImgDot = $("chipImgDot");
  const chipBullDot = $("chipBullDot");
  const chipShotsDot = $("chipShotsDot");
  const chipImg = $("chipImg");
  const chipBull = $("chipBull");
  const chipShots = $("chipShots");

  const distanceYdsEl = $("distanceYds");
  const moaPerClickEl = $("moaPerClick");
  const mapWidthInEl = $("mapWidthIn");
  const mapHeightInEl = $("mapHeightIn");

  const stage = $("stage");
  const img = $("targetImg");
  const tapLayer = $("tapLayer");

  const resultsWrap = $("results");
  const resultsMeta = $("resultsMeta");
  const resultGrid = $("resultGrid");

  const diagOut = $("diagOut");

  // Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const CALC_URL = `${API_BASE}/api/calc`;

  // State
  let objectUrl = null;

  // Tap coords normalized to displayed image box (0..1)
  let bull = null;  // { nx, ny }
  let shots = [];   // [{ nx, ny }...]

  // ---------- helpers ----------
  function setStatus(msg) { statusLine.textContent = msg; }

  function setChip(dotEl, valueEl, ok, text) {
    dotEl.classList.toggle("ok", !!ok);
    valueEl.textContent = text;
  }

  function clearDots() { tapLayer.innerHTML = ""; }

  function addDot(nx, ny, kind) {
    const d = document.createElement("div");
    d.className = `tapDot ${kind}`;
    d.style.left = `${nx * 100}%`;
    d.style.top = `${ny * 100}%`;
    tapLayer.appendChild(d);
  }

  function redraw() {
    clearDots();
    if (bull) addDot(bull.nx, bull.ny, "bull");
    for (const s of shots) addDot(s.nx, s.ny, "shot");
  }

  function showResultsUI(rows) {
    resultGrid.innerHTML = "";
    for (const r of rows) {
      const el = document.createElement("div");
      el.className = "resultRow";
      el.innerHTML = `<b>${r.label}</b><span>${r.value}</span>`;
      resultGrid.appendChild(el);
    }
    resultsWrap.style.display = "block";
  }

  function hideResultsUI() {
    resultsWrap.style.display = "none";
    resultGrid.innerHTML = "";
  }

  function meanPoint(list) {
    let sx = 0, sy = 0;
    for (const p of list) { sx += p.nx; sy += p.ny; }
    return { nx: sx / list.length, ny: sy / list.length };
  }

  function num(v, fallback) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  // Explicit mapping (visible inputs, not hidden)
  function normalizedToInches(dxN, dyN) {
    const wIn = Math.max(0.0001, num(mapWidthInEl.value, 20));
    const hIn = Math.max(0.0001, num(mapHeightInEl.value, 20));
    return { x: dxN * wIn, y: dyN * hIn };
  }

  // Authoritative direction from backend delta (bull - poib) in inches
  // Rule lock:
  // - delta.x > 0 => RIGHT, delta.x < 0 => LEFT
  // - delta.y > 0 => UP,    delta.y < 0 => DOWN
  function directionFromDelta(delta) {
    const wind = delta.x === 0 ? "—" : (delta.x > 0 ? "RIGHT" : "LEFT");
    const elev = delta.y === 0 ? "—" : (delta.y > 0 ? "UP" : "DOWN");
    return { wind, elev };
  }

  function updateButtons() {
    undoBtn.disabled = shots.length < 1;
    resetBullBtn.disabled = !bull && shots.length < 1;
    resultsBtn.disabled = !(bull && shots.length >= 1);
  }

  function resetSessionDotsOnly() {
    bull = null;
    shots = [];
    redraw();
    hideResultsUI();
    setChip(chipBullDot, chipBull, false, "not set");
    setChip(chipShotsDot, chipShots, false, "0");
    updateButtons();
  }

  // ---------- iOS-safe picker ----------
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
      setChip(chipImgDot, chipImg, true, f.name);

      resetSessionDotsOnly(); // new photo = new session
      redraw();
      updateButtons();
    };

    img.onerror = () => {
      setStatus("Could not load image ❌");
      setChip(chipImgDot, chipImg, false, "error");
    };

    img.src = objectUrl;
  });

  // ---------- taps ----------
  function getTapNormalized(ev) {
    const rect = tapLayer.getBoundingClientRect();
    const touch = ev.touches && ev.touches[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    const nx = Math.max(0, Math.min(1, x));
    const ny = Math.max(0, Math.min(1, y));
    return { nx, ny };
  }

  function onTap(ev) {
    if (!img.src) return;
    ev.preventDefault();

    const p = getTapNormalized(ev);

    if (!bull) {
      bull = p;
      setStatus("Bull set ✅");
      setChip(chipBullDot, chipBull, true, "set");
      redraw();
      updateButtons();
      return;
    }

    shots.push(p);
    setStatus(`Shot added ✅ (${shots.length})`);
    setChip(chipShotsDot, chipShots, true, String(shots.length));
    redraw();
    updateButtons();
  }

  tapLayer.addEventListener("touchstart", onTap, { passive: false });
  tapLayer.addEventListener("click", (ev) => onTap(ev));

  // ---------- controls ----------
  clearBtn.addEventListener("click", () => {
    hideResultsUI();
    diagOut.textContent = "(none)";
    setStatus("Cleared ✅");
    hintLine.textContent = "Tap the bull (blue). Then tap shots (red).";
    resetSessionDotsOnly();
  });

  undoBtn.addEventListener("click", () => {
    if (shots.length < 1) return;
    shots.pop();
    setStatus(shots.length ? `Undo ✅ (${shots.length} shots left)` : "Undo ✅ (no shots)");
    setChip(chipShotsDot, chipShots, shots.length > 0, String(shots.length));
    redraw();
    updateButtons();
  });

  resetBullBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    hideResultsUI();
    setStatus("Bull reset ✅ (tap bull again)");
    setChip(chipBullDot, chipBull, false, "not set");
    setChip(chipShotsDot, chipShots, false, "0");
    redraw();
    updateButtons();
  });

  // ---------- results ----------
  resultsBtn.addEventListener("click", async () => {
    if (!img.src) { setStatus("Choose a photo first."); return; }
    if (!bull) { setStatus("Tap the bull first (blue)."); return; }
    if (shots.length < 1) { setStatus("Tap at least 1 shot (red)."); return; }

    hideResultsUI();
    setStatus("Calculating…");

    const distanceYds = num(distanceYdsEl.value, 100);
    const moaPerClick = num(moaPerClickEl.value, 0.25);

    // POIB = mean of shots (normalized)
    const poibN = meanPoint(shots);

    // POIB relative to bull (normalized)
    const poibRelN = { nx: poibN.nx - bull.nx, ny: poibN.ny - bull.ny };

    // Convert to inches.
    // IMPORTANT: screen y grows DOWN, but our inches y is UP.
    const poibRelIn_screen = normalizedToInches(poibRelN.nx, poibRelN.ny);
    const poib = { x: poibRelIn_screen.x, y: -poibRelIn_screen.y };

    const body = {
      distanceYds,
      moaPerClick,
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
        setStatus("Backend error ❌ (open Diagnostics)");
        return;
      }

      // Backend is authority
      const delta = data.delta; // correction vector bull - poib (inches)
      const dir = directionFromDelta(delta);

      // Click extraction (supports multiple backend shapes)
      let windClicks = null;
      let elevClicks = null;

      if (data.clicks && typeof data.clicks === "object") {
        windClicks = Number.isFinite(Number(data.clicks.windage)) ? Number(data.clicks.windage) : null;
        elevClicks = Number.isFinite(Number(data.clicks.elevation)) ? Number(data.clicks.elevation) : null;
      }
      if (windClicks === null && Number.isFinite(Number(data.windageClicks))) windClicks = Number(data.windageClicks);
      if (elevClicks === null && Number.isFinite(Number(data.elevationClicks))) elevClicks = Number(data.elevationClicks);

      // If backend didn’t send clicks, compute them from inchesPerMoa + moaPerClick if present
      if ((windClicks === null || elevClicks === null) && Number.isFinite(Number(data.inchesPerMoa))) {
        const inchesPerMoa = Number(data.inchesPerMoa);
        const windMoa = delta.x / inchesPerMoa;
        const elevMoa = delta.y / inchesPerMoa;
        if (windClicks === null) windClicks = windMoa / moaPerClick;
        if (elevClicks === null) elevClicks = elevMoa / moaPerClick;
      }

      resultsMeta.textContent = `${data.distanceYds} yds • ${data.moaPerClick} MOA/click`;

      const rows = [
        { label: "Windage", value: `${dir.wind}${windClicks !== null ? ` • ${windClicks.toFixed(2)} clicks` : ""}` },
        { label: "Elevation", value: `${dir.elev}${elevClicks !== null ? ` • ${elevClicks.toFixed(2)} clicks` : ""}` },
        { label: "POIB", value: `x ${Number(data.poib.x).toFixed(2)} in, y ${Number(data.poib.y).toFixed(2)} in` },
        { label: "Delta", value: `x ${Number(delta.x).toFixed(2)} in, y ${Number(delta.y).toFixed(2)} in` }
      ];

      showResultsUI(rows);
      setStatus("Results ready ✅");

    } catch (err) {
      diagOut.textContent = String(err);
      setStatus("Network error ❌ (open Diagnostics)");
    }
  });

  // Boot
  setStatus("Tap-n-Score loaded ✅");
  hintLine.textContent = "Choose Photo to begin.";
  setChip(chipImgDot, chipImg, false, "not loaded");
  setChip(chipBullDot, chipBull, false, "not set");
  setChip(chipShotsDot, chipShots, false, "0");
  updateButtons();
})();
