/* ============================================================
   index.js (FULL REPLACEMENT) — Tap-n-Score™ 3-Page Flow
   - Page 1: Landing → Take/Choose Photo (iOS-safe)
   - Page 2: Target view → Tap bull, then tap holes (pinch zoom)
   - Page 3: SEC → Clicks ONLY (2 decimals), big score, prev 3, cumulative, session ID
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Pages
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSEC = $("pageSEC");

  // Landing input
  const photoInput = $("photoInput");

  // Tap page elements
  const targetWrap = $("targetWrap");
  const targetImg = $("targetImg");
  const dotsLayer = $("dotsLayer");
  const instructionLine = $("instructionLine");

  const btnUndo = $("btnUndo");
  const btnClear = $("btnClear");
  const btnShow = $("btnShow");
  const btnBuyMoreTop = $("btnBuyMoreTop");

  // SEC page elements
  const clickUp = $("clickUp");
  const clickDown = $("clickDown");
  const clickLeft = $("clickLeft");
  const clickRight = $("clickRight");
  const sessionIdEl = $("sessionId");

  const scoreBig = $("scoreBig");
  const scoreCurrent = $("scoreCurrent");
  const scorePrev = $("scorePrev");
  const scoreCum = $("scoreCum");

  const btnDlImg = $("btnDlImg");
  const btnDlTxt = $("btnDlTxt");
  const btnBuyMoreSEC = $("btnBuyMoreSEC");

  // --- State
  let objectUrl = null;

  let stage = "BULL"; // "BULL" | "HOLES"
  let bull = null;    // {x,y} in WRAP coordinates
  let holes = [];     // array of {x,y} in WRAP coordinates

  // Pinch zoom (applies to target image only; dots stay in wrap coords)
  let scale = 1;
  let lastDist = 0;

  // Session
  let sessionId = null;

  // --- Helpers
  function showPage(which) {
    [pageLanding, pageTap, pageSEC].forEach(p => p.classList.remove("pageActive"));
    which.classList.add("pageActive");
  }

  function two(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function newSessionId() {
    // Short, readable
    const a = Math.random().toString(16).slice(2, 8).toUpperCase();
    const b = Math.random().toString(16).slice(2, 10).toUpperCase();
    return `SEC-${a}-${b}`;
  }

  function clearAll() {
    bull = null;
    holes = [];
    stage = "BULL";
    renderDots();
    setInstruction();
    setCtasVisibility();
  }

  function setInstruction() {
    if (stage === "BULL") {
      instructionLine.textContent = "Tap bull’s-eye to center";
    } else {
      instructionLine.textContent = "Tap bullet holes to be scored";
    }
  }

  function setCtasVisibility() {
    const bullSet = !!bull;

    // CTAs do NOT appear until after bull is set
    btnUndo.hidden = !bullSet;
    btnClear.hidden = !bullSet;
    btnShow.hidden = !bullSet;

    btnUndo.disabled = !bullSet || (holes.length === 0);
    btnClear.disabled = !bullSet || (holes.length === 0);
    btnShow.disabled = !bullSet || (holes.length < 1);

    // Buy-more top CTA: also hidden until bull is set
    btnBuyMoreTop.hidden = !bullSet;
  }

  function wrapPointFromEvent(e) {
    const rect = targetWrap.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    return { x, y };
  }

  function addDot(pt, kind, label) {
    const d = document.createElement("div");
    d.className = "dot" + (kind === "BULL" ? " dotBull" : "");
    d.style.left = `${pt.x}px`;
    d.style.top = `${pt.y}px`;
    d.textContent = label ?? "";
    dotsLayer.appendChild(d);
  }

  function renderDots() {
    dotsLayer.innerHTML = "";
    if (bull) addDot(bull, "BULL", "B");
    holes.forEach((h, i) => addDot(h, "HOLE", String(i + 1)));
  }

  function dist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function applyScale() {
    targetImg.style.transform = `scale(${scale})`;
  }

  // --- Scoring + Clicks (placeholder math for now)
  // Your backend can replace this later. For pilot UI/perfection, the layout/flow is the win.
  function computePOIB() {
    if (!holes.length) return null;
    const sx = holes.reduce((a, p) => a + p.x, 0);
    const sy = holes.reduce((a, p) => a + p.y, 0);
    return { x: sx / holes.length, y: sy / holes.length };
  }

  function computeClicks() {
    // UI expects clicks only; two decimals.
    // For now we create a deterministic demo based on pixel deltas so the page is functional.
    // Replace with your real MOA math/True MOA + distance once backend is wired.
    const poib = computePOIB();
    if (!bull || !poib) return { up:0, down:0, left:0, right:0, score:0 };

    const dx = bull.x - poib.x; // + means bull is right of POIB -> need RIGHT correction
    const dy = bull.y - poib.y; // + means bull is below POIB -> need DOWN correction (screen-space)

    // Convert px deltas to “clicks” for demo: 50px ~= 1 click (arbitrary but stable)
    const clicksX = dx / 50;
    const clicksY = dy / 50;

    const right = Math.max(0, clicksX);
    const left  = Math.max(0, -clicksX);
    const down  = Math.max(0, clicksY);
    const up    = Math.max(0, -clicksY);

    // Score demo: tighter cluster + closer to bull = higher
    const spread = holes.reduce((acc, p) => acc + Math.hypot(p.x - poib.x, p.y - poib.y), 0) / holes.length;
    const err = Math.hypot(dx, dy);
    let score = 100 - (err / 6) - (spread / 8);
    score = clamp(Math.round(score), 0, 100);

    return { up, down, left, right, score };
  }

  function scoreClass(score) {
    if (score >= 90) return "scoreGood";
    if (score >= 70) return "scoreMid";
    return "scoreBad";
  }

  function loadScoreHistory() {
    try {
      const raw = localStorage.getItem("sczn3_score_hist");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(n => Number.isFinite(n)) : [];
    } catch {
      return [];
    }
  }

  function saveScoreHistory(arr) {
    try {
      localStorage.setItem("sczn3_score_hist", JSON.stringify(arr.slice(-25)));
    } catch {}
  }

  function goSEC() {
    sessionId = newSessionId();

    const out = computeClicks();

    // Two decimals ALWAYS
    clickUp.textContent = two(out.up);
    clickDown.textContent = two(out.down);
    clickLeft.textContent = two(out.left);
    clickRight.textContent = two(out.right);

    sessionIdEl.textContent = sessionId;

    // Score
    scoreBig.classList.remove("scoreGood","scoreMid","scoreBad");
    scoreBig.classList.add(scoreClass(out.score));
    scoreBig.textContent = String(out.score);

    // History (prev 3 + cumulative)
    const hist = loadScoreHistory();
    const prev3 = hist.slice(-3);
    const nextHist = hist.concat([out.score]);
    saveScoreHistory(nextHist);

    scoreCurrent.textContent = String(out.score);
    scorePrev.textContent = prev3.length ? prev3.join(", ") : "—";

    const all = nextHist;
    const cum = all.length ? Math.round(all.reduce((a,b)=>a+b,0) / all.length) : out.score;
    scoreCum.textContent = String(cum);

    showPage(pageSEC);
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadCanvasPNG(filename, canvas) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  }

  function buildSECImageCanvas() {
    // Creates a simple SEC image from Page 3 data (clean + readable).
    const w = 1200, h = 700;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");

    // bg
    ctx.fillStyle = "#0b0f18";
    ctx.fillRect(0,0,w,h);

    // header
    ctx.font = "900 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ff2a2a";
    ctx.fillText("SEC", 60, 90);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(" Card", 160, 90);

    // session
    ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(`Session: ${sessionId}`, 60, 130);

    // clicks box
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, 60, 170, 520, 420, 26, true, true);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Target Clicks", 90, 220);

    ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    const lines = [
      ["Up", clickUp.textContent],
      ["Down", clickDown.textContent],
      ["Left", clickLeft.textContent],
      ["Right", clickRight.textContent],
    ];

    let y = 270;
    lines.forEach(([k,v]) => {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(k, 100, y);
      ctx.fillStyle = "#ffffff";
      ctx.font = "950 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(v, 240, y+6);
      ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      y += 78;
    });

    // score box
    roundRect(ctx, 640, 170, 500, 420, 26, true, true);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Score", 670, 220);

    // score big
    const s = scoreBig.textContent;
    ctx.font = "1000 140px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreBig.classList.contains("scoreGood") ? "#42ff7b" :
                    scoreBig.classList.contains("scoreBad") ? "#ff4d4d" : "#ffd166";
    ctx.fillText(s, 670, 370);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "800 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Current ${scoreCurrent.textContent}`, 670, 430);
    ctx.fillText(`Previous 3 ${scorePrev.textContent}`, 670, 475);
    ctx.fillText(`Cumulative ${scoreCum.textContent}`, 670, 520);

    return c;

    function roundRect(ctx, x, y, w, h, r, fill, stroke) {
      const rr = Math.min(r, w/2, h/2);
      ctx.beginPath();
      ctx.moveTo(x+rr, y);
      ctx.arcTo(x+w, y, x+w, y+h, rr);
      ctx.arcTo(x+w, y+h, x, y+h, rr);
      ctx.arcTo(x, y+h, x, y, rr);
      ctx.arcTo(x, y, x+w, y, rr);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }
  }

  // --- Events

  // Photo chosen
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);

    targetImg.onload = () => {
      // Reset state + zoom
      scale = 1;
      applyScale();

      clearAll();
      showPage(pageTap);
    };

    targetImg.src = objectUrl;
  });

  // Tap to set bull / holes
  targetWrap.addEventListener("pointerdown", (e) => {
    // Ignore if multi-touch pinch is happening (handled below)
    if (e.pointerType === "touch") {
      // allow; pinch handled by touch events
    }

    // Only register tap if image is loaded
    if (!targetImg.src) return;

    const pt = wrapPointFromEvent(e);

    if (stage === "BULL") {
      bull = pt;
      stage = "HOLES";
      setInstruction();
      renderDots();
      setCtasVisibility();
      return;
    }

    // HOLES stage
    holes.push(pt);
    renderDots();
    setCtasVisibility();
  });

  // Pinch zoom (touch)
  targetWrap.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 2) {
      lastDist = dist(e.touches[0], e.touches[1]);
    }
  }, { passive: true });

  targetWrap.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length === 2) {
      const d = dist(e.touches[0], e.touches[1]);
      if (lastDist > 0) {
        const delta = (d - lastDist) / 250; // sensitivity
        scale = clamp(scale + delta, 1, 4);
        applyScale();
      }
      lastDist = d;
    }
  }, { passive: true });

  targetWrap.addEventListener("touchend", (e) => {
    if (!e.touches || e.touches.length < 2) lastDist = 0;
  }, { passive: true });

  btnUndo.addEventListener("click", () => {
    if (!holes.length) return;
    holes.pop();
    renderDots();
    setCtasVisibility();
  });

  btnClear.addEventListener("click", () => {
    if (!bull) return;
    holes = [];
    renderDots();
    setCtasVisibility();
  });

  btnShow.addEventListener("click", () => {
    goSEC();
  });

  // Downloads
  btnDlTxt.addEventListener("click", () => {
    const txt =
`SEC Card
Session: ${sessionIdEl.textContent}

Target Clicks (2 decimals)
Up: ${clickUp.textContent}
Down: ${clickDown.textContent}
Left: ${clickLeft.textContent}
Right: ${clickRight.textContent}

Score
Current: ${scoreCurrent.textContent}
Previous 3: ${scorePrev.textContent}
Cumulative: ${scoreCum.textContent}
`;
    downloadTextFile(`${sessionIdEl.textContent}.txt`, txt);
  });

  btnDlImg.addEventListener("click", () => {
    const canvas = buildSECImageCanvas();
    downloadCanvasPNG(`${sessionIdEl.textContent}.png`, canvas);
  });

  // Vendor CTA hooks (wire your real Baker URL later)
  btnBuyMoreTop.addEventListener("click", () => {
    window.open("https://bakertargets.com", "_blank", "noopener,noreferrer");
  });
  btnBuyMoreSEC.addEventListener("click", () => {
    window.open("https://bakertargets.com", "_blank", "noopener,noreferrer");
  });

  // Initial
  showPage(pageLanding);
})();
