/* ============================================================
   sec.js (FULL REPLACEMENT) — Clean SEC Diagnostics (Baseline 22206)
   - Reads payload from ?payload= (primary)
   - Falls back to localStorage (backup)
   - Diagnostics hidden by default
   - Reveal diagnostics via:
       1) add ?debug=1
       2) long-press the SEC title ("SHOOTER EXPERIENCE CARD") ~0.7s
   - Back button behavior:
       1) Prefer real history.back() when available
       2) Fallback to index.html with a TRUE fresh timestamp
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- Helpers
  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function fromB64(b64) {
    try {
      const json = decodeURIComponent(escape(atob(b64)));
      return safeJsonParse(json);
    } catch {
      return null;
    }
  }

  function getParam(name) {
    try {
      const u = new URL(location.href);
      return u.searchParams.get(name);
    } catch {
      return null;
    }
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
    const t = Date.now();
    // replace avoids building history loops
    location.replace(`./index.html?fresh=${t}`);
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

  // Long-press to reveal diagnostics (iPad friendly)
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
    let ls = null;
    try { ls = localStorage.getItem(KEY); } catch {}
    if (ls) payload = safeJsonParse(ls);
  }

  // ---- Buttons
  const downloadBtn = $("downloadBtn");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");
  const backBtn = $("backToTargetBtn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // Prefer actual back if user came from the app flow
      if (history.length > 1) {
        history.back();
        return;
      }
      // Fallback: hard route to baseline entry with true cache-bust
      goToIndexFresh();
    });
  }

  // ---- If no payload, keep page clean + only back works
  if (!payload) {
    enableBtn(downloadBtn, false);
    enableBtn(vendorBtn, false);
    enableBtn(surveyBtn, false);

    if (debugOn) {
      writeDiag({
        ok: false,
        reason: "Missing SEC payload in URL or localStorage",
        expected: { urlParam: "payload", localStorageKey: KEY },
        url: location.href
      });
    }
    return;
  }

  // ---- Persist backup (safe)
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

  // ---- Hydrate UI
  setText("secSession", payload.sessionId || "—");
  setText("secShots", payload.shots ?? 0);

  // Score (null => "—")
  setText("secScore", (payload.score === null || payload.score === undefined) ? "—" : payload.score);

  // Direction + clicks
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
  // Supports either payload.secPngUrl OR payload.secUrl
  const secUrl = String(payload.secPngUrl || payload.secUrl || "").trim();

  if (secUrl) {
    enableBtn(downloadBtn, true);
    downloadBtn.addEventListener("click", () => {
      // Ensure return path always re-enters the baseline with true freshness
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
  } else {
    enableBtn(vendorBtn, false);
  }

  // ---- Survey button
  const surveyUrl = String(payload.surveyUrl || "").trim();
  if (surveyUrl) {
    enableBtn(surveyBtn, true);
    surveyBtn.addEventListener("click", () =>
      window.open(surveyUrl, "_blank", "noopener,noreferrer")
    );
  } else {
    enableBtn(surveyBtn, false);
  }

  // ---- Diagnostics content ONLY if visible
  if (debugOn) {
    writeDiag({
      ok: true,
      loadedFrom: rawPayloadParam ? "url.payload" : "localStorage",
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
      },
      debug: payload.debug || null
    });
  }
})();
