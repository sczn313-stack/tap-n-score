/* /* ============================================================
   docs/sec.js (FULL REPLACEMENT) — TWO-PAGE SEC
   Page 1: Precision (score + big clicks)
   Page 2: Report Card image (tap & hold to save) + Vendor + Survey

   NEW IN THIS REV:
   ✅ Draw Baker logo in the “OFFICIAL TARGET PARTNER” square (when Baker)
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
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";

  // History (Store 10, show 10)
  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";
  const KEEP_N = 10;

  // Survey default
  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  // ✅ Add this file in your repo: docs/assets/baker-logo.png
  const BAKER_LOGO_URL = "./assets/baker-logo.png";

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

  function avg2(arr) {
    const a = arr.map(Number).filter(Number.isFinite);
    if (!a.length) return "0.00";
    const s = a.reduce((p,c)=>p+c,0) / a.length;
    return s.toFixed(2);
  }

  function domainFromUrl(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  function isBaker(url) {
    const d = domainFromUrl(url || "");
    return d.includes("bakertargets.com") || d.includes("thebakerpress.com") || d.includes("baker");
  }

  function loadTargetImageUrl() {
    const d = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (d.startsWith("data:image/")) return d;

    const b = localStorage.getItem(KEY_TARGET_IMG_BLOB) || "";
    if (b.startsWith("blob:")) return b;

    return "";
  }

  async function loadImage(url) {
    return await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
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
      vendor: domainFromUrl(payload?.vendorUrl || "")
    };

    hist.unshift(row);
    saveHistory(hist.slice(0, KEEP_N));
    return hist;
  }

  function computeStats(hist) {
    const scores = hist.map(h => Number(h.score)).filter(Number.isFinite);
    const highest = scores.length ? Math.max(...scores) : 0;
    const avg10 = avg2(scores.slice(0, KEEP_N));
    return { highest, avg10 };
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

    ctx.fillStyle = "#06070a";
    ctx.fillRect(0, 0, W, H);

    function roundedRect(x, y, w, h, r) {
      const rr = Math.max(0, Math.min(Number(r || 0), w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function panel(x, y, w, h) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      roundedRect(x, y, w, h, 28);
      ctx.fill();

      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      roundedRect(x, y, w, h, 28);
      ctx.stroke();
      ctx.restore();
    }

    // Header
    const secY = 120;
    ctx.font = "900 92px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";

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
    ctx.fillText("SCORE", W/2, 285);

    ctx.font = "900 120px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(238,242,247,.94)";
    ctx.fillText(String(Math.round(score)), W/2, 405);

    // Band pill
    const pillW = 720, pillH = 64;
    const pillX = (W - pillW)/2;
    const pillY = 430;
    roundedRect(pillX, pillY, pillW, pillH, 999);

    let pillFill = "rgba(255,255,255,.08)";
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
    ctx.fillText(band.text, W/2, pillY + 44);

    // One-line identity
    const dist = Number(payload?.debug?.distanceYds ?? payload?.distanceYds ?? 0);
    const hitsN = Number(payload?.shots ?? 0);

    const wdir = String(payload?.windage?.dir || "");
    const edir = String(payload?.elevation?.dir || "");
    const wclick = fmt2(payload?.windage?.clicks ?? 0);
    const eclick = fmt2(payload?.elevation?.clicks ?? 0);

    ctx.fillStyle = "rgba(238,242,247,.78)";
    ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${dist || 100} yds  |  ${hitsN} hits  |  ${wclick} ${wdir}  |  ${eclick} ${edir}`, W/2, 560);

    // Two equal squares: thumbnail + vendor
    const sq = 360;
    const gap = 60;
    const total = sq*2 + gap;
    const start = (W - total)/2;
    const ySq = 620;

    panel(start, ySq, sq, sq);
    panel(start + sq + gap, ySq, sq, sq);

    // Labels
    ctx.fillStyle = "rgba(238,242,247,.72)";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("TARGET USED", start + sq/2, ySq - 16);
    ctx.fillText("OFFICIAL TARGET PARTNER", start + sq + gap + sq/2, ySq - 16);

    // Thumbnail + markers
    const imgUrl = loadTargetImageUrl();
    const aim = payload?.debug?.aim || null;
    const hitArr = Array.isArray(payload?.debug?.hits) ? payload.debug.hits : [];

    if (imgUrl) {
      try {
        const img = await loadImage(imgUrl);

        const innerX = start + 10;
        const innerY = ySq + 10;
        const innerW = sq - 20;
        const innerH = sq - 20;

        const scale = Math.max(innerW / img.width, innerH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = innerX + (innerW - dw)/2;
        const dy = innerY + (innerH - dh)/2;

        ctx.save();
        roundedRect(innerX, innerY, innerW, innerH, 22);
        ctx.clip();

        ctx.drawImage(img, dx, dy, dw, dh);

        function map01(p){
          const x = dx + (Number(p?.x01 ?? 0) * dw);
          const y = dy + (Number(p?.y01 ?? 0) * dh);
          return { x, y };
        }

        for (const h of hitArr) {
          const m = map01(h);
          ctx.beginPath();
          ctx.arc(m.x, m.y, 10, 0, Math.PI*2);
          ctx.fillStyle = "rgba(183,255,60,.95)";
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.stroke();
        }

        if (aim) {
          const m = map01(aim);
          ctx.beginPath();
          ctx.arc(m.x, m.y, 12, 0, Math.PI*2);
          ctx.fillStyle = "rgba(103,243,164,.95)";
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(m.x, m.y, 22, 0, Math.PI*2);
          ctx.strokeStyle = "rgba(238,242,247,.85)";
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.restore();
      } catch {}
    } else {
      ctx.fillStyle = "rgba(238,242,247,.25)";
      ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("No Image", start + sq/2, ySq + sq/2);
    }

    // ✅ Vendor square: Baker logo when Baker; else text
    const vendorUrl = String(payload?.vendorUrl || "");
    const vendorHost = domainFromUrl(vendorUrl);
    const isB = isBaker(vendorUrl);

    const vx = start + sq + gap;
    const vy = ySq;
    const vInnerX = vx + 18;
    const vInnerY = vy + 18;
    const vInnerW = sq - 36;
    const vInnerH = sq - 36;

    let drewLogo = false;
    if (isB) {
      try {
        const logo = await loadImage(BAKER_LOGO_URL + "?v=" + Date.now());
        // contain-fit
        const scale = Math.min(vInnerW / logo.width, vInnerH / logo.height);
        const dw = logo.width * scale;
        const dh = logo.height * scale;
        const dx = vInnerX + (vInnerW - dw) / 2;
        const dy = vInnerY + (vInnerH - dh) / 2;

        ctx.save();
        roundedRect(vInnerX, vInnerY, vInnerW, vInnerH, 22);
        ctx.clip();
        ctx.drawImage(logo, dx, dy, dw, dh);
        ctx.restore();

        drewLogo = true;
      } catch {
        drewLogo = false;
      }
    }

    if (!drewLogo) {
      const vendorName = isB ? "Baker Printing" : (vendorHost || "Vendor Partner");
      ctx.fillStyle = "rgba(238,242,247,.92)";
      ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(vendorName, vx + sq/2, vy + sq/2 - 10);

      ctx.fillStyle = "rgba(238,242,247,.62)";
      ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("After-Shot Intelligence", vx + sq/2, vy + sq/2 + 34);
    }

    // Stats panel
    panel(pad, 1040, W - pad*2, 200);
    ctx.fillStyle = "rgba(238,242,247,.70)";
    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SESSION SUMMARY (LAST 10)", W/2, 1090);

    ctx.fillStyle = "rgba(238,242,247,.92)";
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const leftX = pad + 200;
    const rightX = W - pad - 200;
    const row1 = 1160;

    ctx.fillText(`${Math.round(stats.highest)}`, leftX, row1);
    ctx.fillText(`${stats.avg10}`, rightX, row1);

    ctx.fillStyle = "rgba(238,242,247,.70)";
    ctx.font = "900 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Highest (10)", leftX, row1 + 40);
    ctx.fillText("Average (10)", rightX, row1 + 40);

    // Top 10 history
    panel(pad, 1260, W - pad*2, 540);
    ctx.fillStyle = "rgba(238,242,247,.75)";
    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("LAST 10 — SCORE / YDS / HITS (NEWEST TOP)", W/2, 1315);

    const top10 = hist.slice(0, KEEP_N);
    ctx.textAlign = "left";
    ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const startY = 1370;
    const lineH = 44;
    const colX = pad + 60;

    for (let i = 0; i < top10.length; i++) {
      const h = top10[i];
      const rowY = startY + i * lineH;

      if (i === 0) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#2f66ff";
        roundedRect(pad + 30, rowY - 32, W - pad*2 - 60, 42, 12);
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
  // Render Page 1
  // -----------------------------
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

  pushHistory(payload);

  renderPrecision(payload);
  showPrecision();

  toReportBtn.addEventListener("click", async () => {
    showReport();
    await renderReport(payload);
  });

  backBtn.addEventListener("click", () => {
    showPrecision();
  });

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", () => {
      window.location.href = "./index.html?from=sec&fresh=" + Date.now();
    });
  }
})();============================================================
   docs/sec.js (FULL REPLACEMENT) — TWO-PAGE SEC
   Page 1: Precision (score + big clicks)
   Page 2: Report Card image (tap & hold to save) + Vendor + Survey

   FIXES INCLUDED:
   ✅ Exit button works (goHomeBtn -> index.html)
   ✅ Page 1 score color changes by score band (green/yellow/red)
   ✅ Page 2 thumbnail shows Aim + Hole markers
   ✅ Keeps/stores 10 sessions, shows 10 newest on top
   ✅ Avg(10) uses TWO decimals (averages only)
   ✅ “Yellow swoosh” eliminated by radius clamping
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

  // Storage keys (must match index.js)
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";

  // History (Store 10, show 10)
  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";
  const KEEP_N = 10;

  // Survey default (published form)
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
    if (!Number.isFinite(s)) return { cls: "scoreBandNeutral", text: "—", scoreCls: "" };

    // LOCKED: GREEN 90–100, YELLOW 60–89, RED 0–59
    if (s >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT", scoreCls: "scoreGood" };
    if (s >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID", scoreCls: "scoreMid" };
    return { cls: "scoreBandRed", text: "NEEDS WORK", scoreCls: "scoreLow" };
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function avg2(arr) {
    const a = arr.map(Number).filter(Number.isFinite);
    if (!a.length) return "0.00";
    const s = a.reduce((p,c)=>p+c,0) / a.length;
    return s.toFixed(2); // ✅ averages only
  }

  function domainFromUrl(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  function isBaker(url) {
    const d = domainFromUrl(url || "");
    return d.includes("bakertargets.com") || d.includes("baker");
  }

  function loadTargetImageUrl() {
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
      vendor: domainFromUrl(payload?.vendorUrl || "")
    };

    hist.unshift(row);
    const trimmed = hist.slice(0, KEEP_N);
    saveHistory(trimmed);
    return trimmed;
  }

  function computeStats(hist) {
    const scores = hist.map(h => Number(h.score)).filter(Number.isFinite);
    const sessions = scores.length;

    const highest = sessions ? Math.max(...scores) : 0;
    const avg10 = avg2(scores.slice(0, KEEP_N));

    return { sessions, highest, avg10 };
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

    ctx.fillStyle = "#06070a";
    ctx.fillRect(0, 0, W, H);

    // Rounded rect that NEVER “swooshes”
    function roundedRect(x, y, w, h, r) {
      const rr = Math.max(0, Math.min(Number(r || 0), w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function panel(x, y, w, h) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      roundedRect(x, y, w, h, 28);
      ctx.fill();

      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      roundedRect(x, y, w, h, 28);
      ctx.stroke();
      ctx.restore();
    }

    // SEC header
    const secY = 120;
    ctx.font = "900 92px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";

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
    ctx.fillText("SCORE", W/2, 285);

    ctx.font = "900 120px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(238,242,247,.94)";
    ctx.fillText(String(Math.round(score)), W/2, 405);

    // Band pill
    const pillW = 720, pillH = 64;
    const pillX = (W - pillW)/2;
    const pillY = 430;
    roundedRect(pillX, pillY, pillW, pillH, 999);

    let pillFill = "rgba(255,255,255,.08)";
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
    ctx.fillText(band.text, W/2, pillY + 44);

    // One-line identity
    const dist = Number(payload?.debug?.distanceYds ?? payload?.distanceYds ?? 0);
    const hitsN = Number(payload?.shots ?? 0);

    const wdir = String(payload?.windage?.dir || "");
    const edir = String(payload?.elevation?.dir || "");
    const wclick = fmt2(payload?.windage?.clicks ?? 0);
    const eclick = fmt2(payload?.elevation?.clicks ?? 0);

    ctx.fillStyle = "rgba(238,242,247,.78)";
    ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${dist || 100} yds  |  ${hitsN} hits  |  ${wclick} ${wdir}  |  ${eclick} ${edir}`, W/2, 560);

    // Two equal squares: thumbnail + vendor
    const sq = 360;
    const gap = 60;
    const total = sq*2 + gap;
    const start = (W - total)/2;
    const ySq = 620;

    panel(start, ySq, sq, sq);
    panel(start + sq + gap, ySq, sq, sq);

    // Labels
    ctx.fillStyle = "rgba(238,242,247,.72)";
    ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("TARGET USED", start + sq/2, ySq - 16);
    ctx.fillText("OFFICIAL TARGET PARTNER", start + sq + gap + sq/2, ySq - 16);

    // Thumbnail (cover crop) + markers
    const imgUrl = loadTargetImageUrl();
    const aim = payload?.debug?.aim || null;
    const hitArr = Array.isArray(payload?.debug?.hits) ? payload.debug.hits : [];

    if (imgUrl) {
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = imgUrl;
        });

        // cover crop into inner rect
        const innerX = start + 10;
        const innerY = ySq + 10;
        const innerW = sq - 20;
        const innerH = sq - 20;

        const scale = Math.max(innerW / img.width, innerH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = innerX + (innerW - dw)/2;
        const dy = innerY + (innerH - dh)/2;

        ctx.save();
        roundedRect(innerX, innerY, innerW, innerH, 22);
        ctx.clip();

        // draw image
        ctx.drawImage(img, dx, dy, dw, dh);

        // helpers map x01,y01 to the drawn image area (dx..dx+dw)
        function map01(p){
          const x = dx + (Number(p?.x01 ?? 0) * dw);
          const y = dy + (Number(p?.y01 ?? 0) * dh);
          return { x, y };
        }

        // draw hits
        for (const h of hitArr) {
          const m = map01(h);
          ctx.beginPath();
          ctx.arc(m.x, m.y, 10, 0, Math.PI*2);
          ctx.fillStyle = "rgba(183,255,60,.95)";
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.stroke();
        }

        // draw aim point (distinct)
        if (aim) {
          const m = map01(aim);
          ctx.beginPath();
          ctx.arc(m.x, m.y, 12, 0, Math.PI*2);
          ctx.fillStyle = "rgba(103,243,164,.95)";
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.stroke();

          // small crosshair ring
          ctx.beginPath();
          ctx.arc(m.x, m.y, 22, 0, Math.PI*2);
          ctx.strokeStyle = "rgba(238,242,247,.85)";
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.restore();
      } catch {
        // ignore
      }
    } else {
      ctx.fillStyle = "rgba(238,242,247,.25)";
      ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("No Image", start + sq/2, ySq + sq/2);
    }

    // Vendor box (text placeholder)
    const vendorUrl = String(payload?.vendorUrl || "");
    const vendorHost = domainFromUrl(vendorUrl);
    const vendorName = isBaker(vendorUrl) ? "Baker Printing" : (vendorHost || "Vendor Partner");

    ctx.fillStyle = "rgba(238,242,247,.92)";
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(vendorName, start + sq + gap + sq/2, ySq + sq/2 - 10);

    ctx.fillStyle = "rgba(238,242,247,.62)";
    ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("After-Shot Intelligence", start + sq + gap + sq/2, ySq + sq/2 + 34);

    // Stats panel (tight + relevant)
    panel(pad, 1040, W - pad*2, 200);
    ctx.fillStyle = "rgba(238,242,247,.70)";
    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SESSION SUMMARY (LAST 10)", W/2, 1090);

    ctx.fillStyle = "rgba(238,242,247,.92)";
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const leftX = pad + 200;
    const rightX = W - pad - 200;
    const row1 = 1160;

    ctx.fillText(`${Math.round(stats.highest)}`, leftX, row1);
    ctx.fillText(`${stats.avg10}`, rightX, row1);

    ctx.fillStyle = "rgba(238,242,247,.70)";
    ctx.font = "900 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Highest (10)", leftX, row1 + 40);
    ctx.fillText("Average (10)", rightX, row1 + 40);

    // Top 10 history (newest on top)
    panel(pad, 1260, W - pad*2, 540);
    ctx.fillStyle = "rgba(238,242,247,.75)";
    ctx.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("LAST 10 — SCORE / YDS / HITS (NEWEST TOP)", W/2, 1315);

    const top10 = hist.slice(0, KEEP_N);
    ctx.textAlign = "left";
    ctx.font = "900 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const startY = 1370;
    const lineH = 44;
    const colX = pad + 60;

    for (let i = 0; i < top10.length; i++) {
      const h = top10[i];
      const rowY = startY + i * lineH;

      if (i === 0) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#2f66ff";
        roundedRect(pad + 30, rowY - 32, W - pad*2 - 60, 42, 12);
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
  // Render Page 1
  // -----------------------------
  function renderPrecision(payload) {
    const score = Number(payload?.score ?? 0);
    const band = scoreBandInfo(score);

    scoreValue.textContent = Number.isFinite(score) ? String(Math.round(score)) : "—";

    // band pill
    scoreBand.classList.remove("scoreBandNeutral", "scoreBandGreen", "scoreBandYellow", "scoreBandRed");
    scoreBand.classList.add(band.cls);
    scoreBand.textContent = band.text;

    // ✅ score number color by band (NOT white-only)
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

  // ✅ Exit to landing (works every time)
  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", () => {
      window.location.href = "./index.html?from=sec&fresh=" + Date.now();
    });
  }
})();
