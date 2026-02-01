/* ============================================================
   server.js (FULL REPLACEMENT) — Tap-n-Score Backend (Render)
   What you get:
   - GET  /api/health         (simple “am I live?”)
   - GET  /api/test-analyze   (proves the route exists)
   - POST /api/analyze        (expects { anchor:{x,y}, hits:[{x,y},...] })
   Notes:
   - Backend is the ONLY authority for direction labels.
   - Screen-space Y is used (down = +Y).
     • UP   when (bull.y - poib.y) < 0
     • DOWN when (bull.y - poib.y) > 0
     • RIGHT when (bull.x - poib.x) > 0
     • LEFT  when (bull.x - poib.x) < 0
   ============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// ---- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Helpers
function clampNum(n, fallback = null) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function isPoint(p) {
  if (!p || typeof p !== "object") return false;
  const x = clampNum(p.x, null);
  const y = clampNum(p.y, null);
  return x !== null && y !== null;
}

function avgPoint(points) {
  let sx = 0, sy = 0, c = 0;
  for (const p of points) {
    if (!isPoint(p)) continue;
    sx += Number(p.x);
    sy += Number(p.y);
    c++;
  }
  if (!c) return null;
  return { x: sx / c, y: sy / c };
}

function directionFromDelta(deltaX, deltaY) {
  // delta = bull - poib (vector from POIB to Bull)
  // Screen-space Y: down = +. Therefore:
  // bull above poib => deltaY < 0 => UP
  const horiz = deltaX > 0 ? "RIGHT" : deltaX < 0 ? "LEFT" : "NONE";
  const vert  = deltaY > 0 ? "DOWN"  : deltaY < 0 ? "UP"   : "NONE";
  return { horiz, vert };
}

// ---- Routes
app.get("/", (req, res) => {
  res.type("text").send("Tap-n-Score backend is running. Try /api/health");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "tap-n-score-backend",
    fingerprint: process.env.FINGERPRINT || "no-fingerprint-set",
    time: new Date().toISOString(),
  });
});

// Simple “does the route exist?” test
app.get("/api/test-analyze", (req, res) => {
  res.json({
    ok: true,
    route: "/api/test-analyze",
    anchor: { x: 0.5, y: 0.5 },
    hits: [
      { x: 0.55, y: 0.48 },
      { x: 0.52, y: 0.50 },
      { x: 0.58, y: 0.46 },
    ],
    note: "POST /api/analyze with {anchor:{x,y}, hits:[{x,y}...]}",
  });
});

app.post("/api/analyze", (req, res) => {
  try {
    const body = req.body || {};
    const anchor = body.anchor;
    const hits = Array.isArray(body.hits) ? body.hits : [];

    if (!isPoint(anchor)) {
      return res.status(400).json({ error: "Missing/invalid anchor" });
    }
    if (!hits.length) {
      return res.status(400).json({ error: "Missing/invalid hits" });
    }
    for (const h of hits) {
      if (!isPoint(h)) {
        return res.status(400).json({ error: "One or more hits are invalid" });
      }
    }

    // POIB = average of hits
    const poib = avgPoint(hits);
    if (!poib) {
      return res.status(400).json({ error: "Could not compute POIB" });
    }

    // Correction vector: POIB -> Bull (bull - poib)
    const deltaX = Number(anchor.x) - Number(poib.x);
    const deltaY = Number(anchor.y) - Number(poib.y);

    const { horiz, vert } = directionFromDelta(deltaX, deltaY);

    res.json({
      ok: true,
      anchor: { x: Number(anchor.x), y: Number(anchor.y) },
      poib: { x: poib.x, y: poib.y },
      delta: { x: deltaX, y: deltaY }, // signed; screen-space
      direction: {
        windage: horiz,
        elevation: vert,
      },
      meta: {
        hitsCount: hits.length,
        basis: "delta = bull - poib (screen-space y down = +)",
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: String(err?.message || err) });
  }
});

// ---- Start
const PORT = Number(process.env.PORT) || 10000;
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
