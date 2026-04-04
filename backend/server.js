/* ============================================================
   server.js — Tap-n-Score Backend
   Polished Analytics + Intelligence Layer
   ------------------------------------------------------------
   Includes:
   - Health endpoint
   - Poster endpoint
   - Analytics tracking endpoint
   - Analytics summary endpoint with:
     * revenue
     * conversions
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

/* ------------------------------------------------------------
   CONFIG
------------------------------------------------------------ */
const PORT = Number(process.env.PORT) || 10000;
const TRACK_LOG = path.join(__dirname, "track-events.ndjson");

const REVENUE_RATES = {
  page_view: 0.0,
  scan: 0.05,
  settings_initialized: 0.0,
  settings_changed: 0.0,
  demo_start: 0.0,
  aim_set: 0.0,
  shot_added: 0.0,
  results_clicked: 0.0,
  results_ready: 0.1,
  results_viewed: 0.0,
  try_again: 0.0,
  reset: 0.0,
  undo: 0.0,
  vendor_click: 0.25,
  session_completed: 0.0,
  session_abandoned: 0.0
};

/* ------------------------------------------------------------
   MIDDLEWARE
------------------------------------------------------------ */
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------ */
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

function median(values) {
  const nums = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 0) {
    return round2((nums[mid - 1] + nums[mid]) / 2);
  }
  return round2(nums[mid]);
}

function avg(values) {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!nums.length) return 0;
  return round2(nums.reduce((sum, n) => sum + n, 0) / nums.length);
}

function minVal(values) {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!nums.length) return 0;
  return round2(Math.min(...nums));
}

function maxVal(values) {
  const nums = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!nums.length) return 0;
  return round2(Math.max(...nums));
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

/* ------------------------------------------------------------
   BASIC ROUTES
------------------------------------------------------------ */
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

