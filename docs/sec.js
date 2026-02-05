/* ============================================================
   tap-n-score/sec.js (FULL REPLACEMENT) — SEC (RW&B) FIX PACK
   Fixes:
   - NO Tap-n-Score branding on SEC (HTML handles brand)
   - Responsive safe layout: score never clipped
   - Smaller dots
   - Replace "U R Here" with scoring explanation
   - Score color changes by value (tunable)
   - PNG generation + download.html auto-open stays
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
  function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

  function fromB64Payload(param) {
    try {
      const json = decodeURIComponent(escape(atob(param)));
      return JSON.parse(json);
    } catch { return null; }
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

  // -----------------------
  // Score color by value (TUNABLE)
  // -----------------------
  function scoreColor(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    // Tune these bands any time:
    if (s >= 90) return { on:"#67f3a4", glow:"rgba(103,243,164,.55)", off:"rgba(103,243,164,.10)" }; // elite green
    if (s >= 75) return { on:"#f5f0b3", glow:"rgba(245,240,179,.55)", off:"rgba(245,240,179,.10)" }; // pale yellow
    if (s >= 55) return { on:"#ffb85c", glow:"rgba(255,184,92,.55)", off:"rgba(255,184,92,.10)" };  // orange
    return        { on:"#ff6b6b", glow:"rgba(255,107,107,.55)", off:"rgba(255,107,107,.10)" };        // red
  }

  // -----------------------
  // Seven-seg LED drawing
  // -----------------------
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

  function drawSeg(x, y, w, h, on, palette) {
    ctx.save();
    ctx.fillStyle = on ? palette.on : palette.off;
    ctx.shadowColor = on ? palette.glow : "transparent";
    ctx.shadowBlur = on ? Math.max(6, Math.floor(w * 0.08)) : 0;
    drawRoundedRect(x, y, w, h, Math.min(10, h / 2));
    ctx.fill();
    ctx.restore();
  }

  function drawDigit(x, y, size, digit, palette) {
    // digit box: size wide, size*1.8 tall
    const W = size;
    const H = size * 1.8;
    const t = Math.max(5, Math.floor(size * 0.18)); // segment thickness
    const gap = Math.max(5, Math.floor(size * 0.12));
    const seg = segMap(digit);

    // a b c d e f g
    drawSeg(x + gap, y,             W - 2 * gap, t,                         seg[0], palette); // top
    drawSeg(x + W - t, y + gap,     t,           (H/2) - gap - t/2,         seg[1], palette); // top-right
    drawSeg(x + W - t, y + (H/2)+t/2, t,         (H/2) - gap - t/2,         seg[2], palette); // bot-right
    drawSeg(x + gap, y + H - t,     W - 2 * gap, t,                         seg[3], palette); // bottom
    drawSeg(x,         y + (H/2)+t/2, t,         (H/2) - gap - t/2,         seg[4], palette); // bot-left
    drawSeg(x,         y + gap,     t,           (H/2) - gap - t/2,         seg[5], palette); // top-left
    drawSeg(x + gap, y + (H/2)-(t/2), W - 2 * gap, t,                       seg[6], palette); // middle
  }

  function drawLedNumberCentered(score, cx, cy, totalWidth) {
    const s = Math.round(Number(score) || 0);
    const str = String(Math.max(0, Math.min(100, s)));
    const digits = (str === "100") ? ["1","0","0"] : str.padStart(2, "0").split("");

    const palette = scoreColor(s);

    const digitCount = digits.length;
    const spacing = Math.max(10, Math.floor(totalWidth * 0.04));
    const size = Math.floor((totalWidth - spacing * (digitCount - 1)) / digitCount);

    const blockH = size * 1.8;
    const startX = cx - ((size * digitCount) + (spacing * (digitCount - 1))) / 2;
    const startY = cy - blockH / 2;

    digits.forEach((d, i) => {
      const x = startX + i * (size + spacing);
      drawDigit(x, startY, size, d, palette);
    });
  }

  // -----------------------
  // Text + Dots
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

  function drawDotsFromPayload(payload, imgRect) {
    const aim = payload?.debug?.aim;
    const avg = payload?.debug?.avgPoi;

    const R = 7; // ✅ smaller dots
    const strokeW = 2;

    function dotAt(p, fill) {
      if (!p) return;
      const x01 = clamp01(Number(p.x01));
      const y01 = clamp01(Number(p.y01));
      const x = imgRect.x + x01 * imgRect.w;
      const y = imgRect.y + y01 * imgRect.h;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.55)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = fill;
      ctx.strokeStyle = "rgba(0,0,0,.70)";
      ctx.lineWidth = strokeW;

      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // AIM + POI (clean, no labels)
    dotAt(aim, "#67f3a4");
    dotAt(avg, "#b7ff3c");
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
  // Render SEC (safe layout)
  // -----------------------
  async function renderSec(payload) {
    hideErr();

    const cssW = Math.min(980, Math.floor(window.innerWidth * 0.96));
    const cssH = Math.floor(cssW * 9 / 16);
    dprScaleCanvas(cssW, cssH);

    // Background
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(6,7,10,1)";
    ctx.fillRect(0, 0, cssW, cssH);

    // Glass frame
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    drawRoundedRect(12, 12, cssW - 24, cssH - 24, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // SAFE layout numbers (scale with height so nothing clips)
    const topPad = Math.max(16, Math.floor(cssH * 0.04));
    const scoreCenterY = Math.max(78, Math.floor(cssH * 0.17));     // ✅ safe
    const scoreWidth = Math.min(Math.floor(cssW * 0.70), 520);

    const explY = Math.floor(cssH * 0.30);

    // Image area below explanation down to footer zone
    const imgTop = Math.floor(cssH * 0.35);
    const imgBottom = Math.floor(cssH * 0.88);
    const imgH = Math.max(120, imgBottom - imgTop);

    const padX = 22;
    const imgRectOuter = {
      x: padX,
      y: imgTop,
      w: cssW - padX * 2,
      h: imgH
    };

    // Draw target photo
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
        drawDotsFromPayload(payload, drawnImgRect);

        ctx.restore();
      }
    }

    // LED score (color by value)
    const score = Math.round(Number(payload?.score ?? 0));
    drawLedNumberCentered(score, cssW / 2, scoreCenterY, scoreWidth);

    // Explanation line (replaces "U R Here" messaging)
    drawOverlayText(
      "Tighter group + closer to Aim Point = higher score.",
      cssW / 2,
      explY,
      Math.max(14, Math.floor(cssW * 0.028)),
      "rgba(238,242,247,.86)",
      1
    );

    // Footer
    ctx.save();
    ctx.fillStyle = "rgba(238,242,247,.25)";
    ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("SCZN3", cssW / 2, cssH - topPad);
    ctx.restore();

    return { ok: true, hasTarget: !!drawnImgRect };
  }

  // -----------------------
  // Save PNG (data + blob)
  // -----------------------
  async function savePngToStorage() {
    try {
      const dataUrl = elCanvas.toDataURL("image/png");
      localStorage.setItem(KEY_PNG_DATA, dataUrl);

      // blob URL helps immediate iOS flow (same-session)
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
      showErr("Missing payload. Open from results.");
      return;
    }

    const sid = payload.sessionId || "—";
    if (elSession) elSession.textContent = `Session: ${sid}`;

    await renderSec(payload);

    const saved = await savePngToStorage();
    if (!saved.ok) showErr("SEC rendered, but PNG could not be saved. Try again or clear storage.");
  }

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
