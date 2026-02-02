/* ============================================================
   SEC ROUTE + PAYLOAD (FULL REPLACEMENT)
   - Writes Shooter Experience Card data to localStorage
   - Then routes to sec.html
   - SEC page reads key: "SCZN3_SEC_PAYLOAD_V1"
============================================================ */

function routeToSEC_FromBackendResult(data) {
  const SEC_KEY = "SCZN3_SEC_PAYLOAD_V1";

  // Build the SEC payload from BACKEND AUTHORITY ONLY
  const secPayload = {
    sessionId:
      data.sessionId ||
      `SEC-${Date.now().toString(36).toUpperCase()}`,

    // Score (number only — SEC handles coloring)
    score: Number.isFinite(Number(data.score)) ? Number(data.score) : null,

    // Shot count
    shots: Number.isFinite(Number(data.shots)) ? Number(data.shots) : 0,

    // Windage (LEFT/RIGHT decided by backend)
    windage: {
      dir:
        data.windage?.dir ||
        data.clicks?.windDir ||
        data.windDir ||
        "—",
      clicks:
        (data.windage?.clicks ??
          data.clicks?.windage ??
          data.windageClicks ??
          0)
    },

    // Elevation (UP/DOWN decided by backend)
    elevation: {
      dir:
        data.elevation?.dir ||
        data.clicks?.elevDir ||
        data.elevDir ||
        "—",
      clicks:
        (data.elevation?.clicks ??
          data.clicks?.elevation ??
          data.elevationClicks ??
          0)
    },

    // OPTIONAL: if backend returns a generated SEC PNG URL
    // (If you use download.html?img=... style, keep this)
    secPngUrl: data.secPngUrl || data.secUrl || "",

    // Optional links (safe placeholders)
    vendorUrl: data.vendorUrl || "",
    surveyUrl: data.surveyUrl || ""
  };

  // Persist for SEC page
  try {
    localStorage.setItem(SEC_KEY, JSON.stringify(secPayload));
  } catch (e) {
    console.error("SEC localStorage write failed:", e);
  }

  // Helpful debug (you can remove later)
  console.log("✅ SEC payload written:", secPayload);

  // Route to Shooter Experience Card
  window.location.href = "./sec.html";
}

/* ============================================================
   CALL THIS RIGHT AFTER YOU GET BACKEND RESULTS
   Example usage inside your Show Results handler:
============================================================ */

// Example: if your handler already has `data` from fetch:
// routeToSEC_FromBackendResult(data);
