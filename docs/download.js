(() => {
  const $ = (id) => document.getElementById(id);

  const elStatus = $("statusLine");
  const elImg = $("secImg");
  const elEmpty = $("emptyState");
  const elDownload = $("downloadBtn");
  const elScoreAnother = $("scoreAnotherBtn");
  const elBack = $("backToSetupBtn");
  const elTiny = $("tinyNote");
  const elDiag = $("diag");

  // -----------------------------
  // URL helpers
  // -----------------------------
  const url = new URL(window.location.href);
  const qp = (k) => url.searchParams.get(k);

  // expected params (optional)
  const imgParam = qp("img");          // http(s) OR data:image/png;base64,...
  const payloadParam = qp("payload");  // base64 JSON (optional)
  const fromParam = qp("from");        // return link (optional)
  const targetParam = qp("target");    // return link (optional)

  // localStorage keys (fallback)
  const LS_IMG = "SCZN3_SEC_PNG";          // dataURL recommended
  const LS_IMG_URL = "SCZN3_SEC_IMG_URL";  // url fallback
  const LS_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function decodePayloadB64(b64) {
    try {
      const json = decodeURIComponent(escape(atob(b64)));
      return safeJsonParse(json);
    } catch {
      return null;
    }
  }

  // -----------------------------
  // Resolve image source
  // -----------------------------
  let resolvedImgSrc = null;

  if (imgParam && imgParam.trim()) {
    resolvedImgSrc = imgParam.trim();
  } else {
    // localStorage fallback
    const ls1 = localStorage.getItem(LS_IMG);
    const ls2 = localStorage.getItem(LS_IMG_URL);
    resolvedImgSrc = (ls1 && ls1.trim()) ? ls1.trim() : ((ls2 && ls2.trim()) ? ls2.trim() : null);
  }

  // -----------------------------
  // Resolve payload (diagnostics only)
  // -----------------------------
  let payloadObj = null;

  if (payloadParam && payloadParam.trim()) {
    payloadObj = decodePayloadB64(payloadParam.trim());
  }
  if (!payloadObj) {
    payloadObj = safeJsonParse(localStorage.getItem(LS_PAYLOAD) || "");
  }

  // -----------------------------
  // UI rendering
  // -----------------------------
  function setDiag(obj) {
    elDiag.textContent = JSON.stringify(obj, null, 2);
  }

  function showLoaded(src) {
    elEmpty.style.display = "none";
    elImg.style.display = "block";
    elImg.src = src;

    elStatus.textContent = "SEC loaded. Ready to download.";
    elTiny.textContent = "If download doesn’t start on iOS, use press-and-hold on the opened PNG → Save to Photos.";
  }

  function showMissing(reason) {
    elEmpty.style.display = "block";
    elImg.style.display = "none";
    elStatus.textContent = "SEC not found.";
    elTiny.textContent = reason || "No image provided. Return and generate a SEC first.";
  }

  // -----------------------------
  // Download behavior (iOS safe)
  // -----------------------------
  function isDataUrl(s) {
    return typeof s === "string" && s.startsWith("data:image/");
  }

  function tryProgrammaticDownload(src) {
    // Works on many browsers, often ignored on iOS for dataURLs.
    try {
      const a = document.createElement("a");
      a.href = src;
      a.download = "SEC.png";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch {
      return false;
    }
  }

  function openImageInNewTab(src) {
    // iOS friendly: open the PNG so user can Save to Photos.
    // Must be called from a user gesture (button tap) to avoid popup blocking.
    try {
      const w = window.open(src, "_blank", "noopener,noreferrer");
      return !!w;
    } catch {
      return false;
    }
  }

  elDownload.addEventListener("click", () => {
    if (!resolvedImgSrc) return;

    // Attempt normal download first
    const ok = tryProgrammaticDownload(resolvedImgSrc);

    // iOS fallback: open image tab for press-and-hold save
    // (even if "ok" is true, iOS may still do nothing)
    const opened = openImageInNewTab(resolvedImgSrc);

    if (!ok && !opened) {
      alert("Download was blocked. Try pressing and holding the preview image to save it.");
    }
  });

  // Return buttons
  function goBack(where) {
    const fallback = "/tap-n-score/index.html?fresh=" + Date.now();
    window.location.href = where || fallback;
  }

  elScoreAnother.addEventListener("click", () => {
    goBack(fromParam || targetParam);
  });

  elBack.addEventListener("click", () => {
    goBack(targetParam || fromParam);
  });

  // -----------------------------
  // Boot
  // -----------------------------
  const diag = {
    ok: !!resolvedImgSrc,
    reason: resolvedImgSrc ? "resolved img" : "missing img",
    baseLocked: "/tap-n-score/",
    imgSource: imgParam ? "querystring" : (resolvedImgSrc ? "localStorage" : "none"),
    hasPayload: !!payloadObj,
    nav: {
      scoreAnother: fromParam || "./index.html?fresh=" + Date.now(),
      backToSetup: targetParam || "./index.html?fresh=" + Date.now(),
    },
    example: "https://sczn313-stack.github.io/tap-n-score/download.html?img=https://example.com/sec.png&from=./index.html&target=./index.html"
  };

  setDiag({ ...diag, payloadPreview: payloadObj ? payloadObj : null });

  if (resolvedImgSrc) {
    showLoaded(resolvedImgSrc);
  } else {
    showMissing("No image provided. Open this page with ?img=YOUR_PNG_URL or store SCZN3_SEC_PNG in localStorage.");
  }
})();
