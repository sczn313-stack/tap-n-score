/* ============================================================
   drills.js — Tap-n-Score Drill Engine v1.1
   Back-to-Basics locked drill implementation
============================================================ */

const TNS_DRILLS = {
  "back-to-basics": {
    id: "back-to-basics",
    title: "Back to Basics",

    laneCount: 10,

    laneShapes: {
      1: "circle",
      2: "circle",
      3: "circle",
      4: "square",
      5: "circle",
      6: "square",
      7: "circle",
      8: "circle",
      9: "circle",
      10: "circle"
    },

    laneText: {
      1: "1 — slow (5x)",
      2: "1 → 2",
      3: "1 → 3 (4x)",
      4: "4 — strong hand only (5x)",
      5: "1 → 5",
      6: "1 → 6 (4x)",
      7: "7 — weak hand only (5x)",
      8: "1 → 8",
      9: "1 → 9 (4x)",
      10: "10 — slow (5x)"
    },

    vendorLabel: "BUY MORE TARGETS LIKE THIS",
    vendorUrl: "https://bakertargets.com/",
    surveyUrl: "",

    scoring: {
      maxScore: 10,
      scoreMode: "one-point-per-lane",
      centerHitAddsStar: true,
      multipleHitsSameLaneCountOnce: true
    },

    progression: {
      maxLevel: 5,

      levels: [
        {
          level: 1,
          stars: "★☆☆☆☆",
          requirementText: "Complete 1 verified session",
          achieved: history => history.length >= 1
        },
        {
          level: 2,
          stars: "★★☆☆☆",
          requirementText: "Score 7/10 or higher once",
          achieved: history =>
            history.some(s => TNS_scoreSession(s) >= 7)
        },
        {
          level: 3,
          stars: "★★★☆☆",
          requirementText: "Score 8/10 or higher twice",
          achieved: history =>
            history.filter(s => TNS_scoreSession(s) >= 8).length >= 2
        },
        {
          level: 4,
          stars: "★★★★☆",
          requirementText: "Score 9/10 or higher twice",
          achieved: history =>
            history.filter(s => TNS_scoreSession(s) >= 9).length >= 2
        },
        {
          level: 5,
          stars: "★★★★★",
          requirementText: "Shoot a clean 10/10",
          achieved: history =>
            history.some(s => TNS_scoreSession(s) === 10)
        }
      ]
    }
  }
};

/* ---------- PUBLIC ENGINE API ---------- */

window.TNS_getDrill = function (id) {
  return TNS_DRILLS[id] || TNS_DRILLS["back-to-basics"];
};

window.TNS_scoreSession = function (session) {
  if (!session || !session.hits) return 0;
  return session.hits.reduce((sum, v) => sum + (v ? 1 : 0), 0);
};

window.TNS_getCurrentLevel = function (drill, history) {
  if (!drill || !history) return 1;

  const levels = drill.progression.levels;
  let current = 1;

  for (const lvl of levels) {
    if (lvl.achieved(history)) {
      current = lvl.level;
    } else {
      break;
    }
  }

  return Math.min(current, drill.progression.maxLevel);
};

window.TNS_getLevelStars = function (drill, history) {
  const level = window.TNS_getCurrentLevel(drill, history);
  const lvlDef = drill.progression.levels[level - 1];
  return lvlDef ? lvlDef.stars : "☆☆☆☆☆";
};

window.TNS_getNextRequirementText = function (drill, history) {
  const level = window.TNS_getCurrentLevel(drill, history);
  const lvlDef = drill.progression.levels[level - 1];
  return lvlDef ? lvlDef.requirementText : "";
};

window.TNS_getLaneText = function (drill, lane) {
  if (!drill || !drill.laneText) return "";
  return drill.laneText[lane] || "";
};

/* ============================================================
   END OF FILE
============================================================ */
