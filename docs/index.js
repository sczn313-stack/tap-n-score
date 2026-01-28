/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Baker Pilot (iOS-safe load)
   Fixes:
   - File picker opens via <label for="photoInput"> (handled in HTML)
   - Target image reliably loads on iOS (ObjectURL + FileReader fallback)
   - Image always fits/centers (prevents "blank" due to off-screen transform)
   - Adds "INDEX.JS READY" badge to prove this JS file is running
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Required elements (must exist in index.html)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elUndo = $("undoTapsBtn");
  const elClear = $("clearTapsBtn");
  const elResults = $("showResultsBtn");
  const elInstruction = $("instructionLine");
  const elSec = $("secPanel");

  const elUnitToggle = $("unitToggle");
  const elUnitLabel = $("unitLabel");
  const elDistance = $("distanceInput");
  const elDistanceUnit = $("distanceUnit");
  const elClick = $("clickInput");
  const elApply = $("momaApplyBtn");

  const elCatalog = $("bakerCatalogBtn");
  const elProduct = $("bakerProductBtn");

  // ---- Minimal safety: if any critical element missing, stop
  const must = [elFile, elImg, elWrap, elDots, elTapCount, elUndo, elClear, elResults, elInstruction, elSec];
  if (must.some((x) => !x)) {
    console.error("Missing required DOM IDs. Check index.html IDs.");
    return;
  }

  // ---- Badge to prove index.js loaded
  (function showIndexBadge() {
    const b = document.createElement("div");
    b.textContent = "INDEX.JS READY";
    b.style.position = "fixed";
    b.style.left = "10px";
    b.style.bottom = "10px";
    b.style.zIndex = "999999";
    b.style.padding = "8px 10px";
    b.style.borderRadius = "12px";
    b.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Arial";
    b.style.fontSize = "12px";
    b.style.fontWeight = "900";
    b.style.letterSpacing = "0.2px";
    b.style.background = "rgba(0,90,200,0.85)";
    b.style.color = "white";
    b.style.boxShadow = "0 18px 45px rgba(0,0,0,0.55)";
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2500);
  })();

  // ---- Vendor links (safe placeholders — replace later)
  // Set these to real Baker URLs when ready.
  elCatalog.href = "https://bakertargets.com/";
  elProduct.href = "https://bakertargets.com/";

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  let objectUrl = null;
  let imageLoaded = false;

  // Transform for pan/zoom
  const view = {
    scale: 1,
    tx: 0,
    ty: 0,
    minScale: 0.25,
    maxScale: 8
  };

  // Taps stored in IMAGE PIXEL coordinates
  let taps = []; // {xPx, yPx}

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setInstruction(msg) {
    elInstruction.textContent = msg;
  }

  function setTapCount() {
    elTapCount.textContent = String(taps.length);
  }

  function clearSec() {
    elSec.innerHTML = "";
  }

  function applyTransform() {
    const t = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    elImg.style.transform = t;
    elDots.style.transform = t;
    redrawDots();
  }

  function redrawDots() {
    // dotsLayer is transformed alongside the image,
    // so dot positions should be in IMAGE pixel space.
    const w = elImg.naturalWidth || 0;
    const h = elImg.naturalHeight || 0;
    if (!imageLoaded || !w || !h) {
      elDots.innerHTML = "";
      return;
    }

    // Make dotsLayer match image pixel size (pre-transform)
    elDots.style.width = `${w}px`;
    elDots.style.height = `${h}px`;

    // Draw
    const dotPx = 10; // locked at 10px per your request
    const r = dotPx / 2;

    elDots.innerHTML = taps
      .map((p, i) => {
        // numbered filled dot (small, visible)
        const n = i + 1;
        return `
          <div style="
            position:absolute;
            left:${p.xPx - r}px;
            top:${p.yPx - r}px;
            width:${dotPx}px;
            height:${dotPx}px;
            border-radius:999px;
            background: rgba(255,80,80,0.95);
            box-shadow: 0 0 0 2px rgba(0,0,0,0.55);
            display:flex;
            align-items:center;
            justify-content:center;
            font-weight:900;
            font-size:10px;
            color:#120000;
            line-height:1;
            pointer-events:none;
          ">${n}</div>
        `;
      })
      .join("");
  }

  function resetViewToFit() {
    const w = elImg.naturalWidth || 0;
    const h = elImg.naturalHeight || 0;
    const wrapW = elWrap.clientWidth || 1;
    const wrapH = elWrap.clientHeight || 1;

    if (!w || !h) return;

    const s = Math.min(wrapW / w, wrapH / h);
    view.scale = clamp(s, view.minScale, view.maxScale);

    // center image in viewport
    const scaledW = w * view.scale;
    const scaledH = h * view.scale;
    view.tx = (wrapW - scaledW) / 2;
    view.ty = (wrapH - scaledH) / 2;

    applyTransform();
  }

  function screenToImagePx(clientX, clientY) {
    const rect = elWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // inverse of transform: (x - tx)/scale
    const ix = (x - view.tx) / view.scale;
    const iy = (y - view.ty) / view.scale;

    return { ix, iy };
  }

  // ------------------------------------------------------------
  // Image loading (ObjectURL + FileReader fallback)
  // ------------------------------------------------------------
  function revokeOldUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  async function loadFileToImage(file) {
    imageLoaded = false;
    clearSec();
    taps = [];
    setTapCount();
    elDots.innerHTML = "";
    setInstruction("Loading photo…");

    // Ensure img is "visible"
    elImg.style.display = "block";

    // Try ObjectURL first
    revokeOldUrl();
    let used = "objecturl";
    try {
      objectUrl = URL.createObjectURL(file);
      elImg.src = objectUrl;
    } catch (e) {
      used = "dataurl";
      objectUrl = null;
      elImg.removeAttribute("src");
    }

    // If ObjectURL path fails, use FileReader DataURL
    if (used === "dataurl") {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error("FileReader failed"));
        fr.onload = () => resolve(fr.result);
        fr.readAsDataURL(file);
      });
      elImg.src = String(dataUrl);
    }

    // Wait for actual decode (more reliable than onload alone)
    await new Promise((resolve, reject) => {
      const done = () => resolve();
      const fail = () => reject(new Error("Image failed to load"));
      elImg.onload = done;
      elImg.onerror = fail;
      // If cached and already complete
      if (elImg.complete && elImg.naturalWidth > 0) resolve();
    });

    // Extra decode when available
    if (elImg.decode) {
      try { await elImg.decode(); } catch (_) {}
    }

    imageLoaded = true;

    // Make dotsLayer match image pixels
    elDots.style.left = "0px";
    elDots.style.top = "0px";

    resetViewToFit();

    setInstruction(`Photo loaded. Pinch/zoom + pan. Tap bull first, then tap hits. Then press Show Results.`);
  }

  // ------------------------------------------------------------
  // Input handlers
  // ------------------------------------------------------------
  elFile.addEventListener("change", async () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    try {
      await loadFileToImage(f);
    } catch (err) {
      console.error(err);
      setInstruction("Could not load that image. Try a different photo or screenshot.");
    }
  });

  // ------------------------------------------------------------
  // Tap capture (1 finger tap only)
  // ------------------------------------------------------------
  let activePointers = new Map();
  let isPanning = false;
  let panStart = null;
  let lastTapTime = 0;

  elWrap.addEventListener("pointerdown", (e) => {
    elWrap.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      // potential tap/pan start
      isPanning = true;
      panStart = {
        x: e.clientX,
        y: e.clientY,
        tx: view.tx,
        ty: view.ty
      };
    } else {
      // multi-touch => stop panning as "tap"
      isPanning = false;
      panStart = null;
    }
  });

  elWrap.addEventListener("pointermove", (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pan with 1 pointer
    if (activePointers.size === 1 && isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      view.tx = panStart.tx + dx;
      view.ty = panStart.ty + dy;
      applyTransform();
    }

    // Pinch with 2 pointers (simple)
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

      if (!elWrap._pinch) {
        elWrap._pinch = {
          startDist: d,
          startScale: view.scale,
          startTx: view.tx,
          startTy: view.ty,
          // pinch center
          cx: (pts[0].x + pts[1].x) / 2,
          cy: (pts[0].y + pts[1].y) / 2
        };
      } else {
        const p = elWrap._pinch;
        const factor = d / (p.startDist || 1);

        // zoom around center
        const newScale = clamp(p.startScale * factor, view.minScale, view.maxScale);

        // Convert center point to wrap coords
        const rect = elWrap.getBoundingClientRect();
        const cx = p.cx - rect.left;
        const cy = p.cy - rect.top;

        // Keep the image point under the pinch center stable
        const ix = (cx - p.startTx) / p.startScale;
        const iy = (cy - p.startTy) / p.startScale;

        view.scale = newScale;
        view.tx = cx - ix * view.scale;
        view.ty = cy - iy * view.scale;

        applyTransform();
      }
    }
  });

  elWrap.addEventListener("pointerup", (e) => {
    // detect tap (1-finger quick without big movement)
    const wasSingle = activePointers.size === 1;
    const down = activePointers.get(e.pointerId);
    activePointers.delete(e.pointerId);

    // clear pinch state when leaving 2 pointers
    if (activePointers.size < 2) elWrap._pinch = null;

    if (!imageLoaded) return;
    if (!wasSingle || !down) return;

    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 10) return; // treated as pan

    // Double-tap to reset view
    const now = Date.now();
    if (now - lastTapTime < 280) {
      resetViewToFit();
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;

    // Record a hit tap
    const { ix, iy } = screenToImagePx(e.clientX, e.clientY);

    // bounds
    if (ix < 0 || iy < 0 || ix > elImg.naturalWidth || iy > elImg.naturalHeight) return;

    taps.push({ xPx: ix, yPx: iy });
    setTapCount();
    redrawDots();
  });

  elWrap.addEventListener("pointercancel", (e) => {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) elWrap._pinch = null;
  });

  // ------------------------------------------------------------
  // Undo / Clear
  // ------------------------------------------------------------
  elUndo.addEventListener("click", () => {
    if (taps.length) taps.pop();
    setTapCount();
    redrawDots();
    clearSec();
  });

  elClear.addEventListener("click", () => {
    taps = [];
    setTapCount();
    redrawDots();
    clearSec();
    setInstruction("Cleared taps. Tap bull first, then tap hits.");
  });

  // ------------------------------------------------------------
  // Units + MOMA inputs (UI only for now)
  // Default pilot: 100 yd, 0.25 MOA/click, inches mode
  // ------------------------------------------------------------
  const session = {
    unit: "in",         // "in" or "m"
    distanceYds: 100,
    moaPerClick: 0.25
  };

  function fmt2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function refreshMomaUI() {
    elUnitLabel.textContent = session.unit === "m" ? "M" : "IN";
    elDistanceUnit.textContent = session.unit === "m" ? "m" : "yd";

    // show defaults
    elDistance.value = session.unit === "m"
      ? fmt2(session.distanceYds * 0.9144) // yd -> m
      : fmt2(session.distanceYds);

    elClick.value = fmt2(session.moaPerClick);
  }

  elUnitToggle.addEventListener("change", () => {
    session.unit = elUnitToggle.checked ? "m" : "in";
    refreshMomaUI();
    clearSec(); // per your rule: session-only display; clearing resets later
  });

  elApply.addEventListener("click", () => {
    // parse distance
    const d = Number(elDistance.value);
    const c = Number(elClick.value);

    if (Number.isFinite(d) && d > 0) {
      session.distanceYds = session.unit === "m" ? (d / 0.9144) : d;
    }
    if (Number.isFinite(c) && c > 0) {
      session.moaPerClick = c;
    }

    setInstruction(
      `Updated: ${session.unit === "m" ? fmt2(session.distanceYds * 0.9144) + " m" : fmt2(session.distanceYds) + " yd"} • ${fmt2(session.moaPerClick)} MOA/click`
    );
    clearSec();
  });

  refreshMomaUI();

  // ------------------------------------------------------------
  // Show Results (placeholder SEC — we’ll wire bull + inches math next)
  // ------------------------------------------------------------
  elResults.addEventListener("click", () => {
    if (!imageLoaded) {
      setInstruction("Upload a target photo first.");
      return;
    }
    if (taps.length < 2) {
      setInstruction("Tap bull first, then tap at least one hit.");
      return;
    }

    // For now, just prove SEC renders and values are session-correct.
    const unitShown = session.unit === "m" ? "m" : "in";
    const distShown = session.unit === "m"
      ? fmt2(session.distanceYds * 0.9144)
      : fmt2(session.distanceYds);

    elSec.innerHTML = `
      <div style="
        background: rgba(0,0,0,0.25);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 16px;
        padding: 12px;
      ">
        <div style="font-weight:900; letter-spacing:0.2px; margin-bottom:8px;">Shooter Experience Card</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
          <div style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.06); font-weight:900;">True MOA</div>
          <div style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.06); font-weight:900;">${distShown} ${session.unit === "m" ? "m" : "yd"}</div>
          <div style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.06); font-weight:900;">${fmt2(session.moaPerClick)} MOA/click</div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
            <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">Verified Hits</div>
            <div style="font-size:26px; font-weight:900;">${taps.length - 1}</div>
          </div>
          <div style="padding:10px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
            <div style="color:rgba(255,255,255,0.65); font-weight:800; font-size:12px;">Units</div>
            <div style="font-size:26px; font-weight:900;">${unitShown.toUpperCase()}</div>
          </div>
        </div>

        <div style="margin-top:10px; color:rgba(255,255,255,0.60); font-weight:800; font-size:12px;">
          Next: we lock the 1" grid (px/in), compute POIB + correction in inches, then MOA + clicks with correct directions.
        </div>
      </div>
    `;

    setInstruction("SEC rendered. Next brick: bull + 1-inch grid lock → real inches math.");
  });

  // Initial instruction
  setInstruction("Upload your Baker 23×35 1-inch grid target photo to begin.");
})();
