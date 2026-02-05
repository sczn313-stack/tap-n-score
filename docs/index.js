/* ============================================================
   index.js (FULL REPLACEMENT) — POLISH PASS
   Adds:
   - Aim Point dot = GREEN
   - Hit dots = BRIGHT GREEN (clear visual switch)
   - Sticky "Show results" appears after user pauses tapping
   - Scroll-safe: swipe/scroll does NOT record a hit (tap vs move threshold)
   - Uses URL payload to sec.html (baseline behavior preserved)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs
  const elFile = $("photoInput");
  const elPhotoBtn = $("photoBtn");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Sticky results bar
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Settings
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let bull = null;     // {x01,y01}
  let shots = [];      // [{x01,y01},...]

  // "Magic" sticky timing
  let stickyTimer = null;

  // Tap vs scroll detection
  let downInfo = null; // {x,y,time}

  // ---------- helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, txt) { if (el) el.textContent = txt; }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
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

  function clearStickyTimer() {
    if (stickyTimer) {
      clearTimeout(stickyTimer);
      stickyTimer = null;
    }
  }

  function scheduleStickyReveal() {
    clearStickyTimer();
    // Only show after at least 1 hit + user paused
    if (shots.length < 1) return;

    stickyTimer = setTimeout(() => {
      showSticky(true);
      // Keep copy minimal
      setText(elInstruction, "");
      setText(elStatus, "Ready when you are.");
    }, 900); // <-- "magic pause" time
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    clearStickyTimer();
    showSticky(false);

    if (elImg && elImg.src) {
      setText(elStatus, "Tap Aim Point, then tap hits.");
      setText(elInstruction, "Aim Point first. Then hits.");
    } else {
      setText(elStatus, "Add a target photo to begin.");
      setText(elInstruction, "");
    }
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "tapDot";

    // Position
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";

    // COLOR RULES (inline so it ALWAYS wins)
    // Aim Point = GREEN
    // Hits = BRIGHT GREEN (different shade so you feel the switch)
    if (kind === "bull") {
      d.style.background = "#67f3a4";           // green
      d.style.borderColor = "rgba(0,0,0,.55)";
      d.style.boxShadow = "0 8px 26px rgba(0,0,0,.55)";
    } else {
      d.style.background = "#00ff66";           // bright green
      d.style.borderColor = "rgba(0,0,0,.55)";
      d.style.boxShadow = "0 8px 26px rgba(0,0,0,.55)";
    }

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

  function readDistanceYds() {
    const n = Number(elDistance?.value);
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.max(1, Math.min(2000, Math.round(n)));
  }

  function readMoaPerClick() {
    const n = Number(elMoaClick?.value);
    return Number.isFinite(n) && n > 0 ? n : 0.25;
  }

  // Demo correction (placeholder math, but directions are consistent)
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

    const dist = readDistanceYds();
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

  function runResults() {
    const out = computeCorrection();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one hit.");
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
      debug: { bull, avgPoi: out.avgPoi, distanceYds: readDistanceYds(), moaPerClick: readMoaPerClick() }
    };

    goToSEC(payload);
  }

  // ---------- events

  // Big photo button opens picker
  if (elPhotoBtn && elFile) elPhotoBtn.addEventListener("click", () => elFile.click());

  // Load photo
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => {
        setText(elStatus, "Tap Aim Point, then tap hits.");
        setText(elInstruction, "Aim Point first. Then hits.");
      };
      elImg.onerror = () => {
        setText(elStatus, "Photo failed to load.");
        setText(elInstruction, "Try again.");
      };

      elImg.src = objectUrl;

      // allow choosing same photo again
      elFile.value = "";
    });
  }

  // Tap vs scroll: record only if "tap-like"
  // - pointerdown records start point/time
  // - pointerup checks movement threshold
  // - only then we record a tap
  if (elImg) {
    // Helps iOS understand this area can scroll; we will only record true taps
    elImg.style.touchAction = "pan-y";

    elImg.addEventListener("pointerdown", (ev) => {
      if (!elImg.src) return;
      downInfo = { x: ev.clientX, y: ev.clientY, t: Date.now() };

      // while user is tapping/moving, hide sticky
      showSticky(false);
      clearStickyTimer();
    }, { passive: true });

    elImg.addEventListener("pointerup", (ev) => {
      if (!elImg.src) return;
      if (!downInfo) return;

      const dx = Math.abs(ev.clientX - downInfo.x);
      const dy = Math.abs(ev.clientY - downInfo.y);
      const dt = Date.now() - downInfo.t;
      downInfo = null;

      // Thresholds: if finger moved, assume scroll/pan, NOT a hit
      // dt guard keeps long scroll holds from triggering taps
      const movedTooMuch = (dx > 10 || dy > 10);
      const heldTooLong = (dt > 900);

      if (movedTooMuch || heldTooLong) return;

      // This is a real tap
      const { x01, y01 } = getRelative01FromClientXY(ev.clientX, ev.clientY);

      if (!bull) {
        bull = { x01, y01 };
        addDot(x01, y01, "bull");
        setText(elStatus, "Now tap hits.");
        setText(elInstruction, "Now tap hits.");
      } else {
        shots.push({ x01, y01 });
        addDot(x01, y01, "shot");
        setTapCount();

        // Magic reveal after pause
        setText(elStatus, "Tap more hits… or pause.");
        scheduleStickyReveal();
      }
    }, { passive: true });

    elImg.addEventListener("pointercancel", () => {
      downInfo = null;
    }, { passive: true });
  }

  if (elClear) elClear.addEventListener("click", clearDots);

  if (elStickyBtn) elStickyBtn.addEventListener("click", runResults);

  // ---------- boot
  clearDots();
})();
