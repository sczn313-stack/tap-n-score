/* ============================================================
   index.js (FULL REPLACEMENT) — SEC-SCORE-ONLY-LOCK-1
   GOAL (locked):
   - Backend is the ONLY math authority.
   - SEC shows ONLY the SCORE number (colored by bands).
   - Clear / Undo / Results appear ONLY after first tap (anchor or hit).
   - No Start button. No tap pills/HUD logic here.
   - Results button -> POST /api/analyze { anchor, hits } -> { score }
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------------- Pages ----------------
  const pageLanding = $("pageLanding");
  const pageTap = $("pageTap");
  const pageSec = $("pageSec");

  // ---------------- Landing ----------------
  const elFile = $("photoInput");
  const elChoose = $("chooseBtn");
  const elFileName = $("fileName");

  // ---------------- Tap ----------------
  const imgBox = $("imgBox");
  const targetImg = $("targetImg");
  const dotsLayer = $("dotsLayer");

  const controlsBar = $("controlsBar");
  const clearBtn = $("clearBtn");
  const undoBtn = $("undoBtn");
  const resultsBtn = $("resultsBtn");

  // ---------------- SEC ----------------
  const scoreHero = $("scoreHero");

  // ---------------- Guard: required IDs ----------------
  const REQUIRED = [
    ["pageLanding", pageLanding],
    ["pageTap", pageTap],
    ["pageSec", pageSec],
    ["photoInput", elFile],
    ["chooseBtn", elChoose],
    ["fileName", elFileName],
    ["imgBox", imgBox],
    ["targetImg", targetImg],
    ["dotsLayer", dotsLayer],
    ["controlsBar", controlsBar],
    ["clearBtn", clearBtn],
    ["undoBtn", undoBtn],
    ["resultsBtn", resultsBtn],
    ["scoreHero", scoreHero],
  ];

  for (const [name, el] of REQUIRED) {
    if (!el) {
      alert(`Missing required element: #${name}. Check index.html IDs.`);
      return;
    }
  }

  // ---------------- State ----------------
  let selectedFile = null;
  let objectUrl = null;

  let anchor = null; // {x,y} normalized
  let hits = [];     // [{x,y}...]

  let controlsShown = false;

  // ---------------- Helpers ----------------
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function showPage(which) {
    pageLanding.classList.add("hidden");
    pageTap.classList.add("hidden");
    pageSec.classList.add("hidden");

    which.classList.remove("hidden");

    requestAnimationFrame(() => {
      try {
        which.scrollIntoView({ behavior: "instant", block: "start" });
      } catch (_) {}
    });
  }

  function scoreColorCss(scoreNum) {
    if (!Number.isFinite(scoreNum)) return "rgba(255,255,255,0.92)";
    if (scoreNum <= 60) return "rgba(255, 70, 70, 0.98)";   // red
    if (scoreNum <= 79) return "rgba(255, 208, 70, 0.98)";  // yellow
    return "rgba(0, 235, 150, 0.98)";                       // green
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

  function showControlsIfNeeded() {
    if (controlsShown) return;
    controlsShown = true;
    controlsBar.classList.remove("hidden");
    clearBtn.disabled = false;
    undoBtn.disabled = false;
    resultsBtn.disabled = false;
  }

  function hideControls() {
    controlsShown = false;
    controlsBar.classList.add("hidden");
    clearBtn.disabled = true;
    undoBtn.disabled = true;
    resultsBtn.disabled = true;
  }

  function clearDots() {
    while (dotsLayer.firstChild) dotsLayer.removeChild(dotsLayer.firstChild);
  }

  function drawDot(p, kind) {
    const d = document.createElement("div");
    d.className = "tapDot";

    // Smaller dots (you asked for half-ish on phones)
    const size = kind === "anchor" ? 10 : 8;
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;

    d.style.left = `${(p.x * 100).toFixed(4)}%`;
    d.style.top = `${(p.y * 100).toFixed(4)}%`;

    d.style.background =
      kind === "anchor"
        ? "rgba(255, 196, 0, 0.95)"
        : "rgba(0, 220, 130, 0.95)";

    dotsLayer.appendChild(d);
  }

  function redraw() {
    clearDots();
    if (anchor) drawDot(anchor, "anchor");
    hits.forEach((h) => drawDot(h, "hit"));
  }

  function getNormFromPointer(evt) {
    const rect = dotsLayer.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;

    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: clamp01(x), y: clamp01(y) };
  }

  // ---------------- Backend ----------------
  // Same-origin by default. If you ever need a full URL, set window.API_BASE in HTML.
  const API_BASE = (typeof window !== "undefined" && window.API_BASE) ? String(window.API_BASE) : "";
  const ANALYZE_URL = `${API_BASE}/api/analyze`;

  async function fetchBackendScoreOnly() {
    const res = await fetch(ANALYZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor, hits }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Backend ${res.status}: ${t || "no body"}`);
    }
    return res.json();
  }

  function applySecDataScoreOnly(data) {
    // SCORE ONLY. Nothing else.
    const score = Number(data && data.score);
    setScore(score);
  }

  // ---------------- Events ----------------
  elChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    selectedFile = f;
    elFileName.textContent = f.name;

    // Load main image
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
    objectUrl = URL.createObjectURL(f);
    targetImg.src = objectUrl;

    // Reset taps + UI
    anchor = null;
    hits = [];
    redraw();
    hideControls();

    showPage(pageTap);

    // allow re-selecting same file on iOS
    elFile.value = "";
  });

  dotsLayer.addEventListener(
    "pointerdown",
    (evt) => {
      if (!selectedFile) return;
      evt.preventDefault();

      const p = getNormFromPointer(evt);
      if (!p) return;

      showControlsIfNeeded();

      if (!anchor) anchor = p;
      else hits.push(p);

      redraw();
    },
    { passive: false }
  );

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
    // Must have anchor + at least one hit
    if (!anchor || hits.length === 0) return;

    // SEC opens immediately, score waits for backend
    showPage(pageSec);
    setScore(NaN);

    try {
      const data = await fetchBackendScoreOnly();
      applySecDataScoreOnly(data);
    } catch (e) {
      console.warn("Backend failed:", e);
      setScore(NaN); // shows "—"
    }
  });

  // ---------------- Init ----------------
  hideControls();
  showPage(pageLanding);
  setScore(NaN);
})();
