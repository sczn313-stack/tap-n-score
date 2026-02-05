/* ============================================================
   download.js (FULL REPLACEMENT) — 22206d4
   Fixes:
   - OLD page expected ?img=...
   - NEW system uses sec.html?payload=... + localStorage payload
   Now:
   - Build SEC preview from payload (query OR localStorage)
   - Render as SVG, display in <img>
   - Download as PNG (SVG -> canvas -> PNG)
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const elImg = $("secImg");
  const elMsg = $("msgLine");
  const elDiag = $("diag");
  const elDl = $("downloadBtn");
  const elScoreAnother = $("scoreAnotherBtn");
  const elBack = $("backBtn");

  const KEY = "SCZN3_SEC_PAYLOAD_V1";

  function qs(name) {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }

  function safeParsePayload() {
    // 1) payload in URL
    const p = qs("payload");
    if (p) {
      try {
        const json = decodeURIComponent(escape(atob(p)));
        return JSON.parse(json);
      } catch {}
    }

    // 2) localStorage
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}

    return null;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  // LED “dot” style digits using simple rounded rectangles (clean + calm)
  function ledDigitSVG(d, x, y, s, color) {
    // 7-seg mapping
    const seg = {
      0: [1,1,1,1,1,1,0],
      1: [0,1,1,0,0,0,0],
      2: [1,1,0,1,1,0,1],
      3: [1,1,1,1,0,0,1],
      4: [0,1,1,0,0,1,1],
      5: [1,0,1,1,0,1,1],
      6: [1,0,1,1,1,1,1],
      7: [1,1,1,0,0,0,0],
      8: [1,1,1,1,1,1,1],
      9: [1,1,1,1,0,1,1],
    }[d];

    const on = seg || [0,0,0,0,0,0,0];

    const w = 60 * s, h = 110 * s;
    const t = 12 * s; // thickness
    const r = 6 * s;

    // segments: A,B,C,D,E,F,G
    const A = [x + t, y, w - 2*t, t];
    const B = [x + w - t, y + t, t, (h/2) - (1.5*t)];
    const C = [x + w - t, y + (h/2) + (0.5*t), t, (h/2) - (1.5*t)];
    const D = [x + t, y + h - t, w - 2*t, t];
    const E = [x, y + (h/2) + (0.5*t), t, (h/2) - (1.5*t)];
    const F = [x, y + t, t, (h/2) - (1.5*t)];
    const G = [x + t, y + (h/2) - (t/2), w - 2*t, t];

    const rect = ([rx, ry, rw, rh], isOn) => {
      const op = isOn ? 1 : 0.10;
      const glow = isOn ? `filter="url(#glow)"` : "";
      return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="${r}" ry="${r}"
        fill="${color}" opacity="${op}" ${glow} />`;
    };

    return [
      rect(A, on[0]),
      rect(B, on[1]),
      rect(C, on[2]),
      rect(D, on[3]),
      rect(E, on[4]),
      rect(F, on[5]),
      rect(G, on[6]),
    ].join("\n");
  }

  function buildSECsvg(payload) {
    const scoreRaw = Number(payload?.score ?? 0);
    const score = clamp(Math.round(scoreRaw), 0, 100);

    const wDir = payload?.windage?.dir ?? "RIGHT";
    const wClicks = Number(payload?.windage?.clicks ?? 0).toFixed(2);

    const eDir = payload?.elevation?.dir ?? "UP";
    const eClicks = Number(payload?.elevation?.clicks ?? 0).toFixed(2);

    const shots = payload?.shots ?? 0;

    // Pale yellow request for 25 example (we’ll use pale yellow for ALL scores)
    const ledColor = "#F6E79A"; // pale warm yellow

    const scoreStr = score === 100 ? "100" : String(score).padStart(2, "0");

    // Center layout
    const canvasW = 1200;
    const canvasH = 700;

    // digit sizing + centering
    const s = 3.2;              // scale factor
    const digitW = 60*s;
    const gap = 26*s;

    const totalW = (scoreStr.length === 3)
      ? (digitW*3 + gap*2)
      : (digitW*2 + gap);

    const startX = (canvasW - totalW) / 2;
    const startY = 180;

    const digits = scoreStr.split("").map((ch, i) => {
      const x = startX + i*(digitW + gap);
      return ledDigitSVG(Number(ch), x, startY, s, ledColor);
    }).join("\n");

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b0f18"/>
      <stop offset="1" stop-color="#06070a"/>
    </linearGradient>

    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0.03)"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>

  <!-- Header -->
  <text x="70" y="95" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="64" font-weight="800" fill="#ffffff" opacity="0.95">TAP-N-SCORE™</text>
  <text x="70" y="145" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="40" font-weight="700" fill="#cfd6e6" opacity="0.85">After-Shot Intelligence</text>

  <!-- Card -->
  <rect x="70" y="185" width="1060" height="420" rx="36" fill="url(#card)" stroke="rgba(255,255,255,0.10)"/>

  <!-- LED Score -->
  ${digits}

  <!-- Small “You’re here / Get better” line (calm) -->
  <text x="600" y="545" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="40" font-weight="800" fill="#ffffff" opacity="0.92">U R Here!  Keep Going.</text>

  <!-- Corrections -->
  <text x="110" y="635" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="32" font-weight="700" fill="#cfd6e6" opacity="0.9">
    Windage: ${wDir} ${wClicks}  •  Elevation: ${eDir} ${eClicks}  •  Shots: ${shots}
  </text>

  <!-- Footer mark -->
  <text x="1090" y="670" text-anchor="end"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="26" font-weight="800" fill="#ffffff" opacity="0.35">SCZN3</text>
</svg>
`.trim();
  }

  function svgToDataUrl(svg) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  async function svgToPngDataUrl(svg, outW = 1200, outH = 700) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = outW;
        c.height = outH;
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);
        try {
          resolve(c.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = svgToDataUrl(svg);
    });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function setMsg(t) {
    if (elMsg) elMsg.textContent = t || "";
  }

  // ---- Boot
  const payload = safeParsePayload();

  const diag = {
    ok: !!payload,
    reason: payload ? "loaded payload" : "missing payload",
    gotQueryPayload: !!qs("payload"),
    gotLocalStoragePayload: (() => {
      try { return !!localStorage.getItem(KEY); } catch { return false; }
    })(),
    baseLocked: "/tap-n-score/",
    nav: {
      scoreAnother: "./index.html?fresh=" + Date.now(),
      backToSetup: "./index.html?fresh=" + Date.now(),
    }
  };

  if (elDiag) elDiag.textContent = JSON.stringify(diag, null, 2);

  if (!payload) {
    setMsg("No SEC payload found. Go back and hit Show results first.");
    if (elImg) elImg.removeAttribute("src");
    if (elDl) elDl.disabled = true;
  } else {
    const svg = buildSECsvg(payload);
    const svgUrl = svgToDataUrl(svg);
    elImg.src = svgUrl;
    setMsg("Preview ready. Download PNG, or press-and-hold to Save to Photos.");
  }

  // Buttons
  if (elScoreAnother) elScoreAnother.addEventListener("click", () => {
    window.location.href = "./index.html?fresh=" + Date.now();
  });

  if (elBack) elBack.addEventListener("click", () => {
    window.location.href = "./index.html?fresh=" + Date.now();
  });

  if (elDl) elDl.addEventListener("click", async () => {
    try {
      const payloadNow = safeParsePayload();
      if (!payloadNow) {
        alert("No SEC payload found. Go back and hit Show results first.");
        return;
      }
      const svg = buildSECsvg(payloadNow);
      const pngUrl = await svgToPngDataUrl(svg, 1200, 700);
      downloadDataUrl(pngUrl, "SEC.png");
    } catch (e) {
      alert("Download failed. Try press-and-hold the image → Save to Photos.");
    }
  });
})();
