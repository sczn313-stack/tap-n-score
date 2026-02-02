/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — SEC page renderer
   Matches IDs in docs/sec.html exactly.
   Reads SEC payload from localStorage and populates:
   - Session / Shots / Score
   - Windage + Elevation (dir + clicks)
   - Enables buttons (Download / Vendor / Survey)
   - Diagnostics in <pre id="secDiag">
============================================================ */

(() => {
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const FALLBACK_KEYS = ["SCZN3_SEC_PAYLOAD", "SCZN3_SEC", "SEC_PAYLOAD"];

  const $ = (id) => document.getElementById(id);

  // ---- Elements (must match sec.html)
  const elSession = $("secSession");
  const elShots = $("secShots");
  const elScore = $("secScore");

  const elWindDir = $("secWindDir");
  const elWindClicks = $("secWindClicks");

  const elElevDir = $("secElevDir");
  const elElevClicks = $("secElevClicks");

  const btnDownload = $("downloadBtn");
  const btnVendor = $("vendorBtn");
  const btnSurvey = $("surveyBtn");
  const btnBack = $("backToTargetBtn");

  const diag = $("secDiag");

  // ---- Helpers
  function setDiag(obj) {
    if (!diag) return;
    diag.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function setText(el, val) {
    if (!el) return;
    el.textContent = val;
  }

  function toNum(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }

  function n2(x) {
    return toNum(x, 0).toFixed(2);
  }

  function setBtnEnabled(btn, enabled) {
    if (!btn) return;
    btn.classList.toggle("btnDisabled", !enabled);
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");
    btn.disabled = !enabled;
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function readPayload() {
    const raw0 = localStorage.getItem(SEC_KEY);
    if (raw0) return { key: SEC_KEY, raw: raw0, payload: safeJsonParse(raw0) };

    for (const k of FALLBACK_KEYS) {
      const r = localStorage.getItem(k);
      if (r) return { key: k, raw: r, payload: safeJsonParse(r) };
    }
    return { key: null, raw: null, payload: null };
  }

  function buildDownloadUrl(secPngUrl) {
    // Your download page expects: ./download.html?img=...
    // We also pass return paths so buttons are consistent.
    const img = encodeURIComponent(secPngUrl);
    const from = encodeURIComponent("./sec.html");
    const target = encodeURIComponent("./target.html");
    return `./download.html?img=${img}&from=${from}&target=${target}`;
  }

  // ---- Main
  const { key, raw, payload } = readPayload();

  // Default UI state (safe)
  setText(elSession, "—");
  setText(elShots, "0");
  setText(elScore, "—");

  setText(elWindDir, "—");
  setText(elWindClicks, "0.00");

  setText(elElevDir, "—");
  setText(elElevClicks, "0.00");

  setBtnEnabled(btnDownload, false);
  setBtnEnabled(btnVendor, false);
  setBtnEnabled(btnSurvey, false);

  // Back button always works
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      window.location.href = "./target.html";
    });
  }

  // If no payload, explain why
  if (!payload) {
    setDiag({
      ok: false,
      reason: raw ? "payload JSON parse failed" : "payload missing from localStorage",
      expectedKey: SEC_KEY,
      foundKey: key,
      fix:
        "Do NOT open sec.html directly. Run scoring flow and press Show Results so it writes payload then routes here."
    });
    return;
  }

  // Pull fields (tolerant of slight backend naming differences)
  const sessionId =
    payload.sessionId ||
    payload.id ||
    payload.session ||
    "—";

  const shots =
    payload.shots ??
    payload.shotCount ??
    payload.count ??
    0;

  const score =
    payload.score ??
    payload.smartScore ??
    payload.resultScore ??
    null;

  // Windage / Elevation
  const windDir =
    payload.windage?.dir ??
    payload.windDir ??
    payload.clicks?.windDir ??
    "—";

  const windClicks =
    payload.windage?.clicks ??
    payload.windageClicks ??
    payload.clicks?.windage ??
    0;

  const elevDir =
    payload.elevation?.dir ??
    payload.elevDir ??
    payload.clicks?.elevDir ??
    "—";

  const elevClicks =
    payload.elevation?.clicks ??
    payload.elevationClicks ??
    payload.clicks?.elevation ??
    0;

  // SEC image url (for download page)
  const secPngUrl =
    payload.secPngUrl ||
    payload.secUrl ||
    payload.pngUrl ||
    payload.cardPngUrl ||
    "";

  // Optional links
  const vendorUrl = payload.vendorUrl || "";
  const surveyUrl = payload.surveyUrl || "";

  // Populate UI
  setText(elSession, String(sessionId));
  setText(elShots, String(toNum(shots, 0)));

  if (Number.isFinite(Number(score))) {
    setText(elScore, String(Number(score)));
  } else {
    setText(elScore, "—");
  }

  setText(elWindDir, String(windDir));
  setText(elWindClicks, n2(windClicks));

  setText(elElevDir, String(elevDir));
  setText(elElevClicks, n2(elevClicks));

  // Buttons
  if (btnDownload) {
    if (secPngUrl) {
      setBtnEnabled(btnDownload, true);
      btnDownload.addEventListener("click", () => {
        window.location.href = buildDownloadUrl(secPngUrl);
      });
    } else {
      setBtnEnabled(btnDownload, false);
    }
  }

  if (btnVendor) {
    if (vendorUrl) {
      setBtnEnabled(btnVendor, true);
      btnVendor.addEventListener("click", () => window.open(vendorUrl, "_blank", "noopener"));
    } else {
      setBtnEnabled(btnVendor, false);
    }
  }

  if (btnSurvey) {
    if (surveyUrl) {
      setBtnEnabled(btnSurvey, true);
      btnSurvey.addEventListener("click", () => window.open(surveyUrl, "_blank", "noopener"));
    } else {
      setBtnEnabled(btnSurvey, false);
    }
  }

  // Diagnostics (show what we loaded)
  setDiag({
    ok: true,
    storageKey: key,
    sessionId,
    shots: toNum(shots, 0),
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    windage: { dir: windDir, clicks: toNum(windClicks, 0) },
    elevation: { dir: elevDir, clicks: toNum(elevClicks, 0) },
    secPngUrlPresent: !!secPngUrl,
    vendorUrlPresent: !!vendorUrl,
    surveyUrlPresent: !!surveyUrl
  });
})();
