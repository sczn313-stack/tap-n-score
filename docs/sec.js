(() => {
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";
  const TRACK_ENDPOINT = "https://tap-n-score-backend.onrender.com/api/track";

  const $ = (id) => document.getElementById(id);

  const els = {
    targetTitle: $("targetTitle"),
    summaryCopy: $("summaryCopy"),
    gridWrap: $("gridWrap"),
    bestScore: $("bestScore"),
    bestBadge: $("bestBadge"),
    levelLabel: $("levelLabel"),
    levelNote: $("levelNote"),
    levelPill: $("levelPill"),
    starsRow: $("starsRow"),
    backBtn: $("backBtn"),
    historyBtn: $("historyBtn"),
    newScanBtn: $("newScanBtn"),
    leaderboardBtn: $("leaderboardBtn")
  };

  function safeJsonParse(text, fallback = null) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function decodePayloadFromQuery() {
    try {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get("payload");
      if (!raw) return null;
      const json = decodeURIComponent(escape(atob(raw)));
      return safeJsonParse(json, null);
    } catch {
      return null;
    }
  }

  function getStoredPayload() {
    const fromQuery = decodePayloadFromQuery();
    if (fromQuery && typeof fromQuery === "object") {
      try {
        localStorage.setItem(KEY_PAYLOAD, JSON.stringify(fromQuery));
      } catch {}
      return fromQuery;
    }

    const fromStorage = safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "", null);
    if (fromStorage && typeof fromStorage === "object") {
      return fromStorage;
    }

    return null;
  }

  function getQueryParam(name) {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function getVendor() {
    return getQueryParam("v").toLowerCase() || "unknown";
  }

  function getSku() {
    return getQueryParam("sku").toLowerCase() || "unknown";
  }

  function getBatch() {
    return getQueryParam("b").toLowerCase() || "";
  }

  function getSessionId(payload) {
    return payload?.sessionId || ("sec_" + Date.now().toString(36));
  }

  function trackEvent(eventName, payload, extra = {}) {
    const body = {
      event: eventName,
      vendor: getVendor(),
      sku: getSku(),
      batch: getBatch(),
      page: "docs/sec",
      mode: "sec",
      session_id: getSessionId(payload),
      ts: new Date().toISOString(),
      score: Number.isFinite(Number(payload?.score)) ? Number(payload.score) : null,
      shots: Number.isFinite(Number(payload?.shots)) ? Number(payload.shots) : null,
      distance_yards: Number.isFinite(Number(payload?.debug?.distanceYds))
        ? Number(payload.debug.distanceYds)
        : null,
      dial_unit: String(payload?.dial?.unit || ""),
      click_value: Number.isFinite(Number(payload?.dial?.clickValue))
        ? Number(payload.dial.clickValue)
        : null,
      target_key: String(payload?.target?.key || ""),
      target_w_in: Number.isFinite(Number(payload?.target?.wIn))
        ? Number(payload.target.wIn)
        : null,
      target_h_in: Number.isFinite(Number(payload?.target?.hIn))
        ? Number(payload.target.hIn)
        : null,
      results_viewed: true,
      ...extra
    };

    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(() => {});
  }

  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  function format2(n) {
    return round2(n).toFixed(2);
  }

  function getStarsFromScore(score) {
    const s = Number(score) || 0;
    if (s >= 95) return 4;
    if (s >= 90) return 3;
    if (s >= 85) return 2;
    if (s >= 80) return 1;
    return 0;
  }

  function computeLevel(score, stars) {
    if (score >= 100 && stars >= 4) {
      return { level: 5, starsDisplay: "★★★★★", note: "Top tier performance" };
    }
    if (score >= 90 && stars >= 3) {
      return { level: 4, starsDisplay: "★★★★☆", note: "Reach 100 with 4 stars" };
    }
    if (score >= 85 && stars >= 2) {
      return { level: 3, starsDisplay: "★★★☆☆", note: "Reach 90 with 3 stars" };
    }
    if (score >= 80) {
      return { level: 2, starsDisplay: "★★☆☆☆", note: "Reach 85 to advance" };
    }
    return { level: 1, starsDisplay: "★☆☆☆☆", note: "Build consistency" };
  }

  function correctionRows(payload) {
    const windageDir = String(payload?.windage?.dir || "NONE");
    const windageClicks = format2(payload?.windage?.clicks || 0);
    const elevationDir = String(payload?.elevation?.dir || "NONE");
    const elevationClicks = format2(payload?.elevation?.clicks || 0);
    const shots = Number(payload?.shots || 0);
    const score = Number(payload?.score || 0);
    const distance = Number(payload?.debug?.distanceYds || 0);
    const dialUnit = String(payload?.dial?.unit || "");
    const clickValue = format2(payload?.dial?.clickValue || 0);
    const dx = format2(payload?.debug?.inches?.x || 0);
    const dy = format2(payload?.debug?.inches?.y || 0);
    const radius = format2(payload?.debug?.inches?.r || 0);

    return [
      { label: "SMART SCORE", value: `${score}/100`, kind: "check" },
      { label: "SHOTS", value: String(shots), kind: "check" },
      { label: "DISTANCE", value: `${distance} yds`, kind: "check" },
      { label: "DIAL", value: `${clickValue} ${dialUnit}`, kind: "check" },
      { label: "WINDAGE", value: `${windageDir} ${windageClicks} clicks`, kind: "check", star: true },
      { label: "ELEVATION", value: `${elevationDir} ${elevationClicks} clicks`, kind: "check", star: true },
      { label: "DELTA X", value: `${dx}"`, kind: "check" },
      { label: "DELTA Y", value: `${dy}"`, kind: "check" },
      { label: "GROUP OFFSET", value: `${radius}"`, kind: "check" },
      { label: "SESSION", value: "VERIFIED", kind: "check", star: score >= 90 }
    ];
  }

  function buildGrid(payload) {
    const rows = correctionRows(payload);

    const table = document.createElement("table");
    table.className = "sec-grid";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const thLeft = document.createElement("th");
    thLeft.innerHTML = `<span class="lanes-head">Correction Card</span>`;
    headRow.appendChild(thLeft);

    const thNow = document.createElement("th");
    thNow.innerHTML = `
      <span class="col-date">${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      <span class="col-score">${Number(payload?.score || 0)}/100</span>
      <span class="col-pct">${Number(payload?.shots || 0)} shots</span>
    `;
    headRow.appendChild(thNow);

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.className = "lane-cell";
      tdLabel.innerHTML = `
        <div class="lane-wrap">
          <div class="lane-icon">${idx + 1}</div>
          <div class="lane-num">${row.label}</div>
        </div>
      `;
      tr.appendChild(tdLabel);

      const tdValue = document.createElement("td");
      tdValue.innerHTML = `
        <span class="result-mark result-check">✓</span>
        ${row.star ? '<span class="result-star">★</span>' : ""}
        <div style="margin-top:8px;font-size:18px;font-weight:900;color:#f4f7ff;">${row.value}</div>
      `;
      tr.appendChild(tdValue);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }

  function render(payload) {
    const score = Number(payload?.score || 0);
    const stars = getStarsFromScore(score);
    const level = computeLevel(score, stars);

    if (els.targetTitle) {
      els.targetTitle.textContent = "Back to Basics";
    }

    if (els.summaryCopy) {
      els.summaryCopy.textContent = "Understand and act on your performance";
    }

    if (els.bestScore) {
      els.bestScore.textContent = `${score}/100`;
    }

    if (els.bestBadge) {
      els.bestBadge.textContent = score >= 90 ? "HOT RUN" : "SESSION";
    }

    if (els.levelLabel) {
      els.levelLabel.textContent = `LEVEL ${level.level}`;
    }

    if (els.levelPill) {
      els.levelPill.textContent = `LEVEL ${level.level}`;
    }

    if (els.starsRow) {
      els.starsRow.textContent = level.starsDisplay;
    }

    if (els.levelNote) {
      els.levelNote.textContent = level.note;
    }

    if (els.gridWrap) {
      els.gridWrap.innerHTML = "";
      els.gridWrap.appendChild(buildGrid(payload));
    }
  }

  function wireActions(payload) {
    els.backBtn?.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "./index.html";
      }
    });

    els.historyBtn?.addEventListener("click", () => {
      alert("History layer comes next.");
    });

    els.newScanBtn?.addEventListener("click", () => {
      window.location.href = "./index.html";
    });

    els.leaderboardBtn?.addEventListener("click", () => {
      alert("Leaderboard layer comes next.");
    });

    trackEvent("results_viewed", payload);
  }

  function renderEmptyState() {
    if (els.targetTitle) els.targetTitle.textContent = "Back to Basics";
    if (els.summaryCopy) els.summaryCopy.textContent = "No SEC payload found";
    if (els.bestScore) els.bestScore.textContent = "—";
    if (els.bestBadge) els.bestBadge.textContent = "EMPTY";
    if (els.levelLabel) els.levelLabel.textContent = "LEVEL —";
    if (els.levelPill) els.levelPill.textContent = "LEVEL —";
    if (els.starsRow) els.starsRow.textContent = "☆☆☆☆☆";
    if (els.levelNote) els.levelNote.textContent = "Run a scan first";

    if (els.gridWrap) {
      els.gridWrap.innerHTML = `
        <div style="padding:20px;color:#dfe8ff;font-size:18px;font-weight:700;">
          No live SEC payload was found. Go back, run a target, then open results again.
        </div>
      `;
    }
  }

  const payload = getStoredPayload();

  if (!payload) {
    renderEmptyState();
    wireActions({});
    return;
  }

  render(payload);
  wireActions(payload);

  window.SEC_LIVE_PAYLOAD = payload;
})();
