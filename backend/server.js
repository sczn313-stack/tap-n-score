/* ============================================================
   server.js — SCZN3 / Tap-n-Score SEC Backend (Truth Authority)

   Goals:
   - Always-available health check: GET /api/health
   - Fix "Cannot GET /api/poster": GET /api/poster
   - Authoritative math endpoint: POST /api/calc
     Backend becomes the authority for movement math.

   IMPORTANT:
   - Backward compatible:
     A) Inches mode (existing):
        { bull:{x,y}, shots:[{x,y}], distanceYds, clickMoa }

     B) Normalized mode (NEW - preferred truth):
        {
          aim:{x01,y01},
          hits:[{x01,y01}, ...],
          target:{ wIn, hIn },   // inches
          distanceYds,
          dialUnit: "MOA" | "MRAD",
          clickValue
        }

   Conventions:
   - Screen-space: x RIGHT positive, y DOWN positive
   - delta = bull - poib
   - Two-decimal clicks ALWAYS
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

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

// Inches per MOA at a given distance (yards)
function inchesPerMoa(distanceYds) {
  const d = clampNum(distanceYds, 0);
  return 1.047 * (d / 100); // 1 MOA ≈ 1.047" at 100y
}

// Inches per MRAD at a given distance (yards)
// Using your pilot approximation (keeps behavior consistent with your UI)
function inchesPerMrad(distanceYds) {
  const d = clampNum(distanceYds, 0);
  return 3.6 * (d / 100);
}

function directionFromDelta(deltaX, deltaY) {
  const windage = deltaX === 0 ? "NONE" : deltaX < 0 ? "LEFT" : "RIGHT";
  const elevation = deltaY === 0 ? "NONE" : deltaY < 0 ? "UP" : "DOWN";
  return { windage, elevation };
}

function meanPoint(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let sx = 0, sy = 0, n = 0;
  for (const p of points) {
    const x = clampNum(p?.x, NaN);
    const y = clampNum(p?.y, NaN);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      sx += x;
      sy += y;
      n += 1;
    }
  }
  if (n === 0) return null;
  return { x: sx / n, y: sy / n };
}

function meanPoint01(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let sx = 0, sy = 0, n = 0;
  for (const p of points) {
    const x01 = clamp01(p?.x01);
    const y01 = clamp01(p?.y01);
    sx += x01;
    sy += y01;
    n += 1;
  }
  if (n === 0) return null;
  return { x01: sx / n, y01: sy / n };
}

// Square-based conversion: normalized deltas -> inches deltas
// This is the fix that removes rectangle bias.
function delta01ToInches(dx01, dy01, targetWIn, targetHIn) {
  const w = Math.max(1, clampNum(targetWIn, 23));
  const h = Math.max(1, clampNum(targetHIn, 35));

  // SCZN3 rule: grid is square; movement uses ONE physical scale for both axes
  const scaleIn = Math.min(w, h);

  return {
    inchesX: dx01 * scaleIn,
    inchesY: dy01 * scaleIn,
    scaleIn
  };
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
 *
 * Supports TWO input modes:
 *
 * 1) INCHES MODE (backward compatible):
 * {
 *   bull: {x,y},
 *   shots: [{x,y},...],
 *   distanceYds: 100,
 *   clickMoa: 0.25
 * }
 *
 * 2) NORMALIZED MODE (truth mode — recommended):
 * {
 *   aim: {x01,y01},
 *   hits: [{x01,y01},...],
 *   target: { wIn, hIn },
 *   distanceYds: 100,
 *   dialUnit: "MOA" | "MRAD",
 *   clickValue: 0.25
 * }
 */
