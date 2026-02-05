/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 (POLISH)
   Fixes:
   - Prevents "2 hits per tap" (iOS ghost click) using pointer events
   - Aim Point dot = green
   - Hit dots = bright green
   - Cleaner instruction text: "Tap Aim Point" -> "Tap Hits"
   Flow:
   - Upload photo
   - Tap Aim Point (first) then tap hits
   - Show results -> payload -> sec.html (?payload=base64)
   - localStorage backup only
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs in index.html
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine"); // optional but in your latest html

  // Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;

  // normalized (0..1) coords relative to displayed image
  let aim = null;     // {x01,y01}
  let hits = [];      // [{x01,y01},...]

  // --- Ghost tap prevention
  // If a browser fires both pointer + click, we ignore follow-ups inside a short window.
  let lastPointerTapAt = 0;
  const GHOST_WINDOW_MS = 650;

  function now() { return Date.now(); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, txt) {
    if (el) el.textContent = txt;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
  }

  function setInstructionMode() {
    if (!aim) {
      setText(elInstruction, "Tap Aim Point.");
      setText(elStatus, "Tap Aim Point.");
    } else {
      setText(elInstruction, "Tap Hits.");
      setText(elStatus, "Tap Hits.");
    }
  }

  function clearDots() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    setInstructionMode();
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "aim" ? "tapDotAim" : "tapDotHit");
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

  // --- Simple placeholder correction (keeps your “direction always right” logic intact)
  function computeCorrection() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    // aim - POI (move POI to aim)
    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    // Demo scale placeholder: full image width = 10 inches
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

  function handleTap(ev) {
    // Must have image loaded
    if (!elImg?.src) return;

    // Ghost protection: ignore duplicate triggers within window
    const t = now();
    if (t - lastPointerTapAt < GHOST_WINDOW_MS) return;
    lastPointerTapAt = t;

    const { x01, y01 } = getRelative01FromEvent(ev);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setInstructionMode();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();
    setInstructionMode();
  }

  // ---- EVENTS

  // File input — keep iOS-friendly
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);
      elImg.src = objectUrl;

      // reset input so same photo can be re-picked
      elFile.value = "";
    });
  }

  // Tap layer — pointer events ONLY (prevents 2-count issue)
  // Make sure dotsLayer or wrap is actually the tap surface.
  const tapSurface = elWrap || elImg;

  if (tapSurface) {
    // Stop browser gestures from turning into “click” after touch
    tapSurface.style.touchAction = "manipulation";

    tapSurface.addEventListener("pointerdown", (ev) => {
      // Only primary touch/pen/mouse
      if (ev.isPrimary === false) return;
      // Avoid right-click
      if (ev.pointerType === "mouse" && ev.button !== 0) return;

      ev.preventDefault();
      handleTap(ev);
    }, { passive: false });

    // Extra safety: if some browser still fires click, block it
    tapSurface.addEventListener("click", (ev) => {
      const t = now();
      if (t - lastPointerTapAt < GHOST_WINDOW_MS) {
        ev.preventDefault();
        ev.stopPropagation();
        return false;
      }
    }, true);
  }

  if (elClear) elClear.addEventListener("click", clearDots);

  if (elSee) {
    elSee.addEventListener("click", () => {
      const out = computeCorrection();
      if (!out) {
        alert("Tap Aim Point first, then tap at least one hit.");
        return;
      }

      const payload = {
        sessionId: "S-" + Date.now(),
        score: 99,
        shots: hits.length,
        windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
        elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
        secPngUrl: "",
        vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
        surveyUrl: "",
        debug: { aim, avgPoi: out.avgPoi }
      };

      goToSEC(payload);
    });
  }

  // ---- BOOT
  clearDots();
})();
