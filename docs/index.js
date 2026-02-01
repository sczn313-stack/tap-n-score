(() => {
  const $ = (id) => document.getElementById(id);

  const chooseBtn  = $("chooseBtn");
  const clearBtn   = $("clearBtn");
  const input      = $("photoInput");
  const statusLine = $("statusLine");
  const tapCountEl = $("tapCount");

  const targetWrap = $("targetWrap");
  const img        = $("targetImg");
  const tapLayer   = $("tapLayer");

  // State
  let selectedFile = null;
  let objectUrl = null;
  let taps = []; // {xPct, yPct}

  function setStatus(msg) {
    statusLine.textContent = msg;
  }

  function resetImage() {
    // revoke URL if we used it
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    img.removeAttribute("src");
    targetWrap.style.display = "none";
    selectedFile = null;
    input.value = "";
    clearTaps();
    setStatus("Ready ✅ Tap Choose Photo.");
  }

  function clearTaps() {
    taps = [];
    tapCountEl.textContent = "0";
    // remove dots
    tapLayer.querySelectorAll(".dot").forEach((n) => n.remove());
  }

  function addDotAtPct(xPct, yPct) {
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.left = (xPct * 100).toFixed(4) + "%";
    dot.style.top  = (yPct * 100).toFixed(4) + "%";
    tapLayer.appendChild(dot);
  }

  function onPickFile(file) {
    if (!file) return;

    selectedFile = file;

    // Use object URL for speed + iOS stability
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      targetWrap.style.display = "block";
      clearTaps();
      setStatus(`Loaded ✅ ${file.name || "photo"} — tap to mark hits.`);
    };

    img.onerror = () => {
      setStatus("Image failed to load ❌ Try a different photo.");
    };

    img.src = objectUrl;
  }

  // --- iOS-safe choose flow: button click triggers input click (user gesture)
  chooseBtn.addEventListener("click", () => {
    // ensure the input exists + is clickable
    input.click();
  });

  // store file immediately on change
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    onPickFile(file);
  });

  clearBtn.addEventListener("click", () => {
    // If image exists, clear taps first, else reset everything
    if (targetWrap.style.display === "block") {
      clearTaps();
      setStatus("Cleared taps ✅");
    } else {
      resetImage();
    }
  });

  // --- Tap capture (single-source): pointerdown ONLY (prevents iOS double-firing click+touch)
  tapLayer.addEventListener("pointerdown", (e) => {
    // don’t allow browser gestures to steal taps
    e.preventDefault();

    // must have image displayed
    if (targetWrap.style.display !== "block") return;

    const r = tapLayer.getBoundingClientRect();
    const x = (e.clientX - r.left);
    const y = (e.clientY - r.top);

    // Clamp inside layer
    const xClamped = Math.max(0, Math.min(r.width,  x));
    const yClamped = Math.max(0, Math.min(r.height, y));

    const xPct = r.width  ? (xClamped / r.width)  : 0;
    const yPct = r.height ? (yClamped / r.height) : 0;

    taps.push({ xPct, yPct });
    tapCountEl.textContent = String(taps.length);

    addDotAtPct(xPct, yPct);
  }, { passive: false });

  // boot
  setStatus("DOCS IOS FIX LOADED ✅ Tap Choose Photo.");
})();
