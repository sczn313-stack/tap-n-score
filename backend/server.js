/* ============================================================
   backend/server.js (FULL REPLACEMENT) — Tap-n-Score Backend
   What this gives you:
   - GET  /                 : simple “backend is running” message
   - GET  /api/health       : health JSON
   - GET  /api/test-analyze : deterministic sample output (no POST tool needed)
   - POST /api/analyze      : accepts { anchor:{x,y}, hits:[{x,y}...] } and returns POIB + directions
   - GET  /api/poster       : iPad-friendly in-browser POST tester for /api/analyze

   Notes:
   - Directions are derived ONLY from signed deltas (bull - poib).
   - Coordinate convention: x increases to the RIGHT, y increases DOWN (screen space).
     So: deltaY > 0 means "DOWN"; deltaY < 0 means "UP".
   ============================================================ */

const express = require("express");
const cors = require("cors");

const app = express();

// ---- Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Helpers
function isNum(v) {
  return Number.isFinite(Number(v));
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function pickDirX(dx) {
  if (dx > 0) return "RIGHT";
  if (dx < 0) return "LEFT";
  return "CENTER";
}

function pickDirY(dy) {
  // screen-space Y: down is +
  if (dy > 0) return "DOWN";
  if (dy < 0) return "UP";
  return "CENTER";
}

function meanXY(points) {
  const n = points.length;
  let sx = 0,
    sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / n, y: sy / n };
}

function validatePayload(body) {
  const err = (msg) => ({ ok: false, error: msg });

  if (!body || typeof body !== "object") return err("Body must be JSON.");

  const anchor = body.anchor;
  const hits = body.hits;

  if (!anchor || typeof anchor !== "object") return err("Missing anchor {x,y}.");
  if (!isNum(anchor.x) || !isNum(anchor.y)) return err("anchor.x and anchor.y must be numbers.");
  if (!Array.isArray(hits) || hits.length < 1) return err("hits must be an array with at least 1 point.");

  const cleanedHits = [];
  for (const h of hits) {
    if (!h || typeof h !== "object") return err("Each hit must be an object {x,y}.");
    if (!isNum(h.x) || !isNum(h.y)) return err("Each hit must have numeric x and y.");
    cleanedHits.push({ x: clamp01(h.x), y: clamp01(h.y) });
  }

  return {
    ok: true,
    anchor: { x: clamp01(anchor.x), y: clamp01(anchor.y) },
    hits: cleanedHits,
  };
}

// ---- Routes
app.get("/", (req, res) => {
  res.type("text").send("Tap-n-Score backend is running. Try /api/health");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "tap-n-score-backend", time: new Date().toISOString() });
});

// Deterministic test so you can verify the backend quickly in Safari
app.get("/api/test-analyze", (req, res) => {
  res.json({
    ok: true,
    route: "/api/test-analyze",
    anchor: { x: 0.5, y: 0.5 },
    hits: [
      { x: 0.55, y: 0.48 },
      { x: 0.52, y: 0.5 },
      { x: 0.58, y: 0.46 },
    ],
    note: "POST /api/analyze with {anchor:{x,y}, hits:[{x,y}...]}",
  });
});

// Main analyze endpoint (JSON)
app.post("/api/analyze", (req, res) => {
  const v = validatePayload(req.body);
  if (!v.ok) return res.status(400).json(v);

  const { anchor, hits } = v;

  // POIB = mean of hits (normalized 0..1)
  const poib = meanXY(hits);

  // Correction vector = bull(anchor) - poib
  const dx = anchor.x - poib.x; // + => move RIGHT
  const dy = anchor.y - poib.y; // + => move DOWN (screen-space)

  // Magnitudes (absolute)
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  // Directions
  const dirX = pickDirX(dx);
  const dirY = pickDirY(dy);

  res.json({
    ok: true,
    anchor,
    hits,
    poib: {
      x: Number(poib.x.toFixed(6)),
      y: Number(poib.y.toFixed(6)),
    },
    delta: {
      dx: Number(dx.toFixed(6)),
      dy: Number(dy.toFixed(6)),
    },
    directions: {
      x: dirX,
      y: dirY,
    },
    magnitude: {
      x: Number(ax.toFixed(6)),
      y: Number(ay.toFixed(6)),
    },
    debug: {
      convention: "x:right+, y:down+ (screen space)",
      meaning: "directions derived ONLY from signed deltas (anchor - poib)",
    },
  });
});

// iPad-friendly POST tester page (no ReqBin/Hoppscotch needed)
app.get("/api/poster", (req, res) => {
  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tap-n-Score API Poster</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 14px; }
    textarea { width: 100%; height: 220px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
    button { padding: 12px 14px; font-size: 16px; margin-top: 10px; }
    pre { white-space: pre-wrap; background: #111; color: #0f0; padding: 12px; border-radius: 10px; }
    .row { display:flex; gap:10px; flex-wrap:wrap; }
    a { color: #0a84ff; }
  </style>
</head>
<body>
  <h2>POST /api/analyze</h2>
  <p>
    Health: <a href="/api/health">/api/health</a> |
    Test: <a href="/api/test-analyze">/api/test-analyze</a>
  </p>

  <p>Paste JSON below, then tap <b>Send</b>.</p>

  <textarea id="payload">{
  "anchor": { "x": 0.5, "y": 0.5 },
  "hits": [
    { "x": 0.55, "y": 0.48 },
    { "x": 0.52, "y": 0.50 },
    { "x": 0.58, "y": 0.46 }
  ]
}</textarea>

  <div class="row">
    <button id="sendBtn">Send</button>
    <button id="clearBtn" type="button">Clear Output</button>
  </div>

  <h3>Response</h3>
  <pre id="out">(nothing yet)</pre>

<script>
  const out = document.getElementById("out");
  document.getElementById("clearBtn").onclick = () => out.textContent = "(cleared)";
  document.getElementById("sendBtn").onclick = async () => {
    out.textContent = "Sending...";
    try {
      const payload = JSON.parse(document.getElementById("payload").value);
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await r.text();
      out.textContent = "HTTP " + r.status + "\\n\\n" + text;
    } catch (e) {
      out.textContent = "ERROR: " + (e && e.message ? e.message : String(e));
    }
  };
</script>
</body>
</html>
  `);
});

// ---- Start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("tap-n-score-backend listening on", PORT);
});
