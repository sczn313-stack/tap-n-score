/* ============================================================
   docs/index.js  (FULL REPLACEMENT)
   Tap-n-Score™ → Backend /api/calc → SEC localStorage → sec.html

   HARDENED:
   - Binds to multiple possible element IDs so a renamed button
     won’t silently break the flow.
   - Writes SEC payload every time BEFORE routing.
   - Uses inches only. Screen space: x right, y down.
============================================================ */

(() => {
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const API_CALC = `${API_BASE}/api/calc`;

  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- helpers
  const $ = (id) => document.getElementById(id);
  const pick = (...ids) => ids.map($).find(Boolean) || null;

  const setText = (el, txt) => { if (el) el.textContent = txt; };
  const enable = (el, yes) => {
    if (!el) return;
    el.disabled = !yes;
    el.setAttribute("aria-disabled", yes ? "false" : "true");
    el.classList.toggle("btnDisabled", !yes);
    el.classList.toggle("btnDisabled", !yes);
  };

  const readNum = (el, fallback) => {
    const v = Number(el?.value);
    return Number.isFinite(v) ? v : fallback;
  };

  // ---- target size inches (default 23)
  const params = new URLSearchParams(location.search);
  const TARGET_SIZE_IN = Number(params.get("size")) || 23;

  // ---- DOM (support multiple ID variants)
  const elFile = pick("photoInput", "fileInput", "imageInput");
  const elImg = pick("targetImg", "previewImg", "img");
  const elWrap = pick("targetWrap", "imgWrap", "wrap");
  const elDots = pick("dotsLayer", "tapLayer", "overlay");
  const elInstruction = pick("instructionLine", "instruction", "instructions");
  const elTapCount = pick("tapCount", "countLabel", "shotCount");
  const elClear = pick("clearTapsBtn", "clearBtn", "btnClear");
  const elShow = pick("showResultsBtn", "showResults", "showResultsButton", "btnResults");
  const elDist = pick("distanceYds", "distance");
  const elClick = pick("clickMoa", "moaPerClick");

  // ---- state
  let objectUrl = null;
  let bull = null;      // {x,y} inches
  let shots = [];       // [{x,y}] inches

  // ---- overlay dots
  function clearDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
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

  function syncOverlayToImage() {
    if (!elImg || !elDots) return;
    const r = elImg.getBoundingClientRect();
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }

  function pxToInches(xPx, yPx, rect) {
    return {
      x: (xPx / rect.width) * TARGET_SIZE_IN,
      y: (yPx / rect.height) * TARGET_SIZE_IN
    };
  }

  function inchesToPx(p, rect) {
    return {
      xPx: (p.x / TARGET_SIZE_IN) * rect.width,
      yPx: (p.y / TARGET_SIZE_IN) * rect.height
    };
  }

  function redrawAllDots() {
    clearDots();
    const r = imgRect();
    if (!r) return;

    if (bull) {
      const { xPx, yPx } = inchesToPx(bull, r);
      addDot(xPx, yPx, "dotBull");
    }

    for (const s of shots) {
      const { xPx, yPx } = inchesToPx(s, r);
      addDot(xPx, yPx, "dotShot");
    }
  }

  function setInstruction(txt) {
    setText(elInstruction, txt);
  }

  function setCount() {
    setText(elTapCount, String(shots.length));
  }

  function resetAll() {
    bull = null;
    shots = [];
    redrawAllDots();
    setCount();
    setInstruction("Tap the bull first (blue). Then tap shots (red).");
    enable(elShow, false);
  }

  // ---- SEC payload + history
  function pushHistory(entry) {
    try {
      const prev = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      const next = [entry, ...prev].slice(0, 3);
      localStorage.setItem(HIST_KEY, JSON.stringify(next));
    } catch (_) {}
  }

  function routeToSEC(calcResult) {
    const windDir = calcResult?.directions?.windage ?? "—";
    const elevDir = calcResult?.directions?.elevation ?? "—";

    const windClicks = Number(calcResult?.clicks?.windage ?? 0);
    const elevClicks = Number(calcResult?.clicks?.elevation ?? 0);

    // backend may not return score yet; keep null
    const scoreMaybe = Number(calcResult?.score);
    const score = Number.isFinite(scoreMaybe) ? scoreMaybe : null;

    const payload = {
      sessionId: calcResult?.sessionId || `SEC-${Date.now().toString(36).toUpperCase()}`,
      score,
      shots: shots.length,
      windage: { dir: windDir, clicks: windClicks },
      elevation: { dir: elevDir, clicks: elevClicks },
      secPngUrl: calcResult?.secPngUrl || calcResult?.secUrl || "",
      vendorUrl: calcResult?.vendorUrl || "",
      surveyUrl: calcResult?.surveyUrl || ""
    };

    // write history
    pushHistory({
      t: Date.now(),
      score: payload.score,
      shots: payload.shots,
      wind: `${payload.windage.dir} ${windClicks.toFixed(2)}`,
      elev: `${payload.elevation.dir} ${elevClicks.toFixed(2)}`
    });

    // write payload
    localStorage.setItem(SEC_KEY, JSON.stringify(payload));

    // route
    window.location.href = "./sec.html";
  }

  // ---- backend calc
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
      throw new Error(data?.error || `Backend error (${res.status})`);
    }
    return data;
  }

  // ---- tapping
  function onTap(e) {
    const r = imgRect();
    if (!r) return;

    const xPx = e.clientX - r.left;
    const yPx = e.clientY - r.top;

    if (xPx < 0 || yPx < 0 || xPx > r.width || yPx > r.height) return;

    const pIn = pxToInches(xPx, yPx, r);

    if (!bull) {
      bull = pIn;
      addDot(xPx, yPx, "dotBull");
      setInstruction("Bull set. Now tap shots (red).");
      return;
    }

    shots.push(pIn);
    addDot(xPx, yPx, "dotShot");
    setCount();
    enable(elShow, shots.length >= 1);
  }

  // ---- file load
  function loadFile(file) {
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    if (elImg) {
      elImg.onload = () => {
        syncOverlayToImage();
        redrawAllDots();
      };
      elImg.src = objectUrl;
    }

    resetAll();
  }

  // ---- wiring
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

        // ✅ results finalized → write SEC payload → route
        routeToSEC(calcResult);
      } catch (err) {
        console.error(err);
        setInstruction(`Error: ${String(err?.message || err)}`);
        enable(elShow, true);
      }
    });
  }

  window.addEventListener("resize", () => {
    syncOverlayToImage();
    redrawAllDots();
  });

  // boot
  setInstruction("Tap the bull first (blue). Then tap shots (red).");
  setCount();
})();
