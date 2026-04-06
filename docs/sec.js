/* ============================================================
   docs/sec.js
   BEAUTIFIED FULL REPLACEMENT
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");
  const toReportBtn = $("toReportBtn");
  const backBtn = $("backBtn");
  const backBtnReport = $("backBtnReport");

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

  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const downloadBtn = $("downloadBtn");
  const surveyBtn = $("surveyBtn");

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

    const score = Number(raw.score ?? raw.smartScore ?? 0);
    const shots = Number(raw.shots ?? 0);
    const distanceYds = Number(raw.distance_yards ?? raw.debug?.distanceYds ?? 100);

    const windageClicks = Number(raw.windage_clicks ?? raw.windage?.clicks ?? 0);
    const elevationClicks = Number(raw.elevation_clicks ?? raw.elevation?.clicks ?? 0);

    const windageDirection = String(raw.windage_dir ?? raw.windage?.dir ?? "—");
    const elevationDirection = String(raw.elevation_dir ?? raw.elevation?.dir ?? "—");

    const vendorUrl = String(raw.vendorUrl || localStorage.getItem(KEY_VENDOR_URL) || "");
    const vendorName = String(raw.vendorName || localStorage.getItem(KEY_VENDOR_NAME) || "Visit Vendor");

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

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fillRoundedRect(ctx, x, y, w, h, r, fillStyle) {
    ctx.save();
    drawRoundedRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
  }

  function strokeRoundedRect(ctx, x, y, w, h, r, strokeStyle, lineWidth = 1) {
    ctx.save();
    drawRoundedRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  async function drawReport(payload) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;

    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 1200, 1600);
    bg.addColorStop(0, "#07163f");
    bg.addColorStop(0.55, "#0a2467");
    bg.addColorStop(1, "#081434");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(600, 280, 80, 600, 280, 700);
    glow.addColorStop(0, "rgba(90,140,255,0.20)");
    glow.addColorStop(1, "rgba(90,140,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    fillRoundedRect(ctx, 90, 80, 1020, 1440, 38, "rgba(255,255,255,0.05)");
    strokeRoundedRect(ctx, 90, 80, 1020, 1440, 38, "rgba(255,255,255,0.12)", 2);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff6666";
    ctx.font = "bold 84px Arial";
    ctx.fillText("S", 470, 180);

    ctx.fillStyle = "#ffffff";
    ctx.fillText("E", 600, 180);

    ctx.fillStyle = "#6b95ff";
    ctx.fillText("C", 725, 180);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "32px Arial";
    ctx.fillText("Shooter Experience Card", 790, 182);

    const scorePanel = ctx.createLinearGradient(180, 240, 1020, 520);
    scorePanel.addColorStop(0, "rgba(255,255,255,0.08)");
    scorePanel.addColorStop(1, "rgba(255,255,255,0.04)");
    fillRoundedRect(ctx, 180, 240, 840, 260, 32, scorePanel);
    strokeRoundedRect(ctx, 180, 240, 840, 260, 32, "rgba(255,255,255,0.10)", 2);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 170px Arial";
    ctx.fillText(String(Math.round(payload.score)), 600, 390);

    let bandText = "NEEDS WORK";
    let bandFill = "#f16c6c";
    if (payload.score >= 90) {
      bandText = "STRONG / EXCELLENT";
      bandFill = "#59d37c";
    } else if (payload.score >= 60) {
      bandText = "IMPROVING / SOLID";
      bandFill = "#f1c64f";
    }

    fillRoundedRect(ctx, 430, 425, 340, 72, 36, bandFill);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 28px Arial";
    ctx.fillText(bandText, 600, 472);

    const cardFill = "rgba(255,255,255,0.06)";
    fillRoundedRect(ctx, 180, 560, 390, 260, 28, cardFill);
    fillRoundedRect(ctx, 630, 560, 390, 260, 28, cardFill);
    strokeRoundedRect(ctx, 180, 560, 390, 260, 28, "rgba(255,255,255,0.10)", 2);
    strokeRoundedRect(ctx, 630, 560, 390, 260, 28, "rgba(255,255,255,0.10)", 2);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "bold 34px Arial";
    ctx.fillText("WINDAGE", 375, 645);
    ctx.fillText("ELEVATION", 825, 645);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 88px Arial";
    ctx.fillText(fmt2(payload.windageClicks), 375, 745);
    ctx.fillText(fmt2(payload.elevationClicks), 825, 745);

    ctx.font = "bold 54px Arial";
    ctx.fillText(payload.windageDirection, 375, 815);
    ctx.fillText(payload.elevationDirection, 825, 815);

    fillRoundedRect(ctx, 180, 870, 840, 180, 28, "rgba(255,255,255,0.06)");
    strokeRoundedRect(ctx, 180, 870, 840, 180, 28, "rgba(255,255,255,0.10)", 2);

    ctx.fillStyle = "rgba(255,255,255,0.84)";
    ctx.font = "bold 34px Arial";
    ctx.fillText(`${payload.distanceYds} yds`, 600, 950);
    ctx.fillText(`${payload.shots} hits`, 600, 1005);

    ctx.font = "28px Arial";
    ctx.fillText(new Date().toLocaleString(), 600, 1060);

    const footer = ctx.createLinearGradient(180, 1145, 1020, 1255);
    footer.addColorStop(0, "rgba(95,141,255,0.96)");
    footer.addColorStop(1, "rgba(59,99,235,0.96)");
    fillRoundedRect(ctx, 180, 1145, 840, 110, 24, footer);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Arial";
    ctx.fillText(
      payload.vendorName && payload.vendorName !== "Visit Vendor"
        ? String(payload.vendorName).toUpperCase()
        : "SEC REPORT",
      600,
      1215
    );

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "bold 26px Arial";
    ctx.fillText("FAITH • ORDER • PRECISION", 600, 1360);

    return canvas.toDataURL("image/png");
  }

  async function renderReport(payload) {
    if (vendorBtn) {
      vendorBtn.href = payload.vendorUrl || "#";
      vendorBtn.textContent =
        payload.vendorName === "BAKER TARGETS"
          ? "Shop Baker Targets"
          : (payload.vendorUrl ? payload.vendorName : "Visit Vendor");
    }

    if (surveyBtn) {
      surveyBtn.href = DEFAULT_SURVEY_URL;
    }

    if (secCardImg) {
      secCardImg.src = await drawReport(payload);
    }

    if (downloadBtn) {
      downloadBtn.onclick = (e) => {
        e.preventDefault();
        const a = document.createElement("a");
        a.href = secCardImg.src;
        a.download = "SEC_Report.png";
        a.click();
      };
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
      toReportBtn.textContent = "Loading...";
      toReportBtn.disabled = true;

      showReport();
      await renderReport(payload);
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (viewReport && viewReport.classList.contains("viewOn")) {
        showPrecision();
        toReportBtn.textContent = "Unlock Full Report";
        toReportBtn.disabled = false;
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "./index.html";
      }
    });
  }

  if (backBtnReport) {
    backBtnReport.addEventListener("click", () => {
      showPrecision();
      if (toReportBtn) {
        toReportBtn.textContent = "Unlock Full Report";
        toReportBtn.disabled = false;
      }
    });
  }

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }
})();
