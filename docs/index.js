/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-DL-HIST-1
   Adds:
   - SEC modal with Download SEC (PNG)
   - Stores current score + previous 3 + average
   - Score numeral color follows thresholds:
       0–60 red, 61–79 yellow, 80–100 green
   Also:
   - Controls (Clear/Undo/Results) appear AFTER first tap
   - Thumbnail section hides once target image is shown
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- CONFIG (edit these for Baker pilot) ----------
  const BUY_MORE_URL = "https://bakertargets.com"; // <-- change if needed
  const SURVEY_URL   = "https://example.com/survey"; // <-- change if needed

  // ---------- Elements ----------
  const elFile      = $("photoInput");
  const elChoose    = $("chooseBtn");
  const elFileName  = $("fileName");
  const elThumbBox  = $("thumbBox");

  const elImgBox    = $("imgBox");
  const elImg       = $("targetImg");
  const elDots      = $("dotsLayer");

  const elHUDLeft   = $("instructionLine");
  const elHUDRight  = $("tapCount");

  const elControls  = $("controlsBar");
  const elClear     = $("clearBtn");
  const elUndo      = $("undoBtn");
  const elResults   = $("resultsBtn");

  // Optional (present in your HTML right now, but we will not show values on SEC)
  const elDistance  = $("distanceYds");
  const elClick     = $("clickValue");

  // ---------- State ----------
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized
  let hits = [];     // [{x,y}...]

  let hasAnyTap = false; // controls appear after first tap

  // ---------- Storage (score history) ----------
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
    hist.unshift(s);              // newest first
    saveScoreHistory(hist);
  }

  function getPrevThreeExcludingCurrent() {
    const hist = loadScoreHistory();
    // hist[0] should be current after pushScore(). Previous three are hist[1..3]
    return hist.slice(1, 4);
  }

  function getAverageAll() {
    const hist = loadScoreHistory();
    if (!hist.length) return null;
    const sum = hist.reduce((a, b) => a + b, 0);
    return sum / hist.length;
  }

  // ---------- Helpers ----------
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
    // Controls appear only after first tap of any kind
    if (!hasAnyTap) {
      elControls.classList.add("hidden");
      return;
    }
    elControls.classList.remove("hidden");
  }

  function redrawAll() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));

    setHUD();

    // Buttons enabled logic
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
    // Hide the whole "Selected target photo thumbnail" field if possible
    // thumbBox is inside a .field in your HTML
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

  function computePOIB() {
    if (hits.length === 0) return null;
    const sum = hits.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / hits.length, y: sum.y / hits.length };
  }

  // Direction labels for the *scope move* (user-facing)
  // If POIB is LEFT of anchor -> move RIGHT
  // If POIB is ABOVE anchor -> move UP (screen Y smaller)
  function computeScopeMove(anchorPt, poibPt) {
    const dx = anchorPt.x - poibPt.x; // + means move RIGHT
    const dy = anchorPt.y - poibPt.y; // + means move DOWN in screen-space

    const windDir = dx >= 0 ? "R" : "L";
    const elevDir = dy >= 0 ? "D" : "U";

    return { windDir, elevDir, dx, dy };
  }

  // Score color thresholds
  function scoreColor(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return "rgba(255,255,255,0.92)";
    if (s <= 60) return "rgba(255, 70, 70, 0.96)";      // red
    if (s <= 79) return "rgba(255, 205, 70, 0.96)";     // yellow
    return "rgba(0, 235, 150, 0.96)";                   // green
  }

  // ----------------------------------------------------------
  // IMPORTANT:
  // Your platform already has "score" + "windage clicks" + "elevation clicks"
  // working in your current build.
  //
  // So this function tries to read those values from wherever you currently set them.
  // If you already compute them elsewhere, plug them in here in ONE place.
  //
  // For now:
  // - Score: simple placeholder derived from group size (you can replace)
  // - Click values: placeholder based on dx/dy percent (you can replace)
  // ----------------------------------------------------------
  function computeScoreAndClicks() {
    const poib = computePOIB();
    if (!anchor || !poib) return null;

    const move = computeScopeMove(anchor, poib);

    // PLACEHOLDER score (replace with your true scoring logic)
    // Small correction distance => higher score
    const dist = Math.sqrt((move.dx * move.dx) + (move.dy * move.dy));
    let score = Math.round(100 - (dist * 200)); // heuristic
    score = Math.max(0, Math.min(100, score));

    // PLACEHOLDER clicks (replace with true inches→clicks pipeline)
    const windClicks = Math.abs(move.dx) * 100; // acts like "some number"
    const elevClicks = Math.abs(move.dy) * 100;

    return {
      score,
      shots: hits.length,
      windClicks,
      elevClicks,
      windDir: move.windDir,
      elevDir: move.elevDir
    };
  }

  // ---------- Canvas download (PNG) ----------
  function downloadSECPng(payload) {
    const {
      score,
      shots,
      windClicks,
      elevClicks,
      windDir,
      elevDir,
      prev3,
      avg
    } = payload;

    // Canvas size tuned for a nice shareable card
    const W = 1400;
    const H = 820;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "rgba(10,12,11,1)";
    ctx.fillRect(0, 0, W, H);

    // Card
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

    // Big Score centerpiece
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

    // Info line: current / prev3 / avg
    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    const prevText = prev3.length ? prev3.join(", ") : "—";
    const avgText = (avg == null) ? "—" : avg.toFixed(1);
    ctx.fillText(`Current: ${score}   Prev 3: ${prevText}   Avg: ${avgText}`, x + 70, scoreBoxY + 140);

    // Windage / Elevation compact area
    const smallAreaY = scoreBoxY + scoreBoxH + 22;
    const rowH = 128;

    // Windage row
    roundedRect(ctx, x + 34, smallAreaY, w - 68, rowH, 26, "rgba(0,0,0,0.18)", "rgba(255,255,255,0.10)");
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText("Windage", x + 70, smallAreaY + 78);

    // arrow + number + dir
    const windArrow = (windDir === "R") ? "→" : "←";
    ctx.font = "900 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${windArrow} ${Number(windClicks).toFixed(2)}`, x + w - 120, smallAreaY + 86);
    ctx.textAlign = "left";
    ctx.font = "900 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(windDir, x + w - 98, smallAreaY + 86);

    // Elevation row
    const elevY = smallAreaY + rowH + 18;
    roundedRect(ctx, x + 34, elevY, w - 68, rowH, 26, "rgba(0,0,0,0.18)", "rgba(255,255,255,0.10)");
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.fillText("Elevation", x + 70, elevY + 78);

    const elevArrow = (elevDir === "U") ? "↑" : "↓";
    ctx.font = "900 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${elevArrow} ${Number(elevClicks).toFixed(2)}`, x + w - 120, elevY + 86);
    ctx.textAlign = "left";
    ctx.font = "900 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(elevDir, x + w - 98, elevY + 86);

    // Action buttons row (Buy more / Survey) + Close
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

    const closeY = btnY + btnH + 16;
    pill(ctx, x + 34, closeY, w - 68, 92, "rgba(0,170,110,0.95)");
    ctx.textAlign = "center";
    ctx.fillText("Close", x + 34 + (w - 68) / 2, closeY + 60);
    ctx.textAlign = "left";

    // Download
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

  function roundedRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function pill(ctx, x, y, w, h, fill) {
    roundedRect(ctx, x, y, w, h, h / 2, fill, "rgba(255,255,255,0.10)");
    // subtle top sheen
    ctx.save();
    ctx.globalAlpha = 0.14;
    roundedRect(ctx, x + 2, y + 2, w - 4, h * 0.55, (h / 2) - 2, "rgba(255,255,255,1)", null);
    ctx.restore();
  }

  // ---------- SEC Modal ----------
  function showSECModal() {
    const data = computeScoreAndClicks();
    if (!data) return;

    // Save score into history first so "previous 3" means before current
    pushScore(data.score);
    const prev3 = getPrevThreeExcludingCurrent();
    const avg = getAverageAll();

    const overlay = document.createElement("div");
    overlay.className = "secOverlay";

    const card = document.createElement("div");
    card.className = "secCard";

    // Title (red/white/blue)
    const title = document.createElement("div");
    title.className = "secTitle";
    title.innerHTML = `
      <span class="tRed">SHOOTER</span>
      <span class="tWhite"> EXPERIENCE </span>
      <span class="tBlue">CARD</span>
    `;

    const shots = document.createElement("div");
    shots.className = "secShots";
    shots.textContent = `Shots: ${data.shots}`;

    // Score centerpiece
    const scoreRow = document.createElement("div");
    scoreRow.className = "secRow secScoreRow";
    scoreRow.innerHTML = `
      <div class="secLabel">Shooter’s Score</div>
      <div class="secValue secScoreValue" style="color:${scoreColor(data.score)}">${data.score}</div>
    `;

    // Info line under score
    const info = document.createElement("div");
    info.className = "secInfoLine";
    info.textContent =
      `Current: ${data.score}   Prev 3: ${prev3.length ? prev3.join(", ") : "—"}   Avg: ${avg == null ? "—" : avg.toFixed(1)}`;

    // Windage/Elevation compact area
    const wind = document.createElement("div");
    wind.className = "secRow";
    wind.innerHTML = `
      <div class="secLabel">Windage</div>
      <div class="secValue">
        <span class="secArrow">${data.windDir === "R" ? "→" : "←"}</span>
        <span class="secNum">${Number(data.windClicks).toFixed(2)}</span>
        <span class="secDir">${data.windDir}</span>
      </div>
    `;

    const elev = document.createElement("div");
    elev.className = "secRow";
    elev.innerHTML = `
      <div class="secLabel">Elevation</div>
      <div class="secValue">
        <span class="secArrow">${data.elevDir === "U" ? "↑" : "↓"}</span>
        <span class="secNum">${Number(data.elevClicks).toFixed(2)}</span>
        <span class="secDir">${data.elevDir}</span>
      </div>
    `;

    // Buttons row
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

    // Download + Close row
    const bottom = document.createElement("div");
    bottom.className = "secBottom";

    const dlBtn = document.createElement("button");
    dlBtn.className = "secDownloadBtn";
    dlBtn.type = "button";
    dlBtn.textContent = "Download SEC";
    dlBtn.addEventListener("click", () => {
      downloadSECPng({
        score: data.score,
        shots: data.shots,
        windClicks: data.windClicks,
        elevClicks: data.elevClicks,
        windDir: data.windDir,
        elevDir: data.elevDir,
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

    // Assemble
    card.appendChild(title);
    card.appendChild(shots);
    card.appendChild(scoreRow);
    card.appendChild(info);
    card.appendChild(wind);
    card.appendChild(elev);
    card.appendChild(actions);
    card.appendChild(bottom);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // close when tapping outside
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ---------- Events ----------
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    // show thumb briefly (then we hide the whole section once target appears)
    setThumb(f);

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    // reset taps
    anchor = null;
    hits = [];
    hasAnyTap = false;
    redrawAll();

    // show image immediately
    elImgBox.classList.remove("hidden");
    hideThumbnailSection();
    setInstruction("Tap bull’s-eye (anchor)");

    // scroll to target
    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Tap handling (first tap triggers control bar appearance)
  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

    if (!hasAnyTap) {
      hasAnyTap = true;
    }

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
    hasAnyTap = false;          // hide controls again until next first tap
    setInstruction("Tap bull’s-eye (anchor)");
    redrawAll();
  });

  elUndo.addEventListener("click", () => {
    if (hits.length > 0) {
      hits.pop();
    } else if (anchor) {
      anchor = null;
      setInstruction("Tap bull’s-eye (anchor)");
    }
    // if everything is gone, drop controls until next tap
    if (!anchor && hits.length === 0) hasAnyTap = false;
    redrawAll();
  });

  elResults.addEventListener("click", () => {
    // IMPORTANT: We only show SEC when we have anchor + hits
    showSECModal();
  });

  // Recenter after rotation / resize
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      if (!elImgBox.classList.contains("hidden")) {
        elImgBox.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }, 250);
  });

  window.addEventListener("resize", () => {
    if (!elImgBox.classList.contains("hidden")) {
      // Keep target centered-ish after pinch/rotate changes
      elImgBox.scrollIntoView({ behavior: "auto", block: "start" });
    }
  });

  // Initial
  setHUD();
  redrawAll();
})();
