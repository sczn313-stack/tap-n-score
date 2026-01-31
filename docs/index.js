/* ============================================================
   index.js (FULL REPLACEMENT) — TAP-RESET-1
   Restores:
   - Start -> Tap Mode gate
   - Clear / Undo / Results
   - Anchor first tap, then hits
   - Overlay locked to image box
   - Direction: shows OFFSET + SUGGESTED DIAL (opposite)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const log = (...a) => console.log("[TAP-N-SCORE]", ...a);

  // State
  let tapMode = false;
  let points = []; // {nx, ny} normalized to image box
  let objectUrl = null;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setHud(text) {
    const el = $("instructionLine");
    if (el) el.textContent = text;
  }

  function setTapCount() {
    const el = $("tapCount");
    if (!el) return;
    const hits = Math.max(0, points.length - 1);
    el.textContent = `Taps: ${points.length}  (hits: ${hits})`;
  }

  function revokeUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
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

    // ObjectURL first
    try {
      objectUrl = URL.createObjectURL(file);
      await loadImgSrc(imgEl, objectUrl);
      return;
    } catch (e) {
      log("ObjectURL failed, fallback to FileReader", e);
      revokeUrl();
    }

    // FileReader fallback
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(file);
    });

    await loadImgSrc(imgEl, dataUrl);
  }

  function setThumb(src) {
    const thumbBox = $("thumbBox");
    if (!thumbBox) return;
    thumbBox.innerHTML = "";
    const im = document.createElement("img");
    im.src = src;
    im.alt = "Selected target thumbnail";
    thumbBox.appendChild(im);
  }

  function renderDots() {
    const dotsLayer = $("dotsLayer");
    const img = $("targetImg");
    if (!dotsLayer || !img) return;

    dotsLayer.innerHTML = "";

    // Use IMG rect so dots match the real rendered pixels
    const r = img.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;

    points.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "tapDot";

      const isAnchor = i === 0;
      const size = isAnchor ? 18 : 14;

      d.style.width = `${size}px`;
      d.style.height = `${size}px`;
      d.style.left = `${p.nx * w}px`;
      d.style.top = `${p.ny * h}px`;
      d.style.background = isAnchor
        ? "rgba(255,180,0,0.95)"
        : "rgba(0,220,120,0.95)";

      dotsLayer.appendChild(d);
    });

    setTapCount();
  }

  function showTapUI(on) {
    const imgBox = $("imgBox");
    const actionBar = $("actionBar");
    if (imgBox) imgBox.classList.toggle("hidden", !on);
    if (actionBar) actionBar.classList.toggle("hidden", !on);
  }

  function enterTapMode() {
    tapMode = true;
    showTapUI(true);
    setHud(points.length === 0 ? "Tap bull’s-eye (anchor)" : "Now tap each confirmed hit");
  }

  function exitTapMode() {
    tapMode = false;
    showTapUI(false);
    setHud("Press Start to enter tap mode");
  }

  function clearAll() {
    points = [];
    renderDots();
    setHud("Tap bull’s-eye (anchor)");
  }

  function undoOne() {
    points.pop();
    renderDots();
    if (points.length === 0) setHud("Tap bull’s-eye (anchor)");
    else if (points.length === 1) setHud("Now tap each confirmed hit");
    else setHud("Now tap each confirmed hit");
  }

  function pct(n) { return (Math.abs(n) * 100).toFixed(2) + "%"; }

  function computeResults() {
    if (points.length < 2) {
      return "Need at least:\n- 1 anchor tap\n- 1 hit tap";
    }

    const anchor = points[0];
    const hits = points.slice(1);

    const poib = hits.reduce((acc, p) => {
      acc.x += p.nx;
      acc.y += p.ny;
      return acc;
    }, { x: 0, y: 0 });

    poib.x /= hits.length;
    poib.y /= hits.length;

    // Offset of POIB relative to Anchor in IMAGE SPACE:
    // x: right positive, y: down positive (screen coords)
    const dx = poib.x - anchor.nx; // + => POIB right of anchor
    const dy = poib.y - anchor.ny; // + => POIB down of anchor

    const offsetH = dx >= 0 ? `${pct(dx)} RIGHT` : `${pct(dx)} LEFT`;
    const offsetV = dy >= 0 ? `${pct(dy)} DOWN` : `${pct(dy)} UP`;

    // Suggested dial to move POIB back to anchor = OPPOSITE of offset
    const dialH = dx >= 0 ? "LEFT" : "RIGHT";
    const dialV = dy >= 0 ? "UP" : "DOWN";

    const dist = Number($("distanceYds")?.value || 100);
    const click = Number($("clickValue")?.value || 0.25);

    // Informational only (still % until grid calibration exists)
    const moaAtDist = 1.047 * (dist / 100);

    return [
      `Shots: ${hits.length}`,
      ``,
      `POIB offset from Anchor (image-space):`,
      `Horizontal: ${offsetH}`,
      `Vertical:   ${offsetV}`,
      ``,
      `Suggested dial (to move POIB to Anchor):`,
      `Windage:    ${dialH}`,
      `Elevation:  ${dialV}`,
      ``,
      `Distance: ${dist} yd`,
      `Click: ${click} MOA per click`,
      `1 MOA ≈ ${moaAtDist.toFixed(3)}" at this distance`,
      ``,
      `Next step: GRID calibration converts % → inches → clicks.`
    ].join("\n");
  }

  function openModal(text) {
    const modal = $("modal");
    const modalText = $("modalText");
    if (modalText) modalText.textContent = text;
    if (modal) modal.classList.remove("hidden");
  }

  function closeModal() {
    const modal = $("modal");
    if (modal) modal.classList.add("hidden");
  }

  function bindOverlayTaps() {
    const dotsLayer = $("dotsLayer");
    const img = $("targetImg");
    if (!dotsLayer || !img) return;

    dotsLayer.style.pointerEvents = "auto";
    dotsLayer.style.touchAction = "none";

    dotsLayer.addEventListener("pointerdown", (evt) => {
      if (!tapMode) return; // gate: must press Start
      if (evt.cancelable) evt.preventDefault();

      const r = img.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;

      const x = evt.clientX;
      const y = evt.clientY;

      // Normalize to image rect
      const nx = clamp01((x - r.left) / r.width);
      const ny = clamp01((y - r.top) / r.height);

      points.push({ nx, ny });
      renderDots();

      if (points.length === 1) setHud("Now tap each confirmed hit");
      else setHud("Now tap each confirmed hit");
    }, { passive: false });

    dotsLayer.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function init() {
    const input = $("photoInput");
    const chooseBtn = $("chooseBtn");
    const fileName = $("fileName");
    const startBtn = $("startBtn");
    const img = $("targetImg");

    const clearBtn = $("clearBtn");
    const undoBtn = $("undoBtn");
    const resultsBtn = $("resultsBtn");
    const closeModalBtn = $("closeModalBtn");
    const modal = $("modal");

    if (!input || !chooseBtn || !startBtn || !img) {
      alert("Missing required elements. Check IDs.");
      return;
    }

    bindOverlayTaps();

    // Choose Photo button triggers file picker
    chooseBtn.addEventListener("click", () => input.click());

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      if (fileName) fileName.textContent = file.name;

      // Reset state for new photo
      points = [];
      tapMode = false;
      setTapCount();
      renderDots();
      exitTapMode();

      setHud("Loading image…");
      startBtn.disabled = true;

      try {
        await loadFileToImg(file, img);
        setThumb(img.src);

        // Once image is loaded, enable Start
        startBtn.disabled = false;
        setHud("Press Start to enter tap mode");
      } catch (e) {
        log("Image load failed:", e);
        alert("Couldn’t load image. Try a different photo.");
        setHud("Image load failed");
      } finally {
        // iOS: allow picking same file again
        input.value = "";
      }
    });

    startBtn.addEventListener("click", () => {
      // entering tap mode shows image box + bottom action bar
      enterTapMode();

      // scroll image into view immediately
      $("imgBox")?.scrollIntoView({ behavior: "smooth", block: "start" });

      // make sure dots are aligned
      requestAnimationFrame(() => renderDots());
    });

    clearBtn?.addEventListener("click", clearAll);
    undoBtn?.addEventListener("click", undoOne);
    resultsBtn?.addEventListener("click", () => openModal(computeResults()));

    closeModalBtn?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Keep dots aligned on resize/orientation changes
    window.addEventListener("resize", () => renderDots());
    window.addEventListener("orientationchange", () => setTimeout(renderDots, 200));

    // Initial
    setTapCount();
    setHud("Choose a photo to begin");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