/* ------------------------------------------------------------
   TRACKING ENDPOINT
------------------------------------------------------------ */
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
      reason: safeString(body.reason, ""),
      final_mode: safeString(body.final_mode, ""),
      completed: typeof body.completed === "boolean" ? body.completed : null,

      session_id: safeString(body.session_id, ""),
      session_started_at: safeString(body.session_started_at, ""),
      session_duration_ms: Number.isFinite(Number(body.session_duration_ms))
        ? Number(body.session_duration_ms)
        : null,
      time_to_first_interaction_ms: Number.isFinite(Number(body.time_to_first_interaction_ms))
        ? Number(body.time_to_first_interaction_ms)
        : null,
      time_to_aim_ms: Number.isFinite(Number(body.time_to_aim_ms))
        ? Number(body.time_to_aim_ms)
        : null,
      time_to_first_shot_ms: Number.isFinite(Number(body.time_to_first_shot_ms))
        ? Number(body.time_to_first_shot_ms)
        : null,
      time_to_results_ms: Number.isFinite(Number(body.time_to_results_ms))
        ? Number(body.time_to_results_ms)
        : null,
      inactivity_ms: Number.isFinite(Number(body.inactivity_ms))
        ? Number(body.inactivity_ms)
        : null,

      score: Number.isFinite(Number(body.score)) ? Number(body.score) : null,
      shots: Number.isFinite(Number(body.shots)) ? Number(body.shots) : null,
      total_shots: Number.isFinite(Number(body.total_shots)) ? Number(body.total_shots) : null,
      has_aim: typeof body.has_aim === "boolean" ? body.has_aim : null,
      had_aim: typeof body.had_aim === "boolean" ? body.had_aim : null,
      results_viewed: typeof body.results_viewed === "boolean" ? body.results_viewed : null,
      had_results: typeof body.had_results === "boolean" ? body.had_results : null,

      distance_yards: Number.isFinite(Number(body.distance_yards))
        ? Number(body.distance_yards)
        : null,
      click_value_moa: Number.isFinite(Number(body.click_value_moa))
        ? Number(body.click_value_moa)
        : null,
      dial_unit: safeString(body.dial_unit, ""),
      click_value: Number.isFinite(Number(body.click_value))
        ? Number(body.click_value)
        : null,
      shot_goal: Number.isFinite(Number(body.shot_goal))
        ? Number(body.shot_goal)
        : null,

      target_key: safeString(body.target_key, ""),
      target_w_in: Number.isFinite(Number(body.target_w_in))
        ? Number(body.target_w_in)
        : null,
      target_h_in: Number.isFinite(Number(body.target_h_in))
        ? Number(body.target_h_in)
        : null,

      aim_x_pct: Number.isFinite(Number(body.aim_x_pct))
        ? Number(body.aim_x_pct)
        : null,
      aim_y_pct: Number.isFinite(Number(body.aim_y_pct))
        ? Number(body.aim_y_pct)
        : null,

      shot_index: Number.isFinite(Number(body.shot_index))
        ? Number(body.shot_index)
        : null,
      shot_x_pct: Number.isFinite(Number(body.shot_x_pct))
        ? Number(body.shot_x_pct)
        : null,
      shot_y_pct: Number.isFinite(Number(body.shot_y_pct))
        ? Number(body.shot_y_pct)
        : null,

      group_size_inches: Number.isFinite(Number(body.group_size_inches))
        ? Number(body.group_size_inches)
        : null,

      dx_inches: Number.isFinite(Number(body.dx_inches))
        ? Number(body.dx_inches)
        : null,
      dy_inches: Number.isFinite(Number(body.dy_inches))
        ? Number(body.dy_inches)
        : null,
      windage_moa: Number.isFinite(Number(body.windage_moa))
        ? Number(body.windage_moa)
        : null,
      elevation_moa: Number.isFinite(Number(body.elevation_moa))
        ? Number(body.elevation_moa)
        : null,
      windage_clicks: Number.isFinite(Number(body.windage_clicks))
        ? Number(body.windage_clicks)
        : null,
      elevation_clicks: Number.isFinite(Number(body.elevation_clicks))
        ? Number(body.elevation_clicks)
        : null,

      windage_direction: safeString(body.windage_direction, ""),
      elevation_direction: safeString(body.elevation_direction, ""),

      reset_from: safeString(body.reset_from, ""),
      undo_type: safeString(body.undo_type, ""),
      remaining_shots: Number.isFinite(Number(body.remaining_shots))
        ? Number(body.remaining_shots)
        : null,

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

