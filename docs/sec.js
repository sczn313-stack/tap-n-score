/* ============================================================
   sec.js (FULL REPLACEMENT) — GitHub Pages SAFE ROUTING + Clean Diag
   - Reads payload from ?payload= (primary)
   - Falls back to localStorage (backup)
   - Diagnostics hidden by default:
       ?debug=1  OR long-press title ~0.7s
   - Back button:
       Always routes to /tap-n-score/index.html?fresh=TIMESTAMP
       (Fixes misrouting when sec.html opened directly)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- Base path for GitHub Pages project site
  // If your repo is /tap-n-score/, keep this:
  const BASE = "/tap-n-score/";
  const INDEX_URL = () => `${BASE}index.html?fresh=${Date.now()}`;
  const DOWNLOAD_URL = (qs) => `${BASE}download.html${qs}`;
  const SEC_URL = () => `${BASE}sec.html`;

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

  function goToIndexHard() {
    location.href = INDEX_URL();
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
      // Always hard-route to the real landing page (fixes “SEC direct open” cases)
      goToIndexHard();
    });
  }

  // ---- If no payload, disable actions and keep only Back working
  if (!payload) {
    enableBtn(downloadBtn, false);
    enableBtn(vendorBtn, false);
    enableBtn(surveyBtn, false);

    if (debugOn) {
      writeDiag({
        ok: false,
        reason: "Missing SEC payload in URL or localStorage",
        expected: { urlParam: "payload", localStorageKey: KEY },
        url: location.href,
        fix: "Run flow from index.html → Show results (payload gets passed)."
      });
    }
    return;
  }

  // ---- Persist backup (safe)
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

  // ---- Hydrate UI
  setText("secSession", payload.sessionId || "—");
  setText("secShots", payload.shots ?? 0);
  setText("secScore", (payload.score === null || payload.score === undefined) ? "—" : payload.score);

  setText("secWindDir", payload.windage?.dir || "—");
  setNum2("secWindClicks", payload.windage?.clicks ?? 0);

  setText("secElevDir", payload.elevation?.dir || "—");
  setNum2("secElevClicks", payload.elevation?.clicks ?? 0);

  // ---- History (optional)
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

  // ---- Download button enable (only if we have a URL)
  const secUrl = String(payload.secPngUrl || payload.secUrl || "").trim();

  if (secUrl) {
    enableBtn(downloadBtn, true);
    downloadBtn.addEventListener("click", () => {
      // Always return to the real landing page with fresh timestamp
      const from = INDEX_URL();
      const target = INDEX_URL();

      const qs =
        `?img=${encodeURIComponent(secUrl)}` +
        `&from=${encodeURIComponent(from)}` +
        `&target=${encodeURIComponent(target)}`;

      window.location.href = DOWNLOAD_URL(qs);
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
      base: BASE,
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
      urls: {
        index: INDEX_URL(),
        sec: SEC_URL()
      },
      debug: payload.debug || null
    });
  }
})();
