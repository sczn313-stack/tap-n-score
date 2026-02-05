/* ============================================================
   tap-n-score/download.js (FULL REPLACEMENT) — Auto-open + auto-download (iOS-safe)
   Reads:
   - ?img=... (optional)
   - localStorage SCZN3_SEC_PNG (primary for our flow)
============================================================ */

(() => {
  const KEY_PNG = "SCZN3_SEC_PNG";

  const $ = (id) => document.getElementById(id);

  const elImg = $("secImg");
  const elMsg = $("msgLine");
  const btnDl = $("dlBtn");
  const btnScoreAnother = $("scoreAnotherBtn");
  const btnBack = $("backBtn");
  const elDiag = $("diagPre");

  function setMsg(t) { if (elMsg) elMsg.textContent = String(t || ""); }
  function setDiag(o) { if (elDiag) elDiag.textContent = JSON.stringify(o, null, 2); }

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function getDataUrl() {
    const p = getParam("img");
    if (p && (p.startsWith("data:image/") || p.startsWith("http"))) return p;
    const ls = localStorage.getItem(KEY_PNG) || "";
    if (ls && ls.startsWith("data:image/")) return ls;
    return "";
  }

  function tryDownload(dataUrl) {
    // iOS Safari may block automatic downloads; this still works on many devices.
    try {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "SEC.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch {
      return false;
    }
  }

  function goIndex() {
    window.location.href = `./index.html?fresh=${Date.now()}`;
  }

  const img = getDataUrl();

  const diag = {
    ok: !!img,
    reason: img ? "ok" : "missing img",
    imgSource: img ? (img.startsWith("data:image/") ? "localStorage/img-param" : "url") : "none",
    example: "https://sczn313-stack.github.io/tap-n-score/download.html?img=data:image/png;base64,...",
  };
  setDiag(diag);

  if (!img) {
    setMsg("No SEC image loaded.");
    return;
  }

  if (elImg) {
    elImg.onload = () => {
      // Attempt auto-download
      const ok = tryDownload(img);
      if (!ok) {
        setMsg("Press-and-hold the image and choose Save to Photos.");
      } else {
        setMsg("Download started.");
      }
    };
    elImg.onerror = () => setMsg("Image failed to load.");
    elImg.src = img;
  }

  if (btnDl) btnDl.addEventListener("click", () => tryDownload(img));
  if (btnScoreAnother) btnScoreAnother.addEventListener("click", goIndex);
  if (btnBack) btnBack.addEventListener("click", goIndex);
})();
