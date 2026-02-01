/* ============================================================
   Tap-n-Score™ (Docs) — iOS/iPadOS SAFE Photo Picker + Preview
   Goal: make "Choose Photo" work reliably on Safari iOS
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const chooseBtn  = $("chooseBtn");
  const clearBtn   = $("clearBtn");
  const photoInput = $("photoInput");
  const targetImg  = $("targetImg");
  const statusLine = $("statusLine");

  let selectedFile = null;
  let previewUrl = null;

  function setStatus(msg) {
    if (statusLine) statusLine.textContent = msg;
  }

  function clearAll() {
    selectedFile = null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }

    if (targetImg) {
      targetImg.removeAttribute("src");
      targetImg.style.display = "none";
    }

    // iOS: clearing input value helps reset selection behavior
    try { photoInput.value = ""; } catch (_) {}

    setStatus("Cleared ✅");
  }

  function loadPreviewFromFile(file) {
    selectedFile = file;

    if (!file) {
      setStatus("No file received ❌");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);

    targetImg.onload = () => {
      targetImg.style.display = "block";
      setStatus("Preview ready ✅");
    };

    targetImg.onerror = () => {
      targetImg.style.display = "none";
      setStatus("Preview failed ❌");
    };

    targetImg.src = previewUrl;
  }

  // ============================================================
  // iOS SAFE picker binding
  // ============================================================
  function bindIosSafePhotoPicker() {
    if (!chooseBtn || !photoInput) return;

    chooseBtn.addEventListener("click", () => {
      // Critical on iOS: clear BEFORE opening picker
      try { photoInput.value = ""; } catch (_) {}
      photoInput.click();
    });

    photoInput.addEventListener("change", () => {
      const grabFile = () =>
        (photoInput.files && photoInput.files[0]) ? photoInput.files[0] : null;

      // Sometimes available instantly
      const f1 = grabFile();
      if (f1) {
        setStatus("Photo selected ✅");
        loadPreviewFromFile(f1);
        return;
      }

      // iOS sometimes populates a moment later
      setStatus("Waiting on iOS…");
      setTimeout(() => {
        const f2 = grabFile();
        if (f2) {
          setStatus("Photo selected ✅");
          loadPreviewFromFile(f2);
        } else {
          setStatus("No file received ❌ (try again)");
        }
      }, 250);
    });
  }

  // Clear button
  if (clearBtn) clearBtn.addEventListener("click", clearAll);

  // Boot
  setStatus("DOCS IOS FIX LOADED ✅");
  bindIosSafePhotoPicker();
})();
