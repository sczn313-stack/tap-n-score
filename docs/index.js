/* ============================================================
   docs/index.js  (FULL REPLACEMENT)
   Purpose:
   - Calls SCZN3 backend correctly (POST /api/calc)
   - Keeps backend base configurable (vendor.json or fallback)
   - Prevents browser "GET /api/calc" mistakes
   - Clean error handling + visible debug
============================================================ */

(() => {
  const $ = (sel) => document.querySelector(sel);

  // ---------- Config loading ----------
  async function loadVendorConfig() {
    // vendor.json is optional, but recommended.
    // Example:
    // { "backendBase": "https://sczn3-backend-new.onrender.com" }
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) throw new Error("vendor.json not found");
      const cfg = await res.json();
      return cfg && typeof cfg === "object" ? cfg : {};
    } catch {
      return {};
    }
  }

  function normalizeBase(url) {
    const s = String(url || "").trim();
    if (!s) return "";
    return s.replace(/\/+$/, ""); // strip trailing slashes
  }

  // ---------- POST helper ----------
  async function postJSON(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* keep text */ }
    return { ok: res.ok, status: res.status, data, text };
  }

  // ---------- Math helpers (frontend only for display/validation) ----------
  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  // ---------- UI refs (must exist in your docs/index.html) ----------
  const elStatus = $("#statusLine") || $("#status") || null;
  const elDebug  = $("#debugOut") || $("#debug") || null;

  function setStatus(msg) {
    if (elStatus) elStatus.textContent = msg;
    // also log for easy Safari debugging
    console.log("[STATUS]", msg);
  }

  function setDebug(objOrText) {
    if (!elDebug) return;
    if (typeof objOrText === "string") elDebug.textContent = objOrText;
    else elDebug.textContent = JSON.stringify(objOrText, null, 2);
  }

  // ---------- CORE: Call backend /api/calc ----------
  async function callBackendCalc(base, payload) {
    const url = `${base}/api/calc`;
    setStatus(`Calling POST ${url}`);
    setDebug({ postingTo: url, payload });

    const r = await postJSON(url, payload);

    if (!r.ok) {
      // If backend returns JSON, show it. Else show raw text.
      const shown = r.data || { ok: false, status: r.status, text: r.text };
      setStatus(`Backend error (${r.status})`);
      setDebug(shown);
      return null;
    }

    const data = r.data || {};
    setStatus("Backend OK ✅");
    setDebug(data);
    return data;
  }

  // ---------- Main boot ----------
  async function boot() {
    const cfg = await loadVendorConfig();

    // Priority:
    // 1) vendor.json backendBase
    // 2) window.BACKEND_BASE if you set it in HTML
    // 3) fallback hard-coded
    const base =
      normalizeBase(cfg.backendBase) ||
      normalizeBase(window.BACKEND_BASE) ||
      "https://sczn3-backend-new.onrender.com";

    // Quick health ping (GET)
    try {
      setStatus("Pinging backend…");
      const h = await fetch(`${base}/api/health`, { cache: "no-store" });
      const ht = await h.text();
      console.log("[HEALTH]", h.status, ht);
      if (!h.ok) throw new Error(ht);
      setStatus("Backend reachable ✅");
    } catch (e) {
      setStatus("Backend not reachable ❌");
      setDebug(String(e));
      // Continue anyway; user can still try.
    }

    // Hook to your existing button if present
    // We try common ids. If your button id differs, tell me and I’ll match it.
    const btn =
      $("#showResultsBtn") ||
      $("#seeResultsBtn") ||
      $("#btnResults") ||
      $("button[data-action='results']") ||
      null;

    if (!btn) {
      setStatus("Loaded. (No Results button found to hook.)");
      return;
    }

    btn.addEventListener("click", async () => {
      // ---- IMPORTANT ----
      // This payload must match what your backend expects.
      // If your app already computes bull/poib from taps, replace these with your real values.
      //
      // For now this keeps a safe minimal structure and won’t ever use GET /api/calc.
      //
      // If your existing code already has these values (distance, moaPerClick, bull, poib),
      // tell me the variable names and I will stitch them in exactly.

      const payload = {
        distanceYds: Number($("#distanceYds")?.value || 100),
        moaPerClick: Number($("#moaPerClick")?.value || 0.25),
        bull: { x: 0, y: 0 },
        poib: { x: 1.25, y: -0.5 },
      };

      // sanitize numbers
      payload.distanceYds = Number.isFinite(payload.distanceYds) ? payload.distanceYds : 100;
      payload.moaPerClick = Number.isFinite(payload.moaPerClick) ? payload.moaPerClick : 0.25;

      const out = await callBackendCalc(base, payload);
      if (!out) return;

      // If your UI has fields for directions/clicks, we can populate them.
      // Common structure from backend:
      // out.directions = { windage: "LEFT/RIGHT", elevation: "UP/DOWN" }
      // out.clicks = { windage: 1.23, elevation: 0.45 }

      const windEl = $("#windageDir") || $("#windDir") || null;
      const elevEl = $("#elevationDir") || $("#elevDir") || null;
      const wClkEl = $("#windageClicks") || $("#windClicks") || null;
      const eClkEl = $("#elevationClicks") || $("#elevClicks") || null;

      if (windEl && out.directions?.windage) windEl.textContent = out.directions.windage;
      if (elevEl && out.directions?.elevation) elevEl.textContent = out.directions.elevation;

      if (wClkEl && out.clicks?.windage != null) wClkEl.textContent = String(round2(out.clicks.windage));
      if (eClkEl && out.clicks?.elevation != null) eClkEl.textContent = String(round2(out.clicks.elevation));
    });

    setStatus("Docs loaded ✅ Ready.");
  }

  boot();
})();
