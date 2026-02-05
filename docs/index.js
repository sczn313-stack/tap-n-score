/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206d4
   Fixes:
   - "Two hits per tap" (single input path: Pointer Events only)
   - "Photo selected but didn’t load" (FileReader -> dataURL for iOS)
   Keeps:
   - Distance clicker (+/-)
   - One big photo button
   - Aim Point green, Hits bright green
   - Sticky results appears after pause
   - Real score (radius inches -> score) using placeholder width scale
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

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";

  // Tap state (normalized 0..1)
  let aim = null;     // {x01,y01}
  let hits = [];      // [{x01,y01},...]

  // Sticky timing
  let pauseTimer = null;

  // Pointer tracking (scroll vs tap discrimination)
  let pointerDown = null; // {x,y,t}
  let suppressUntil = 0;  // hard gate to prevent fast double-fire

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
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

  function resetAll() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    setInstructionForState();
    setText(elStatus, elImg?.src ? "Tap Aim Point." : "Add a target photo to begin.");
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "tapDot";
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";

    // IMPORTANT: dots should never steal taps
    d.style.pointerEvents = "none";

    if (kind === "aim") {
      d.style.background = "#67f3a4"; // aim point green
      d.style.border = "2px solid rgba(0,0,0,.55)";
      d.style.boxShadow = "0 10px 28px rgba(0,0,0,.55)";
    } else {
      d.style.background = "#b7ff3c"; // hits bright green
      d.style.border = "2px solid rgba(0,0,0,.55)";
      d.style.boxShadow = "0 10px 28px rgba(0,0,0,.55)";
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
  // SCORING (REAL-ish) — inches-based using current placeholder scale
  // Placeholder scale: full image width = 10 inches
  // Later: replace with real inches mapping per target profile.
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

    // Average POI
    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    // Correction vector aim - poi
    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    // Inches (placeholder)
    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;
    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    const dist = getDistance();
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    // True MOA inches at distance
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
    try { localStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload)); } catch {}
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

  // ------------------------------------------------------------
  // Distance clicker (+/-)
  // ------------------------------------------------------------
  if (elDistUp) elDistUp.addEventListener("click", () => setDistance(getDistance() + 5));
  if (elDistDown) elDistDown.addEventListener("click", () => setDistance(getDistance() - 5));

  // ------------------------------------------------------------
  // Photo button -> file input
  // NOTE: removing capture attribute is what enables library picker
  // (Keep capture in HTML if you want camera-first; here we do NOT force it)
  // ------------------------------------------------------------
  if (elPhotoBtn && elFile) elPhotoBtn.addEventListener("click", () => elFile.click());

  function loadFileToImg(file) {
    resetAll();

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image/")) {
        setText(elStatus, "Photo failed to load.");
        setText(elInstruction, "Try again.");
        return;
      }

      elImg.onload = () => {
        setText(elStatus, "Tap Aim Point.");
        setInstructionForState();
      };

      elImg.onerror = () => {
        setText(elStatus, "Photo failed to load.");
        setText(elInstruction, "Try again.");
      };

      elImg.src = dataUrl;
    };

    reader.onerror = () => {
      setText(elStatus, "Photo failed to load.");
      setText(elInstruction, "Try again.");
    };

    reader.readAsDataURL(file);
  }

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      loadFileToImg(f);

      // allow selecting same file again
      elFile.value = "";
    });
  }

  // ------------------------------------------------------------
  // Tap logic — ONE PATH ONLY (Pointer Events)
  // Prevents double-hit on iOS.
  // Scroll detection: movement > 10px => treat as scroll, ignore.
  // ------------------------------------------------------------
  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;

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
    // ensure overlay never blocks pointer
    if (elDots) elDots.style.pointerEvents = "none";

    elWrap.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary) return;
      if (!elImg?.src) return;

      pointerDown = { x: e.clientX, y: e.clientY, t: Date.now() };
    });

    elWrap.addEventListener("pointerup", (e) => {
      if (!e.isPrimary) return;
      if (!pointerDown) return;

      const now = Date.now();
      if (now < suppressUntil) {
        pointerDown = null;
        return;
      }

      const dx = Math.abs(e.clientX - pointerDown.x);
      const dy = Math.abs(e.clientY - pointerDown.y);

      // If the user dragged (scroll gesture), ignore
      if (dx > 10 || dy > 10) {
        pointerDown = null;
        return;
      }

      // Hard gate to prevent accidental double-fire
      suppressUntil = now + 350;

      acceptTap(e.clientX, e.clientY);
      pointerDown = null;
    });

    elWrap.addEventListener("pointercancel", () => { pointerDown = null; });
    elWrap.addEventListener("pointerleave", () => { pointerDown = null; });
  }

  // ------------------------------------------------------------
  // Buttons
  // ------------------------------------------------------------
  if (elClear) {
    elClear.addEventListener("click", () => {
      resetAll();
      if (elImg?.src) setText(elStatus, "Tap Aim Point.");
    });
  }

  if (elStickyBtn) elStickyBtn.addEventListener("click", onShowResults);

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  setDistance(100);
  resetAll();
})();
