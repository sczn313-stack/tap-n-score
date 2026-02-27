(() => {
  const photoBtn = document.getElementById("photoBtn");
  const photoInput = document.getElementById("photoInput");

  if (!photoBtn || !photoInput) {
    console.log("Missing #photoBtn or #photoInput in index.html");
    return;
  }

  // iOS-safe: file picker must be triggered inside a user gesture
  photoBtn.addEventListener("click", () => {
    try {
      photoInput.value = ""; // allows selecting same photo twice
      photoInput.click();
    } catch (e) {
      alert("Photo picker was blocked. Please refresh and try again.");
    }
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;

    // Proof it worked
    alert(`Photo received ✅\n${file.name}\n${Math.round(file.size / 1024)} KB`);

    // Show quick preview
    const reader = new FileReader();
    reader.onload = (e) => showPreview(e.target.result);
    reader.readAsDataURL(file);
  });

  function showPreview(src) {
    document.body.innerHTML = `
      <div style="min-height:100vh;background:#070a12;color:#fff;font-family:-apple-system,system-ui;padding:20px;">
        <div style="max-width:980px;margin:0 auto;">
          <h2 style="margin:0 0 14px;">Image Preview</h2>
          <div style="opacity:.75;margin:0 0 18px;">(This is a temporary proof screen.)</div>
          <img src="${src}" style="max-width:100%;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.6);" />
          <div style="margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;">
            <button id="backBtn" style="padding:14px 18px;border-radius:999px;border:0;font-weight:900;background:#d23434;color:#fff;">
              Back
            </button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("backBtn").addEventListener("click", () => location.reload());
  }
})();
