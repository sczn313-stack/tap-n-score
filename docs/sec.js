/* ============================================================
   tap-n-score/sec.js (FULL REPLACEMENT) — SEC RENDERS + PNG + CLICKS + HISTORY
   Fix/Adds:
   - Header text handled by sec.html (you already changed to Shooter Experience Card)
   - Draws: target photo + AIM + ALL HITS + AVG POI dots (radius = 10)
   - Shows score (colored by value)
   - Shows Windage/Elevation clicks on-card (so clicks are not “gone”)
   - Stores & shows LAST 3 SCORES + AVG
   - Saves PNG to localStorage for download.html
============================================================ */

(() => {
  // ---- Payload key
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";

  // ---- Target photo handoff keys (from index page)
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1"; // data:image/...
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1"; // blob:...

  // ---- PNG keys (consumed by download.js)
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_PNG_BLOB = "SCZN3_SEC_PNG_BLOBURL_V1";
  const KEY_FROM = "SCZN3_SEC_FROM_V1";

  // ---- Score history
  const KEY_SCORE_HIST = "SCZN3_SCORE_HISTORY_V1"; // JSON array [{score,ts,sessionId}...]

  const $ = (id) => document.getElementById(id);

  const elCanvas = $("secCanvas");
  const ctx = elCanvas.getContext("2d");

  const elSession = $("sessionLine");
  const elErr = $("errLine");

  const btnDownload = $("downloadBtn");
  const btnScoreAnother = $("scoreAnotherBtn");
  const btnBack = $("backBtn");

  // -----------------------
  // Helpers
  // -----------------------
  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function fromB64Payload(param) {
    try {
      const json = decodeURIComponent(escape(atob(param)));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function showErr(msg) {
    if (!elErr) return;
    elErr.style.display = "block";
    elErr.textContent = msg;
  }

  function hideErr() {
    if (!elErr) return;
    elErr.style.display = "none";
    elErr.textContent = "";
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function dprScaleCanvas(cssW, cssH) {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    elCanvas.style.width = cssW + "px";
    elCanvas.style.height = cssH + "px";
    elCanvas.width = Math.round(cssW * dpr);
    elCanvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cssW, cssH, dpr };
  }

  function drawRoundedRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function scoreColor(score) {
    const s = Number(score) || 0;
    if (s >= 90) return { on: "#7CFF7C", glow: "rgba(124,255,124,.55)" };     // green
    if (s >= 75) return { on: "#f5f0b3", glow: "rgba(245,240,179,.55)" };     // pale yellow
    return { on: "#ff7a7a", glow: "rgba(255,122,122,.55)" };                 // red
  }

  // -----------------------
  // Seven-seg LED drawing
  // -----------------------
  const LED_OFF = "rgba(255,255,255,.08)";

  function segMap(d) {
    // segments: a b c d e f g
    const m = {
      "0": [1,1,1,1,1,1,0],
      "1": [0,1,1,0,0,0,0],
      "2": [1,1,0,1,1,0,1],
      "3": [1,1,1,1,0,0,1],
      "4": [0,1,1,0,0,1,1],
      "5": [1,0,1,1,0,1,1],
      "6": [1,0,1,1,1,1,1],
      "7": [1,1,1,0,0,0,0],
      "8": [1,1,1,1,1,1,1],
      "9": [1,1,1,1,0,1,1],
    };
    return m[String(d)] || [0,0,0,0,0,0,0];
  }

  function drawSeg(x, y, w, h, on, LED_ON, LED_GLOW) {
    ctx.save();
    ctx.fillStyle = on ? LED_ON : LED_OFF;
    ctx.shadowColor = on ? LED_GLOW : "transparent";
    ctx.shadowBlur = on ? Math.max(6, Math.floor(w * 0.08)) : 0;
    drawRoundedRect(x, y, w, h, Math.min(10, h / 2));
    ctx.fill();
    ctx.restore();
  }

  function drawDigit(x, y, size, digit, LED_ON, LED_GLOW) {
    const W = size;
    const H = size * 1.8;
    const t = Math.max(6, Math.floor(size * 0.18)); // thickness
    const gap = Math.max(6, Math.floor(size * 0.12));

    const seg = segMap(digit);

    drawSeg(x + gap, y, W - 2 * gap, t, seg[0], LED_ON, LED_GLOW);                       // a
    drawSeg(x + W - t, y + gap, t, (H / 2) - gap - t / 2, seg[1], LED_ON, LED_GLOW);    // b
    drawSeg(x + W - t, y + (H / 2) + t / 2, t, (H / 2) - gap - t / 2, seg[2], LED_ON, LED_GLOW); // c
    drawSeg(x + gap, y + H - t, W - 2 * gap, t, seg[3], LED_ON, LED_GLOW);               // d
    drawSeg(x, y + (H / 2) + t / 2, t, (H / 2) - gap - t / 2, seg[4], LED_ON, LED_GLOW); // e
    drawSeg(x, y + gap, t, (H / 2) - gap - t / 2, seg[5], LED_ON, LED_GLOW);            // f
    drawSeg(x + gap, y + (H / 2) - (t / 2), W - 2 * gap, t, seg[6], LED_ON, LED_GLOW);  // g
  }

  function drawLedNumberCentered(score, cx, cy, totalWidth) {
    const s = Math.round(Number(score) || 0);
    const str = String(Math.max(0, Math.min(100, s)));
    const digits = (str === "100") ? ["1","0","0"] : str.padStart(2, "0").split("");

    const { on: LED_ON, glow: LED_GLOW } = scoreColor(s);

    const digitCount = digits.length;
    const spacing = Math.max(16, Math.floor(totalWidth * 0.04));
    const size = Math.floor((totalWidth - spacing * (digitCount - 1)) / digitCount);

    const blockH = size * 1.8;
    const startX = cx - ((size * digitCount) + (spacing * (digitCount - 1))) / 2;
    const startY = cy - blockH / 2;

    digits.forEach((d, i) => {
      const x = startX + i * (size + spacing);
      drawDigit(x, startY, size, d, LED_ON, LED_GLOW);
    });
  }

  // -----------------------
  // Text + Dots
  // -----------------------
  function drawText(text, x, y, size, color, weight = 900, align = "center") {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function dotAt(imgRect, p, color, label, r = 10) {
    if (!p) return;
    const x01 = clamp01(Number(p.x01));
    const y01 = clamp01(Number(p.y01));
    const x = imgRect.x + x01 * imgRect.w;
    const y = imgRect.y + y01 * imgRect.h;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 16;

    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,.65)";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (label) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(238,242,247,.92)";
      ctx.font = "900 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x, y - (r + 6));
    }

    ctx.restore();
  }

  function drawHits(payload, imgRect) {
    const aim = payload?.debug?.aim || null;
    const hits = Array.isArray(payload?.debug?.hits) ? payload.debug.hits : [];
    const avg = payload?.debug?.avgPoi || null;

    // AIM (green)
    dotAt(imgRect, aim, "#67f3a4", "AIM", 10);

    // HITS (bright green) — no label per-dot (clean)
    hits.forEach((h) => dotAt(imgRect, h, "#b7ff3c", "", 10));

    // AVG POI (white ring + green center)
    if (avg) {
      dotAt(imgRect, avg, "#e9eef6", "AVG", 10);
      dotAt(imgRect, avg, "#b7ff3c", "", 6);
    }
  }

  async function loadImage(src) {
    if (!src) return null;
    const img = new Image();
    img.decoding = "async";
    if (typeof src === "string" && src.startsWith("http")) img.crossOrigin = "anonymous";
    img.src = src;

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    if (!img.naturalWidth) return null;
    return img;
  }

  function getBestTargetPhoto(payload) {
    const p = payload?.sourceImg;
    if (p && typeof p === "string" && p.length > 20) return p;

    const data = localStorage.getItem(KEY_TARGET_IMG_DATA);
    if (data && data.startsWith("data:image/")) return data;

    const blob = localStorage.getItem(KEY_TARGET_IMG_BLOB);
    if (blob && blob.startsWith("blob:")) return blob;

    return "";
  }

  // -----------------------
  // Score history (last 3 + avg)
  // -----------------------
  function loadHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_SCORE_HIST) || "[]");
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(arr) {
    try { localStorage.setItem(KEY_SCORE_HIST, JSON.stringify(arr)); } catch {}
  }

  function pushScoreToHistory(payload) {
    const s = Math.round(Number(payload?.score ?? 0));
    const sessionId = String(payload?.sessionId || "");
    const now = Date.now();

    const hist = loadHistory();

    // De-dupe by sessionId if present
    const already = sessionId ? hist.some(h => h && h.sessionId === sessionId) : false;
    if (!already) {
      hist.unshift({ score: s, ts: now, sessionId });
    }

    const trimmed = hist.slice(0, 3);
    saveHistory(trimmed);
    return trimmed;
  }

  function avgFromHistory(hist) {
    if (!hist || !hist.length) return 0;
    const sum = hist.reduce((a, h) => a + (Number(h?.score) || 0), 0);
    return Math.round(sum / hist.length);
  }

  // -----------------------
  // Render SEC
  // -----------------------
  async function renderSec(payload, hist3) {
    hideErr();

    // Canvas size (16:9)
    const cssW = Math.min(980, Math.floor(window.innerWidth * 0.96));
    const cssH = Math.floor(cssW * 9 / 16);
    dprScaleCanvas(cssW, cssH);

    // Background
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(6,7,10,1)";
    ctx.fillRect(0, 0, cssW, cssH);

    // Glass panel
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    drawRoundedRect(16, 16, cssW - 32, cssH - 32, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Image rect (leave room for header LED + footer info)
    const pad = 26;
    const imgRectOuter = {
      x: pad,
      y: pad + 110,                 // pushes image DOWN so LED area never feels cramped
      w: cssW - pad * 2,
      h: cssH - pad * 2 - 210        // leaves bottom space for clicks/history
    };

    // Target photo
    const src = getBestTargetPhoto(payload);
    let drawnImgRect = null;

    if (!src) {
      showErr("No target photo provided to SEC. Go back and re-score.");
    } else {
      const img = await loadImage(src);
      if (!img) {
        showErr("Target photo failed to load in SEC. Go back and re-score.");
      } else {
        const iw = img.naturalWidth || 1;
        const ih = img.naturalHeight || 1;
        const scale = Math.min(imgRectOuter.w / iw, imgRectOuter.h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = imgRectOuter.x + (imgRectOuter.w - dw) / 2;
        const dy = imgRectOuter.y + (imgRectOuter.h - dh) / 2;

        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,.22)";
        ctx.strokeStyle = "rgba(255,255,255,.10)";
        ctx.lineWidth = 1;
        drawRoundedRect(imgRectOuter.x, imgRectOuter.y, imgRectOuter.w, imgRectOuter.h, 16);
        ctx.fill();
        ctx.stroke();
        ctx.clip();

        ctx.drawImage(img, dx, dy, dw, dh);
        drawnImgRect = { x: dx, y: dy, w: dw, h: dh };

        // Dots (AIM + HITS + AVG)
        drawHits(payload, drawnImgRect);

        ctx.restore();
      }
    }

    // LED score centered (top)
    const score = Math.round(Number(payload?.score ?? 0));
    drawLedNumberCentered(score, cssW / 2, 84, Math.min(520, cssW - 80));

    // Explanation line (replaces “U R Here!”)
    drawText(
      "Tighter group + closer to aim point = higher score",
      cssW / 2,
      136,
      18,
      "rgba(238,242,247,.88)",
      900
    );

    // Clicks row (bottom)
    const wDir = String(payload?.windage?.dir || "—");
    const wClk = Number(payload?.windage?.clicks ?? NaN);
    const eDir = String(payload?.elevation?.dir || "—");
    const eClk = Number(payload?.elevation?.clicks ?? NaN);

    const clicksY = cssH - 112;

    // left block
    drawText("WINDAGE", cssW * 0.26, clicksY - 18, 12, "rgba(238,242,247,.55)", 900);
    drawText(
      `${wDir}  ${Number.isFinite(wClk) ? wClk.toFixed(2) : "—"} clicks`,
      cssW * 0.26,
      clicksY + 8,
      16,
      "rgba(238,242,247,.90)",
      900
    );

    // right block
    drawText("ELEVATION", cssW * 0.74, clicksY - 18, 12, "rgba(238,242,247,.55)", 900);
    drawText(
      `${eDir}  ${Number.isFinite(eClk) ? eClk.toFixed(2) : "—"} clicks`,
      cssW * 0.74,
      clicksY + 8,
      16,
      "rgba(238,242,247,.90)",
      900
    );

    // History (last 3 + avg)
    const avg3 = avgFromHistory(hist3);
    const histStr = (hist3 || []).map(h => String(h?.score ?? "—")).join("  •  ");
    const histY = cssH - 64;

    drawText("LAST 3", cssW * 0.20, histY - 14, 11, "rgba(238,242,247,.45)", 900);
    drawText(histStr || "—", cssW * 0.20, histY + 8, 13, "rgba(238,242,247,.78)", 900);

    drawText("AVG", cssW * 0.80, histY - 14, 11, "rgba(238,242,247,.45)", 900);
    drawText(String(avg3 || "—"), cssW * 0.80, histY + 8, 16, "rgba(238,242,247,.85)", 900);

    // Footer mark
    ctx.save();
    ctx.fillStyle = "rgba(238,242,247,.22)";
    ctx.font = "900 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("SEC", cssW / 2, cssH - 18);
    ctx.restore();

    return { ok: true, hasTarget: !!drawnImgRect };
  }

  // -----------------------
  // Save PNG for download page (data + blob)
  // -----------------------
  async function savePngToStorage() {
    try {
      const dataUrl = elCanvas.toDataURL("image/png");
      localStorage.setItem(KEY_PNG_DATA, dataUrl);

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      try { localStorage.setItem(KEY_PNG_BLOB, blobUrl); } catch {}
      try { localStorage.setItem(KEY_FROM, "./sec.html?fresh=" + Date.now()); } catch {}

      return { ok: true, dataUrl, blobUrl };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  function navToDownloadAuto() {
    window.location.href = `./download.html?auto=1&fresh=${Date.now()}`;
  }

  function navToIndex() {
    window.location.href = `./index.html?fresh=${Date.now()}`;
  }

  // -----------------------
  // Boot
  // -----------------------
  function loadPayload() {
    const p = getParam("payload");
    if (p) {
      const obj = fromB64Payload(p);
      if (obj) return obj;
    }
    return safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "");
  }

  async function boot() {
    const payload = loadPayload();
    if (!payload) {
      showErr("Missing payload. Open from Tap-n-Score results.");
      return;
    }

    const sid = payload.sessionId || "—";
    if (elSession) elSession.textContent = `Session: ${sid}`;

    // Push score into history (last 3)
    const hist3 = pushScoreToHistory(payload);

    await renderSec(payload, hist3);

    // Always generate PNG immediately so download page ALWAYS has it
    const saved = await savePngToStorage();
    if (!saved.ok) {
      showErr("SEC rendered, but PNG could not be saved. Try again or clear storage.");
    }
  }

  // Buttons
  if (btnDownload) {
    btnDownload.addEventListener("click", async () => {
      const saved = await savePngToStorage();
      if (!saved.ok) {
        showErr("Could not generate PNG. Try again.");
        return;
      }
      navToDownloadAuto();
    });
  }

  if (btnScoreAnother) btnScoreAnother.addEventListener("click", navToIndex);
  if (btnBack) btnBack.addEventListener("click", navToIndex);

  boot();
})();
