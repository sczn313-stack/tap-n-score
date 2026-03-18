/* ============================================================
   docs/index.js — B2B Go-Live Router + Zone Scoring + Run Metadata
   - Keeps printed QR URL permanent
   - Routes Baker B2B into B2B tap scoring
   - Uses zone-based lane detection
   - FIX: lane 10 priority / separation from lane 8
   - Leaves normal targets on generic correction flow
   - Adds distance + cleaner payload metadata
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  function getUrl() {
    try {
      return new URL(window.location.href);
    } catch {
      return null;
    }
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

  function isB2B() {
    return getVendor() === "baker" && getSku() === "bkr-b2b";
  }

  const B2B_MODE = isB2B();

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

  /* ============================================================
     B2B ZONE SCORING
     FIX NOTES:
     - Lane 10 gets priority
     - Lane 10 pulled slightly lower
     - Lane 8 slightly tightened so it stops stealing lane 10 taps
  ============================================================ */
  const B2B_ZONES = [
    { id: 1,  shape: "circle", cx: 0.16, cy: 0.22, r: 0.105 },
    { id: 2,  shape: "square", cx: 0.50, cy: 0.22, hw: 0.105, hh: 0.105 },
    { id: 3,  shape: "circle", cx: 0.84, cy: 0.22, r: 0.105 },

    { id: 4,  shape: "circle", cx: 0.16, cy: 0.50, r: 0.105 },
    { id: 5,  shape: "square", cx: 0.50, cy: 0.50, hw: 0.105, hh: 0.105 },
    { id: 6,  shape: "circle", cx: 0.84, cy: 0.50, r: 0.105 },

    { id: 7,  shape: "circle", cx: 0.16, cy: 0.78, r: 0.098 },
    { id: 8,  shape: "square", cx: 0.50, cy: 0.77, hw: 0.090, hh: 0.082 },
    { id: 9,  shape: "circle", cx: 0.84, cy: 0.78, r: 0.098 },

    { id: 10, shape: "circle", cx: 0.50, cy: 0.935, r: 0.102 }
  ];

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

  function setText(el, t) {
    if (el) el.textContent = String(t ?? "");
  }

  function revealScoringUI() {
    elScoreSection?.classList.remove("scoreHidden");
    try {
      elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
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

  function nowTs() {
    return Date.now();
  }

  function ensureRunStarted() {
    if (!runStartedAt) runStartedAt = nowTs();
  }

  function newSessionId() {
    return "S-" + nowTs() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function setInstruction(text, kind) {
    if (!elInstruction) return;

    const color =
      kind === "aim"   ? "rgba(103,243,164,.95)" :
      kind === "holes" ? "rgba(183,255,60,.95)"  :
      kind === "go"    ? "rgba(47,102,255,.92)"  :
                         "rgba(238,242,247,.70)";

    elInstruction.style.transition = "opacity 180ms ease, transform 180ms ease, color 120ms ease";
    elInstruction.style.opacity = "0
