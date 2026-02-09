/* ============================================================
   tap-n-score/index.js (FULL REPLACEMENT) — TOP = 2 LINES DATA
   - Top shows ONLY: "100 yds" and "0.25 MOA" (or "91 m")
   - ALL adjustments live inside MATRIX drawer
   - Adds (s) to yds
   - Removes on-target instruction pills
   - 3+ taps on ANY button => history.back()
   - Distance unit toggle: UI YD/M (internal storage stays in YARDS)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Landing / hero
  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elVendorBox = $("vendorBox");
  const elVendorLabel = $("vendorLabel");

  // Scoring UI
  const elScoreSection = $("scoreSection");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Sticky
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Top display lines
  const elTopDistance = $("topDistanceLine");
  const elTopDial = $("topDialLine");

  // Matrix controls (still same IDs)
  const elDist = $("distanceYds");
  const elDistUp = $("distUp");
  const elDistDown = $("distDown");
  const elDistUnitLabel = $("distUnitLabel");

  const elDistUnitYd = $("distUnitYd");
  const elDistUnitM = $("distUnitM");

  const elUnitMoa = $("unitMoa");
  const elUnitMrad = $("unitMrad");

  const elClickValue = $("clickValue");
  const elClickUnitLabel = $("clickUnitLabel");

  // Matrix drawer
  const elMatrixBtn = $("matrixBtn");
  const elMatrixPanel = $("matrixPanel");
  const elMatrixClose = $("matrixCloseBtn");

  // Storage keys (kept)
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_DIST_UNIT = "SCZN3_RANGE_UNIT_V1"; // "YDS" | "M"
  const KEY_DIST_YDS = "SCZN3_RANGE_YDS_V1";   // numeric (yards)

  let objectUrl = null;

  // taps
  let aim = null;
  let hits = [];

  // touch anti-double-fire
  let lastTouchTapAt = 0;
  let touchStart = null;
  let pauseTimer = null;

  // vendor rotate
  let vendorRotateTimer = null;
  let vendorRotateOn = false;

  // unit state (default locked)
  let dialUnit = "MOA"; // "MOA" | "MRAD"

  // distance display unit (internal is yards)
  let rangeUnit = "YDS"; // "YDS" | "M"
  let rangeYds = 100;    // internal yards

  const DEFAULTS = {
    MOA: 0.25,
    MRAD: 0.10
  };

  // ------------------------------------------------------------
  // HARD LANDING LOCK (iOS scroll restore)
  // ------------------------------------------------------------
  try { history.scrollRestoration = "manual"; } catch {}
  function forceTop() { try { window.scrollTo(0, 0); } catch {} }
  function hardHideScoringUI() {
    if (elScoreSection) elScoreSection.classList.add("scoreHidden");
  }
  window.addEventListener("pageshow", () => {
    forceTop();
    hardHideScoringUI();
    hideSticky();
    closeMatrix();
  });
  window.addEventListener("load", () => forceTop());

  // ------------------------------------------------------------
  // GLOBAL: 3+ taps on ANY button => history.back()
  // ------------------------------------------------------------
  const tripleTap = new WeakMap(); // button -> {t, n}
  function registerButtonTap(btn) {
    const now = Date.now();
    const s = tripleTap.get(btn) || { t: 0, n: 0 };

    if (now - s.t <= 750) s.n += 1;
    else s.n = 1;

    s.t = now;
    tripleTap.set(btn, s);

    if (s.n >= 3) {
      try { window.history.back(); } catch {}
      s.n = 0;
      tripleTap.set(btn, s);
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (b) registerButtonTap(b);
  }, { capture: true });

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function setText(el, t) { if (el) el.textContent = String(t ?? ""); }

  function revealScoringUI() {
    if (elScoreSection) elScoreSection.classList.remove("scoreHidden");
    try { elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
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

  // ------------------------------------------------------------
  // Instructions (no on-image pills)
  // ------------------------------------------------------------
  function syncInstruction() {
    if (!elImg?.src) {
      setText(elInstruction, "");
      return;
    }

    if (!aim) {
      setText(elInstruction, "Tap Aim Point.");
      return;
    }

    if (hits.length < 1) {
      setText(elInstruction, "Tap Hits.");
      return;
    }

    setText(elInstruction, "Tap more hits, or pause — results will appear.");
  }

  function resetAll() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    syncInstruction();
    setText(elStatus, elImg?.src ? "Tap Aim Point." : "Add a target photo to begin.");
    closeMatrix();
  }

  // ------------------------------------------------------------
  // Vendor pill rotation
  // ------------------------------------------------------------
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
  // Target photo storage (kept)
  // ------------------------------------------------------------
  async function storeTargetPhotoForSEC(file, blobUrl) {
    try { localStorage.setItem(KEY_TARGET_IMG_BLOB, blobUrl); } catch {}
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      if (dataUrl && dataUrl.startsWith("data:image/")) {
        localStorage.setItem(KEY_TARGET_IMG_DATA, dataUrl);
      }
    } catch {}
  }

  // ------------------------------------------------------------
  // Dot draw
  // ------------------------------------------------------------
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
  // Range: internal yards, display YD or M
  // ------------------------------------------------------------
  function ydsToM(yds) { return yds * 0.9144; }
  function mToYds(m) { return m / 0.9144; }

  function clampRangeYds(v) {
    let n = Number(v);
    if (!Number.isFinite(n)) n = 100;
    n = Math.round(n);
    n = Math.max(1, Math.min(5000, n));
    return n;
  }

  function syncTopDataLines() {
    // distance line
    if (elTopDistance) {
      if (rangeUnit === "M") {
        const m = Math.round(ydsToM(rangeYds)); // you requested: 91 m (rounded)
        elTopDistance.textContent = `${m} m`;
      } else {
        elTopDistance.textContent = `${rangeYds} yds`; // you requested: add (s)
      }
    }

    // dial line
    if (elTopDial) {
      const cv = getClickValue();
      elTopDial.textContent = `${cv.toFixed(2)} ${dialUnit}`;
    }
  }

  function setRangeUnit(u) {
    rangeUnit = (u === "M") ? "M" : "YDS";
    try { localStorage.setItem(KEY_DIST_UNIT, rangeUnit); } catch {}

    // UI toggle (chips)
    elDistUnitYd?.classList.toggle("chipOn", rangeUnit === "YDS");
    elDistUnitM?.classList.toggle("chipOn", rangeUnit === "M");

    // unit label (in drawer)
    if (elDistUnitLabel) elDistUnitLabel.textContent = (rangeUnit === "M") ? "m" : "yds";

    // refresh input display
    syncRangeInputFromInternal();
    syncTopDataLines();
  }

  function syncRangeInputFromInternal() {
    if (!elDist) return;
    if (rangeUnit === "M") {
      const m = Math.round(ydsToM(rangeYds));
      elDist.value = String(m);
    } else {
      elDist.value = String(rangeYds);
    }
  }

  function syncInternalFromRangeInput() {
    if (!elDist) return;
    let n = Number(elDist.value);
    if (!Number.isFinite(n)) n = (rangeUnit === "M") ? Math.round(ydsToM(rangeYds)) : rangeYds;

    if (rangeUnit === "M") {
      rangeYds = clampRangeYds(mToYds(n));
    } else {
      rangeYds = clampRangeYds(n);
    }

    try { localStorage.setItem(KEY_DIST_YDS, String(rangeYds)); } catch {}
    syncRangeInputFromInternal();
    syncTopDataLines();
  }

  function bumpRange(stepYds) {
    rangeYds = clampRangeYds(rangeYds + stepYds);
    try { localStorage.setItem(KEY_DIST_YDS, String(rangeYds)); } catch {}
    syncRangeInputFromInternal();
    syncTopDataLines();
  }

  function getDistanceYds() {
    return clampRangeYds(rangeYds);
  }

  function hydrateRange() {
    const savedYds = Number(localStorage.getItem(KEY_DIST_YDS) || "100");
    rangeYds = clampRangeYds(savedYds);

    const savedUnit = localStorage.getItem(KEY_DIST_UNIT) || "YDS";
    setRangeUnit(savedUnit === "M" ? "M" : "YDS");
  }

  // ------------------------------------------------------------
  // Dial unit + click value
  // ------------------------------------------------------------
  function setUnit(newUnit) {
    dialUnit = newUnit === "MRAD" ? "MRAD" : "MOA";

    // segment UI (chips)
    elUnitMoa?.classList.toggle("chipOn", dialUnit === "MOA");
    elUnitMrad?.classList.toggle("chipOn", dialUnit === "MRAD");

    // ALWAYS snap to common default
    const def = DEFAULTS[dialUnit];
    if (elClickValue) elClickValue.value = String(def.toFixed(2));

    // drawer label
    if (elClickUnitLabel) {
      elClickUnitLabel.textContent = dialUnit === "MOA" ? "MOA/click" : "MRAD/click";
    }

    syncTopDataLines();
  }

  function getClickValue() {
    let n = Number(elClickValue?.value);
    if (!Number.isFinite(n) || n <= 0) {
      n = DEFAULTS[dialUnit];
      if (elClickValue) elClickValue.value = String(n.toFixed(2));
    }
    n = Math.max(0.01, Math.min(5, n));
    return n;
  }

  // ------------------------------------------------------------
  // Matrix (drawer)
  // ------------------------------------------------------------
  function openMatrix() {
    if (!elMatrixPanel) return;
    elMatrixPanel.classList.remove("matrixHidden");
    elMatrixPanel.setAttribute("aria-hidden", "false");
  }

  function closeMatrix() {
    if (!elMatrixPanel) return;
    elMatrixPanel.classList.add("matrixHidden");
    elMatrixPanel.setAttribute("aria-hidden", "true");
  }

  function isMatrixOpen() {
    return !!elMatrixPanel && !elMatrixPanel.classList.contains("matrixHidden");
  }

  function toggleMatrix() {
    if (isMatrixOpen()) closeMatrix();
    else openMatrix();
  }

  function applyPreset(unit, clickVal) {
    setUnit(unit);
    if (elClickValue) elClickValue.value = Number(clickVal).toFixed(2);
    getClickValue();
    syncTopDataLines();
    closeMatrix();
  }

  function wireMatrixPresets() {
    if (!elMatrixPanel) return;
    const items = Array.from(elMatrixPanel.querySelectorAll("[data-unit][data-click]"));
    items.forEach((btn) => {
      btn.addEventListener("click", () => {
        const u = btn.getAttribute("data-unit") || "MOA";
        const c = Number(btn.getAttribute("data-click") || "0.25");
        applyPreset(u, c);
      });
    });
  }

  // close on escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMatrix();
  });

  // close when tapping outside panel
  document.addEventListener("click", (e) => {
    if (!isMatrixOpen()) return;
    if (!elMatrixPanel) return;
    const inside = e.target && elMatrixPanel.contains(e.target);
    const isBtn = e.target && elMatrixBtn && (e.target === elMatrixBtn || e.target.closest?.("#matrixBtn"));
    if (!inside && !isBtn) closeMatrix();
  }, { capture: true });

  // ------------------------------------------------------------
  // Scoring placeholder (kept)
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

    const dist = getDistanceYds();

    // MOA inches per unit: (dist/100)*1.047
    // MRAD inches per unit: (dist/100)*3.6 (approx)
    const inchesPerUnit = (dialUnit === "MOA")
      ? (dist / 100) * 1.047
      : (dist / 100) * 3.6;

    const unitX = inchesX / inchesPerUnit;
    const unitY = inchesY / inchesPerUnit;

    const clickVal = getClickValue();
    const clicksX = unitX / clickVal;
    const clicksY = unitY / clickVal;

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      inches: { x: inchesX, y: inchesY, r: rIn },
      score: scoreFromRadiusInches(rIn),
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
      dial: { unit: dialUnit, clickValue: clickVal }
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
      dial: { unit: out.dial.unit, clickValue: Number(out.dial.clickValue.toFixed(2)) },
      vendorUrl,
      surveyUrl: "",
      sourceImg: "", // thumbnail stays nuked (never used)
      debug: { aim, avgPoi: out.avgPoi, distanceYds: getDistanceYds(), inches: out.inches }
    };

    goToSEC(payload);
  }

  // ------------------------------------------------------------
  // Photo picker
  // ------------------------------------------------------------
  if (elPhotoBtn && elFile) {
    elPhotoBtn.addEventListener("click", () => elFile.click());
  }

  if (elFile) {
    elFile.addEventListener("change", async () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      resetAll();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      await storeTargetPhotoForSEC(f, objectUrl);

      elImg.onload = () => {
        setText(elStatus, "Tap Aim Point.");
        syncInstruction();
        revealScoringUI();
      };

      elImg.onerror = () => {
        setText(elStatus, "Photo failed to load.");
        setText(elInstruction, "Try again.");
        revealScoringUI();
      };

      elImg.src = objectUrl;
      elFile.value = "";
    });
  }

  // ------------------------------------------------------------
  // Tap logic
  // ------------------------------------------------------------
  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setText(elStatus, "Tap Hits.");
      hideSticky();
      syncInstruction();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();

    hideSticky();
    syncInstruction();
    scheduleStickyMagic();
  }

  if (elWrap) {
    elWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });

    elWrap.addEventListener("touchend", (e) => {
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);

      if (dx > 10 || dy > 10) { touchStart = null; return; } // scroll => ignore

      lastTouchTapAt = Date.now();
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
    resetAll();
    if (elImg?.src) setText(elStatus, "Tap Aim Point.");
  });

  elStickyBtn?.addEventListener("click", onShowResults);

  // range +/- always bumps internal yards (stable math)
  elDistUp?.addEventListener("click", () => bumpRange(5));
  elDistDown?.addEventListener("click", () => bumpRange(-5));

  // manual input: always convert/clamp on blur/change
  elDist?.addEventListener("change", () => syncInternalFromRangeInput());
  elDist?.addEventListener("blur", () => syncInternalFromRangeInput());

  // YD/M toggle
  elDistUnitYd?.addEventListener("click", () => setRangeUnit("YD"));
  elDistUnitM?.addEventListener("click", () => setRangeUnit("M"));

  // dial unit
  elUnitMoa?.addEventListener("click", () => setUnit("MOA"));
  elUnitMrad?.addEventListener("click", () => setUnit("MRAD"));

  // click value: clamp lightly on blur/change
  elClickValue?.addEventListener("blur", () => { getClickValue(); syncTopDataLines(); });
  elClickValue?.addEventListener("change", () => { getClickValue(); syncTopDataLines(); });

  // Matrix buttons
  elMatrixBtn?.addEventListener("click", toggleMatrix);
  elMatrixClose?.addEventListener("click", closeMatrix);

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  setUnit("MOA");          // snaps click value to 0.25
  closeMatrix();
  hideSticky();
  resetAll();
  hydrateVendorBox();

  hydrateRange();          // pulls saved yards + unit and updates UI
  wireMatrixPresets();
  hardHideScoringUI();
  forceTop();

  // ensure top data shows immediately
  syncTopDataLines();
})();
