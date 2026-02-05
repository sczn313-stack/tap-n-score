/* ============================================================
   /tap-n-score/index.js (FULL REPLACEMENT) — “LOCK-N-ROLL” Polish
   Goals:
   - One photo button -> opens picker
   - Tap Aim Point (first) in GREEN, then tap Hits (bright green)
   - Prevent “2 hits per tap” (no touch+click double fire)
   - “Confidence Lock” feedback:
       • status text updates
       • subtle aim-point pulse
       • small haptic (where supported)
   - Sticky “Show results” appears after a short pause (magic)
   - URL payload (base64) to sec.html; localStorage backup
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- REQUIRED IDs
  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  const elStickyBar = $("stickyBar");
  const elStickyResultsBtn = $("stickyResultsBtn");

  // Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  // ---- Storage / routing
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  // ---- State
  let objectUrl = null;

  // Normalized 0..1 points (screen-space): x right +, y down +
  let aim = null;      // {x01,y01}
  let hits = [];       // [{x01,y01}...]

  // Tap control / anti-double-fire
  let lastPointerTs = 0;

  // Sticky “magic” timer
  let idleTimer = null;

  // ---- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function setText(el, txt) {
    if (el) el.textContent = String(txt ?? "");
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
  }

  function haptic(ms = 10) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_) {}
  }

  function clearDots() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    setText(elInstruction, "");
    setText(elStatus, "Add a target photo to begin.");
    if (elPhotoBtn) elPhotoBtn.style.display = "";
  }

  function makeDot(x01, y01, kind) {
    if (!elDots) return null;

    const d = document.createElement("div");
    d.className = "tapDot";

    // Position (percent so it scales)
    d.style.left = `${x01 * 100}%`;
    d.style.top = `${y01 * 100}%`;

    // Style (inline so we don’t depend on CSS classes)
    d.style.position = "absolute";
    d.style.width = "16px";
    d.style.height = "16px";
    d.style.marginLeft = "-8px";
    d.style.marginTop = "-8px";
    d.style.borderRadius = "999px";
    d.style.boxShadow = "0 6px 20px rgba(0,0,0,.55)";
    d.style.border = "2px solid rgba(0,0,0,.55)";

    if (kind === "aim") {
      // Aim Point = GREEN
      d.style.background = "rgba(103,243,164,.98)";
      d.style.borderColor = "rgba(0,0,0,.70)";
    } else {
      // Hits = BRIGHT GREEN (slightly different so the switch is obvious)
      d.style.background = "rgba(67,255,160,.98)";
      d.style.borderColor = "rgba(0,0,0,.70)";
    }

    elDots.appendChild(d);
    return d;
  }

  function pulse(el) {
    if (!el || !el.animate) return;
    try {
      el.animate(
        [
          { transform: "translateZ(0) scale(1)", opacity: 1 },
          { transform: "translateZ(0) scale(1.35)", opacity: 0.85 },
          { transform: "translateZ(0) scale(1)", opacity: 1 }
        ],
        { duration: 420, iterations: 1, easing: "ease-out" }
      );
    } catch (_) {}
  }

  function imgReady() {
    return elImg && elImg.src && String(elImg.src).length > 8;
  }

  function getRelative01FromPointer(ev) {
    const r = elImg.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function hideSticky() {
    if (!elStickyBar) return;
    elStickyBar.classList.add("stickyHidden");
    elStickyBar.setAttribute("aria-hidden", "true");
  }

  function showSticky() {
    if (!elStickyBar) return;
    elStickyBar.classList.remove("stickyHidden");
    elStickyBar.setAttribute("aria-hidden", "false");
  }

  function scheduleStickyMagic() {
    // Show results only when: aim is set + at least 1 hit
    if (!aim || hits.length < 1) {
      hideSticky();
      return;
    }

    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      showSticky();
      setText(elStatus, "Ready when you are.");
    }, 850); // “pause & ponder” moment
  }

  // ---- Compute correction (placeholder scale, TRUE MOA)
  function computeCorrection() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce(
      (acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }),
      { x: 0, y: 0 }
    );
    avg.x /= hits.length;
    avg.y /= hits.length;

    // bull/aim - POI
    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    // Demo scale: full image width = 10 inches (replace later with real inches mapping)
    const inchesPerFullWidth = 10;
    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    const dist = Number(elDistance?.value ?? 100);
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    const inchesPerMoa = (dist / 100) * 1.047; // TRUE MOA
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
    try { localStorage.setItem(SEC_KEY, JSON.stringify(payload)); } catch (_) {}

    const b64 = b64FromObj(payload);
    // Use replace to avoid “back stack weirdness”
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  // ---- Photo picker wiring
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => {
      // NOTE: iOS will still show options depending on device/settings.
      // If you want ALWAYS “Photo Library”, remove capture="environment" in HTML.
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

      // Hide the big button once a photo is selected
      if (elPhotoBtn) elPhotoBtn.style.display = "none";

      setText(elStatus, "Tap Aim Point.");
      setText(elInstruction, "Tap Aim Point (green). Then tap hits.");
      elImg.src = objectUrl;

      // Allow re-selecting same file later
      try { elFile.value = ""; } catch (_) {}
    });
  }

  // ---- Tap handling (POINTER ONLY to stop double-fire)
  // We listen on the IMAGE, and stop click/touch duplicates by:
  // - using pointerdown
  // - ignoring very-close repeats
  if (elImg) {
    elImg.style.touchAction = "manipulation"; // reduce browser gesture weirdness

    elImg.addEventListener("pointerdown", (ev) => {
      if (!imgReady()) return;
      if (ev.pointerType === "mouse" && ev.button !== 0) return;

      const now = Date.now();
      if (now - lastPointerTs < 120) return; // tiny guard
      lastPointerTs = now;

      // Hide sticky while actively tapping
      hideSticky();
      clearTimeout(idleTimer);

      const { x01, y01 } = getRelative01FromPointer(ev);

      if (!aim) {
        aim = { x01, y01 };
        const dot = makeDot(x01, y01, "aim");
        pulse(dot);
        haptic(10);

        setText(elStatus, "Aim point locked. Add hits.");
        setText(elInstruction, "Now tap hits (bright green).");
      } else {
        hits.push({ x01, y01 });
        makeDot(x01, y01, "hit");
        setTapCount();
        haptic(6);

        // After each hit, set a calm “ponder” window
        scheduleStickyMagic();
      }
    }, { passive: true });

    // Hard-block click as a second channel (prevents 2-per-tap on iOS)
    elImg.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);
  }

  // ---- Clear
  if (elClear) {
    elClear.addEventListener("click", () => {
      clearDots();
      setText(elStatus, "Tap-n-Score™ ready.");
      setText(elInstruction, "");
      // If a photo is still showing, keep the button hidden
      if (imgReady() && elPhotoBtn) elPhotoBtn.style.display = "none";
      if (imgReady()) setText(elStatus, "Tap Aim Point.");
    });
  }

  // ---- Sticky results (the “magic” CTA)
  if (elStickyResultsBtn) {
    elStickyResultsBtn.addEventListener("click", () => {
      const out = computeCorrection();
      if (!out) {
        setText(elStatus, "Tap Aim Point, then add at least one hit.");
        setText(elInstruction, "Tap Aim Point (green) first, then tap hits.");
        hideSticky();
        return;
      }

      const payload = {
        sessionId: "S-" + Date.now(),
        score: null, // keep it clean; score comes later when real scoring lands
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

  // ---- Boot
  clearDots();
})();
