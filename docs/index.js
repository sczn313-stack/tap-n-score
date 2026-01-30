/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vTAPFIX+LOADFALLBACK-4
   Fixes:
   - Bind taps to #dotsLayer (NOT canvas) so taps always register
   - Use pointerdown only (prevents double counting on iOS)
   - Robust image load: try ObjectURL, fallback to FileReader dataURL
   - Always resync overlay after image loads
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

  let taps = [];
  let objectUrl = null;

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function renderDots(dotsLayer, wrap, tapCountEl) {
    dotsLayer.innerHTML = "";

    const r = wrap.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;

    taps.forEach((t, i) => {
      const d = document.createElement("div");
      d.className = "tapDot";
      d.style.position = "absolute";
      d.style.width = i === 0 ? "18px" : "14px";
      d.style.height = i === 0 ? "18px" : "14px";
      d.style.borderRadius = "999px";
      d.style.transform = "translate(-50%, -50%)";
      d.style.left = `${t.nx * w}px`;
      d.style.top = `${t.ny * h}px`;
      d.style.background = i === 0 ? "rgba(255,180,0,0.95)" : "rgba(0,220,120,0.95)";
      d.style.boxShadow = "0 6px 18px rgba(0,0,0,0.45)";
      d.style.border = "2px solid rgba(0,0,0,0.35)";
      dotsLayer.appendChild(d);
    });

    tapCountEl.textContent = `Taps: ${taps.length}`;
  }

  function getClientXY(evt) {
    // PointerEvent preferred
    if (evt && typeof evt.clientX === "number" && typeof evt.clientY === "number") {
      return { x: evt.clientX, y: evt.clientY };
    }
    // Touch fallback (rare once pointerdown is used)
    if (evt.touches && evt.touches[0]) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    return null;
  }

  function bindTapToOverlay(dotsLayer, wrap, tapCountEl) {
    // Make sure overlay actually receives interaction
    dotsLayer.style.pointerEvents = "auto";
    dotsLayer.style.touchAction = "none"; // stop Safari gesture stealing taps

    const handler = (evt) => {
      // Prevent scroll/zoom stealing the tap
      if (evt.cancelable) evt.preventDefault();

      const pt = getClientXY(evt);
      if (!pt) return;

      const r = wrap.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;

      const nx = clamp01((pt.x - r.left) / r.width);
      const ny = clamp01((pt.y - r.top) / r.height);

      taps.push({ nx, ny });
      renderDots(dotsLayer, wrap, tapCountEl);
    };

    // Only ONE listener. No click. No touchstart. No duplicates.
    dotsLayer.addEventListener("pointerdown", handler, { passive: false });

    // Block long-press menu
    dotsLayer.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function setThumb(thumbBox, imgSrc) {
    if (!thumbBox) return;
    thumbBox.innerHTML = "";
    const im = document.createElement("img");
    im.src = imgSrc;
    im.alt = "Selected target thumbnail";
    im.style.width = "100%";
    im.style.height = "auto";
    im.style.display = "block";
    im.style.borderRadius = "12px";
    thumbBox.appendChild(im);
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

    // iOS sometimes needs decode() to fully paint before measuring
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
      log("ObjectURL load failed, fallback to FileReader:", e);
      revokeUrl();
    }

    // Fallback: FileReader dataURL (more reliable on iOS for some images)
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(file);
    });

    await loadImgSrc(imgEl, dataUrl);
  }

  function init() {
    showBanner("INDEX.JS LOADED ✅ vTAPFIX+LOADFALLBACK-4", 2500);
    log("Loaded v4");

    const input = $("photoInput");
    const chooseBtn = $("chooseBtn");
    const fileName = $("fileName");
    const thumbBox = $("thumbBox");

    const wrap = $("targetWrap");
    const img = $("targetImg");
    const dots = $("dotsLayer");
    const tapCountEl = $("tapCount");
    const instructionEl = $("instructionLine");

    if (!input || !chooseBtn || !wrap || !img || !dots || !tapCountEl || !instructionEl) {
      alert("Missing required HTML element IDs. Check index.html IDs match index.js.");
      return;
    }

    // Bind taps to overlay (this is the core fix)
    bindTapToOverlay(dots, wrap, tapCountEl);

    const resync = () => {
      renderDots(dots, wrap, tapCountEl);
    };
    window.addEventListener("resize", resync);

    chooseBtn.addEventListener("click", () => {
      showBanner("OPENING PHOTO PICKER…", 900);
      input.click();
    });

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      showBanner(`FILE: ${file.name}`, 1700);
      log("Selected file:", file.name, file.type, file.size);

      if (fileName) fileName.textContent = file.name;

      taps = [];
      tapCountEl.textContent = "Taps: 0";
      instructionEl.textContent = "Loading image…";

      try {
        img.style.display = "block";
        await loadFileToImg(file, img);

        // Thumbnail = same src
        setThumb(thumbBox, img.src);

        // Give layout a beat, then resync overlay
        requestAnimationFrame(() => {
          resync();
          instructionEl.textContent = "Tap bull’s-eye (anchor)";
        });
      } catch (e) {
        log("Load failed:", e);
        alert("Couldn’t load image. Try a different photo.");
        instructionEl.textContent = "Image load failed";
      } finally {
        // Allow re-selecting same file again on iOS
        input.value = "";
      }
    });

    tapCountEl.textContent = "Taps: 0";
    instructionEl.textContent = "Choose a photo to begin";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
