/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   SINGLE-PAGE FLOW:
   - Choose Photo
   - Tap bull (blue) + shots (red)
   - POST to backend /api/calc (backend authority)
   - Render SEC numbers ON THIS PAGE (no sec.html, no localStorage payload)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Backend
  const API_BASE = "https://sczn3-backend-new.onrender.com";
  const API_CALC = `${API_BASE}/api/calc`;

  // ---- Optional: if you still use target.html elsewhere, we’ll restore an image if present
  const KEY_IMG = "sczn3_target_image_dataurl_v1";

  // ---- Target size for tap->inches mapping (default 23" grid)
  const params = new URLSearchParams(location.search);
  const TARGET_SIZE_IN = Number(params.get("size")) || 23;

  // ---- DOM
  const chooseBtn = $("chooseBtn");
  const fileInput = $("photoInput");
  const clearBtn = $("clearTapsBtn");
  const showBtn = $("showResultsBtn");

  const img = $("targetImg");
  const wrap = $("targetWrap");
  const dotsLayer = $("dotsLayer");
  const emptyState = $("emptyState");

  const instructionLine = $("instructionLine");
  const tapCount = $("tapCount");
  const diagOut = $("diagOut");

  const distanceYdsEl = $("distanceYds");
  const clickMoaEl = $("clickMoa");

  // Results (SEC on same page)
  const resultsWrap = $("results");
  const secScore = $("secScore");
  const secWindClicks = $("secWindClicks");
  const secWindDir = $("secWindDir");
  const secElevClicks = $("secElevClicks");
  const secElevDir = $("secElevDir");

  // ---- State (in inches, screen-space: x right+, y down+)
  let bull = null;     // {x,y}
  let shots = [];      // [{x,y},...]
  let objectUrl = null;

  // ---- Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setDiag(obj) {
    if (!diagOut) return;
    diagOut.textContent = JSON.stringify(obj, null, 2);
  }

  function setInstruction(txt) {
    if (instructionLine) instructionLine.textContent = txt;
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

  function imgRect() {
    if (!img) return null;
    const r = img.getBoundingClientRect();
    if (!r || r.width < 2 || r.height < 2) return null;
    return r;
  }

  // px (inside image box) -> inches (0..TARGET_SIZE_IN)
  function pxToInches(xPx, yPx, rect) {
    const xIn = (xPx / rect.width) * TARGET_SIZE_IN;
    const yIn = (yPx / rect.height) * TARGET_SIZE_IN;
    return { x: xIn, y: yIn };
  }

  function inchesToPx(p, rect) {
    const xPx = (p.x / TARGET_SIZE_IN) * rect.width;
    const yPx = (p.y / TARGET_SIZE_IN) * rect.height;
    return { xPx, yPx };
  }

  function clearDots() {
    if (!dotsLayer) return;
    dotsLayer.innerHTML = "";
  }

  function addDotPx(xPx, yPx, cls) {
    if (!dotsLayer) return;
    const d = document.createElement("div");
    d.className = `dot ${cls || ""}`.trim();
    d.style.left = `${xPx}px`;
    d.style.top = `${yPx}px`;
    dotsLayer.appendChild(d);
  }

  function redrawDots() {
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

  function resetTaps() {
    bull = null;
    shots = [];
    redrawDots();
    if (tapCount) tapCount.textContent = "0";
    resultsWrap.style.display = "none";
    secScore.textContent = "—";
    secWindClicks.textContent = "0.00";
    secWindDir.textContent = "—";
    secElevClicks.textContent = "0.00";
    secElevDir.textContent = "—";
    enable(showBtn, false);
    setInstruction("Choose a photo. Tap the bull (blue). Tap shots (red). Then Show Results.");
  }

  function setImageSrc(src) {
    if (!img) return;
    img.onload = () => {
      img.style.display = "block";
      if (emptyState) emptyState.style.display = "none";
      redrawDots();
      resetTaps(); // start clean every time photo loads
      setInstruction("Photo loaded ✅ Tap the bull (blue).");
      setDiag({ ok: true, imageLoaded: true });
    };
    img.onerror = () => {
      setInstruction("Image failed to load ❌");
      setDiag({ ok: false, imageLoaded: false });
    };
    img.src = src;
  }

  // ---- Tap handling
  function onTap(ev) {
    const r = imgRect();
    if (!r) return;

    const t = ev.touches && ev.touches[0];
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    const xPx = clientX - r.left;
    const yPx = clientY - r.top;

    if (xPx < 0 || yPx < 0 || xPx > r.width || yPx > r.height) return;

    const pIn = pxToInches(xPx, yPx, r);

    if (!bull) {
      bull = pIn;
      redrawDots();
      setInstruction("Bull set ✅ Now tap shots (red).");
      return;
    }

    shots.push(pIn);
    if (tapCount) tapCount.textContent = String(shots.length);
    redrawDots();
    enable(showBtn, shots.length >= 1);
  }

  // ---- Backend calc
  async function calcViaBackend() {
    const distanceYds = readNum(distanceYdsEl, 100);
    const clickMoa = readNum(clickMoaEl, 0.25);

    const body = { bull, shots, distanceYds, clickMoa };

    const res = await fetch(API_CALC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `Backend error (${res.status})`);
    }

    return { data, bodySent: body };
  }

  function fmt2(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  }

  // ---- Render SEC (same page)
  function renderSEC(calcResult) {
    const data = calcResult.data;

    // Directions + clicks (backend authority)
    const wDir = data?.directions?.windage || "—";
    const eDir = data?.directions?.elevation || "—";
    const wClicks = data?.clicks?.windage ?? 0;
    const eClicks = data?.clicks?.elevation ?? 0;

    secWindDir.textContent = wDir;
    secElevDir.textContent = eDir;
    secWindClicks.textContent = fmt2(wClicks);
    secElevClicks.textContent = fmt2(eClicks);

    // Score not implemented by backend yet -> show —
    const scoreMaybe = Number(data?.score);
    secScore.textContent = Number.isFinite(scoreMaybe) ? String(scoreMaybe) : "—";

    resultsWrap.style.display = "block";

    setInstruction("Results ready ✅");
    setDiag({
      ok: true,
      bodySent: calcResult.bodySent,
      backend: data
    });
  }

  // ---- Wire events
  chooseBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    // Save dataURL too (helps if you still bounce pages)
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl.startsWith("data:image/")) {
        try { localStorage.setItem(KEY_IMG, dataUrl); } catch {}
      }
    };
    reader.readAsDataURL(f);

    setImageSrc(objectUrl);
    fileInput.value = "";
  });

  clearBtn.addEventListener("click", () => {
    resetTaps();
    setInstruction("Cleared ✅ Tap the bull (blue). Then tap shots (red).");
  });

  // Tap on overlay (preferred) so dots never block image taps
  dotsLayer.addEventListener("touchstart", (e) => { e.preventDefault(); onTap(e); }, { passive: false });
  dotsLayer.addEventListener("click", onTap);

  enable(showBtn, false);
  showBtn.addEventListener("click", async () => {
    if (!img.src) { setInstruction("Choose a photo first."); return; }
    if (!bull) { setInstruction("Tap the bull first (blue)."); return; }
    if (shots.length < 1) { setInstruction("Tap at least 1 shot (red)."); return; }

    try {
      enable(showBtn, false);
      setInstruction("Calculating…");

      const calcResult = await calcViaBackend();
      renderSEC(calcResult);

      enable(showBtn, true);
    } catch (err) {
      setInstruction(`Error: ${String(err?.message || err)}`);
      setDiag({ ok: false, error: String(err?.message || err) });
      enable(showBtn, true);
    }
  });

  window.addEventListener("resize", () => redrawDots());

  // ---- Boot
  setInstruction("Choose a photo. Tap the bull (blue). Tap shots (red). Then Show Results.");
  setDiag({ ok: true, mode: "single-page-sec", api: API_CALC });

  // If an image was stored previously (from an old target page), restore it
  try {
    const stored = localStorage.getItem(KEY_IMG);
    if (stored && String(stored).startsWith("data:image/")) {
      setImageSrc(stored);
    }
  } catch {}
})();
