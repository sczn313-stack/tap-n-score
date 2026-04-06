(() => {
  const $ = (id) => document.getElementById(id);

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";

  const elViewPrecision = $("viewPrecision");
  const elViewReport = $("viewReport");

  const elScore = $("scoreValue");
  const elBand = $("scoreBand");

  const elWind = $("windageBig");
  const elWindDir = $("windageDir");

  const elElev = $("elevationBig");
  const elElevDir = $("elevationDir");

  const elDist = $("runDistance");
  const elHits = $("runHits");
  const elTime = $("runTime");

  const elToReport = $("toReportBtn");
  const elBack = $("backBtn");
  const elBackReport = $("backBtnReport");
  const elHome = $("goHomeBtn");

  const elVendor = $("vendorBtn");
  const elSurvey = $("surveyBtn");

  const elImg = $("secCardImg");

  // =========================
  // FORMATTERS
  // =========================
  function fmt(n) {
    return Number(n || 0).toFixed(2);
  }

  function getBand(score) {
    if (score >= 90) return { text: "ELITE", cls: "scoreBandElite" };
    if (score >= 80) return { text: "SOLID", cls: "scoreBandSolid" };
    if (score >= 70) return { text: "IMPROVING", cls: "scoreBandImprove" };
    return { text: "NEEDS WORK", cls: "scoreBandNeutral" };
  }

  // =========================
  // HISTORY
  // =========================
  function saveHistory(payload) {
    try {
      const list = JSON.parse(localStorage.getItem(KEY_HISTORY) || "[]");

      list.unshift({
        score: payload.score,
        wind: payload.windage,
        elev: payload.elevation,
        shots: payload.shots,
        ts: Date.now()
      });

      const trimmed = list.slice(0, 10);
      localStorage.setItem(KEY_HISTORY, JSON.stringify(trimmed));
    } catch {}
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(KEY_HISTORY) || "[]");
    } catch {
      return [];
    }
  }

  function renderHistory() {
    let box = document.getElementById("historyBox");

    if (!box) {
      box = document.createElement("div");
      box.id = "historyBox";
      box.style.marginTop = "10px";
      box.style.fontSize = "12px";
      box.style.opacity = ".8";
      elViewReport.appendChild(box);
    }

    const history = getHistory();

    if (!history.length) {
      box.innerHTML = "";
      return;
    }

    box.innerHTML = `
      <div style="margin-top:10px;text-align:center;">
        <div style="margin-bottom:6px;opacity:.7;">Recent Sessions</div>
        ${history.map(h => `
          <div style="margin:2px 0;">
            ${h.score} • ${fmt(h.wind.clicks)} ${h.wind.dir} • ${fmt(h.elev.clicks)} ${h.elev.dir}
          </div>
        `).join("")}
      </div>
    `;
  }

  // =========================
  // LOAD PAYLOAD
  // =========================
  function loadPayload() {
    try {
      return JSON.parse(localStorage.getItem(KEY_PAYLOAD) || "{}");
    } catch {
      return {};
    }
  }

  const data = loadPayload();

  if (!data || !data.score) return;

  saveHistory(data);

  // =========================
  // PRECISION VIEW
  // =========================
  elScore.textContent = data.score;

  const band = getBand(data.score);
  elBand.textContent = band.text;
  elBand.className = "score-band " + band.cls;

  elWind.textContent = fmt(data.windage.clicks);
  elWindDir.textContent = data.windage.dir;

  elElev.textContent = fmt(data.elevation.clicks);
  elElevDir.textContent = data.elevation.dir;

  elDist.textContent = `${data.debug?.distanceYds || 100} yds`;
  elHits.textContent = `${data.shots} hits`;
  elTime.textContent = new Date().toLocaleString();

  // =========================
  // REPORT VIEW
  // =========================
  function buildReportCard() {
    const html = `
      <div style="
        background:#0b1b3a;
        padding:30px;
        border-radius:20px;
        text-align:center;
      ">
        <div style="font-size:20px;margin-bottom:10px;">SEC Report</div>
        <div style="font-size:60px;font-weight:bold;">${data.score}</div>

        <div style="margin-top:15px;">
          Distance: ${data.debug?.distanceYds || 100} yds<br/>
          Shots: ${data.shots}
        </div>

        <div style="margin-top:15px;">
          Windage: ${fmt(data.windage.clicks)} ${data.windage.dir}<br/>
          Elevation: ${fmt(data.elevation.clicks)} ${data.elevation.dir}
        </div>
      </div>
    `;

    const blob = new Blob([html], { type: "text/html" });
    elImg.src = URL.createObjectURL(blob);
  }

  buildReportCard();
  renderHistory();

  // =========================
  // NAV
  // =========================
  elToReport.onclick = () => {
    elViewPrecision.classList.remove("viewOn");
    elViewReport.classList.add("viewOn");
  };

  elBack.onclick = () => window.history.back();

  elBackReport.onclick = () => {
    elViewReport.classList.remove("viewOn");
    elViewPrecision.classList.add("viewOn");
  };

  elHome.onclick = () => {
    window.location.href = "./index.html?cb=" + Date.now();
  };

  // =========================
  // LINKS
  // =========================
  if (data.vendorUrl) {
    elVendor.href = data.vendorUrl;
  }

  elSurvey.href = "#";

})();
