/* ============================================================
   tap-n-score/index.js (FULL REPLACEMENT) — LOCKED FLOW
   - Always start on Landing hero
   - Photo => reveals Target page + Settings
   - Aim point then hits (dots always visible)
   - Sticky "Show results" appears after pause
   - Two-decimal clicks in payload
   - One-time cache/SW purge to kill "black screen" stale assets
   - Vendor pill rotates text every 1.2s when vendor URL exists
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements
  const elHero = $("hero");

  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");

  const elVendorBox = $("vendorBox");
  const elVendorLabel = $("vendorLabel");

  const elScoreSection = $("scoreSection");
  const elSettingsSection = $("settingsSection");

  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");

  const elTapCount = $("tapCount");
  const elUndo = $("undoBtn");
  const elClear = $("clearTapsBtn");

  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  const elDistance = $("distanceYds");
  const elDistDisplay = $("distDisplay");
  const elDistUp = $("distUp");
  const elDistDown = $("distDown");
  const elMoaClick = $("moaPerClick");

  const elVendorLink = $("vendorLink");

  // --- Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_ONE_TIME_PURGE = "SCZN3_ONE_TIME_PURGE_0206A";

  // --- State
  let objectUrl = null;

  // points stored as {x01,y01}
  let aim = null;
  let hits = [];

  // touch/click de-dupe
  let lastTouchTapAt = 0;
  let touchStart = null;

  // sticky pause
  let pauseTimer = null;

  // vendor rotation
  let vendorRotateTimer = null;
  let vendorRotateIdx = 0;

  // ------------------------------------------------------------
  // HARD LANDING LOCK: kill iOS scroll restore weirdness
  // ------------------------------------------------------------
  try { history.scrollRestoration = "manual"; } catch {}
  function forceTop() { try { window.scrollTo(0, 0); } catch {} }

  window.addEventListener("pageshow", () => {
    // iOS bfcache restore
    forceTop();
    hideSticky();
    // if no photo loaded, force landing view
    if (!elImg?.src) hardHideScoringUI();
  });

  window.addEventListener("load", () => {
    forceTop();
    if (!elImg?.src) hardHideScoringUI();
  });

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function setText(el, t) { if (el) el.textContent = String(t ?? ""); }

  // ------------------------------------------------------------
  // ONE-TIME PURGE: kill old SW + caches (stale black screen fix)
  // ------------------------------------------------------------
  async function oneTimePurge() {
    try {
      const done = localStorage.getItem(KEY_ONE_TIME_PURGE);
      if (done === "1") return;

      // Unregister service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          try { await r.unregister(); } catch {}
        }
      }

      // Delete caches
      if (window.caches?.keys) {
        const keys = await caches.keys();
        for (const k of keys) {
          try { await caches.delete(k); } catch {}
        }
      }

      localStorage.setItem(KEY_ONE_TIME_PURGE, "1");
    } catch {
      // never block UI
    }
  }

  // ------------------------------------------------------------
  // UI show/hide
  // ------------------------------------------------------------
  function hardHideScoringUI() {
    elScoreSection?.classList.add("scoreHidden");
    elSettingsSection?.classList.add("scoreHidden");
  }

  function revealScoringUI() {
    elScoreSection?.classList.remove("scoreHidden");
    elSettingsSection?.classList.remove("scoreHidden");
    try { elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  }

  // ------------------------------------------------------------
  // Vendor pill + vendor link
  // ------------------------------------------------------------
  function getVendorUrl() {
    const v = localStorage.getItem(KEY_VENDOR_URL) || "";
    return (typeof v === "string" && v.startsWith("http")) ? v : "";
  }

  function setVendorClickable(url) {
    if (!elVendorBox) return;
    if (url) {
      elVendorBox.href = url;
      elVendorBox.target = "_blank";
      elVendorBox.rel = "noopener";
      elVendorBox.style.pointerEvents = "auto";
      elVendorBox.style.opacity = "1";
    } else {
      elVendorBox.removeAttribute("href");
      elVendorBox.removeAttribute("target");
      elVendorBox.removeAttribute("rel");
      elVendorBox.style.pointerEvents = "none";
      elVendorBox.style.opacity = ".92";
    }
  }

  function stopVendorRotate() {
    if (vendorRotateTimer) clearInterval(vendorRotateTimer);
    vendorRotateTimer = null;
  }

  function startVendorRotate(url) {
    stopVendorRotate();

    // always show something
    const a = "BUY MORE TARGETS LIKE THIS";
    const b = "VENDOR";

    // if no vendor, just show buy-more message (no rotate)
    if (!url) {
      if (elVendorLabel) elVendorLabel.textContent = a;
      return;
    }

    // rotate every 1.2s
    vendorRotateIdx = 0;
    vendorRotateTimer = setInterval(() => {
      vendorRotateIdx = (vendorRotateIdx + 1) % 2;
      if (elVendorLabel) elVendorLabel.textContent = vendorRotateIdx === 0 ? a : b;
    }, 1200);

    if (elVendorLabel) elVendorLabel.textContent = a;
  }

  function hydrateVendorUI() {
    const url = getVendorUrl();
    setVendorClickable(url);
    startVendorRotate(url);

    // target-page vendor link (optional)
    if (elVendorLink) {
      if (url) {
        elVendorLink.classList.add("on");
        elVendorLink.href = url;
        elVendorLink.textContent = "Visit vendor";
      } else {
        elVendorLink.classList.remove("on");
        elVendorLink.removeAttribute("href");
        elVendorLink.textContent = "";
      }
    }
  }

  // ------------------------------------------------------------
  // Tap dots + helpers
  // ------------------------------------------------------------
  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
  }

  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function hideSticky() {
    if (!elStickyBar) return;
    elStickyBar.classList.add("stickyHidden");
    elStickyBar.setAttribute("aria-hidden", "true");
  }

  function showSticky() {
    if (!elStickyBar) return;
    elStickyBar.classList.remove("stickyHidden");
    elStickyBar.setAttribute("aria-hidden", "false");
  }

  function scheduleStickyMagic() {
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      if (hits.length >= 1) showSticky();
    }, 650);
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot";
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    d.style.background = (kind === "aim") ? "var(--aim)" : "var(--hit)";
    d.style.border = "2px solid rgba(0,0,0,.55)";
    d.style.boxShadow = "0 10px 28px rgba(0,0,0,.55)";
    elDots.appendChild(d);
  }

  function redrawAllDots() {
    clearDots();
    if (aim) addDot(aim.x01, aim.y01, "aim");
    for (const p of hits) addDot(p.x01, p.y01, "hit");
  }

  function getRelative01(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function setInstructionForState() {
    if (!elInstruction) return;
    if (!elImg?.src) { setText(elInstruction, ""); return; }
    if (!aim) { setText(elInstruction, "Tap Aim Point."); return; }
    if (hits.length < 1) { setText(elInstruction, "Tap Hits."); return; }
    setText(elInstruction, "Tap more hits, or pause — results will appear.");
  }

  function resetAll() {
    aim = null;
    hits = [];
    clearDots();
    setTapCount();
    hideSticky();
    setInstructionForState();
    setText(elStatus, elImg?.src ? "Tap Aim Point." : "Add a target photo to begin.");
  }

  function undoLast() {
    if (!elImg?.src) return;

    if (hits.length > 0) {
      hits.pop();
      redrawAllDots();
      setTapCount();
      hideSticky();
      setInstructionForState();
      return;
    }

    if (aim) {
      aim = null;
      redrawAllDots();
      setTapCount();
      hideSticky();
      setInstructionForState();
      setText(elStatus, "Tap Aim Point.");
    }
  }

  // ------------------------------------------------------------
  // Distance / settings
  // ------------------------------------------------------------
  function getDistance() {
    const n = Number(elDistance?.value ?? 100);
    return Number.isFinite(n) ? n : 100;
  }

  function setDistance(v) {
    let n = Math.round(Number(v));
    if (!Number.isFinite(n)) n = 100;
    n = Math.max(5, Math.min(1000, n));
    if (elDistance) elDistance.value = String(n);
    if (elDistDisplay) elDistDisplay.textContent = String(n);
  }

  // ------------------------------------------------------------
  // Compute score + clicks (simple placeholder math)
  // NOTE: This is not your final ABF/CVC/CECH engine; just stable UX.
  // ------------------------------------------------------------
  const inchesPerFullWidth = 10;

  function scoreFromRadiusInches(rIn) {
    if (rIn <= 0.25) return 100;
    if (rIn <= 0.50) return 95;
    if (rIn <= 1.00) return 90;
    if (rIn <= 1.50) return 85;
    if (rIn <= 2.00) return 80;
    if (rIn <= 2.50) return 75;
    if (rIn <= 3.00) return 70;
    if (rIn <= 3.50) return 65;
    if (rIn <= 4.00) return 60;
    return 50;
  }

  function computeCorrectionAndScore() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    const dx = aim.x01 - avg.x;
    const dy = aim.y01 - avg.y;

    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;
    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    const dist = getDistance();
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);
    const inchesPerMoa = (dist / 100) * 1.047;

    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    const score = scoreFromRadiusInches(rIn);

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      inches: { x: inchesX, y: inchesY, r: rIn },
      score,
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
    };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload)); } catch {}
    const b64 = b64FromObj(payload);
    window.location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function onShowResults() {
    const out = computeCorrectionAndScore();
    if (!out) { alert("Tap Aim Point first, then tap at least one hit."); return; }

    const vendorUrl = getVendorUrl();

    const payload = {
      sessionId: "S-" + Date.now(),
      score: out.score,
      shots: hits.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      vendorUrl,
      debug: {
        aim,
        avgPoi: out.avgPoi,
        distanceYds: getDistance(),
        inches: out.inches,
        moaPerClick: Number(elMoaClick?.value ?? 0.25)
      }
    };

    goToSEC(payload);
  }

  // ------------------------------------------------------------
  // Photo loading
  // ------------------------------------------------------------
  function onPickPhotoClick() {
    if (elFile) elFile.click();
  }

  async function loadPhoto(file) {
    resetAll();

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    elImg.onload = () => {
      setText(elStatus, "Tap Aim Point.");
      setInstructionForState();
      revealScoringUI();
    };

    elImg.onerror = () => {
      setText(elStatus, "Photo failed to load.");
      setText(elInstruction, "Try again.");
      revealScoringUI();
    };

    elImg.src = objectUrl;

    // Clear file input for iOS repeat selects
    if (elFile) elFile.value = "";
  }

  // ------------------------------------------------------------
  // Tap handling (touch + click, de-duped)
  // ------------------------------------------------------------
  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setText(elStatus, "Tap Hits.");
      setInstructionForState();
      hideSticky();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();
    setInstructionForState();

    hideSticky();
    scheduleStickyMagic();
  }

  function bindTaps() {
    if (!elWrap) return;

    elWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    elWrap.addEventListener("touchend", (e) => {
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);
      touchStart = null;

      // treat drags as scroll/zoom
      if (dx > 10 || dy > 10) return;

      lastTouchTapAt = Date.now();
      acceptTap(t.clientX, t.clientY);
    }, { passive: true });

    elWrap.addEventListener("click", (e) => {
      // ignore ghost click right after touch
      if (Date.now() - lastTouchTapAt < 800) return;
      acceptTap(e.clientX, e.clientY);
    }, { passive: true });
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  async function boot() {
    // Safety: if core hero is missing, do nothing (prevents blanking)
    if (!elHero || !elPhotoBtn || !elFile) {
      console.warn("Landing DOM missing. Aborting boot.");
      return;
    }

    // kill stale SW/caches once
    await oneTimePurge();

    // Always start on landing view unless photo exists right now
    if (!elImg?.src) hardHideScoringUI();

    // Vendor UI
    hydrateVendorUI();

    // Buttons
    elPhotoBtn.addEventListener("click", onPickPhotoClick);

    elFile.addEventListener("change", async () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;
      await loadPhoto(f);
    });

    elUndo?.addEventListener("click", undoLast);
    elClear?.addEventListener("click", () => {
      resetAll();
      if (elImg?.src) setText(elStatus, "Tap Aim Point.");
    });

    elStickyBtn?.addEventListener("click", onShowResults);

    elDistUp?.addEventListener("click", () => setDistance(getDistance() + 5));
    elDistDown?.addEventListener("click", () => setDistance(getDistance() - 5));

    setDistance(100);
    hideSticky();
    resetAll();
    bindTaps();

    // force top after boot paint
    try { forceTop(); } catch {}
  }

  boot();
})();
