/* ============================================================
   tap-n-score/download.js (FULL REPLACEMENT) — AUTO OPEN + iOS FRIENDLY
   Reads SEC PNG from localStorage:
     SCZN3_SEC_PNG_DATAURL_V1
     SCZN3_SEC_PNG_BLOBURL_V1
   Shows preview image and supports:
   - Auto open on load when ?auto=1
   - Download button (fallback instructions for iOS)
============================================================ */

(() => {
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_PNG_BLOB = "SCZN3_SEC_PNG_BLOBURL_V1";
  const KEY_FROM = "SCZN3_SEC_FROM_V1";

  const $ = (id) => document.getElementById(id);

  const elImg = $("secImg");
  const elMsg = $("msgLine");
  const btnDownload = $("downloadBtn");
  const btnScoreAnother = $("scoreAnotherBtn");
  const btnBack = $("backBtn");

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function setMsg(t) {
    if (!elMsg) return;
    elMsg.textContent = String(t || "");
  }

  function bestSrc() {
    const blob = localStorage.getItem(KEY_PNG_BLOB);
    if (blob && blob.startsWith("blob:")) return { src: blob, kind: "blob" };

    const data = localStorage.getItem(KEY_PNG_DATA);
    if (data && data.startsWith("data:image/png")) return { src: data, kind: "data" };

    return { src: "", kind: "none" };
  }

  function navToIndex() {
    window.location.href = `./index.html?fresh=${Date.now()}`;
  }

  function navBackToFrom() {
    const from = localStorage.getItem(KEY_FROM);
    if (from && typeof from === "string" && from.includes("sec.html")) {
      window.location.href = from;
    } else {
      navToIndex();
    }
  }

  // iOS Safari won't always "download" on click for data/blob URLs.
  // Best approach: open the image in a new tab and let user Save to Photos.
  function openImageNewTab(src) {
    try {
      window.open(src, "_blank", "noopener,noreferrer");
      return true;
    } catch {
      return false;
    }
  }

  function tryProgrammaticDownload(src) {
    try {
      const a = document.createElement("a");
      a.href = src;
      a.download = "SEC.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch {
      return false;
    }
  }

  function doDownloadFlow(src) {
    if (!src) {
      setMsg("No SEC image found. Re-score to generate a PNG.");
      return;
    }

    // Try direct download first (works on many desktop browsers)
    const ok = tryProgrammaticDownload(src);
    if (ok) {
      setMsg("Downloading SEC.png…");
      return;
    }

    // Fallback: open image in new tab (best for iOS Save to Photos)
    const opened = openImageNewTab(src);
    if (opened) {
      setMsg("If download doesn’t start: press-and-hold the image and choose Save to Photos.");
      return;
    }

    setMsg("Could not start download. Try again or re-score.");
  }

  function boot() {
    const { src } = bestSrc();

    if (elImg) {
      elImg.src = src || "";
      elImg.alt = src ? "SEC Preview" : "No SEC image loaded";
    }

    if (!src) {
      setMsg("No SEC image found. Go back and re-score.");
    } else {
      setMsg("Tip (iPhone/iPad): press-and-hold the image to Save to Photos.");
    }

    // Buttons
    if (btnDownload) btnDownload.addEventListener("click", () => doDownloadFlow(src));
    if (btnScoreAnother) btnScoreAnother.addEventListener("click", navToIndex);
    if (btnBack) btnBack.addEventListener("click", navBackToFrom);

    // Auto-open
    if (getParam("auto") === "1" && src) {
      // Small delay helps iOS allow the popup/open more reliably
      setTimeout(() => doDownloadFlow(src), 350);
    }
  }

  boot();
})();
