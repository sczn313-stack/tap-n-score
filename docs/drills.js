window.TNS_DRILLS = {
  "back-to-basics": {
    id: "back-to-basics",
    title: "BACK TO BASICS DRILL",
    vendor: "baker",
    vendorLabel: "BUY MORE TARGETS LIKE THIS",
    vendorUrl: "https://bakertargets.com/",
    surveyUrl: "./survey.html?drill=back-to-basics",

    laneCount: 10,

    laneShapes: {
      1: "circle",
      2: "square",
      3: "circle",
      4: "circle",
      5: "square",
      6: "circle",
      7: "circle",
      8: "square",
      9: "circle",
      10: "circle"
    },

    laneText: {
      1: "Slow fire — 5 shots",
      2: "Draw, one shot (repeat 5 times)",
      3: "Draw, one on 3, one on 4 (repeat 4 times)",
      4: "Second target for the transition drill",
      5: "Draw, five shots strong hand only",
      6: "Draw, two on 6, two on 7 (repeat 4 times)",
      7: "Second target for controlled pairs",
      8: "Ready, five shots weak hand",
      9: "Draw, one shot",
      10: "Draw, one on 9 → reload → one on 10 (repeat 3 times)"
    },

    scoring: {
      mode: "binary-10",
      maxScore: 10,
      allowStar: true,
      starLabel: "Center hit",
      passValue: 1,
      missValue: 0,
      notes: [
        "1 point per lane",
        "Bullet breaking the line counts",
        "Maximum score = 10"
      ],
      rules: [
        "Multiple hits in a lane count once",
        "Center hits earn a star"
      ]
    },

    progression: {
      maxLevel: 5,
      levels: {
        1: {
          label: "LEVEL 1",
          stars: 1,
          requirementText: "Complete 1 verified session",
          unlockedBy(history) {
            return history.length >= 1;
          }
        },
        2: {
          label: "LEVEL 2",
          stars: 2,
          requirementText: "Reach 7/10 once",
          unlockedBy(history) {
            return history.some(s => scoreSession(s) >= 7);
          }
        },
        3: {
          label: "LEVEL 3",
          stars: 3,
          requirementText: "Reach 8/10 twice",
          unlockedBy(history) {
            return history.filter(s => scoreSession(s) >= 8).length >= 2;
          }
        },
        4: {
          label: "LEVEL 4",
          stars: 4,
          requirementText: "Reach 9/10 twice",
          unlockedBy(history) {
            return history.filter(s => scoreSession(s) >= 9).length >= 2;
          }
        },
        5: {
          label: "LEVEL 5",
          stars: 5,
          requirementText: "Shoot a clean 10/10",
          unlockedBy(history) {
            return history.some(s => scoreSession(s) === 10);
          }
        }
      }
    }
  }
};

function scoreSession(session) {
  if (!session || !Array.isArray(session.hits)) return 0;
  return session.hits.reduce((sum, v) => sum + (Number(v) ? 1 : 0), 0);
}

window.TNS_getDrill = function (drillId) {
  return window.TNS_DRILLS[drillId] || window.TNS_DRILLS["back-to-basics"];
};

window.TNS_scoreSession = scoreSession;

window.TNS_getCurrentLevel = function (drill, history) {
  const safeHistory = Array.isArray(history) ? history : [];
  let current = 1;

  for (let level = 1; level <= drill.progression.maxLevel; level++) {
    const def = drill.progression.levels[level];
    if (def && def.unlockedBy(safeHistory)) current = level;
  }

  return current;
};

window.TNS_getNextRequirementText = function (drill, history) {
  const current = window.TNS_getCurrentLevel(drill, history);
  if (current >= drill.progression.maxLevel) return "MAX LEVEL REACHED";

  const nextLevel = drill.progression.levels[current + 1];
  return nextLevel ? nextLevel.requirementText : "";
};

window.TNS_getLevelStars = function (drill, history) {
  const current = window.TNS_getCurrentLevel(drill, history);
  const filled = drill.progression.levels[current].stars || current;
  return "★".repeat(filled) + "☆".repeat(drill.progression.maxLevel - filled);
};
