/* ============================================================
   docs/index.js (FULL REPLACEMENT) — IOS-PICKER-FIX-2
   Goals:
   - Choose Photo ALWAYS opens picker on iPad/iOS
   - Status line proves JS is running
   - Preview loads via ObjectURL, fallback to FileReader
   - Clear resets cleanly
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const chooseBtn = $("chooseBtn");
  const clearBtn = $("clearBtn");
  const input = $("photoInput");
  const img = $("targetImg");
  const statusLine = $("statusLine");

  let objectUrl = null;

  function setStatus(msg) {
    statusLine.textContent = msg;
    console.log("[DOCS]", msg);
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      objectUrl = null;
    }
  }

  async function setImageFromFile(file) {
    revokeObjectUrl();

    // Try Object URL first (fast)
    try {
      objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        img.style.display = "block";
        setStatus(`Loaded ✅ ${file.name}`);
      };
      img.onerror = () => {
        setStatus("ObjectURL failed… trying FileReader fallback");
        revokeObjectUrl();
        fileReaderFallback(file);
      };
      img.src = objectUrl;
      return;
    } catch (e) {
      setStatus("ObjectURL exception… trying FileReader fallback");
      fileReaderFallback(file);
    }
  }

  function fileReaderFallback(file) {
    try {
      const r = new FileReader();
      r.onload = () => {
        img.onload = () => {
          img.style.display = "block";
          setStatus(`Loaded ✅ ${file.name}`);
        };
        img.onerror = () => setStatus("Image load failed ❌ (FileReader)");
        img.src = r.result;
      };
      r.onerror = () => setStatus("FileReader failed ❌");
      r.readAsDataURL(file);
    } catch (e) {
      setStatus("FileReader exception ❌");
    }
  }

  function clearAll() {
    revokeObjectUrl();
    img.removeAttribute("src");
    img.style.display = "none";
    // reset input so picking the SAME photo again works on iOS
    input.value = "";
    setStatus("Cleared. Tap Choose Photo.");
  }

  function openPicker() {
    // iOS requires this to be inside a direct user gesture
    // Also reset input first so the same file can be picked again
    input.value = "";
    setStatus("Opening picker…");

    // IMPORTANT: call click() on the real input
    input.click();
  }

  function bind() {
    if (!chooseBtn || !clearBtn || !input || !img || !statusLine) {
      alert("Missing required elements. Check IDs in index.html.");
      return;
    }

    // Button handlers
    chooseBtn.addEventListener("click", openPicker);
    clearBtn.addEventListener("click", clearAll);

    // When user selects a file
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) {
        setStatus("No file selected.");
        return;
      }

      setStatus(`Selected: ${file.name}`);
      await setImageFromFile(file);
    });

    setStatus("DOCS IOS FIX LOADED ✅ Tap Choose Photo.");
  }

  // Boot
  try {
    bind();
  } catch (e) {
    console.error(e);
    setStatus("JS crashed ❌ (check console)");
  }
})();
