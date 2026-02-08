/* ============================================================
   tap-n-score/index.js (FULL REPLACEMENT) — TARGET PAGE POLISH
   Locks:
   - Distance + system must be set BEFORE taps (Start Tapping gate)
   - Top & bottom tips are synchronized (same text + color)
   - MOA/MRAD toggle (default MOA 0.25)
   - US/Metric distance toggle (yd <-> m) (math uses yards internally)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Landing
  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elVendorBox = $("vendorBox");
  const elVendorLabel = $("vendorLabel");

  // Sections
  const elScoreSection = $("scoreSection");
  const elSettingsSection = $("settingsSection");

  // Target area
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");

  // Tips (synced)
  const elTipTop = $("tipTop");
  const elTipBottom = $("tipBottom");

  // Sticky
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Controls
  const elDistDown = $("distDown");
  const elDistUp = $("distUp");
  const elDistDisplay = $("distDisplay");
  const elDistUnit = $("distUnit");
  const elDistanceVal = $("distanceVal");

  const elUnitsToggle = $("unitsToggle");   // US / Metric
  const elSysToggle = $("sysToggle");       // MOA / MRAD
  const elClickValue = $("clickValue");     // per click

  const btnStart = $("startTappingBtn");

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";

  // State
  let objectUrl = null;
  let aim = null;
  let hits = [];

  let lastTouchTapAt = 0;
  let touchStart = null;
  let pauseTimer = null;

  // Settings state
  let unitsMode = "US";        // "US" or "METRIC"
  let sysMode = "MOA";         // "MOA" or "MRAD"
  let settingsConfirmed = false;

  // ------------------------------------------------------------
  // iOS scroll restore kill
  // ------------------------------------------------------------
  try { history.scrollRestoration = "manual"; } catch {}
  function forceTop() { try { window.scrollTo(0, 0); } catch {} }
  function hardHideScoringUI() {
    elScoreSection?.classList.add("scoreHidden");
    elSettingsSection?.classList.add("scoreHidden");
  }
  window.addEventListener("pageshow", () => {
    forceTop();
    hardHideScoringUI();
    hideSticky();
  });
  window.addEventListener("load", () => forceTop());

  // ------------------------------------------------------------
  // Tip helpers (SYNC top + bottom)
  // ------------------------------------------------------------
  function setTip(text, tone /* blue|red|green|gold */) {
    const t = String(text || "");
    const cls = {
      blue: "tipBlue",
      red: "tipRed",
      green: "tipGreen",
      gold: "tipGold",
    }[tone] || "tipBlue";

    [elTipTop, elTipBottom].forEach((el) => {
      if (!el) return;
      el.textContent = t;
      el.classList.remove("tipBlue","tipRed","tipGreen","tipGold");
      el.classList.add(cls);
    });
  }

  // ------------------------------------------------------------
  // Sticky
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // Vendor pill
  // ------------------------------------------------------------
  let vendorRotateTimer = null;
  let vendorRotateOn = false;

  function stopVendorRotate() {
    if (vendorRotateTimer) clearInterval(vendorRotateTimer);
    vendorRotateTimer = null;
    vendorRotateOn = false;
  }
  function startVendorRotate() {
    stopVendorRotate();
    if (!elVendorLabel) return;
    vendorRotateTimer = setInterval(() => {
      vendorRotateOn = !vendorRotateOn;
      elVendorLabel.textContent = vendorRotateOn ? "VENDOR" : "BUY MORE TARGETS LIKE THIS";
    }, 1200);
  }

  function hydrateVendorBox() {
    const v = localStorage.getItem(KEY_VENDOR_URL) || "";
    const ok = typeof v === "string" && v.startsWith("http");

    if (!elVendorBox) return;

    if (ok) {
      elVendorBox.href = v;
      elVendorBox.target = "_blank";
      elVendorBox.rel = "noopener";
      elVendorBox.style.pointerEvents = "auto";
      elVendorBox.style.opacity = "1";
      if (elVendorLabel) elVendorLabel.textContent = "BUY MORE TARGETS LIKE THIS";
      startVendorRotate();
    } else {
      elVendorBox.removeAttribute("href");
      elVendorBox.removeAttribute("target");
      elVendorBox.removeAttribute("rel");
      elVendorBox.style.pointerEvents = "none";
      elVendorBox.style.opacity = ".92";
      if (elVendorLabel) elVendorLabel.textContent = "BUY MORE TARGETS LIKE THIS";
      stopVendorRotate();
    }
  }

  // ------------------------------------------------------------
  // Controls: distance + units + system
  // ------------------------------------------------------------
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function getDistanceNumber() {
    const n = Number(elDistanceVal?.value ?? 100);
    return Number.isFinite(n) ? n : 100;
  }

  // Distance display depends on unitsMode:
  // - US: stored/displayed in yards
  // - METRIC: stored/displayed in meters
  function setDistanceNumber(v) {
    let n = Math.round(Number(v));
    if (!Number.isFinite(n)) n = (unitsMode === "US") ? 100 : 91; // 100 yd ~ 91 m
    n = clamp(n, 5, 1500);

    if (elDistanceVal) elDistanceVal.value = String(n);
    if (elDistDisplay) elDistDisplay.textContent = String(n);
    if (elDistUnit) elDistUnit.textContent = (unitsMode === "US") ? "yd" : "m";
  }

  function distanceToYards() {
    const n = getDistanceNumber();
    if (unitsMode === "US") return n;
    // meters -> yards
    return n * 1.0936133;
  }

  function setUnitsMode(next) {
    unitsMode = next;

    // Convert current value to the other unit so the "real world" distance stays ~same
    const cur = getDistanceNumber();
    if (next === "METRIC") {
      // yards -> meters
      const meters = Math.round(cur / 1.0936133);
      setDistanceNumber(meters);
    } else {
      // meters -> yards
      const yards = Math.round(cur * 1.0936133);
      setDistanceNumber(yards);
    }
  }

  function setSysMode(next) {
    sysMode = next;

    // Replace click value options depending on system
    if (!elClickValue) return;
    elClickValue.innerHTML = "";

    if (sysMode === "MOA") {
      // default 0.25
      const opts = [
        { v: "0.25", t: "0.25" },
        { v: "0.5", t: "0.50" },
        { v: "0.125", t: "0.13" },
      ];
      opts.forEach(o => {
        const op = document.createElement("option");
        op.value = o.v; op.textContent = o.t;
        elClickValue.appendChild(op);
      });
      elClickValue.value = "0.25";
    } else {
      // MRAD defaults: 0.10
      const opts = [
        { v: "0.1", t: "0.10" },
        { v: "0.2", t: "0.20" },
        { v: "0.05", t: "0.05" },
      ];
      opts.forEach(o => {
        const op = document.createElement("option");
        op.value = o.v; op.textContent = o.t;
        elClickValue.appendChild(op);
      });
      elClickValue.value = "0.1";
    }
  }

  // ------------------------------------------------------------
  // Reveal flow
  // ------------------------------------------------------------
  function revealTargetFlow() {
    elSettingsSection?.classList.remove("scoreHidden");
    elScoreSection?.classList.remove("scoreHidden");

    // show settings first (distance before taps)
    try { elSettingsSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  }

  function resetTapsOnly() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    if (elTapCount) elTapCount.textContent = "0";
    hideSticky();

    // Tips depend on settingsConfirmed
    if (!elImg?.src) {
      setTip("Add a target photo to begin.", "blue");
      return;
    }
    if (!settingsConfirmed) {
      setTip("Set distance & click system, then press Start Tapping.", "blue");
      return;
    }
    setTip("Tap Aim Point.", "red");
  }

  // ------------------------------------------------------------
  // Dot draw + coord helpers
  // ------------------------------------------------------------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function addDot(x01, y01, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot";
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    d.style.background = (kind === "aim") ? "#67f3a4" : "#b7ff3c";
    d.style.border = "2px solid rgba(0,0,0,.55)";
    d.style.boxShadow = "0 10px 28px rgba(0,0,0,.55)";
    elDots.appendChild(d);
  }

  function getRelative01(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  // ------------------------------------------------------------
  // Scoring (placeholder, but click math supports MOA + MRAD)
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

    const yards = distanceToYards();
    const perClick = Number(elClickValue?.value ?? (sysMode === "MOA" ? 0.25 : 0.1));

    // MOA: 1 MOA = 1.047" at 100yd
    // MRAD: 1 mil = 3.6" at 100yd
    let clicksX = 0;
    let clicksY = 0;

    if (sysMode === "MOA") {
      const inchesPerMoa = (yards / 100) * 1.047;
      const moaX = inchesX / inchesPerMoa;
      const moaY = inchesY / inchesPerMoa;
      clicksX = moaX / perClick;
      clicksY = moaY / perClick;
    } else {
      const inchesPerMil = (yards / 100) * 3.6;
      const milX = inchesX / inchesPerMil;
      const milY = inchesY / inchesPerMil;
      clicksX = milX / perClick;
      clicksY = milY / perClick;
    }

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      inches: { x: inchesX, y: inchesY, r: rIn },
      score: scoreFromRadiusInches(rIn),
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

    const vendorUrl = localStorage.getItem(KEY_VENDOR_URL) || "";

    const payload = {
      sessionId: "S-" + Date.now(),
      score: out.score,
      shots: hits.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      vendorUrl,
      surveyUrl: "",
      sourceImg: "",
      debug: {
        unitsMode,
        sysMode,
        perClick: Number(Number(elClickValue?.value ?? 0).toFixed(2)),
        distanceDisplay: getDistanceNumber(),
        distanceYds: Number(distanceToYards().toFixed(2)),
        aim,
        avgPoi: out.avgPoi,
        inches: out.inches
      }
    };

    goToSEC(payload);
  }

  // ------------------------------------------------------------
  // Start Tapping gate
  // ------------------------------------------------------------
  function confirmSettingsAndEnableTaps() {
    settingsConfirmed = true;
    hideSticky();
    resetTapsOnly();
    // take them to the image for tapping
    try { elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  }

  // ------------------------------------------------------------
  // Tap acceptance (BLOCKED until settingsConfirmed)
  // ------------------------------------------------------------
  function acceptTap(clientX, clientY) {
    if (!settingsConfirmed) {
      setTip("Set distance & click system, then press Start Tapping.", "blue");
      try { elSettingsSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
      return;
    }

    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setTip("Tap Hits.", "green");
      hideSticky();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    if (elTapCount) elTapCount.textContent = String(hits.length);

    setTip("Tap more hits, or pause — results will appear.", "gold");

    hideSticky();
    scheduleStickyMagic();
  }

  // ------------------------------------------------------------
  // Photo picker
  // ------------------------------------------------------------
  if (elPhotoBtn && elFile) elPhotoBtn.addEventListener("click", () => elFile.click());

  if (elFile) {
    elFile.addEventListener("change", async () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // Reset state
      settingsConfirmed = false;
      aim = null;
      hits = [];
      if (elDots) elDots.innerHTML = "";
      if (elTapCount) elTapCount.textContent = "0";
      hideSticky();

      // Show settings + target
      revealTargetFlow();

      // Tip: settings first
      setTip("Set distance & click system, then press Start Tapping.", "blue");

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => {
        // after photo loads, keep them on settings first
        try { elSettingsSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
      };

      elImg.onerror = () => {
        setTip("Photo failed to load. Try again.", "red");
      };

      elImg.src = objectUrl;

      // allow selecting same file again
      elFile.value = "";
    });
  }

  // ------------------------------------------------------------
  // Touch + click handling (anti double fire)
  // ------------------------------------------------------------
  if (elWrap) {
    elWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });

    elWrap.addEventListener("touchend", (e) => {
      const now = Date.now();
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);

      if (dx > 10 || dy > 10) { touchStart = null; return; } // scroll

      lastTouchTapAt = now;
      acceptTap(t.clientX, t.clientY);
      touchStart = null;
    }, { passive: true });

    elWrap.addEventListener("click", (e) => {
      const now = Date.now();
      if (now - lastTouchTapAt < 800) return;
      acceptTap(e.clientX, e.clientY);
    }, { passive: true });
  }

  // ------------------------------------------------------------
  // Buttons
  // ------------------------------------------------------------
  elClear?.addEventListener("click", () => {
    resetTapsOnly();
  });

  elStickyBtn?.addEventListener("click", onShowResults);

  btnStart?.addEventListener("click", confirmSettingsAndEnableTaps);

  // Distance steps (small footprint)
  elDistUp?.addEventListener("click", () => setDistanceNumber(getDistanceNumber() + (unitsMode === "US" ? 5 : 5)));
  elDistDown?.addEventListener("click", () => setDistanceNumber(getDistanceNumber() - (unitsMode === "US" ? 5 : 5)));

  // Units toggle
  elUnitsToggle?.addEventListener("click", () => {
    const next = (unitsMode === "US") ? "METRIC" : "US";
    elUnitsToggle.textContent = (next === "US") ? "US" : "METRIC";
    setUnitsMode(next);
  });

  // System toggle
  elSysToggle?.addEventListener("click", () => {
    const next = (sysMode === "MOA") ? "MRAD" : "MOA";
    elSysToggle.textContent = next;
    setSysMode(next);
  });

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  hydrateVendorBox();
  hardHideScoringUI();
  forceTop();

  // defaults
  unitsMode = "US";
  sysMode = "MOA";
  elUnitsToggle && (elUnitsToggle.textContent = "US");
  elSysToggle && (elSysToggle.textContent = "MOA");
  setDistanceNumber(100);
  setSysMode("MOA");
  setTip("Add a target photo to begin.", "blue");
  hideSticky();
})();
