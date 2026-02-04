/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 + Hide Add Photo
   Behavior:
   - "Add target photo" is visible until an image loads
   - Once image loads, hide Add Photo control (clean UI)
   - If user taps Clear, show Add Photo again (optional, but requested)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs in index.html
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elStatus = $("statusLine");
  const elInstruction = $("instructionLine");

  // New wrapper we added in index.html
  const elAddPhotoWrap = $("addPhotoWrap");

  // Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;   // {x01,y01}
  let shots = [];    // [{x01,y01},...]

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, txt) {
    if (el) el.textContent = txt;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function showAddPhoto(yes) {
    if (!elAddPhotoWrap) return;
    elAddPhotoWrap.style.display = yes ? "" : "none";
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();

    // When cleared, we show Add Photo again (your request)
    showAddPhoto(true);

    setText(elStatus, "Choose a photo to begin.");
    setText(elInstruction, "Tap the bull first, then tap each shot.");
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

  function computeCorrection() {
    if (!bull || shots.length < 1) return null;

    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    // bull - POI (move POI to bull)
    const dx = bull.x01 - avg.x; // + => RIGHT
    const dy = bull.y01 - avg.y; // + => DOWN (screen space)

    // Demo scale (placeholder): treat full image width as 10 inches
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
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
    };
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

    const b64 = b64FromObj(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  // ---- Events
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // New photo = reset tap state
      bull = null;
      shots = [];
      if (elDots) elDots.innerHTML = "";
      setTapCount();

      // Load image
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      // Hide Add Photo AFTER image actually loads
      elImg.onload = () => {
        showAddPhoto(false);
        setText(elStatus, "Photo loaded. Tap bull, then shots.");
      };

      elImg.onerror = () => {
        showAddPhoto(true);
        setText(elStatus, "Photo failed to load. Try again.");
      };

      elImg.src = objectUrl;
      setText(elInstruction, "Tap the bull first, then tap each shot.");

      // iOS: allow selecting same file again
      elFile.value = "";
    });
  }

  if (elImg) {
    elImg.addEventListener("click", (ev) => {
      if (!elImg.src) return;

      const { x01, y01 } = getRelative01FromEvent(ev);

      if (!bull) {
        bull = { x01, y01 };
        addDot(x01, y01, "bull");
        setText(elStatus, "Bull set. Tap shots.");
      } else {
        shots.push({ x01, y01 });
        addDot(x01, y01, "shot");
        setTapCount();
      }
    }, { passive: true });
  }

  if (elClear) elClear.addEventListener("click", clearDots);

  if (elSee) {
    elSee.addEventListener("click", () => {
      const out = computeCorrection();
      if (!out) {
        alert("Tap the bull first, then tap at least one shot.");
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

  // ---- Boot
  showAddPhoto(true);
  clearDots();
})();
