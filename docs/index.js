/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 (LOCKED, CLEAN)
   Flow:
   - User uploads photo
   - Tap bull (first) then tap shots
   - Click "Show results" => computeCorrection()
   - Build SEC payload (two decimals) -> pass via URL base64 to sec.html
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
   - vendorLink (optional)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- REQUIRED ELEMENT IDs on Target page
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");

  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");

  const elVendor = $("vendorLink");     // optional
  const elDistance = $("distanceYds");  // required by baseline
  const elMoaClick = $("moaPerClick");  // required by baseline

  // ---- State
  const KEY = "SCZN3_SEC_PAYLOAD_V1";
  let objectUrl = null;

  let bull = null;      // {x01,y01}
  let shots = [];       // [{x01,y01}, ...]

  // ---- Helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

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
    d.style.left = (x01 * 100) + "%";
    d.style.top  = (y01 * 100) + "%";
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

  // ---- Frontend compute (placeholder) — keeps pipeline solid
  function computeCorrection() {
    if (!bull || shots.length < 1) return null;

    // Avg POI in normalized coords
    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    // bull - poi (move POI to bull)
    const dx = bull.x01 - avg.x; // + => RIGHT
    const dy = bull.y01 - avg.y; // + => DOWN in screen space

    // demo scale: width=10"
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

    const windage = {
      dir: clicksX >= 0 ? "RIGHT" : "LEFT",
      clicks: Math.abs(clicksX)
    };

    // Screen-space DOWN = +dy => dial DOWN
    const elevation = {
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
    // Backup storage
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

    // Primary: URL payload
    const b64 = b64FromObj(payload);
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
      elImg.src = objectUrl;

      // snap to top so user starts at the image area clean
      try { window.location.hash = "top"; } catch {}
    });
  }

  if (elImg) {
    elImg.addEventListener("click", (ev) => {
      if (!elImg.src) return;

      const { x01, y01 } = getRelative01FromEvent(ev);

      if (!bull) {
        bull = { x01, y01 };
        addDot(x01, y01, "bull");
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
        shots: out.shots.length,
        windage: {
          dir: out.windage.dir,
          clicks: Number(out.windage.clicks.toFixed(2))
        },
        elevation: {
          dir: out.elevation.dir,
          clicks: Number(out.elevation.clicks.toFixed(2))
        },
        secPngUrl: "",
        vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
        surveyUrl: "",
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
