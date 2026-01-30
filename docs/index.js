/* ============================================================
   index.js (FULL REPLACEMENT) — Tap-n-Score™ (WIRED)
   - iOS picker works
   - Tap flow: first tap = bull, then holes
   - Show Results -> POST /api/score (Render backend)
   - Populates SEC card: sessionId + 4 click values + score
   - Download SEC (Image): generates a real PNG from canvas
   - Survey button: loose (placeholder alert)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // -----------------------------
  // API BASE (backend)
  // Priority:
  // 1) URL param: ?api=https://YOUR-backend.onrender.com
  // 2) localStorage: TNS_API_BASE
  // 3) window.API_BASE
  // 4) same-origin ("")
  // -----------------------------
  function getApiBase() {
    const u = new URL(window.location.href);
    const qp = u.searchParams.get("api");
    if (qp && qp.startsWith("http")) {
      const clean = qp.replace(/\/+$/, "");
      localStorage.setItem("TNS_API_BASE", clean);
      return clean;
    }
    const ls = localStorage.getItem("TNS_API_BASE");
    if (ls && ls.startsWith("http")) return ls.replace(/\/+$/, "");
    if (window.API_BASE && String(window.API_BASE).startsWith("http")) {
      return String(window.API_BASE).replace(/\/+$/, "");
    }
    return ""; // same-origin
  }

  const API_BASE = getApiBase();
  const API_SCORE = `${API_BASE}/api/score`;

  // -----------------------------
  // Elements (must exist)
  // -----------------------------
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");

  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn") || $("seeResultsBtn"); // supports either id
  const elInstruction = $("instructionLine");

  // Optional settings inputs (if present)
  const elDistance = $("distanceYds");
  const elMoaPerClick = $("moaPerClick");
  const elWIn = $("targetWidthIn");
  const elHIn = $("targetHeightIn");

  // SEC card elements
  const elSecCard = $("secCard");
  const elSession = $("secSessionId") || $("sessionId");
  const elUp = $("clickUp");
  const elDown = $("clickDown");
  const elLeft = $("clickLeft");
  const elRight = $("clickRight");
  const elScoreBig = $("scoreBig");
  const elScoreCur = $("scoreCurrent");

  // Buttons at bottom of SEC
  const btnDlImg = $("downloadSecImageBtn");
  const btnSurvey = $("surveyBtn") || $("downloadSecTextBtn"); // supports either id

  // -----------------------------
  // State
  // -----------------------------
  let objectUrl = null;
  let bull = null; // {x:0..1, y:0..1}
  let holes = [];  // [{x,y}...]
  let lastSEC = null; // last response payload from backend (plus inputs)

  // -----------------------------
  // Helpers
  // -----------------------------
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function num(v, fallback) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function setTapCounter() {
    if (!elTapCount) return;
    const total = (bull ? 1 : 0) + holes.length;
    elTapCount.textContent = String(total);
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function clearDots() {
    if (elDots) elDots.innerHTML = "";
  }

  function drawDot(normX, normY, kind) {
    if (!elDots) return;

    const d = document.createElement("div");
    d.className = "dot";
    d.style.left = `${normX * 100}%`;
    d.style.top = `${normY * 100}%`;

    // quick visual difference if your CSS doesn’t already do it
    d.style.position = "absolute";
    d.style.transform = "translate(-50%, -50%)";
    d.style.width = kind === "bull" ? "18px" : "14px";
    d.style.height = kind === "bull" ? "18px" : "14px";
    d.style.borderRadius = "999px";
    d.style.border = "2px solid rgba(255,255,255,0.9)";
    d.style.background = kind === "bull"
      ? "rgba(255,40,40,0.90)"
      : "rgba(0,160,255,0.90)";
    d.style.boxShadow = "0 10px 24px rgba(0,0,0,0.45)";

    elDots.appendChild(d);
  }

  function redrawDots() {
    clearDots();
    if (bull) drawDot(bull.x, bull.y, "bull");
    holes.forEach((h) => drawDot(h.x, h.y, "hole"));
  }

  function resetTaps() {
    bull = null;
    holes = [];
    lastSEC = null;
    setTapCounter();
    redrawDots();
    setInstruction("Tap bull’s-eye to center");
    if (elSecCard) elSecCard.hidden = true;
    if (btnDlImg) btnDlImg.disabled = true;
  }

  function getNormalizedFromEvent(e) {
    const rect = elWrap.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clamp01((cx - rect.left) / rect.width);
    const y = clamp01((cy - rect.top) / rect.height);
    return { x, y };
  }

  // -----------------------------
  // File selection
  // -----------------------------
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0] ? elFile.files[0] : null;
      if (!f) return;

      revokeObjectUrl();
      objectUrl = URL.createObjectURL(f);
      elImg.src = objectUrl;

      // Reset taps on new photo
      resetTaps();
    });
  }

  // -----------------------------
  // Tap capture
  // -----------------------------
  function onTap(e) {
    if (!elImg || !elImg.src) return;

    // prevent zoom/scroll on iOS tap
    if (e.type === "touchstart") e.preventDefault();

    const p = getNormalizedFromEvent(e);

    if (!bull) {
      bull = p;
      setInstruction("Tap bullet holes to be scored");
    } else {
      holes.push(p);
    }

    setTapCounter();
    redrawDots();
  }

  if (elWrap) {
    elWrap.addEventListener("click", onTap);
    elWrap.addEventListener("touchstart", onTap, { passive: false });
  }

  // -----------------------------
  // Clear taps
  // -----------------------------
  if (elClear) {
    elClear.addEventListener("click", resetTaps);
  }

  // -----------------------------
  // Call backend + populate SEC
  // -----------------------------
  async function scoreNow() {
    if (!bull) {
      alert("Tap bull’s-eye first.");
      return;
    }
    if (holes.length === 0) {
      alert("Tap at least one bullet hole.");
      return;
    }

    // Pull inputs (fallbacks if you don’t have the inputs yet)
    const distanceYds = num(elDistance?.value, 100);
    const moaPerClick = num(elMoaPerClick?.value, 0.25);
    const widthIn = num(elWIn?.value, 8.5);
    const heightIn = num(elHIn?.value, 11);

    const payload = {
      bull,
      holes,
      target: { widthIn, heightIn },
      distanceYds,
      moaPerClick
    };

    setInstruction("Computing…");

    let resp, data;
    try {
      resp = await fetch(API_SCORE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      data = await resp.json().catch(() => null);
    } catch (err) {
      alert(`Backend not reachable.\n\nAPI: ${API_SCORE}\n\n${String(err?.message || err)}`);
      setInstruction("Tap bull’s-eye to center");
      return;
    }

    if (!resp.ok || !data || data.ok !== true) {
      alert(`Score failed.\n\n${data?.error || resp.statusText || "Unknown error"}`);
      setInstruction("Tap bull’s-eye to center");
      return;
    }

    lastSEC = { ...data, input: payload };

    // Populate SEC UI
    if (elSecCard) elSecCard.hidden = false;
    if (elSession) elSession.textContent = (data.sessionId || "—");

    if (elUp) elUp.textContent = data.clicks?.up ?? "0.00";
    if (elDown) elDown.textContent = data.clicks?.down ?? "0.00";
    if (elLeft) elLeft.textContent = data.clicks?.left ?? "0.00";
    if (elRight) elRight.textContent = data.clicks?.right ?? "0.00";

    const sc = data.score?.current;
    if (elScoreBig) elScoreBig.textContent = (sc ?? "—");
    if (elScoreCur) elScoreCur.textContent = (sc ?? "—");

    if (btnDlImg) btnDlImg.disabled = false;

    setInstruction("Results ready.");
    elSecCard?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (elShow) {
    elShow.addEventListener("click", scoreNow);
  }

  // -----------------------------
  // Download SEC (Image) — REAL PNG
  // (no html2canvas dependency, pure canvas)
  // -----------------------------
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function safeName(s) {
    return String(s || "SEC").replace(/[^A-Za-z0-9_-]+/g, "_");
  }

  function exportSecPng() {
    if (!lastSEC) {
      alert("Run Show Results first.");
      return;
    }

    const sid = lastSEC.sessionId || "SEC";
    const clicks = lastSEC.clicks || {};
    const score = lastSEC.score?.current;

    // Canvas design
    const W = 1200, H = 1600;
    const pad = 72;

    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    // background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1830");
    g.addColorStop(1, "#05070b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SEC CARD", pad, pad + 30);

    // session
    ctx.globalAlpha = 0.85;
    ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Session: ${sid}`, pad, pad + 95);
    ctx.globalAlpha = 1;

    // card helper
    function card(x, y, w, h, title) {
      // rounded rect
      const r = 34;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "900 38px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(title, x + 48, y + 72);
    }

    // clicks card
    const cx = pad, cy = pad + 140, cw = W - pad * 2, ch = 360;
    card(cx, cy, cw, ch, "Target Clicks");

    ctx.font = "800 32px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("Up", cx + 48, cy + 140);
    ctx.fillText("Down", cx + cw * 0.55, cy + 140);
    ctx.fillText("Left", cx + 48, cy + 270);
    ctx.fillText("Right", cx + cw * 0.55, cy + 270);

    ctx.font = "950 78px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(clicks.up ?? "0.00"), cx + 48, cy + 215);
    ctx.fillText(String(clicks.down ?? "0.00"), cx + cw * 0.55, cy + 215);
    ctx.fillText(String(clicks.left ?? "0.00"), cx + 48, cy + 345);
    ctx.fillText(String(clicks.right ?? "0.00"), cx + cw * 0.55, cy + 345);

    // score card
    const sx = pad, sy = cy + ch + 60, sw = W - pad * 2, sh = 460;
    card(sx, sy, sw, sh, "Score");

    ctx.fillStyle = "#ffd166";
    ctx.font = "1000 240px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(score ?? "—"), sx + 48, sy + 330);

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Download this SEC and save it.", pad, H - pad + 10);
    ctx.globalAlpha = 1;

    c.toBlob((blob) => {
      if (!blob) return alert("PNG export failed.");
      downloadBlob(blob, `${safeName(sid)}.png`);
    }, "image/png");
  }

  if (btnDlImg) {
    btnDlImg.disabled = true;
    btnDlImg.addEventListener("click", exportSecPng);
  }

  // -----------------------------
  // Survey button (LOOSE)
  // -----------------------------
  if (btnSurvey) {
    // Optional: force label
    if (btnSurvey.textContent && btnSurvey.textContent.toLowerCase().includes("download")) {
      btnSurvey.textContent = "Take 10-Second Survey";
    }
    btnSurvey.addEventListener("click", () => {
      alert("Survey coming next — after everything else is wired.");
    });
  }

  // -----------------------------
  // Boot
  // -----------------------------
  setTapCounter();
  setInstruction("Take or Choose Target Photo");
})();
