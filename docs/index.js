/* ============================================================
   docs/index.js (FULL REPLACEMENT) — Tap-n-Score™ → SEC Route
   Goals:
   - iOS Safari friendly file load (store File immediately)
   - Tap flow: Bull first, then shots
   - Backend is authority for directions + numbers
   - Write SEC payload to localStorage, then route to sec.html
   - Resilient: works even if your HTML IDs differ (tries many)
============================================================ */

(() => {
  // ---------- helpers ----------
  const $id = (id) => document.getElementById(id);
  const firstEl = (...candidates) => {
    for (const c of candidates.flat()) {
      const el = typeof c === "string" ? $id(c) : c;
      if (el) return el;
    }
    return null;
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const isNum = (v) => Number.isFinite(Number(v));
  const toNum = (v, fallback = 0) => (isNum(v) ? Number(v) : fallback);

  // ---------- CONFIG ----------
  // If you have a backend on Render, set this to the full origin:
  // e.g. "https://tap-n-score.onrender.com"
  // If you proxy backend on same origin, leave as "".
  const BACKEND_ORIGIN = ""; // <-- EDIT IF NEEDED
  const API_CALC_PATH = "/api/calc"; // <-- match your backend route
  const API_ANALYZE_PATH = "/api/analyze"; // optional (if you use it)

  // ---------- storage keys ----------
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";
  const DIST_KEY = "SCZN3_DISTANCE_YDS_V1";
  const MOA_KEY = "SCZN3_MOA_PER_CLICK_V1";
  const VENDOR_KEY = "SCZN3_VENDOR_ID_V1";
  const TARGET_KEY = "SCZN3_TARGET_ID_V1";

  // ---------- DOM (try multiple IDs so we don’t break) ----------
  const elFile =
    firstEl(
      "photoInput",
      "fileInput",
      "imageInput",
      "uploadInput",
      document.querySelector('input[type="file"]')
    );

  const elImg = firstEl("targetImg", "img", "photo", "previewImg");
  const elWrap = firstEl("targetWrap", "imgWrap", "imageWrap", "wrap");
  const elDots = firstEl("dotsLayer", "tapLayer", "overlayLayer");

  const elTapCount = firstEl("tapCount", "shotCount", "count");
  const elInstruction = firstEl("instructionLine", "instruction", "hint");
  const btnClear = firstEl("clearTapsBtn", "clearBtn", "btnClear");
  const btnShow = firstEl("showResultsBtn", "seeResultsBtn", "btnShowResults");
  const btnSetup = firstEl("setupBtn", "btnSetup");
  const btnChoose =
    firstEl("choosePhotoBtn", "chooseBtn", "btnChoosePhoto") ||
    null; // optional

  const elSetupPill =
    firstEl("setupPill", "setupLockedPill", "lockedPill") || null;
  const elTapModePill =
    firstEl("tapModePill", "tapMode", "modePill") || null;

  // ---------- state ----------
  let selectedFile = null;
  let objectUrl = null;

  // taps are normalized to the displayed image box (0..1)
  let bull = null; // {nx, ny}
  let shots = []; // [{nx, ny}, ...]

  // ---------- UI text ----------
  const UI = {
    setInstruction(txt) {
      if (elInstruction) elInstruction.textContent = txt;
    },
    setCount() {
      if (elTapCount) elTapCount.textContent = String(shots.length);
    },
    setTapMode(label) {
      if (elTapModePill) elTapModePill.textContent = label;
    },
    setSetupLocked(locked) {
      if (!elSetupPill) return;
      // if your pill is text-only:
      elSetupPill.textContent = locked ? "SETUP LOCKED" : "SETUP";
      // if you style via classes:
      elSetupPill.classList.toggle("isLocked", !!locked);
    },
    enable(el, on) {
      if (!el) return;
      el.classList.toggle("btnDisabled", !on);
      el.setAttribute("aria-disabled", on ? "false" : "true");
      el.disabled = !on;
    }
  };

  // ---------- create a dot element ----------
  function makeDot(kind) {
    const d = document.createElement("div");
    d.className = kind === "bull" ? "tapDot tapDotBull" : "tapDot tapDotShot";
    // fallback inline styles if css classes missing
    d.style.position = "absolute";
    d.style.width = "14px";
    d.style.height = "14px";
    d.style.borderRadius = "999px";
    d.style.transform = "translate(-50%, -50%)";
    d.style.boxShadow = "0 8px 20px rgba(0,0,0,.35)";
    d.style.border = "2px solid rgba(255,255,255,.85)";
    d.style.background = kind === "bull" ? "rgba(47,102,255,.95)" : "rgba(214,64,64,.95)";
    return d;
  }

  function clearDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
  }

  function renderDots() {
    if (!elDots) return;
    clearDots();

    // Render bull
    if (bull) {
      const dot = makeDot("bull");
      dot.style.left = `${bull.nx * 100}%`;
      dot.style.top = `${bull.ny * 100}%`;
      elDots.appendChild(dot);
    }

    // Render shots
    for (const s of shots) {
      const dot = makeDot("shot");
      dot.style.left = `${s.nx * 100}%`;
      dot.style.top = `${s.ny * 100}%`;
      elDots.appendChild(dot);
    }

    UI.setCount();
    UI.enable(btnShow, !!bull && shots.length > 0);
  }

  function resetAll() {
    bull = null;
    shots = [];
    renderDots();
    UI.setTapMode("TAP: BULL");
    UI.setInstruction("Tap the bull first (blue). Then tap shots (red).");
  }

  // ---------- get normalized tap coords ----------
  function getTapNormFromEvent(ev) {
    const rect = (elDots || elWrap || elImg).getBoundingClientRect();
    const clientX = ev.touches?.[0]?.clientX ?? ev.clientX;
    const clientY = ev.touches?.[0]?.clientY ?? ev.clientY;
    const nx = clamp01((clientX - rect.left) / rect.width);
    const ny = clamp01((clientY - rect.top) / rect.height);
    return { nx, ny };
  }

  // ---------- SEC ROUTE + PAYLOAD ----------
  function routeToSEC_FromBackendResult(data) {
    // Build the SEC payload from BACKEND AUTHORITY ONLY
    const secPayload = {
      sessionId: data.sessionId || `SEC-${Date.now().toString(36).toUpperCase()}`,
      score: Number.isFinite(Number(data.score)) ? Number(data.score) : null,
      shots: Number.isFinite(Number(data.shots)) ? Number(data.shots) : 0,

      windage: {
        dir: data.windage?.dir || data.clicks?.windDir || data.windDir || "—",
        clicks: data.windage?.clicks ?? data.clicks?.windage ?? data.windageClicks ?? 0
      },

      elevation: {
        dir: data.elevation?.dir || data.clicks?.elevDir || data.elevDir || "—",
        clicks: data.elevation?.clicks ?? data.clicks?.elevation ?? data.elevationClicks ?? 0
      },

      secPngUrl: data.secPngUrl || data.secUrl || "",
      vendorUrl: data.vendorUrl || "",
      surveyUrl: data.surveyUrl || ""
    };

    try {
      localStorage.setItem(SEC_KEY, JSON.stringify(secPayload));
    } catch (e) {
      console.error("SEC localStorage write failed:", e);
      alert("Could not save SEC data (storage blocked). Try disabling private browsing.");
      return;
    }

    console.log("✅ SEC payload written:", secPayload);
    window.location.href = "./sec.html";
  }

  // ---------- backend call ----------
  async function callBackendForResults() {
    // Pull upstream (set on target.html)
    const distanceYds = toNum(localStorage.getItem(DIST_KEY), 100);
    const moaPerClick = toNum(localStorage.getItem(MOA_KEY), 0.25);
    const vendorId = (localStorage.getItem(VENDOR_KEY) || "").trim();
    const targetId = (localStorage.getItem(TARGET_KEY) || "").trim();

    // Minimal payload that most backends can adapt to
    const payload = {
      meta: {
        distanceYds,
        moaPerClick,
        vendorId,
        targetId
      },
      taps: {
        bull,   // {nx, ny}
        shots   // [{nx, ny}, ...]
      }
    };

    const url = `${BACKEND_ORIGIN}${API_CALC_PATH}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error || data?.message || `Backend error (${res.status})`;
      throw new Error(msg);
    }

    return data;
  }

  // ---------- event wiring ----------
  function bindTapLayer() {
    const layer = elDots || elWrap || elImg;
    if (!layer) return;

    // Make sure overlay can receive taps
    layer.style.touchAction = "none";

    const onTap = (ev) => {
      ev.preventDefault?.();

      if (!elImg || !elImg.src) {
        UI.setInstruction("Choose a photo first.");
        return;
      }

      const p = getTapNormFromEvent(ev);

      // bull first
      if (!bull) {
        bull = p;
        UI.setTapMode("TAP: SHOTS");
        UI.setInstruction("Now tap your shots (red). Then press Show Results.");
        renderDots();
        return;
      }

      // shots
      shots.push(p);
      renderDots();
    };

    // pointer events work best across iOS/desktop
    layer.addEventListener("pointerdown", onTap);
  }

  function bindFileInput() {
    if (!elFile) return;

    const openPicker = () => elFile.click?.();
    if (btnChoose) btnChoose.addEventListener("click", openPicker);

    elFile.addEventListener("change", () => {
      const file = elFile.files?.[0];
      if (!file) return;

      selectedFile = file;

      // iOS Safari: createObjectURL is fastest + reliable
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);

      if (elImg) {
        elImg.onload = () => {
          // ensure dots layer covers image (if your HTML uses absolute overlay)
          renderDots();
        };
        elImg.src = objectUrl;
      }

      resetAll();
      UI.setSetupLocked(true);
    });
  }

  function bindButtons() {
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        resetAll();
      });
    }

    if (btnSetup) {
      btnSetup.addEventListener("click", () => {
        // if you want setup to re-open upstream setup page:
        // window.location.href = "./target.html";
        // Otherwise, just reset taps:
        resetAll();
      });
    }

    if (btnShow) {
      btnShow.addEventListener("click", async () => {
        if (!bull || shots.length === 0) {
          UI.setInstruction("Tap bull first, then at least 1 shot.");
          return;
        }

        UI.enable(btnShow, false);
        UI.setInstruction("Computing results…");

        try {
          const data = await callBackendForResults();

          // ✅ WRITE SEC PAYLOAD + ROUTE (THIS FIXES “Missing SEC payload”)
          routeToSEC_FromBackendResult(data);
          return;
        } catch (e) {
          console.error(e);
          UI.setInstruction(`Error: ${String(e.message || e)}`);
          UI.enable(btnShow, true);
        }
      });
    }

    // default button states
    UI.enable(btnShow, false);
  }

  // ---------- init ----------
  function init() {
    // Instruction defaults (distance/moa are upstream and not shown here)
    UI.setInstruction("Tap the bull first (blue). Then tap shots (red).");
    UI.setTapMode("TAP: BULL");
    UI.setCount();
    UI.setSetupLocked(false);

    bindFileInput();
    bindTapLayer();
    bindButtons();
    renderDots();
  }

  init();
})();
