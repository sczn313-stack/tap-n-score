/* ============================================================
   server.js — SCZN3 / Tap-n-Score SEC Backend (Clean Bridge)

   Goals:
   - Always-available health check: GET /api/health
   - Fix "Cannot GET /api/poster": GET /api/poster
   - Authoritative math endpoint: POST /api/calc
     (backend is the ONLY authority for directions)
   - Screen-space convention:
       x increases to the RIGHT
       y increases DOWN (like canvas / DOM)
     delta = bull - poib
       deltaX < 0 => move LEFT,  deltaX > 0 => move RIGHT
       deltaY < 0 => move UP,    deltaY > 0 => move DOWN

   Notes:
   - Inputs are assumed to already be in INCHES (per your system).
   - Click outputs are two decimals.
   ============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// ---- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Helpers
function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Inches per MOA at a given distance (yards)
function inchesPerMoa(distanceYds) {
  const d = clampNum(distanceYds, 0);
  // 1 MOA ≈ 1.047" at 100 yards
  return 1.047 * (d / 100);
}

function directionFromDelta(deltaX, deltaY) {
  // Screen-space: y down is positive
  const windage =
    deltaX === 0 ? "NONE" : deltaX < 0 ? "LEFT" : "RIGHT";
  const elevation =
    deltaY === 0 ? "NONE" : deltaY < 0 ? "UP" : "DOWN";
  return { windage, elevation };
}

function meanPoint(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let sx = 0, sy = 0, n = 0;
  for (const p of points) {
    const x = clampNum(p?.x, NaN);
    const y = clampNum(p?.y, NaN);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      sx += x; sy += y; n += 1;
    }
  }
  if (n === 0) return null;
  return { x: sx / n, y: sy / n };
}

// ---- Routes
app.get("/", (req, res) => {
  res.type("text").send("SCZN3 SEC backend is running. Try /api/health");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-sec-backend",
    time: new Date().toISOString()
  });
});

/**
 * Fixes the exact browser error: "Cannot GET /api/poster"
 * You can later expand this into real SEC “poster” metadata.
 */
app.get("/api/poster", (req, res) => {
  res.json({
    ok: true,
    poster: {
      name: "Tap-n-Score™",
      mode: "SEC",
      message: "Backend poster endpoint is live."
    },
    time: new Date().toISOString()
  });
});

/**
 * POST /api/calc
 * Body (recommended):
 * {
 *   "bull": {"x": 10.5, "y": 12.25},
 *   "shots": [{"x": 9.8, "y": 13.1}, {"x": 10.2, "y": 12.9}],
 *   "distanceYds": 100,
 *   "clickMoa": 0.25
 * }
 *
 * All x/y are in INCHES.
 */
app.post("/api/calc", (req, res) => {
  try {
    const bull = req.body?.bull;
    const shots = req.body?.shots;

    const bullX = clampNum(bull?.x, NaN);
    const bullY = clampNum(bull?.y, NaN);

    if (!Number.isFinite(bullX) || !Number.isFinite(bullY)) {
      return res.status(400).json({
        ok: false,
        error: "bull.x and bull.y are required numbers (in inches)."
      });
    }

    const poib = meanPoint(shots);
    if (!poib) {
      return res.status(400).json({
        ok: false,
        error: "shots must be a non-empty array of {x,y} numbers (in inches)."
      });
    }

    const distanceYds = clampNum(req.body?.distanceYds, 100);
    const clickMoa = clampNum(req.body?.clickMoa, 0.25);

    const ipm = inchesPerMoa(distanceYds);
    if (!(ipm > 0) || !(clickMoa > 0)) {
      return res.status(400).json({
        ok: false,
        error: "distanceYds and clickMoa must be > 0."
      });
    }

    // delta = bull - poib (screen-space)
    const deltaX = bullX - poib.x;
    const deltaY = bullY - poib.y;

    const { windage, elevation } = directionFromDelta(deltaX, deltaY);

    // Convert inches -> MOA -> clicks
    const moaX = Math.abs(deltaX) / ipm;
    const moaY = Math.abs(deltaY) / ipm;

    const clicksX = moaX / clickMoa;
    const clicksY = moaY / clickMoa;

    res.json({
      ok: true,
      inputs: {
        distanceYds,
        clickMoa
      },
      bull: { x: bullX, y: bullY },
      poib: { x: round2(poib.x), y: round2(poib.y) },
      delta: {
        x: round2(deltaX),
        y: round2(deltaY)
      },
      directions: {
        windage,
        elevation
      },
      clicks: {
        windage: round2(clicksX),
        elevation: round2(clicksY)
      }
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Server error",
      detail: String(err?.message || err)
    });
  }
});

// ---- Start
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`SEC backend listening on port ${port}`);
});
