/* ============================================================
   frontend/index.js (FULL REPLACEMENT) — Tap-n-Score™ Shooter
   Includes:
   - Photo pick (iOS-safe)
   - Tap bull anchor + holes
   - Call backend /api/score
   - Render clicks + score
   - REAL exports:
       Download SEC (Image) via html2canvas + iOS Share Sheet
       Download SEC (Text) via blob
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  // ---- Elements
  const elTakeChoose = $("takeChooseBtn");
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elTapLayer = $("tapLayer");
  const elDots = $("dotsLayer");

  const elInstruction = $("instructionLine");
  const elTapCount = $("tapCount");
  const elClear = $("clearTapsBtn");
  const elShow = $("showResultsBtn");

  const elDistance = $("distanceYds");
  const elMoaPerClick = $("moaPerClick");
  const elW = $("widthIn");
  const elH = $("heightIn");

  const elSession = $("sessionId");
  const elUp = $("clickUp");
  const elDown = $("clickDown");
  const elLeft = $("clickLeft");
  const elRight = $("clickRight");

  const elScoreBig = $("scoreBig");
  const elScoreCurrent = $("scoreCurrent");
  const elScoreCum = $("scoreCum");

  const elDownloadImg = $("downloadSecImageBtn");
  const elDownloadText = $("downloadSecTextBtn");

  // ---- State
  let selectedFile = null;
  let objectUrl = null;

  let bull = null;        // {x,y} normalized
  let holes = [];         // [{x,y} normalized]
  let lastResult = null;  // backend payload
  let sessionId = "";

  // ---- Backend URL resolution
  // Priority:
  // 1) ?api=https://your-backend.onrender.com
  // 2) localStorage "TNS_API_BASE"
  // 3) window.API_BASE
  // 4) same origin (works if frontend+backend are on same host)
  function getApiBase() {
    const u = new URL(window.location.href);
    const qp = u.searchParams.get("api");
    if (qp && qp.startsWith("http")) {
      localStorage.setItem("TNS_API_BASE", qp.replace(/\/+$/, ""));
      return qp.replace(/\/+$/, "");
    }
    const ls = localStorage.getItem("TNS_API_BASE");
    if (ls && ls.startsWith("http")) return ls.replace(/\/+$/, "");
    if (window.API_BASE && String(window.API_BASE).startsWith("http")) {
      return String(window.API_BASE).replace(/\/+$/, "");
    }
    return ""; // same-origin
  }

  const API_BASE = getApiBase();

  // ---- Utilities
  function clampNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function toFixed2(n) {
    const x = Number(n);
    return (Number.isFinite(x) ? x : 0).toFixed(2);
  }

  function setEnabled(el, on) {
    if (!el) return;
    el.disabled = !on;
    el.setAttribute("aria-disabled", (!on).toString());
  }

  function resetAll() {
    bull = null;
    holes = [];
    lastResult = null;
    sessionId = "";

    elSession.textContent = "—";
    elUp.textContent = "0.00";
    elDown.textContent = "0.00";
    elLeft.textContent = "0.00";
    elRight.textContent = "0.00";
    elScoreBig.textContent = "—";
    elScoreCurrent.textContent = "—";
    elScoreCum.textContent = "—";

    elTapCount.textContent = "0";
    elDots.innerHTML = "";
    setEnabled(elClear, false);
    setEnabled(elShow, false);
    setEnabled(elDownloadImg, false);
    setEnabled(elDownloadText, false);
    elInstruction.textContent = "Tap the bull to anchor. Then tap your hits. Then press “Show Results”.";
  }

  function revokeUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function ensureImgLoaded() {
    return new Promise((resolve, reject) => {
      if (!elImg.src) return reject(new Error("No image src"));
      if (elImg.complete && elImg.naturalWidth > 0) return resolve();
      elImg.onload = () => resolve();
      elImg.onerror = (e) => reject(e);
    });
  }

  function getLayerRect() {
    return elTapLayer.getBoundingClientRect();
  }

  function pointToNormalized(clientX, clientY) {
    const r = getLayerRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }

  function drawDot(norm, kind) {
    // kind: "bull" | "hole"
    const r = getLayerRect();
    const xPx = norm.x * r.width;
    const yPx = norm.y * r.height;

    const d = document.createElement("div");
    d.className = `dot ${kind}`;
    d.style.left = `${xPx}px`;
    d.style.top = `${yPx}px`;
    elDots.appendChild(d);
  }

  function redrawAllDots() {
    elDots.innerHTML = "";
    if (bull) drawDot(bull, "bull");
    holes.forEach((h) => drawDot(h, "hole"));
  }

  function updateTapUi() {
    elTapCount.textContent = String(holes.length + (bull ? 1 : 0));
    setEnabled(elClear, bull !== null || holes.length > 0);
    setEnabled(elShow, bull !== null && holes.length > 0);
    if (!bull) {
      elInstruction.textContent = "Tap the bull to anchor.";
    } else if (holes.length === 0) {
      elInstruction.textContent = "Now tap your bullet holes.";
    } else {
      elInstruction.textContent = "Press “Show Results” when ready.";
    }
  }

  // ---- File picking (iOS-safe)
  elTakeChoose.addEventListener("click", () => elFile.click());

  elFile.addEventListener("change", async () => {
    const f = elFile.files && elFile.files[0];
    if (!f) return;

    resetAll();

    selectedFile = f;
    revokeUrl();
    objectUrl = URL.createObjectURL(f);
    elImg.src = objectUrl;

    try {
      await ensureImgLoaded();
      // ensure overlay layers match image area
      setEnabled(elClear, true);
      elInstruction.textContent = "Tap the bull to anchor.";
    } catch {
      alert("Could not load image.");
    }
  });

  // ---- Tap handling
  function onTap(ev) {
    if (!elImg.src) return;

    const touch = ev.touches && ev.touches[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;

    const p = pointToNormalized(clientX, clientY);

    if (!bull) {
      bull = p;
    } else {
      holes.push(p);
    }

    redrawAllDots();
    updateTapUi();
  }

  // prevent scroll/zoom on tap layer
  elTapLayer.addEventListener("touchstart", (e) => {
    e.preventDefault();
    onTap(e);
  }, { passive: false });

  elTapLayer.addEventListener("click", (e) => onTap(e));

  elClear.addEventListener("click", () => {
    bull = null;
    holes = [];
    lastResult = null;
    sessionId = "";
    redrawAllDots();
    updateTapUi();
    setEnabled(elDownloadImg, false);
    setEnabled(elDownloadText, false);
    elSession.textContent = "—";
    elUp.textContent = "0.00";
    elDown.textContent = "0.00";
    elLeft.textContent = "0.00";
    elRight.textContent = "0.00";
    elScoreBig.textContent = "—";
    elScoreCurrent.textContent = "—";
    elScoreCum.textContent = "—";
  });

  // ---- API call
  async function postScore() {
    const distanceYds = clampNum(elDistance.value, 100);
    const moaPerClick = clampNum(elMoaPerClick.value, 0.25);
    const widthIn = clampNum(elW.value, 8.5);
    const heightIn = clampNum(elH.value, 11);

    const payload = {
      bull,
      holes,
      target: { widthIn, heightIn },
      distanceYds,
      moaPerClick
    };

    const url = `${API_BASE}/api/score`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      const msg = data?.error || `Request failed (${resp.status})`;
      throw new Error(msg);
    }
    return data;
  }

  elShow.addEventListener("click", async () => {
    try {
      elShow.textContent = "Working…";
      setEnabled(elShow, false);

      const data = await postScore();
      lastResult = data;
      sessionId = data.sessionId || "";
      window.__SEC_SESSION_ID__ = sessionId;

      // Render
      elSession.textContent = sessionId || "—";
      elUp.textContent = data.clicks?.up ?? "0.00";
      elDown.textContent = data.clicks?.down ?? "0.00";
      elLeft.textContent = data.clicks?.left ?? "0.00";
      elRight.textContent = data.clicks?.right ?? "0.00";

      const sc = data.score?.current;
      elScoreBig.textContent = (sc ?? "—");
      elScoreCurrent.textContent = (sc ?? "—");
      elScoreCum.textContent = (sc ?? "—");

      setEnabled(elDownloadImg, true);
      setEnabled(elDownloadText, true);

      elInstruction.textContent = "Results ready. Download your SEC or run another session.";
    } catch (e) {
      alert(`Score failed: ${String(e?.message || e)}`);
      setEnabled(elShow, true);
    } finally {
      elShow.textContent = "Show Results";
      // only re-enable if still valid
      setEnabled(elShow, bull !== null && holes.length > 0);
    }
  });

  /* ============================================================
     REAL EXPORT: SEC Image (PNG)
     - Captures #secCard only (not the download buttons)
     - Uses iOS Share Sheet when available
  ============================================================ */
  async function exportSecPng() {
    const card = $("secCard");
    if (!card) return alert("SEC card container not found (#secCard).");
    if (!lastResult) return alert("Run “Show Results” first.");

    // Wait for paint (helps iOS)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(card, {
      backgroundColor: null,
      scale: 2,
      useCORS: true
    });

    const safe = (window.__SEC_SESSION_ID__ || "SEC").replace(/[^A-Z0-9_-]/gi, "");
    const filename = `${safe}.png`;

    canvas.toBlob(async (blob) => {
      if (!blob) return alert("Could not create image blob.");

      const file = new File([blob], filename, { type: "image/png" });

      // Best path on iOS: share sheet
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (_) {
          // user canceled → fall through
        }
      }

      // Fallback: download/open
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // If iOS ignores download attr, user can still open it:
      // window.open(url, "_blank"); // uncomment if you prefer open instead of download

      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, "image/png");
  }

  elDownloadImg.addEventListener("click", () => {
    exportSecPng().catch((e) => alert(`Export failed: ${String(e?.message || e)}`));
  });

  /* ============================================================
     REAL EXPORT: SEC Text
  ============================================================ */
  function exportSecText() {
    if (!lastResult) return alert("Run “Show Results” first.");

    const s = window.__SEC_SESSION_ID__ || "SEC";
    const lines = [
      `Tap-n-Score™ — Shooter Experience Card`,
      `Session: ${s}`,
      ``,
      `Target Clicks`,
      `Up: ${lastResult.clicks?.up ?? "0.00"}`,
      `Down: ${lastResult.clicks?.down ?? "0.00"}`,
      `Left: ${lastResult.clicks?.left ?? "0.00"}`,
      `Right: ${lastResult.clicks?.right ?? "0.00"}`,
      ``,
      `Score: ${lastResult.score?.current ?? "—"}`,
      ``,
      `Distance (yds): ${clampNum(elDistance.value, 100)}`,
      `MOA/Click: ${clampNum(elMoaPerClick.value, 0.25)}`,
      `Target (in): ${clampNum(elW.value, 8.5)} x ${clampNum(elH.value, 11)}`
    ];

    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });

    const safe = String(s).replace(/[^A-Z0-9_-]/gi, "");
    const filename = `${safe}.txt`;

    // share if possible
    const file = new File([blob], filename, { type: "text/plain" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: filename }).catch(() => {});
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  elDownloadText.addEventListener("click", exportSecText);

  // ---- Boot
  resetAll();
})();
