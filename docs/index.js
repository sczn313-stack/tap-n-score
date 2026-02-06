/* ============================================================
   tap-n-score/index.js (FULL REPLACEMENT) — LOCKED LANDING + DOTS + REDO
   Fixes / Adds:
   - DOTS ALWAYS RENDER (relies on .tapDot CSS)
   - Dot size handled in CSS (10px)
   - REDO button removes last action:
       last hit -> removed
       if no hits, aim -> removed
   - Keeps: landing vendor placeholder logic, iOS touch + ghost click suppression,
            sticky results behavior, photo storage for SEC
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
  const elSettingsSection = $("settingsSection");

  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");
  const elTapCount = $("tapCount");
  const elRedo = $("redoBtn");
  const elClear = $("clearTapsBtn");
  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  // Sticky
  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  // Settings
  const elDistance = $("distanceYds");
  const elDistDisplay = $("distDisplay");
  const elDistUp = $("distUp");
  const elDistDown = $("distDown");
  const elMoaClick = $("moaPerClick");

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";

  let objectUrl = null;

  // Actions stack (truth)
  // [{type:"aim"|"hit", x01, y01}]
  let actions = [];

  // Derived state
  const getAim = () => actions.find(a => a.type === "aim") || null;
  const getHits = () => actions.filter(a => a.type === "hit");

  // Anti-double-fire / anti-scroll
  let lastTouchTapAt = 0;
  let touchStart = null;
  let pauseTimer = null;

  // ---- Helpers
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function setText(el, t) { if (el) el.textContent = String(t ?? ""); }

  function revealScoringUI() {
    if (elScoreSection) elScoreSection.classList.remove("scoreHidden");
    if (elSettingsSection) elSettingsSection.classList.remove("scoreHidden");
    try { elScoreSection?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch {}
  }

  // ---- Vendor placeholder ALWAYS shows
  function hydrateVendorBox() {
    const v = localStorage.getItem(KEY_VENDOR_URL) || "";
    const ok = typeof v === "string" && v.startsWith("http");
    if (!elVendorBox) return;

    if (ok) {
      elVendorBox.href = v;
      elVendorBox.target = "_blank";
      elVendorBox.rel = "noopener";
      if (elVendorLabel) elVendorLabel.textContent = "VENDOR";
      elVendorBox.style.opacity = "1";
      elVendorBox.style.pointerEvents = "auto";
    } else {
      // placeholder state (visible but not clickable)
      elVendorBox.removeAttribute("href");
      elVendorBox.removeAttribute("target");
      elVendorBox.removeAttribute("rel");
      if (elVendorLabel) elVendorLabel.textContent = "VENDOR";
      elVendorBox.style.opacity = ".92";
      elVendorBox.style.pointerEvents = "none";
    }
  }

  function setTapCount() {
    const hits = getHits();
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
      if (getHits().length >= 1) showSticky();
    }, 650);
  }

  function setInstructionForState() {
    if (!elInstruction) return;
    if (!elImg?.src) { setText(elInstruction, ""); return; }

    const aim = getAim();
    const hits = getHits();

    if (!aim) {
      setText(elInstruction, "Tap Aim Point.");
      return;
    }
    if (hits.length < 1) {
      setText(elInstruction, "Tap Hits.");
      return;
    }
    setText(elInstruction, "Tap more hits, or pause — results will appear.");
  }

  function resetAll() {
    actions = [];
    renderDots();
    setTapCount();
    hideSticky();
    setInstructionForState();
    setText(elStatus, elImg?.src ? "Tap Aim Point." : "Add a target photo to begin.");
  }

  // ------------------------------------------------------------
  // DOT RENDERING (single source of truth)
  // ------------------------------------------------------------
  function renderDots() {
    if (!elDots) return;
    elDots.innerHTML = "";

    actions.forEach((a) => {
      const d = document.createElement("div");
      d.className = "tapDot";
      d.style.left = (a.x01 * 100) + "%";
      d.style.top = (a.y01 * 100) + "%";

      // Colors (aim + hit)
      if (a.type === "aim") {
        d.style.background = "#67f3a4";
      } else {
        d.style.background = "#b7ff3c";
      }

      elDots.appendChild(d);
    });
  }

  // ------------------------------------------------------------
  // TARGET PHOTO STORAGE (SEC handoff)
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

  function getRelative01(clientX, clientY) {
    const r = elImg.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x01: clamp01(x), y01: clamp01(y) };
  }

  function b64FromObj(obj) {
    const json = JSON.stringify(obj);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function getDistance() {
    const n = Number(elDistance?.value ?? 100);
    return Number.isFinite(n) ? n : 100;
  }
  function setDistance(v) {
    let n = Math.round(Number(v));
    if (!Number.isFinite(n)) n = 100;
    n = Math.max(5, Math.min(1000, n));
    if (elDistance) elDistance.value = String(n);
    if (elDistDisplay) elDistDisplay.textContent = String(n);
  }

  // ------------------------------------------------------------
  // SCORING (placeholder unchanged)
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
    const aim = getAim();
    const hits = getHits();
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((acc, p) => ({ x: acc.x + p.x01, y: acc.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    const dx = aim.x01 - avg.x;
    const dy = aim.y01 - avg.y;

    const inchesX = dx * inchesPerFullWidth;
    const inchesY = dy * inchesPerFullWidth;

    const rIn = Math.sqrt(inchesX * inchesX + inchesY * inchesY);

    const dist = getDistance();
    const moaPerClick = Number(elMoaClick?.value ?? 0.25);
    const inchesPerMoa = (dist / 100) * 1.047;

    const moaX = inchesX / inchesPerMoa;
    const moaY = inchesY / inchesPerMoa;

    const clicksX = moaX / moaPerClick;
    const clicksY = moaY / moaPerClick;

    const score = scoreFromRadiusInches(rIn);

    return {
      avgPoi: { x01: avg.x, y01: avg.y },
      inches: { x: inchesX, y: inchesY, r: rIn },
      score,
      windage: { dir: clicksX >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(clicksX) },
      elevation: { dir: clicksY >= 0 ? "DOWN" : "UP", clicks: Math.abs(clicksY) },
    };
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload)); } catch {}
    const b64 = b64FromObj(payload);
    window.location.href = `./sec.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function onShowResults() {
    const out = computeCorrectionAndScore();
    if (!out) {
      alert("Tap Aim Point first, then tap at least one hit.");
      return;
    }

    const aim = getAim();
    const hits = getHits();
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
      debug: { aim, avgPoi: out.avgPoi, distanceYds: getDistance(), inches: out.inches }
    };

    goToSEC(payload);
  }

  // ------------------------------------------------------------
  // INPUT: PHOTO
  // ------------------------------------------------------------
  if (elPhotoBtn && elFile) elPhotoBtn.addEventListener("click", () => elFile.click());

  if (elFile) {
    elFile.addEventListener("change", async () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      resetAll();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      await storeTargetPhotoForSEC(f, objectUrl);

      elImg.onload = () => {
        setText(elStatus, "Tap Aim Point.");
        setInstructionForState();
        revealScoringUI();
      };

      elImg.onerror = () => {
        setText(elStatus, "Photo failed to load.");
        setText(elInstruction, "Try again.");
        revealScoringUI();
      };

      elImg.src = objectUrl;
      elFile.value = "";
    });
  }

  // ------------------------------------------------------------
  // INPUT: TAPS
  // ------------------------------------------------------------
  function acceptTap(clientX, clientY) {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(clientX, clientY);

    const aim = getAim();
    if (!aim) {
      actions = [{ type: "aim", x01, y01 }];
      renderDots();
      setText(elStatus, "Tap Hits.");
      setTapCount();
      setInstructionForState();
      hideSticky();
      return;
    }

    actions.push({ type: "hit", x01, y01 });
    renderDots();
    setTapCount();
    setInstructionForState();

    hideSticky();
    scheduleStickyMagic();
  }

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

      // scroll => ignore
      if (dx > 10 || dy > 10) {
        touchStart = null;
        return;
      }

      lastTouchTapAt = now;
      acceptTap(t.clientX, t.clientY);
      touchStart = null;
    }, { passive: true });

    elWrap.addEventListener("click", (e) => {
      const now = Date.now();
      if (now - lastTouchTapAt < 800) return; // kill ghost click
      acceptTap(e.clientX, e.clientY);
    }, { passive: true });
  }

  // ------------------------------------------------------------
  // BUTTONS
  // ------------------------------------------------------------
  function doRedo() {
    if (!actions.length) return;

    // Remove last action
    actions.pop();

    // If we removed aim but still have hits (shouldn't happen), strip hits too
    const hasAim = !!getAim();
    if (!hasAim) {
      actions = []; // aim defines the whole session
      hideSticky();
      setText(elStatus, "Tap Aim Point.");
    }

    renderDots();
    setTapCount();
    setInstructionForState();

    const hits = getHits();
    if (hasAim && hits.length < 1) {
      hideSticky();
      setText(elStatus, "Tap Hits.");
    }
  }

  if (elRedo) elRedo.addEventListener("click", doRedo);

  if (elClear) {
    elClear.addEventListener("click", () => {
      resetAll();
      if (elImg?.src) setText(elStatus, "Tap Aim Point.");
    });
  }

  if (elStickyBtn) elStickyBtn.addEventListener("click", onShowResults);
  if (elDistUp) elDistUp.addEventListener("click", () => setDistance(getDistance() + 5));
  if (elDistDown) elDistDown.addEventListener("click", () => setDistance(getDistance() - 5));

  // ---- Boot
  setDistance(100);
  hideSticky();
  resetAll();
  hydrateVendorBox();
})();
