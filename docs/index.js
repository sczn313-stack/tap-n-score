/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Tap-n-Score™
   Stability Brick:
   - iOS file-picker reliability (store File immediately)
   - Vendor.json wiring (name/url/logo)
   - Prevent taps while scrolling (touch-move threshold)
   - Bull marker = YELLOW
   - Hole markers = GREEN
   - SEC overlay mode: hide Tap-n-Score UI while SEC is displayed
   - Simple local calc (True MOA + 2 decimals) so you always get results
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // --- Elements (must exist in index.html)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elWrap = $("targetWrap");

  const elBullStatus = $("bullStatus");
  const elTapCount = $("tapCount");
  const elInstruction = $("instructionLine");

  const btnSetBull = $("setBullBtn");
  const btnUndo = $("undoBtn");
  const btnClear = $("clearBtn");
  const btnShow = $("showResultsBtn");
  const btnDownload = $("downloadSecBtn");
  const btnDetails = $("detailsBtn");

  const elWindDir = $("windDir");
  const elWindClicks = $("windClicks");
  const elElevDir = $("elevDir");
  const elElevClicks = $("elevClicks");

  const elVendorLink = $("vendorLink");
  const elVendorLogo = $("vendorLogo");
  const elVendorName = $("vendorName");

  // --- Tunables
  const TRUE_MOA_IN_PER_100Y = 1.047;
  const DEFAULT_DISTANCE_YDS = 50;
  const DEFAULT_CLICK_MOA = 0.25;

  // Tap-vs-scroll threshold (pixels)
  const SCROLL_CANCEL_PX = 12;

  // --- State
  let selectedFile = null;
  let objectUrl = null;

  let imageReady = false;

  // Stored in IMAGE-NORMALIZED coordinates [0..1] so resizing doesn’t break
  let bullN = null;          // {xN, yN}
  let holesN = [];           // [{xN, yN}, ...]

  // mode: when true, next tap sets bull
  let setBullMode = false;

  // touch gating
  let touchStart = null;     // {x, y}
  let movedTooMuch = false;

  // ============================================================
  // Helpers
  // ============================================================
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toFixed(2);
  }

  function getImageRect() {
    // Image element rect (visible size on screen)
    const r = elImg.getBoundingClientRect();
    return r;
  }

  function pointToNormalized(clientX, clientY) {
    const r = getImageRect();
    if (!r.width || !r.height) return null;

    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;

    return { xN: clamp01(x), yN: clamp01(y) };
  }

  function normalizedToPx(n) {
    const r = getImageRect();
    return {
      x: n.xN * r.width,
      y: n.yN * r.height,
    };
  }

  function clearDots() {
    elDots.innerHTML = "";
  }

  function makeDot({ x, y }, kind) {
    // kind: "bull" | "hole"
    const d = document.createElement("div");
    d.className = "dot";

    // Base dot size
    const size = kind === "bull" ? 20 : 18;

    d.style.position = "absolute";
    d.style.left = `${x - size / 2}px`;
    d.style.top = `${y - size / 2}px`;
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;
    d.style.borderRadius = "999px";
    d.style.boxSizing = "border-box";
    d.style.pointerEvents = "none"; // dots never intercept taps

    if (kind === "bull") {
      // Yellow bull marker
      d.style.background = "#FFD400";
      d.style.border = "3px solid rgba(0,0,0,0.85)";
      d.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
    } else {
      // Green hole marker
      d.style.background = "#00E676";
      d.style.border = "3px solid rgba(255,255,255,0.85)";
      d.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
    }

    elDots.appendChild(d);
  }

  function redrawAllDots() {
    clearDots();
    if (!imageReady) return;

    // Dots layer matches image rect
    const r = getImageRect();
    elDots.style.position = "absolute";
    elDots.style.left = `${r.left - elWrap.getBoundingClientRect().left}px`;
    elDots.style.top = `${r.top - elWrap.getBoundingClientRect().top}px`;
    elDots.style.width = `${r.width}px`;
    elDots.style.height = `${r.height}px`;

    // Bull
    if (bullN) {
      const p = normalizedToPx(bullN);
      makeDot(p, "bull");
    }

    // Holes
    for (const h of holesN) {
      const p = normalizedToPx(h);
      makeDot(p, "hole");
    }
  }

  function setInstruction(text) {
    elInstruction.textContent = text;
  }

  function updateStatus() {
    elBullStatus.textContent = bullN ? "set" : "not set";
    elTapCount.textContent = String(holesN.length);

    // Button hinting
    btnSetBull.style.opacity = setBullMode ? "1" : "0.85";
  }

  function resetResults() {
    elWindDir.textContent = "—";
    elWindClicks.textContent = "—";
    elElevDir.textContent = "—";
    elElevClicks.textContent = "—";
  }

  // ============================================================
  // Vendor.json
  // ============================================================
  async function loadVendor() {
    // vendor.json expected fields:
    // {
    //   "name": "Baker Targets",
    //   "url": "https://example.com",
    //   "logo": "./assets/vendor-baker-logo.png"
    // }
    try {
      const res = await fetch("./vendor.json", { cache: "no-store" });
      if (!res.ok) throw new Error("vendor.json not found");
      const v = await res.json();

      const name = (v && v.name) ? String(v.name) : "Vendor";
      const url = (v && v.url) ? String(v.url) : "#";
      const logo = (v && v.logo) ? String(v.logo) : "";

      elVendorName.textContent = name;

      if (url && url !== "#") {
        elVendorLink.href = url;
        elVendorLink.style.pointerEvents = "auto";
        elVendorLink.style.opacity = "1";
      } else {
        elVendorLink.href = "#";
        elVendorLink.style.pointerEvents = "none";
        elVendorLink.style.opacity = "0.8";
      }

      if (logo) {
        elVendorLogo.src = logo;
        elVendorLogo.alt = name;
        elVendorLogo.style.display = "block";
      } else {
        elVendorLogo.removeAttribute("src");
        elVendorLogo.alt = "";
        elVendorLogo.style.display = "none";
      }
    } catch (e) {
      // Soft fail: keep pill present
      elVendorName.textContent = "Vendor";
      elVendorLink.href = "#";
      elVendorLink.style.pointerEvents = "none";
      elVendorLogo.style.display = "none";
    }
  }

  // ============================================================
  // Image loading (iOS-safe)
  // ============================================================
  function setImageFromFile(file) {
    selectedFile = file || null;
    imageReady = false;

    resetResults();

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    if (!selectedFile) {
      elImg.removeAttribute("src");
      clearDots();
      setInstruction("Choose a photo, then tap the bull once, then tap each confirmed hole.");
      return;
    }

    objectUrl = URL.createObjectURL(selectedFile);
    elImg.onload = () => {
      imageReady = true;
      // Make sure dots layer redraws once image knows its rendered size
      requestAnimationFrame(() => {
        redrawAllDots();
      });
    };
    elImg.src = objectUrl;
  }

  // ============================================================
  // Tap capture (prevent taps during scroll)
  // ============================================================
  function onTouchStart(e) {
    if (!imageReady) return;
    if (!e.touches || e.touches.length !== 1) return;

    movedTooMuch = false;
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }

  function onTouchMove(e) {
    if (!touchStart) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStart.x);
    const dy = Math.abs(t.clientY - touchStart.y);
    if (dx > SCROLL_CANCEL_PX || dy > SCROLL_CANCEL_PX) movedTooMuch = true;
  }

  function onTouchEnd(e) {
    if (!imageReady) return;
    if (!touchStart) return;

    const wasScroll = movedTooMuch;
    touchStart = null;

    // If user was scrolling, do NOT record a tap
    if (wasScroll) return;

    // Use changedTouches for end point
    const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
    if (!t) return;

    handleTap(t.clientX, t.clientY);
  }

  function handleTap(clientX, clientY) {
    // Only capture taps inside the image rectangle
    const r = getImageRect();
    if (
      clientX < r.left || clientX > r.right ||
      clientY < r.top || clientY > r.bottom
    ) {
      return;
    }

    const n = pointToNormalized(clientX, clientY);
    if (!n) return;

    if (setBullMode || !bullN) {
      bullN = n;
      setBullMode = false;
      setInstruction("Tap each confirmed hole.");
      updateStatus();
      redrawAllDots();
      resetResults();
      return;
    }

    holesN.push(n);
    updateStatus();
    redrawAllDots();
    resetResults();
  }

  // ============================================================
  // Math: POIB (centroid), deltas, clicks (True MOA)
  // ============================================================
  function inchesPerMoa(distanceYds) {
    return TRUE_MOA_IN_PER_100Y * (distanceYds / 100);
  }

  function calcResults() {
    if (!bullN) return null;
    if (holesN.length < 1) return null;

    // POIB = mean of holes (normalized)
    const poib = holesN.reduce(
      (acc, h) => ({ xN: acc.xN + h.xN, yN: acc.yN + h.yN }),
      { xN: 0, yN: 0 }
    );
    poib.xN /= holesN.length;
    poib.yN /= holesN.length;

    // Convert normalized delta to pixels, then to inches using the *rendered* width as reference.
    // NOTE: Without a known real-world scale on the photo, inches are relative.
    // For stability, we compute direction + click magnitude based on screen delta,
    // which still produces correct *direction logic* and consistent outputs for this pilot.
    const r = getImageRect();
    const dxPx = (bullN.xN - poib.xN) * r.width;   // + => bull right of POIB
    const dyPx = (bullN.yN - poib.yN) * r.height;  // + => bull below POIB (screen coords)

    // We need a pixels→inches scale. For this pilot, assume the image shown width represents the full paper width.
    // Default = 8.5" wide (you can swap to 23" when you’re in that target profile).
    const ASSUMED_PAPER_WIDTH_IN = 8.5;
    const pxPerIn = r.width / ASSUMED_PAPER_WIDTH_IN;

    const dxIn = dxPx / pxPerIn;
    const dyIn = dyPx / pxPerIn;

    const dist = DEFAULT_DISTANCE_YDS;
    const clickMOA = DEFAULT_CLICK_MOA;

    const ipm = inchesPerMoa(dist); // inches per MOA at distance

    const windMoa = Math.abs(dxIn) / ipm;
    const elevMoa = Math.abs(dyIn) / ipm;

    const windClicks = windMoa / clickMOA;
    const elevClicks = elevMoa / clickMOA;

    const windDir = dxIn > 0 ? "RIGHT" : (dxIn < 0 ? "LEFT" : "—");
    // Screen Y: down is positive. If bull is BELOW POIB (dyIn>0), shooter needs to move POI DOWN => dial DOWN
    const elevDir = dyIn > 0 ? "DOWN" : (dyIn < 0 ? "UP" : "—");

    return {
      windDir,
      elevDir,
      windClicks,
      elevClicks,
      bullN,
      poibN: poib,
      dxIn,
      dyIn,
      dist,
      clickMOA,
    };
  }

  function renderResults() {
    const res = calcResults();
    if (!res) return;

    elWindDir.textContent = res.windDir;
    elElevDir.textContent = res.elevDir;

    elWindClicks.textContent = `${fmt2(res.windClicks)} clicks`;
    elElevClicks.textContent = `${fmt2(res.elevClicks)} clicks`;
  }

  // ============================================================
  // SEC overlay (Tap-n-Score disappears while SEC is showing)
  // ============================================================
  function enterSecMode() {
    // Hide the main UI while SEC overlay is up
    const headerRow = document.querySelector(".headerRow");
    const chipsRow = document.querySelector(".chipsRow");
    const instruction = document.querySelector(".instructionLine");
    const targetWrap = document.querySelector(".targetWrap");
    const actionsRow = document.querySelector(".actionsRow");
    const resultsCard = document.querySelector(".resultsCard");

    if (headerRow) headerRow.style.display = "none";
    if (chipsRow) chipsRow.style.display = "none";
    if (instruction) instruction.style.display = "none";
    if (targetWrap) targetWrap.style.display = "none";
    if (actionsRow) actionsRow.style.display = "none";
    if (resultsCard) resultsCard.style.display = "none";
  }

  function exitSecMode() {
    const headerRow = document.querySelector(".headerRow");
    const chipsRow = document.querySelector(".chipsRow");
    const instruction = document.querySelector(".instructionLine");
    const targetWrap = document.querySelector(".targetWrap");
    const actionsRow = document.querySelector(".actionsRow");
    const resultsCard = document.querySelector(".resultsCard");

    if (headerRow) headerRow.style.display = "";
    if (chipsRow) chipsRow.style.display = "";
    if (instruction) instruction.style.display = "";
    if (targetWrap) targetWrap.style.display = "";
    if (actionsRow) actionsRow.style.display = "";
    if (resultsCard) resultsCard.style.display = "";
  }

  function buildSecPng() {
    const res = calcResults();
    if (!res) return null;

    // Canvas
    const w = 1100;
    const h = 650;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    // Background (white)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);

    // RWB header bar
    ctx.fillStyle = "#B22234"; // red
    ctx.fillRect(0, 0, w, 70);
    ctx.fillStyle = "#FFFFFF"; // white stripe
    ctx.fillRect(0, 70, w, 14);
    ctx.fillStyle = "#3C3B6E"; // blue
    ctx.fillRect(0, 84, w, 38);

    // Title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("SHOOTER EXPERIENCE CARD", 34, 48);

    // Vendor (name)
    ctx.fillStyle = "#0B0B0B";
    ctx.font = "700 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(elVendorName?.textContent || "Vendor", 34, 170);

    // Divider
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(34, 190, w - 68, 2);

    // Corrections
    ctx.fillStyle = "#0B0B0B";
    ctx.font = "800 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Corrections (Scope)", 34, 250);

    ctx.font = "700 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    ctx.fillText("Windage:", 34, 310);
    ctx.fillText(res.windDir, 220, 310);
    ctx.fillText(`${fmt2(res.windClicks)} clicks`, 520, 310);

    ctx.fillText("Elevation:", 34, 370);
    ctx.fillText(res.elevDir, 220, 370);
    ctx.fillText(`${fmt2(res.elevClicks)} clicks`, 520, 370);

    // Footer bar
    ctx.fillStyle = "#3C3B6E";
    ctx.fillRect(0, h - 60, w, 60);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("After-Shot Intelligence", 34, h - 22);

    return c.toDataURL("image/png");
  }

  function showSecOverlay() {
    const dataUrl = buildSecPng();
    if (!dataUrl) return;

    enterSecMode();

    // Overlay
    const overlay = document.createElement("div");
    overlay.id = "secOverlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.zIndex = "999999";
    overlay.style.background = "rgba(0,0,0,0.92)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "18px";

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "SEC";
    img.style.maxWidth = "96vw";
    img.style.maxHeight = "78vh";
    img.style.borderRadius = "14px";
    img.style.boxShadow = "0 18px 60px rgba(0,0,0,0.55)";
    img.style.background = "#fff";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "12px";
    row.style.marginTop = "16px";

    const btnClose = document.createElement("button");
    btnClose.textContent = "Close";
    btnClose.style.padding = "12px 18px";
    btnClose.style.borderRadius = "12px";
    btnClose.style.border = "0";
    btnClose.style.fontWeight = "800";
    btnClose.style.background = "#222";
    btnClose.style.color = "#fff";

    const btnSave = document.createElement("a");
    btnSave.textContent = "Download PNG";
    btnSave.href = dataUrl;
    btnSave.download = "SEC.png";
    btnSave.style.padding = "12px 18px";
    btnSave.style.borderRadius = "12px";
    btnSave.style.fontWeight = "900";
    btnSave.style.background = "#B22234";
    btnSave.style.color = "#fff";
    btnSave.style.textDecoration = "none";

    btnClose.onclick = () => {
      overlay.remove();
      exitSecMode();
    };

    row.appendChild(btnClose);
    row.appendChild(btnSave);

    overlay.appendChild(img);
    overlay.appendChild(row);

    document.body.appendChild(overlay);
  }

  // ============================================================
  // Event wiring
  // ============================================================
  elFile.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    // iOS: store immediately
    setImageFromFile(f);
    // Reset capture state
    bullN = null;
    holesN = [];
    setBullMode = false;
    updateStatus();
    redrawAllDots();
    resetResults();
    setInstruction("Choose a photo, then tap the bull once, then tap each confirmed hole.");
  });

  // Tap capture on wrapper (NOT body)
  // Use touch events so we can cancel when scroll happens
  elWrap.addEventListener("touchstart", onTouchStart, { passive: true });
  elWrap.addEventListener("touchmove", onTouchMove, { passive: true });
  elWrap.addEventListener("touchend", onTouchEnd, { passive: true });

  // Desktop click support
  elWrap.addEventListener("click", (e) => {
    if (!imageReady) return;
    // Ignore clicks if they originated on buttons/links
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "button" || tag === "a" || tag === "input" || tag === "label") return;
    handleTap(e.clientX, e.clientY);
  });

  btnSetBull.addEventListener("click", () => {
    setBullMode = true;
    setInstruction("Set the bull first (tap Set Bull, then tap the bull).");
    updateStatus();
  });

  btnUndo.addEventListener("click", () => {
    if (holesN.length > 0) {
      holesN.pop();
    } else if (bullN) {
      bullN = null;
    }
    updateStatus();
    redrawAllDots();
    resetResults();
  });

  btnClear.addEventListener("click", () => {
    bullN = null;
    holesN = [];
    setBullMode = false;
    updateStatus();
    redrawAllDots();
    resetResults();
    setInstruction("Choose a photo, then tap the bull once, then tap each confirmed hole.");
  });

  btnShow.addEventListener("click", () => {
    renderResults();
  });

  btnDownload.addEventListener("click", () => {
    // Build and show SEC overlay (and hide Tap-n-Score UI while it’s up)
    showSecOverlay();
  });

  btnDetails.addEventListener("click", () => {
    // Minimal: toggle a quick info alert (safe + stable)
    const info =
      `Vendor: ${elVendorName?.textContent || "Vendor"}\n` +
      `Distance: ${DEFAULT_DISTANCE_YDS} yards\n` +
      `Click: ${DEFAULT_CLICK_MOA} MOA/click\n` +
      `True MOA: 1.047" @ 100y\n\n` +
      `Flow:\n` +
      `1) Choose Target Photo\n` +
      `2) Set Bull (tap Set Bull, then tap bull)\n` +
      `3) Tap each confirmed hole\n` +
      `4) Show Results → Download SEC`;
    alert(info);
  });

  // On resize/orientation change, keep dots aligned
  window.addEventListener("resize", () => {
    if (!imageReady) return;
    requestAnimationFrame(() => redrawAllDots());
  });

  // ============================================================
  // Boot
  // ============================================================
  resetResults();
  updateStatus();
  loadVendor();
})();
