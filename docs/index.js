(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const chooseBtn = $("chooseBtn");
  const clearBtn  = $("clearBtn");
  const resultsBtn = $("resultsBtn");
  const fileInput = $("photoInput");

  const stage = $("stage");
  const img = $("targetImg");
  const tapLayer = $("tapLayer");

  const scoreValue = $("scoreValue");
  const scoreSub   = $("scoreSub");

  const elevDirPill = $("elevDirPill");
  const windDirPill = $("windDirPill");
  const elevClicksEl = $("elevClicks");
  const windClicksEl = $("windClicks");
  const shotsCountEl = $("shotsCount");

  const noteLine = $("noteLine");
  const diagOut = $("diagOut");

  // Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const CALC_URL = `${API_BASE}/api/calc`;

  // State
  let objectUrl = null;
  let bull = null;     // { nx, ny }
  let shots = [];      // [{ nx, ny }, ...]

  // ---- upstream settings (MOVED OFF THIS PAGE)
  // Read from query string OR localStorage (set these on page 2).
  function getNum(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function readUpstreamSettings() {
    const qs = new URLSearchParams(location.search);

    const distanceYds =
      getNum(qs.get("distanceYds"), getNum(localStorage.getItem("distanceYds"), 100));

    const moaPerClick =
      getNum(qs.get("moaPerClick"), getNum(localStorage.getItem("moaPerClick"), 0.25));

    return { distanceYds, moaPerClick };
  }

  // Store latest so refresh keeps it
  function persistSettings({ distanceYds, moaPerClick }) {
    localStorage.setItem("distanceYds", String(distanceYds));
    localStorage.setItem("moaPerClick", String(moaPerClick));
  }

  // Tap coords normalized to displayed image (0..1)
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

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

  // IMPORTANT:
  // This is still a placeholder conversion until your true mapping layer is wired.
  // Direction/click authority comes from backend, not this client mapping.
  function normalizedToInches(deltaNx, deltaNy) {
    const ASSUMED_W_IN = 20;
    const ASSUMED_H_IN = 20;
    return { x: deltaNx * ASSUMED_W_IN, y: deltaNy * ASSUMED_H_IN };
  }

  function setPill(el, text){
    el.textContent = text;
  }

  function setClicks(el, v){
    const n = Number(v);
    el.textContent = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function setScore(v){
    // pilot: show dash if not provided
    scoreValue.textContent = (v === null || v === undefined) ? "—" : String(v);
  }

  function getTapNormalized(ev) {
    const rect = tapLayer.getBoundingClientRect();
    const t = ev.touches && ev.touches[0];
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return { nx: clamp01(x), ny: clamp01(y) };
  }

  function onTap(ev) {
    if (!img.src) return;
    ev.preventDefault();

    const p = getTapNormalized(ev);

    if (!bull) {
      bull = p;
      noteLine.textContent = "Bull set (blue). Now tap shots (red).";
      redraw();
      return;
    }

    shots.push(p);
    shotsCountEl.textContent = String(shots.length);
    noteLine.textContent = `Shots: ${shots.length}. Tap more or hit “Show Results”.`;
    redraw();
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
      bull = null;
      shots = [];
      shotsCountEl.textContent = "0";
      setPill(elevDirPill, "—");
      setPill(windDirPill, "—");
      setClicks(elevClicksEl, 0);
      setClicks(windClicksEl, 0);
      setScore(null);
      noteLine.textContent = "Tap the bull (blue), then tap shots (red).";
      diagOut.textContent = "(none)";
      redraw();
    };

    img.onerror = () => {
      noteLine.textContent = "Could not load image.";
    };

    img.src = objectUrl;
  });

  tapLayer.addEventListener("touchstart", onTap, { passive:false });
  tapLayer.addEventListener("click", (ev) => onTap(ev));

  clearBtn.addEventListener("click", () => {
    bull = null;
    shots = [];
    shotsCountEl.textContent = "0";
    setPill(elevDirPill, "—");
    setPill(windDirPill, "—");
    setClicks(elevClicksEl, 0);
    setClicks(windClicksEl, 0);
    setScore(null);
    noteLine.textContent = "Cleared. Tap the bull (blue), then tap shots (red).";
    diagOut.textContent = "(none)";
    redraw();
  });

  resultsBtn.addEventListener("click", async () => {
    if (!img.src) { noteLine.textContent = "Choose a photo first."; return; }
    if (!bull) { noteLine.textContent = "Tap the bull first (blue)."; return; }
    if (shots.length < 1) { noteLine.textContent = "Tap at least 1 shot (red)."; return; }

    noteLine.textContent = "Calculating…";

    const { distanceYds, moaPerClick } = readUpstreamSettings();
    persistSettings({ distanceYds, moaPerClick });

    // POIB normalized mean
    const poibN = meanPoint(shots);

    // Convert POIB relative to bull into inches (placeholder)
    const poibInRaw = normalizedToInches(poibN.nx - bull.nx, poibN.ny - bull.ny);

    // Adopt convention: x right positive, y up positive (screen y is down, so invert)
    const poib = { x: poibInRaw.x, y: -poibInRaw.y };

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
        noteLine.textContent = "Backend error (see Diagnostics).";
        return;
      }

      // Backend authority
      const delta = data.delta; // correction vector bull - poib

      // Directions (if backend provides explicit, use it; else derive from delta)
      const windDir = data.directions?.windage
        ?? (delta.x === 0 ? "—" : (delta.x > 0 ? "RIGHT" : "LEFT"));

      const elevDir = data.directions?.elevation
        ?? (delta.y === 0 ? "—" : (delta.y > 0 ? "UP" : "DOWN"));

      // Clicks: prefer backend fields; fallbacks are safe
      const windClicks =
        data.clicks?.windage ??
        data.windageClicks ??
        (Number.isFinite(data.delta?.x) && Number.isFinite(data.inchesPerMoa)
          ? (Math.abs(data.delta.x) / data.inchesPerMoa) / moaPerClick
          : 0);

      const elevClicks =
        data.clicks?.elevation ??
        data.elevationClicks ??
        (Number.isFinite(data.delta?.y) && Number.isFinite(data.inchesPerMoa)
          ? (Math.abs(data.delta.y) / data.inchesPerMoa) / moaPerClick
          : 0);

      setPill(windDirPill, windDir);
      setPill(elevDirPill, elevDir);
      setClicks(windClicksEl, windClicks);
      setClicks(elevClicksEl, elevClicks);

      // Pilot score (only if backend provides one)
      const smartScore = data.smartScore ?? null;
      setScore(smartScore);

      noteLine.textContent = "Results ready.";
    } catch (err) {
      diagOut.textContent = String(err);
      noteLine.textContent = "Network error (see Diagnostics).";
    }
  });

  // Boot defaults
  setScore(null);
  noteLine.textContent = "Choose a photo. Tap bull (blue), then shots (red).";
})();
