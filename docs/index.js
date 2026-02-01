(() => {
  const $ = (id) => document.getElementById(id);

  const previewImg = $("previewImg");
  const previewPlaceholder = $("previewPlaceholder");
  const metaLine = $("metaLine");
  const downloadBtn = $("downloadBtn");
  const diagOut = $("diagOut");

  // Accept SEC image from:
  // 1) ?img= (URL or data URL), OR
  // 2) sessionStorage key: "sec_png_dataurl" (data:image/png;base64,...)
  function getSecImage() {
    const qs = new URLSearchParams(location.search);
    const imgParam = qs.get("img");
    if (imgParam && imgParam.trim()) return { src: imgParam.trim(), source: "querystring" };

    const ss = sessionStorage.getItem("sec_png_dataurl");
    if (ss && ss.trim()) return { src: ss.trim(), source: "sessionStorage" };

    return null;
  }

  function setPreview(src, source) {
    previewImg.src = src;
    previewImg.style.display = "block";
    previewPlaceholder.style.display = "none";

    // lightweight meta
    const kind = src.startsWith("data:") ? "data URL" : "URL";
    metaLine.textContent = `Loaded (${kind}) • source: ${source}`;

    downloadBtn.disabled = false;
  }

  async function downloadFromUrl(url) {
    // If it’s a data URL, we can download directly.
    if (url.startsWith("data:image")) {
      triggerDownload(url, `SEC_${Date.now()}.png`);
      return;
    }

    // Otherwise fetch to blob (best chance for consistent downloads)
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    triggerDownload(objUrl, `SEC_${Date.now()}.png`);
    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
  }

  function triggerDownload(href, filename) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadBtn.addEventListener("click", async () => {
    try {
      const info = getSecImage();
      if (!info) return;

      diagOut.textContent = JSON.stringify({ action: "download", info }, null, 2);

      await downloadFromUrl(info.src);
    } catch (e) {
      diagOut.textContent = String(e);
      alert("Download failed. Open Diagnostics.");
    }
  });

  // Boot
  const info = getSecImage();
  if (!info) {
    diagOut.textContent = JSON.stringify({
      ok: false,
      message: "No SEC image provided.",
      expected: [
        "download.html?img=<SEC image url or data url>",
        "sessionStorage.sec_png_dataurl = 'data:image/png;base64,...'"
      ]
    }, null, 2);
    return;
  }

  setPreview(info.src, info.source);
  diagOut.textContent = JSON.stringify({ ok: true, loadedFrom: info.source }, null, 2);
})();
