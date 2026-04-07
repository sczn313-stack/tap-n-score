(() => {
  const $ = (id) => document.getElementById(id);

  const scoreValue = $("scoreValue");
  const scoreBand = $("scoreBand");
  const windageBig = $("windageBig");
  const windageDir = $("windageDir");
  const elevationBig = $("elevationBig");
  const elevationDir = $("elevationDir");
  const runDistance = $("runDistance");
  const runHits = $("runHits");
  const runSummary = $("runSummary");
  const toReportBtn = $("toReportBtn");
  const goHomeBtn = $("goHomeBtn");

  const reportSection = $("reportSection");
  const targetThumb = $("targetThumb");
  const vendorCard = $("vendorCard");
  const vendorName = $("vendorName");
  const vendorLogoWrap = $("vendorLogoWrap");
  const vendorLogo = $("vendorLogo");
  const highestScore = $("highestScore");
  const averageScore = $("averageScore");
  const historyList = $("historyList");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";
  const KEY_VENDOR_NAME = "SCZN3_VENDOR_NAME_V1";
  const KEY_VENDOR_LOGO = "SCZN3_VENDOR_LOGO_V1";

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

  function getPayload() {
    return safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "", null);
  }

  function getHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_HISTORY) || "[]", []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(items) {
    localStorage.setItem(KEY_HISTORY, JSON.stringify(items));
  }

  function getTargetImage() {
    const dataUrl = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (dataUrl.startsWith("data:image/")) return dataUrl;

    const blobUrl = localStorage.getItem(KEY_TARGET_IMG_BLOB) || "";
    if (blobUrl.startsWith("blob:")) return blobUrl;

    return "";
  }

  function bandText(score) {
    const s = Number(score) || 0;
    if (s >= 90) return "STRONG / EXCELLENT";
    if (s >= 80) return "IMPROVING / SOLID";
    return "NEEDS WORK";
  }

  function bandClass(score) {
    const s = Number(score) || 0;
    if (s >= 80) return "score-band-yellow";
    return "score-band-red";
  }

  function normalize(payload) {
    return {
      score: Number(payload?.score ?? 80),
      shots: Number(payload?.shots ?? 4),
      windage: {
        clicks: Number(payload?.windage?.clicks ?? 6.87),
        dir: String(payload?.windage?.dir || "LEFT")
      },
      elevation: {
        clicks: Number(payload?.elevation?.clicks ?? 2.98),
        dir: String(payload?.elevation?.dir || "DOWN")
      },
      debug: {
        distanceYds: Number(payload?.debug?.distanceYds ?? 100)
      },
      vendorUrl: String(payload?.vendorUrl || localStorage.getItem(KEY_VENDOR_URL) || "#"),
      vendorName: String(payload?.vendorName || localStorage.getItem(KEY_VENDOR_NAME) || "VENDOR")
    };
  }

  function pushHistory(payload) {
    const row = {
      score: Math.round(payload.score),
      distanceYds: Number(payload.debug.distanceYds),
      hits: Number(payload.shots)
    };

    const history = getHistory();
    history.unshift(row);

    const trimmed = history.slice(0, 10);
    saveHistory(trimmed);
    return trimmed;
  }

  function renderTop(payload) {
    scoreValue.textContent = String(Math.round(payload.score));
    scoreBand.textContent = bandText(payload.score);
    scoreBand.className = `hero-score-band ${bandClass(payload.score)}`;

    windageBig.textContent = fmt2(payload.windage.clicks);
    windageDir.textContent = payload.windage.dir;

    elevationBig.textContent = fmt2(payload.elevation.clicks);
    elevationDir.textContent = payload.elevation.dir;

    runDistance.textContent = `${payload.debug.distanceYds} yds`;
    runHits.textContent = `${payload.shots} hits`;
    runSummary.textContent = `${fmt2(payload.windage.clicks)} ${payload.windage.dir} | ${fmt2(payload.elevation.clicks)} ${payload.elevation.dir}`;
  }

  function renderReport(payload, history) {
    const img = getTargetImage();
    if (img) targetThumb.src = img;

    const logo = localStorage.getItem(KEY_VENDOR_LOGO) || "";
    if (logo && vendorLogo && vendorLogoWrap) {
      vendorLogo.src = logo;
      vendorLogoWrap.classList.remove("hidden");
    }

    vendorName.textContent = payload.vendorName || "VENDOR";
    vendorCard.href = payload.vendorUrl || "#";

    const scores = history.map((x) => Number(x.score || 0));
    const highest = scores.length ? Math.max(...scores) : Math.round(payload.score);
    const average = scores.length
      ? (scores.reduce((a, b) => a + b, 0) / scores.length)
      : payload.score;

    highestScore.textContent = String(highest);
    averageScore.textContent = average.toFixed(2);

    historyList.innerHTML = history.map((row, idx) => {
      const n = String(idx + 1).padStart(2, "0");
      return `<div class="history-row">${n}. ${row.score} &nbsp; | &nbsp; ${row.distanceYds} yds &nbsp; | &nbsp; ${row.hits} hits</div>`;
    }).join("");
  }

  toReportBtn.addEventListener("click", () => {
    reportSection.classList.remove("hidden");
    reportSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  goHomeBtn.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  const payload = normalize(getPayload() || {});
  const history = pushHistory(payload);

  renderTop(payload);
  renderReport(payload, history);
})();
