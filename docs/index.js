/* ============================================================
   docs/index.js  (FULL REPLACEMENT)
   Tap-n-Score™ → Backend /api/calc → SEC localStorage → sec.html

   IMPORTANT:
   - localStorage is PER-DOMAIN.
   - This file MUST be run from your GitHub Pages site (same origin as sec.html).
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const API_CALC = `${API_BASE}/api/calc`;

  // ---- SEC storage keys (MUST MATCH sec.js)
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- Target size (inches)
  const params = new URLSearchParams(location.search);
  const TARGET_SIZE_IN = Number(params.get("size")) || 23;

  // ---- DOM
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elInstruction = $("instructionLine");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");
  const elDist = $("distanceYds"); // optional
  const elClick = $("clickMoa");   // optional

  // ---- State
  let selectedFile = null;
  let objectUrl = null;

  // Bull + shots in inches (screen-space: x right, y down)
  let bull = null;
  let shots = [];

  // ---- Helpers
  function setText(el, txt) {
    if (el) el.textContent = txt;
  }

  function setInstruction(txt) {
    setText(elInstruction, txt);
  }

  function setTapCount() {
    setText(elTapCount, `${shots.length}`);
  }

  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function addDot(xPx, yPx, cls) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = `dot ${cls || ""}`.trim();
    d.style.left = `${xPx}px`;
    d.style.top = `${yPx}px`;
    elDots.appendChild(d);
  }

  function imgRect() {
    if (!elImg) return null;
    const r = elImg.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return null;
    return r;
  }

  function pointPxToInches(xPx, yPx, rect) {
    const xIn = (xPx / rect.width) * TARGET_SIZE_IN;
    const yIn = (yPx / rect.height) * TARGET_SIZE_IN;
    return { x: xIn, y: yIn };
  }

  function pointInchesToPx(p, rect) {
    const xPx = (p.x / TARGET_SIZE_IN) * rect.width;
    const yPx = (p.y / TARGET_SIZE_IN) * rect.height;
    return { xPx, yPx };
  }

  function enable(el, yes) {
    if (!el) return;
    el.disabled = !yes;
    el.setAttribute("aria-disabled", yes ? "false" : "true");
    el.classList.toggle("btnDisabled", !yes);
  }

  function readNum(el, fallback) {
    const v = Number(el?.value);
    return Number.isFinite(v) ? v : fallback;
  }

  function redrawAllDots() {
    clearDots();
    const r = imgRect();
    if (!r) return;

    if (bull) {
      const { xPx, yPx } = pointInchesToPx(bull, r);
      addDot(xPx, yPx, "dotBull");
    }
    for (const s of shots) {
      const { xPx, yPx } = pointInchesToPx(s, r);
      addDot(xPx, yPx, "dotShot");
    }
  }

  function resetAll() {
    bull = null;
    shots = [];
    redrawAllDots();
    setTapCount();
    setInstruction("Tap the bull first (blue). Then tap shots (red).");
    enable(elShow, false);
  }

  // ---- SAFE SAME-ORIGIN ROUTE (prevents bouncing to another domain)
  function goToSecSameOrigin() {
    // Example:
    // https://sczn313-stack.github.io/tap-n-score/sec.html
    const basePath = location.pathname.replace(/[^/]*$/, ""); // current folder
    const secUrl = `${location.origin}${basePath}sec.html`;
    window.location.href = secUrl;
  }

  // ---- SEC route + payload (backend authority)
  function routeToSEC_FromBackendResult(calcResult) {
    const windDir = calcResult?.directions?.windage ?? "—";
    const elevDir = calcResult?.directions?.elevation ?? "—";

    const windClicks = Number(calcResult?.clicks?.windage ?? 0);
    const elevClicks = Number(calcResult?.clicks?.elevation ?? 0);

    const scoreMaybe = Number(calcResult?.score);
    const score = Number.isFinite(scoreMaybe) ? scoreMaybe : null;

    const secPayload = {
      sessionId: calcResult?.sessionId || `SEC-${Date.now().toString(36).toUpperCase()}`,
      score,               // number or null
      shots: shots.length, // local shot count is correct
      windage: { dir: windDir, clicks: windClicks },
      elevation: { dir: elevDir, clicks: elevClicks },
      secPngUrl: calcResult?.secPngUrl || calcResult?.secUrl || "",
      vendorUrl: calcResult?.vendorUrl || "",
      surveyUrl: calcResult?.surveyUrl || ""
    };

    // Save small history (PREV 1–3)
    try {
      const prev = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      const entry = {
        t: Date.now(),
        score: secPayload.score,
        shots: secPayload.shots,
        wind: `${secPayload.windage.dir} ${Number(secPayload.windage.clicks).toFixed(2)}`,
        elev: `${secPayload.elevation.dir} ${Number(secPayload.elevation.clicks).toFixed(2)}`
      };
      const next = [entry, ...prev].slice(0, 3);
      localStorage.setItem(HIST_KEY, JSON.stringify(next));
    } catch (_) {}

    // Persist payload (BOTH storages = extra iOS safety)
    try {
      localStorage.setItem(SEC_KEY, JSON.stringify(secPayload));
      sessionStorage.setItem(SEC_KEY, JSON.stringify(secPayload));
    } catch (e) {
      console.error("SEC storage write failed:", e);
    }

    console.log("✅ SEC payload written on:", location.origin, secPayload);

    // Route to SEC on SAME ORIGIN
    goToSecSameOrigin();
  }

  // ---- Backend call
  async function calcViaBackend() {
    const distanceYds = readNum(elDist, 100);
    const clickMoa = readNum(elClick, 0.25);

    const body = { bull, shots, distanceYds, clickMoa };

    const res = await fetch(API_CALC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      const msg = data?.error || `Backend error (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  // ---- Tap handling
  function onTap(e) {
    const r = imgRect();
    if (!r) return;

    const xPx = e.clientX - r.left;
    const yPx = e.clientY - r.top;

    if (xPx < 0 || yPx < 0 || xPx > r.width || yPx > r.height) return;

    const pIn = pointPxToInches(xPx, yPx, r);

    if (!bull) {
      bull = pIn;
      addDot(xPx, yPx, "dotBull");
      setInstruction("Bull set. Now tap shots (red).");
      return;
    }

    shots.push(pIn);
    addDot(xPx, yPx, "dotShot");
    setTapCount();
    enable(elShow, shots.length >= 1);
  }

  // ---- File load (iOS safe)
  function loadFile(file) {
    if (!file) return;
    selectedFile = file;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    if (elImg) {
      elImg.onload = () => redrawAllDots();
      elImg.src = objectUrl;
    }

    resetAll();
  }

  // ---- Wiring
  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      loadFile(f);
    });
  }

  if (elDots) elDots.addEventListener("click", onTap);
  else if (elImg) elImg.addEventListener("click", onTap);

  if (elClear) elClear.addEventListener("click", resetAll);

  if (elShow) {
    enable(elShow, false);
    elShow.addEventListener("click", async () => {
      if (!bull || shots.length < 1) return;

      try {
        enable(elShow, false);
        setInstruction("Calculating…");

        const calcResult = await calcViaBackend();

        // ✅ Results finalized → write payload → route
        routeToSEC_FromBackendResult(calcResult);
      } catch (err) {
        console.error(err);
        setInstruction(`Error: ${String(err?.message || err)}`);
        enable(elShow, true);
      }
    });
  }

  window.addEventListener("resize", redrawAllDots);

  // Boot
  setInstruction("Tap the bull first (blue). Then tap shots (red).");
  setTapCount();
})();
