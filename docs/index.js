/* ============================================================
   index.js (FULL REPLACEMENT) — SEC-LOCK-2
   Step 2:
   - Add score history: previous 3 + cumulative avg + count
   - Backend provides score/clicks/shots
   - We store ONLY returned scores locally for display
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Pages
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSec = $("pageSec");

  // Landing
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");
  const elFileName = $("fileName");

  // Tap
  const imgBox = $("imgBox");
  const targetImg = $("targetImg");
  const dotsLayer = $("dotsLayer");

  const controlsBar = $("controlsBar");
  const clearBtn = $("clearBtn");
  const undoBtn = $("undoBtn");
  const resultsBtn = $("resultsBtn");

  // SEC
  const secSessionId = $("secSessionId");
  const scoreHero = $("scoreHero");
  const clickUp = $("clickUp");
  const clickDown = $("clickDown");
  const clickLeft = $("clickLeft");
  const clickRight = $("clickRight");
  const shotsCount = $("shotsCount");

  // History (Step 2)
  const prev1 = $("prev1");
  const prev2 = $("prev2");
  const prev3 = $("prev3");
  const avgScore = $("avgScore");
  const scoreCount = $("scoreCount");

  const downloadSecBtn = $("downloadSecBtn");
  const surveyBtn = $("surveyBtn");
  const secCanvas = $("secCanvas");

  // State
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y}
  let hits = [];     // [{x,y}...]

  let controlsShown = false;

  // Local score history store
  const HISTORY_KEY = "sczn3_score_history_v1";
  const HISTORY_MAX = 50;

  // ------------ Helpers ------------
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function showPage(which) {
    pageLanding.classList.add("hidden");
    pageTap.classList.add("hidden");
    pageSec.classList.add("hidden");

    which.classList.remove("hidden");
    requestAnimationFrame(() => {
      which.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }

  function scoreColorCss(scoreNum) {
    if (!Number.isFinite(scoreNum)) return "rgba(255,255,255,0.92)";
    if (scoreNum <= 60) return "rgba(255, 70, 70, 0.98)";
    if (scoreNum <= 79) return "rgba(255, 208, 70, 0.98)";
    return "rgba(0, 235, 150, 0.98)";
  }

  function setScore(scoreNum) {
    if (!Number.isFinite(scoreNum)) {
      scoreHero.textContent = "—";
      scoreHero.style.color = "rgba(255,255,255,0.92)";
      return;
    }
    const s = Math.round(scoreNum);
    scoreHero.textContent = String(s);
    scoreHero.style.color = scoreColorCss(s);
  }

  function setClicks({ up, down, left, right }) {
    clickUp.textContent = (Number(up) || 0).toFixed(2);
    clickDown.textContent = (Number(down) || 0).toFixed(2);
    clickLeft.textContent = (Number(left) || 0).toFixed(2);
    clickRight.textContent = (Number(right) || 0).toFixed(2);
  }

  function clearDots() {
    while (dotsLayer.firstChild) dotsLayer.removeChild(dotsLayer.firstChild);
  }

  function drawDot(p, kind) {
    const d = document.createElement("div");
    d.className = "tapDot";

    // smaller dots for phones
    const size = (kind === "anchor") ? 12 : 10;
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;

    d.style.left = `${(p.x * 100).toFixed(4)}%`;
    d.style.top  = `${(p.y * 100).toFixed(4)}%`;

    d.style.background = (kind === "anchor")
      ? "rgba(255, 196, 0, 0.95)"
      : "rgba(0, 220, 130, 0.95)";

    dotsLayer.appendChild(d);
  }

  function redraw() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));
  }

  function showControlsIfNeeded() {
    if (controlsShown) return;
    controlsShown = true;
    controlsBar.classList.remove("hidden");
    clearBtn.disabled = false;
    undoBtn.disabled = false;
    resultsBtn.disabled = false;
  }

  function getNormFromPointer(evt) {
    const rect = dotsLayer.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;

    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: clamp01(x), y: clamp01(y) };
  }

  function newSessionId() {
    const n = Math.random().toString(16).slice(2, 10).toUpperCase();
    return `SEC-${n}`;
  }

  // Recenter after rotation/pinch changes
  function bindRecenter() {
    const recenter = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (!pageSec.classList.contains("hidden")) {
        $("secCard")?.scrollIntoView({ behavior: "instant", block: "start" });
      }
      if (!pageTap.classList.contains("hidden")) {
        imgBox?.scrollIntoView({ behavior: "instant", block: "start" });
      }
    };

    window.addEventListener("orientationchange", () => setTimeout(recenter, 120));
    window.addEventListener("resize", () => setTimeout(recenter, 120));

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => setTimeout(recenter, 120));
      window.visualViewport.addEventListener("scroll", () => setTimeout(recenter, 120));
    }
  }

  // ------------ Score history (Step 2) ------------
  function readHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter((n) => Number.isFinite(Number(n))).map((n) => Number(n));
    } catch {
      return [];
    }
  }

  function writeHistory(arr) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-HISTORY_MAX)));
    } catch {}
  }

  function pushScoreToHistory(scoreNum) {
    if (!Number.isFinite(scoreNum)) return;
    const h = readHistory();
    h.push(Math.round(scoreNum));
    writeHistory(h);
  }

  function updateHistoryUI(currentScore) {
    const h = readHistory(); // includes current after push
    const count = h.length;
    scoreCount.textContent = String(count);

    // avg across all stored scores
    if (count > 0) {
      const sum = h.reduce((a, b) => a + b, 0);
      avgScore.textContent = String(Math.round(sum / count));
    } else {
      avgScore.textContent = "—";
    }

    // Previous 3 = scores BEFORE current
    // currentScore is last in history (if we pushed it)
    const prev = h.slice(0, -1).slice(-3).reverse(); // most recent first
    const p1 = prev[0], p2 = prev[1], p3 = prev[2];

    setHistPill(prev1, p1);
    setHistPill(prev2, p2);
    setHistPill(prev3, p3);

    // keep pills neutral background; numerals can be color-coded too (optional)
    // We'll color numerals only, matching your rule.
    colorHistPill(prev1, p1);
    colorHistPill(prev2, p2);
    colorHistPill(prev3, p3);

    // also color avg number only
    const avgNum = Number(avgScore.textContent);
    avgScore.style.color = scoreColorCss(avgNum);
  }

  function setHistPill(el, val) {
    if (!el) return;
    el.textContent = (Number.isFinite(val)) ? String(val) : "—";
  }

  function colorHistPill(el, val) {
    if (!el) return;
    if (!Number.isFinite(val)) {
      el.style.color = "rgba(255,255,255,0.85)";
      return;
    }
    el.style.color = scoreColorCss(val);
  }

  // ------------ Backend call ------------
  async function fetchBackendResults() {
    const endpoint = "/api/analyze";

    const payload = {
      anchor,
      hits
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Backend error ${res.status}: ${t || "no body"}`);
    }
    return res.json();
  }

  function applySecData(data) {
    const session = (data && data.sessionId) ? String(data.sessionId) : newSessionId();
    secSessionId.textContent = session;

    const score = Number(data && data.score);
    setScore(score);

    const shots = Number(data && data.shots);
    shotsCount.textContent = Number.isFinite(shots) ? String(shots) : String(hits.length);

    const clicks = (data && data.clicks) ? data.clicks : { up: 0, down: 0, left: 0, right: 0 };
    setClicks(clicks);

    // Step 2: store score + update history strip
    if (Number.isFinite(score)) {
      pushScoreToHistory(score);
    }
    updateHistoryUI(score);
  }

  // ------------ SEC Download ------------
  function downloadSecAsImage() {
    const ctx = secCanvas.getContext("2d");
    const W = secCanvas.width;
    const H = secCanvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0f0d";
    ctx.fillRect(0, 0, W, H);

    const pad = 70;
    const r = 40;
    const x = pad, y = pad, w = W - pad * 2, h = H - pad * 2;

    ctx.fillStyle = "rgba(20,26,24,0.90)";
    roundRect(ctx, x, y, w, h, r, true, false);

    // Title
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("Shooter Experience Card", x + 56, y + 92);

    // Session
    ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText(`Session: ${secSessionId.textContent}`, x + 56, y + 140);

    // Score
    const scoreTxt = scoreHero.textContent || "—";
    const scoreNum = Number(scoreTxt);
    ctx.font = "1000 220px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColorCss(Number.isFinite(scoreNum) ? scoreNum : NaN);
    ctx.textAlign = "center";
    ctx.fillText(scoreTxt, x + w / 2, y + 430);
    ctx.textAlign = "left";

    // History strip
    const hArr = readHistory();
    const count = hArr.length;
    const avg = count ? Math.round(hArr.reduce((a,b)=>a+b,0)/count) : NaN;
    const prev = hArr.slice(0,-1).slice(-3).reverse();
    const p1 = prev[0], p2 = prev[1], p3 = prev[2];

    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Previous 3", x + 56, y + 560);

    // Pills
    drawPill(ctx, x + 56,  y + 590, 220, 70, p1);
    drawPill(ctx, x + 296, y + 590, 220, 70, p2);
    drawPill(ctx, x + 536, y + 590, 220, 70, p3);

    ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText(`Avg:`, x + 56, y + 700);
    ctx.fillStyle = scoreColorCss(avg);
    ctx.fillText(`${Number.isFinite(avg) ? avg : "—"}`, x + 120, y + 700);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText(`Count: ${count}`, x + 260, y + 700);

    // Clicks
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Target Clicks", x + 56, y + 780);

    ctx.font = "900 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`↑ U  ${clickUp.textContent}`, x + 56, y + 850);
    ctx.fillText(`↓ D  ${clickDown.textContent}`, x + 56, y + 910);
    ctx.fillText(`← L  ${clickLeft.textContent}`, x + 56, y + 970);
    ctx.fillText(`→ R  ${clickRight.textContent}`, x + 56, y + 1030);

    // Shots
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Shots", x + 56, y + 1120);

    ctx.font = "1000 72px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`${shotsCount.textContent}`, x + 56, y + 1200);

    // Timestamp
    ctx.font = "800 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText(new Date().toLocaleString(), x + 56, y + h - 56);

    const a = document.createElement("a");
    a.download = `${secSessionId.textContent}.png`;
    a.href = secCanvas.toDataURL("image/png");
    a.click();
  }

  function drawPill(ctx, x, y, w, h, score) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, x, y, w, h, 18, true, false);

    const s = Number(score);
    ctx.font = "1000 42px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColorCss(s);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Number.isFinite(s) ? String(s) : "—", x + w/2, y + h/2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // ------------ Events ------------
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    targetImg.src = objectUrl;

    anchor = null;
    hits = [];
    controlsShown = false;
    controlsBar.classList.add("hidden");
    redraw();

    showPage(pageTap);
    elFile.value = "";
  });

  dotsLayer.addEventListener("pointerdown", (evt) => {
    if (!selectedFile) return;
    evt.preventDefault();

    const p = getNormFromPointer(evt);
    if (!p) return;

    showControlsIfNeeded();

    if (!anchor) anchor = p;
    else hits.push(p);

    redraw();
  }, { passive: false });

  clearBtn.addEventListener("click", () => {
    anchor = null;
    hits = [];
    redraw();
  });

  undoBtn.addEventListener("click", () => {
    if (hits.length > 0) hits.pop();
    else anchor = null;
    redraw();
  });

  resultsBtn.addEventListener("click", async () => {
    if (!anchor || hits.length === 0) return;

    // show SEC immediately (stable), fill after backend responds
    secSessionId.textContent = newSessionId();
    setScore(NaN);
    shotsCount.textContent = String(hits.length);
    setClicks({ up: 0, down: 0, left: 0, right: 0 });

    // show history based on current stored state (before pushing new)
    updateHistoryUI(NaN);

    showPage(pageSec);

    try {
      const data = await fetchBackendResults();
      applySecData(data);
    } catch (e) {
      console.warn("Backend not ready / failed:", e);
      // keep UI stable; no fake math
    }
  });

  downloadSecBtn.addEventListener("click", () => downloadSecAsImage());

  surveyBtn.addEventListener("click", () => {
    alert("Survey coming next.");
  });

  // Init
  bindRecenter();
  showPage(pageLanding);

  // Show history values even before first run (optional)
  updateHistoryUI(NaN);
})();
