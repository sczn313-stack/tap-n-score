/* ============================================================
   docs/index.js — iPad/iOS photo picker hardening (Docs)
   Fixes:
   - Force iOS to always fire change by resetting input before click
   - Add "capture" attr to encourage camera/gallery chooser
   - Add a visible debug line showing whether files[0] exists
   - Preview via objectURL first, FileReader fallback
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
    statusEl.textContent = msg;
  }

  // Prove JS is running
  setStatus("DOCS IOS FIX LOADED ✅");

  // If any JS error happens, show it
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
      setStatus("Picked nothing (no file received).");
      return;
    }

    setStatus(`Picked: ${file.name} (${Math.round(file.size / 1024)} KB)`);

    // Fast path: object URL
    try {
      revokeObjectUrl();
      objectUrl = URL.createObjectURL(file);
      preview.src = objectUrl;
      preview.style.display = "block";
      await new Promise((r) => setTimeout(r, 50));
      setStatus("Preview ready ✅");
      return;
    } catch (_) {
      // fallback
    }

    // Fallback: FileReader
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

  // IMPORTANT iOS hardening:
  // - Reset input.value BEFORE opening picker (so selecting same photo still triggers change)
  // - Set capture to hint camera/gallery chooser
  chooseBtn.addEventListener("click", () => {
    try {
      input.value = ""; // forces change event even if same file chosen
      input.setAttribute("capture", "environment"); // harmless if ignored
      setStatus("Opening photo picker…");
      input.click();
    } catch (e) {
      setStatus(`Picker error: ${e.message || e}`);
    }
  });

  // iOS: change fires, but sometimes files is empty for a moment.
  // So we do a tiny delayed read too.
  input.addEventListener("change", () => {
    setStatus("Picker returned… reading file…");

    const readNow = async () => {
      const f = input.files && input.files[0] ? input.files[0] : null;
      await handlePickedFile(f);
    };

    // Try immediately
    readNow();

    // And try again after a beat (covers iOS timing weirdness)
    setTimeout(readNow, 150);
  });

  clearBtn.addEventListener("click", clearAll);
})();
