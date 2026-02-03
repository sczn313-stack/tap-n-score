/* ============================================================
   sec.js (FULL REPLACEMENT) — BASELINE 22206 (CLEAN DIAGNOSTICS)
   - Reads payload from ?payload= (primary), localStorage (backup)
   - Hydrates SEC UI
   - Diagnostics are hidden by default:
       - show if URL has ?debug=1
       - OR press-and-hold the "SEC" title for ~700ms to reveal
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = "SCZN3_SEC_PAYLOAD_V1";

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

  function getQueryParam(name) {
    try {
      const u = new URL(location.href);
      return u.searchParams.get(name);
    } catch {
      const m = new RegExp(`[?&]${name}=([^&]+)`).exec(location.search);
      return m ? decodeURIComponent(m[1]) : null;
    }
  }

  function writeDiag(obj) {
    const pre = $("secDiag");
    if (!pre) return;
    try { pre.textContent = JSON.stringify(obj, null, 2); }
    catch { pre.textContent = String(obj); }
  }

  function showDiagnostics() {
    const wrap = $("diagWrap");
    if (!wrap) return;
    wrap.classList.remove("diagHidden");
  }

  function hideDiagnostics() {
    const wrap = $("diagWrap");
    if (!wrap) return;
    wrap.classList.add("diagHidden");
  }

  // --- Diagnostics gate
  const debugParam = getQueryParam("debug");
  const debugOn = String(debugParam || "") === "1";

  if (debugOn) showDiagnostics();
  else hideDiagnostics();

  // Press-and-hold on the title to reveal diagnostics (no clutter)
  const title = $("secTitle");
  if (title) {
    let t = null;
    const start = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        showDiagnostics();
        // auto-open details once revealed
        const d = $("diagWrap");
        if (d && d.tagName === "DETAILS") d.open = true;
      }, 700);
    };
    const end = () => { clearTimeout(t); t = null; };

    title.addEventListener("touchstart", start, { passive: true });
    title.addEventListener("touchend", end, { passive: true });
    title.addEventListener("touchcancel", end, { passive: true });

    title.addEventListener("mousedown", start);
    title.addEventListener("mouseup", end);
    title.addEventListener("mouseleave", end);
  }

  // --- Load payload: URL first, storage second
  const rawPayloadParam = getQueryParam("payload");
  let payload = null;

  if (rawPayloadParam) payload = fromB64(rawPayloadParam);

  if (!payload) {
    const ls = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
    if (ls) payload = safeJsonParse(ls);
  }

  // Back button (always works)
  const backBtn = $("backToTargetBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // If you ever route through target.html, that file now redirects to index.html anyway
      location.href = "./index.html?fresh=" + Date.now();
    });
  }

  if (!payload) {
    // Only show diagnostics automatically if debug=1
    if (debugOn) {
      writeDiag({
        ok: false,
        reason: "No payload found. Expected ?payload=... OR localStorage SCZN3_SEC_PAYLOAD_V1",
        url: location.href
      });
      showDiagnostics();
    }
    return;
  }

  // Persist backup
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

  // Hydrate UI (these IDs match sec.html)
  const setText = (id, v) => {
    const el = $(id);
    if (!el) return;
    el.textContent = (v === undefined || v === null || v === "") ? "—" : String(v);
  };

  setText("score", payload.score);
  setText("shots", payload.shots);

  setText("windDir", payload.windage?.dir);
  setText("windClicks", payload.windage?.clicks);

  setText("elevDir", payload.elevation?.dir);
  setText("elevClicks", payload.elevation?.clicks);

  // Vendor/Survey links
  const vendorLink = $("vendorLink");
  if (vendorLink && payload.vendorUrl) {
    vendorLink.href = payload.vendorUrl;
    vendorLink.style.display = "";
  }

  const surveyLink = $("surveyLink");
  if (surveyLink && payload.surveyUrl) {
    surveyLink.href = payload.surveyUrl;
    surveyLink.style.display = "";
  }

  // Diagnostics (only fill if debug=1 OR user long-press reveals)
  writeDiag({
    ok: true,
    loadedFrom: rawPayloadParam ? "url.payload" : "localStorage",
    key: KEY,
    rendered: {
      sessionId: payload.sessionId || "(missing)",
      shots: String(payload.shots ?? "(missing)"),
      score: String(payload.score ?? "(missing)"),
      windage: payload.windage ? { dir: String(payload.windage.dir), clicks: String(payload.windage.clicks) } : "(missing)",
      elevation: payload.elevation ? { dir: String(payload.elevation.dir), clicks: String(payload.elevation.clicks) } : "(missing)",
      secUrl: payload.secPngUrl ? "(present)" : "(missing)",
      vendorUrl: payload.vendorUrl ? "(present)" : "(missing)",
      surveyUrl: payload.surveyUrl ? "(present)" : "(missing)"
    },
    rawPayload: payload
  });
})();
