/* ============================================================
   index.js (FULL REPLACEMENT) — POLISH v2
   Adds:
   - Less repetitive instruction text
   - Action bar already sticky via HTML/CSS (no JS needed)
   Keeps:
   - One photo button w/ iOS options
   - Tap Mode OFF lets you scroll safely
   - Distance stepper (+/-) and editable number
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const addPhotoBtn = $("addPhotoBtn");
  const elFile = $("photoInput");
  const statusLine = $("statusLine");

  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const tapLayer = $("tapLayer");

  const elTapCount = $("tapCount");
  const elTapModeBtn = $("tapModeBtn");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elInstruction = $("instructionLine");

  const elVendor = $("vendorLink");

  const elDistance = $("distanceYds");
  const distDown = $("distDown");
  const distUp = $("distUp");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;
  let shots = [];
  let tapMode = false;

  function setStatus(txt) { if (statusLine) statusLine.textContent = txt; }
  function setInstruction(txt) { if (elInstruction) elInstruction.textContent = txt; }
  function setTapCount() { if (elTapCount) elTapCount.textContent = String(shots.length); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function clearDotsOnly() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
  }

  function resetAll() {
    clearDotsOnly();
    if (elImg) elImg.removeAttribute("src");
    if (addPhotoBtn) addPhotoBtn.style.display = "";
    setTapMode(false);
    setStatus("Add a target photo.");
    setInstruction("Turn Tap mode ON when you’re ready.");
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    elDots.appendChild(d);
  }

  function getRelative01FromPoint(pt) {
    const r = elImg.getBoundingClientRect();
    const x = (pt.clientX - r.left) / r.width;
    const y = (pt.clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
    const b64 = b64FromObj(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function computeCorrection() {
    if (!bull || shots.length < 1) return null;

    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    const dx = bull.x01 - avg.x; // + RIGHT
    const dy = bull.y01 - avg.y; // + DOWN (screen-space)

    const inchesPerFullWidth = 10;
    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    const dist = Number(elDistance?.value ?? 100);
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    const inchesPerMoa = (dist / 100) * 1.047;
    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) }
    };
  }

  function setTapMode(on) {
    tapMode = !!on;
    if (tapLayer) tapLayer.style.display = tapMode ? "block" : "none";

    if (elTapModeBtn) elTapModeBtn.textContent = tapMode ? "Tap mode: ON" : "Tap mode: OFF";

    if (!elImg?.src) {
      setInstruction("Turn Tap mode ON when you’re ready.");
      return;
    }

    if (!tapMode) {
      setStatus("Scroll-safe (Tap mode OFF).");
      setInstruction("Turn Tap mode ON when you’re ready.");
      return;
    }

    setStatus("Tap mode ON.");
    setInstruction(!bull ? "Tap the bull." : "Tap each shot.");
  }

  // Photo button (iOS options)
  if (addPhotoBtn && elFile) {
    addPhotoBtn.addEventListener("click", () => {
      try {
        if (typeof elFile.showPicker === "function") elFile.showPicker();
        else elFile.click();
      } catch {
        elFile.click();
      }
    });
  }

  // Photo chosen
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDotsOnly();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);
      if (elImg) elImg.src = objectUrl;

      if (addPhotoBtn) addPhotoBtn.style.display = "none";

      setTapMode(false);
      setStatus("Photo loaded.");
      setInstruction("Turn Tap mode ON when you’re ready.");

      // allow picking same image later
      elFile.value = "";
    });
  }

  // Tap capture only when Tap Mode ON
  function handleTap(ev) {
    if (!tapMode) return;
    if (!elImg?.src) return;

    ev.preventDefault();

    const pt = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
    const { x01, y01 } = getRelative01FromPoint(pt);

    if (!bull) {
      bull = { x01, y01 };
      addDot(x01, y01, "bull");
      setInstruction("Tap each shot.");
      return;
    }

    shots.push({ x01, y01 });
    addDot(x01, y01, "shot");
    setTapCount();
  }

  if (tapLayer) {
    tapLayer.addEventListener("touchstart", handleTap, { passive: false });
    tapLayer.addEventListener("click", handleTap);
  }

  if (elTapModeBtn) elTapModeBtn.addEventListener("click", () => setTapMode(!tapMode));

  if (elClear) elClear.addEventListener("click", resetAll);

  if (elSee) {
    elSee.addEventListener("click", () => {
      const out = computeCorrection();
      if (!out) {
        alert("Turn Tap mode ON, tap bull, then tap at least one shot.");
        return;
      }

      const payload = {
        sessionId: "S-" + Date.now(),
        score: 99,
        shots: shots.length,
        windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
        elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
        secPngUrl: "",
        vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
        surveyUrl: "",
        debug: { bull, avgPoi: out.avgPoi }
      };

      goToSEC(payload);
    });
  }

  // Distance stepper
  function bumpDistance(delta) {
    const cur = Number(elDistance?.value ?? 100);
    const next = Math.max(1, Math.round(cur + delta));
    if (elDistance) elDistance.value = String(next);
  }
  if (distDown) distDown.addEventListener("click", () => bumpDistance(-1));
  if (distUp) distUp.addEventListener("click", () => bumpDistance(+1));

  // Boot
  clearDotsOnly();
  setTapMode(false);
  setStatus("Add a target photo.");
  setInstruction("Turn Tap mode ON when you’re ready.");
})();
