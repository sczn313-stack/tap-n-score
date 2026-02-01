/* ============================================================
   docs/index.js — iPad/iOS-safe photo picker + preview (Docs)
   Goals:
   - Prove JS is actually running (status changes immediately)
   - iOS Safari: file selection "sticks" and preview reliably
   - Clear resets state cleanly
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const chooseBtn = $("chooseBtn");
  const clearBtn  = $("clearBtn");
  const input     = $("photoInput");
  const statusEl  = $("statusLine");
  const preview   = $("preview");

  let objectUrl = null;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  // Show JS is alive ASAP
  setStatus("DOCS IOS FIX LOADED ✅");

  // If there is a JS error, show it on-screen (iOS Safari hides console too often)
  window.addEventListener("error", (e) => {
    setStatus(`JS ERROR: ${e.message || "unknown"}`);
  });

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function clearAll() {
    revokeObjectUrl();
    preview.removeAttribute("src");
    preview.style.display = "none";
    // Reset input (Safari-friendly)
    input.value = "";
    setStatus("Cleared ✅");
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(file);
    });
  }

  async function handlePickedFile(file) {
    if (!file) {
      setStatus("No file picked.");
      return;
    }

    setStatus(`Picked: ${file.name} (${Math.round(file.size / 1024)} KB)`);

    // Try object URL first (fast)
    try {
      revokeObjectUrl();
      objectUrl = URL.createObjectURL(file);
      preview.src = objectUrl;
      preview.style.display = "block";

      // iOS sometimes delays image load; wait a beat then confirm
      await new Promise((r) => setTimeout(r, 50));
      setStatus("Preview ready ✅");
      return;
    } catch (_) {
      // Fall through to FileReader
    }

    // Fallback: FileReader DataURL (most compatible)
    try {
      revokeObjectUrl();
      const dataUrl = await fileToDataUrl(file);
      preview.src = dataUrl;
      preview.style.display = "block";
      setStatus("Preview ready ✅ (FileReader)");
    } catch (err) {
      setStatus(`Could not preview image: ${err.message || err}`);
    }
  }

  // Button -> open picker
  chooseBtn.addEventListener("click", () => {
    setStatus("Opening photo picker…");
    input.click();
  });

  // iOS Safari: store file immediately on change
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0] ? input.files[0] : null;
    await handlePickedFile(file);
  });

  clearBtn.addEventListener("click", clearAll);
})();
