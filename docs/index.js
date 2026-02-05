/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206d4 (DOT VISIBILITY FIX)
   Fix:
   - Taps were counted but dots not visible (CSS/z-index/size issues)
   - This version FORCE-STYLES dots + overlay layer in JS so it can’t break
   Keeps:
   - One big photo button
   - Distance clicker (+/-)
   - iOS double-tap prevention (touch+click)
   - Aim Point green, Hits bright green
   - Sticky results appears after pause
   - Real score from radius (placeholder inches mapping)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Required IDs
  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Sticky
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Settings / links (optional)
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");     // hidden input (canonical)
  const elDistDisplay = $("distDisplay");  // visible number
  const elDistUp = $("distUp");
  const elDistDown = $("distDown");

  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;

  // Tap state (normalized 0..1)
  let aim = null;     // {x01,y01}
  let hits = [];      // [{x01,y01},...]

  // Anti-double-fire / anti-scroll
  let lastTouchTapAt = 0;
  let touchStart = null;
  let pauseTimer = null;

  // ---- Helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function setText(el, t) { if (el) el.textContent = String(t ?? ""); }

  function getDistance() {
    const n = Number(elDistance?.value ?? 100);
    return Number.isFinite(n) ? n : 100;
  }

  function setDistance(v) {
    let n = Math.round(Number(v));
    if (!Number.isFinite(n)) n = 100;
    n = Math.max(5, Math.min(1000, n));

    if (elDistance) elDistance.value = String(n);
    if (elDistDisplay) elDistDisplay.textContent = String(n);
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
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
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      if (hits.length >= 1) showSticky();
    }, 650);
  }

  function setInstructionForState() {
    if (!elInstruction) return;

    if (!elImg?.src) { setText(elInstruction, ""); return; }
    if (!aim) { setText(elInstruction, "Tap Aim Point."); return; }
    if (hits.length < 1) { setText(elInstruction, "Tap Hits."); return; }

    setText(elInstruction, "Tap more hits, or pause — results will appear.");
  }

  // ---- FORCE overlay layer to be visible and on top (THIS IS THE FIX)
  function forceOverlayLayout() {
    if (!elWrap || !elImg || !elDots) return;

    // Ensure wrapper is a positioning context
    const wrapStyle = getComputedStyle(elWrap);
    if (wrapStyle.position === "static") elWrap.style.position = "relative";

    // Ensure image is below overlay
    elImg.style.position = "relative";
    elImg.style.zIndex = "1";

    // Ensure overlay covers the image and sits on top
    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.right = "0";
    elDots.style.bottom = "0";
    elDots.style.width = "100%";
    elDots.style.height = "100%";
    elDots.style.zIndex = "10";
    elDots.style.pointerEvents = "none";
  }

  function resetAll() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    forceOverlayLayout();
    setInstructionForState();
    setText(elStatus, elImg?.src ? "Tap Aim Point." : "Add a photo to begin.");
  }

  // ---- Add dot with INLINE sizing + styling so CSS can’t break it
  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");

    // absolute position with center alignment
    d.style.position = "absolute";
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    d.style.transform = "translate(-50%, -50%)";
    d.style.width = "18px";
    d.style.height = "18px";
    d.style.borderRadius = "999px";
    d.style.zIndex = "20";
    d.style.boxShadow = "0 10px 28px rgba(0,0,0,.55)";
    d.style.border = "2px solid rgba(0,0,0,.55)";

    if (kind === "aim") {
      d.style.background = "#67f3a4"; // aim point green
    } else {
      d.style.background = "#b7ff3c"; // hits bright green
    }

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

  // ------------------------------------------------------------
  // SCORING — placeholder inches mapping (width=10 inches)
  // ------------------------------------------------------------
  const inchesPerFullWidth = 10;

  function scoreFromRadiusInches(rIn) {
    if (rIn <= 0.25) return 100;
    if (rIn <= 0.50) return 95;
    if (rIn <= 1.00) return 90;
    if (rIn <= 1.50) return 85;
    if (rIn <= 2.00) return 80;
    if (rIn <= 2.50) return 75;
    if (rIn <= 3.00) return 70;
    if (rIn <= 3.50) return 65;
    if (rIn <= 4.00) return 60;
    return 50;
  }

  function computeCorrectionAndScore() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    const dist = getDistance();
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    const inchesPerMoa = (dist / 100) * 1.047;

    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    const score = scoreFromRadiusInches(rIn);

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      inches: { x: inchesX, y: inchesY, r: rIn },
      score,
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
    };
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
    const b64 = b64FromObj(payload);
    window.location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function onShowResults() {
    const out = computeCorrectionAndScore();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one hit.");
      return;
    }

    const vendorUrl =
      (elVendor && elVendor.href && elVendor.href !== "#" && !elVendor.href.endsWith("#"))
        ? elVendor.href
        : "";

    const payload = {
      sessionId: "S-" + Date.now(),
      score: out.score,
      shots: hits.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      secPngUrl: "",
      vendorUrl,
      surveyUrl: "",
      debug: {
        aim,
        avgPoi: out.avgPoi,
        distanceYds: getDistance(),
        inches: out.inches
      }
    };

    goToSEC(payload);
  }

  // ---- Distance clicker (+/-)
  if (elDistUp) elDistUp.addEventListener("click", () => setDistance(getDistance() + 5));
  if (elDistDown) elDistDown.addEventListener("click", () => setDistance(getDistance() - 5));

  // ---- Photo picker
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => elFile.click());
  }

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      resetAll();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => {
        forceOverlayLayout();
        setText(elStatus, "Tap Aim Point.");
        setInstructionForState();
      };
      elImg.onerror = () => {
        setText(elStatus, "Photo failed to load.");
        setText(elInstruction, "Try again.");
      };

      elImg.src = objectUrl;

      // allow selecting same file again
      elFile.value = "";
    });
  }

  // ---- Tap logic (touch-first, click suppressed)
  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;

    forceOverlayLayout(); // keep overlay correct even after layout shifts
    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setText(elStatus, "Tap Hits.");
      setInstructionForState();
      hideSticky();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();
    setInstructionForState();

    hideSticky();
    scheduleStickyMagic();
  }

  if (elWrap) {
    elWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });

    elWrap.addEventListener("touchend", (e) => {
      const now = Date.now();
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);

      // scroll => ignore
      if (dx > 10 || dy > 10) {
        touchStart = null;
        return;
      }

      lastTouchTapAt = now;
      acceptTap(t.clientX, t.clientY);
      touchStart = null;
    }, { passive: true });

    elWrap.addEventListener("click", (e) => {
      const now = Date.now();
      if (now - lastTouchTapAt < 800) return; // kill ghost click
      acceptTap(e.clientX, e.clientY);
    }, { passive: true });
  }

  // ---- Buttons
  if (elClear) {
    elClear.addEventListener("click", () => {
      resetAll();
      if (elImg?.src) setText(elStatus, "Tap Aim Point.");
    });
  }

  if (elStickyBtn) elStickyBtn.addEventListener("click", onShowResults);

  // ---- Boot
  setDistance(100);
  forceOverlayLayout();
  resetAll();
})();
