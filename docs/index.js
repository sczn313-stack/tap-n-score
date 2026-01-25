/* ============================================================
   Tap-n-Score™ — index.js (FULL REPLACEMENT)

   Fixes / Adds:
   - Loads vendor.json and shows vendor logo + name
   - Bull marker is yellow (CSS class .dot.bull)
   - Scroll vs tap threshold (no dots while scrolling)
   - Keeps iOS photo selection stable (store File immediately)
   ============================================================ */

(() => {
  const qs = (sel, root = document) => root.querySelector(sel);

  // ---- Element discovery (supports minor HTML variations)
  const elPhotoInput =
    qs("#photoInput") ||
    qs('input[type="file"]') ||
    null;

  const elChooseBtn =
    qs("#choosePhotoBtn") ||
    qs("#chooseTargetPhotoBtn") ||
    qs('label[for="photoInput"]') ||
    qs('button[data-action="choose-photo"]') ||
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
  const elDownloadSec = qs("#downloadSecBtn") || qs('button[data-action="download-sec"]');

  // vendor UI
  const elVendorPill = qs("#vendorPill") || qs(".vendorPill");
  const elVendorLogo = qs("#vendorLogo") || qs(".vendorLogo");
  const elVendorName = qs("#vendorName") || qs(".vendorName");

  // ---- State
  let selectedFile = null;
  let objectUrl = null;

  let mode = "holes"; // "bull" or "holes"
  let bull = null;    // {xPct, yPct}
  let holes = [];     // [{xPct, yPct}, ...]

  // tap/scroll discrimination
  let down = null; // {x, y, t, xPct, yPct}
  const MOVE_PX = 10; // threshold: above this is a scroll, not a tap

  // ---------- Vendor loading
  async function loadVendor() {
    // vendor.json currently sits in /docs/vendor.json
    // (If you move it to /docs/assets/vendor.json later, update this path.)
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
      // silent fail is fine for now
      // console.warn(e);
    }
  }

  // ---------- Helpers
  function setInstruction(text) {
    if (elInstruction) elInstruction.textContent = text;
  }

  function setChips() {
    if (elBullChip) {
      elBullChip.textContent = bull ? "Bull: set" : "Bull: not set";
    }
    if (elHolesChip) {
      elHolesChip.textContent = "Holes: " + holes.length;
    }
  }

  function clearDotsLayer() {
    if (!elDots) return;
    elDots.innerHTML = "";
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
    clearDotsLayer();
    if (bull) drawDot(bull, "bull");
    for (const h of holes) drawDot(h, "hole");
    setChips();
  }

  function pctFromEvent(clientX, clientY) {
    if (!elWrap) return { xPct: 0, yPct: 0 };

    const r = elWrap.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width);
    const y = Math.min(Math.max(clientY - r.top, 0), r.height);

    return {
      xPct: (x / r.width) * 100,
      yPct: (y / r.height) * 100,
    };
  }

  function ensureDotsLayerSizing() {
    if (!elWrap || !elDots) return;
    // make sure dots layer covers wrap exactly
    elDots.style.position = "absolute";
    elDots.style.left = "0";
    elDots.style.top = "0";
    elDots.style.right = "0";
    elDots.style.bottom = "0";
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
    redraw();
  }

  // ---------- Tap handling (scroll-safe)
  function onPointerDown(ev) {
    if (!elWrap) return;
    // Only accept primary touch / pointer
    const pt = pctFromEvent(ev.clientX, ev.clientY);
    down = {
      x: ev.clientX,
      y: ev.clientY,
      t: performance.now(),
      xPct: pt.xPct,
      yPct: pt.yPct
    };
  }

  function onPointerUp(ev) {
    if (!down) return;

    const dx = ev.clientX - down.x;
    const dy = ev.clientY - down.y;
    const dist = Math.hypot(dx, dy);

    // If user moved finger, treat as scroll — do NOT place dot
    if (dist > MOVE_PX) {
      down = null;
      return;
    }

    // if no photo loaded, ignore taps
    if (!selectedFile || !elImg || !elImg.src) {
      down = null;
      return;
    }

    // place point
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
    // if no holes, allow undo bull
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
    // Placeholder: you already have your backend / calc logic elsewhere.
    // This function is intentionally minimal to avoid breaking current flow.
    // If you’re using an existing showResults handler in your HTML, keep it there.
  }

  // ---------- Init
  function init() {
    loadVendor();

    ensureDotsLayerSizing();
    setChips();

    // Make taps work while still allowing vertical scroll
    if (elWrap) {
      elWrap.style.position = elWrap.style.position || "relative";
      // allow vertical scrolling, but we still capture "tap" when finger doesn't move
      elWrap.style.touchAction = "pan-y";
      elWrap.addEventListener("pointerdown", onPointerDown, { passive: true });
      elWrap.addEventListener("pointerup", onPointerUp, { passive: true });
    }

    // File input: iOS-safe
    if (elPhotoInput) {
      elPhotoInput.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) setPhotoFile(f);
      });
    }

    // If choose button is a custom button (not <label for>), trigger picker
    if (elChooseBtn && elPhotoInput && elChooseBtn.tagName.toLowerCase() === "button") {
      elChooseBtn.addEventListener("click", () => elPhotoInput.click());
    }

    if (elSetBull) elSetBull.addEventListener("click", setBullMode);
    if (elUndo) elUndo.addEventListener("click", undo);
    if (elClear) elClear.addEventListener("click", clearAll);
    if (elShowResults) elShowResults.addEventListener("click", showResults);

    // download button left as-is (your existing SEC generator likely attaches elsewhere)
    // If you already wire it, we don’t override it.
  }

  window.addEventListener("resize", () => {
    ensureDotsLayerSizing();
    redraw();
  });

  init();
})();
