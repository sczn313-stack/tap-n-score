/* ============================================================
   sec.js (FULL REPLACEMENT) — URL payload (base64) + storage backup
   Fix:
   - Reads payload from ?payload= (primary)
   - Falls back to localStorage (backup)
   - Hydrates SEC UI safely (supports multiple possible IDs)
   - Writes diagnostics into #secDiag
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  // ---- Helpers
  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function fromB64(b64) {
    // reverse of: btoa(unescape(encodeURIComponent(json)))
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
      // basic fallback
      const m = new RegExp(`[?&]${name}=([^&]+)`).exec(location.search);
      return m ? decodeURIComponent(m[1]) : null;
    }
  }

  function setTextIfExists(idList, value) {
    const v = (value === undefined || value === null) ? "" : String(value);
    for (const id of idList) {
      const el = $(id);
      if (el) {
        el.textContent = v;
        return true;
      }
    }
    return false;
  }

  function setHrefIfExists(idList, href, label) {
    if (!href) return false;
    for (const id of idList) {
      const el = $(id);
      if (el && el.tagName === "A") {
        el.href = href;
        if (label) el.textContent = label;
        el.style.display = "";
        return true;
      }
      // if it's a button, click opens
      if (el && el.tagName === "BUTTON") {
        el.style.display = "";
        el.onclick = () => window.open(href, "_blank", "noopener,noreferrer");
        return true;
      }
    }
    return false;
  }

  function setImageIfExists(idList, src) {
    if (!src) return false;
    for (const id of idList) {
      const el = $(id);
      if (el && el.tagName === "IMG") {
        el.src = src;
        el.style.display = "";
        return true;
      }
    }
    return false;
  }

  function writeDiag(obj) {
    const pre = $("secDiag");
    if (!pre) return;
    try {
      pre.textContent = JSON.stringify(obj, null, 2);
    } catch {
      pre.textContent = String(obj);
    }
  }

  // ---- Load payload: URL first, storage second
  const rawPayloadParam = getQueryParam("payload");
  let payload = null;

  if (rawPayloadParam) {
    payload = fromB64(rawPayloadParam);
  }

  if (!payload) {
    // fallback to localStorage
    const ls = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
    if (ls) payload = safeJsonParse(ls);
  }

  // ---- If still nothing, show diag + stop
  if (!payload) {
    writeDiag({
      ok: false,
      reason: "No payload found. Expected ?payload=... OR localStorage SCZN3_SEC_PAYLOAD_V1",
      url: location.href
    });

    // keep back button working even if empty
    const backBtn = $("backToTargetBtn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        location.href = "./index.html?fresh=1";
      });
    }
    return;
  }

  // ---- Persist backup
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}

  // ---- Hydrate UI (supports multiple possible IDs)
  // Score
  setTextIfExists(["score", "scoreVal", "scoreValue", "secScore"], payload.score);

  // Shot count
  setTextIfExists(["shots", "shotsCount", "shotCount", "secShots"], payload.shots);

  // Windage
  setTextIfExists(["windDir", "windageDir", "secWindDir"], payload.windage?.dir);
  setTextIfExists(["windClicks", "windageClicks", "secWindClicks"], payload.windage?.clicks);

  // Elevation
  setTextIfExists(["elevDir", "elevationDir", "secElevDir"], payload.elevation?.dir);
  setTextIfExists(["elevClicks", "elevationClicks", "secElevClicks"], payload.elevation?.clicks);

  // Optional SEC image
  setImageIfExists(["secImg", "secImage", "secPng", "secPngImg"], payload.secPngUrl);

  // Optional vendor link / CTA
  setHrefIfExists(["vendorLink", "vendorUrl", "vendorBtn", "vendorCta"], payload.vendorUrl, "Vendor");
  setHrefIfExists(["surveyLink", "surveyUrl", "surveyBtn", "surveyCta"], payload.surveyUrl, "Survey");

  // Back button
  const backBtn = $("backToTargetBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // you can change to ./target.html if that’s your actual first page
      location.href = "./index.html?fresh=1";
    });
  }

  // ---- Diagnostics section
  writeDiag({
    ok: true,
    loadedFrom: rawPayloadParam ? "url.payload" : "localStorage",
    key: KEY,
    payloadSummary: {
      sessionId: payload.sessionId,
      score: payload.score,
      shots: payload.shots,
      windage: payload.windage,
      elevation: payload.elevation
    },
    debug: payload.debug || null
  });
})();
