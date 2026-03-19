/* ============================================================
   docs/index.js — PROFILE ENGINE (PART 1 OF 2)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  function getUrl() {
    try { return new URL(window.location.href); }
    catch { return null; }
  }

  function getParam(name) {
    const u = getUrl();
    return u ? (u.searchParams.get(name) || "") : "";
  }

  function getVendor() {
    return getParam("v").toLowerCase();
  }

  function getSku() {
    return getParam("sku").toLowerCase();
  }

  const vendor = getVendor();
  const sku = getSku();

  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elVendorBox = $("vendorBox");
  const elVendorLabel = $("vendorLabel");
  const elVendorPanel = $("vendorPanel");
  const elVendorPanelLink = $("vendorPanelLink");
  const elScoreSection = $("scoreSection");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");
  const elLiveDistance = $("liveDistance");
  const elLiveDial = $("liveDial");
  const elLiveTarget = $("liveTarget");
  const elMatrixBtn = $("matrixBtn");
  const elMatrixPanel = $("matrixPanel");
  const elMatrixClose = $("matrixCloseBtn");
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
  const elSizeChipRow = $("sizeChipRow");
  const elSwapSizeBtn = $("swapSizeBtn");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_VENDOR_NAME = "SCZN3_VENDOR_NAME_V1";
  const KEY_DIST_UNIT = "SCZN3_RANGE_UNIT_V1";
  const KEY_DIST_YDS = "SCZN3_RANGE_YDS_V1";
  const KEY_TARGET_SIZE = "SCZN3_TARGET_SIZE_KEY_V1";
  const KEY_TARGET_W = "SCZN3_TARGET_W_IN_V1";
  const KEY_TARGET_H = "SCZN3_TARGET_H_IN_V1";

  let objectUrl = null;
  let aim = null;
  let hits = [];
  let lastTouchTapAt = 0;
  let touchStart = null;
  let pauseTimer = null;
  let dialUnit = "MOA";
  let rangeUnit = "YDS";
  let rangeYds = 100;
  let targetSizeKey = "23x35";
  let targetWIn = 23;
  let targetHIn = 35;
  let runStartedAt = 0;

  const DEFAULTS = { MOA: 0.25, MRAD: 0.10 };

  const TARGET_PROFILES = {
    "b2b-original": {
      profileId: "b2b-original",
      name: "Back to Basics Original",
      vendorDefault: "baker",
      targetKind: "drill",
      scoringMode: "occupancy",
      maxScore: 10,
      instructionsSummary: "Original Back to Basics drill target.",
      displayLayout: {
        1:  { x: 0.76, y: 0.12, shape: "circle" },
        2:  { x: 0.18, y: 0.34, shape: "circle" },
        3:  { x: 0.50, y: 0.34, shape: "square" },
        4:  { x: 0.82, y: 0.34, shape: "circle" },
        5:  { x: 0.18, y: 0.57, shape: "circle" },
        6:  { x: 0.50, y: 0.57, shape: "square" },
        7:  { x: 0.82, y: 0.57, shape: "circle" },
        8:  { x: 0.18, y: 0.80, shape: "circle" },
        9:  { x: 0.50, y: 0.80, shape: "square" },
        10: { x: 0.82, y: 0.80, shape: "circle" }
      },
      zones: [
        { id: 1,  shape: "circle", cx: 0.76, cy: 0.13, r: 0.080 },
        { id: 2,  shape: "circle", cx: 0.18, cy: 0.36, r: 0.075 },
        { id: 3,  shape: "square", cx: 0.50, cy: 0.36, hw: 0.083, hh: 0.083 },
        { id: 4,  shape: "circle", cx: 0.82, cy: 0.36, r: 0.075 },
        { id: 5,  shape: "circle", cx: 0.18, cy: 0.59, r: 0.075 },
        { id: 6,  shape: "square", cx: 0.50, cy: 0.59, hw: 0.083, hh: 0.083 },
        { id: 7,  shape: "circle", cx: 0.82, cy: 0.59, r: 0.075 },
        { id: 8,  shape: "circle", cx: 0.18, cy: 0.82, r: 0.075 },
        { id: 9,  shape: "square", cx: 0.50, cy: 0.82, hw: 0.083, hh: 0.083 },
        { id: 10, shape: "circle", cx: 0.82, cy: 0.82, r: 0.075 }
      ]
    },

    "bkr-b2b": {
      profileId: "bkr-b2b",
      name: "Back to Basics Grid",
      vendorDefault: "baker",
      targetKind: "drill",
      scoringMode: "occupancy",
      maxScore: 10,
      instructionsSummary: "Grid-style Back to Basics scoring target.",
      displayLayout: {
        1:  { x: 0.20, y: 0.16, shape: "circle" },
        2:  { x: 0.50, y: 0.16, shape: "square" },
        3:  { x: 0.80, y: 0.16, shape: "circle" },
        4:  { x: 0.20, y: 0.40, shape: "circle" },
        5:  { x: 0.50, y: 0.40, shape: "square" },
        6:  { x: 0.80, y: 0.40, shape: "circle" },
        7:  { x: 0.20, y: 0.64, shape: "circle" },
        8:  { x: 0.50, y: 0.64, shape: "square" },
        9:  { x: 0.80, y: 0.64, shape: "circle" },
        10: { x: 0.50, y: 0.88, shape: "circle" }
      },
      zones: [
        { id: 1,  shape: "circle", cx: 0.16, cy: 0.22, r: 0.105 },
        { id: 2,  shape: "square", cx: 0.50, cy: 0.22, hw: 0.105, hh: 0.105 },
        { id: 3,  shape: "circle", cx: 0.84, cy: 0.22, r: 0.105 },
        { id: 4,  shape: "circle", cx: 0.16, cy: 0.50, r: 0.105 },
        { id: 5,  shape: "square", cx: 0.50, cy: 0.50, hw: 0.105, hh: 0.105 },
        { id: 6,  shape: "circle", cx: 0.84, cy: 0.50, r: 0.105 },
        { id: 7,  shape: "circle", cx: 0.16, cy: 0.78, r: 0.098 },
        { id: 8,  shape: "square", cx: 0.50, cy: 0.765, hw: 0.088, hh: 0.070 },
        { id: 9,  shape: "circle", cx: 0.84, cy: 0.78, r: 0.098 },
        { id: 10, shape: "circle", cx: 0.50, cy: 0.935, r: 0.105 }
      ],
      lane10Priority: { left: 0.32, right: 0.68, top: 0.86, bottom: 1.00 },
      lane8MaxY: 0.83
    },

    "dot-torture": {
      profileId: "dot-torture",
      name: "Dot Torture",
      vendorDefault: "",
      targetKind: "drill",
      scoringMode: "shot-count",
      maxScore: 50,
      instructionsSummary: "Dot Torture target foundation profile.",
      displayLayout: {
        1:  { x: 0.50, y: 0.10, shape: "circle" },
        2:  { x: 0.22, y: 0.26, shape: "circle" },
        3:  { x: 0.50, y: 0.26, shape: "circle" },
        4:  { x: 0.78, y: 0.26, shape: "circle" },
        5:  { x: 0.22, y: 0.46, shape: "circle" },
        6:  { x: 0.50, y: 0.46, shape: "circle" },
        7:  { x: 0.78, y: 0.46, shape: "circle" },
        8:  { x: 0.22, y: 0.66, shape: "circle" },
        9:  { x: 0.50, y: 0.66, shape: "circle" },
        10: { x: 0.78, y: 0.66, shape: "circle" }
      },
      zones: [
        { id: 1,  shape: "circle", cx: 0.50, cy: 0.12, r: 0.060 },
        { id: 2,  shape: "circle", cx: 0.22, cy: 0.30, r: 0.060 },
        { id: 3,  shape: "circle", cx: 0.50, cy: 0.30, r: 0.060 },
        { id: 4,  shape: "circle", cx: 0.78, cy: 0.30, r: 0.060 },
        { id: 5,  shape: "circle", cx: 0.22, cy: 0.50, r: 0.060 },
        { id: 6,  shape: "circle", cx: 0.50, cy: 0.50, r: 0.060 },
        { id: 7,  shape: "circle", cx: 0.78, cy: 0.50, r: 0.060 },
        { id: 8,  shape: "circle", cx: 0.22, cy: 0.70, r: 0.060 },
        { id: 9,  shape: "circle", cx: 0.50, cy: 0.70, r: 0.060 },
        { id: 10, shape: "circle", cx: 0.78, cy: 0.70, r: 0.060 }
      ]
    }
  };

  function getProfileKey() {
    if (TARGET_PROFILES[sku]) return sku;
    return "";
  }

  const PROFILE_KEY = getProfileKey();
  const ACTIVE_PROFILE = PROFILE_KEY ? TARGET_PROFILES[PROFILE_KEY] : null;
  const DRILL_MODE = !!ACTIVE_PROFILE && ACTIVE_PROFILE.targetKind === "drill";

  try { history.scrollRestoration = "manual"; } catch {}

  function forceTop() {
    try { window.scrollTo(0, 0); } catch {}
  }

  function hardHideScoringUI() {
    elScoreSection?.classList.add("scoreHidden");
  }

  window.addEventListener("pageshow", () => {
    forceTop();
    hardHideScoringUI();
    hideSticky();
    closeMatrix();
    closeVendorPanel();
  });

  window.addEventListener("load", () => forceTop());

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function nowTs() {
    return Date.now();
  }

  function ensureRunStarted() {
    if (!runStartedAt) runStartedAt = nowTs();
  }

  function newSessionId() {
    return "S-" + nowTs() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function setText(el, t) {
    if (el) el.textContent = String(t ?? "");
  }

  function setInstruction(text, kind) {
    if (!elInstruction) return;

    const color =
      kind === "aim"   ? "rgba(103,243,164,.95)" :
      kind === "holes" ? "rgba(183,255,60,.95)"  :
      kind === "go"    ? "rgba(47,102,255,.92)"  :
                         "rgba(238,242,247,.70)";

    elInstruction.style.transition = "opacity 180ms ease, transform 180ms ease, color 120ms ease";
    elInstruction.style.opacity = "0";
    elInstruction.style.transform = "translateY(2px)";
    elInstruction.style.color = color;

    void elInstruction.offsetHeight;

    elInstruction.textContent = text || "";
    elInstruction.style.opacity = "1";
    elInstruction.style.transform = "translateY(0px)";
  }

  function syncInstruction() {
    if (!elImg?.src) {
      setInstruction("", "");
      return;
    }

    if (DRILL_MODE) {
      setInstruction("Tap each lane that has at least one hit.", "holes");
      return;
    }

    if (!aim) {
      setInstruction("Tap Aim Point.", "aim");
      return;
    }

    setInstruction("Tap Bullet Holes.", "holes");
  }

  function revealScoringUI() {
    elScoreSection?.classList.remove("scoreHidden");
    try {
      elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
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

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
  }

  function resetAll() {
    aim = null;
    hits = [];
    touchStart = null;
    runStartedAt = 0;
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    syncInstruction();
    setText(
      elStatus,
      elImg?.src
        ? (DRILL_MODE ? "Tap each lane that was hit." : "Tap Aim Point.")
        : "Add a target photo to begin."
    );
    closeMatrix();
    closeVendorPanel();
  }

  function isBakerMode() {
    return vendor === "baker";
  }

  function closeVendorPanel() {
    if (!elVendorPanel) return;
    elVendorPanel.classList.remove("vendorOpen");
  }

  function toggleVendorPanel() {
    if (!elVendorPanel) return;
    elVendorPanel.classList.toggle("vendorOpen");
  }

  function hydrateVendorBox() {
    if (elVendorLabel) elVendorLabel.textContent = "BUY MORE TARGETS LIKE THIS";

    if (isBakerMode()) {
      try { localStorage.setItem(KEY_VENDOR_NAME, "BAKER TARGETS"); } catch {}
    }

    if (isBakerMode() && elVendorLabel) {
      const a = "BUY MORE TARGETS LIKE THIS";
      const b = "BAKER • SMART TARGET™";
      let flip = false;
      setInterval(() => {
        flip = !flip;
        elVendorLabel.textContent = flip ? b : a;
      }, 1200);
    }

    const v = localStorage.getItem(KEY_VENDOR_URL) || "";
    const ok = typeof v === "string" && v.startsWith("http");

    if (elVendorPanelLink) {
      if (ok) {
        elVendorPanelLink.href = v;
        elVendorPanelLink.style.pointerEvents = "auto";
        elVendorPanelLink.style.opacity = "1";
      } else {
        elVendorPanelLink.href = "#";
        elVendorPanelLink.style.pointerEvents = "none";
        elVendorPanelLink.style.opacity = ".65";
      }
    }

    if (elVendorBox) {
      elVendorBox.removeAttribute("target");
      elVendorBox.removeAttribute("rel");
      elVendorBox.href = "#";
      elVendorBox.style.pointerEvents = "auto";
      elVendorBox.style.opacity = "1";

      elVendorBox.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleVendorPanel();
      });
    }
  }

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
    const r = elWrap.getBoundingClientRect();
    if (!r || r.width <= 1 || r.height <= 1) return { x01: 0.5, y01: 0.5 };

    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;

    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function ydsToM(yds) { return yds * 0.9144; }
  function mToYds(m) { return m / 0.9144; }

  function clampRangeYds(v) {
    let n = Number(v);
    if (!Number.isFinite(n)) n = 100;
    n = Math.round(n);
    n = Math.max(1, Math.min(5000, n));
    return n;
  }

  function getDistanceYds() {
    return clampRangeYds(rangeYds);
  }

  function setRangeUnit(u) {
    rangeUnit = (u === "M") ? "M" : "YDS";
    try { localStorage.setItem(KEY_DIST_UNIT, rangeUnit); } catch {}

    elDistUnitYd?.classList.toggle("segOn", rangeUnit === "YDS");
    elDistUnitM?.classList.toggle("segOn", rangeUnit === "M");

    if (elDistUnitLabel) {
      elDistUnitLabel.textContent = (rangeUnit === "M") ? "m" : "yds";
    }

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
    if (!Number.isFinite(n)) {
      n = (rangeUnit === "M") ? Math.round(ydsToM(rangeYds)) : rangeYds;
    }

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

  function setUnit(newUnit) {
    dialUnit = newUnit === "MRAD" ? "MRAD" : "MOA";

    elUnitMoa?.classList.toggle("segOn", dialUnit === "MOA");
    elUnitMrad?.classList.toggle("segOn", dialUnit === "MRAD");

    const def = DEFAULTS[dialUnit];
    if (elClickValue) elClickValue.value = String(def.toFixed(2));

    if (elClickUnitLabel) {
      elClickUnitLabel.textContent = dialUnit === "MOA" ? "MOA/click" : "MRAD/click";
    }

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
  }

  function hydrateTargetSize() {
    const key = localStorage.getItem(KEY_TARGET_SIZE) || "23x35";
    const presetMap = {
      "8.5x11": { w: 8.5, h: 11 },
      "11x17":  { w: 11,  h: 17 },
      "12x18":  { w: 12,  h: 18 },
      "18x24":  { w: 18,  h: 24 },
      "23x35":  { w: 23,  h: 35 },
      "24x36":  { w: 24,  h: 36 }
    };

    const p = presetMap[key] || {
      w: clampInches(localStorage.getItem(KEY_TARGET_W) || "23", 23),
      h: clampInches(localStorage.getItem(KEY_TARGET_H) || "35", 35)
    };

    const finalKey = (key in presetMap) ? key : (key === "custom" ? "custom" : "23x35");
    setTargetSize(finalKey, p.w, p.h);
  }

  function wireTargetSizeChips() {
    if (!elSizeChipRow) return;

    const chips = Array.from(elSizeChipRow.querySelectorAll("[data-size]"));
    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-size") || "23x35";

        if (key === "custom") {
          setTargetSize("custom", targetWIn, targetHIn);
          return;
        }

        const w = Number(btn.getAttribute("data-w") || targetWIn);
        const h = Number(btn.getAttribute("data-h") || targetHIn);
        setTargetSize(key, w, h);
      });
    });
  }

  function wireSwapSize() {
    if (!elSwapSizeBtn) return;
    elSwapSizeBtn.addEventListener("click", () => {
      const newW = targetHIn;
      const newH = targetWIn;
      setTargetSize(targetSizeKey || "custom", newW, newH);
    });
  }

  function syncLiveTop() {
    if (elLiveDistance) {
      elLiveDistance.textContent = (rangeUnit === "M")
        ? `${Math.round(ydsToM(rangeYds))} m`
        : `${rangeYds} yds`;
    }

    if (elLiveDial) {
      elLiveDial.textContent = DRILL_MODE
        ? (ACTIVE_PROFILE ? ACTIVE_PROFILE.name.toUpperCase() : "DRILL MODE")
        : `${getClickValue().toFixed(2)} ${dialUnit}`;
    }

    if (elLiveTarget) {
      if (DRILL_MODE && ACTIVE_PROFILE) {
        elLiveTarget.textContent = ACTIVE_PROFILE.profileId;
      } else {
        elLiveTarget.textContent = (targetSizeKey || "").replace("x", "×") || "—";
      }
    }
  }

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
    isMatrixOpen() ? closeMatrix() : openMatrix();
  }

  function applyPreset(unit, clickVal) {
    setUnit(unit);
    if (elClickValue) elClickValue.value = Number(clickVal).toFixed(2);
    getClickValue();
    closeMatrix();
    syncLiveTop();
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
  function zoneContains(z, x01, y01) {
    if (z.shape === "circle") {
      const dx = x01 - z.cx;
      const dy = y01 - z.cy;
      return (dx * dx + dy * dy) <= (z.r * z.r);
    }

    if (z.shape === "square") {
      return (
        x01 >= (z.cx - z.hw) &&
        x01 <= (z.cx + z.hw) &&
        y01 >= (z.cy - z.hh) &&
        y01 <= (z.cy + z.hh)
      );
    }

    return false;
  }

  function detectLane(profile, x01, y01) {
    if (!profile?.zones) return null;

    // ----- Special override for Baker B2B grid -----
    if (profile.profileId === "bkr-b2b") {

      // Force lane 10 if inside bottom center region
      const p = profile.lane10Priority;
      if (
        p &&
        x01 >= p.left &&
        x01 <= p.right &&
        y01 >= p.top &&
        y01 <= p.bottom
      ) {
        return 10;
      }

      // Prevent lane 8 stealing bottom hits
      if (profile.lane8MaxY && y01 > profile.lane8MaxY) {
        return null;
      }
    }

    for (const z of profile.zones) {
      if (zoneContains(z, x01, y01)) return z.id;
    }

    return null;
  }

  function computeDrillOccupancy(profile, taps) {
    const laneSet = new Set();

    taps.forEach((t) => {
      const id = detectLane(profile, t.x01, t.y01);
      if (id != null) laneSet.add(id);
    });

    return {
      score: laneSet.size,
      lanesHit: Array.from(laneSet).sort((a, b) => a - b)
    };
  }

  function buildDrillPayload() {
    if (!ACTIVE_PROFILE) return null;

    const occ = computeDrillOccupancy(ACTIVE_PROFILE, hits);

    const sessionId = newSessionId();

    return {
      version: "SEC-2P",
      sessionId,
      ts: nowTs(),
      vendor: localStorage.getItem(KEY_VENDOR_NAME) || "",
      vendorUrl: localStorage.getItem(KEY_VENDOR_URL) || "",
      surveyUrl: "",
      drill: {
        mode: "b2b",
        profileId: ACTIVE_PROFILE.profileId,
        lanesHit: occ.lanesHit
      },
      score: occ.score,
      taps: hits.length,
      distanceYds: getDistanceYds()
    };
  }

  function computePrecisionPayload() {
    if (!aim || hits.length === 0) return null;

    const dxAvg =
      hits.reduce((s, h) => s + (h.x01 - aim.x01), 0) / hits.length;

    const dyAvg =
      hits.reduce((s, h) => s + (h.y01 - aim.y01), 0) / hits.length;

    const dxIn = dxAvg * targetWIn;
    const dyIn = dyAvg * targetHIn;

    const range = getDistanceYds();
    const click = getClickValue();

    const perClickIn =
      dialUnit === "MOA"
        ? (1.047 * range / 100) * click
        : (range / 100) * click * 3.6;

    const windClicks = dxIn / perClickIn;
    const elevClicks = dyIn / perClickIn;

    return {
      version: "SEC-2P",
      sessionId: newSessionId(),
      ts: nowTs(),
      vendor: localStorage.getItem(KEY_VENDOR_NAME) || "",
      vendorUrl: localStorage.getItem(KEY_VENDOR_URL) || "",
      surveyUrl: "",
      score: Math.round(Math.random() * 100), // placeholder
      windage: {
        clicks: Math.abs(windClicks),
        dir: windClicks >= 0 ? "RIGHT" : "LEFT"
      },
      elevation: {
        clicks: Math.abs(elevClicks),
        dir: elevClicks >= 0 ? "UP" : "DOWN"
      },
      shots: hits.length,
      distanceYds: range
    };
  }

  function buildPayload() {
    if (DRILL_MODE) return buildDrillPayload();
    return computePrecisionPayload();
  }

  function goToSEC(payload) {
    try {
      localStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload));
    } catch {}

    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    window.location.href = `./sec.html?payload=${enc}`;
  }

  function handleTap(x01, y01) {
    ensureRunStarted();

    if (DRILL_MODE) {
      hits.push({ x01, y01 });
      addDot(x01, y01, "hit");
      setTapCount();
      scheduleStickyMagic();
      return;
    }

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      syncInstruction();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();
    scheduleStickyMagic();
  }

  function wireImageTaps() {
    if (!elWrap) return;

    elWrap.addEventListener("click", (e) => {
      if (!elImg?.src) return;

      const { x01, y01 } = getRelative01(e.clientX, e.clientY);
      handleTap(x01, y01);
    });
  }

  function wireStickyButton() {
    if (!elStickyBtn) return;

    elStickyBtn.addEventListener("click", () => {
      const payload = buildPayload();
      if (!payload) return;
      goToSEC(payload);
    });
  }

  function wireClear() {
    elClear?.addEventListener("click", resetAll);
  }

  function wirePhotoInput() {
    if (!elFile) return;

    elFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);

      elImg.src = objectUrl;

      await storeTargetPhotoForSEC(file, objectUrl);

      resetAll();
      syncInstruction();
      revealScoringUI();
    });
  }

  function wirePhotoButton() {
    elPhotoBtn?.addEventListener("click", () => {
      elFile?.click();
    });
  }

  function init() {
    hydrateVendorBox();
    hydrateRange();
    hydrateTargetSize();

    wireTargetSizeChips();
    wireSwapSize();

    wireMatrixPresets();
    elMatrixBtn?.addEventListener("click", toggleMatrix);
    elMatrixClose?.addEventListener("click", closeMatrix);

    elDist?.addEventListener("change", syncInternalFromRangeInput);
    elDistUp?.addEventListener("click", () => bumpRange(1));
    elDistDown?.addEventListener("click", () => bumpRange(-1));

    elDistUnitYd?.addEventListener("click", () => setRangeUnit("YDS"));
    elDistUnitM?.addEventListener("click", () => setRangeUnit("M"));

    elUnitMoa?.addEventListener("click", () => setUnit("MOA"));
    elUnitMrad?.addEventListener("click", () => setUnit("MRAD"));

    wireImageTaps();
    wireStickyButton();
    wireClear();
    wirePhotoInput();
    wirePhotoButton();

    syncInstruction();
    syncLiveTop();
  }

  init();

})();
