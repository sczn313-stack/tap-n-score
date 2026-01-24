(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");

  const elBullStatus = $("bullStatus");
  const elTapCount = $("tapCount");

  const elUndo = $("undoBtn");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");

  const elWindDir = $("windDir");
  const elWindClicks = $("windClicks");
  const elElevDir = $("elevDir");
  const elElevClicks = $("elevClicks");

  const elDownload = $("downloadSecBtn");
  const secCanvas = $("secCanvas");
  const secCtx = secCanvas.getContext("2d");

  // Vendor UI (two places)
  const elVendorLink1 = $("vendorLink");
  const elVendorLogo1 = $("vendorLogo");
  const elVendorLink2 = $("vendorLink2");
  const elVendorLogo2 = $("vendorLogo2");

  // State
  let taps = [];       // {x01,y01} normalized 0..1
  let bull = null;     // {x01,y01}
  let imgLoaded = false;
  let vendor = null;   // from vendor.json
  let vendorLogoImg = null;

  // ----------------------------
  // Vendor load + apply
  // ----------------------------
  async function loadVendor() {
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) throw new Error("vendor.json not found");
      vendor = await res.json();

      // Set links
      const href = vendor.website || "#";
      elVendorLink1.href = href;
      elVendorLink2.href = href;

      // Set logos
      const logoSrc = vendor.logo || "";
      if (logoSrc) {
        elVendorLogo1.src = logoSrc;
        elVendorLogo2.src = logoSrc;
        elVendorLogo1.style.display = "block";
        elVendorLogo2.style.display = "block";

        // Preload for SEC stamping
        vendorLogoImg = new Image();
        vendorLogoImg.crossOrigin = "anonymous";
        vendorLogoImg.src = logoSrc;
        await vendorLogoImg.decode().catch(() => {});
      }
    } catch (e) {
      // Leave vendor hidden if missing
      elVendorLogo1.style.display = "none";
      elVendorLogo2.style.display = "none";
    }
  }

  // ----------------------------
  // Image + taps
  // ----------------------------
  function promptPickPhoto() {
    elFile.click();
  }

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    elImg.onload = () => {
      imgLoaded = true;
      resetSession();
      renderDots();
    };
    elImg.src = url;
  });

  function resetSession() {
    taps = [];
    bull = null;
    elBullStatus.textContent = "Bull: not set";
    elTapCount.textContent = "Holes: 0";
    elWindDir.textContent = "—";
    elWindClicks.textContent = "—";
    elElevDir.textContent = "—";
    elElevClicks.textContent = "—";
  }

  // Tap to add holes; long-press (or 2-finger tap) to set bull (simple + reliable on iPad)
  let pressTimer = null;

  function clientXYToNorm(e) {
    const rect = elImg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x01: Math.max(0, Math.min(1, x)), y01: Math.max(0, Math.min(1, y)) };
  }

  function addTap(p) {
    taps.push(p);
    elTapCount.textContent = `Holes: ${taps.length}`;
    renderDots();
  }

  function setBull(p) {
    bull = p;
    elBullStatus.textContent = "Bull: set";
    renderDots();
  }

  elImg.addEventListener("pointerdown", (e) => {
    if (!imgLoaded) return;

    // Long press = set bull
    pressTimer = setTimeout(() => {
      setBull(clientXYToNorm(e));
      pressTimer = null;
    }, 450);
  });

  elImg.addEventListener("pointerup", (e) => {
    if (!imgLoaded) return;
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;

      // Normal tap = add hole
      addTap(clientXYToNorm(e));
    }
  });

  function renderDots() {
    elDots.innerHTML = "";
    const rect = elImg.getBoundingClientRect();

    function dot(x01, y01, cls) {
      const d = document.createElement("div");
      d.className = cls;
      d.style.position = "absolute";
      d.style.left = `${x01 * rect.width}px`;
      d.style.top = `${y01 * rect.height}px`;
      d.style.width = "14px";
      d.style.height = "14px";
      d.style.borderRadius = "999px";
      d.style.transform = "translate(-50%, -50%)";
      d.style.border = "2px solid rgba(255,255,255,0.85)";
      d.style.boxShadow = "0 0 0 4px rgba(0,0,0,0.25)";
      return d;
    }

    // Bull (yellow)
    if (bull) {
      const b = dot(bull.x01, bull.y01);
      b.style.background = "rgba(255,215,0,0.95)";
      elDots.appendChild(b);
    }

    // Holes (green)
    taps.forEach((p) => {
      const h = dot(p.x01, p.y01);
      h.style.background = "rgba(0,255,180,0.85)";
      elDots.appendChild(h);
    });
  }

  // Controls
  elUndo.addEventListener("click", () => {
    if (taps.length) taps.pop();
    elTapCount.textContent = `Holes: ${taps.length}`;
    renderDots();
  });

  elClear.addEventListener("click", () => {
    resetSession();
    renderDots();
  });

  // ----------------------------
  // Results (placeholder directions + two-decimals)
  // Replace this section with your real math if needed.
  // ----------------------------
  function two(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  elShow.addEventListener("click", () => {
    if (!bull || taps.length < 1) return;

    // Fake output (keeps your UI flowing). Swap with real computed clicks.
    // Signed deltas: bull - avg
    const avg = taps.reduce((a,p)=>({x:a.x+p.x01, y:a.y+p.y01}), {x:0,y:0});
    avg.x /= taps.length; avg.y /= taps.length;

    const dx = bull.x01 - avg.x;   // + = need RIGHT
    const dy = bull.y01 - avg.y;   // + = need DOWN (screen space)

    const windDir = dx >= 0 ? "RIGHT" : "LEFT";
    const elevDir = dy >= 0 ? "DOWN" : "UP";

    // Scale into “click-like” numbers just to show format (two decimals)
    const windClicks = Math.abs(dx) * 20;
    const elevClicks = Math.abs(dy) * 20;

    elWindDir.textContent = windDir;
    elWindClicks.textContent = `${two(windClicks)} clicks`;
    elElevDir.textContent = elevDir;
    elElevClicks.textContent = `${two(elevClicks)} clicks`;
  });

  // ----------------------------
  // SEC download (stamps vendor in SEC)
  // ----------------------------
  function drawVendorStamp(ctx, W, H) {
    if (!vendorLogoImg || !vendorLogoImg.naturalWidth) return;

    // Bottom-right stamp
    const pad = Math.round(W * 0.03);
    const maxW = Math.round(W * 0.28);
    const maxH = Math.round(H * 0.10);

    const iw = vendorLogoImg.naturalWidth;
    const ih = vendorLogoImg.naturalHeight;
    const scale = Math.min(maxW / iw, maxH / ih);

    const w = Math.round(iw * scale);
    const h = Math.round(ih * scale);

    const x = W - pad - w;
    const y = H - pad - h;

    ctx.globalAlpha = 0.95;
    ctx.drawImage(vendorLogoImg, x, y, w, h);
    ctx.globalAlpha = 1;
  }

  elDownload.addEventListener("click", () => {
    // Build a simple SEC image
    const W = secCanvas.width;
    const H = secCanvas.height;

    secCtx.clearRect(0, 0, W, H);
    secCtx.fillStyle = "#0b0f14";
    secCtx.fillRect(0, 0, W, H);

    // Title
    secCtx.fillStyle = "#e6edf3";
    secCtx.font = "bold 52px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    secCtx.fillText("Shooter Experience Card (SEC)", 60, 90);

    // Vendor name (top-right)
    if (vendor && vendor.name) {
      secCtx.font = "bold 36px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      secCtx.textAlign = "right";
      secCtx.fillText(vendor.name, W - 60, 90);
      secCtx.textAlign = "left";
    }

    // Results summary
    secCtx.font = "bold 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    secCtx.fillText(`Windage: ${elWindDir.textContent}  ${elWindClicks.textContent}`, 60, 170);
    secCtx.fillText(`Elevation: ${elElevDir.textContent}  ${elElevClicks.textContent}`, 60, 235);

    // Vendor logo stamp (SEC placement)
    drawVendorStamp(secCtx, W, H);

    // Download
    secCanvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "SEC.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }, "image/png");
  });

  // Boot
  loadVendor();

  // If no image yet, prompt once (optional)
  // promptPickPhoto();
})();
