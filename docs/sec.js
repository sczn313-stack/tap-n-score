/* ============================================================
   docs/sec.js  (FULL REPLACEMENT)
   - Reads Shooter Experience Card payload from localStorage
   - Populates sec.html UI
   - Enables buttons when URLs exist
   - Populates PREV 1–3 from history key
   ============================================================ */

(() => {
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  const $ = (id) => document.getElementById(id);

  const elSession = $("secSession");
  const elShots = $("secShots");
  const elScore = $("secScore");

  const elWindClicks = $("secWindClicks");
  const elWindDir = $("secWindDir");
  const elElevClicks = $("secElevClicks");
  const elElevDir = $("secElevDir");

  const elPrev1 = $("prev1");
  const elPrev2 = $("prev2");
  const elPrev3 = $("prev3");

  const elDownloadBtn = $("downloadBtn");
  const elVendorBtn = $("vendorBtn");
  const elSurveyBtn = $("surveyBtn");
  const elBackBtn = $("backToTargetBtn");

  const elDiag = $("secDiag");

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt;
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

  function toFixed2(n, fallback = "0.00") {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : fallback;
  }

  function safeJsonParse(s, fallback) {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  }

  function writeDiag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  function normalizeDir(d) {
    const s = String(d || "").toUpperCase().trim();
    if (!s) return "—";
    if (s === "NONE") return "NONE";
    if (s === "LEFT") return "LEFT";
    if (s === "RIGHT") return "RIGHT";
    if (s === "UP") return "UP";
    if (s === "DOWN") return "DOWN";
    return s; // allow custom labels if you ever add them
  }

  // -------- Read payload
  const raw = localStorage.getItem(SEC_KEY);
  const payload = raw ? safeJsonParse(raw, null) : null;

  if (!payload) {
    writeDiag({
      ok: false,
      reason: "Missing SEC payload in localStorage",
      key: SEC_KEY
    });

    // Keep UI in safe defaults
    setText(elSession, "—");
    setText(elShots, "0");
    setText(elScore, "—");
    setText(elWindClicks, "0.00");
    setText(elElevClicks, "0.00");
    setText(elWindDir, "—");
    setText(elElevDir, "—");
    setText(elPrev1, "—");
    setText(elPrev2, "—");
    setText(elPrev3, "—");

    enableBtn(elDownloadBtn, false);
    enableBtn(elVendorBtn, false);
    enableBtn(elSurveyBtn, false);
  } else {
    // -------- Populate header
    setText(elSession, payload.sessionId || "—");
    setText(elShots, Number.isFinite(Number(payload.shots)) ? String(Number(payload.shots)) : "0");

    // Score: number or —
    const scoreNum = Number(payload.score);
    setText(elScore, Number.isFinite(scoreNum) ? String(scoreNum) : "—");

    // -------- Populate clicks + direction
    const wind = payload.windage || {};
    const elev = payload.elevation || {};

    setText(elWindClicks, toFixed2(wind.clicks));
    setText(elElevClicks, toFixed2(elev.clicks));

    setText(elWindDir, normalizeDir(wind.dir));
    setText(elElevDir, normalizeDir(elev.dir));

    // -------- History PREV 1–3
    const histRaw = localStorage.getItem(HIST_KEY);
    const hist = histRaw ? safeJsonParse(histRaw, []) : [];

    const fmtHist = (h) => {
      if (!h) return "—";
      const s = (h.score === null || h.score === undefined) ? "—" : String(h.score);
      const sh = Number.isFinite(Number(h.shots)) ? Number(h.shots) : "—";
      // Keep it compact: "Score 92 | 5 shots"
      return `Score ${s} | ${sh} shots`;
    };

    setText(elPrev1, fmtHist(hist[0]));
    setText(elPrev2, fmtHist(hist[1]));
    setText(elPrev3, fmtHist(hist[2]));

    // -------- Buttons
    // Download SEC:
    // If secPngUrl exists → route to download.html?img=...&from=...&target=...
    const secPngUrl = String(payload.secPngUrl || "").trim();

    if (elDownloadBtn) {
      if (secPngUrl) {
        enableBtn(elDownloadBtn, true);
        elDownloadBtn.addEventListener("click", () => {
          const url =
            `./download.html?img=${encodeURIComponent(secPngUrl)}` +
            `&from=${encodeURIComponent(location.pathname)}` +
            `&target=${encodeURIComponent(payload.sessionId || "sec")}`;
          window.location.href = url;
        });
      } else {
        enableBtn(elDownloadBtn, false);
      }
    }

    // Vendor button
    const vendorUrl = String(payload.vendorUrl || "").trim();
    if (elVendorBtn) {
      if (vendorUrl) {
        enableBtn(elVendorBtn, true);
        elVendorBtn.addEventListener("click", () => {
          window.open(vendorUrl, "_blank", "noopener,noreferrer");
        });
      } else {
        enableBtn(elVendorBtn, false);
      }
    }

    // Survey button
    const surveyUrl = String(payload.surveyUrl || "").trim();
    if (elSurveyBtn) {
      if (surveyUrl) {
        enableBtn(elSurveyBtn, true);
        elSurveyBtn.addEventListener("click", () => {
          window.open(surveyUrl, "_blank", "noopener,noreferrer");
        });
      } else {
        enableBtn(elSurveyBtn, false);
      }
    }

    // Back button: prefer the stored "from" param if you later add it, otherwise default to target.html
    if (elBackBtn) {
      elBackBtn.addEventListener("click", () => {
        // If you came from target.html in your flow, go there:
        window.location.href = "./target.html";
      });
    }

    // Diagnostics
    writeDiag({
      ok: true,
      key: SEC_KEY,
      payload: {
        sessionId: payload.sessionId || null,
        shots: payload.shots ?? null,
        score: payload.score ?? null,
        windage: payload.windage || null,
        elevation: payload.elevation || null,
        hasSecPngUrl: Boolean(secPngUrl),
        hasVendorUrl: Boolean(vendorUrl),
        hasSurveyUrl: Boolean(surveyUrl)
      }
    });
  }
})();
