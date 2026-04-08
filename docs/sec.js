(() => {
  const qs = new URLSearchParams(window.location.search);

  const $ = (id) => document.getElementById(id);

  const el = {
    viewScore: $("viewScore"),
    viewHistory: $("viewHistory"),

    scoreValue: $("scoreValue"),
    scoreBand: $("scoreBand"),

    windageValue: $("windageValue"),
    windageDir: $("windageDir"),
    elevationValue: $("elevationValue"),
    elevationDir: $("elevationDir"),

    distanceChip: $("distanceChip"),
    hitsChip: $("hitsChip"),
    summaryChip: $("summaryChip"),

    highestValue: $("highestValue"),
    averageValue: $("averageValue"),
    historyList: $("historyList"),

    saveBtn: $("saveBtn"),
    resetBtn: $("resetBtn"),
    historyBtn: $("historyBtn"),

    historySaveBtn: $("historySaveBtn"),
    historyResetBtn: $("historyResetBtn"),
    backToScoreBtn: $("backToScoreBtn")
  };

  const HISTORY_KEY = "sczn3_shooter_history";
  const SEC_KEY = "sczn3_sec_payload";

  function toNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function clampScore(v) {
    const n = Math.round(toNum(v, 50));
    return Math.max(0, Math.min(100, n));
  }

  function fmt2(v) {
    return toNum(v, 0).toFixed(2);
  }

  function normalizeDir(value, fallbackPositive, fallbackNegative) {
    const n = toNum(value, 0);
    return n >= 0 ? fallbackPositive : fallbackNegative;
  }

  function stripSign(v) {
    return Math.abs(toNum(v, 0));
  }

  function getSecPayload() {
    const fromSession = safeParse(sessionStorage.getItem(SEC_KEY), null);
    const fromLocal = safeParse(localStorage.getItem(SEC_KEY), null);

    if (fromSession && typeof fromSession === "object") return fromSession;
    if (fromLocal && typeof fromLocal === "object") return fromLocal;

    const score = toNum(qs.get("score"), 50);
    const windage = toNum(qs.get("windage"), 13.56);
    const elevation = toNum(qs.get("elevation"), 12.57);
    const distanceYds = toNum(qs.get("yds"), 200);
    const hits = toNum(qs.get("hits"), 4);

    return {
      score,
      windageClicks: Math.abs(windage),
      windageDirection: windage >= 0 ? "LEFT" : "RIGHT",
      elevationClicks: Math.abs(elevation),
      elevationDirection: elevation >= 0 ? "DOWN" : "UP",
      distanceYards: distanceYds,
      hits
    };
  }

  function getHistory() {
    const history = safeParse(localStorage.getItem(HISTORY_KEY), []);
    return Array.isArray(history) ? history : [];
  }

  function setHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  }

  function bandForScore(score) {
    if (score >= 85) {
      return {
        text: "LOCKED IN — VERIFY AND CONFIRM",
        className: "band-high"
      };
    }
    if (score >= 60) {
      return {
        text: "ON TARGET — ADJUST TO CENTER",
        className: "band-mid"
      };
    }
    return {
      text: "OFF CENTER — APPLY CORRECTION",
      className: "band-low"
    };
  }

  function renderScore(payload) {
    const score = clampScore(payload.score);
    const windageClicks = stripSign(payload.windageClicks);
    const elevationClicks = stripSign(payload.elevationClicks);
    const windageDirection = (payload.windageDirection || normalizeDir(payload.windageClicks, "LEFT", "RIGHT")).toUpperCase();
    const elevationDirection = (payload.elevationDirection || normalizeDir(payload.elevationClicks, "DOWN", "UP")).toUpperCase();
    const distanceYards = Math.round(toNum(payload.distanceYards, 200));
    const hits = Math.max(0, Math.round(toNum(payload.hits, payload.shots || 0)));

    el.scoreValue.textContent = String(score);

    const band = bandForScore(score);
    el.scoreBand.textContent = band.text;
    el.scoreBand.classList.remove("band-low", "band-mid", "band-high");
    el.scoreBand.classList.add(band.className);

    el.windageValue.textContent = fmt2(windageClicks);
    el.windageDir.textContent = windageDirection;

    el.elevationValue.textContent = fmt2(elevationClicks);
    el.elevationDir.textContent = elevationDirection;

    el.distanceChip.textContent = `${distanceYards} yds`;
    el.hitsChip.textContent = `${hits} ${hits === 1 ? "hit" : "hits"}`;
    el.summaryChip.textContent = `${fmt2(windageClicks)} ${windageDirection} | ${fmt2(elevationClicks)} ${elevationDirection}`;
  }

  function pushCurrentToHistory(payload) {
    const entry = {
      ts: Date.now(),
      score: clampScore(payload.score),
      yds: Math.round(toNum(payload.distanceYards, 200)),
      hits: Math.max(0, Math.round(toNum(payload.hits, payload.shots || 0))),
      windageClicks: stripSign(payload.windageClicks),
      windageDirection: (payload.windageDirection || normalizeDir(payload.windageClicks, "LEFT", "RIGHT")).toUpperCase(),
      elevationClicks: stripSign(payload.elevationClicks),
      elevationDirection: (payload.elevationDirection || normalizeDir(payload.elevationClicks, "DOWN", "UP")).toUpperCase()
    };

    const existing = getHistory();

    const dedupeKey = [
      entry.score,
      entry.yds,
      entry.hits,
      fmt2(entry.windageClicks),
      entry.windageDirection,
      fmt2(entry.elevationClicks),
      entry.elevationDirection
    ].join("|");

    const alreadyExists = existing.some((x) => {
      const key = [
        clampScore(x.score),
        Math.round(toNum(x.yds, 0)),
        Math.round(toNum(x.hits, 0)),
        fmt2(x.windageClicks),
        String(x.windageDirection || "").toUpperCase(),
        fmt2(x.elevationClicks),
        String(x.elevationDirection || "").toUpperCase()
      ].join("|");
      return key === dedupeKey;
    });

    const next = alreadyExists ? existing : [entry, ...existing];
    setHistory(next);
  }

  function renderHistory() {
    const history = getHistory().slice(0, 10);

    if (!history.length) {
      el.highestValue.textContent = "0";
      el.averageValue.textContent = "0.00";
      el.historyList.innerHTML = `
        <div class="history-row">01. No saved sessions yet</div>
      `;
      return;
    }

    const scores = history.map((x) => clampScore(x.score));
    const highest = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    el.highestValue.textContent = String(highest);
    el.averageValue.textContent = avg.toFixed(2);

    el.historyList.innerHTML = history.map((row, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const score = clampScore(row.score);
      const yds = Math.round(toNum(row.yds, 0));
      const hits = Math.round(toNum(row.hits, 0));

      return `
        <div class="history-row">
          <span>${num}. ${score}</span>
          <span>|</span>
          <span>${yds} yds</span>
          <span>|</span>
          <span>${hits} ${hits === 1 ? "hit" : "hits"}</span>
        </div>
      `;
    }).join("");
  }

  function showScoreView() {
    el.viewScore.classList.add("view-on");
    el.viewHistory.classList.remove("view-on");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showHistoryView() {
    renderHistory();
    el.viewHistory.classList.add("view-on");
    el.viewScore.classList.remove("view-on");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function saveReportImage() {
    window.print();
  }

  function resetFlow() {
    try { sessionStorage.removeItem(SEC_KEY); } catch {}
    try { sessionStorage.removeItem("sczn3_active_target"); } catch {}
    try { sessionStorage.removeItem("sczn3_b2b_entry_context"); } catch {}

    const resetUrl = "./index.html";
    window.location.href = resetUrl;
  }

  function bindEvents() {
    el.historyBtn?.addEventListener("click", showHistoryView);
    el.backToScoreBtn?.addEventListener("click", showScoreView);

    el.saveBtn?.addEventListener("click", saveReportImage);
    el.historySaveBtn?.addEventListener("click", saveReportImage);

    el.resetBtn?.addEventListener("click", resetFlow);
    el.historyResetBtn?.addEventListener("click", resetFlow);
  }

  function init() {
    const payload = getSecPayload();

    try {
      sessionStorage.setItem(SEC_KEY, JSON.stringify(payload));
      localStorage.setItem(SEC_KEY, JSON.stringify(payload));
    } catch {}

    renderScore(payload);
    pushCurrentToHistory(payload);
    renderHistory();
    bindEvents();
    showScoreView();
  }

  init();
})();
