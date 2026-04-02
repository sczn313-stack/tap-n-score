/* ============================================================
   server.js — Tap-n-Score Backend
   Phase 3:
   - Health endpoint
   - Poster endpoint
   - Analytics tracking endpoint
   - Analytics summary endpoint
   - Existing correction math endpoint
============================================================ */

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const PORT = Number(process.env.PORT) || 10000;
const TRACK_LOG = path.join(__dirname, "track-events.ndjson");

// ------------------------------------------------------------
// MIDDLEWARE
// ------------------------------------------------------------
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
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

function safeLower(v, fallback = "") {
  return String(v ?? fallback).trim().toLowerCase();
}

function safeString(v, fallback = "") {
  return String(v ?? fallback).trim();
}

function getClientIp(req) {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string" && xfwd.trim()) {
    return xfwd.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

function readTrackEvents() {
  if (!fs.existsSync(TRACK_LOG)) return [];

  const raw = fs.readFileSync(TRACK_LOG, "utf8");
  if (!raw.trim()) return [];

  const lines = raw.split("\n").filter(Boolean);
  const out = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      out.push(obj);
    } catch {
      // ignore malformed lines
    }
  }

  return out;
}

function bucketCount(map, key) {
  const k = safeString(key || "unknown", "unknown") || "unknown";
  map[k] = (map[k] || 0) + 1;
}

