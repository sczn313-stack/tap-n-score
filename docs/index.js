/* ============================================================
   index.js (FULL REPLACEMENT) — IMAGE LOAD RELIABILITY PATCH
   Fixes:
   - Target image sometimes not showing after selecting a photo (iOS/Safari)
   - Adds onload/onerror status so we know EXACT failure point
   - Resets file input ONLY AFTER img loads (prevents iOS oddities)
   - Keeps your Aim Point + Hits tap flow intact
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Required IDs
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Optional
  const elVendor = $("vendorLink");
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let aim = null;
  let hits = [];

  // Ghost tap prevention (still fine to keep)
  let lastPointerTapAt = 0;
  const GHOST_WINDOW_MS = 650;

  function setText(el, txt) { if (el) el.textContent = txt; }
  function now() { return Date.now(); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

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

  function computeCorrection() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    const dx = aim.x01 - avg.x; // + => RIGHT
    const dy = aim.y01 - avg.y; // + => DOWN (screen space)

    const inchesPerFullWidth = 10; // placeholder
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
    if (!elImg?.src) return;

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

  // ---- IMAGE LOAD PIPELINE (THE FIX)
  function loadSelectedFile(file) {
    if (!file) return;

    // clear tap state, keep UI ready
    clearDots();

    // cleanup old object URL
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      objectUrl = null;
    }

    // set status now
    setText(elStatus, "Loading photo…");

    // create URL + attach reliable handlers
    objectUrl = URL.createObjectURL(file);

    // IMPORTANT: assign handlers BEFORE setting src
    elImg.onload = () => {
      setText(elStatus, "Photo loaded. Tap Aim Point.");
      // NOW it is safe to clear the input so user can re-pick same image
      try { elFile.value = ""; } catch {}
    };

    elImg.onerror = () => {
      setText(elStatus, "Photo failed to load. Try again.");
      // keep input (don’t clear) so user can retry
    };

    elImg.src = objectUrl;
  }

  // ---- EVENTS
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;
      loadSelectedFile(f);
    });
  }

  // Tap surface — use wrapper so image scroll/drag doesn’t steal taps
  const tapSurface = elWrap || elImg;

  if (tapSurface) {
    tapSurface.style.touchAction = "manipulation";

    tapSurface.addEventListener("pointerdown", (ev) => {
      if (ev.isPrimary === false) return;
      if (ev.pointerType === "mouse" && ev.button !== 0) return;

      // Only allow taps AFTER image has loaded (prevents “half state” taps)
      if (!elImg?.src) return;

      ev.preventDefault();
      handleTap(ev);
    }, { passive: false });

    // block ghost click if it happens
    tapSurface.addEventListener("click", (ev) => {
      const t = now();
      if (t - lastPointerTapAt < GHOST_WINDOW_MS) {
        ev.preventDefault();
        ev.stopPropagation();
        return false;
      }
    }, true);
  }

  if (elClear) elClear.addEventListener("click", () => {
    clearDots();
    setText(elStatus, "Cleared. Tap Aim Point.");
  });

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
  setText(elStatus, "Add a photo to begin.");
})();
