/* ============================================================
   docs/sec.js (FULL REPLACEMENT)
   Shooter Experience Card (SEC) renderer
   - Reads SEC payload from localStorage (SCZN3_SEC_PAYLOAD_V1)
   - Populates score, shots, elevation, windage
   - Wires buttons:
       - Download (routes to download.html?img=...)
       - Score another (back to index.html)
       - Back to target (to target.html)
       - Vendor / Survey (optional URLs from payload)
   NOTE: Distance + MOA are upstream only (target.html). Not shown here.
============================================================ */

(() => {
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  const $ = (id) => document.getElementById(id);

  // ---- Expected IDs in sec.html (safe if some missing)
  const elScore = $("secScore");
  const elShots = $("secShots");

  const elElevDir = $("secElevDir");
  const elElevClicks = $("secElevClicks");

  const elWindDir = $("secWindDir");
  const elWindClicks = $("secWindClicks");

  const elDownload = $("downloadBtn");
  const elScoreAnother = $("scoreAnotherBtn");
  const elBackToTarget = $("backToTargetBtn");

  const elVendorBtn = $("vendorBtn");
  const elSurveyBtn = $("surveyBtn");

  const elDiag = $("secDiag"); // optional <pre> diagnostics
  const elStatus = $("secStatus"); // optional status line

  // ---- Helpers
  function setText(el, v) {
    if (!el) return;
    el.textContent = v;
  }

  function clampNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function safeStr(v, fallback = "—") {
    const s = (v ?? "").toString().trim();
    return s ? s : fallback;
  }

  function isHttpUrl(u) {
    try {
      const x = new URL(u, window.location.href);
      return x.protocol === "http:" || x.protocol === "https:";
    } catch {
      return false;
    }
  }

  function diag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  // Best-effort image URL for download page
  // Priority:
  // 1) payload.secPngUrl (if you add it later)
  // 2) payload.secImageUrl (alias)
  // 3) payload.imageUrl (alias)
  function getSecImageUrl(payload) {
    const u =
      payload?.secPngUrl ||
      payload?.secImageUrl ||
      payload?.imageUrl ||
      "";
    return typeof u === "string" ? u : "";
  }

  // ---- Load payload
  let payload = null;
  try {
    const raw = localStorage.getItem(SEC_KEY);
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!payload || typeof payload !== "object") {
    setText(elStatus, "No SEC data found. Score a target first.");
    diag({ ok: false, reason: "missing_payload", key: SEC_KEY });

    // Disable download if present
    if (elDownload) {
      elDownload.classList.add("btnDisabled");
      elDownload.setAttribute("aria-disabled", "true");
    }

    // Still allow navigation buttons
    if (elScoreAnother) elScoreAnother.addEventListener("click", () => (window.location.href = "./index.html"));
    if (elBackToTarget) elBackToTarget.addEventListener("click", () => (window.location.href = "./target.html"));
    return;
  }

  // ---- Populate UI
  const scoreNum = clampNum(payload.score, 0);
  const shotsNum = clampNum(payload.shots, 0);

  const elevDir = safeStr(payload?.elevation?.dir, "—");
  const elevClicks = clampNum(payload?.elevation?.clicks, 0);

  const windDir = safeStr(payload?.windage?.dir, "—");
  const windClicks = clampNum(payload?.windage?.clicks, 0);

  setText(elStatus, "SEC ready.");
  setText(elScore, scoreNum.toFixed(0));
  setText(elShots, shotsNum.toFixed(0));

  setText(elElevDir, elevDir);
  setText(elElevClicks, elevClicks.toFixed(2));

  setText(elWindDir, windDir);
  setText(elWindClicks, windClicks.toFixed(2));

  // Optional: enable/disable vendor/survey buttons
  const vendorUrl = (payload.vendorUrl || "").trim();
  const surveyUrl = (payload.surveyUrl || "").trim();

  if (elVendorBtn) {
    if (isHttpUrl(vendorUrl)) {
      elVendorBtn.classList.remove("btnDisabled");
      elVendorBtn.addEventListener("click", () => window.open(vendorUrl, "_blank", "noopener"));
    } else {
      elVendorBtn.classList.add("btnDisabled");
    }
  }

  if (elSurveyBtn) {
    if (isHttpUrl(surveyUrl)) {
      elSurveyBtn.classList.remove("btnDisabled");
      elSurveyBtn.addEventListener("click", () => window.open(surveyUrl, "_blank", "noopener"));
    } else {
      elSurveyBtn.classList.add("btnDisabled");
    }
  }

  // ---- Buttons
  if (elScoreAnother) {
    elScoreAnother.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }

  if (elBackToTarget) {
    elBackToTarget.addEventListener("click", () => {
      window.location.href = "./target.html";
    });
  }

  // Download behavior:
  // If you have an image URL, send it to download.html as ?img=...
  // Also pass return paths so Download page buttons route back correctly.
  if (elDownload) {
    const secUrl = getSecImageUrl(payload);

    if (!secUrl || !isHttpUrl(secUrl)) {
      // No image URL yet — keep button but explain in diagnostics
      elDownload.classList.add("btnDisabled");
      elDownload.setAttribute("aria-disabled", "true");
    } else {
      elDownload.classList.remove("btnDisabled");
      elDownload.addEventListener("click", () => {
        const from = "./index.html";
        const target = "./target.html";
        const href =
          `./download.html?img=${encodeURIComponent(secUrl)}` +
          `&from=${encodeURIComponent(from)}` +
          `&target=${encodeURIComponent(target)}`;

        window.location.href = href;
      });
    }
  }

  // ---- Diagnostics
  diag({
    ok: true,
    key: SEC_KEY,
    payload: {
      sessionId: payload.sessionId || null,
      score: scoreNum,
      shots: shotsNum,
      elevation: { dir: elevDir, clicks: elevClicks },
      windage: { dir: windDir, clicks: windClicks },
      vendorUrl: vendorUrl || null,
      surveyUrl: surveyUrl || null,
      secImageUrl: getSecImageUrl(payload) || null
    }
  });
})();
