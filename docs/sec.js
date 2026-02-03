/* ============================================================
   sec.js (FULL REPLACEMENT) — HARD GATE + STRICT RENDER
   Rules:
   - SEC must NOT open without data.
   - If data missing → show clear message, disable everything except Back.
   - Read order:
       1) ?payload=  (base64 JSON)
       2) localStorage "SCZN3_SEC_PAYLOAD_V1" (backup)
   - No guessing: only render the fields we expect.
   - Download button only enables if secPngUrl exists.
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  // ---------- Helpers
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
      return new URL(location.href).searchParams.get(name);
    } catch {
      return null;
    }
  }

  function setText(id, value) {
    const el = $(id);
    if (!el) return false;
    el.textContent = value;
    return true;
  }

  function fmtClicks(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  }

  function normDir(v) {
    const s = String(v || "—").toUpperCase().trim();
    if (s === "LEFT" || s === "RIGHT" || s === "UP" || s === "DOWN" || s === "NONE" || s === "—") return s;
    return "—";
  }

  function writeDiag(obj) {
    const pre = $("secDiag");
    if (!pre) return;
    try { pre.textContent = JSON.stringify(obj, null, 2); }
    catch { pre.textContent = String(obj); }
  }

  function disableAllButtonsExceptBack(reasonMsg) {
    // Optional: show a clear banner if you have it (not required)
    // We’ll reuse the score box as a safe place to show the message.
    setText("secScore", "—");
    setText("secShots", "0");
    setText("secWindClicks", "0.00");
    setText("secElevClicks", "0.00");
    setText("secWindDir", "—");
    setText("secElevDir", "—");

    // If you have session pill
    setText("secSession", "—");

    // Disable buttons
    const downloadBtn = $("downloadBtn");
    const vendorBtn = $("vendorBtn");
    const surveyBtn = $("surveyBtn");

    if (downloadBtn) {
      downloadBtn.classList.add("btnDisabled");
      downloadBtn.disabled = true;
      downloadBtn.setAttribute("aria-disabled", "true");
    }
    if (vendorBtn) {
      vendorBtn.classList.add("btnDisabled");
      vendorBtn.disabled = true;
      vendorBtn.setAttribute("aria-disabled", "true");
    }
    if (surveyBtn) {
      surveyBtn.classList.add("btnDisabled");
      surveyBtn.disabled = true;
      surveyBtn.setAttribute("aria-disabled", "true");
    }

    // Make Back work
    const backBtn = $("backToTargetBtn");
    if (backBtn) {
      backBtn.onclick = () => {
        // Your first real step is target.html
        window.location.href = "./target.html?fresh=" + Date.now();
      };
    }

    // Helpful hint line if present
    const hintLine = $("hintLine");
    if (hintLine) hintLine.textContent = reasonMsg;

    writeDiag({
      ok: false,
      reason: reasonMsg,
      expected: {
        urlPayload: "?payload=<base64>",
        storageKey: SEC_KEY
      },
      url: location.href
    });
  }

  // ---------- Load payload (URL first, storage second)
  const payloadParam = getQueryParam("payload");
  let payload = null;
  let loadedFrom = "none";

  if (payloadParam) {
    payload = fromB64(payloadParam);
    if (payload) loadedFrom = "url.payload";
  }

  if (!payload) {
    const ls = (() => {
      try { return localStorage.getItem(SEC_KEY); } catch { return null; }
    })();
    if (ls) {
      payload = safeJsonParse(ls);
      if (payload) loadedFrom = "localStorage";
    }
  }

  // ---------- HARD GATE
  if (!payload) {
    disableAllButtonsExceptBack("No scoring data found. Please score a target first.");
    return;
  }

  // ---------- Persist backup (best effort)
  try { localStorage.setItem(SEC_KEY, JSON.stringify(payload)); } catch {}

  // ---------- Strict read (NO GUESSING)
  const sessionId = String(payload.sessionId || "—");
  const shots = Number.isFinite(Number(payload.shots)) ? Number(payload.shots) : 0;

  const windDir = normDir(payload.windage && payload.windage.dir);
  const elevDir = normDir(payload.elevation && payload.elevation.dir);

  const windClicks = fmtClicks(payload.windage && payload.windage.clicks);
  const elevClicks = fmtClicks(payload.elevation && payload.elevation.clicks);

  // Score can be null (SEC shows —)
  const scoreNum = Number(payload.score);
  const scoreText = Number.isFinite(scoreNum) ? String(scoreNum) : "—";

  // ---------- Render (these IDs exist in your sec.html)
  setText("secSession", sessionId);
  setText("secShots", String(shots));
  setText("secScore", scoreText);

  setText("secWindDir", windDir === "NONE" ? "—" : windDir);
  setText("secElevDir", elevDir === "NONE" ? "—" : elevDir);

  setText("secWindClicks", windClicks);
  setText("secElevClicks", elevClicks);

  // ---------- Buttons
  const backBtn = $("backToTargetBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = "./target.html?fresh=" + Date.now();
    };
  }

  // Vendor / Survey buttons (only enable if URL exists)
  const vendorUrl = String(payload.vendorUrl || "").trim();
  const surveyUrl = String(payload.surveyUrl || "").trim();

  const vendorBtn = $("vendorBtn");
  if (vendorBtn) {
    if (vendorUrl) {
      vendorBtn.classList.remove("btnDisabled");
      vendorBtn.disabled = false;
      vendorBtn.setAttribute("aria-disabled", "false");
      vendorBtn.onclick = () => window.open(vendorUrl, "_blank", "noopener,noreferrer");
    } else {
      vendorBtn.classList.add("btnDisabled");
      vendorBtn.disabled = true;
      vendorBtn.setAttribute("aria-disabled", "true");
    }
  }

  const surveyBtn = $("surveyBtn");
  if (surveyBtn) {
    if (surveyUrl) {
      surveyBtn.classList.remove("btnDisabled");
      surveyBtn.disabled = false;
      surveyBtn.setAttribute("aria-disabled", "false");
      surveyBtn.onclick = () => window.open(surveyUrl, "_blank", "noopener,noreferrer");
    } else {
      surveyBtn.classList.add("btnDisabled");
      surveyBtn.disabled = true;
      surveyBtn.setAttribute("aria-disabled", "true");
    }
  }

  // Download button -> download.html?img=...
  const secUrl = String(payload.secPngUrl || payload.secUrl || "").trim();
  const downloadBtn = $("downloadBtn");
  if (downloadBtn) {
    if (secUrl) {
      downloadBtn.classList.remove("btnDisabled");
      downloadBtn.disabled = false;
      downloadBtn.setAttribute("aria-disabled", "false");
      downloadBtn.onclick = () => {
        const from = "./sec.html";
        const target = "./target.html";
        const u =
          `./download.html?img=${encodeURIComponent(secUrl)}` +
          `&from=${encodeURIComponent(from)}` +
          `&target=${encodeURIComponent(target)}` +
          `&fresh=${Date.now()}`;
        window.location.href = u;
      };
    } else {
      downloadBtn.classList.add("btnDisabled");
      downloadBtn.disabled = true;
      downloadBtn.setAttribute("aria-disabled", "true");
      downloadBtn.onclick = null;
    }
  }

  // ---------- Diagnostics
  writeDiag({
    ok: true,
    loadedFrom,
    key: SEC_KEY,
    rendered: {
      sessionId,
      shots,
      score: scoreText,
      windage: { dir: windDir, clicks: windClicks },
      elevation: { dir: elevDir, clicks: elevClicks },
      secUrl: secUrl ? "(present)" : "(missing)",
      vendorUrl: vendorUrl ? "(present)" : "(missing)",
      surveyUrl: surveyUrl ? "(present)" : "(missing)"
    },
    rawPayload: payload
  });
})();
