(() => {
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const $ = (id) => document.getElementById(id);

  const img = $("pngImg");
  const btn = $("saveBtn");

  function load() {
    const dataUrl = localStorage.getItem(KEY_PNG_DATA) || "";
    if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
      if (img) img.alt = "Missing SEC PNG. Go back and re-score.";
      if (btn) btn.disabled = true;
      return null;
    }
    if (img) img.src = dataUrl;
    return dataUrl;
  }

  const dataUrl = load();

  btn?.addEventListener("click", async () => {
    if (!dataUrl) return;
    // Open in same tab (Safari-friendly)
    window.location.href = dataUrl;
  });

  // auto-open if requested
  const u = new URL(window.location.href);
  if (u.searchParams.get("auto") === "1" && dataUrl) {
    // slight delay so iOS paints
    setTimeout(() => { window.location.href = dataUrl; }, 250);
  }
})();
