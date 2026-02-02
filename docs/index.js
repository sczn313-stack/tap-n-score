/* ============================================================
   docs/index.js  (FULL REPLACEMENT)
   Tap-n-Score™ → Backend /api/calc → SEC localStorage → sec.html

   Requires these IDs in index.html:
   - photoInput        (file input)
   - targetImg         (img)
   - targetWrap        (container around img)
   - dotsLayer         (overlay div positioned over img)
   - instructionLine   (text line)
   - tapCount          (text/label)
   - clearTapsBtn      (button)
   - showResultsBtn    (button)
   - backBtn (optional) (button or link)
   - distanceYds (optional) input
   - clickMoa   (optional) input
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const API_CALC = `${API_BASE}/api/calc`;

  // ---- SEC localStorage key (MUST MATCH sec.js)
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- Assumption: the target is a 23x23 inch grid unless overridden
  // You can override by adding ?size=23 in URL, or change default below.
  const params = new URLSearchParams(location.search);
  const TARGET_SIZE_IN = Number(params.get("size")) || 23;

  // ---- DOM (only bind if it exists; avoids hard crashes)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
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

  // Bull + shots in *inches* (screen-space: x right, y down)
  let bull = null;     // {x,y}
  let shots = [];      // [{x,y}, ...]

  // ---- Helpers
  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt;
  }

  function setInstruction(txt) {
    setText(elInstruction, txt);
  }

  function setTapCount() {
    setText(elTapCount, `${shots.length}`);
  }

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

  function syncOverlayToImage() {
    if (!elImg || !elDots) return;
    const r = elImg.getBoundingClientRect();
    // dotsLayer is positioned absolute inside targetWrap in most of your layouts
    // This keeps the overlay the same size as the displayed image.
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }

  function imgRect() {
    if (!elImg) return null;
    const r = elImg.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return null;
    return r;
  }

  function pointPxToInches(xPx, yPx, rect) {
    // Map displayed-pixel coords -> inches over known target size
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
    if (yes) {
      el.classList.remove("btnDisabled");
      el.setAttribute("aria-disabled", "false");
      el.disabled = false;
    } else {
      el.classList.add("btnDisabled");
      el.setAttribute("aria-disabled", "true");
      el.disabled = true;
    }
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

  // ---- SEC route + payload (backend authority)
  function routeToSEC_FromBackendResult(calcResult) {
    // calcResult is expected from /api/calc
    // {
    //   ok:true,
    //   directions:{windage:"LEFT|RIGHT|NONE", elevation:"UP|DOWN|NONE"},
    //   clicks:{windage:number, elevation:number},
    //   ...
    // }

    const windDir = calcResult?.directions?.windage ?? "—";
    const elevDir = calcResult?.directions?.elevation ?? "—";

    const windClicks = calcResult?.clicks?.windage ?? 0;
    const elevClicks = calcResult?.clicks?.elevation ?? 0;

    // If your backend later returns score, we’ll show it. Otherwise keep "—".
    const scoreMaybe = Number(calcResult?.score);
    const score = Number.isFinite(scoreMaybe) ? scoreMaybe : null;

    const secPayload = {
      sessionId: calcResult?.sessionId || `SEC-${Date.now().toString(36).toUpperCase()}`,
      score,               // number or null (sec.html will show —)
      shots: shots.length, // local shot count is reliable

      windage: { dir: windDir, clicks: windClicks },
      elevation: { dir: elevDir, clicks: elevClicks },

      secPngUrl: calcResult?.secPngUrl || calcResult?.secUrl || "",

      vendorUrl: calcResult?.vendorUrl || "",
      surveyUrl: calcResult?.surveyUrl || ""
    };

    // Save a small history for PREV 1–3 display on SEC page
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

    // Persist for sec.html
    localStorage.setItem(SEC_KEY, JSON.stringify(secPayload));

    // Route
    window.location.href = "./sec.html";
  }

  // ---- Backend call
  async function calcViaBackend() {
    const distanceYds = readNum(elDist, 100);
    const clickMoa = readNum(elClick, 0.25);

    const body = {
      bull,
      shots,
      distanceYds,
      clickMoa
    };

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

    // Tap position inside displayed image
    const xPx = e.clientX - r.left;
    const yPx = e.clientY - r.top;

    // Only accept taps inside the image bounds
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

    // Enable results after 1+ shots
    enable(elShow, shots.length >= 1);
  }

  // ---- File load (iOS safe)
  function loadFile(file) {
    if (!file) return;

    selectedFile = file;

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

  // ---- Wiring
  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      loadFile(f);
    });
  }

  // Tap on overlay if available, otherwise on the image
  if (elDots) elDots.addEventListener("click", onTap);
  else if (elImg) elImg.addEventListener("click", onTap);

  if (elClear) {
    elClear.addEventListener("click", () => {
      resetAll();
    });
  }

  if (elShow) {
    enable(elShow, false);
    elShow.addEventListener("click", async () => {
      if (!bull || shots.length < 1) return;

      try {
        enable(elShow, false);
        setInstruction("Calculating…");

        const calcResult = await calcViaBackend();

        // ✅ This is the exact moment results are finalized:
        // write SEC payload -> route to sec.html
        routeToSEC_FromBackendResult(calcResult);
      } catch (err) {
        console.error(err);
        setInstruction(`Error: ${String(err?.message || err)}`);
        enable(elShow, true);
      }
    });
  }

  // Keep overlay in sync on resize/orientation
  window.addEventListener("resize", () => {
    syncOverlayToImage();
    redrawAllDots();
  });

  // Boot
  setInstruction("Tap the bull first (blue). Then tap shots (red).");
  setTapCount();
})();
