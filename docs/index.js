(() => {
  const $ = (id) => document.getElementById(id);

  const elPhotoBtn = $("photoBtn");
  const elPhotoInput = $("photoInput");
  const elVendorBox = $("vendorBox");
  const elVendorLabel = $("vendorLabel");
  const elVendorPanel = $("vendorPanel");
  const elVendorPanelLink = $("vendorPanelLink");

  const elScoreSection = $("scoreSection");
  const elLiveDistance = $("liveDistance");
  const elLiveDial = $("liveDial");
  const elLiveTarget = $("liveTarget");
  const elLiveProfile = $("liveProfile");

  const elProfileTitle = $("profileTitle");
  const elProfileSubtitle = $("profileSubtitle");

  const elMatrixBtn = $("matrixBtn");
  const elMatrixPanel = $("matrixPanel");
  const elMatrixCloseBtn = $("matrixCloseBtn");

  const elDistDown = $("distDown");
  const elDistUp = $("distUp");
  const elDistanceYds = $("distanceYds");
  const elDistUnitYd = $("distUnitYd");
  const elDistUnitM = $("distUnitM");
  const elDistUnitLabel = $("distUnitLabel");

  const elUnitMoa = $("unitMoa");
  const elUnitMrad = $("unitMrad");
  const elClickValue = $("clickValue");
  const elClickUnitLabel = $("clickUnitLabel");

  const elSizeChipRow = $("sizeChipRow");
  const elSwapSizeBtn = $("swapSizeBtn");

  const elTargetWrap = $("targetWrap");
  const elTargetImg = $("targetImg");
  const elDotsLayer = $("dotsLayer");

  const elTapCount = $("tapCount");
  const elClearTapsBtn = $("clearTapsBtn");
  const elShowResultsBtn = $("showResultsBtn");
  const elInstructionLine = $("instructionLine");
  const elStatusLine = $("statusLine");

  const elStickyBar = $("stickyBar");
  const elStickyResultsBtn = $("stickyResultsBtn");

  const STORAGE = {
    payload: "SCZN3_SEC_PAYLOAD_V1",
    targetImgData: "SCZN3_TARGET_IMG_DATAURL_V1",
    targetImgBlob: "SCZN3_TARGET_IMG_BLOBURL_V1",
    vendorUrl: "SCZN3_VENDOR_URL_V1",
    vendorName: "SCZN3_VENDOR_NAME_V1",
    distUnit: "SCZN3_RANGE_UNIT_V1",
    distYds: "SCZN3_RANGE_YDS_V1",
    targetSize: "SCZN3_TARGET_SIZE_KEY_V1",
    targetW: "SCZN3_TARGET_W_IN_V1",
    targetH: "SCZN3_TARGET_H_IN_V1"
  };

  const DEFAULTS = {
    dialUnit: "MOA",
    clickMOA: 0.25,
    clickMRAD: 0.10,
    rangeUnit: "YDS",
    rangeYds: 100,
    targetSizeKey: "23x35",
    targetWIn: 23,
    targetHIn: 35
  };

  const PROFILE = {
    id: "zero",
    title: "Precision Zero",
    subtitle: "Tap aim point, then impacts."
  };

  let objectUrl = null;
  let aim = null;
  let hits = [];
  let lastTouchTapAt = 0;
  let touchStart = null;
  let pauseTimer = null;
  let runStartedAt = 0;

  let dialUnit = DEFAULTS.dialUnit;
  let rangeUnit = DEFAULTS.rangeUnit;
  let rangeYds = DEFAULTS.rangeYds;
  let targetSizeKey = DEFAULTS.targetSizeKey;
  let targetWIn = DEFAULTS.targetWIn;
  let targetHIn = DEFAULTS.targetHIn;

  function nowTs() {
    return Date.now();
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function clampRangeYds(v) {
    let n = Number(v);
    if (!Number.isFinite(n)) n = DEFAULTS.rangeYds;
    n = Math.round(n);
    return Math.max(1, Math.min(5000, n));
  }

  function clampInches(v, fallback) {
    let n = Number(v);
    if (!Number.isFinite(n) || n <= 0) n = fallback;
    return Math.max(1, Math.min(200, n));
  }

  function ydsToM(yds) {
    return yds * 0.9144;
  }

  function mToYds(m) {
    return m / 0.9144;
  }

  function getClickValue() {
    let n = Number(elClickValue?.value);
    if (!Number.isFinite(n) || n <= 0) {
      n = dialUnit === "MRAD" ? DEFAULTS.clickMRAD : DEFAULTS.clickMOA;
      if (elClickValue) elClickValue.value = String(n.toFixed(2));
    }
    return Math.max(0.01, Math.min(5, n));
  }

  function setStatus(text) {
    if (elStatusLine) elStatusLine.textContent = text;
  }

  function setInstruction(text) {
    if (elInstructionLine) elInstructionLine.textContent = text;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(hits.length);
  }

  function hideSticky() {
    elStickyBar?.classList.add("stickyHidden");
    elStickyBar?.setAttribute("aria-hidden", "true");
  }

  function showSticky() {
    elStickyBar?.classList.remove("stickyHidden");
    elStickyBar?.setAttribute("aria-hidden", "false");
  }

  function scheduleSticky() {
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      if (hits.length >= 1) showSticky();
    }, 650);
  }

  function revealScoring() {
    elScoreSection?.classList.remove("scoreHidden");
  }

  function closeMatrix() {
    elMatrixPanel?.classList.add("matrixHidden");
    elMatrixPanel?.setAttribute("aria-hidden", "true");
  }

  function openMatrix() {
    elMatrixPanel?.classList.remove("matrixHidden");
    elMatrixPanel?.setAttribute("aria-hidden", "false");
  }

  function toggleMatrix() {
    if (!elMatrixPanel) return;
    if (elMatrixPanel.classList.contains("matrixHidden")) openMatrix();
    else closeMatrix();
  }

  function closeVendorPanel() {
    elVendorPanel?.classList.remove("vendorOpen");
    elVendorPanel?.setAttribute("aria-hidden", "true");
  }

  function toggleVendorPanel() {
    if (!elVendorPanel) return;
    const open = elVendorPanel.classList.contains("vendorOpen");
    if (open) closeVendorPanel();
    else {
      elVendorPanel.classList.add("vendorOpen");
      elVendorPanel.setAttribute("aria-hidden", "false");
    }
  }

  function clearDots() {
    if (elDotsLayer) elDotsLayer.innerHTML = "";
  }

  function addDot(x01, y01, kind) {
    if (!elDotsLayer) return;
    const d = document.createElement("div");
    d.className = "tapDot";
    d.style.left = `${x01 * 100}%`;
    d.style.top = `${y01 * 100}%`;
    d.style.background = kind === "aim" ? "#48ff8b" : "#b7ff3c";
    d.style.border = "2px solid rgba(0,0,0,.55)";
    d.style.boxShadow = "0 8px 22px rgba(0,0,0,.45)";
    elDotsLayer.appendChild(d);
  }

  function getRelative01(clientX, clientY) {
    const r = elTargetWrap?.getBoundingClientRect();
    if (!r || r.width <= 1 || r.height <= 1) return { x01: 0.5, y01: 0.5 };
    return {
      x01: clamp01((clientX - r.left) / r.width),
      y01: clamp01((clientY - r.top) / r.height)
    };
  }

  function setProfileUi() {
    if (elLiveProfile) elLiveProfile.textContent = "ZERO";
    if (elProfileTitle) elProfileTitle.textContent = PROFILE.title;
    if (elProfileSubtitle) elProfileSubtitle.textContent = PROFILE.subtitle;
  }

  function syncRangeInputFromInternal() {
    if (!elDistanceYds) return;
    elDistanceYds.value = rangeUnit === "M"
      ? String(Math.round(ydsToM(rangeYds)))
      : String(rangeYds);
  }

  function syncInternalFromRangeInput() {
    if (!elDistanceYds) return;
    let n = Number(elDistanceYds.value);
    if (!Number.isFinite(n)) {
      n = rangeUnit === "M" ? Math.round(ydsToM(rangeYds)) : rangeYds;
    }
    rangeYds = rangeUnit === "M" ? clampRangeYds(mToYds(n)) : clampRangeYds(n);
    localStorage.setItem(STORAGE.distYds, String(rangeYds));
    syncRangeInputFromInternal();
    syncLiveTop();
  }

  function setRangeUnit(unit) {
    rangeUnit = unit === "M" ? "M" : "YDS";
    localStorage.setItem(STORAGE.distUnit, rangeUnit);

    elDistUnitYd?.classList.toggle("segOn", rangeUnit === "YDS");
    elDistUnitM?.classList.toggle("segOn", rangeUnit === "M");
    if (elDistUnitLabel) elDistUnitLabel.textContent = rangeUnit === "M" ? "m" : "yds";

    syncRangeInputFromInternal();
    syncLiveTop();
  }

  function bumpRange(stepYds) {
    rangeYds = clampRangeYds(rangeYds + stepYds);
    localStorage.setItem(STORAGE.distYds, String(rangeYds));
    syncRangeInputFromInternal();
    syncLiveTop();
  }

  function setDialUnit(unit) {
    dialUnit = unit === "MRAD" ? "MRAD" : "MOA";

    elUnitMoa?.classList.toggle("segOn", dialUnit === "MOA");
    elUnitMrad?.classList.toggle("segOn", dialUnit === "MRAD");

    const def = dialUnit === "MRAD" ? DEFAULTS.clickMRAD : DEFAULTS.clickMOA;
    if (elClickValue) elClickValue.value = String(def.toFixed(2));
    if (elClickUnitLabel) elClickUnitLabel.textContent = dialUnit === "MRAD" ? "MRAD/click" : "MOA/click";

    syncLiveTop();
  }

  function setTargetSize(key, w, h) {
    targetSizeKey = key || DEFAULTS.targetSizeKey;
    targetWIn = clampInches(w, DEFAULTS.targetWIn);
    targetHIn = clampInches(h, DEFAULTS.targetHIn);

    localStorage.setItem(STORAGE.targetSize, targetSizeKey);
    localStorage.setItem(STORAGE.targetW, String(targetWIn));
    localStorage.setItem(STORAGE.targetH, String(targetHIn));

    const chips = Array.from(elSizeChipRow?.querySelectorAll("[data-size]") || []);
    chips.forEach((chip) => {
      chip.classList.toggle("chipOn", (chip.getAttribute("data-size") || "") === targetSizeKey);
    });

    syncLiveTop();
  }

  function hydrateTargetSize() {
    const key = localStorage.getItem(STORAGE.targetSize) || DEFAULTS.targetSizeKey;
    const presets = {
      "8.5x11": { w: 8.5, h: 11 },
      "11x17": { w: 11, h: 17 },
      "12x18": { w: 12, h: 18 },
      "18x24": { w: 18, h: 24 },
      "23x35": { w: 23, h: 35 },
      "24x36": { w: 24, h: 36 }
    };
    const p = presets[key] || {
      w: clampInches(localStorage.getItem(STORAGE.targetW), DEFAULTS.targetWIn),
      h: clampInches(localStorage.getItem(STORAGE.targetH), DEFAULTS.targetHIn)
    };
    setTargetSize(key, p.w, p.h);
  }

  function hydrateRange() {
    rangeYds = clampRangeYds(localStorage.getItem(STORAGE.distYds) || DEFAULTS.rangeYds);
    const savedUnit = localStorage.getItem(STORAGE.distUnit) || DEFAULTS.rangeUnit;
    setRangeUnit(savedUnit);
  }

  function syncLiveTop() {
    if (elLiveDistance) {
      elLiveDistance.textContent = rangeUnit === "M"
        ? `${Math.round(ydsToM(rangeYds))} m`
        : `${rangeYds} yds`;
    }
    if (elLiveDial) {
      elLiveDial.textContent = `${getClickValue().toFixed(2)} ${dialUnit}`;
    }
    if (elLiveTarget) {
      elLiveTarget.textContent = (targetSizeKey || "").replace("x", "×");
    }
    setProfileUi();
  }

  function resetAll() {
    aim = null;
    hits = [];
    runStartedAt = 0;
    touchStart = null;
    clearDots();
    setTapCount();
    hideSticky();
    setInstruction("");
    setStatus(elTargetImg?.src ? "Tap Aim Point." : "Add a target photo to begin.");
    closeMatrix();
    closeVendorPanel();
  }

  function ensureRunStarted() {
    if (!runStartedAt) runStartedAt = nowTs();
  }

  async function storeTargetPhotoForSEC(file, blobUrl) {
    try { localStorage.setItem(STORAGE.targetImgBlob, blobUrl); } catch {}
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      if (dataUrl && dataUrl.startsWith("data:image/")) {
        localStorage.setItem(STORAGE.targetImgData, dataUrl);
      }
    } catch {}
  }

  function computeCorrectionAndScore() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => {
      acc.x += p.x01;
      acc.y += p.y01;
      return acc;
    }, { x: 0, y: 0 });

    avg.x /= hits.length;
    avg.y /= hits.length;

    const dx = aim.x01 - avg.x;
    const dy = aim.y01 - avg.y;

    const squareIn = Math.min(targetWIn, targetHIn);
    const inchesX = dx * squareIn;
    const inchesY = dy * squareIn;
    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    let score = 50;
    if (rIn <= 0.25) score = 100;
    else if (rIn <= 0.50) score = 95;
    else if (rIn <= 1.00) score = 90;
    else if (rIn <= 1.50) score = 85;
    else if (rIn <= 2.00) score = 80;
    else if (rIn <= 2.50) score = 75;
    else if (rIn <= 3.00) score = 70;
    else if (rIn <= 3.50) score = 65;
    else if (rIn <= 4.00) score = 60;

    const inchesPerUnit = dialUnit === "MOA"
      ? (rangeYds / 100) * 1.047
      : (rangeYds / 100) * 3.6;

    const unitX = inchesX / inchesPerUnit;
    const unitY = inchesY / inchesPerUnit;
    const clickVal = getClickValue();
    const clicksX = unitX / clickVal;
    const clicksY = unitY / clickVal;

    return {
      score,
      avgPoi: { x01: avg.x, y01: avg.y },
      windage: {
        dir: clicksX >= 0 ? "RIGHT" : "LEFT",
        clicks: Math.abs(clicksX)
      },
      elevation: {
        dir: clicksY >= 0 ? "DOWN" : "UP",
        clicks: Math.abs(clicksY)
      },
      inches: { x: inchesX, y: inchesY, r: rIn },
      squareIn,
      dial: { unit: dialUnit, clickValue: clickVal }
    };
  }

  function savePayloadAndGo(out) {
    const payload = {
      sessionId: `S-${nowTs()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: "zero",
      profileId: "zero",
      profileName: PROFILE.title,
      distanceYds: rangeYds,
      target: {
        key: targetSizeKey,
        wIn: Number(targetWIn),
        hIn: Number(targetHIn)
      },
      runStartedAt,
      runCompletedAt: nowTs(),
      runDurationSec: runStartedAt ? Math.max(0, Math.round((nowTs() - runStartedAt) / 1000)) : 0,
      score: out.score,
      taps: hits.length,
      shots: hits.length,
      windage: {
        dir: out.windage.dir,
        clicks: Number(out.windage.clicks.toFixed(2))
      },
      elevation: {
        dir: out.elevation.dir,
        clicks: Number(out.elevation.clicks.toFixed(2))
      },
      dial: {
        unit: out.dial.unit,
        clickValue: Number(out.dial.clickValue.toFixed(2))
      },
      vendorUrl: localStorage.getItem(STORAGE.vendorUrl) || "",
      vendorName: localStorage.getItem(STORAGE.vendorName) || "",
      surveyUrl: "",
      debug: {
        aim,
        hits,
        avgPoi: out.avgPoi,
        distanceYds: rangeYds,
        inches: out.inches,
        squareIn: out.squareIn
      }
    };

    try {
      localStorage.setItem(STORAGE.payload, JSON.stringify(payload));
    } catch {}

    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    window.location.href = `./sec.html?from=target&payload=${encodeURIComponent(encoded)}&fresh=${Date.now()}`;
  }

  function onShowResults() {
    const out = computeCorrectionAndScore();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one bullet hole.");
      return;
    }
    savePayloadAndGo(out);
  }

  function acceptTap(clientX, clientY) {
    if (!elTargetImg?.src) return;
    ensureRunStarted();

    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setStatus("Tap Bullet Holes.");
      setInstruction("Tap Bullet Holes.");
      hideSticky();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    setTapCount();
    setInstruction("Tap Bullet Holes.");
    hideSticky();
    scheduleSticky();
  }

  function setupVendor() {
    if (elVendorLabel) elVendorLabel.textContent = "BUY MORE TARGETS LIKE THIS";

    const params = new URLSearchParams(window.location.search);
    const vendor = (params.get("v") || "").toLowerCase();

    if (vendor === "baker") {
      localStorage.setItem(STORAGE.vendorName, "BAKER TARGETS");
    }

    const vendorUrl = localStorage.getItem(STORAGE.vendorUrl) || "#";
    if (elVendorPanelLink) {
      elVendorPanelLink.href = vendorUrl;
      if (!vendorUrl.startsWith("http")) {
        elVendorPanelLink.style.pointerEvents = "none";
        elVendorPanelLink.style.opacity = ".65";
      }
    }

    elVendorBox?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleVendorPanel();
    });

    document.addEventListener("click", (e) => {
      if (!elVendorPanel || !elVendorBox) return;
      const inPanel = elVendorPanel.contains(e.target);
      const inPill = elVendorBox.contains(e.target);
      if (!inPanel && !inPill) closeVendorPanel();
    }, { capture: true });
  }

  function setupImageInput() {
    elPhotoBtn?.addEventListener("click", () => elPhotoInput?.click());

    elPhotoInput?.addEventListener("change", async () => {
      const file = elPhotoInput.files?.[0];
      if (!file) return;

      resetAll();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);

      await storeTargetPhotoForSEC(file, objectUrl);

      elTargetImg.onload = () => {
        runStartedAt = nowTs();
        setStatus("Tap Aim Point.");
        setInstruction("Tap Aim Point.");
        revealScoring();
      };

      elTargetImg.onerror = () => {
        setStatus("Photo failed to load.");
        setInstruction("Try again.");
        revealScoring();
      };

      elTargetImg.src = objectUrl;
      elPhotoInput.value = "";
    });
  }

  function setupTapArea() {
    if (!elTargetWrap) return;

    elTargetWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) {
        touchStart = null;
        return;
      }
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    elTargetWrap.addEventListener("touchend", (e) => {
      const t = e.changedTouches?.[0];
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);
      if (dx > 10 || dy > 10) {
        touchStart = null;
        return;
      }

      lastTouchTapAt = nowTs();
      acceptTap(t.clientX, t.clientY);
      touchStart = null;
    }, { passive: true });

    elTargetWrap.addEventListener("click", (e) => {
      if (nowTs() - lastTouchTapAt < 800) return;
      acceptTap(e.clientX, e.clientY);
    }, { passive: true });
  }

  function setupMatrix() {
    elMatrixBtn?.addEventListener("click", toggleMatrix);
    elMatrixCloseBtn?.addEventListener("click", closeMatrix);

    document.addEventListener("click", (e) => {
      if (!elMatrixPanel || elMatrixPanel.classList.contains("matrixHidden")) return;
      const inside = elMatrixPanel.contains(e.target);
      const isBtn = e.target === elMatrixBtn || e.target.closest?.("#matrixBtn");
      if (!inside && !isBtn) closeMatrix();
    }, { capture: true });

    elDistDown?.addEventListener("click", () => bumpRange(-5));
    elDistUp?.addEventListener("click", () => bumpRange(5));
    elDistanceYds?.addEventListener("change", syncInternalFromRangeInput);
    elDistanceYds?.addEventListener("blur", syncInternalFromRangeInput);

    elDistUnitYd?.addEventListener("click", () => setRangeUnit("YDS"));
    elDistUnitM?.addEventListener("click", () => setRangeUnit("M"));

    elUnitMoa?.addEventListener("click", () => setDialUnit("MOA"));
    elUnitMrad?.addEventListener("click", () => setDialUnit("MRAD"));

    elClickValue?.addEventListener("blur", syncLiveTop);
    elClickValue?.addEventListener("change", syncLiveTop);

    const chips = Array.from(elSizeChipRow?.querySelectorAll("[data-size]") || []);
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-size") || DEFAULTS.targetSizeKey;
        if (key === "custom") {
          setTargetSize("custom", targetWIn, targetHIn);
          return;
        }
        const w = Number(chip.getAttribute("data-w") || targetWIn);
        const h = Number(chip.getAttribute("data-h") || targetHIn);
        setTargetSize(key, w, h);
      });
    });

    elSwapSizeBtn?.addEventListener("click", () => {
      setTargetSize(targetSizeKey, targetHIn, targetWIn);
    });
  }

  function setupActionButtons() {
    elClearTapsBtn?.addEventListener("click", () => {
      resetAll();
      if (elTargetImg?.src) {
        runStartedAt = nowTs();
        setStatus("Tap Aim Point.");
        setInstruction("Tap Aim Point.");
      }
    });

    [elShowResultsBtn, elStickyResultsBtn].filter(Boolean).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        onShowResults();
      });
    });
  }

  function boot() {
    try { history.scrollRestoration = "manual"; } catch {}
    window.scrollTo(0, 0);

    setDialUnit(DEFAULTS.dialUnit);
    hydrateRange();
    hydrateTargetSize();
    setProfileUi();
    closeMatrix();
    closeVendorPanel();
    hideSticky();
    resetAll();

    setupVendor();
    setupImageInput();
    setupTapArea();
    setupMatrix();
    setupActionButtons();

    setInstruction("");
    setStatus("Add a target photo to begin.");
  }

  boot();
})();
