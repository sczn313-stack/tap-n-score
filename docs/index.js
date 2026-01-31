/* ============================================================
   index.js (FULL REPLACEMENT) — vSEC-SCOREIMG-1
   - Results modal IS the SEC
   - Shooter Score is an IMAGE (SVG data URL)
   - Previous 3 + Average remain (localStorage)
   - SEC layout: LEFT content, RIGHT intentionally blank
   - CTAs smaller and kept on LEFT only
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- Vendor hook ----------
  const VENDOR_NAME = "Baker Printing";
  const VENDOR_URL = "https://example.com"; // <-- replace with Baker link

  // Elements
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");
  const elFileName = $("fileName");
  const elThumbBox = $("thumbBox");

  const elImgBox = $("imgBox");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");

  const elDistance = $("distanceYds");
  const elClick = $("clickValue");

  const elHUDLeft = $("instructionLine");
  const elHUDRight = $("tapCount");

  const elControls = $("controlsBar");
  const elClear = $("clearBtn");
  const elUndo = $("undoBtn");
  const elResults = $("resultsBtn");

  // State
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized
  let hits = [];     // [{x,y}...]

  // ---------- Helpers ----------
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function setHUD() {
    elHUDRight.textContent = `Taps: ${(anchor ? 1 : 0) + hits.length} (hits: ${hits.length})`;
  }
  function setInstruction(msg) { elHUDLeft.textContent = msg; }

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

  function redrawAll() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));

    setHUD();

    elClear.disabled = (!anchor && hits.length === 0);
    elUndo.disabled  = (!anchor && hits.length === 0);
    elResults.disabled = (!anchor || hits.length === 0);
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

  function computePOIB() {
    if (hits.length === 0) return null;
    const sum = hits.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / hits.length, y: sum.y / hits.length };
  }

  function directionText(anchorPt, poibPt) {
    // POIB -> Anchor (bull - poib)
    const dx = anchorPt.x - poibPt.x;
    const dy = anchorPt.y - poibPt.y; // screen truth: down is +

    const horizDir = dx >= 0 ? "RIGHT" : "LEFT";
    const vertDir  = dy >= 0 ? "DOWN" : "UP";

    return {
      horizDir,
      vertDir,
      horizPct: Math.abs(dx) * 100,
      vertPct:  Math.abs(dy) * 100
    };
  }

  // ---------- Score logic (0..100) ----------
  function computeShooterScore() {
    if (hits.length < 1) return { score: 0, tier: "red" };

    const poib = computePOIB();
    if (!poib) return { score: 0, tier: "red" };

    // avg distance from POIB (normalized)
    const avgDist = hits.reduce((acc, h) => {
      const dx = h.x - poib.x;
      const dy = h.y - poib.y;
      return acc + Math.sqrt(dx*dx + dy*dy);
    }, 0) / hits.length;

    // Map avgDist 0.00 => 100, avgDist 0.20 => ~0
    const norm = Math.max(0, Math.min(1, avgDist / 0.20));
    const score = Math.round((1 - norm) * 100);

    // thresholds you gave: 33/66/100
    let tier = "red";
    if (score >= 67) tier = "green";
    else if (score >= 34) tier = "yellow";

    return { score, tier };
  }

  function loadScoreHistory() {
    try {
      const arr = JSON.parse(localStorage.getItem("sczn3_score_history") || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveScoreHistory(arr) {
    localStorage.setItem("sczn3_score_history", JSON.stringify(arr.slice(0, 25)));
  }

  function pushScore(score) {
    const arr = loadScoreHistory();
    arr.unshift({ score, ts: Date.now() });
    saveScoreHistory(arr);
    return arr;
  }

  function getPrevThree(arr) {
    const prev = arr.slice(1, 4).map((x) => x.score);
    while (prev.length < 3) prev.push(null);
    return prev;
  }

  function calcAverage(arr, count = 10) {
    const sample = arr.slice(0, count).map((x) => x.score).filter((n) => Number.isFinite(n));
    if (!sample.length) return null;
    const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
    return Math.round(avg);
  }

  // ---------- Score IMAGE (SVG → data URL) ----------
  function getTierColors(tier) {
    if (tier === "green") {
      return {
        ring: "rgba(0,220,130,0.95)",
        glow: "rgba(0,220,130,0.35)"
      };
    }
    if (tier === "yellow") {
      return {
        ring: "rgba(255,208,60,0.95)",
        glow: "rgba(255,208,60,0.35)"
      };
    }
    return {
      ring: "rgba(255,70,70,0.95)",
      glow: "rgba(255,70,70,0.35)"
    };
  }

  function scoreSvgDataUrl(score, tier) {
    const { ring, glow } = getTierColors(tier);

    // keep it crisp and consistent
    const w = 340;
    const h = 120;

    const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="glow" x="-40%" y="-80%" width="180%" height="260%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0.22)"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" rx="22" fill="url(#bg)" stroke="rgba(255,255,255,0.12)"/>

  <rect x="14" y="14" width="${w-28}" height="${h-28}" rx="18"
        fill="rgba(0,0,0,0.22)"
        stroke="${ring}" stroke-width="3"
        filter="url(#glow)"/>

  <text x="24" y="44"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="14" font-weight="900"
        fill="rgba(255,255,255,0.82)" letter-spacing="1.2">
    SHOOTER SCORE
  </text>

  <text x="${w/2}" y="92"
        text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="64" font-weight="1000"
        fill="${ring}">
    ${score}
  </text>

  <rect x="${w-96}" y="20" width="72" height="24" rx="12"
        fill="${glow}" stroke="rgba(255,255,255,0.10)"/>
  <text x="${w-60}" y="38" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="12" font-weight="900"
        fill="rgba(0,0,0,0.75)">
    ${tier.toUpperCase()}
  </text>
</svg>`;

    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // ---------- Survey ----------
  function getSessionId() {
    const k = "sczn3_session_id";
    let v = localStorage.getItem(k);
    if (!v) {
      v = `SEC-${Math.random().toString(16).slice(2)}-${Date.now()}`;
      localStorage.setItem(k, v);
    }
    return v;
  }

  function logSurvey(payload) {
    const record = {
      ts: new Date().toISOString(),
      session: getSessionId(),
      vendor: VENDOR_NAME,
      distanceYds: Number(elDistance?.value || 100),
      clickValue: Number(elClick?.value || 0.25),
      hits: hits.length,
      ...payload
    };

    console.log("[SURVEY]", record);

    const key = "sczn3_survey_log";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(record);
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function openSurveyOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "surveyOverlay";

    const card = document.createElement("div");
    card.className = "surveyCard";

    const title = document.createElement("div");
    title.className = "surveyTitle";
    title.textContent = "10 seconds";

    const helper = document.createElement("div");
    helper.className = "surveyHelper";
    helper.textContent = "This helps improve your shooter experience.";

    const question = document.createElement("div");
    question.className = "surveyQuestion";
    question.textContent = "Did this help you understand your next adjustment?";

    const btnRow = document.createElement("div");
    btnRow.className = "surveyBtnRow";

    const yesBtn = document.createElement("button");
    yesBtn.className = "surveyBtn surveyBtnYes";
    yesBtn.type = "button";
    yesBtn.textContent = "✅ Yes";

    const noBtn = document.createElement("button");
    noBtn.className = "surveyBtn surveyBtnNo";
    noBtn.type = "button";
    noBtn.textContent = "❌ Not yet";

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);

    const notNow = document.createElement("button");
    notNow.className = "surveyNotNow";
    notNow.type = "button";
    notNow.textContent = "Not now";

    const reasonsWrap = document.createElement("div");
    reasonsWrap.className = "surveyReasons hidden";

    const reasonsTitle = document.createElement("div");
    reasonsTitle.className = "surveyReasonsTitle";
    reasonsTitle.textContent = "What was missing? (tap one)";

    const reasonsGrid = document.createElement("div");
    reasonsGrid.className = "surveyReasonsGrid";

    const reasons = [
      "Direction felt wrong",
      "Numbers didn’t make sense",
      "Tapping was hard / clunky",
      "The photo didn’t line up",
      "Other"
    ];

    reasons.forEach((label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "surveyReasonBtn";
      b.textContent = label;

      b.addEventListener("click", () => {
        logSurvey({ q: "helped_next_adjustment", a: "not_yet", reason: label });
        card.innerHTML = `
          <div class="surveyTitle">Got it.</div>
          <div class="surveyHelper">That helps us improve the shooter experience.</div>
        `;
        setTimeout(() => overlay.remove(), 900);
      });

      reasonsGrid.appendChild(b);
    });

    reasonsWrap.appendChild(reasonsTitle);
    reasonsWrap.appendChild(reasonsGrid);

    yesBtn.addEventListener("click", () => {
      logSurvey({ q: "helped_next_adjustment", a: "yes" });
      card.innerHTML = `
        <div class="surveyTitle">Perfect.</div>
        <div class="surveyHelper">Glad it helped. See you next range trip.</div>
      `;
      setTimeout(() => overlay.remove(), 900);
    });

    noBtn.addEventListener("click", () => {
      reasonsWrap.classList.remove("hidden");
      btnRow.classList.add("hidden");
      notNow.classList.remove("hidden");
    });

    notNow.addEventListener("click", () => {
      logSurvey({ q: "helped_next_adjustment", a: "skipped" });
      overlay.remove();
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    card.appendChild(title);
    card.appendChild(helper);
    card.appendChild(question);
    card.appendChild(btnRow);
    card.appendChild(reasonsWrap);
    card.appendChild(notNow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    notNow.classList.remove("hidden");
  }

  // ---------- SEC modal ----------
  function showSecModal() {
    const poib = computePOIB();
    if (!anchor || !poib) return;

    const dist = Number(elDistance.value) || 100;
    const clickVal = Number(elClick.value) || 0.25;
    const oneMOAin = (dist / 100) * 1.047;

    const dir = directionText(anchor, poib);

    // Score + history
    const { score, tier } = computeShooterScore();
    const hist = pushScore(score);
    const prev3 = getPrevThree(hist);
    const avg = calcAverage(hist, 10);

    const overlay = document.createElement("div");
    overlay.className = "resultsOverlay";

    const card = document.createElement("div");
    card.className = "resultsCard";

    const grid = document.createElement("div");
    grid.className = "secGrid";

    const left = document.createElement("div");
    left.className = "secLeft";

    const right = document.createElement("div");
    right.className = "secRight";

    // Header: Shooter Experience Card (darker blue)
    const header = document.createElement("div");
    header.className = "secHeader";
    header.innerHTML = `
      <div class="secHeaderTop">
        <span class="secWordRed">SHOOTER</span>
        <span class="secWordWhite"> EXPERIENCE </span>
        <span class="secWordBlue">CARD</span>
      </div>
      <div class="secHeaderSub">Tap-n-Score™</div>
    `;

    // Adjust block
    const adjust = document.createElement("div");
    adjust.className = "secAdjust";
    adjust.innerHTML = `
      <div class="secAdjustTitle">Adjust</div>
      <div class="secAdjustRow">
        <div class="secAdjustItem">
          <div class="secAdjustNum">${dir.horizPct.toFixed(2)}</div>
          <div class="secAdjustLbl">${dir.horizDir}</div>
        </div>
        <div class="secAdjustItem">
          <div class="secAdjustNum">${dir.vertPct.toFixed(2)}</div>
          <div class="secAdjustLbl">${dir.vertDir}</div>
        </div>
      </div>
      <div class="secAdjustNote">(% until grid calibration converts to inches + clicks)</div>
    `;

    // Score block (IMAGE)
    const scoreBox = document.createElement("div");
    scoreBox.className = "secScoreBox";

    const scoreImg = document.createElement("img");
    scoreImg.className = "secScoreImg";
    scoreImg.alt = `Shooter Score ${score}`;
    scoreImg.src = scoreSvgDataUrl(score, tier);

    scoreBox.innerHTML = `<div class="secScoreTitle">Shooter Score</div>`;
    scoreBox.appendChild(scoreImg);

    const meta = document.createElement("div");
    meta.className = "secScoreMeta";
    meta.innerHTML = `
      <div class="secScoreLine">
        <span class="secScoreKey">Previous 3:</span>
        <span class="secScoreVal">${prev3.map((n) => (n === null ? "—" : n)).join("  ·  ")}</span>
      </div>
      <div class="secScoreLine">
        <span class="secScoreKey">Average:</span>
        <span class="secScoreVal">${avg === null ? "—" : avg}</span>
      </div>
    `;
    scoreBox.appendChild(meta);

    // Details (small)
    const details = document.createElement("div");
    details.className = "secDetails";
    details.textContent =
`Hits: ${hits.length}
Distance: ${dist} yd
Click: ${clickVal} MOA
1 MOA ≈ ${oneMOAin.toFixed(3)}"`;

    // Small CTAs (left only)
    const ctaRow = document.createElement("div");
    ctaRow.className = "resultsCtaRow";

    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "resultsCtaBtn";
    buyBtn.innerHTML = `<span class="ctaTop">BUY MORE</span><br/><span class="ctaBottom">Targets Like This</span>`;
    buyBtn.addEventListener("click", () => window.open(VENDOR_URL, "_blank", "noopener,noreferrer"));

    const surveyBtn = document.createElement("button");
    surveyBtn.type = "button";
    surveyBtn.className = "resultsCtaBtn";
    surveyBtn.innerHTML = `<span class="ctaTop">SURVEY</span><br/><span class="ctaBottom">10 seconds</span>`;
    surveyBtn.addEventListener("click", () => openSurveyOverlay());

    ctaRow.appendChild(buyBtn);
    ctaRow.appendChild(surveyBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btnResults";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => overlay.remove());

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    left.appendChild(header);
    left.appendChild(adjust);
    left.appendChild(scoreBox);
    left.appendChild(details);
    left.appendChild(ctaRow);
    left.appendChild(closeBtn);

    grid.appendChild(left);
    grid.appendChild(right);

    card.appendChild(grid);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ---------- Events ----------
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
    redrawAll();

    elImgBox.classList.remove("hidden");
    elControls.classList.remove("hidden");
    setInstruction("Tap bull’s-eye (anchor)");

    // Hide thumbnail when target is on screen
    elThumbBox.classList.add("hidden");

    elImgBox.scrollIntoView({ behavior: "smooth", block: "start" });

    elFile.value = "";
  });

  elDots.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const norm = getNormFromEvent(evt);
    if (!norm) return;

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
    redrawAll();
  });

  elResults.addEventListener("click", () => showSecModal());

  setHUD();
  redrawAll();
})();
