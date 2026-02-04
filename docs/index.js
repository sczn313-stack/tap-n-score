/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 (Mobile-safe taps)
   Fixes:
   - iPhone scroll doesn't create phantom taps (drag/scroll ignored)
   - Keeps existing: camera + library inputs, distance stepper
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Inputs (camera + library)
  const elCam = $("photoInputCamera");
  const elLib = $("photoInputLibrary");

  // Image + overlay
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elStatus = $("statusLine");
  const elInstruction = $("instructionLine");

  // Settings
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");
  const elMinus = $("distMinus");
  const elPlus = $("distPlus");

  // Optional
  const elVendor = $("vendorLink");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;   // {x01,y01}
  let shots = [];    // [{x01,y01},...]

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function setText(el, txt) { if (el) el.textContent = txt; }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    setText(elInstruction, "Tap bull once, then tap each shot.");
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    elDots.appendChild(d);
  }

  function getRelative01FromPoint(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function readDistance() {
    const n = Number(elDistance?.value);
    if (!Number.isFinite(n)) return 100;
    return Math.max(5, Math.min(1000, Math.round(n)));
  }

  function readMoaPerClick() {
    const n = Number(elMoaClick?.value);
    return Number.isFinite(n) && n > 0 ? n : 0.25;
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

    const dist = readDistance();
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

  function loadFile(f) {
    if (!f) return;

    clearDots();

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    setText(elStatus, "Photo loaded. Tap bull, then shots.");
  }

  // ---- Photo inputs
  if (elCam) {
    elCam.addEventListener("change", () => {
      const f = elCam.files && elCam.files[0];
      loadFile(f);
      elCam.value = "";
    });
  }

  if (elLib) {
    elLib.addEventListener("change", () => {
      const f = elLib.files && elLib.files[0];
      loadFile(f);
      elLib.value = "";
    });
  }

  // ============================================================
  // Scroll-safe tap detection (works on iPhone + desktop)
  // A "tap" must be:
  // - small movement (<= 10px)
  // - short press (<= 350ms)
  // ============================================================
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 350;

  let down = null; // {x,y,t}

  function onDown(clientX, clientY) {
    down = { x: clientX, y: clientY, t: Date.now() };
  }

  function onUp(clientX, clientY) {
    if (!down) return null;

    const dt = Date.now() - down.t;
    const dx = clientX - down.x;
    const dy = clientY - down.y;
    const dist = Math.hypot(dx, dy);

    down = null;

    if (dt > TAP_TIME_MS) return null;
    if (dist > TAP_MOVE_PX) return null;

    return { clientX, clientY };
  }

  function registerTap(clientX, clientY) {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01FromPoint(clientX, clientY);

    if (!bull) {
      bull = { x01, y01 };
      addDot(x01, y01, "bull");
      setText(elInstruction, "Bull set. Now tap shots.");
    } else {
      shots.push({ x01, y01 });
      addDot(x01, y01, "shot");
      setTapCount();
    }
  }

  // Touch
  if (elImg) {
    elImg.addEventListener("touchstart", (ev) => {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      onDown(t.clientX, t.clientY);
    }, { passive: true });

    elImg.addEventListener("touchend", (ev) => {
      const t = ev.changedTouches && ev.changedTouches[0];
      if (!t) return;
      const hit = onUp(t.clientX, t.clientY);
      if (hit) registerTap(hit.clientX, hit.clientY);
    }, { passive: true });

    elImg.addEventListener("touchcancel", () => { down = null; }, { passive: true });

    // Mouse
    elImg.addEventListener("mousedown", (ev) => onDown(ev.clientX, ev.clientY));
    elImg.addEventListener("mouseup", (ev) => {
      const hit = onUp(ev.clientX, ev.clientY);
      if (hit) registerTap(hit.clientX, hit.clientY);
    });
    elImg.addEventListener("mouseleave", () => { down = null; });
  }

  // ---- Clear
  if (elClear) elClear.addEventListener("click", () => {
    clearDots();
    setText(elStatus, "Cleared. Tap bull, then shots.");
  });

  // ---- Distance stepper
  function stepDistance(delta) {
    const cur = readDistance();
    const next = Math.max(5, Math.min(1000, cur + delta));
    if (elDistance) elDistance.value = String(next);
  }
  if (elMinus) elMinus.addEventListener("click", () => stepDistance(-5));
  if (elPlus) elPlus.addEventListener("click", () => stepDistance(+5));
  if (elDistance) {
    elDistance.addEventListener("change", () => {
      elDistance.value = String(readDistance());
    });
  }

  // ---- Results
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
        debug: {
          bull,
          avgPoi: out.avgPoi,
          distanceYds: readDistance(),
          moaPerClick: readMoaPerClick()
        }
      };

      goToSEC(payload);
    });
  }

  // ---- Boot
  clearDots();
  setText(elStatus, "Add target photo to begin.");
})();
