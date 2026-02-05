/* ============================================================
   sec.js (FULL REPLACEMENT) — LED DOT-MATRIX SCORE
   - Reads payload from ?payload= (base64 JSON) OR localStorage fallback
   - Renders centered LED dot-matrix digits (2-digit or 100)
   - Pale yellow for 25 (and mid-range); special handling for 100
   - Provides Download link route: /tap-n-score/download.html?img=...
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  const ledDots = $("ledDots");
  const sessionLine = $("sessionLine");
  const backBtn = $("backBtn");
  const downloadBtn = $("downloadBtn");
  const diagWrap = $("diagWrap");
  const diagBox = $("diagBox");

  const youHereLine = $("youHereLine");
  const doBetterLine = $("doBetterLine");

  const params = new URLSearchParams(location.search);
  const debugOn = params.get("debug") === "1";

  function setDiag(obj) {
    if (!diagBox) return;
    diagBox.textContent = JSON.stringify(obj, null, 2);
    if (diagWrap) diagWrap.classList.add("show");
  }

  function parsePayload() {
    // 1) URL payload
    const b64 = params.get("payload");
    if (b64) {
      try {
        const json = decodeURIComponent(escape(atob(decodeURIComponent(b64))));
        return JSON.parse(json);
      } catch (e) {
        if (debugOn) setDiag({ ok:false, where:"url", error:String(e) });
      }
    }

    // 2) localStorage fallback
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      if (debugOn) setDiag({ ok:false, where:"localStorage", error:String(e) });
    }

    return null;
  }

  // ---------------- LED DOT MATRIX ----------------
  // Each digit is a 7x10 dot matrix (simple, readable LED look)
  // 1 = ON dot, 0 = OFF
  const DIGITS = {
    "0": [
      "0111110",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "0111110",
    ],
    "1": [
      "0011000",
      "0111000",
      "0011000",
      "0011000",
      "0011000",
      "0011000",
      "0011000",
      "0011000",
      "0011000",
      "0111110",
    ],
    "2": [
      "0111110",
      "1100011",
      "0000011",
      "0000110",
      "0001100",
      "0011000",
      "0110000",
      "1100000",
      "1100000",
      "1111111",
    ],
    "3": [
      "0111110",
      "1100011",
      "0000011",
      "0001110",
      "0001110",
      "0000011",
      "0000011",
      "1100011",
      "1100011",
      "0111110",
    ],
    "4": [
      "0001110",
      "0011110",
      "0110110",
      "1100110",
      "1100110",
      "1111111",
      "0000110",
      "0000110",
      "0000110",
      "0000110",
    ],
    "5": [
      "1111111",
      "1100000",
      "1100000",
      "1111110",
      "1100011",
      "0000011",
      "0000011",
      "1100011",
      "1100011",
      "0111110",
    ],
    "6": [
      "0011110",
      "0110000",
      "1100000",
      "1111110",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "0111110",
    ],
    "7": [
      "1111111",
      "0000011",
      "0000110",
      "0001100",
      "0011000",
      "0011000",
      "0011000",
      "0011000",
      "0011000",
      "0011000",
    ],
    "8": [
      "0111110",
      "1100011",
      "1100011",
      "0111110",
      "0111110",
      "1100011",
      "1100011",
      "1100011",
      "1100011",
      "0111110",
    ],
    "9": [
      "0111110",
      "1100011",
      "1100011",
      "1100011",
      "0111111",
      "0000011",
      "0000011",
      "0000110",
      "0001100",
      "0111000",
    ],
  };

  function scoreToDigits(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    if (s === 100) return ["1", "0", "0"];
    if (s < 10) return ["0", String(s)];
    return String(s).split("").slice(0, 2);
  }

  function scoreToColor(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    // EXACT intent: 25 = pale yellow
    if (s === 25) return { on: "#f2e6a6", glow: "rgba(242,230,166,.55)" };

    // Calm progression:
    // 0–24: soft red
    // 25–69: pale yellow
    // 70–99: soft green
    // 100: white (special)
    if (s <= 24) return { on: "#ff5b5b", glow: "rgba(255,91,91,.55)" };
    if (s <= 69) return { on: "#f2e6a6", glow: "rgba(242,230,166,.55)" };
    if (s <= 99) return { on: "#67f3a4", glow: "rgba(103,243,164,.55)" };
    return { on: "#eef2f7", glow: "rgba(238,242,247,.55)" };
  }

  function clearSvg() {
    while (ledDots && ledDots.firstChild) ledDots.removeChild(ledDots.firstChild);
  }

  function drawLedScore(score) {
    if (!ledDots) return;

    clearSvg();

    const digits = scoreToDigits(score);
    const { on, glow } = scoreToColor(score);

    // Layout inside viewBox 1000x320
    // Center block horizontally regardless of 2 or 3 digits.
    const dotR = 6.6;             // dot radius
    const stepX = 16.6;           // dot spacing
    const stepY = 16.6;
    const cols = 7;
    const rows = 10;

    const digitW = (cols - 1) * stepX + dotR * 2; // width occupied
    const digitH = (rows - 1) * stepY + dotR * 2;

    const gap = 42;               // space between digits
    const blockW = digits.length * digitW + (digits.length - 1) * gap;

    const startX = (1000 - blockW) / 2;
    const startY = (320 - digitH) / 2;

    // a subtle “off dot” background behind the lit dots
    // (like the black dot grid you see on real LED panels)
    function drawOffGrid(offsetX) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = offsetX + c * stepX + dotR;
          const cy = startY + r * stepY + dotR;
          const off = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          off.setAttribute("cx", cx);
          off.setAttribute("cy", cy);
          off.setAttribute("r", dotR);
          off.setAttribute("fill", "rgba(255,255,255,.05)");
          ledDots.appendChild(off);
        }
      }
    }

    function drawOnDots(pattern, offsetX) {
      // glow filter per dot using duplicated circles (simple + fast)
      for (let r = 0; r < rows; r++) {
        const line = pattern[r];
        for (let c = 0; c < cols; c++) {
          if (line[c] !== "1") continue;

          const cx = offsetX + c * stepX + dotR;
          const cy = startY + r * stepY + dotR;

          const glowDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          glowDot.setAttribute("cx", cx);
          glowDot.setAttribute("cy", cy);
          glowDot.setAttribute("r", dotR + 3.4);
          glowDot.setAttribute("fill", glow);
          glowDot.setAttribute("opacity", "0.55");
          ledDots.appendChild(glowDot);

          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("cx", cx);
          dot.setAttribute("cy", cy);
          dot.setAttribute("r", dotR);
          dot.setAttribute("fill", on);
          ledDots.appendChild(dot);
        }
      }
    }

    digits.forEach((d, i) => {
      const ox = startX + i * (digitW + gap);
      drawOffGrid(ox);
      drawOnDots(DIGITS[d] || DIGITS["0"], ox);
    });
  }

  // ---------------- Page wiring ----------------
  const payload = parsePayload();

  if (!payload) {
    drawLedScore(0);
    sessionLine.textContent = "SCZN3";
    youHereLine.textContent = "You’re here.";
    doBetterLine.textContent = "There’s more room. Keep going.";
    if (downloadBtn) downloadBtn.href = "/tap-n-score/download.html";
    if (debugOn) setDiag({ ok:false, reason:"no payload found" });
    return;
  }

  const score = Number(payload.score ?? 0);

  // Copy / messaging rules:
  // - “You’re here.” stays calm
  // - “There’s more room. Keep going.” stays calm
  // (No shaming, no “bad” language)
  youHereLine.textContent = "You’re here.";
  doBetterLine.textContent = "There’s more room. Keep going.";

  // session line
  const sid = String(payload.sessionId || "SCZN3");
  sessionLine.textContent = `Session: ${sid}`;

  // back link: if payload has a known origin, allow override via ?from=
  const from = params.get("from");
  if (from && backBtn) backBtn.href = from;

  // download link routes to your download.html page
  // If you later produce a real PNG URL, set payload.secPngUrl and it will flow through.
  const imgUrl = payload.secPngUrl || "";
  if (downloadBtn) {
    if (imgUrl) {
      downloadBtn.href =
        `/tap-n-score/download.html?img=${encodeURIComponent(imgUrl)}&from=${encodeURIComponent(backBtn?.href || "/tap-n-score/index.html")}&target=${encodeURIComponent("/tap-n-score/index.html")}`;
    } else {
      // fallback: still open download page (shows “no image loaded” until you wire PNG generation)
      downloadBtn.href = `/tap-n-score/download.html?from=${encodeURIComponent(backBtn?.href || "/tap-n-score/index.html")}&target=${encodeURIComponent("/tap-n-score/index.html")}`;
    }
  }

  // draw LED
  drawLedScore(score);

  if (debugOn) {
    setDiag({
      ok: true,
      score,
      digits: scoreToDigits(score).join(""),
      color: scoreToColor(score),
      payload,
    });
  }
})();
