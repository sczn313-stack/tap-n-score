/* ============================================================
   sec.js — Shooter Experience Card Renderer (FULL REPLACEMENT)

   Reads payload from localStorage:
     key = "SCZN3_SEC_PAYLOAD_V1"

   Renders:
   - Session
   - Shots
   - Score
   - Windage / Elevation (clicks + direction)
   - Enables buttons when payload is valid
============================================================ */

(() => {
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  // ---- DOM helpers
  const $ = (id) => document.getElementById(id);

  const diagEl = $("secDiag");

  function diag(obj) {
    if (diagEl) {
      diagEl.textContent = JSON.stringify(obj, null, 2);
    }
  }

  // ---- Load payload
  let raw = null;
  let payload = null;

  try {
    raw = localStorage.getItem(SEC_KEY);
    if (!raw) {
      diag({
        ok: false,
        reason: "Missing SEC payload in localStorage",
        key: SEC_KEY
      });
      return;
    }

    payload = JSON.parse(raw);
  } catch (e) {
    diag({
      ok: false,
      reason: "Failed to parse SEC payload",
      error: String(e)
    });
    return;
  }

  // ---- Validate minimum fields
  if (!payload || typeof payload !== "object") {
    diag({
      ok: false,
      reason: "Invalid SEC payload shape",
      payload
    });
    return;
  }

  // ---- Render header pills
  if ($("secSession")) {
    $("secSession").textContent = payload.sessionId || "—";
  }

  if ($("secShots")) {
    $("secShots").textContent =
      Number.isFinite(payload.shots) ? payload.shots : 0;
  }

  // ---- Render score
  if ($("secScore")) {
    $("secScore").textContent =
      Number.isFinite(payload.score) ? payload.score.toFixed(2) : "—";
  }

  // ---- Render windage
  if ($("secWindClicks")) {
    $("secWindClicks").textContent =
      Number.isFinite(payload.windage?.clicks)
        ? payload.windage.clicks.toFixed(2)
        : "0.00";
  }

  if ($("secWindDir")) {
    $("secWindDir").textContent = payload.windage?.dir || "—";
  }

  // ---- Render elevation
  if ($("secElevClicks")) {
    $("secElevClicks").textContent =
      Number.isFinite(payload.elevation?.clicks)
        ? payload.elevation.clicks.toFixed(2)
        : "0.00";
  }

  if ($("secElevDir")) {
    $("secElevDir").textContent = payload.elevation?.dir || "—";
  }

  // ---- Enable buttons
  const enable = (id) => {
    const b = $(id);
    if (!b) return;
    b.classList.remove("btnDisabled");
    b.removeAttribute("aria-disabled");
  };

  enable("downloadBtn");
  enable("backToTargetBtn");

  if (payload.vendorUrl) enable("vendorBtn");
  if (payload.surveyUrl) enable("surveyBtn");

  // ---- Wire buttons
  $("downloadBtn")?.addEventListener("click", () => {
    if (payload.secPngUrl) {
      window.location.href =
        "./download.html?img=" + encodeURIComponent(payload.secPngUrl);
    }
  });

  $("vendorBtn")?.addEventListener("click", () => {
    if (payload.vendorUrl) window.open(payload.vendorUrl, "_blank");
  });

  $("surveyBtn")?.addEventListener("click", () => {
    if (payload.surveyUrl) window.open(payload.surveyUrl, "_blank");
  });

  $("backToTargetBtn")?.addEventListener("click", () => {
    window.location.href = "./target.html";
  });

  // ---- Diagnostics success
  diag({
    ok: true,
    sessionId: payload.sessionId,
    shots: payload.shots,
    score: payload.score,
    windage: payload.windage,
    elevation: payload.elevation
  });
})();
