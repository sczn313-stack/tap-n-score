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

  // SEC outputs
  const secCard = $("secCard");
  const smartScore = $("smartScore");
  const elevDir = $("elevDir");
  const windDir = $("windDir");
  const elevClicks = $("elevClicks");
  const windClicks = $("windClicks");
  const shotsCount = $("shotsCount");
  const distanceOut = $("distanceOut");
  const clickOut = $("clickOut");

  const diagOut = $("diagOut");

  // Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const CALC_URL = `${API_BASE}/api/calc`;

  // State
  let objectUrl = null;

  // Tap coords normalized to displayed image box (0..1)
  let bull = null;   // { nx, ny }
  let shots = [];    // [{ nx, ny }...]

  // ---- Helpers
  function setStatus(msg) {
    statusLine.textContent = msg;
  }

  function setChip(dotEl, valueEl, ok, text) {
    dotEl.style.opacity = ok ? "1" : ".25";
    valueEl.textContent = text;
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

  // ✅ IMPORTANT: This is still your placeholder “inches mapping”.
  // Swap this later with your true mapping layer.
  function normalizedToInches(deltaNx, deltaNy) {
    const ASSUMED_INCHES_W = 20;
    const ASSUMED_INCHES_H = 20;
    return {
      x: deltaNx * ASSUMED_INCHES_W,
      y: deltaNy * ASSUMED_INCHES_H
    };
  }

  // ✅ Your rule: NO negatives shown + Elevation fixed
  function directionFromDelta(delta) {
    // delta is correction vector bull - poib (inches)
    const wind = delta.x === 0 ? "—" : (delta.x < 0 ? "LEFT" : "RIGHT");
    const elev = delta.y === 0 ? "—" : (delta.y > 0 ? "UP" : "DOWN"); // FIXED
    return { wind, elev };
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return Math.abs(x).toFixed(2); // NO negatives
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
      secCard.style.display = "none";

      setStatus(`Loaded ✅ ${f.name}`);
      setChip(chipImgDot, chipImg, true, f.name);

      hintLine.textContent = "Tap the bull (blue). Then tap shots (red).";
      redraw();
    };

    img.onerror = () => {
      setStatus("Could not load image ❌");
      setChip(chipImgDot, chipImg, false, "error");
    };

    img.src = objectUrl;
  });

  // ---- Tap handling
  function getTapNormalized(ev) {
    const rect = tapLayer.getBoundingClientRect();
    const touch = ev.touches && ev.touches[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return {
      nx: Math.max(0, Math.min(1, x)),
      ny: Math.max(0, Math.min(1, y)),
    };
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
      return;
    }

    shots.push(p);
    setStatus(`Shot added ✅ (${shots.length})`);
    setChip(chipShotsDot, chipShots, true, String(shots.length));
    redraw();
  }

  tapLayer.addEventListener("touchstart", onTap, { passive: false });
  tapLayer.addEventListener("click", (ev) => onTap(ev));

  // ---- Clear
  clearBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    secCard.style.display = "none";
    redraw();

    setStatus("Cleared ✅");
    setChip(chipBullDot, chipBull, false, "not set");
    setChip(chipShotsDot, chipShots, false, "0");
    diagOut.textContent = "(none)";
  });

  // ---- Results
  resultsBtn.addEventListener("click", async () => {
    if (!img.src) { setStatus("Choose a photo first."); return; }
    if (!bull) { setStatus("Tap the bull first (blue)."); return; }
    if (shots.length < 1) { setStatus("Tap at least 1 shot (red)."); return; }

    setStatus("Calculating…");

    const poibN = meanPoint(shots);

    // POIB relative to bull in normalized:
    const poibRelN = { nx: (poibN.nx - bull.nx), ny: (poibN.ny - bull.ny) };

    // Convert to inches (placeholder) then convert to SCZN3-style:
    // screen y down => “up” is negative, so invert y for inches coord system
    const poibRelIn = normalizedToInches(poibRelN.nx, poibRelN.ny);
    const poib = { x: poibRelIn.x, y: -poibRelIn.y };

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

      if (!data || data.ok !== true) {
        setStatus("Backend error ❌ (see Diagnostics)");
        return;
      }

      // Backend is authority
      const delta = data.delta; // correction vector bull - poib (inches)
      const dir = directionFromDelta(delta);

      // Prefer backend clicks (whatever your backend returns)
      const wind = (data.clicks?.windage ?? data.windageClicks ?? null);
      const elev = (data.clicks?.elevation ?? data.elevationClicks ?? null);

      // Fill SEC
      secCard.style.display = "block";
      smartScore.textContent = "92"; // pilot placeholder, swap to your real score when ready

      elevDir.textContent = dir.elev;
      windDir.textContent = dir.wind;

      elevClicks.textContent = elev !== null ? fmt2(elev) : "—";
      windClicks.textContent = wind !== null ? fmt2(wind) : "—";

      shotsCount.textContent = String(shots.length);
      distanceOut.textContent = `${Number(data.distanceYds).toFixed(0)} yds`;
      clickOut.textContent = `${Number(data.moaPerClick).toFixed(2)} MOA`;

      setStatus("Results ready ✅");

    } catch (err) {
      diagOut.textContent = String(err);
      setStatus("Network error ❌ (see Diagnostics)");
    }
  });

  // ---- Boot
  setStatus("Tap-n-Score loaded ✅");
  setChip(chipImgDot, chipImg, false, "not loaded");
  setChip(chipBullDot, chipBull, false, "not set");
  setChip(chipShotsDot, chipShots, false, "0");
})();
