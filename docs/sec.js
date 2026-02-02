/* ============================================================
   sec.js (FULL REPLACEMENT)
   Reads Shooter Experience Card payload from localStorage
   Populates sec.html (classic layout)
   Enables Download/Vendor/Survey when URLs exist
============================================================ */

(() => {
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const $ = (id) => document.getElementById(id);

  // Elements
  const elSession = $("secSession");
  const elShots = $("secShots");
  const elScore = $("secScore");

  const elWindDir = $("secWindDir");
  const elWindClicks = $("secWindClicks");

  const elElevDir = $("secElevDir");
  const elElevClicks = $("secElevClicks");

  const elPrev1 = $("prev1");
  const elPrev2 = $("prev2");
  const elPrev3 = $("prev3");

  const btnDownload = $("downloadBtn");
  const btnVendor = $("vendorBtn");
  const btnSurvey = $("surveyBtn");
  const btnBack = $("backToTargetBtn");

  const elDiag = $("secDiag");

  function setDiag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function safeDir(d) {
    const s = (d ?? "").toString().trim().toUpperCase();
    if (!s) return "—";
    // Keep it short: UP/DOWN/LEFT/RIGHT or U/D/L/R
    if (s === "UP") return "U";
    if (s === "DOWN") return "D";
    if (s === "LEFT") return "L";
    if (s === "RIGHT") return "R";
    if (["U","D","L","R","—"].includes(s)) return s;
    return s.slice(0, 2);
  }

  function enableBtn(btn) {
    btn?.classList.remove("btnDisabled");
    btn?.setAttribute("aria-disabled", "false");
  }
  function disableBtn(btn) {
    btn?.classList.add("btnDisabled");
    btn?.setAttribute("aria-disabled", "true");
  }

  // Load payload
  let payload = null;
  try {
    payload = JSON.parse(localStorage.getItem(SEC_KEY) || "null");
  } catch {
    payload = null;
  }

  if (!payload) {
    // Empty state
    elSession && (elSession.textContent = "—");
    elShots && (elShots.textContent = "0");
    elScore && (elScore.textContent = "—");

    elWindDir && (elWindDir.textContent = "—");
    elWindClicks && (elWindClicks.textContent = "0.00");
    elElevDir && (elElevDir.textContent = "—");
    elElevClicks && (elElevClicks.textContent = "0.00");

    elPrev1 && (elPrev1.textContent = "—");
    elPrev2 && (elPrev2.textContent = "—");
    elPrev3 && (elPrev3.textContent = "—");

    disableBtn(btnDownload);
    disableBtn(btnVendor);
    disableBtn(btnSurvey);

    setDiag({ ok:false, reason:"No payload found in localStorage", key: SEC_KEY });
    return;
  }

  // Populate fields
  const sessionId = payload.sessionId || "—";
  const shots = Number(payload.shots ?? 0);
  const score = payload.score;

  elSession && (elSession.textContent = sessionId);
  elShots && (elShots.textContent = Number.isFinite(shots) ? String(shots) : "0");

  // Score display (keep as-is; if blank, show dash)
  elScore && (elScore.textContent = (score === null || score === undefined || score === "") ? "—" : String(score));

  // Windage
  elWindDir && (elWindDir.textContent = safeDir(payload.windage?.dir));
  elWindClicks && (elWindClicks.textContent = fmt2(payload.windage?.clicks));

  // Elevation
  elElevDir && (elElevDir.textContent = safeDir(payload.elevation?.dir));
  elElevClicks && (elElevClicks.textContent = fmt2(payload.elevation?.clicks));

  // History (optional — leave dashes unless you later wire it)
  elPrev1 && (elPrev1.textContent = payload.history?.[0] ?? "—");
  elPrev2 && (elPrev2.textContent = payload.history?.[1] ?? "—");
  elPrev3 && (elPrev3.textContent = payload.history?.[2] ?? "—");

  // Links (optional)
  const vendorUrl = (payload.vendorUrl || "").trim();
  const surveyUrl = (payload.surveyUrl || "").trim();

  if (vendorUrl) {
    enableBtn(btnVendor);
    btnVendor.addEventListener("click", () => window.open(vendorUrl, "_blank", "noopener"));
  } else {
    disableBtn(btnVendor);
  }

  if (surveyUrl) {
    enableBtn(btnSurvey);
    btnSurvey.addEventListener("click", () => window.open(surveyUrl, "_blank", "noopener"));
  } else {
    disableBtn(btnSurvey);
  }

  // Download behavior:
  // If payload includes a sec image URL, route to download.html?img=...
  // Supported keys: payload.secPngUrl OR payload.secUrl OR payload.pngUrl
  const secImgUrl = (payload.secPngUrl || payload.secUrl || payload.pngUrl || "").trim();

  if (secImgUrl) {
    enableBtn(btnDownload);
    btnDownload.addEventListener("click", () => {
      const from = encodeURIComponent("./sec.html");
      const target = encodeURIComponent("./target.html");
      const img = encodeURIComponent(secImgUrl);
      window.location.href = `./download.html?img=${img}&from=${from}&target=${target}`;
    });
  } else {
    disableBtn(btnDownload);
  }

  // Back to target
  btnBack?.addEventListener("click", () => {
    window.location.href = "./target.html";
  });

  setDiag({
    ok:true,
    sessionId,
    shots,
    score,
    windage: payload.windage,
    elevation: payload.elevation,
    hasDownloadUrl: !!secImgUrl,
    vendorUrl: vendorUrl || null,
    surveyUrl: surveyUrl || null
  });
})();
