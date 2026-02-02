/* ============================================================
   docs/sec.js (FULL REPLACEMENT)
   Reads SEC payload from localStorage and renders sec.html

   Expects sec.html IDs:
   - secSession, secShots, secScore
   - secWindClicks, secWindDir
   - secElevClicks, secElevDir
   - downloadBtn, vendorBtn, surveyBtn, backToTargetBtn
   - prev1, prev2, prev3
   - secDiag

   Storage keys:
   - SCZN3_SEC_PAYLOAD_V1
   - SCZN3_SEC_HISTORY_V1
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // --- Elements
  const elSession = $("secSession");
  const elShots = $("secShots");
  const elScore = $("secScore");

  const elWindClicks = $("secWindClicks");
  const elWindDir = $("secWindDir");
  const elElevClicks = $("secElevClicks");
  const elElevDir = $("secElevDir");

  const downloadBtn = $("downloadBtn");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");
  const backBtn = $("backToTargetBtn");

  const prev1 = $("prev1");
  const prev2 = $("prev2");
  const prev3 = $("prev3");

  const diag = $("secDiag");

  function setDiag(obj) {
    if (!diag) return;
    diag.textContent = JSON.stringify(obj, null, 2);
  }

  function fmt2(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  }

  function safeText(el, txt) {
    if (el) el.textContent = txt;
  }

  function disableBtn(btn) {
    if (!btn) return;
    btn.classList.add("btnDisabled");
    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
  }

  function enableBtn(btn) {
    if (!btn) return;
    btn.classList.remove("btnDisabled");
    btn.disabled = false;
    btn.setAttribute("aria-disabled", "false");
  }

  function updateHistoryUI() {
    try {
      const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      const a = hist[0] || null;
      const b = hist[1] || null;
      const c = hist[2] || null;

      safeText(prev1, a ? `${a.wind} • ${a.elev}` : "—");
      safeText(prev2, b ? `${b.wind} • ${b.elev}` : "—");
      safeText(prev3, c ? `${c.wind} • ${c.elev}` : "—");
    } catch {
      safeText(prev1, "—");
      safeText(prev2, "—");
      safeText(prev3, "—");
    }
  }

  // --- Read payload
  let raw = "";
  try {
    raw = localStorage.getItem(SEC_KEY) || "";
  } catch (e) {
    setDiag({ ok: false, reason: "localStorage blocked", error: String(e) });
    return;
  }

  if (!raw) {
    // Don’t guess; show exactly what’s missing.
    updateHistoryUI();
    disableBtn(downloadBtn);
    disableBtn(vendorBtn);
    disableBtn(surveyBtn);
    enableBtn(backBtn);

    setDiag({
      ok: false,
      reason: "Missing SEC payload in localStorage",
      key: SEC_KEY,
      tip: "This means you reached sec.html without saving results first. Go back and hit Show Results."
    });
    return;
  }

  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    setDiag({ ok: false, reason: "SEC payload JSON parse failed", raw, error: String(e) });
    return;
  }

  // --- Render numbers
  safeText(elSession, payload.sessionId || "—");
  safeText(elShots, Number.isFinite(Number(payload.shots)) ? String(Number(payload.shots)) : "0");

  // Score can be null until you add it later
  if (Number.isFinite(Number(payload.score))) safeText(elScore, String(Number(payload.score)));
  else safeText(elScore, "—");

  safeText(elWindDir, payload?.windage?.dir || "—");
  safeText(elWindClicks, fmt2(payload?.windage?.clicks));

  safeText(elElevDir, payload?.elevation?.dir || "—");
  safeText(elElevClicks, fmt2(payload?.elevation?.clicks));

  // --- Buttons
  // Back to target always works
  enableBtn(backBtn);
  backBtn?.addEventListener("click", () => {
    window.location.href = "./target.html";
  });

  // Download:
  // Your payload uses `secPngUrl`. Some older code uses secUrl.
  const secUrl = String(payload.secPngUrl || payload.secUrl || payload.secPng || "").trim();

  if (secUrl) {
    enableBtn(downloadBtn);
    downloadBtn?.addEventListener("click", () => {
      const from = "./index.html";
      const target = "./target.html";
      const u = `./download.html?img=${encodeURIComponent(secUrl)}&from=${encodeURIComponent(from)}&target=${encodeURIComponent(target)}`;
      window.location.href = u;
    });
  } else {
    disableBtn(downloadBtn);
  }

  // Vendor / Survey (optional)
  const vendorUrl = String(payload.vendorUrl || "").trim();
  if (vendorUrl) {
    enableBtn(vendorBtn);
    vendorBtn?.addEventListener("click", () => window.open(vendorUrl, "_blank", "noopener"));
  } else {
    disableBtn(vendorBtn);
  }

  const surveyUrl = String(payload.surveyUrl || "").trim();
  if (surveyUrl) {
    enableBtn(surveyBtn);
    surveyBtn?.addEventListener("click", () => window.open(surveyUrl, "_blank", "noopener"));
  } else {
    disableBtn(surveyBtn);
  }

  // History chips
  updateHistoryUI();

  // Diagnostics
  setDiag({ ok: true, key: SEC_KEY, payload, hasSecUrl: !!secUrl });
})();
