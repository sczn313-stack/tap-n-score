/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — SEC-LOCALSTORAGE-1
   Purpose:
   - Read SEC payload from localStorage (set by scoring page)
   - Render: Score (colored numerals only), Elev/Wind clicks w/ arrows,
     single-letter dirs (U/D/L/R), shots count
   - Download SEC as PNG via canvas
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- IDs expected in sec.html
  const elScore = $("secScore");
  const elShots = $("secShots");

  const elWindDir = $("windDir");     // e.g. "R" / "L" / "—"
  const elWindVal = $("windVal");     // numeric string
  const elWindArrow = $("windArrow"); // arrow glyph

  const elElevDir = $("elevDir");     // e.g. "U" / "D" / "—"
  const elElevVal = $("elevVal");     // numeric string
  const elElevArrow = $("elevArrow"); // arrow glyph

  const btnDownload = $("downloadBtn");
  const btnVendor = $("vendorBtn");
  const btnSurvey = $("surveyBtn");

  const diag = $("secDiag"); // optional <pre> (ok if missing)

  // Canvas (hidden is fine)
  const secCanvas = $("secCanvas");

  // ---- Storage key (must match scoring page)
  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  // ---- Score color rule
  function scoreColor(scoreNum) {
    if (!Number.isFinite(scoreNum)) return "rgba(238,242,247,0.92)";
    const s = Math.round(scoreNum);
    if (s <= 60) return "rgba(214,64,64,0.98)";      // red
    if (s <= 79) return "rgba(255,208,70,0.98)";     // yellow
    return "rgba(103,243,164,0.98)";                 // green
  }

  function safeNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function fmtClicks(n) {
    // You asked for "Yes 0.00" style; keep 2 decimals always.
    return safeNum(n, 0).toFixed(2);
  }

  function arrowForDir(letter) {
    // Single-letter direction with arrow glyph
    switch (letter) {
      case "U": return "↑";
      case "D": return "↓";
      case "L": return "←";
      case "R": return "→";
      default:  return "•";
    }
  }

  function normalizeDirLetter(v) {
    // Accept "UP"/"DOWN"/"LEFT"/"RIGHT" or already "U/D/L/R"
    if (!v) return "—";
    const s = String(v).trim().toUpperCase();
    if (s === "U" || s === "UP") return "U";
    if (s === "D" || s === "DOWN") return "D";
    if (s === "L" || s === "LEFT") return "L";
    if (s === "R" || s === "RIGHT") return "R";
    if (s === "—" || s === "-") return "—";
    return "—";
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt;
  }

  function setScoreUI(scoreNum) {
    const s = Number(scoreNum);
    const shown = Number.isFinite(s) ? String(Math.round(s)) : "—";
    setText(elScore, shown);
    if (elScore) elScore.style.color = scoreColor(s);
  }

  function setShotsUI(shots) {
    const n = Number.isFinite(Number(shots)) ? String(Number(shots)) : "0";
    setText(elShots, n);
  }

  function setWindUI(dirLetter, clicks) {
    const d = normalizeDirLetter(dirLetter);
    setText(elWindDir, d);
    setText(elWindArrow, arrowForDir(d));
    setText(elWindVal, fmtClicks(clicks));
  }

  function setElevUI(dirLetter, clicks) {
    const d = normalizeDirLetter(dirLetter);
    setText(elElevDir, d);
    setText(elElevArrow, arrowForDir(d));
    setText(elElevVal, fmtClicks(clicks));
  }

  function readPayload() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeDiag(obj) {
    if (!diag) return;
    diag.textContent = JSON.stringify(obj, null, 2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function downloadPNG(payload) {
    if (!secCanvas) return;

    // High-res export
    secCanvas.width = 1200;
    secCanvas.height = 1600;

    const ctx = secCanvas.getContext("2d");
    const W = secCanvas.width;
    const H = secCanvas.height;

    // Background
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    // Card
    const pad = 70;
    const x = pad, y = pad, w = W - pad * 2, h = H - pad * 2;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 48);
    ctx.fill();
    ctx.stroke();

    // Title (simple, no RWB line)
    ctx.fillStyle = "rgba(238,242,247,0.92)";
    ctx.font = "900 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Shooter Experience Card", x + 56, y + 96);

    // SCORE label
    ctx.fillStyle = "rgba(238,242,247,0.65)";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Shooter’s Score", x + 56, y + 150);

    // SCORE number
    const scoreNum = safeNum(payload?.score, NaN);
    const scoreTxt = Number.isFinite(scoreNum) ? String(Math.round(scoreNum)) : "—";
    ctx.fillStyle = scoreColor(scoreNum);
    ctx.font = "1000 260px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText(scoreTxt, x + w / 2, y + 430);
    ctx.textAlign = "left";

    // Mini panel: clicks + shots
    const panelY = y + 560;
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    roundRect(ctx, x + 56, panelY, w - 112, 380, 32);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(238,242,247,0.75)";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Target Adjustments", x + 92, panelY + 68);

    // Windage line
    const windDir = normalizeDirLetter(payload?.windage?.dir);
    const windClicks = fmtClicks(payload?.windage?.clicks);
    ctx.fillStyle = "rgba(238,242,247,0.92)";
    ctx.font = "1000 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`${arrowForDir(windDir)}  ${windDir}`, x + 92, panelY + 150);
    ctx.fillText(`${windClicks}`, x + 240, panelY + 150);

    // Elevation line
    const elevDir = normalizeDirLetter(payload?.elevation?.dir);
    const elevClicks = fmtClicks(payload?.elevation?.clicks);
    ctx.fillText(`${arrowForDir(elevDir)}  ${elevDir}`, x + 92, panelY + 245);
    ctx.fillText(`${elevClicks}`, x + 240, panelY + 245);

    // Shots
    const shots = safeNum(payload?.shots, 0);
    ctx.fillStyle = "rgba(238,242,247,0.75)";
    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Shots", x + 92, panelY + 330);
    ctx.fillStyle = "rgba(238,242,247,0.92)";
    ctx.font = "1000 70px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(shots), x + 180, panelY + 335);

    // Footer timestamp
    ctx.fillStyle = "rgba(238,242,247,0.35)";
    ctx.font = "800 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(new Date().toLocaleString(), x + 56, y + h - 56);

    // Download
    const a = document.createElement("a");
    a.download = (payload?.sessionId ? String(payload.sessionId) : "SEC") + ".png";
    a.href = secCanvas.toDataURL("image/png");
    a.click();
  }

  // ---- Boot
  const payload = readPayload();

  // If payload missing, still render something stable
  if (!payload) {
    setScoreUI(NaN);
    setShotsUI(0);
    setWindUI("—", 0);
    setElevUI("—", 0);
    writeDiag({ ok: false, reason: "No SEC payload found in localStorage", key: KEY });
  } else {
    // Render UI from payload
    setScoreUI(payload.score);
    setShotsUI(payload.shots);

    // IMPORTANT: Elevation truth comes from backend; frontend only displays.
    // Payload should already include the correct "U/D" letter.
    setWindUI(payload?.windage?.dir, payload?.windage?.clicks);
    setElevUI(payload?.elevation?.dir, payload?.elevation?.clicks);

    writeDiag({ ok: true, payload });
  }

  // ---- Buttons
  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      const p = readPayload() || payload || {};
      downloadPNG(p);
    });
  }

  if (btnVendor) {
    btnVendor.addEventListener("click", () => {
      // Update this URL later if needed
      const url = (payload && payload.vendorUrl) ? payload.vendorUrl : "";
      if (url) window.open(url, "_blank", "noopener");
      else alert("Vendor link not set yet.");
    });
  }

  if (btnSurvey) {
    btnSurvey.addEventListener("click", () => {
      const url = (payload && payload.surveyUrl) ? payload.surveyUrl : "";
      if (url) window.open(url, "_blank", "noopener");
      else alert("Survey link coming next.");
    });
  }
})();
