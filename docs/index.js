(() => {
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");
  const elResults = $("resultsBox");
  const elMode = $("modeSelect");

  // --- State
  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // {xPct, yPct}

  // --- Persist last mode
  const MODE_KEY = "tns_last_mode";
  try {
    const last = localStorage.getItem(MODE_KEY);
    if (last) elMode.value = last;
  } catch {}

  elMode.addEventListener("change", () => {
    try { localStorage.setItem(MODE_KEY, elMode.value); } catch {}
  });

  // --- Helpers
  function setHint(msg) { elInstruction.textContent = msg; }

  function setButtons() {
    elTapCount.textContent = String(taps.length);
    elClear.disabled = taps.length === 0;
    elSee.disabled = taps.length === 0 || !selectedFile;
  }

  function clearDots() {
    elDots.innerHTML = "";
  }

  function drawDots() {
    clearDots();
    for (const t of taps) {
      const d = document.createElement("div");
      d.className = "dot";
      d.style.left = `${t.xPct}%`;
      d.style.top = `${t.yPct}%`;
      elDots.appendChild(d);
    }
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  // --- iOS-safe: store File immediately on change
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;

    // reset session taps when new image chosen
    taps = [];
    setButtons();
    elResults.style.display = "none";
    elResults.innerHTML = "";

    revokeObjectUrl();
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;
    elImg.style.display = "block";

    setHint("Tap each bullet hole. Use Clear to restart. Then Show Results.");
  });

  // --- Tap handling: attach to wrapper, compute % coords within image box
  function onTap(ev) {
    if (!selectedFile || elImg.style.display === "none") {
      setHint("Choose a target photo first.");
      return;
    }

    const rect = elImg.getBoundingClientRect();
    const clientX = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
    const clientY = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY);

    // Only accept taps that land on the image area
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    // clamp 0..100
    const xPct = Math.max(0, Math.min(100, x));
    const yPct = Math.max(0, Math.min(100, y));

    taps.push({ xPct, yPct });
    drawDots();
    setButtons();
    elResults.style.display = "none";
    elResults.innerHTML = "";
  }

  // Use pointer events (best cross-platform) + touch fallback
  elWrap.addEventListener("pointerdown", (e) => {
    // prevent double-fire on iOS
    if (e.pointerType === "touch") e.preventDefault();
    onTap(e);
  }, { passive: false });

  // Safety fallback (some iOS cases)
  elWrap.addEventListener("touchstart", (e) => {
    e.preventDefault();
    onTap(e);
  }, { passive: false });

  elClear.addEventListener("click", () => {
    taps = [];
    drawDots();
    setButtons();
    elResults.style.display = "none";
    elResults.innerHTML = "";
    setHint("Cleared. Tap each bullet hole again.");
  });

  elSee.addEventListener("click", () => {
    if (!selectedFile || taps.length === 0) return;

    const mode = elMode.value; // pistol / rifle / measure

    // For v1 we only show tap summary (POIB + clicks will come after backend hook)
    const avg = taps.reduce((a, t) => ({ x: a.x + t.xPct, y: a.y + t.yPct }), { x: 0, y: 0 });
    const poibX = avg.x / taps.length;
    const poibY = avg.y / taps.length;

    elResults.style.display = "block";
    elResults.innerHTML = `
      <div style="font-weight:800; font-size:16px; margin-bottom:8px;">Session Summary</div>
      <div><b>Mode:</b> ${mode}</div>
      <div><b>Taps:</b> ${taps.length}</div>
      <div><b>POIB (image %):</b> X ${poibX.toFixed(2)}% • Y ${poibY.toFixed(2)}%</div>
      <div style="margin-top:10px; color:#b9b9b9;">
        Next: we’ll map taps to inches, compute POIB offset to bull, then clicks + score100.
      </div>
    `;
  });

  // init
  setButtons();
  setHint("Choose a target photo to begin.");
})();
