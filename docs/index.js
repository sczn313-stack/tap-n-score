/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206e2 (POLISH)
   Fixes / Polish:
   - Big button triggers photo picker (camera OR library)
   - Photo load reliability
   - iOS double-tap bug (touch + click) eliminated
   - Copy: "Tap Aim Point" then "Tap Hits"
   - Aim Point dot = green, Hits = bright green
   - Sticky Show Results appears after user pauses (magic)
   - SEC handoff via URL base64 + localStorage backup
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

  // Optional (back-compat if present)
  const elSee = $("seeResultsBtn");

  // Settings / links (optional)
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;

  // Tap state (normalized 0..1)
  let aim = null;     // {x01,y01}
  let hits = [];      // [{x01,y01},...]

  // Anti-double-fire / anti-scroll
  let lastTouchTapAt = 0;     // time we accepted a touch tap
  let touchStart = null;      // {x,y,t}
  let pauseTimer = null;

  // ---- Helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setText(el, t) { if (el) el.textContent = String(t ?? ""); }

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
      // Only show after user has at least 1 hit
      if (hits.length >= 1) showSticky();
    }, 650);
  }

  function setInstructionForState() {
    if (!elInstruction) return;

    if (!elImg?.src) {
      setText(elInstruction, "");
      return;
    }

    if (!aim) {
      setText(elInstruction, "Tap Aim Point.");
      return;
    }

    if (hits.length < 1) {
      setText(elInstruction, "Tap Hits.");
      return;
    }

    setText(elInstruction, "Tap more hits, or pause — results will appear.");
  }

  function resetAll() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    setInstructionForState();
    setText(elStatus, elImg?.src ? "Tap Aim Point." : "Add a photo to begin.");
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "tapDot";

    // position in %
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";

    // Make colors unmissable (JS forces it regardless of CSS)
    // Aim = green, Hits = bright green
    if (kind === "aim") {
      d.style.background = "#67f3a4";
      d.style.border = "2px solid rgba(0,0,0,.55)";
      d.style.boxShadow = "0 10px 28px rgba(0,0,0,.55)";
    } else {
      d.style.background = "#b7ff3c"; // bright green
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

  // Placeholder math (kept stable): bull/aim - avg(hit)
  function computeCorrection() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    // Demo scale
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
    window.location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function onShowResults() {
    const out = computeCorrection();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one hit.");
      return;
    }

    // Vendor link (only if real)
    const vendorUrl =
      (elVendor && elVendor.href && elVendor.href !== "#" && !elVendor.href.endsWith("#"))
        ? elVendor.href
        : "";

    const payload = {
      sessionId: "S-" + Date.now(),
      score: 25, // placeholder — real score next fertilizer
      shots: hits.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      secPngUrl: "",
      vendorUrl,
      surveyUrl: "",
      debug: { aim, avgPoi: out.avgPoi }
    };

    goToSEC(payload);
  }

  // ---- Photo picker
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => {
      // force-open picker
      elFile.click();
    });
  }

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // Reset state for new photo
      resetAll();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      // iOS: assign after onload handlers
      elImg.onload = () => {
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
  function acceptTap(clientX, clientY, source) {
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

    // Magic: show sticky after pause
    hideSticky();
    scheduleStickyMagic();
  }

  // Touch: track movement so scroll doesn’t become a hit
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

      // If user moved finger, treat as scroll (ignore tap)
      if (dx > 10 || dy > 10) {
        touchStart = null;
        return;
      }

      lastTouchTapAt = now;
      acceptTap(t.clientX, t.clientY, "touch");
      touchStart = null;
    }, { passive: true });
  }

  // Click: ignore if it follows a touch (prevents 2 hits per tap on iOS)
  if (elWrap) {
    elWrap.addEventListener("click", (e) => {
      const now = Date.now();
      if (now - lastTouchTapAt < 800) return; // suppress ghost click
      acceptTap(e.clientX, e.clientY, "click");
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
  if (elSee) elSee.addEventListener("click", onShowResults);

  // ---- Boot
  resetAll();
})();
