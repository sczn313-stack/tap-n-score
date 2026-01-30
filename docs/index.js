/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vTAP-LAYER-LOCK-6
   Fixes:
   - ONE tap receiver: #tapLayer sits exactly on top of image
   - Uses pointerdown only (no double counting)
   - Robust load: ObjectURL then FileReader fallback
   - Shows DEBUG in banner + instruction line when things go wrong
   - Reveals targetWrap only AFTER image is confirmed loaded
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  function banner(msg, ms = 2200) {
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
    clearTimeout(banner._t);
    banner._t = setTimeout(() => (b.style.display = "none"), ms);
  }

  const log = (...a) => console.log("[SCZN3]", ...a);

  let taps = [];
  let objectUrl = null;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function clearDots(tapLayer) {
    tapLayer.querySelectorAll(".tapDot").forEach((n) => n.remove());
  }

  function drawDots(tapLayer, rect) {
    clearDots(tapLayer);
    const w = rect.width || 1;
    const h = rect.height || 1;

    taps.forEach((t, i) => {
      const d = document.createElement("div");
      d.className = "tapDot";
      d.style.width = i === 0 ? "18px" : "14px";
      d.style.height = i === 0 ? "18px" : "14px";
      d.style.left = `${t.nx * w}px`;
      d.style.top  = `${t.ny * h}px`;
      d.style.background = i === 0 ? "rgba(255,180,0,0.95)" : "rgba(0,220,120,0.95)";
      tapLayer.appendChild(d);
    });
  }

  function getClientXY(evt) {
    if (evt && typeof evt.clientX === "number" && typeof evt.clientY === "number") {
      return { x: evt.clientX, y: evt.clientY };
    }
    return null;
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
      log("ObjectURL failed, fallback FileReader:", e);
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

  function setThumb(thumbBox, imgSrc) {
    if (!thumbBox) return;
    thumbBox.innerHTML = "";
    const im = document.createElement("img");
    im.src = imgSrc;
    im.alt = "Selected target thumbnail";
    thumbBox.appendChild(im);
  }

  function init() {
    banner("INDEX.JS LOADED ✅ vTAP-LAYER-LOCK-6", 2400);

    const input = $("photoInput");
    const chooseBtn = $("chooseBtn");
    const fileName = $("fileName");
    const thumbBox = $("thumbBox");

    const wrap = $("targetWrap");
    const img = $("targetImg");
    const tapLayer = $("tapLayer");

    const tapCountEl = $("tapCount");
    const instructionEl = $("instructionLine");

    if (!input || !chooseBtn || !wrap || !img || !tapLayer || !tapCountEl || !instructionEl) {
      alert("Missing required HTML element IDs. Check index.html matches index.js.");
      return;
    }

    // Make sure tap layer can receive pointer events on iOS
    tapLayer.style.pointerEvents = "auto";
    tapLayer.style.touchAction = "none";

    const resync = () => {
      const r = tapLayer.getBoundingClientRect();
      drawDots(tapLayer, r);
    };
    window.addEventListener("resize", resync);

    // Tap handler (ONE event only)
    tapLayer.addEventListener("pointerdown", (evt) => {
      if (evt.cancelable) evt.preventDefault();

      const pt = getClientXY(evt);
      if (!pt) return;

      const r = tapLayer.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) {
        instructionEl.textContent = `Tap layer too small: ${Math.round(r.width)}×${Math.round(r.height)}`;
        return;
      }

      const nx = clamp01((pt.x - r.left) / r.width);
      const ny = clamp01((pt.y - r.top) / r.height);

      taps.push({ nx, ny });
      tapCountEl.textContent = `Taps: ${taps.length}`;
      drawDots(tapLayer, r);

      // DEBUG (quick proof we’re reading the right coords)
      instructionEl.textContent = `Tap saved: (${nx.toFixed(3)}, ${ny.toFixed(3)})`;
    }, { passive: false });

    tapLayer.addEventListener("contextmenu", (e) => e.preventDefault());

    chooseBtn.addEventListener("click", () => {
      banner("OPENING PHOTO PICKER…", 900);
      input.click();
    });

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      taps = [];
      tapCountEl.textContent = "Taps: 0";
      instructionEl.textContent = "Loading image…";

      if (fileName) fileName.textContent = file.name;

      banner(`FILE: ${file.name}`, 1600);
      log("Selected:", file.name, file.type, file.size);

      try {
        await loadFileToImg(file, img);

        // show target area only after image is loaded
        wrap.classList.remove("hidden");

        // thumb uses same src
        setThumb(thumbBox, img.src);

        // let layout settle, then resync dots layer geometry
        requestAnimationFrame(() => {
          resync();
          instructionEl.textContent = "Tap bull’s-eye (anchor)";
          wrap.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } catch (e) {
        console.error(e);
        instructionEl.textContent = "Image load failed";
        alert("Couldn’t load image. Try a different photo.");
      } finally {
        // allow choosing the same file again on iOS
        input.value = "";
      }
    });

    // initial state
    wrap.classList.add("hidden");
    tapCountEl.textContent = "Taps: 0";
    instructionEl.textContent = "Choose a photo to begin";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
