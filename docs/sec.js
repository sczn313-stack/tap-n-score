/* ============================================================
   tap-n-score/sec.js (FULL REPLACEMENT) — NO PHOTO + SHOW ALL HITS
   Changes:
   - Remove target photo rendering completely
   - Draw AIM + ALL hits + AVG POI
   - Dot size = 10 (radius)
   - Ensure LED score is never clipped at the top
   - Keep PNG generation + download.html auto-open
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
  // Score color by value
  // -----------------------
  function scorePalette(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    if (s >= 90) return { on:"#67f3a4", glow:"rgba(103,243,164,.55)", off:"rgba(103,243,164,.10)" };
    if (s >= 75) return { on:"#f5f0b3", glow:"rgba(245,240,179,.55)", off:"rgba(245,240,179,.10)" };
    if (s >= 55) return { on:"#ffb85c", glow:"rgba(255,184,92,.55)",  off:"rgba(255,184,92,.10)"  };
    return          { on:"#ff6b6b", glow:"rgba(255,107,107,.55)", off:"rgba(255,107,107,.10)" };
  }

  // -----------------------
  // Seven-seg LED drawing
  // -----------------------
  function segMap(d) {
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

  function drawSeg(x, y, w, h, on, pal) {
    ctx.save();
    ctx.fillStyle = on ? pal.on : pal.off;
    ctx.shadowColor = on ? pal.glow : "transparent";
    ctx.shadowBlur = on ? Math.max(6, Math.floor(w * 0.08)) : 0;
    drawRoundedRect(x, y, w, h, Math.min(10, h / 2));
    ctx.fill();
    ctx.restore();
  }

  function drawDigit(x, y, size, digit, pal) {
    const W = size;
    const H = size * 1.8;
    const t = Math.max(5, Math.floor(size * 0.18));
    const gap = Math.max(5, Math.floor(size * 0.12));
    const seg = segMap(digit);

    drawSeg(x + gap, y,               W - 2 * gap, t,                      seg[0], pal); // a
    drawSeg(x + W - t, y + gap,       t, (H/2) - gap - t/2,                seg[1], pal); // b
    drawSeg(x + W - t, y + (H/2)+t/2, t, (H/2) - gap - t/2,                seg[2], pal); // c
    drawSeg(x + gap, y + H - t,       W - 2 * gap, t,                      seg[3], pal); // d
    drawSeg(x,         y + (H/2)+t/2, t, (H/2) - gap - t/2,                seg[4], pal); // e
    drawSeg(x,         y + gap,       t, (H/2) - gap - t/2,                seg[5], pal); // f
    drawSeg(x + gap, y + (H/2)-(t/2), W - 2 * gap, t,                      seg[6], pal); // g
  }

  // Safer LED: respects maxHeight so it never clips
  function drawLedNumberCentered(score, cx, cy, totalWidth, maxHeight) {
    const s = Math.round(Number(score) || 0);
    const str = String(Math.max(0, Math.min(100, s)));
    const digits = (str === "100") ? ["1","0","0"] : str.padStart(2, "0").split("");
    const pal = scorePalette(s);

    const digitCount = digits.length;
    const spacing = Math.max(10, Math.floor(totalWidth * 0.05));

    // width-based size
    let size = Math.floor((totalWidth - spacing * (digitCount - 1)) / digitCount);

    // height limit: digit block is size*1.8
    const maxSizeByH = Math.floor((maxHeight || 99999) / 1.8);
    size = Math.max(24, Math.min(size, maxSizeByH));

    const blockH = size * 1.8;
    const startX = cx - ((size * digitCount) + (spacing * (digitCount - 1))) / 2;
    const startY = cy - blockH / 2;

    digits.forEach((d, i) => {
      const x = startX + i * (size + spacing);
      drawDigit(x, startY, size, d, pal);
    });
  }

  // -----------------------
  // Dots: AIM + hits + POI
  // -----------------------
  function getAim(payload) {
    return payload?.debug?.aim || payload?.aim || payload?.anchor || null;
  }

  function getAvgPoi(payload) {
    return payload?.debug?.avgPoi || payload?.avgPoi || payload?.poi || null;
  }

  function getHits(payload) {
    // Try multiple known shapes (we don't assume)
    const candidates = [
      payload?.hits,
      payload?.hits01,
      payload?.debug?.hits,
      payload?.debug?.hits01,
      payload?.taps,
      payload?.taps01,
      payload?.debug?.taps,
      payload?.debug?.taps01,
      payload?.points,
      payload?.debug?.points,
    ];

    const arr = candidates.find((x) => Array.isArray(x) && x.length);
    if (!arr) return [];

    // Normalize to {x01,y01}
    const norm = [];
    for (const p of arr) {
      if (!p) continue;

      // common shapes: {x01,y01} OR {x,y} already normalized 0..1
      const x01 = (p.x01 ?? p.x);
      const y01 = (p.y01 ?? p.y);

      if (Number.isFinite(Number(x01)) && Number.isFinite(Number(y01))) {
        norm.push({ x01: clamp01(Number(x01)), y01: clamp01(Number(y01)) });
      }
    }
    return norm;
  }

  function drawDot(p01, rect, fill, radius) {
    const x = rect.x + clamp01(Number(p01.x01)) * rect.w;
    const y = rect.y + clamp01(Number(p01.y01)) * rect.h;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = fill;
    ctx.strokeStyle = "rgba(0,0,0,.75)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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

  function drawSubtleGrid(rect) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    ctx.lineWidth = 1;

    const step = Math.max(22, Math.floor(rect.w / 12)); // adaptive grid
    for (let x = rect.x; x <= rect.x + rect.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, rect.y + rect.h);
      ctx.stroke();
    }
    for (let y = rect.y; y <= rect.y + rect.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
    }
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

    // Glass frame
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    drawRoundedRect(12, 12, cssW - 24, cssH - 24, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Safe layout zones
    const topPad = Math.max(18, Math.floor(cssH * 0.05));

    // Score zone (guaranteed not clipped)
    const scoreCenterY = Math.max(96, Math.floor(cssH * 0.18));
    const scoreWidth = Math.min(420, Math.floor(cssW * 0.60)); // smaller than before
    const scoreMaxH = Math.max(90, Math.floor(cssH * 0.22));   // hard height limit

    // Explanation line
    const explY = Math.floor(cssH * 0.33);

    // “Plot area” for dots (replaces photo)
    const plotTop = Math.floor(cssH * 0.38);
    const plotBottom = Math.floor(cssH * 0.88);
    const padX = 22;

    const plotRect = {
      x: padX,
      y: plotTop,
      w: cssW - padX * 2,
      h: Math.max(140, plotBottom - plotTop)
    };

    // Plot frame
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.20)";
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    drawRoundedRect(plotRect.x, plotRect.y, plotRect.w, plotRect.h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.clip();

    // subtle grid so dots feel grounded
    drawSubtleGrid(plotRect);

    // Draw dots
    const DOT_R = 10; // ✅ requested size
    const aim = getAim(payload);
    const avg = getAvgPoi(payload);
    const hits = getHits(payload);

    // hits (white)
    for (const h of hits) drawDot(h, plotRect, "rgba(238,242,247,.95)", DOT_R);

    // aim (green)
    if (aim) drawDot(aim, plotRect, "#67f3a4", DOT_R);

    // avg poi (lime)
    if (avg) drawDot(avg, plotRect, "#b7ff3c", DOT_R);

    ctx.restore();

    // LED score
    const score = Math.round(Number(payload?.score ?? 0));
    drawLedNumberCentered(score, cssW / 2, scoreCenterY, scoreWidth, scoreMaxH);

    // Explanation line
    drawOverlayText(
      "Tighter group + closer to Aim Point = higher score.",
      cssW / 2,
      explY,
      Math.max(14, Math.floor(cssW * 0.030)),
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

    // If we still have no hits and no aim, tell you why
    if (!hits.length && !aim) {
      showErr("No hits found in payload. If this persists, your results page isn’t sending hits into the SEC payload yet.");
    }

    return { ok: true };
  }

  // -----------------------
  // Save PNG (data + blob)
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

      return { ok: true };
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
