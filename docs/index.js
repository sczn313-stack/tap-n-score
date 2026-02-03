alert("✅ index.js is loading");
console.log("✅ index.js loaded", location.href);/* ============================================================
   index.js (FULL REPLACEMENT) — Works with YOUR index.html
   IDs expected (matches what you pasted):
   - photoInput, targetImg, targetWrap, dotsLayer
   - tapCount, clearTapsBtn, seeResultsBtn
   - distanceYds, moaPerClick
   - vendorLink (optional)

   Output:
   - Builds SEC payload
   - Saves backup to localStorage: SCZN3_SEC_PAYLOAD_V1
   - Routes to: ./sec.html?payload=BASE64&fresh=TIMESTAMP

   NOTE: This is “frontend math” to keep the pipeline solid.
   When you’re ready, we can swap compute() to call /api/calc.
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");

  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");

  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const elVendor = $("vendorLink"); // optional

  // ---- Storage
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  // ---- State
  let objectUrl = null;
  let bull = null;   // {x01,y01}
  let shots = [];    // [{x01,y01},...]

  // ---- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = `${x01 * 100}%`;
    d.style.top = `${y01 * 100}%`;
    elDots.appendChild(d);
  }

  function getRelative01FromEvent(ev) {
    const r = elImg.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  // base64 helpers (safe for unicode)
  function toB64(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  // ---- Frontend “compute” (placeholder math)
  // Keeps directions consistent with your screen-space convention:
  // delta = bull - avgShot
  // dx>0 => RIGHT, dx<0 => LEFT
  // dy>0 => DOWN,  dy<0 => UP
  function computeFromTaps() {
    if (!bull || shots.length < 1) return null;

    // avg POI (normalized)
    let sx = 0, sy = 0;
    for (const p of shots) { sx += p.x01; sy += p.y01; }
    const avg = { x01: sx / shots.length, y01: sy / shots.length };

    const dx01 = bull.x01 - avg.x01;
    const dy01 = bull.y01 - avg.y01;

    // “fake inches” scale just to drive clicks until backend is wired
    // Treat full image width as 10.00 inches (placeholder)
    const inchesPerFullWidth = 10.0;
    const inchesX = dx01 * inchesPerFullWidth;
    const inchesY = dy01 * inchesPerFullWidth;

    const dist = Number(elDistance?.value ?? 100);
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    // True MOA inches @ distance: 1 MOA = 1.047" @ 100y
    const inchesPerMoa = 1.047 * (dist / 100);

    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    const windDir = clicksX === 0 ? "NONE" : (clicksX > 0 ? "RIGHT" : "LEFT");
    const elevDir = clicksY === 0 ? "NONE" : (clicksY > 0 ? "DOWN" : "UP");

    return {
      bull,
      avgPoi: avg,
      windage: { dir: windDir, clicks: round2(Math.abs(clicksX)) },
      elevation:{ dir: elevDir, clicks: round2(Math.abs(clicksY)) }
    };
  }

  function routeToSEC(payload) {
    // backup storage
    try { localStorage.setItem(SEC_KEY, JSON.stringify(payload)); } catch {}

    // primary: URL payload
    const b64 = toB64(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  // ---- Events
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      if (elImg) elImg.src = objectUrl;
    });
  }

  // Tap on the IMAGE (dotsLayer has pointer-events:none in your HTML — perfect)
  if (elImg) {
    elImg.addEventListener("click", (ev) => {
      if (!elImg.src) return;

      const { x01, y01 } = getRelative01FromEvent(ev);

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
      const out = computeFromTaps();
      if (!out) {
        alert("Tap the bull first, then tap at least one shot.");
        return;
      }

      // Build SEC payload (what sec.js expects)
      const payload = {
        sessionId: `S-${Date.now()}`,
        score: 99, // placeholder until backend score exists
        shots: shots.length,

        windage: { dir: out.windage.dir, clicks: round2(out.windage.clicks) },
        elevation:{ dir: out.elevation.dir, clicks: round2(out.elevation.clicks) },

        secPngUrl: "", // optional later
        vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
        surveyUrl: "",

        debug: {
          bull: out.bull,
          avgPoi: out.avgPoi
        }
      };

      routeToSEC(payload);
    });
  }

  // ---- Boot
  clearDots();
})();
