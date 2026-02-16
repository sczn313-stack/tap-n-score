/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   - MATRIX + SQUARE PLANE
   - Pilot counters (localStorage) for Baker pilot analytics
   - No on-target polish prompts (instruction line only)
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

  // LIVE top
  const elLiveDistance = $("liveDistance");
  const elLiveDial = $("liveDial");
  const elLiveTarget = $("liveTarget");

  // Matrix
  const elMatrixBtn = $("matrixBtn");
  const elMatrixPanel = $("matrixPanel");
  const elMatrixClose = $("matrixCloseBtn");

  // Distance controls
  const elDist = $("distanceYds");
  const elDistUp = $("distUp");
  const elDistDown = $("distDown");
  const elDistUnitLabel = $("distUnitLabel");
  const elDistUnitYd = $("distUnitYd");
  const elDistUnitM = $("distUnitM");

  // Dial controls
  const elUnitMoa = $("unitMoa");
  const elUnitMrad = $("unitMrad");
  const elClickValue = $("clickValue");
  const elClickUnitLabel = $("clickUnitLabel");

  // Target size chip row
  const elSizeChipRow = $("sizeChipRow");
  const elSwapSizeBtn = $("swapSizeBtn"); // optional (exists in your newer html)

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_DIST_UNIT = "SCZN3_RANGE_UNIT_V1"; // "YDS" | "M"
  const KEY_DIST_YDS = "SCZN3_RANGE_YDS_V1";   // numeric (yards)

  // Target size persistence
  const KEY_TARGET_SIZE = "SCZN3_TARGET_SIZE_KEY_V1"; // e.g., "23x35"
  const KEY_TARGET_W = "SCZN3_TARGET_W_IN_V1";
  const KEY_TARGET_H = "SCZN3_TARGET_H_IN_V1";

  // Pilot stats (local-only, no backend)
  const KEY_PILOT = "SCZN3_PILOT_STATS_V1"; // { total:{}, days:{YYYY-MM-DD:{}} }

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

  // dial unit
  let dialUnit = "MOA"; // "MOA" | "MRAD"

  // distance state
  let rangeUnit = "YDS"; // "YDS" | "M"
  let rangeYds = 100;    // internal yards

  // target size (inches)
  let targetSizeKey = "23x35";
  let targetWIn = 23;
  let targetHIn = 35;

  // pilot: session guard so we only count "session_start" once per photo
  let sessionStarted = false;

  const DEFAULTS = { MOA: 0.25, MRAD: 0.10 };

  // ------------------------------------------------------------
  // Pilot counters (localStorage)
  // ------------------------------------------------------------
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function safeJSON(s) {
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function readPilot() {
    const box = safeJSON(localStorage.getItem(KEY_PILOT));
    if (box && typeof box === "object") return box;
    return { total: {}, days: {} };
  }

  function writePilot(box) {
    try { localStorage.setItem(KEY_PILOT, JSON.stringify(box)); } catch {}
  }

  function incPilot(name, by = 1) {
    const key = String(name || "").trim();
    if (!key) return;

    const n = Number(by);
    const add = Number.isFinite(n) ? n : 1;

    const box = readPilot();
    const day = todayKey();

    box.total = box.total && typeof box.total === "object" ? box.total : {};
    box.days = box.days && typeof box.days === "object" ? box.days : {};
    box.days[day] = box.days[day] && typeof box.days[day] === "object" ? box.days[day] : {};

    box.total[key] = (Number(box.total[key]) || 0) + add;
    box.days[day][key] = (Number(box.days[day][key]) || 0) + add;

    writePilot(box);
  }

  // ------------------------------------------------------------
  // HARD LANDING LOCK
  // ------------------------------------------------------------
  try { history.scrollRestoration = "manual"; } catch {}
  function forceTop() { try { window.scrollTo(0, 0); } catch {} }
  function hardHideScoringUI() { elScoreSection?.classList.add("scoreHidden"); }

  window.addEventListener("pageshow", () => {
    forceTop();
    hardHideScoringUI();
    hideSticky();
    closeMatrix();
  });
  window.addEventListener("load", () => forceTop());

  // Count page open
  incPilot("open", 1);

  // ------------------------------------------------------------
  // GLOBAL: 3+ taps on ANY button => history.back()
  // ------------------------------------------------------------
  const tripleTap = new WeakMap();
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
    const b = e.target?.closest?.("button");
    if (b) registerButtonTap(b);
  }, { capture: true });

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function setText(el, t) { if (el) el.textContent = String(t ?? ""); }

  function revealScoringUI() {
    elScoreSection?.classList.remove("scoreHidden");
    try { elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  }

  function setTapCount() { if (elTapCount) elTapCount.textContent = String(hits.length); }

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

  // Instruction line state coloring
  function setInstruction(text, kind) {
    if (!elInstruction) return;
    elInstruction.textContent = text || "";

    // default soft
    elInstruction.style.color = "rgba(238,242,247,.70)";
    // aim green
    if (kind === "aim")  elInstruction.style.color = "rgba(103,243,164,.95)";
    // holes yellow-green
    if (kind === "holes") elInstruction.style.color = "rgba(183,255,60,.95)";
    // go blue
    if (kind === "go")   elInstruction.style.color = "rgba(47,102,255,.92)";
  }

  function syncInstruction() {
    if (!elImg?.src) {
      setInstruction("", "");
      return;
    }
    if (!aim) {
      setInstruction("Tap Aim Point.", "aim");
      return;
    }
    setInstruction("Tap Bullet Holes.", "holes");
  }

  function resetAll() {
    aim = null;
    hits = [];
    touchStart = null;
    sessionStarted = false;

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
  // Target photo storage
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
  // Dots
  // ------------------------------------------------------------
  function addDot(x01, y01, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "aim" ? "tapDotAim" : "tapDotHit");
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
  // Range: internal yards, display YDS or M
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

  function getDistanceYds() { return clampRangeYds(rangeYds); }

  function setRangeUnit(u) {
    rangeUnit = (u === "M") ? "M" : "YDS";
    try { localStorage.setItem(KEY_DIST_UNIT, rangeUnit); } catch {}

    elDistUnitYd?.classList.toggle("segOn", rangeUnit === "YDS");
    elDistUnitM?.classList.toggle("segOn", rangeUnit === "M");

    if (elDistUnitLabel) elDistUnitLabel.textContent = (rangeUnit === "M") ? "m" : "yds";

    syncRangeInputFromInternal();
    syncLiveTop();
  }

  function syncRangeInputFromInternal() {
    if (!elDist) return;
    if (rangeUnit === "M") elDist.value = String(Math.round(ydsToM(rangeYds)));
    else elDist.value = String(rangeYds);
  }

  function syncInternalFromRangeInput() {
    if (!elDist) return;
    let n = Number(elDist.value);
    if (!Number.isFinite(n)) n = (rangeUnit === "M") ? Math.round(ydsToM(rangeYds)) : rangeYds;

    rangeYds = (rangeUnit === "M") ? clampRangeYds(mToYds(n)) : clampRangeYds(n);

    try { localStorage.setItem(KEY_DIST_YDS, String(rangeYds)); } catch {}
    syncRangeInputFromInternal();
    syncLiveTop();
  }

  function bumpRange(stepYds) {
    rangeYds = clampRangeYds(rangeYds + stepYds);
    try { localStorage.setItem(KEY_DIST_YDS, String(rangeYds)); } catch {}
    syncRangeInputFromInternal();
    syncLiveTop();
  }

  function hydrateRange() {
    rangeYds = clampRangeYds(Number(localStorage.getItem(KEY_DIST_YDS) || "100"));
    const savedUnit = localStorage.getItem(KEY_DIST_UNIT) || "YDS";
    setRangeUnit(savedUnit === "M" ? "M" : "YDS");
  }

  // ------------------------------------------------------------
  // Dial unit + click
  // ------------------------------------------------------------
  function setUnit(newUnit) {
    dialUnit = newUnit === "MRAD" ? "MRAD" : "MOA";

    elUnitMoa?.classList.toggle("segOn", dialUnit === "MOA");
    elUnitMrad?.classList.toggle("segOn", dialUnit === "MRAD");

    const def = DEFAULTS[dialUnit];
    if (elClickValue) elClickValue.value = String(def.toFixed(2));

    if (elClickUnitLabel) elClickUnitLabel.textContent = dialUnit === "MOA" ? "MOA/click" : "MRAD/click";

    syncLiveTop();
  }

  function getClickValue() {
    let n = Number(elClickValue?.value);
    if (!Number.isFinite(n) || n <= 0) {
      n = DEFAULTS[dialUnit];
      if (elClickValue) elClickValue.value = String(n.toFixed(2));
    }
    return Math.max(0.01, Math.min(5, n));
  }

  // ------------------------------------------------------------
  // Target size
  // ------------------------------------------------------------
  function clampInches(v, fallback) {
    let n = Number(v);
    if (!Number.isFinite(n) || n <= 0) n = fallback;
    return Math.max(1, Math.min(200, n));
  }

  function highlightSizeChip() {
    if (!elSizeChipRow) return;
    const chips = Array.from(elSizeChipRow.querySelectorAll("[data-size]"));
    chips.forEach((c) => {
      const key = c.getAttribute("data-size") || "";
      c.classList.toggle("chipOn", key === targetSizeKey);
    });
  }

  function setTargetSize(key, wIn, hIn) {
    targetSizeKey = String(key || "23x35");
    targetWIn = clampInches(wIn, 23);
    targetHIn = clampInches(hIn, 35);

    try { localStorage.setItem(KEY_TARGET_SIZE, targetSizeKey); } catch {}
    try { localStorage.setItem(KEY_TARGET_W, String(targetWIn)); } catch {}
    try { localStorage.setItem(KEY_TARGET_H, String(targetHIn)); } catch {}

    highlightSizeChip();
    syncLiveTop();
    incPilot("target_size_change", 1);
  }

  function hydrateTargetSize() {
    const key = localStorage.getItem(KEY_TARGET_SIZE) || "23x35";
    const presetMap = {
      "8.5x11": { w: 8.5, h: 11 },
      "11x17": { w: 11, h: 17 },
      "12x18": { w: 12, h: 18 },
      "18x24": { w: 18, h: 24 },
      "23x35": { w: 23, h: 35 },
      "24x36": { w: 24, h: 36 }
    };

    const p = presetMap[key] || {
      w: clampInches(localStorage.getItem(KEY_TARGET_W) || "23", 23),
      h: clampInches(localStorage.getItem(KEY_TARGET_H) || "35", 35)
    };

    setTargetSize(key in presetMap ? key : "23x35", p.w, p.h);
  }

  function wireTargetSizeChips() {
    if (!elSizeChipRow) return;
    const chips = Array.from(elSizeChipRow.querySelectorAll("[data-size]"));
    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-size") || "23x35";
        if (key === "custom") {
          // Pilot-safe: keep your current saved W/H, just highlight custom
          setTargetSize("custom", targetWIn, targetHIn);
          incPilot("target_custom", 1);
          return;
        }
        const w = Number(btn.getAttribute("data-w") || "23");
        const h = Number(btn.getAttribute("data-h") || "35");
        setTargetSize(key, w, h);
      });
    });
  }

  // Swap (if button exists)
  elSwapSizeBtn?.addEventListener("click", () => {
    const w = targetWIn;
    const h = targetHIn;
    setTargetSize(targetSizeKey, h, w);
    incPilot("target_swap", 1);
  });

  // ------------------------------------------------------------
  // LIVE TOP
  // ------------------------------------------------------------
  function syncLiveTop() {
    if (elLiveDistance) {
      elLiveDistance.textContent = (rangeUnit === "M")
        ? `${Math.round(ydsToM(rangeYds))} m`
        : `${rangeYds} yds`;
    }

    if (elLiveDial) elLiveDial.textContent = `${getClickValue().toFixed(2)} ${dialUnit}`;

    if (elLiveTarget) elLiveTarget.textContent = (targetSizeKey || "").replace("x", "×");
  }

  // ------------------------------------------------------------
  // Matrix drawer
  // ------------------------------------------------------------
  function openMatrix() {
    if (!elMatrixPanel) return;
    elMatrixPanel.classList.remove("matrixHidden");
    elMatrixPanel.setAttribute("aria-hidden", "false");
    incPilot("matrix_open", 1);
  }

  function closeMatrix() {
    if (!elMatrixPanel) return;
    elMatrixPanel.classList.add("matrixHidden");
    elMatrixPanel.setAttribute("aria-hidden", "true");
  }

  function isMatrixOpen() {
    return !!elMatrixPanel && !elMatrixPanel.classList.contains("matrixHidden");
  }

  function toggleMatrix() { isMatrixOpen() ? closeMatrix() : openMatrix(); }

  function applyPreset(unit, clickVal) {
    setUnit(unit);
    if (elClickValue) elClickValue.value = Number(clickVal).toFixed(2);
    getClickValue();
    closeMatrix();
    syncLiveTop();
    incPilot("dial_preset", 1);
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

  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMatrix(); });

  document.addEventListener("click", (e) => {
    if (!isMatrixOpen()) return;
    if (!elMatrixPanel) return;
    const inside = elMatrixPanel.contains(e.target);
    const isBtn = (e.target === elMatrixBtn) || e.target.closest?.("#matrixBtn");
    if (!inside && !isBtn) closeMatrix();
  }, { capture: true });

  // ------------------------------------------------------------
  // Score (LOCAL placeholder)
  // ------------------------------------------------------------
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

    // correction vector = aim - avgPoi (bull - poib)
    const dx = aim.x01 - avg.x; // + means move RIGHT
    const dy = aim.y01 - avg.y; // + means move DOWN (screen y)

    // square scoring plane
    const squareIn = Math.min(targetWIn, targetHIn);
    const inchesX = dx * squareIn;
    const inchesY = dy * squareIn;
    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    const dist = getDistanceYds();
    const inchesPerUnit = (dialUnit === "MOA")
      ? (dist / 100) * 1.047
      : (dist / 100) * 3.6; // pilot MRAD

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
      dial: { unit: dialUnit, clickValue: clickVal },
      squareIn
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
    if (!out) { alert("Tap Aim Point first, then tap at least one bullet hole."); return; }

    // pilot: conversion event
    incPilot("show_results", 1);

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
      target: { key: targetSizeKey, wIn: Number(targetWIn), hIn: Number(targetHIn) },

      // taps for export overlay markers
      debug: { aim, hits, avgPoi: out.avgPoi, distanceYds: getDistanceYds(), inches: out.inches, squareIn: out.squareIn }
    };

    goToSEC(payload);
  }

  // ------------------------------------------------------------
  // Photo picker
  // ------------------------------------------------------------
  elPhotoBtn?.addEventListener("click", () => elFile?.click());

  elFile?.addEventListener("change", async () => {
    const f = elFile.files?.[0];
    if (!f) return;

    resetAll();

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    await storeTargetPhotoForSEC(f, objectUrl);

    // pilot
    incPilot("photo_loaded", 1);
    if (!sessionStarted) {
      incPilot("session_start", 1);
      sessionStarted = true;
    }

    elImg.onload = () => {
      setText(elStatus, "Tap Aim Point.");
      syncInstruction();
      revealScoringUI();
    };

    elImg.onerror = () => {
      setText(elStatus, "Photo failed to load.");
      setInstruction("Try again.", "");
      revealScoringUI();
    };

    elImg.src = objectUrl;
    elFile.value = "";
  });

  // ------------------------------------------------------------
  // Tap logic (iOS anti-scroll chaining, pinch-zoom allowed)
  // ------------------------------------------------------------
  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setText(elStatus, "Tap Bullet Holes.");
      hideSticky();
      syncInstruction();

      incPilot("aim_set", 1);
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();

    incPilot("hit_added", 1);

    hideSticky();
    syncInstruction();
    scheduleStickyMagic();
  }

  if (elWrap) {
    elWrap.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length === 1) e.preventDefault();
    }, { passive: false });

    elWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) { touchStart = null; return; }
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });

    elWrap.addEventListener("touchend", (e) => {
      const t = e.changedTouches?.[0];
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);
      if (dx > 10 || dy > 10) { touchStart = null; return; }

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
    incPilot("clear", 1);
    resetAll();
    if (elImg?.src) setText(elStatus, "Tap Aim Point.");
  });

  [elStickyBtn, $("showResultsBtn")].filter(Boolean).forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onShowResults();
    });
  });

  // Distance +/- (internal yards)
  elDistUp?.addEventListener("click", () => { bumpRange(5); incPilot("distance_bump", 1); });
  elDistDown?.addEventListener("click", () => { bumpRange(-5); incPilot("distance_bump", 1); });

  elDist?.addEventListener("change", () => { syncInternalFromRangeInput(); incPilot("distance_change", 1); });
  elDist?.addEventListener("blur", () => { syncInternalFromRangeInput(); });

  elDistUnitYd?.addEventListener("click", () => { setRangeUnit("YDS"); incPilot("distance_unit_yds", 1); });
  elDistUnitM?.addEventListener("click", () => { setRangeUnit("M"); incPilot("distance_unit_m", 1); });

  elUnitMoa?.addEventListener("click", () => { setUnit("MOA"); incPilot("dial_unit_moa", 1); });
  elUnitMrad?.addEventListener("click", () => { setUnit("MRAD"); incPilot("dial_unit_mrad", 1); });

  elClickValue?.addEventListener("blur", () => { getClickValue(); syncLiveTop(); incPilot("dial_click_change", 1); });
  elClickValue?.addEventListener("change", () => { getClickValue(); syncLiveTop(); incPilot("dial_click_change", 1); });

  elMatrixBtn?.addEventListener("click", toggleMatrix);
  elMatrixClose?.addEventListener("click", closeMatrix);

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  setUnit("MOA");
  closeMatrix();
  hideSticky();
  resetAll();

  hydrateVendorBox();
  hydrateRange();
  hydrateTargetSize();

  wireMatrixPresets();
  wireTargetSizeChips();

  highlightSizeChip();
  syncLiveTop();

  hardHideScoringUI();
  forceTop();
})();
