/* ============================================================
   server.js (FULL REPLACEMENT) — SEC-CONTRACT-LOCK-1
   Goal:
   - Stable API you control
   - Frontend does ZERO math
   Endpoints:
   - GET  /api/health
   - POST /api/analyze  { anchor:{x,y}, hits:[{x,y}...] }
============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// ---- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Helpers
function isNum(n) {
  const x = Number(n);
  return Number.isFinite(x);
}
function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  if (x < 0 || x > 1) return null;
  return x;
}
function normPoint(p) {
  if (!p || typeof p !== "object") return null;
  const x = clamp01(p.x);
  const y = clamp01(p.y);
  if (x === null || y === null) return null;
  return { x, y };
}
function asArray(a) {
  return Array.isArray(a) ? a : [];
}
function sessionId() {
  return `SEC-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
}

// ---- Replace this with SCZN3 real math later.
// For now: return deterministic numbers so wiring can be locked.
function compute(anchor, hits) {
  const shots = hits.length;

  // simple average delta (HIT - ANCHOR)
  let dx = 0, dy = 0;
  for (const h of hits) {
    dx += (h.x - anchor.x);
    dy += (h.y - anchor.y);
  }
  dx = dx / shots;
  dy = dy / shots;

  // Direction convention (screen truth):
  // dx > 0 means POI is to the RIGHT of anchor -> correction should go LEFT
  // dy > 0 means POI is BELOW anchor (screen down) -> correction should go UP
  // But backend returns explicit up/down/left/right magnitudes, never labels.
  const magX = Math.abs(dx) * 40;
  const magY = Math.abs(dy) * 40;

  const clicks = {
    up:    dy > 0 ? magY : 0,
    down:  dy < 0 ? magY : 0,
    left:  dx > 0 ? magX : 0,
    right: dx < 0 ? magX : 0,
  };

  // placeholder score based on distance from anchor
  const dist = Math.sqrt(dx * dx + dy * dy);
  const score = Math.max(0, Math.min(100, Math.round(100 - dist * 220)));

  return {
    score,
    shots,
    clicks: {
      up: Number(clicks.up.toFixed(2)),
      down: Number(clicks.down.toFixed(2)),
      left: Number(clicks.left.toFixed(2)),
      right: Number(clicks.right.toFixed(2)),
    },
  };
}

// ---- Routes
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sczn3-sec-backend",
    time: new Date().toISOString(),
  });
});

app.post("/api/analyze", (req, res) => {
  const anchor = normPoint(req.body?.anchor);
  const hits = asArray(req.body?.hits).map(normPoint).filter(Boolean);

  if (!anchor) return res.status(400).json({ error: "Invalid anchor. Need {x,y} between 0..1" });
  if (hits.length < 1) return res.status(400).json({ error: "Need at least 1 hit." });

  const out = compute(anchor, hits);

  return res.json({
    sessionId: sessionId(),
    score: out.score,
    shots: out.shots,
    clicks: out.clicks,
  });
});

// ---- Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("SEC backend listening on", PORT));
