/* ============================================================
   index.js (FULL REPLACEMENT) — POLISH PASS (22206p1)
   Fixes:
   - After selecting photo, it ALWAYS loads (iOS safe)
   - Add Target Picture is the main CTA; swaps to Change photo after load
   - Scroll vs tap on iPhone:
       * touch drag = scroll (ignored)
       * quick tap = registers as bull/shot
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");
  const elStatus = $("statusLine");
  const elHint = $("instructionLine");

  const elAddBtn = $("addPhotoBtn");
  const elChangeBtn = $("changePhotoBtn");

  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");
  const elVendor = $("vendorLink");

  let bull = null;
  let shots = [];

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function setText(el, t){ if (el) el.textContent = t; }

  function setTapCount(){
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function clearAll(){
    bull = null;
    shots = [];
    elDots.innerHTML = "";
    setTapCount();
    setText(elHint, elImg && elImg.src ? "Tap once to set aim point, then tap hits." : "Add a photo to start.");
  }

  function addDot(x01, y01, kind){
    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "bull" ? "tapDotBull" : "tapDotShot");
    d.style.left = `${x01 * 100}%`;
    d.style.top = `${y01 * 100}%`;
    elDots.appendChild(d);
  }

  function getRelative01FromPoint(clientX, clientY){
    const r = elImg.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  // -------- iOS SAFE IMAGE LOAD --------
  function showBigButton(){
    if (elAddBtn) elAddBtn.style.display = "";
    if (elChangeBtn) elChangeBtn.style.display = "none";
  }

  function showSmallButton(){
    if (elAddBtn) elAddBtn.style.display = "none";
    if (elChangeBtn) elChangeBtn.style.display = "";
  }

  function loadImage(file){
    if (!file) return;

    // reset UI + taps
    bull = null;
    shots = [];
    elDots.innerHTML = "";
    setTapCount();

    // hard reset image before setting src
    elImg.src = "";
    elImg.style.display = "none";
    elImg.offsetHeight; // force layout

    const reader = new FileReader();
    reader.onload = () => {
      elImg.onload = () => {
        elImg.style.display = "block";
        showSmallButton();
        setText(elStatus, "Tap to set aim point, then tap hits.");
        setText(elHint, "Tap once to set aim point, then tap hits.");
      };

      elImg.src = reader.result;

      // force repaint (Safari)
      requestAnimationFrame(() => {
        elImg.style.opacity = "0.99";
        requestAnimationFrame(() => (elImg.style.opacity = "1"));
      });

      clearAll();
    };
    reader.readAsDataURL(file);
  }

  // -------- Scroll vs tap handling (touch threshold) --------
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;

  function handleTapAt(clientX, clientY){
    if (!elImg.src) return;

    const { x01, y01 } = getRelative01FromPoint(clientX, clientY);

    if (!bull){
      bull = { x01, y01 };
      addDot(x01, y01, "bull");
      setText(elStatus, "Aim point set. Tap hits.");
      setText(elHint, "Aim point set. Tap hits.");
    } else {
      shots.push({ x01, y01 });
      addDot(x01, y01, "shot");
      setTapCount();
      setText(elStatus, "Tap hits. Then Show results.");
      setText(elHint, "Tap hits. Then Show results.");
    }
  }

  // desktop click
  elImg.addEventListener("click", (ev) => {
    handleTapAt(ev.clientX, ev.clientY);
  }, { passive: true });

  // mobile touch
  elImg.addEventListener("touchstart", (ev) => {
    if (!elImg.src) return;
    const t = ev.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchMoved = false;
  }, { passive: true });

  elImg.addEventListener("touchmove", (ev) => {
    if (!elImg.src) return;
    const t = ev.touches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    if (dx > 8 || dy > 8) touchMoved = true; // drag = scroll
  }, { passive: true });

  elImg.addEventListener("touchend", (ev) => {
    if (!elImg.src) return;
    if (touchMoved) return; // was a scroll, ignore
    const t = ev.changedTouches[0];
    handleTapAt(t.clientX, t.clientY);
  }, { passive: true });

  // -------- Controls --------
  elFile.addEventListener("change", () => {
    const file = elFile.files && elFile.files[0];
    if (!file) return;
    loadImage(file);
  });

  elClear.addEventListener("click", () => {
    clearAll();
    setText(elStatus, elImg.src ? "Cleared. Tap to set aim point." : "Add a photo to begin.");
  });

  elSee.addEventListener("click", () => {
    if (!elImg.src) { alert("Add a photo first."); return; }
    if (!bull || shots.length < 1) { alert("Tap aim point first, then tap at least one hit."); return; }

    // Baseline: we’re only polishing the landing UI right now.
    // Your SEC routing stays as-is in your baseline build.
    alert("✅ Ready: bull + hits captured. (SEC flow continues from here.)");
  });

  // boot
  showBigButton();
  setText(elStatus, "Add a photo to begin.");
  setText(elHint, "Add a photo to start.");
  setTapCount();

  // vendor link stays hidden unless you set href elsewhere
  if (elVendor && elVendor.href && elVendor.href !== "#" ) elVendor.style.display = "";
})();
