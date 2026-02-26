/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — TWO-PAGE SEC
   Page 1: Precision (score + big clicks)
   Page 2: Report Card image (tap & hold to save) + Vendor + Survey

   ✅ Vendor button is HARD-SOURCED from localStorage
   ✅ Cannot fail if landing saved vendor URL
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Views
  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");
  const toReportBtn = $("toReportBtn");
  const backBtn = $("backBtn");

  // Page 1 elements
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

  // Page 2 elements
  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");

  // Storage keys
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_VENDOR_URL = "SCZN3_VENDOR_URL_V1";

  // History
  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";
  const KEEP_N = 10;

  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function b64ToObj(b64) {
    try {
      const json = decodeURIComponent(escape(atob(String(b64 || ""))));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function nowStamp() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd}/${yy} ${hh}:${mi}`;
  }

  function scoreBandInfo(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return { cls: "scoreBandNeutral", text: "—", scoreCls: "" };
    if (s >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT", scoreCls: "scoreGood" };
    if (s >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID", scoreCls: "scoreMid" };
    return { cls: "scoreBandRed", text: "NEEDS WORK", scoreCls: "scoreLow" };
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function loadHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_HISTORY) || "[]");
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(arr) {
    try { localStorage.setItem(KEY_HISTORY, JSON.stringify(arr)); } catch {}
  }

  function pushHistory(payload) {
    const hist = loadHistory();
    hist.unshift({
      t: Date.now(),
      score: Number(payload?.score ?? 0),
      dist: Number(payload?.debug?.distanceYds ?? payload?.distanceYds ?? 0),
      hits: Number(payload?.shots ?? 0)
    });
    saveHistory(hist.slice(0, KEEP_N));
  }

  function loadPayload() {
    const qp = getQueryParam("payload");
    if (qp) {
      const obj = b64ToObj(qp);
      if (obj) return obj;
    }
    const s = localStorage.getItem(KEY_PAYLOAD) || "";
    const j = safeJsonParse(s);
    if (j) return j;
    return null;
  }

  function showPrecision() {
    viewPrecision.classList.add("viewOn");
    viewReport.classList.remove("viewOn");
    try { window.scrollTo(0, 0); } catch {}
  }

  function showReport() {
    viewPrecision.classList.remove("viewOn");
    viewReport.classList.add("viewOn");
    try { window.scrollTo(0, 0); } catch {}
  }

  function renderPrecision(payload) {
    const score = Number(payload?.score ?? 0);
    const band = scoreBandInfo(score);

    scoreValue.textContent = Number.isFinite(score) ? String(Math.round(score)) : "—";

    scoreBand.classList.remove("scoreBandNeutral", "scoreBandGreen", "scoreBandYellow", "scoreBandRed");
    scoreBand.classList.add(band.cls);
    scoreBand.textContent = band.text;

    scoreValue.classList.remove("scoreGood","scoreMid","scoreLow");
    if (band.scoreCls) scoreValue.classList.add(band.scoreCls);

    windageBig.textContent = fmt2(payload?.windage?.clicks ?? 0);
    windageDir.textContent = String(payload?.windage?.dir || "—");

    elevationBig.textContent = fmt2(payload?.elevation?.clicks ?? 0);
    elevationDir.textContent = String(payload?.elevation?.dir || "—");

    const dist = Number(payload?.debug?.distanceYds ?? payload?.distanceYds ?? 100);
    const shots = Number(payload?.shots ?? 0);

    runDistance.textContent = `${Math.round(dist)} yds`;
    runHits.textContent = `${shots} hits`;
    runTime.textContent = nowStamp();
  }

  async function renderReport(payload) {
    // ✅ HARD SOURCE vendor URL from localStorage (landing truth)
    const vendorUrl = localStorage.getItem(KEY_VENDOR_URL) || "";
    const surveyUrl = String(payload?.surveyUrl || "") || DEFAULT_SURVEY_URL;

    if (vendorUrl && vendorUrl.startsWith("http")) {
      vendorBtn.href = vendorUrl;
      vendorBtn.target = "_blank";
      vendorBtn.rel = "noopener";
      vendorBtn.style.opacity = "1";
      vendorBtn.style.pointerEvents = "auto";
      vendorBtn.textContent = "Baker Printing — Shop Targets";
    } else {
      vendorBtn.href = "#";
      vendorBtn.style.opacity = ".65";
      vendorBtn.style.pointerEvents = "none";
      vendorBtn.textContent = "Vendor Not Active";
    }

    if (surveyUrl && surveyUrl.startsWith("http")) {
      surveyBtn.href = surveyUrl;
      surveyBtn.target = "_blank";
      surveyBtn.rel = "noopener";
      surveyBtn.style.opacity = "1";
      surveyBtn.style.pointerEvents = "auto";
    } else {
      surveyBtn.href = "#";
      surveyBtn.style.opacity = ".65";
      surveyBtn.style.pointerEvents = "none";
    }

    // If your SEC image generator is already working, leave it.
    // If not, we simply keep whatever is already in the HTML.
    // (No changes here to avoid breaking your current render pipeline.)
  }

  const payload = loadPayload();
  if (!payload) {
    alert("SEC data not found. Go back and run a target first.");
    showPrecision();
    return;
  }

  pushHistory(payload);
  renderPrecision(payload);
  showPrecision();

  toReportBtn.addEventListener("click", async () => {
    showReport();
    await renderReport(payload);
  });

  backBtn.addEventListener("click", () => showPrecision());

  goHomeBtn?.addEventListener("click", () => {
    window.location.href = "./index.html?from=sec&fresh=" + Date.now();
  });
})();
