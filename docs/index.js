/* ============================================================
   docs/index.js  (FULL REPLACEMENT) — Baker 23×35 1" Grid Pilot
   Fixes / Guarantees:
   - Direction correctness: Top = UP, Right = RIGHT (no flips)
   - 2-decimal outputs everywhere
   - Requires Grid Lock calibration before Show Results
   - Default: 100.00 yds, 0.25 MOA/click
   - Bullet taps happen after: Bull + GridLock (4 taps)
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Required DOM
  const elFile = $("photoInput");
  const elWrap = $("targetWrap");
  const elImg = $("targetImg");
  const elDots = $("dotsLayer");
  const elTapCount = $("tapCount");
  const elUndo = $("undoTapsBtn");
  const elClear = $("clearTapsBtn");
  const elResults = $("showResultsBtn");
  const elInstruction = $("instructionLine");
  const elSec = $("secPanel");

  const elUnitToggle = $("unitToggle");
  const elUnitLabel = $("unitLabel");
  const elDist = $("distanceInput");
  const elDistUnit = $("distanceUnit");
  const elClick = $("clickInput");
  const elApply = $("momaApplyBtn");

  const elCatalog = $("bakerCatalogBtn");
  const elProduct = $("bakerProductBtn");

  // ---- Constants
  const TRUE_MOA_IN_PER_100Y = 1.047; // True MOA
  const YARDS_PER_METER = 1.0936132983;
  const CM_PER_INCH = 2.54;

  const DEFAULT_DISTANCE_YDS = 100.0;
  const DEFAULT_CLICK_MOA = 0.25;

  // ---- State
  let objectUrl = null;
  let imgNaturalW = 0;
  let imgNaturalH = 0;

  // View transform (image space -> screen space)
  let view = {
    scale: 1,
    minScale: 1,
    maxScale: 6,
    tx: 0,
    ty: 0,
  };

  // Session settings (per run; reset on Clear/New photo)
  let session = {
    unitSystem: "in",   // "in" or "metric" (metric shows cm + meters, still computes MOA internally)
    distanceYds: DEFAULT_DISTANCE_YDS,
    clickMoa: DEFAULT_CLICK_MOA
  };

  // Tap workflow:
  // 0: need photo
  // 1: tap bull
  // 2: grid X-A
  // 3: grid X-B (1" right of A)
  // 4: grid Y-A
  // 5: grid Y-B (1" down of Y-A)
  // 6+: bullet taps
  let step = 0;

  let bull = null;              // {x,y} image px
  let grid = {
    locked: false,
    pxPerInchX: null,
    pxPerInchY: null,
    xA: null,
    xB: null,
    yA: null,
    yB: null
  };

  let shots = [];               // array of {x,y} image px

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
  const toNum = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function setTapCount() {
    if (elTapCount) elTapCount.textContent = String(shots.length);
  }

  function setButtonsEnabled() {
    const ok = !!(bull && grid.locked && shots.length > 0);
    elResults.disabled = !ok;
    elResults.style.opacity = ok ? "1" : "0.55";
  }

  function resetSessionOnClear() {
    session.unitSystem = "in";
    session.distanceYds = DEFAULT_DISTANCE_YDS;
    session.clickMoa = DEFAULT_CLICK_MOA;

    if (elUnitToggle) elUnitToggle.checked = false;
    syncUnitUI();

    if (elDist) elDist.value = f2(session.distanceYds);
    if (elClick) elClick.value = f2(session.clickMoa);
  }

  function clearAll(keepPhoto = true) {
    bull = null;
    shots = [];
    grid.locked = false;
    grid.pxPerInchX = null;
    grid.pxPerInchY = null;
    grid.xA = grid.xB = grid.yA = grid.yB = null;

    step = keepPhoto ? 1 : 0;
    setTapCount();
    elSec.innerHTML = "";
    renderDots();
    setButtonsEnabled();

    if (keepPhoto) {
      setInstruction(`Step 1: Tap the bull center (aim point).`);
    } else {
      setInstruction(`Upload your Baker 23×35 1-inch grid target photo to begin.`);
    }
  }

  function syncUnitUI() {
    const isMetric = session.unitSystem === "metric";
    if (elUnitLabel) elUnitLabel.textContent = isMetric ? "M" : "IN";
    if (elDistUnit) elDistUnit.textContent = isMetric ? "m" : "yd";

    // Keep input showing correct unit
    if (elDist) {
      if (isMetric) {
        const meters = session.distanceYds / YARDS_PER_METER;
        elDist.value = f2(meters);
      } else {
        elDist.value = f2(session.distanceYds);
      }
    }
  }

  function applyMoma() {
    const isMetric = !!(elUnitToggle && elUnitToggle.checked);
    session.unitSystem = isMetric ? "metric" : "in";

    const distRaw = toNum(elDist?.value, isMetric ? (DEFAULT_DISTANCE_YDS / YARDS_PER_METER) : DEFAULT_DISTANCE_YDS);
    session.distanceYds = isMetric ? (distRaw * YARDS_PER_METER) : distRaw;

    const clickRaw = toNum(elClick?.value, DEFAULT_CLICK_MOA);
    session.clickMoa = clickRaw;

    syncUnitUI();
    // Only messaging; computations update when Show Results is pressed
    if (grid.locked) {
      setInstruction(`Ready: Tap bullet holes, then press Show Results.`);
    } else if (step >= 2) {
      setInstruction(`Grid Lock required: complete the 1-inch X + Y calibration taps.`);
    }
  }

  // ------------------------------------------------------------
  // Image load + view transform
  // ------------------------------------------------------------
  function fitImageToWrap() {
    const rw = elWrap.clientWidth;
    const rh = elWrap.clientHeight;
    if (!imgNaturalW || !imgNaturalH || !rw || !rh) return;

    const s = Math.min(rw / imgNaturalW, rh / imgNaturalH);
    view.scale = s;
    view.minScale = s;
    view.maxScale = Math.max(4, s * 6);

    // Center
    const imgW = imgNaturalW * view.scale;
    const imgH = imgNaturalH * view.scale;
    view.tx = (rw - imgW) / 2;
    view.ty = (rh - imgH) / 2;

    applyTransform();
  }

  function applyTransform() {
    const t = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    elImg.style.transform = t;
    // Dots layer is in WRAP space; we redraw dots using view transform
    renderDots();
  }

  function wrapPointToImagePoint(px, py) {
    // Invert transform: image = (wrap - translate) / scale
    return {
      x: (px - view.tx) / view.scale,
      y: (py - view.ty) / view.scale
    };
  }

  function imagePointToWrapPoint(ix, iy) {
    return {
      x: ix * view.scale + view.tx,
      y: iy * view.scale + view.ty
    };
  }

  // ------------------------------------------------------------
  // Dots rendering (in WRAP overlay coords)
  // ------------------------------------------------------------
  function renderDots() {
    if (!elDots) return;
    elDots.innerHTML = "";

    // Bull
    if (bull) {
      const p = imagePointToWrapPoint(bull.x, bull.y);
      elDots.appendChild(makeDot(p.x, p.y, "B", "rgba(0,150,255,0.9)", 10));
    }

    // Grid cal points
    const calPoints = [
      grid.xA && { p: grid.xA, label: "XA", color: "rgba(255,215,0,0.9)" },
      grid.xB && { p: grid.xB, label: "XB", color: "rgba(255,215,0,0.9)" },
      grid.yA && { p: grid.yA, label: "YA", color: "rgba(255,215,0,0.9)" },
      grid.yB && { p: grid.yB, label: "YB", color: "rgba(255,215,0,0.9)" },
    ].filter(Boolean);

    calPoints.forEach((c) => {
      const p = imagePointToWrapPoint(c.p.x, c.p.y);
      elDots.appendChild(makeDot(p.x, p.y, "", c.color, 9));
    });

    // Shots (numbered)
    shots.forEach((s, i) => {
      const p = imagePointToWrapPoint(s.x, s.y);
      elDots.appendChild(makeDot(p.x, p.y, String(i + 1), "rgba(255,0,0,0.85)", 10));
    });
  }

  function makeDot(x, y, text, color, sizePx) {
    const d = document.createElement("div");
    d.style.position = "absolute";
    d.style.left = `${x - sizePx / 2}px`;
    d.style.top = `${y - sizePx / 2}px`;
    d.style.width = `${sizePx}px`;
    d.style.height = `${sizePx}px`;
    d.style.borderRadius = "999px";
    d.style.background = "rgba(0,0,0,0.20)";
    d.style.border = `2px solid ${color}`;
    d.style.boxShadow = "0 8px 18px rgba(0,0,0,0.35)";
    d.style.display = "flex";
    d.style.alignItems = "center";
    d.style.justifyContent = "center";
    d.style.fontSize = "10px";
    d.style.fontWeight = "900";
    d.style.color = "rgba(255,255,255,0.92)";
    d.style.pointerEvents = "none";
    if (text) d.textContent = text;
    return d;
  }

  // ------------------------------------------------------------
  // Grid Lock computation
  // ------------------------------------------------------------
  function tryLockGrid() {
    if (!grid.xA || !grid.xB || !grid.yA || !grid.yB) return false;

    const dx = Math.abs(grid.xB.x - grid.xA.x);
    const dy = Math.abs(grid.yB.y - grid.yA.y);

    // Must be non-zero
    if (dx < 2 || dy < 2) return false;

    grid.pxPerInchX = dx; // exactly 1 inch apart in X
    grid.pxPerInchY = dy; // exactly 1 inch apart in Y
    grid.locked = true;

    setInstruction(`Grid Lock: ON — Now tap bullet holes, then press Show Results.`);
    setButtonsEnabled();
    return true;
  }

  // ------------------------------------------------------------
  // Results / SEC
  // ------------------------------------------------------------
  function computeAndRenderSEC() {
    if (!bull || !grid.locked || shots.length === 0) return;

    const pxInX = grid.pxPerInchX;
    const pxInY = grid.pxPerInchY;

    // POIB in inches, with:
    //   +X = right
    //   +Y = up   (IMPORTANT: screen Y down, so use bullY - shotY)
    let sumX = 0;
    let sumY = 0;

    shots.forEach((s) => {
      const dxIn = (s.x - bull.x) / pxInX;
      const dyInUp = (bull.y - s.y) / pxInY;
      sumX += dxIn;
      sumY += dyInUp;
    });

    const poibX = sumX / shots.length;
    const poibY = sumY / shots.length;

    // Correction vector (Bull - POIB)
    const corrX = -poibX;
    const corrY = -poibY;

    // Directions
    const dirX = corrX > 0.0001 ? "RIGHT" : corrX < -0.0001 ? "LEFT" : "CENTER";
    const dirY = corrY > 0.0001 ? "UP" : corrY < -0.0001 ? "DOWN" : "CENTER";

    // MOA
    const inchesPerMOA = TRUE_MOA_IN_PER_100Y * (session.distanceYds / 100.0);
    const moaX = Math.abs(corrX) / inchesPerMOA;
    const moaY = Math.abs(corrY) / inchesPerMOA;

    // Clicks
    const clicksX = moaX / session.clickMoa;
    const clicksY = moaY / session.clickMoa;

    // Display units for POIB & correction
    const isMetric = session.unitSystem === "metric";
    const poibXDisp = isMetric ? (poibX * CM_PER_INCH) : poibX;
    const poibYDisp = isMetric ? (poibY * CM_PER_INCH) : poibY;
    const corrXDisp = isMetric ? (corrX * CM_PER_INCH) : corrX;
    const corrYDisp = isMetric ? (corrY * CM_PER_INCH) : corrY;
    const uLabel = isMetric ? "cm" : "in";

    // Distance label shown
    const distLabel = isMetric ? `${f2(session.distanceYds / YARDS_PER_METER)} m` : `${f2(session.distanceYds)} yds`;

    // Grid detect note
    const gridNote = `1" grid detected: ${f2(pxInX)} px/in (X) • ${f2(pxInY)} px/in (Y)`;

    // Render SEC (compact)
    elSec.innerHTML = `
      <div style="
        margin-top:12px;
        padding:12px;
        border-radius:18px;
        border:1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
      ">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div style="font-weight:900; letter-spacing:0.2px; font-size:18px;">Shooter Experience Card</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20); font-weight:900;">True MOA</span>
            <span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20); font-weight:900;">${distLabel}</span>
            <span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20); font-weight:900;">${f2(session.clickMoa)} MOA/click</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:12px;">
          <div style="padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20);">
            <div style="color:rgba(255,255,255,0.70); font-weight:800; font-size:12px;">Verified Hits</div>
            <div style="font-weight:900; font-size:28px;">${shots.length}</div>
          </div>

          <div style="padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20);">
            <div style="color:rgba(255,255,255,0.70); font-weight:800; font-size:12px;">POIB (${uLabel})</div>
            <div style="font-weight:900; font-size:22px;">X ${f2(poibXDisp)} • Y ${f2(poibYDisp)}</div>
          </div>

          <div style="padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20);">
            <div style="color:rgba(255,255,255,0.70); font-weight:800; font-size:12px;">Correction (Bull − POIB) (${uLabel})</div>
            <div style="font-weight:900; font-size:22px;">ΔX ${f2(corrXDisp)} • ΔY ${f2(corrYDisp)}</div>
          </div>

          <div style="padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20);">
            <div style="color:rgba(255,255,255,0.70); font-weight:800; font-size:12px;">Directions</div>
            <div style="font-weight:900; font-size:22px;">${dirX}${dirY !== "CENTER" ? " • " + dirY : ""}</div>
          </div>

          <div style="padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20);">
            <div style="color:rgba(255,255,255,0.70); font-weight:800; font-size:12px;">MOA</div>
            <div style="font-weight:900; font-size:22px;">X ${f2(moaX)} • Y ${f2(moaY)}</div>
          </div>

          <div style="padding:12px; border-radius:16px; border:1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.20);">
            <div style="color:rgba(255,255,255,0.70); font-weight:800; font-size:12px;">Clicks</div>
            <div style="font-weight:900; font-size:22px;">X ${f2(clicksX)} • Y ${f2(clicksY)}</div>
          </div>
        </div>

        <div style="margin-top:10px; color:rgba(255,255,255,0.60); font-weight:800; font-size:12px;">
          ${gridNote}
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // Tap handling (single-finger taps; 2-finger pan/zoom)
  // ------------------------------------------------------------
  let gesture = {
    mode: "none",
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startDist: 0,
    startMid: null,
    lastPan: null
  };

  function dist(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function mid(a, b) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function onTouchStart(e) {
    if (!imgNaturalW) return;

    if (e.touches.length === 2) {
      gesture.mode = "pinch";
      gesture.startScale = view.scale;
      gesture.startTx = view.tx;
      gesture.startTy = view.ty;
      gesture.startDist = dist(e.touches[0], e.touches[1]);
      gesture.startMid = mid(e.touches[0], e.touches[1]);
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1) {
      // Potential pan if user drags, but we prioritize taps:
      gesture.mode = "tap";
      gesture.lastPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      // do not preventDefault here; iOS sometimes needs it for clickability
      return;
    }
  }

  function onTouchMove(e) {
    if (!imgNaturalW) return;

    if (gesture.mode === "pinch" && e.touches.length === 2) {
      const d = dist(e.touches[0], e.touches[1]);
      const m = mid(e.touches[0], e.touches[1]);

      const scaleFactor = d / gesture.startDist;
      const newScale = clamp(gesture.startScale * scaleFactor, view.minScale, view.maxScale);

      // Zoom around midpoint
      const before = wrapPointToImagePoint(m.x - elWrap.getBoundingClientRect().left, m.y - elWrap.getBoundingClientRect().top);
      view.scale = newScale;
      const after = before;

      const wrapRect = elWrap.getBoundingClientRect();
      const wrapMidX = m.x - wrapRect.left;
      const wrapMidY = m.y - wrapRect.top;

      view.tx = wrapMidX - after.x * view.scale;
      view.ty = wrapMidY - after.y * view.scale;

      applyTransform();
      e.preventDefault();
      return;
    }

    if (gesture.mode === "tap" && e.touches.length === 1) {
      // Light pan if finger moves enough
      const cur = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const last = gesture.lastPan;
      const dx = cur.x - last.x;
      const dy = cur.y - last.y;

      // If they drag a bit, pan
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        view.tx += dx;
        view.ty += dy;
        gesture.lastPan = cur;
        applyTransform();
        e.preventDefault();
      }
      return;
    }
  }

  function onTouchEnd(e) {
    // If it ended as a true tap, we handle in click handler (pointer)
    gesture.mode = "none";
  }

  function onClickTap(e) {
    if (!imgNaturalW) return;

    // Prevent tap through on buttons
    if (e.target && (e.target.closest("button") || e.target.closest("label") || e.target.closest("input") || e.target.closest("a"))) {
      return;
    }

    const rect = elWrap.getBoundingClientRect();
    const wx = e.clientX - rect.left;
    const wy = e.clientY - rect.top;

    // Must be inside wrap
    if (wx < 0 || wy < 0 || wx > rect.width || wy > rect.height) return;

    const p = wrapPointToImagePoint(wx, wy);

    if (step === 0) {
      setInstruction("Upload a target photo first.");
      return;
    }

    if (step === 1) {
      bull = { x: p.x, y: p.y };
      step = 2;
      setInstruction(`Step 2: Tap a grid intersection (X cal point A). (Grid Lock: OFF)`);
      renderDots();
      setButtonsEnabled();
      return;
    }

    if (step === 2) {
      grid.xA = { x: p.x, y: p.y };
      step = 3;
      setInstruction(`Step 3: Tap the next grid intersection exactly 1 square RIGHT from X point A (X cal point B).`);
      renderDots();
      return;
    }

    if (step === 3) {
      grid.xB = { x: p.x, y: p.y };
      step = 4;
      setInstruction(`Step 4: Tap a grid intersection (Y cal point A).`);
      renderDots();
      return;
    }

    if (step === 4) {
      grid.yA = { x: p.x, y: p.y };
      step = 5;
      setInstruction(`Step 5: Tap the next grid intersection exactly 1 square DOWN from Y point A (Y cal point B).`);
      renderDots();
      return;
    }

    if (step === 5) {
      grid.yB = { x: p.x, y: p.y };
      const locked = tryLockGrid();
      if (locked) {
        step = 6;
      } else {
        // retry
        grid.locked = false;
        grid.pxPerInchX = null;
        grid.pxPerInchY = null;
        setInstruction(`Grid Lock failed. Re-do: Step 2 (X cal point A).`);
        step = 2;
      }
      renderDots();
      return;
    }

    // step >= 6 bullet taps
    shots.push({ x: p.x, y: p.y });
    setTapCount();
    renderDots();
    setButtonsEnabled();
    setInstruction(`Ready: Tap more holes or press Show Results.`);
  }

  // ------------------------------------------------------------
  // Events
  // ------------------------------------------------------------
  function wireButtons() {
    // Optional: set these to real Baker URLs later
    if (elCatalog) elCatalog.href = "#";
    if (elProduct) elProduct.href = "#";

    elApply?.addEventListener("click", applyMoma);

    elUnitToggle?.addEventListener("change", () => {
      session.unitSystem = elUnitToggle.checked ? "metric" : "in";
      syncUnitUI();
    });

    elUndo?.addEventListener("click", () => {
      if (shots.length > 0) {
        shots.pop();
        setTapCount();
        renderDots();
        setButtonsEnabled();
      } else {
        // If no shots, let Undo step backward in calibration (lightly)
        if (step > 1 && step < 6) {
          if (step === 5) grid.yA = null;
          if (step === 4) grid.xB = null;
          if (step === 3) grid.xA = null;
          step = Math.max(2, step - 1);
          setInstruction(`Undo — continue Grid Lock step ${step}.`);
          renderDots();
        }
      }
    });

    elClear?.addEventListener("click", () => {
      // Clear should reset per-run unit overrides back to defaults (you requested this behavior)
      resetSessionOnClear();
      clearAll(true);
    });

    elResults?.addEventListener("click", () => {
      if (!bull) {
        setInstruction("Tap the bull center first.");
        return;
      }
      if (!grid.locked) {
        setInstruction("Grid Lock required: complete the 1-inch X + Y calibration taps.");
        return;
      }
      if (shots.length === 0) {
        setInstruction("Tap at least one bullet hole first.");
        return;
      }
      computeAndRenderSEC();
      setInstruction("SEC ready. You can Undo/Clear or upload a new photo.");
    });

    // File load
    elFile?.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      if (!f) return;

      // New photo resets everything, including unit overrides
      resetSessionOnClear();

      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(f);

      elImg.onload = () => {
        imgNaturalW = elImg.naturalWidth || 0;
        imgNaturalH = elImg.naturalHeight || 0;

        // Reset view and fit
        fitImageToWrap();

        // Clear state but keep photo
        clearAll(true);
        setButtonsEnabled();
      };

      elImg.src = objectUrl;
    });

    // Taps
    elWrap.addEventListener("click", onClickTap);

    // Touch pan/zoom
    elWrap.addEventListener("touchstart", onTouchStart, { passive: false });
    elWrap.addEventListener("touchmove", onTouchMove, { passive: false });
    elWrap.addEventListener("touchend", onTouchEnd, { passive: true });

    // Double-tap to reset view (desktop: dblclick)
    elWrap.addEventListener("dblclick", () => {
      fitImageToWrap();
    });
  }

  function initDefaults() {
    // Defaults in UI
    if (elDist) elDist.value = f2(DEFAULT_DISTANCE_YDS);
    if (elClick) elClick.value = f2(DEFAULT_CLICK_MOA);
    if (elUnitToggle) elUnitToggle.checked = false;
    syncUnitUI();

    setInstruction(`Upload your Baker 23×35 1-inch grid target photo to begin.`);
    setTapCount();
    setButtonsEnabled();
  }

  // Handle resize
  window.addEventListener("resize", () => {
    if (imgNaturalW) fitImageToWrap();
  });

  // Boot
  wireButtons();
  initDefaults();
})();
