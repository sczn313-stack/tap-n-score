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

  function getBatch() {
    return getParam("b").toLowerCase();
  }

  function isB2B() {
    return getVendor() === "baker" && getSku() === "bkr-b2b";
  }

  function alreadyOnB2BPage() {
    const u = getUrl();
    if (!u) return false;
    return /\/docs\/b2b-sec\.html$/i.test(u.pathname) || /\/b2b-sec\.html$/i.test(u.pathname);
  }

  function routeTargetIfNeeded() {
    if (!isB2B()) return false;
    if (alreadyOnB2BPage()) return false;

    const u = getUrl();
    if (!u) return false;

    const qs = u.searchParams.toString();
    const next = `./b2b-sec.html${qs ? `?${qs}` : ""}`;
    window.location.replace(next);
    return true;
  }

  if (routeTargetIfNeeded()) return;

  const TRACK_ENDPOINT = "https://tap-n-score-backend.onrender.com/api/track";

  const vendor = getVendor() || "unknown";
  const sku = getSku() || "unknown";
  const batch = getBatch() || "";
  const pageMode = "landing";

  const sessionId = (() => {
    const key = "SCZN3_TRACK_SESSION_ID_V1";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, value);
    }
    return value;
  })();

  function trackEvent(eventName, extra = {}) {
    const payload = {
      event: eventName,
      vendor,
      sku,
      batch,
      page: "docs/index",
      mode: pageMode,
      session_id: sessionId,
      ts: new Date().toISOString(),
      ...extra
    };

    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }

  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");

  const elInstruction = $("instructionLine");
  const elStatus = $("statusLine");

  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");

  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");

  const elStickyBar = $("stickyBar");
  const elStickyBtn = $("stickyResultsBtn");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";

  let objectUrl = null;
  let aim = null;
  let hits = [];

  const MAX_HITS_PER_SESSION = 10;

  function setText(el, t) {
    if (el) el.textContent = String(t ?? "");
  }

  function resetAll() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    if (elTapCount) elTapCount.textContent = "0";
  }

  function addDot(x01, y01, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot " + (kind === "aim" ? "tapDotAim" : "tapDotHit");
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    elDots.appendChild(d);
  }

  function getRelative01(clientX, clientY) {
    const r = elWrap.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x01: Math.max(0, Math.min(1, x)), y01: Math.max(0, Math.min(1, y)) };
  }

  function compute() {
    if (!aim || hits.length < 1) return null;

    const avg = hits.reduce((a, p) => ({ x: a.x + p.x01, y: a.y + p.y01 }), { x: 0, y: 0 });
    avg.x /= hits.length;
    avg.y /= hits.length;

    const dx = aim.x01 - avg.x;
    const dy = aim.y01 - avg.y;

    const score = Math.max(50, 100 - Math.sqrt(dx * dx + dy * dy) * 100);

    return {
      score: Math.round(score),
      shots: hits.length,
      windage: { dir: dx >= 0 ? "RIGHT" : "LEFT", clicks: Math.abs(dx * 10) },
      elevation: { dir: dy >= 0 ? "DOWN" : "UP", clicks: Math.abs(dy * 10) },
      debug: { distanceYds: 100 }
    };
  }

  function goToSEC(payload) {
    try { localStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload)); } catch {}
    window.location.href = "./sec.html?cb=" + Date.now();
  }

  function onShowResults() {
    const result = compute();
    if (!result) {
      alert("Tap Aim Point and at least one hit.");
      return;
    }

    trackEvent("results_ready", {
      shots: result.shots,
      score: result.score
    });

    goToSEC(result);
  }

  elPhotoBtn?.addEventListener("click", () => elFile?.click());

  elFile?.addEventListener("change", () => {
    const f = elFile.files?.[0];
    if (!f) return;

    resetAll();

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    elImg.src = objectUrl;
  });

  elWrap?.addEventListener("click", (e) => {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(e.clientX, e.clientY);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "aim");
      setText(elStatus, "Tap bullet holes");
      return;
    }

    if (hits.length >= MAX_HITS_PER_SESSION) return;

    hits.push({ x01, y01 });
    addDot(x01, y01, "hit");

    if (elTapCount) elTapCount.textContent = hits.length;
  });

  elClear?.addEventListener("click", resetAll);

  elStickyBtn?.addEventListener("click", onShowResults);

  trackEvent("scan", {
    source: "landing"
  });

})();
