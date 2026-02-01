/* ============================================================
   server.js (FULL REPLACEMENT) — SCZN3 BACKEND LOCK v1
   Endpoints:
   - GET  /api/health
   - GET  /api/analyze   (instructions only)
   - POST /api/analyze   (returns score + clicks + shots)
   Notes:
   - Backend is math authority.
   - Frontend sends normalized points: anchor {x,y} and hits [{x,y}...]
============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// ---------- Config ----------
const PORT = process.env.PORT || 3000;

// If you want to lock CORS to your frontend later:
// set Render env var: CORS_ORIGIN = https://YOUR-FRONTEND.onrender.com
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// ---------- Middleware ----------
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "2mb" }));

// ---------- Helpers ----------
function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function normPoint(p) {
  if (!p || typeof p !== "object") return null;
  const x = clamp01(p.x);
  const y = clamp01(p.y);
  if (x === null || y === null) return null;
  return { x, y };
}

function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

function newSessionId() {
  return `SEC-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
}

/**
 * ------------------------------------------------------------
 * PLACEHOLDER MATH (stable contract)
 * Replace this with your real SCZN3 math later.
 * ------------------------------------------------------------
 * This returns:
 *  - shots: hits.length
 *  - score: 0..100 based on average distance to anchor (proxy)
 *  - clicks: four numbers with 2 decimals (proxy)
 */
function compute(anchor, hits) {
  const n = hits.length;

  // Average delta: hit - anchor
  let dx = 0;
  let dy = 0;

  for (const h of hits) {
    dx += (h.x - anchor.x);
    dy += (h.y - anchor.y);
  }
  dx /= n;
  dy /= n;

  // Score proxy: smaller distance = higher score
  const dist = Math.sqrt(dx * dx + dy * dy);
  const score = Math.max(0, Math.min(100, Math.round(100 - dist * 240)));

  // Click proxy: directional magnitudes
  // NOTE: This is NOT your real click math. It’s only a contract shape.
  const scale = 40;
  const horiz = Math.abs(dx * scale);
  const vert = Math.abs(dy * scale);

  // IMPORTANT:
  // screen-space y is down-positive.
  // But these are just placeholders anyway.
  const clicks = {
    // if average hit is RIGHT of anchor -> you need LEFT correction (placeholder)
    left: dx > 0 ? horiz : 0,
    right: dx < 0 ? horiz : 0,

    // if average hit is BELOW anchor -> you need UP correction (placeholder)
    up: dy > 0 ? vert : 0,
    down: dy < 0 ? vert : 0,
  };

  return {
    shots: n,
    score,
    clicks: {
      up: Number(clicks.up.toFixed(2)),
      down: Number(clicks.down.toFixed(2)),
      left: Number(clicks.left.toFixed(2)),
      right: Number(clicks.right.toFixed(2)),
    },
  };
}

// ---------- Routes ----------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-sec-backend",
    time: new Date().toISOString(),
  });
});

app.get("/api/analyze", (req, res) => {
  res.status(200).send(
    "Use POST /api/analyze with JSON body: { anchor:{x,y}, hits:[{x,y}...] }"
  );
});

app.post("/api/analyze", (req, res) => {
  try {
    const anchor = normPoint(req.body?.anchor);
    const hitsRaw = safeArray(req.body?.hits);
    const hits = hitsRaw.map(normPoint).filter(Boolean);

    if (!anchor) {
      return res.status(400).json({ error: "Missing/invalid anchor" });
    }
    if (hits.length < 1) {
      return res.status(400).json({ error: "Need at least 1 hit" });
    }

    const out = compute(anchor, hits);

    // Final contract
    return res.json({
      sessionId: newSessionId(),
      score: out.score,
      shots: out.shots,
      clicks: out.clicks,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Server error", detail: String(e?.message || e) });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`SCZN3 backend listening on port ${PORT}`);
});
