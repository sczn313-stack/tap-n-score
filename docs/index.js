/* ============================================================
   SEC ROUTE + PAYLOAD (FULL REPLACEMENT)
   Writes Shooter Experience Card data to localStorage
   Then routes to sec.html
============================================================ */

const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

// Build the SEC payload from BACKEND AUTHORITY ONLY
const secPayload = {
  sessionId:
    data.sessionId ||
    `SEC-${Date.now().toString(36).toUpperCase()}`,

  // Score (number only — SEC handles coloring)
  score: Number(data.score),

  // Shot count
  shots: Number(data.shots),

  // Windage (LEFT / RIGHT already decided by backend)
  windage: {
    dir:
      data.windage?.dir ||
      data.clicks?.windDir ||
      data.windDir ||
      "—",
    clicks:
      data.windage?.clicks ??
      data.clicks?.windage ??
      data.windageClicks ??
      0
  },

  // Elevation (UP / DOWN already decided by backend)
  elevation: {
    dir:
      data.elevation?.dir ||
      data.clicks?.elevDir ||
      data.elevDir ||
      "—",
    clicks:
      data.elevation?.clicks ??
      data.clicks?.elevation ??
      data.elevationClicks ??
      0
  },

  // Optional links (safe placeholders)
  vendorUrl: "",
  surveyUrl: ""
};

// Persist for SEC page
localStorage.setItem(SEC_KEY, JSON.stringify(secPayload));

// Route to Shooter Experience Card
window.location.href = "./sec.html";
