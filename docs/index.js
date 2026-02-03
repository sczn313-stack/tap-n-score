/* ============================================================
   index.js (FULL REPLACEMENT) — Target Page → SEC handoff
   Fix:
   - SEC payload is passed via URL (base64) for reliability.
   - localStorage used only as backup.
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- REQUIRED ELEMENT IDs on Target page
  // Photo + canvas/layer
  const elFile = $("photoInput");     // <input type="file" id="photoInput" accept="image/*">
  const elImg = $("targetImg");       // <img id="targetImg">
  const elDots = $("dotsLayer");      // <div id="dotsLayer"> overlay container (position:absolute)
  const elWrap = $("targetWrap");     // <div id="targetWrap"> wrapper around img + dots

  // Controls
  const elTapCount = $("tapCount");   // <span id="tapCount">
  const elClear = $("clearTapsBtn");  // <button id="clearTapsBtn">
  const elSee = $("seeResultsBtn");   // <button id="seeResultsBtn">

  // Optional UI / links (safe if null)
  const elVendor = $("vendorLink");   // <a id="vendorLink">
  const elDistance = $("distanceYds");// <select or input id="distanceYds">
  const elMoaClick = $("moaPerClick");// <select or input id="moaPerClick">

  // ---- State
  const KEY = "SCZN3_SEC_PAYLOAD_V1";
  let objectUrl = null;
  let taps = []; // {x01,y01, kind:'bull'|'shot'}
  let bull = null;
  let shots = [];

  // ---- Helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function clearDots() {
    taps = [];
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
  }

  function addDot(x01, y01, kind) {
    taps.push({ x01, y01, kind });

    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");

    // percent positioning so it stays correct with scaling
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";

    elDots.appendChild(d);
  }

  function getRelative01FromEvent(ev) {
    // tap coordinates relative to the displayed image box
    const r = elImg.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  // ---- Simple click math (placeholder)
  // IMPORTANT: This only exists so the pipeline works end-to-end.
  // Your real backend can replace this later.
  function computeDirectionsFromTaps() {
    // Need bull + at least 1 shot
    if (!bull || shots.length < 1) return null;

    // Compute POI average in normalized space
    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    // Signed deltas: bull - POI (we want to move POI to bull)
    const dx = bull.x01 - avg.x; // + means need RIGHT
    const dy = bull.y01 - avg.y; // + means need DOWN in screen space

    // Convert to "fake inches" scale just for demo pipeline:
    // Treat image width as 10 inches. (Replace later with real inches mapping.)
    const inchesPerFullWidth = 10;
    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    // User distance + moa/click (default safe values)
    const dist = Number(elDistance?.value ?? 100);
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    // Inches per MOA (true MOA) at distance
    const inchesPerMoa = (dist / 100) * 1.047;
    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    const windage = {
      dir: clicksX >= 0 ? "RIGHT" : "LEFT",
      clicks: Math.abs(clicksX)
    };

    const elevation = {
      // screen-space down is +dy, but elevation “UP” is the opposite of screen-down.
      // If dy is positive (bull below POI), you need to move POI DOWN => dial DOWN.
      dir: clicksY >= 0 ? "DOWN" : "UP",
      clicks: Math.abs(clicksY)
    };

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      bull,
      shots,
      windage,
      elevation
    };
  }

  function goToSEC(payload) {
    // Store backup
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) {}

    // URL payload is primary
    const b64 = b64FromObj(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  // ---- Events
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // reset dots when new photo selected
      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);
      elImg.src = objectUrl;
    });
  }

  if (elImg) {
    elImg.addEventListener("click", (ev) => {
      // Must have image loaded
      if (!elImg.src) return;

      const { x01, y01 } = getRelative01FromEvent(ev);

      // First tap = bull, remaining taps = shots
      if (!bull) {
        bull = { x01, y01 };
        addDot(x01, y01, "bull");
      } else {
        const s = { x01, y01 };
        shots.push(s);
        addDot(x01, y01, "shot");
        setTapCount();
      }
    }, { passive: true });
  }

  if (elClear) elClear.addEventListener("click", clearDots);

  if (elSee) {
    elSee.addEventListener("click", () => {
      const out = computeDirectionsFromTaps();
      if (!out) {
        alert("Tap the bull first, then tap at least one shot.");
        return;
      }

      // Build SEC payload
      const payload = {
        sessionId: "S-" + Date.now(),
        score: 99,                // placeholder
        shots: out.shots.length,
        windage: {
          dir: out.windage.dir,
          clicks: Number(out.windage.clicks.toFixed(2))
        },
        elevation: {
          dir: out.elevation.dir,
          clicks: Number(out.elevation.clicks.toFixed(2))
        },
        secPngUrl: "",            // optional
        vendorUrl: elVendor?.href || "",
        surveyUrl: "",            // optional
        debug: {
          bull: out.bull,
          avgPoi: out.avgPoi
        }
      };

      goToSEC(payload);
    });
  }

  // ---- Boot
  clearDots();
})();
