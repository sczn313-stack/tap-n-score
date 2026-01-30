/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vBANNER+LOAD-PROOF-1

   Primary goals:
   1) PROVE the JS is actually running (green banner + console logs)
   2) PROVE file input change is firing (filename shown)
   3) PROVE image is loading (ObjectURL -> DataURL fallback)
   4) PROVE taps are captured (dot appears + tapCount increments)

   Works even if some IDs differ by creating missing elements.

   Expected / common IDs (but we guard hard):
   - photoInput
   - targetWrap
   - targetImg (optional; we will create if missing)
   - dotsLayer (optional; we will create if missing)
   - tapCount (optional; we will create if missing)
   - instructionLine (optional; we will create if missing)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- PROOF BANNER ----------
  function showBanner(msg) {
    const existing = document.getElementById("scznBanner");
    if (existing) existing.remove();

    const b = document.createElement("div");
    b.id = "scznBanner";
    b.textContent = msg;
    b.style.position = "fixed";
    b.style.left = "12px";
    b.style.right = "12px";
    b.style.bottom = "12px";
    b.style.zIndex = "999999";
    b.style.padding = "12px 14px";
    b.style.borderRadius = "12px";
    b.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
    b.style.fontSize = "14px";
    b.style.fontWeight = "700";
    b.style.letterSpacing = "0.3px";
    b.style.background = "rgba(0,160,70,0.92)";
    b.style.color = "#fff";
    b.style.boxShadow = "0 12px 32px rgba(0,0,0,0.45)";
    document.body.appendChild(b);

    setTimeout(() => {
      try { b.style.opacity = "0.92"; } catch (_) {}
    }, 50);
  }

  function log(...args) {
    console.log("[SCZN3]", ...args);
  }

  // ---------- STATE ----------
  let taps = [];
  let objectUrl = null;

  // ---------- ELEMENT ENSURE ----------
  function ensureTargetWrap() {
    let wrap = $("targetWrap");
    if (!wrap) {
      // last-resort: create a wrap so you still get a preview
      wrap = document.createElement("div");
      wrap.id = "targetWrap";
      wrap.style.marginTop = "12px";
      wrap.style.position = "relative";
      wrap.style.maxWidth = "980px";
      wrap.style.marginLeft = "auto";
      wrap.style.marginRight = "auto";
      document.body.appendChild(wrap);
      log("Created missing #targetWrap");
    }
    wrap.style.position = "relative";
    wrap.style.touchAction = "none";
    return wrap;
  }

  function ensureTargetImg(wrap) {
    let img = $("targetImg");
    if (!img) {
      img = document.createElement("img");
      img.id = "targetImg";
      img.alt = "Selected target preview";
      img.style.display = "block";
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.borderRadius = "12px";
      img.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
      img.style.pointerEvents = "none"; // taps go to overlay
      wrap.appendChild(img);
      log("Created missing #targetImg");
    } else {
      img.style.pointerEvents = "none";
    }
    return img;
  }

  function ensureDotsLayer(wrap) {
    let dots = $("dotsLayer");
    if (!dots) {
      dots = document.createElement("div");
      dots.id = "dotsLayer";
      wrap.appendChild(dots);
      log("Created missing #dotsLayer");
    }
    dots.style.position = "absolute";
    dots.style.inset = "0";
    dots.style.zIndex = "40";
    dots.style.pointerEvents = "none";
    return dots;
  }

  function ensureTapCanvas(wrap) {
    let c = $("tapCanvas");
    if (!c) {
      c = document.createElement("canvas");
      c.id = "tapCanvas";
      wrap.appendChild(c);
      log("Created missing #tapCanvas");
    }
    c.style.position = "absolute";
    c.style.inset = "0";
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.zIndex = "30";
    c.style.pointerEvents = "auto";
    c.style.touchAction = "none";
    c.style.background = "transparent";
    return c;
  }

  function ensureTapCount() {
    let el = $("tapCount");
    if (!el) {
      el = document.createElement("div");
      el.id = "tapCount";
      el.style.position = "fixed";
      el.style.top = "12px";
      el.style.right = "12px";
      el.style.zIndex = "999999";
      el.style.padding = "8px 10px";
      el.style.borderRadius = "10px";
      el.style.background = "rgba(0,0,0,0.6)";
      el.style.color = "#fff";
      el.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
      el.style.fontSize = "14px";
      el.style.fontWeight = "700";
      el.textContent = "Taps: 0";
      document.body.appendChild(el);
      log("Created missing #tapCount (floating counter)");
    }
    return el;
  }

  function ensureInstruction() {
    let el = $("instructionLine");
    if (!el) {
      el = document.createElement("div");
      el.id = "instructionLine";
      el.style.position = "fixed";
      el.style.top = "12px";
      el.style.left = "12px";
      el.style.zIndex = "999999";
      el.style.padding = "8px 10px";
      el.style.borderRadius = "10px";
      el.style.background = "rgba(0,0,0,0.6)";
      el.style.color = "#fff";
      el.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
      el.style.fontSize = "14px";
      el.style.fontWeight = "700";
      el.textContent = "Ready";
      document.body.appendChild(el);
      log("Created missing #instructionLine (floating)");
    }
    return el;
  }

  function syncCanvasToWrap(canvas, wrap) {
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  // ---------- DOTS ----------
  function renderDots(dotsLayer, wrap, tapCountEl, instructionEl) {
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
    instructionEl.textContent = taps.length === 0 ? "Tap bull’s-eye (anchor)" : "Tap confirmed hits";
  }

  // ---------- IMAGE LOADING ----------
  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function loadImgViaObjectUrl(img, file) {
    return new Promise((resolve, reject) => {
      revokeUrl();
      objectUrl = URL.createObjectURL(file);

      const ok = () => cleanup(resolve);
      const bad = () => cleanup(() => reject(new Error("ObjectURL decode failed")));

      const cleanup = (done) => {
        img.removeEventListener("load", ok);
        img.removeEventListener("error", bad);
        done();
      };

      img.addEventListener("load", ok, { once: true });
      img.addEventListener("error", bad, { once: true });
      img.src = objectUrl;
    });
  }

  function loadImgViaDataUrl(img, file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("FileReader failed"));
      fr.onload = () => {
        const dataUrl = fr.result;
        if (!dataUrl || typeof dataUrl !== "string") return reject(new Error("Bad dataURL"));
        const ok = () => cleanup(resolve);
        const bad = () => cleanup(() => reject(new Error("dataURL decode failed")));

        const cleanup = (done) => {
          img.removeEventListener("load", ok);
          img.removeEventListener("error", bad);
          done();
        };

        img.addEventListener("load", ok, { once: true });
        img.addEventListener("error", bad, { once: true });

        revokeUrl();
        img.src = dataUrl;
      };
      fr.readAsDataURL(file);
    });
  }

  async function loadSelectedFile(file, img, canvas, wrap, dotsLayer, tapCountEl, instructionEl) {
    taps = [];
    renderDots(dotsLayer, wrap, tapCountEl, instructionEl);

    instructionEl.textContent = "Loading image…";

    try {
      await loadImgViaObjectUrl(img, file);
      log("Loaded via ObjectURL:", file.name, file.type, file.size);
    } catch (e1) {
      log("ObjectURL failed, falling back to DataURL:", e1.message);
      await loadImgViaDataUrl(img, file);
      log("Loaded via DataURL:", file.name, file.type, file.size);
    }

    // After load, ensure overlay matches size
    requestAnimationFrame(() => {
      syncCanvasToWrap(canvas, wrap);
      renderDots(dotsLayer, wrap, tapCountEl, instructionEl);
      instructionEl.textContent = "Tap bull’s-eye (anchor)";
    });
  }

  // ---------- TAP CAPTURE ----------
  function getClientPoint(evt) {
    if (evt.touches && evt.touches.length) {
      return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    if (typeof evt.clientX === "number" && typeof evt.clientY === "number") {
      return { x: evt.clientX, y: evt.clientY };
    }
    return null;
  }

  function bindTap(canvas, wrap, dotsLayer, tapCountEl, instructionEl) {
    const handler = (evt) => {
      if (evt.cancelable) evt.preventDefault();
      evt.stopPropagation();

      const pt = getClientPoint(evt);
      if (!pt) return;

      const r = wrap.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (pt.x - r.left) / r.width));
      const ny = Math.max(0, Math.min(1, (pt.y - r.top) / r.height));

      taps.push({ nx, ny });
      renderDots(dotsLayer, wrap, tapCountEl, instructionEl);
    };

    canvas.addEventListener("pointerdown", handler, { passive: false });
    canvas.addEventListener("touchstart", handler, { passive: false });
    canvas.addEventListener("click", handler);

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ---------- FILE INPUT LISTEN (DELEGATED) ----------
  function setChosenFilenameUI(file) {
    // If you have a dedicated filename element, we’ll update it if found:
    // common ones: #fileName, #chosenName, #selectedFileName
    const candidates = ["fileName", "chosenName", "selectedFileName"];
    for (const id of candidates) {
      const el = $(id);
      if (el) el.textContent = file ? file.name : "";
    }
    log("Selected file:", file ? file.name : "(none)");
  }

  function wireFileInput(onFile) {
    // Direct binding if exists
    const input = $("photoInput");
    if (input) {
      input.addEventListener("change", (e) => {
        const f = e.target?.files?.[0] || null;
        if (!f) return;
        setChosenFilenameUI(f);
        onFile(f);
      });
      log("Bound #photoInput change listener");
    }

    // Also delegate (covers cases where element is re-rendered)
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.id === "photoInput") {
        const f = t.files?.[0] || null;
        if (!f) return;
        setChosenFilenameUI(f);
        onFile(f);
      }
    });
  }

  // ---------- INIT ----------
  function init() {
    showBanner("INDEX.JS LOADED ✅ vBANNER+LOAD-PROOF-1");
    log("INDEX.JS LOADED");

    const wrap = ensureTargetWrap();
    const img = ensureTargetImg(wrap);
    const dotsLayer = ensureDotsLayer(wrap);
    const canvas = ensureTapCanvas(wrap);
    const tapCountEl = ensureTapCount();
    const instructionEl = ensureInstruction();

    // make sure overlay sizing follows layout changes
    const resync = () => {
      syncCanvasToWrap(canvas, wrap);
      renderDots(dotsLayer, wrap, tapCountEl, instructionEl);
    };
    window.addEventListener("resize", resync);

    bindTap(canvas, wrap, dotsLayer, tapCountEl, instructionEl);

    wireFileInput(async (file) => {
      try {
        await loadSelectedFile(file, img, canvas, wrap, dotsLayer, tapCountEl, instructionEl);
      } catch (err) {
        log("LOAD FAILED:", err);
        alert("Couldn’t load image. Try a different photo.");
        instructionEl.textContent = "Image load failed";
      }
    });

    instructionEl.textContent = "Choose a photo to begin";
    tapCountEl.textContent = "Taps: 0";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
