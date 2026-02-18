/* docs/sec.js (FULL REPLACEMENT) — SEC + 4-MODE PILOT SURVEY (EFFICIENCY VERSION) */
(() => {
  const $ = (id) => document.getElementById(id);

  // ==============================
  // SURVEY OUTPUT MODES (toggle)
  // ==============================
  const SURVEY_MODE = {
    localStorage: true,   // A: always on
    email: false,         // B: optional (mailto)
    googleSheet: false,   // C: optional (Apps Script endpoint)
    jsonExport: true      // D: portal-ready JSON log
  };

  // If you enable googleSheet, paste your Apps Script URL here:
  const GOOGLE_SHEET_ENDPOINT = ""; // e.g. "https://script.google.com/macros/s/XXXX/exec"

  // If you enable email mode, paste your email here:
  const EMAIL_TO = ""; // e.g. "ron@yourdomain.com"

  // ==============================
  // UI
  // ==============================
  const elScore = $("scoreValue");
  const elScoreLabel = $("scoreLabel");
  const elAvgSoft = $("avgSoft");

  const elShots = $("shotsVal");
  const elWind = $("windVal");
  const elElev = $("elevVal");
  const elWindDir = $("windDir");
  const elElevDir = $("elevDir");

  const elVendorName = $("vendorName");
  const elVendorLink = $("vendorLink");
  const elVendorMicro = $("vendorMicro");

  const elDone = $("doneBtn");
  const elDownload = $("downloadBtn");
  const elScoreAnother = $("scoreAnotherBtn");

  const elErr = $("errLine");
  const elSessionGhost = $("sessionGhost");

  // Survey
  const elSurveyPanel = $("surveyPanel");
  const elSurveyForm = $("surveyForm");
  const elSurveySubmit = $("surveySubmitBtn");
  const elSurveyThanks = $("surveyThanks");

  // ==============================
  // Storage keys (must match index.js)
  // ==============================
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";

  // Soft scoring memory (Avg)
  const KEY_SCORES_DAY = "SCZN3_SCORES_BY_DAY_V1"; // { "YYYY-MM-DD": [numbers...] }

  // Survey logs
  const KEY_SURVEY_LOG = "SCZN3_SURVEY_LOG_V1";       // array rows
  const KEY_SURVEY_JSON_EXPORT = "SCZN3_SURVEY_JSON_V1"; // array rows (same, kept separate if you want)

  function showErr(msg) {
    if (!elErr) return;
    elErr.style.display = "block";
    elErr.textContent = String(msg || "Error");
  }
  function hideErr() { if (elErr) elErr.style.display = "none"; }

  function clampNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function safeJSON(s) {
    try { return JSON.parse(String(s || "")); } catch { return null; }
  }

  function decodePayloadFromQuery() {
    try {
      const qs = new URLSearchParams(window.location.search);
      const b64 = qs.get("payload");
      if (!b64) return null;
      const json = decodeURIComponent(escape(atob(b64)));
      const obj = JSON.parse(json);
      return obj && typeof obj === "object" ? obj : null;
    } catch {
      return null;
    }
  }

  function getPayload() {
    return decodePayloadFromQuery() || safeJSON(localStorage.getItem(KEY_PAYLOAD)) || null;
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function recordScoreForAvg(score) {
    const day = todayKey();
    const box = safeJSON(localStorage.getItem(KEY_SCORES_DAY)) || {};
    const arr = Array.isArray(box[day]) ? box[day] : [];
    arr.push(score);
    box[day] = arr.slice(-200);
    try { localStorage.setItem(KEY_SCORES_DAY, JSON.stringify(box)); } catch {}
    const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
    return { avg, n: arr.length };
  }

  // ===== Score labeling + color bands (YOUR LOCK)
  // GREEN = 90–100
  // YELLOW = 60–89
  // RED = 0–59
  function labelForScore(s) {
    if (s >= 90) return "Strong / Excellent / Elite";
    if (s >= 60) return "Improving / Solid";
    return "Needs work";
  }
  function bandForScore(s) {
    if (s >= 90) return "green";
    if (s >= 60) return "yellow";
    return "red";
  }

  function normalizeDirWord(w) {
    const x = String(w || "").toUpperCase();
    if (x === "LEFT" || x === "RIGHT" || x === "UP" || x === "DOWN") return x;
    return "—";
  }

  function vendorNameFromUrl(url) {
    // Pilot default
    if (typeof url === "string" && url.startsWith("http")) return "Baker Printing";
    return "—";
  }

  function formatClicks(n) { return clampNum(n, 0).toFixed(2); }

  function goHome(reset = false) {
    const url = `./index.html?fresh=${Date.now()}${reset ? "&again=1" : ""}`;
    window.location.href = url;
  }

  // ==============================
  // CERTIFICATE EXPORT (existing)
  // ==============================
  async function exportCertificatePNG(p) {
    const dataUrl = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (!dataUrl.startsWith("data:image/")) throw new Error("Missing target image.");

    const img = await loadImage(dataUrl);

    const W = 1400, H = 1800;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");

    const bg = "#f3f4f6";
    const ink = "#111827";
    const soft = "rgba(17,24,39,.55)";
    const border = "rgba(17,24,39,.28)";

    g.fillStyle = bg; g.fillRect(0,0,W,H);

    g.strokeStyle = border; g.lineWidth = 3; g.strokeRect(34,34,W-68,H-68);
    g.strokeStyle = "rgba(17,24,39,.14)"; g.lineWidth = 2; g.strokeRect(52,52,W-104,H-104);

    g.fillStyle = ink;
    g.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("SHOOTER EXPERIENCE CARD", 92, 128);

    drawSECMark(g, W - 240, 92);

    const pad = 92, gap = 24, topY = 170, panelH = 520;
    const panelW = (W - pad*2 - gap) / 2;

    drawRoundRect(g, pad, topY, panelW, panelH, 22, "rgba(255,255,255,.75)", "rgba(17,24,39,.14)");
    drawRoundRect(g, pad + panelW + gap, topY, panelW, panelH, 22, "rgba(255,255,255,.75)", "rgba(17,24,39,.14)");

    const score = Math.round(clampNum(p.score, 0));
    g.fillStyle = soft; g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("SCORE", pad + 28, topY + 56);

    g.fillStyle = ink; g.font = "1000 170px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(String(score), pad + 28, topY + 220);

    g.fillStyle = ink; g.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(labelForScore(score), pad + 28, topY + 280);

    g.fillStyle = soft; g.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("Measured results from confirmed hits", pad + 28, topY + 334);

    const statsY = topY + panelH + 26, statsH = 170;
    const statW = (W - pad*2 - gap*2) / 3;

    const shots = clampNum(p.shots, 0);
    const wClicks = clampNum(p.windage?.clicks, 0);
    const eClicks = clampNum(p.elevation?.clicks, 0);
    const wDir = normalizeDirWord(p.windage?.dir);
    const eDir = normalizeDirWord(p.elevation?.dir);

    drawStatBox(g, pad + (statW + gap)*0, statsY, statW, statsH, "HITS", String(shots), "", ink, soft);
    drawStatBox(g, pad + (statW + gap)*1, statsY, statW, statsH, "WINDAGE", formatClicks(wClicks), wDir, ink, soft);
    drawStatBox(g, pad + (statW + gap)*2, statsY, statW, statsH, "ELEVATION", formatClicks(eClicks), eDir, ink, soft);

    const thumbX = pad + panelW + gap + 22;
    const thumbY = topY + 70;
    const thumbW = panelW - 44;
    const thumbH = panelH - 120;

    g.fillStyle = soft;
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("TARGET (with hits)", pad + panelW + gap + 28, topY + 56);

    const fit = contain(img.width, img.height, thumbW, thumbH);
    const ix = thumbX + (thumbW - fit.w)/2;
    const iy = thumbY + (thumbH - fit.h)/2;

    drawRoundRect(g, thumbX, thumbY, thumbW, thumbH, 18, "rgba(17,24,39,.04)", "rgba(17,24,39,.12)");
    clipRoundRect(g, thumbX, thumbY, thumbW, thumbH, 18, () => {
      g.drawImage(img, ix, iy, fit.w, fit.h);
    });

    const aim = p?.debug?.aim;
    const hits = Array.isArray(p?.debug?.hits) ? p.debug.hits : null;
    const avgPoi = p?.debug?.avgPoi;

    const scaleX = fit.w, scaleY = fit.h;
    const drawPoint01 = (pt01, style) => {
      if (!pt01 || typeof pt01.x01 !== "number" || typeof pt01.y01 !== "number") return;
      const px = ix + pt01.x01 * scaleX;
      const py = iy + pt01.y01 * scaleY;
      drawMarker(g, px, py, style);
    };

    drawPoint01(aim, "aim");
    if (hits && hits.length) hits.forEach(h => drawPoint01(h, "hit"));
    else if (avgPoi) drawPoint01(avgPoi, "hit");

    const vendorUrl = String(p.vendorUrl || "");
    const vendorName = vendorNameFromUrl(vendorUrl);
    g.fillStyle = soft; g.font = "900 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(`Printer: ${vendorName}`, pad + panelW + gap + 28, topY + panelH - 28);

    g.fillStyle = "rgba(17,24,39,.28)";
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const sid = `Session ${String(p.sessionId || "—")}`;
    const sidW = g.measureText(sid).width;
    g.fillText(sid, W - pad - sidW, H - 92);

    g.save();
    g.globalAlpha = 0.10;
    g.fillStyle = ink;
    g.font = "1100 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const wm = "SCZN3";
    const wmW = g.measureText(wm).width;
    g.fillText(wm, (W - wmW)/2, H - 92);
    g.restore();

    const outUrl = c.toDataURL("image/png");
    downloadDataUrl(outUrl, `SEC_${String(score).padStart(3,"0")}_${Date.now()}.png`);
  }

  // ==============================
  // SURVEY LOGGING (4 modes)
  // ==============================
  function readFormValues(form) {
    const fd = new FormData(form);
    const obj = {};
    for (const [k, v] of fd.entries()) obj[k] = String(v || "");
    return obj;
  }

  function getSurveyLog(key) {
    const arr = safeJSON(localStorage.getItem(key));
    return Array.isArray(arr) ? arr : [];
  }

  function pushSurveyRow(row) {
    if (SURVEY_MODE.localStorage) {
      const log = getSurveyLog(KEY_SURVEY_LOG);
      log.push(row);
      try { localStorage.setItem(KEY_SURVEY_LOG, JSON.stringify(log.slice(-5000))); } catch {}
    }
    if (SURVEY_MODE.jsonExport) {
      const log = getSurveyLog(KEY_SURVEY_JSON_EXPORT);
      log.push(row);
      try { localStorage.setItem(KEY_SURVEY_JSON_EXPORT, JSON.stringify(log.slice(-5000))); } catch {}
    }
  }

  async function postToGoogleSheet(row) {
    if (!SURVEY_MODE.googleSheet) return;
    if (!GOOGLE_SHEET_ENDPOINT || !GOOGLE_SHEET_ENDPOINT.startsWith("http")) return;

    // keep it resilient—no throw
    try {
      await fetch(GOOGLE_SHEET_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row)
      });
    } catch {}
  }

  function emailRow(row) {
    if (!SURVEY_MODE.email) return;
    if (!EMAIL_TO || !EMAIL_TO.includes("@")) return;

    try {
      const subject = encodeURIComponent("Tap-n-Score Pilot Feedback");
      const body = encodeURIComponent(JSON.stringify(row, null, 2));
      window.location.href = `mailto:${encodeURIComponent(EMAIL_TO)}?subject=${subject}&body=${body}`;
    } catch {}
  }

  function lockSurveyUI() {
    if (elSurveyPanel) elSurveyPanel.classList.add("surveyLocked");
    if (elSurveySubmit) elSurveySubmit.disabled = true;
  }

  function showSurveyThanks() {
    if (!elSurveyThanks) return;
    elSurveyThanks.style.display = "block";
  }

  // ==============================
  // UI wiring
  // ==============================
  function wireUI(p) {
    hideErr();
    if (!p) { showErr("Missing SEC payload."); return; }

    const score = Math.round(clampNum(p.score, 0));
    const shots = clampNum(p.shots, 0);

    const wClicks = clampNum(p.windage?.clicks, 0);
    const eClicks = clampNum(p.elevation?.clicks, 0);
    const wDir = normalizeDirWord(p.windage?.dir);
    const eDir = normalizeDirWord(p.elevation?.dir);

    // Score
    if (elScore) elScore.textContent = String(score);
    if (elScoreLabel) elScoreLabel.textContent = labelForScore(score);

    // Optional: add a band class for CSS if you want later
    const band = bandForScore(score);
    document.body.dataset.scoreBand = band; // "green" | "yellow" | "red"

    // Soft avg (today)
    const { avg, n } = recordScoreForAvg(score);
    if (elAvgSoft) elAvgSoft.textContent = `Avg: ${avg.toFixed(0)} (${n})`;

    // Stats
    if (elShots) elShots.textContent = String(shots);
    if (elWind) elWind.textContent = formatClicks(wClicks);
    if (elElev) elElev.textContent = formatClicks(eClicks);
    if (elWindDir) elWindDir.textContent = wDir;
    if (elElevDir) elElevDir.textContent = eDir;

    // Vendor panel
    const vUrl = String(p.vendorUrl || "");
    const hasVendor = vUrl.startsWith("http");
    if (elVendorName) elVendorName.textContent = vendorNameFromUrl(vUrl);

    if (elVendorLink) {
      if (hasVendor) {
        elVendorLink.href = vUrl;
        elVendorLink.style.pointerEvents = "auto";
        elVendorLink.style.opacity = "1";
      } else {
        elVendorLink.removeAttribute("href");
        elVendorLink.style.pointerEvents = "none";
        elVendorLink.style.opacity = ".55";
      }
    }

    const tgt = p.target?.key ? `Target: ${(p.target.key || "").replace("x","×")}` : "Target: —";
    const dial = p.dial?.unit ? `${(p.dial.clickValue ?? 0).toFixed(2)} ${String(p.dial.unit)}` : "—";
    if (elVendorMicro) elVendorMicro.textContent = `For After-Shot Intelligence • ${tgt} • Dial: ${dial}`;

    if (elSessionGhost) elSessionGhost.textContent = `Session ${String(p.sessionId || "—")}`;

    // Buttons
    elDone?.addEventListener("click", () => goHome());
    elScoreAnother?.addEventListener("click", () => goHome(true));

    elDownload?.addEventListener("click", async () => {
      try {
        elDownload.disabled = true;
        elDownload.textContent = "Preparing…";
        await exportCertificatePNG(p);
      } catch (e) {
        showErr("Download failed. Try again.");
        console.error(e);
      } finally {
        elDownload.disabled = false;
        elDownload.textContent = "Download SEC Picture";
      }
    });

    // Survey submit
    elSurveyForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideErr();

      const answers = readFormValues(elSurveyForm);

      // Build one row of truth (portal-ready)
      const row = {
        type: "pilot_feedback",
        ts: new Date().toISOString(),
        sessionId: String(p.sessionId || ""),
        printer: vendorNameFromUrl(vUrl),
        vendorUrl: vUrl || "",
        sku: String(p.sku || p.target?.key || ""), // safe fallback
        score: score,
        shots: shots,
        distanceYds: clampNum(p?.debug?.distanceYds, 0),
        dialUnit: String(p?.dial?.unit || ""),
        dialClick: clampNum(p?.dial?.clickValue, 0),
        windDir: wDir, windClicks: clampNum(wClicks, 0),
        elevDir: eDir, elevClicks: clampNum(eClicks, 0),
        targetKey: String(p?.target?.key || ""),
        answers
      };

      // A + D
      pushSurveyRow(row);

      // C
      await postToGoogleSheet(row);

      // B
      emailRow(row);

      // Confirm + lock
      lockSurveyUI();
      showSurveyThanks();
    });
  }

  // ==============================
  // Drawing helpers (export)
  // ==============================
  function drawSECMark(g, x, y) {
    g.save();
    g.font = "1100 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillStyle = "#d64040"; g.fillText("S", x, y+30);
    g.fillStyle = "#111827"; g.fillText("E", x+28, y+30);
    g.fillStyle = "#2f66ff"; g.fillText("C", x+55, y+30);
    g.restore();
  }

  function drawRoundRect(g, x, y, w, h, r, fill, stroke) {
    g.save();
    g.beginPath();
    const rr = Math.min(r, w/2, h/2);
    g.moveTo(x+rr, y);
    g.arcTo(x+w, y, x+w, y+h, rr);
    g.arcTo(x+w, y+h, x, y+h, rr);
    g.arcTo(x, y+h, x, y, rr);
    g.arcTo(x, y, x+w, y, rr);
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
    g.restore();
  }

  function clipRoundRect(g, x, y, w, h, r, fn) {
    g.save();
    g.beginPath();
    const rr = Math.min(r, w/2, h/2);
    g.moveTo(x+rr, y);
    g.arcTo(x+w, y, x+w, y+h, rr);
    g.arcTo(x+w, y+h, x, y+h, rr);
    g.arcTo(x, y+h, x, y, rr);
    g.arcTo(x, y, x+w, y, rr);
    g.closePath();
    g.clip();
    fn();
    g.restore();
  }

  function drawMarker(g, x, y, kind) {
    const isAim = kind === "aim";
    const outer = isAim ? "rgba(16,185,129,.85)" : "rgba(245,158,11,.85)";
    const inner = isAim ? "rgba(16,185,129,.35)" : "rgba(245,158,11,.35)";
    g.save();
    g.beginPath(); g.fillStyle = outer; g.arc(x, y, 10, 0, Math.PI*2); g.fill();
    g.beginPath(); g.fillStyle = inner; g.arc(x, y, 5, 0, Math.PI*2); g.fill();
    g.lineWidth = 2; g.strokeStyle = "rgba(0,0,0,.45)"; g.stroke();
    g.restore();
  }

  function drawStatBox(g, x, y, w, h, k, v, dir, ink, soft) {
    drawRoundRect(g, x, y, w, h, 18, "rgba(255,255,255,.78)", "rgba(17,24,39,.14)");
    g.fillStyle = soft; g.font = "1000 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(k, x+20, y+42);
    g.fillStyle = ink; g.font = "1100 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(String(v), x+20, y+102);
    if (dir) {
      g.fillStyle = soft; g.font = "1000 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      g.fillText(String(dir), x+20, y+140);
    }
  }

  function contain(sw, sh, mw, mh) {
    const s = Math.min(mw / sw, mh / sh);
    return { w: sw * s, h: sh * s };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ==============================
  // Boot
  // ==============================
  const payload = getPayload();
  wireUI(payload);
})();
