(() => {
  const STORAGE_KEY = "tns_history_back_to_basics_v8";
  const DEFAULT_DRILL_ID = "back-to-basics";

  function query(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function parseCsvBits(value, count) {
    if (!value) return Array(count).fill(0);
    const out = value.split(",").slice(0, count).map(v => Number(v) ? 1 : 0);
    while (out.length < count) out.push(0);
    return out;
  }

  function getDrill() {
    const drillId = query("drill") || DEFAULT_DRILL_ID;
    return window.TNS_getDrill(drillId);
  }

  function createSessionFromUrl(drill) {
    const hasHits = new URLSearchParams(window.location.search).has("hits");
    const now = new Date();
    const date = query("date") || now.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      hits: parseCsvBits(query("hits"), drill.laneCount),
      stars: parseCsvBits(query("stars"), drill.laneCount),
      verified: true,
      fromUrl: hasHits
    };
  }

  function demoSession(drill) {
    const hits = Array(drill.laneCount).fill(0);
    const stars = Array(drill.laneCount).fill(0);
    [1,2,3,4,5,6,7,9,10].forEach(n => hits[n - 1] = 1);
    [4,6].forEach(n => stars[n - 1] = 1);

    return {
      id: "demo-session",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      hits,
      stars,
      verified: true,
      fromUrl: false
    };
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function sameSession(a, b) {
    return JSON.stringify({
      date: a.date,
      hits: a.hits,
      stars: a.stars
    }) === JSON.stringify({
      date: b.date,
      hits: b.hits,
      stars: b.stars
    });
  }

  function addSession(history, session) {
    const exists = history.some(item => sameSession(item, session));
    if (!exists) {
      history.unshift(session);
      if (history.length > 25) history.length = 25;
      saveHistory(history);
    }
    return getHistory();
  }

  function scoreSession(session) {
    return window.TNS_scoreSession(session);
  }

  function bestScore(history) {
    if (!history.length) return 0;
    return Math.max(...history.map(scoreSession));
  }

  function getProgressHint(drill, history) {
    const currentLevel = window.TNS_getCurrentLevel(drill, history);
    const currentScores = history.map(scoreSession);

    if (currentLevel >= drill.progression.maxLevel) {
      return "You’ve reached the top level on this drill.";
    }

    if (currentLevel === 1) {
      const has7 = currentScores.some(s => s >= 7);
      return has7 ? "You’re ready to unlock the next level." : "Reach 7/10 once to level up.";
    }

    if (currentLevel === 2) {
      const count8 = currentScores.filter(s => s >= 8).length;
      return count8 === 1 ? "One more 8/10 session unlocks the next level." : "Reach 8/10 twice to level up.";
    }

    if (currentLevel === 3) {
      const count9 = currentScores.filter(s => s >= 9).length;
      return count9 === 1 ? "One more 9/10 session unlocks the next level." : "Reach 9/10 twice to level up.";
    }

    if (currentLevel === 4) {
      const has10 = currentScores.some(s => s === 10);
      return has10 ? "Clean run achieved." : "Shoot a clean 10/10 to reach the top level.";
    }

    return "Keep shooting verified sessions to progress.";
  }

  function renderHeader(drill, history, currentSession, previousBest, previousLevel) {
    const currentLevel = window.TNS_getCurrentLevel(drill, history);
    const starString = window.TNS_getLevelStars(drill, history);
    const nextReq = window.TNS_getNextRequirementText(drill, history);
    const nextHint = getProgressHint(drill, history);
    const best = bestScore(history);
    const currentScore = currentSession ? scoreSession(currentSession) : 0;
    const isNewBest = currentSession && currentScore >= previousBest && currentScore > 0;

    document.getElementById("drillTitle").textContent = drill.title;
    document.getElementById("levelChip").textContent = `LEVEL ${currentLevel}`;
    document.getElementById("levelLabel").textContent = `LEVEL ${currentLevel}`;
    document.getElementById("nextReq").textContent = nextReq || "";
    document.getElementById("nextHint").textContent = nextHint || "";
    document.getElementById("lifetimeBest").textContent = `${best}/10`;

    const bestBadge = document.getElementById("bestBadge");
    if (isNewBest) bestBadge.classList.remove("hidden");
    else bestBadge.classList.add("hidden");

    const levelChip = document.getElementById("levelChip");
    if (currentLevel > previousLevel) {
      levelChip.classList.remove("levelPulse");
      void levelChip.offsetWidth;
      levelChip.classList.add("levelPulse");
    }

    animateStars(starString);
  }

  function animateStars(starString) {
    const starsEl = document.getElementById("levelStars");
    starsEl.textContent = "☆☆☆☆☆";

    const filledCount = (starString.match(/★/g) || []).length;
    let i = 0;

    function step() {
      if (i > filledCount) {
        starsEl.textContent = starString;
        return;
      }
      starsEl.textContent = "★".repeat(i) + "☆".repeat(5 - i);
      starsEl.classList.remove("starFlash");
      void starsEl.offsetWidth;
      starsEl.classList.add("starFlash");
      i += 1;
      setTimeout(step, 140);
    }

    step();
  }

  function makeNodeIcon(shape, lane) {
    return `
      <div class="nodeIcon ${shape}">
        <div class="nodeNum">${lane}</div>
        <div class="nodeReticleH"></div>
        <div class="nodeReticleV"></div>
      </div>
    `;
  }

  function renderMatrix(drill, history) {
    const header = document.getElementById("matrixHeader");
    const body = document.getElementById("matrixBody");
    const sessions = history.slice(0, 5);

    header.innerHTML = "";
    body.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "cornerHead";
    corner.textContent = "Lanes";
    header.appendChild(corner);

    sessions.forEach(session => {
      const cell = document.createElement("div");
      cell.className = "dateHead";
      cell.innerHTML = `
        <div class="date">${session.date}</div>
        <div class="score">${scoreSession(session)}/10</div>
      `;
      header.appendChild(cell);
    });

    for (let i = sessions.length; i < 5; i++) {
      const cell = document.createElement("div");
      cell.className = "dateHead";
      cell.innerHTML = `<div class="date">—</div><div class="score">—</div>`;
      header.appendChild(cell);
    }

    for (let lane = 1; lane <= drill.laneCount; lane++) {
      const row = document.createElement("div");
      row.className = "matrixRow";

      const shape = drill.laneShapes[lane] === "square" ? "square" : "circle";

      const laneCell = document.createElement("div");
      laneCell.className = "laneCell";
      laneCell.innerHTML = `
        ${makeNodeIcon(shape, lane)}
        <div class="laneLabel">${lane}</div>
      `;
      row.appendChild(laneCell);

      for (let col = 0; col < 5; col++) {
        const session = sessions[col];
        const cell = document.createElement("div");
        cell.className = "cell";

        if (!session) {
          cell.innerHTML = `<div class="mark miss" style="opacity:.18">•</div>`;
        } else {
          const hit = session.hits[lane - 1] === 1;
          const star = session.stars[lane - 1] === 1;

          cell.innerHTML = `
            <div class="mark ${hit ? "hit" : "miss"}">${hit ? "✓" : "✕"}</div>
            ${star ? `<div class="star">★</div>` : ""}
          `;
        }

        row.appendChild(cell);
      }

      body.appendChild(row);
    }
  }

  function wireButtons(drill) {
    document.getElementById("backBtn").onclick = () => history.back();

    document.getElementById("historyBtn").onclick = () => {
      alert("History is shown in the grid.");
    };

    document.getElementById("newScanBtn").onclick = () => {
      window.location.href = "./index.html";
    };

    document.getElementById("vendorBtn").textContent = `🎯  ${drill.vendorLabel}`;
    document.getElementById("vendorBtn").onclick = () => {
      window.open(drill.vendorUrl, "_blank", "noopener");
    };

    document.getElementById("surveyBtn").onclick = () => {
      if (drill.surveyUrl) window.open(drill.surveyUrl, "_blank", "noopener");
      else alert("Survey link not set yet.");
    };
  }

  function init() {
    const drill = getDrill();
    let history = getHistory();
    const previousBest = bestScore(history);
    const previousLevel = window.TNS_getCurrentLevel(drill, history);

    const urlSession = createSessionFromUrl(drill);
    const hasHits = new URLSearchParams(window.location.search).has("hits");
    let currentSession = null;

    if (hasHits) {
      history = addSession(history, urlSession);
      currentSession = urlSession;
    } else if (!history.length) {
      history = addSession(history, demoSession(drill));
      currentSession = history[0];
    } else {
      currentSession = history[0];
    }

    renderHeader(drill, history, currentSession, previousBest, previousLevel);
    renderMatrix(drill, history);
    wireButtons(drill);
  }

  init();
})();
