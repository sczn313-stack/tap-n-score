/* ============================================================
   index.js (FULL REPLACEMENT) — A + B (Picker + iPhone layout safety)
   A:
   - One big button triggers file input
   - NO capture attribute => iPhone offers Library/Camera/Browse
   B:
   - Tap detection ignores scroll/drag (movement threshold)
   - Dots placed in percent so they stay aligned
   Flow:
   - Upload photo
   - Tap bull first, then shots
   - Show results -> builds payload -> URL base64 to sec.html
   - localStorage backup only
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elStatus = $("statusLine");
  const elInstruction = $("instructionLine");

  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;   // {x01,y01}
  let shots = [];    // [{x01,y01},...]

  // ---- tap vs scroll guard
  let down = null; // {x,y,t}
  const MOVE_PX = 10; // if finger moves more than this, treat as scroll

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, txt) {
    if (el) el.textContent = txt;
  }

  function setTapCount() {
    setText(elTapCount, String(shots.length));
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    setText(elInstruction, "Tap bull first, then tap hits.");
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

    // bull - POI (move POI to bull)
    const dx = bull.x01 - avg.x; // + => RIGHT
    const dy = bull.y01 - avg.y; // + => DOWN (screen space)

    // Demo scale placeholder
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

  // ---- Photo button (one button, always gives choices on iPhone)
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => {
      elFile.click();
    });
  }

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => setPhotoUiLoaded(true);
      elImg.src = objectUrl;

      // allow picking same photo again later
      elFile.value = "";
    });
  }

  // ---- Tap handling with scroll guard (pointer events)
  function onDown(ev) {
    if (!elImg || !elImg.src) return;
    const t = ev.touches && ev.touches[0];
    const x = t ? t.clientX : ev.clientX;
    const y = t ? t.clientY : ev.clientY;
    down = { x, y, t: Date.now() };
  }

  function onUp(ev) {
    if (!down) return;
    if (!elImg || !elImg.src) { down = null; return; }

    const t = ev.changedTouches && ev.changedTouches[0];
    const x = t ? t.clientX : ev.clientX;
    const y = t ? t.clientY : ev.clientY;

    const dx = Math.abs(x - down.x);
    const dy = Math.abs(y - down.y);

    // If user moved finger -> scrolling. Ignore as tap.
    if (dx > MOVE_PX || dy > MOVE_PX) {
      down = null;
      return;
    }

    // Must be inside image box
    const r = elImg.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) {
      down = null;
      return;
    }

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
  }

  if (elImg) {
    // Touch
    elImg.addEventListener("touchstart", onDown, { passive: true });
    elImg.addEventListener("touchend", onUp, { passive: true });

    // Mouse
    elImg.addEventListener("mousedown", onDown);
    elImg.addEventListener("mouseup", onUp);
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      clearDots();
      // keep photo loaded state
      setText(elStatus, elImg?.src ? "Tap bull, then tap hits." : "Add a target photo to begin.");
    });
  }

  if (elSee) {
    elSee.addEventListener("click", () => {
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
    });
  }

  // ---- Boot
  clearDots();
  setPhotoUiLoaded(false);
})();
