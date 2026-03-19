/* ============================================================
   docs/index.js — PROFILE UI ENGINE + PROFILE SCORING
   PART 1 OF 2
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  /* ============================================================
     URL / ROUTING
  ============================================================ */
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

  /* ============================================================
     DOM
  ============================================================ */
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
  const elShowResultsBtn = $("showResultsBtn");

  const elLiveDistance = $("liveDistance");
  const elLiveDial = $("liveDial");
  const elLiveTarget = $("liveTarget");
  const elLiveProfile = $("liveProfile");

  const elProfileBar = $("profileBar");
  const elProfileTitle = $("profileTitle");
  const elProfileSubtitle = $("profileSubtitle");

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

  /* ============================================================
     STORAGE
  ============================================================ */
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

  /* ============================================================
     STATE
  ============================================================ */
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

  /* ============================================================
     PROFILE REGISTRY
  ============================================================ */
  const TARGET_PROFILES = {
    "b2b-original": {
      profileId: "b2b-original",
      name: "Back to Basics Original",
      vendorDefault: "baker",
      targetKind: "drill",
      scoringMode: "occupancy",
      maxScore: 10,
      instructionsSummary: "Tap each lane that has at least one hit.",
      ui: {
        liveProfile: "B2B-ORG",
        title: "Back to Basics Original",
        subtitle: "Tap each lane that has at least one hit."
      },
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
      instructionsSummary: "Tap each lane that has at least one hit.",
      ui: {
        liveProfile: "B2B",
        title: "Back to Basics Grid",
        subtitle: "Tap each lane that has at least one hit."
      },
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
      instructionsSummary: "Tap each scoring dot that was hit.",
      ui: {
        liveProfile: "TORTURE",
        title: "Dot Torture",
        subtitle: "Tap each scoring dot that was hit."
      },
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

  /* ============================================================
     HELPERS
  ============================================================ */
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
      setInstruction(getProfileUi().subtitle, "holes");
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
        ? (DRILL_MODE ? getProfileUi().subtitle : "Tap Aim Point.")
        : "Add a target photo to begin."
    );
    closeMatrix();
    closeVendorPanel();
  }

  /* ============================================================
     PROFILE UI ENGINE
  ============================================================ */
  function getProfileUi() {
    if (DRILL_MODE && ACTIVE_PROFILE) {
      return {
        liveProfile: ACTIVE_PROFILE.ui?.liveProfile || "DRILL",
        title: ACTIVE_PROFILE.ui?.title || ACTIVE_PROFILE.name || "Drill Target",
        subtitle: ACTIVE_PROFILE.ui?.subtitle || ACTIVE_PROFILE.instructionsSummary || "Tap each scoring area that was hit."
      };
    }

    return {
      liveProfile: "ZERO",
      title: "Precision Zero",
      subtitle: "Tap aim point, then impacts."
    };
  }

  /* ============================================================
     VENDOR
  ============================================================ */
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

  /* ============================================================
     IMAGE / TAPS
  ============================================================ */
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

  /* ============================================================
     RANGE / MATRIX
  ============================================================ */
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
    const ui = getProfileUi();

    if (elLiveDistance) {
      elLiveDistance.textContent = (rangeUnit === "M")
        ? `${Math.round(ydsToM(rangeYds))} m`
        : `${rangeYds} yds`;
    }

    if (elLiveDial) {
      elLiveDial.textContent = DRILL_MODE
        ? "DRILL MODE"
        : `${getClickValue().toFixed(2)} ${dialUnit}`;
    }

    if (elLiveTarget) {
      if (DRILL_MODE && ACTIVE_PROFILE) {
        elLiveTarget.textContent = ACTIVE_PROFILE.profileId;
      } else {
        elLiveTarget.textContent = (targetSizeKey || "").replace("x", "×") || "—";
      }
    }

    if (elLiveProfile) {
      elLiveProfile.textContent = ui.liveProfile;
    }

    if (elProfileTitle) {
      elProfileTitle.textContent = ui.title;
    }

    if (elProfileSubtitle) {
      elProfileSubtitle.textContent = ui.subtitle;
    }

    if (elProfileBar) {
      elProfileBar.style.display = "block";
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

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMatrix();
  });

  document.addEventListener("click", (e) => {
    if (!isMatrixOpen()) return;
    if (!elMatrixPanel) return;
    const inside = elMatrixPanel.contains(e.target);
    const isBtn = (e.target === elMatrixBtn) || e.target.closest?.("#matrixBtn");
    if (!inside && !isBtn) closeMatrix();
  }, { capture: true });
     /* ============================================================
     ZERO SCORING
  ============================================================ */
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

    const squareIn = Math.min(targetWIn, targetHIn);
    const inchesX = dx * squareIn;
    const inchesY = dy * squareIn;
    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    const dist = getDistanceYds();
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
      dial: { unit: dialUnit, clickValue: clickVal },
      squareIn
    };
  }

  /* ============================================================
     PROFILE SCORING
  ============================================================ */
  function pointInZone(hit, zone) {
    const dx = hit.x01 - zone.cx;
    const dy = hit.y01 - zone.cy;

    if (zone.shape === "circle") {
      return (dx * dx + dy * dy) <= (zone.r * zone.r);
    }

    if (zone.shape === "square") {
      return Math.abs(dx) <= zone.hw && Math.abs(dy) <= zone.hh;
    }

    return false;
  }

  function zoneDistanceScore(hit, zone) {
    const dx = hit.x01 - zone.cx;
    const dy = hit.y01 - zone.cy;

    if (zone.shape === "circle") {
      const dist = Math.sqrt(dx * dx + dy * dy);
      return zone.r > 0 ? dist / zone.r : 999;
    }

    if (zone.shape === "square") {
      const nx = zone.hw > 0 ? Math.abs(dx) / zone.hw : 999;
      const ny = zone.hh > 0 ? Math.abs(dy) / zone.hh : 999;
      return Math.max(nx, ny);
    }

    return 999;
  }

  function scoreOccupancyProfile(hitPoints, profile) {
    if (!hitPoints || hitPoints.length === 0) {
      return { score: 0, lanes: [], laneCount: 0, missedTaps: 0 };
    }

    const hitLanes = new Set();
    let missedTaps = 0;

    for (const hit of hitPoints) {
      if (profile.lane10Priority) {
        const p = profile.lane10Priority;
        const inPriority =
          hit.x01 >= p.left &&
          hit.x01 <= p.right &&
          hit.y01 >= p.top &&
          hit.y01 <= p.bottom;

        if (inPriority) {
          hitLanes.add(10);
          continue;
        }
      }

      let matching = profile.zones.filter(zone => pointInZone(hit, zone));

      if (typeof profile.lane8MaxY === "number" && hit.y01 >= profile.lane8MaxY) {
        matching = matching.filter(zone => zone.id !== 8);
      }

      if (!matching.length) {
        missedTaps += 1;
        continue;
      }

      const chosen = matching
        .map(zone => ({ zone, score: zoneDistanceScore(hit, zone) }))
        .sort((a, b) => a.score - b.score)[0].zone;

      hitLanes.add(chosen.id);
    }

    const lanes = Array.from(hitLanes).sort((a, b) => a - b);

    return {
      score: lanes.length,
      lanes,
      laneCount: lanes.length,
      missedTaps
    };
  }

  function scoreShotCountProfile(hitPoints, profile) {
    if (!hitPoints || hitPoints.length === 0) {
      return { score: 0, lanes: [], laneCount: 0, missedTaps: 0 };
    }

    let score = 0;
    let missedTaps = 0;
    const laneHits = [];

    for (const hit of hitPoints) {
      const matching = profile.zones.filter(zone => pointInZone(hit, zone));
      if (!matching.length) {
        missedTaps += 1;
        continue;
      }

      const chosen = matching
        .map(zone => ({ zone, score: zoneDistanceScore(hit, zone) }))
        .sort((a, b) => a.score - b.score)[0].zone;

      laneHits.push(chosen.id);
      score += 1;
    }

    const uniqueLanes = Array.from(new Set(laneHits)).sort((a, b) => a - b);

    return {
      score: Math.min(score, profile.maxScore || score),
      lanes: uniqueLanes,
      laneCount: uniqueLanes.length,
      missedTaps
    };
  }

  function scoreProfile(hitPoints, profile) {
    if (!profile) return { score: 0, lanes: [], laneCount: 0, missedTaps: 0 };

    if (profile.scoringMode === "occupancy") {
      return scoreOccupancyProfile(hitPoints, profile);
    }

    if (profile.scoringMode === "shot-count") {
      return scoreShotCountProfile(hitPoints, profile);
    }

    return { score: 0, lanes: [], laneCount: 0, missedTaps: 0 };
  }

  /* ============================================================
     PAYLOAD
  ============================================================ */
  function buildBasePayload() {
    return {
      sessionId: newSessionId(),
      vendor,
      sku,
      vendorUrl: localStorage.getItem(KEY_VENDOR_URL) || "",
      vendorName: localStorage.getItem(KEY_VENDOR_NAME) || "",
      surveyUrl: "",
      distanceYds: getDistanceYds(),
      target: {
        key: DRILL_MODE ? PROFILE_KEY : targetSizeKey,
        wIn: Number(targetWIn),
        hIn: Number(targetHIn)
      },
      runStartedAt,
      runCompletedAt: nowTs(),
      runDurationSec: runStartedAt ? Math.max(0, Math.round((nowTs() - runStartedAt) / 1000)) : 0
    };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload)); } catch {}
    const b64 = b64FromObj(payload);
    window.location.href = `./sec.html?from=target&payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function onShowResults() {
    const base = buildBasePayload();

    if (DRILL_MODE && ACTIVE_PROFILE) {
      const out = scoreProfile(hits, ACTIVE_PROFILE);

      const payload = {
        ...base,
        mode: "drill",
        profileId: ACTIVE_PROFILE.profileId,
        profileName: ACTIVE_PROFILE.name,
        drill: {
          mode: ACTIVE_PROFILE.profileId,
          name: ACTIVE_PROFILE.name,
          lanesHit: out.lanes,
          maxScore: ACTIVE_PROFILE.maxScore,
          displayLayout: ACTIVE_PROFILE.displayLayout,
          scoringMode: ACTIVE_PROFILE.scoringMode
        },
        score: out.score,
        maxScore: ACTIVE_PROFILE.maxScore,
        taps: hits.length,
        shots: hits.length,
        hits: out.laneCount,
        windage: { dir: "", clicks: 0 },
        elevation: { dir: "", clicks: 0 },
        dial: { unit: "DRILL", clickValue: 0 },
        debug: {
          mode: ACTIVE_PROFILE.profileId,
          distanceYds: getDistanceYds(),
          lanesHit: out.lanes,
          rawTapCount: hits.length,
          missedTaps: out.missedTaps,
          hits,
          zones: ACTIVE_PROFILE.zones,
          displayLayout: ACTIVE_PROFILE.displayLayout
        }
      };

      goToSEC(payload);
      return;
    }

    const out = computeCorrectionAndScore();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one bullet hole.");
      return;
    }

    const payload = {
      ...base,
      mode: "zero",
      score: out.score,
      taps: hits.length,
      shots: hits.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      dial: { unit: out.dial.unit, clickValue: Number(out.dial.clickValue.toFixed(2)) },
      debug: {
        aim,
        hits,
        avgPoi: out.avgPoi,
        distanceYds: getDistanceYds(),
        inches: out.inches,
        squareIn: out.squareIn
      }
    };

    goToSEC(payload);
  }

  /* ============================================================
     EVENTS
  ============================================================ */
  elPhotoBtn?.addEventListener("click", () => elFile?.click());

  elFile?.addEventListener("change", async () => {
    const f = elFile.files?.[0];
    if (!f) return;

    resetAll();

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    await storeTargetPhotoForSEC(f, objectUrl);

    elImg.onload = () => {
      runStartedAt = nowTs();
      setText(elStatus, DRILL_MODE ? getProfileUi().subtitle : "Tap Aim Point.");
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

  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;
    ensureRunStarted();

    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!DRILL_MODE) {
      if (!aim) {
        aim = { x01, y01 };
        addDot(x01, y01, "aim");
        setText(elStatus, "Tap Bullet Holes.");
        hideSticky();
        syncInstruction();
        return;
      }
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();

    hideSticky();
    syncInstruction();
    scheduleStickyMagic();
  }

  if (elWrap) {
    elWrap.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length === 1) e.preventDefault();
    }, { passive: false });

    elWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) {
        touchStart = null;
        return;
      }
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });

    elWrap.addEventListener("touchend", (e) => {
      const t = e.changedTouches?.[0];
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);
      if (dx > 10 || dy > 10) {
        touchStart = null;
        return;
      }

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

  elClear?.addEventListener("click", () => {
    resetAll();
    if (elImg?.src) {
      runStartedAt = nowTs();
      setText(elStatus, DRILL_MODE ? getProfileUi().subtitle : "Tap Aim Point.");
    }
  });

  [elStickyBtn, elShowResultsBtn].filter(Boolean).forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onShowResults();
    });
  });

  /* ============================================================
     MATRIX EVENTS
  ============================================================ */
  elDistUp?.addEventListener("click", () => bumpRange(5));
  elDistDown?.addEventListener("click", () => bumpRange(-5));

  elDist?.addEventListener("change", syncInternalFromRangeInput);
  elDist?.addEventListener("blur", syncInternalFromRangeInput);

  elDistUnitYd?.addEventListener("click", () => setRangeUnit("YDS"));
  elDistUnitM?.addEventListener("click", () => setRangeUnit("M"));

  elUnitMoa?.addEventListener("click", () => setUnit("MOA"));
  elUnitMrad?.addEventListener("click", () => setUnit("MRAD"));

  elClickValue?.addEventListener("blur", () => { getClickValue(); syncLiveTop(); });
  elClickValue?.addEventListener("change", () => { getClickValue(); syncLiveTop(); });

  elMatrixBtn?.addEventListener("click", toggleMatrix);
  elMatrixClose?.addEventListener("click", closeMatrix);

  document.addEventListener("click", (e) => {
    if (!elVendorPanel || !elVendorBox) return;
    const inPanel = elVendorPanel.contains(e.target);
    const inPill = elVendorBox.contains(e.target);
    if (!inPanel && !inPill) closeVendorPanel();
  }, { capture: true });

  /* ============================================================
     BOOT
  ============================================================ */
  setUnit("MOA");
  closeMatrix();
  hideSticky();
  resetAll();

  hydrateVendorBox();
  hydrateRange();
  hydrateTargetSize();

  wireMatrixPresets();
  wireTargetSizeChips();
  wireSwapSize();

  highlightSizeChip();
  syncLiveTop();

  hardHideScoringUI();
  forceTop();
})();
