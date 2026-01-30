/* ============================================================
   frontend/index.js (FULL REPLACEMENT) — Tap-n-Score (SEC Export Brick)
   Adds:
   - Real "Download SEC (Image)" PNG export
   - Real "Download SEC (Text)" TXT export
   - First tap = bull anchor; subsequent taps = holes
   - Calls backend POST /api/score

   Assumptions (IDs in your HTML):
     photoInput
     targetImg
     targetWrap
     dotsLayer
     tapCount
     instructionLine
     clearTapsBtn
     seeResultsBtn

     distanceYds (optional input)
     moaPerClick (optional input)
     targetWidthIn (optional input)
     targetHeightIn (optional input)

     sessionIdLine (or sessionId)
     clickUp, clickDown, clickLeft, clickRight
     scoreCurrent

     downloadSecImageBtn
     downloadSecTextBtn

   Backend base URL:
     - Defaults to https://tap-n-score.onrender.com
     - Override by setting: window.API_BASE = "https://YOUR.onrender.com"
       OR localStorage.setItem("TNS_API_BASE", "https://YOUR.onrender.com")
============================================================ */

(() => {
  // ---------- tiny helpers
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nnum = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  // ---------- config
  const API_BASE =
    (window.API_BASE ||
      window.__API_BASE__ ||
      localStorage.getItem("TNS_API_BASE") ||
      "https://tap-n-score.onrender.com").replace(/\/+$/, "");

  const API_SCORE = `${API_BASE}/api/score`;

  // ---------- elements (graceful if missing)
  const elFile = $("photoInput");
  const elImg = $("targetImg");
  const elWrap = $("targetWrap");
  const elDots = $("dotsLayer");

  const elTapCount = $("tapCount");
  const elInstruction = $("instructionLine");
  const elClear = $("clearTapsBtn");
  const elSeeResults = $("seeResultsBtn");

  const elDistance = $("distanceYds");
  const elMoaPerClick = $("moaPerClick");
  const elWIn = $("targetWidthIn");
  const elHIn = $("targetHeightIn");

  const elSession = $("sessionIdLine") || $("sessionId");
  const elUp = $("clickUp");
  const elDown = $("clickDown");
  const elLeft = $("clickLeft");
  const elRight = $("clickRight");
  const elScore = $("scoreCurrent");

  const elDlImg = $("downloadSecImageBtn");
  const elDlTxt = $("downloadSecTextBtn");

  // ---------- state
  let objectUrl = null;
  let selectedFile = null;

  // bull = {x,y} normalized; holes = [{x,y}...]
  let bull = null;
  let holes = [];

  // last response from backend
  let lastSEC = null;

  // ---------- UI text helpers
  function setInstruction(msg) {
    if (elInstruction) elInstruction.textContent = msg;
  }

  function setTapCount() {
    if (!elTapCount) return;
    const bullDone = bull ? 1 : 0;
    elTapCount.textContent = `Bull: ${bullDone} • Holes: ${holes.length}`;
  }

  function clearDots() {
    if (!elDots) return;
    elDots.innerHTML = "";
  }

  function drawDot(px, py, kind) {
    if (!elDots) return;
    const d = document.createElement("div");
    d.className = `tapDot ${kind || "hole"}`; // you can style .tapDot.bull vs .tapDot.hole in CSS
    d.style.position = "absolute";
    d.style.left = `${px}px`;
    d.style.top = `${py}px`;
    d.style.transform = "translate(-50%, -50%)";
    d.style.width = kind === "bull" ? "16px" : "14px";
    d.style.height = kind === "bull" ? "16px" : "14px";
    d.style.borderRadius = "999px";
    d.style.border = kind === "bull" ? "2px solid rgba(255,255,255,0.9)" : "2px solid rgba(255,255,255,0.65)";
    d.style.background = kind === "bull" ? "rgba(255,0,0,0.85)" : "rgba(0,160,255,0.85)";
    d.style.boxShadow = "0 6px 16px rgba(0,0,0,0.35)";
    elDots.appendChild(d);
  }

  function redrawAllDots() {
    clearDots();
    // bull first
    if (bull && elImg) {
      const { w, h } = getImageDrawSize();
      drawDot(bull.x * w, bull.y * h, "bull");
    }
    // holes
    if (holes.length && elImg) {
      const { w, h } = getImageDrawSize();
      holes.forEach((p) => drawDot(p.x * w, p.y * h, "hole"));
    }
  }

  // ---------- image sizing helpers
  function getImageDrawSize() {
    // We position dots relative to the displayed image size.
    // Using getBoundingClientRect is safest on mobile.
    const r = elImg?.getBoundingClientRect?.();
    const w = r ? r.width : elImg?.clientWidth || 1;
    const h = r ? r.height : elImg?.clientHeight || 1;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  function getTapNormalizedFromEvent(evt) {
    const imgRect = elImg.getBoundingClientRect();
    const clientX = evt.touches?.[0]?.clientX ?? evt.clientX;
    const clientY = evt.touches?.[0]?.clientY ?? evt.clientY;

    const xPx = clientX - imgRect.left;
    const yPx = clientY - imgRect.top;

    const xN = clamp(xPx / imgRect.width, 0, 1);
    const yN = clamp(yPx / imgRect.height, 0, 1);

    return { x: xN, y: yN };
  }

  // ---------- file handling
  function setImageFromFile(file) {
    if (!file) return;

    // revoke old
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    selectedFile = file;
    objectUrl = URL.createObjectURL(file);

    // reset taps
    bull = null;
    holes = [];
    lastSEC = null;

    setTapCount();
    setInstruction("Tap the bull (aim point) once to anchor it.");
    clearDots();

    if (elImg) {
      elImg.onload = () => {
        // ensure dots redraw after layout
        setTimeout(() => redrawAllDots(), 50);
      };
      elImg.src = objectUrl;
    }
  }

  // ---------- tap handling
  function onTap(evt) {
    if (!elImg) return;
    // if you tapped outside image, ignore
    const r = elImg.getBoundingClientRect();
    const x = evt.touches?.[0]?.clientX ?? evt.clientX;
    const y = evt.touches?.[0]?.clientY ?? evt.clientY;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;

    evt.preventDefault?.();

    const p = getTapNormalizedFromEvent(evt);

    if (!bull) {
      bull = p;
      setInstruction("Bull anchored. Now tap each bullet hole.");
    } else {
      holes.push(p);
      setInstruction("Tap bullet holes. When ready, press “Show Results”.");
    }

    setTapCount();
    redrawAllDots();
  }

  // ---------- backend call
  async function postScore() {
    if (!bull || holes.length === 0) {
      alert("Need bull + at least 1 hole.");
      return;
    }

    const distanceYds = nnum(elDistance?.value, 100);
    const moaPerClick = nnum(elMoaPerClick?.value, 0.25);
    const widthIn = nnum(elWIn?.value, 8.5);
    const heightIn = nnum(elHIn?.value, 11);

    const payload = {
      bull,
      holes,
      target: { widthIn, heightIn },
      distanceYds,
      moaPerClick
    };

    setInstruction("Computing…");

    let resp;
    try {
      resp = await fetch(API_SCORE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      setInstruction("Network error.");
      alert(`Backend not reachable.\n\nAPI: ${API_SCORE}\n\n${String(e?.message || e)}`);
      return;
    }

    let data = null;
    try {
      data = await resp.json();
    } catch (e) {
      // ignore
    }

    if (!resp.ok || !data?.ok) {
      setInstruction("Error.");
      alert(`Backend error.\n\n${data?.error || resp.statusText || "Unknown error"}`);
      return;
    }

    lastSEC = {
      ...data,
      input: payload
    };

    renderSEC(lastSEC);
    setInstruction("Results ready. Download your SEC or run another tap set.");
  }

  // ---------- render results into the UI
  function renderSEC(sec) {
    if (!sec) return;

    const sid = sec.sessionId || "SEC-UNKNOWN";
    if (elSession) elSession.textContent = `Session: ${sid}`;

    const c = sec.clicks || {};
    if (elUp) elUp.textContent = c.up ?? "0.00";
    if (elDown) elDown.textContent = c.down ?? "0.00";
    if (elLeft) elLeft.textContent = c.left ?? "0.00";
    if (elRight) elRight.textContent = c.right ?? "0.00";

    const sc = sec.score?.current;
    if (elScore) elScore.textContent = Number.isFinite(Number(sc)) ? String(sc) : "—";

    // enable downloads
    if (elDlImg) elDlImg.disabled = false;
    if (elDlTxt) elDlTxt.disabled = false;
  }

  // ---------- export helpers
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function secFilenameBase(sec) {
    const sid = (sec?.sessionId || "SEC").replace(/[^A-Za-z0-9_-]+/g, "_");
    return sid;
  }

  // ---------- SEC TEXT export
  function buildSecText(sec) {
    const sid = sec.sessionId || "SEC-UNKNOWN";
    const c = sec.clicks || {};
    const score = sec.score?.current;

    const distanceYds = sec.input?.distanceYds ?? 100;
    const moaPerClick = sec.input?.moaPerClick ?? 0.25;
    const wIn = sec.input?.target?.widthIn ?? 8.5;
    const hIn = sec.input?.target?.heightIn ?? 11;

    const lines = [
      "TAP-N-SCORE™ — Shooter Experience Card (SEC)",
      "",
      `Session: ${sid}`,
      "",
      `Target: ${wIn}in × ${hIn}in`,
      `Distance: ${distanceYds} yards`,
      `MOA/Click: ${moaPerClick}`,
      "",
      "Target Clicks (two decimals):",
      `  Up:    ${c.up ?? "0.00"}`,
      `  Down:  ${c.down ?? "0.00"}`,
      `  Left:  ${c.left ?? "0.00"}`,
      `  Right: ${c.right ?? "0.00"}`,
      "",
      `Score: ${Number.isFinite(Number(score)) ? score : "—"}`,
      "",
      "Note: directions are computed by backend authority only."
    ];

    return lines.join("\n");
  }

  function exportSecText() {
    if (!lastSEC) {
      alert("Run a score first.");
      return;
    }
    const txt = buildSecText(lastSEC);
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${secFilenameBase(lastSEC)}.txt`);
  }

  // ---------- SEC IMAGE export (PNG)
  function exportSecImage() {
    if (!lastSEC) {
      alert("Run a score first.");
      return;
    }

    const sec = lastSEC;
    const sid = sec.sessionId || "SEC-UNKNOWN";
    const c = sec.clicks || {};
    const score = sec.score?.current;

    // High-res canvas
    const W = 1200;
    const H = 1600;
    const pad = 72;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // background gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1630");
    g.addColorStop(1, "#05080f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // subtle glow
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#00a0ff";
    ctx.beginPath();
    ctx.ellipse(W * 0.72, H * 0.25, 420, 260, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // header
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("TAP-N-SCORE™", pad, pad + 20);

    ctx.globalAlpha = 0.85;
    ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("After-Shot Intelligence", pad, pad + 70);
    ctx.globalAlpha = 1;

    // session line
    ctx.globalAlpha = 0.85;
    ctx.font = "500 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Session: ${sid}`, pad, pad + 130);
    ctx.globalAlpha = 1;

    // clicks card
    const cardX = pad;
    const cardY = pad + 190;
    const cardW = W - pad * 2;
    const cardH = 330;

    roundRect(ctx, cardX, cardY, cardW, cardH, 36, "rgba(255,255,255,0.06)", "rgba(255,255,255,0.14)");

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Target Clicks", cardX + 48, cardY + 78);

    // two columns
    ctx.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.globalAlpha = 0.85;
    ctx.fillText("Up", cardX + 48, cardY + 140);
    ctx.fillText("Down", cardX + cardW * 0.55, cardY + 140);

    ctx.fillText("Left", cardX + 48, cardY + 250);
    ctx.fillText("Right", cardX + cardW * 0.55, cardY + 250);
    ctx.globalAlpha = 1;

    ctx.font = "800 78px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(c.up ?? "0.00"), cardX + 48, cardY + 210);
    ctx.fillText(String(c.down ?? "0.00"), cardX + cardW * 0.55, cardY + 210);

    ctx.fillText(String(c.left ?? "0.00"), cardX + 48, cardY + 320);
    ctx.fillText(String(c.right ?? "0.00"), cardX + cardW * 0.55, cardY + 320);

    // score card
    const sX = pad;
    const sY = cardY + cardH + 60;
    const sW = W - pad * 2;
    const sH = 420;

    roundRect(ctx, sX, sY, sW, sH, 36, "rgba(255,255,255,0.06)", "rgba(255,255,255,0.14)");

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Score", sX + 48, sY + 78);

    ctx.fillStyle = "#f6c85f";
    ctx.font = "900 220px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(String(Number.isFinite(Number(score)) ? score : "—"), sX + 48, sY + 290);

    // footer note
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = "#ffffff";
    ctx.font = "500 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Generated by Tap-n-Score™ (backend-authoritative directions)", pad, H - pad + 10);
    ctx.globalAlpha = 1;

    canvas.toBlob((blob) => {
      if (!blob) {
        alert("Could not generate PNG.");
        return;
      }
      downloadBlob(blob, `${secFilenameBase(sec)}.png`);
    }, "image/png");
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // ---------- bind events
  if (elFile) {
    elFile.addEventListener("change", (e) => {
      const f = e.target?.files?.[0] || null;
      if (f) setImageFromFile(f);
    });
  }

  // tap layer: prefer the wrapper so taps work even if image has pointer-events:none
  const tapTarget = elWrap || elImg;
  if (tapTarget) {
    tapTarget.addEventListener("click", onTap, { passive: false });
    tapTarget.addEventListener("touchstart", onTap, { passive: false });
  }

  if (elClear) {
    elClear.addEventListener("click", () => {
      bull = null;
      holes = [];
      lastSEC = null;
      setTapCount();
      clearDots();
      setInstruction("Tap the bull (aim point) once to anchor it.");
      if (elDlImg) elDlImg.disabled = true;
      if (elDlTxt) elDlTxt.disabled = true;
    });
  }

  if (elSeeResults) {
    elSeeResults.addEventListener("click", postScore);
  }

  if (elDlImg) {
    elDlImg.disabled = true;
    elDlImg.addEventListener("click", exportSecImage);
  }

  if (elDlTxt) {
    elDlTxt.disabled = true;
    elDlTxt.addEventListener("click", exportSecText);
  }

  // ---------- initial state
  setTapCount();
  setInstruction("Take or choose a target photo to begin.");

  // quick health sanity (optional; silent)
  // fetch(`${API_BASE}/health`).catch(() => {});
})();
