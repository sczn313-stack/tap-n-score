/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — vIOS-PREVIEW-FIX-1
   Fixes:
   - iOS “Couldn’t load image. Try a different photo.” preview failures
   - Stores the File immediately (prevents iOS Safari losing selection)
   - Uses ObjectURL first, then falls back to FileReader(dataURL)
   - Only shows preview AFTER the image successfully loads
   - START: if no file, opens picker; if file, proceeds (hooks provided)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements from the new index.html
  const elInput = $("photoInput");
  const elFileName = $("fileName");
  const elPreview = $("targetPreview");
  const elEmpty = $("emptyState");
  const elStart = $("startBtn");
  const elDistance = $("distanceYds");
  const elClick = $("clickValue");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  // --- Helpers
  const setText = (el, txt) => { if (el) el.textContent = txt; };

  function safeRevokeObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  function hidePreview() {
    if (!elPreview) return;
    elPreview.removeAttribute("src");
    elPreview.style.display = "none";
  }

  function showPreview() {
    if (!elPreview) return;
    elPreview.style.display = "block";
  }

  function showError(msg) {
    // Keep it simple + consistent with your screenshot behavior
    alert(msg);
  }

  // Attempt #1: ObjectURL (fast, best)
  function loadPreviewWithObjectUrl(file) {
    return new Promise((resolve, reject) => {
      if (!elPreview) return reject(new Error("preview img missing"));

      safeRevokeObjectUrl();
      objectUrl = URL.createObjectURL(file);

      const onLoad = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        reject(new Error("objectURL image decode failed"));
      };
      const cleanup = () => {
        elPreview.removeEventListener("load", onLoad);
        elPreview.removeEventListener("error", onError);
      };

      elPreview.addEventListener("load", onLoad, { once: true });
      elPreview.addEventListener("error", onError, { once: true });

      // Hide until it actually loads (prevents “empty box” / flashing)
      hidePreview();
      elPreview.src = objectUrl;
    });
  }

  // Attempt #2: FileReader -> dataURL (fallback for iOS weirdness)
  function loadPreviewWithDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!elPreview) return reject(new Error("preview img missing"));

      const fr = new FileReader();

      fr.onerror = () => reject(new Error("FileReader failed"));
      fr.onload = () => {
        const dataUrl = fr.result;
        if (!dataUrl || typeof dataUrl !== "string") {
          return reject(new Error("Invalid dataURL"));
        }

        const onLoad = () => {
          cleanup();
          resolve(true);
        };
        const onError = () => {
          cleanup();
          reject(new Error("dataURL image decode failed"));
        };
        const cleanup = () => {
          elPreview.removeEventListener("load", onLoad);
          elPreview.removeEventListener("error", onError);
        };

        elPreview.addEventListener("load", onLoad, { once: true });
        elPreview.addEventListener("error", onError, { once: true });

        hidePreview();
        elPreview.src = dataUrl;
      };

      fr.readAsDataURL(file);
    });
  }

  async function setSelectedFile(file) {
    selectedFile = file || null;

    if (!selectedFile) {
      setText(elFileName, "no file selected");
      if (elEmpty) elEmpty.style.display = "block";
      hidePreview();
      safeRevokeObjectUrl();
      return;
    }

    // Update filename
    setText(elFileName, selectedFile.name || "selected photo");

    // Attempt load
    try {
      await loadPreviewWithObjectUrl(selectedFile);
    } catch (e1) {
      try {
        await loadPreviewWithDataUrl(selectedFile);
      } catch (e2) {
        // Total fail
        hidePreview();
        safeRevokeObjectUrl();
        if (elEmpty) elEmpty.style.display = "block";
        showError("Couldn’t load image. Try a different photo.");
        return;
      }
    }

    // Success
    if (elEmpty) elEmpty.style.display = "none";
    showPreview();
  }

  // --- Events
  if (elInput) {
    elInput.addEventListener("change", (e) => {
      // iOS Safari: grab file immediately
      const f = e.target?.files?.[0] || null;
      setSelectedFile(f);
    });
  }

  if (elStart) {
    elStart.addEventListener("click", () => {
      // If no photo yet, open picker
      if (!selectedFile) {
        elInput?.click();
        return;
      }

      // Persist settings + file for the next step/page/flow
      // (Works even if you later split into pages.)
      try {
        sessionStorage.setItem("sczn3_distanceYds", String(elDistance?.value || "100"));
        sessionStorage.setItem("sczn3_clickValue", String(elClick?.value || "0.25"));
      } catch (_) {}

      // Hook point:
      // If you already have a tap-flow function, call it here.
      // Otherwise this just confirms the landing step is ready.
      if (typeof window.startTapFlow === "function") {
        window.startTapFlow({ file: selectedFile });
        return;
      }

      // Default behavior (safe): just scroll a hair so user sees the preview is locked
      // and confirms the file is actually loaded.
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {}
    });
  }

  // --- Init
  hidePreview();
  if (elEmpty) elEmpty.style.display = "block";
  setText(elFileName, "no file selected");
})();
