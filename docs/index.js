/* ============================================================
   index.js (FULL REPLACEMENT) — FIX-LOCK-IMG-1
   Fixes:
   - Image box contains ONLY image + overlay (CSS locks geometry)
   - Taps bind ONLY to #dotsLayer using pointerdown (no doubles)
   - Coordinates computed from IMG BOX rect (no page mismatch)
   - Robust image load: ObjectURL + fallback to FileReader
   - Start button only enables after image loaded
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const log = (...a) => console.log("[TAP-N-SCORE]", ...a);

  function showBanner(msg, ms = 1800) {
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

  let taps = [];
  let objectUrl = null;
  let imageReady = false;

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function clearTaps(dotsLayer, tapCountEl) {
    taps = [];
    dotsLayer.innerHTML = "";
    tapCountEl.textContent = "Taps: 0";
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
      d.style.top  = `${t.ny * h}px`;
      d.style.background = i === 0
        ? "rgba(255,180,0,0.95)"
        : "rgba(0,220,120,0.95)";
      dotsLayer.appendChild(d);
    });

    tapCountEl.textContent = `Taps: ${taps.length}`;
  }

  function setThumb(thumbBox, imgSrc) {
    thumbBox.innerHTML = "";
    const im = document.createElement("img");
    im.src = imgSrc;
    im.alt = "Selected target thumbnail";
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

    if (imgEl.decode) {
      try { await imgEl.decode(); } catch (_) {}
    }
  }

  async function loadFileToImg(file, imgEl) {
    revokeUrl();

    // 1) ObjectURL
    try {
      objectUrl = URL.createObjectURL(file);
      await loadImgSrc(imgEl, objectUrl);
      return;
    } catch (e) {
      log("ObjectURL failed -> FileReader fallback", e);
      revokeUrl();
    }

    // 2) FileReader fallback
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(file);
    });

    await loadImgSrc(imgEl, dataUrl);
  }

  function bindTap(dotsLayer, imgBox, tapCountEl) {
    // Make sure iOS actually delivers pointer events here
    dotsLayer.style.pointerEvents = "auto";
    dotsLayer.style.touchAction = "none";

    const onDown = (evt) => {
      // Block scroll/zoom stealing taps
      if (evt.cancelable) evt.preventDefault();

      // Don’t accept taps until image is loaded/shown
      if (!imageReady) return;

      const r = imgBox.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;

      const x = evt.clientX;
      const y = evt.clientY;

      const nx = clamp01((x - r.left) / r.width);
      const ny = clamp01((y - r.top) / r.height);

      taps.push({ nx, ny });
      renderDots(dotsLayer, imgBox, tapCountEl);
    };

    // ONE listener. No click. No touchstart.
    dotsLayer.addEventListener("pointerdown", onDown, { passive: false });

    // Block long-press menu
    dotsLayer.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function init() {
    showBanner("LOADED ✅ FIX-LOCK-IMG-1", 1600);

    const input = $("photoInput");
    const chooseBtn = $("chooseBtn");
    const fileName = $("fileName");
    const thumbBox = $("thumbBox");
    const startBtn = $("startBtn");

    const imgBox = $("imgBox");
    const img = $("targetImg");
    const dots = $("dotsLayer");

    const tapCountEl = $("tapCount");
    const instructionEl = $("instructionLine");

    if (!input || !chooseBtn || !fileName || !thumbBox || !startBtn ||
        !imgBox || !img || !dots || !tapCountEl || !instructionEl) {
      alert("Missing required element IDs. Re-check index.html.");
      return;
    }

    bindTap(dots, imgBox, tapCountEl);

    // Resize safety: redraw dots if orientation/size changes
    window.addEventListener("resize", () => {
      if (imageReady) renderDots(dots, imgBox, tapCountEl);
    });

    chooseBtn.addEventListener("click", () => {
      showBanner("OPENING PHOTO PICKER…", 900);
      input.click();
    });

    startBtn.addEventListener("click", () => {
      if (!imageReady) return;
      instructionEl.textContent = "Tap bull’s-eye (anchor)";
      imgBox.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      showBanner(`FILE: ${file.name}`, 1400);
      fileName.textContent = file.name;

      // Reset state
      imageReady = false;
      startBtn.disabled = true;
      instructionEl.textContent = "Loading image…";
      clearTaps(dots, tapCountEl);

      try {
        // Show image box now (but taps still locked until imageReady = true)
        imgBox.classList.remove("hidden");

        await loadFileToImg(file, img);

        // Thumb uses same src
        setThumb(thumbBox, img.src);

        // Now safe to accept taps
        imageReady = true;
        startBtn.disabled = false;

        // Redraw (in case)
        requestAnimationFrame(() => {
          renderDots(dots, imgBox, tapCountEl);
          instructionEl.textContent = "Press Start to begin tapping";
        });

        // Nice UX: scroll to Start
        // (keeps the card in view, then Start brings you to image)
      } catch (e) {
        log("Load failed:", e);
        alert("Couldn’t load image. Try a different photo.");
        instructionEl.textContent = "Image load failed";
        imgBox.classList.add("hidden");
      } finally {
        // Allow reselecting same file on iOS
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
