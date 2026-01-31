/* ============================================================
   index.js (FULL REPLACEMENT) — SEC-LOCK-1
   - Card-contained SEC scoring page
   - HERO score is centerpiece; numerals only; colored by thresholds
   - Controls (Clear/Undo/Results) appear ONLY after first tap
   - All math/results come from backend endpoint
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

  const downloadSecBtn = $("downloadSecBtn");
  const surveyBtn = $("surveyBtn");
  const secCanvas = $("secCanvas");

  // State
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y}
  let hits = [];     // [{x,y}...]

  let controlsShown = false;

  // ------------ Helpers ------------
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function showPage(which) {
    pageLanding.classList.add("hidden");
    pageTap.classList.add("hidden");
    pageSec.classList.add("hidden");

    which.classList.remove("hidden");

    // recenter after page change
    requestAnimationFrame(() => {
      which.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }

  function setScoreColor(scoreNum) {
    // your rules (numbers only colored)
    scoreHero.style.color = "rgba(255,255,255,0.92)";
    if (!Number.isFinite(scoreNum)) return;

    if (scoreNum <= 60) scoreHero.style.color = "rgba(255, 70, 70, 0.98)";
    else if (scoreNum <= 79) scoreHero.style.color = "rgba(255, 208, 70, 0.98)";
    else scoreHero.style.color = "rgba(0, 235, 150, 0.98)";
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

    // smaller dots for iPhone (anchor a touch bigger)
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
    // initial enable states
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
      if (!pageSec.classList.contains("hidden")) {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        $("secCard")?.scrollIntoView({ behavior: "instant", block: "start" });
      }
      if (!pageTap.classList.contains("hidden")) {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        imgBox?.scrollIntoView({ behavior: "instant", block: "start" });
      }
    };

    window.addEventListener("orientationchange", () => setTimeout(recenter, 120));
    window.addEventListener("resize", () => setTimeout(recenter, 120));

    // iOS pinch/visual viewport shifts
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => setTimeout(recenter, 120));
      window.visualViewport.addEventListener("scroll", () => setTimeout(recenter, 120));
    }
  }

  // ------------ Backend call ------------
  async function fetchBackendResults() {
    // This endpoint must exist on your backend.
    // If yours is different, change it here ONLY.
    const endpoint = "/api/analyze";

    const payload = {
      // Backend is authority for ALL math.
      anchor,
      hits,
      // We intentionally HIDE distance/MOA on SEC UI,
      // but backend may still need them internally later.
      // Keep these in payload if your backend uses them.
      // distanceYds: Number($("distanceYds")?.value || 100),
      // clickValue: Number($("clickValue")?.value || 0.25),
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
    // expected shape (example):
    // {
    //   sessionId: "SEC-....",
    //   score: 87,
    //   shots: 5,
    //   clicks: {up:0.25, down:0, left:0, right:0},
    // }
    const session = (data && data.sessionId) ? String(data.sessionId) : newSessionId();
    secSessionId.textContent = session;

    const score = Number(data && data.score);
    scoreHero.textContent = Number.isFinite(score) ? String(Math.round(score)) : "—";
    setScoreColor(Number.isFinite(score) ? score : NaN);

    const shots = Number(data && data.shots);
    shotsCount.textContent = Number.isFinite(shots) ? String(shots) : String(hits.length);

    const clicks = (data && data.clicks) ? data.clicks : { up: 0, down: 0, left: 0, right: 0 };
    setClicks(clicks);
  }

  // ------------ SEC Download ------------
  function downloadSecAsImage() {
    // Simple v1: render a clean card image with score + clicks + shots.
    // (We’ll add history strip in Step 2, then enhance this.)
    const ctx = secCanvas.getContext("2d");
    const W = secCanvas.width;
    const H = secCanvas.height;

    // background
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0f0d";
    ctx.fillRect(0, 0, W, H);

    // card
    const pad = 70;
    const r = 40;
    const x = pad, y = pad, w = W - pad * 2, h = H - pad * 2;

    // rounded rect
    ctx.fillStyle = "rgba(20,26,24,0.90)";
    roundRect(ctx, x, y, w, h, r, true, false);

    // title
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("Shooter Experience Card", x + 56, y + 92);

    // session
    ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fillText(`Session: ${secSessionId.textContent}`, x + 56, y + 140);

    // score
    const scoreTxt = scoreHero.textContent || "—";
    ctx.font = "1000 220px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = getScoreColorForCanvas(scoreTxt);
    ctx.textAlign = "center";
    ctx.fillText(scoreTxt, x + w / 2, y + 430);
    ctx.textAlign = "left";

    // clicks + shots
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Target Clicks", x + 56, y + 560);

    ctx.font = "900 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`↑ U  ${clickUp.textContent}`, x + 56, y + 630);
    ctx.fillText(`↓ D  ${clickDown.textContent}`, x + 56, y + 690);
    ctx.fillText(`← L  ${clickLeft.textContent}`, x + 56, y + 750);
    ctx.fillText(`→ R  ${clickRight.textContent}`, x + 56, y + 810);

    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Shots", x + 56, y + 900);

    ctx.font = "1000 72px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`${shotsCount.textContent}`, x + 56, y + 980);

    // timestamp
    ctx.font = "800 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText(new Date().toLocaleString(), x + 56, y + h - 56);

    // download
    const a = document.createElement("a");
    a.download = `${secSessionId.textContent}.png`;
    a.href = secCanvas.toDataURL("image/png");
    a.click();
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

  function getScoreColorForCanvas(scoreTxt) {
    const s = Number(scoreTxt);
    if (!Number.isFinite(s)) return "rgba(255,255,255,0.92)";
    if (s <= 60) return "rgba(255, 70, 70, 0.98)";
    if (s <= 79) return "rgba(255, 208, 70, 0.98)";
    return "rgba(0, 235, 150, 0.98)";
  }

  // ------------ Events ------------
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    // load image
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    targetImg.src = objectUrl;

    // reset taps
    anchor = null;
    hits = [];
    controlsShown = false;
    controlsBar.classList.add("hidden");
    redraw();

    showPage(pageTap);
    // allow selecting same file again later
    elFile.value = "";
  });

  // taps
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

    // show SEC page even if backend fails, but with safe placeholders
    const localSession = newSessionId();
    secSessionId.textContent = localSession;
    scoreHero.textContent = "—";
    setScoreColor(NaN);
    shotsCount.textContent = String(hits.length);
    setClicks({ up: 0, down: 0, left: 0, right: 0 });

    showPage(pageSec);

    try {
      const data = await fetchBackendResults();
      applySecData(data);
    } catch (e) {
      // keep page stable; just show safe text in console
      console.warn("Backend not ready / failed:", e);
      // optional: you can display a tiny non-intrusive message later
    }
  });

  downloadSecBtn.addEventListener("click", () => downloadSecAsImage());

  surveyBtn.addEventListener("click", () => {
    // Placeholder: wire to your survey URL later
    alert("Survey coming next.");
  });

  // Init
  bindRecenter();
  showPage(pageLanding);
})();
