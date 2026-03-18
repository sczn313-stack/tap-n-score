/* ============================================================
   docs/sec.js — FULL REPLACEMENT
   B2B LANE VISUAL BUILD + REPLAY LOOP + PROGRESS LADDER
   + B2B DASHBOARD BRIDGE
   + FIX: replay/home preserves B2B route params
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");
  const toReportBtn = $("toReportBtn");
  const backBtn = $("backBtn");
  const replayBtn = $("replayBtn");
  const b2bDashBtn = $("b2bDashBtn");
  const b2bDashBtn2 = $("b2bDashBtn2");

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

  const ladderWrap = $("ladderWrap");
  const ladderLevelChip = $("ladderLevelChip");
  const ladderStars = $("ladderStars");
  const ladderText = $("ladderText");
  const ladderNext = $("ladderNext");

  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_B2B_LADDER = "SCZN3_B2B_LADDER_HISTORY_V1";
  const KEY_B2B_LADDER_LAST = "SCZN3_B2B_LADDER_LAST_SESSION_V1";
  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function fmt2(n) {
    return Number(n || 0).toFixed(2);
  }

  function nowStamp() {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function isB2B(payload) {
    return String(payload?.drill?.mode || "").toLowerCase() === "b2b"
      || String(payload?.sku || "").toLowerCase().includes("b2b")
      || String(payload?.target?.key || "").toLowerCase() === "bkr-b2b";
  }

  function scoreBandInfo(score, b2b) {
    const s = Number(score) || 0;
    if (b2b) {
      if (s >= 9) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT" };
      if (s >= 6) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID" };
      return { cls: "scoreBandRed", text: "NEEDS WORK" };
    }
    if (s >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT" };
    if (s >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID" };
    return { cls: "scoreBandRed", text: "NEEDS WORK" };
  }

  function loadPayload() {
    const qp = new URL(location.href).searchParams.get("payload");
    if (qp) {
      try {
        return JSON.parse(decodeURIComponent(escape(atob(qp))));
      } catch {}
    }
    return safeJsonParse(localStorage.getItem(KEY_PAYLOAD) || "");
  }

  function payloadToB64(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  }

  function goToB2BDashboard(payload) {
    const b64 = payloadToB64(payload);
    location.href = `./b2b.html?payload=${encodeURIComponent(b64)}&fresh=${Date.now()}`;
  }

  function getReturnToIndexUrl(payload) {
    const fresh = Date.now();

    if (isB2B(payload)) {
      const vendor = String(payload?.vendor || "baker").toLowerCase() || "baker";
      const sku = String(payload?.sku || payload?.target?.key || "bkr-b2b").toLowerCase() || "bkr-b2b";
      return `./index.html?v=${encodeURIComponent(vendor)}&sku=${encodeURIComponent(sku)}&fresh=${fresh}`;
    }

    return `./index.html?fresh=${fresh}`;
  }

  function showPrecision() {
    viewPrecision.classList.add("viewOn");
    viewReport.classList.remove("viewOn");
  }

  function showReport() {
    viewPrecision.classList.remove("viewOn");
    viewReport.classList.add("viewOn");
  }

  function loadLadderHistory() {
    const arr = safeJsonParse(localStorage.getItem(KEY_B2B_LADDER) || "[]");
    return Array.isArray(arr) ? arr : [];
  }

  function saveLadderHistory(arr) {
    try {
      localStorage.setItem(KEY_B2B_LADDER, JSON.stringify(arr.slice(0, 25)));
    } catch {}
  }

  function pushB2BLadderResult(payload) {
    if (!isB2B(payload)) return;

    const sid = String(payload?.sessionId || "");
    const lastSid = String(localStorage.getItem(KEY_B2B_LADDER_LAST) || "");
    if (!sid || sid === lastSid) return;

    const hist = loadLadderHistory();
    hist.unshift({
      sessionId: sid,
      score: Number(payload?.score || 0),
      ts: Date.now()
    });

    saveLadderHistory(hist);
    try {
      localStorage.setItem(KEY_B2B_LADDER_LAST, sid);
    } catch {}
  }

  function getB2BLevelState() {
    const hist = loadLadderHistory();
    const scores = hist.map(x => Number(x.score || 0));

    const defs = [
      {
        level: 1,
        stars: "★☆☆☆☆",
        text: "Complete one verified drill session.",
        next: "Next: Score 7/10 or higher once."
      },
      {
        level: 2,
        stars: "★★☆☆☆",
        text: "Unlocked: Score 7/10 or higher once.",
        next: "Next: Score 8/10 or higher twice."
      },
      {
        level: 3,
        stars: "★★★☆☆",
        text: "Unlocked: Score 8/10 or higher twice.",
        next: "Next: Score 9/10 or higher twice."
      },
      {
        level: 4,
        stars: "★★★★☆",
        text: "Unlocked: Score 9/10 or higher twice.",
        next: "Next: Shoot one clean 10/10."
      },
      {
        level: 5,
        stars: "★★★★★",
        text: "Unlocked: Clean 10/10 achieved.",
        next: "Top ladder reached."
      }
    ];

    let level = 0;
    if (scores.length >= 1) level = 1;
    if (scores.some(s => s >= 7)) level = 2;
    if (scores.filter(s => s >= 8).length >= 2) level = 3;
    if (scores.filter(s => s >= 9).length >= 2) level = 4;
    if (scores.some(s => s === 10)) level = 5;

    if (level === 0) level = 1;

    const idx = Math.max(0, Math.min(defs.length - 1, level - 1));
    return defs[idx];
  }

  function renderLadder(payload) {
    if (!ladderWrap) return;

    if (!isB2B(payload)) {
      ladderWrap.hidden = true;
      return;
    }

    const state = getB2BLevelState();
    ladderWrap.hidden = false;
    ladderLevelChip.textContent = `LEVEL ${state.level}`;
    ladderStars.textContent = state.stars;
    ladderText.textContent = state.text;
    ladderNext.textContent = state.next;
  }

  function renderB2BButtons(payload) {
    const b2b = isB2B(payload);

    if (b2bDashBtn) b2bDashBtn.hidden = !b2b;
    if (b2bDashBtn2) b2bDashBtn2.hidden = !b2b;
  }

  function renderPrecision(p) {
    const b2b = isB2B(p);
    const score = Number(p?.score || 0);
    const band = scoreBandInfo(score, b2b);

    scoreValue.textContent = Math.round(score);
    scoreBand.textContent = band.text;
    scoreBand.className = "scoreBand " + band.cls;

    if (b2b) {
      const taps = Number(p?.taps ?? p?.hits ?? p?.shots ?? 0);
      const dist = Number(p?.distanceYds ?? p?.debug?.distanceYds ?? 0);

      windageBig.textContent = Math.round(score);
      windageDir.textContent = "/10";

      elevationBig.textContent = taps;
      elevationDir.textContent = "TAPS";

      runDistance.textContent = dist ? `${Math.round(dist)} yds` : "DRILL MODE";
      runHits.textContent = `${taps} taps`;
      runTime.textContent = nowStamp();

      renderLadder(p);
      renderB2BButtons(p);
      return;
    }

    if (ladderWrap) ladderWrap.hidden = true;
    renderB2BButtons(p);

    windageBig.textContent = fmt2(p?.windage?.clicks);
    windageDir.textContent = p?.windage?.dir || "—";
    elevationBig.textContent = fmt2(p?.elevation?.clicks);
    elevationDir.textContent = p?.elevation?.dir || "—";

    runDistance.textContent = `${Math.round(p?.distanceYds || 100)} yds`;
    runHits.textContent = `${p?.shots || 0} hits`;
    runTime.textContent = nowStamp();
  }

  async function drawReport(p) {
    const b2b = isB2B(p);

    const W = 1080, H = 1920;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#06070a";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    ctx.font = "900 120px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(p.score || 0), W / 2, 380);

    ctx.font = "700 26px system-ui";
    ctx.fillStyle = "rgba(255,255,255,.75)";

    if (b2b) {
      const taps = Number(p?.taps ?? p?.hits ?? p?.shots ?? 0);
      const dist = Number(p?.distanceYds ?? p?.debug?.distanceYds ?? 0);
      const lanesHit = Array.isArray(p?.drill?.lanesHit) ? p.drill.lanesHit : [];
      const laneSet = new Set(lanesHit);

      ctx.fillText(
        `${dist ? Math.round(dist) + " yds | " : ""}DRILL MODE | ${taps} taps | SCORE ${Math.round(p.score)}/10`,
        W / 2,
        460
      );

      const total = 10;
      const cols = 5;
      const rows = 2;
      const size = 110;
      const gap = 36;

      const gridW = cols * size + (cols - 1) * gap;
      const startX = (W - gridW) / 2;
      const startY = 560;

      for (let i = 0; i < total; i++) {
        const laneId = i + 1;
        const r = Math.floor(i / cols);
        const col = i % cols;

        const x = startX + col * (size + gap);
        const y = startY + r * (size + gap);

        let color = "rgba(255,255,255,.25)";
        if (laneSet.has(laneId)) color = "#48ff8b";
        else color = "#ff4d4d";

        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,.5)";
        ctx.stroke();

        ctx.fillStyle = "rgba(0,0,0,.75)";
        ctx.font = "900 40px system-ui";
        ctx.fillText(String(laneId), x + size / 2, y + size / 2 + 14);
      }

      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.font = "900 28px system-ui";
      ctx.fillText("COUNTED LANES", W / 2, startY + rows * (size + gap) + 40);
    }

    return c.toDataURL("image/png");
  }

  async function renderReport(p) {
    const img = await drawReport(p);
    secCardImg.src = img;

    const v = p.vendorUrl || "#";
    vendorBtn.href = v;
    vendorBtn.textContent = "Visit Vendor";

    const s = p.surveyUrl || DEFAULT_SURVEY_URL;
    surveyBtn.href = s;

    renderB2BButtons(p);
  }

  function goBackToLanding(payload) {
    location.href = getReturnToIndexUrl(payload);
  }

  const payload = loadPayload();
  if (!payload) {
    alert("Run a target first.");
    return;
  }

  pushB2BLadderResult(payload);
  renderPrecision(payload);
  showPrecision();

  toReportBtn.onclick = async () => {
    showReport();
    await renderReport(payload);
  };

  backBtn.onclick = showPrecision;

  if (replayBtn) {
    replayBtn.onclick = () => goBackToLanding(payload);
  }

  if (goHomeBtn) {
    goHomeBtn.onclick = () => goBackToLanding(payload);
  }

  if (b2bDashBtn) {
    b2bDashBtn.onclick = () => goToB2BDashboard(payload);
  }

  if (b2bDashBtn2) {
    b2bDashBtn2.onclick = () => goToB2BDashboard(payload);
  }
})();
