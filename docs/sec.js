/* ============================================================
   tap-n-score/sec.js (FULL REPLACEMENT) — OPTION A (SEC renders + generates PNG)
   Goal:
   - Read payload from ?payload= (base64 JSON) or localStorage SCZN3_SEC_PAYLOAD_V1
   - Draw SEC canvas: target image + aim/poi dots + LED score (pale yellow) + “U R Here! Do better.”
   - Save PNG to localStorage:
       SCZN3_SEC_PNG_DATAURL_V1
       SCZN3_SEC_PNG_BLOBURL_V1
   - Route to download.html (no img param needed) + auto-open with ?auto=1
============================================================ */

(() => {
  // ---- Payload key
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";

  // ---- Target photo handoff keys (from index page)
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1"; // data:image/...
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1"; // blob:...

  // ---- PNG keys (consumed by download.js FULL REPLACEMENT)
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
  // Seven-seg LED drawing
  // -----------------------
  const LED_ON = "#f5f0b3";      // pale yellow
  const LED_GLOW = "rgba(245,240,179,.55)";
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

  function drawSeg(x, y, w, h, on) {
    ctx.save();
    ctx.fillStyle = on ? LED_ON : LED_OFF;
    ctx.shadowColor = on ? LED_GLOW : "transparent";
    ctx.shadowBlur = on ? Math.max(6, Math.floor(w * 0.08)) : 0;
    drawRoundedRect(x, y, w, h, Math.min(10, h / 2));
    ctx.fill();
    ctx.restore();
  }

  function drawDigit(x, y, size, digit) {
    // digit box: size wide, size*1.8 tall
    const W = size;
    const H = size * 1.8;
    const t = Math.max(6, Math.floor(size * 0.18)); // segment thickness
    const gap = Math.max(6, Math.floor(size * 0.12));

    const seg = segMap(digit);

    // a (top)
    drawSeg(x + gap, y, W - 2 * gap, t, seg[0]);
    // b (top-right)
    drawSeg(x + W - t, y + gap, t, (H / 2) - gap - t / 2, seg[1]);
    // c (bottom-right)
    drawSeg(x + W - t, y + (H / 2) + t / 2, t, (H / 2) - gap - t / 2, seg[2]);
    // d (bottom)
    drawSeg(x + gap, y + H - t, W - 2 * gap, t, seg[3]);
    // e (bottom-left)
    drawSeg(x, y + (H / 2) + t / 2, t, (H / 2) - gap - t / 2, seg[4]);
    // f (top-left)
    drawSeg(x, y + gap, t, (H / 2) - gap - t / 2, seg[5]);
    // g (middle)
    drawSeg(x + gap, y + (H / 2) - (t / 2), W - 2 * gap, t, seg[6]);
  }

  function drawLedNumberCentered(score, cx, cy, totalWidth) {
    const s = Math.round(Number(score) || 0);
    const str = String(Math.max(0, Math.min(100, s)));

    const digits = (str === "100") ? ["1","0","0"] : str.padStart(2, "0").split("");

    const digitCount = digits.length;
    const spacing = Math.max(16, Math.floor(totalWidth * 0.04));
    const size = Math.floor((totalWidth - spacing * (digitCount - 1)) / digitCount);

    const blockH = size * 1.8;
    const startX = cx - ((size * digitCount) + (spacing * (digitCount - 1))) / 2;
    const startY = cy - blockH / 2;

    digits.forEach((d, i) => {
      const x = startX + i * (size + spacing);
      drawDigit(x, startY, size, d);
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
    // Show AIM dot + AVG POI dot (truthful + clean)
    const aim = payload?.debug?.aim;
    const avg = payload?.debug?.avgPoi;

    function dotAt(p, color, label) {
      if (!p) return;
      const x01 = clamp01(Number(p.x01));
      const y01 = clamp01(Number(p.y01));
      const x = imgRect.x + x01 * imgRect.w;
      const y = imgRect.y + y01 * imgRect.h;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.55)";
      ctx.shadowBlur = 18;

      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(0,0,0,.65)";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(238,242,247,.90)";
      ctx.font = "900 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x, y - 14);

      ctx.restore();
    }

    dotAt(aim, "#67f3a4", "AIM");
    dotAt(avg, "#b7ff3c", "POI");
  }

  async function loadImage(src) {
    if (!src) return null;

    // If we got a data URL, we can draw it directly.
    // If we got a blob URL, also fine.
    // If we got https, needs CORS to allow canvas export; GitHub Pages images may taint.
    const img = new Image();
    img.decoding = "async";

    // Try to reduce CORS canvas-tainting when possible
    if (typeof src === "string" && src.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }

    img.src = src;

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    // If it failed, naturalWidth will be 0
    if (!img.naturalWidth) return null;
    return img;
  }

  // -----------------------
  // Determine the best target photo source
  // -----------------------
  function getBestTargetPhoto(payload) {
    // Priority:
    // 1) payload.sourceImg
    // 2) localStorage data URL
    // 3) localStorage blob URL
    const p = payload?.sourceImg;
    if (p && typeof p === "string" && p.length > 20) return p;

    const data = localStorage.getItem(KEY_TARGET_IMG_DATA);
    if (data && data.startsWith("data:image/")) return data;

    const blob = localStorage.getItem(KEY_TARGET_IMG_BLOB);
    if (blob && blob.startsWith("blob:")) return blob;

    return "";
  }

  // -----------------------
  // Render SEC
  // -----------------------
  async function renderSec(payload) {
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

    // Image rect
    const pad = 26;
    const imgRectOuter = { x: pad, y: pad + 24, w: cssW - pad * 2, h: cssH - pad * 2 - 84 };

    // Target photo
    const src = getBestTargetPhoto(payload);
    let drawnImgRect = null;

    if (!src) {
      showErr("No target photo provided to SEC. Go back and re-score (the capture image must be included).");
    } else {
      const img = await loadImage(src);

      if (!img) {
        showErr("Target photo failed to load in SEC. Go back and re-score.");
      } else {
        // Fit image into imgRectOuter (contain)
        const iw = img.naturalWidth || 1;
        const ih = img.naturalHeight || 1;
        const scale = Math.min(imgRectOuter.w / iw, imgRectOuter.h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = imgRectOuter.x + (imgRectOuter.w - dw) / 2;
        const dy = imgRectOuter.y + (imgRectOuter.h - dh) / 2;

        // Frame + clip
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

        // Dots (AIM + POI)
        drawDotsFromPayload(payload, drawnImgRect);

        ctx.restore();
      }
    }

    // LED score centered
    const score = Math.round(Number(payload?.score ?? 0));
    drawLedNumberCentered(score, cssW / 2, 92, Math.min(520, cssW - 80));

    // Coaching line
    drawOverlayText("U R Here!   Do better.", cssW / 2, cssH - 62, 24, "rgba(238,242,247,.90)", 1);

    // Footer
    ctx.save();
    ctx.fillStyle = "rgba(238,242,247,.25)";
    ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("SCZN3", cssW / 2, cssH - 18);
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
    const ls = safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "");
    return ls;
  }

  async function boot() {
    const payload = loadPayload();
    if (!payload) {
      showErr("Missing payload. Open from Tap-n-Score results.");
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
