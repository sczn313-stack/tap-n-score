/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — TWO-PAGE SEC
   Page 1: Precision (score + big clicks) + Intelligent Exit
   Page 2: Report Card image (tap & hold to save) + Vendor + Survey

   FIXES INCLUDED:
   ✅ Page 1 numeric SCORE now color-shifts by score band
   ✅ Exit button:
      - If launched from target page: history.back() then fallback to ./index.html
      - Otherwise: ./index.html
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Views
  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");
  const toReportBtn = $("toReportBtn");
  const backBtn = $("backBtn");

  // NEW: Exit button (Page 1)
  const exitBtn = $("exitBtn");

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

  // Page 2 elements
  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");

  // Storage keys (must match index.js)
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";

  // History (Top 20 stored, render Top 15)
  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";

  // Survey default (your published form)
  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  // -----------------------------
  // Helpers
  // -----------------------------
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
    if (!Number.isFinite(s)) return { cls: "scoreBandNeutral", text: "—", numCls: "scoreNumNeutral" };

    // LOCKED: GREEN 90–100, YELLOW 60–89, RED 0–59
    if (s >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT", numCls: "scoreNumGreen" };
    if (s >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID", numCls: "scoreNumYellow" };
    return { cls: "scoreBandRed", text: "NEEDS WORK", numCls: "scoreNumRed" };
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function domainFromUrl(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  function isBaker(url) {
    const d = domainFromUrl(url || "");
    return d.includes("bakertargets.com") || d.includes("baker");
  }

  function loadTargetImageUrl() {
    // Prefer dataURL (more reliable across navigation), fallback to blobUrl
    const d = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (d.startsWith("data:image/")) return d;

    const b = localStorage.getItem(KEY_TARGET_IMG_BLOB) || "";
    if (b.startsWith("blob:")) return b;

    return "";
  }

  // -----------------------------
  // History
  // -----------------------------
  function loadHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_HISTORY) || "[]");
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(arr) {
    try { localStorage.setItem(KEY_HISTORY, JSON.stringify(arr)); } catch {}
  }

  function pushHistory(payload) {
    const hist = loadHistory();
    const row = {
      t: Date.now(),
      score: Number(payload?.score ?? 0),
      dist: Number(payload?.debug?.distanceYds ?? payload?.distanceYds ?? 0),
      hits: Number(payload?.shots ?? 0),
      windDir: String(payload?.windage?.dir || ""),
      wind: Number(payload?.windage?.clicks ?? 0),
      elevDir: String(payload?.elevation?.dir || ""),
      elev: Number(payload?.elevation?.clicks ?? 0),
      vendor: domainFromUrl(payload?.vendorUrl || "")
    };

    hist.unshift(row);
    const trimmed = hist.slice(0, 20);
    saveHistory(trimmed);
    return trimmed;
  }

  function computeStats(hist) {
    const scores = hist.map(h => Number(h.score)).filter(Number.isFinite);
    const sessions = scores.length;

    const highest20 = sessions ? Math.max(...scores) : 0;

    const avg = (arr) => {
      if (!arr.length) return 0;
      const sum = arr.reduce((a,b) => a + b, 0);
      return sum / arr.length;
    };

    const top5 = scores.slice(0, 5);
    const top20 = scores.slice(0, 20);

    return {
      sessions,
      highest20,
      avg5: avg(top5),
      avg20: avg(top20)
    };
  }

  // -----------------------------
  // Report Card image (Canvas -> <img>)
  // -----------------------------
  async function drawReportCardImage(payload, hist) {
    const stats = computeStats(hist);

    const W = 1080;
    const H = 1920;
    const pad = 60;

    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    // Background
    ctx.fillStyle = "#06070a";
    ctx.fillRect(0, 0, W, H);

    function roundedRect(x,y,w,h,r){
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.arcTo(x+w, y, x+w, y+h, r);
      ctx.arcTo(x+w, y+h, x, y+h, r);
      ctx.arcTo(x, y+h, x, y, r);
      ctx.arcTo(x, y, x+w, y, r);
      ctx.closePath();
    }
    function panel(x,y,w,h){
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      roundedRect(x,y,w,h,28);
      ctx.fill();
      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      roundedRect(x,y,w,h,28);
      ctx.stroke();
      ctx.restore();
    }

    // Title SEC centered
    const secY = 120;
    ctx.font = "900 92px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const parts = ["S", "E", "C"];
    const colors = ["#ff4d4d", "#eef2f7", "#2f66ff"];
    const spacing = 90;
    const midX = W / 2;
    const startX = midX - spacing;

    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillText(parts[i], startX + spacing * i, secY);
    }

    ctx.fillStyle = "rgba(238,242,247,.75)";
    ctx.font = "700 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Shooter Experience Card", W/2, secY + 42);

    // Score block
    panel(pad, 220, W - pad*2, 220);

    const score = Number(payload?.score ?? 0);
    const band = scoreBandInfo(score);

    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(238,242,247,.70)";
    ctx.textAlign = "center";
    ctx.fillText("SCORE", W/2, 285);

    // Score number in band color on the card image too
    let scoreColor = "rgba(238,242,247,.94)";
    if (band.cls === "scoreBandGreen") scoreColor = "rgba(72,255,139,.98)";
    if (band.cls === "scoreBandYellow") scoreColor = "rgba(255,232,90,.98)";
    if (band.cls === "scoreBandRed") scoreColor = "rgba(255,77,77,.98)";

    ctx.font = "900 120px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColor;
    ctx.fillText(String(Math.round(score)), W/2, 405);

    // band pill
    const pillW = 720, pillH = 64;
    const pillX = (W - pillW)/2;
    const pillY = 430;
    roundedRect(pillX, pillY, pillW, pillH, 999);

    let pillFill = "rgba(255,255,255,.08)";
    let pillText = band.text;
    let pillTextColor = "rgba(238,242,247,.75)";
    if (band.cls === "scoreBandGreen"){ pillFill = "rgba(72,255,139,.92)"; pillTextColor="#031009"; }
    if (band.cls === "scoreBandYellow"){ pillFill = "rgba(255,232,90,.92)"; pillTextColor="#191300"; }
    if (band.cls === "scoreBandRed"){ pillFill = "rgba(255,77,77,.92)"; pillTextColor="#1b0000"; }

    ctx.fillStyle = pillFill;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    roundedRect(pillX, pillY, pillW, pillH, 999);
    ctx.stroke();

    ctx.fillStyle = pillTextColor;
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(pillText, W/2, pillY + 44);

    // Identity line
    const dist = Number(payload?.debug?.distanceYds ?? 0);
    const hits = Number(payload?.shots ?? 0);

    const wdir = String(payload?.windage?.dir || "");
    const edir = String(payload?.elevation?.dir || "");
    const wclick = fmt2(payload?.windage?.clicks ?? 0);
    const eclick = fmt2(payload?.elevation?.clicks ?? 0);

    ctx.fillStyle = "rgba(238,242,247,.78)";
    ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${dist || 100} yds  |  ${hits} hits  |  ${wclick} ${wdir}  |  ${eclick} ${edir}`, W/2, 560);

    // Two equal squares: thumbnail + vendor
    const sq = 360;
    const gap = 60;
    const total = sq*2 + gap;
    const start = (W - total)/2;
    const ySq = 620;

    panel(start, ySq, sq, sq);
    panel(start + sq + gap, ySq, sq, sq);

    ctx.fillStyle = "rgba(238,242,247,.72)";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("TARGET USED", start + sq/2, ySq - 16);
    ctx.fillText("OFFICIAL TARGET PARTNER", start + sq + gap + sq/2, ySq - 16);

    const imgUrl = loadTargetImageUrl();
    if (imgUrl) {
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = imgUrl;
        });

        const r = Math.min(img.width / sq, img.height / sq);
        const sw = sq * r;
        const sh = sq * r;
        const sx = (img.width - sw) / 2;
        const sy = (img.height - sh) / 2;

        ctx.save();
        roundedRect(start + 10, ySq + 10, sq - 20, sq - 20, 22);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, start + 10, ySq + 10, sq - 20, sq - 20);
        ctx.restore();
      } catch {}
    } else {
      ctx.fillStyle = "rgba(238,242,247,.25)";
      ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("No Image", start + sq/2, ySq + sq/2);
    }

    const vendorUrl = String(payload?.vendorUrl || "");
    const vendorHost = domainFromUrl(vendorUrl);
    const vendorName = isBaker(vendorUrl) ? "Baker Printing" : (vendorHost || "Vendor Partner");

    ctx.fillStyle = "rgba(238,242,247,.92)";
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(vendorName, start + sq + gap + sq/2, ySq + sq/2 - 10);

    ctx.fillStyle = "rgba(238,242,247,.62)";
    ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("After-Shot Intelligence", start + sq + gap + sq/2, ySq + sq/2 + 34);

    // Stats panel
    panel(pad, 1040, W - pad*2, 240);
    ctx.fillStyle = "rgba(238,242,247,.70)";
    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SESSION SUMMARY", W/2, 1090);

    ctx.fillStyle = "rgba(238,242,247,.92)";
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const leftX = pad + 140;
    const rightX = W - pad - 140;
    const row1 = 1160;
    const row2 = 1240;

    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(stats.highest20)}`, leftX, row1);
    ctx.fillText(`${stats.avg5.toFixed(1)}`, rightX, row1);

    ctx.fillText(`${stats.avg20.toFixed(1)}`, leftX, row2);
    ctx.fillText(`${stats.sessions}`, rightX, row2);

    ctx.fillStyle = "rgba(238,242,247,.70)";
    ctx.font = "900 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Highest (20)", leftX, row1 + 40);
    ctx.fillText("Average (5)", rightX, row1 + 40);
    ctx.fillText("Average (20)", leftX, row2 + 40);
    ctx.fillText("Sessions", rightX, row2 + 40);

    // Top 15 history
    panel(pad, 1320, W - pad*2, 500);
    ctx.fillStyle = "rgba(238,242,247,.75)";
    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("TOP 15 (MOST RECENT) — SCORE / YDS / HITS", W/2, 1375);

    const top15 = hist.slice(0, 15);
    ctx.textAlign = "left";
    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const startY = 1425;
    const lineH = 30;
    const colX = pad + 60;

    for (let i = 0; i < top15.length; i++) {
      const h = top15[i];
      const rowY = startY + i * lineH;

      if (i === 0) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#2f66ff";
        roundedRect(pad + 30, rowY - 22, W - pad*2 - 60, 32, 10);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = "rgba(238,242,247,.92)";
      const s = Math.round(Number(h.score || 0));
      const yd = Math.round(Number(h.dist || 0));
      const ht = Math.round(Number(h.hits || 0));
      ctx.fillText(`${String(i+1).padStart(2,"0")}.  ${s}   |   ${yd} yds   |   ${ht} hits`, colX, rowY);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(238,242,247,.45)";
    ctx.font = "800 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Generated ${nowStamp()}`, W/2, 1875);

    return c.toDataURL("image/png");
  }

  // -----------------------------
  // Payload
  // -----------------------------
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

  // -----------------------------
  // View switching
  // -----------------------------
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

  // -----------------------------
  // Intelligent Exit
  // -----------------------------
  function smartExit() {
    const from = getQueryParam("from") || "";
    const cameFromTarget = (from === "target");

    if (cameFromTarget) {
      const before = window.location.href;
      try { window.history.back(); } catch {}

      setTimeout(() => {
        if (window.location.href === before) {
          window.location.href = "./index.html";
        }
      }, 250);
      return;
    }

    window.location.href = "./index.html";
  }

  // -----------------------------
  // Render Page 1
  // -----------------------------
  function renderPrecision(payload) {
    const score = Number(payload?.score ?? 0);
    const band = scoreBandInfo(score);

    // Score number
    scoreValue.textContent = Number.isFinite(score) ? String(Math.round(score)) : "—";

    // ✅ Score number color by band
    scoreValue.classList.remove("scoreNumNeutral", "scoreNumGreen", "scoreNumYellow", "scoreNumRed");
    scoreValue.classList.add(band.numCls);

    // Band pill
    scoreBand.classList.remove("scoreBandNeutral", "scoreBandGreen", "scoreBandYellow", "scoreBandRed");
    scoreBand.classList.add(band.cls);
    scoreBand.textContent = band.text;

    // Big clicks
    windageBig.textContent = fmt2(payload?.windage?.clicks ?? 0);
    windageDir.textContent = String(payload?.windage?.dir || "—");

    elevationBig.textContent = fmt2(payload?.elevation?.clicks ?? 0);
    elevationDir.textContent = String(payload?.elevation?.dir || "—");

    const dist = Number(payload?.debug?.distanceYds ?? payload?.distanceYds ?? 100);
    const shots = Number(payload?.shots ?? 0);

    runDistance.textContent = `${Math.round(dist)} yds`;
    runHits.textContent = `${shots} hits`;
    runTime.textContent = nowStamp();

    // Exit label
    if (exitBtn) {
      const from = getQueryParam("from") || "";
      exitBtn.textContent = (from === "target") ? "Back to Target" : "Exit";
    }
  }

  // -----------------------------
  // Render Page 2
  // -----------------------------
  async function renderReport(payload) {
    const vendorUrl = String(payload?.vendorUrl || "");
    const surveyUrl = String(payload?.surveyUrl || "") || DEFAULT_SURVEY_URL;

    if (vendorUrl && vendorUrl.startsWith("http")) {
      vendorBtn.href = vendorUrl;
      vendorBtn.style.opacity = "1";
      vendorBtn.style.pointerEvents = "auto";
      vendorBtn.textContent = isBaker(vendorUrl) ? "Baker Printing — Shop Targets" : "Visit Vendor";
    } else {
      vendorBtn.href = "#";
      vendorBtn.style.opacity = ".65";
      vendorBtn.style.pointerEvents = "none";
      vendorBtn.textContent = "Vendor (Not Set)";
    }

    if (surveyUrl && surveyUrl.startsWith("http")) {
      surveyBtn.href = surveyUrl;
      surveyBtn.style.opacity = "1";
      surveyBtn.style.pointerEvents = "auto";
    } else {
      surveyBtn.href = "#";
      surveyBtn.style.opacity = ".65";
      surveyBtn.style.pointerEvents = "none";
    }

    const hist = loadHistory();
    const dataUrl = await drawReportCardImage(payload, hist);
    secCardImg.src = dataUrl;
  }

  // -----------------------------
  // Boot
  // -----------------------------
  const payload = loadPayload();
  if (!payload) {
    alert("SEC data not found. Go back and run a target first.");
    showPrecision();
    return;
  }

  // Push current run into history immediately
  pushHistory(payload);

  // Render initial view
  renderPrecision(payload);
  showPrecision();

  // Wire buttons
  toReportBtn.addEventListener("click", async () => {
    showReport();
    await renderReport(payload);
  });

  backBtn.addEventListener("click", () => {
    showPrecision();
  });

  // Wire exit
  if (exitBtn) {
    exitBtn.addEventListener("click", smartExit);
  }

})();
