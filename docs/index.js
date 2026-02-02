/* ============================================================
   docs/index.js  (FULL REPLACEMENT)
   Tap-n-Score™ (Tap Page)
   Flow:
   1) Load photo (from target.html localStorage OR picker)
   2) Tap bull (blue) + shots (red)
   3) POST to backend /api/calc (backend authority)
   4) Write SEC payload to localStorage (SCZN3_SEC_PAYLOAD_V1)
   5) Route to sec.html

   REQUIRED IDs in docs/index.html:
   - photoInput
   - targetImg
   - targetWrap
   - dotsLayer
   - instructionLine
   - tapCount
   - clearTapsBtn
   - showResultsBtn
   - backBtn (optional)
   - distanceYds (optional)
   - clickMoa   (optional)

   NOTE:
   - Inches-only internal representation.
   - Screen-space: x right positive, y down positive (matches backend server.js).
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const API_CALC = `${API_BASE}/api/calc`;

  // ---- Storage Keys
  const KEY_IMG = "sczn3_target_image_dataurl_v1"; // from target.html
  const KEY_NAME = "sczn3_target_image_name_v1";
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- Target size (inches) mapping for tap->inches conversion
  // default 23; override with ?size=23
  const params = new URLSearchParams(location.search);
  const TARGET_SIZE_IN = Number(params.get("size")) || 23;

  // ---- DOM
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elInstruction = $("instructionLine");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");
  const elBack = $("backBtn");       // optional
  const elDist = $("distanceYds");   // optional
  const elClick = $("clickMoa");     // optional

  // ---- State (in inches, screen-space)
  let bull = null;    // {x,y}
  let shots = [];     // [{x,y},...]

  let objectUrl = null;

  // ---- Tiny helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setText(el, txt) {
    if (el) el.textContent = txt;
  }

  function setInstruction(txt) {
    setText(elInstruction, txt);
  }

  function setTapCount() {
    setText(elTapCount, String(shots.length));
  }

  function enable(el, yes) {
    if (!el) return;
    if (yes) {
      el.classList.remove("btnDisabled");
      el.disabled = false;
      el.setAttribute("aria-disabled", "false");
    } else {
      el.classList.add("btnDisabled");
      el.disabled = true;
      el.setAttribute("aria-disabled", "true");
    }
  }

  function readNum(el, fallback) {
    const v = Number(el?.value);
    return Number.isFinite(v) ? v : fallback;
  }

  // ---- Overlay / dots
  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function addDotPx(xPx, yPx, cls) {
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
    if (!r || r.width < 2 || r.height < 2) return null;
    return r;
  }

  function syncOverlayToImage() {
    if (!elImg || !elDots) return;
    const r = elImg.getBoundingClientRect();
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;
  }

  function pxToInches(xPx, yPx, rect) {
    // Map displayed pixels -> inches across known target size
    const xIn = (xPx / rect.width) * TARGET_SIZE_IN;
    const yIn = (yPx / rect.height) * TARGET_SIZE_IN;
    return { x: xIn, y: yIn };
  }

  function inchesToPx(p, rect) {
    const xPx = (p.x / TARGET_SIZE_IN) * rect.width;
    const yPx = (p.y / TARGET_SIZE_IN) * rect.height;
    return { xPx, yPx };
  }

  function redrawAllDots() {
    clearDots();
    const r = imgRect();
    if (!r) return;

    if (bull) {
      const { xPx, yPx } = inchesToPx(bull, r);
      addDotPx(xPx, yPx, "dotBull");
    }
    for (const s of shots) {
      const { xPx, yPx } = inchesToPx(s, r);
      addDotPx(xPx, yPx, "dotShot");
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

  // ---- Tap handling (overlay click)
  function onTap(ev) {
    const r = imgRect();
    if (!r) return;

    // Support touch and mouse
    const t = ev.touches && ev.touches[0];
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    const xPx = clientX - r.left;
    const yPx = clientY - r.top;

    if (xPx < 0 || yPx < 0 || xPx > r.width || yPx > r.height) return;

    const pIn = pxToInches(xPx, yPx, r);

    if (!bull) {
      bull = pIn;
      redrawAllDots();
      setInstruction("Bull set ✅ Now tap shots (red).");
      return;
    }

    shots.push(pIn);
    setTapCount();
    redrawAllDots();
    enable(elShow, shots.length >= 1);
  }

  // ---- Backend call
  async function calcViaBackend() {
    const distanceYds = readNum(elDist, 100);
    const clickMoa = readNum(elClick, 0.25);

    const body = {
      bull,          // inches
      shots,         // inches
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

  // ---- Write SEC payload + route
  function routeToSEC_FromCalc(calcResult) {
    const payload = {
      sessionId: calcResult.sessionId || `SEC-${Date.now().toString(36).toUpperCase()}`,

      // score may not exist yet; SEC will show —
      score: Number.isFinite(Number(calcResult.score)) ? Number(calcResult.score) : null,

      shots: shots.length,

      windage: {
        dir: calcResult?.directions?.windage || "—",
        clicks: Number(calcResult?.clicks?.windage ?? 0)
      },
      elevation: {
        dir: calcResult?.directions?.elevation || "—",
        clicks: Number(calcResult?.clicks?.elevation ?? 0)
      },

      // optional future: backend-generated png URL
      secPngUrl: String(calcResult?.secPngUrl || calcResult?.secUrl || "").trim(),
      vendorUrl: String(calcResult?.vendorUrl || "").trim(),
      surveyUrl: String(calcResult?.surveyUrl || "").trim()
    };

    // history (prev1-3)
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

    // write + verify
    localStorage.setItem(SEC_KEY, JSON.stringify(payload));
    const verify = localStorage.getItem(SEC_KEY);

    if (!verify) {
      alert("SEC payload did NOT save. (Safari storage blocked / wrong page running)");
      console.log("❌ localStorage write failed", payload);
      return;
    }

    console.log("✅ SEC payload saved", payload);

    // cache-bust the SEC page so iOS doesn’t show an old render
    window.location.href = `./sec.html?fresh=${Date.now()}`;
  }

  // ---- Image loading (from target.html storage OR picker)
  function setImageSrc(src) {
    if (!elImg) return;
    elImg.onload = () => {
      syncOverlayToImage();
      redrawAllDots();
    };
    elImg.onerror = () => {
      setInstruction("Image failed to load ❌");
    };
    elImg.src = src;
    if (elImg.style) elImg.style.display = "block";
  }

  function restoreImageFromStorage() {
    try {
      const dataUrl = localStorage.getItem(KEY_IMG);
      if (dataUrl && String(dataUrl).startsWith("data:image/")) {
        setImageSrc(dataUrl);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function loadFile(file) {
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    setImageSrc(objectUrl);

    // also store a dataURL so user can bounce pages without re-picking (iOS-friendly)
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl.startsWith("data:image/")) {
        try {
          localStorage.setItem(KEY_IMG, dataUrl);
          localStorage.setItem(KEY_NAME, file.name || "target.jpg");
        } catch (_) {}
      }
    };
    reader.readAsDataURL(file);

    resetAll();
  }

  // ---- Wire events
  if (elDots) {
    elDots.addEventListener("touchstart", (e) => { e.preventDefault(); onTap(e); }, { passive: false });
    elDots.addEventListener("click", onTap);
  } else if (elImg) {
    elImg.addEventListener("touchstart", (e) => { e.preventDefault(); onTap(e); }, { passive: false });
    elImg.addEventListener("click", onTap);
  }

  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      loadFile(f);
      // allow same file again
      elFile.value = "";
    });
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      resetAll();
      setInstruction("Cleared ✅ Tap the bull first (blue). Then tap shots (red).");
    });
  }

  if (elShow) {
    enable(elShow, false);
    elShow.addEventListener("click", async () => {
      if (!bull) { setInstruction("Tap the bull first (blue)."); return; }
      if (shots.length < 1) { setInstruction("Tap at least 1 shot (red)."); return; }

      try {
        enable(elShow, false);
        setInstruction("Calculating…");

        const calcResult = await calcViaBackend();

        // ✅ FINALIZE -> write SEC payload -> go SEC
        routeToSEC_FromCalc(calcResult);
      } catch (err) {
        console.error(err);
        setInstruction(`Error: ${String(err?.message || err)}`);
        enable(elShow, true);
      }
    });
  }

  if (elBack) {
    elBack.addEventListener("click", () => {
      // go back to target page if you have it, otherwise to root
      window.location.href = "./target.html";
    });
  }

  window.addEventListener("resize", () => {
    syncOverlayToImage();
    redrawAllDots();
  });

  // ---- Boot
  setInstruction("Tap the bull first (blue). Then tap shots (red).");
  setTapCount();

  // If we came from target.html, image should already be in storage
  const restored = restoreImageFromStorage();

  // If not restored, user must pick a file (your UI will handle the picker)
  if (restored) {
    // ensure overlay matches
    setTimeout(() => {
      syncOverlayToImage();
      redrawAllDots();
    }, 0);
  }

})();
