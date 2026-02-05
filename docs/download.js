/* ============================================================
   tap-n-score/download.js (FULL REPLACEMENT) — PREVIEW + DIAG + iOS FRIENDLY
   Reads SEC PNG from localStorage:
     SCZN3_SEC_PNG_DATAURL_V1
     SCZN3_SEC_PNG_BLOBURL_V1
   Optional:
     SCZN3_SEC_FROM_V1  (back-to-sec route)
   Behavior:
   - Shows preview (hides empty state)
   - Download button:
       1) tries programmatic download
       2) falls back to opening image (best on iOS: press-and-hold -> Save)
   - Auto mode (?auto=1):
       attempts download flow, but if popup blocked, shows clear instruction
============================================================ */

(() => {
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_PNG_BLOB = "SCZN3_SEC_PNG_BLOBURL_V1";
  const KEY_FROM = "SCZN3_SEC_FROM_V1";

  const $ = (id) => document.getElementById(id);

  const elImg = $("secImg");
  const elEmpty = $("emptyState");
  const elMsg = $("msgLine");
  const elDiag = $("diag");

  const btnDownload = $("downloadBtn");
  const btnScoreAnother = $("scoreAnotherBtn");
  const btnBack = $("backBtn");

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name);
    } catch {
      return null;
    }
  }

  function setMsg(t) {
    if (elMsg) elMsg.textContent = String(t || "");
  }

  function setDiag(obj) {
    if (!elDiag) return;
    try { elDiag.textContent = JSON.stringify(obj, null, 2); }
    catch { elDiag.textContent = String(obj); }
  }

  function bestSrc() {
    let blob = "";
    let data = "";
    try { blob = localStorage.getItem(KEY_PNG_BLOB) || ""; } catch {}
    try { data = localStorage.getItem(KEY_PNG_DATA) || ""; } catch {}

    if (blob && blob.startsWith("blob:")) return { src: blob, kind: "blob" };
    if (data && data.startsWith("data:image/png")) return { src: data, kind: "data" };
    return { src: "", kind: "none" };
  }

  function showPreview(src) {
    if (elEmpty) elEmpty.style.display = src ? "none" : "block";
    if (!elImg) return;

    if (!src) {
      elImg.style.display = "none";
      elImg.removeAttribute("src");
      return;
    }

    elImg.style.display = "block";
    elImg.src = src;
  }

  function navToIndex() {
    window.location.href = `./index.html?fresh=${Date.now()}`;
  }

  function navBackToFrom() {
    let from = "";
    try { from = localStorage.getItem(KEY_FROM) || ""; } catch {}
    if (from && typeof from === "string" && from.includes("sec.html")) {
      window.location.href = from;
      return;
    }
    navToIndex();
  }

  // iOS: "download" often fails; opening the image is most reliable.
  function openImage(src) {
    // try new tab first
    try {
      const w = window.open(src, "_blank", "noopener,noreferrer");
      if (w) return true;
    } catch {}

    // fallback: same-tab navigation
    try {
      window.location.href = src;
      return true;
    } catch {}

    return false;
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

  function doDownloadFlow(src, meta = {}) {
    if (!src) {
      setMsg("No SEC image found. Go back and re-score.");
      setDiag({ ok: false, reason: "missing_src", ...meta });
      return;
    }

    // Try classic download (desktop-friendly)
    const okDl = tryProgrammaticDownload(src);
    if (okDl) {
      setMsg("Downloading SEC.png…");
      setDiag({ ok: true, method: "anchor_download", ...meta });
      return;
    }

    // Fallback: open image (best for iOS save-to-photos)
    const opened = openImage(src);
    if (opened) {
      setMsg("If it opens as an image: press-and-hold it and choose Save to Photos.");
      setDiag({ ok: true, method: "open_image", ...meta });
      return;
    }

    setMsg("Could not start download. Re-score and try again.");
    setDiag({ ok: false, reason: "download_failed", ...meta });
  }

  function boot() {
    const { src, kind } = bestSrc();

    showPreview(src);

    if (!src) {
      setMsg("No SEC image found. Go back and re-score.");
    } else {
      setMsg("Tip (iPhone/iPad): press-and-hold the image to Save to Photos.");
    }

    setDiag({
      ok: !!src,
      kind,
      keys: {
        blob: KEY_PNG_BLOB,
        data: KEY_PNG_DATA,
        from: KEY_FROM
      },
      hasBlob: kind === "blob",
      hasData: kind === "data",
      auto: getParam("auto")
    });

    if (btnDownload) btnDownload.addEventListener("click", () => doDownloadFlow(src, { trigger: "click" }));
    if (btnScoreAnother) btnScoreAnother.addEventListener("click", navToIndex);
    if (btnBack) btnBack.addEventListener("click", navBackToFrom);

    // Auto mode: may be blocked by popup rules — we still try, then message user.
    if (getParam("auto") === "1" && src) {
      setTimeout(() => {
        doDownloadFlow(src, { trigger: "auto" });
      }, 350);
    }
  }

  boot();
})();
