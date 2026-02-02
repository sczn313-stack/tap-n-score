/* ============================================================
   index.js (FULL REPLACEMENT) — ROUTE-TO-SEC-LOCK-1
   Purpose:
   - Target page: choose photo → tap bull → tap shots → Results
   - Results: POST to backend (math authority = backend)
   - Store SEC payload to localStorage (SCZN3_SEC_PAYLOAD_V1)
   - Route to ./sec.html
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // UI (must exist in your docs/index.html)
  const chooseBtn  = $("chooseBtn");
  const clearBtn   = $("clearBtn");
  const resultsBtn = $("resultsBtn");
  const fileInput  = $("photoInput");

  const statusLine = $("statusLine");
  const hintLine   = $("hintLine");

  const stage   = $("stage");      // wrapper that becomes visible once image loads
  const img     = $("targetImg");  // <img>
  const tapLayer= $("tapLayer");   // overlay div on top of the image

  // Optional “chips” (if your HTML has them). If not, we fail-soft.
  const chipImgDot   = $("chipImgDot");
  const chipBullDot  = $("chipBullDot");
  const chipShotsDot = $("chipShotsDot");
  const chipImg      = $("chipImg");
  const chipBull     = $("chipBull");
  const chipShots    = $("chipShots");

  // Dots container (if your CSS uses .dot). If not present, we still run.
  // We'll draw dots into tapLayer itself.
  // Backend
  // ✅ CHANGE THIS to your Render backend base URL
  // Example: "https://YOUR-BACKEND.onrender.com"
  const API_BASE = "https://YOUR-BACKEND.onrender.com";
  const ANALYZE_URL = `${API_BASE}/api/analyze`;

  // SEC storage key
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  // State
  let selectedFile = null;
  let objectUrl = null;

  // Store taps normalized to image box (0..1)
  let bull = null;   // { nx, ny }
  let shots = [];    // [{ nx, ny }...]

  // ---------- helpers ----------
  function setStatus(msg) {
    if (statusLine) statusLine.textContent = msg;
  }

  function setHint(msg) {
    if (hintLine) hintLine.textContent = msg;
  }

  function setChip(dotEl, valueEl, ok, text) {
    if (!dotEl || !valueEl) return;
    dotEl.style.opacity = ok ? "1" : ".25";
    valueEl.textContent = text;
  }

  function clearDots() {
    if (!tapLayer) return;
    // remove any .dot elements we added
    tapLayer.querySelectorAll(".dot").forEach((n) => n.remove());
  }

  function addDot(nx, ny, kind) {
    if (!tapLayer) return;
    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${nx * 100}%`;
    d.style.top  = `${ny * 100}%`;
    tapLayer.appendChild(d);
  }

  function redraw() {
    clearDots();
    if (bull) addDot(bull.nx, bull.ny, "bull");
    for (const s of shots) addDot(s.nx, s.ny, "shot");
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function getTapNormalized(ev) {
    const rect = tapLayer.getBoundingClientRect();

    // Support pointer/touch/mouse
    const t = ev.touches && ev.touches[0];
    const clientX = t ? t.clientX : ev.clientX;
    const clientY = t ? t.clientY : ev.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    return { nx: clamp01(x), ny: clamp01(y) };
  }

  // ---------- actions ----------
  function hardReset() {
    bull = null;
    shots = [];
    redraw();

    setChip(chipBullDot, chipBull, false, "not set");
    setChip(chipShotsDot, chipShots, false, "0");
  }

  // iOS-safe file open
  chooseBtn?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;

    selectedFile = f;

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);

    img.onload = () => {
      if (stage) stage.style.display = "block";
      img.style.display = "block";

      setStatus(`Loaded ✅ ${f.name}`);
      setHint("Tap the bull first. Then tap your shots. Press Results.");

      setChip(chipImgDot, chipImg, true, f.name);

      hardReset();
    };

    img.onerror = () => {
      setStatus("Could not load image ❌");
      setChip(chipImgDot, chipImg, false, "error");
    };

    img.src = objectUrl;

    // allow re-pick same file
    fileInput.value = "";
  });

  // Tap handling (use pointerdown so it works reliably on iOS)
  function onTap(ev) {
    if (!img || !img.src) return;
    ev.preventDefault();

    const p = getTapNormalized(ev);

    if (!bull) {
      bull = p;
      setStatus("Bull set ✅");
      setChip(chipBullDot, chipBull, true, "set");
      redraw();
      return;
    }

    shots.push(p);
    setStatus(`Shot added ✅ (${shots.length})`);
    setChip(chipShotsDot, chipShots, shots.length > 0, String(shots.length));
    redraw();
  }

  tapLayer?.addEventListener("pointerdown", onTap, { passive: false });

  // Clear
  clearBtn?.addEventListener("click", () => {
    hardReset();
    setStatus("Cleared ✅");
    setHint("Tap the bull first. Then tap your shots.");
  });

  // Results → Backend → SEC payload → sec.html
  resultsBtn?.addEventListener("click", async () => {
    if (!img || !img.src) { setStatus("Choose a photo first."); return; }
    if (!bull) { setStatus("Tap the bull first."); return; }
    if (shots.length < 1) { setStatus("Tap at least 1 shot."); return; }

    setStatus("Calculating…");

    // Backend contract: send normalized points (backend is authority)
    const body = {
      bull: { x: bull.nx, y: bull.ny },
      hits: shots.map((s) => ({ x: s.nx, y: s.ny }))
    };

    try {
      const res = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setStatus(`Backend error ❌ ${res.status}`);
        console.warn("Backend error body:", t);
        return;
      }

      const data = await res.json();

      // Build SEC payload from BACKEND AUTHORITY ONLY
      const secPayload = {
        sessionId:
          data.sessionId ||
          `SEC-${Date.now().toString(36).toUpperCase()}`,

        score: Number(data.score),
        shots: Number(data.shots),

        windage: {
          dir:
            data.windage?.dir ||
            data.clicks?.windDir ||
            data.windDir ||
            "—",
          clicks:
            data.windage?.clicks ??
            data.clicks?.windage ??
            data.windageClicks ??
            0
        },

        elevation: {
          dir:
            data.elevation?.dir ||
            data.clicks?.elevDir ||
            data.elevDir ||
            "—",
          clicks:
            data.elevation?.clicks ??
            data.clicks?.elevation ??
            data.elevationClicks ??
            0
        },

        vendorUrl: data.vendorUrl || "",
        surveyUrl: data.surveyUrl || ""
      };

      localStorage.setItem(SEC_KEY, JSON.stringify(secPayload));

      setStatus("SEC ready ✅");
      window.location.href = "./sec.html";

    } catch (err) {
      console.warn(err);
      setStatus("Network error ❌");
    }
  });

  // Boot
  setStatus("Tap-n-Score loaded ✅");
  setHint("Choose a photo to begin.");
  setChip(chipImgDot, chipImg, false, "not loaded");
  setChip(chipBullDot, chipBull, false, "not set");
  setChip(chipShotsDot, chipShots, false, "0");
})();
