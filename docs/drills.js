/* ============================================================
   drills.js — Tap-n-Score Drill Engine v1.0
   Back-to-Basics baseline implementation
============================================================ */

/* ---------- DRILL DEFINITIONS ---------- */

const TNS_DRILLS = {
  "back-to-basics": {
    id: "back-to-basics",
    title: "Back to Basics",

    laneCount: 10,

    /* Shape per lane (circle | square) */
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

    /* Vendor + survey */
    vendorLabel: "BUY MORE TARGETS LIKE THIS",
    vendorUrl: "https://bakertargets.com/",
    surveyUrl: "",

    /* ---------- PROGRESSION MODEL ---------- */

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

/* Get drill by ID */
window.TNS_getDrill = function (id) {
  return TNS_DRILLS[id] || TNS_DRILLS["back-to-basics"];
};

/* Score a session (count hits) */
window.TNS_scoreSession = function (session) {
  if (!session || !session.hits) return 0;
  return session.hits.reduce((sum, v) => sum + (v ? 1 : 0), 0);
};

/* Determine current level */
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

/* Get stars string for level */
window.TNS_getLevelStars = function (drill, history) {
  const level = window.TNS_getCurrentLevel(drill, history);
  const lvlDef = drill.progression.levels[level - 1];
  return lvlDef ? lvlDef.stars : "☆☆☆☆☆";
};

/* Requirement text for current level */
window.TNS_getNextRequirementText = function (drill, history) {
  const level = window.TNS_getCurrentLevel(drill, history);
  const lvlDef = drill.progression.levels[level - 1];
  return lvlDef ? lvlDef.requirementText : "";
};

/* ============================================================
   END OF FILE
============================================================ */
