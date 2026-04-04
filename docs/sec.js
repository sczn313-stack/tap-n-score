(function () {
  const secData = {
    targetTitle: "Back to Basics",
    summaryCopy: "Understand and act on your performance",
    lanes: 10,
    sessions: [
      {
        date: "Apr 12",
        score: 9,
        total: 10,
        pct: 90,
        results: [
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "x" }
        ]
      },
      {
        date: "Apr 9",
        score: 8,
        total: 10,
        pct: 80,
        results: [
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "x" },
          { status: "check" },
          { status: "check" }
        ]
      },
      {
        date: "Apr 6",
        score: 9,
        total: 10,
        pct: 90,
        results: [
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "check" },
          { status: "x" },
          { status: "check" }
        ]
      },
      {
        date: "Apr 4",
        score: 5,
        total: 10,
        pct: 50,
        results: [
          { status: "check", star: true },
          { status: "check", star: true },
          { status: "check", star: true },
          { status: "check" },
          { status: "check" },
          { status: "check", star: true },
          { status: "check" },
          { status: "x" },
          { status: "x" },
          { status: "check" }
        ]
      },
      {
        date: "Mar 31",
        score: 5,
        total: 10,
        pct: 50,
        results: [
          { status: "check" },
          { status: "x" },
          { status: "empty" },
          { status: "x" },
          { status: "empty" },
          { status: "x" },
          { status: "check" },
          { status: "empty" },
          { status: "empty" },
          { status: "empty" }
        ]
      }
    ],
    levelRules: [
      { level: 1, label: "7 / 10" },
      { level: 2, label: "8 / 10" },
      { level: 3, label: "8 / 10 + ⭐⭐" },
      { level: 4, label: "9 / 10 + ⭐⭐⭐" },
      { level: 5, label: "10 / 10 + ⭐⭐⭐⭐" }
    ]
  };

  const els = {
    targetTitle: document.getElementById("targetTitle"),
    summaryCopy: document.getElementById("summaryCopy"),
    gridWrap: document.getElementById("gridWrap"),
    bestScore: document.getElementById("bestScore"),
    bestBadge: document.getElementById("bestBadge"),
    levelLabel: document.getElementById("levelLabel"),
    levelNote: document.getElementById("levelNote"),
    levelPill: document.getElementById("levelPill"),
    starsRow: document.getElementById("starsRow"),
    backBtn: document.getElementById("backBtn"),
    historyBtn: document.getElementById("historyBtn"),
    newScanBtn: document.getElementById("newScanBtn"),
    leaderboardBtn: document.getElementById("leaderboardBtn")
  };

  function computeBestSession(sessions) {
    return sessions.reduce((best, current) => {
      const bestPct = best ? best.pct : -1;
      if (current.pct > bestPct) return current;
      if (current.pct === bestPct && current.score > (best?.score ?? -1)) return current;
      return best;
    }, null);
  }

  function countStars(results) {
    return results.filter((r) => r.star).length;
  }

  function computeLevel(bestSession) {
    const score = bestSession.score;
    const stars = countStars(bestSession.results);

    if (score === 10 && stars >= 4) {
      return {
        level: 5,
        starsDisplay: "★★★★★",
        note: "Top tier performance"
      };
    }

    if (score >= 9 && stars >= 3) {
      return {
        level: 4,
        starsDisplay: "★★★★☆",
        note: "Reach 10/10 with 4 stars"
      };
    }

    if (score >= 8 && stars >= 2) {
      return {
        level: 3,
        starsDisplay: "★★★☆☆",
        note: "Reach 9/10 with 3 stars"
      };
    }

    if (score >= 8) {
      return {
        level: 2,
        starsDisplay: "★★☆☆☆",
        note: "Reach 8/10 consistently"
      };
    }

    return {
      level: 1,
      starsDisplay: "★☆☆☆☆",
      note: "Reach 8/10 to advance"
    };
  }

  function buildResultCell(result) {
    if (result.status === "check") {
      return `
        <span class="result-mark result-check">✓</span>
        ${result.star ? '<span class="result-star">★</span>' : ""}
      `;
    }

    if (result.status === "x") {
      return `<span class="result-mark result-x">✕</span>`;
    }

    return `<div class="empty-dot"></div>`;
  }

  function buildGrid(data) {
    const table = document.createElement("table");
    table.className = "sec-grid";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const thLanes = document.createElement("th");
    thLanes.innerHTML = `<span class="lanes-head">Lanes</span>`;
    headRow.appendChild(thLanes);

    data.sessions.forEach((session) => {
      const th = document.createElement("th");
      th.innerHTML = `
        <span class="col-date">${session.date}</span>
        <span class="col-score">${session.score}/${session.total}</span>
        <span class="col-pct">${session.pct}%</span>
      `;
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (let lane = 1; lane <= data.lanes; lane += 1) {
      const tr = document.createElement("tr");

      const laneTd = document.createElement("td");
      laneTd.className = "lane-cell";
      laneTd.innerHTML = `
        <div class="lane-wrap">
          <div class="lane-icon">${lane}</div>
          <div class="lane-num">${lane}</div>
        </div>
      `;
      tr.appendChild(laneTd);

      data.sessions.forEach((session) => {
        const result = session.results[lane - 1] || { status: "empty" };
        const td = document.createElement("td");
        td.innerHTML = buildResultCell(result);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    return table;
  }

  function render(data) {
    els.targetTitle.textContent = data.targetTitle;
    els.summaryCopy.textContent = data.summaryCopy;

    const bestSession = computeBestSession(data.sessions);
    const levelState = computeLevel(bestSession);

    els.bestScore.textContent = `${bestSession.score}/${bestSession.total}`;
    els.bestBadge.textContent = "NEW BEST";
    els.levelLabel.textContent = `LEVEL ${levelState.level}`;
    els.levelPill.textContent = `LEVEL ${levelState.level}`;
    els.starsRow.textContent = levelState.starsDisplay;
    els.levelNote.textContent = levelState.note;

    els.gridWrap.innerHTML = "";
    els.gridWrap.appendChild(buildGrid(data));
  }

  function wireActions() {
    els.backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "./index.html";
      }
    });

    els.historyBtn.addEventListener("click", () => {
      alert("History drawer goes here.");
    });

    els.newScanBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });

    els.leaderboardBtn.addEventListener("click", () => {
      alert("Leaderboard screen goes here.");
    });
  }

  render(secData);
  wireActions();

  window.SEC_DATA = secData;
})();
