/* docs/trophy.js (FULL REPLACEMENT) — reads session log, shows Top + Recent */

(() => {
  const $ = (id) => document.getElementById(id);

  const elBackSec = $("backSecBtn");
  const elBackTarget = $("backTargetBtn");
  const elClearLog = $("clearLogBtn");

  const elCount = $("countSessions");
  const elBest = $("bestScore");
  const elAvg = $("avgScore");

  const elTop = $("topList");
  const elRecent = $("recentList");
  const elEmpty = $("emptyState");
  const elBuild = $("tinyBuild");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const KEY_SESSIONS = "SCZN3_SESSIONS_V1";

  const BUILD = "TROPHY-0216A";

  function safeJSON(s){ try { return JSON.parse(String(s||"")); } catch { return null; } }

  function fmtTime(ts){
    try {
      const d = new Date(ts);
      const hh = d.getHours();
      const mm = String(d.getMinutes()).padStart(2,"0");
      const ap = hh >= 12 ? "PM" : "AM";
      const h12 = ((hh + 11) % 12) + 1;
      return `${h12}:${mm} ${ap}`;
    } catch { return "—"; }
  }

  function bandForScore(s){
    if (s >= 90) return "green";
    if (s >= 60) return "yellow";
    return "red";
  }

  function avg(arr){
    if (!arr.length) return 0;
    return arr.reduce((a,b)=>a+b,0) / arr.length;
  }

  function renderRow(item){
    const row = document.createElement("div");
    row.className = "row";

    const left = document.createElement("div");
    left.className = "left";

    const topline = document.createElement("div");
    topline.className = "topline";

    const score = document.createElement("div");
    score.className = "score";
    score.textContent = String(item.score ?? "—");

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.label || ""} • ${fmtTime(item.ts)}`;

    topline.appendChild(score);
    topline.appendChild(meta);

    const sub = document.createElement("div");
    sub.className = "submeta";
    const tgt = item.targetKey ? `Target ${item.targetKey}` : "Target —";
    const dial = item.dial ? `Dial ${item.dial}` : "Dial —";
    const shots = `Hits ${item.shots ?? 0}`;
    sub.textContent = `${tgt} • ${dial} • ${shots}`;

    left.appendChild(topline);
    left.appendChild(sub);

    const badge = document.createElement("div");
    const band = bandForScore(Number(item.score || 0));
    badge.className = `badge ${band}`;
    badge.textContent = band.toUpperCase();

    row.appendChild(left);
    row.appendChild(badge);

    return row;
  }

  function readSessions(){
    const s = safeJSON(localStorage.getItem(KEY_SESSIONS));
    return Array.isArray(s) ? s : [];
  }

  function writeSessions(arr){
    try { localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr)); } catch {}
  }

  function render(){
    if (elBuild) elBuild.textContent = `v${BUILD}`;

    const sessions = readSessions();

    if (!sessions.length){
      if (elEmpty) elEmpty.style.display = "block";
      if (elTop) elTop.innerHTML = "";
      if (elRecent) elRecent.innerHTML = "";
      if (elCount) elCount.textContent = "0";
      if (elBest) elBest.textContent = "—";
      if (elAvg) elAvg.textContent = "—";
      return;
    }

    if (elEmpty) elEmpty.style.display = "none";

    const scores = sessions.map(x => Number(x.score || 0)).filter(n => Number.isFinite(n));
    const best = Math.max(...scores);
    const a = avg(scores);

    if (elCount) elCount.textContent = String(sessions.length);
    if (elBest) elBest.textContent = String(best);
    if (elAvg) elAvg.textContent = String(Math.round(a));

    // Top 10
    const top = [...sessions]
      .sort((x,y) => Number(y.score||0) - Number(x.score||0))
      .slice(0,10);

    // Recent 20 (newest first)
    const recent = [...sessions]
      .sort((x,y) => Number(y.ts||0) - Number(x.ts||0))
      .slice(0,20);

    if (elTop){
      elTop.innerHTML = "";
      top.forEach(item => elTop.appendChild(renderRow(item)));
    }

    if (elRecent){
      elRecent.innerHTML = "";
      recent.forEach(item => elRecent.appendChild(renderRow(item)));
    }
  }

  function goBackToSEC(){
    // prefer the last payload in storage
    const p = localStorage.getItem(KEY_PAYLOAD);
    if (p) {
      window.location.href = `./sec.html?fresh=${Date.now()}`;
      return;
    }
    // fallback
    window.location.href = `./index.html?fresh=${Date.now()}`;
  }

  function goBackToTarget(){
    window.location.href = `./index.html?fresh=${Date.now()}`;
  }

  elBackSec?.addEventListener("click", goBackToSEC);
  elBackTarget?.addEventListener("click", goBackToTarget);

  elClearLog?.addEventListener("click", () => {
    const ok = confirm("Clear score log?");
    if (!ok) return;
    writeSessions([]);
    render();
  });

  render();
})();