app.post("/api/calc", (req, res) => {
  try {
    const body = req.body || {};

    // ---------- Detect mode
    const hasNormalized =
      body?.aim && Number.isFinite(Number(body?.aim?.x01)) && Number.isFinite(Number(body?.aim?.y01)) &&
      Array.isArray(body?.hits) && body.hits.length > 0;

    const hasInches =
      body?.bull && Number.isFinite(Number(body?.bull?.x)) && Number.isFinite(Number(body?.bull?.y)) &&
      Array.isArray(body?.shots) && body.shots.length > 0;

    if (!hasNormalized && !hasInches) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing inputs. Provide either (A) bull+shots in inches or (B) aim+hits normalized (0–1) with target wIn/hIn."
      });
    }

    // ---------- Shared settings
    const distanceYds = clampNum(body?.distanceYds, 100);
    if (!(distanceYds > 0)) {
      return res.status(400).json({ ok: false, error: "distanceYds must be > 0." });
    }

    // ---------- NORMALIZED MODE (NEW TRUTH)
    if (hasNormalized) {
      const aim = { x01: clamp01(body.aim.x01), y01: clamp01(body.aim.y01) };
      const avgHit = meanPoint01(body.hits);
      if (!avgHit) {
        return res.status(400).json({ ok: false, error: "hits must be a non-empty array of {x01,y01}." });
      }

      // delta01 = bull - poib (still normalized)
      const dx01 = aim.x01 - avgHit.x01;
      const dy01 = aim.y01 - avgHit.y01;

      // target inches
      const wIn = clampNum(body?.target?.wIn, 23);
      const hIn = clampNum(body?.target?.hIn, 35);

      // FIX: square scaling
      const { inchesX, inchesY, scaleIn } = delta01ToInches(dx01, dy01, wIn, hIn);

      const { windage, elevation } = directionFromDelta(inchesX, inchesY);

      const dialUnit = (String(body?.dialUnit || "MOA").toUpperCase() === "MRAD") ? "MRAD" : "MOA";
      const clickValue = clampNum(body?.clickValue, dialUnit === "MRAD" ? 0.10 : 0.25);
      if (!(clickValue > 0)) {
        return res.status(400).json({ ok: false, error: "clickValue must be > 0." });
      }

      const ipu = (dialUnit === "MOA") ? inchesPerMoa(distanceYds) : inchesPerMrad(distanceYds);
      if (!(ipu > 0)) {
        return res.status(400).json({ ok: false, error: "Invalid distanceYds." });
      }

      const unitsX = Math.abs(inchesX) / ipu;
      const unitsY = Math.abs(inchesY) / ipu;

      const clicksX = unitsX / clickValue;
      const clicksY = unitsY / clickValue;

      return res.json({
        ok: true,
        mode: "normalized_truth",
        inputs: {
          distanceYds,
          dialUnit,
          clickValue: round2(clickValue),
          target: { wIn: round2(wIn), hIn: round2(hIn) },
          scaleIn: round2(scaleIn)
        },
        aim01: { x01: round2(aim.x01), y01: round2(aim.y01) },
        poib01: { x01: round2(avgHit.x01), y01: round2(avgHit.y01) },
        deltaInches: { x: round2(inchesX), y: round2(inchesY) },
        directions: { windage, elevation },
        clicks: {
          windage: round2(clicksX),
          elevation: round2(clicksY)
        }
      });
    }

    // ---------- INCHES MODE (BACKWARD COMPATIBLE)
    const bullX = clampNum(body?.bull?.x, NaN);
    const bullY = clampNum(body?.bull?.y, NaN);
    if (!Number.isFinite(bullX) || !Number.isFinite(bullY)) {
      return res.status(400).json({ ok: false, error: "bull.x and bull.y are required numbers (in inches)." });
    }

    const poib = meanPoint(body?.shots);
    if (!poib) {
      return res.status(400).json({
        ok: false,
        error: "shots must be a non-empty array of {x,y} numbers (in inches)."
      });
    }

    const clickMoa = clampNum(body?.clickMoa, 0.25);
    const ipm = inchesPerMoa(distanceYds);
    if (!(ipm > 0) || !(clickMoa > 0)) {
      return res.status(400).json({ ok: false, error: "distanceYds and clickMoa must be > 0." });
    }

    // delta = bull - poib (inches)
    const deltaX = bullX - poib.x;
    const deltaY = bullY - poib.y;

    const { windage, elevation } = directionFromDelta(deltaX, deltaY);

    const moaX = Math.abs(deltaX) / ipm;
    const moaY = Math.abs(deltaY) / ipm;

    const clicksX = moaX / clickMoa;
    const clicksY = moaY / clickMoa;

    return res.json({
      ok: true,
      mode: "inches_legacy",
      inputs: { distanceYds, clickMoa: round2(clickMoa) },
      bull: { x: round2(bullX), y: round2(bullY) },
      poib: { x: round2(poib.x), y: round2(poib.y) },
      delta: { x: round2(deltaX), y: round2(deltaY) },
      directions: { windage, elevation },
      clicks: { windage: round2(clicksX), elevation: round2(clicksY) }
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
