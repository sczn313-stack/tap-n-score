/* index.js (FULL REPLACEMENT) — photo button yields iOS selection options */
(() => {
  const $ = (id) => document.getElementById(id);

  const addPhotoBtn = $("addPhotoBtn");
  const elFile = $("photoInput");
  const statusLine = $("statusLine");

  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elSee = $("seeResultsBtn");

  let objectUrl = null;
  let bull = null;
  let shots = [];

  function setStatus(txt) { if (statusLine) statusLine.textContent = txt; }
  function setTapCount() { if (elTapCount) elTapCount.textContent = String(shots.length); }

  function clearDots() {
    bull = null;
    shots = [];
    if (elDots) elDots.innerHTML = "";
    setTapCount();
    setStatus("Add a target photo to begin.");
  }

  // ONE BUTTON → file chooser
  if (addPhotoBtn && elFile) {
    addPhotoBtn.addEventListener("click", async () => {
      // Newer Safari supports showPicker; fallback to click()
      try {
        if (typeof elFile.showPicker === "function") elFile.showPicker();
        else elFile.click();
      } catch {
        elFile.click();
      }
    });
  }

  // When a photo is chosen
  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // reset tap state on new photo
      clearDots();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);
      if (elImg) elImg.src = objectUrl;

      // Hide the button once photo is loaded (your rule)
      if (addPhotoBtn) addPhotoBtn.style.display = "none";

      setStatus("Tap bull first, then tap shots.");
      // allow choosing same file again later
      elFile.value = "";
    });
  }

  // Clear should bring the button back (your rule)
  if (elClear) {
    elClear.addEventListener("click", () => {
      clearDots();

      // remove image
      if (elImg) elImg.removeAttribute("src");

      // show the photo button again
      if (addPhotoBtn) addPhotoBtn.style.display = "";
    });
  }

  // Keep your existing tap/results logic elsewhere; this file only fixes photo selection + UI behavior
  // If you already have tap logic in this file, paste it BELOW this line and keep the addPhoto changes above.

  // Boot
  clearDots();
})();
