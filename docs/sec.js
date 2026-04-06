/* ============================================================
   docs/sec.js
   CLEAN FULL REPLACEMENT
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Views
  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");
  const toReportBtn = $("toReportBtn");
  const backBtn = $("backBtn");
  const backBtnReport = $("backBtnReport");

  // Page 1
  const scoreValue = $("scoreValue");
  const scoreBand = $("scoreBand");
  const runDistance = $("runDistance");
  const runHits = $("runHits");
  const runTime = $("runTime");
  const windageBig = $("windageBig");
  const windageDir = $("windageDir");
  const elevationBig = $("elevationBig");
  const elevationDir = $("elevationDir");
  const goHomeBtn = $("goHomeBtn");

  // Page 2
  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");

  // Storage
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_LAST_RESULT = "sczn3_last_result";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_VENDOR_NAME = "SCZN3_VENDOR_NAME_V1";

  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function nowStamp() {
    return new Date().toLocaleString();
  }

  function showPrecision() {
    if (viewPrecision) viewPrecision.classList.add("viewOn");
    if (viewReport) viewReport.classList.remove("viewOn");
  }

  function showReport() {
    if (viewPrecision) viewPrecision.classList.remove("viewOn");
    if (viewReport) viewReport.classList.add("viewOn");
  }

  function scoreBandInfo(score) {
    const s = Number(score) || 0;
    if (s >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT" };
    if (s >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID" };
    return { cls: "scoreBandRed", text: "NEEDS WORK" };
  }

  function getPayload() {
    const fromSessionMain = safeJsonParse(sessionStorage.getItem(KEY_PAYLOAD));
    if (fromSessionMain) return fromSessionMain;

    const fromSessionLast = safeJsonParse(sessionStorage.getItem(KEY_LAST_RESULT));
    if (fromSessionLast) return fromSessionLast;

    const fromLocalMain = safeJsonParse(localStorage.getItem(KEY_PAYLOAD));
    if (fromLocalMain) return fromLocalMain;

    const fromLocalLast = safeJsonParse(localStorage.getItem(KEY_LAST_RESULT));
    if (fromLocalLast) return fromLocalLast;

    return null;
  }

  function normalizePayload(raw) {
    if (!raw) return null;

    const score =
      Number(raw.score ?? raw.smartScore ?? 0);

    const shots =
      Number(raw.shots ?? 0);

    const distanceYds =
      Number(raw.distance_yards ?? raw.debug?.distanceYds ?? 100);

    const windageClicks =
      Number(raw.windage_clicks ?? raw.windage?.clicks ?? 0);

    const elevationClicks =
      Number(raw.elevation_clicks ?? raw.elevation?.clicks ?? 0);

    const windageDirection =
      String(raw.windage_dir ?? raw.windage?.dir ?? "—");

    const elevationDirection =
      String(raw.elevation_dir ?? raw.elevation?.dir ?? "—");

    const vendorUrl =
      String(raw.vendorUrl || localStorage.getItem(KEY_VENDOR_URL) || "");

    const vendorName =
      String(raw.vendorName || localStorage.getItem(KEY_VENDOR_NAME) || "Visit Vendor");

    return {
      score,
      shots,
      distanceYds,
      windageClicks,
      elevationClicks,
      windageDirection,
      elevationDirection,
      vendorUrl,
      vendorName
    };
  }

  function renderPrecision(payload) {
    const band = scoreBandInfo(payload.score);

    if (scoreValue) scoreValue.textContent = Math.round(payload.score);
    if (scoreBand) {
      scoreBand.className = `score-band ${band.cls}`;
      scoreBand.textContent = band.text;
    }

    if (windageBig) windageBig.textContent = fmt2(payload.windageClicks);
    if (windageDir) windageDir.textContent = payload.windageDirection;

    if (elevationBig) elevationBig.textContent = fmt2(payload.elevationClicks);
    if (elevationDir) elevationDir.textContent = payload.elevationDirection;

    if (runDistance) runDistance.textContent = `${payload.distanceYds} yds`;
    if (runHits) runHits.textContent = `${payload.shots} hits`;
    if (runTime) runTime.textContent = nowStamp();
  }

  async function drawReport(payload) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#081434";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";

    ctx.font = "bold 72px Arial";
    ctx.fillText("SEC Report", 540, 120);

    ctx.font = "bold 140px Arial";
    ctx.fillText(String(Math.round(payload.score)), 540, 280);

    ctx.font = "32px Arial";
    ctx.fillText(`Distance: ${payload.distanceYds} yds`, 540, 360);
    ctx.fillText(`Shots: ${payload.shots}`, 540, 415);
    ctx.fillText(
      `Windage: ${fmt2(payload.windageClicks)} ${payload.windageDirection}`,
      540,
      500
    );
    ctx.fillText(
      `Elevation: ${fmt2(payload.elevationClicks)} ${payload.elevationDirection}`,
      540,
      555
    );

    return canvas.toDataURL("image/png");
  }

  async function renderReport(payload) {
    if (vendorBtn) {
      vendorBtn.href = payload.vendorUrl || "#";
      vendorBtn.textContent = payload.vendorUrl ? payload.vendorName : "Visit Vendor";
    }

    if (surveyBtn) {
      surveyBtn.href = DEFAULT_SURVEY_URL;
    }

    if (secCardImg) {
      secCardImg.src = await drawReport(payload);
    }
  }

  const rawPayload = getPayload();
  const payload = normalizePayload(rawPayload);

  if (!payload) {
    alert("No SEC data found.");
    return;
  }

  try {
    localStorage.setItem(KEY_PAYLOAD, JSON.stringify(rawPayload));
  } catch {}

  renderPrecision(payload);
  showPrecision();

  if (toReportBtn) {
    toReportBtn.addEventListener("click", async () => {
      showReport();
      await renderReport(payload);
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (viewReport && viewReport.classList.contains("viewOn")) {
        showPrecision();
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "./index.html";
      }
    });
  }

  if (backBtnReport) {
    backBtnReport.addEventListener("click", showPrecision);
  }

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }
})();
