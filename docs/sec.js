/* ============================================================
   tap-n-score/sec.js (FULL REPLACEMENT) — SEC (NO TARGET PHOTO) + DOTS SIZE 10
   Does:
   - Reads payload from ?payload= (base64 JSON) or localStorage SCZN3_SEC_PAYLOAD_V1
   - Renders SEC canvas WITHOUT drawing the target photo
   - Draws dots:
       - AIM (green)
       - HITS (bright green) if provided
       - Otherwise falls back to AVG POI (bright green) if hits not provided
     Dot size = 10px diameter (radius 5)
   - LED score (pale yellow) with COLOR SHIFT by score value
   - Places LED with safe top padding so it never clips
   - Saves PNG to localStorage:
       SCZN3_SEC_PNG_DATAURL_V1
       SCZN3_SEC_PNG_BLOBURL_V1
       SCZN3_SEC_FROM_V1
   - Download button routes to download.html?auto=1
============================================================ */

(() => {
  // ---- Payload key
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";

  // ---- PNG keys (consumed by download.js)
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_PNG_BLOB = "SCZN3_SEC_PNG_BLOBURL_V1";
  const KEY_FROM = "SCZN3_SEC_FROM_V1";

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

  function clamp01(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

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

  // -----------------------
  // Score color logic
  // -----------------------
  function scoreTheme(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    // Calm + readable score colors (still “LED-ish”)
    if (s >= 90) return { on: "#b7ff3c", glow: "rgba(183,255,60,.55)" };    // green
    if (s >= 75) return { on: "#f5f0b3", glow: "rgba(245,240,179,.55)" };   // pale yellow
    if (s >= 60) return { on: "#ffd166", glow: "rgba(255,209,102,.55)" };   // amber
    return { on: "#ff6b6b", glow: "rgba(255,107,107,.55)" };                // red
  }

  // -----------------------
  // Seven-seg LED drawing (uses theme colors)
  // -----------------------
  const LED_OFF = "rgba(245,240,179,.08)";

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
    // digit box: size wide, size*1.8 tall
    const W = size;
    const H = size * 1.8;
    const t = Math.max(5, Math.floor(size * 0.18)); // segment thickness
    const gap = Math.max(5, Math.floor(size * 0.12));

    const seg = segMap(digit);

    // a (top)
    drawSeg(x + gap, y, W - 2 * gap, t, seg[0], LED_ON, LED_GLOW);
    // b (top-right)
    drawSeg(x + W - t, y + gap, t, (H / 2) - gap - t / 2, seg[1], LED_ON, LED_GLOW);
    // c (bottom-right)
    drawSeg(x + W - t, y + (H / 2) + t / 2, t, (H / 2) - gap - t / 2, seg[2], LED_ON, LED_GLOW);
    // d (bottom)
    drawSeg(x + gap, y + H - t, W - 2 * gap, t, seg[3], LED_ON, LED_GLOW);
    // e (bottom-left)
    drawSeg(x, y + (H / 2) + t / 2, t, (H / 2) - gap - t / 2, seg[4], LED_ON, LED_GLOW);
    // f (top-left)
    drawSeg(x, y + gap, t, (H / 2) - gap - t / 2, seg[5], LED_ON, LED_GLOW);
    // g (middle)
    drawSeg(x + gap, y + (H / 2) - (t / 2), W - 2 * gap, t, seg[6], LED_ON, LED_GLOW);
  }

  function drawLedNumberCentered(score, cx, cy, totalWidth) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const str = String(s);

    // 2 digits unless 100
    const digits = (str === "100") ? ["1","0","0"] : str.padStart(2, "0").split("");
    const digitCount = digits.length;

    const spacing = Math.max(12, Math.floor(totalWidth * 0.035));
    const size = Math.floor((totalWidth - spacing * (digitCount - 1)) / digitCount);

    const blockH = size * 1.8;
    const startX = cx - ((size * digitCount) + (spacing * (digitCount - 1))) / 2;
    const startY = cy - blockH / 2;

    const th = scoreTheme(s);
    digits.forEach((d, i) => {
      const x = startX + i * (size + spacing);
      drawDigit(x, startY, size, d, th.on, th.glow);
    });
  }

  // -----------------------
  // Dots (AIM + HITS) — size 10px diameter
  // -----------------------
  function drawDotAt01(p, rect, color) {
    if (!p) return;
    const x01 = clamp01(p.x01);
    const y01 = clamp01(p.y01);
    const x = rect.x + x01 * rect.w;
    const y = rect.y + y01 * rect.h;

    const r = 5; // radius => 10px diameter

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,.60)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawDots(payload, rect) {
    const aim = payload?.debug?.aim;

    // Prefer hits if present
    const hits = payload?.debug?.hits;
    const avgPoi = payload?.debug?.avgPoi;

    // AIM always (if present)
    if (aim && typeof aim === "object") drawDotAt01(aim, rect, "#67f3a4");

    // HITS
    if (Array.isArray(hits) && hits.length) {
      hits.forEach(h => {
        if (h && typeof h === "object") drawDotAt01(h, rect, "#b7ff3c");
      });
      return;
    }

    // Fallback: AVG POI only
    if (avgPoi && typeof avgPoi === "object") drawDotAt01(avgPoi, rect, "#b7ff3c");
  }

  // -----------------------
  // Render SEC (NO PHOTO)
  // -----------------------
  function drawOverlayText(text, x, y, size, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  async function renderSec(payload) {
    hideErr();

    const cssW = Math.min(980, Math.floor(window.innerWidth * 0.96));
    const cssH = Math.floor(cssW * 9 / 16);
    dprScaleCanvas(cssW, cssH);

    // Background
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(6,7,10,1)";
    ctx.fillRect(0, 0, cssW, cssH);

    // Outer glass panel
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    drawRoundedRect(16, 16, cssW - 32, cssH - 32, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Safe top region so LED never clips
    const topSafe = 26;
    const ledCenterY = topSafe + 96; // keeps full digit height inside frame

    // LED score centered (safe)
    const score = Math.round(Number(payload?.score ?? 0));
    drawLedNumberCentered(score, cssW / 2, ledCenterY, Math.min(520, cssW - 90));

    // Dot field area (no photo, but consistent “target area” frame)
    const pad = 26;
    const fieldTop = topSafe + 170;
    const fieldH = cssH - fieldTop - 90;
    const field = { x: pad, y: fieldTop, w: cssW - pad * 2, h: Math.max(160, fieldH) };

    // Inner field frame
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    drawRoundedRect(field.x, field.y, field.w, field.h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Dots inside field (01 mapped to field)
    drawDots(payload, field);

    // Simple explanation (replacing “you are here”)
    drawOverlayText(
      "Tighter group + closer to aim point = higher score",
      cssW / 2,
      cssH - 62,
      18,
      "rgba(238,242,247,.90)",
      1
    );

    // Footer
    ctx.save();
    ctx.fillStyle = "rgba(238,242,247,.25)";
    ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("SEC", cssW / 2, cssH - 18);
    ctx.restore();
  }

  // -----------------------
  // Save PNG for download page (data + blob)
  // -----------------------
  async function savePngToStorage() {
    try {
      const dataUrl = elCanvas.toDataURL("image/png");
      localStorage.setItem(KEY_PNG_DATA, dataUrl);

      // Convert to blob URL (iOS friendlier)
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
      showErr("Missing payload. Open from scoring results.");
      return;
    }

    const sid = payload.sessionId || "—";
    if (elSession) elSession.textContent = `Session: ${sid}`;

    await renderSec(payload);

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
