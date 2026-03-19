/* ============================================================
   docs/sec.js — PROFILE-LAYOUT SEC
   - Supports drill profiles from index.js
   - Uses payload.drill.displayLayout
   - Renders profile-shaped lane map on report card
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");
  const toReportBtn = $("toReportBtn");
  const backBtn = $("backBtn");
  const replayBtn = $("replayBtn");

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

  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");

  const ladderWrap = $("ladderWrap");
  const ladderLevelChip = $("ladderLevelChip");
  const ladderStars = $("ladderStars");
  const ladderText = $("ladderText");
  const ladderNext = $("ladderNext");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function fmt2(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  }

  function nowStamp() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${mm}/${dd}/${yy} ${hh}:${mi}`;
  }

  function isDrill(payload) {
    return payload?.mode === "drill" || !!payload?.drill;
  }

  function scoreBandInfo(score, drill, maxScore) {
    const s = Number(score) || 0;

    if (drill) {
      const max = Number(maxScore) || 10;
      const pct = max > 0 ? (s / max) * 100 : 0;
      if (pct >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT", scoreCls: "scoreGood" };
      if (pct >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID", scoreCls: "scoreMid" };
      return { cls: "scoreBandRed", text: "NEEDS WORK", scoreCls: "scoreLow" };
    }

    if (s >= 90) return { cls: "scoreBandGreen", text: "STRONG / EXCELLENT", scoreCls: "scoreGood" };
    if (s >= 60) return { cls: "scoreBandYellow", text: "IMPROVING / SOLID", scoreCls: "scoreMid" };
    return { cls: "scoreBandRed", text: "NEEDS WORK", scoreCls: "scoreLow" };
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

  function showPrecision() {
    viewPrecision?.classList.add("viewOn");
    viewReport?.classList.remove("viewOn");
    try { window.scrollTo(0, 0); } catch {}
  }

  function showReport() {
    viewPrecision?.classList.remove("viewOn");
    viewReport?.classList.add("viewOn");
    try { window.scrollTo(0, 0); } catch {}
  }

  function renderLadder(payload) {
    if (!ladderWrap) return;

    const profileId = String(payload?.profileId || payload?.drill?.mode || "");
    const drill = isDrill(payload);

    if (!drill || !profileId.includes("b2b")) {
      ladderWrap.hidden = true;
      return;
    }

    const score = Number(payload?.score || 0);
    const maxScore = Number(payload?.maxScore || payload?.drill?.maxScore || 10);

    ladderWrap.hidden = false;

    if (score >= maxScore) {
      ladderLevelChip.textContent = "LEVEL MAX";
      ladderStars.textContent = "★★★★★";
      ladderText.textContent = "Clean run achieved.";
      ladderNext.textContent = "Next: Repeat and confirm consistency.";
      return;
    }

    if (score >= Math.ceil(maxScore * 0.8)) {
      ladderLevelChip.textContent = "LEVEL 4";
      ladderStars.textContent = "★★★★☆";
      ladderText.textContent = "Strong drill performance.";
      ladderNext.textContent = `Next: Reach ${maxScore}/${maxScore}.`;
      return;
    }

    if (score >= Math.ceil(maxScore * 0.6)) {
      ladderLevelChip.textContent = "LEVEL 3";
      ladderStars.textContent = "★★★☆☆";
      ladderText.textContent = "Solid progress.";
      ladderNext.textContent = `Next: Reach ${Math.ceil(maxScore * 0.8)}/${maxScore}.`;
      return;
    }

    if (score >= Math.ceil(maxScore * 0.4)) {
      ladderLevelChip.textContent = "LEVEL 2";
      ladderStars.textContent = "★★☆☆☆";
      ladderText.textContent = "Foundational progress.";
      ladderNext.textContent = `Next: Reach ${Math.ceil(maxScore * 0.6)}/${maxScore}.`;
      return;
    }

    ladderLevelChip.textContent = "LEVEL 1";
    ladderStars.textContent = "★☆☆☆☆";
    ladderText.textContent = "Complete one verified drill session.";
    ladderNext.textContent = `Next: Reach ${Math.ceil(maxScore * 0.4)}/${maxScore}.`;
  }

  function renderPrecision(payload) {
    const drill = isDrill(payload);
    const score = Number(payload?.score || 0);
    const maxScore = Number(payload?.maxScore || payload?.drill?.maxScore || 10);
    const band = scoreBandInfo(score, drill, maxScore);

    if (scoreValue) scoreValue.textContent = String(Math.round(score));
    if (scoreBand) {
      scoreBand.textContent = band.text;
      scoreBand.className = "scoreBand " + band.cls;
    }

    if (scoreValue) {
      scoreValue.classList.remove("scoreGood", "scoreMid", "scoreLow");
      if (band.scoreCls) scoreValue.classList.add(band.scoreCls);
    }

    if (drill) {
      const taps = Number(payload?.taps ?? payload?.hits ?? payload?.shots ?? 0);
      const dist = Number(payload?.distanceYds ?? 0);

      if (windageBig) windageBig.textContent = `${Math.round(score)}`;
      if (windageDir) windageDir.textContent = `/${maxScore}`;

      if (elevationBig) elevationBig.textContent = `${taps}`;
      if (elevationDir) elevationDir.textContent = "TAPS";

      if (runDistance) runDistance.textContent = dist ? `${Math.round(dist)} yds` : "DRILL MODE";
      if (runHits) runHits.textContent = `${taps} taps`;
      if (runTime) runTime.textContent = nowStamp();

      renderLadder(payload);
      return;
    }

    if (ladderWrap) ladderWrap.hidden = true;

    if (windageBig) windageBig.textContent = fmt2(payload?.windage?.clicks);
    if (windageDir) windageDir.textContent = payload?.windage?.dir || "—";
    if (elevationBig) elevationBig.textContent = fmt2(payload?.elevation?.clicks);
    if (elevationDir) elevationDir.textContent = payload?.elevation?.dir || "—";

    if (runDistance) runDistance.textContent = `${Math.round(payload?.distanceYds || 100)} yds`;
    if (runHits) runHits.textContent = `${payload?.shots || 0} hits`;
    if (runTime) runTime.textContent = nowStamp();
  }

  async function drawReport(payload) {
    const drill = isDrill(payload);

    const W = 1080;
    const H = 1920;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#06070a";
    ctx.fillRect(0, 0, W, H);

    const score = Number(payload?.score || 0);
    const maxScore = Number(payload?.maxScore || payload?.drill?.maxScore || 10);

    // Header score
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 120px system-ui";
    ctx.fillText(String(Math.round(score)), W / 2, 250);

    ctx.font = "700 32px system-ui";
    ctx.fillStyle = "rgba(255,255,255,.72)";

    if (drill) {
      const taps = Number(payload?.taps ?? payload?.hits ?? payload?.shots ?? 0);
      const dist = Number(payload?.distanceYds ?? 0);
      const profileName = String(payload?.profileName || payload?.drill?.name || "DRILL");
      const prefix = dist ? `${Math.round(dist)} yds | ` : "";
      ctx.fillText(`${prefix}${profileName} | ${taps} taps | SCORE ${Math.round(score)}/${maxScore}`, W / 2, 320);
    } else {
      const dist = Number(payload?.distanceYds ?? 0);
      const shots = Number(payload?.shots ?? 0);
      ctx.fillText(`${dist || 100} yds | ${shots} hits`, W / 2, 320);
    }

    if (drill) {
      const lanesHit = Array.isArray(payload?.drill?.lanesHit) ? payload.drill.lanesHit : [];
      const displayLayout = payload?.drill?.displayLayout || {};
      const laneSet = new Set(lanesHit);

      const centerX = W / 2;
      const boxTop = 420;
      const boxSize = 620;

      // panel
      ctx.fillStyle = "rgba(255,255,255,.05)";
      roundRect(ctx, centerX - boxSize / 2, boxTop, boxSize, boxSize, 28, true, false);

      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 2;
      roundRect(ctx, centerX - boxSize / 2, boxTop, boxSize, boxSize, 28, false, true);

      // title
      ctx.fillStyle = "rgba(255,255,255,.82)";
      ctx.font = "900 28px system-ui";
      ctx.fillText("PROFILE LANE MAP", centerX, boxTop - 22);

      const mapX = centerX - boxSize / 2;
      const mapY = boxTop;

      const ids = Object.keys(displayLayout)
        .map(Number)
        .sort((a, b) => a - b);

      ids.forEach((id) => {
        const item = displayLayout[id];
        const x = mapX + item.x * boxSize;
        const y = mapY + item.y * boxSize;
        const hit = laneSet.has(id);
        const isSquare = item.shape === "square";
        const size = 42;

        ctx.beginPath();
        if (isSquare) {
          ctx.rect(x - size, y - size, size * 2, size * 2);
        } else {
          ctx.arc(x, y, size, 0, Math.PI * 2);
        }

        ctx.fillStyle = hit ? "#48ff8b" : "#ff4d4d";
        ctx.fill();

        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,.5)";
        ctx.stroke();

        ctx.fillStyle = "rgba(0,0,0,.82)";
        ctx.font = "900 34px system-ui";
        ctx.fillText(String(id), x, y + 12);
      });

      ctx.fillStyle = "rgba(255,255,255,.82)";
      ctx.font = "900 26px system-ui";
      ctx.fillText(`COUNTED LANES: ${lanesHit.join(", ") || "NONE"}`, centerX, 1120);

      // summary block
      const sumTop = 1190;
      ctx.fillStyle = "rgba(255,255,255,.05)";
      roundRect(ctx, 120, sumTop, 840, 220, 24, true, false);
      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 2;
      roundRect(ctx, 120, sumTop, 840, 220, 24, false, true);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 40px system-ui";
      ctx.fillText(`PROFILE: ${String(payload?.profileName || "").toUpperCase()}`, centerX, sumTop + 58);

      ctx.font = "800 30px system-ui";
      ctx.fillStyle = "rgba(255,255,255,.80)";
      ctx.fillText(`SCORE ${Math.round(score)}/${maxScore}`, centerX, sumTop + 112);
      ctx.fillText(`TAPS ${Number(payload?.taps ?? 0)}`, centerX, sumTop + 158);

      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = "800 22px system-ui";
      ctx.fillText(`Generated ${nowStamp()}`, centerX, 1840);

      return c.toDataURL("image/png");
    }

    // zero-mode fallback
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = "900 36px system-ui";
    ctx.fillText("PRECISION REPORT", W / 2, 520);

    ctx.font = "800 34px system-ui";
    ctx.fillText(`Windage ${fmt2(payload?.windage?.clicks)} ${payload?.windage?.dir || ""}`, W / 2, 620);
    ctx.fillText(`Elevation ${fmt2(payload?.elevation?.clicks)} ${payload?.elevation?.dir || ""}`, W / 2, 690);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "800 22px system-ui";
    ctx.fillText(`Generated ${nowStamp()}`, W / 2, 1840);

    return c.toDataURL("image/png");
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  async function renderReport(payload) {
    const img = await drawReport(payload);
    if (secCardImg) secCardImg.src = img;

    const v = payload?.vendorUrl || "#";
    if (vendorBtn) {
      vendorBtn.href = v;
      vendorBtn.textContent = "Visit Vendor";
    }

    const s = payload?.surveyUrl || DEFAULT_SURVEY_URL;
    if (surveyBtn) surveyBtn.href = s;
  }

  function goBackToLanding() {
    location.href = "./index.html?fresh=" + Date.now();
  }

  const payload = loadPayload();
  if (!payload) {
    alert("Run a target first.");
    return;
  }

  renderPrecision(payload);
  showPrecision();

  if (toReportBtn) {
    toReportBtn.onclick = async () => {
      showReport();
      await renderReport(payload);
    };
  }

  if (backBtn) backBtn.onclick = showPrecision;
  if (replayBtn) replayBtn.onclick = goBackToLanding;
  if (goHomeBtn) goHomeBtn.onclick = goBackToLanding;
})();
