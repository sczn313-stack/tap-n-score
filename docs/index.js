setStatus("DOCS IOS FIX LOADED ✅");/* ============================================================
   docs/index.js  (FULL REPLACEMENT)
   Fix: iOS/iPadOS photo picker selection not sticking
   - Uses a real <input type="file">
   - Triggers it via a button
   - Stores File immediately on change
   - Creates objectURL immediately
   - Resets input value so same photo can be re-picked
   - Guards against double-fire
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elFile   = $("photoInput");
  const elChoose = $("choosePhotoBtn");
  const elClear  = $("clearBtn");
  const elImg    = $("targetImg");
  const elStatus = $("statusLine");
  const elDebug  = $("debugOut");

  if (!elFile || !elChoose || !elClear || !elImg || !elStatus) {
    console.log("Docs: missing required elements.");
    return;
  }

  let selectedFile = null;
  let objectUrl = null;
  let lastChangeAt = 0;

  function setStatus(msg) {
    elStatus.textContent = msg;
    console.log("[STATUS]", msg);
  }

  function showDebug(obj) {
    if (!elDebug) return;
    elDebug.style.display = "block";
    elDebug.textContent = JSON.stringify(obj, null, 2);
  }

  function hideDebug() {
    if (!elDebug) return;
    elDebug.style.display = "none";
    elDebug.textContent = "";
  }

  function cleanupObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      objectUrl = null;
    }
  }

  function clearAll() {
    selectedFile = null;
    cleanupObjectUrl();
    elImg.removeAttribute("src");
    elImg.style.display = "none";
    hideDebug();
    setStatus("Cleared. Tap Choose Photo.");
  }

  elChoose.addEventListener("click", () => {
    // must be directly in user gesture for iOS
    elFile.click();
  });

  elClear.addEventListener("click", clearAll);

  elFile.addEventListener("change", () => {
    const now = Date.now();

    // iOS sometimes fires change twice
    if (now - lastChangeAt < 250) return;
    lastChangeAt = now;

    const file = elFile.files && elFile.files[0] ? elFile.files[0] : null;

    if (!file) {
      setStatus("No photo selected (cancelled).");
      return;
    }

    // IMPORTANT: grab immediately (iOS can drop it if delayed)
    selectedFile = file;

    cleanupObjectUrl();
    objectUrl = URL.createObjectURL(file);

    showDebug({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    setStatus(`Photo selected ✅ (${file.type || "unknown"}, ${file.size || 0} bytes)`);

    elImg.onload = () => setStatus("Photo loaded into preview ✅");
    elImg.onerror = () => setStatus("Preview failed to load ❌");

    elImg.src = objectUrl;
    elImg.style.display = "block";

    // IMPORTANT: allow picking same photo again
    elFile.value = "";
  });

  setStatus("Ready. Tap Choose Photo.");
})();
