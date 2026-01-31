 /* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-BACKEND-TRUTH-1
   Rule:
   - ALL math comes from backend (score, clicks, directions).
   Frontend:
   - Collect taps (anchor + hits)
   - POST to backend on Results
   - Render SEC + Download SEC PNG from backend response
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ------------------------------
  // CONFIG: BACKEND URL
  // ------------------------------
  // If your frontend and backend share the same origin, leave "".
  // If backend is on Render (different domain), paste it here:
  //   const BACKEND_URL = "https://YOUR-BACKEND.onrender.com";
  const BACKEND_URL = "";

  // Endpoint preference order (we try first, then fallback)
  const ENDPOINTS = ["/api/calc", "/api/analyze"];

  // Vendor links (Baker pilot)
  const BUY_MORE_URL = "https://bakertargets.com";
  const SURVEY_URL   = "https://example.com/survey";

  // ------------------------------
  // Elements
  // ------------------------------
  const elFile     = $("photoInput");
  const elChoose   = $("chooseBtn");
  const elFileName = $("fileName");
  const elThumbBox = $("thumbBox");

  const elImgBox   = $("imgBox");
  const elImg      = $("targetImg");
  const elDots     = $("dotsLayer");

  const elDistance = $("distanceYds");  // hidden on SEC, but still useful for backend
  const elClick    = $("clickValue");   // hidden on SEC, but still useful for backend

  const elHUDLeft  = $("instructionLine");
  const elHUDRight = $("tapCount");

  const elControls = $("controlsBar");
  const elClear    = $("clearBtn");
  const elUndo     = $("undoBtn");
  const elResults  = $("resultsBtn");

  // ------------------------------
  // State
  // ------------------------------
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized
  let hits = [];     // [{x,y}...]

  let hasAnyTap = false; // controls appear after first tap

  // ------------------------------
  // Score history (display only; math stays backend)
  // ------------------------------
  const SCORE_KEY = "sczn3_score_history_v1";

  function loadScoreHistory() {
    try {
      const raw = localStorage.getItem(SCORE_KEY);
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr.filter((n) => Number.isFinite(Number(n))).map(Number) : [];
    } catch {
      return [];
    }
  }

  function saveScoreHistory(arr) {
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(arr.slice(0, 50))); } catch {}
  }

  function pushScore(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return;
    const hist = loadScoreHistory();
    hist.unshift(s);
    saveScoreHistory(hist);
  }

  function getPrevThreeExcludingCurrent() {
    const hist = loadScoreHistory();
    return hist.slice(1, 4);
  }

  function getAverageAll() {
    const hist = loadScoreHistory();
    if (!hist.length) return null;
    const sum = hist.reduce((a, b) => a + b, 0);
    return sum / hist.length;
  }

  // ------------------------------
  // UI helpers
  // ------------------------------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setHUD() {
    elHUDRight.textContent = `Taps: ${(anchor ? 1 : 0) + hits.length} (hits: ${hits.length})`;
  }

  function setInstruction(msg) {
    elHUDLeft.textContent = msg;
  }

  function clearDots() {
    while (elDots.firstChild) elDots.removeChild(elDots.firstChild);
  }

  function drawDot(norm, kind) {
    const dot = document.createElement("div");
    dot.className = "tapDot";
    const size = kind === "anchor" ? 18 : 16;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${(norm.x * 100).toFixed(4)}%`;
    dot.style.top  = `${(norm.y * 100).toFixed(4)}%`;
    dot.style.background = (kind === "anchor")
      ? "rgba(255, 196, 0, 0.95)"
      : "rgba(0, 220, 130, 0.95)";
    elDots.appendChild(dot);
  }

  function showControlsIfNeeded() {
    if (!hasAnyTap) elControls.classList.add("hidden");
    else elControls.classList.remove("hidden");
  }

  function redrawAll() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));

    setHUD();

    elClear.disabled   = (!anchor && hits.length === 0);
    elUndo.disabled    = (!anchor && hits.length === 0);
    elResults.disabled = (!anchor || hits.length === 0);

    showControlsIfNeeded();
  }

  function setThumb(file) {
    elThumbBox.innerHTML = "";
    const img = document.createElement("img");
    img.alt = "Selected thumbnail";
    img.src = URL.createObjectURL(file);
    elThumbBox.appendChild(img);
  }

  function hideThumbnailSection() {
    const field = elThumbBox ? elThumbBox.closest(".field") : null;
    if (field) field.classList.add("hidden");
  }

  function getNormFromEvent(evt) {
    const rect = elDots.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: clamp01(x), y: clamp01(y) };
  }

  // ------------------------------
  // Display-only score color
  // ------------------------------
  function scoreColor(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return "rgba(255,255,255,0.92)";
    if (s <= 60) return "rgba(255, 70, 70, 0.96)";
    if (s <= 79) return "rgba(255, 205, 70, 0.96)";
    return "rgba(0, 235, 150, 0.96)";
  }

  // ------------------------------
  // Backend call (truth)
  // ------------------------------
  async function postJSON(url, bodyObj) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
      cache: "no-store"
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      const msg = (json && (json.error || json.message)) ? (json.error || json.message) : text;
      throw new Error(msg || `HTTP ${res.status}`);
    }
    if (!json) throw new Error("Backend did not return JSON.");
    return json;
  }

  async function fetchBackendTruth(payload) {
    // Try endpoints in order
    let lastErr = null;

    for (const ep of ENDPOINTS) {
      const url = `${BACKEND_URL}${ep}`;
      try {
        const data = await postJSON(url, payload);
        return data;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Backend call failed.");
  }

  // Payload we send to backend
  function buildPayload() {
    const distanceYds = elDistance ? Number(elDistance.value) : 100;
    const clickValue  = elClick ? Number(elClick.value) : 0.25;

    return {
      distanceYds: Number.isFinite(distanceYds) ? distanceYds : 100,
      clickValue: Number.isFinite(clickValue) ? clickValue : 0.25,
      anchor, // {x,y} normalized 0..1
      hits,   // [{x,y}...] normalized 0..1
      shots: hits.length,
      // optional context (harmless if backend ignores)
      client: { app: "tap-n-score", ver: "vSEC-BACKEND-TRUTH-1" }
    };
  }

  // ------------------------------
  // SEC modal + Download (PNG)
  // ------------------------------
  function roundedRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function pill(ctx, x, y, w, h, fill) {
    roundedRect(ctx, x, y, w, h, h / 2, fill, "rgba(255,255,255,0.10)");
    ctx.save();
    ctx.globalAlpha = 0.14;
    roundedRect(ctx, x + 2, y + 2, w - 4, h * 0.55, (h / 2) - 2, "rgba(255,255,255,1)", null);
    ctx.restore();
  }

  function normalizeDirLetter(dir) {
    // backend may return "RIGHT"/"LEFT"/"UP"/"DOWN" or "R/L/U/D"
    const d = String(dir || "").toUpperCase().trim();
    if (d === "RIGHT") return "R";
    if (d === "LEFT")  return "L";
    if (d === "UP")    return "U";
    if (d === "DOWN")  return "D";
    if (["R","L","U","D"].includes(d)) return d;
    return d ? d[0] : "?";
  }

  function arrowForDir(letter) {
    if (letter === "R") return "→";
    if (letter === "L") return "←";
    if (letter === "U") return "↑";
    if (letter === "D") return "↓";
    return "•";
  }

  function downloadSECPng(payload) {
    const {
      score,
      shots,
      windClicks,
      windDir,
      elevClicks,
      elevDir,
      prev3,
      avg
    } = payload;

    const W = 1400;
    const H = 820;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "rgba(10,12,11,1)";
    ctx.fillRect(0, 0, W, H);

    const pad = 44;
    const x = pad, y = pad, w = W - pad * 2, h = H - pad * 2;

    roundedRect(ctx, x, y, w, h, 34, "rgba(24,28,26,0.92)", "rgba(255,255,255,0.10)");

    // Title: red/white/blue
    const titleY = y + 78;
    ctx.font = "900 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "alphabetic";

    const t1 = "SHOOTER";
    const t2 = " EXPERIENCE ";
    const t3 = "CARD";

    let tx = x + 44;

    ctx.fillStyle = "rgba(255,70,70,0.95)";
    ctx.fillText(t1, tx, titleY);
    tx += ctx.measureText(t1).width;

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(t2, tx, titleY);
    tx += ctx.measureText(t2).width;

    ctx.fillStyle = "rgba(70,140,255,0.95)";
    ctx.fillText(t3, tx, titleY);

    // Shots
    ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(`Shots: ${shots}`, x + 44, titleY + 54);

    // Score centerpiece
    const scoreBoxY = y + 170;
    const scoreBoxH = 160;
    roundedRect(ctx, x + 34, scoreBoxY, w - 68, scoreBoxH, 28, "rgba(0,0,0,0.20)", "rgba(255,255,255,0.10)");

    ctx.font = "900 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Shooter’s Score", x + 70, scoreBoxY + 64);

    ctx.font = "900 118px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColor(score);
    ctx.textAlign = "right";
    ctx.fillText(String(score), x + w - 70, scoreBoxY + 120);
    ctx.textAlign = "left";

    // Current / Prev3 / Avg
    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    const prevText = prev3.length ? prev3.join(", ") : "—";
    const avgText = (avg == null) ? "—" : avg.toFixed(1);
    ctx.fillText(`Current: ${score}   Prev 3: ${prevText}   Avg: ${avgText}`, x + 70, scoreBoxY + 140);

    // Windage/Elevation compact area
    const smallAreaY = scoreBoxY + scoreBoxH + 22;
    const rowH = 128;

    const wDir = normalizeDirLetter(windDir);
    const eDir = normalizeDirLetter(elevDir);

    // Windage row
    roundedRect(ctx, x + 34, smallAreaY, w - 68, rowH, 26, "rgba(0,0,0,0.18)", "rgba(255,255,255,0.10)");
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText("Windage", x + 70, smallAreaY + 78);

    ctx.font = "900 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${arrowForDir(wDir)} ${Number(windClicks).toFixed(2)}`, x + w - 120, smallAreaY + 86);
    ctx.textAlign = "left";
    ctx.font = "900 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(wDir, x + w - 98, smallAreaY + 86);

    // Elevation row
    const elevY = smallAreaY + rowH + 18;
    roundedRect(ctx, x + 34, elevY, w - 68, rowH, 26, "rgba(0,0,0,0.18)", "rgba(255,255,255,0.10)");
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText("Elevation", x + 70, elevY + 78);

    ctx.font = "900 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${arrowForDir(eDir)} ${Number(elevClicks).toFixed(2)}`, x + w - 120, elevY + 86);
    ctx.textAlign = "left";
    ctx.font = "900 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(eDir, x + w - 98, elevY + 86);

    // Action buttons row
    const btnY = elevY + rowH + 26;
    const btnH = 86;
    const gap = 18;
    const btnW = (w - 68 - gap) / 2;

    pill(ctx, x + 34, btnY, btnW, btnH, "rgba(0,170,110,0.95)");
    pill(ctx, x + 34 + btnW + gap, btnY, btnW, btnH, "rgba(0,170,110,0.95)");

    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.textAlign = "center";
    ctx.fillText("Buy more targets", x + 34 + btnW / 2, btnY + 56);
    ctx.fillText("Survey", x + 34 + btnW + gap + btnW / 2, btnY + 56);
    ctx.textAlign = "left";

    // Close button look
    const closeY = btnY + btnH + 16;
    pill(ctx, x + 34, closeY, w - 68, 92, "rgba(0,170,110,0.95)");
    ctx.textAlign = "center";
    ctx.fillText("Close", x + 34 + (w - 68) / 2, closeY + 60);
    ctx.textAlign = "left";

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SEC_score_${score}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, "image/png");
  }

  function showSECModalFromBackend(truth) {
    // We accept a few shapes — we normalize what we need.
    // Expected (ideal):
    // {
    //   score: 87,
    //   shots: 5,
    //   windage: { clicks: 1.25, dir: "R" },
    //   elevation:{ clicks: 0.50, dir: "U" }
    // }
    const score = Number(truth.score);
    const shots = Number(truth.shots ?? truth.shotCount ?? hits.length);

    const windObj = truth.windage || truth.wind || {};
    const elevObj = truth.elevation || truth.elev || {};

    const windClicks = Number(windObj.clicks ?? truth.windClicks ?? truth.windageClicks);
    const elevClicks = Number(elevObj.clicks ?? truth.elevClicks ?? truth.elevationClicks);

    const windDir = windObj.dir ?? truth.windDir ?? truth.windageDir;
    const elevDir = elevObj.dir ?? truth.elevDir ?? truth.elevationDir;

    if (!Number.isFinite(score)) throw new Error("Backend did not return a valid score.");
    if (!Number.isFinite(windClicks) || !Number.isFinite(elevClicks)) {
      throw new Error("Backend did not return valid click numbers.");
    }

    // Update history (display only)
    pushScore(score);
    const prev3 = getPrevThreeExcludingCurrent();
    const avg = getAverageAll();

    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    const card = document.createElement("div");
    card.className = "secCard";

    const title = document.createElement("div");
    title.className = "secTitle";
    title.innerHTML = `
      <span class="tRed">SHOOTER</span>
      <span class="tWhite"> EXPERIENCE </span>
      <span class="tBlue">CARD</span>
    `;

    const shotsLine = document.createElement("div");
    shotsLine.className = "secShots";
    shotsLine.textContent = `Shots: ${Number.isFinite(shots) ? shots : hits.length}`;

    const scoreRow = document.createElement("div");
    scoreRow.className = "secRow secScoreRow";
    scoreRow.innerHTML = `
      <div class="secLabel">Shooter’s Score</div>
      <div class="secValue secScoreValue" style="color:${scoreColor(score)}">${score}</div>
    `;

    const info = document.createElement("div");
    info.className = "secInfoLine";
    info.textContent =
      `Current: ${score}   Prev 3: ${prev3.length ? prev3.join(", ") : "—"}   Avg: ${avg == null ? "—" : avg.toFixed(1)}`;

    const wDir = normalizeDirLetter(windDir);
    const eDir = normalizeDirLetter(elevDir);

    const wind = document.createElement("div");
    wind.className = "secRow";
    wind.innerHTML = `
      <div class="secLabel">Windage</div>
      <div class="secValue">
        <span class="secArrow">${arrowForDir(wDir)}</span>
        <span class="secNum">${Number(windClicks).toFixed(2)}</span>
        <span class="secDir">${wDir}</span>
      </div>
    `;

    const elev = document.createElement("div");
    elev.className = "secRow";
    elev.innerHTML = `
      <div class="secLabel">Elevation</div>
      <div class="secValue">
        <span class="secArrow">${arrowForDir(eDir)}</span>
        <span class="secNum">${Number(elevClicks).toFixed(2)}</span>
        <span class="secDir">${eDir}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "secActions";

    const buyBtn = document.createElement("button");
    buyBtn.className = "secActionBtn";
    buyBtn.type = "button";
    buyBtn.textContent = "Buy more targets";
    buyBtn.addEventListener("click", () => window.open(BUY_MORE_URL, "_blank", "noopener,noreferrer"));

    const surveyBtn = document.createElement("button");
    surveyBtn.className = "secActionBtn";
    surveyBtn.type = "button";
    surveyBtn.textContent = "Survey";
    surveyBtn.addEventListener("click", () => window.open(SURVEY_URL, "_blank", "noopener,noreferrer"));

    actions.appendChild(buyBtn);
    actions.appendChild(surveyBtn);

    const bottom = document.createElement("div");
    bottom.className = "secBottom";

    const dlBtn = document.createElement("button");
    dlBtn.className = "secDownloadBtn";
    dlBtn.type = "button";
    dlBtn.textContent = "Download SEC";
    dlBtn.addEventListener("click", () => {
      downloadSECPng({
        score,
        shots: Number.isFinite(shots) ? shots : hits.length,
        windClicks,
        windDir: wDir,
        elevClicks,
        elevDir: eDir,
        prev3,
        avg
      });
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "secCloseBtn";
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => overlay.remove());

    bottom.appendChild(dlBtn);
    bottom.appendChild(closeBtn);

    card.appendChild(title);
    card.appendChild(shotsLine);
    card.appendChild(scoreRow);
    card.appendChild(info);
    card.appendChild(wind);
    card.appendChild(elev);
    card.appendChild(actions);
    card.appendChild(bottom);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ------------------------------
  // Events
  // ------------------------------
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    setThumb(f);

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    anchor = null;
    hits = [];
    hasAnyTap = false;
    redrawAll();

    elImgBox.classList.remove("hidden");
    hideThumbnailSection();

    setInstruction("Tap bull’s-eye (anchor)");
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    if (!hasAnyTap) hasAnyTap = true;

    if (!anchor) {
      anchor = norm;
      setInstruction("Now tap each confirmed hit");
    } else {
      hits.push(norm);
    }
    redrawAll();
  }, { passive: false });

  elClear.addEventListener("click", () => {
    anchor = null;
    hits = [];
    hasAnyTap = false;
    setInstruction("Tap bull’s-eye (anchor)");
    redrawAll();
  });

  elUndo.addEventListener("click", () => {
    if (hits.length > 0) hits.pop();
    else if (anchor) {
      anchor = null;
      setInstruction("Tap bull’s-eye (anchor)");
    }
    if (!anchor && hits.length === 0) hasAnyTap = false;
    redrawAll();
  });

  elResults.addEventListener("click", async () => {
    if (!anchor || hits.length === 0) return;

    elResults.disabled = true;
    setInstruction("Computing…");

    const payload = buildPayload();

    try {
      const truth = await fetchBackendTruth(payload);
      setInstruction("Results ready");
      showSECModalFromBackend(truth);
    } catch (e) {
      console.error(e);
      alert(`Backend error: ${e.message || e}`);
      setInstruction("Backend error");
    } finally {
      elResults.disabled = false;
    }
  });

  // Recenter after rotation / resize
  function recenterIfVisible() {
    if (!elImgBox.classList.contains("hidden")) {
      elImgBox.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }

  window.addEventListener("orientationchange", () => setTimeout(recenterIfVisible, 250));
  window.addEventListener("resize", () => setTimeout(recenterIfVisible, 60));

  // Initial
  setHUD();
  redrawAll();
})();  
/* ============================================================
   Service Worker Register (LOCKED for /docs GitHub Pages)
   - Ensures correct scope under /tap-n-score/
   - Forces immediate control after update
============================================================ */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });

      // If a new SW is waiting, activate it immediately
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

      // If an update is found, when installed -> activate it
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      // When controller changes, reload once so newest assets are live
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    } catch (err) {
      // silent on purpose — SW is a bonus, app still runs
    }
  });
}
