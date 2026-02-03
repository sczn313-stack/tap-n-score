/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — SEC Payload Loader (iPad-safe)
   Goal:
   - SEC NEVER opens as an empty shell.
   - Reads the most recent computed result from localStorage (multiple key fallbacks).
   - If no payload exists, shows a clear message + keeps "Back to target" working.
   - Fills any matching SEC fields it can find by ID (safe even if IDs differ).
   ============================================================ */

(() => {
  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function pretty(obj) {
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  }

  function setTextIfExists(id, val) {
    const el = $(id);
    if (!el) return false;
    el.textContent = (val === undefined || val === null) ? "" : String(val);
    return true;
  }

  function setHtmlIfExists(id, html) {
    const el = $(id);
    if (!el) return false;
    el.innerHTML = html || "";
    return true;
  }

  function setImgIfExists(id, src) {
    const el = $(id);
    if (!el) return false;
    if (el.tagName === "IMG") {
      el.src = src || "";
      return true;
    }
    // If it's a div placeholder, inject an img
    if (src) {
      el.innerHTML = `<img src="${src}" alt="SEC image" style="max-width:100%;height:auto;border-radius:12px;" />`;
    } else {
      el.innerHTML = "";
    }
    return true;
  }

  function getQueryParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  // ---------- Payload retrieval ----------
  function loadPayload() {
    // Primary key we expect going forward:
    const keys = [
      "SCZN3_SEC_PAYLOAD_V1",
      // Common fallbacks in case prior code used different names:
      "SCZN3_SEC_PAYLOAD",
      "SEC_PAYLOAD",
      "secPayload",
      "sec_payload",
      "SCZN3_LAST_RESULT",
      "SCZN3_RESULT",
      "analysisResult",
      "result",
      "data"
    ];

    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;

      // Some apps store raw JSON; others store an object with .payload
      const parsed = safeJsonParse(raw);
      if (parsed && typeof parsed === "object") {
        return { payload: parsed.payload ?? parsed, source: `localStorage:${k}` };
      }

      // If it wasn't JSON, return raw as a string payload
      return { payload: { raw }, source: `localStorage:${k} (raw)` };
    }

    // Optional URL payload (if someone ever uses ?payload=... )
    const qp = getQueryParam("payload");
    if (qp) {
      const decoded = safeJsonParse(qp) || safeJsonParse(decodeURIComponent(qp));
      if (decoded) return { payload: decoded, source: "querystring:payload" };
    }

    return { payload: null, source: "none" };
  }

  // ---------- Render ----------
  function renderEmptyState(diagEl) {
    // Try common placeholders first
    setTextIfExists("secStatus", "No data found");
    setTextIfExists("secSubtitle", "Run a score first, then return here.");
    setHtmlIfExists(
      "secMessage",
      `<div style="padding:12px 0;opacity:.9;line-height:1.35">
         This SEC page opened, but it didn’t receive a saved result.<br/>
         Use <b>Back to target</b> and run the score again.
       </div>`
    );

    // If there is a big blank rectangle, try to fill it with a message
    // (We don’t know the exact ID, so we try a few common ones)
    const possibleHolders = ["secImageWrap", "secImgWrap", "secCard", "secPreview", "secOutput", "secBigBox"];
    for (const id of possibleHolders) {
      const el = $(id);
      if (!el) continue;
      el.innerHTML = `
        <div style="padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:14px;">
          <div style="font-weight:700;margin-bottom:6px;">SEC has no saved result</div>
          <div style="opacity:.9;">Go back, run the score, then open SEC again.</div>
        </div>
      `;
      break;
    }

    if (diagEl) {
      diagEl.textContent =
        "SEC: payload missing.\n" +
        "Expected localStorage key: SCZN3_SEC_PAYLOAD_V1 (or one of the fallbacks).\n" +
        "Fix is upstream: save payload BEFORE redirecting to sec.html.\n";
    }
  }

  function renderPayload(payload, source, diagEl) {
    // 1) Diagnostics
    if (diagEl) {
      const head =
        `SEC: payload loaded ✅\n` +
        `source: ${source}\n` +
        `time: ${new Date().toISOString()}\n\n`;
      diagEl.textContent = head + pretty(payload);
    }

    // 2) Image (if provided)
    // Accept multiple field names
    const imgSrc =
      payload.secImage ||
      payload.sec_image ||
      payload.secPng ||
      payload.pngDataUrl ||
      payload.sec_png_data_url ||
      payload.imageDataUrl ||
      payload.cardDataUrl ||
      null;

    // Try known IDs
    setImgIfExists("secImage", imgSrc) ||
      setImgIfExists("secImg", imgSrc) ||
      setImgIfExists("secPreview", imgSrc) ||
      setImgIfExists("secCard", imgSrc) ||
      false;

    // 3) Populate common text fields (safe if IDs don’t exist)
    // These are best-effort — if the element ID exists, it gets filled.
    const map = [
      ["secTitle", payload.title],
      ["secHeader", payload.title],
      ["secVendor", payload.vendor],
      ["secTargetName", payload.targetName || payload.target_name || payload.fileName || payload.filename],
      ["secFileName", payload.fileName || payload.filename],

      ["secScore", payload.score],
      ["secSmartScore", payload.smartScore || payload.smart_score],

      ["secWindage", payload.windage],
      ["secElevation", payload.elevation],

      ["secWindageDir", payload.windageDir || payload.windage_dir],
      ["secElevationDir", payload.elevationDir || payload.elevation_dir],

      ["secWindageClicks", payload.windageClicks || payload.windage_clicks],
      ["secElevationClicks", payload.elevationClicks || payload.elevation_clicks],

      ["secWindageMOA", payload.windageMoa || payload.windage_moa],
      ["secElevationMOA", payload.elevationMoa || payload.elevation_moa],

      ["secPOIB", payload.poib],
      ["secBull", payload.bull],
      ["secDeltaX", payload.dx],
      ["secDeltaY", payload.dy],

      ["secNotes", payload.notes],
      ["secAdvice", payload.advice],
      ["secNext", payload.next]
    ];

    for (const [id, val] of map) {
      if (val !== undefined && val !== null) setTextIfExists(id, val);
    }

    // 4) If there’s a big placeholder box but no image, inject readable summary
    if (!imgSrc) {
      const summary =
        `<div style="padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;">
           <div style="font-weight:700;margin-bottom:8px;">Result Loaded</div>
           <pre style="margin:0;white-space:pre-wrap;word-break:break-word;opacity:.95;">${escapeHtml(pretty(payload))}</pre>
         </div>`;

      // Try likely container IDs
      const placed =
        setHtmlIfExists("secImageWrap", summary) ||
        setHtmlIfExists("secImgWrap", summary) ||
        setHtmlIfExists("secCard", summary) ||
        setHtmlIfExists("secOutput", summary);

      // If none exist, do nothing — page still has payload + diagnostics
      void placed;
    }

    // Update any status line if present
    setTextIfExists("secStatus", "Loaded");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Wiring ----------
  function wireButtons() {
    const backBtn = $("backToTargetBtn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        // Return to target flow (works even if payload missing)
        window.location.href = "./target.html?from=sec";
      });
    }
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    wireButtons();

    const diagEl = $("secDiag");
    const { payload, source } = loadPayload();

    if (!payload) {
      renderEmptyState(diagEl);
      return;
    }

    renderPayload(payload, source, diagEl);
  });
})();
