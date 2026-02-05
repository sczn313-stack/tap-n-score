/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206d1
   Matches your CURRENT index.html IDs:
   - photoBtn (big button) triggers photoInput
   - stickyResultsBtn triggers results
   - stickyBar appears after user pauses (magic)
   Fixes:
   - iOS/Safari image not loading reliably (onload/onerror)
   - double-tap / double-hit (ghost click suppression)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- IDs in your index.html
  const elPhotoBtn = $("photoBtn");
  const elFile     = $("photoInput");
  const elImg      = $("targetImg");
  const elDots     = $("dotsLayer");
  const elWrap     = $("targetWrap");

  const elTapCount = $("tapCount");
  const elClear    = $("clearTapsBtn");

  const elStickyBar     = $("stickyBar");
  const elStickyResults = $("stickyResultsBtn");

  const elInstruction = $("instructionLine");
  const elStatus      = $("statusLine");

  // Optional
  const elVendor   = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  // --- State
  let objectUrl = null;
  let aim = null;     // {x01,y01}
  let hits = [];      // [{x01,y01},...]
  let lastTapAt = 0;

  // “Magic” sticky timing
  let idleTimer = null;
  const IDLE_SHOW_MS = 650;

  // Ghost click guard (pointerdown + click both firing on iOS sometimes)
  const GHOST_WINDOW_MS = 700;

  function setText(el, txt) { if (el) el.textContent = txt; }
  function now() { return Date.now(); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function showSticky(show) {
    if (!elStickyBar) return;
    if (show) {
      elStickyBar.classList.remove("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "false");
    } else {
      elStickyBar.classList.add("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "true");
    }
  }

  function scheduleStickyReveal() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // Only reveal once we have aim + at least 1 hit
      if (aim && hits.length > 0) showSticky(true);
    }, IDLE_SHOW_MS);
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
  }

  function setInstructionMode() {
    // keep this minimal (you asked to stop repeating)
    if (!aim) {
      setText(elInstruction, "Tap Aim Point.");
      setText(elStatus, "Tap Aim Point.");
      showSticky(false);
    } else {
      setText(elInstruction, "Tap Hits.");
      setText(elStatus, "Tap Hits.");
      // don’t show sticky instantly; wait for “ponder moment”
      showSticky(false);
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

  // Placeholder correction math (keeps the pipeline alive)
  function computeCorrection() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    // aim - POI (move POI to aim)
    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen)

    // demo scale
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

  function runResults() {
    const out = computeCorrection();
    if (!out) {
      alert("Tap Aim Point, then tap at least one hit.");
      return;
    }

    const payload = {
      sessionId: "S-" + Date.now(),
      score: 99,
      shots: hits.length,
      windage:   { dir: out.windage.dir,   clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      secPngUrl: "",
      vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
      surveyUrl: "",
      debug: { aim, avgPoi: out.avgPoi }
    };

    goToSEC(payload);
  }

  // --- IMAGE LOAD RELIABILITY (iOS/Safari)
  function loadSelectedFile(file) {
    if (!file) return;

    clearDots();

    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      objectUrl = null;
    }

    setText(elStatus, "Loading photo…");

    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      setText(elStatus, "Photo loaded. Tap Aim Point.");
      // allow selecting the same photo again later
      try { elFile.value = ""; } catch {}
    };

    elImg.onerror = () => {
      setText(elStatus, "Photo failed to load. Try again.");
    };

    elImg.src = objectUrl;
  }

  // --- EVENTS

  // Big button -> open chooser
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => {
      elFile.click();
    });
  }

  // File chosen
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;
      loadSelectedFile(f);
    });
  }

  // Tapping surface
  const tapSurface = elWrap || elImg;
  if (tapSurface) {
    tapSurface.style.touchAction = "manipulation";

    tapSurface.addEventListener("pointerdown", (ev) => {
      if (!elImg?.src) return;

      const t = now();
      if (t - lastTapAt < GHOST_WINDOW_MS) return;
      lastTapAt = t;

      ev.preventDefault();

      const { x01, y01 } = getRelative01FromEvent(ev);

      if (!aim) {
        aim = { x01, y01 };
        addDot(x01, y01, "aim");
        setInstructionMode();
        scheduleStickyReveal();
        return;
      }

      hits.push({ x01, y01 });
      addDot(x01, y01, "hit");
      setTapCount();
      setInstructionMode();
      scheduleStickyReveal();
    }, { passive: false });

    // swallow ghost clicks
    tapSurface.addEventListener("click", (ev) => {
      const t = now();
      if (t - lastTapAt < GHOST_WINDOW_MS) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      clearDots();
      setText(elStatus, "Cleared. Add a photo or tap Aim Point.");
      showSticky(false);
    });
  }

  // Sticky results button
  if (elStickyResults) {
    elStickyResults.addEventListener("click", () => {
      runResults();
    });
  }

  // --- BOOT
  clearDots();
  setText(elStatus, "Add a target photo to begin.");
  showSticky(false);
})();
