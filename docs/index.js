/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 + Distance Clicker
   Adds:
   - Distance clicker (+ / -) around #distanceYds input
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs in index.html
  const elFile = $("photoInput");
  const elPhotoBtn = $("photoBtn");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Sticky
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Settings
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds"); // now an <input type="number">
  const elMoaClick = $("moaPerClick");

  // Distance clicker buttons
  const elMinus = $("distMinus");
  const elPlus = $("distPlus");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;   // {x01,y01}
  let shots = [];    // [{x01,y01},...]

  // --- helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, txt) { if (el) el.textContent = txt; }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function showSticky(yes) {
    if (!elStickyBar) return;
    if (yes) {
      elStickyBar.classList.remove("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "false");
    } else {
      elStickyBar.classList.add("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "true");
    }
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    showSticky(false);
    setText(elInstruction, "");
    setText(elStatus, elImg?.src ? "Tap Aim Point, then tap hits." : "Add a target photo to begin.");
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    elDots.appendChild(d);
  }

  function getRelative01FromEvent(ev) {
    const r = elImg.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function readDistanceYds() {
    const n = Number(elDistance?.value);
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.max(1, Math.min(2000, Math.round(n)));
  }

  function readMoaPerClick() {
    const n = Number(elMoaClick?.value);
    return Number.isFinite(n) && n > 0 ? n : 0.25;
  }

  // Demo correction (placeholder math)
  function computeCorrection() {
    if (!bull || shots.length < 1) return null;

    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    // bull - POI (move POI to bull)
    const dx = bull.x01 - avg.x; // + => RIGHT
    const dy = bull.y01 - avg.y; // + => DOWN (screen space)

    // Demo scale: treat full image width as 10 inches
    const inchesPerFullWidth = 10;
    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    const dist = readDistanceYds();
    const moaPerClick = readMoaPerClick();

    const inchesPerMoa = (dist / 100) * 1.047;
    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
    };
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
    const b64 = b64FromObj(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  // --- Distance clicker behavior
  function setDistance(v) {
    const n = Number(v);
    const val = Number.isFinite(n) ? Math.max(1, Math.min(2000, Math.round(n))) : 100;
    if (elDistance) elDistance.value = String(val);
  }

  function stepDistance(delta) {
    const cur = readDistanceYds();
    setDistance(cur + delta);
  }

  if (elMinus) elMinus.addEventListener("click", () => stepDistance(-5));
  if (elPlus) elPlus.addEventListener("click", () => stepDistance(+5));

  if (elDistance) {
    elDistance.addEventListener("change", () => setDistance(readDistanceYds()));
    elDistance.addEventListener("blur", () => setDistance(readDistanceYds()));
  }

  // --- Photo button opens picker (Camera OR Library)
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => elFile.click());
  }

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => {
        setText(elStatus, "Tap Aim Point, then tap hits.");
        setText(elInstruction, "Tap Aim Point (green), then tap hits.");
      };
      elImg.onerror = () => {
        setText(elStatus, "Photo failed to load.");
        setText(elInstruction, "Try again.");
      };

      elImg.src = objectUrl;

      // allow picking same file again
      elFile.value = "";
    });
  }

  // --- Tap handling (single event path to avoid double taps)
  if (elImg) {
    elImg.addEventListener("pointerdown", (ev) => {
      if (!elImg.src) return;
      // stop double-fire from synthesized clicks
      ev.preventDefault();

      const { x01, y01 } = getRelative01FromEvent(ev);

      if (!bull) {
        bull = { x01, y01 };
        addDot(x01, y01, "bull");
        setText(elInstruction, "Now tap hits.");
      } else {
        shots.push({ x01, y01 });
        addDot(x01, y01, "shot");
        setTapCount();

        // show sticky after first hit
        if (shots.length >= 1) showSticky(true);
      }
    }, { passive: false });
  }

  if (elClear) elClear.addEventListener("click", clearDots);

  function runResults() {
    const out = computeCorrection();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one hit.");
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
      debug: { bull, avgPoi: out.avgPoi, distanceYds: readDistanceYds(), moaPerClick: readMoaPerClick() }
    };

    goToSEC(payload);
  }

  if (elStickyBtn) elStickyBtn.addEventListener("click", runResults);

  // --- boot
  setDistance(Number(elDistance?.value || 100));
  clearDots();
})();
