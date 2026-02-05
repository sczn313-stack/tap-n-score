/* ============================================================
   tap-n-score/sec.js  (FULL REPLACEMENT) — Fertilizer Pass
   Adds:
   - Micro-twinkle on lit LED dots (random delay/duration)
   - Keeps centered 2-digit (00–99) and 100 as 3-digit
   Test:
     /tap-n-score/sec.html?score=25
     /tap-n-score/sec.html?score=100
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const ledDigits = $("ledDigits");
  const diagOut = $("diagOut");
  const downloadBtn = $("downloadBtn");

  function clampInt(n, min, max, fallback) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    const xi = Math.round(x);
    return Math.max(min, Math.min(max, xi));
  }

  function setDiag(obj) {
    if (!diagOut) return;
    diagOut.textContent = JSON.stringify(obj, null, 2);
  }

  function getQueryScore() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("score");
    if (raw == null) return null;
    return clampInt(raw, 0, 100, 0);
  }

  // Dot-matrix size
  const W = 10;
  const H = 14;

  function makeBlankGrid() {
    return Array.from({ length: H }, () => Array.from({ length: W }, () => 0));
  }

  function drawH(grid, y, x0, x1) {
    for (let x = x0; x <= x1; x++) grid[y][x] = 1;
  }

  function drawV(grid, x, y0, y1) {
    for (let y = y0; y <= y1; y++) grid[y][x] = 1;
  }

  function digitToGrid(d) {
    const g = makeBlankGrid();

    const topY = 1, topX0 = 2, topX1 = 7;
    const uvY0 = 2, uvY1 = 6, leftX = 1, rightX = 8;
    const midY = 7, midX0 = 2, midX1 = 7;
    const lvY0 = 8, lvY1 = 12;
    const botY = 13, botX0 = 2, botX1 = 7;

    const segs = {
      0: ["a","b","c","d","e","f"],
      1: ["b","c"],
      2: ["a","b","g","e","d"],
      3: ["a","b","g","c","d"],
      4: ["f","g","b","c"],
      5: ["a","f","g","c","d"],
      6: ["a","f","g","e","c","d"],
      7: ["a","b","c"],
      8: ["a","b","c","d","e","f","g"],
      9: ["a","b","c","d","f","g"],
    }[d] || [];

    if (segs.includes("a")) drawH(g, topY, topX0, topX1);
    if (segs.includes("f")) drawV(g, leftX, uvY0, uvY1);
    if (segs.includes("b")) drawV(g, rightX, uvY0, uvY1);
    if (segs.includes("g")) drawH(g, midY, midX0, midX1);
    if (segs.includes("e")) drawV(g, leftX, lvY0, lvY1);
    if (segs.includes("c")) drawV(g, rightX, lvY0, lvY1);
    if (segs.includes("d")) drawH(g, botY, botX0, botX1);

    // subtle thickness
    const boosted = makeBlankGrid();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!g[y][x]) continue;
        boosted[y][x] = 1;
        if (x + 1 < W) boosted[y][x + 1] = 1;
      }
    }

    return boosted;
  }

  function renderDigit(grid) {
    const digitEl = document.createElement("div");
    digitEl.className = "ledDigit";

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dot = document.createElement("div");
        dot.className = grid[y][x] ? "dot on" : "dot";
        digitEl.appendChild(dot);
      }
    }
    return digitEl;
  }

  function applyTwinkle() {
    // Add calm “organic” twinkle only to lit dots
    const onDots = ledDigits.querySelectorAll(".dot.on");
    onDots.forEach((dot) => {
      dot.classList.add("twinkle");

      // Random but calm
      const delay = (Math.random() * 2.8).toFixed(2) + "s";
      const dur = (3.2 + Math.random() * 3.2).toFixed(2) + "s"; // 3.2–6.4s
      dot.style.animationDelay = delay;
      dot.style.animationDuration = dur;
    });
  }

  function setScore(score) {
    const s = clampInt(score, 0, 100, 0);
    const str = (s === 100) ? "100" : String(s).padStart(2, "0");

    ledDigits.innerHTML = "";
    for (const ch of str) {
      const d = Number(ch);
      ledDigits.appendChild(renderDigit(digitToGrid(d)));
    }

    applyTwinkle();

    // Optional: wire download if img param exists
    const params = new URLSearchParams(window.location.search);
    const img = params.get("img");
    if (img && downloadBtn) {
      downloadBtn.href =
        "/tap-n-score/download.html?img=" + encodeURIComponent(img) +
        "&from=" + encodeURIComponent("/tap-n-score/index.html?fresh=1") +
        "&target=" + encodeURIComponent("/tap-n-score/index.html?fresh=1");
    }

    setDiag({
      ok: true,
      score: s,
      displayed: str,
      twinkle: "onDots randomized (delay/duration)"
    });
  }

  const queryScore = getQueryScore();
  if (queryScore == null) {
    setScore(25);
    setDiag({
      ok: true,
      score: 25,
      displayed: "25",
      source: "default demo",
      tip: "Add ?score=25 or ?score=100"
    });
  } else {
    setScore(queryScore);
    setDiag({
      ok: true,
      score: queryScore,
      source: "query",
      tip: "Try ?score=100"
    });
  }
})();
