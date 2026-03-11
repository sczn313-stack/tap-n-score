(() => {
  const STORAGE_KEY = "tns_history_back_to_basics_v2";
  const DEFAULT_DRILL_ID = "back-to-basics";

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function getDrill() {
    const drillId = qs("drill") || DEFAULT_DRILL_ID;
    return window.TNS_getDrill ? window.TNS_getDrill(drillId) : null;
  }

  function parseCsvNumbers(value, count = 10) {
    if (!value) return Array(count).fill(0);
    const arr = value.split(",").map(v => (Number(v) ? 1 : 0)).slice(0, count);
    while (arr.length < count) arr.push(0);
    return arr;
  }

  function parseSessionFromUrl() {
    const hits = parseCsvNumbers(qs("hits"), 10);
    const stars = parseCsvNumbers(qs("stars"), 10);
    const hasHitsParam = new URLSearchParams(window.location.search).has("hits");

    const now = new Date();
    const date =
      qs("date") ||
      now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      hits,
      stars,
      verified: true,
      fromUrl: hasHitsParam
    };
  }

  function demoSession() {
    return {
      id: "demo-session",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      hits: [1, 1, 1, 1, 1, 1, 1, 0, 1, 1],
      stars: [0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
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

  function addSessionIfNeeded(history, session) {
    const exists = history.some(item => sameSession(item, session));
    if (!exists) {
      history.unshift(session);
      if (history.length > 25) history.length = 25;
      saveHistory(history);
    }
    return getHistory();
  }

  function scoreSession(session) {
    return window.TNS_scoreSession
      ? window.TNS_scoreSession(session)
      : (session.hits || []).reduce((a, b) => a + (Number(b) ? 1 : 0), 0);
  }

  function starCount(session) {
    return (session.stars || []).reduce((a, b) => a + (Number(b) ? 1 : 0), 0);
  }

  function bestSession(history) {
    if (!history.length) return null;
    return [...history].sort((a, b) => scoreSession(b) - scoreSession(a))[0];
  }

  function laneShapeClass(drill, lane) {
    const shape = drill?.laneShapes?.[lane] || "circle";
    return shape === "square" ? "square" : "";
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderHeader(drill, history) {
    const level = window.TNS_getCurrentLevel(drill, history);
    const stars = window.TNS_getLevelStars(drill, history);
    const nextReq = window.TNS_getNextRequirementText(drill, history);
    const best = bestSession(history);

    setText("drillTitle", drill.title);
    setText("levelChip", `LEVEL ${level}`);
    setText("levelLabel", `LEVEL ${level}`);
    setText("levelStars", stars);
    setText("nextReq", nextReq || "");
    setText("lifetimeBest", best ? `${scoreSession(best)}/10` : "0/10");
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

      const laneCell = document.createElement("div");
      laneCell.className = "laneCell";
      laneCell.innerHTML = `
        <div class="laneBadge ${laneShapeClass(drill, lane)}">${lane}</div>
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
    const backBtn = document.getElementById("backBtn");
    const historyBtn = document.getElementById("historyBtn");
    const newScanBtn = document.getElementById("newScanBtn");
    const vendorBtn = document.getElementById("vendorBtn");
    const surveyBtn = document.getElementById("surveyBtn");

    if (backBtn) backBtn.onclick = () => history.back();
    if (historyBtn) historyBtn.onclick = () => alert("History is shown in the session grid.");
    if (newScanBtn) newScanBtn.onclick = () => {
      window.location.href = "./index.html";
    };

    if (vendorBtn) {
      vendorBtn.textContent = `🎯  ${drill.vendorLabel || "BUY MORE TARGETS LIKE THIS"}`;
      vendorBtn.onclick = () => {
        if (drill.vendorUrl) window.open(drill.vendorUrl, "_blank", "noopener");
      };
    }

    if (surveyBtn) {
      surveyBtn.onclick = () => {
        if (drill.surveyUrl) {
          window.open(drill.surveyUrl, "_blank", "noopener");
        } else {
          alert("Survey link not set yet.");
        }
      };
    }
  }

  function init() {
    const drill = getDrill();
    if (!drill) {
      alert("Drill definition not found.");
      return;
    }

    const sessionFromUrl = parseSessionFromUrl();
    const hasLiveHits = new URLSearchParams(window.location.search).has("hits");

    let history = getHistory();

    if (hasLiveHits) {
      history = addSessionIfNeeded(history, sessionFromUrl);
    } else if (!history.length) {
      history = addSessionIfNeeded(history, demoSession());
    }

    renderHeader(drill, history);
    renderMatrix(drill, history);
    wireButtons(drill);
  }

  init();
})();