/* ------------------------------------------------------------
   ANALYTICS SUMMARY ENDPOINT
------------------------------------------------------------ */
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
    const byTarget = {};
    const byMode = {};
    const bySource = {};
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
      const targetName = safeKey(e.target_key || e.sku || "unknown");
      const modeName = safeKey(e.mode || "unknown");
      const sourceName = safeKey(e.source || "unknown");
      const sid = safeString(e.session_id, "unknown");
      const eventTs = e.ts || e.received_at;

      bucketCount(byEvent, eventName);
      bucketCount(byVendor, vendorName);
      bucketCount(bySku, skuName);
      bucketCount(byBatch, batchName);
      bucketCount(byTarget, targetName);
      bucketCount(byMode, modeName);
      bucketCount(bySource, sourceName);
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
          page_views: 0,
          results_ready: 0,
          results_viewed: 0,
          vendor_clicks: 0,
          sessions_completed: 0,
          sessions_abandoned: 0,
          revenue: 0
        };
      }

      if (eventName === "scan") skuPerformance[skuName].scans++;
      if (eventName === "page_view") skuPerformance[skuName].page_views++;
      if (eventName === "results_ready") skuPerformance[skuName].results_ready++;
      if (eventName === "results_viewed") skuPerformance[skuName].results_viewed++;
      if (eventName === "vendor_click") skuPerformance[skuName].vendor_clicks++;
      if (eventName === "session_completed") skuPerformance[skuName].sessions_completed++;
      if (eventName === "session_abandoned") skuPerformance[skuName].sessions_abandoned++;
      skuPerformance[skuName].revenue = round2(
        skuPerformance[skuName].revenue + revenueAmount
      );

      if (!vendorPerformance[vendorName]) {
        vendorPerformance[vendorName] = {
          scans: 0,
          page_views: 0,
          results_ready: 0,
          results_viewed: 0,
          vendor_clicks: 0,
          sessions_completed: 0,
          sessions_abandoned: 0,
          revenue: 0,
          amount_due: 0
        };
      }

      if (eventName === "scan") vendorPerformance[vendorName].scans++;
      if (eventName === "page_view") vendorPerformance[vendorName].page_views++;
      if (eventName === "results_ready") vendorPerformance[vendorName].results_ready++;
      if (eventName === "results_viewed") vendorPerformance[vendorName].results_viewed++;
      if (eventName === "vendor_click") vendorPerformance[vendorName].vendor_clicks++;
      if (eventName === "session_completed") vendorPerformance[vendorName].sessions_completed++;
      if (eventName === "session_abandoned") vendorPerformance[vendorName].sessions_abandoned++;
      vendorPerformance[vendorName].revenue = round2(
        vendorPerformance[vendorName].revenue + revenueAmount
      );
      vendorPerformance[vendorName].amount_due = vendorPerformance[vendorName].revenue;

      if (!batchPerformance[batchName]) {
        batchPerformance[batchName] = {
          scans: 0,
          page_views: 0,
          results_ready: 0,
          results_viewed: 0,
          vendor_clicks: 0,
          sessions_completed: 0,
          sessions_abandoned: 0,
          revenue: 0
        };
      }

      if (eventName === "scan") batchPerformance[batchName].scans++;
      if (eventName === "page_view") batchPerformance[batchName].page_views++;
      if (eventName === "results_ready") batchPerformance[batchName].results_ready++;
      if (eventName === "results_viewed") batchPerformance[batchName].results_viewed++;
      if (eventName === "vendor_click") batchPerformance[batchName].vendor_clicks++;
      if (eventName === "session_completed") batchPerformance[batchName].sessions_completed++;
      if (eventName === "session_abandoned") batchPerformance[batchName].sessions_abandoned++;
      batchPerformance[batchName].revenue = round2(
        batchPerformance[batchName].revenue + revenueAmount
      );
    }

    totalRevenue = round2(totalRevenue);

    const scans = byEvent.scan || 0;
    const pageViews = byEvent.page_view || 0;
    const resultsReady = byEvent.results_ready || 0;
    const resultsViewed = byEvent.results_viewed || 0;
    const vendorClicks = byEvent.vendor_click || 0;
    const sessionsCompleted = byEvent.session_completed || 0;
    const sessionsAbandoned = byEvent.session_abandoned || 0;

    const pageToResultsPct = calcPct(resultsViewed, pageViews);
    const scanToResultsPct = calcPct(resultsViewed, scans);
    const resultsToVendorPct = calcPct(vendorClicks, resultsViewed);
    const scanToVendorPct = calcPct(vendorClicks, scans);
    const sessionCompletionPct = calcPct(
      sessionsCompleted,
      sessionsCompleted + sessionsAbandoned
    );

    const totalSessions = Object.keys(sessionSeen).length;
    const totalEventsPerSession = Object.values(sessionEventCount).reduce((a, b) => a + b, 0);
    const avgEventsPerSession =
      totalSessions > 0 ? round2(totalEventsPerSession / totalSessions) : 0;

    Object.keys(skuPerformance).forEach((skuKey) => {
      const item = skuPerformance[skuKey];
      item.scan_to_results_pct = calcPct(item.results_viewed, item.scans);
      item.results_to_click_pct = calcPct(item.vendor_clicks, item.results_viewed);
      item.scan_to_click_pct = calcPct(item.vendor_clicks, item.scans);
      item.completion_pct = calcPct(
        item.sessions_completed,
        item.sessions_completed + item.sessions_abandoned
      );
      item.revenue = round2(item.revenue);
    });

    Object.keys(vendorPerformance).forEach((vendorKey) => {
      const item = vendorPerformance[vendorKey];
      item.scan_to_results_pct = calcPct(item.results_viewed, item.scans);
      item.results_to_click_pct = calcPct(item.vendor_clicks, item.results_viewed);
      item.scan_to_click_pct = calcPct(item.vendor_clicks, item.scans);
      item.completion_pct = calcPct(
        item.sessions_completed,
        item.sessions_completed + item.sessions_abandoned
      );
      item.revenue = round2(item.revenue);
      item.amount_due = round2(item.amount_due);
    });

    Object.keys(batchPerformance).forEach((batchKey) => {
      const item = batchPerformance[batchKey];
      item.scan_to_results_pct = calcPct(item.results_viewed, item.scans);
      item.results_to_click_pct = calcPct(item.vendor_clicks, item.results_viewed);
      item.scan_to_click_pct = calcPct(item.vendor_clicks, item.scans);
      item.completion_pct = calcPct(
        item.sessions_completed,
        item.sessions_completed + item.sessions_abandoned
      );
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
      batchClickMap[k] = v.vendor_clicks;
    });

    const revenuePerScan = scans > 0 ? round2(totalRevenue / scans) : 0;
    const revenuePerResult = resultsViewed > 0 ? round2(totalRevenue / resultsViewed) : 0;
    const projectedPer100Scans = round2(revenuePerScan * 100);
    const projectedPer1000Scans = round2(revenuePerScan * 1000);
    const projectedMonthly = round2(totalRevenue * 30);

    /* ------------------------------------------------------------
       SESSION INTELLIGENCE LAYER
    ------------------------------------------------------------ */
    const sessionProfiles = {};

    for (const e of filtered) {
      const sid = safeString(e.session_id, "unknown");
      const eventName = safeLower(e.event, "unknown");
      const eventTs = e.ts || e.received_at;
      const vendorName = safeLower(e.vendor, "unknown");
      const skuName = safeLower(e.sku, "unknown");
      const batchName = safeLower(e.batch, "") || "unknown";

      if (!sessionProfiles[sid]) {
        sessionProfiles[sid] = {
          session_id: sid,
          vendor: vendorName,
          sku: skuName,
          batch: batchName,
          mode: safeString(e.mode, ""),
          source: safeString(e.source, ""),
          target_key: safeString(e.target_key, ""),
          events: [],
          started_at: eventTs,
          ended_at: eventTs,
          scans: 0,
          page_views: 0,
          settings_initialized: 0,
          settings_changed: 0,
          demo_starts: 0,
          aims: 0,
          shots_added: 0,
          results_clicked: 0,
          results_ready: 0,
          results_viewed: 0,
          vendor_clicks: 0,
          resets: 0,
          tries_again: 0,
          undos: 0,
          session_completed: 0,
          session_abandoned: 0,
          reasons: [],
          session_duration_ms: null,
          time_to_first_interaction_ms: null,
          time_to_aim_ms: null,
          time_to_first_shot_ms: null,
          time_to_results_ms: null,
          inactivity_ms: null,
          last_shot_goal: null,
          last_distance_yards: null,
          last_click_value_moa: null,
          last_dial_unit: null,
          group_size_inches: null,
          windage_direction: "",
          elevation_direction: ""
        };
      }

      const p = sessionProfiles[sid];

      p.events.push(eventName);

      if (new Date(eventTs).getTime() < new Date(p.started_at).getTime()) {
        p.started_at = eventTs;
      }
      if (new Date(eventTs).getTime() > new Date(p.ended_at).getTime()) {
        p.ended_at = eventTs;
      }

      if (eventName === "scan") p.scans++;
      if (eventName === "page_view") p.page_views++;
      if (eventName === "settings_initialized") p.settings_initialized++;
      if (eventName === "settings_changed") p.settings_changed++;
      if (eventName === "demo_start") p.demo_starts++;
      if (eventName === "aim_set") p.aims++;
      if (eventName === "shot_added") p.shots_added++;
      if (eventName === "results_clicked") p.results_clicked++;
      if (eventName === "results_ready") p.results_ready++;
      if (eventName === "results_viewed") p.results_viewed++;
      if (eventName === "vendor_click") p.vendor_clicks++;
      if (eventName === "reset") p.resets++;
      if (eventName === "try_again") p.tries_again++;
      if (eventName === "undo") p.undos++;
      if (eventName === "session_completed") p.session_completed++;
      if (eventName === "session_abandoned") p.session_abandoned++;

      if (e.reason) p.reasons.push(e.reason);

      if (Number.isFinite(Number(e.session_duration_ms))) {
        p.session_duration_ms = Number(e.session_duration_ms);
      }
      if (Number.isFinite(Number(e.time_to_first_interaction_ms))) {
        p.time_to_first_interaction_ms = Number(e.time_to_first_interaction_ms);
      }
      if (Number.isFinite(Number(e.time_to_aim_ms))) {
        p.time_to_aim_ms = Number(e.time_to_aim_ms);
      }
      if (Number.isFinite(Number(e.time_to_first_shot_ms))) {
        p.time_to_first_shot_ms = Number(e.time_to_first_shot_ms);
      }
      if (Number.isFinite(Number(e.time_to_results_ms))) {
        p.time_to_results_ms = Number(e.time_to_results_ms);
      }
      if (Number.isFinite(Number(e.inactivity_ms))) {
        p.inactivity_ms = Number(e.inactivity_ms);
      }

      if (Number.isFinite(Number(e.shot_goal))) {
        p.last_shot_goal = Number(e.shot_goal);
      }
      if (Number.isFinite(Number(e.distance_yards))) {
        p.last_distance_yards = Number(e.distance_yards);
      }
      if (Number.isFinite(Number(e.click_value_moa))) {
        p.last_click_value_moa = Number(e.click_value_moa);
      }
      if (safeString(e.dial_unit)) {
        p.last_dial_unit = safeString(e.dial_unit);
      }
      if (Number.isFinite(Number(e.group_size_inches))) {
        p.group_size_inches = Number(e.group_size_inches);
      }
      if (safeString(e.windage_direction)) {
        p.windage_direction = safeString(e.windage_direction);
      }
      if (safeString(e.elevation_direction)) {
        p.elevation_direction = safeString(e.elevation_direction);
      }
    }

    const intelligence = {
      sessions: {
        total: 0,
        scan_only: 0,
        page_only: 0,
        started: 0,
        aimed: 0,
        partial_build: 0,
        reached_results: 0,
        viewed_results: 0,
        clicked_vendor: 0,
        completed: 0,
        abandoned: 0,
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
        avg_settings_changes_per_session: 0,
        repeat_rate_pct: 0,
        vendor_click_rate_pct: 0,
        completion_rate_pct: 0
      },
      timing: {
        avg_time_to_first_interaction_ms: 0,
        avg_time_to_aim_ms: 0,
        avg_time_to_first_shot_ms: 0,
        avg_time_to_results_ms: 0,
        avg_session_duration_ms: 0,
        median_time_to_results_ms: 0
      },
      diagnostics: {
        avg_group_size_inches: 0,
        min_group_size_inches: 0,
        max_group_size_inches: 0,
        most_common_windage_direction: "NONE",
        most_common_elevation_direction: "NONE"
      },
      dropoff: {
        scan_only_pct: 0,
        after_start_before_aim_pct: 0,
        after_aim_before_results_pct: 0,
        after_results_before_vendor_pct: 0
      }
    };

    let totalShotsAddedAcrossSessions = 0;
    let totalResultsViewedAcrossSessions = 0;
    let totalSettingsChangesAcrossSessions = 0;

    const timeToFirstInteractionList = [];
    const timeToAimList = [];
    const timeToFirstShotList = [];
    const timeToResultsList = [];
    const sessionDurationList = [];
    const groupSizeList = [];
    const windageMap = {};
    const elevationMap = {};

    Object.values(sessionProfiles).forEach((p) => {
      intelligence.sessions.total += 1;
      totalShotsAddedAcrossSessions += p.shots_added;
      totalResultsViewedAcrossSessions += p.results_viewed;
      totalSettingsChangesAcrossSessions += p.settings_changed;

      const repeated = p.tries_again > 0 || p.results_viewed > 1 || p.events.length >= 8;
      const highIntent = p.results_viewed > 0 && p.vendor_clicks > 0;
      const engaged = p.aims > 0 || p.shots_added > 0 || p.settings_changed > 0;
      const understood = p.results_viewed > 0;

      if (p.scans > 0 && p.demo_starts === 0 && p.aims === 0 && p.results_viewed === 0) {
        intelligence.sessions.scan_only += 1;
      }

      if (p.page_views > 0 && p.scans === 0 && p.demo_starts === 0 && p.aims === 0 && p.results_viewed === 0) {
        intelligence.sessions.page_only += 1;
      }

      if (p.demo_starts > 0) intelligence.sessions.started += 1;
      if (p.aims > 0) intelligence.sessions.aimed += 1;
      if (p.shots_added > 0 && p.results_viewed === 0) intelligence.sessions.partial_build += 1;
      if (p.results_ready > 0) intelligence.sessions.reached_results += 1;
      if (p.results_viewed > 0) intelligence.sessions.viewed_results += 1;
      if (p.vendor_clicks > 0) intelligence.sessions.clicked_vendor += 1;
      if (p.session_completed > 0) intelligence.sessions.completed += 1;
      if (p.session_abandoned > 0) intelligence.sessions.abandoned += 1;
      if (repeated) intelligence.sessions.repeated += 1;

      if (!engaged && !understood) intelligence.user_stages.curious += 1;
      if (engaged && !understood) intelligence.user_stages.engaged += 1;
      if (understood) intelligence.user_stages.understood += 1;
      if (repeated) intelligence.user_stages.returning += 1;
      if (highIntent) intelligence.user_stages.high_intent += 1;

      if (Number.isFinite(p.time_to_first_interaction_ms)) {
        timeToFirstInteractionList.push(p.time_to_first_interaction_ms);
      }
      if (Number.isFinite(p.time_to_aim_ms)) {
        timeToAimList.push(p.time_to_aim_ms);
      }
      if (Number.isFinite(p.time_to_first_shot_ms)) {
        timeToFirstShotList.push(p.time_to_first_shot_ms);
      }
      if (Number.isFinite(p.time_to_results_ms)) {
        timeToResultsList.push(p.time_to_results_ms);
      }
      if (Number.isFinite(p.session_duration_ms)) {
        sessionDurationList.push(p.session_duration_ms);
      }
      if (Number.isFinite(p.group_size_inches)) {
        groupSizeList.push(p.group_size_inches);
      }
      if (p.windage_direction) {
        bucketCount(windageMap, p.windage_direction);
      }
      if (p.elevation_direction) {
        bucketCount(elevationMap, p.elevation_direction);
      }
    });

    if (intelligence.sessions.total > 0) {
      intelligence.behavior_signals.avg_shots_added_per_session = round2(
        totalShotsAddedAcrossSessions / intelligence.sessions.total
      );

      intelligence.behavior_signals.avg_results_per_session = round2(
        totalResultsViewedAcrossSessions / intelligence.sessions.total
      );

      intelligence.behavior_signals.avg_settings_changes_per_session = round2(
        totalSettingsChangesAcrossSessions / intelligence.sessions.total
      );

      intelligence.behavior_signals.repeat_rate_pct = calcPct(
        intelligence.sessions.repeated,
        intelligence.sessions.total
      );

      intelligence.behavior_signals.vendor_click_rate_pct = calcPct(
        intelligence.sessions.clicked_vendor,
        intelligence.sessions.viewed_results
      );

      intelligence.behavior_signals.completion_rate_pct = calcPct(
        intelligence.sessions.completed,
        intelligence.sessions.completed + intelligence.sessions.abandoned
      );

      intelligence.dropoff.scan_only_pct = calcPct(
        intelligence.sessions.scan_only,
        intelligence.sessions.total
      );

      intelligence.dropoff.after_start_before_aim_pct = calcPct(
        intelligence.sessions.started - intelligence.sessions.aimed,
        intelligence.sessions.started
      );

      intelligence.dropoff.after_aim_before_results_pct = calcPct(
        intelligence.sessions.aimed - intelligence.sessions.viewed_results,
        intelligence.sessions.aimed
      );

      intelligence.dropoff.after_results_before_vendor_pct = calcPct(
        intelligence.sessions.viewed_results - intelligence.sessions.clicked_vendor,
        intelligence.sessions.viewed_results
      );
    }

    intelligence.timing.avg_time_to_first_interaction_ms = avg(timeToFirstInteractionList);
    intelligence.timing.avg_time_to_aim_ms = avg(timeToAimList);
    intelligence.timing.avg_time_to_first_shot_ms = avg(timeToFirstShotList);
    intelligence.timing.avg_time_to_results_ms = avg(timeToResultsList);
    intelligence.timing.avg_session_duration_ms = avg(sessionDurationList);
    intelligence.timing.median_time_to_results_ms = median(timeToResultsList);

    intelligence.diagnostics.avg_group_size_inches = avg(groupSizeList);
    intelligence.diagnostics.min_group_size_inches = minVal(groupSizeList);
    intelligence.diagnostics.max_group_size_inches = maxVal(groupSizeList);

    const topWindage = topNFromMap(windageMap, 1)[0];
    const topElevation = topNFromMap(elevationMap, 1)[0];
    intelligence.diagnostics.most_common_windage_direction = topWindage?.key || "NONE";
    intelligence.diagnostics.most_common_elevation_direction = topElevation?.key || "NONE";

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
        page_views: pageViews,
        scans,
        results_ready: resultsReady,
        results_viewed: resultsViewed,
        vendor_clicks: vendorClicks,
        sessions_completed: sessionsCompleted,
        sessions_abandoned: sessionsAbandoned
      },
      conversion: {
        page_to_results_pct: pageToResultsPct,
        scan_to_results_pct: scanToResultsPct,
        results_to_vendor_pct: resultsToVendorPct,
        scan_to_vendor_pct: scanToVendorPct,
        session_completion_pct: sessionCompletionPct
      },
      pricing: {
        current_rates: { ...REVENUE_RATES }
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
        by_batch: byBatch,
        by_target: byTarget,
        by_mode: byMode,
        by_source: bySource
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

/* ------------------------------------------------------------
   CORRECTION MATH ENDPOINT
------------------------------------------------------------ */
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

      const dialUnit =
        String(body?.dialUnit || "MOA").toUpperCase() === "MRAD" ? "MRAD" : "MOA";
      const clickValue = clampNum(body?.clickValue, dialUnit === "MRAD" ? 0.1 : 0.25);

      if (!(clickValue > 0)) {
        return res.status(400).json({
          ok: false,
          error: "clickValue must be > 0."
        });
      }

      const inchesPerUnit =
        dialUnit === "MOA" ? inchesPerMoa(distanceYds) : inchesPerMrad(distanceYds);

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

/* ------------------------------------------------------------
   START
------------------------------------------------------------ */
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
