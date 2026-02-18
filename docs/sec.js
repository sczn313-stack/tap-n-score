/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — FINAL SEC + LIGHT CERTIFICATE EXPORT
   - Screen view stays DARK (this page)
   - Download builds a LIGHT "certificate" PNG w/ border + target thumbnail + markers
   - NOW: Trophy "Top 10 of last 20" is embedded INTO the exported PNG
   - Uses payload from ?payload= (base64 JSON) OR localStorage
   - Uses target image from localStorage (SCZN3_TARGET_IMG_DATAURL_V1)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // UI
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
  const elSurvey = $("surveyBtn");

  const elErr = $("errLine");
  const elSessionGhost = $("sessionGhost");

  // Storage keys (must match index.js)
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";

  // Soft scoring memory (today avg)
  const KEY_SCORES_DAY = "SCZN3_SCORES_BY_DAY_V1"; // { "YYYY-MM-DD": [numbers...] }

  // Trophy rolling storage (Top 10 of last 20)
  const KEY_TROPHY = "SCZN3_TROPHY_ROLLING_V1"; // [{ts, score, shots, distanceYds, dialUnit, clickValue, vendorName?}...]

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

  function safeJSON(s) {
    try { return JSON.parse(String(s || "")); } catch { return null; }
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
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { avg, n: arr.length };
  }

  function labelForScore(s) {
    if (s >= 98) return "Elite";
    if (s >= 95) return "Excellent";
    if (s >= 90) return "Strong";
    if (s >= 85) return "Solid";
    if (s >= 80) return "Improving";
    if (s >= 70) return "Getting there";
    return "Keep going";
  }

  // ✅ Your agreed scoring color bands (for UI + export)
  // GREEN = 90–100, YELLOW = 60–89, RED = 0–59
  function bandForScore(score) {
    const s = clampNum(score, 0);
    if (s >= 90) return "GREEN";
    if (s >= 60) return "YELLOW";
    return "RED";
  }

  function normalizeDirWord(w) {
    const x = String(w || "").toUpperCase();
    if (x === "LEFT" || x === "RIGHT" || x === "UP" || x === "DOWN") return x;
    return "—";
  }

  function vendorNameFromUrl(url) {
    if (typeof url === "string" && url.startsWith("http")) return "Baker Printing";
    return "—";
  }

  function formatClicks(n) {
    return clampNum(n, 0).toFixed(2);
  }

  // ============================================================
  // TROPHY ROLLING (Top 10 of last 20)
  // ============================================================
  function readTrophyArray() {
    const raw = safeJSON(localStorage.getItem(KEY_TROPHY));
    return Array.isArray(raw) ? raw : [];
  }

  function writeTrophyArray(arr) {
    try { localStorage.setItem(KEY_TROPHY, JSON.stringify(arr)); } catch {}
  }

  function upsertTrophyFromPayload(p) {
    // Create a clean trophy record from current payload
    const ts = Date.now();
    const score = Math.round(clampNum(p?.score, 0));
    const shots = clampNum(p?.shots, 0);

    // Prefer debug distanceYds if present; else attempt p.debug.distanceYds; else null
    const distYds = clampNum(p?.debug?.distanceYds, clampNum(p?.distanceYds, 0));

    const dialUnit = String(p?.dial?.unit || "");
    const clickValue = clampNum(p?.dial?.clickValue, 0);
    const vUrl = String(p?.vendorUrl || "");
    const vendorName = vendorNameFromUrl(vUrl);

    const rec = { ts, score, shots, distanceYds: distYds, dialUnit, clickValue, vendorName };

    const arr = readTrophyArray();
    arr.push(rec);

    // Keep only last 20 by time
    const trimmed = arr.sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-20);
    writeTrophyArray(trimmed);
    return trimmed;
  }

  function getTop10Of20() {
    const arr = readTrophyArray().slice(-20);
    // Sort by score desc, then newest first
    const sorted = arr.sort((a, b) => {
      const ds = (b.score || 0) - (a.score || 0);
      if (ds !== 0) return ds;
      return (b.ts || 0) - (a.ts || 0);
    });
    return sorted.slice(0, 10);
  }

  function fmtTs(ts) {
    try {
      const d = new Date(ts);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${mm}/${dd} ${hh}:${mi}`;
    } catch {
      return "—";
    }
  }

  function fmtYds(yds) {
    const n = clampNum(yds, 0);
    return n > 0 ? `${Math.round(n)} yds` : "— yds";
  }

  // ============================================================
  // UI wiring
  // ============================================================
  function wireUI(p) {
    hideErr();
    if (!p) { showErr("Missing SEC payload."); return; }

    const score = Math.round(clampNum(p.score, 0));
    const shots = clampNum(p.shots, 0);

    const wClicks = clampNum(p.windage?.clicks, 0);
    const eClicks = clampNum(p.elevation?.clicks, 0);
    const wDir = normalizeDirWord(p.windage?.dir);
    const eDir = normalizeDirWord(p.elevation?.dir);

    // Score text
    if (elScore) elScore.textContent = String(score);
    if (elScoreLabel) elScoreLabel.textContent = labelForScore(score);

    // ✅ Apply score color band to the on-screen score number
    if (elScore) {
      const band = bandForScore(score);
      elScore.style.color =
        band === "GREEN" ? "rgba(103,243,164,.98)" :
        band === "YELLOW" ? "rgba(255,214,102,.98)" :
        "rgba(255,97,97,.98)";
      elScore.style.textShadow =
        band === "GREEN" ? "0 18px 46px rgba(16,185,129,.18)" :
        band === "YELLOW" ? "0 18px 46px rgba(245,158,11,.18)" :
        "0 18px 46px rgba(239,68,68,.18)";
    }

    // Soft avg (today)
    const { avg, n } = recordScoreForAvg(score);
    if (elAvgSoft) elAvgSoft.textContent = `Avg: ${avg.toFixed(0)} (${n})`;

    // Stats
    if (elShots) elShots.textContent = String(shots);
    if (elWind) elWind.textContent = formatClicks(wClicks);
    if (elElev) elElev.textContent = formatClicks(eClicks);

    if (elWindDir) elWindDir.textContent = wDir;
    if (elElevDir) elElevDir.textContent = eDir;

    // Vendor
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

    // Micro line
    const tgt = p.target?.key ? `Target: ${(p.target.key || "").replace("x", "×")}` : "Target: —";
    const dial = p.dial?.unit ? `${(p.dial.clickValue ?? 0).toFixed(2)} ${String(p.dial.unit)}` : "—";
    const yds = fmtYds(p?.debug?.distanceYds);
    if (elVendorMicro) elVendorMicro.textContent = `${tgt} • Distance: ${yds} • Dial: ${dial}`;

    // Session ghost
    if (elSessionGhost) elSessionGhost.textContent = `Session ${String(p.sessionId || "—")}`;

    // Buttons
    elDone?.addEventListener("click", () => goHome());
    elScoreAnother?.addEventListener("click", () => goHome(true));
    elSurvey?.addEventListener("click", () => {
      alert("Survey (pilot): coming next. For now, just close and keep shooting.");
    });

    elDownload?.addEventListener("click", async () => {
      try {
        elDownload.disabled = true;
        elDownload.textContent = "Preparing…";

        // ✅ Update rolling trophy set when downloading (so the export always includes the newest run)
        upsertTrophyFromPayload(p);

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
  // EXPORT: Light certificate PNG with trophy strip embedded
  // ============================================================
  async function exportCertificatePNG(p) {
    const dataUrl = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Missing target image dataurl for export.");
    }

    const img = await loadImage(dataUrl);

    // Canvas size
    const W = 1400;
    const H = 1800;
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
    g.fillRect(0, 0, W, H);

    // Outer + inner borders
    g.strokeStyle = border;
    g.lineWidth = 3;
    g.strokeRect(34, 34, W - 68, H - 68);

    g.strokeStyle = "rgba(17,24,39,.14)";
    g.lineWidth = 2;
    g.strokeRect(52, 52, W - 104, H - 104);

    // Header
    g.fillStyle = ink;
    g.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("SHOOTER EXPERIENCE CARD", 92, 128);

    // SEC tag
    drawSECMark(g, W - 240, 92);

    // Panels
    const pad = 92;
    const gap = 24;
    const topY = 170;
    const panelH = 520;
    const panelW = (W - pad * 2 - gap) / 2;

    drawRoundRect(g, pad, topY, panelW, panelH, 22, "rgba(255,255,255,.75)", "rgba(17,24,39,.14)");
    drawRoundRect(g, pad + panelW + gap, topY, panelW, panelH, 22, "rgba(255,255,255,.75)", "rgba(17,24,39,.14)");

    // Score content
    const score = Math.round(clampNum(p.score, 0));
    const band = bandForScore(score);

    g.fillStyle = soft;
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("SCORE", pad + 28, topY + 56);

    // Score number (band color)
    g.fillStyle =
      band === "GREEN" ? "rgba(16,185,129,.95)" :
      band === "YELLOW" ? "rgba(245,158,11,.95)" :
      "rgba(239,68,68,.95)";
    g.font = "1000 170px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(String(score), pad + 28, topY + 220);

    // Label (ink)
    g.fillStyle = ink;
    g.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(labelForScore(score), pad + 28, topY + 280);

    // Distance line (requested)
    const distYds = clampNum(p?.debug?.distanceYds, 0);
    g.fillStyle = soft;
    g.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(`Distance: ${fmtYds(distYds)}`, pad + 28, topY + 328);

    // Stats row
    const statsY = topY + panelH + 26;
    const statsH = 170;
    const statW = (W - pad * 2 - gap * 2) / 3;

    const shots = clampNum(p.shots, 0);
    const wClicks = clampNum(p.windage?.clicks, 0);
    const eClicks = clampNum(p.elevation?.clicks, 0);
    const wDir = normalizeDirWord(p.windage?.dir);
    const eDir = normalizeDirWord(p.elevation?.dir);

    drawStatBox(g, pad + (statW + gap) * 0, statsY, statW, statsH, "HITS", String(shots), "", ink, soft);
    drawStatBox(g, pad + (statW + gap) * 1, statsY, statW, statsH, "WINDAGE", formatClicks(wClicks), wDir, ink, soft);
    drawStatBox(g, pad + (statW + gap) * 2, statsY, statW, statsH, "ELEVATION", formatClicks(eClicks), eDir, ink, soft);

    // Target thumbnail with markers
    const thumbX = pad + panelW + gap + 22;
    const thumbY = topY + 70;
    const thumbW = panelW - 44;
    const thumbH = panelH - 120;

    g.fillStyle = soft;
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("TARGET (with taps)", pad + panelW + gap + 28, topY + 56);

    const fit = contain(img.width, img.height, thumbW, thumbH);
    const ix = thumbX + (thumbW - fit.w) / 2;
    const iy = thumbY + (thumbH - fit.h) / 2;

    drawRoundRect(g, thumbX, thumbY, thumbW, thumbH, 18, "rgba(17,24,39,.04)", "rgba(17,24,39,.12)");
    clipRoundRect(g, thumbX, thumbY, thumbW, thumbH, 18, () => {
      g.drawImage(img, ix, iy, fit.w, fit.h);
    });

    const aim = p?.debug?.aim;
    const hits = Array.isArray(p?.debug?.hits) ? p.debug.hits : null;
    const avgPoi = p?.debug?.avgPoi;

    const scaleX = fit.w;
    const scaleY = fit.h;

    function drawPoint01(pt01, style) {
      if (!pt01 || typeof pt01.x01 !== "number" || typeof pt01.y01 !== "number") return;
      const px = ix + pt01.x01 * scaleX;
      const py = iy + pt01.y01 * scaleY;
      drawMarker(g, px, py, style);
    }

    drawPoint01(aim, "aim");
    if (hits && hits.length) hits.forEach(h => drawPoint01(h, "hit"));
    else if (avgPoi) drawPoint01(avgPoi, "hit");

    // Printer line
    const vendorUrl = String(p.vendorUrl || "");
    const vendorName = vendorNameFromUrl(vendorUrl);
    g.fillStyle = soft;
    g.font = "900 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(`Printed by: ${vendorName}`, pad + panelW + gap + 28, topY + panelH - 28);

    // ============================================================
    // ✅ TROPHY STRIP (Top 10 of last 20) — embedded in export PNG
    // ============================================================
    const trophy = getTop10Of20();

    // Trophy box placement (below stats row)
    const tY = statsY + statsH + 26;
    const tH = 420; // enough for 10 rows
    drawRoundRect(g, pad, tY, W - pad * 2, tH, 18, "rgba(255,255,255,.78)", "rgba(17,24,39,.14)");

    // Title
    g.fillStyle = ink;
    g.font = "1000 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("TROPHY — Top 10 of last 20", pad + 22, tY + 44);

    // Columns header (subtle)
    g.fillStyle = "rgba(17,24,39,.45)";
    g.font = "900 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText("Rank", pad + 22, tY + 74);
    g.fillText("Score", pad + 120, tY + 74);
    g.fillText("Hits",  pad + 220, tY + 74);
    g.fillText("Distance", pad + 320, tY + 74);
    g.fillText("When", pad + 470, tY + 74);

    // Rows
    const rowY0 = tY + 104;
    const rowH = 30;

    for (let i = 0; i < 10; i++) {
      const rec = trophy[i];
      const y = rowY0 + i * rowH;

      // zebra row
      if (i % 2 === 0) {
        g.fillStyle = "rgba(17,24,39,.03)";
        g.fillRect(pad + 16, y - 18, (W - pad * 2) - 32, rowH);
      }

      if (!rec) {
        g.fillStyle = "rgba(17,24,39,.30)";
        g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        g.fillText(`${i + 1}. —`, pad + 22, y);
        continue;
      }

      const s = Math.round(clampNum(rec.score, 0));
      const b = bandForScore(s);

      // Rank
      g.fillStyle = ink;
      g.font = "1000 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      g.fillText(`${i + 1}.`, pad + 22, y);

      // Score (band color)
      g.fillStyle =
        b === "GREEN" ? "rgba(16,185,129,.95)" :
        b === "YELLOW" ? "rgba(245,158,11,.95)" :
        "rgba(239,68,68,.95)";
      g.font = "1100 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      g.fillText(String(s), pad + 120, y);

      // Hits
      g.fillStyle = ink;
      g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      g.fillText(String(clampNum(rec.shots, 0)), pad + 220, y);

      // Distance
      g.fillStyle = ink;
      g.fillText(fmtYds(rec.distanceYds), pad + 320, y);

      // When
      g.fillStyle = "rgba(17,24,39,.55)";
      g.fillText(fmtTs(rec.ts), pad + 470, y);
    }

    // Session ID bottom-right (faint)
    g.fillStyle = "rgba(17,24,39,.28)";
    g.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const sid = `Session ${String(p.sessionId || "—")}`;
    const sidW = g.measureText(sid).width;
    g.fillText(sid, W - pad - sidW, H - 92);

    // SCZN3 mark bottom center (faint)
    g.save();
    g.globalAlpha = 0.10;
    g.fillStyle = ink;
    g.font = "1100 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const wm = "SCZN3";
    const wmW = g.measureText(wm).width;
    g.fillText(wm, (W - wmW) / 2, H - 92);
    g.restore();

    // Export
    const outUrl = c.toDataURL("image/png");
    downloadDataUrl(outUrl, `SEC_${String(score).padStart(3, "0")}_${Date.now()}.png`);
  }

  // ============================================================
  // Drawing helpers
  // ============================================================
  function drawSECMark(g, x, y) {
    g.save();
    g.font = "1100 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillStyle = "#d64040"; g.fillText("S", x, y + 30);
    g.fillStyle = "#111827"; g.fillText("E", x + 28, y + 30);
    g.fillStyle = "#2f66ff"; g.fillText("C", x + 55, y + 30);
    g.restore();
  }

  function drawRoundRect(g, x, y, w, h, r, fill, stroke) {
    g.save();
    g.beginPath();
    const rr = Math.min(r, w / 2, h / 2);
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();

    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
    g.restore();
  }

  function clipRoundRect(g, x, y, w, h, r, fn) {
    g.save();
    g.beginPath();
    const rr = Math.min(r, w / 2, h / 2);
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
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
    g.arc(x, y, 10, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.fillStyle = inner;
    g.arc(x, y, 5, 0, Math.PI * 2);
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
    g.fillText(k, x + 20, y + 42);

    g.fillStyle = ink;
    g.font = "1100 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    g.fillText(String(v), x + 20, y + 102);

    if (dir) {
      g.fillStyle = soft;
      g.font = "1000 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      g.fillText(String(dir), x + 20, y + 140);
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
