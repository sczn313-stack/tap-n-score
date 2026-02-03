/* ============================================================
   sec.js (FULL REPLACEMENT) — SEC Page
   Fix:
   - Reads payload from URL first (reliable)
   - Falls back to localStorage
   - If missing, shows message and redirects to Target page
============================================================ */

(() => {
  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  const $ = (id) => document.getElementById(id);

  // OPTIONAL IDs on SEC page (wire these to your UI)
  const elScore = $("secScore");
  const elShots = $("secShots");
  const elWindDir = $("secWindDir");
  const elWindClicks = $("secWindClicks");
  const elElevDir = $("secElevDir");
  const elElevClicks = $("secElevClicks");
  const btnBack = $("backToTargetBtn"); // your existing “Go back to target” button

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

  function goTarget() {
    location.href = "./index.html?fresh=" + Date.now();
  }

  function showNoDataState() {
    // Leave existing SEC shell alone, but add a clear banner so it’s obvious what happened.
    const banner = document.createElement("div");
    banner.style.maxWidth = "820px";
    banner.style.margin = "16px auto";
    banner.style.padding = "14px 16px";
    banner.style.borderRadius = "12px";
    banner.style.border = "1px solid rgba(255,255,255,0.18)";
    banner.style.background = "rgba(0,0,0,0.35)";
    banner.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    banner.innerHTML = `
      <div style="font-size:18px;font-weight:700;margin-bottom:6px;">SEC loaded with no data</div>
      <div style="opacity:0.9;margin-bottom:10px;">
        Please return to the Target page and tap <b>Show Results</b>.
      </div>
      <button id="secNoDataBack" style="padding:10px 14px;border-radius:10px;border:0;cursor:pointer;">
        Go back to Target
      </button>
    `;
    document.body.prepend(banner);

    banner.querySelector("#secNoDataBack").onclick = goTarget;

    // Auto-return after a moment
    setTimeout(goTarget, 2000);
  }

  function render(payload) {
    // If your SEC has different IDs, swap them here.
    if (elScore) elScore.textContent = String(payload.score ?? "");
    if (elShots) elShots.textContent = String(payload.shots ?? "");

    if (elWindDir) elWindDir.textContent = String(payload.windage?.dir ?? "");
    if (elWindClicks) elWindClicks.textContent = format2(payload.windage?.clicks);

    if (elElevDir) elElevDir.textContent = String(payload.elevation?.dir ?? "");
    if (elElevClicks) elElevClicks.textContent = format2(payload.elevation?.clicks);

    // If you have vendor link/button
    const vendorA = $("secVendorLink");
    if (vendorA && payload.vendorUrl) {
      vendorA.href = payload.vendorUrl;
      vendorA.style.display = "";
    }

    // Debug (optional)
    console.log("SEC payload:", payload);
  }

  function format2(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2);
  }

  // Wire the back button if present
  if (btnBack) btnBack.addEventListener("click", goTarget);

  // BOOT
  const payload = getPayload();
  if (!payload) {
    showNoDataState();
    return;
  }

  render(payload);
})();
