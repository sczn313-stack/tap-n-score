/* ============================================================
   server.js (FULL REPLACEMENT) — Tap-n-Score Backend (v1.0.1)
   Purpose:
   - Backend is the ONLY authority for click math + directions.
   - True MOA: 1.047" at 100 yards (scaled by distance).
   - Correction vector = bull - POIB (POIB = average of holes)
   - Directions derived ONLY from signed deltas:
       dx > 0 => RIGHT, dx < 0 => LEFT
       dy > 0 => DOWN  (screen-space +y), dy < 0 => UP
   - Output precision: ALWAYS two decimals (strings)
   Render hardening:
   - trust proxy enabled (Render sits behind a proxy)
   - bind to 0.0.0.0
============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// Render / proxy hygiene
app.set("trust proxy", 1);

// ---- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Helpers
function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function toFixed2(n) {
  const x = Number(n);
  return (Number.isFinite(x) ? x : 0).toFixed(2);
}

function avg(arr, key) {
  if (!arr || arr.length === 0) return 0;
  const s = arr.reduce((acc, o) => acc + clampNum(o[key], 0), 0);
  return s / arr.length;
}

// Inches per MOA at a given distance (yards)
// True MOA: 1.047" at 100y, scales linearly with distance.
function inchesPerMoa(distanceYds) {
  const d = clampNum(distanceYds, 100);
  return 1.047 * (d / 100);
}

// Score (simple + stable): based on radial distance in MOA
// 100 = perfect. Drops as error grows. Clamp 0..100.
function computeScore(radMoa) {
  const k = 10; // slope (tune later)
  const raw = 100 - radMoa * k;
  const s = Math.max(0, Math.min(100, Math.round(raw)));
  return s;
}

// Session ID
function makeSessionId() {
  const a = Math.random().toString(16).slice(2, 8).toUpperCase();
  const b = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `SEC-${a}-${b}`;
}

/* ============================================================
   POST /api/score
   Body:
   {
     bull: { x: 0..1, y: 0..1 },          // normalized
     holes: [{ x: 0..1, y: 0..1 }, ...],  // normalized
     target: { widthIn: number, heightIn: number }, // physical inches
     distanceYds: number,                 // e.g., 100
     moaPerClick: number                  // e.g., 0.25
   }
============================================================ */
app.post("/api/score", (req, res) => {
  try {
    const bull = req.body?.bull || null;
    const holes = Array.isArray(req.body?.holes) ? req.body.holes : [];
    const target = req.body?.target || {};
    const distanceYds = clampNum(req.body?.distanceYds, 100);
    const moaPerClick = clampNum(req.body?.moaPerClick, 0.25);

    const widthIn = clampNum(target.widthIn, 8.5);
    const heightIn = clampNum(target.heightIn, 11);

    if (!bull || holes.length === 0) {
      return res.status(400).json({ ok: false, error: "Missing bull or holes." });
    }

    const bullX = clampNum(bull.x, 0);
    const bullY = clampNum(bull.y, 0);

    const poibX = avg(holes, "x");
    const poibY = avg(holes, "y");

    // Correction vector (bull - POIB) in normalized units
    const dxN = bullX - poibX;
    const dyN = bullY - poibY;

    // Convert to inches using target physical size
    const dxIn = dxN * widthIn;
    const dyIn = dyN * heightIn;

    // Convert to MOA
    const ipm = inchesPerMoa(distanceYds);
    const dxMoa = dxIn / ipm;
    const dyMoa = dyIn / ipm;

    // Convert to clicks
    const dxClicks = dxMoa / moaPerClick;
    const dyClicks = dyMoa / moaPerClick;

    // Break into Up/Down/Left/Right (non-negative)
    const right = dxClicks > 0 ? dxClicks : 0;
    const left = dxClicks < 0 ? Math.abs(dxClicks) : 0;

    // screen-space Y: +dy means bull is BELOW POIB => need move POI DOWN
    const down = dyClicks > 0 ? dyClicks : 0;
    const up = dyClicks < 0 ? Math.abs(dyClicks) : 0;

    // Score
    const radMoa = Math.sqrt(dxMoa * dxMoa + dyMoa * dyMoa);
    const score = computeScore(radMoa);

    const sessionId = makeSessionId();

    return res.json({
      ok: true,
      sessionId,

      // Helpful debug (keep for now)
      poib: { x: poibX, y: poibY },
      bull: { x: bullX, y: bullY },

      delta: {
        dxIn, dyIn,
        dxMoa, dyMoa,
        dxClicks, dyClicks
      },

      // Shooter-facing values (ALWAYS 2 decimals)
      clicks: {
        up: toFixed2(up),
        down: toFixed2(down),
        left: toFixed2(left),
        right: toFixed2(right)
      },

      score: {
        current: score
      }
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(e?.message || e)
    });
  }
});

// ---- Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Optional: root ping (handy for quick browser check)
app.get("/", (_req, res) => res.send("Tap-n-Score backend OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Tap-n-Score backend running on :${PORT}`)
);
