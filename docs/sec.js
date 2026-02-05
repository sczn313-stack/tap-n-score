/* ============================================================
   tap-n-score/sec.js (FULL REPLACEMENT) — OPTION A (SEC renders + generates PNG)
   Goal:
   - Read payload from ?payload= (base64 JSON) or localStorage SCZN3_SEC_PAYLOAD_V1
   - Draw SEC canvas: target image + aim/hits + LED score (pale yellow) + “U R Here! Do better.”
   - Save PNG to localStorage key: SCZN3_SEC_PNG
   - Route to download.html (no img param needed) + optionally auto-download
============================================================ */

(() => {
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_PNG = "SCZN3_SEC_PNG";

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

    // Render as 2 digits unless 100
    const digits = (str === "100") ? ["1","0","0"] : str.padStart(2, "0").split("");

    // Choose size from available width
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
  // Draw SEC Canvas
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
    // payload.debug.aim and payload.debug.avgPoi exist now, but hits are not shipped.
    // We’ll show AIM dot + AVG POI dot for now (clean + true).
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

      // small label
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

  async function renderSec(payload) {
    hideErr();

    // Canvas size (16:9 for now, looks great on iPhone)
    const cssW = Math.min(980, Math.floor(window.innerWidth * 0.96));
    const cssH = Math.floor(cssW * 9 / 16);
    dprScaleCanvas(cssW, cssH);

    // Background
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(6,7,10,1)";
    ctx.fillRect(0, 0, cssW, cssH);

    // Glass panel behind image
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    drawRoundedRect(16, 16, cssW - 32, cssH - 32, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Image rect
    const pad = 26;
    const imgRect = { x: pad, y: pad + 24, w: cssW - pad * 2, h: cssH - pad * 2 - 84 };

    // draw target photo if we have it
    const src = payload?.sourceImg || "";
    if (!src) {
      // No image available — still show LED score and coaching text
      showErr("No target photo provided to SEC. Go back and re-score (the capture image must be included).");
    } else {
      const img = new Image();
      img.decoding = "async";
      img.src = src;

      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      // Fit image into imgRect (contain)
      const iw = img.naturalWidth || 1;
      const ih = img.naturalHeight || 1;
      const scale = Math.min(imgRect.w / iw, imgRect.h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = imgRect.x + (imgRect.w - dw) / 2;
      const dy = imgRect.y + (imgRect.h - dh) / 2;

      // Photo frame
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.lineWidth = 1;
      drawRoundedRect(imgRect.x, imgRect.y, imgRect.w, imgRect.h, 16);
      ctx.fill();
      ctx.stroke();

      // Clip to rounded rect
      ctx.clip();

      // Draw image
      ctx.drawImage(img, dx, dy, dw, dh);

      // Dots (AIM + POI)
      drawDotsFromPayload(payload, { x: dx, y: dy, w: dw, h: dh });

      ctx.restore();
    }

    // LED score centered
    const score = Math.round(Number(payload?.score ?? 0));
    drawLedNumberCentered(score, cssW / 2, 92, Math.min(520, cssW - 80));

    // Coaching line
    drawOverlayText("U R Here!   Do better.", cssW / 2, cssH - 62, 24, "rgba(238,242,247,.90)", 1);

    // Small footer mark
    ctx.save();
    ctx.fillStyle = "rgba(238,242,247,.25)";
    ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("SCZN3", cssW / 2, cssH - 18);
    ctx.restore();
  }

  function savePngToLocalStorage() {
    try {
      const dataUrl = elCanvas.toDataURL("image/png");
      localStorage.setItem(KEY_PNG, dataUrl);
      return true;
    } catch (e) {
      return false;
    }
  }

  function navToDownload() {
    window.location.href = `./download.html?fresh=${Date.now()}`;
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

    // session line
    const sid = payload.sessionId || "—";
    if (elSession) elSession.textContent = `Session: ${sid}`;

    await renderSec(payload);

    // Generate PNG immediately so download page has it
    const ok = savePngToLocalStorage();
    if (!ok) {
      showErr("SEC rendered, but PNG could not be saved. Try again or clear storage.");
    }
  }

  // Buttons
  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      const ok = savePngToLocalStorage();
      if (!ok) {
        showErr("Could not generate PNG. Try again.");
        return;
      }
      navToDownload();
    });
  }

  if (btnScoreAnother) btnScoreAnother.addEventListener("click", navToIndex);
  if (btnBack) btnBack.addEventListener("click", navToIndex);

  boot();
})();
