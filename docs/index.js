/* ============================================================
   Tap-n-Score™ Frontend (FULL REPLACEMENT)
   Purpose:
   - iPad/iOS-safe "Choose Photo" behavior
   - Reliable preview (no FileReader-first)
   - Clear resets iOS file input state
   - Simple status line so you can SEE JS is loaded
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements
  const elChoose = $("chooseBtn");
  const elClear = $("clearBtn");
  const elInput = $("photoInput");
  const elImg = $("targetImg");
  const elStatus = $("statusLine");
  const elHint = $("hintLine");

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  function setStatus(msg) {
    if (elStatus) elStatus.textContent = msg;
  }

  function revokePreviewUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      objectUrl = null;
    }
  }

  function resetPreview() {
    revokePreviewUrl();
    selectedFile = null;

    if (elImg) {
      elImg.removeAttribute("src");
      elImg.style.display = "none";
    }

    // iOS needs this to re-open / re-select the same image
    try { elInput.value = ""; } catch {}

    setStatus("Cleared ✅");
  }

  function loadPreviewFromFile(file) {
    if (!file) return;

    selectedFile = file;

    revokePreviewUrl();
    objectUrl = URL.createObjectURL(file);

    elImg.src = objectUrl;
    elImg.style.display = "block";

    setStatus("Preview ready ✅");
  }

  function openPickerIOSSafe() {
    // KEY iOS SAFARI FIX:
    // Clear value BEFORE click, so "same image" selections fire change.
    try { elInput.value = ""; } catch {}

    // Must be in direct user gesture stack
    elInput.click();

    // iOS sometimes populates files slightly later; check again
    setTimeout(() => {
      const f = elInput.files && elInput.files[0];
      if (f) loadPreviewFromFile(f);
    }, 250);
  }

  // ---- Events
  elChoose.addEventListener("click", () => {
    setStatus("Opening picker…");
    openPickerIOSSafe();
  });

  elClear.addEventListener("click", () => {
    resetPreview();
  });

  elInput.addEventListener("change", () => {
    const f = elInput.files && elInput.files[0];
    if (!f) {
      setStatus("No file selected");
      return;
    }
    loadPreviewFromFile(f);
  });

  // ---- Boot
  setStatus("FRONTEND IOS FIX LOADED ✅");
  if (elHint) {
    elHint.textContent =
      "If the picker opens but selection doesn’t stick, Safari cached old JS. Bump the ?v= in index.html and reload.";
  }
})();
