// ----- Gestures (NO-JUMP TAPS)
// Rules:
// - 1 finger: tap bull/hits (no pan unless user drags past threshold)
// - 2 fingers: pinch/zoom + pan
// - double-tap: reset view
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

const TAP_SLOP = 10;      // max move still treated as tap
const PAN_START = 14;     // move beyond this -> pan mode
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

    mode = "tap";                 // start as tap
    downPt = pt;                  // remember for slop
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

  // Pinch always wins
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

  // One-finger: stay TAP until user drags far enough to PAN
  if (e.touches.length === 1 && panStart) {
    const t = e.touches[0];
    const pt = getViewportPointFromClient(t.clientX, t.clientY);

    const moved = downPt ? Math.hypot(pt.x - downPt.x, pt.y - downPt.y) : 999;

    if (mode === "tap" && moved >= PAN_START) {
      mode = "pan"; // switch to pan only after intentional drag
    }

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

  // If we were tapping, treat it as a tap if movement stayed small
  if (mode === "tap" && e.changedTouches.length === 1 && downPt) {
    const t = e.changedTouches[0];
    const upPt = getViewportPointFromClient(t.clientX, t.clientY);
    const moved = Math.hypot(upPt.x - downPt.x, upPt.y - downPt.y);

    if (moved <= TAP_SLOP) {
      const now = Date.now();

      // double tap resets view
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

  // Reset state depending on remaining touches
  if (e.touches.length === 0) {
    mode = "none";
    panStart = null;
    pinchStart = null;
    downPt = null;
    return;
  }

  // If one finger remains after pinch, restart gesture tracking clean
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const pt = getViewportPointFromClient(t.clientX, t.clientY);

    mode = "tap";
    downPt = pt;
    panStart = { x: pt.x, y: pt.y, tx, ty };
    pinchStart = null;
  }
}, { passive: false });
