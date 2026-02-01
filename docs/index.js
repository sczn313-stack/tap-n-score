(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const chooseBtn = $("chooseBtn");
  const clearBtn = $("clearBtn");
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

  const stage = $("stage");
  const img = $("targetImg");
  const tapLayer = $("tapLayer");

  const resultsWrap = $("results");
  const resultGrid = $("resultGrid");

  const diagOut = $("diagOut");

  // Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const CALC_URL = `${API_BASE}/api/calc`;

  // State
  let selectedFile = null;
  let objectUrl = null;

  // Tap coords are stored normalized to the displayed image box (0..1)
  let bull = null;         // { nx, ny }
  let shots = [];          // [{ nx, ny }, ...]

  // --- Helpers
  function setStatus(msg) {
    statusLine.textContent = msg;
  }

  function setChip(dotEl, valueEl, ok, text) {
    dotEl.style.opacity = ok ? "1" : ".25";
    valueEl.textContent = text;
  }

  function clearDots() {
    tapLayer.innerHTML = "";
  }

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

  // Convert normalized tap positions into inches using a simple grid model.
  // For now, we assume the grid visible is 1" squares and we reference bull as (0,0).
  // The actual inch conversion should be replaced with your production mapping layer later.
  function normalizedToInches(deltaNx, deltaNy) {
    // Minimal "docs" conversion:
    // We treat the displayed image box width as 20 inches and height as 20 inches (placeholder),
    // but we keep direction logic correct. This is for UI flow validation only.
    //
    // If you already have true inches mapping elsewhere, swap this function to that.
    const ASSUMED_INCHES_W = 20;
    const ASSUMED_INCHES_H = 20;
    return {
      x: deltaNx * ASSUMED_INCHES_W,
      y: deltaNy * ASSUMED_INCHES_H
    };
  }

  function directionFromDelta(delta) {
    // delta is correction vector bull - poib in inches
    const wind = delta.x === 0 ? "—" : (delta.x < 0 ? "LEFT" : "RIGHT");
    const elev = delta.y === 0 ? "—" : (delta.y > 0 ? "DOWN" : "UP");
    return { wind, elev };
  }

  // --- iOS-safe file open
  chooseBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    selectedFile = f;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      stage.style.display = "block";
      setStatus(`Loaded ✅ ${f.name}`);
      setChip(chipImgDot, chipImg, true, f.name);
      hintLine.textContent = "Tap the bull (blue). Then tap shots (red).";
      hideResultsUI();
      redraw();
    };

    img.onerror = () => {
      setStatus("Could not load image ❌");
      setChip(chipImgDot, chipImg, false, "error");
    };

    img.src = objectUrl;
    img.style.display = "block";
  });

  // --- Tap handling
  function getTapNormalized(ev) {
    const rect = tapLayer.getBoundingClientRect();
    const touch = ev.touches && ev.touches[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // Clamp
    const nx = Math.max(0, Math.min(1, x));
    const ny = Math.max(0, Math.min(1, y));
    return { nx, ny };
  }

  function onTap(ev) {
    if (!img.src) return; // no photo
    ev.preventDefault();

    const p = getTapNormalized(ev);

    // First tap sets bull, next taps are shots
    if (!bull) {
      bull = p;
      setStatus("Bull set ✅");
      setChip(chipBullDot, chipBull, true, "set");
      redraw();
      return;
    }

    shots.push(p);
    setStatus(`Shot added ✅ (${shots.length})`);
    setChip(chipShotsDot, chipShots, shots.length > 0, String(shots.length));
    redraw();
  }

  // Support touch + mouse
  tapLayer.addEventListener("touchstart", onTap, { passive: false });
  tapLayer.addEventListener("click", (ev) => onTap(ev));

  // --- Clear
  clearBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    hideResultsUI();
    redraw();

    setStatus("Cleared ✅");
    setChip(chipBullDot, chipBull, false, "not set");
    setChip(chipShotsDot, chipShots, false, "0");
    diagOut.textContent = "(none)";
  });

  // --- Results
  resultsBtn.addEventListener("click", async () => {
    if (!img.src) { setStatus("Choose a photo first."); return; }
    if (!bull) { setStatus("Tap the bull first (blue)."); return; }
    if (shots.length < 1) { setStatus("Tap at least 1 shot (red)."); return; }

    hideResultsUI();
    setStatus("Calculating…");

    // Compute POIB as mean of shots (normalized)
    const poibN = meanPoint(shots);

    // Correction vector is bull - poib (normalized)
    const deltaN = { nx: bull.nx - poibN.nx, ny: bull.ny - poibN.ny };

    // Convert to inches (docs placeholder mapping)
    const poibIn = normalizedToInches(poibN.nx - bull.nx, poibN.ny - bull.ny); // POIB relative to bull
    // POIB relative to bull should be: right positive, up negative (screen y down), so we invert y:
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

      // Diagnostics
      diagOut.textContent = JSON.stringify({ bodySent: body, backendResponse: data }, null, 2);

      if (!data || data.ok !== true) {
        setStatus("Backend error ❌ (see Diagnostics)");
        return;
      }

      // Use backend delta for authority
      const delta = data.delta; // {x,y} in inches, correction vector bull - poib
      const dir = directionFromDelta(delta);

      // Convert to clicks if backend provides click fields, otherwise compute rough
      // Expected backend fields in your service: inchesPerMoa, moa, clicks, etc.
      const windClicks = data.clicks?.windage ?? data.windageClicks ?? null;
      const elevClicks = data.clicks?.elevation ?? data.elevationClicks ?? null;

      const rows = [
        { label: "Windage", value: `${dir.wind}${windClicks !== null ? ` • ${windClicks.toFixed(2)} clicks` : ""}` },
        { label: "Elevation", value: `${dir.elev}${elevClicks !== null ? ` • ${elevClicks.toFixed(2)} clicks` : ""}` },
        { label: "POIB", value: `x ${Number(data.poib.x).toFixed(2)} in, y ${Number(data.poib.y).toFixed(2)} in` },
        { label: "Distance", value: `${data.distanceYds} yds` },
        { label: "Click value", value: `${data.moaPerClick} MOA/click` }
      ];

      showResultsUI(rows);
      setStatus("Results ready ✅");

    } catch (err) {
      diagOut.textContent = String(err);
      setStatus("Network error ❌ (see Diagnostics)");
    }
  });

  // Boot
  setStatus("Tap-n-Score loaded ✅");
  setChip(chipImgDot, chipImg, false, "not loaded");
  setChip(chipBullDot, chipBull, false, "not set");
  setChip(chipShotsDot, chipShots, false, "0");
})();
