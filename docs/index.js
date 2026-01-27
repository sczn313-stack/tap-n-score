/* ============================================================
   frontend_new/index.js (FULL REPLACEMENT) — PILOT PINCH/ZOOM
   Fixes / Features:
   - Pinch to zoom + pan (iOS + Android) using Pointer Events
   - Prevents image "jump" on tap by disabling native gestures (touch-action:none)
   - Tap markers remain accurate while zoomed (stored in image-local coords)
   - Bull anchor first, then bullet holes
   - Undo / Clear
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements
  const elFile = $("photoInput");
  const viewport = $("targetViewport");
  const img = $("targetImg");
  const dotsLayer = $("dotsLayer");

  const tapCountEl = $("tapCount");
  const undoBtn = $("undoBtn");
  const clearBtn = $("clearBtn");
  const showBtn = $("showResultsBtn");

  const instructionLine = $("instructionLine");
  const outputBox = $("outputBox");
  const outputText = $("outputText");

  // ---- State
  let objectUrl = null;

  // Tap data stored in IMAGE-LOCAL coordinates (pre-transform)
  // bull: {x,y} or null
  // hits: [{x,y}, ...]
  let bull = null;
  let hits = [];

  // ---- View transform state (applied to IMG)
  let scale = 1;
  let tx = 0;
  let ty = 0;

  const MIN_SCALE = 1;
  const MAX_SCALE = 6;

  // pointer tracking for pinch/pan
  const pointers = new Map(); // pointerId -> {x,y}
  let isPanning = false;
  let panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  let pinchStart = null; // { dist, midX, midY, scale, tx, ty }

  // ---- Utils
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function applyTransform() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    // Keep dots layer visually aligned to transformed image:
    dotsLayer.style.transformOrigin = "0 0";
    dotsLayer.style.transform = img.style.transform;
  }

  function getViewportPointFromClient(clientX, clientY) {
    const r = viewport.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  // Convert viewport point -> image local point (inverse transform)
  function viewportToImageLocal(pt) {
    return { x: (pt.x - tx) / scale, y: (pt.y - ty) / scale };
  }

  // Convert image local -> viewport point (forward transform)
  function imageLocalToViewport(pt) {
    return { x: pt.x * scale + tx, y: pt.y * scale + ty };
  }

  function resetView() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
  }

  // Optional clamp so image doesn’t drift too far away
  function clampPan() {
    const r = viewport.getBoundingClientRect();
    const slack = 90;

    const baseW = r.width;

    // Estimate base height from current rendered height at scale=1
    // Current img rect includes transforms, so divide by scale
    const imgRect = img.getBoundingClientRect();
    const baseH = (imgRect.height / scale) || (r.width * 0.75);

    const minTx = -(baseW * scale - baseW) - slack;
    const maxTx = slack;

    const minTy = -(baseH * scale - baseH) - slack;
    const maxTy = slack;

    tx = clamp(tx, minTx, maxTx);
    ty = clamp(ty, minTy, maxTy);
  }

  function setUi() {
    const totalTaps = (bull ? 1 : 0) + hits.length;
    tapCountEl.textContent = String(totalTaps);

    undoBtn.disabled = totalTaps === 0;
    clearBtn.disabled = totalTaps === 0;
    showBtn.disabled = !(bull && hits.length > 0);

    if (!img.src) {
      instructionLine.textContent = "Upload your target photo to begin.";
      return;
    }
    if (!bull) {
      instructionLine.textContent = "Pinch to zoom if needed, then TAP the bull (aim point) once.";
    } else {
      instructionLine.textContent = "Now TAP bullet holes. Pinch/zoom and pan as needed. Then press Show Results.";
    }
  }

  function clearAll() {
    bull = null;
    hits = [];
    dotsLayer.innerHTML = "";
    outputBox.classList.add("hidden");
    outputText.textContent = "";
    setUi();
  }

  function undo() {
    // Undo last action: last hit, else bull
    if (hits.length > 0) {
      hits.pop();
    } else if (bull) {
      bull = null;
    }
    renderDots();
    outputBox.classList.add("hidden");
    outputText.textContent = "";
    setUi();
  }

  function addDot(elClass, ptImageLocal) {
    const d = document.createElement("div");
    d.className = `dot ${elClass}`;

    // Place dots in IMAGE-LOCAL space and let dotsLayer inherit transform
    d.style.left = `${ptImageLocal.x}px`;
    d.style.top = `${ptImageLocal.y}px`;

    dotsLayer.appendChild(d);
  }

  function renderDots() {
    dotsLayer.innerHTML = "";
    if (bull) addDot("bull", bull);
    for (const h of hits) addDot("hit", h);
  }

  // ---- File load
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      // Reset everything for new image
      resetView();
      clearAll();
      setUi();
    };
    img.src = objectUrl;

    // Make dotsLayer match the intrinsic image coordinate space:
    // We’ll set dotsLayer size to the natural image size AFTER load.
    img.addEventListener("load", () => {
      // Set dotsLayer to natural size so image-local coords match pixels
      dotsLayer.style.width = img.naturalWidth + "px";
      dotsLayer.style.height = img.naturalHeight + "px";
    }, { once: true });

    setUi();
  });

  // ---- Gestures (Pointer Events)
  viewport.addEventListener("pointerdown", (e) => {
    if (!img.src) return;

    e.preventDefault();
    viewport.setPointerCapture(e.pointerId);

    const pt = getViewportPointFromClient(e.clientX, e.clientY);
    pointers.set(e.pointerId, pt);

    if (pointers.size === 1) {
      isPanning = true;
      panStart = { x: pt.x, y: pt.y, tx, ty };
      pinchStart = null;
    }

    if (pointers.size === 2) {
      const [p1, p2] = Array.from(pointers.values());
      const m = mid(p1, p2);
      pinchStart = {
        dist: dist(p1, p2),
        midX: m.x,
        midY: m.y,
        scale,
        tx,
        ty,
      };
      isPanning = false;
    }
  }, { passive: false });

  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;

    e.preventDefault();
    const pt = getViewportPointFromClient(e.clientX, e.clientY);
    pointers.set(e.pointerId, pt);

    if (pointers.size === 1 && isPanning) {
      // Pan
      tx = panStart.tx + (pt.x - panStart.x);
      ty = panStart.ty + (pt.y - panStart.y);
      clampPan();
      applyTransform();
    }

    if (pointers.size === 2 && pinchStart) {
      const [p1, p2] = Array.from(pointers.values());
      const d = dist(p1, p2);
      const m = mid(p1, p2);

      const nextScale = clamp(pinchStart.scale * (d / pinchStart.dist), MIN_SCALE, MAX_SCALE);

      // Keep the pinch midpoint stable in image-local space
      const imgLocalAtStartMid = {
        x: (pinchStart.midX - pinchStart.tx) / pinchStart.scale,
        y: (pinchStart.midY - pinchStart.ty) / pinchStart.scale
      };

      scale = nextScale;
      tx = m.x - imgLocalAtStartMid.x * scale;
      ty = m.y - imgLocalAtStartMid.y * scale;

      clampPan();
      applyTransform();
    }
  }, { passive: false });

  function endPointer(e) {
    if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);

    if (pointers.size === 0) {
      isPanning = false;
      pinchStart = null;
    } else if (pointers.size === 1) {
      // Transition back to pan with remaining pointer
      const [p] = Array.from(pointers.values());
      isPanning = true;
      panStart = { x: p.x, y: p.y, tx, ty };
      pinchStart = null;
    }
  }

  viewport.addEventListener("pointerup", endPointer, { passive: false });
  viewport.addEventListener("pointercancel", endPointer, { passive: false });
  viewport.addEventListener("pointerleave", endPointer, { passive: false });

  // Double-tap (dblclick) to reset view
  viewport.addEventListener("dblclick", (e) => {
    if (!img.src) return;
    resetView();
  });

  // ---- Tap to place bull / hits
  // We treat a "tap" as pointerup with minimal movement (so panning doesn't place dots)
  const TAP_SLOP = 8; // px
  const pointerDownPos = new Map(); // pointerId -> {x,y}

  viewport.addEventListener("pointerdown", (e) => {
    if (!img.src) return;
    const pt = getViewportPointFromClient(e.clientX, e.clientY);
    pointerDownPos.set(e.pointerId, pt);
  });

  viewport.addEventListener("pointerup", (e) => {
    if (!img.src) return;

    // Only treat as tap if single pointer (not during pinch) and minimal movement
    const down = pointerDownPos.get(e.pointerId);
    pointerDownPos.delete(e.pointerId);

    if (!down) return;
    if (pointers.size >= 1) {
      // If there are still pointers, user may be pinching/panning—avoid dot placement
      return;
    }

    const upPt = getViewportPointFromClient(e.clientX, e.clientY);
    const moved = Math.hypot(upPt.x - down.x, upPt.y - down.y);
    if (moved > TAP_SLOP) return;

    // Convert to image-local coords
    const imgLocal = viewportToImageLocal(upPt);

    // Safety: ignore taps outside reasonable image bounds
    if (!Number.isFinite(imgLocal.x) || !Number.isFinite(imgLocal.y)) return;

    // Place bull first, then hits
    if (!bull) {
      bull = imgLocal;
    } else {
      hits.push(imgLocal);
    }

    renderDots();
    outputBox.classList.add("hidden");
    outputText.textContent = "";
    setUi();
  }, { passive: false });

  // ---- Buttons
  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", clearAll);

  showBtn.addEventListener("click", () => {
    if (!(bull && hits.length > 0)) return;

    // Pilot stub output (replace with backend call when ready)
    outputBox.classList.remove("hidden");
    outputText.textContent =
      `Bull anchored. Hits recorded: ${hits.length}. (Pilot view) Next: wire this to your /api/analyze endpoint.`;

    // Optional: lock a "done" feeling
    // You can also trigger a webhook/engagement count here later.
  });

  // ---- Init
  setUi();
})();
