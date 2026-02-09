/* ============================================================
   tap-n-score/download.js (FULL REPLACEMENT) — iOS QUICK LOOK HELP
   - Keeps iOS preview behavior (opens data URL in same tab)
   - Adds iPhone/iPad overlay: "Tap green ✓ then Save"
   - Overlay can be dismissed (remembered)
   - ?auto=1 still works, but shows overlay first on iOS
============================================================ */

(() => {
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_IOS_HELP_SEEN = "SCZN3_IOS_SAVE_HELP_SEEN_V1";

  const $ = (id) => document.getElementById(id);

  const img = $("pngImg");
  const btn = $("saveBtn");
  const hint = $("hintLine");

  const iosHelp = $("iosHelp");
  const iosGotIt = $("iosGotIt");
  const iosOpenNow = $("iosOpenNow");

  function isIOS() {
    const ua = navigator.userAgent || "";
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
    // iPadOS can masquerade as Mac; detect touch + Mac platform
    const isIPadOS13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return isAppleMobile || isIPadOS13Plus;
  }

  function load() {
    const dataUrl = localStorage.getItem(KEY_PNG_DATA) || "";
    if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
      if (img) img.alt = "Missing SEC PNG. Go back and re-score.";
      if (btn) btn.disabled = true;
      if (hint) hint.textContent = "Missing SEC PNG. Go back and re-score.";
      return null;
    }
    if (img) img.src = dataUrl;
    return dataUrl;
  }

  function showIOSHelp() {
    if (!iosHelp) return;
    iosHelp.classList.add("show");
    iosHelp.setAttribute("aria-hidden", "false");
  }

  function hideIOSHelp(persist = false) {
    if (!iosHelp) return;
    iosHelp.classList.remove("show");
    iosHelp.setAttribute("aria-hidden", "true");
    if (persist) {
      try { localStorage.setItem(KEY_IOS_HELP_SEEN, "1"); } catch {}
    }
  }

  function openPng(dataUrl) {
    // Safari-friendly: open in same tab (Quick Look)
    window.location.href = dataUrl;
  }

  const dataUrl = load();

  // Button click: show overlay on iOS (first time), otherwise open
  btn?.addEventListener("click", () => {
    if (!dataUrl) return;

    if (isIOS()) {
      const seen = (localStorage.getItem(KEY_IOS_HELP_SEEN) || "") === "1";
      if (!seen) {
        showIOSHelp();
        return;
      }
    }
    openPng(dataUrl);
  });

  // Overlay actions
  iosGotIt?.addEventListener("click", () => hideIOSHelp(true));
  iosOpenNow?.addEventListener("click", () => {
    hideIOSHelp(true);
    if (dataUrl) openPng(dataUrl);
  });

  // Tap outside sheet closes overlay (does not persist)
  iosHelp?.addEventListener("click", (e) => {
    const sheet = e.target && e.target.closest ? e.target.closest(".iosSheet") : null;
    if (!sheet) hideIOSHelp(false);
  });

  // auto-open if requested
  const u = new URL(window.location.href);
  const auto = u.searchParams.get("auto") === "1";

  if (auto && dataUrl) {
    if (isIOS()) {
      const seen = (localStorage.getItem(KEY_IOS_HELP_SEEN) || "") === "1";
      if (!seen) {
        // show help first; user can hit "Open PNG now"
        showIOSHelp();
      } else {
        setTimeout(() => openPng(dataUrl), 250);
      }
    } else {
      setTimeout(() => openPng(dataUrl), 250);
    }
  }
})();
