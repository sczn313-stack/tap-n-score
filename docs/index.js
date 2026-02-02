/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   Tap-n-Score™ (Shooter-facing)
   - Bull first (blue), then shots (red)
   - Sends taps + setup (distance/moa) to backend
   - Backend is authority for directions + clicks
   - Saves SEC payload to localStorage then routes to sec.html
============================================================ */

(() => {
  // --------------------------
  // DOM helpers
  // --------------------------
  const $ = (id) => document.getElementById(id);

  // Expected IDs (match your index.html)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");
  const elInstruction = $("instructionLine");
  const elWrap = $("targetWrap");

  // Optional UI (safe if missing)
  const elDiag = $("diagOut"); // optional <pre>
  const elMode = $("modeLine"); // optional
  const elSetupLocked = $("setupLockedBadge"); // optional

  // --------------------------
  // Storage keys
  // --------------------------
  const SETUP_KEY = "SCZN3_TARGET_SETUP_V1";       // written by target.html
  const SEC_KEY   = "SCZN3_SEC_PAYLOAD_V1";        // read by sec.js

  // --------------------------
  // State
  // --------------------------
  let selectedFile = null;
  let objectUrl = null;

  // taps: bull (first) + shots
  let bull = null;            // {x,y} in image pixel space
  let shots = [];             // [{x,y}]
  let stage = "bull";         // "bull" | "shots"

  // --------------------------
  // Diagnostics
  // --------------------------
  function diag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  // --------------------------
  // Setup (distance/moa) from target.html
  // --------------------------
  function readSetup() {
    try {
      const raw = localStorage.getItem(SETUP_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      // expected: { distanceYds: number, moaPerClick: number, vendorUrl?: string, surveyUrl?: string }
      return s && typeof s === "object" ? s : null;
    } catch {
      return null;
    }
  }

  function ensureSetupLockedUI() {
    const setup = readSetup();
    if (!setup) {
      if (elSetupLocked) elSetupLocked.textContent = "SETUP NOT SET";
      return false;
    }
    if (elSetupLocked) elSetupLocked.textContent = "SETUP LOCKED";
    return true;
  }

  // --------------------------
  // Coordinate mapping
  // Tap position -> image pixel coordinates
  // --------------------------
  function getImageRect() {
    return elImg.getBoundingClientRect();
  }

  function clientToImageXY(clientX, clientY) {
    const rect = getImageRect();
    const xRel = (clientX - rect.left) / rect.width;
    const yRel = (clientY - rect.top) / rect.height;

    const x = xRel * elImg.naturalWidth;
    const y = yRel * elImg.naturalHeight;

    return { x, y };
  }

  // Render dots in overlay layer using % positioning (stable on resize)
  function clearDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
  }

  function addDot(clientX, clientY, colorClass) {
    if (!elDots) return;

    const rect = getImageRect();
    const xPct = ((clientX - rect.left) / rect.width) * 100;
    const yPct = ((clientY - rect.top) / rect.height) * 100;

    const dot = document.createElement("div");
    dot.className = `dot ${colorClass}`; // expect .dot, .dotBull, .dotShot in CSS
    dot.style.left = `${xPct}%`;
    dot.style.top = `${yPct}%`;

    elDots.appendChild(dot);
  }

  function updateInstruction() {
    if (!elInstruction) return;

    if (!selectedFile) {
      elInstruction.textContent = "Choose a photo to start.";
      return;
    }

    if (stage === "bull") {
      elInstruction.textContent = "Tap the bull first (blue).";
    } else {
      elInstruction.textContent = "Now tap your shots (red), then hit Show Results.";
    }
  }

  function updateCounts() {
    if (!elTapCount) return;
    const bullCount = bull ? 1 : 0;
    elTapCount.textContent = `${bullCount + shots.length}`;
  }

  function setModeLabel() {
    if (!elMode) return;
    elMode.textContent = stage === "bull" ? "TAP: BULL" : "TAP: SHOTS";
  }

  // --------------------------
  // Image loading
  // --------------------------
  function setImageFromFile(file) {
    selectedFile = file;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      // Clear previous state on new image load
      bull = null;
      shots = [];
      stage = "bull";
      clearDots();
      updateCounts();
      updateInstruction();
      setModeLabel();
      ensureSetupLockedUI();

      diag({
        ok: true,
        event: "image_loaded",
        natural: { w: elImg.naturalWidth, h: elImg.naturalHeight },
      });
    };

    elImg.src = objectUrl;
  }

  // --------------------------
  // Tapping handler
  // --------------------------
  function handleTap(ev) {
    if (!selectedFile) return;
    if (!elImg.naturalWidth || !elImg.naturalHeight) return;

    // iOS: use changedTouches for touch events
    const p = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
    const clientX = p.clientX;
    const clientY = p.clientY;

    const imgXY = clientToImageXY(clientX, clientY);

    if (stage === "bull") {
      bull = imgXY;
      addDot(clientX, clientY, "dotBull");
      stage = "shots";
    } else {
      shots.push(imgXY);
      addDot(clientX, clientY, "dotShot");
    }

    updateCounts();
    updateInstruction();
    setModeLabel();

    diag({
      ok: true,
      event: "tap",
      stage,
      bull: bull ? { x: round2(bull.x), y: round2(bull.y) } : null,
      shots: shots.length,
    });
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // --------------------------
  // Backend call
  // --------------------------
  function getApiBase() {
    // Uses same-origin by default. If you have a different backend host,
    // set localStorage SCZN3_API_BASE once, or add a global window.SCXN3_API_BASE.
    return (
      window.SCXN3_API_BASE ||
      localStorage.getItem("SCZN3_API_BASE") ||
      ""
    );
  }

  async function callAnalyze(payload) {
    const apiBase = getApiBase();
    const url = (apiBase ? apiBase.replace(/\/+$/, "") : "") + "/api/analyze";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Analyze failed (${res.status}) ${text}`.trim());
    }
    return res.json();
  }

  // --------------------------
  // SEC payload + routing
  // --------------------------
  function buildSecPayloadFromBackend(data, setup) {
    return {
      sessionId: data.sessionId || `SEC-${Date.now().toString(36).toUpperCase()}`,

      // score number only (SEC page decides style)
      score: Number(data.score ?? 0),

      // shot count
      shots: Number(data.shots ?? shots.length),

      windage: {
        dir: data.windage?.dir || data.clicks?.windDir || data.windDir || "—",
        clicks: data.windage?.clicks ?? data.clicks?.windage ?? data.windageClicks ?? 0,
      },

      elevation: {
        dir: data.elevation?.dir || data.clicks?.elevDir || data.elevDir || "—",
        clicks: data.elevation?.clicks ?? data.clicks?.elevation ?? data.elevationClicks ?? 0,
      },

      // Optional linkouts
      vendorUrl: setup?.vendorUrl || data.vendorUrl || "",
      surveyUrl: setup?.surveyUrl || data.surveyUrl || "",

      // Optional debug fields (safe)
      debug: data.debug || null,
    };
  }

  function routeToSec() {
    window.location.href = "./sec.html";
  }

  // --------------------------
  // Buttons
  // --------------------------
  function onClear() {
    bull = null;
    shots = [];
    stage = "bull";
    clearDots();
    updateCounts();
    updateInstruction();
    setModeLabel();

    diag({ ok: true, event: "clear" });
  }

  async function onShowResults() {
    // Setup MUST be chosen upstream (target.html)
    const setup = readSetup();
    if (!setup || !Number.isFinite(Number(setup.distanceYds)) || !Number.isFinite(Number(setup.moaPerClick))) {
      alert("Setup not set yet. Go to Target Setup first (distance + MOA per click).");
      diag({ ok: false, event: "show_results", reason: "missing_setup", setup });
      return;
    }

    if (!bull) {
      alert("Tap the bull first.");
      return;
    }
    if (shots.length < 1) {
      alert("Tap at least one shot.");
      return;
    }

    // Disable button while working (if present)
    if (elShow) {
      elShow.disabled = true;
      elShow.classList.add("isWorking");
    }

    try {
      const payload = {
        setup: {
          distanceYds: Number(setup.distanceYds),
          moaPerClick: Number(setup.moaPerClick),
        },
        bull: { x: bull.x, y: bull.y },
        shots: shots.map((s) => ({ x: s.x, y: s.y })),

        // optional metadata
        client: {
          ua: navigator.userAgent,
          ts: Date.now(),
        },
      };

      diag({ ok: true, event: "analyze_request", url: getApiBase() + "/api/analyze", payload });

      const data = await callAnalyze(payload);

      // Build + persist SEC payload
      const secPayload = buildSecPayloadFromBackend(data, setup);
      localStorage.setItem(SEC_KEY, JSON.stringify(secPayload));

      diag({ ok: true, event: "analyze_ok", data, secPayload });

      // Route to SEC screen
      routeToSec();
    } catch (err) {
      console.error(err);
      alert(String(err?.message || err || "Analyze error"));
      diag({ ok: false, event: "analyze_error", error: String(err) });
    } finally {
      if (elShow) {
        elShow.disabled = false;
        elShow.classList.remove("isWorking");
      }
    }
  }

  // --------------------------
  // Hook up listeners
  // --------------------------
  function init() {
    ensureSetupLockedUI();
    updateInstruction();
    setModeLabel();
    updateCounts();

    // Choose photo
    if (elFile) {
      elFile.addEventListener("change", (e) => {
        const file = e.target?.files?.[0];
        if (file) setImageFromFile(file);
      });
    }

    // Tap area (wrap preferred; fallback to image)
    const tapTarget = elWrap || elImg;
    if (tapTarget) {
      tapTarget.addEventListener("click", handleTap, { passive: true });
      tapTarget.addEventListener("touchend", handleTap, { passive: true });
    }

    // Clear
    if (elClear) elClear.addEventListener("click", onClear);

    // Show Results
    if (elShow) elShow.addEventListener("click", onShowResults);

    diag({ ok: true, event: "init", setup: readSetup() });
  }

  init();
})();
