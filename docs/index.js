/* ============================================================
   index.js (FULL REPLACEMENT) — TAP-LAYER-LOCK-6a
   Restores:
   - Start flow
   - Clear / Undo / Results buttons
   - Thumbnail not huge (CSS handles size)
   Fixes:
   - Tap binding on #dotsLayer only (no double count)
   - Overlay locked to image box
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  function showBanner(msg, ms = 2200) {
    let b = document.getElementById("scznBanner");
    if (!b) {
      b = document.createElement("div");
      b.id = "scznBanner";
      b.style.position = "fixed";
      b.style.left = "12px";
      b.style.right = "12px";
      b.style.bottom = "12px";
      b.style.zIndex = "999999";
      b.style.padding = "12px 14px";
      b.style.borderRadius = "12px";
      b.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
      b.style.fontSize = "14px";
      b.style.fontWeight = "900";
      b.style.background = "rgba(0,160,70,0.92)";
      b.style.color = "#fff";
      b.style.boxShadow = "0 12px 32px rgba(0,0,0,0.45)";
      document.body.appendChild(b);
    }
    b.textContent = msg;
    b.style.display = "block";
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => (b.style.display = "none"), ms);
  }

  const log = (...a) => console.log("[SCZN3]", ...a);

  let taps = [];          // [{nx, ny}] first = anchor
  let objectUrl = null;
  let started = false;

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function getClientXY(evt) {
    if (evt && typeof evt.clientX === "number") return { x: evt.clientX, y: evt.clientY };
    if (evt.touches && evt.touches[0]) return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    return null;
  }

  function renderDots(dotsLayer, imgBox, tapCountEl) {
    dotsLayer.innerHTML = "";

    const r = imgBox.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;

    taps.forEach((t, i) => {
      const d = document.createElement("div");
      d.className = "tapDot";
      d.style.width = i === 0 ? "18px" : "14px";
      d.style.height = i === 0 ? "18px" : "14px";
      d.style.left = `${t.nx * w}px`;
      d.style.top = `${t.ny * h}px`;
      d.style.background = i === 0 ? "rgba(255,180,0,0.95)" : "rgba(0,220,120,0.95)";
      dotsLayer.appendChild(d);
    });

    tapCountEl.textContent = `Taps: ${taps.length}`;
  }

  async function loadImgSrc(imgEl, src) {
    await new Promise((resolve, reject) => {
      const ok = () => cleanup(resolve);
      const bad = () => cleanup(() => reject(new Error("Image load error")));
      const cleanup = (done) => {
        imgEl.removeEventListener("load", ok);
        imgEl.removeEventListener("error", bad);
        done();
      };
      imgEl.addEventListener("load", ok, { once: true });
      imgEl.addEventListener("error", bad, { once: true });
      imgEl.src = src;
    });

    if (imgEl.decode) {
      try { await imgEl.decode(); } catch (_) {}
    }
  }

  async function loadFileToImg(file, imgEl) {
    revokeUrl();

    // Try ObjectURL first
    try {
      objectUrl = URL.createObjectURL(file);
      await loadImgSrc(imgEl, objectUrl);
      return;
    } catch (e) {
      log("ObjectURL failed, using FileReader:", e);
      revokeUrl();
    }

    // Fallback: FileReader
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(file);
    });

    await loadImgSrc(imgEl, dataUrl);
  }

  function setThumb(thumbBox, src) {
    thumbBox.innerHTML = "";
    const im = document.createElement("img");
    im.src = src;
    im.alt = "Selected target thumbnail";
    thumbBox.appendChild(im);
  }

  function moaInchesAt(distanceYds) {
    // 1 MOA ~ 1.047" at 100yd (scale linearly)
    return 1.047 * (Number(distanceYds) / 100);
  }

  function computeResultsText(distanceYds, clickValue) {
    if (taps.length < 2) return "Need anchor + at least 1 hit.";

    const anchor = taps[0];
    const hits = taps.slice(1);

    const avg = hits.reduce((acc, t) => {
      acc.nx += t.nx;
      acc.ny += t.ny;
      return acc;
    }, { nx: 0, ny: 0 });

    avg.nx /= hits.length;
    avg.ny /= hits.length;

    // dx/dy in "image percent" relative to anchor (for now)
    const dx = avg.nx - anchor.nx; // + right
    const dy = avg.ny - anchor.ny; // + down (screen space)

    // We can’t convert to inches without calibration here, so we show percent + direction.
    // This keeps the UI working while you finish grid calibration.
    const dirH = dx > 0 ? "RIGHT" : "LEFT";
    const dirV = dy > 0 ? "DOWN" : "UP";

    const absDx = Math.abs(dx) * 100;
    const absDy = Math.abs(dy) * 100;

    const moaPerClick = Number(clickValue);
    const inchesPerMoa = moaInchesAt(distanceYds);

    // Placeholder “clicks” in percent-space is meaningless, so do NOT fake it.
    // Show the framework only.
    return [
      `Shots: ${hits.length}`,
      `POIB vs Anchor (image-space):`,
      `Horizontal: ${absDx.toFixed(2)}% ${dirH}`,
      `Vertical:   ${absDy.toFixed(2)}% ${dirV}`,
      ``,
      `Distance: ${distanceYds} yd`,
      `Click: ${moaPerClick} MOA per click`,
      `1 MOA ≈ ${inchesPerMoa.toFixed(3)}" at this distance`,
      ``,
      `Next step: add GRID calibration to convert % → inches → clicks.`
    ].join("\n");
  }

  function setButtons(clearBtn, undoBtn, resultsBtn) {
    const hasImg = started;
    const hasAny = taps.length > 0;
    const hasEnoughForResults = taps.length >= 2;

    clearBtn.disabled = !(hasImg && hasAny);
    undoBtn.disabled = !(hasImg && hasAny);
    resultsBtn.disabled = !(hasImg && hasEnoughForResults);
  }

  function init() {
    showBanner("INDEX.JS LOADED ✅ vTAP-LAYER-LOCK-6a", 2400);
    log("Loaded v6a");

    const input = $("photoInput");
    const chooseBtn = $("chooseBtn");
    const fileName = $("fileName");
    const thumbBox = $("thumbBox");

    const startBtn = $("startBtn");
    const imgBox = $("imgBox");
    const img = $("targetImg");
    const dots = $("dotsLayer");

    const clearBtn = $("clearBtn");
    const undoBtn = $("undoBtn");
    const resultsBtn = $("resultsBtn");

    const instructionEl = $("instructionLine");
    const tapCountEl = $("tapCount");

    const resultsPanel = $("resultsPanel");
    const resultsBody = $("resultsBody");
    const closeResultsBtn = $("closeResultsBtn");

    if (!input || !chooseBtn || !startBtn || !imgBox || !img || !dots || !instructionEl || !tapCountEl) {
      alert("Missing required element IDs. Make sure you replaced /docs/index.html with the provided version.");
      return;
    }

    // Tap layer should receive taps, not the image
    dots.style.pointerEvents = "auto";
    dots.style.touchAction = "none";

    const onTap = (evt) => {
      if (!started) return; // must press Start
      if (evt.cancelable) evt.preventDefault();

      const pt = getClientXY(evt);
      if (!pt) return;

      const r = imgBox.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;

      const nx = clamp01((pt.x - r.left) / r.width);
      const ny = clamp01((pt.y - r.top) / r.height);

      taps.push({ nx, ny });
      renderDots(dots, imgBox, tapCountEl);

      if (taps.length === 1) instructionEl.textContent = "Now tap each confirmed hit";
      setButtons(clearBtn, undoBtn, resultsBtn);
    };

    // SINGLE listener (no double count)
    dots.addEventListener("pointerdown", onTap, { passive: false });
    dots.addEventListener("contextmenu", (e) => e.preventDefault());

    chooseBtn.addEventListener("click", () => input.click());

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      showBanner(`FILE: ${file.name}`, 1400);
      fileName.textContent = file.name;

      // reset state
      taps = [];
      started = false;
      tapCountEl.textContent = "Taps: 0";
      instructionEl.textContent = "Photo loaded — press Start";
      renderDots(dots, imgBox, tapCountEl);

      try {
        await loadFileToImg(file, img);
        setThumb(thumbBox, img.src);

        // enable start
        startBtn.disabled = false;

        // keep img box hidden until Start
        imgBox.classList.add("hidden");

        setButtons(clearBtn, undoBtn, resultsBtn);
      } catch (e) {
        log("Load failed:", e);
        alert("Couldn’t load image. Try a different photo.");
        instructionEl.textContent = "Image load failed";
      } finally {
        input.value = ""; // allow selecting same file again on iOS
      }
    });

    startBtn.addEventListener("click", () => {
      if (startBtn.disabled) return;
      started = true;

      imgBox.classList.remove("hidden");

      taps = [];
      tapCountEl.textContent = "Taps: 0";
      instructionEl.textContent = "Tap bull’s-eye (anchor)";
      renderDots(dots, imgBox, tapCountEl);

      setButtons(clearBtn, undoBtn, resultsBtn);
    });

    clearBtn.addEventListener("click", () => {
      if (clearBtn.disabled) return;
      taps = [];
      tapCountEl.textContent = "Taps: 0";
      instructionEl.textContent = "Tap bull’s-eye (anchor)";
      renderDots(dots, imgBox, tapCountEl);
      setButtons(clearBtn, undoBtn, resultsBtn);
    });

    undoBtn.addEventListener("click", () => {
      if (undoBtn.disabled) return;
      taps.pop();
      renderDots(dots, imgBox, tapCountEl);

      if (taps.length === 0) instructionEl.textContent = "Tap bull’s-eye (anchor)";
      else if (taps.length === 1) instructionEl.textContent = "Now tap each confirmed hit";
      else instructionEl.textContent = "Keep tapping hits (or press Results)";

      setButtons(clearBtn, undoBtn, resultsBtn);
    });

    resultsBtn.addEventListener("click", () => {
      if (resultsBtn.disabled) return;
      const dist = $("distanceYds").value;
      const click = $("clickValue").value;

      resultsBody.textContent = computeResultsText(dist, click);
      resultsPanel.classList.remove("hidden");
    });

    closeResultsBtn.addEventListener("click", () => {
      resultsPanel.classList.add("hidden");
    });

    // Initial UI state
    startBtn.disabled = true;
    imgBox.classList.add("hidden");
    tapCountEl.textContent = "Taps: 0";
    instructionEl.textContent = "Choose a photo to begin";
    setButtons(clearBtn, undoBtn, resultsBtn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
