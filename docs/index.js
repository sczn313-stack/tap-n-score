/* ============================================================
   index.js (FULL REPLACEMENT) — BASELINE 22206 (iOS SAFE)
   Fixes:
   - Image always loads on iPhone after selection
   - Uses FileReader fallback
   - Forces repaint so Safari cannot skip render
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");

  let bull = null;
  let shots = [];

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = shots.length;
  }

  function clearAll() {
    bull = null;
    shots = [];
    elDots.innerHTML = "";
    setTapCount();
  }

  function addDot(x01, y01, kind) {
    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = `${x01 * 100}%`;
    d.style.top = `${y01 * 100}%`;
    elDots.appendChild(d);
  }

  function getRelative01(ev) {
    const r = elImg.getBoundingClientRect();
    return {
      x01: clamp01((ev.clientX - r.left) / r.width),
      y01: clamp01((ev.clientY - r.top) / r.height),
    };
  }

  // -------- IMAGE LOAD (iOS SAFE) --------
  function loadImage(file) {
    if (!file) return;

    clearAll();

    // Hard reset image first
    elImg.src = "";
    elImg.style.display = "none";

    // Force layout flush (Safari needs this)
    elImg.offsetHeight;

    const reader = new FileReader();

    reader.onload = () => {
      elImg.onload = () => {
        elImg.style.display = "block";
      };

      elImg.src = reader.result;

      // Double-force repaint (yes, really)
      requestAnimationFrame(() => {
        elImg.style.opacity = "0.99";
        requestAnimationFrame(() => {
          elImg.style.opacity = "1";
        });
      });
    };

    reader.readAsDataURL(file);
  }

  // -------- EVENTS --------
  elFile.addEventListener("change", () => {
    const file = elFile.files && elFile.files[0];
    if (!file) return;
    loadImage(file);
  });

  elImg.addEventListener(
    "click",
    (ev) => {
      if (!elImg.src) return;

      const { x01, y01 } = getRelative01(ev);

      if (!bull) {
        bull = { x01, y01 };
        addDot(x01, y01, "bull");
      } else {
        shots.push({ x01, y01 });
        addDot(x01, y01, "shot");
        setTapCount();
      }
    },
    { passive: true }
  );

  elClear.addEventListener("click", clearAll);

  elSee.addEventListener("click", () => {
    if (!bull || shots.length === 0) {
      alert("Add a photo, tap the aim point, then tap shots.");
      return;
    }
    alert("Results flow is wired — UI test complete.");
  });

  clearAll();
})();
