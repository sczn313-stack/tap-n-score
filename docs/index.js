/* ============================================================
   Tap-n-Score™ — index.js (FULL REPLACEMENT)

   Fixes:
   - Dots/taps are mapped to the *actual displayed image area*
     (object-fit: contain creates gutters; we ignore those)
   - Positions #dotsLayer to exactly cover the image rect
   - Scroll vs tap threshold (no dots while scrolling)
   - Loads vendor.json and shows vendor logo + name
   ============================================================ */

(() => {
  const qs = (sel, root = document) => root.querySelector(sel);

  // ---- Element discovery (supports minor HTML variations)
  const elPhotoInput =
    qs("#photoInput") ||
    qs('input[type="file"]') ||
    null;

  const elImg =
    qs("#targetImg") ||
    qs("img#img") ||
    qs("img") ||
    null;

  const elWrap =
    qs("#targetWrap") ||
    qs(".targetWrap") ||
    (elImg ? elImg.parentElement : null);

  const elDots =
    qs("#dotsLayer") ||
    qs(".dotsLayer") ||
    null;

  const elInstruction = qs("#instructionLine");

  const elBullChip = qs("#bullStatus") || qs("#bullChip");
  const elHolesChip = qs("#holesStatus") || qs("#holesChip");

  const elSetBull = qs("#setBullBtn") || qs('button[data-action="set-bull"]');
  const elUndo = qs("#undoBtn") || qs('button[data-action="undo"]');
  const elClear = qs("#clearBtn") || qs('button[data-action="clear"]');
  const elShowResults = qs("#showResultsBtn") || qs('button[data-action="results"]');

  // vendor UI
  const elVendorPill = qs("#vendorPill") || qs(".vendorPill");
  const elVendorLogo = qs("#vendorLogo") || qs(".vendorLogo");
  const elVendorName = qs("#vendorName") || qs(".vendorName");

  // ---- State
  let selectedFile = null;
  let objectUrl = null;

  let mode = "holes"; // "bull" or "holes"
  let bull = null;    // {xPct, yPct}   (PCT relative to displayed IMAGE RECT)
  let holes = [];     // [{xPct, yPct}, ...]

  // tap/scroll discrimination
  let down = null; // {x, y, xPct, yPct}
  const MOVE_PX = 10; // threshold: above this is a scroll, not a tap

  // ---------- Vendor loading
  async function loadVendor() {
    const url = "./vendor.json?v=" + Date.now();
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("vendor.json fetch failed: " + res.status);
      const v = await res.json();

      const name = (v && (v.name || v.vendorName || v.vendor)) || "Vendor";
      const logo = (v && (v.logo || v.logoUrl || v.logo_url || v.vendorLogo)) || "";

      if (elVendorName) elVendorName.textContent = name;

      if (elVendorLogo && logo) {
        elVendorLogo.src = logo;
        elVendorLogo.alt = name + " logo";
        elVendorLogo.style.display = "";
      }

      if (elVendorPill && v && v.url) {
        elVendorPill.href = v.url;
        elVendorPill.target = "_blank";
        elVendorPill.rel = "noopener";
      }
    } catch (e) {
      // silent fail ok
      // console.warn(e);
    }
  }

  // ---------- Helpers
  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function setChips() {
    if (elBullChip) elBullChip.textContent = bull ? "Bull: set" : "Bull: not set";
    if (elHolesChip) elHolesChip.textContent = "Holes: " + holes.length;
  }

  function clearDotsLayer() {
    if (elDots) elDots.innerHTML = "";
  }

  function drawDot(pt, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${pt.xPct}%`;
    d.style.top = `${pt.yPct}%`;
    elDots.appendChild(d);
  }

  function redraw() {
    positionDotsLayerToImage();
    clearDotsLayer();
    if (bull) drawDot(bull, "bull"); // yellow via CSS
    for (const h of holes) drawDot(h, "hole");
    setChips();
  }

  // ---------- Critical Fix: find the displayed image rect inside wrapper
  function getDisplayedImageRect() {
    if (!elWrap || !elImg) return null;

    const wrapRect = elWrap.getBoundingClientRect();

    // If image isn't loaded yet, bail
    const naturalW = elImg.naturalWidth || 0;
    const naturalH = elImg.naturalHeight || 0;
    if (!naturalW || !naturalH) return null;

    // wrapper's inner size
    const wrapW = wrapRect.width;
    const wrapH = wrapRect.height;

    // contain scale
    const scale = Math.min(wrapW / naturalW, wrapH / naturalH);

    const dispW = naturalW * scale;
    const dispH = naturalH * scale;

    // centered (contain)
    const left = (wrapW - dispW) / 2;
    const top = (wrapH - dispH) / 2;

    return {
      // coords relative to wrapper (not page)
      left,
      top,
      width: dispW,
      height: dispH
    };
  }

  function positionDotsLayerToImage() {
    if (!elWrap || !elDots) return;
    const imgBox = getDisplayedImageRect();
    if (!imgBox) return;

    // Place dots layer exactly over displayed image area
    elDots.style.position = "absolute";
    elDots.style.left = imgBox.left + "px";
    elDots.style.top = imgBox.top + "px";
    elDots.style.width = imgBox.width + "px";
    elDots.style.height = imgBox.height + "px";
    elDots.style.right = "auto";
    elDots.style.bottom = "auto";
  }

  // Convert screen coords -> % within displayed IMAGE RECT
  function pctFromEvent(clientX, clientY) {
    if (!elWrap) return null;

    const wrapRect = elWrap.getBoundingClientRect();
    const imgBox = getDisplayedImageRect();
    if (!imgBox) return null;

    // convert to wrapper-local
    const xLocal = clientX - wrapRect.left;
    const yLocal = clientY - wrapRect.top;

    // convert to image-local
    const xImg = xLocal - imgBox.left;
    const yImg = yLocal - imgBox.top;

    // ignore taps outside the image (gutters)
    if (xImg < 0 || yImg < 0 || xImg > imgBox.width || yImg > imgBox.height) {
      return null;
    }

    return {
      xPct: (xImg / imgBox.width) * 100,
      yPct: (yImg / imgBox.height) * 100
    };
  }

  // ---------- Photo selection
  function setPhotoFile(file) {
    selectedFile = file;
    if (!file || !elImg) return;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    elImg.src = objectUrl;

    // reset session
    mode = "bull";
    bull = null;
    holes = [];
    setInstruction("Set the bull first (tap Set Bull, then tap the bull).");
    setChips();

    // wait a tick so naturalWidth/Height are available, then position overlay
    setTimeout(() => {
      positionDotsLayerToImage();
      redraw();
    }, 60);
  }

  // ---------- Tap handling (scroll-safe + image-box-safe)
  function onPointerDown(ev) {
    const pt = pctFromEvent(ev.clientX, ev.clientY);
    if (!pt) {
      down = null;
      return;
    }

    down = {
      x: ev.clientX,
      y: ev.clientY,
      xPct: pt.xPct,
      yPct: pt.yPct
    };
  }

  function onPointerUp(ev) {
    if (!down) return;

    const dx = ev.clientX - down.x;
    const dy = ev.clientY - down.y;
    const dist = Math.hypot(dx, dy);

    // If user moved finger, treat as scroll — no dot
    if (dist > MOVE_PX) {
      down = null;
      return;
    }

    // if no photo loaded, ignore
    if (!selectedFile || !elImg || !elImg.src) {
      down = null;
      return;
    }

    const pt = { xPct: down.xPct, yPct: down.yPct };

    if (mode === "bull") {
      bull = pt;
      mode = "holes";
      setInstruction("Tap each confirmed hole.");
    } else {
      holes.push(pt);
    }

    redraw();
    down = null;
  }

  // ---------- Buttons
  function setBullMode() {
    mode = "bull";
    setInstruction("Tap the bull once.");
  }

  function undo() {
    if (mode === "holes" && holes.length > 0) {
      holes.pop();
      redraw();
      return;
    }
    if (bull) {
      bull = null;
      mode = "bull";
      setInstruction("Tap the bull once.");
      redraw();
    }
  }

  function clearAll() {
    bull = null;
    holes = [];
    mode = "bull";
    setInstruction("Tap the bull once.");
    redraw();
  }

  function showResults() {
    // Leave your existing results logic intact elsewhere if you have it.
    // This file focuses on stability + correct dot mapping.
  }

  // ---------- Init
  function init() {
    loadVendor();
    setChips();

    if (elWrap) {
      elWrap.style.position = elWrap.style.position || "relative";

      // vertical scrolling allowed; dots only if finger doesn't move
      elWrap.style.touchAction = "pan-y";
      elWrap.addEventListener("pointerdown", onPointerDown, { passive: true });
      elWrap.addEventListener("pointerup", onPointerUp, { passive: true });
    }

    if (elPhotoInput) {
      elPhotoInput.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) setPhotoFile(f);
      });
    }

    if (elSetBull) elSetBull.addEventListener("click", setBullMode);
    if (elUndo) elUndo.addEventListener("click", undo);
    if (elClear) elClear.addEventListener("click", clearAll);
    if (elShowResults) elShowResults.addEventListener("click", showResults);
  }

  window.addEventListener("resize", () => {
    positionDotsLayerToImage();
    redraw();
  });

  // When image finishes loading (so natural size is known)
  if (elImg) {
    elImg.addEventListener("load", () => {
      positionDotsLayerToImage();
      redraw();
    });
  }

  init();
})();
