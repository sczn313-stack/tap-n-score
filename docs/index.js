/* ============================================================
   index.js (FULL REPLACEMENT) — Tap Behavior Polish
   Goals:
   - One “Add Target Picture” button that opens Camera OR Library (iOS friendly)
   - No double-counting taps (fixes the 2-hits-per-tap issue)
   - Aim point wording: "Tap Aim Point" (AIM = GREEN)
   - Hits are BRIGHT GREEN (easy “mode switch”)
   - Sticky "Show results" appears like magic after user pauses (idle reveal)
   - Works with your existing index.html IDs:
       photoBtn, photoInput, targetImg, targetWrap, dotsLayer,
       tapCount, clearTapsBtn, instructionLine,
       stickyBar, stickyResultsBtn,
       distanceYds, moaPerClick, vendorLink
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM (required)
  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Sticky results
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Settings
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");
  const elVendor = $("vendorLink");

  // ---- Storage + routing
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  // ---- State
  let objectUrl = null;
  let hasPhoto = false;

  // normalized 0..1 (image box)
  let aim = null;            // {x01,y01}
  let hits = [];             // [{x01,y01}, ...]

  // tap handling guard
  let lastTapAt = 0;
  let idleTimer = null;

  // ---- Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function setText(el, txt) {
    if (el) el.textContent = String(txt ?? "");
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
  }

  function showSticky(yes) {
    if (!elStickyBar) return;
    if (yes) {
      elStickyBar.classList.remove("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "false");
    } else {
      elStickyBar.classList.add("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "true");
    }
  }

  function setInstruction(msg) {
    setText(elInstruction, msg);
  }

  function setStatus(msg) {
    setText(elStatus, msg);
  }

  function clearDots() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    showSticky(false);
    if (hasPhoto) {
      setInstruction("Tap Aim Point (green), then tap hits (green).");
      setStatus("Tap Aim Point first.");
    } else {
      setInstruction("");
      setStatus("Add a picture to begin.");
    }
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    // Use existing classes but we’ll override colors in JS inline for clarity
    d.className = "tapDot " + (kind === "aim" ? "tapDotBull" : "tapDotShot");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";

    // Force colors regardless of CSS:
    // Aim = GREEN, Hits = BRIGHT GREEN
    if (kind === "aim") {
      d.style.background = "rgba(103,243,164,.98)";
      d.style.borderColor = "rgba(0,0,0,.55)";
    } else {
      d.style.background = "rgba(110,255,90,.98)";   // bright green hits
      d.style.borderColor = "rgba(0,0,0,.55)";
    }

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

  // Placeholder correction math (kept from baseline so directions stay correct)
  function computeCorrection() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    // aim - POI (move POI to aim)
    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    // Demo scale (placeholder): treat full image width as 10 inches
    const inchesPerFullWidth = 10;
    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    const dist = Number(elDistance?.value ?? 100);
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    const inchesPerMoa = (dist / 100) * 1.047; // true MOA
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
    try { localStorage.setItem(SEC_KEY, JSON.stringify(payload)); } catch {}

    const b64 = b64FromObj(payload);
    // Keep sec.html baseline routing
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function buildAndShowResults() {
    const out = computeCorrection();
    if (!out) {
      if (!aim) {
        setStatus("Tap Aim Point first.");
        setInstruction("Tap Aim Point (green), then tap hits (green).");
      } else {
        setStatus("Tap at least 1 hit.");
        setInstruction("Now tap your hits (green).");
      }
      showSticky(false);
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
  }

  function scheduleIdleReveal() {
    clearTimeout(idleTimer);

    // Only reveal when:
    // - photo exists
    // - aim is set
    // - at least 1 hit
    if (!hasPhoto || !aim || hits.length < 1) {
      showSticky(false);
      return;
    }

    // “magic pause” reveal after ~650ms of no tapping
    idleTimer = setTimeout(() => {
      showSticky(true);
      setStatus("Ready when you are.");
      setInstruction(""); // keep it clean
    }, 650);
  }

  // ---- Photo selection behavior
  function openPicker() {
    if (!elFile) return;

    // iOS sometimes “sticks” to last selection unless you reset value
    elFile.value = "";
    elFile.click();
  }

  function loadFile(file) {
    if (!file) return;

    // Reset tap state
    clearDots();

    // Render image
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    elImg.src = objectUrl;

    hasPhoto = true;
    setStatus("Tap Aim Point first.");
    setInstruction("Tap Aim Point (green), then tap hits (green).");
  }

  // ---- Tap handler (single-source; prevents double-fire)
  function handleTap(ev) {
    if (!hasPhoto || !elImg || !elImg.src) return;

    // Debounce double-fire (touch+click)
    const now = Date.now();
    if (now - lastTapAt < 250) return;
    lastTapAt = now;

    const { x01, y01 } = getRelative01FromEvent(ev);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setStatus("Now tap hits.");
      setInstruction("Tap hits (green).");
      showSticky(false);
      scheduleIdleReveal();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();
    setStatus(`Hits: ${hits.length}`);
    showSticky(false);
    scheduleIdleReveal();
  }

  // ---- Wire events
  if (elPhotoBtn) {
    elPhotoBtn.addEventListener("click", openPicker);
  }

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      loadFile(f);
      // allow re-select same file
      elFile.value = "";
    });
  }

  // IMPORTANT: Use ONE event path.
  // iOS: touchend is reliable; desktop: click works.
  // We’ll attach both but stop duplicates via debounce.
  if (elWrap) {
    elWrap.addEventListener("touchend", (e) => {
      // translate to a mouse-like event using changedTouches
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      handleTap({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });

    elWrap.addEventListener("click", (e) => handleTap(e), { passive: true });
  } else if (elImg) {
    elImg.addEventListener("touchend", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      handleTap({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });

    elImg.addEventListener("click", (e) => handleTap(e), { passive: true });
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      clearDots();
      if (hasPhoto) {
        setStatus("Tap Aim Point first.");
        setInstruction("Tap Aim Point (green), then tap hits (green).");
      }
    });
  }

  if (elStickyBtn) {
    elStickyBtn.addEventListener("click", () => {
      buildAndShowResults();
    });
  }

  // ---- Boot
  hasPhoto = false;
  showSticky(false);
  setTapCount();
  setInstruction("");
  setStatus("Add a picture to begin.");
})();
