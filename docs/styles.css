/* ============================================================
   docs/index.js (FULL REPLACEMENT) — vLOCK-SEC-DL-1
   - Removes landing HUD pills (none in HTML)
   - Controls bar appears ONLY after first tap (anchor or hit)
   - All math comes from backend (/api/score)
   - SEC modal includes Download SEC PNG (with Prev 3 + Avg)
   - Mobile: smaller dots handled by CSS
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");
  const elFileName = $("fileName");
  const elThumbBox = $("thumbBox");
  const elLanding = $("landingCard");

  const elImgBox = $("imgBox");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");

  const elDistance = $("distanceYds");
  const elClick = $("clickValue");

  const elControls = $("controlsBar");
  const elClear = $("clearBtn");
  const elUndo = $("undoBtn");
  const elResults = $("resultsBtn");

  // State
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized
  let hits = [];     // [{x,y}...]

  // Vendor config
  let VENDOR = {
    vendorName: "Baker Printing",
    buyUrl: "https://bakertargets.com",
    surveyUrl: "https://example.com/survey",
    apiBase: "" // set this in vendor.json if you have a Render backend
  };

  async function loadVendor() {
    try {
      const r = await fetch("./vendor.json", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      VENDOR = { ...VENDOR, ...j };
    } catch (_) {}
  }

  // Helpers
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const round2 = (n) => Math.round(n * 100) / 100;

  function clearDots() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  function drawDot(norm, kind) {
    const dot = document.createElement("div");
    dot.className = `tapDot ${kind === "anchor" ? "tapDotAnchor" : "tapDotHit"}`;

    dot.style.left = `${(norm.x * 100).toFixed(4)}%`;
    dot.style.top  = `${(norm.y * 100).toFixed(4)}%`;

    elDots.appendChild(dot);
  }

  function redrawAll() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));

    // Enable/disable buttons (only logical; visibility handled separately)
    const anyTap = !!anchor || hits.length > 0;
    elClear.disabled = !anyTap;
    elUndo.disabled = !anyTap;
    elResults.disabled = !(anchor && hits.length > 0);
  }

  function setThumb(file) {
    elThumbBox.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Selected thumbnail";
    img.src = URL.createObjectURL(file);
    elThumbBox.appendChild(img);
  }

  function getNormFromEvent(evt) {
    const rect = elDots.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: clamp01(x), y: clamp01(y) };
  }

  // Controls show only after first tap
  function updateControlsVisibility() {
    const anyTap = !!anchor || hits.length > 0;
    if (anyTap) elControls.classList.remove("hidden");
    else elControls.classList.add("hidden");
  }

  // Score history (Prev 3 + Avg) stored locally (history is not “math”)
  function readScoreHistory() {
    try {
      const raw = localStorage.getItem("sczn3_score_history_v1");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function pushScoreHistory(score) {
    const hist = readScoreHistory();
    hist.unshift(score);
    const trimmed = hist.slice(0, 4); // current + prev3 (we’ll display prev3 separately)
    localStorage.setItem("sczn3_score_history_v1", JSON.stringify(trimmed));
    return trimmed;
  }

  function computeAvg(arr) {
    if (!arr.length) return 0;
    const s = arr.reduce((a, b) => a + b, 0);
    return Math.round((s / arr.length) * 10) / 10; // 1 decimal
  }

  // Backend call (ALL math)
  async function fetchBackendMath() {
    const apiBase = (VENDOR.apiBase || "").trim();
    const url = (apiBase ? apiBase.replace(/\/+$/, "") : "") + "/api/score";

    const payload = {
      distanceYds: Number(elDistance.value) || 100,
      clickValue: Number(elClick.value) || 0.25,
      anchor,
      hits
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Backend error (${r.status}): ${t || "unknown"}`);
    }

    return r.json();
  }

  // Score color rule
  function scoreClass(score) {
    if (score <= 60) return "scoreRed";
    if (score <= 79) return "scoreYellow";
    return "scoreGreen";
  }

  // Build downloadable SEC PNG (Canvas)
  async function renderSECToPNG(secData, historyLine) {
    // High-res canvas (good for sharing)
    const W = 1400;
    const H = 860;

    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    // Background
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.clearRect(0, 0, W, H);

    // Card
    const x = 60, y = 60, w = W - 120, h = H - 120, r = 44;

    function roundRect(px, py, pw, ph, pr) {
      ctx.beginPath();
      ctx.moveTo(px + pr, py);
      ctx.arcTo(px + pw, py, px + pw, py + ph, pr);
      ctx.arcTo(px + pw, py + ph, px, py + ph, pr);
      ctx.arcTo(px, py + ph, px, py, pr);
      ctx.arcTo(px, py, px + pw, py, pr);
      ctx.closePath();
    }

    // shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    roundRect(x, y, w, h, r);
    ctx.fillStyle = "rgba(18,24,22,0.82)";
    ctx.fill();
    ctx.restore();

    // border
    roundRect(x, y, w, h, r);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Title: SHOOTER (red) EXPERIENCE (white) CARD (blue)
    ctx.font = "900 62px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "top";
    let tx = x + 44, ty = y + 32;

    ctx.fillStyle = "#e53935"; // red
    ctx.fillText("SHOOTER", tx, ty);
    tx += ctx.measureText("SHOOTER").width + 18;

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("EXPERIENCE", tx, ty);
    tx += ctx.measureText("EXPERIENCE").width + 18;

    ctx.fillStyle = "#1e5aa8"; // blue
    ctx.fillText("CARD", tx, ty);

    // Shots (small)
    ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText(`Shots: ${secData.shots}`, x + 44, y + 112);

    // Score label + giant score
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText("Shooter Score", x + 44, y + 170);

    const s = secData.score;
    const sColor = (s <= 60) ? "#ff3b30" : (s <= 79 ? "#ffd60a" : "#34c759");

    ctx.font = "900 180px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = sColor;
    ctx.textAlign = "right";
    ctx.fillText(String(s), x + w - 54, y + 140);
    ctx.textAlign = "left";

    // History line
    ctx.font = "800 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText(historyLine, x + 44, y + 240);

    // Windage/Elevation boxes
    const boxW = w - 88;
    const boxH = 126;
    const boxX = x + 44;
    let boxY = y + 300;

    function drawRow(label, arrow, value, dirLetter) {
      // row background
      roundRect(boxX, boxY, boxW, boxH, 28);
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // left label
      ctx.font = "900 46px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.fillText(label, boxX + 28, boxY + 36);

      // arrow + number + dir
      ctx.textAlign = "right";
      ctx.font = "900 58px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(arrow, boxX + boxW - 280, boxY + 38);

      ctx.font = "900 78px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(value.toFixed(2), boxX + boxW - 88, boxY + 22);

      ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(dirLetter, boxX + boxW - 28, boxY + 44);

      ctx.textAlign = "left";
      boxY += boxH + 22;
    }

    drawRow("Windage Clicks", secData.windageArrow, secData.windageClicks, secData.windageDir);
    drawRow("Elevation Clicks", secData.elevArrow, secData.elevClicks, secData.elevDir);

    // Export PNG
    return new Promise((resolve) => {
      c.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    // iOS Safari sometimes ignores download; opening still lets user save/share
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function buildSECModal(secData, historyLine) {
    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    const card = document.createElement("div");
    card.className = "secCard";

    // Title line (red/white/blue)
    const title = document.createElement("div");
    title.className = "secTitle";
    title.innerHTML = `
      <span class="tRed">SHOOTER</span>
      <span class="tWhite">EXPERIENCE</span>
      <span class="tBlue">CARD</span>
    `;

    const shots = document.createElement("div");
    shots.className = "secShots";
    shots.textContent = `Shots: ${secData.shots}`;

    // Score row
    const scoreRow = document.createElement("div");
    scoreRow.className = "secRow secScoreRow";
    scoreRow.innerHTML = `
      <div class="secLabel">Shooter Score</div>
      <div class="secScoreNum ${scoreClass(secData.score)}">${secData.score}</div>
    `;

    const hist = document.createElement("div");
    hist.className = "secHistory";
    hist.textContent = historyLine;

    // Wind/Elev
    const wind = document.createElement("div");
    wind.className = "secRow";
    wind.innerHTML = `
      <div class="secLabel">Windage Clicks</div>
      <div class="secRight">
        <span class="secArrow">${secData.windageArrow}</span>
        <span class="secValue">${secData.windageClicks.toFixed(2)}</span>
        <span class="secDir">${secData.windageDir}</span>
      </div>
    `;

    const elev = document.createElement("div");
    elev.className = "secRow";
    elev.innerHTML = `
      <div class="secLabel">Elevation Clicks</div>
      <div class="secRight">
        <span class="secArrow">${secData.elevArrow}</span>
        <span class="secValue">${secData.elevClicks.toFixed(2)}</span>
        <span class="secDir">${secData.elevDir}</span>
      </div>
    `;

    // Buttons row (Buy + Survey)
    const actions = document.createElement("div");
    actions.className = "secActions";
    actions.innerHTML = `
      <button class="secBtn" id="secBuyBtn" type="button">Buy more targets</button>
      <button class="secBtn" id="secSurveyBtn" type="button">Survey</button>
    `;

    const dl = document.createElement("button");
    dl.className = "secBtn secBtnPrimary";
    dl.type = "button";
    dl.textContent = "Download SEC";

    const close = document.createElement("button");
    close.className = "secBtn secBtnPrimary";
    close.type = "button";
    close.textContent = "Close";

    card.appendChild(title);
    card.appendChild(shots);
    card.appendChild(scoreRow);
    card.appendChild(hist);
    card.appendChild(wind);
    card.appendChild(elev);
    card.appendChild(actions);
    card.appendChild(dl);
    card.appendChild(close);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Wire buttons
    const buyBtn = $("secBuyBtn");
    const surveyBtn = $("secSurveyBtn");

    buyBtn?.addEventListener("click", () => {
      const u = (VENDOR.buyUrl || "").trim();
      if (u) window.open(u, "_blank");
    });

    surveyBtn?.addEventListener("click", () => {
      const u = (VENDOR.surveyUrl || "").trim();
      if (u) window.open(u, "_blank");
    });

    dl.addEventListener("click", async () => {
      try {
        const blob = await renderSECToPNG(secData, historyLine);
        const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
        downloadBlob(blob, `SEC-${secData.score}-${ts}.png`);
      } catch (e) {
        alert(`Download failed: ${e.message || e}`);
      }
    });

    close.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  async function showSEC() {
    if (!anchor || hits.length === 0) return;

    // get math from backend
    const sec = await fetchBackendMath();

    // update local score history
    const hist = pushScoreHistory(sec.score);
    const prev3 = hist.slice(1, 4);
    const avg = computeAvg(hist);

    const prevText = prev3.length ? prev3.join(", ") : "—";
    const historyLine = `Prev 3: ${prevText}   Avg: ${avg}`;

    buildSECModal(sec, historyLine);
  }

  // Events
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", async () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    // thumbnail
    setThumb(f);

    // main image
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    // reset taps
    anchor = null;
    hits = [];
    redrawAll();
    updateControlsVisibility();

    // show image
    elImgBox.classList.remove("hidden");

    // hide landing thumbnail area once target is shown (your earlier request)
    elLanding.classList.remove("hidden");
    // If you want it fully gone while shooting:
    elLanding.classList.add("secLandingHidden");

    // scroll
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Tapping
  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    if (!anchor) anchor = norm;
    else hits.push(norm);

    redrawAll();
    updateControlsVisibility();
  }, { passive: false });

  elClear.addEventListener("click", () => {
    anchor = null;
    hits = [];
    redrawAll();
    updateControlsVisibility();
  });

  elUndo.addEventListener("click", () => {
    if (hits.length > 0) hits.pop();
    else if (anchor) anchor = null;

    redrawAll();
    updateControlsVisibility();
  });

  elResults.addEventListener("click", async () => {
    try {
      await showSEC();
    } catch (e) {
      alert(e.message || String(e));
    }
  });

  // Init
  loadVendor();
  redrawAll();
  updateControlsVisibility();
})();
