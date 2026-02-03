/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 (LOCKED)
   Flow:
   - User uploads photo
   - Tap bull (first) then tap shots
   - Click "Show results" → computeCorrection()
   - Build SEC payload (two decimals) → pass via URL base64 to sec.html
   - localStorage is backup only

   REQUIRED IDs in index.html:
   - photoInput
   - targetImg
   - targetWrap
   - dotsLayer
   - tapCount
   - clearTapsBtn
   - seeResultsBtn
   - distanceYds
   - moaPerClick
   (optional)
   - vendorLink

============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");
  const elVendor = $("vendorLink"); // optional

  // ---- State
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  let objectUrl = null;

  // normalized taps (0..1) in screen space (x right, y down)
  let bull = null;   // {x01,y01}
  let shots = [];    // [{x01,y01},...]

  // ---- Helpers
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

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

    // percent positioning so it stays correct with scaling
    d.style.left = x01 * 100 + "%";
    d.style.top = y01 * 100 + "%";

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

  // ============================================================
  // computeCorrection() — LOCKED MATH CORE (BASELINE 22206)
  // ============================================================
  function computeCorrection({ bull, shots, distanceYds, moaPerClick }) {
    if (!bull || !Number.isFinite(bull.x01) || !Number.isFinite(bull.y01)) {
      return { ok: false, error: "Missing/invalid bull" };
    }
    if (!Array.isArray(shots) || shots.length < 1) {
      return { ok: false, error: "Need at least 1 shot" };
    }

    const dist = Number.isFinite(Number(distanceYds)) ? Number(distanceYds) : 100;
    const click = Number.isFinite(Number(moaPerClick)) ? Number(moaPerClick) : 0.25;

    if (!(dist > 0)) return { ok: false, error: "distanceYds must be > 0" };
    if (!(click > 0)) return { ok: false, error: "moaPerClick must be > 0" };

    // avg POI (shots only)
    let sx = 0, sy = 0, n = 0;
    for (const p of shots) {
      const x = Number(p?.x01);
      const y = Number(p?.y01);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        sx += x; sy += y; n += 1;
      }
    }
    if (n === 0) return { ok: false, error: "No valid shots" };

    const avgPoi = { x01: sx / n, y01: sy / n };

    // signed deltas: bull - avgPoi (THE LAW)
    const dx01 = bull.x01 - avgPoi.x01; // + => RIGHT
    const dy01 = bull.y01 - avgPoi.y01; // + => DOWN (screen-space)

    // placeholder inches scale (LOCKED for baseline 22206)
    const inchesPerFullWidth = 10;
    const inchesX = dx01 * inchesPerFullWidth;
    const inchesY = dy01 * inchesPerFullWidth;

    // true MOA inches at distance
    const inchesPerMoa = (dist / 100) * 1.047;

    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const rawClicksX = moaX / click; // signed
    const rawClicksY = moaY / click; // signed

    const windageDir = rawClicksX === 0 ? "NONE" : rawClicksX > 0 ? "RIGHT" : "LEFT";
    const elevDir    = rawClicksY === 0 ? "NONE" : rawClicksY > 0 ? "DOWN"  : "UP";

    const round2 = (v) => Math.round(v * 100) / 100;

    return {
      ok: true,
      avgPoi,
      delta: { dx01, dy01 },
      windage: { dir: windageDir, clicks: round2(Math.abs(rawClicksX)) },
      elevation: { dir: elevDir, clicks: round2(Math.abs(rawClicksY)) }
    };
  }

  // ---- Build + route to SEC
  function goToSEC(payload) {
    // backup store
    try { localStorage.setItem(SEC_KEY, JSON.stringify(payload)); } catch (e) {}

    const b64 = b64FromObj(payload);
    window.location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  // ---- Events
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // reset taps on new photo
      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);
      elImg.src = objectUrl;
    });
  }

  if (elImg) {
    elImg.addEventListener(
      "click",
      (ev) => {
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
      },
      { passive: true }
    );
  }

  if (elClear) elClear.addEventListener("click", clearDots);

  if (elSee) {
    elSee.addEventListener("click", () => {
      if (!bull || shots.length < 1) {
        alert("Tap the bull first, then tap at least one shot.");
        return;
      }

      const distanceYds = Number(elDistance?.value ?? 100);
      const moaPerClick = Number(elMoaClick?.value ?? 0.25);

      const r = computeCorrection({ bull, shots, distanceYds, moaPerClick });
      if (!r.ok) {
        alert(r.error || "Could not compute correction.");
        return;
      }

      // SEC payload (two decimals guaranteed by computeCorrection)
      const payload = {
        sessionId: "S-" + Date.now(),
        score: null, // placeholder (until backend scoring exists)
        shots: shots.length,

        windage: {
          dir: r.windage.dir,
          clicks: Number(r.windage.clicks.toFixed(2))
        },
        elevation: {
          dir: r.elevation.dir,
          clicks: Number(r.elevation.clicks.toFixed(2))
        },

        secPngUrl: "",
        vendorUrl: elVendor?.href || "",
        surveyUrl: "",

        debug: {
          bull,
          avgPoi: r.avgPoi,
          delta: r.delta,
          distanceYds,
          moaPerClick
        }
      };

      goToSEC(payload);
    });
  }

  // ---- Boot
  clearDots();
})();
