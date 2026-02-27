/* ============================================================
   docs/index.js (FULL REPLACEMENT) — MATRIX + SQUARE PLANE
   + Instruction mirroring (Aim ↔ Holes) in the info line (fade)
   + Matrix + target size chips
   + iOS-safe photo input (not display:none)
   + SEC exit intelligence flag (?from=target)

   VENDOR FIX REV:
   ✅ Vendor slug/sku/batch captured from QR params (?v=...&sku=...&b=...)
   ✅ Vendor URL saved to localStorage (SCZN3_VENDOR_URL_V1)
   ✅ Landing vendor badge rotates every 1.5s once vendor known
   ✅ Vendor URL normalized to https:// if missing
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Landing / hero
  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elVendorBox = $("vendorBox");     // usually <a>
  const elVendorLabel = $("vendorLabel"); // inner text node
  const elVendorLogo = $("vendorLogo");   // OPTIONAL <img id="vendorLogo"> if you have it

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
  const elSwapSizeBtn = $("swapSizeBtn");

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";

  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_VENDOR_NAME = "SCZN3_VENDOR_NAME_V1";
  const KEY_VENDOR_SLUG = "SCZN3_VENDOR_SLUG_V1";
  const KEY_VENDOR_SKU  = "SCZN3_VENDOR_SKU_V1";
  const KEY_VENDOR_BATCH= "SCZN3_VENDOR_BATCH_V1";

  const KEY_DIST_UNIT = "SCZN3_RANGE_UNIT_V1"; // "YDS" | "M"
  const KEY_DIST_YDS = "SCZN3_RANGE_YDS_V1";   // numeric (yards)

  // Target size persistence
  const KEY_TARGET_SIZE = "SCZN3_TARGET_SIZE_KEY_V1"; // e.g., "23x35"
  const KEY_TARGET_W = "SCZN3_TARGET_W_IN_V1";
  const KEY_TARGET_H = "SCZN3_TARGET_H_IN_V1";

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
  let rotateState = 0;

  // dial unit
  let dialUnit = "MOA"; // "MOA" | "MRAD"

  // distance state
  let rangeUnit = "YDS"; // "YDS" | "M"
  let rangeYds = 100;    // internal yards

  // target size (inches)
  let targetSizeKey = "23x35";
  let targetWIn = 23;
  let targetHIn = 35;

  const DEFAULTS = { MOA: 0.25, MRAD: 0.10 };

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
    // Re-apply vendor on back/forward too
    applyVendorFromQrOrStorage();
  });

  window.addEventListener("load", () => forceTop());

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

  // ------------------------------------------------------------
  // Instruction line (mirrored + fade)
  // ------------------------------------------------------------
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
    if (!elImg?.src) { setInstruction("", ""); return; }
    if (!aim) { setInstruction("Tap Aim Point.", "aim"); return; }
    setInstruction("Tap Bullet Holes.", "holes");
  }

  function resetAll() {
    aim = null;
    hits = [];
    touchStart = null;
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    syncInstruction();
    setText(elStatus, elImg?.src ? "Tap Aim Point." : "Add a target photo to begin.");
    closeMatrix();
  }

  // ------------------------------------------------------------
  // ✅ URL normalization
  // ------------------------------------------------------------
  function normalizeHttpUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return "https:" + s;
    // if it's a domain like bakertargets.com/...
    if (/^[a-z0-9.-]+\.[a-z]{2,}\/?/i.test(s)) return "https://" + s;
    return s; // fallback, may be invalid but we don't destroy it
  }

  // ------------------------------------------------------------
  // Vendor badge rotation (1.5s)
  // ------------------------------------------------------------
  function stopVendorRotate() {
    if (vendorRotateTimer) clearInterval(vendorRotateTimer);
    vendorRotateTimer = null;
    rotateState = 0;
  }

  function startVendorRotate(lineA, lineB) {
    stopVendorRotate();
    if (!elVendorLabel) return;

    const a = String(lineA || "VENDOR");
    const b = String(lineB || "BUY MORE TARGETS LIKE THIS");

    // set immediately
    elVendorLabel.textContent = a;

    vendorRotateTimer = setInterval(() => {
      rotateState = (rotateState + 1) % 2;
      elVendorLabel.textContent = rotateState === 0 ? a : b;
    }, 1500);
  }

  function hydrateVendorBadge() {
    if (!elVendorBox) return;

    const storedUrl = normalizeHttpUrl(localStorage.getItem(KEY_VENDOR_URL) || "");
    const storedName = String(localStorage.getItem(KEY_VENDOR_NAME) || "").trim();
    const storedSlug = String(localStorage.getItem(KEY_VENDOR_SLUG) || "").trim();

    // Determine display name
    let name = storedName;
    if (!name && storedSlug === "baker") name = "BAKER TARGETS";
    if (!name) name = "VENDOR";

    const ok = storedUrl.startsWith("http");

    // Logo support if you have <img id="vendorLogo">
    if (elVendorLogo) {
      if (storedSlug === "baker") {
        elVendorLogo.src = "./assets/vendor-baker-logo.png";
        elVendorLogo.alt = "Baker Targets";
        elVendorLogo.style.display = "block";
      } else {
        // if you want no logo for unknown vendor
        elVendorLogo.style.display = "none";
      }
    }

    if (ok) {
      elVendorBox.href = storedUrl;
      elVendorBox.target = "_blank";
      elVendorBox.rel = "noopener";
      elVendorBox.style.pointerEvents = "auto";
      elVendorBox.style.opacity = "1";
    } else {
      // Still show/rotate label (branding), but disable click
      elVendorBox.removeAttribute("href");
      elVendorBox.removeAttribute("target");
      elVendorBox.removeAttribute("rel");
      elVendorBox.style.pointerEvents = "none";
      elVendorBox.style.opacity = ".92";
    }

    // Always rotate once a vendor is known (slug or url or name)
    const hasVendorIdentity = !!storedSlug || !!storedName || ok;
    if (hasVendorIdentity) startVendorRotate(name, "BUY MORE TARGETS LIKE THIS");
    else stopVendorRotate();
  }

  // ------------------------------------------------------------
  // ✅ Vendor wiring from QR params
  // ------------------------------------------------------------
  function getParams() {
    try { return new URLSearchParams(window.location.search || ""); }
    catch { return new URLSearchParams(); }
  }

  function normalizeSlug(s) {
    return String(s || "").trim().toLowerCase();
  }

  // Vendor registry (expand anytime)
  const VENDOR_REGISTRY = {
    baker: {
      name: "BAKER TARGETS",
      url: "https://bakertargets.com/product/100-yard-bulls-eye-rifle-target-smart-target-version"
    }
  };

  function applyVendorFromQrOrStorage() {
    const p = getParams();

    const slug = normalizeSlug(p.get("v"));
    const sku  = String(p.get("sku") || "").trim();
    const batch= String(p.get("b") || "").trim();

    if (slug) {
      try { localStorage.setItem(KEY_VENDOR_SLUG, slug); } catch {}
    }
    if (sku) {
      try { localStorage.setItem(KEY_VENDOR_SKU, sku); } catch {}
    }
    if (batch) {
      try { localStorage.setItem(KEY_VENDOR_BATCH, batch); } catch {}
    }

    // If slug provided, set vendor url/name from registry
    if (slug && VENDOR_REGISTRY[slug]) {
      const entry = VENDOR_REGISTRY[slug];
      try { localStorage.setItem(KEY_VENDOR_URL, normalizeHttpUrl(entry.url)); } catch {}
      try { localStorage.setItem(KEY_VENDOR_NAME, String(entry.name || "").trim()); } catch {}
    }

    // DO NOT clear vendor if no params (we want it to persist)
    hydrateVendorBadge();
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

    try { localStorage
