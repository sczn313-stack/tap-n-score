/* ============================================================
   tap-n-score/sec.js  (FULL REPLACEMENT)
   Purpose:
   - LED-style score display (pale yellow)
   - Perfectly centered for 2-digit OR 100 (3-digit)
   - Copy locked: "U R Here!" / "Keep going!"
   - Test via URL:
       /tap-n-score/sec.html?score=25
       /tap-n-score/sec.html?score=100
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const ledDigits = $("ledDigits");
  const diagOut = $("diagOut");
  const downloadBtn = $("downloadBtn");

  // --- Helpers
  function clampInt(n, min, max, fallback) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    const xi = Math.round(x);
    return Math.max(min, Math.min(max, xi));
  }

  function setDiag(obj) {
    diagOut.textContent = JSON.stringify(obj, null, 2);
  }

  function getQueryScore() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("score");
    if (raw == null) return null;
    return clampInt(raw, 0, 100, 0);
  }

  // --- LED dot-matrix font (10 x 14)
  // We draw digits using line segments (7-seg-ish) mapped into dot grids.
  // This keeps it clean + consistent and always centered.

  const W = 10; // columns
  const H = 14; // rows

  function makeBlankGrid() {
    return Array.from({ length: H }, () => Array.from({ length: W }, () => 0));
  }

  function drawH(grid, y, x0, x1) {
    for (let x = x0; x <= x1; x++) {
      grid[y][x] = 1;
    }
  }

  function drawV(grid, x, y0, y1) {
    for (let y = y0; y <= y1; y++) {
      grid[y][x] = 1;
    }
  }

  function digitToGrid(d) {
    const g = makeBlankGrid();

    // Segment coordinates tuned to look like a dot-matrix “LED sign”
    // Top
    const topY = 1, topX0 = 2, topX1 = 7;
    // Upper verticals
    const uvY0 = 2, uvY1 = 6, leftX = 1, rightX = 8;
    // Middle
    const midY = 7, midX0 = 2, midX1 = 7;
    // Lower verticals
    const lvY0 = 8, lvY1 = 12;
    // Bottom
    const botY = 13, botX0 = 2, botX1 = 7;

    // Segment flags: a b c d e f g
    // a=top, b=upper right, c=lower right, d=bottom, e=lower left, f=upper left, g=middle
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

    // Slight “thickness” boost: add adjacent dots for a softer LED feel
    // (kept subtle so it stays calm and not chunky)
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

  function setScore(score) {
    // Score is 0..100, show:
    // - 100 => "100"
    // - else 2-digit with leading 0? NO. We’ll show natural: 0..99 (but centered).
    // For “two digit calm” UX, we can force 2-digit display (e.g., 5 -> 05).
    // You told me “large two digit unless it has a 100” => we force 2-digit for 0..99.
    const s = clampInt(score, 0, 100, 0);
    const str = (s === 100) ? "100" : String(s).padStart(2, "0");

    // Clear existing
    ledDigits.innerHTML = "";

    // Build digits
    for (const ch of str) {
      const d = Number(ch);
      const grid = digitToGrid(d);
      ledDigits.appendChild(renderDigit(grid));
    }

    setDiag({
      ok: true,
      score: s,
      displayed: str,
      note: "Two-digit display (00–99), three-digit only for 100."
    });

    // If you later pass an SEC png url, we can wire this:
    // /download.html?img=...
    // For now: preserve any existing download link (optional param).
    const params = new URLSearchParams(window.location.search);
    const img = params.get("img");
    if (img) {
      downloadBtn.href = "/tap-n-score/download.html?img=" + encodeURIComponent(img)
        + "&from=" + encodeURIComponent("/tap-n-score/index.html?fresh=1")
        + "&target=" + encodeURIComponent("/tap-n-score/index.html?fresh=1");
    }
  }

  // --- Boot
  const queryScore = getQueryScore();

  if (queryScore == null) {
    // Default demo score if none provided
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
