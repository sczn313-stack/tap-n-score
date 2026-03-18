/* ============================================================
   docs/index.js — Tap-n-Score Router + Scoring Engine
   PRODUCTION TARGET-AWARE VERSION
============================================================ */

(() => {
  const $ = id => document.getElementById(id);

  /* ----------------------------------------------------------
     TARGET ROUTING SYSTEM
     This is the LONG-TERM architecture
  ---------------------------------------------------------- */

  function getParams() {
    const u = new URL(window.location.href);
    return {
      vendor: (u.searchParams.get("v") || "default").toLowerCase(),
      sku: (u.searchParams.get("sku") || "default").toLowerCase()
    };
  }

  const TARGET_CONFIG = {

    /* ---------- BAKER TARGETS ---------- */

    baker: {

      /* 🟢 BACK-TO-BASICS TARGET */
      "bkr-b2b": {
        title: "Back to Basics",
        drillId: "back-to-basics",
        vendorUrl: "https://bakertargets.com/",
        surveyUrl: ""
      }

      // 👉 Future Baker SKUs go here
    }

    // 👉 Future vendors go here
  };

  function resolveTarget() {
    const { vendor, sku } = getParams();

    const vendorBlock = TARGET_CONFIG[vendor];
    if (!vendorBlock) return null;

    const target = vendorBlock[sku];
    if (!target) return null;

    return target;
  }

  const ACTIVE_TARGET = resolveTarget();

  /* ----------------------------------------------------------
     Vendor URL injection for SEC page
  ---------------------------------------------------------- */

  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";

  if (ACTIVE_TARGET?.vendorUrl) {
    try {
      localStorage.setItem(KEY_VENDOR_URL, ACTIVE_TARGET.vendorUrl);
    } catch {}
  }

  /* ----------------------------------------------------------
     BASIC SCORING ENGINE (your existing logic)
     — untouched so nothing breaks
  ---------------------------------------------------------- */

  const elPhotoBtn = $("photoBtn");
  const elFile = $("photoInput");
  const elScoreSection = $("scoreSection");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");

  let aim = null;
  let hits = [];

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function resetAll() {
    aim = null;
    hits = [];
    if (elDots) elDots.innerHTML = "";
    if (elTapCount) elTapCount.textContent = "0";
  }

  function addDot(x01, y01, color) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = "tapDot";
    d.style.left = (x01 * 100) + "%";
    d.style.top = (y01 * 100) + "%";
    d.style.background = color;
    elDots.appendChild(d);
  }

  function getRelative01(x, y) {
    const r = elWrap.getBoundingClientRect();
    return {
      x01: clamp01((x - r.left) / r.width),
      y01: clamp01((y - r.top) / r.height)
    };
  }

  function acceptTap(x, y) {
    if (!elImg?.src) return;

    const { x01, y01 } = getRelative01(x, y);

    if (!aim) {
      aim = { x01, y01 };
      addDot(x01, y01, "#67f3a4");
      return;
    }

    hits.push({ x01, y01 });
    addDot(x01, y01, "#b7ff3c");

    if (elTapCount)
      elTapCount.textContent = String(hits.length);
  }

  elWrap?.addEventListener("click", e =>
    acceptTap(e.clientX, e.clientY)
  );

  /* ----------------------------------------------------------
     SHOW RESULTS → SEC PAGE
  ---------------------------------------------------------- */

  function scoreSession() {
    const score = hits.length; // simple B2B scoring

    const payload = {
      sessionId: "S-" + Date.now(),
      score,
      shots: hits.length,
      targetTitle: ACTIVE_TARGET?.title || "Target",
      vendorUrl: ACTIVE_TARGET?.vendorUrl || ""
    };

    const b64 = btoa(JSON.stringify(payload));

    window.location.href =
      `./sec.html?payload=${encodeURIComponent(b64)}`;
  }

  document.getElementById("showResultsBtn")
    ?.addEventListener("click", scoreSession);

  /* ----------------------------------------------------------
     PHOTO PICKER
  ---------------------------------------------------------- */

  elPhotoBtn?.addEventListener("click", () => elFile?.click());

  elFile?.addEventListener("change", () => {
    const f = elFile.files?.[0];
    if (!f) return;

    resetAll();

    const url = URL.createObjectURL(f);

    elImg.onload = () => {
      elScoreSection?.classList.remove("scoreHidden");
    };

    elImg.src = url;
  });

})();
