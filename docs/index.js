/* docs/index.js — FULL REPLACEMENT
   Landing page lock/unlock gate + existing photo button wiring
*/

(() => {
  // ====== LOCK CONFIG ======
  const REQUIRED_KEY = "SEC-X2";          // change if you want
  const STORAGE_FLAG = "tns_unlocked_v1"; // localStorage flag

  // Allow unlock via URL: ?key=SEC-X2
  const url = new URL(window.location.href);
  const urlKey = (url.searchParams.get("key") || "").trim();

  const alreadyUnlocked = localStorage.getItem(STORAGE_FLAG) === "1";

  if (!alreadyUnlocked && urlKey === REQUIRED_KEY) {
    localStorage.setItem(STORAGE_FLAG, "1");
    // Clean URL (remove key so you don't leak it)
    url.searchParams.delete("key");
    window.history.replaceState({}, "", url.toString());
  }

  // If still locked, show lock screen and STOP.
  if (localStorage.getItem(STORAGE_FLAG) !== "1") {
    renderLockScreen();
    return;
  }

  // ====== NORMAL PAGE LOGIC ======
  const photoBtn = document.getElementById("photoBtn");
  const photoInput = document.getElementById("photoInput");

  if (photoBtn && photoInput) {
    // iOS requires the click to happen inside a user gesture handler.
    photoBtn.addEventListener("click", () => {
      try {
        photoInput.value = ""; // allow same file again
        photoInput.click();
      } catch (e) {
        alert("Photo picker blocked. Please refresh and try again.");
      }
    });

    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;

      // TODO: your upload/analyze pipeline goes here.
      // For now, just confirm selection:
      console.log("Selected file:", file.name, file.type, file.size);
      // Example: window.location.href = "./sec.html";
    });
  }

  // ====== LOCK UI ======
  function renderLockScreen() {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070a12;color:#fff;font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;">
        <div style="width:min(520px,100%);border-radius:22px;padding:22px 18px;background:rgba(14,18,34,.92);box-shadow:0 18px 60px rgba(0,0,0,.55);">
          <div style="font-weight:900;letter-spacing:.08em;font-size:24px;margin:0 0 8px;">TAP-N-SCORE™</div>
          <div style="opacity:.75;margin:0 0 16px;">Enter access code to open this landing page.</div>

          <input id="unlockInput" inputmode="text" autocomplete="one-time-code"
            placeholder="Access code"
            style="width:100%;padding:16px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.20);color:#fff;font-size:18px;font-weight:800;outline:none;" />

          <button id="unlockBtn"
            style="width:100%;margin-top:12px;border:0;border-radius:999px;padding:16px 18px;font-weight:900;font-size:18px;cursor:pointer;background:rgba(210,52,52,.92);color:#fff;">
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
