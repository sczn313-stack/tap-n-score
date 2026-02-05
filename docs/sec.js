/* ============================================================
   sec.js (FULL REPLACEMENT) — LED Score + Payload Priority
   Priority:
     1) payload.score (URL payload or localStorage payload)
     2) ?score=25 (manual preview / demo)
     3) "—"
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

  function fromB64(b64) {
    try {
      const json = decodeURIComponent(escape(atob(b64)));
      return safeJsonParse(json);
    } catch { return null; }
  }

  function getParam(name) {
    try {
      return new URL(location.href).searchParams.get(name);
    } catch { return null; }
  }

  function writeDiag(obj) {
    const pre = $("secDiag");
    if (!pre) return;
    try { pre.textContent = JSON.stringify(obj, null, 2); }
    catch { pre.textContent = String(obj); }
  }

  function setText(id, v) {
    const el = $(id);
    if (!el) return;
    el.textContent = (v === undefined || v === null || v === "") ? "—" : String(v);
  }

  function setNum2(id, v) {
    const el = $(id);
    if (!el) return;
    const n = Number(v);
    el.textContent = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }

  function enableBtn(btn, yes) {
    if (!btn) return;
    if (yes) {
      btn.classList.remove("btnDisabled");
      btn.setAttribute("aria-disabled", "false");
      btn.disabled = false;
    } else {
      btn.classList.add("btnDisabled");
      btn.setAttribute("aria-disabled", "true");
      btn.disabled = true;
    }
  }

  function goToIndexFresh() {
    location.replace(`./index.html?fresh=${Date.now()}`);
  }

  // ---- Diagnostics gating
  const diagBox = $("secDiagBox");
  const titleEl = $("secTitle");
  const debugParam = getParam("debug");
  const debugOn = debugParam === "1" || debugParam === "true";

  function showDiagnostics() {
    if (!diagBox) return;
    diagBox.classList.remove("diagHidden");
    diagBox.open = true;
  }
  function hideDiagnostics() {
    if (!diagBox) return;
    diagBox.classList.add("diagHidden");
    diagBox.open = false;
  }

  if (debugOn) showDiagnostics();
  else hideDiagnostics();

  // Long-press title to reveal diagnostics
  if (titleEl && !debugOn) {
    let t = null;
    const start = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        showDiagnostics();
        writeDiag({ ok: true, note: "Diagnostics revealed by long-press" });
      }, 700);
    };
    const stop = () => { clearTimeout(t); t = null; };

    titleEl.addEventListener("touchstart", start, { passive: true });
    titleEl.addEventListener("touchend", stop);
    titleEl.addEventListener("touchcancel", stop);

    titleEl.addEventListener("mousedown", start);
    titleEl.addEventListener("mouseup", stop);
    titleEl.addEventListener("mouseleave", stop);
  }

  // ---- Load payload: URL payload first, then localStorage
  const rawPayloadParam = getParam("payload");
  let payload = null;

  if (rawPayloadParam) payload = fromB64(rawPayloadParam);

  if (!payload) {
    try {
      const ls = localStorage.getItem(KEY);
      if (ls) payload = safeJsonParse(ls);
    } catch {}
  }

  // ---- Buttons
  const downloadBtn = $("downloadBtn");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");
  const backBtn = $("backToTargetBtn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (history.length > 1) { history.back(); return; }
      goToIndexFresh();
    });
  }

  // ---- Score source: payload.score -> ?score= -> —
  const scoreParam = getParam("score");
  const scoreFromParam = (scoreParam !== null && scoreParam !== "") ? Number(scoreParam) : null;

  let scoreFinal = null;
  if (payload && payload.score !== undefined && payload.score !== null && payload.score !== "") {
    scoreFinal = payload.score;
  } else if (Number.isFinite(scoreFromParam)) {
    scoreFinal = scoreFromParam;
  } else {
    scoreFinal = "—";
  }

  // If payload is missing, still show the score demo cleanly
  setText("secScore", scoreFinal);

  // ---- If payload missing, disable buttons + minimal fill
  if (!payload) {
    setText("secSession", "—");
    setText("secShots", 0);
    setText("secWindDir", "—");
    setNum2("secWindClicks", 0);
    setText("secElevDir", "—");
    setNum2("secElevClicks", 0);

    setText("prev1", "—");
    setText("prev2", "—");
    setText("prev3", "—");

    enableBtn(downloadBtn, false);
    enableBtn(vendorBtn, false);
    enableBtn(surveyBtn, false);

    if (debugOn) {
      writeDiag({
        ok: false,
        note: "No payload loaded. Showing score via ?score= fallback if provided.",
        url: location.href,
        hasScoreParam: Number.isFinite(scoreFromParam),
        expected: { urlParam: "payload", localStorageKey: KEY }
      });
    }
    return;
  }

  // ---- Persist backup
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

  // ---- Hydrate UI from payload
  setText("secSession", payload.sessionId || "—");
  setText("secShots", payload.shots ?? 0);

  setText("secWindDir", payload.windage?.dir || "—");
  setNum2("secWindClicks", payload.windage?.clicks ?? 0);

  setText("secElevDir", payload.elevation?.dir || "—");
  setNum2("secElevClicks", payload.elevation?.clicks ?? 0);

  // ---- History PREV 1–3
  try {
    const hist = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
    const fmt = (h) => {
      if (!h) return "—";
      const s = (h.score === null || h.score === undefined) ? "—" : h.score;
      return `Score ${s} • Shots ${h.shots} • ${h.wind} • ${h.elev}`;
    };
    setText("prev1", fmt(hist[0]));
    setText("prev2", fmt(hist[1]));
    setText("prev3", fmt(hist[2]));
  } catch {
    setText("prev1", "—");
    setText("prev2", "—");
    setText("prev3", "—");
  }

  // ---- Buttons enabled only if URLs exist
  const secUrl = String(payload.secPngUrl || payload.secUrl || "").trim();
  const vendorUrl = String(payload.vendorUrl || "").trim();
  const surveyUrl = String(payload.surveyUrl || "").trim();

  if (secUrl) {
    enableBtn(downloadBtn, true);
    downloadBtn.addEventListener("click", () => {
      const t = Date.now();
      const from = `./index.html?fresh=${t}`;
      const target = `./index.html?fresh=${t}`;
      const u =
        `./download.html?img=${encodeURIComponent(secUrl)}` +
        `&from=${encodeURIComponent(from)}` +
        `&target=${encodeURIComponent(target)}`;
      location.href = u;
    });
  } else {
    enableBtn(downloadBtn, false);
  }

  if (vendorUrl) {
    enableBtn(vendorBtn, true);
    vendorBtn.addEventListener("click", () => window.open(vendorUrl, "_blank", "noopener,noreferrer"));
  } else {
    enableBtn(vendorBtn, false);
  }

  if (surveyUrl) {
    enableBtn(surveyBtn, true);
    surveyBtn.addEventListener("click", () => window.open(surveyUrl, "_blank", "noopener,noreferrer"));
  } else {
    enableBtn(surveyBtn, false);
  }

  // ---- Diagnostics (only when visible)
  if (debugOn) {
    writeDiag({
      ok: true,
      loadedFrom: rawPayloadParam ? "url.payload" : "localStorage",
      scoreRendered: scoreFinal,
      key: KEY,
      payloadSummary: {
        sessionId: payload.sessionId,
        score: payload.score,
        shots: payload.shots,
        windage: payload.windage,
        elevation: payload.elevation,
        hasSecUrl: Boolean(secUrl),
        hasVendorUrl: Boolean(vendorUrl),
        hasSurveyUrl: Boolean(surveyUrl)
      }
    });
  }
})();
