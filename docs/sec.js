(() => {
  const $ = (id) => document.getElementById(id);

  const HISTORY_KEY = "sczn3_shooter_history";
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  const el = {
    scoreValue: $("scoreValue"),
    windageValue: $("windageValue"),
    windageDir: $("windageDir"),
    elevationValue: $("elevationValue"),
    elevationDir: $("elevationDir"),
    distanceChip: $("distanceChip"),
    hitsChip: $("hitsChip"),
    summaryChip: $("summaryChip"),

    highestValue: $("highestValue"),
    averageValue: $("averageValue"),
    historyList: $("historyList")
  };

  function toNum(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function fmt(v) {
    return toNum(v).toFixed(2);
  }

  function normalize(row) {
    return {
      score: Math.round(toNum(row.score)),
      yds: Math.round(toNum(row.yds ?? row.distanceYards)),
      hits: Math.round(toNum(row.hits ?? row.shots)),
      w: Math.abs(toNum(row.windageClicks)),
      wd: (row.windageDirection || "").toUpperCase(),
      e: Math.abs(toNum(row.elevationClicks)),
      ed: (row.elevationDirection || "").toUpperCase()
    };
  }

  function isGarbage(row) {
    const r = normalize(row);
    return (
      r.score === 0 &&
      r.yds === 0 &&
      r.hits === 0 &&
      r.w === 0 &&
      r.e === 0
    );
  }

  function key(row) {
    const r = normalize(row);
    return `${r.score}|${r.yds}|${r.hits}|${fmt(r.w)}|${r.wd}|${fmt(r.e)}|${r.ed}`;
  }

  function getHistory() {
    let raw = [];
    try {
      raw = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {}

    const seen = new Set();
    const clean = [];

    for (const r of raw) {
      if (!r) continue;
      if (isGarbage(r)) continue;

      const k = key(r);
      if (seen.has(k)) continue;

      seen.add(k);
      clean.push(normalize(r));
    }

    const finalList = clean.slice(0, 10);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(finalList));

    return finalList;
  }

  function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
  }

  function pushHistory(payload) {
    const row = normalize(payload);

    // 🚫 HARD BLOCK BAD DATA
    if (isGarbage(row)) return;

    const history = getHistory();

    const exists = history.some((h) => key(h) === key(row));
    if (exists) return;

    const next = [row, ...history];
    saveHistory(next);
  }

  function renderHistory() {
    const history = getHistory();

    if (!history.length) return;

    const scores = history.map((x) => x.score);
    const highest = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    el.highestValue.textContent = highest;
    el.averageValue.textContent = avg.toFixed(2);

    el.historyList.innerHTML = history.map((r, i) => {
      const n = String(i + 1).padStart(2, "0");
      return `
        <div class="history-row">
          ${n}. ${r.score} | ${r.yds} yds | ${r.hits} hits
        </div>
      `;
    }).join("");
  }

  function getPayload() {
    try {
      return JSON.parse(localStorage.getItem(SEC_KEY));
    } catch {
      return null;
    }
  }

  function renderScore(p) {
    if (!p) return;

    el.scoreValue.textContent = p.score;
    el.windageValue.textContent = fmt(p.windageClicks);
    el.windageDir.textContent = p.windageDirection;
    el.elevationValue.textContent = fmt(p.elevationClicks);
    el.elevationDir.textContent = p.elevationDirection;

    el.distanceChip.textContent = `${p.distanceYards} yds`;
    el.hitsChip.textContent = `${p.hits} hits`;

    el.summaryChip.textContent =
      `${fmt(p.windageClicks)} ${p.windageDirection} | ${fmt(p.elevationClicks)} ${p.elevationDirection}`;
  }

  function init() {
    // 🧼 CLEAN FIRST
    getHistory();

    const payload = getPayload();

    renderScore(payload);

    // 🔒 SAFE INSERT
    if (payload) pushHistory(payload);

    renderHistory();
  }

  init();
})();
