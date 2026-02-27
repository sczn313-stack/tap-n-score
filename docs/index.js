/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   MATRIX + SQUARE PLANE + Instruction mirroring (Aim ↔ Holes)
   + iOS-safe photo input
   + Vendor pill wired by QR params (?v=...&sku=...&b=...)
   + Vendor pill shows VENDOR NAME and flips every ~1.5s
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
  const elSwapSizeBtn = $("swapSizeBtn");

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";

  // Vendor keys
  const KEY_VENDOR_URL  = "SCZN3_VENDOR_URL_V1";
  const KEY_VENDOR_NAME = "SCZN3_VENDOR_NAME_V1";
  const KEY_VENDOR_SLUG = "SCZN3_VENDOR_SLUG_V1";
  const KEY_VENDOR_SKU  = "SCZN3_VENDOR_SKU_V1";
  const KEY_VENDOR_BATCH= "SCZN3_VENDOR_BATCH_V1";

  // Distance keys
  const KEY_DIST_UNIT = "SCZN3_RANGE_UNIT_V1"; // "YDS" | "M"
  const KEY_DIST_YDS  = "SCZN3_RANGE_YDS_V1";  // numeric yards

  // Target size persistence
  const KEY_TARGET_SIZE = "SCZN3_TARGET_SIZE_KEY_V1";
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
  // ✅ Vendor helpers (name + rotate)
  // ------------------------------------------------------------
  function domainFromUrl(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
  }
  function vendorNameFromUrl(u) {
    const d = domainFromUrl(u || "");
    if (d.includes("bakertargets.com")) return "BAKER TARGETS";
    if (d.includes("baker")) return "BAKER";
    return "VENDOR";
  }

  function stopVendorRotate() {
    if (vendorRotateTimer) clearInterval(vendorRotateTimer);
    vendorRotateTimer = null;
  }

  function startVendorRotate(primaryText) {
    stopVendorRotate();
    if (!elVendorLabel) return;

    const a = String(primaryText || "VENDOR");
    const b = "BUY MORE TARGETS LIKE THIS";

    let flip = false;
    elVendorLabel.textContent = a;

    vendorRotateTimer = setInterval(() => {
      flip = !flip;
      elVendorLabel.textContent = flip ? b : a;
    }, 1500);
  }

  function hydrateVendorBox() {
    const url = localStorage.getItem(KEY_VENDOR_URL) || "";
    const name = localStorage.getItem(KEY_VENDOR_NAME) || vendorNameFromUrl(url);

    const ok = typeof url === "string" && url.startsWith("http");

    if (!elVendorBox) return;

    if (ok) {
      elVendorBox.href = url;
      elVendorBox.target = "_blank";
      elVendorBox.rel = "noopener";
      elVendorBox.style.pointerEvents = "auto";
      elVendorBox.style.opacity = "1";
      startVendorRotate(name);
    } else {
      elVendorBox.removeAttribute("href");
      elVendorBox.removeAttribute("target");
      elVendorBox.removeAttribute("rel");
      elVendorBox.style.pointerEvents = "none";
      elVendorBox.style.opacity = ".92";
      if (elVendorLabel) elVendorLabel.textContent = "VENDOR";
      stopVendorRotate();
    }
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

  function vendorUrlFromParams() {
    const p = getParams();

    const slug = normalizeSlug(p.get("v"));
    const sku  = String(p.get("sku") || "").trim().toLowerCase();
    const batch= String(p.get("b") || "").trim().toLowerCase();

    if (slug)  { try { localStorage.setItem(KEY_VENDOR_SLUG, slug); } catch {} }
    if (sku)   { try { localStorage.setItem(KEY_VENDOR_SKU, sku); } catch {} }
    if (batch) { try { localStorage.setItem(KEY_VENDOR_BATCH, batch); } catch {} }

    const VENDOR_REGISTRY = {
      baker: {
        name: "BAKER TARGETS",
        defaultUrl: "https://bakertargets.com/product/100-yard-bulls-eye-rifle-target-smart-target-version"
      }
    };

    if (!slug) return null;
    const entry = VENDOR_REGISTRY[slug];
    if (!entry) return null;

    // Future: per-SKU mapping here
    return entry.defaultUrl || null;
  }

  function vendorNameFromParams() {
    const p = getParams();
    const slug = normalizeSlug(p.get("v"));
    const map = { baker: "BAKER TARGETS" };
    return map[slug] || "";
  }

  function applyVendorFromQr() {
    const url = vendorUrlFromParams();
    const name = vendorNameFromParams();

    if (url && url.startsWith("http")) {
      try { localStorage.setItem(KEY_VENDOR_URL, url); } catch {}
      try { localStorage.setItem(KEY_VENDOR_NAME, name || vendorNameFromUrl(url)); } catch {}
    }

    hydrateVendorBox();
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

    if (elLiveTarget) {
      const label = (targetSizeKey || "").replace("x", "×");
      elLiveTarget.textContent = label || "—";
    }
  }

  // ------------------------------------------------------------
  // Matrix drawer
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

  function toggleMatrix() { isMatrixOpen() ? closeMatrix() : openMatrix(); }

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

    const dx = aim.x01 - avg.x; // + means move RIGHT
    const dy = aim.y01 - avg.y; // + means move DOWN (screen y)

    const squareIn = Math.min(targetWIn, targetHIn);
    const inchesX = dx * squareIn;
    const inchesY = dy * squareIn;
    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    const dist = getDistanceYds();
    const inchesPerUnit = (dialUnit === "MOA")
      ? (dist / 100) * 1.047
      : (dist / 100) * 3.6; // pilot

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
    window.location.href = `./sec.html?from=target&payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function onShowResults() {
    const out = computeCorrectionAndScore();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one bullet hole.");
      return;
    }

    const vendorUrl = localStorage.getItem(KEY_VENDOR_URL) || "";
    const vendorName = localStorage.getItem(KEY_VENDOR_NAME) || vendorNameFromUrl(vendorUrl);

    const payload = {
      sessionId: "S-" + Date.now(),
      score: out.score,
      shots: hits.length,
      windage: { dir: out.windage.dir, clicks: Number(out.windage.clicks.toFixed(2)) },
      elevation: { dir: out.elevation.dir, clicks: Number(out.elevation.clicks.toFixed(2)) },
      dial: { unit: out.dial.unit, clickValue: Number(out.dial.clickValue.toFixed(2)) },
      vendorUrl,
      vendorName,
      surveyUrl: "",
      target: { key: targetSizeKey, wIn: Number(targetWIn), hIn: Number(targetHIn) },
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

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  setUnit("MOA");
  closeMatrix();
  hideSticky();
  resetAll();

  // ✅ Apply vendor FIRST so the landing pill is live immediately
  applyVendorFromQr();

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
