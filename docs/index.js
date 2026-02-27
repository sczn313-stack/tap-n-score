(() => {

  /* =========================
     LOCK CONFIG
  ========================== */

  const REQUIRED_KEY = "SEC-X2";
  const STORAGE_FLAG = "tns_unlocked_v1";

  const url = new URL(window.location.href);
  const urlKey = (url.searchParams.get("key") || "").trim();

  const alreadyUnlocked = localStorage.getItem(STORAGE_FLAG) === "1";

  if (!alreadyUnlocked && urlKey === REQUIRED_KEY) {
    localStorage.setItem(STORAGE_FLAG, "1");
    url.searchParams.delete("key");
    window.history.replaceState({}, "", url.toString());
  }

  if (localStorage.getItem(STORAGE_FLAG) !== "1") {
    renderLockScreen();
    return;
  }

  /* =========================
     NORMAL PAGE LOGIC
  ========================== */

  const photoBtn = document.getElementById("photoBtn");
  const photoInput = document.getElementById("photoInput");

  if (!photoBtn || !photoInput) {
    console.log("Photo elements missing.");
    return;
  }

  photoBtn.addEventListener("click", () => {
    photoInput.value = "";   // allow same file twice
    photoInput.click();      // iOS-safe because inside user gesture
  });

  photoInput.addEventListener("change", () => {

    const file = photoInput.files && photoInput.files[0];

    if (!file) {
      alert("No file selected.");
      return;
    }

    alert(`Photo received ✅\n${file.name}\n${Math.round(file.size/1024)} KB`);

    const reader = new FileReader();

    reader.onload = function(e) {
      showPreview(e.target.result);
    };

    reader.readAsDataURL(file);
  });


  /* =========================
     PREVIEW DISPLAY
  ========================== */

  function showPreview(src) {

    document.body.innerHTML = `
      <div style="min-height:100vh;background:#070a12;color:#fff;font-family:-apple-system,system-ui;padding:20px;">
        <h2 style="margin-bottom:20px;">Image Preview</h2>
        <img src="${src}" style="max-width:100%;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.6);" />
        <br><br>
        <button onclick="location.reload()" style="padding:14px 18px;border-radius:999px;border:0;font-weight:900;background:#d23434;color:#fff;">
          Back
        </button>
      </div>
    `;
  }


  /* =========================
     LOCK UI
  ========================== */

  function renderLockScreen() {

    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070a12;color:#fff;font-family:-apple-system,system-ui;padding:24px;">
        <div style="width:min(520px,100%);border-radius:22px;padding:22px 18px;background:rgba(14,18,34,.92);box-shadow:0 18px 60px rgba(0,0,0,.55);">
          <div style="font-weight:900;letter-spacing:.08em;font-size:24px;margin:0 0 8px;">TAP-N-SCORE™</div>
          <div style="opacity:.75;margin:0 0 16px;">Enter access code to open this landing page.</div>

          <input id="unlockInput"
            placeholder="Access code"
            style="width:100%;padding:16px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.20);color:#fff;font-size:18px;font-weight:800;outline:none;" />

          <button id="unlockBtn"
            style="width:100%;margin-top:12px;border:0;border-radius:999px;padding:16px 18px;font-weight:900;font-size:18px;background:rgba(210,52,52,.92);color:#fff;">
            Unlock
          </button>

          <div id="unlockMsg" style="margin-top:10px;min-height:18px;opacity:.75;"></div>
        </div>
      </div>
    `;

    const input = document.getElementById("unlockInput");
    const btn = document.getElementById("unlockBtn");
    const msg = document.getElementById("unlockMsg");

    const attempt = () => {
      const val = (input.value || "").trim();
      if (val === REQUIRED_KEY) {
        localStorage.setItem(STORAGE_FLAG, "1");
        location.reload();
        return;
      }
      msg.textContent = "Wrong code.";
      input.focus();
      input.select();
    };

    btn.addEventListener("click", attempt);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") attempt();
    });

    input.focus();
  }

})();
