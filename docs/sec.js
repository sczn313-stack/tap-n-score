/* ============================================================
   docs/sec.js (FULL REPLACEMENT)
   - Reads SEC payload from localStorage
   - If missing, auto-redirects to landing (target.html)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const SEC_KEY  = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // --- Elements
  const elSession = $("secSession");
  const elShots   = $("secShots");
  const elScore   = $("secScore");

  const elWindClicks = $("secWindClicks");
  const elWindDir    = $("secWindDir");
  const elElevClicks = $("secElevClicks");
  const elElevDir    = $("secElevDir");

  const elPrev1 = $("prev1");
  const elPrev2 = $("prev2");
  const elPrev3 = $("prev3");

  const elDiag = $("secDiag");

  const downloadBtn = $("downloadBtn");
  const vendorBtn   = $("vendorBtn");
  const surveyBtn   = $("surveyBtn");
  const backBtn     = $("backToTargetBtn");

  function setText(el, v) { if (el) el.textContent = v; }

  function setDiag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  function num2(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  // --- Read payload
  let raw = null;
  try { raw = localStorage.getItem(SEC_KEY); } catch (_) {}

  if (!raw) {
    // Hard truth: SEC should never be visited first.
    const bounce = {
      ok: false,
      reason: "Missing SEC payload in localStorage",
      key: SEC_KEY,
      action: "Redirecting to landing (target.html)…"
    };
    setDiag(bounce);

    // Bounce back to landing page with cache-buster
    const u = "./target.html?fresh=" + Date.now();
    setTimeout(() => window.location.replace(u), 400);
    return;
  }

  let payload = null;
  try { payload = JSON.parse(raw); } catch (_) {}

  if (!payload || typeof payload !== "object") {
    setDiag({ ok:false, reason:"SEC payload invalid JSON", raw });
    const u = "./target.html?fresh=" + Date.now();
    setTimeout(() => window.location.replace(u), 400);
    return;
  }

  // --- Populate UI
  setText(elSession, payload.sessionId || "—");
  setText(elShots,   String(payload.shots ?? 0));

  const score = payload.score;
  setText(elScore, Number.isFinite(Number(score)) ? String(score) : "—");

  setText(elWindClicks, num2(payload.windage?.clicks));
  setText(elWindDir, payload.windage?.dir || "—");

  setText(elElevClicks, num2(payload.elevation?.clicks));
  setText(elElevDir, payload.elevation?.dir || "—");

  // --- History (optional)
  try {
    const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
    const h1 = hist?.[0];
    const h2 = hist?.[1];
    const h3 = hist?.[2];
    setText(elPrev1, h1 ? `${h1.wind} | ${h1.elev}` : "—");
    setText(elPrev2, h2 ? `${h2.wind} | ${h2.elev}` : "—");
    setText(elPrev3, h3 ? `${h3.wind} | ${h3.elev}` : "—");
  } catch (_) {}

  // --- Buttons
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "./target.html?fresh=" + Date.now();
    });
  }

  // Download button only if secPngUrl exists
  const secUrl = String(payload.secPngUrl || "").trim();
  if (downloadBtn) {
    if (secUrl) {
      downloadBtn.classList.remove("btnDisabled");
      downloadBtn.disabled = false;
      downloadBtn.addEventListener("click", () => {
        const u = `./download.html?img=${encodeURIComponent(secUrl)}&from=${encodeURIComponent("./target.html")}`;
        window.location.href = u;
      });
    } else {
      downloadBtn.classList.add("btnDisabled");
      downloadBtn.disabled = true;
    }
  }

  // Vendor / Survey (optional)
  if (vendorBtn) {
    const v = String(payload.vendorUrl || "").trim();
    if (v) {
      vendorBtn.classList.remove("btnDisabled");
      vendorBtn.disabled = false;
      vendorBtn.addEventListener("click", () => window.open(v, "_blank"));
    }
  }

  if (surveyBtn) {
    const s = String(payload.surveyUrl || "").trim();
    if (s) {
      surveyBtn.classList.remove("btnDisabled");
      surveyBtn.disabled = false;
      surveyBtn.addEventListener("click", () => window.open(s, "_blank"));
    }
  }

  // Final diag
  setDiag({ ok:true, key: SEC_KEY, payload });
})();