function hourBucket(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:00 UTC`;
}

function dayBucket(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Inches per MOA at a given distance (yards)
function inchesPerMoa(distanceYds) {
  const d = clampNum(distanceYds, 0);
  return 1.047 * (d / 100);
}

// Inches per MRAD at a given distance (yards)
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
  let sx = 0;
  let sy = 0;
  let n = 0;

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
  let sx = 0;
  let sy = 0;
  let n = 0;

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

function delta01ToInches(dx01, dy01, targetWIn, targetHIn) {
  const w = Math.max(1, clampNum(targetWIn, 23));
  const h = Math.max(1, clampNum(targetHIn, 35));
  const scaleIn = Math.min(w, h);

  return {
    inchesX: dx01 * scaleIn,
    inchesY: dy01 * scaleIn,
    scaleIn
  };
}

// ------------------------------------------------------------
// BASIC ROUTES
// ------------------------------------------------------------
app.get("/", (req, res) => {
  res.type("text").send("Tap-n-Score backend is running. Try /api/health");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "tap-n-score-backend",
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

// ------------------------------------------------------------
// TRACKING ENDPOINT
// ------------------------------------------------------------
app.post("/api/track", (req, res) => {
  try {
    const body = req.body || {};

    const payload = {
      event: safeLower(body.event, "unknown"),
      vendor: safeLower(body.vendor, "unknown"),
      sku: safeLower(body.sku, "unknown"),
      batch: safeLower(body.batch, ""),
      page: safeString(body.page, ""),
      mode: safeString(body.mode, ""),
      source: safeString(body.source, ""),
      destination: safeString(body.destination, ""),
      session_id: safeString(body.session_id, ""),
      score: Number.isFinite(Number(body.score)) ? Number(body.score) : null,
      shots: Number.isFinite(Number(body.shots)) ? Number(body.shots) : null,
      distance_yards: Number.isFinite(Number(body.distance_yards)) ? Number(body.distance_yards) : null,
      dial_unit: safeString(body.dial_unit, ""),
      click_value: Number.isFinite(Number(body.click_value)) ? Number(body.click_value) : null,
      target_key: safeString(body.target_key, ""),
      target_w_in: Number.isFinite(Number(body.target_w_in)) ? Number(body.target_w_in) : null,
      target_h_in: Number.isFinite(Number(body.target_h_in)) ? Number(body.target_h_in) : null,
      ts: safeString(body.ts, new Date().toISOString()) || new Date().toISOString(),
      ip: getClientIp(req),
      ua: req.headers["user-agent"] || null,
      received_at: new Date().toISOString()
    };

    const line = JSON.stringify(payload) + "\n";
    fs.appendFile(TRACK_LOG, line, (err) => {
      if (err) {
        console.error("Track write error:", err);
      }
    });

    res.json({
      ok: true,
      logged: true,
      event: payload.event
    });
  } catch (err) {
    console.error("Track endpoint error:", err);
    res.status(500).json({
      ok: false,
      error: "Track endpoint error"
    });
  }
});

// ------------------------------------------------------------
// ANALYTICS SUMMARY ENDPOINT
// ------------------------------------------------------------
app.get("/api/analytics/summary", (req, res) => {
  try {
    const vendorFilter = safeLower(req.query.vendor, "");
    const skuFilter = safeLower(req.query.sku, "");
    const batchFilter = safeLower(req.query.batch, "");
    const eventFilter = safeLower(req.query.event, "");

    const allEvents = readTrackEvents();

    const filtered = allEvents.filter((e) => {
      if (vendorFilter && safeLower(e.vendor) !== vendorFilter) return false;
      if (skuFilter && safeLower(e.sku) !== skuFilter) return false;
      if (batchFilter && safeLower(e.batch) !== batchFilter) return false;
      if (eventFilter && safeLower(e.event) !== eventFilter) return false;
      return true;
    });

    const byEvent = {};
    const byVendor = {};
    const bySku = {};
    const byBatch = {};
    const byDay = {};
    const byHour = {};

    for (const e of filtered) {
      bucketCount(byEvent, e.event || "unknown");
      bucketCount(byVendor, e.vendor || "unknown");
      bucketCount(bySku, e.sku || "unknown");
      bucketCount(byBatch, e.batch || "unknown");
      bucketCount(byDay, dayBucket(e.ts || e.received_at));
      bucketCount(byHour, hourBucket(e.ts || e.received_at));
    }

    const scans = byEvent.scan || 0;
    const resultsReady = byEvent.results_ready || 0;
    const vendorClicks = byEvent.vendor_click || 0;

    const scanToResultsPct = scans > 0 ? round2((resultsReady / scans) * 100) : 0;
    const resultsToVendorPct = resultsReady > 0 ? round2((vendorClicks / resultsReady) * 100) : 0;
    const scanToVendorPct = scans > 0 ? round2((vendorClicks / scans) * 100) : 0;

    res.json({
      ok: true,
      filters: {
        vendor: vendorFilter || null,
        sku: skuFilter || null,
        batch: batchFilter || null,
        event: eventFilter || null
      },
      totals: {
        events: filtered.length,
        scans,
        results_ready: resultsReady,
        vendor_click: vendorClicks
      },
      conversion: {
        scan_to_results_pct: scanToResultsPct,
        results_to_vendor_pct: resultsToVendorPct,
        scan_to_vendor_pct: scanToVendorPct
      },
      breakdown: {
        by_event: byEvent,
        by_vendor: byVendor,
        by_sku: bySku,
        by_batch: byBatch,
        by_day: byDay,
        by_hour: byHour
      },
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("Analytics summary error:", err);
    res.status(500).json({
      ok: false,
      error: "Analytics summary error"
    });
  }
});

// ------------------------------------------------------------
// CORRECTION MATH ENDPOINT
// Supports:
// 1) Inches mode legacy
// 2) Normalized mode truth
// ------------------------------------------------------------
app.post("/api/calc", (req, res) => {
  try {
    const body = req.body || {};

    const hasNormalized =
      body?.aim &&
      Number.isFinite(Number(body?.aim?.x01)) &&
      Number.isFinite(Number(body?.aim?.y01)) &&
      Array.isArray(body?.hits) &&
      body.hits.length > 0;

    const hasInches =
      body?.bull &&
      Number.isFinite(Number(body?.bull?.x)) &&
      Number.isFinite(Number(body?.bull?.y)) &&
      Array.isArray(body?.shots) &&
      body.shots.length > 0;

    if (!hasNormalized && !hasInches) {
      return res.status(400).json({
        ok: false,
        error: "Missing inputs. Provide either bull+shots or aim+hits."
      });
    }

    const distanceYds = clampNum(body?.distanceYds, 100);
    if (!(distanceYds > 0)) {
      return res.status(400).json({
        ok: false,
        error: "distanceYds must be > 0."
      });
    }

    // ---------------- NORMALIZED MODE ----------------
    if (hasNormalized) {
      const aim = {
        x01: clamp01(body.aim.x01),
        y01: clamp01(body.aim.y01)
      };

      const avgHit = meanPoint01(body.hits);
      if (!avgHit) {
        return res.status(400).json({
          ok: false,
          error: "hits must be a non-empty array of {x01,y01}."
        });
      }

      const dx01 = aim.x01 - avgHit.x01;
      const dy01 = aim.y01 - avgHit.y01;

      const wIn = clampNum(body?.target?.wIn, 23);
      const hIn = clampNum(body?.target?.hIn, 35);

      const { inchesX, inchesY, scaleIn } = delta01ToInches(dx01, dy01, wIn, hIn);
      const { windage, elevation } = directionFromDelta(inchesX, inchesY);

      const dialUnit = String(body?.dialUnit || "MOA").toUpperCase() === "MRAD" ? "MRAD" : "MOA";
      const clickValue = clampNum(body?.clickValue, dialUnit === "MRAD" ? 0.1 : 0.25);

      if (!(clickValue > 0)) {
        return res.status(400).json({
          ok: false,
          error: "clickValue must be > 0."
        });
      }

      const inchesPerUnit = dialUnit === "MOA"
        ? inchesPerMoa(distanceYds)
        : inchesPerMrad(distanceYds);

      const unitsX = Math.abs(inchesX) / inchesPerUnit;
      const unitsY = Math.abs(inchesY) / inchesPerUnit;

      const clicksX = unitsX / clickValue;
      const clicksY = unitsY / clickValue;

      return res.json({
        ok: true,
        mode: "normalized_truth",
        inputs: {
          distanceYds,
          dialUnit,
          clickValue: round2(clickValue),
          target: {
            wIn: round2(wIn),
            hIn: round2(hIn)
          },
          scaleIn: round2(scaleIn)
        },
        aim01: {
          x01: round2(aim.x01),
          y01: round2(aim.y01)
        },
        poib01: {
          x01: round2(avgHit.x01),
          y01: round2(avgHit.y01)
        },
        deltaInches: {
          x: round2(inchesX),
          y: round2(inchesY)
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
    }

    // ---------------- LEGACY INCHES MODE ----------------
    const bullX = clampNum(body?.bull?.x, NaN);
    const bullY = clampNum(body?.bull?.y, NaN);

    if (!Number.isFinite(bullX) || !Number.isFinite(bullY)) {
      return res.status(400).json({
        ok: false,
        error: "bull.x and bull.y are required numbers."
      });
    }

    const poib = meanPoint(body?.shots);
    if (!poib) {
      return res.status(400).json({
        ok: false,
        error: "shots must be a non-empty array of {x,y}."
      });
    }

    const clickMoa = clampNum(body?.clickMoa, 0.25);
    const ipm = inchesPerMoa(distanceYds);

    if (!(ipm > 0) || !(clickMoa > 0)) {
      return res.status(400).json({
        ok: false,
        error: "distanceYds and clickMoa must be > 0."
      });
    }

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
      inputs: {
        distanceYds,
        clickMoa: round2(clickMoa)
      },
      bull: {
        x: round2(bullX),
        y: round2(bullY)
      },
      poib: {
        x: round2(poib.x),
        y: round2(poib.y)
      },
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

// ------------------------------------------------------------
// START
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
