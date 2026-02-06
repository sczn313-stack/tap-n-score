/* ============================================================
   tap-n-score/sec.js (FULL REPLACEMENT) — SEC LOCK + ENTRY GUARD
   Change:
   - If SEC is opened directly with no payload, redirect to landing.
============================================================ */

(() => {
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_PNG_BLOB = "SCZN3_SEC_PNG_BLOBURL_V1";
  const KEY_FROM = "SCZN3_SEC_FROM_V1";

  const $ = (id) => document.getElementById(id);

  const elSession = $("sessionLine");
  const elScore = $("scoreValue");
  const elScoreLabel = $("scoreLabel");
  const elShots = $("shotsVal");
  const elDist = $("distVal");
  const elWind = $("windVal");
  const elElev = $("elevVal");
  const elErr = $("errLine");

  const btnDownload = $("downloadBtn");
  const btnScoreAnother = $("scoreAnotherBtn");

  function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function fromB64Payload(param) {
    try {
      const json = decodeURIComponent(escape(atob(param)));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function navToIndex() {
    window.location.href = `./index.html?fresh=${Date.now()}`;
  }

  function navToDownloadAuto() {
    window.location.href = `./download.html?auto=1&fresh=${Date.now()}`;
  }

  function showErr(msg) {
    if (!elErr) return;
    elErr.style.display = "block";
    elErr.textContent = String(msg || "");
  }

  function hideErr() {
    if (!elErr) return;
    elErr.style.display = "none";
    elErr.textContent = "";
  }

  function loadPayload() {
    const p = getParam("payload");
    if (p) {
      const obj = fromB64Payload(p);
      if (obj) return obj;
    }
    return safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "");
  }

  function clampScore(s) {
    const n = Math.round(Number(s));
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function scoreColor(score) {
    if (score >= 90) return "#67f3a4";
    if (score >= 75) return "#f5f0b3";
    if (score >= 60) return "#ffb84a";
    return "#ff5b5b";
  }

  function scoreLabel(score) {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Solid";
    if (score >= 60) return "Needs tightening";
    return "Wide / Off-center";
  }

  function fmtClicks(obj) {
    const dir = obj?.dir ? String(obj.dir) : "—";
    const c = Number(obj?.clicks);
    const clicks = Number.isFinite(c) ? c.toFixed(2) : "—";
    return `${dir}  ${clicks}`;
  }

  // -------- PNG generation (no target photo)
  function buildSecPng(payload) {
    const score = clampScore(payload?.score ?? 0);
    const sid = payload?.sessionId || "—";
    const shots = Number(payload?.shots ?? 0) || 0;
    const dist = Number(payload?.debug?.distanceYds ?? 100) || 100;

    const windTxt = fmtClicks(payload?.windage);
    const elevTxt = fmtClicks(payload?.elevation);

    const W = 1600;
    const H = 900;

    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#06070a";
    ctx.fillRect(0, 0, W, H);

    function radial(x,y,r, color){
      const g = ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      return g;
    }
    ctx.fillStyle = radial(350, 160, 700, "rgba(47,102,255,0.18)");
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle = radial(1250, 180, 700, "rgba(214,64,64,0.14)");
    ctx.fillRect(0,0,W,H);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;

    roundRect(ctx, 80, 70, W-160, H-140, 34);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawRWBTitle(ctx, W/2, 155);

    // Session
    ctx.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(238,242,247,0.55)";
    ctx.fillText(`Session: ${sid}`, W/2, 205);

    // Score
    ctx.font = "1000 170px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColor(score);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 26;
    ctx.fillText(String(score), W/2, 375);
    ctx.shadowBlur = 0;

    // Label
    ctx.font = "950 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(238,242,247,0.90)";
    ctx.fillText(scoreLabel(score), W/2, 470);

    // Fairness
    ctx.font = "850 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(238,242,247,0.72)";
    ctx.fillText("Tighter group + closer to aim point = higher score", W/2, 520);

    // Stats
    const boxY = 585;
    const boxW = (W - 220) / 2;
    const boxH = 120;
    const leftX = 110;
    const rightX = leftX + boxW + 20;

    statBox(ctx, leftX, boxY, boxW, boxH, "Shots", `${shots} hits`);
    statBox(ctx, rightX, boxY, boxW, boxH, "Distance", `${dist} yd`);

    const boxY2 = boxY + boxH + 18;
    statBox(ctx, leftX, boxY2, boxW, boxH, "Windage", windTxt);
    statBox(ctx, rightX, boxY2, boxW, boxH, "Elevation", elevTxt);

    // Footer
    ctx.font = "900 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(238,242,247,0.28)";
    ctx.fillText("SCZN3", W/2, H - 100);

    return c.toDataURL("image/png");

    function roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w/2, h/2);
      ctx.beginPath();
      ctx.moveTo(x+rr, y);
      ctx.arcTo(x+w, y, x+w, y+h, rr);
      ctx.arcTo(x+w, y+h, x, y+h, rr);
      ctx.arcTo(x, y+h, x, y, rr);
      ctx.arcTo(x, y, x+w, y, rr);
      ctx.closePath();
    }

    function drawRWBTitle(ctx, cx, cy){
      const parts = [
        {t:"SHOOTER", c:"#d64040"},
        {t:"EXPERIENCE", c:"#eef2f7"},
        {t:"CARD", c:"#2f66ff"},
        {t:"SEC", c:"#eef2f7"},
      ];
      ctx.font = "1000 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const gap = 18;
      const widths = parts.map(p => ctx.measureText(p.t).width);
      const total = widths.reduce((a,b)=>a+b,0) + gap*(parts.length-1);
      let x = cx - total/2;

      for (let i=0;i<parts.length;i++){
        ctx.fillStyle = parts[i].c;
        ctx.fillText(parts[i].t, x + widths[i]/2, cy);
        x += widths[i] + gap;
      }
    }

    function statBox(ctx, x, y, w, h, label, value){
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 26);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(238,242,247,0.55)";
      ctx.font = "950 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(label.toUpperCase(), x + 24, y + 42);

      ctx.fillStyle = "rgba(238,242,247,0.92)";
      ctx.font = "1000 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(String(value), x + 24, y + 92);
    }
  }

  async function savePngToStorage(dataUrl) {
    localStorage.setItem(KEY_PNG_DATA, dataUrl);

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    try { localStorage.setItem(KEY_PNG_BLOB, blobUrl); } catch {}
    try { localStorage.setItem(KEY_FROM, "./sec.html?fresh=" + Date.now()); } catch {}
    return blobUrl;
  }

  function paintUI(payload) {
    hideErr();

    const sid = payload?.sessionId || "—";
    if (elSession) elSession.textContent = `Session: ${sid}`;

    const score = clampScore(payload?.score ?? 0);
    if (elScore) {
      elScore.textContent = String(score);
      elScore.style.color = scoreColor(score);
    }
    if (elScoreLabel) elScoreLabel.textContent = scoreLabel(score);

    if (elShots) elShots.textContent = String(Number(payload?.shots ?? 0) || 0);
    const dist = Number(payload?.debug?.distanceYds ?? 100) || 100;
    if (elDist) elDist.textContent = String(dist);

    if (elWind) elWind.textContent = fmtClicks(payload?.windage);
    if (elElev) elElev.textContent = fmtClicks(payload?.elevation);
  }

  async function boot() {
    const payload = loadPayload();

    // ✅ ENTRY GUARD: SEC is not allowed to be the entry page
    if (!payload) {
      // No error screen; just go home
      navToIndex();
      return;
    }

    paintUI(payload);

    try {
      const png = buildSecPng(payload);
      await savePngToStorage(png);
    } catch {
      showErr("SEC loaded, but PNG could not be generated. Try re-score.");
    }
  }

  if (btnDownload) {
    btnDownload.addEventListener("click", async () => {
      const payload = loadPayload();
      if (!payload) { navToIndex(); return; }

      try {
        const png = buildSecPng(payload);
        await savePngToStorage(png);
        navToDownloadAuto();
      } catch {
        showErr("Could not generate PNG. Try again.");
      }
    });
  }

  if (btnScoreAnother) btnScoreAnother.addEventListener("click", navToIndex);

  boot();
})();
