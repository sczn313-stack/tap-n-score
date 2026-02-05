/* ============================================================
   index.js (FULL REPLACEMENT) — REAL SCORE (Baseline 22206+)
   Flow:
   - Add photo
   - Tap Aim Point (first) then tap hits
   - Show results -> computes correction + REAL score -> payload -> sec.html
   - Saves short history for SEC "PREV 1–3"
   Fix:
   - Prevents double-tap registering (pointer-based + debounce)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs in index.html
  const elFile = $("photoInput");
  const elPhotoBtn = $("photoBtn");          // big button (optional)
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");          // optional if you use sticky only
  const elStickyBar = $("stickyBar");        // optional
  const elStickyBtn = $("stickyResultsBtn"); // optional
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // --- SCORING TUNERS (you can tune later)
  // Score starts at 100 and loses points based on:
  // 1) Center error (MOA)  -> weight_center
  // 2) Group spread (MOA)  -> weight_spread
  const weight_center = 7.5;  // points per MOA of center error
  const weight_spread = 4.0;  // points per MOA of spread (RMS)
  const minShotsForScore = 3; // score is more meaningful at 3+

  // --- Placeholder scale: image full-width represents 10 inches
  // (Later: replace with a real calibration mapping.)
  const inchesPerFullWidth = 10;

  let objectUrl = null;

  // Aim point + shots in normalized [0..1] coordinates
  let aim = null;   // {x01,y01}
  let shots = [];   // [{x01,y01},...]

  // Tap debounce (prevents double registers)
  let lastTapMs = 0;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function setStatus(msg) {
    if (elStatus) elStatus.textContent = msg;
  }

  function setHint(msg) {
    if (elInstruction) elInstruction.textContent = msg || "";
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function clearDots() {
    aim = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    setHint("");
    hideResultsIfAny();
    setStatus("Add a target photo to begin.");
  }

  function showResultsIfAny() {
    // If you have sticky bar UI
    if (elStickyBar) {
      elStickyBar.classList.remove("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "false");
    }
  }

  function hideResultsIfAny() {
    if (elStickyBar) {
      elStickyBar.classList.add("stickyHidden");
      elStickyBar.setAttribute("aria-hidden", "true");
    }
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    // Use your existing CSS classes:
    // tapDotBull (aim point) and tapDotShot (hits)
    d.className = "tapDot " + (kind === "aim" ? "tapDotBull" : "tapDotShot");
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

  function inchesPerMoaAt(distYds) {
    return (distYds / 100) * 1.047; // TRUE MOA
  }

  function formatWindElev(windDir, windClicks, elevDir, elevClicks) {
    const w = `${windDir} ${Number(windClicks).toFixed(2)}`;
    const e = `${elevDir} ${Number(elevClicks).toFixed(2)}`;
    return { wind: w, elev: e };
  }

  function computeReal(out) {
    // out contains avgPoi, windage, elevation, inchesX, inchesY, moaX, moaY, etc.
    // Score uses:
    // - center error = distance between avgPoi and aim (MOA)
    // - spread = RMS distance of shots from avgPoi (MOA)
    const dist = out.dist;

    // center error in normalized space
    const dx01 = aim.x01 - out.avgPoi.x01;
    const dy01 = aim.y01 - out.avgPoi.y01;

    // convert to inches (placeholder scale)
    const cx_in = Math.sqrt((dx01 * inchesPerFullWidth) ** 2 + (dy01 * inchesPerFullWidth) ** 2);

    const ipm = inchesPerMoaAt(dist);
    const center_moa = cx_in / ipm;

    // spread RMS around avgPoi
    let sumSqIn = 0;
    for (const s of shots) {
      const sx01 = s.x01 - out.avgPoi.x01;
      const sy01 = s.y01 - out.avgPoi.y01;
      const rin = Math.sqrt((sx01 * inchesPerFullWidth) ** 2 + (sy01 * inchesPerFullWidth) ** 2);
      sumSqIn += rin * rin;
    }
    const rms_in = Math.sqrt(sumSqIn / Math.max(1, shots.length));
    const spread_moa = rms_in / ipm;

    // Score model
    // - Penalize center and spread
    // - Slightly reduce reliability if fewer than minShotsForScore
    let penalty = (center_moa * weight_center) + (spread_moa * weight_spread);

    if (shots.length < minShotsForScore) {
      penalty *= 0.85; // still score, but gentler penalty on tiny sample
    }

    const score = clamp(Math.round(100 - penalty), 0, 100);

    return {
      score,
      center_moa: Number(center_moa.toFixed(2)),
      spread_moa: Number(spread_moa.toFixed(2)),
    };
  }

  function computeCorrectionAndScore() {
    if (!aim || shots.length < 1) return null;

    // avg POI (normalized)
    const avg = shots.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= shots.length;
    avg.y /= shots.length;

    // aim - POI (move POI to aim)
    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    // placeholder inches mapping
    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    const dist = Number(elDistance?.value ?? 100);
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);

    const ipm = inchesPerMoaAt(dist);
    const moaX = inchesX / ipm;
    const moaY = inchesY / ipm;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    const windage = { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) };
    const elevation = { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) };

    const base = {
      dist,
      moaPerClick,
      avgPoi: { x01: avg.x, y01: avg.y },
      windage,
      elevation
    };

    const scoreBits = computeReal(base);

    return {
      ...base,
      ...scoreBits
    };
  }

  function saveHistoryEntry(payload) {
    try {
      const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      const { wind, elev } = formatWindElev(
        payload.windage?.dir || "—",
        payload.windage?.clicks ?? 0,
        payload.elevation?.dir || "—",
        payload.elevation?.clicks ?? 0
      );

      const entry = {
        ts: Date.now(),
        score: payload.score,
        shots: payload.shots,
        wind,
        elev
      };

      const next = [entry, ...hist].slice(0, 3);
      localStorage.setItem(HIST_KEY, JSON.stringify(next));
    } catch {}
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
    saveHistoryEntry(payload);

    const b64 = b64FromObj(payload);
    location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  // ---- Photo button triggers file picker
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => elFile.click());
  }

  // ---- File input: load image
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => {
        setStatus("Tap Aim Point, then tap hits.");
        setHint(""); // keep landing clean
      };
      elImg.src = objectUrl;
    });
  }

  // ---- Single-tap handler (prevents double-hit)
  function handleTap(ev) {
    // Debounce: ignore if too soon (prevents touch+click doubles)
    const now = Date.now();
    if (now - lastTapMs < 220) return;
    lastTapMs = now;

    if (!elImg || !elImg.src) return;

    // If we can, prevent default to avoid ghost clicks
    if (ev && typeof ev.preventDefault === "function") ev.preventDefault();

    const { x01, y01 } = getRelative01FromEvent(ev);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setStatus("Now tap your hits.");
      showResultsIfAny(); // “magic” results button can appear once aim is set
    } else {
      shots.push({ x01, y01 });
      addDot(x01, y01, "shot");
      setTapCount();
      showResultsIfAny(); // ensure visible once shots exist
    }
  }

  function bindTapLayer() {
    if (!elImg) return;

    // Prefer pointer events
    if ("PointerEvent" in window) {
      elImg.addEventListener("pointerdown", handleTap, { passive: false });
      return;
    }

    // Fallback: touchstart (avoid click)
    elImg.addEventListener("touchstart", (ev) => {
      const t = ev.touches && ev.touches[0];
      if (!t) return;
      // synthesize clientX/Y onto event-like object
      handleTap({
        clientX: t.clientX,
        clientY: t.clientY,
        preventDefault: () => ev.preventDefault()
      });
    }, { passive: false });
  }

  bindTapLayer();

  // ---- Clear
  if (elClear) elClear.addEventListener("click", clearDots);

  // ---- Show results (either normal button or sticky)
  function onShowResults() {
    const out = computeCorrectionAndScore();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one hit.");
      return;
    }

    const payload = {
      sessionId: "S-" + Date.now(),
      score: out.score, // ✅ REAL SCORE
      shots: shots.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      secPngUrl: "",
      vendorUrl: (elVendor && elVendor.href && elVendor.href !== "#") ? elVendor.href : "",
      surveyUrl: "",
      debug: {
        aim,
        avgPoi: out.avgPoi,
        center_moa: out.center_moa,
        spread_moa: out.spread_moa,
        dist: out.dist
      }
    };

    goToSEC(payload);
  }

  if (elSee) elSee.addEventListener("click", onShowResults);
  if (elStickyBtn) elStickyBtn.addEventListener("click", onShowResults);

  // ---- Boot
  clearDots();
})();
