(() => {
  const STORAGE_KEY = "tns_b2b_history_v1";

  // Demo data if no payload is present.
  const demoCurrent = {
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    hits: [1,1,1,1,1,1,1,0,1,1],
    stars: [0,0,0,1,0,1,0,0,0,0],
    verified: true
  };

  // Query options:
  // ?hits=1,1,0,1,1,1,0,1,1,1
  // ?stars=0,0,1,0,0,1,0,0,0,0
  // ?date=Apr%2012
  function parseSessionFromUrl() {
    const qs = new URLSearchParams(window.location.search);
    const hitsRaw = (qs.get("hits") || "").trim();
    const starsRaw = (qs.get("stars") || "").trim();
    const date = (qs.get("date") || "").trim();

    if (!hitsRaw) return null;

    const hits = hitsRaw.split(",").slice(0, 10).map(v => Number(v) ? 1 : 0);
    while (hits.length < 10) hits.push(0);

    const stars = starsRaw
      ? starsRaw.split(",").slice(0, 10).map(v => Number(v) ? 1 : 0)
      : Array(10).fill(0);

    while (stars.length < 10) stars.push(0);

    return {
      date: date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      hits,
      stars,
      verified: true
    };
  }

  function getStoredHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function scoreOf(session) {
    return session.hits.reduce((a, b) => a + b, 0);
  }

  function starsOf(session) {
    return session.stars.reduce((a, b) => a + b, 0);
  }

  function bestScore(history) {
    if (!history.length) return 0;
    return Math.max(...history.map(scoreOf));
  }

  function computeLevel(history) {
    const verified = history.filter(s => s.verified);
    const s8 = verified.filter(s => scoreOf(s) >= 8).length;
    const s9 = verified.filter(s => scoreOf(s) >= 9).length;
    const clean10 = verified.some(s => scoreOf(s) === 10);

    if (clean10) return 5;
    if (s9 >= 2) return 4;
    if (s8 >= 2) return 3;
    if (verified.some(s => scoreOf(s) >= 7)) return 2;
    return 1;
  }

  function levelStars(level) {
    return "★".repeat(level) + "☆".repeat(5 - level);
  }

  function laneShape(n) {
    return [2,5,8].includes(n) ? "square" : "";
  }

  function buildHistory() {
    const history = getStoredHistory();
    const current = parseSessionFromUrl() || demoCurrent;

    const fingerprint = JSON.stringify({
      date: current.date,
      hits: current.hits,
      stars: current.stars
    });

    const exists = history.some(s => JSON.stringify({
      date: s.date, hits: s.hits, stars: s.stars
    }) === fingerprint);

    if (!exists) {
      history.unshift(current);
      if (history.length > 20) history.length = 20;
      saveHistory(history);
    }

    return getStoredHistory();
  }

  function render(history) {
    const lastFive = history.slice(0, 5);
    const level = computeLevel(history);

    document.getElementById("levelChip").textContent = `LEVEL ${level}`;
    document.getElementById("levelLabel").textContent = `LEVEL ${level}`;
    document.getElementById("levelStars").textContent = levelStars(level);
    document.getElementById("lifetimeBest").textContent = `${bestScore(history)}/10${history.some(s => starsOf(s) > 0 && scoreOf(s) === bestScore(history)) ? "★" : ""}`;

    const header = document.getElementById("matrixHeader");
    const body = document.getElementById("matrixBody");

    header.innerHTML = "";
    body.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "cornerHead";
    corner.textContent = "Lanes";
    header.appendChild(corner);

    lastFive.forEach(s => {
      const box = document.createElement("div");
      box.className = "dateHead";
      box.innerHTML = `
        <div class="date">${s.date}</div>
        <div class="score">${scoreOf(s)}/10</div>
      `;
      header.appendChild(box);
    });

    // fill empty columns up to 5
    for (let i = lastFive.length; i < 5; i++) {
      const box = document.createElement("div");
      box.className = "dateHead";
      box.innerHTML = `<div class="date">—</div><div class="score">—</div>`;
      header.appendChild(box);
    }

    for (let lane = 1; lane <= 10; lane++) {
      const row = document.createElement("div");
      row.className = "matrixRow";

      const laneCell = document.createElement("div");
      laneCell.className = "laneCell";
      laneCell.innerHTML = `
        <div class="laneBadge ${laneShape(lane)}">${lane}</div>
        <div class="laneNum">${lane}</div>
      `;
      row.appendChild(laneCell);

      for (let col = 0; col < 5; col++) {
        const s = lastFive[col];
        const cell = document.createElement("div");
        cell.className = "cell";

        if (s) {
          const hit = s.hits[lane - 1] === 1;
          const star = s.stars[lane - 1] === 1;

          cell.innerHTML = `
            <div class="mark ${hit ? "hit" : "miss"}">${hit ? "✓" : "✕"}</div>
            ${star ? `<div class="star">★</div>` : ""}
          `;
        } else {
          cell.innerHTML = `<div class="mark miss" style="opacity:.22">•</div>`;
        }

        row.appendChild(cell);
      }

      body.appendChild(row);
    }
  }

  function wireButtons() {
    document.getElementById("backBtn").onclick = () => history.back();
    document.getElementById("historyBtn").onclick = () => {
      alert("History view is already shown in the matrix.");
    };
    document.getElementById("newScanBtn").onclick = () => {
      window.location.href = "./index.html";
    };
    document.getElementById("leaderboardBtn").onclick = () => {
      alert("Leaderboard hook goes here.");
    };
  }

  const history = buildHistory();
  render(history);
  wireButtons();
})();
