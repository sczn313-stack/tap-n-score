/* ============================================================
   tap-n-score/index.js (FULL REPLACEMENT) — TARGET PAGE POLISH v2
   - NO Start Tapping button
   - Compact ADJUST strip (tap to expand)
   - Settings default: 100 yd, US, MOA, 0.25
   - Tips top/bottom always synchronized + color changes
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Landing
  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elVendorBox = $("vendorBox");
  const elVendorLabel = $("vendorLabel");

  // Target section
  const elScoreSection = $("scoreSection");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");

  // Tips (sync)
  const elTipTop = $("tipTop");
  const elTipBottom = $("tipBottom");

  // Sticky
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Adjust UI
  const elAdjustBar = $("adjustBar");
  const elAdjustPanel = $("adjustPanel");

  // Badges
  const elDistBadge = $("distBadge");
  const elDistUnitBadge = $("distUnitBadge");
  const elUnitsBadge = $("unitsBadge");
  const elSysBadge = $("sysBadge");
  const elClickBadge = $("clickBadge");

  // Controls
  const elDistDown = $("distDown");
  const elDistUp = $("distUp");
  const elDistDisplay = $("distDisplay");
  const elDistUnit = $("distUnit");
  const elDistanceVal = $("distanceVal");

  const elUnitsToggle = $("unitsToggle"); // US / METRIC
  const elSysToggle = $("sysToggle");     // MOA / MRAD
  const elClickValue = $("clickValue");   // per click

  // Storage
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";

  // State
  let objectUrl = null;
  let aim = null;
  let hits = [];

  let lastTouchTapAt = 0;
  let touchStart = null;
  let pauseTimer = null;

  let unitsMode = "US";  // US | METRIC
  let sysMode = "MOA";   // MOA | MRAD

  // ------------------------------------------------------------
  // iOS scroll restore kill
  // ------------------------------------------------------------
  try { history.scrollRestoration = "manual"; } catch {}
  function forceTop() { try { window.scrollTo(0, 0); } catch {} }
  window.addEventListener("pageshow", () => { forceTop(); hideSticky(); });
  window.addEventListener("load", () => forceTop());

  // ------------------------------------------------------------
  // Tip helpers (SYNC top + bottom)
  // ------------------------------------------------------------
  function setTip(text, tone /* blue|red|green|gold */) {
    const t = String(text || "");
    const cls = {
      blue: "tipBlue",
      red: "tipRed",
      green: "tipGreen",
      gold: "tipGold",
    }[tone] || "tipBlue";

    [elTipTop, elTipBottom].forEach((el) => {
      if (!el) return;
      el.textContent = t;
      el.classList.remove("tipBlue","tipRed","tipGreen","tipGold");
      el.classList.add(cls);
    });
  }

  // ------------------------------------------------------------
  // Sticky
  // ------------------------------------------------------------
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
  // Vendor pill
  // ------------------------------------------------------------
  let vendorRotateTimer = null;
  let vendorRotateOn = false;

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
  // Adjust bar expand/collapse
  // ------------------------------------------------------------
  function isExpanded() {
    return elAdjustPanel && !elAdjustPanel.classList.contains("panelHidden");
  }

  function setExpanded(expand) {
    if (!elAdjustPanel) return;
    if (expand) {
      elAdjustPanel.classList.remove("panelHidden");
      elAdjustPanel.setAttribute("aria-hidden", "false");
      elAdjustBar?.classList.add("adjustExpanded");
    } else {
      elAdjustPanel.classList.add("panelHidden");
      elAdjustPanel.setAttribute("aria-hidden", "true");
      elAdjustBar?.classList.remove("adjustExpanded");
    }
  }

  function toggleExpanded() { setExpanded(!isExpanded()); }

  elAdjustBar?.addEventListener("click", toggleExpanded);
  elAdjustBar?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpanded(); }
  });

  // ------------------------------------------------------------
  // Distance / units / system
  // ------------------------------------------------------------
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function getDistanceNumber() {
    const n = Number(elDistanceVal?.value ?? 100);
    return Number.isFinite(n) ? n : 100;
  }

  function setDistanceNumber(v) {
    let n = Math.round(Number(v));
    if (!Number.isFinite(n)) n = (unitsMode === "US") ? 100 : 91;
    n = clamp(n, 5, 1500);

    elDistanceVal && (elDistanceVal.value = String(n));
    elDistDisplay && (elDistDisplay.textContent = String(n));
    elDistUnit && (elDistUnit.textContent = (unitsMode === "US") ? "yd" : "m");

    // badges
    elDistBadge && (elDistBadge.textContent = String(n));
    elDistUnitBadge && (elDistUnitBadge.textContent = (unitsMode === "US") ? "yd" : "m");
  }

  function distanceToYards() {
    const n = getDistanceNumber();
    if (unitsMode === "US") return n;
    return n * 1.0936133; // meters -> yards
  }

  function setUnitsMode(next) {
    // keep real-world distance approximately same
    const cur = getDistanceNumber();
    if (next === "METRIC") {
      unitsMode = "METRIC";
      const meters = Math.round(cur / 1.0936133);
      elUnitsToggle && (elUnitsToggle.textContent = "METRIC");
      elUnitsBadge && (elUnitsBadge.textContent = "METRIC");
      setDistanceNumber(meters);
    } else {
      unitsMode = "US";
      const yards = Math.round(cur * 1.0936133);
      elUnitsToggle && (elUnitsToggle.textContent = "US");
      elUnitsBadge && (elUnitsBadge.textContent = "US");
      setDistanceNumber(yards);
    }
  }

  function setSysMode(next) {
    sysMode = next;
    elSysToggle && (elSysToggle.textContent = next);
    elSysBadge && (elSysBadge.textContent = next);

    if (!elClickValue) return;
    elClickValue.innerHTML = "";

    if (sysMode === "MOA") {
      [
        { v: "0.25", t: "0.25" },
        { v: "0.5",  t: "0.50" },
        { v: "0.125",t: "0.13" },
      ].forEach(o => {
        const op = document.createElement("option");
        op.value = o.v; op.textContent = o.t;
        elClickValue.appendChild(op);
      });
      elClickValue.value = "0.25";
      elClickBadge && (elClickBadge.textContent = "0.25");
    } else {
      [
        { v: "0.1",  t: "0.10" },
        { v: "0.2",  t: "0.20" },
        { v: "0.05", t: "0.05" },
      ].forEach(o => {
        const op = document.createElement("option");
        op.value = o.v; op.textContent = o.t;
        elClickValue.appendChild(op);
      });
      elClickValue.value = "0.1";
      elClickBadge && (elClickBadge.textContent = "0.10");
    }
  }

  elDistUp?.addEventListener("click", () => setDistanceNumber(getDistanceNumber() + 5));
  elDistDown?.addEventListener("click", () => setDistanceNumber(getDistanceNumber() - 5));

  elUnitsToggle?.addEventListener("click", () => setUnitsMode(unitsMode === "US" ? "METRIC" : "US"));
  elSysToggle?.addEventListener("click", () => setSysMode(sysMode === "MOA" ? "MRAD" : "MOA"));

  elClickValue?.addEventListener("change", () => {
    const v = Number(elClickValue.value);
    if (Number.isFinite(v)) {
      elClickBadge && (elClickBadge.textContent = v.toFixed(2));
    }
  });

  // ------------------------------------------------------------
  // Dot draw + tap logic
  // ------------------------------------------------------------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

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

  function resetAll() {
    aim = null;
    hits = [];
    elDots && (elDots.innerHTML = "");
    elTapCount && (elTapCount.textContent = "0");
    hideSticky();

    if (!elImg?.src) setTip("Add a target photo to begin.", "blue");
    else setTip("Tap Aim Point.", "red");
  }

  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(clientX, clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setTip("Tap Hits.", "green");
      hideSticky();
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");
    elTapCount && (elTapCount.textContent = String(hits.length));
    setTip("Tap more hits, or pause — results will appear.", "gold");

    hideSticky();
    scheduleStickyMagic();
  }

  // Touch anti-double fire
  if (elWrap) {
    elWrap.addEventListener("touchstart", (e) => {
      if (!e.touches || !e.touches[0]) return;
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
    }, { passive: true });

    elWrap.addEventListener("touchend", (e) => {
      const now = Date.now();
      const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t || !touchStart) return;

      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);

      if (dx > 10 || dy > 10) { touchStart = null; return; }

      lastTouchTapAt = now;
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
  // Scoring math (MOA + MRAD supported)
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

    const yards = distanceToYards();
    const perClick = Number(elClickValue?.value ?? (sysMode === "MOA" ? 0.25 : 0.1));

    let clicksX = 0;
    let clicksY = 0;

    if (sysMode === "MOA") {
      const inchesPerMoa = (yards / 100) * 1.047;
      const moaX = inchesX / inchesPerMoa;
      const moaY = inchesY / inchesPerMoa;
      clicksX = moaX / perClick;
      clicksY = moaY / perClick;
    } else {
      const inchesPerMil = (yards / 100) * 3.6;
      const milX = inchesX / inchesPerMil;
      const milY = inchesY / inchesPerMil;
      clicksX = milX / perClick;
      clicksY = milY / perClick;
    }

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      inches: { x: inchesX, y: inchesY, r: rIn },
      score: scoreFromRadiusInches(rIn),
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
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
      vendorUrl,
      surveyUrl: "",
      sourceImg: "",
      debug: {
        unitsMode,
        sysMode,
        perClick: Number(Number(elClickValue?.value ?? 0).toFixed(2)),
        distanceDisplay: getDistanceNumber(),
        distanceYds: Number(distanceToYards().toFixed(2)),
        aim,
        avgPoi: out.avgPoi,
        inches: out.inches
      }
    };

    goToSEC(payload);
  }

  // ------------------------------------------------------------
  // Buttons
  // ------------------------------------------------------------
  elClear?.addEventListener("click", resetAll);
  elStickyBtn?.addEventListener("click", onShowResults);

  // ------------------------------------------------------------
  // Photo picker
  // ------------------------------------------------------------
  function revealTargetUI() {
    elScoreSection?.classList.remove("scoreHidden");
    // keep panel collapsed by default (small footprint)
    setExpanded(false);
    try { elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  }

  if (elPhotoBtn && elFile) elPhotoBtn.addEventListener("click", () => elFile.click());

  if (elFile) {
    elFile.addEventListener("change", async () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // reset
      aim = null;
      hits = [];
      elDots && (elDots.innerHTML = "");
      elTapCount && (elTapCount.textContent = "0");
      hideSticky();

      revealTargetUI();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => { setTip("Tap Aim Point.", "red"); };
      elImg.onerror = () => { setTip("Photo failed to load. Try again.", "red"); };

      elImg.src = objectUrl;
      elFile.value = "";
    });
  }

  // ------------------------------------------------------------
  // Boot defaults (small, obvious, ignorable)
  // ------------------------------------------------------------
  hydrateVendorBox();

  // Default collapsed panel (you only open if needed)
  setExpanded(false);

  unitsMode = "US";
  sysMode = "MOA";

  elUnitsToggle && (elUnitsToggle.textContent = "US");
  elUnitsBadge && (elUnitsBadge.textContent = "US");

  elSysToggle && (elSysToggle.textContent = "MOA");
  elSysBadge && (elSysBadge.textContent = "MOA");

  setDistanceNumber(100);
  setSysMode("MOA");

  // click badge init
  elClickBadge && (elClickBadge.textContent = "0.25");

  setTip("Add a target photo to begin.", "blue");
  hideSticky();
})();
