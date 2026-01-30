/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vBANNER+LOAD-PROOF-2

   Fix focus:
   - Bind to ANY <input type="file">, not only #photoInput
   - Show selected filename in banner + console
   - Load preview reliably (ObjectURL -> DataURL fallback)
   - Enable taps via overlay canvas + visible dots + counter
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- PROOF BANNER ----------
  function showBanner(msg, ms = 2500) {
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
      b.style.fontWeight = "800";
      b.style.letterSpacing = "0.2px";
      b.style.background = "rgba(0,160,70,0.92)";
      b.style.color = "#fff";
      b.style.boxShadow = "0 12px 32px rgba(0,0,0,0.45)";
      document.body.appendChild(b);
    }
    b.textContent = msg;
    b.style.display = "block";
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => {
      try { b.style.display = "none"; } catch (_) {}
    }, ms);
  }

  const log = (...a) => console.log("[SCZN3]", ...a);

  // ---------- STATE ----------
  let taps = [];
  let objectUrl = null;

  // ---------- ENSURE ELEMENTS ----------
  function ensureTargetWrap() {
    let wrap = $("targetWrap");
    if (!wrap) {
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
      img.style.display = "none"; // hidden until load
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.borderRadius = "12px";
      img.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
      img.style.pointerEvents = "none"; // taps go to canvas
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
      el.style.fontWeight = "800";
      document.body.appendChild(el);
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
      el.style.fontWeight = "800";
      document.body.appendChild(el);
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

  function loadViaObjectUrl(img, file) {
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

  function loadViaDataUrl(img, file) {
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
    if (!file) return;

    // Guard: must be image
    if (!String(file.type || "").startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    taps = [];
    renderDots(dotsLayer, wrap, tapCountEl, instructionEl);
    instructionEl.textContent = "Loading image…";

    // show it even before load finishes (so layout exists)
    img.style.display = "block";

    try {
      await loadViaObjectUrl(img, file);
      log("Loaded via ObjectURL:", file.name, file.type, file.size);
    } catch (e1) {
      log("ObjectURL failed -> DataURL:", e1.message);
      await loadViaDataUrl(img, file);
      log("Loaded via DataURL:", file.name, file.type, file.size);
    }

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
      if (r.width <= 1 || r.height <= 1) return;

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

  // ---------- FILE INPUT (BULLETPROOF) ----------
  function getAnyFileInput() {
    // Prefer #photoInput if it exists, otherwise first file input found.
    return $("photoInput") || document.querySelector('input[type="file"]');
  }

  function bindAllFileInputs(onFile) {
    const bindOne = (input) => {
      if (!input || input._scznBound) return;
      input._scznBound = true;

      input.addEventListener("change", () => {
        const f = input.files && input.files[0] ? input.files[0] : null;
        if (!f) return;
        showBanner(`FILE: ${f.name}`, 1800);
        log("File change:", f.name, f.type, f.size);
        onFile(f);
      });

      log("Bound file input:", input.id ? `#${input.id}` : "(no id)");
    };

    // bind existing inputs now
    document.querySelectorAll('input[type="file"]').forEach(bindOne);

    // and keep binding if DOM changes
    const mo = new MutationObserver(() => {
      document.querySelectorAll('input[type="file"]').forEach(bindOne);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ---------- INIT ----------
  function init() {
    showBanner("INDEX.JS LOADED ✅ vBANNER+LOAD-PROOF-2", 2500);
    log("INDEX.JS LOADED v2");

    const wrap = ensureTargetWrap();
    const img = ensureTargetImg(wrap);
    const dotsLayer = ensureDotsLayer(wrap);
    const canvas = ensureTapCanvas(wrap);
    const tapCountEl = ensureTapCount();
    const instructionEl = ensureInstruction();

    tapCountEl.textContent = "Taps: 0";
    instructionEl.textContent = "Choose a photo to begin";

    // keep overlay synced
    const resync = () => {
      syncCanvasToWrap(canvas, wrap);
      renderDots(dotsLayer, wrap, tapCountEl, instructionEl);
    };
    window.addEventListener("resize", resync);

    bindTap(canvas, wrap, dotsLayer, tapCountEl, instructionEl);

    bindAllFileInputs(async (file) => {
      try {
        await loadSelectedFile(file, img, canvas, wrap, dotsLayer, tapCountEl, instructionEl);
      } catch (err) {
        log("LOAD FAILED:", err);
        alert("Couldn’t load image. Try a different photo.");
        instructionEl.textContent = "Image load failed";
      }
    });

    // Helpful: if there is NO file input found at all, call it out
    const fi = getAnyFileInput();
    if (!fi) {
      showBanner("NO <input type='file'> FOUND ON PAGE ❌", 4000);
      log("No file input found.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
