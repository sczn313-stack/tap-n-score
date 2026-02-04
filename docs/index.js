/* ============================================================
   index.js (FULL REPLACEMENT) — TUNED MAGIC STICKY “SHOW RESULTS”
   Behavior:
   - Hidden while tapping
   - Appears after a short pause (idle) once bull + 1+ hit exist
   - Copy changes based on state:
       • No photo  -> “Add a photo to begin.”
       • Photo     -> “Tap once to set aim point.”
       • Bull set  -> “Now tap your hits.”
       • Hits      -> “Pause… then Show results.”
   - Disappears on next tap/scroll interaction
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

  const sticky = $("stickyCta");
  const stickyShowBtn = $("stickyShowBtn");
  const stickySub = $("stickySub");

  // (kept for later math/SEC handoff)
  const elDistance = $("distanceYds");
  const elMoaClick = $("moaPerClick");

  let bull = null;
  let shots = [];

  // --- Magic idle timer
  let idleTimer = null;
  const IDLE_MS = 850;          // slightly faster
  const IDLE_MS_AFTER_BULL = 650;

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
  function setText(el, t){ if (el) el.textContent = t; }

  function showSticky(msg){
    if (!sticky) return;
    if (stickySub && msg) stickySub.textContent = msg;
    sticky.classList.remove("stickyHidden");
    sticky.setAttribute("aria-hidden", "false");
  }

  function hideSticky(){
    if (!sticky) return;
    sticky.classList.add("stickyHidden");
    sticky.setAttribute("aria-hidden", "true");
  }

  function hasPhoto(){
    return !!(elImg && elImg.src);
  }

  function setMicrocopy() {
    if (!hasPhoto()) {
      setText(elStatus, "Add a photo to begin.");
      setText(elHint, "Add a photo to start.");
      return;
    }
    if (!bull) {
      setText(elStatus, "Tap once to set aim point.");
      setText(elHint, "Tap once to set aim point.");
      return;
    }
    if (bull && shots.length < 1) {
      setText(elStatus, "Now tap your hits.");
      setText(elHint, "Now tap your hits.");
      return;
    }
    // bull + hits
    setText(elStatus, "Pause… then Show results.");
    setText(elHint, "Pause… then Show results.");
  }

  function scheduleSticky() {
    clearTimeout(idleTimer);
    hideSticky();

    if (!hasPhoto()) return;

    // State-based “magic”
    if (!bull) {
      // no sticky before bull
      return;
    }

    // Bull set but no hits: show a gentle nudge faster
    if (bull && shots.length < 1) {
      idleTimer = setTimeout(() => {
        if (hasPhoto() && bull && shots.length < 1) {
          showSticky("Now tap your hits.");
        }
      }, IDLE_MS_AFTER_BULL);
      return;
    }

    // Bull + hits: show the CTA after a thoughtful pause
    idleTimer = setTimeout(() => {
      if (hasPhoto() && bull && shots.length >= 1) {
        showSticky("Pause… then tap “Show results”.");
      }
    }, IDLE_MS);
  }

  function setTapCount(){
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function showBigButton(){
    if (elAddBtn) elAddBtn.style.display = "";
    if (elChangeBtn) elChangeBtn.style.display = "none";
  }

  function showSmallButton(){
    if (elAddBtn) elAddBtn.style.display = "none";
    if (elChangeBtn) elChangeBtn.style.display = "";
  }

  function resetTapsOnly(){
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    clearTimeout(idleTimer);
    setMicrocopy();
    scheduleSticky();
  }

  function fullReset(){
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    clearTimeout(idleTimer);
    showBigButton();
    setMicrocopy();
  }

  function addDot(x01, y01, kind){
    if (!elDots) return;
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

  // iOS-safe file load (FileReader)
  function loadImage(file){
    if (!file) return;

    // reset taps on new photo
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    clearTimeout(idleTimer);

    // reset image
    elImg.src = "";
    elImg.style.display = "none";
    elImg.offsetHeight; // force layout

    const reader = new FileReader();
    reader.onload = () => {
      elImg.onload = () => {
        elImg.style.display = "block";
        showSmallButton();
        setMicrocopy();
        scheduleSticky();
      };
      elImg.src = reader.result;

      // tiny “force repaint” nudge
      requestAnimationFrame(() => {
        elImg.style.opacity = "0.99";
        requestAnimationFrame(() => (elImg.style.opacity = "1"));
      });
    };
    reader.readAsDataURL(file);
  }

  // Scroll vs tap
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;

  function onAnyInteractionStart(){
    hideSticky();
    clearTimeout(idleTimer);
  }

  function handleTapAt(clientX, clientY){
    if (!hasPhoto()) return;

    onAnyInteractionStart();

    const { x01, y01 } = getRelative01FromPoint(clientX, clientY);

    if (!bull){
      bull = { x01, y01 };
      addDot(x01, y01, "bull");
    } else {
      shots.push({ x01, y01 });
      addDot(x01, y01, "shot");
      setTapCount();
    }

    setMicrocopy();
    scheduleSticky();
  }

  // Desktop click
  elImg.addEventListener("click", (ev) => {
    handleTapAt(ev.clientX, ev.clientY);
  }, { passive: true });

  // Touch
  elImg.addEventListener("touchstart", (ev) => {
    if (!hasPhoto()) return;
    const t = ev.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchMoved = false;
    onAnyInteractionStart();
  }, { passive: true });

  elImg.addEventListener("touchmove", (ev) => {
    if (!hasPhoto()) return;
    const t = ev.touches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    if (dx > 8 || dy > 8) touchMoved = true;
  }, { passive: true });

  elImg.addEventListener("touchend", (ev) => {
    if (!hasPhoto()) return;

    if (touchMoved) {
      // it was scroll; schedule sticky after they stop scrolling
      setMicrocopy();
      scheduleSticky();
      return;
    }

    const t = ev.changedTouches[0];
    handleTapAt(t.clientX, t.clientY);
  }, { passive: true });

  // File
  if (elFile) {
    elFile.addEventListener("change", () => {
      const file = elFile.files && elFile.files[0];
      if (!file) return;
      loadImage(file);
    });
  }

  // Clear
  if (elClear) {
    elClear.addEventListener("click", () => {
      resetTapsOnly();
    });
  }

  // Show results (both buttons do the same thing)
  function onShowResults(){
    if (!hasPhoto()) { alert("Add a photo first."); return; }
    if (!bull) { alert("Tap once to set aim point."); return; }
    if (shots.length < 1) { alert("Now tap your hits."); return; }

    // keep this as-is until SEC handoff is plugged back in
    alert("✅ Ready: aim point + hits captured. (Next: SEC handoff.)");
  }

  if (elSee) elSee.addEventListener("click", onShowResults);
  if (stickyShowBtn) stickyShowBtn.addEventListener("click", onShowResults);

  // Boot
  showBigButton();
  hideSticky();
  setTapCount();
  setMicrocopy();
})();
