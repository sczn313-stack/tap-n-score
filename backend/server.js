/* ============================================================
   server.js — Tap-n-Score Backend
   Layer 3 + Intelligence Layer:
   - Health endpoint
   - Poster endpoint
   - Analytics tracking endpoint
   - Analytics summary endpoint with:
     * revenue
     * growth/session intelligence
     * leaderboards
     * time heatmap data
     * per-SKU funnel
     * per-vendor billing totals
     * interpreted intelligence layer
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

const REVENUE_RATES = {
  scan: 0.05,
  demo_start: 0.00,
  aim_set: 0.00,
  shot_added: 0.00,
  results_clicked: 0.00,
  results_ready: 0.10,
  try_again: 0.00,
  reset: 0.00,
  undo: 0.00,
  vendor_click: 0.25
};

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

function safeKey(v, fallback = "unknown") {
  const s = safeString(v, fallback);
  return s || fallback;
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
      out.push(JSON.parse(line));
    } catch {
      // ignore malformed lines
    }
  }

  return out;
}

function bucketCount(map, key) {
  const k = safeKey(key);
  map[k] = (map[k] || 0) + 1;
}

function addRevenue(map, key, amount) {
  const k = safeKey(key);
  map[k] = round2((map[k] || 0) + amount);
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

function dayOfWeekBucket(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "unknown";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[d.getUTCDay()];
}

function hourOfDayBucket(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "unknown";
  return String(d.getUTCHours()).padStart(2, "0");
}

function getRevenueAmountForEvent(eventName) {
  const key = safeLower(eventName, "unknown");
  return REVENUE_RATES[key] || 0;
}

function topNFromMap(map, n = 3) {
  return Object.entries(map || {})
    .map(([key, value]) => [key, Number(value || 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({ key, value: round2(value) }));
}

function calcPct(num, den) {
  if (!den || den <= 0) return 0;
  return round2((num / den) * 100);
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
      has_aim: typeof body.has_aim === "boolean" ? body.has_aim : null,
      results_viewed: typeof body.results_viewed === "boolean" ? body.results_viewed : null,
      distance_yards: Number.isFinite(Number(body.distance_yards)) ? Number(body.distance_yards) : null,
      click_value_moa: Number.isFinite(Number(body.click_value_moa)) ? Number(body.click_value_moa) : null,
      dial_unit: safeString(body.dial_unit, ""),
      click_value: Number.isFinite(Number(body.click_value)) ? Number(body.click_value) : null,
      target_key: safeString(body.target_key, ""),
      target_w_in: Number.isFinite(Number(body.target_w_in)) ? Number(body.target_w_in) : null,
      target_h_in: Number.isFinite(Number(body.target_h_in)) ? Number(body.target_h_in) : null,
      aim_x_pct: Number.isFinite(Number(body.aim_x_pct)) ? Number(body.aim_x_pct) : null,
      aim_y_pct: Number.isFinite(Number(body.aim_y_pct)) ? Number(body.aim_y_pct) : null,
      shot_index: Number.isFinite(Number(body.shot_index)) ? Number(body.shot_index) : null,
      shot_x_pct: Number.isFinite(Number(body.shot_x_pct)) ? Number(body.shot_x_pct) : null,
      shot_y_pct: Number.isFinite(Number(body.shot_y_pct)) ? Number(body.shot_y_pct) : null,
      shot_goal: Number.isFinite(Number(body.shot_goal)) ? Number(body.shot_goal) : null,
      group_size_inches: Number.isFinite(Number(body.group_size_inches)) ? Number(body.group_size_inches) : null,
      windage_direction: safeString(body.windage_direction, ""),
      elevation_direction: safeString(body.elevation_direction, ""),
      reset_from: safeString(body.reset_from, ""),
      undo_type: safeString(body.undo_type, ""),
      remaining_shots: Number.isFinite(Number(body.remaining_shots)) ? Number(body.remaining_shots) : null,
      ts: safeString(body.ts, new Date().toISOString()) || new Date().toISOString(),
      ip: getClientIp(req),
      ua: req.headers["user-agent"] || null,
      received_at: new Date().toISOString()
    };

    const line = JSON.stringify(payload) + "\n";
    fs.appendFile(TRACK_LOG, line, (err) => {
      if (err) console.error("Track write error:", err);
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
    const byDayOfWeek = {};
    const byHourOfDay = {};

    const revenueByEvent = {};
    const revenueByVendor = {};
    const revenueBySku = {};
    const revenueByBatch = {};

    const sessionSeen = {};
    const sessionEventCount = {};

    const skuPerformance = {};
    const vendorPerformance = {};
    const batchPerformance = {};

    let totalRevenue = 0;

    for (const e of filtered) {
      const eventName = safeLower(e.event, "unknown");
      const vendorName = safeLower(e.vendor, "unknown");
      const skuName = safeLower(e.sku, "unknown");
      const batchName = safeLower(e.batch, "") || "unknown";
      const sid = safeString(e.session_id, "unknown");
      const eventTs = e.ts || e.received_at;

      bucketCount(byEvent, eventName);
      bucketCount(byVendor, vendorName);
      bucketCount(bySku, skuName);
      bucketCount(byBatch, batchName);
      bucketCount(byDay, dayBucket(eventTs));
      bucketCount(byHour, hourBucket(eventTs));
      bucketCount(byDayOfWeek, dayOfWeekBucket(eventTs));
      bucketCount(byHourOfDay, hourOfDayBucket(eventTs));

      const revenueAmount = getRevenueAmountForEvent(eventName);
      totalRevenue += revenueAmount;

      if (revenueAmount > 0) {
        addRevenue(revenueByEvent, eventName, revenueAmount);
        addRevenue(revenueByVendor, vendorName, revenueAmount);
        addRevenue(revenueBySku, skuName, revenueAmount);
        addRevenue(revenueByBatch, batchName, revenueAmount);
      }

      sessionSeen[sid] = true;
      sessionEventCount[sid] = (sessionEventCount[sid] || 0) + 1;

      if (!skuPerformance[skuName]) {
        skuPerformance[skuName] = {
          scans: 0,
          results: 0,
          clicks: 0,
          revenue: 0
        };
      }
      if (eventName === "scan") skuPerformance[skuName].scans++;
      if (eventName === "results_ready") skuPerformance[skuName].results++;
      if (eventName === "vendor_click") skuPerformance[skuName].clicks++;
      skuPerformance[skuName].revenue = round2(skuPerformance[skuName].revenue + revenueAmount);

      if (!vendorPerformance[vendorName]) {
        vendorPerformance[vendorName] = {
          scans: 0,
          results: 0,
          clicks: 0,
          revenue: 0,
          amount_due: 0
        };
      }
      if (eventName === "scan") vendorPerformance[vendorName].scans++;
      if (eventName === "results_ready") vendorPerformance[vendorName].results++;
      if (eventName === "vendor_click") vendorPerformance[vendorName].clicks++;
      vendorPerformance[vendorName].revenue = round2(vendorPerformance[vendorName].revenue + revenueAmount);
      vendorPerformance[vendorName].amount_due = vendorPerformance[vendorName].revenue;

      if (!batchPerformance[batchName]) {
        batchPerformance[batchName] = {
          scans: 0,
          results: 0,
          clicks: 0,
          revenue: 0
        };
      }
      if (eventName === "scan") batchPerformance[batchName].scans++;
      if (eventName === "results_ready") batchPerformance[batchName].results++;
      if (eventName === "vendor_click") batchPerformance[batchName].clicks++;
      batchPerformance[batchName].revenue = round2(batchPerformance[batchName].revenue + revenueAmount);
    }

    totalRevenue = round2(totalRevenue);

    const scans = byEvent.scan || 0;
    const resultsReady = byEvent.results_ready || 0;
    const vendorClicks = byEvent.vendor_click || 0;

    const scanToResultsPct = calcPct(resultsReady, scans);
    const resultsToVendorPct = calcPct(vendorClicks, resultsReady);
    const scanToVendorPct = calcPct(vendorClicks, scans);

    const totalSessions = Object.keys(sessionSeen).length;
    const totalEventsPerSession = Object.values(sessionEventCount).reduce((a, b) => a + b, 0);
    const avgEventsPerSession = totalSessions > 0 ? round2(totalEventsPerSession / totalSessions) : 0;

    Object.keys(skuPerformance).forEach((skuKey) => {
      const item = skuPerformance[skuKey];
      item.scan_to_results_pct = calcPct(item.results, item.scans);
      item.results_to_click_pct = calcPct(item.clicks, item.results);
      item.scan_to_click_pct = calcPct(item.clicks, item.scans);
      item.revenue = round2(item.revenue);
    });

    Object.keys(vendorPerformance).forEach((vendorKey) => {
      const item = vendorPerformance[vendorKey];
      item.scan_to_results_pct = calcPct(item.results, item.scans);
      item.results_to_click_pct = calcPct(item.clicks, item.results);
      item.scan_to_click_pct = calcPct(item.clicks, item.scans);
      item.revenue = round2(item.revenue);
      item.amount_due = round2(item.amount_due);
    });

    Object.keys(batchPerformance).forEach((batchKey) => {
      const item = batchPerformance[batchKey];
      item.scan_to_results_pct = calcPct(item.results, item.scans);
      item.results_to_click_pct = calcPct(item.clicks, item.results);
      item.scan_to_click_pct = calcPct(item.clicks, item.scans);
      item.revenue = round2(item.revenue);
    });

    const vendorRevenueMap = {};
    const skuRevenueMap = {};
    const batchRevenueMap = {};
    const skuScanMap = {};
    const skuResultsConvMap = {};
    const batchClickMap = {};

    Object.entries(vendorPerformance).forEach(([k, v]) => {
      vendorRevenueMap[k] = v.revenue;
    });

    Object.entries(skuPerformance).forEach(([k, v]) => {
      skuRevenueMap[k] = v.revenue;
      skuScanMap[k] = v.scans;
      skuResultsConvMap[k] = v.scan_to_results_pct;
    });

    Object.entries(batchPerformance).forEach(([k, v]) => {
      batchRevenueMap[k] = v.revenue;
      batchClickMap[k] = v.clicks;
    });

    const revenuePerScan = scans > 0 ? round2(totalRevenue / scans) : 0;
    const revenuePerResult = resultsReady > 0 ? round2(totalRevenue / resultsReady) : 0;
    const projectedPer100Scans = round2(revenuePerScan * 100);
    const projectedPer1000Scans = round2(revenuePerScan * 1000);
    const projectedMonthly = round2(totalRevenue * 30);

    // ------------------------------------------------------------
    // INTELLIGENCE LAYER
    // ------------------------------------------------------------
    const sessionProfiles = {};

    for (const e of filtered) {
      const sid = safeString(e.session_id, "unknown");

      if (!sessionProfiles[sid]) {
        sessionProfiles[sid] = {
          events: [],
          scans: 0,
          demo_starts: 0,
          aims: 0,
          shots_added: 0,
          results_clicked: 0,
          results: 0,
          clicks: 0,
          resets: 0,
          tries_again: 0,
          undos: 0,
          mode: safeString(e.mode, ""),
          source: safeString(e.source, "")
        };
      }

      const p = sessionProfiles[sid];
      const eventName = safeLower(e.event, "unknown");

      p.events.push(eventName);

      if (eventName === "scan") p.scans++;
      if (eventName === "demo_start") p.demo_starts++;
      if (eventName === "aim_set") p.aims++;
      if (eventName === "shot_added") p.shots_added++;
      if (eventName === "results_clicked") p.results_clicked++;
      if (eventName === "results_ready") p.results++;
      if (eventName === "vendor_click") p.clicks++;
      if (eventName === "reset") p.resets++;
      if (eventName === "try_again") p.tries_again++;
      if (eventName === "undo") p.undos++;
    }

    const intelligence = {
      sessions: {
        total: 0,
        scan_only: 0,
        started: 0,
        aimed: 0,
        partial_build: 0,
        reached_results: 0,
        clicked_vendor: 0,
        repeated: 0
      },
      user_stages: {
        curious: 0,
        engaged: 0,
        understood: 0,
        returning: 0,
        high_intent: 0
      },
      behavior_signals: {
        avg_shots_added_per_session: 0,
        avg_results_per_session: 0,
        repeat_rate_pct: 0,
        vendor_click_rate_pct: 0
      }
    };

    let totalShotsAddedAcrossSessions = 0;
    let totalResultsAcrossSessions = 0;

    Object.values(sessionProfiles).forEach((p) => {
      intelligence.sessions.total += 1;
      totalShotsAddedAcrossSessions += p.shots_added;
      totalResultsAcrossSessions += p.results;

      const repeated = p.tries_again > 0 || p.results > 1 || p.events.length >= 8;
      const highIntent = p.results > 0 && p.clicks > 0;
      const engaged = p.aims > 0 || p.shots_added > 0;
      const understood = p.results > 0;

      if (p.scans > 0 && p.demo_starts === 0 && p.aims === 0 && p.results === 0) {
        intelligence.sessions.scan_only += 1;
      }

      if (p.demo_starts > 0) {
        intelligence.sessions.started += 1;
      }

      if (p.aims > 0) {
        intelligence.sessions.aimed += 1;
      }

      if (p.shots_added > 0 && p.results === 0) {
        intelligence.sessions.partial_build += 1;
      }

      if (p.results > 0) {
        intelligence.sessions.reached_results += 1;
      }

      if (p.clicks > 0) {
        intelligence.sessions.clicked_vendor += 1;
      }

      if (repeated) {
        intelligence.sessions.repeated += 1;
      }

      if (!engaged && !understood) {
        intelligence.user_stages.curious += 1;
      }

      if (engaged && !understood) {
        intelligence.user_stages.engaged += 1;
      }

      if (understood) {
        intelligence.user_stages.understood += 1;
      }

      if (repeated) {
        intelligence.user_stages.returning += 1;
      }

      if (highIntent) {
        intelligence.user_stages.high_intent += 1;
      }
    });

    if (intelligence.sessions.total > 0) {
      intelligence.behavior_signals.avg_shots_added_per_session = round2(
        totalShotsAddedAcrossSessions / intelligence.sessions.total
      );

      intelligence.behavior_signals.avg_results_per_session = round2(
        totalResultsAcrossSessions / intelligence.sessions.total
      );

      intelligence.behavior_signals.repeat_rate_pct = calcPct(
        intelligence.sessions.repeated,
        intelligence.sessions.total
      );

      intelligence.behavior_signals.vendor_click_rate_pct = calcPct(
        intelligence.sessions.clicked_vendor,
        intelligence.sessions.reached_results
      );
    }

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
      pricing: {
        current_rates: {
          scan: REVENUE_RATES.scan,
          demo_start: REVENUE_RATES.demo_start,
          aim_set: REVENUE_RATES.aim_set,
          shot_added: REVENUE_RATES.shot_added,
          results_clicked: REVENUE_RATES.results_clicked,
          results_ready: REVENUE_RATES.results_ready,
          try_again: REVENUE_RATES.try_again,
          reset: REVENUE_RATES.reset,
          undo: REVENUE_RATES.undo,
          vendor_click: REVENUE_RATES.vendor_click
        }
      },
      revenue: {
        total: totalRevenue,
        by_event: revenueByEvent,
        by_vendor: revenueByVendor,
        by_sku: revenueBySku,
        by_batch: revenueByBatch
      },
      growth: {
        sessions: totalSessions,
        avg_events_per_session: avgEventsPerSession,
        sku_performance: skuPerformance,
        vendor_performance: vendorPerformance
      },
      intelligence,
      leaderboards: {
        top_vendor_by_revenue: topNFromMap(vendorRevenueMap, 3),
        top_sku_by_revenue: topNFromMap(skuRevenueMap, 3),
        top_sku_by_scans: topNFromMap(skuScanMap, 3),
        top_sku_by_results_conversion: topNFromMap(skuResultsConvMap, 3),
        top_batch_by_vendor_clicks: topNFromMap(batchClickMap, 3),
        top_batch_by_revenue: topNFromMap(batchRevenueMap, 3)
      },
      heatmap: {
        by_day: byDay,
        by_hour: byHour,
        by_day_of_week: byDayOfWeek,
        by_hour_of_day: byHourOfDay
      },
      funnel: {
        by_sku: skuPerformance
      },
      billing: {
        by_vendor: vendorPerformance
      },
      projections: {
        revenue_per_scan: revenuePerScan,
        revenue_per_result: revenuePerResult,
        revenue_per_100_scans: projectedPer100Scans,
        revenue_per_1000_scans: projectedPer1000Scans,
        projected_monthly: projectedMonthly
      },
      breakdown: {
        by_event: byEvent,
        by_vendor: byVendor,
        by_sku: bySku,
        by_batch: byBatch
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
