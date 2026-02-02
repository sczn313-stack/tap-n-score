/* ============================================================
   docs/sec.js  (FULL REPLACEMENT)
   - Reads SEC payload from multiple possible keys (cache-proof)
   - Writes diagnostics showing EXACTLY which key was found
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ✅ Accept BOTH (and a couple common variants) so we can't lose it
  const SEC_KEYS = [
    "SCZN3_SEC_PAYLOAD_V1",
    "SCZN3_SEC_PAYLOAD",
    "SCZN3_SEC_PAYLOAD_V0",
    "SCZN3_SEC_PAYLOAD_v1",
    "sczn3_sec_payload_v1"
  ];

  const HIST_KEYS = [
    "SCZN3_SEC_HISTORY_V1",
    "SCZN3_SEC_HISTORY"
  ];

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
    return Number.isFinite(x) ? x.toFixed(2) : "0.00";
  };

  function setText(el, v) { if (el) el.textContent = v; }

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

  function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

  function setDiag(obj) {
    if (!elDiag) return;
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  function findFirstLocalStorageKey(keys) {
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (raw) return { key: k, raw };
    }
    return { key: null, raw: null };
  }

  function normalizeDir(d) {
    const s = String(d || "—").toUpperCase();
    if (["LEFT","RIGHT","NONE","UP","DOWN"].includes(s)) return s;
    return "—";
  }

  function loadHistory() {
    const found = findFirstLocalStorageKey(HIST_KEYS);
    if (!found.raw) return [];
    const arr = safeParse(found.raw);
    return Array.isArray(arr) ? arr : [];
  }

  function formatHist(entry) {
    const shots = Number(entry?.shots);
    const wind = String(entry?.wind || "").trim();
    const elev = String(entry?.elev || "").trim();
    const parts = [];
    if (Number.isFinite(shots)) parts.push(`${shots} shots`);
    if (wind) parts.push(wind);
    if (elev) parts.push(elev);
    return parts.length ? parts.join(" • ") : "—";
  }

  function renderHistory() {
    const h = loadHistory();
    setText(elPrev1, h[0] ? formatHist(h[0]) : "—");
    setText(elPrev2, h[1] ? formatHist(h[1]) : "—");
    setText(elPrev3, h[2] ? formatHist(h[2]) : "—");
  }

  // ---- Back button always works
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "./target.html?fresh=1";
    });
  }

  // ---- Boot
  (function init() {
    disableBtn(downloadBtn);
    disableBtn(vendorBtn);
    disableBtn(surveyBtn);

    renderHistory();

    const found = findFirstLocalStorageKey(SEC_KEYS);
    const payload = found.raw ? safeParse(found.raw) : null;

    // If missing payload, show EXACT truth
    if (!payload) {
      setText(elSession, "—");
      setText(elShots, "0");
      setText(elScore, "—");
      setText(elWindClicks, "0.00");
      setText(elElevClicks, "0.00");
      setText(elWindDir, "—");
      setText(elElevDir, "—");

      setDiag({
        ok: false,
        reason: "SEC payload not found under any known key",
        triedKeys: SEC_KEYS,
        foundKey: found.key,
        note: "If foundKey is null, the payload was never written OR you're on a cached/old build."
      });
      return;
    }

    // Render payload
    const sessionId = String(payload.sessionId || "—");
    const shots = Number(payload.shots);
    const scoreNum = Number(payload.score);

    const windDir = normalizeDir(payload?.windage?.dir);
    const elevDir = normalizeDir(payload?.elevation?.dir);

    const windClicks = payload?.windage?.clicks ?? 0;
    const elevClicks = payload?.elevation?.clicks ?? 0;

    setText(elSession, sessionId);
    setText(elShots, Number.isFinite(shots) ? String(shots) : "0");
    setText(elScore, Number.isFinite(scoreNum) ? String(scoreNum) : "—");

    setText(elWindClicks, round2(windClicks));
    setText(elElevClicks, round2(elevClicks));

    setText(elWindDir, windDir);
    setText(elElevDir, elevDir);

    const secPngUrl = String(payload.secPngUrl || payload.secUrl || "").trim();
    const vendorUrl = String(payload.vendorUrl || "").trim();
    const surveyUrl = String(payload.surveyUrl || "").trim();

    if (secPngUrl) {
      enableBtn(downloadBtn, () => {
        const from = "./index.html?fresh=1";
        const target = "./target.html?fresh=1";
        window.location.href =
          `./download.html?img=${encodeURIComponent(secPngUrl)}&from=${encodeURIComponent(from)}&target=${encodeURIComponent(target)}`;
      });
    }

    if (vendorUrl) enableBtn(vendorBtn, () => (window.location.href = vendorUrl));
    if (surveyUrl) enableBtn(surveyBtn, () => (window.location.href = surveyUrl));

    renderHistory();

    setDiag({
      ok: true,
      foundKey: found.key,
      sessionId,
      shots: Number.isFinite(shots) ? shots : 0,
      wind: { dir: windDir, clicks: round2(windClicks) },
      elev: { dir: elevDir, clicks: round2(elevClicks) },
      hasDownload: !!secPngUrl
    });
  })();
})();
