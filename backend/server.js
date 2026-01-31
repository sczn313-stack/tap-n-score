/* ============================================================
   backend/server.js (FULL REPLACEMENT) — vLOCK-SEC-DL-1
   ALL MATH HERE (truth)
   Endpoint: POST /api/score
   Inputs: distanceYds, clickValue, anchor{x,y}, hits[{x,y}]
   Output: score(0-100), windageClicks, elevClicks, arrows, dir letters, shots
============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// --- Tunables (until you add real grid calibration):
// Treat normalized delta as inches using an assumed printable span.
// If this is your Baker grid, you can tune these later.
const ASSUMED_TARGET_SPAN_IN = 23.0;

// Inches per MOA at given distance (yards)
function moaInchesAt(distanceYds) {
  return (distanceYds / 100) * 1.047;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function isPoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function avgPoints(points) {
  const s = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / points.length, y: s.y / points.length };
}

function toInchesFromNormDelta(dNorm) {
  return dNorm * ASSUMED_TARGET_SPAN_IN;
}

function clicksFromInches(inches, distanceYds, clickValue) {
  const moaIn = moaInchesAt(distanceYds);
  const moa = inches / moaIn;
  const clicks = moa / clickValue;
  return Math.abs(clicks);
}

// Score model: based on radial error in MOA from POIB to Anchor.
// This is a simple, consistent starting model (can be replaced later).
function computeScore(dxIn, dyIn, distanceYds) {
  const moaIn = moaInchesAt(distanceYds);
  const errIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
  const errMoa = errIn / moaIn;

  // Map error MOA to score
  // 0 MOA => 100
  // ~8.3 MOA => 0 (with this slope)
  const raw = 100 - (errMoa * 12.0);
  return Math.round(clamp(raw, 0, 100));
}

app.post("/api/score", (req, res) => {
  try {
    const distanceYds = Number(req.body.distanceYds) || 100;
    const clickValue = Number(req.body.clickValue) || 0.25;
    const anchor = req.body.anchor;
    const hits = Array.isArray(req.body.hits) ? req.body.hits : [];

    if (!isPoint(anchor)) return res.status(400).json({ error: "Missing/invalid anchor" });
    if (!hits.length || !hits.every(isPoint)) return res.status(400).json({ error: "Missing/invalid hits" });

    const poib = avgPoints(hits);

    // Correction vector: POIB -> Anchor (bull - poib)
    const dxNorm = anchor.x - poib.x; // + means move RIGHT
    const dyNorm = anchor.y - poib.y; // + means move DOWN (screen space)

    // Convert to inches using assumed span
    const dxIn = toInchesFromNormDelta(dxNorm);
    const dyIn = toInchesFromNormDelta(dyNorm);

    // Clicks
    const windageClicks = clicksFromInches(dxIn, distanceYds, clickValue);
    const elevClicks = clicksFromInches(dyIn, distanceYds, clickValue);

    // Directions as single letters
    const windageDir = dxNorm >= 0 ? "R" : "L";
    const elevDir = dyNorm >= 0 ? "D" : "U";

    // Arrows (visual)
    const windageArrow = dxNorm >= 0 ? "→" : "←";
    const elevArrow = dyNorm >= 0 ? "↓" : "↑";

    // Score
    const score = computeScore(dxIn, dyIn, distanceYds);

    res.json({
      shots: hits.length,
      score,
      windageClicks: Number(windageClicks.toFixed(2)),
      elevClicks: Number(elevClicks.toFixed(2)),
      windageDir,
      elevDir,
      windageArrow,
      elevArrow
    });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("SCZN3 backend listening on", PORT));
