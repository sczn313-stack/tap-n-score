Yep — let’s fix it right.

The problem is the nearest-center method.
We need real zone scoring for B2B.

Below is a full replacement for docs/index.js that changes B2B to:
	•	score by lane zones
	•	count each lane once
	•	keep distance
	•	keep your current QR / SEC flow
	•	stay tap-based, not auto

Replace the whole file with this:

/* ============================================================
   docs/index.js — B2B Go-Live Router + Zone Scoring + Run Metadata
   - Keeps printed QR URL permanent
   - Routes Baker B2B into B2B tap scoring
   - Uses zone-based lane detection (not nearest-center only)
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

    if (B2B_MODE) {
      setInstruction("Tap each lane that has at least one hit.", "holes");
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
    runStartedAt = 0;
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    syncInstruction();
    setText(
      elStatus,
      elImg?.src
        ? (B2B_MODE ? "Tap each lane that was hit." : "Tap Aim Point.")
        : "Add a target photo to begin."
    );
    closeMatrix();
    closeVendorPanel();
  }

  function isBakerMode() {
    return getVendor() === "baker";
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
        el
