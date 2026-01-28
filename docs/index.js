Got you — full replacements only from here forward in this chat.

docs/index.js (FULL REPLACEMENT) — now includes Grid Lock (one-shot sacred ruler)

Paste this over your entire docs/index.js:

/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Baker 23×35 1" Grid Pilot
   Includes:
   - GRID LOCK (sacred ruler): detect once per photo, then lock
     Only unlocks on: NEW UPLOAD or CLEAR
   - MOMA top-right only (IN⇄M toggle + Distance + Click MOA + Update)
   - LIVE MOMA behavior (toggle converts instantly; blur/Enter applies)
   - Session-only metric toggle (resets on Clear + New Upload)
   - 1" grid detect (px per inch) from photo
   - Real inches math (True MOA @ distance, default 100y, 0.25 MOA/click)
   - Canonical directions:
       ΔX = bullX − POIBx  (+ RIGHT, − LEFT)
       ΔY = bullY − POIBy  (+ UP,    − DOWN)
   - 2-finger pinch/zoom + pan
   - 1-finger tap bull then hits (NO-JUMP taps)
   - Dots: locked 10px, colored filled markers
   - SEC compact + expandable (NO MOMA duplication)
   - Baker buttons: Catalog + Product links + landing selection via:
       ?baker=catalog
       ?baker=product
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ----- DOM (must exist in docs/index.html)
  const elFile = $("photoInput");
  const uploadBtn = $("uploadBtn");
  const viewport = $("targetWrap");
  const img = $("targetImg");
  const dotsLayer = $("dotsLayer");

  const tapCountEl = $("tapCount");
  const undoBtn = $("undoTapsBtn");
  const clearBtn = $("clearTapsBtn");
  const showBtn = $("showResultsBtn");
  const instructionLine = $("instructionLine");

  const secPanel = $("secPanel");

  // Baker buttons
  const bakerCatalogBtn = $("bakerCatalogBtn");
  const bakerProductBtn = $("bakerProductBtn");

  // Legacy single link (safe if missing)
  const vendorLink = $("vendorLink");

  // MOMA
  const unitToggle = $("unitToggle");
  const unitLabel = $("unitLabel");
  const distanceInput = $("distanceInput");
  const clickInput = $("clickInput");
  const distanceUnit = $("distanceUnit");
  const momaApplyBtn = $("momaApplyBtn");

  // ----- Inject dot styles (LOCKED 10px, filled colored markers)
  const DOT_PX = 10; // locked dot size
  const style = document.createElement("style");
  style.textContent = `
    .dot{
      position:absolute;
      width:${DOT_PX}px;
      height:${DOT_PX}px;
      border-radius:999px;
      transform: translate(-50%, -50%);
      pointer-events:none;
      will-change: transform;
    }
    .dot::before{
      content:"";
      position:absolute;
      inset:-2px;
      border-radius:999px;
      border: 1.5px solid rgba(255,255,255,0.55);
      box-shadow: 0 8px 18px rgba(0,0,0,0.55);
    }
    .dot::after{
      content:"";
      position:absolute;
      inset:0;
      border-radius:999px;
      background: rgba(255,255,255,0.85);
      opacity: 0.18;
      mix-blend-mode: screen;
    }
    .dot.bull{
      background: rgba(255, 165, 0, 0.98);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.35),
        0 10px 22px rgba(0,0,0,0.55),
        0 0 14px rgba(255,165,0,0.50);
    }
    .dot.bull::before{ border-color: rgba(255,255,255,0.70); }
    .dot.hit{
      background: rgba(0, 170, 255, 0.98);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.35),
        0 10px 22px rgba(0,0,0,0.55),
        0 0 14px rgba(0,170,255,0.50);
    }
    .dot.hit::before{ border-color: rgba(255,255,255,0.65); }
  `;
  document.head.appendChild(style);

  // ----- Constants
  const TRUE_MOA_IN_PER_100Y = 1.047;
  const IN_PER_METER = 39.37007874015748;
  const YARDS_PER_METER = 1.0936132983377078;

  const fmt2 = (n) => Number(n).toFixed(2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampNum = (n, fallback = 0) => {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  };

  // ----- Session (pilot defaults)
  const session = {
    unit: "in",          // "in" | "m" (display only)
    distanceYds: 100,    // pilot standard
    clickMoa: 0.25,      // pilot standard
    isTrueMoa: true,     // pilot uses True MOA
  };

  function resetSessionToPilotDefaults() {
    session.unit = "in";
    session.distanceYds = 100;
    session.clickMoa = 0.25;
    session.isTrueMoa = true;
  }

  function inchesToSessionUnits(inches) {
    return session.unit === "m" ? (inches / IN_PER_METER) : inches;
  }

  function inchesPerMoaAtDistance() {
    return TRUE_MOA_IN_PER_100Y * (session.distanceYds / 100);
  }

  function directionsFromDelta(dxIn, dyIn) {
    const horiz = dxIn > 0 ? "RIGHT" : dxIn < 0 ? "LEFT" : "—";
    const vert  = dyIn > 0 ? "UP"    : dyIn < 0 ? "DOWN" : "—";
    return { horiz, vert };
  }

  // ----- State
  let objectUrl = null;

  // image-local taps (pixels)
  let bullPx = null;
  let hitsPx = [];

  // view transform
  let scale = 1;
  let tx = 0;
  let ty = 0;
  const MIN_SCALE = 1;
  const MAX_SCALE = 6;

  // grid detection result (px per 1 inch)
  let pxPerInchX = null;
  let pxPerInchY = null;

  // ----- GRID LOCK (sacred ruler: detect once per photo)
  let gridLocked = false;

  function lockGrid() {
    gridLocked = true;
  }

  function unlockGrid() {
    gridLocked = false;
    pxPerInchX = null;
    pxPerInchY = null;
  }

  // results cache
  let lastResult = null;

  // ----- Baker URLs (EDIT these when you have exact pages)
  const BAKER_URLS = {
    catalog: "https://bakertargets.com",
    product: "https://bakertargets.com",
  };

  function getQueryParam(name) {
    try {
      const url = new URL(window.location.href);
      return (url.searchParams.get(name) || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  function highlightBtn(el) {
    if (!el) return;
    el.style.outline = "2px solid rgba(255,255,255,0.35)";
    el.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.08), 0 18px 40px rgba(0,0,0,0.45)";
    el.style.background = "rgba(255,255,255,0.09)";
  }

  function clearBtnHighlight(el) {
    if (!el) return;
    el.style.outline = "";
    el.style.boxShadow = "";
    el.style.background = "";
  }

  function applyBakerLandingSelection() {
    const sel = getQueryParam("baker"); // "catalog" | "product" | ""
    clearBtnHighlight(bakerCatalogBtn);
    clearBtnHighlight(bakerProductBtn);

    if (sel === "catalog") highlightBtn(bakerCatalogBtn);
    else if (sel === "product") highlightBtn(bakerProductBtn);
  }

  function wireVendor() {
    // Hide legacy single vendor link if present
    if (vendorLink) vendorLink.style.display = "none";

    if (bakerCatalogBtn) {
      bakerCatalogBtn.href = BAKER_URLS.catalog;
      bakerCatalogBtn.target = "_blank";
      bakerCatalogBtn.rel = "noopener";
    }

    if (bakerProductBtn) {
      bakerProductBtn.href = BAKER_URLS.product;
      bakerProductBtn.target = "_blank";
      bakerProductBtn.rel = "noopener";
    }

    applyBakerLandingSelection();
  }

  // ----- Transform apply
  let rafPending = false;
  function applyTransform() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const t = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      img.style.transform = t;
      dotsLayer.style.transform = t;
    });
  }

  function resetView() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
  }

  // ----- Coordinate helpers
  function getViewportPointFromClient(clientX, clientY) {
    const r = viewport.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, r };
  }

  function viewportToImageLocal(pt) {
    return { x: (pt.x - tx) / scale, y: (pt.y - ty) / scale };
  }

  // ----- Dots
  function addDot(kind, pt) {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${pt.x}px`;
    d.style.top = `${pt.y}px`;
    dotsLayer.appendChild(d);
  }

  function renderDots() {
    dotsLayer.innerHTML = "";
    if (bullPx) addDot("bull", bullPx);
    for (const h of hitsPx) addDot("hit", h);
  }

  // ----- UI state
  function setUi() {
    const totalTaps = (bullPx ? 1 : 0) + hitsPx.length;
    tapCountEl.textContent = String(totalTaps);

    undoBtn.disabled = totalTaps === 0;
    clearBtn.disabled = totalTaps === 0;

    const gridReady = !!(pxPerInchX && pxPerInchY && gridLocked);
    showBtn.disabled = !(bullPx && hitsPx.length > 0 && gridReady);

    if (!img.src) {
      instructionLine.textContent = "Upload your Baker 23×35 1-inch grid target photo to begin.";
      return;
    }
    if (!gridReady) {
      instructionLine.textContent =
        "Photo loaded. Detecting 1-inch grid… (Tip: keep photo straight & full-frame)";
      return;
    }
    if (!bullPx) {
      instructionLine.textContent = "Grid locked. Tap the bull once. (2 fingers: zoom/pan)";
      return;
    }
    instructionLine.textContent = "Grid locked. Tap bullet holes. Then press Show Results.";
  }

  // ----- Grid spacing detection (px per 1 inch) — SACRED + ONE-SHOT
  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return (a.length % 2) ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function diffsSorted(peaks) {
    const d = [];
    for (let i = 1; i < peaks.length; i++) {
      const dx = peaks[i] - peaks[i - 1];
      if (dx > 4) d.push(dx);
    }
    return d;
  }

  function findPeaks(signal, threshold) {
    const peaks = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > threshold && signal[i] >= signal[i - 1] && signal[i] >= signal[i + 1]) {
        peaks.push(i);
      }
    }
    const thinned = [];
    const minSep = 6;
    for (const p of peaks) {
      if (!thinned.length || (p - thinned[thinned.length - 1]) >= minSep) thinned.push(p);
    }
    return thinned;
  }

  function detectGridSpacing() {
    // If already locked, never re-run
    if (gridLocked && pxPerInchX && pxPerInchY) return true;

    // Fresh attempt state
    pxPerInchX = null;
    pxPerInchY = null;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return false;

    // downscale for speed
    const maxW = 1200;
    const scaleDown = Math.min(1, maxW / w);
    const cw = Math.round(w * scaleDown);
    const ch = Math.round(h * scaleDown);

    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cw, ch);

    function scanHorizontal(y) {
      const data = ctx.getImageData(0, y, cw, 1).data;
      const edge = new Float32Array(cw);
      for (let x = 1; x < cw - 1; x++) {
        const iL = (x - 1) * 4;
        const iR = (x + 1) * 4;
        const gL = (data[iL] + data[iL + 1] + data[iL + 2]) / 3;
        const gR = (data[iR] + data[iR + 1] + data[iR + 2]) / 3;
        edge[x] = Math.abs(gR - gL);
      }
      return edge;
    }

    function scanVertical(x) {
      const data = ctx.getImageData(x, 0, 1, ch).data;
      const edge = new Float32Array(ch);
      for (let y = 1; y < ch - 1; y++) {
        const iU = (y - 1) * 4;
        const iD = (y + 1) * 4;
        const gU = (data[iU] + data[iU + 1] + data[iU + 2]) / 3;
        const gD = (data[iD] + data[iD + 1] + data[iD + 2]) / 3;
        edge[y] = Math.abs(gD - gU);
      }
      return edge;
    }

    const ys = [Math.round(ch * 0.20), Math.round(ch * 0.30), Math.round(ch * 0.75)];
    const xs = [Math.round(cw * 0.20), Math.round(cw * 0.50), Math.round(cw * 0.80)];

    const spacingsX = [];
    for (const y of ys) {
      const edge = scanHorizontal(y);
      let max = 0;
      for (let i = 0; i < edge.length; i++) if (edge[i] > max) max = edge[i];
      const th = max * 0.55;
      const peaks = findPeaks(edge, th);
      const diffs = diffsSorted(peaks);
      for (const d of diffs) if (d >= 12 && d <= 120) spacingsX.push(d);
    }

    const spacingsY = [];
    for (const x of xs) {
      const edge = scanVertical(x);
      let max = 0;
      for (let i = 0; i < edge.length; i++) if (edge[i] > max) max = edge[i];
      const th = max * 0.55;
      const peaks = findPeaks(edge, th);
      const diffs = diffsSorted(peaks);
      for (const d of diffs) if (d >= 12 && d <= 120) spacingsY.push(d);
    }

    const medX = median(spacingsX);
    const medY = median(spacingsY);
    if (!medX || !medY) return false;

    pxPerInchX = medX / scaleDown;
    pxPerInchY = medY / scaleDown;

    // LOCK ON SUCCESS — sacred ruler
    lockGrid();
    return true;
  }

  // ----- Compute POIB & results
  function meanPoint(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }

  function computeResult() {
    const poibPx = meanPoint(hitsPx);

    const bullInX = bullPx.x / pxPerInchX;
    const bullInY = bullPx.y / pxPerInchY;
    const poibInX = poibPx.x / pxPerInchX;
    const poibInY = poibPx.y / pxPerInchY;

    // Canonical correction vector (Bull − POIB)
    const dxIn = bullInX - poibInX;
    const dyIn = bullInY - poibInY;

    const { horiz, vert } = directionsFromDelta(dxIn, dyIn);

    // True MOA conversion
    const inPerMoa = inchesPerMoaAtDistance();
    const moaX = Math.abs(dxIn) / inPerMoa;
    const moaY = Math.abs(dyIn) / inPerMoa;

    const clicksX = moaX / session.clickMoa;
    const clicksY = moaY / session.clickMoa;

    const poibRelInX = poibInX - bullInX; // POIB − Bull (signed)
    const poibRelInY = poibInY - bullInY;

    return {
      hits: hitsPx.length,
      poibPx,
      dxIn, dyIn,
      poibRelInX, poibRelInY,
      horiz, vert,
      moaX, moaY,
      clicksX, clicksY,
      unit: session.unit,
      pxPerInchX, pxPerInchY,
      gridLocked,
    };
  }

  // ----- SEC (compact + expandable) — NO MOMA duplication
  let secExpanded = false;

  function renderSEC(result) {
    const unitLabelLocal = (result.unit === "m") ? "m" : "in";

    const dxDisp = inchesToSessionUnits(result.dxIn);
    const dyDisp = inchesToSessionUnits(result.dyIn);
    const poibRelXDisp = inchesToSessionUnits(result.poibRelInX);
    const poibRelYDisp = inchesToSessionUnits(result.poibRelInY);

    const score = result.hits;

    secPanel.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:3px; min-width:0;">
          <div style="display:flex; align-items:baseline; gap:10px; flex-wrap:wrap;">
            <div style="font-weight:900; letter-spacing:0.4px;">SEC</div>
            <div style="font-size:12px; opacity:0.78;">
              Score: <span style="font-weight:900; opacity:0.98;">${score}</span>
              <span style="opacity:0.55;">•</span>
              Hits: <span style="font-weight:900; opacity:0.98;">${result.hits}</span>
            </div>
          </div>

          <div style="font-weight:900; font-size:15px; line-height:1.25; word-break:break-word;">
            ${result.horiz} • ${result.vert}
            <span style="opacity:0.65; font-weight:900;"> | </span>
            X ${fmt2(result.clicksX)} • Y ${fmt2(result.clicksY)}
            <span style="opacity:0.70; font-weight:900;"> clicks</span>
          </div>
        </div>

        <button id="secToggleBtn" class="btn" type="button"
          style="height:34px; padding:0 12px; border-radius:12px; font-size:12px; white-space:nowrap;">
          ${secExpanded ? "Less" : "More"}
        </button>
      </div>

      <div id="secBody" style="margin-top:10px; display:${secExpanded ? "block" : "none"};">
        <div style="display:grid; grid-template-columns: 1fr; gap:10px;">

          <div style="padding:10px 12px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03);">
            <div style="font-size:12px; opacity:0.70; font-weight:900;">Correction (Bull − POIB)</div>
            <div style="margin-top:6px; font-size:13px; opacity:0.92;">
              ΔX ${fmt2(dxDisp)} ${unitLabelLocal} • ΔY ${fmt2(dyDisp)} ${unitLabelLocal}
            </div>
          </div>

          <div style="padding:10px 12px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03);">
            <div style="font-size:12px; opacity:0.70; font-weight:900;">POIB Offset (POIB − Bull)</div>
            <div style="margin-top:6px; font-size:13px; opacity:0.92;">
              X ${fmt2(poibRelXDisp)} ${unitLabelLocal} • Y ${fmt2(poibRelYDisp)} ${unitLabelLocal}
            </div>
          </div>

          <div style="padding:10px 12px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03);">
            <div style="font-size:12px; opacity:0.70; font-weight:900;">Grid</div>
            <div style="margin-top:6px; font-size:12px; opacity:0.72;">
              Locked: ${result.gridLocked ? "YES" : "NO"} • ${fmt2(result.pxPerInchX)} px/in (X) • ${fmt2(result.pxPerInchY)} px/in (Y)
            </div>
          </div>

        </div>
      </div>
    `;

    const toggleBtn = $("secToggleBtn");
    toggleBtn.addEventListener("click", () => {
      secExpanded = !secExpanded;
      if (lastResult) renderSEC(lastResult);
    });
  }

  function clearSEC() {
    lastResult = null;
    secPanel.innerHTML = "";
  }

  // ============================================================
  // MOMA WIRING (LIVE + IN⇄M CONVERT)
  // ============================================================

  function syncMomaUIFromSession() {
    const isMetric = session.unit === "m";

    unitToggle.checked = isMetric;
    unitLabel.textContent = isMetric ? "M" : "IN";
    distanceUnit.textContent = isMetric ? "m" : "yd";

    distanceInput.value = isMetric
      ? fmt2(session.distanceYds / YARDS_PER_METER) // show meters
      : fmt2(session.distanceYds);                 // show yards

    clickInput.value = fmt2(session.clickMoa);
  }

  function normalizeAndApplyMomaFromUI() {
    const wantsMetric = !!unitToggle.checked;

    session.unit = wantsMetric ? "m" : "in";
    unitLabel.textContent = wantsMetric ? "M" : "IN";
    distanceUnit.textContent = wantsMetric ? "m" : "yd";

    const distRaw = (distanceInput.value || "").trim();
    const distFallback = wantsMetric ? (100 / YARDS_PER_METER) : 100;
    const distNum = clampNum(distRaw, distFallback);

    session.distanceYds = wantsMetric ? (distNum * YARDS_PER_METER) : distNum;
    if (session.distanceYds <= 0) session.distanceYds = 100;

    const clickRaw = (clickInput.value || "").trim();
    const clickNum = clampNum(clickRaw, 0.25);
    session.clickMoa = (clickNum > 0) ? clickNum : 0.25;

    syncMomaUIFromSession();

    if (bullPx && hitsPx.length > 0 && pxPerInchX && pxPerInchY && gridLocked) {
      lastResult = computeResult();
      renderSEC(lastResult);
    }
  }

  function convertDistanceFieldOnUnitFlip() {
    const currentlyMetric = session.unit === "m";
    const nextMetric = !!unitToggle.checked;
    if (currentlyMetric === nextMetric) return;

    const raw = (distanceInput.value || "").trim();
    let val = clampNum(raw, currentlyMetric ? (100 / YARDS_PER_METER) : 100);

    if (!currentlyMetric && nextMetric) {
      val = val / YARDS_PER_METER; // yards -> meters
    } else if (currentlyMetric && !nextMetric) {
      val = val * YARDS_PER_METER; // meters -> yards
    }

    distanceInput.value = fmt2(val);
    normalizeAndApplyMomaFromUI();
  }

  unitToggle.addEventListener("change", convertDistanceFieldOnUnitFlip);
  momaApplyBtn.addEventListener("click", normalizeAndApplyMomaFromUI);

  distanceInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      normalizeAndApplyMomaFromUI();
      distanceInput.blur();
    }
  });
  clickInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      normalizeAndApplyMomaFromUI();
      clickInput.blur();
    }
  });

  distanceInput.addEventListener("blur", normalizeAndApplyMomaFromUI);
  clickInput.addEventListener("blur", normalizeAndApplyMomaFromUI);

  // ----- Upload handling
  uploadBtn.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    // NEW PHOTO: unlock grid + reset session + clear taps
    unlockGrid();
    resetSessionToPilotDefaults();
    syncMomaUIFromSession();

    bullPx = null;
    hitsPx = [];
    renderDots();
    clearSEC();
    resetView();

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      resetView();
      const ok = detectGridSpacing(); // locks on success
      setUi();
      if (!ok) {
        unlockGrid();
        instructionLine.textContent =
          "Grid not detected. Re-take photo: straight, full-frame, clear grid lines.";
      }
    };

    img.src = objectUrl;
    setUi();
  });

  // ----- Undo / Clear / Show
  undoBtn.addEventListener("click", () => {
    if (hitsPx.length > 0) hitsPx.pop();
    else bullPx = null;

    renderDots();
    clearSEC();
    setUi();
  });

  clearBtn.addEventListener("click", () => {
    // CLEAR = cancel session: unlock grid + reset everything
    bullPx = null;
    hitsPx = [];
    renderDots();
    clearSEC();

    unlockGrid();
    resetSessionToPilotDefaults();
    syncMomaUIFromSession();

    setUi();
  });

  showBtn.addEventListener("click", () => {
    if (!(bullPx && hitsPx.length > 0 && pxPerInchX && pxPerInchY && gridLocked)) return;
    lastResult = computeResult();
    secExpanded = false; // compact by default
    renderSEC(lastResult);
  });

  // ----- Gestures (NO-JUMP TAPS)
  ["gesturestart", "gesturechange", "gestureend"].forEach((evt) => {
    viewport.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });

  let mode = "none"; // "tap" | "pan" | "pinch"
  let panStart = null;
  let pinchStart = null;

  function tDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }
  function tMid(t1, t2) {
    const r = viewport.getBoundingClientRect();
    return {
      x: ((t1.clientX + t2.clientX) / 2) - r.left,
      y: ((t1.clientY + t2.clientY) / 2) - r.top,
      r
    };
  }

  const TAP_SLOP = 10;   // still tap
  const PAN_START = 14;  // intentional drag becomes pan
  let downPt = null;
  let lastTapTime = 0;

  function clampPan() {
    const r = viewport.getBoundingClientRect();
    const slack = 120;

    const baseW = r.width;
    const baseH = r.height;

    const minTx = -(baseW * (scale - 1)) - slack;
    const maxTx = slack;
    const minTy = -(baseH * (scale - 1)) - slack;
    const maxTy = slack;

    tx = clamp(tx, minTx, maxTx);
    ty = clamp(ty, minTy, maxTy);
  }

  viewport.addEventListener("touchstart", (e) => {
    if (!img.src) return;
    e.preventDefault();

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);

      mode = "tap";
      downPt = pt;
      panStart = { x: pt.x, y: pt.y, tx, ty };
      pinchStart = null;
      return;
    }

    if (e.touches.length === 2) {
      mode = "pinch";
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const m = tMid(t1, t2);

      pinchStart = {
        dist: tDist(t1, t2),
        midX: m.x,
        midY: m.y,
        scale,
        tx,
        ty
      };

      downPt = null;
      panStart = null;
    }
  }, { passive: false });

  viewport.addEventListener("touchmove", (e) => {
    if (!img.src) return;
    e.preventDefault();

    if (mode === "pinch" && e.touches.length === 2 && pinchStart) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const m = tMid(t1, t2);
      const d = tDist(t1, t2);

      const nextScale = clamp(pinchStart.scale * (d / pinchStart.dist), MIN_SCALE, MAX_SCALE);

      const imgLocalAtStartMid = {
        x: (pinchStart.midX - pinchStart.tx) / pinchStart.scale,
        y: (pinchStart.midY - pinchStart.ty) / pinchStart.scale
      };

      scale = nextScale;
      tx = m.x - imgLocalAtStartMid.x * scale;
      ty = m.y - imgLocalAtStartMid.y * scale;

      clampPan();
      applyTransform();
      return;
    }

    if (e.touches.length === 1 && panStart) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);

      const moved = downPt ? Math.hypot(pt.x - downPt.x, pt.y - downPt.y) : 999;
      if (mode === "tap" && moved >= PAN_START) mode = "pan";

      if (mode === "pan") {
        tx = panStart.tx + (pt.x - panStart.x);
        ty = panStart.ty + (pt.y - panStart.y);
        clampPan();
        applyTransform();
      }
    }
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (!img.src) return;
    e.preventDefault();

    if (mode === "tap" && e.changedTouches.length === 1 && downPt) {
      const t = e.changedTouches[0];
      const upPt = getViewportPointFromClient(t.clientX, t.clientY);
      const moved = Math.hypot(upPt.x - downPt.x, upPt.y - downPt.y);

      if (moved <= TAP_SLOP) {
        const now = Date.now();
        if (now - lastTapTime < 300) {
          resetView();
          lastTapTime = 0;
        } else {
          lastTapTime = now;

          const imgLocal = viewportToImageLocal(upPt);
          if (!Number.isFinite(imgLocal.x) || !Number.isFinite(imgLocal.y)) return;

          if (!bullPx) bullPx = imgLocal;
          else hitsPx.push(imgLocal);

          renderDots();
          clearSEC();
          setUi();
        }
      }
    }

    if (e.touches.length === 0) {
      mode = "none";
      panStart = null;
      pinchStart = null;
      downPt = null;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);
      mode = "tap";
      downPt = pt;
      panStart = { x: pt.x, y: pt.y, tx, ty };
      pinchStart = null;
    }
  }, { passive: false });

  // ----- Init
  wireVendor();
  resetSessionToPilotDefaults();
  syncMomaUIFromSession();
  setUi();
})();

What to test right now (30 seconds)
	1.	Upload photo → wait for “Grid locked” instruction line
	2.	Pinch/zoom/pan → should stay smooth
	3.	Tap bull + 3 holes → Show Results
	4.	Toggle IN→M → SEC numbers should convert (grid stays locked)
	5.	Hit Clear → grid unlocks (back to “detecting” next upload)

Say Next and tell me what’s still feeling “not smooth” (pinch, taps, or load), and I’ll do the next full replacement to optimize that path.
