/* ============================================================
   docs/sec.js (FULL REPLACEMENT) — SEC Page (works with your IDs)
   Confirmed IDs in your sec.html:
   - backToTargetBtn
   - secDiag

   Fix:
   - URL payload first, localStorage backup
   - Always renders a visible "Results" card even if your boxes are just shells
   - Writes full payload into Diagnostics (secDiag)
============================================================ */

(() => {
  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  const $ = (id) => document.getElementById(id);

  const btnBack = $("backToTargetBtn");
  const elDiag = $("secDiag");

  function goTarget() {
    // adjust if your target page filename differs:
    location.href = "./index.html?fresh=" + Date.now();
  }

  function decodePayloadFromUrl() {
    const params = new URLSearchParams(location.search);
    const b64 = params.get("payload");
    if (!b64) return null;

    try {
      const json = decodeURIComponent(escape(atob(b64)));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function getPayload() {
    // 1) URL first
    const fromUrl = decodePayloadFromUrl();
    if (fromUrl) {
      try { localStorage.setItem(KEY, JSON.stringify(fromUrl)); } catch (e) {}
      return fromUrl;
    }

    // 2) localStorage fallback
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function format2(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }

  function writeDiagnostics(payload) {
    if (!elDiag) return;
    try {
      elDiag.textContent = JSON.stringify(payload, null, 2);
    } catch (e) {
      elDiag.textContent = "(diag: failed to stringify payload)";
    }
  }

  function injectResultsCard(payload) {
    // Remove old injected card if present
    const old = document.getElementById("secInjectedCard");
    if (old) old.remove();

    const windDir = payload?.windage?.dir ?? "";
    const windClicks = format2(payload?.windage?.clicks);
    const elevDir = payload?.elevation?.dir ?? "";
    const elevClicks = format2(payload?.elevation?.clicks);

    const shots = payload?.shots ?? "";
    const score = payload?.score ?? "";

    const card = document.createElement("div");
    card.id = "secInjectedCard";
    card.style.maxWidth = "860px";
    card.style.margin = "14px auto";
    card.style.padding = "14px 16px";
    card.style.borderRadius = "14px";
    card.style.border = "1px solid rgba(255,255,255,0.18)";
    card.style.background = "rgba(0,0,0,0.35)";
    card.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";

    card.innerHTML = `
      <div style="font-size:18px;font-weight:800;margin-bottom:10px;">
        SEC Results (data confirmed)
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.06);min-width:180px;">
          <div style="opacity:0.85;font-size:12px;">Score</div>
          <div style="font-size:22px;font-weight:800;">${score}</div>
        </div>

        <div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.06);min-width:180px;">
          <div style="opacity:0.85;font-size:12px;">Shots</div>
          <div style="font-size:22px;font-weight:800;">${shots}</div>
        </div>

        <div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.06);min-width:220px;">
          <div style="opacity:0.85;font-size:12px;">Windage</div>
          <div style="font-size:20px;font-weight:800;">${windDir} ${windClicks}</div>
        </div>

        <div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.06);min-width:220px;">
          <div style="opacity:0.85;font-size:12px;">Elevation</div>
          <div style="font-size:20px;font-weight:800;">${elevDir} ${elevClicks}</div>
        </div>
      </div>

      <div style="opacity:0.85;font-size:12px;">
        sessionId: <span style="opacity:0.95;">${payload?.sessionId ?? "(none)"}</span>
      </div>
    `;

    // Put it right under <body> so it’s always visible
    document.body.prepend(card);
  }

  function showNoData() {
    // Also write a diagnostic message
    if (elDiag) elDiag.textContent = "(none) — SEC loaded without payload";

    const card = document.createElement("div");
    card.id = "secInjectedCard";
    card.style.maxWidth = "860px";
    card.style.margin = "14px auto";
    card.style.padding = "14px 16px";
    card.style.borderRadius = "14px";
    card.style.border = "1px solid rgba(255,255,255,0.18)";
    card.style.background = "rgba(120,0,0,0.25)";
    card.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";

    card.innerHTML = `
      <div style="font-size:18px;font-weight:800;margin-bottom:8px;">
        SEC opened with no data
      </div>
      <div style="opacity:0.9;margin-bottom:10px;">
        That means the Target page did not send the payload in the URL and there was no backup in localStorage.
      </div>
      <button id="secBackNow" style="padding:10px 14px;border-radius:10px;border:0;cursor:pointer;">
        Back to Target
      </button>
    `;

    document.body.prepend(card);
    card.querySelector("#secBackNow").onclick = goTarget;
  }

  // Wire your existing button
  if (btnBack) btnBack.addEventListener("click", goTarget);

  // BOOT
  const payload = getPayload();

  if (!payload) {
    showNoData();
    return;
  }

  writeDiagnostics(payload);
  injectResultsCard(payload);
})();
