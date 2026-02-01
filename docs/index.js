(() => {
  const $ = (id) => document.getElementById(id);

  const chooseBtn  = $("chooseBtn");
  const clearBtn   = $("clearBtn");
  const undoBtn    = $("undoBtn");
  const input      = $("photoInput");

  const statusLine = $("statusLine");
  const bullStatus = $("bullStatus");
  const shotCount  = $("shotCount");

  const targetWrap = $("targetWrap");
  const img        = $("targetImg");
  const tapLayer   = $("tapLayer");

  // State
  let selectedFile = null;
  let objectUrl = null;

  // Tap model:
  // bull = {xPct,yPct} (single)
  // shots = array of {xPct,yPct}
  let bull = null;
  let shots = [];

  function setStatus(msg) { statusLine.textContent = msg; }

  function revokeUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function clearDots() {
    tapLayer.querySelectorAll(".dot").forEach((n) => n.remove());
  }

  function redraw() {
    clearDots();

    // bull first
    if (bull) addDot(bull.xPct, bull.yPct, "dotBull");

    // then shots
    for (const s of shots) addDot(s.xPct, s.yPct, "dotShot");

    bullStatus.textContent = bull ? "set ✅" : "not set";
    shotCount.textContent = String(shots.length);
  }

  function addDot(xPct, yPct, cls) {
    const dot = document.createElement("div");
    dot.className = `dot ${cls}`;
    dot.style.left = (xPct * 100).toFixed(4) + "%";
    dot.style.top  = (yPct * 100).toFixed(4) + "%";
    tapLayer.appendChild(dot);
  }

  function resetAll() {
    revokeUrl();
    img.removeAttribute("src");
    targetWrap.style.display = "none";
    selectedFile = null;
    input.value = "";

    bull = null;
    shots = [];
    redraw();

    setStatus("Ready ✅ Tap Choose Photo.");
  }

  function clearTapsOnly() {
    bull = null;
    shots = [];
    redraw();
    setStatus("Cleared taps ✅ Next tap sets bull.");
  }

  function onPickFile(file) {
    if (!file) return;

    selectedFile = file;

    revokeUrl();
    objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      targetWrap.style.display = "block";
      clearTapsOnly();
      setStatus(`Loaded ✅ ${file.name || "photo"} — tap bull first, then tap shots.`);
    };

    img.onerror = () => {
      setStatus("Image failed to load ❌ Try a different photo.");
    };

    img.src = objectUrl;
  }

  function pctFromEvent(e) {
    const r = tapLayer.getBoundingClientRect();
    const x = (e.clientX - r.left);
    const y = (e.clientY - r.top);

    const xClamped = Math.max(0, Math.min(r.width,  x));
    const yClamped = Math.max(0, Math.min(r.height, y));

    return {
      xPct: r.width  ? (xClamped / r.width)  : 0,
      yPct: r.height ? (yClamped / r.height) : 0,
    };
  }

  // Buttons
  chooseBtn.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    onPickFile(file);
  });

  clearBtn.addEventListener("click", () => {
    if (targetWrap.style.display === "block") clearTapsOnly();
    else resetAll();
  });

  undoBtn.addEventListener("click", () => {
    if (shots.length > 0) {
      shots.pop();
      redraw();
      setStatus("Undid last shot ✅");
      return;
    }
    if (bull) {
      bull = null;
      redraw();
      setStatus("Removed bull ✅ Next tap sets bull.");
      return;
    }
    setStatus("Nothing to undo.");
  });

  // Tap capture
  tapLayer.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (targetWrap.style.display !== "block") return;

    const { xPct, yPct } = pctFromEvent(e);

    if (!bull) {
      bull = { xPct, yPct };
      redraw();
      setStatus("Bull set ✅ Now tap shots.");
      return;
    }

    shots.push({ xPct, yPct });
    redraw();
    setStatus(`Shot added ✅ (${shots.length})`);
  }, { passive: false });

  // boot
  setStatus("DOCS IOS FIX LOADED ✅ Tap Choose Photo.");
})();
