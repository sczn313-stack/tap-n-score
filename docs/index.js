/* ============================================================
   index.js (FULL REPLACEMENT) — Magic Sticky Results (Pause-to-show)
   - Big photo button triggers picker (Library/Camera/Browse)
   - Tap vs scroll guard (movement threshold)
   - Sticky "Show results" appears ONLY when:
       bull exists AND shots >= 1 AND user pauses tapping ~900ms
   - Normal "Show results" button stays hidden (cleaner)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn"); // hidden by CSS
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  const elStatus = $("statusLine");
  const elInstruction = $("instructionLine");

  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;
  let shots = [];

  // tap vs scroll guard
  let down = null;
  const MOVE_PX = 10;

  // pause-to-show
  let pauseTimer = null;
  const PAUSE_MS = 900;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, txt) { if (el) el.textContent = txt; }

  function setTapCount() { setText(elTapCount, String(shots.length)); }

  function hideSticky() {
    if (!elStickyBar) return;
    elStickyBar.classList.add("stickyHidden");
    elStickyBar.setAttribute("aria-hidden", "true");
  }

  function showStickyIfReady() {
    if (!elStickyBar) return;
    const ready = Boolean(bull) && shots.length >= 1;
    if (!ready) { hideSticky(); return; }
    elStickyBar.classList.remove("stickyHidden");
    elStickyBar.setAttribute("aria-hidden", "false");
  }

  function scheduleStickyAfterPause() {
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      showStickyIfReady();
    }, PAUSE_MS);
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    setText(elInstruction, "Tap bull first, then tap hits.");
    hideSticky();
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    elDots.appendChild(d);
  }

  function getRelative01(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
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

    const dx = bull.x01 - avg.x; // + => RIGHT
    const dy = bull.y01 - avg.y; // + => DOWN (screen space)

    // Placeholder scale
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
      elevation:{ dir: clicksY >= 0 ? "DOWN"  : "UP",   clicks: Math.abs(clicksY) },
    };
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
    const b64 = b64FromObj(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function setPhotoUiLoaded(loaded) {
    if (!elPhotoBtn) return;
    if (loaded) {
      elPhotoBtn.textContent = "Change photo";
      setText(elStatus, "Tap bull, then tap hits.");
    } else {
      elPhotoBtn.textContent = "Add Target Picture";
      setText(elStatus, "Add a target photo to begin.");
    }
  }

  function doShowResults() {
    const out = computeCorrection();
    if (!out) {
      alert("Tap the bull first, then tap at least one hit.");
      return;
    }

    const payload = {
      sessionId: "S-" + Date.now(),
      score: 99,
      shots: shots.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation:{ dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      secPngUrl: "",
      vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
      surveyUrl: "",
      debug: { bull, avgPoi: out.avgPoi }
    };

    goToSEC(payload);
  }

  // ---- Photo button
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
        setPhotoUiLoaded(true);
        hideSticky();
      };

      elImg.src = objectUrl;

      // allow re-select same file later
      elFile.value = "";
    });
  }

  // ---- Tap capture
  function onDown(ev) {
    if (!elImg || !elImg.src) return;
    hideSticky(); // while tapping, keep it out of the way

    const t = ev.touches && ev.touches[0];
    const x = t ? t.clientX : ev.clientX;
    const y = t ? t.clientY : ev.clientY;
    down = { x, y };
  }

  function onUp(ev) {
    if (!down) return;
    if (!elImg || !elImg.src) { down = null; return; }

    const t = ev.changedTouches && ev.changedTouches[0];
    const x = t ? t.clientX : ev.clientX;
    const y = t ? t.clientY : ev.clientY;

    const dxm = Math.abs(x - down.x);
    const dym = Math.abs(y - down.y);

    // scroll/drag => ignore
    if (dxm > MOVE_PX || dym > MOVE_PX) { down = null; return; }

    // must be inside image
    const r = elImg.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) { down = null; return; }

    const { x01, y01 } = getRelative01(x, y);

    if (!bull) {
      bull = { x01, y01 };
      addDot(x01, y01, "bull");
      setText(elInstruction, "Bull set ✅ Now tap hits.");
    } else {
      shots.push({ x01, y01 });
      addDot(x01, y01, "shot");
      setTapCount();
    }

    down = null;

    // pause-to-show sticky (only when shooter stops tapping)
    scheduleStickyAfterPause();
  }

  if (elImg) {
    elImg.addEventListener("touchstart", onDown, { passive: true });
    elImg.addEventListener("touchend", onUp, { passive: true });

    elImg.addEventListener("mousedown", onDown);
    elImg.addEventListener("mouseup", onUp);
  }

  // ---- Buttons
  if (elClear) {
    elClear.addEventListener("click", () => {
      clearDots();
      setText(elStatus, elImg?.src ? "Tap bull, then tap hits." : "Add a target photo to begin.");
    });
  }

  if (elSee) elSee.addEventListener("click", doShowResults);
  if (elStickyBtn) elStickyBtn.addEventListener("click", doShowResults);

  // ---- Boot
  clearDots();
  setPhotoUiLoaded(false);
  hideSticky();
})();
