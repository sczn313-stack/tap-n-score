/* ============================================================
   tap-n-score/download.js (FULL REPLACEMENT) — MATCHES download.html IDS
   Reads SEC PNG from localStorage:
     SCZN3_SEC_PNG_DATAURL_V1
     SCZN3_SEC_PNG_BLOBURL_V1
   Shows preview + supports:
   - Auto open on load when ?auto=1
   - Download button (iOS-friendly open)
============================================================ */

(() => {
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_PNG_BLOB = "SCZN3_SEC_PNG_BLOBURL_V1";
  const KEY_FROM = "SCZN3_SEC_FROM_V1";

  const $ = (id) => document.getElementById(id);

  const elImg = $("secImg");
  const elEmpty = $("emptyState");
  const elStatus = $("statusLine");
  const elDiag = $("diag");
  const elDiagWrap = $("diagWrap");
  const elTiny = $("tinyNote");

  const btnDownload = $("downloadBtn");
  const btnScoreAnother = $("scoreAnotherBtn");
  const btnBackToSetup = $("backToSetupBtn");

  function getParam(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function setStatus(t) {
    if (!elStatus) return;
    elStatus.textContent = String(t || "");
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
      setStatus("No SEC image found. Re-score to generate a PNG.");
      return;
    }

    const ok = tryProgrammaticDownload(src);
    if (ok) {
      setStatus("Downloading SEC.png…");
      return;
    }

    const opened = openImageNewTab(src);
    if (opened) {
      setStatus("If download doesn’t start: press-and-hold the image and choose Save to Photos.");
      return;
    }

    setStatus("Could not start download. Try again or re-score.");
  }

  function boot() {
    const { src, kind } = bestSrc();

    // Preview
    if (elImg) {
      if (src) {
        elImg.style.display = "block";
        elImg.src = src;
      } else {
        elImg.style.display = "none";
        elImg.removeAttribute("src");
      }
    }

    if (elEmpty) elEmpty.style.display = src ? "none" : "block";

    if (!src) setStatus("No SEC image found. Go back and re-score.");
    else setStatus("Preview then download.");

    if (elTiny) elTiny.textContent = src ? `Loaded from: ${kind}` : "";

    // Diagnostics
    if (elDiag && elDiagWrap) {
      elDiag.textContent =
        `PNG kind: ${kind}\n` +
        `Has DATA: ${!!localStorage.getItem(KEY_PNG_DATA)}\n` +
        `Has BLOB: ${!!localStorage.getItem(KEY_PNG_BLOB)}\n` +
        `FROM: ${localStorage.getItem(KEY_FROM) || "—"}`;
    }

    // Buttons
    if (btnDownload) btnDownload.addEventListener("click", () => doDownloadFlow(src));
    if (btnScoreAnother) btnScoreAnother.addEventListener("click", navToIndex);
    if (btnBackToSetup) btnBackToSetup.addEventListener("click", navBackToFrom);

    // Auto-open
    if (getParam("auto") === "1" && src) {
      setTimeout(() => doDownloadFlow(src), 350);
    }
  }

  boot();
})();
