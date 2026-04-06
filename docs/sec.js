/* ============================================================
   docs/sec.js — FULL REPLACEMENT
   Locked single-render SEC
   - No duplicate rendering
   - No innerHTML +=
   - Page 1 = precision
   - Page 2 = full report
   - Uses existing sec.html IDs only
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Views
  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");

  // Buttons
  const backBtn = $("backBtn");
  const backBtnReport = $("backBtnReport");
  const toReportBtn = $("toReportBtn");
  const goHomeBtn = $("goHomeBtn");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");
  const downloadBtn = $("downloadBtn");

  // Page 1
  const scoreValue = $("scoreValue");
  const scoreBand = $("scoreBand");
  const windageBig = $("windageBig");
  const windageDir = $("windageDir");
  const elevationBig = $("elevationBig");
  const elevationDir = $("elevationDir");
  const runDistance = $("runDistance");
  const runHits = $("runHits");
  const runTime = $("runTime");

  // Page 2
  const secCardImg = $("secCardImg");
  const historyList = $("historyList");

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_VENDOR_NAME = "SCZN3_VENDOR_NAME_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";

  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";
  const HISTORY_LIMIT = 10;
  const HISTORY_PREVIEW = 3;

  function safeJsonParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function fmt2(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  }

  function showPrecision() {
    if (viewPrecision) viewPrecision.classList.add("viewOn");
    if (viewReport) viewReport.classList.remove("viewOn");
  }

  function showReport() {
    if (viewPrecision) viewPrecision.classList.remove("viewOn");
    if (viewReport) viewReport.classList.add("viewOn");
  }

  function scoreBandText(score) {
    const s = Number(score) || 0;
    if (s >= 90) return "STRONG / EXCELLENT";
    if (s >= 80) return "IMPROVING / SOLID";
    return "NEEDS WORK";
  }

  function scoreBandClass(score) {
    const s = Number(score) || 0;
    if (s >= 90) return "scoreBandGreen";
    if (s >= 80) return "scoreBandYellow";
    return "scoreBandRed";
  }

  function getQueryPayload() {
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get("payload");
      if (!raw) return null;
      const json = decodeURIComponent(escape(atob(raw)));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function loadPayload() {
    const fromQuery = getQueryPayload();
    if (fromQuery && typeof fromQuery === "object") {
      try {
        localStorage.setItem(KEY_PAYLOAD, JSON.stringify(fromQuery));
      } catch {}
      return fromQuery;
    }

    const fromStorage = safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "", null);
    if (fromStorage && typeof fromStorage === "object") {
      return fromStorage;
    }

    return null;
  }

  function getTargetImageUrl() {
    const dataUrl = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (dataUrl.startsWith("data:image/")) return dataUrl;

    const blobUrl = localStorage.getItem(KEY_TARGET_IMG_BLOB) || "";
    if (blobUrl.startsWith("blob:")) return blobUrl;

    return "";
  }

  function normalizePayload(payload) {
    const vendorUrl =
      String(payload?.vendorUrl || localStorage.getItem(KEY_VENDOR_URL) || "").trim();

    const vendorName =
      String(payload?.vendorName || localStorage.getItem(KEY_VENDOR_NAME) || "").trim() ||
      (vendorUrl.toLowerCase().includes("baker") ? "BAKER TARGETS" : "VENDOR");

    return {
      sessionId: String(payload?.sessionId || ("sec_" + Date.now())),
      score: Number(payload?.score ?? 0),
      shots: Number(payload?.shots ?? 0),
      windage: {
        dir: String(payload?.windage?.dir || "—"),
        clicks: Number(payload?.windage?.clicks ?? 0)
      },
      elevation: {
        dir: String(payload?.elevation?.dir || "—"),
        clicks: Number(payload?.elevation?.clicks ?? 0)
      },
      dial: {
        unit: String(payload?.dial?.unit || "MOA"),
        clickValue: Number(payload?.dial?.clickValue ?? 0.25)
      },
      debug: {
        distanceYds: Number(payload?.debug?.distanceYds ?? 100),
        inches: {
          x: Number(payload?.debug?.inches?.x ?? 0),
          y: Number(payload?.debug?.inches?.y ?? 0),
          r: Number(payload?.debug?.inches?.r ?? 0)
        }
      },
      vendorUrl,
      vendorName
    };
  }

  function getHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_HISTORY) || "[]", []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(items) {
    try {
      localStorage.setItem(KEY_HISTORY, JSON.stringify(items));
    } catch {}
  }

  function makeHistoryRow(payload) {
    return {
      sessionId: payload.sessionId,
      score: Number(payload.score || 0),
      shots: Number(payload.shots || 0),
      distanceYds: Number(payload.debug?.distanceYds || 100),
      windageDir: String(payload.windage?.dir || "—"),
      windageClicks: Number(payload.windage?.clicks || 0),
      elevationDir: String(payload.elevation?.dir || "—"),
      elevationClicks: Number(payload.elevation?.clicks || 0),
      ts: Date.now()
    };
  }

  function upsertHistory(payload) {
    const nextRow = makeHistoryRow(payload);
    const history = getHistory().filter((item) => item.sessionId !== nextRow.sessionId);
    history.unshift(nextRow);
    const trimmed = history.slice(0, HISTORY_LIMIT);
    saveHistory(trimmed);
    return trimmed;
  }

  function renderHistory(history) {
    if (!historyList) return;

    const preview = history.slice(0, HISTORY_PREVIEW);

    if (!preview.length) {
      historyList.innerHTML = `<div class="history-empty">No recent sessions.</div>`;
      return;
    }

    historyList.innerHTML = preview.map((item) => {
      return `
        <div class="history-row">
          <div class="history-main">
            <div class="history-meta">${item.distanceYds} yds • ${item.shots} hits</div>
            <div class="history-sub">${item.windageDir} ${fmt2(item.windageClicks)} clicks • ${item.elevationDir} ${fmt2(item.elevationClicks)} clicks</div>
          </div>
          <div class="history-score">${Math.round(item.score)}</div>
        </div>
      `;
    }).join("");
  }

  function renderPrecision(payload) {
    if (scoreValue) scoreValue.textContent = String(Math.round(payload.score || 0));

    if (scoreBand) {
      scoreBand.className = "score-band " + scoreBandClass(payload.score);
      scoreBand.textContent = scoreBandText(payload.score);
    }

    if (windageBig) windageBig.textContent = fmt2(payload.windage?.clicks);
    if (windageDir) windageDir.textContent = payload.windage?.dir || "—";

    if (elevationBig) elevationBig.textContent = fmt2(payload.elevation?.clicks);
    if (elevationDir) elevationDir.textContent = payload.elevation?.dir || "—";

    if (runDistance) runDistance.textContent = `${Number(payload.debug?.distanceYds || 100)} yds`;
    if (runHits) runHits.textContent = `${Number(payload.shots || 0)} hits`;

    if (runTime) {
      runTime.textContent = new Date().toLocaleString();
    }
  }

  function drawSecCard(payload) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;

      const ctx = canvas.getContext("2d");

      // Background
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, "#0a1226");
      g.addColorStop(1, "#08111f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Main panel
      roundRect(ctx, 90, 70, 900, 1210, 40);
      ctx.fillStyle = "#0f1e4b";
      ctx.fill();

      // Header logo
      ctx.textAlign = "center";
      ctx.font = "bold 64px Arial";
      ctx.fillStyle = "#ff5b5b";
      ctx.fillText("S", 450, 150);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("E", 540, 150);
      ctx.fillStyle = "#5a8cff";
      ctx.fillText("C", 630, 150);

      ctx.font = "28px Arial";
      ctx.fillStyle = "#d9e3ff";
      ctx.fillText("Shooter Experience Card", 540, 200);

      // Score block
      roundRect(ctx, 180, 240, 720, 170, 26);
      ctx.fillStyle = "#273d83";
      ctx.fill();

      ctx.font = "bold 120px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(Math.round(payload.score || 0)), 540, 355);

      // Band
      roundRect(ctx, 360, 425, 360, 56, 28);
      ctx.fillStyle = Number(payload.score || 0) >= 80 ? "#ffd23f" : "#ef6a6a";
      ctx.fill();
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#0b1020";
      ctx.fillText(scoreBandText(payload.score), 540, 462);

      // Corrections
      roundRect(ctx, 180, 540, 300, 165, 22);
      ctx.fillStyle = "#2c438a";
      ctx.fill();

      roundRect(ctx, 600, 540, 300, 165, 22);
      ctx.fill();

      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#cfd9ff";
      ctx.fillText("WINDAGE", 330, 590);
      ctx.fillText("ELEVATION", 750, 590);

      ctx.font = "bold 62px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(fmt2(payload.windage?.clicks), 330, 660);
      ctx.fillText(fmt2(payload.elevation?.clicks), 750, 660);

      ctx.font = "bold 28px Arial";
      ctx.fillText(payload.windage?.dir || "—", 330, 700);
      ctx.fillText(payload.elevation?.dir || "—", 750, 700);

      // Meta block
      roundRect(ctx, 180, 760, 720, 120, 22);
      ctx.fillStyle = "#2a4187";
      ctx.fill();

      ctx.font = "bold 26px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${Number(payload.debug?.distanceYds || 100)} yds`, 540, 810);
      ctx.fillText(`${Number(payload.shots || 0)} hits`, 540, 848);

      ctx.font = "20px Arial";
      ctx.fillStyle = "#d2dbff";
      ctx.fillText(new Date().toLocaleString(), 540, 880);

      // Vendor button
      roundRect(ctx, 220, 975, 640, 68, 18);
      ctx.fillStyle = "#4d7cff";
      ctx.fill();

      ctx.font = "bold 30px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(payload.vendorName || "VENDOR", 540, 1020);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#b8c7ff";
      ctx.fillText("FAITH • ORDER • PRECISION", 540, 1125);

      // Optional target thumbnail
      const imgUrl = getTargetImageUrl();
      if (imgUrl) {
        const img = new Image();
        img.onload = () => {
          try {
            roundRect(ctx, 320, 1110, 400, 180, 20);
            ctx.save();
            ctx.clip();
            ctx.drawImage(img, 320, 1110, 400, 180);
            ctx.restore();
          } catch {}
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(canvas.toDataURL("image/png"));
        img.src = imgUrl;
      } else {
        resolve(canvas.toDataURL("image/png"));
      }
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function renderReport(payload) {
    const dataUrl = await drawSecCard(payload);

    if (secCardImg) {
      secCardImg.src = dataUrl;
    }

    if (downloadBtn) {
      downloadBtn.href = dataUrl;
      downloadBtn.download = "SEC_Report.png";
    }

    if (vendorBtn) {
      const href = payload.vendorUrl || "#";
      vendorBtn.href = href;
      vendorBtn.textContent = payload.vendorName || "Visit Vendor";
      if (!payload.vendorUrl) {
        vendorBtn.removeAttribute("target");
      }
    }

    if (surveyBtn) {
      surveyBtn.href = DEFAULT_SURVEY_URL;
    }
  }

  function goHome() {
    window.location.href = "./index.html";
  }

  // Boot once only
  const rawPayload = loadPayload();
  if (!rawPayload) {
    console.warn("No SEC payload found.");
    return;
  }

  const payload = normalizePayload(rawPayload);
  const history = upsertHistory(payload);

  renderPrecision(payload);
  renderHistory(history);
  showPrecision();

  if (toReportBtn) {
    toReportBtn.addEventListener("click", async () => {
      await renderReport(payload);
      showReport();
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", goHome);
  }

  if (backBtnReport) {
    backBtnReport.addEventListener("click", showPrecision);
  }

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", goHome);
  }
})();
