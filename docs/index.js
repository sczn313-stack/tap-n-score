/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — 3-page flow
   - Page 1: Landing (locked)
   - Page 2: Target tap (bull first; CTAs appear after bull)
   - Page 3: SEC (final) — clicks + score only + sessionId embedded
   - Download SEC as Image (canvas render) or Text (plain)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Views
  const viewLanding = $("viewLanding");
  const viewTarget  = $("viewTarget");
  const viewSEC     = $("viewSEC");

  // Landing
  const btnChoosePhoto = $("btnChoosePhoto");
  const photoInput     = $("photoInput");

  // Target page
  const targetImg       = $("targetImg");
  const tapLayer        = $("tapLayer");
  const instructionLine = $("instructionLine");
  const targetWrap      = $("targetCanvasWrap");
  const ctaBar          = $("ctaBar");
  const btnClear        = $("btnClear");
  const btnUndo         = $("btnUndo");
  const btnGetResults   = $("btnGetResults");
  const btnBuyMore      = $("btnBuyMore");

  // SEC page
  const btnBuyMoreTop = $("btnBuyMoreTop");
  const clickUpEl     = $("clickUp");
  const clickDownEl   = $("clickDown");
  const clickLeftEl   = $("clickLeft");
  const clickRightEl  = $("clickRight");
  const secSessionId  = $("secSessionId");
  const secScoreValue = $("secScoreValue");
  const histCurrent   = $("histCurrent");
  const histPrev3     = $("histPrev3");
  const histCum       = $("histCum");
  const btnDownloadImg= $("btnDownloadImg");
  const btnDownloadTxt= $("btnDownloadTxt");
  const secCanvas     = $("secCanvas");

  // -----------------------------
  // Session ID (embedded on Page 3 + downloads)
  // -----------------------------
  function makeSessionId() {
    // short, readable, unique enough for sessions
    const a = Math.random().toString(16).slice(2, 10).toUpperCase();
    const b = Date.now().toString(16).slice(-6).toUpperCase();
    return `SEC-${b}-${a}`;
  }

  let sessionId = sessionStorage.getItem("sczn3_session_id");
  if (!sessionId) {
    sessionId = makeSessionId();
    sessionStorage.setItem("sczn3_session_id", sessionId);
  }

  // -----------------------------
  // State for target tapping
  // -----------------------------
  let objectUrl = null;
  let selectedFile = null;

  let bull = null;     // {x, y} in IMAGE coordinates (not screen)
  let holes = [];      // array of {x,y} in IMAGE coordinates

  // Zoom/pan state
  let scale = 1;
  let panX = 0; // px
  let panY = 0; // px
  let isPanning = false;
  let lastTouchDist = null;
  let lastTouchMid = null;
  let lastPanPoint = null;

  // Result state (from backend or computed)
  let secData = {
    up: "0.00", down: "0.00", left: "0.00", right: "0.00",
    score: 0,
    prev3: [],
    cumulative: 0,
    vendor: "BAKER"
  };

  // -----------------------------
  // Helpers
  // -----------------------------
  function show(view) {
    viewLanding.classList.add("hidden");
    viewTarget.classList.add("hidden");
    viewSEC.classList.add("hidden");
    view.classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  function twoDec(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // Get point in IMAGE coords from a tap on the wrapper
  function screenToImagePoint(clientX, clientY) {
    const wrapRect = targetWrap.getBoundingClientRect();
    const imgRect  = targetImg.getBoundingClientRect();

    // point in screen
    const sx = clientX;
    const sy = clientY;

    // point relative to image rect
    const rx = sx - imgRect.left;
    const ry = sy - imgRect.top;

    // map to natural image coordinates
    const nx = (rx / imgRect.width)  * targetImg.naturalWidth;
    const ny = (ry / imgRect.height) * targetImg.naturalHeight;

    return { x: nx, y:z: ny, y: ny };
  }

  function clearDots() {
    tapLayer.innerHTML = "";
  }

  function drawDotImageCoords(pt, cls = "") {
    // Convert IMAGE coords -> current SCREEN coords
    const imgRect = targetImg.getBoundingClientRect();
    const sx = imgRect.left + (pt.x / targetImg.naturalWidth)  * imgRect.width;
    const sy = imgRect.top  + (pt.y / targetImg.naturalHeight) * imgRect.height;

    const wrapRect = targetWrap.getBoundingClientRect();
    const x = sx - wrapRect.left;
    const y = sy - wrapRect.top;

    const d = document.createElement("div");
    d.className = `dot ${cls}`.trim();
    d.style.left = `${x}px`;
    d.style.top  = `${y}px`;
    tapLayer.appendChild(d);
  }

  function redrawDots() {
    clearDots();
    if (bull) drawDotImageCoords(bull, "bull");
    holes.forEach((h) => drawDotImageCoords(h, ""));
  }

  function applyTransform() {
    targetImg.style.transform =
      `translate(-50%,-50%) translate(${panX}px, ${panY}px) scale(${scale})`;
    redrawDots();
  }

  // -----------------------------
  // Landing → choose photo
  // -----------------------------
  btnChoosePhoto.addEventListener("click", () => {
    photoInput.click();
  });

  photoInput.addEventListener("change", () => {
    const f = photoInput.files && photoInput.files[0];
    if (!f) return;
    selectedFile = f;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    // reset state
    bull = null;
    holes = [];
    scale = 1;
    panX = 0;
    panY = 0;
    lastTouchDist = null;
    lastTouchMid = null;
    lastPanPoint = null;

    // show target page
    show(viewTarget);

    // load image
    targetImg.onload = () => {
      applyTransform();
      redrawDots();
      instructionLine.textContent = "Tap bull’s-eye to center";
      ctaBar.classList.add("hidden"); // CTAs NOT visible until bull is set
    };
    targetImg.src = objectUrl;
  });

  // -----------------------------
  // Tap logic (bull first, then holes)
  // -----------------------------
  targetWrap.addEventListener("click", (e) => {
    // ignore if not loaded
    if (!targetImg.naturalWidth) return;

    // If user is pinching/panning, ignore click
    if (lastTouchDist !== null) return;

    const pt = screenToImagePoint(e.clientX, e.clientY);

    if (!bull) {
      bull = pt;
      instructionLine.textContent = "Tap bullet holes to be scored";
      ctaBar.classList.remove("hidden"); // CTAs appear only now
      redrawDots();
      return;
    }

    // hole tap
    holes.push(pt);
    redrawDots();
  });

  // -----------------------------
  // Touch gestures: pinch zoom + pan
  // -----------------------------
  targetWrap.addEventListener("touchstart", (e) => {
    if (!targetImg.naturalWidth) return;

    if (e.touches.length === 2) {
      // pinch start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      lastTouchDist = Math.hypot(dx, dy);
      lastTouchMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1) {
      // pan start
      isPanning = true;
      const t = e.touches[0];
      lastPanPoint = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  targetWrap.addEventListener("touchmove", (e) => {
    if (!targetImg.naturalWidth) return;

    if (e.touches.length === 2 && lastTouchDist !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);

      const delta = dist / lastTouchDist;
      scale = clamp(scale * delta, 0.75, 6);

      lastTouchDist = dist;

      // Optional: keep mid stable (basic feel)
      const mid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      const mdx = mid.x - lastTouchMid.x;
      const mdy = mid.y - lastTouchMid.y;
      panX += mdx;
      panY += mdy;
      lastTouchMid = mid;

      applyTransform();
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1 && isPanning && lastPanPoint) {
      const t = e.touches[0];
      const dx = t.clientX - lastPanPoint.x;
      const dy = t.clientY - lastPanPoint.y;
      panX += dx;
      panY += dy;
      lastPanPoint = { x: t.clientX, y: t.clientY };
      applyTransform();
      e.preventDefault();
    }
  }, { passive: false });

  targetWrap.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      lastTouchDist = null;
      lastTouchMid = null;
    }
    if (e.touches.length === 0) {
      isPanning = false;
      lastPanPoint = null;
    }
  });

  // -----------------------------
  // CTAs on Page 2
  // -----------------------------
  btnClear.addEventListener("click", () => {
    holes = [];
    redrawDots();
  });

  btnUndo.addEventListener("click", () => {
    holes.pop();
    redrawDots();
  });

  // “Buy more targets like this” — only appears after bull is set per spec
  function openVendorLink() {
    // Replace with your real Baker URL when ready:
    window.open("https://bakertargets.com", "_blank", "noopener,noreferrer");
  }
  btnBuyMore.addEventListener("click", openVendorLink);
  btnBuyMoreTop.addEventListener("click", openVendorLink);

  // -----------------------------
  // Get Results → Page 3 (SEC)
  // -----------------------------
  btnGetResults.addEventListener("click", async () => {
    if (!bull) return;

    // Minimal guard: need at least 1 hole to be meaningful (you can change later)
    if (holes.length < 1) {
      // Keep it silent for now; you can add UI later.
      return;
    }

    // Call backend if you have it; otherwise use placeholder
    // IMPORTANT: page 3 shows ONLY clicks + score; no other calculations.
    try {
      // If you have an endpoint, set it here:
      const endpoint = "/api/analyze"; // change if needed

      // Build request payload
      const payload = {
        sessionId,
        bull,
        holes,
        // You can add distance/clickValue later once you wire settings back in
      };

      // Attempt backend call; if it fails we fall back to placeholder.
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const data = await resp.json();

        // Expecting clicks with 2 decimals already OR numeric we format:
        secData.up    = twoDec(data?.clicks?.up ?? data?.up ?? 0);
        secData.down  = twoDec(data?.clicks?.down ?? data?.down ?? 0);
        secData.left  = twoDec(data?.clicks?.left ?? data?.left ?? 0);
        secData.right = twoDec(data?.clicks?.right ?? data?.right ?? 0);

        secData.score = Number(data?.score ?? 0) || 0;

        // history (optional)
        secData.prev3 = Array.isArray(data?.prev3) ? data.prev3.slice(0,3) : [];
        secData.cumulative = Number(data?.cumulative ?? secData.score) || secData.score;

      } else {
        throw new Error("backend not ok");
      }
    } catch (err) {
      // Placeholder (until backend wiring)
      // Keep values small and 2-decimal
      secData.up = "0.00";
      secData.down = "0.00";
      secData.left = "0.00";
      secData.right = "0.00";
      secData.score = 82; // example
      secData.prev3 = [78, 80, 76];
      secData.cumulative = 79;
    }

    // Update Page 3 UI + embed sessionId
    renderSEC();
    show(viewSEC);
  });

  function setScoreColor(score) {
    secScoreValue.classList.remove("scoreGood", "scoreMid", "scoreLow");
    // Simple default thresholds; change later to your official system
    if (score >= 85) secScoreValue.classList.add("scoreGood");
    else if (score >= 65) secScoreValue.classList.add("scoreMid");
    else secScoreValue.classList.add("scoreLow");
  }

  function renderSEC() {
    clickUpEl.textContent    = secData.up;
    clickDownEl.textContent  = secData.down;
    clickLeftEl.textContent  = secData.left;
    clickRightEl.textContent = secData.right;

    secSessionId.textContent = `Session: ${sessionId}`;

    secScoreValue.textContent = String(secData.score);
    setScoreColor(secData.score);

    histCurrent.textContent = String(secData.score);
    histPrev3.textContent = secData.prev3.length ? secData.prev3.join(", ") : "—";
    histCum.textContent = String(secData.cumulative);
  }

  // -----------------------------
  // Download SEC (Image) — Canvas render (embeds sessionId)
  // -----------------------------
  btnDownloadImg.addEventListener("click", () => {
    const ctx = secCanvas.getContext("2d");
    if (!ctx) return;

    // Canvas background (dark + subtle vignette)
    const w = secCanvas.width;
    const h = secCanvas.height;

    // base
    ctx.fillStyle = "#060709";
    ctx.fillRect(0, 0, w, h);

    // vignette
    const grd = ctx.createRadialGradient(w*0.5, h*0.25, 50, w*0.5, h*0.25, h*0.9);
    grd.addColorStop(0, "rgba(255,255,255,0.06)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.02)");
    grd.addColorStop(0.6, "rgba(0,0,0,0.75)");
    grd.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Header: SEC Card (R/W/B feel)
    ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#e0222f";
    ctx.fillText("SEC", 70, 70);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(" Card", 190, 70);

    // Buy more (top right box)
    const boxX = w - 70 - 360;
    const boxY = 70;
    const boxW = 360;
    const boxH = 140;
    ctx.fillStyle = "rgba(15,20,28,0.92)";
    ctx.strokeStyle = "#223044";
    ctx.lineWidth = 3;
    roundRect(ctx, boxX, boxY, boxW, boxH, 22, true, true);

    ctx.fillStyle = "#2b6cff";
    ctx.font = "900 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("BUY", boxX + 28, boxY + 26);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(" MORE", boxX + 110, boxY + 26);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Targets Like This", boxX + 28, boxY + 78);

    // Left clicks box
    const cX = 70, cY = 260, cW = 520, cH = 520;
    ctx.fillStyle = "rgba(15,18,22,0.90)";
    ctx.strokeStyle = "#202632";
    ctx.lineWidth = 3;
    roundRect(ctx, cX, cY, cW, cH, 26, true, true);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Target Clicks", cX + 30, cY + 28);

    ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("Up", cX + 30, cY + 100);
    ctx.fillText("Down", cX + 280, cY + 100);
    ctx.fillText("Left", cX + 30, cY + 230);
    ctx.fillText("Right", cX + 280, cY + 230);

    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(secData.up, cX + 30, cY + 130);
    ctx.fillText(secData.down, cX + 280, cY + 130);
    ctx.fillText(secData.left, cX + 30, cY + 260);
    ctx.fillText(secData.right, cX + 280, cY + 260);

    // Embedded session ID (in the image)
    ctx.font = "700 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.fillText(`Session: ${sessionId}`, cX + 30, cY + cH - 54);

    // Right score panel
    const sX = 640, sY = 260, sW = 370, sH = 520;
    ctx.fillStyle = "rgba(15,18,22,0.90)";
    ctx.strokeStyle = "#202632";
    ctx.lineWidth = 3;
    roundRect(ctx, sX, sY, sW, sH, 26, true, true);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Score", sX + 30, sY + 28);

    // score color
    ctx.font = "950 140px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = scoreColor(secData.score);
    ctx.fillText(String(secData.score), sX + 30, sY + 88);

    // history
    ctx.font = "750 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText(`Current: ${secData.score}`, sX + 30, sY + 270);

    const prev = secData.prev3.length ? secData.prev3.join(", ") : "—";
    ctx.fillText(`Previous 3: ${prev}`, sX + 30, sY + 316);
    ctx.fillText(`Cumulative: ${secData.cumulative}`, sX + 30, sY + 362);

    // Footer note (optional minimal, keeps artifact clean)
    ctx.font = "700 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("SEC export", 70, h - 64);

    // Download
    secCanvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${sessionId}_SEC.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }, "image/png");
  });

  function scoreColor(score) {
    if (score >= 85) return "#39d98a";
    if (score >= 65) return "#ffd166";
    return "#ff5c5c";
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // -----------------------------
  // Download SEC (Text) — embeds sessionId
  // -----------------------------
  btnDownloadTxt.addEventListener("click", () => {
    const lines = [];
    lines.push(`Session: ${sessionId}`);
    lines.push(`Score: ${secData.score}`);
    lines.push(`Target Clicks (two decimals):`);
    lines.push(`  Up: ${secData.up}`);
    lines.push(`  Down: ${secData.down}`);
    lines.push(`  Left: ${secData.left}`);
    lines.push(`  Right: ${secData.right}`);
    lines.push(`History:`);
    lines.push(`  Current: ${secData.score}`);
    lines.push(`  Previous 3: ${secData.prev3.length ? secData.prev3.join(", ") : "—"}`);
    lines.push(`  Cumulative: ${secData.cumulative}`);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sessionId}_SEC.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  });

  // Start on landing
  show(viewLanding);

})();
