/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 (iPhone Fit + Scroll Safe)
   Flow:
   - Add target photo
   - Tap aim point (first) then tap hits
   - Show results -> payload -> URL base64 -> sec.html
   - localStorage backup only
   Fixes:
   - iPhone scroll-safe: drag/scroll does NOT count as a tap
   - “Add target photo” button hides after photo is loaded
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs in index.html
  const elFile = $("photoInput");
  const elFileBtn = $("fileBtnLabel");
  const elStatus = $("statusLine");

  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");

  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");

  // Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;   // {x01,y01}
  let shots = [];    // [{x01,y01},...]

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    if (elStatus) elStatus.textContent = elImg && elImg.src ? "Tap aim point, then tap hits." : "Add a target photo to begin.";
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    elDots.appendChild(d);
  }

  function getRelative01FromClientXY(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  // Placeholder correction math (baseline pipeline)
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

  // ---- Photo input
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      if (elImg) elImg.src = objectUrl;

      // Hide the "Add target photo" button after selection
      if (elFileBtn) elFileBtn.style.display = "none";

      if (elStatus) elStatus.textContent = "Tap aim point, then tap hits.";
    });
  }

  // ---- iPhone-safe tap detection:
  // If finger moves (drag/scroll), ignore (do not count as tap).
  if (elImg) {
    let start = null; // {x,y}
    let moved = false;
    const MOVE_PX = 10;

    const onStart = (x, y) => {
      start = { x, y };
      moved = false;
    };

    const onMove = (x, y) => {
      if (!start) return;
      const dx = Math.abs(x - start.x);
      const dy = Math.abs(y - start.y);
      if (dx > MOVE_PX || dy > MOVE_PX) moved = true;
    };

    const onEnd = (x, y) => {
      if (!elImg.src) return;
      if (!start) return;

      // Drag/scroll => ignore
      if (moved) {
        start = null;
        moved = false;
        return;
      }

      // True tap
      const { x01, y01 } = getRelative01FromClientXY(x, y);

      if (!bull) {
        bull = { x01, y01 };
        addDot(x01, y01, "bull");
        if (elStatus) elStatus.textContent = "Aim point set. Tap hits.";
      } else {
        shots.push({ x01, y01 });
        addDot(x01, y01, "shot");
        setTapCount();
      }

      start = null;
      moved = false;
    };

    // Touch
    elImg.addEventListener("touchstart", (ev) => {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      onStart(t.clientX, t.clientY);
    }, { passive: true });

    elImg.addEventListener("touchmove", (ev) => {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      onMove(t.clientX, t.clientY);
    }, { passive: true });

    elImg.addEventListener("touchend", (ev) => {
      const t = ev.changedTouches && ev.changedTouches[0];
      if (!t) return;
      onEnd(t.clientX, t.clientY);
    }, { passive: true });

    // Mouse (desktop)
    elImg.addEventListener("mousedown", (ev) => onStart(ev.clientX, ev.clientY));
    elImg.addEventListener("mousemove", (ev) => onMove(ev.clientX, ev.clientY));
    elImg.addEventListener("mouseup", (ev) => onEnd(ev.clientX, ev.clientY));
  }

  // ---- Clear
  if (elClear) elClear.addEventListener("click", clearDots);

  // ---- Show results
  if (elSee) {
    elSee.addEventListener("click", () => {
      const out = computeCorrection();
      if (!out) {
        alert("Add a photo, then tap your aim point and at least one hit.");
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
  clearDots();
})();
