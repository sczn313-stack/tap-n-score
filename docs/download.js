/* ============================================================
   docs/download.js (FULL REPLACEMENT) — GHP SAFE + iOS QUICK LOOK HELP
   Works with the SIMPLE docs/download.html I gave you:
   - Required IDs: pngImg, saveBtn, backSECBtn, backHomeBtn
   - Pulls PNG from localStorage KEY_PNG_DATA
   - iOS overlay (injected) teaches: open image → long-press → Save
   - ?auto=1 will auto-open (after overlay first-time on iOS)
============================================================ */

(() => {
  const KEY_PNG_DATA = "SCZN3_SEC_PNG_DATAURL_V1";
  const KEY_IOS_HELP_SEEN = "SCZN3_IOS_SAVE_HELP_SEEN_V1";

  const $ = (id) => document.getElementById(id);

  const img = $("pngImg");
  const btnSave = $("saveBtn");
  const btnBackSEC = $("backSECBtn");
  const btnBackHome = $("backHomeBtn");

  function isIOS() {
    const ua = navigator.userAgent || "";
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
    const isIPadOS13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return isAppleMobile || isIPadOS13Plus;
  }

  function loadPngDataUrl() {
    const dataUrl = localStorage.getItem(KEY_PNG_DATA) || "";
    if (!dataUrl || !dataUrl.startsWith("data:image/png")) return null;
    if (img) img.src = dataUrl;
    return dataUrl;
  }

  function openPng(dataUrl) {
    // iOS Safari: Quick Look opens in-tab
    window.location.href = dataUrl;
  }

  // ---------- iOS help overlay (no HTML required)
  let overlayEl = null;

  function injectOverlayIfNeeded() {
    if (overlayEl) return overlayEl;

    const wrap = document.createElement("div");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.position = "fixed";
    wrap.style.inset = "0";
    wrap.style.zIndex = "999999";
    wrap.style.display = "none";
    wrap.style.alignItems = "flex-end";
    wrap.style.justifyContent = "center";
    wrap.style.padding = "16px";
    wrap.style.background = "rgba(0,0,0,.55)";

    const sheet = document.createElement("div");
    sheet.style.width = "min(720px, 100%)";
    sheet.style.borderRadius = "18px";
    sheet.style.border = "1px solid rgba(255,255,255,.14)";
    sheet.style.background = "rgba(8,10,14,.98)";
    sheet.style.boxShadow = "0 22px 70px rgba(0,0,0,.6)";
    sheet.style.padding = "16px 16px 14px 16px";
    sheet.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
    sheet.style.color = "rgba(238,242,247,.95)";

    const title = document.createElement("div");
    title.textContent = "Save on iPhone/iPad";
    title.style.fontWeight = "900";
    title.style.fontSize = "18px";
    title.style.marginBottom = "8px";

    const steps = document.createElement("div");
    steps.style.opacity = ".88";
    steps.style.lineHeight = "1.35";
    steps.style.fontSize = "15px";
    steps.innerHTML =
      "1) Tap <b>Open / Save</b><br/>" +
      "2) When the PNG opens, <b>press-and-hold</b> the image<br/>" +
      "3) Tap <b>Save to Photos</b>";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.marginTop = "14px";

    const gotIt = document.createElement("button");
    gotIt.type = "button";
    gotIt.textContent = "Got it";
    gotIt.style.flex = "1";
    gotIt.style.padding = "12px 12px";
    gotIt.style.borderRadius = "14px";
    gotIt.style.border = "1px solid rgba(255,255,255,.14)";
    gotIt.style.background = "rgba(255,255,255,.06)";
    gotIt.style.color = "rgba(238,242,247,.95)";
    gotIt.style.fontWeight = "900";
    gotIt.style.fontSize = "16px";

    const openNow = document.createElement("button");
    openNow.type = "button";
    openNow.textContent = "Open PNG now";
    openNow.style.flex = "1";
    openNow.style.padding = "12px 12px";
    openNow.style.borderRadius = "14px";
    openNow.style.border = "1px solid rgba(47,102,255,.45)";
    openNow.style.background = "rgba(47,102,255,.18)";
    openNow.style.color = "rgba(238,242,247,.98)";
    openNow.style.fontWeight = "1000";
    openNow.style.fontSize = "16px";

    row.appendChild(gotIt);
    row.appendChild(openNow);

    sheet.appendChild(title);
    sheet.appendChild(steps);
    sheet.appendChild(row);
    wrap.appendChild(sheet);
    document.body.appendChild(wrap);

    // close by tapping backdrop
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) hideOverlay(false);
    });

    overlayEl = wrap;

    // wire buttons (handlers assigned later after dataUrl exists)
    overlayEl.__gotItBtn = gotIt;
    overlayEl.__openNowBtn = openNow;

    return overlayEl;
  }

  function showOverlay() {
    const o = injectOverlayIfNeeded();
    o.style.display = "flex";
    o.setAttribute("aria-hidden", "false");
  }

  function hideOverlay(persist) {
    if (!overlayEl) return;
    overlayEl.style.display = "none";
    overlayEl.setAttribute("aria-hidden", "true");
    if (persist) {
      try { localStorage.setItem(KEY_IOS_HELP_SEEN, "1"); } catch {}
    }
  }

  // ---------- Boot
  const dataUrl = loadPngDataUrl();

  if (!dataUrl) {
    if (img) img.alt = "Missing SEC PNG. Go back and re-score.";
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = "Missing PNG";
      btnSave.style.opacity = ".6";
    }
  }

  // Back buttons
  btnBackSEC?.addEventListener("click", () => {
    window.location.href = `./sec.html?fresh=${Date.now()}`;
  });

  btnBackHome?.addEventListener("click", () => {
    window.location.href = `./index.html?fresh=${Date.now()}`;
  });

  // Save/Open button
  btnSave?.addEventListener("click", () => {
    if (!dataUrl) return;

    if (isIOS()) {
      const seen = (localStorage.getItem(KEY_IOS_HELP_SEEN) || "") === "1";
      if (!seen) {
        const o = injectOverlayIfNeeded();

        // wire once
        if (!o.__wired) {
          o.__wired = true;

          o.__gotItBtn?.addEventListener("click", () => hideOverlay(true));
          o.__openNowBtn?.addEventListener("click", () => {
            hideOverlay(true);
            openPng(dataUrl);
          });
        }

        showOverlay();
        return;
      }
    }

    openPng(dataUrl);
  });

  // Auto-open
  try {
    const u = new URL(window.location.href);
    const auto = u.searchParams.get("auto") === "1";

    if (auto && dataUrl) {
      if (isIOS()) {
        const seen = (localStorage.getItem(KEY_IOS_HELP_SEEN) || "") === "1";
        if (!seen) {
          const o = injectOverlayIfNeeded();
          if (!o.__wired) {
            o.__wired = true;

            o.__gotItBtn?.addEventListener("click", () => hideOverlay(true));
            o.__openNowBtn?.addEventListener("click", () => {
              hideOverlay(true);
              openPng(dataUrl);
            });
          }
          showOverlay();
        } else {
          setTimeout(() => openPng(dataUrl), 250);
        }
      } else {
        setTimeout(() => openPng(dataUrl), 250);
      }
    }
  } catch {}
})();
