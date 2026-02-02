/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — SEC page renderer
   - Reads SEC payload from localStorage
   - Populates SEC numbers
   - Enables Download button when secPngUrl exists
   - Adds diagnostics so we can see what's missing
============================================================ */

(() => {
  // ---- Storage key (writer should use this)
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  const $ = (id) => document.getElementById(id);

  // ---- Try to find elements by multiple possible IDs (safe + tolerant)
  const elSession =
    $("secSession") || $("sessionVal") || $("sessionValue") || $("sessionText");
  const elShots =
    $("secShots") || $("shotsVal") || $("shotsValue") || $("shotsText");
  const elScore =
    $("secScore") || $("scoreVal") || $("scoreValue") || $("scoreText");

  const elWindDir =
    $("windDir") || $("windageDir") || $("secWindDir");
  const elWindClicks =
    $("windClicks") || $("windageClicks") || $("secWindClicks");

  const elElevDir =
    $("elevDir") || $("elevationDir") || $("secElevDir");
  const elElevClicks =
    $("elevClicks") || $("elevationClicks") || $("secElevClicks");

  const btnDownload =
    $("downloadSecBtn") || $("downloadBtn") || $("downloadSEC");

  const btnBuy =
    $("buyMoreBtn") || $("buyMoreTargetsBtn") || $("buyMore");
  const btnSurvey =
    $("surveyBtn") || $("surveyButton") || $("survey");

  const btnBack =
    $("backToTargetBtn") || $("backBtn") || $("backToTarget");

  // ---- Create a small diagnostics panel (non-intrusive)
  function ensureDiag() {
    let box = $("secDiag");
    if (box) return box;
    box = document.createElement("pre");
    box.id = "secDiag";
    box.style.marginTop = "12px";
    box.style.padding = "10px 12px";
    box.style.borderRadius = "12px";
    box.style.border = "1px solid rgba(255,255,255,.12)";
    box.style.background = "rgba(0,0,0,.25)";
    box.style.color = "rgba(238,242,247,.80)";
    box.style.fontSize = "12px";
    box.style.lineHeight = "1.35";
    box.style.whiteSpace = "pre-wrap";
    box.style.wordBreak = "break-word";
    box.style.maxHeight = "180px";
    box.style.overflow = "auto";
    box.textContent = "SEC diagnostics…";

    // Put it at the bottom of the page
    document.body.appendChild(box);
    return box;
  }

  const diag = ensureDiag();

  function setText(el, value) {
    if (!el) return;
    el.textContent = value;
  }

  function n2(x) {
    const v = Number(x);
    return Number.isFinite(v) ? v.toFixed(2) : "0.00";
  }

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function readPayload() {
    // Primary
    const raw = localStorage.getItem(SEC_KEY);
    if (raw) return { raw, payload: safeParse(raw), key: SEC_KEY };

    // Optional fallbacks (in case earlier builds used a different key)
    const fallbacks = [
      "SCZN3_SEC_PAYLOAD",
      "SCZN3_SEC",
      "SEC_PAYLOAD",
    ];
    for (const k of fallbacks) {
      const r = localStorage.getItem(k);
      if (r) return { raw: r, payload: safeParse(r), key: k };
    }
    return { raw: null, payload: null, key: null };
  }

  function setBtnDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.classList.toggle("btnDisabled", !!disabled);
  }

  function buildDownloadHref(secPngUrl) {
    // Use your existing download page flow
    const from = encodeURIComponent("./sec.html");
    const target = encodeURIComponent("./target.html");
    const img = encodeURIComponent(secPngUrl);
    return `./download.html?img=${img}&from=${from}&target=${target}`;
  }

  // ---- Main
  const { raw, payload, key } = readPayload();

  // If missing: show exactly why the page is empty
  if (!payload) {
    setText(elSession, "—");
    setText(elShots, "0");
    setText(elScore, "—");

    if (elWindDir) setText(elWindDir, "—");
    if (elWindClicks) setText(elWindClicks, "0.00");

    if (elElevDir) setText(elElevDir, "—");
    if (elElevClicks) setText(elElevClicks, "0.00");

    setBtnDisabled(btnDownload, true);

    diag.textContent =
      "SEC payload NOT FOUND in localStorage.\n\n" +
      "Fix:\n" +
      "1) Go back to scoring page\n" +
      "2) Tap bull + shots\n" +
      "3) Press Show Results (this writes payload then routes here)\n\n" +
      "Expected key: " + SEC_KEY;

    // Back button fallback
    if (btnBack) {
      btnBack.addEventListener("click", () => {
        window.location.href = "./target.html";
      });
    }
    return;
  }

  // ---- We have payload: populate UI
  const sessionId = payload.sessionId || "—";
  const shots = Number(payload.shots ?? 0);
  const score = payload.score;

  const windDir = payload.windage?.dir ?? "—";
  const windClicks = payload.windage?.clicks ?? 0;

  const elevDir = payload.elevation?.dir ?? "—";
  const elevClicks = payload.elevation?.clicks ?? 0;

  // Link for download
  const secPngUrl =
    payload.secPngUrl ||
    payload.secUrl ||
    payload.pngUrl ||
    payload.cardPngUrl ||
    "";

  setText(elSession, sessionId);
  setText(elShots, String(Number.isFinite(shots) ? shots : 0));

  // Score display: if number, show it; else dash
  if (Number.isFinite(Number(score))) {
    setText(elScore, String(Number(score)));
  } else {
    setText(elScore, "—");
  }

  if (elWindDir) setText(elWindDir, String(windDir));
  if (elWindClicks) setText(elWindClicks, n2(windClicks));

  if (elElevDir) setText(elElevDir, String(elevDir));
  if (elElevClicks) setText(elElevClicks, n2(elevClicks));

  // Buttons
  if (btnDownload) {
    if (!secPngUrl) {
      setBtnDisabled(btnDownload, true);
    } else {
      setBtnDisabled(btnDownload, false);
      btnDownload.addEventListener("click", () => {
        window.location.href = buildDownloadHref(secPngUrl);
      });
    }
  }

  if (btnBuy && payload.vendorUrl) {
    btnBuy.addEventListener("click", () => window.open(payload.vendorUrl, "_blank", "noopener"));
  } else {
    // If empty, disable to avoid dead tap
    setBtnDisabled(btnBuy, true);
  }

  if (btnSurvey && payload.surveyUrl) {
    btnSurvey.addEventListener("click", () => window.open(payload.surveyUrl, "_blank", "noopener"));
  } else {
    setBtnDisabled(btnSurvey, true);
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      window.location.href = "./target.html";
    });
  }

  // ---- Diagnostics
  diag.textContent =
    "SEC payload loaded ✅\n" +
    "storageKey: " + key + "\n" +
    "secPngUrl present: " + (secPngUrl ? "YES" : "NO") + "\n\n" +
    "payload:\n" + raw;
})();
