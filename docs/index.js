/* ============================================================
   index.js (FULL REPLACEMENT) — SEC-LOCK-3
   Goals:
   1) Backend is the ONLY authority for math (score + clicks + shots).
   2) Controls (Clear / Undo / Results) appear ONLY after first tap.
   3) Works with separate frontend + backend domains:
      - Reads API base from vendor.json if present (apiBase / backendBase / backendUrl)
      - Falls back to same-origin if not provided
      - You can also force override via localStorage key: SCZN3_API_BASE
   4) Stable SEC: shows placeholders until backend responds.
   5) Keeps score history locally (numbers only) for display + SEC download image.
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // -------------------------
  // DOM (must exist in HTML)
  // -------------------------
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
  const secCard = $("secCard");
  const secSessionId = $("secSessionId");
  const scoreHero = $("scoreHero");
  const clickUp = $("clickUp");
  const clickDown = $("clickDown");
  const clickLeft = $("clickLeft");
  const clickRight = $("clickRight");
  const shotsCount = $("shotsCount");

  // History (prev 3 + avg + count)
  const prev1 = $("prev1");
  const prev2 = $("prev2");
  const prev3 = $("prev3");
  const avgScore = $("avgScore");
  const scoreCount = $("scoreCount");

  // SEC actions
  const downloadSecBtn = $("downloadSecBtn");
  const surveyBtn = $("surveyBtn");
  const secCanvas = $("secCanvas");

  // -------------------------
  // State
  // -------------------------
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized 0..1
  let hits = [];     // [{x,y}...]

  let controlsShown = false;

  // API base (frontend + backend likely separate)
  let API_BASE = ""; // e.g. "https://your-backend.onrender.com"

  // Score history
  const HISTORY_KEY = "sczn3_score_history_v1";
  const HISTORY_MAX = 50;

  // -------------------------
  // Helpers
  // -------------------------
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function must(el, name) {
    if (!el) console.warn(`Missing element: #${name}`);
    return el;
  }

  // Sanity warnings if something is missing
  must(pageLanding, "pageLanding");
  must(pageTap, "pageTap");
  must(pageSec, "pageSec");
  must(dotsLayer, "dotsLayer");
  must(controlsBar, "controlsBar");
  must(clearBtn, "clearBtn");
  must(undoBtn, "undoBtn");
  must(resultsBtn, "resultsBtn");
  must(scoreHero, "scoreHero");

  function showPage(which) {
    pageLanding?.classList.add("hidden");
    pageTap?.classList.add("hidden");
    pageSec?.classList.add("hidden");

    which?.classList.remove("hidden");

    requestAnimationFrame(() => {
      // keep top aligned after screen rotate/pinch
      (which || document.body).scrollIntoView({ behavior: "instant", block: "start" });
    });
  }

  function newSessionId() {
    const n = Math.random().toString(16).slice(2, 10).toUpperCase();
    return `SEC-${n}`;
  }

  function scoreColorCss(scoreNum) {
    // Rule:
    // 0-60 red, 61-79 yellow, 80-100 green
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
    // numerals only get color (your rule)
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

    // iPhone-friendly: half-size from earlier oversized complaint
    // Anchor slightly bigger than hit
    const size = (kind === "anchor") ? 10 : 8;
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;

    // Center the dot on the coordinate
    d.style.transform = "translate(-50%, -50%)";

    d.style.left = `${(p.x * 100).toFixed(4)}%`;
    d.style.top  = `${(p.y * 100).toFixed(4)}%`;

    d.style.background = (kind === "anchor")
      ? "rgba(255, 196, 0, 0.95)"
      : "rgba(0, 220, 130, 0.95)";

    dotsLayer.appendChild(d);
  }

  function redraw() {
    if (!dotsLayer) return;
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));
  }

  function setControlsVisible(visible) {
    if (!controlsBar) return;
    if (visible) {
      controlsBar.classList.remove("hidden");
      clearBtn && (clearBtn.disabled = false);
      undoBtn && (undoBtn.disabled = false);
      resultsBtn && (resultsBtn.disabled = false);
    } else {
      controlsBar.classList.add("hidden");
      clearBtn && (clearBtn.disabled = true);
      undoBtn && (undoBtn.disabled = true);
      resultsBtn && (resultsBtn.disabled = true);
    }
  }

  function showControlsIfNeeded() {
    if (controlsShown) return;
    controlsShown = true;
    setControlsVisible(true);
  }

  function getNormFromPointer(evt) {
    const rect = dotsLayer.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    // Support touch + pointer + mouse
    let clientX = evt.clientX;
    let clientY = evt.clientY;

    if (evt.touches && evt.touches[0]) {
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    }

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: clamp01(x), y: clamp01(y) };
  }

  // Recenter after rotation/pinch/viewport changes
  function bindRecenter() {
    const recenter = () => {
      // force top
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      if (pageSec && !pageSec.classList.contains("hidden")) {
        (secCard || pageSec).scrollIntoView({ behavior: "instant", block: "start" });
      }
      if (pageTap && !pageTap.classList.contains("hidden")) {
        (imgBox || pageTap).scrollIntoView({ behavior: "instant", block: "start" });
      }
    };

    window.addEventListener("orientationchange", () => setTimeout(recenter, 120));
    window.addEventListener("resize", () => setTimeout(recenter, 120));

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => setTimeout(recenter, 120));
      window.visualViewport.addEventListener("scroll", () => setTimeout(recenter, 120));
    }
  }

  // -------------------------
  // Score history
  // -------------------------
  function readHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.round(n) );
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

  function setHistCell(el, val) {
    if (!el) return;
    el.textContent = Number.isFinite(val) ? String(val) : "—";
    el.style.color = Number.isFinite(val) ? scoreColorCss(val) : "rgba(255,255,255,0.85)";
  }

  function updateHistoryUI() {
    const h = readHistory();
    const count = h.length;
    if (scoreCount) scoreCount.textContent = String(count);

    // avg
    if (avgScore) {
      if (count > 0) {
        const sum = h.reduce((a, b) => a + b, 0);
        const avg = Math.round(sum / count);
        avgScore.textContent = String(avg);
        avgScore.style.color = scoreColorCss(avg);
      } else {
        avgScore.textContent = "—";
        avgScore.style.color = "rgba(255,255,255,0.85)";
      }
    }

    // previous 3 (excluding current score displayed now? we show last three completed scores)
    const prev = h.slice(-3).reverse(); // most recent first
    setHistCell(prev1, prev[0]);
    setHistCell(prev2, prev[1]);
    setHistCell(prev3, prev[2]);
  }

  // -------------------------
  // API base loading (vendor.json + override)
  // -------------------------
  async function loadApiBase() {
    // 1) localStorage override if set
    const forced = (localStorage.getItem("SCZN3_API_BASE") || "").trim();
    if (forced) return forced.replace(/\/+$/, "");

    // 2) vendor.json (common in your repo)
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (res.ok) {
        const v = await res.json();
        const guess =
          (v && (v.apiBase || v.backendBase || v.backendUrl || v.api_base || v.backend_base)) || "";
        if (typeof guess === "string" && guess.trim()) {
          return guess.trim().replace(/\/+$/, "");
        }
      }
    } catch {
      // ignore
    }

    // 3) fallback: same-origin
    return "";
  }

  function apiUrl(path) {
    const base = (API_BASE || "").replace(/\/+$/, "");
    const p = String(path || "").startsWith("/") ? String(path) : `/${path}`;
    return base ? `${base}${p}` : p;
  }

  // -------------------------
  // Backend call (POST only)
  // -------------------------
  async function fetchBackendResults() {
    // Your backend should expose POST /api/analyze
    const endpoint = apiUrl("/api/analyze");

    const payload = { anchor, hits };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Backend ${res.status}: ${t || "no body"}`);
    }
    return res.json();
  }

  function applySecData(data) {
    const session = (data && data.sessionId) ? String(data.sessionId) : newSessionId();
    if (secSessionId) secSessionId.textContent = session;

    const score = Number(data && data.score);
    setScore(score);

    const shots = Number(data && data.shots);
    if (shotsCount) shotsCount.textContent = Number.isFinite(shots) ? String(shots) : String(hits.length);

    const clicks = (data && data.clicks) ? data.clicks : { up: 0, down: 0, left: 0, right: 0 };
    setClicks(clicks);

    // history
    if (Number.isFinite(score)) pushScoreToHistory(score);
    updateHistoryUI();
  }

  // -------------------------
  // SEC Download image
  // -------------------------
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

  function drawPill(ctx, x, y, w, h, score) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, x, y, w, h, 18, true, false);

    const s = Number(score);
    ctx.font = "1000 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColorCss(s);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Number.isFinite(s) ? String(Math.round(s)) : "—", x + w / 2, y + h / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function downloadSecAsImage() {
    if (!secCanvas) return;

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
    ctx.fillText(`Session: ${secSessionId?.textContent || "—"}`, x + 56, y + 140);

    // Score (centerpiece)
    const scoreTxt = scoreHero?.textContent || "—";
    const scoreNum = Number(scoreTxt);
    ctx.font = "1000 240px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColorCss(Number.isFinite(scoreNum) ? scoreNum : NaN);
    ctx.textAlign = "center";
    ctx.fillText(scoreTxt, x + w / 2, y + 450);
    ctx.textAlign = "left";

    // History
    const hArr = readHistory();
    const count = hArr.length;
    const avg = count ? Math.round(hArr.reduce((a, b) => a + b, 0) / count) : NaN;
    const p = hArr.slice(-3).reverse();

    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Previous 3", x + 56, y + 585);

    drawPill(ctx, x + 56,  y + 615, 220, 72, p[0]);
    drawPill(ctx, x + 296, y + 615, 220, 72, p[1]);
    drawPill(ctx, x + 536, y + 615, 220, 72, p[2]);

    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText(`Avg:`, x + 56, y + 735);
    ctx.fillStyle = scoreColorCss(avg);
    ctx.fillText(`${Number.isFinite(avg) ? avg : "—"}`, x + 130, y + 735);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText(`Count: ${count}`, x + 260, y + 735);

    // Clicks (still backend-driven)
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Target Clicks", x + 56, y + 810);

    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`↑ U  ${clickUp?.textContent || "0.00"}`, x + 56, y + 885);
    ctx.fillText(`↓ D  ${clickDown?.textContent || "0.00"}`, x + 56, y + 950);
    ctx.fillText(`← L  ${clickLeft?.textContent || "0.00"}`, x + 56, y + 1015);
    ctx.fillText(`→ R  ${clickRight?.textContent || "0.00"}`, x + 56, y + 1080);

    // Shots
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Shots", x + 56, y + 1155);

    ctx.font = "1000 76px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`${shotsCount?.textContent || "—"}`, x + 56, y + 1235);

    // Timestamp
    ctx.font = "800 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText(new Date().toLocaleString(), x + 56, y + h - 56);

    const a = document.createElement("a");
    a.download = `${secSessionId?.textContent || "SEC"}.png`;
    a.href = secCanvas.toDataURL("image/png");
    a.click();
  }

  // -------------------------
  // Tap event wiring (IMPORTANT)
  // -------------------------
  function onTap(evt) {
    if (!selectedFile) return;

    // Stop iOS scroll/pinch interfering with tap capture
    evt.preventDefault?.();

    const p = getNormFromPointer(evt);
    if (!p) return;

    // SHOW CONTROLS AFTER FIRST TAP (this was failing before)
    showControlsIfNeeded();

    // First tap = anchor, next taps = hits
    if (!anchor) anchor = p;
    else hits.push(p);

    redraw();
  }

  // -------------------------
  // Reset session
  // -------------------------
  function resetForNewImage() {
    anchor = null;
    hits = [];
    controlsShown = false;

    // Hide controls until first tap
    setControlsVisible(false);

    redraw();
  }

  // -------------------------
  // Events
  // -------------------------
  elChoose?.addEventListener("click", () => elFile?.click());

  elFile?.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    if (elFileName) elFileName.textContent = f.name;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    if (targetImg) targetImg.src = objectUrl;

    resetForNewImage();
    showPage(pageTap);

    // iOS Safari: clear input so same file can be re-picked
    elFile.value = "";
  });

  // Use pointerdown + touchstart + click for max compatibility
  // (Some iOS builds can be weird if overlay layer blocks pointer events.)
  dotsLayer?.addEventListener("pointerdown", onTap, { passive: false });
  dotsLayer?.addEventListener("touchstart", onTap, { passive: false });
  dotsLayer?.addEventListener("click", onTap, { passive: false });

  clearBtn?.addEventListener("click", () => {
    anchor = null;
    hits = [];
    redraw();

    // After clearing, keep controls visible (user already started)
    // But Results disabled until we have anchor + hit
  });

  undoBtn?.addEventListener("click", () => {
    if (hits.length > 0) hits.pop();
    else anchor = null;
    redraw();
  });

  resultsBtn?.addEventListener("click", async () => {
    // Must have anchor + at least 1 hit
    if (!anchor || hits.length === 0) return;

    // Show SEC immediately (no fake math)
    if (secSessionId) secSessionId.textContent = newSessionId();
    setScore(NaN);
    if (shotsCount) shotsCount.textContent = String(hits.length);
    setClicks({ up: 0, down: 0, left: 0, right: 0 });
    updateHistoryUI();

    showPage(pageSec);

    try {
      const data = await fetchBackendResults();
      applySecData(data);
    } catch (e) {
      console.warn("Backend failed (no fake math):", e);
      // keep stable placeholders
    }
  });

  downloadSecBtn?.addEventListener("click", () => downloadSecAsImage());

  surveyBtn?.addEventListener("click", () => {
    alert("Survey coming next.");
  });

  // -------------------------
  // Init
  // -------------------------
  (async function init() {
    bindRecenter();

    // Load API base (vendor.json or override)
    API_BASE = await loadApiBase();

    // Hide controls on boot (they appear only after first tap)
    setControlsVisible(false);

    // Preload history strip
    updateHistoryUI();

    showPage(pageLanding);
  })();
})();
