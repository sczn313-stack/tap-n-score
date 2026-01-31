/* ============================================================
   docs/index.js (FULL REPLACEMENT) — FIX-LOCK-IMG-1
   Matches current docs/index.html IDs:
   - photoInput, chooseBtn, fileName, thumbBox
   - imgBox, targetImg, dotsLayer
   - instructionLine, tapCount, startBtn
   - distanceYds, clickValue

   Goals:
   - Always load image on iOS (ObjectURL -> FileReader fallback)
   - Overlay locked to the exact image box (#imgBox)
   - Taps only register inside image box
   - No double counting (pointerdown only)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log("[TAP-N-SCORE]", ...a);

  // ---- State
  let taps = []; // {nx, ny}
  let objectUrl = null;
  let hasImage = false;

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function setInstruction(text) {
    const el = $("instructionLine");
    if (el) el.textContent = text;
  }

  function setTapCount() {
    const el = $("tapCount");
    if (el) el.textContent = `Taps: ${taps.length}`;
  }

  function clearDots() {
    const dots = $("dotsLayer");
    if (dots) dots.innerHTML = "";
  }

  function renderDots() {
    const imgBox = $("imgBox");
    const dots = $("dotsLayer");
    if (!imgBox || !dots) return;

    // clear then redraw
    dots.innerHTML = "";

    const r = imgBox.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;

    taps.forEach((t, i) => {
      const d = document.createElement("div");
      d.className = "tapDot";
      d.style.left = `${t.nx * w}px`;
      d.style.top  = `${t.ny * h}px`;

      // first tap (anchor) = gold
      if (i === 0) d.classList.add("tapDotAnchor");
      dots.appendChild(d);
    });

    setTapCount();
  }

  function setThumb(src) {
    const box = $("thumbBox");
    if (!box) return;
    box.innerHTML = "";

    const im = document.createElement("img");
    im.src = src;
    im.alt = "Selected target thumbnail";
    box.appendChild(im);
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

    // iOS sometimes needs decode() to fully paint
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
      log("ObjectURL failed, fallback to FileReader:", e);
      revokeUrl();
    }

    // Fallback: FileReader dataURL
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(file);
    });

    await loadImgSrc(imgEl, dataUrl);
  }

  function bindTaps() {
    const imgBox = $("imgBox");
    const dots = $("dotsLayer");
    if (!imgBox || !dots) return;

    // Ensure overlay is the ONLY interactive layer
    dots.style.pointerEvents = "auto";
    dots.style.touchAction = "none";

    const handler = (evt) => {
      // No scroll/zoom stealing taps
      if (evt.cancelable) evt.preventDefault();

      // Must have an image loaded
      if (!hasImage) return;

      const pt = (typeof evt.clientX === "number")
        ? { x: evt.clientX, y: evt.clientY }
        : (evt.touches && evt.touches[0])
          ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
          : null;

      if (!pt) return;

      const r = imgBox.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;

      // If somehow tapped outside box, ignore
      if (pt.x < r.left || pt.x > r.right || pt.y < r.top || pt.y > r.bottom) return;

      const nx = clamp01((pt.x - r.left) / r.width);
      const ny = clamp01((pt.y - r.top) / r.height);

      taps.push({ nx, ny });
      renderDots();

      // Enable Start after anchor + at least 1 hit (or just after anchor if you want)
      const startBtn = $("startBtn");
      if (startBtn) startBtn.disabled = taps.length < 2;

      // Instruction text progression
      if (taps.length === 1) setInstruction("Tap your confirmed hits");
      else setInstruction("Keep tapping confirmed hits, then press Start");
    };

    // IMPORTANT: pointerdown only = no double count
    dots.addEventListener("pointerdown", handler, { passive: false });
    dots.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function showImgBox() {
    const imgBox = $("imgBox");
    if (!imgBox) return;
    imgBox.classList.remove("hidden");
  }

  function resetForNewImage(fileNameText) {
    taps = [];
    hasImage = false;

    clearDots();
    setTapCount();

    const startBtn = $("startBtn");
    if (startBtn) startBtn.disabled = true;

    const fileName = $("fileName");
    if (fileName) fileName.textContent = fileNameText || "No file selected.";

    setInstruction("Loading image…");
  }

  function init() {
    const input = $("photoInput");
    const chooseBtn = $("chooseBtn");
    const img = $("targetImg");

    if (!input || !chooseBtn || !img) {
      alert("Missing required IDs. Verify docs/index.html IDs match docs/index.js.");
      return;
    }

    // Always bind tap handler once
    bindTaps();

    // Resize redraw
    window.addEventListener("resize", () => {
      if (hasImage) renderDots();
    });

    chooseBtn.addEventListener("click", () => input.click());

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      resetForNewImage(file.name);
      showImgBox();

      try {
        await loadFileToImg(file, img);

        // Thumb uses the same src that loaded successfully
        setThumb(img.src);

        // Now taps are valid
        hasImage = true;

        // Let layout settle, then redraw dots (none yet) and update instruction
        requestAnimationFrame(() => {
          renderDots();
          setInstruction("Tap bull’s-eye (anchor)");
        });
      } catch (e) {
        log("Load failed:", e);
        alert("Couldn’t load image. Try a different photo.");
        setInstruction("Image load failed");
      } finally {
        // Allow picking same file again on iOS
        input.value = "";
      }
    });

    // Start button (placeholder)
    const startBtn = $("startBtn");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        // For now just confirm it fires. Your next step is wiring the analysis.
        alert(`Start pressed with ${taps.length} taps.`);
      });
    }

    setTapCount();
    setInstruction("Choose a photo to begin");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
