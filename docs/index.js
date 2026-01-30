/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vBANNER+LOAD-PROOF-3
   Purpose:
   - Use our own hidden #photoInput + #chooseBtn button (iOS proof)
   - Always load preview + show thumbnail
   - Always capture taps on #tapCanvas and draw dots
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

  function syncCanvasToWrap(canvas, wrap) {
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function renderDots(dotsLayer, wrap, tapCountEl) {
    dotsLayer.innerHTML = "";
    const r = wrap.getBoundingClientRect();
    const w = r.width;
    const h = r.height;

    taps.forEach((t, i) => {
      const d = document.createElement("div");
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

  function getClientPoint(evt) {
    if (evt.touches && evt.touches.length) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    if (typeof evt.clientX === "number") return { x: evt.clientX, y: evt.clientY };
    return null;
  }

  function bindTap(canvas, wrap, dotsLayer, tapCountEl) {
    const handler = (evt) => {
      if (evt.cancelable) evt.preventDefault();
      evt.stopPropagation();

      const pt = getClientPoint(evt);
      if (!pt) return;

      const r = wrap.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) return;

      const nx = Math.max(0, Math.min(1, (pt.x - r.left) / r.width));
      const ny = Math.max(0, Math.min(1, (pt.y - r.top) / r.height));

      taps.push({ nx, ny });
      renderDots(dotsLayer, wrap, tapCountEl);
    };

    canvas.addEventListener("pointerdown", handler, { passive: false });
    canvas.addEventListener("touchstart", handler, { passive: false });
    canvas.addEventListener("click", handler);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  async function loadFileToImg(file, imgEl) {
    revokeUrl();
    objectUrl = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      const ok = () => cleanup(resolve);
      const bad = () => cleanup(() => reject(new Error("Image decode failed")));
      const cleanup = (done) => {
        imgEl.removeEventListener("load", ok);
        imgEl.removeEventListener("error", bad);
        done();
      };
      imgEl.addEventListener("load", ok, { once: true });
      imgEl.addEventListener("error", bad, { once: true });
      imgEl.src = objectUrl;
    });
  }

  function setThumb(thumbBox, imgSrc) {
    thumbBox.innerHTML = "";
    const im = document.createElement("img");
    im.src = imgSrc;
    im.alt = "Selected target thumbnail";
    thumbBox.appendChild(im);
  }

  function init() {
    showBanner("INDEX.JS LOADED ✅ vBANNER+LOAD-PROOF-3", 2500);
    log("Loaded v3");

    const input = $("photoInput");
    const chooseBtn = $("chooseBtn");
    const fileName = $("fileName");
    const thumbBox = $("thumbBox");

    const wrap = $("targetWrap");
    const img = $("targetImg");
    const canvas = $("tapCanvas");
    const dots = $("dotsLayer");
    const tapCountEl = $("tapCount");
    const instructionEl = $("instructionLine");

    // Ensure overlay sizing
    const resync = () => {
      syncCanvasToWrap(canvas, wrap);
      renderDots(dots, wrap, tapCountEl);
    };
    window.addEventListener("resize", resync);

    bindTap(canvas, wrap, dots, tapCountEl);

    // Our own button triggers the hidden input
    chooseBtn.addEventListener("click", () => {
      showBanner("OPENING PHOTO PICKER…", 900);
      input.click();
    });

    // When the file is chosen, we always handle it
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      showBanner(`FILE: ${file.name}`, 1700);
      log("Selected file:", file.name, file.type, file.size);

      fileName.textContent = file.name;

      taps = [];
      tapCountEl.textContent = "Taps: 0";
      instructionEl.textContent = "Loading image…";

      try {
        img.style.display = "block";
        await loadFileToImg(file, img);

        // set thumbnail using same src
        setThumb(thumbBox, img.src);

        requestAnimationFrame(() => {
          resync();
          instructionEl.textContent = "Tap bull’s-eye (anchor)";
        });
      } catch (e) {
        log("Load failed:", e);
        alert("Couldn’t load image. Try a different photo.");
        instructionEl.textContent = "Image load failed";
      }
    });

    // Initial state
    tapCountEl.textContent = "Taps: 0";
    instructionEl.textContent = "Choose a photo to begin";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
