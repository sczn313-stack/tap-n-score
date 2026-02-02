/* ============================================================
   docs/sec.js  (FULL REPLACEMENT)
   Shooter Experience Card
   - Reads payload from localStorage key: "SCZN3_SEC_PAYLOAD_V1"
   - Reads history from localStorage key: "SCZN3_SEC_HISTORY_V1"
   - Populates UI + enables buttons when data is present
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const SEC_KEY  = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  // ---- DOM
  const elSession    = $("secSession");
  const elShots      = $("secShots");
  const elScore      = $("secScore");

  const elWindClicks = $("secWindClicks");
  const elWindDir    = $("secWindDir");

  const elElevClicks = $("secElevClicks");
  const elElevDir    = $("secElevDir");

  const elPrev1      = $("prev1");
  const elPrev2      = $("prev2");
  const elPrev3      = $("prev3");

  const elDiag       = $("secDiag");

  const downloadBtn  = $("downloadBtn");
  const vendorBtn    = $("vendorBtn");
  const surveyBtn    = $("surveyBtn");
  const backBtn      = $("backToTargetBtn");

  // ---- Helpers
  const round2 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  };

  function setText(el, v) {
    if (!el) return;
    el.textContent = v;
  }

  function disableBtn(btn) {
    if (!btn) return;
    btn.classList.add("btnDisabled");
    btn.setAttribute("aria-disabled", "true");
    btn.disabled = true;
    btn.onclick = null;
  }

  function enableBtn(btn, onClick) {
    if (!btn) return;
    btn.classList.remove("btnDisabled");
    btn.setAttribute("aria-disabled", "false");
    btn.disabled = false;
    btn.onclick = null;
    if (typeof onClick === "function") btn.onclick = onClick;
  }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function setDiag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  function loadPayload() {
    const raw = localStorage.getItem(SEC_KEY);
    if (!raw) return null;
    return safeJsonParse(raw, null);
  }

  function loadHistory() {
    const raw = localStorage.getItem(HIST_KEY);
    const arr = safeJsonParse(raw, []);
    return Array.isArray(arr) ? arr : [];
  }

  function renderHistory() {
    const h = loadHistory();

    const v1 = h[0] ? formatHist(h[0]) : "—";
    const v2 = h[1] ? formatHist(h[1]) : "—";
    const v3 = h[2] ? formatHist(h[2]) : "—";

    setText(elPrev1, v1);
    setText(elPrev2, v2);
    setText(elPrev3, v3);
  }

  function formatHist(entry) {
    // entry expected like:
    // { t, score, shots, wind:"LEFT 1.25", elev:"UP 0.50" }
    const shots = Number.isFinite(Number(entry?.shots)) ? Number(entry.shots) : null;
    const wind = String(entry?.wind || "").trim();
    const elev = String(entry?.elev || "").trim();

    const parts = [];
    if (shots !== null) parts.push(`${shots} shots`);
    if (wind) parts.push(wind);
    if (elev) parts.push(elev);

    return parts.length ? parts.join(" • ") : "—";
  }

  function normalizeDir(d) {
    const s = String(d || "—").toUpperCase();
    if (s === "LEFT" || s === "RIGHT" || s === "NONE") return s;
    if (s === "UP" || s === "DOWN") return s;
    return "—";
  }

  // ---- Wire Back button (always)
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // back to Target flow
      window.location.href = "./target.html?fresh=1";
    });
  }

  // ---- Boot
  (function init() {
    // default disabled
    disableBtn(downloadBtn);
    disableBtn(vendorBtn);
    disableBtn(surveyBtn);

    // always render history blocks (even if empty)
    renderHistory();

    const payload = loadPayload();

    if (!payload) {
      // No SEC payload => you landed here directly (wrong route)
      setText(elSession, "—");
      setText(elShots, "0");
      setText(elScore, "—");
      setText(elWindClicks, "0.00");
      setText(elElevClicks, "0.00");
      setText(elWindDir, "—");
      setText(elElevDir, "—");

      setDiag({
        ok: false,
        reason: "Missing SEC payload in localStorage",
        key: SEC_KEY
      });

      return;
    }

    // Populate
    const sessionId = String(payload.sessionId || "—");
    const shots = Number.isFinite(Number(payload.shots)) ? Number(payload.shots) : 0;

    const scoreNum = Number(payload.score);
    const scoreText = Number.isFinite(scoreNum) ? String(scoreNum) : "—";

    const windDir = normalizeDir(payload?.windage?.dir);
    const elevDir = normalizeDir(payload?.elevation?.dir);

    const windClicks = payload?.windage?.clicks ?? 0;
    const elevClicks = payload?.elevation?.clicks ?? 0;

    setText(elSession, sessionId);
    setText(elShots, String(shots));
    setText(elScore, scoreText);

    setText(elWindClicks, round2(windClicks));
    setText(elElevClicks, round2(elevClicks));

    setText(elWindDir, windDir);
    setText(elElevDir, elevDir);

    // Buttons
    const secPngUrl = String(payload.secPngUrl || payload.secUrl || "").trim();
    const vendorUrl = String(payload.vendorUrl || "").trim();
    const surveyUrl = String(payload.surveyUrl || "").trim();

    // Download routes to download.html?img=...
    if (secPngUrl) {
      enableBtn(downloadBtn, () => {
        const from = "./index.html?fresh=1";
        const target = "./target.html?fresh=1";
        const u = `./download.html?img=${encodeURIComponent(secPngUrl)}&from=${encodeURIComponent(from)}&target=${encodeURIComponent(target)}`;
        window.location.href = u;
      });
    } else {
      disableBtn(downloadBtn);
    }

    // Vendor
    if (vendorUrl) {
      enableBtn(vendorBtn, () => {
        window.location.href = vendorUrl;
      });
    } else {
      disableBtn(vendorBtn);
    }

    // Survey
    if (surveyUrl) {
      enableBtn(surveyBtn, () => {
        window.location.href = surveyUrl;
      });
    } else {
      disableBtn(surveyBtn);
    }

    // Diagnostics
    setDiag({ ok: true, payloadSummary: {
      sessionId,
      shots,
      score: scoreText,
      wind: { dir: windDir, clicks: round2(windClicks) },
      elev: { dir: elevDir, clicks: round2(elevClicks) },
      hasDownload: !!secPngUrl
    }});

    // Refresh history UI after render
    renderHistory();
  })();
})();
