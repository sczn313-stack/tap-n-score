/* docs/sec.js (FULL REPLACEMENT) — LOCKED RULES
   ✅ Screen (dark): Distance shown; NO Hits box; NO Trophy on screen
   ✅ Download (light PNG): includes TROPHY (Top 10 of last 20) with Hits + Yds in rows
   ✅ Score color lock:
      GREEN = 90–100
      YELLOW = 60–89
      RED = 0–59
*/

(() => {
  const $ = (id) => document.getElementById(id);

  // UI
  const elScoreCard = $("scoreCard");
  const elScore = $("scoreValue");
  const elScoreLabel = $("scoreLabel");
  const elAvgSoft = $("avgSoft");
  const elDistanceLine = $("distanceLine");

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
  const elSurvey = $("surveyBtn");

  const elErr = $("errLine");
  const elSessionGhost = $("sessionGhost");

  // Storage keys (match index.js)
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_SCORES_DAY = "SCZN3_SCORES_BY_DAY_V1";         // daily avg memory
  const KEY_TROPHY_LAST20 = "SCZN3_TROPHY_LAST20_V1";       // last 20 sessions (for export top 10)
  const KEY_SURVEY_URL = "SCZN3_SURVEY_URL_V1";            // optional override

  // Default survey (Google Sheet / Form / etc.) — you can change anytime
  const DEFAULT_SURVEY_URL = localStorage.getItem(KEY_SURVEY_URL) || "";

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
    box[day] = arr.slice(-200); // cap
    try { localStorage.setItem(KEY_SCORES_DAY, JSON.stringify(box)); } catch {}
    const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
    return { avg, n: arr.length };
  }

  function labelForScore(s) {
    // label text can evolve, but score color thresholds are locked below
    if (s >= 90) return "Strong";
    if (s >= 60) return "Improving";
    return "Keep going";
  }

  function scoreBandClass(s) {
    if (s >= 90) return "scoreGreen";
    if (s >= 60) return "scoreYellow";
    return "scoreRed";
  }

  function normalizeDirWord(w) {
    const x = String(w || "").toUpperCase();
    if (x === "LEFT" || x === "RIGHT" || x === "UP" || x === "DOWN") return x;
    return "—";
  }

  function formatClicks(n) {
    return clampNum(n, 0).toFixed(2);
  }

  function vendorNameFromUrl(url) {
    // Pilot default: show Baker Printing when vendor URL exists.
    if (typeof url === "string" && url.startsWith("http")) return "Baker Printing";
    return "—";
  }

  function distanceTextFromPayload(p) {
    const d = clampNum(p?.debug?.distanceYds, NaN);
    if (Number.isFinite(d) && d > 0) return `${Math.round(d)} yds`;
    // fallback: sometimes payload carries distance in other spots
    const d2 = clampNum(p?.distanceYds, NaN);
    if (Number.isFinite(d2) && d2 > 0) return `${Math.round(d2)} yds`;
    return "—";
  }

  function getSurveyUrl(p) {
    const s1 = String(p?.surveyUrl || "");
    if (s1.startsWith("http")) return s1;
    if (DEFAULT_SURVEY_URL && DEFAULT_SURVEY_URL.startsWith("http")) return DEFAULT_SURVEY_URL;
    return "";
  }

  // ------------------------------------------------------------
  // TROPHY memory: keep LAST 20, export TOP 10
  // Each entry: { score, hits, distanceYds, whenTs }
  // ------------------------------------------------------------
  function readLast20() {
    const arr = safeJSON(localStorage.getItem(KEY_TROPHY_LAST20));
    return Array.isArray(arr) ? arr : [];
  }

  function writeLast20(arr) {
    try { localStorage.setItem(KEY_TROPHY_LAST20, JSON.stringify(arr.slice(0, 20))); } catch {}
  }

  function addToLast20(entry) {
    const list = readLast20();
    // newest first
    list.unshift(entry);
    writeLast20(list.slice(0, 20));
  }

  function getTop10Sorted() {
    const list = readLast20();
    // sort by score desc, then when desc
    const sorted = [...list].sort((a, b) => {
      const sa = clampNum(a?.score, 0);
      const sb = clampNum(b?.score, 0);
      if (sb !== sa) return sb - sa;
      return clampNum(b?.whenTs, 0) - clampNum(a?.whenTs, 0);
    });
    return sorted.slice(0, 10);
  }

  function fmtWhen(ts) {
    const d = new Date(clampNum(ts, Date.now()));
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }

  // ------------------------------------------------------------
  // UI wiring
  // ------------------------------------------------------------
  function wireUI(p) {
    hideErr();
    if (!p) { showErr("Missing SEC payload."); return; }

    const score = Math.round(clampNum(p.score, 0));
    const shots = clampNum(p.shots, 0);

    const wClicks = clampNum(p.windage?.clicks, 0);
    const eClicks = clampNum(p.elevation?.clicks, 0);
    const wDir = normalizeDirWord(p.windage?.dir);
    const eDir = normalizeDirWord(p.elevation?.dir);

    // Score + label
    if (elScore) elScore.textContent = String(score);
    if (elScoreLabel) elScoreLabel.textContent = labelForScore(score);

    // Score color class (LOCKED thresholds)
    if (elScoreCard) {
      elScoreCard.classList.remove("scoreGreen","scoreYellow","scoreRed");
      elScoreCard.classList.add(scoreBandClass(score));
    }

    // Avg (today)
    const { avg, n } = recordScoreForAvg(score);
    if (elAvgSoft) elAvgSoft.textContent = `Avg: ${avg.toFixed(0)} (${n})`;

    // Distance (current run)
    const distText = distanceTextFromPayload(p);
    if (elDistanceLine) elDistanceLine.textContent = `Distance: ${distText}`;

    // Corrections
    if (elWind) elWind.textContent = formatClicks(wClicks);
    if (elElev) elElev.textContent = formatClicks(eClicks);
    if (elWindDir) elWindDir.textContent = wDir;
    if (elElevDir) elElevDir.textContent = eDir;

    // Printer / vendor
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
    if (elVendorMicro) elVendorMicro.textContent = `${tgt} • Distance: ${distText} • Dial: ${dial}`;

    // Session ghost
    if (elSessionGhost) elSessionGhost.textContent = `Session ${String(p.sessionId || "—")}`;

    // Add to last 20 (for exported trophy table)
    const distYds = clampNum(p?.debug?.distanceYds, NaN);
    addToLast20({
      score,
      hits: shots,
      distanceYds: Number.isFinite(distYds) ? Math.round(distYds) : null,
      whenTs: Date.now()
    });

    // Buttons
    elDone?.addEventListener("click", () => goHome(false));
    elScoreAnother?.addEventListener("click", () => goHome(true));

    elSurvey?.addEventListener("click", () => {
      const sUrl = getSurveyUrl(p);
      if (!sUrl) {
        alert("Survey link not set yet (pilot).");
        return;
      }
      window.open(sUrl, "_blank", "noopener");
    });

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
  }

  function goHome(reset = false) {
    const url = `./index.html?fresh=${Date.now()}${reset ? "&again=1" : ""}`;
    window.location.href = url;
  }

  // ============================================================
  // EXPORT: Light certificate PNG
  // Includes:
  // - Distance on current run
  // - Trophy table: Top 10 of last 20 (rows include Hits + Yds)
  // - NO separate Hits box (matches your lock)
  // ============================================================
  async function exportCertificatePNG(p) {
    const dataUrl = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Missing target image dataurl for export.");
    }

    const img = await loadImage(dataUrl);

    // Canvas size
    const W = 1400;
    const H = 1900; // a bit taller to comfortably fit Trophy Top 10
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");

    // Colors (light certificate)
    const bg = "#f3f4f6";
    const ink = "#111827";
    const soft = "rgba(17,24,39,.55)";
    const border = "rgba(17,24,39,.28)";

    // Background
    g.fillStyle = bg;
    g.fillRect(0,0,W,H);

    // Borders
    g.strokeStyle = border;
    g.lineWidth = 3;
    g.strokeRect(34,34,W-68,H-68);

    g.strokeStyle = "rgba(17,24,39,.14)";
    g.lineWidth = 2;
    g.strokeRect(52,52,W-104,H-104);

    // Header
    g.fillStyle = ink;
    g.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("SHOOTER EXPERIENCE CARD", 92, 128);
    drawSECMark(g, W - 240, 92);

    // Panels: Score (L) + Target thumb (R)
    const pad = 92;
    const gap = 24;
    const topY = 170;
    const panelH = 520;
    const panelW = (W - pad*2 - gap) / 2;

    drawRoundRect(g, pad, topY, panelW, panelH, 22, "rgba(255,255,255,.75)", "rgba(17,24,39,.14)");
    drawRoundRect(g, pad + panelW + gap, topY, panelW, panelH, 22, "rgba(255,255,255,.75)", "rgba(17,24,39,.14)");

    const score = Math.round(clampNum(p.score, 0));
    const shots = clampNum(p.shots, 0);
    const distText = distanceTextFromPayload(p);
    const distYds = clampNum(p?.debug?.distanceYds, NaN);

    // Score content
    g.fillStyle = soft;
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("SCORE", pad + 28, topY + 56);

    // Score color (LOCKED thresholds)
    g.fillStyle = (score >= 90) ? "#10b981" : (score >= 60) ? "#f59e0b" : "#ef4444";
    g.font = "1000 170px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(String(score), pad + 28, topY + 220);

    g.fillStyle = ink;
    g.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(labelForScore(score), pad + 28, topY + 280);

    // Distance on current run (certificate)
    g.fillStyle = ink;
    g.font = "900 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(`Distance: ${distText}`, pad + 28, topY + 330);

    g.fillStyle = soft;
    g.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("Measured results from confirmed hits", pad + 28, topY + 372);

    // Target thumb
    const thumbX = pad + panelW + gap + 22;
    const thumbY = topY + 70;
    const thumbW = panelW - 44;
    const thumbH = panelH - 120;

    g.fillStyle = soft;
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("TARGET (with taps)", pad + panelW + gap + 28, topY + 56);

    const fit = contain(img.width, img.height, thumbW, thumbH);
    const ix = thumbX + (thumbW - fit.w)/2;
    const iy = thumbY + (thumbH - fit.h)/2;

    drawRoundRect(g, thumbX, thumbY, thumbW, thumbH, 18, "rgba(17,24,39,.04)", "rgba(17,24,39,.12)");
    clipRoundRect(g, thumbX, thumbY, thumbW, thumbH, 18, () => {
      g.drawImage(img, ix, iy, fit.w, fit.h);
    });

    // markers (aim + hits if present, else avgPoi)
    const aim = p?.debug?.aim;
    const hitsArr = Array.isArray(p?.debug?.hits) ? p.debug.hits : null;

    function drawPoint01(pt01, style) {
      if (!pt01 || typeof pt01.x01 !== "number" || typeof pt01.y01 !== "number") return;
      const px = ix + pt01.x01 * fit.w;
      const py = iy + pt01.y01 * fit.h;
      drawMarker(g, px, py, style);
    }

    drawPoint01(aim, "aim");
    if (hitsArr && hitsArr.length) {
      hitsArr.forEach(h => drawPoint01(h, "hit"));
    } else {
      const avgPoi = p?.debug?.avgPoi;
      if (avgPoi) drawPoint01(avgPoi, "hit");
    }

    // Printed by line (quiet)
    const vUrl = String(p.vendorUrl || "");
    const vendorName = vendorNameFromUrl(vUrl);
    g.fillStyle = soft;
    g.font = "900 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(`Printed by: ${vendorName}`, pad + panelW + gap + 28, topY + panelH - 28);

    // ------------------------------------------------------------
    // Stats row (2 boxes only: windage + elevation) — NO HITS BOX
    // ------------------------------------------------------------
    const statsY = topY + panelH + 26;
    const statsH = 170;
    const statW = (W - pad*2 - gap) / 2;

    const wClicks = clampNum(p.windage?.clicks, 0);
    const eClicks = clampNum(p.elevation?.clicks, 0);
    const wDir = normalizeDirWord(p.windage?.dir);
    const eDir = normalizeDirWord(p.elevation?.dir);

    drawStatBox(g, pad + (statW + gap)*0, statsY, statW, statsH, "WINDAGE", formatClicks(wClicks), wDir, ink, soft);
    drawStatBox(g, pad + (statW + gap)*1, statsY, statW, statsH, "ELEVATION", formatClicks(eClicks), eDir, ink, soft);

    // ------------------------------------------------------------
    // TROPHY: Top 10 of last 20 (rows include Hits + Yds)
    // ------------------------------------------------------------
    const trophyY = statsY + statsH + 24;
    const trophyH = 620;
    drawRoundRect(g, pad, trophyY, W - pad*2, trophyH, 22, "rgba(255,255,255,.78)", "rgba(17,24,39,.14)");

    // Title
    g.fillStyle = ink;
    g.font = "1000 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("TROPHY — Top 10 of last 20", pad + 24, trophyY + 46);

    // Table header
    const tx = pad + 24;
    let ty = trophyY + 86;

    // column positions
    const colRank = tx;
    const colScore = tx + 90;
    const colHits = tx + 220;
    const colYds  = tx + 330;
    const colWhen = tx + 470;

    g.fillStyle = "rgba(17,24,39,.55)";
    g.font = "900 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("Rank", colRank, ty);
    g.fillText("Score", colScore, ty);
    g.fillText("Hits", colHits, ty);
    g.fillText("Yds",  colYds,  ty);
    g.fillText("When", colWhen, ty);

    // rows
    const rows = getTop10Sorted();
    ty += 16;

    for (let i = 0; i < 10; i++) {
      const rowY = ty + i*46 + 18;

      // zebra
      g.fillStyle = (i % 2 === 0) ? "rgba(17,24,39,.04)" : "rgba(17,24,39,.02)";
      g.fillRect(pad + 18, rowY - 22, W - pad*2 - 36, 40);

      const r = rows[i] || null;

      g.fillStyle = ink;
      g.font = "1000 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      g.fillText(`${i+1}.`, colRank, rowY);

      if (r) {
        const s = Math.round(clampNum(r.score, 0));
        const hits = clampNum(r.hits, 0);
        const yds = Number.isFinite(clampNum(r.distanceYds, NaN)) ? `${Math.round(r.distanceYds)} yds` : "—";
        const when = fmtWhen(r.whenTs);

        // score colored
        g.fillStyle = (s >= 90) ? "#10b981" : (s >= 60) ? "#f59e0b" : "#ef4444";
        g.font = "1100 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        g.fillText(String(s), colScore, rowY);

        // hits + yds
        g.fillStyle = ink;
        g.font = "1000 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        g.fillText(String(hits), colHits, rowY);
        g.fillText(String(yds), colYds, rowY);

        g.fillStyle = "rgba(17,24,39,.70)";
        g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        g.fillText(when, colWhen, rowY);
      } else {
        g.fillStyle = "rgba(17,24,39,.28)";
        g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        g.fillText("—", colScore, rowY);
        g.fillText("—", colHits, rowY);
        g.fillText("—", colYds, rowY);
        g.fillText("—", colWhen, rowY);
      }
    }

    // Session ID bottom-right
    g.fillStyle = "rgba(17,24,39,.28)";
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const sid = `Session ${String(p.sessionId || "—")}`;
    const sidW = g.measureText(sid).width;
    g.fillText(sid, W - pad - sidW, H - 92);

    // SCZN3 watermark bottom center
    g.save();
    g.globalAlpha = 0.10;
    g.fillStyle = ink;
    g.font = "1100 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const wm = "SCZN3";
    const wmW = g.measureText(wm).width;
    g.fillText(wm, (W - wmW)/2, H - 92);
    g.restore();

    // Export
    const outUrl = c.toDataURL("image/png");
    downloadDataUrl(outUrl, `SEC_${String(score).padStart(3,"0")}_${Date.now()}.png`);
  }

  // ============================================================
  // Drawing helpers
  // ============================================================
  function drawSECMark(g, x, y) {
    g.save();
    g.font = "1100 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillStyle = "#d64040";
    g.fillText("S", x, y+30);
    g.fillStyle = "#111827";
    g.fillText("E", x+28, y+30);
    g.fillStyle = "#2f66ff";
    g.fillText("C", x+55, y+30);
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
    g.beginPath();
    g.fillStyle = outer;
    g.arc(x, y, 10, 0, Math.PI*2);
    g.fill();
    g.beginPath();
    g.fillStyle = inner;
    g.arc(x, y, 5, 0, Math.PI*2);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = "rgba(0,0,0,.45)";
    g.stroke();
    g.restore();
  }

  function drawStatBox(g, x, y, w, h, k, v, dir, ink, soft) {
    drawRoundRect(g, x, y, w, h, 18, "rgba(255,255,255,.78)", "rgba(17,24,39,.14)");
    g.fillStyle = soft;
    g.font = "1000 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(k, x+20, y+42);
    g.fillStyle = ink;
    g.font = "1100 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(String(v), x+20, y+102);
    if (dir) {
      g.fillStyle = soft;
      g.font = "1000 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
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

  // Boot
  const payload = getPayload();
  wireUI(payload);
})();
