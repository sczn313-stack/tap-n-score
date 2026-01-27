/* ============================================================
   docs/index.js (FULL REPLACEMENT) — PILOT TIGHTEN PACK
   - Smooth pinch zoom + pan (iOS touch events)
   - RAF-throttled transforms (smoother feel)
   - Smaller filled dots (color centers)
   - Vendor session routing for Baker
   - Locked tags: catalog, product
   - Baker landing URLs configurable (Baker chooses)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // Elements
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
  const outputTitle = $("outputTitle");
  const outputText = $("outputText");

  const vendorLink = $("vendorLink");
  const bakerCtas = $("bakerCtas");
  const bakerCatalogBtn = $("bakerCatalogBtn");
  const bakerProductBtn = $("bakerProductBtn");

  // LOCKED Baker tags
  const BAKER_TAG_CATALOG = "catalog";
  const BAKER_TAG_PRODUCT = "product";
  const DEFAULT_DEST = BAKER_TAG_CATALOG;

  // Baker selects landing locations (fill these when Baker tells you)
  // Keep as empty string until you get the exact URLs.
  const BAKER_DESTINATION_MAP = {
    [BAKER_TAG_CATALOG]: "", // e.g. "https://bakerprinting.com/collections/targets"
    [BAKER_TAG_PRODUCT]: "", // e.g. "https://bakerprinting.com/pages/targets"
  };

  function getSessionParams() {
    const qs = new URLSearchParams(window.location.search);
    const vendor = (qs.get("vendor") || "").toLowerCase();
    const dest = (qs.get("dest") || DEFAULT_DEST).toLowerCase();
    return { vendor, dest };
  }

  // Image URL
  let objectUrl = null;

  // Tap data stored in IMAGE-LOCAL coords
  let bull = null;
  let hits = [];

  // DONE state
  let done = false;

  // View transform
  let scale = 1;
  let tx = 0;
  let ty = 0;

  const MIN_SCALE = 1;
  const MAX_SCALE = 6;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // RAF-throttled transforms for smoothness
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

  function showOutput(title, html) {
    outputTitle.textContent = title;
    outputText.innerHTML = html;
    outputBox.classList.remove("hidden");
  }

  function hideOutput() {
    outputBox.classList.add("hidden");
    outputText.textContent = "";
    done = false;
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

    if (done) {
      instructionLine.textContent = "Results ready. You can Undo/Clear or upload a new photo.";
      return;
    }

    instructionLine.textContent = !bull
      ? "Pinch to zoom if needed, then TAP the bull (aim point) once."
      : "Now TAP bullet holes. Pinch/zoom and pan as needed. Then press Show Results.";
  }

  function clearAll() {
    bull = null;
    hits = [];
    dotsLayer.innerHTML = "";
    hideOutput();
    setUi();
  }

  function undo() {
    if (hits.length > 0) hits.pop();
    else if (bull) bull = null;

    renderDots();
    hideOutput();
    setUi();
  }

  function getViewportPointFromClient(clientX, clientY) {
    const r = viewport.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function viewportToImageLocal(pt) {
    return { x: (pt.x - tx) / scale, y: (pt.y - ty) / scale };
  }

  function addDot(kind, pt) {
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${pt.x}px`;
    d.style.top = `${pt.y}px`;
    dotsLayer.appendChild(d);
  }

  function renderDots() {
    dotsLayer.innerHTML = "";
    if (bull) addDot("bull", bull);
    for (const h of hits) addDot("hit", h);
  }

  // keep pan from drifting too far
  function clampPan() {
    const r = viewport.getBoundingClientRect();
    const slack = 90;
    const baseW = r.width;

    const imgRect = img.getBoundingClientRect();
    const baseH = (imgRect.height / scale) || (r.width * 0.75);

    const minTx = -(baseW * scale - baseW) - slack;
    const maxTx = slack;
    const minTy = -(baseH * scale - baseH) - slack;
    const maxTy = slack;

    tx = clamp(tx, minTx, maxTx);
    ty = clamp(ty, minTy, maxTy);
  }

  // Vendor wiring (Baker only)
  function wireVendor() {
    const { vendor, dest } = getSessionParams();

    // Default: hide vendor UI
    vendorLink.style.display = "none";
    bakerCtas.style.display = "none";

    if (vendor !== "baker") return;

    vendorLink.style.display = "inline-flex";
    vendorLink.textContent = "Baker Printing";
    vendorLink.href = "https://bakerprinting.com";

    bakerCtas.style.display = "flex";

    // Locked button labels (already on HTML, but enforce)
    bakerCatalogBtn.textContent = "Buy Baker Targets";
    bakerProductBtn.textContent = "Learn More About Baker Targets";

    bakerCatalogBtn.onclick = () => {
      window.location.href = `${window.location.pathname}?vendor=baker&dest=${BAKER_TAG_CATALOG}`;
    };

    bakerProductBtn.onclick = () => {
      window.location.href = `${window.location.pathname}?vendor=baker&dest=${BAKER_TAG_PRODUCT}`;
    };

    // If someone arrives with dest specified, show the Baker selection note,
    // and if a real URL is configured, redirect.
    const targetUrl = BAKER_DESTINATION_MAP[dest] || "";
    if (dest && (dest === BAKER_TAG_CATALOG || dest === BAKER_TAG_PRODUCT)) {
      if (targetUrl) {
        // Baker landing configured: go there
        window.location.href = targetUrl;
      } else {
        // Not configured yet: show a clean note (no dead-click confusion)
        showOutput(
          "Baker Link",
          `Baker landing for <b>${dest}</b> is not set yet.<br/>
           When Baker provides the destination URL, we’ll map it here without changing any QR codes.`
        );
      }
    }
  }

  // File load
  elFile.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      resetView();
      clearAll();

      // dots layer uses image-local coordinates (natural size)
      dotsLayer.style.width = img.naturalWidth + "px";
      dotsLayer.style.height = img.naturalHeight + "px";

      applyTransform();
      setUi();
    };

    img.src = objectUrl;
    setUi();
  });

  // iOS: stop gesture hijack inside viewport
  ["gesturestart", "gesturechange", "gestureend"].forEach((evt) => {
    viewport.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
  });

  // Touch gesture state
  let mode = "none";     // "pan" | "pinch" | "none"
  let panStart = null;   // { x, y, tx, ty }
  let pinchStart = null; // { dist, midX, midY, scale, tx, ty }

  function tDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }

  function tMid(t1, t2) {
    const r = viewport.getBoundingClientRect();
    return {
      x: ((t1.clientX + t2.clientX) / 2) - r.left,
      y: ((t1.clientY + t2.clientY) / 2) - r.top
    };
  }

  // Tap detection
  const TAP_SLOP = 10;
  let downPt = null;
  let downWasPinch = false;
  let lastTapTime = 0;

  viewport.addEventListener("touchstart", (e) => {
    if (!img.src) return;

    if (e.touches.length === 1) {
      e.preventDefault();
      mode = "pan";

      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);
      panStart = { x: pt.x, y: pt.y, tx, ty };
      pinchStart = null;

      downWasPinch = false;
      downPt = pt;
    }

    if (e.touches.length === 2) {
      e.preventDefault();
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

      panStart = null;

      downWasPinch = true;
      downPt = null;
    }
  }, { passive: false });

  viewport.addEventListener("touchmove", (e) => {
    if (!img.src) return;

    if (mode === "pan" && e.touches.length === 1 && panStart) {
      e.preventDefault();
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);

      tx = panStart.tx + (pt.x - panStart.x);
      ty = panStart.ty + (pt.y - panStart.y);

      clampPan();
      applyTransform();
      return;
    }

    if (mode === "pinch" && e.touches.length === 2 && pinchStart) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const m = tMid(t1, t2);
      const d = tDist(t1, t2);

      const nextScale = clamp(pinchStart.scale * (d / pinchStart.dist), MIN_SCALE, MAX_SCALE);

      // keep pinch-start midpoint stable in image-local space
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
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (!img.src) return;

    // double tap reset + single tap place dots
    if (!downWasPinch && e.changedTouches.length === 1 && downPt) {
      const t = e.changedTouches[0];
      const upPt = getViewportPointFromClient(t.clientX, t.clientY);
      const moved = Math.hypot(upPt.x - downPt.x, upPt.y - downPt.y);

      if (moved <= TAP_SLOP) {
        const now = Date.now();

        // Double tap reset
        if (now - lastTapTime < 300) {
          resetView();
          lastTapTime = 0;
        } else {
          lastTapTime = now;

          const imgLocal = viewportToImageLocal(upPt);
          if (Number.isFinite(imgLocal.x) && Number.isFinite(imgLocal.y)) {
            if (!bull) bull = imgLocal;
            else hits.push(imgLocal);

            renderDots();
            hideOutput();
            setUi();
          }
        }
      }
    }

    // transition mode based on remaining touches
    if (e.touches.length === 0) {
      mode = "none";
      panStart = null;
      pinchStart = null;
      downPt = null;
      downWasPinch = false;
    } else if (e.touches.length === 1) {
      mode = "pan";
      const t = e.touches[0];
      const pt = getViewportPointFromClient(t.clientX, t.clientY);
      panStart = { x: pt.x, y: pt.y, tx, ty };
      pinchStart = null;
      downPt = pt;
      downWasPinch = false;
    }
  }, { passive: false });

  // Buttons
  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", clearAll);

  showBtn.addEventListener("click", () => {
    if (!(bull && hits.length > 0)) return;

    done = true;
    showOutput(
      "Pilot Result",
      `<b>✅ Results Ready (Pilot)</b><br/>
       Bull anchored + <b>${hits.length}</b> hits recorded.<br/>
       You can Undo/Clear to adjust, or upload a new photo.`
    );
    setUi();
  });

  // Init
  wireVendor();
  setUi();
})();
