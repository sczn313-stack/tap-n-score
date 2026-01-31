/* ============================================================
   docs/index.js (FULL REPLACEMENT) — UI-TOOLS-1
   Adds:
   - Undo (remove last tap)
   - Clear (remove all taps)
   - Results (placeholder alert for now)
   - Enables/disables buttons correctly
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);
  const log = (...a) => console.log("[TAP-N-SCORE]", ...a);

  let taps = [];
  let objectUrl = null;
  let hasImage = false;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

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

  function setButtons() {
    const undoBtn = $("undoBtn");
    const clearBtn = $("clearBtn");
    const resultsBtn = $("resultsBtn");

    const canEdit = hasImage && taps.length > 0;
    const canResults = hasImage && taps.length >= 2; // anchor + at least 1 hit

    if (undoBtn) undoBtn.disabled = !canEdit;
    if (clearBtn) clearBtn.disabled = !canEdit;
    if (resultsBtn) resultsBtn.disabled = !canResults;
  }

  function renderDots() {
    const imgBox = $("imgBox");
    const dots = $("dotsLayer");
    if (!imgBox || !dots) return;

    dots.innerHTML = "";
    const r = imgBox.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;

    taps.forEach((t, i) => {
      const d = document.createElement("div");
      d.className = "tapDot" + (i === 0 ? " tapDotAnchor" : "");
      d.style.left = `${t.nx * w}px`;
      d.style.top  = `${t.ny * h}px`;
      dots.appendChild(d);
    });

    setTapCount();
    setButtons();
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

    if (imgEl.decode) {
      try { await imgEl.decode(); } catch (_) {}
    }
  }

  async function loadFileToImg(file, imgEl) {
    revokeUrl();

    try {
      objectUrl = URL.createObjectURL(file);
      await loadImgSrc(imgEl, objectUrl);
      return;
    } catch (e) {
      log("ObjectURL failed, fallback to FileReader:", e);
      revokeUrl();
    }

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

    dots.style.pointerEvents = "auto";
    dots.style.touchAction = "none";

    const handler = (evt) => {
      if (evt.cancelable) evt.preventDefault();
      if (!hasImage) return;

      const pt = (typeof evt.clientX === "number")
        ? { x: evt.clientX, y: evt.clientY }
        : (evt.touches && evt.touches[0])
          ? { x: evt.touches[0].clientX, y: evt.touches[0].clientY }
          : null;

      if (!pt) return;

      const r = imgBox.getBoundingClientRect();
      if (pt.x < r.left || pt.x > r.right || pt.y < r.top || pt.y > r.bottom) return;

      const nx = clamp01((pt.x - r.left) / r.width);
      const ny = clamp01((pt.y - r.top) / r.height);

      taps.push({ nx, ny });
      renderDots();

      if (taps.length === 1) setInstruction("Tap your confirmed hits");
      else setInstruction("Tap more hits or press Results");
    };

    dots.addEventListener("pointerdown", handler, { passive: false });
    dots.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function showImgBox() {
    const imgBox = $("imgBox");
    if (imgBox) imgBox.classList.remove("hidden");
  }

  function resetForNewImage(fileNameText) {
    taps = [];
    hasImage = false;

    const fileName = $("fileName");
    if (fileName) fileName.textContent = fileNameText || "No file selected.";

    const thumbBox = $("thumbBox");
    if (thumbBox) thumbBox.innerHTML = `<div class="thumbEmpty">No photo selected yet.</div>`;

    const dots = $("dotsLayer");
    if (dots) dots.innerHTML = "";

    setTapCount();
    setButtons();
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

    bindTaps();
    window.addEventListener("resize", () => { if (hasImage) renderDots(); });

    chooseBtn.addEventListener("click", () => input.click());

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      resetForNewImage(file.name);
      showImgBox();

      try {
        await loadFileToImg(file, img);
        setThumb(img.src);

        hasImage = true;
        requestAnimationFrame(() => {
          renderDots();
          setInstruction("Tap bull’s-eye (anchor)");
        });
      } catch (e) {
        log("Load failed:", e);
        alert("Couldn’t load image. Try a different photo.");
        setInstruction("Image load failed");
      } finally {
        input.value = "";
      }
    });

    // Tools
    const undoBtn = $("undoBtn");
    const clearBtn = $("clearBtn");
    const resultsBtn = $("resultsBtn");

    if (undoBtn) {
      undoBtn.addEventListener("click", () => {
        if (!hasImage || taps.length === 0) return;
        taps.pop();
        renderDots();
        setInstruction(taps.length === 0 ? "Tap bull’s-eye (anchor)" : "Tap your confirmed hits");
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (!hasImage) return;
        taps = [];
        renderDots();
        setInstruction("Tap bull’s-eye (anchor)");
      });
    }

    if (resultsBtn) {
      resultsBtn.addEventListener("click", () => {
        if (!hasImage || taps.length < 2) return;

        // Placeholder until we wire backend math
        alert(`Results:\nAnchor + Hits recorded\nTotal taps: ${taps.length}`);
      });
    }

    setTapCount();
    setButtons();
    setInstruction("Choose a photo to begin");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
