(() => {
  const $ = (id) => document.getElementById(id);

  const backBtn = $("backBtn");
  const newScanBtn = $("newScanBtn");
  const leaderboardBtn = $("leaderboardBtn");
  const historyBtn = $("historyBtn");
  const matrixGrid = $("matrixGrid");
  const bestScore = $("bestScore");
  const levelChip = $("levelChip");
  const levelStars = $("levelStars");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_B2B_DASH_HISTORY = "SCZN3_B2B_DASH_HISTORY_V1";
  const KEEP_RUNS = 5;

  function safeJsonParse(s){
    try { return JSON.parse(s); } catch { return null; }
  }

  function loadPayload() {
    const qp = new URL(window.location.href).searchParams.get("payload");
    if (qp) {
      try {
        return JSON.parse(decodeURIComponent(escape(atob(qp))));
      } catch {}
    }
    return safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "");
  }

  function isB2B(payload) {
    return String(payload?.drill?.mode || "").toLowerCase() === "b2b"
      || String(payload?.sku || "").toLowerCase().includes("b2b")
      || String(payload?.target?.key || "").toLowerCase() === "bkr-b2b";
  }

  function fmtDate(ts) {
    const d = new Date(Number(ts || Date.now()));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function percent(score, maxScore) {
    const s = Number(score || 0);
    const m = Number(maxScore || 10) || 10;
    return Math.round((s / m) * 100);
  }

  function loadHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_B2B_DASH_HISTORY) || "[]");
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(arr) {
    try {
      localStorage.setItem(KEY_B2B_DASH_HISTORY, JSON.stringify(arr.slice(0, 25)));
    } catch {}
  }

  function pushCurrentRun(payload) {
    if (!isB2B(payload)) return loadHistory();

    const hist = loadHistory();
    const sessionId = String(payload?.sessionId || "");
    if (!sessionId) return hist;

    const exists = hist.some(x => String(x.sessionId || "") === sessionId);
    if (!exists) {
      hist.unshift({
        sessionId,
        ts: Number(payload?.runCompletedAt || Date.now()),
        score: Number(payload?.score || 0),
        maxScore: Number(payload?.maxScore || 10),
        distanceYds: Number(payload?.distanceYds || payload?.debug?.distanceYds || 0),
        lanesHit: Array.isArray(payload?.drill?.lanesHit) ? payload.drill.lanesHit.slice().sort((a,b)=>a-b) : [],
        taps: Number(payload?.taps || payload?.hits || payload?.shots || 0)
      });
      saveHistory(hist);
    }
    return loadHistory();
  }

  function getLevelState(history) {
    const scores = history.map(x => Number(x.score || 0));

    let level = 1;
    if (scores.some(s => s >= 7)) level = 2;
    if (scores.filter(s => s >= 8).length >= 2) level = 3;
    if (scores.filter(s => s >= 9).length >= 2) level = 4;
    if (scores.some(s => s === 10)) level = 5;

    const starsMap = {
      1: "★☆☆☆☆",
      2: "★★☆☆☆",
      3: "★★★☆☆",
      4: "★★★★☆",
      5: "★★★★★"
    };

    return {
      level,
      stars: starsMap[level] || "★☆☆☆☆"
    };
  }

  function renderSummary(history) {
    const best = history.length ? Math.max(...history.map(x => Number(x.score || 0))) : 0;
    bestScore.textContent = `${best}/10`;

    const state = getLevelState(history);
    levelChip.textContent = `LEVEL ${state.level}`;
    levelStars.textContent = state.stars;
  }

  function makeCell(cls, html) {
    const d = document.createElement("div");
    d.className = `cell ${cls}`;
    d.innerHTML = html;
    return d;
  }

  function renderMatrix(history) {
    matrixGrid.innerHTML = "";

    matrixGrid.appendChild(makeCell("cornerCell", "Lanes"));

    const runs = history.slice(0, KEEP_RUNS);
    runs.forEach(run => {
      matrixGrid.appendChild(
        makeCell(
          "headCell",
          `<div>${fmtDate(run.ts)}</div>
           <div class="scoreHead">${run.score}/10</div>
           <div class="subHead">${percent(run.score, run.maxScore)}%</div>`
        )
      );
    });

    for (let i = runs.length; i < KEEP_RUNS; i++) {
      matrixGrid.appendChild(
        makeCell(
          "headCell",
          `<div>—</div><div class="scoreHead">—</div><div class="subHead">—</div>`
        )
      );
    }

    for (let lane = 1; lane <= 10; lane++) {
      matrixGrid.appendChild(
        makeCell(
          "laneCell",
          `<div class="laneBadge">${lane}</div><div class="laneNum">${lane}</div>`
        )
      );

      runs.forEach(run => {
        const hit = Array.isArray(run.lanesHit) && run.lanesHit.includes(lane);
        matrixGrid.appendChild(
          makeCell(
            "markCell",
            `<div class="mark ${hit ? "hit" : "miss"}">${hit ? "✓" : "✕"}</div>`
          )
        );
      });

      for (let i = runs.length; i < KEEP_RUNS; i++) {
        matrixGrid.appendChild(
          makeCell("markCell", `<div class="mark empty">•</div>`)
        );
      }
    }
  }

  function goHome() {
    window.location.href = "./index.html?fresh=" + Date.now();
  }

  function boot() {
    const payload = loadPayload();
    const history = payload && isB2B(payload) ? pushCurrentRun(payload) : loadHistory();

    renderSummary(history);
    renderMatrix(history);

    backBtn?.addEventListener("click", () => {
      history.length ? window.history.back() : goHome();
    });

    newScanBtn?.addEventListener("click", goHome);

    leaderboardBtn?.addEventListener("click", () => {
      alert("Leaderboard build is next.");
    });

    historyBtn?.addEventListener("click", () => {
      const el = document.querySelector(".matrixCard");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  boot();
})();
