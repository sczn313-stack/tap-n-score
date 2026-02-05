/* ============================================================
   index.js (FULL REPLACEMENT) — TRUE INCHES MAPPING (A)
   BASELINE 22206+

   What this does:
   - Converts tap positions to TRUE INCH coordinates using a known target size.
   - Stores bull + shots in inches (not normalized %).
   - Computes correction in inches -> MOA -> clicks using TRUE MOA (1.047"/100y).
   - Fixes “two hits per tap” by using a single pointer pipeline + tap debounce.
   - Adds scroll-friendly tap detection (small-move = tap, else ignore).

   Target size:
   - Default: 23 inches (square)
   - Override via URL: ?size=23   (or 8.5, 11, 12, etc.)
     Example:
       /tap-n-score/index.html?fresh=1&size=23
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Required IDs
  const elPhotoBtn = $("photoBtn");      // big button
  const elFile = $("photoInput");        // hidden input
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSticky = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");
  const elStatus = $("statusLine");
  const elInstruction = $("instructionLine");

  // ---- Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  // ---- Storage
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- Target Size (INCHES)
  // default 23, override with ?size=23
  const params = new URLSearchParams(location.search);
  const TARGET_SIZE_IN = (() => {
    const n = Number(params.get("size"));
    return Number.isFinite(n) && n > 0 ? n : 23;
  })();

  // ---- State (INCHES, screen-space: x right +, y down +)
  let objectUrl = null;
  let bull = null;          // {x,y} inches
  let shots = [];           // [{x,y},...]
  let lastTapAt = 0;

  // ---- Tap handling guards (prevents “double hit per tap”)
  let ignoreClickUntil = 0;

  // ---- Tap/scroll discrimination
  // If finger moves more than this many pixels, treat it as scroll/drag, not a tap.
  const MOVE_THRESHOLD_PX = 10;

  function setText(el, t) { if (el) el.textContent = String(t); }

  function setTapCount() {
    setText(elTapCount, shots.length);
  }

  function showSticky(yes) {
    if (!elSticky) return;
    if (yes) {
      elSticky.classList.remove("stickyHidden");
      elSticky.setAttribute("aria-hidden", "false");
    } else {
      elSticky.classList.add("stickyHidden");
      elSticky.setAttribute("aria-hidden", "true");
    }
  }

  function setInstruction(msg) {
    if (!elInstruction) return;
    elInstruction.textContent = msg || "";
  }

  function setStatus(msg) {
    if (!elStatus) return;
    elStatus.textContent = msg || "";
  }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    showSticky(false);
    setInstruction("Tap Aim Point, then tap hits.");
    setStatus("Add a target photo to begin.");
  }

  function addDotInches(p, kind) {
    if (!elDots || !elImg) return;

    // We position dots in % to stay correct while scaling,
    // but the stored values are inches.
    const r = elImg.getBoundingClientRect();
    if (!r || r.width < 2 || r.height < 2) return;

    const x01 = p.x / TARGET_SIZE_IN;
    const y01 = p.y / TARGET_SIZE_IN;

    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    elDots.appendChild(d);
  }

  function imgRect() {
    if (!elImg) return null;
    const r = elImg.getBoundingClientRect();
    if (!r || r.width < 2 || r.height < 2) return null;
    return r;
  }

  function pxToInches(xPx, yPx, rect) {
    const xIn = (xPx / rect.width) * TARGET_SIZE_IN;
    const yIn = (yPx / rect.height) * TARGET_SIZE_IN;
    return { x: xIn, y: yIn };
  }

  function computeCorrection_Inches() {
    if (!bull || shots.length < 1) return null;

    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    // bull - POI (move POI to bull)
    const dxIn = bull.x - avg.x; // + => RIGHT
    const dyIn = bull.y - avg.y; // + => DOWN (screen-space)

    const dist = Number(elDistance?.value ?? 100);
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    const inchesPerMoa = (dist / 100) * 1.047; // TRUE MOA
    const moaX = dxIn / inchesPerMoa;
    const moaY = dyIn / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    return {
      avgPoi: { x: avg.x, y: avg.y },
      dxIn,
      dyIn,
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) }
    };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function pushHistory(payload) {
    try {
      const prev = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      const entry = {
        t: Date.now(),
        score: payload.score,
        shots: payload.shots,
        wind: `${payload.windage.dir} ${Number(payload.windage.clicks).toFixed(2)}`,
        elev: `${payload.elevation.dir} ${Number(payload.elevation.clicks).toFixed(2)}`
      };
      localStorage.setItem(HIST_KEY, JSON.stringify([entry, ...prev].slice(0, 3)));
    } catch (_) {}
  }

  function goToSEC(payload) {
    try { localStorage.setItem(SEC_KEY, JSON.stringify(payload)); } catch {}

    const b64 = b64FromObj(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function showResults() {
    const out = computeCorrection_Inches();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one hit.");
      return;
    }

    const payload = {
      sessionId: "S-" + Date.now(),
      score: null, // leave real scoring for the next module (you’re building it)
      shots: shots.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      secPngUrl: "",
      vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
      surveyUrl: "",
      debug: {
        targetSizeIn: TARGET_SIZE_IN,
        bull,
        avgPoi: out.avgPoi,
        dxIn: out.dxIn,
        dyIn: out.dyIn
      }
    };

    pushHistory(payload);
    goToSEC(payload);
  }

  // ============================================================
  // Photo button -> open picker/camera with user choice
  // ============================================================
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => {
      // This yields the iOS chooser (Camera / Photo Library / Browse) depending on user settings.
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
      elImg.src = objectUrl;

      setStatus("Tap Aim Point, then tap hits.");
      setInstruction("Tap Aim Point, then tap hits.");
      // allow selecting same file again
      elFile.value = "";
    });
  }

  // ============================================================
  // SINGLE tap pipeline (prevents “two hits per tap”)
  // Uses pointer events when available, falls back to click.
  // ============================================================

  function handleTap(clientX, clientY) {
    const r = imgRect();
    if (!r) return;

    const xPx = clientX - r.left;
    const yPx = clientY - r.top;

    if (xPx < 0 || yPx < 0 || xPx > r.width || yPx > r.height) return;

    const pIn = pxToInches(xPx, yPx, r);

    if (!bull) {
      bull = pIn;
      addDotInches(pIn, "bull");
      setInstruction("Aim Point set ✅ Now tap hits.");
      setStatus("Aim Point set. Tap hits.");
      lastTapAt = Date.now();
      return;
    }

    shots.push(pIn);
    addDotInches(pIn, "shot");
    setTapCount();

    setInstruction("Tap more hits, or pause…");
    setStatus("Tap hits. Pause for results…");

    lastTapAt = Date.now();
  }

  // Touch/scroll discrimination with pointer events
  let downX = 0, downY = 0, downAt = 0, downActive = false;

  function onPointerDown(e) {
    if (!elImg?.src) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    downActive = true;
    downX = e.clientX;
    downY = e.clientY;
    downAt = Date.now();

    // Prevent follow-up click double-fire
    if (e.pointerType === "touch") {
      ignoreClickUntil = Date.now() + 500;
    }
  }

  function onPointerUp(e) {
    if (!downActive) return;
    downActive = false;

    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const moved = Math.hypot(dx, dy);

    // If user dragged (scroll), ignore
    if (moved > MOVE_THRESHOLD_PX) return;

    // Debounce ultra-fast duplicates
    const now = Date.now();
    if (now - lastTapAt < 30) return;

    handleTap(e.clientX, e.clientY);
  }

  if (elImg) {
    if ("PointerEvent" in window) {
      elImg.addEventListener("pointerdown", onPointerDown, { passive: true });
      elImg.addEventListener("pointerup", onPointerUp, { passive: true });
    } else {
      // Fallback: click only (older browsers)
      elImg.addEventListener("click", (ev) => {
        if (Date.now() < ignoreClickUntil) return;
        if (!elImg.src) return;
        handleTap(ev.clientX, ev.clientY);
      }, { passive: true });
    }
  }

  // ============================================================
  // Buttons
  // ============================================================
  if (elClear) elClear.addEventListener("click", clearDots);

  // Sticky results button
  if (elStickyBtn) elStickyBtn.addEventListener("click", showResults);

  // “Magic” appearance: when shooter pauses after at least 1 hit
  setInterval(() => {
    if (!bull || shots.length < 1) { showSticky(false); return; }
    const idleMs = Date.now() - lastTapAt;
    showSticky(idleMs >= 900);
  }, 200);

  // ---- Boot
  clearDots();
})();
