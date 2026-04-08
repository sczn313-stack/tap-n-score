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
    el.summaryChip.textContent =
      `${fmt2(windageClicks)} ${windageDirection} | ${fmt2(elevationClicks)} ${elevationDirection}`;
  }

  function getHistory() {
    const history = safeParse(localStorage.getItem(HISTORY_KEY), []);
    return Array.isArray(history) ? history : [];
  }

  function setHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  }

  function pushCurrentToHistory(payload) {
    const entry = {
      ts: Date.now(),
      score: clampScore(payload.score),
      yds: Math.round(toNum(payload.distanceYards, 0)),
      hits: Math.max(0, Math.round(toNum(payload.hits, 0))),
      windageClicks: Math.abs(toNum(payload.windageClicks, 0)),
      windageDirection: upper(payload.windageDirection, "LEFT"),
      elevationClicks: Math.abs(toNum(payload.elevationClicks, 0)),
      elevationDirection: upper(payload.elevationDirection, "DOWN")
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
        upper(x.windageDirection),
        fmt2(x.elevationClicks),
        upper(x.elevationDirection)
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
      el.historyList.innerHTML = `<div class="history-row">01. No saved sessions yet</div>`;
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
    try { window.scrollTo({ top: 0, behavior: "instant" }); }
    catch { window.scrollTo(0, 0); }
  }

  function showHistoryView() {
    renderHistory();
    el.viewHistory.classList.add("view-on");
    el.viewScore.classList.remove("view-on");
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
