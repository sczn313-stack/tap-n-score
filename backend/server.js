/* ============================================================
   server.js (FULL REPLACEMENT) — API-LOCK-ANALYZE-1
   Purpose:
   - Provide stable backend endpoints for SEC
   - Math authority stays backend-only
   Endpoints:
   - GET  /api/health   -> sanity check
   - GET  /api/analyze  -> tells you to POST (prevents confusion)
   - POST /api/analyze  -> returns score + clicks + shots
============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// ---- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Helpers
function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function normPoint(p) {
  if (!p || typeof p !== "object") return null;
  const x = clamp01(p.x);
  const y = clamp01(p.y);
  return { x, y };
}

function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

/**
 * NOTE:
 * Replace this compute() logic with your real SCZN3 math.
 * This is only a stable shape contract so frontend can run.
 *
 * Contract returned:
 * {
 *   sessionId: "SEC-XXXX",
 *   score: <number>,
 *   shots: <int>,
 *   clicks: { up, down, left, right }
 * }
 */
function computeFromAnchorHits(anchor, hits) {
  // Minimal placeholder that is deterministic and safe.
  // Uses average hit offset from anchor as a proxy vector.
  const n = hits.length || 0;

  let dx = 0;
  let dy = 0;

  for (const h of hits) {
    dx += (h.x - anchor.x);
    dy += (h.y - anchor.y);
  }
  dx = n ? dx / n : 0;
  dy = n ? dy / n : 0;

  // Convert normalized dx/dy into "click-ish" numbers (just for shape).
  // YOUR REAL BACKEND should replace with POIB -> bull etc.
  const scale = 40; // purely placeholder
  const horiz = Math.abs(dx * scale);
  const vert = Math.abs(dy * scale);

  const clicks = {
    left: dx > 0 ? horiz : 0,
    right: dx < 0 ? horiz : 0,
    up: dy > 0 ? vert : 0,
    down: dy < 0 ? vert : 0,
  };

  // Placeholder score: closer cluster to anchor -> higher score.
  // (Replace with real scoring model.)
  const dist = Math.sqrt(dx * dx + dy * dy);
  const score = Math.max(0, Math.min(100, Math.round(100 - dist * 220)));

  return {
    score,
    shots: n,
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
    service: "tap-n-score-backend",
    time: new Date().toISOString(),
  });
});

app.get("/api/analyze", (req, res) => {
  res.status(200).send("Use POST /api/analyze with JSON body { anchor:{x,y}, hits:[{x,y}...] }");
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

    const sessionId = `SEC-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;

    const computed = computeFromAnchorHits(anchor, hits);

    return res.json({
      sessionId,
      score: computed.score,
      shots: computed.shots,
      clicks: computed.clicks,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
  }
});

// ---- Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Backend listening on", PORT);
});
