(() => {
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(window.location.search);

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
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

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
    const n = Math.round(toNum(v, 0));
    return Math.max(0, Math.min(100, n));
  }

  function fmt2(v) {
    return toNum(v, 0).toFixed(2);
  }

  function upper(v, fallback = "") {
    return String(v || fallback).trim().toUpperCase();
  }

  function decodePayloadParam() {
    const raw = qs.get("payload") || "";
    if (!raw) return null;

    try {
      const json = decodeURIComponent(escape(atob(raw)));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function normalizePayload(raw) {
    if (!raw || typeof raw !== "object") return null;

    const score = clampScore(raw.score);

    const windageClicks = toNum(
      raw.windage_clicks ?? raw.windage?.clicks ?? raw.windageClicks,
      0
    );

    const elevationClicks = toNum(
      raw.elevation_clicks ?? raw.elevation?.clicks ?? raw.elevationClicks,
      0
    );

    const windageDirection = upper(
      raw.windage_dir ?? raw.windage?.dir ?? raw.windageDirection,
      "LEFT"
    );

    const elevationDirection = upper(
      raw.elevation_dir ?? raw.elevation?.dir ?? raw.elevationDirection,
      "DOWN"
    );

    const distanceYards = Math.round(
      toNum(raw.distance_yards ?? raw.distanceYards ?? raw.yds, 0)
    );

    const hits = Math.max(
      0,
      Math.round(toNum(raw.shots ?? raw.hits, 0))
    );

    return {
      sessionId: raw.sessionId || "",
      score,
      windageClicks: Math.abs(windageClicks),
      windageDirection,
      elevationClicks: Math.abs(elevationClicks),
      elevationDirection,
      distanceYards,
      hits,
      vendorUrl: raw.vendorUrl || "",
      vendorName: raw.vendorName || "",
      dial: raw.dial || {},
      target: raw.target || {},
      debug: raw.debug || {}
    };
  }

  function getSecPayload() {
    const fromUrlPayload = normalizePayload(decodePayloadParam());
    if (fromUrlPayload) return fromUrlPayload;

    const fromSession = normalizePayload(
      safeParse(sessionStorage.getItem(SEC_KEY), null)
    );
    if (fromSession) return fromSession;

    const fromLocal = normalizePayload(
      safeParse(localStorage.getItem(SEC_KEY), null)
    );
    if (fromLocal) return fromLocal;

    const fromFlatQuery = normalizePayload({
      score: qs.get("score"),
      windage_clicks: qs.get("windage"),
      elevation_clicks: qs.get("elevation"),
      distance_yards: qs.get("yds"),
      hits: qs.get("hits"),
      windage_dir: qs.get("windage_dir") || "LEFT",
      elevation_dir: qs.get("elevation_dir") || "DOWN"
    });
    if (fromFlatQuery) return fromFlatQuery;

    return {
      sessionId: "",
      score: 0,
      windageClicks: 0,
      windageDirection: "LEFT",
      elevationClicks: 0,
      elevationDirection: "DOWN",
      distanceYards: 0,
      hits: 0,
      vendorUrl: "",
      vendorName: "",
      dial: {},
      target: {},
      debug: {}
    };
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
    const windageClicks = Math.abs(toNum(payload.windageClicks, 0));
    const elevationClicks = Math.abs(toNum(payload.elevationClicks, 0));
    const windageDirection = upper(payload.windageDirection, "LEFT");
    const elevationDirection = upper(payload.elevationDirection, "DOWN");
    const distanceYards = Math.round(toNum(payload.distanceYards, 0));
    const hits = Math.max(0, Math.round(toNum(payload.hits, 0)));

    if (el.scoreValue) el.scoreValue.textContent = String(score);

    const band = bandForScore(score);
    if (el.scoreBand) {
      el.scoreBand.textContent = band.text;
      el.scoreBand.classList.remove("band-low", "band-mid", "band-high");
      el.scoreBand.classList.add(band.className);
    }

    if (el.windageValue) el.windageValue.textContent = fmt2(windageClicks);
    if (el.windageDir) el.windageDir.textContent = windageDirection;

    if (el.elevationValue) el.elevationValue.textContent = fmt2(elevationClicks);
    if (el.elevationDir) el.elevationDir.textContent = elevationDirection;

    if (el.distanceChip) el.distanceChip.textContent = `${distanceYards} yds`;
    if (el.hitsChip) el.hitsChip.textContent = `${hits} ${hits === 1 ? "hit" : "hits"}`;
    if (el.summaryChip) {
      el.summaryChip.textContent =
        `${fmt2(windageClicks)} ${windageDirection} | ${fmt2(elevationClicks)} ${elevationDirection}`;
    }
  }

  function isMeaningfulEntry(row) {
    if (!row || typeof row !== "object") return false;

    const score = clampScore(row.score);
    const yds = Math.round(toNum(row.yds ?? row.distanceYards, 0));
    const hits = Math.round(toNum(row.hits ?? row.shots, 0));
    const windageClicks = Math.abs(toNum(row.windageClicks, 0));
    const elevationClicks = Math.abs(toNum(row.elevationClicks, 0));

    if (hits > 0) return true;
    if (yds > 0) return true;
    if (windageClicks > 0) return true;
    if (elevationClicks > 0) return true;

    return score > 0 && (yds > 0 || hits > 0 || windageClicks > 0 || elevationClicks > 0);
  }

  function normalizeHistoryRow(row) {
    return {
      ts: toNum(row.ts, Date.now()),
      score: clampScore(row.score),
      yds: Math.round(toNum(row.yds ?? row.distanceYards, 0)),
      hits: Math.max(0, Math.round(toNum(row.hits ?? row.shots, 0))),
      windageClicks: Math.abs(toNum(row.windageClicks, 0)),
      windageDirection: upper(row.windageDirection, "LEFT"),
      elevationClicks: Math.abs(toNum(row.elevationClicks, 0)),
      elevationDirection: upper(row.elevationDirection, "DOWN")
    };
  }

  function entryKey(row) {
    return [
      clampScore(row.score),
      Math.round(toNum(row.yds, 0)),
      Math.round(toNum(row.hits, 0)),
      fmt2(row.windageClicks),
      upper(row.windageDirection, "LEFT"),
      fmt2(row.elevationClicks),
      upper(row.elevationDirection, "DOWN")
    ].join("|");
  }

  function getHistory() {
    const raw = safeParse(localStorage.getItem(HISTORY_KEY), []);
    const list = Array.isArray(raw) ? raw : [];

    const cleaned = [];
    const seen = new Set();

    for (const item of list) {
      if (!isMeaningfulEntry(item)) continue;
      const row = normalizeHistoryRow(item);
      const key = entryKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(row);
    }

    return cleaned.slice(0, 10);
  }

  function setHistory(history) {
    const cleaned = [];
    const seen = new Set();

    for (const item of Array.isArray(history) ? history : []) {
      if (!isMeaningfulEntry(item)) continue;
      const row = normalizeHistoryRow(item);
      const key = entryKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(row);
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(cleaned.slice(0, 10)));
  }

  function pushCurrentToHistory(payload) {
    const entry = normalizeHistoryRow({
      ts: Date.now(),
      score: payload.score,
      yds: payload.distanceYards,
      hits: payload.hits,
      windageClicks: payload.windageClicks,
      windageDirection: payload.windageDirection,
      elevationClicks: payload.elevationClicks,
      elevationDirection: payload.elevationDirection
    });

    if (!isMeaningfulEntry(entry)) return;

    const existing = getHistory();
    const next = [entry, ...existing];
    setHistory(next);
  }

  function renderHistory() {
    const history = getHistory();

    if (!history.length) {
      if (el.highestValue) el.highestValue.textContent = "0";
      if (el.averageValue) el.averageValue.textContent = "0.00";
      if (el.historyList) {
        el.historyList.innerHTML = `<div class="history-row">01. No saved sessions yet</div>`;
      }
      return;
    }

    const scores = history.map((x) => clampScore(x.score));
    const highest = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (el.highestValue) el.highestValue.textContent = String(highest);
    if (el.averageValue) el.averageValue.textContent = avg.toFixed(2);

    if (el.historyList) {
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
  }

  function showScoreView() {
    if (el.viewScore) el.viewScore.classList.add("view-on");
    if (el.viewHistory) el.viewHistory.classList.remove("view-on");
    try { window.scrollTo({ top: 0, behavior: "instant" }); }
    catch { window.scrollTo(0, 0); }
  }

  function showHistoryView() {
    renderHistory();
    if (el.viewHistory) el.viewHistory.classList.add("view-on");
    if (el.viewScore) el.viewScore.classList.remove("view-on");
    try { window.scrollTo({ top: 0, behavior: "instant" }); }
    catch { window.scrollTo(0, 0); }
  }

  function saveReportImage() {
    window.print();
  }

  function resetFlow() {
    try { sessionStorage.removeItem(SEC_KEY); } catch {}
    window.location.href = "./index.html";
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
