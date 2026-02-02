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

  // Tap coords normalized to the displayed image box (0..1)
  let bull = null; // { nx, ny }
  let shots = [];  // [{ nx, ny }, ...]

  // --- Helpers
  function setStatus(msg) {
    statusLine.textContent = msg;
  }

  function setHint(msg) {
    hintLine.textContent = msg;
  }

  function setChip(dotEl, valueEl, ok, text) {
    dotEl.style.opacity = ok ? "1" : ".25";
    valueEl.textContent = text;
  }

  function setBodyState(className, on) {
    document.body.classList.toggle(className, !!on);
  }

  function clearDots() {
    tapLayer.innerHTML = "";
  }

  function addDot(nx, ny, kind) {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
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

  // Placeholder mapping until true calibration is wired
  function normalizedToInches(deltaNx, deltaNy) {
    const ASSUMED_INCHES_W = 20;
    const ASSUMED_INCHES_H = 20;
    return { x: deltaNx * ASSUMED_INCHES_W, y: deltaNy * ASSUMED_INCHES_H };
  }

  function directionFromDelta(delta) {
    // delta is correction vector bull - poib in inches
    const wind = delta.x === 0 ? "—" : (delta.x < 0 ? "LEFT" : "RIGHT");
    const elev = delta.y === 0 ? "—" : (delta.y > 0 ? "DOWN" : "UP");
    return { wind, elev };
  }

  function resetAllUI() {
    bull = null;
    shots = [];
    hideResultsUI();
    redraw();

    setBodyState("img-loaded", !!img.src);
    setBodyState("bull-set", false);
    setBodyState("shots-set", false);
    setBodyState("results-ready", false);

    setChip(chipBullDot, chipBull, false, "not set");
    setChip(chipShotsDot, chipShots, false, "0");
    diagOut.textContent = "(none)";

    if (!img.src) {
      setStatus("Ready ✅");
      setHint("Press Choose Photo to begin.");
      setChip(chipImgDot, chipImg, false, "not loaded");
    } else {
      setStatus("Tap bull (blue) ✅");
      setHint("First tap = bull. Next taps = shots.");
      setChip(chipImgDot, chipImg, true, "loaded");
    }
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

      img.style.display = "block";

      setBodyState("img-loaded", true);
      setBodyState("bull-set", false);
      setBodyState("shots-set", false);
      setBodyState("results-ready", false);

      setStatus("Photo loaded ✅ Now tap bull (blue).");
      setHint("First tap = bull. Next taps = shots.");
      setChip(chipImgDot, chipImg, true, f.name);
      setChip(chipBullDot, chipBull, false, "not set");
      setChip(chipShotsDot, chipShots, false, "0");

      hideResultsUI();
      bull = null;
      shots = [];
      redraw();

      // Important: clear input so choosing same photo again still triggers change
      fileInput.value = "";
    };

    img.onerror = () => {
      setStatus("Could not load image ❌");
      setHint("Try choosing the photo again.");
      setChip(chipImgDot, chipImg, false, "error");
      setBodyState("img-loaded", false);
    };

    img.src = objectUrl;
  });

  // --- Tap handling (ONE event only — fixes iOS double-count)
  function getTapNormalized(ev) {
    const rect = tapLayer.getBoundingClientRect();
    const clientX = ev.clientX;
    const clientY = ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    const nx = Math.max(0, Math.min(1, x));
    const ny = Math.max(0, Math.min(1, y));
    return { nx, ny };
  }

  function onTap(ev) {
    if (!img.src) return; // no photo loaded
    ev.preventDefault();

    const p = getTapNormalized(ev);

    // 1) bull
    if (!bull) {
      bull = p;
      setBodyState("bull-set", true);

      setStatus("Bull set ✅ Now tap shots (red).");
      setHint("Tap each confirmed hit. Then press Results.");
      setChip(chipBullDot, chipBull, true, "set");
      redraw();
      return;
    }

    // 2) shots
    shots.push(p);
    setBodyState("shots-set", true);

    setStatus(`Shot added ✅ (${shots.length})`);
    setHint("Keep tapping hits, then press Results.");
    setChip(chipShotsDot, chipShots, shots.length > 0, String(shots.length));
    redraw();
  }

  tapLayer.addEventListener("pointerdown", onTap, { passive: false });

  // --- Clear
  clearBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    hideResultsUI();
    redraw();

    setBodyState("bull-set", false);
    setBodyState("shots-set", false);
    setBodyState("results-ready", false);

    setStatus("Cleared ✅ Tap bull (blue).");
    setHint("First tap = bull. Next taps = shots.");
    setChip(chipBullDot, chipBull, false, "not set");
    setChip(chipShotsDot, chipShots, false, "0");
    diagOut.textContent = "(none)";
  });

  // --- Results
  resultsBtn.addEventListener("click", async () => {
    if (!img.src) { setStatus("Choose a photo first."); return; }
    if (!bull) { setStatus("Tap bull first (blue)."); return; }
    if (shots.length < 1) { setStatus("Tap at least 1 shot (red)."); return; }

    hideResultsUI();
    setBodyState("results-ready", false);
    setStatus("Calculating…");
    setHint("Hold tight — backend math is authority.");

    // Compute POIB as mean of shots (normalized)
    const poibN = meanPoint(shots);

    // Correction vector is bull - poib (normalized)
    const deltaN = { nx: bull.nx - poibN.nx, ny: bull.ny - poibN.ny };

    // Convert to inches (docs placeholder mapping)
    const poibIn = normalizedToInches(poibN.nx - bull.nx, poibN.ny - bull.ny); // POIB relative to bull
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
        setHint("We’ll fix backend next. UI is stable.");
        return;
      }

      // Use backend delta for authority
      const delta = data.delta; // {x,y} in inches, correction vector bull - poib
      const dir = directionFromDelta(delta);

      const windClicks = data.clicks?.windage ?? data.windageClicks ?? null;
      const elevClicks = data.clicks?.elevation ?? data.elevationClicks ?? null;

      const rows = [
        { label: "Windage", value: `${dir.wind}${windClicks !== null ? ` • ${windClicks.toFixed(2)} clicks` : ""}` },
        { label: "Elevation", value: `${dir.elev}${elevClicks !== null ? ` • ${elevClicks.toFixed(2)} clicks` : ""}` }
      ];

      showResultsUI(rows);
      setBodyState("results-ready", true);
      setStatus("Results ready ✅");
      setHint("If it looks right, screenshot or proceed to SEC.");
    } catch (err) {
      diagOut.textContent = String(err);
      setStatus("Network error ❌ (see Diagnostics)");
      setHint("Backend wiring next — frontend is now clean.");
    }
  });

  // Boot
  setStatus("Tap-n-Score loaded ✅");
  setChip(chipImgDot, chipImg, false, "not loaded");
  setChip(chipBullDot, chipBull, false, "not set");
  setChip(chipShotsDot, chipShots, false, "0");

  setBodyState("img-loaded", false);
  setBodyState("bull-set", false);
  setBodyState("shots-set", false);
  setBodyState("results-ready", false);

  setHint("Press Choose Photo to begin.");
})();
