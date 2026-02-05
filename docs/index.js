/* ============================================================
   sec.js (FULL REPLACEMENT) — BASELINE 22206 SCORE FIX
   Fixes:
   - Always displays payload.score when present (including 0)
   - Diagnostics works with ?debug, ?debug=1, ?debug=true
   - Back button: history.back() else index.html?fresh=timestamp
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- Helpers
  function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

  function fromB64(b64) {
    try {
      const json = decodeURIComponent(escape(atob(b64)));
      return safeJsonParse(json);
    } catch { return null; }
  }

  function getParam(name) {
    try { return new URL(location.href).searchParams.get(name); }
    catch { return null; }
  }

  function hasParam(name) {
    try { return new URL(location.href).searchParams.has(name); }
    catch { return false; }
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
    const isEmpty = (v === undefined || v === null || v === "");
    el.textContent = isEmpty ? "—" : String(v);
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

  // ---- Diagnostics gating (accepts ?debug, ?debug=1, ?debug=true)
  const diagBox = $("secDiagBox");
  const titleEl = $("secTitle");

  const debugParam = getParam("debug");
  const debugOn =
    hasParam("debug") || debugParam === "1" || debugParam === "true";

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

  if (debugOn) showDiagnostics(); else hideDiagnostics();

  // Long-press title to reveal diagnostics (if not already on)
  if (titleEl && !debugOn) {
    let pressTimer = null;

    const start = () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        showDiagnostics();
        writeDiag({ ok: true, note: "Diagnostics revealed by long-press" });
      }, 700);
    };

    const stop = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
    };

    titleEl.addEventListener("touchstart", start, { passive: true });
    titleEl.addEventListener("touchend", stop);
    titleEl.addEventListener("touchcancel", stop);

    titleEl.addEventListener("mousedown", start);
    titleEl.addEventListener("mouseup", stop);
    titleEl.addEventListener("mouseleave", stop);
  }

  // ---- Load payload: URL first, storage second
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
      if (history.length > 1) return history.back();
      goToIndexFresh();
    });
  }

  // ---- If no payload
  if (!payload) {
    enableBtn(downloadBtn, false);
    enableBtn(vendorBtn, false);
    enableBtn(surveyBtn, false);

    if (diagBox && !diagBox.classList.contains("diagHidden")) {
      writeDiag({
        ok: false,
        reason: "No payload found",
        expected: { urlParam: "payload", localStorageKey: KEY },
        url: location.href
      });
    }
    return;
  }

  // ---- Persist backup
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

  // ---- Hydrate UI
  setText("secSession", payload.sessionId || "—");
  setText("secShots", payload.shots ?? 0);

  // ✅ SCORE FIX: show score if it exists (even 0)
  if (Object.prototype.hasOwnProperty.call(payload, "score")) {
    setText("secScore", payload.score);
  } else {
    setText("secScore", "—");
  }

  setText("secWindDir", payload.windage?.dir || "—");
  setNum2("secWindClicks", payload.windage?.clicks ?? 0);

  setText("secElevDir", payload.elevation?.dir || "—");
  setNum2("secElevClicks", payload.elevation?.clicks ?? 0);

  // ---- History PREV 1–3 (optional)
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

  // ---- Download enable (only if we have a URL)
  const secUrl = String(payload.secPngUrl || payload.secUrl || "").trim();

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
      window.location.href = u;
    });
  } else {
    enableBtn(downloadBtn, false);
  }

  // ---- Vendor button
  const vendorUrl = String(payload.vendorUrl || "").trim();
  if (vendorUrl) {
    enableBtn(vendorBtn, true);
    vendorBtn.addEventListener("click", () =>
      window.open(vendorUrl, "_blank", "noopener,noreferrer")
    );
  } else enableBtn(vendorBtn, false);

  // ---- Survey button
  const surveyUrl = String(payload.surveyUrl || "").trim();
  if (surveyUrl) {
    enableBtn(surveyBtn, true);
    surveyBtn.addEventListener("click", () =>
      window.open(surveyUrl, "_blank", "noopener,noreferrer")
    );
  } else enableBtn(surveyBtn, false);

  // ---- Diagnostics
  if (diagBox && !diagBox.classList.contains("diagHidden")) {
    writeDiag({
      ok: true,
      loadedFrom: rawPayloadParam ? "url.payload" : "localStorage",
      hasScore: Object.prototype.hasOwnProperty.call(payload, "score"),
      score: payload.score,
      payloadSummary: {
        sessionId: payload.sessionId,
        shots: payload.shots,
        windage: payload.windage,
        elevation: payload.elevation
      },
      debug: payload.debug || null
    });
  }
})();
