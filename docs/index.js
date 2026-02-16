/* ============================================================
   docs/index.js (FULL REPLACEMENT)
   - Adds Target Type: GRID vs SILHOUETTE
   - SILHOUETTE mode uses 5-inch anchor (two taps) to scale inches
   - No instruction overlays on target (instructions mirrored in lines only)
   - Uses image natural pixels so pinch/zoom doesn't break scale
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

  // Target type chips
  const elTypeChipRow = $("typeChipRow");
  const elTypeMicro = $("typeMicro");

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_DIST_UNIT = "SCZN3_RANGE_UNIT_V1"; // "YDS" | "M"
  const KEY_DIST_YDS = "SCZN3_RANGE_YDS_V1";   // numeric (yards)

  // Target size persistence
  const KEY_TARGET_SIZE = "SCZN3_TARGET_SIZE_KEY_V1"; // e.g., "23x35" or "custom"
  const KEY_TARGET_W = "SCZN3_TARGET_W_IN_V1";
  const KEY_TARGET_H = "SCZN3_TARGET_H_IN_V1";

  // Target type persistence
  const KEY_TARGET_TYPE = "SCZN3_TARGET_TYPE_V1"; // "grid" | "silhouette"
  const KEY_ANCHOR_IN = "SCZN3_SIL_ANCHOR_IN_V1"; // numeric inches (default 5)

  let objectUrl = null;

  // taps/state
  let aim = null;         // {x01,y01,xPx,yPx}
  let hits = [];          // [{x01,y01,xPx,yPx}, ...]
  let anchorA = null;     // silhouette only
  let anchorB = null;     // silhouette only

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

  // target type
  let targetType = "grid"; // "grid" | "silhouette"
  let anchorIn = 5;        // inches

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

  // pop/fade animation trigger (needs .tnsPulse in livebar_fix.css)
  function pulse(el){
    if (!el) return;
    el.classList.remove("tnsPulse");
    void el.offsetWidth;
    el.classList.add("tnsPulse");
  }

  // ------------------------------------------------------------
  // Mirrored instruction line (statusLine + instructionLine)
  // ------------------------------------------------------------
  function setInstruction(text, kind) {
    const t = text || "";

    let color = "rgba(238,242,247,.65)";
    if (kind === "aim")   color = "rgba(103,243,164,.95)"; // green
    if (kind === "holes") color = "rgba(183,255,60,.95)";  // lime
    if (kind === "go")    color = "rgba(47,102,255,.92)";  // blue

    if (elInstruction) {
      elInstruction.textContent = t;
      elInstruction.style.color = color;
    }

    if (elStatus) {
      elStatus.textContent = t || (elImg?.src ? "" : "Add a target photo to begin.");
      elStatus.style.color = t ? color : "rgba(238,242,247,.65)";
    }

    if (t) {
      pulse(elStatus);
      pulse(elInstruction);
    }
  }

  function setStage(stage) {
    if (elWrap) elWrap.setAttribute("data-stage", stage);
  }

  function syncInstruction() {
    if (!elImg?.src) {
      setInstruction("Add a target photo to begin.", "");
      setStage("noimg");
      return;
    }

    if (targetType === "silhouette") {
      if (!anchorA) {
        setInstruction(`Tap 5-inch anchor (start).`, "aim");
        setStage("anchorA");
        return;
      }
      if (!anchorB) {
        setInstruction(`Tap 5-inch anchor (end).`, "aim");
        setStage("anchorB");
        return;
      }
    }

    if (!aim) {
      setInstruction("Tap Aim Point.", "aim");
      setStage("aim");
      return;
    }

    setInstruction("Tap Bullet Holes.", "holes");
    setStage("holes");
  }

  function resetAll() {
    aim = null;
    hits = [];
    anchorA = null;
    anchorB = null;
    touchStart = null;

    if (elDots) elDots.innerHTML = "";
    setTapCount();
    hideSticky();
    closeMatrix();

    syncInstruction();
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

    const isAim = kind === "aim";
    const isHit = kind === "hit";
    const isAnchor = kind === "anchor";

    d.className = "tapDot " + (isAim ? "tapDotAim" : (isHit ? "tapDotHit" : "tapDotHit"));
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";

    // colors:
    // aim = green, hit = lime, anchor = blue
    const c = isAim ? "#67f3a4" : (isAnchor ? "#2f66ff" : "#b7ff3c");
    d.style.background = c;
    d.style.border = "2px solid rgba(0,0,0,.55)";
    d.style.boxShadow = "0 10px 28px rgba(0,0,0,.55)";
    elDots.appendChild(d);
  }

  function getTapPoint(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const x01 = clamp01((clientX - r.left) / r.width);
    const y01 = clamp01((clientY - r.top) / r.height);

    // map to natural pixels (stable against zoom/pinch)
    const nw = elImg.naturalWidth || 1;
    const nh = elImg.naturalHeight || 1;
    const xPx = x01 * nw;
    const yPx = y01 * nh;

    return { x01, y01, xPx, yPx };
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
  // Target size: 6 presets + Custom + Swap
  // ------------------------------------------------------------
  const PRESET_SIZES = {
    "8.5x11": { w: 8.5, h: 11 },
    "11x17":  { w: 11,  h: 17 },
    "12x18":  { w: 12,  h: 18 },
    "18x24":  { w: 18,  h: 24 },
    "23x35":  { w: 23,  h: 35 },
    "24x36":  { w: 24,  h: 36 },
  };

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

    if (PRESET_SIZES[key]) {
      setTargetSize(key, PRESET_SIZES[key].w, PRESET_SIZES[key].h);
      return;
    }

    const w = clampInches(localStorage.getItem(KEY_TARGET_W) || "23", 23);
    const h = clampInches(localStorage.getItem(KEY_TARGET_H) || "35", 35);
    setTargetSize("custom", w, h);
  }

  function wireTargetSizeChips() {
    if (!elSizeChipRow) return;
    const chips = Array.from(elSizeChipRow.querySelectorAll("[data-size]"));

    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-size") || "23x35";

        if (key === "custom") {
          const curW = Number(targetWIn);
          const curH = Number(targetHIn);

          const wStr = prompt("Custom width (inches):", String(curW));
          if (wStr === null) return;

          const hStr = prompt("Custom height (inches):", String(curH));
          if (hStr === null) return;

          const w = clampInches(wStr, curW);
          const h = clampInches(hStr, curH);

          setTargetSize("custom", w, h);
          closeMatrix();
          return;
        }

        if (PRESET_SIZES[key]) {
          setTargetSize(key, PRESET_SIZES[key].w, PRESET_SIZES[key].h);
          closeMatrix();
        }
      });
    });

    elSwapSizeBtn?.addEventListener("click", () => {
      const w = Number(targetWIn);
      const h = Number(targetHIn);

      const nw = h;
      const nh = w;

      const presetKey = Object.keys(PRESET_SIZES).find(k => {
        const p = PRESET_SIZES[k];
        return Math.abs(p.w - nw) < 0.0001 && Math.abs(p.h - nh) < 0.0001;
      });

      if (presetKey) setTargetSize(presetKey, nw, nh);
      else setTargetSize("custom", nw, nh);

      closeMatrix();
    });
  }

  // ------------------------------------------------------------
  // Target type (GRID vs SILHOUETTE)
  // ------------------------------------------------------------
  function highlightTypeChips() {
    if (!elTypeChipRow) return;
    const chips = Array.from(elTypeChipRow.querySelectorAll("[data-type]"));
    chips.forEach((c) => {
      const k = c.getAttribute("data-type") || "grid";
      c.classList.toggle("chipOn", k === targetType);
    });
  }

  function setTargetType(t) {
    targetType = (t === "silhouette") ? "silhouette" : "grid";
    try { localStorage.setItem(KEY_TARGET_TYPE, targetType); } catch {}

    if (elTypeMicro) {
      elTypeMicro.textContent =
        targetType === "silhouette"
          ? `Silhouette targets use a 5-inch anchor (2 taps) for true inches.`
          : `Grid targets use your selected size for inches math.`;
    }

    highlightTypeChips();

    // changing type resets tap flow (so users don't mix modes mid-stream)
    if (elImg?.src) resetAll();
    else syncInstruction();
  }

  function hydrateTargetType() {
    targetType = (localStorage.getItem(KEY_TARGET_TYPE) === "silhouette") ? "silhouette" : "grid";
    anchorIn = clampInches(localStorage.getItem(KEY_ANCHOR_IN) || "5", 5);
    setTargetType(targetType);
  }

  function wireTargetTypeChips() {
    if (!elTypeChipRow) return;
    const chips = Array.from(elTypeChipRow.querySelectorAll("[data-type]"));
    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-type") || "grid";
        setTargetType(t);
        closeMatrix();
      });
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
      if (targetSizeKey === "custom") {
        elLiveTarget.textContent = `${Number(targetWIn).toFixed(2)}×${Number(targetHIn).toFixed(2)}`;
      } else {
        elLiveTarget.textContent = (targetSizeKey || "").replace("x", "×");
      }
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

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.xPx, y: acc.y + p.yPx }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    // dx,dy in pixels: correction vector = aim - avgPoi
    const dxPx = aim.xPx - avg.x; // + means move RIGHT
    const dyPx = aim.yPx - avg.y; // + means move DOWN (screen y)

    let inchesX = 0;
    let inchesY = 0;

    if (targetType === "silhouette") {
      if (!anchorA || !anchorB) return null;
      const adx = anchorB.xPx - anchorA.xPx;
      const ady = anchorB.yPx - anchorA.yPx;
      const distPx = Math.sqrt(adx*adx + ady*ady);

      if (!Number.isFinite(distPx) || distPx <= 1) return null;

      const inchesPerPx = anchorIn / distPx;
      inchesX = dxPx * inchesPerPx;
      inchesY = dyPx * inchesPerPx;
    } else {
      // GRID mode: use square plane = min(w,h)
      const squareIn = Math.min(targetWIn, targetHIn);
      // Convert px delta to normalized delta using natural dims, then to inches
      const nw = elImg.naturalWidth || 1;
      const nh = elImg.naturalHeight || 1;
      const dx01 = dxPx / nw;
      const dy01 = dyPx / nh;
      inchesX = dx01 * squareIn;
      inchesY = dy01 * squareIn;
    }

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
      avgPoiPx: { xPx: avg.x, yPx: avg.y },
      inches: { x: inchesX, y: inchesY, r: rIn },
      score: scoreFromRadiusInches(rIn),
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
      dial: { unit: dialUnit, clickValue: clickVal },
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
    if (!out) {
      if (targetType === "silhouette" && (!anchorA || !anchorB)) {
        alert("Silhouette mode: tap the 5-inch anchor (two taps), then aim point, then bullet holes.");
        return;
      }
      alert("Tap Aim Point first, then tap at least one bullet hole.");
      return;
    }

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
      target: { key: targetSizeKey, wIn: Number(targetWIn), hIn: Number(targetHIn), type: targetType, anchorIn },

      debug: {
        type: targetType,
        anchorIn,
        anchorA,
        anchorB,
        aim,
        hits,
        distanceYds: getDistanceYds(),
        inches: out.inches,
        avgPoiPx: out.avgPoiPx
      }
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
      syncInstruction();
      revealScoringUI();
    };

    elImg.onerror = () => {
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

    const pt = getTapPoint(clientX, clientY);

    // silhouette: collect anchor first
    if (targetType === "silhouette") {
      if (!anchorA) {
        anchorA = pt;
        addDot(pt.x01, pt.y01, "anchor");
        hideSticky();
        syncInstruction();
        return;
      }
      if (!anchorB) {
        anchorB = pt;
        addDot(pt.x01, pt.y01, "anchor");
        hideSticky();
        syncInstruction();
        return;
      }
    }

    // aim first (both modes)
    if (!aim) {
      aim = pt;
      addDot(pt.x01, pt.y01, "aim");
      hideSticky();
      syncInstruction();
      return;
    }

    hits.push(pt);
    addDot(pt.x01, pt.y01, "hit");
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
      acceptTap(e.clientX, tClientYSafe(e));
    }, { passive: true });
  }

  function tClientYSafe(e){
    // guard for odd click event shapes
    return typeof e.clientY === "number" ? e.clientY : 0;
  }

  // ------------------------------------------------------------
  // Buttons
  // ------------------------------------------------------------
  elClear?.addEventListener("click", () => {
    resetAll();
    if (elImg?.src) syncInstruction();
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

  hydrateVendorBox();
  hydrateRange();
  hydrateTargetSize();
  hydrateTargetType();

  wireMatrixPresets();
  wireTargetSizeChips();
  wireTargetTypeChips();

  highlightSizeChip();
  highlightTypeChips();
  syncLiveTop();

  hardHideScoringUI();
  forceTop();
})();
