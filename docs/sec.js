/* ============================================================
   docs/sec.js (FULL REPLACEMENT)
   Reads SEC payload from localStorage and renders sec.html

   - Primary key: SCZN3_SEC_PAYLOAD_V1
   - History key : SCZN3_SEC_HISTORY_V1
   - Adds deterministic diagnostics + "Seed Test" button
============================================================ */

(() => {
  const SEC_KEY  = "SCZN3_SEC_PAYLOAD_V1";
  const HIST_KEY = "SCZN3_SEC_HISTORY_V1";

  const $ = (id) => document.getElementById(id);

  // ---- UI refs
  const elSession    = $("secSession");
  const elShots      = $("secShots");
  const elScore      = $("secScore");
  const elWindClicks = $("secWindClicks");
  const elWindDir    = $("secWindDir");
  const elElevClicks = $("secElevClicks");
  const elElevDir    = $("secElevDir");

  const elPrev1 = $("prev1");
  const elPrev2 = $("prev2");
  const elPrev3 = $("prev3");

  const elDiag = $("secDiag");

  const btnDownload = $("downloadBtn");
  const btnVendor   = $("vendorBtn");
  const btnSurvey   = $("surveyBtn");
  const btnBack     = $("backToTargetBtn");

  // ---- helpers
  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function fmt2(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  }

  function setText(el, v) {
    if (!el) return;
    el.textContent = v;
  }

  function enableBtn(btn, on) {
    if (!btn) return;
    if (on) {
      btn.classList.remove("btnDisabled");
      btn.setAttribute("aria-disabled", "false");
      btn.disabled = false;
    } else {
      btn.classList.add("btnDisabled");
      btn.setAttribute("aria-disabled", "true");
      btn.disabled = true;
    }
  }

  function diagObject(extra = {}) {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
    } catch (_) {}

    return {
      ok: false,
      reason: "Missing SEC payload in localStorage",
      key: SEC_KEY,
      href: location.href,
      origin: location.origin,
      pathname: location.pathname,
      storageKeys: keys,
      ...extra
    };
  }

  function renderHistory() {
    const hist = safeJsonParse(localStorage.getItem(HIST_KEY) || "[]", []);
    const lines = hist.map((h) => {
      const score = (h?.score == null) ? "—" : String(h.score);
      const shots = Number.isFinite(Number(h?.shots)) ? String(h.shots) : "—";
      const wind  = h?.wind || "—";
      const elev  = h?.elev || "—";
      return `${score} | shots ${shots} | ${wind} | ${elev}`;
    });

    setText(elPrev1, lines[0] || "—");
    setText(elPrev2, lines[1] || "—");
    setText(elPrev3, lines[2] || "—");
  }

  // ---- seed test (proves localStorage works on device/origin)
  function seedPayload() {
    const seed = {
      sessionId: "SEED-TEST",
      score: 88,
      shots: 5,
      windage: { dir: "LEFT",  clicks: 1.25 },
      elevation:{ dir: "DOWN",  clicks: 0.75 },
      secPngUrl: "",
      vendorUrl: "",
      surveyUrl: ""
    };
    localStorage.setItem(SEC_KEY, JSON.stringify(seed));

    // Also add one history line so PREV shows something
    const entry = {
      t: Date.now(),
      score: seed.score,
      shots: seed.shots,
      wind: `${seed.windage.dir} ${fmt2(seed.windage.clicks)}`,
      elev: `${seed.elevation.dir} ${fmt2(seed.elevation.clicks)}`
    };
    localStorage.setItem(HIST_KEY, JSON.stringify([entry]));
    location.reload();
  }

  // ---- main load
  function loadPayload() {
    const raw = localStorage.getItem(SEC_KEY);
    if (!raw) return null;
    const payload = safeJsonParse(raw, null);
    return payload && typeof payload === "object" ? payload : null;
  }

  function render(payload) {
    // Header pills
    setText(elSession, payload?.sessionId || "—");
    setText(elShots, Number.isFinite(Number(payload?.shots)) ? String(payload.shots) : "0");

    // Score
    const score = payload?.score;
    setText(elScore, Number.isFinite(Number(score)) ? String(score) : "—");

    // Clicks + dirs
    setText(elWindClicks, fmt2(payload?.windage?.clicks));
    setText(elWindDir, payload?.windage?.dir || "—");

    setText(elElevClicks, fmt2(payload?.elevation?.clicks));
    setText(elElevDir, payload?.elevation?.dir || "—");

    // Buttons
    enableBtn(btnDownload, !!(payload?.secPngUrl));
    enableBtn(btnVendor, !!(payload?.vendorUrl));
    enableBtn(btnSurvey, !!(payload?.surveyUrl));

    if (btnVendor && payload?.vendorUrl) {
      btnVendor.onclick = () => window.open(payload.vendorUrl, "_blank");
    }
    if (btnSurvey && payload?.surveyUrl) {
      btnSurvey.onclick = () => window.open(payload.surveyUrl, "_blank");
    }

    // Download can simply go to download.html?img=... if you’re using that flow
    if (btnDownload && payload?.secPngUrl) {
      btnDownload.onclick = () => {
        const secUrl = payload.secPngUrl;
        const from = location.pathname;
        window.location.href =
          `./download.html?img=${encodeURIComponent(secUrl)}&from=${encodeURIComponent(from)}&target=${encodeURIComponent("sec")}`;
      };
    }

    // Back
    if (btnBack) {
      btnBack.onclick = () => window.location.href = "./index.html";
    }

    renderHistory();

    // Diagnostics
    if (elDiag) {
      elDiag.textContent = JSON.stringify({ ok: true, key: SEC_KEY, href: location.href }, null, 2);
    }
  }

  // ---- boot
  try {
    const payload = loadPayload();

    if (!payload) {
      // Show strong diagnostics, plus a seed test control.
      if (elDiag) {
        elDiag.textContent = JSON.stringify(diagObject(), null, 2);
      }

      // Make the SCORE area clickable for Seed Test (no HTML edits required)
      // Tap the score box 5 times quickly to seed.
      let taps = 0;
      let t0 = 0;
      const box = elScore?.parentElement; // scoreBox div
      if (box) {
        box.style.cursor = "pointer";
        box.title = "Tap 5x for Seed Test";
        box.addEventListener("click", () => {
          const now = Date.now();
          if (now - t0 > 1200) taps = 0;
          t0 = now;
          taps += 1;
          if (taps >= 5) seedPayload();
        });
      }

      // Ensure buttons are disabled
      enableBtn(btnDownload, false);
      enableBtn(btnVendor, false);
      enableBtn(btnSurvey, false);

      if (btnBack) btnBack.onclick = () => window.location.href = "./index.html";

      // Render history even if missing
      renderHistory();
      return;
    }

    render(payload);
  } catch (err) {
    if (elDiag) {
      elDiag.textContent = JSON.stringify(
        diagObject({ error: String(err?.message || err) }),
        null,
        2
      );
    }
  }
})();
