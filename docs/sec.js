/* ============================================================
   docs/sec.js (FULL REPLACEMENT — LOCKED)
   TWO-PAGE SEC (Precision → Report)

   - Vendor ALWAYS resolved (payload OR localStorage)
   - History (last 10)
   - Canvas report image
   - Back button fix (both pages)
   - Clean, stable, no drift
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Views
  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");

  const toReportBtn = $("toReportBtn");

  // 🔒 Back buttons (both supported)
  const backBtn = $("backBtn");
  const backBtnReport = $("backBtnReport");

  // Page 1
  const scoreValue = $("scoreValue");
  const scoreBand = $("scoreBand");
  const runDistance = $("runDistance");
  const runHits = $("runHits");
  const runTime = $("runTime");
  const windageBig = $("windageBig");
  const windageDir = $("windageDir");
  const elevationBig = $("elevationBig");
  const elevationDir = $("elevationDir");
  const goHomeBtn = $("goHomeBtn");

  // Page 2
  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");

  // Storage
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_TARGET_IMG_DATA = "SCZN3_TARGET_IMG_DATAURL_V1";
  const KEY_TARGET_IMG_BLOB = "SCZN3_TARGET_IMG_BLOBURL_V1";

  const KEY_VENDOR_URL  = "SCZN3_VENDOR_URL_V1";
  const KEY_VENDOR_NAME = "SCZN3_VENDOR_NAME_V1";

  const KEY_HISTORY = "SCZN3_SEC_HISTORY_V1";
  const KEEP_N = 10;

  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  // -----------------------------
  // Helpers
  // -----------------------------
  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function b64ToObj(b64) {
    try {
      const json = decodeURIComponent(escape(atob(String(b64 || ""))));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function nowStamp() {
    const d = new Date();
    return d.toLocaleString();
  }

  function domainFromUrl(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  }

  function isBaker(url) {
    const d = domainFromUrl(url || "");
    return d.includes("baker");
  }

  // -----------------------------
  // Vendor Resolution (LOCKED)
  // -----------------------------
  function resolveVendor(payload) {
    const fromPayloadUrl = String(payload?.vendorUrl || "");
    const fromStorageUrl = String(localStorage.getItem(KEY_VENDOR_URL) || "");

    const vendorUrl =
      fromPayloadUrl.startsWith("http") ? fromPayloadUrl : fromStorageUrl;

    const fromPayloadName = String(payload?.vendorName || "");
    const fromStorageName = String(localStorage.getItem(KEY_VENDOR_NAME) || "");

    let vendorName = fromPayloadName || fromStorageName;

    if (!vendorName) {
      vendorName = isBaker(vendorUrl)
        ? "BAKER TARGETS"
        : (domainFromUrl(vendorUrl) || "VENDOR");
    }

    payload.vendorUrl = vendorUrl;
    payload.vendorName = vendorName;

    return { vendorUrl, vendorName };
  }

  // -----------------------------
  // Image Load
  // -----------------------------
  function loadTargetImageUrl() {
    const d = localStorage.getItem(KEY_TARGET_IMG_DATA) || "";
    if (d.startsWith("data:image/")) return d;

    const b = localStorage.getItem(KEY_TARGET_IMG_BLOB) || "";
    if (b.startsWith("blob:")) return b;

    return "";
  }

  // -----------------------------
  // Score Band
  // -----------------------------
  function scoreBandInfo(score) {
    const s = Number(score);

    if (s >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT" };
    if (s >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID" };
    return { cls: "scoreBandRed", text: "NEEDS WORK" };
  }

  // -----------------------------
  // History
  // -----------------------------
  function loadHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_HISTORY) || "[]");
    return Array.isArray(arr) ? arr : [];
  }

  function saveHistory(arr) {
    try { localStorage.setItem(KEY_HISTORY, JSON.stringify(arr)); } catch {}
  }

  function pushHistory(payload) {
    const hist = loadHistory();

    hist.unshift({
      t: Date.now(),
      score: Number(payload?.score || 0)
    });

    saveHistory(hist.slice(0, KEEP_N));
    return hist;
  }

  // -----------------------------
  // Canvas Report (SIMPLIFIED)
  // -----------------------------
  async function drawReport(payload) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1400;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0a0f1f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";

    ctx.fillText(`Score: ${Math.round(payload.score || 0)}`, 540, 200);

    ctx.font = "28px Arial";

    ctx.fillText(
      `${payload.debug?.distanceYds || 100} yds`,
      540,
      300
    );

    ctx.fillText(
      `${fmt2(payload.windage?.clicks)} ${payload.windage?.dir}`,
      540,
      360
    );

    ctx.fillText(
      `${fmt2(payload.elevation?.clicks)} ${payload.elevation?.dir}`,
      540,
      420
    );

    return canvas.toDataURL("image/png");
  }

  // -----------------------------
  // Load Payload
  // -----------------------------
  function loadPayload() {
    const qp = getQueryParam("payload");
    if (qp) {
      const obj = b64ToObj(qp);
      if (obj) return obj;
    }

    return safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "");
  }

  // -----------------------------
  // Views
  // -----------------------------
  function showPrecision() {
    viewPrecision.classList.add("viewOn");
    viewReport.classList.remove("viewOn");
  }

  function showReport() {
    viewPrecision.classList.remove("viewOn");
    viewReport.classList.add("viewOn");
  }

  // -----------------------------
  // Render Page 1
  // -----------------------------
  function renderPrecision(payload) {
    const score = Number(payload?.score || 0);
    const band = scoreBandInfo(score);

    scoreValue.textContent = Math.round(score);

    scoreBand.className = `score-band ${band.cls}`;
    scoreBand.textContent = band.text;

    windageBig.textContent = fmt2(payload?.windage?.clicks);
    windageDir.textContent = payload?.windage?.dir;

    elevationBig.textContent = fmt2(payload?.elevation?.clicks);
    elevationDir.textContent = payload?.elevation?.dir;

    runDistance.textContent = `${payload?.debug?.distanceYds || 100} yds`;
    runHits.textContent = `${payload?.shots || 0} hits`;
    runTime.textContent = nowStamp();
  }

  // -----------------------------
  // Render Page 2
  // -----------------------------
  async function renderReport(payload) {
    const { vendorUrl } = resolveVendor(payload);

    if (vendorUrl) {
      vendorBtn.href = vendorUrl;
      vendorBtn.textContent = isBaker(vendorUrl)
        ? "Baker Targets — Shop Targets"
        : "Visit Vendor";
    }

    surveyBtn.href = DEFAULT_SURVEY_URL;

    const img = await drawReport(payload);
    secCardImg.src = img;
  }

  // -----------------------------
  // Boot
  // -----------------------------
  const payload = loadPayload();

  if (!payload) {
    alert("No SEC data found.");
    return;
  }

  resolveVendor(payload);
  pushHistory(payload);

  renderPrecision(payload);
  showPrecision();

  // -----------------------------
  // Events
  // -----------------------------
  toReportBtn.addEventListener("click", async () => {
    showReport();
    await renderReport(payload);
  });

  if (backBtn) {
    backBtn.addEventListener("click", showPrecision);
  }

  if (backBtnReport) {
    backBtnReport.addEventListener("click", showPrecision);
  }

  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }

})();      const raw = url.searchParams.get("payload");
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

  function normalizePayload(payload) {
    const resolvedTargetKey =
      String(payload?.target?.key || payload?.targetKey || "").toLowerCase() ||
      String(localStorage.getItem(KEY_TARGET) || "").toLowerCase() ||
      String(sessionStorage.getItem("sczn3_active_target") || "").toLowerCase();

    return {
      ...payload,
      sessionId: payload?.sessionId || ("sec_" + Date.now().toString(36)),
      score: Number(payload?.score ?? payload?.smartScore ?? 0),
      shots: Number(payload?.shots ?? 0),
      windage: {
        dir: String(payload?.windage?.dir || "NONE"),
        clicks: Number(payload?.windage?.clicks ?? 0)
      },
      elevation: {
        dir: String(payload?.elevation?.dir || "NONE"),
        clicks: Number(payload?.elevation?.clicks ?? 0)
      },
      dial: {
        unit: String(payload?.dial?.unit || "MOA"),
        clickValue: Number(payload?.dial?.clickValue ?? 0.25)
      },
      debug: {
        distanceYds: Number(payload?.debug?.distanceYds ?? 0),
        inches: {
          x: Number(payload?.debug?.inches?.x ?? 0),
          y: Number(payload?.debug?.inches?.y ?? 0),
          r: Number(payload?.debug?.inches?.r ?? 0)
        }
      },
      target: {
        key: resolvedTargetKey,
        name: String(payload?.target?.name || ""),
        wIn: Number(payload?.target?.wIn ?? 0),
        hIn: Number(payload?.target?.hIn ?? 0)
      },
      targetKey: resolvedTargetKey
    };
  }

  function getTargetKey(payload) {
    const fromPayload = String(payload?.target?.key || payload?.targetKey || "").toLowerCase();
    if (fromPayload) return fromPayload;

    try {
      const fromLocal = String(localStorage.getItem(KEY_TARGET) || "").toLowerCase();
      if (fromLocal) return fromLocal;
    } catch {}

    try {
      const fromSession = String(sessionStorage.getItem("sczn3_active_target") || "").toLowerCase();
      if (fromSession) return fromSession;
    } catch {}

    return "";
  }

  function getTargetDisplayTitle(payload) {
    const key = getTargetKey(payload);
    if (key === "st100") return "ST100";
    if (key === "b2b") return "Back to Basics";
    return "Shooter Experience Card";
  }

  function getTargetSummaryCopy(payload) {
    const key = getTargetKey(payload);
    if (key === "st100") return "Understand and act on your zero performance";
    if (key === "b2b") return "Understand and act on your performance";
    return "Understand and act on your performance";
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
      target_key: getTargetKey(payload),
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

  function getTodayLabel() {
    return new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
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

  function getHistory() {
    return safeJsonParse(localStorage.getItem(KEY_HISTORY) || "[]", []);
  }

  function saveHistory(items) {
    try {
      localStorage.setItem(KEY_HISTORY, JSON.stringify(items));
    } catch {}
  }

  function getBest() {
    return safeJsonParse(localStorage.getItem(KEY_BEST) || "", null);
  }

  function saveBest(item) {
    try {
      localStorage.setItem(KEY_BEST, JSON.stringify(item));
    } catch {}
  }

  function makeSessionRecord(payload) {
    return {
      id: getSessionId(payload),
      date: getTodayLabel(),
      ts: new Date().toISOString(),
      title: getTargetDisplayTitle(payload),
      score: Number(payload?.score || 0),
      shots: Number(payload?.shots || 0),
      windage: {
        dir: String(payload?.windage?.dir || "NONE"),
        clicks: Number(format2(payload?.windage?.clicks || 0))
      },
      elevation: {
        dir: String(payload?.elevation?.dir || "NONE"),
        clicks: Number(format2(payload?.elevation?.clicks || 0))
      },
      dial: {
        unit: String(payload?.dial?.unit || ""),
        clickValue: Number(format2(payload?.dial?.clickValue || 0))
      },
      distanceYds: Number(payload?.debug?.distanceYds || 0),
      deltaX: Number(format2(payload?.debug?.inches?.x || 0)),
      deltaY: Number(format2(payload?.debug?.inches?.y || 0)),
      groupOffset: Number(format2(payload?.debug?.inches?.r || 0)),
      target: {
        key: getTargetKey(payload),
        name: String(payload?.target?.name || ""),
        wIn: Number(payload?.target?.wIn || 0),
        hIn: Number(payload?.target?.hIn || 0)
      }
    };
  }

  function upsertSessionIntoHistory(payload) {
    const record = makeSessionRecord(payload);
    const history = getHistory();

    const withoutCurrent = history.filter((item) => item.id !== record.id);
    const next = [record, ...withoutCurrent].slice(0, 12);
    saveHistory(next);

    const currentBest = getBest();
    if (!currentBest || Number(record.score) > Number(currentBest.score || 0)) {
      saveBest(record);
      return { record, isNewBest: true };
    }

    return { record, isNewBest: false };
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
      { label: "SMART SCORE", value: `${score}/100`, star: false },
      { label: "SHOTS", value: String(shots), star: false },
      { label: "DISTANCE", value: `${distance} yds`, star: false },
      { label: "DIAL", value: `${clickValue} ${dialUnit}`, star: false },
      { label: "WINDAGE", value: `${windageDir} ${windageClicks} clicks`, star: true },
      { label: "ELEVATION", value: `${elevationDir} ${elevationClicks} clicks`, star: true },
      { label: "DELTA X", value: `${dx}"`, star: false },
      { label: "DELTA Y", value: `${dy}"`, star: false },
      { label: "GROUP OFFSET", value: `${radius}"`, star: false },
      { label: "SESSION", value: "VERIFIED", star: score >= 90 }
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
      <span class="col-date">${getTodayLabel()}</span>
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

  function buildHistoryHtml() {
    const items = getHistory();
    if (!items.length) {
      return `<div style="padding:14px 4px;color:#dfe8ff;font-size:16px;font-weight:700;">No saved sessions yet.</div>`;
    }

    return `
      <div style="padding:8px 4px 2px;">
        ${items.map((item) => `
          <div style="
            padding:12px 10px;
            border-bottom:1px solid rgba(255,255,255,.08);
            color:#f4f7ff;
            display:grid;
            grid-template-columns: 1fr auto;
            gap:8px;
            align-items:center;
          ">
            <div>
              <div style="font-weight:900;font-size:17px;">${item.date} • ${item.title}</div>
              <div style="margin-top:4px;color:#dbe4ff;font-size:14px;">
                ${item.score}/100 • ${item.shots} shots • ${item.distanceYds} yds
              </div>
              <div style="margin-top:4px;color:#f1cd69;font-size:14px;font-weight:700;">
                ${item.windage.dir} ${format2(item.windage.clicks)} clicks •
                ${item.elevation.dir} ${format2(item.elevation.clicks)} clicks
              </div>
            </div>
            <div style="font-size:18px;font-weight:900;color:#ffd54f;">${item.score}/100</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function showHistoryModal() {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.55);
      z-index:9999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      width:min(100%,720px);
      max-height:80vh;
      overflow:auto;
      background:linear-gradient(180deg, rgba(8,20,52,.98), rgba(15,33,83,.98));
      border:1px solid rgba(255,215,84,.28);
      border-radius:20px;
      box-shadow:0 10px 26px rgba(0,0,0,.35);
      padding:16px;
      color:#fff;
    `;

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <div style="font-size:24px;font-weight:900;color:#f4f7ff;">History</div>
        <button id="secHistoryCloseBtn" style="
          border:0;
          background:linear-gradient(180deg, #4d74c8, #3156a8);
          color:#fff;
          border-radius:12px;
          padding:10px 14px;
          font-size:15px;
          font-weight:900;
          cursor:pointer;
        ">Close</button>
      </div>
      ${buildHistoryHtml()}
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    panel.querySelector("#secHistoryCloseBtn")?.addEventListener("click", close);
  }

  function render(payload) {
    const score = Number(payload?.score || 0);
    const stars = getStarsFromScore(score);
    const level = computeLevel(score, stars);
    const best = getBest();
    const title = getTargetDisplayTitle(payload);
    const summary = getTargetSummaryCopy(payload);

    document.title = `SEC — ${title}`;

    if (els.targetTitle) {
      els.targetTitle.textContent = title;
    }

    if (els.summaryCopy) {
      els.summaryCopy.textContent = summary;
    }

    if (els.bestScore) {
      els.bestScore.textContent = best ? `${Number(best.score || 0)}/100` : `${score}/100`;
    }

    if (els.bestBadge) {
      els.bestBadge.textContent = best && Number(best.score || 0) > score ? "BEST" : "NEW BEST";
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
      try {
        const grid = buildGrid(payload);
        els.gridWrap.appendChild(grid);
      } catch (e) {
        console.error("GRID ERROR:", e);
        els.gridWrap.innerHTML = `
          <div style="padding:20px;color:#ff7b7b;font-weight:700;">
            Failed to render correction grid
          </div>
        `;
      }
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
      showHistoryModal();
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
    document.title = "SEC — Shooter Experience Card";

    if (els.targetTitle) els.targetTitle.textContent = "Shooter Experience Card";
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

  let payload = getStoredPayload();
  if (payload) {
    payload = normalizePayload(payload);
  }

  if (!payload) {
    renderEmptyState();
    wireActions({});
    return;
  }

  upsertSessionIntoHistory(payload);
  render(payload);
  wireActions(payload);

  window.SEC_LIVE_PAYLOAD = payload;
})();
