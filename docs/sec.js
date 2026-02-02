/* ============================================================
   docs/sec.js  (FULL REPLACEMENT)
   Reads SEC payload from localStorage and renders numbers.
   - NO /api/poster calls.
   - Shows clear Diagnostics when payload is missing.
============================================================ */

(() => {
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  const $ = (id) => document.getElementById(id);

  const elSession = $("secSession");
  const elShots = $("secShots");
  const elScore = $("secScore");

  const elWindClicks = $("secWindClicks");
  const elWindDir = $("secWindDir");

  const elElevClicks = $("secElevClicks");
  const elElevDir = $("secElevDir");

  const elPrev1 = $("prev1");
  const elPrev2 = $("prev2");
  const elPrev3 = $("prev3");

  const elDiag = $("secDiag");

  const elDownload = $("downloadBtn");
  const elVendor = $("vendorBtn");
  const elSurvey = $("surveyBtn");
  const elBack = $("backToTargetBtn");

  function safeFixed2(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function setText(el, txt) {
    if (el) el.textContent = txt;
  }

  function disableBtn(btn, yes) {
    if (!btn) return;
    btn.disabled = !!yes;
    btn.setAttribute("aria-disabled", yes ? "true" : "false");
    btn.classList.toggle("btnDisabled", !!yes);
  }

  function setDiag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  function loadPayload() {
    try {
      const raw = localStorage.getItem(SEC_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function renderHistory() {
    const h = loadHistory();
    const a = h[0], b = h[1], c = h[2];

    const fmt = (x) => {
      if (!x) return "—";
      const score = x.score == null ? "—" : String(x.score);
      return `${score} | ${x.wind} | ${x.elev}`;
    };

    setText(elPrev1, fmt(a));
    setText(elPrev2, fmt(b));
    setText(elPrev3, fmt(c));
  }

  function routeBack() {
    // Prefer target.html if you’re using it, otherwise index.html
    // (GitHub Pages static site → both are fine as relative links)
    fetch("./target.html", { method: "HEAD" })
      .then((r) => {
        window.location.href = r.ok ? "./target.html" : "./index.html";
      })
      .catch(() => {
        window.location.href = "./index.html";
      });
  }

  // ---- main
  const payload = loadPayload();

  if (!payload) {
    // Missing payload → keep UI placeholders, show diag clearly
    renderHistory();
    disableBtn(elDownload, true);
    disableBtn(elVendor, true);
    disableBtn(elSurvey, true);

    setDiag({
      ok: false,
      reason: "Missing SEC payload in localStorage",
      key: SEC_KEY,
      fix: "Run a session from index.html and tap Show Results (don’t open sec.html directly)."
    });

    if (elBack) elBack.addEventListener("click", routeBack);
    return;
  }

  // Populate UI
  setText(elSession, payload.sessionId || "—");
  setText(elShots, Number(payload.shots || 0));

  // score (can be null if backend doesn’t provide yet)
  setText(elScore, payload.score == null ? "—" : String(payload.score));

  setText(elWindClicks, safeFixed2(payload.windage?.clicks));
  setText(elWindDir, payload.windage?.dir || "—");

  setText(elElevClicks, safeFixed2(payload.elevation?.clicks));
  setText(elElevDir, payload.elevation?.dir || "—");

  renderHistory();

  // Buttons
  // Download: if you later generate a PNG URL, wire it here.
  // For now: if secPngUrl exists, send to download.html?img=...
  const secPngUrl = payload.secPngUrl || "";
  if (secPngUrl) {
    disableBtn(elDownload, false);
    elDownload.addEventListener("click", () => {
      const u = encodeURIComponent(secPngUrl);
      window.location.href = `./download.html?img=${u}`;
    });
  } else {
    disableBtn(elDownload, true);
  }

  // Vendor + Survey
  if (payload.vendorUrl) {
    disableBtn(elVendor, false);
    elVendor.addEventListener("click", () => window.location.href = payload.vendorUrl);
  } else {
    disableBtn(elVendor, true);
  }

  if (payload.surveyUrl) {
    disableBtn(elSurvey, false);
    elSurvey.addEventListener("click", () => window.location.href = payload.surveyUrl);
  } else {
    disableBtn(elSurvey, true);
  }

  if (elBack) elBack.addEventListener("click", routeBack);

  setDiag({
    ok: true,
    key: SEC_KEY,
    payloadPreview: {
      sessionId: payload.sessionId || null,
      shots: payload.shots || 0,
      windage: payload.windage || null,
      elevation: payload.elevation || null,
      hasSecPngUrl: !!secPngUrl
    }
  });
})();
