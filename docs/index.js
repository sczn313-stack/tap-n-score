/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 (NO “TAP MODE”)
   Fixes:
   - One photo button offers Camera OR Photo Library on iOS
     (capture= removed in HTML)
   - Tapping automatically “turns on” once photo is loaded
   - Swipe/scroll does NOT create shots (movement threshold)
   - Show Results becomes usable only after bull + 1 shot
   - Keeps copy minimal (no repeated bull-first everywhere)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs
  const elFile = $("photoInput");
  const elAddPhotoBtn = $("addPhotoBtn");
  const elChangePhotoBtn = $("changePhotoBtn");

  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");

  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");

  const elStatus = $("statusLine");
  const elHint = $("instructionLine");

  // Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;

  let tappingEnabled = false;
  let bull = null; // {x01,y01}
  let shots = [];  // [{x01,y01},...]

  // touch/scroll guard
  let touchStart = null; // {x,y,t}
  const MOVE_PX = 12;     // move threshold to treat as scroll/swipe

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, txt) {
    if (el) el.textContent = String(txt);
  }

  function setTapCount() {
    setText(elTapCount, shots.length);
  }

  function setHint(txt) { setText(elHint, txt); }
  function setStatus(txt) { setText(elStatus, txt); }

  function clearDotsOnly() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    setHint("Tap bull → tap hits → show results.");
    setStatus(tappingEnabled ? "Tap the bull." : "Add a target photo to start.");
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

  function computeCorrectionDemo() {
    if (!bull || shots.length < 1) return null;

    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    // bull - POI (move POI to bull)
    const dx = bull.x01 - avg.x; // + => RIGHT
    const dy = bull.y01 - avg.y; // + => DOWN (screen space)

    // Placeholder scale: treat full image width as 10 inches
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
    window.location.href = `/tap-n-score/sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function openPicker() {
    if (!elFile) return;
    elFile.click();
  }

  // ---- Photo handling
  if (elChangePhotoBtn) elChangePhotoBtn.addEventListener("click", openPicker);

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // Reset taps but keep photo
      clearDotsOnly();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      tappingEnabled = false; // enable only after image loads
      setStatus("Loading photo…");

      elImg.onload = () => {
        tappingEnabled = true;
        setStatus("Tap the bull.");
        setHint("Tap bull → tap hits → show results.");

        // hide “Add target photo” and show “Change photo”
        if (elAddPhotoBtn) elAddPhotoBtn.style.display = "none";
        if (elChangePhotoBtn) elChangePhotoBtn.style.display = "inline-flex";
      };

      elImg.onerror = () => {
        tappingEnabled = false;
        setStatus("Photo failed to load.");
        setHint("Try adding the photo again.");
        if (elAddPhotoBtn) elAddPhotoBtn.style.display = "inline-flex";
        if (elChangePhotoBtn) elChangePhotoBtn.style.display = "none";
      };

      elImg.src = objectUrl;

      // allow selecting same file again
      elFile.value = "";
    });
  }

  // ---- Tap handling (NO tap-mode toggle)
  function onTouchStart(e) {
    if (!tappingEnabled) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function onTouchEnd(e) {
    if (!tappingEnabled) return;
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    if (!t) return;

    if (touchStart) {
      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);
      if (dx > MOVE_PX || dy > MOVE_PX) {
        // This was a scroll/swipe — ignore
        touchStart = null;
        return;
      }
    }
    touchStart = null;

    placeTapAt(t.clientX, t.clientY);
  }

  function onClick(e) {
    if (!tappingEnabled) return;
    placeTapAt(e.clientX, e.clientY);
  }

  function placeTapAt(clientX, clientY) {
    if (!elImg || !elImg.src) return;

    const r = elImg.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;

    // Only accept taps inside the image rectangle
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return;

    const { x01, y01 } = getRelative01FromClientXY(clientX, clientY);

    if (!bull) {
      bull = { x01, y01 };
      addDot(x01, y01, "bull");
      setStatus("Now tap your hits.");
      return;
    }

    shots.push({ x01, y01 });
    addDot(x01, y01, "shot");
    setTapCount();
  }

  if (elWrap) {
    // These allow “tap” but still let scroll gestures pass through (we ignore moved touches)
    elWrap.addEventListener("touchstart", onTouchStart, { passive: true });
    elWrap.addEventListener("touchend", onTouchEnd, { passive: true });
    elWrap.addEventListener("click", onClick, { passive: true });
  }

  // ---- Clear
  if (elClear) {
    elClear.addEventListener("click", () => {
      clearDotsOnly();
      // Do NOT bring back “Add photo” — clear should keep current photo
      if (tappingEnabled) setStatus("Cleared. Tap the bull.");
    });
  }

  // ---- Show results
  if (elSee) {
    elSee.addEventListener("click", () => {
      if (!tappingEnabled || !elImg?.src) {
        alert("Add a target photo first.");
        return;
      }
      if (!bull || shots.length < 1) {
        alert("Tap the bull, then tap at least one hit.");
        return;
      }

      const out = computeCorrectionDemo();
      if (!out) return;

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
  tappingEnabled = false;
  clearDotsOnly();
  setStatus("Add a target photo to start.");
})();
