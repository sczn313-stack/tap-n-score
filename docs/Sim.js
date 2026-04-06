(() => {
  const MIN_SHOTS = 3;
  const TRUE_MOA_INCHES_AT_100 = 1.047;

  // Elements
  const resultsBtn =
    document.getElementById("resultsBtn") ||
    document.getElementById("showResultsBtn");

  // These MUST already exist in your file
  // (they are used elsewhere in your current code)
  // If names differ, adjust ONLY here:
  // shots, windageClicks, elevationClicks, scoreValue

  // Guard
  if (!resultsBtn) {
    console.warn("RESULTS BUTTON NOT FOUND");
    return;
  }

  // REMOVE any existing click handlers by cloning
  const newBtn = resultsBtn.cloneNode(true);
  resultsBtn.parentNode.replaceChild(newBtn, resultsBtn);

  // NEW CLEAN HANDLER
  newBtn.addEventListener("click", () => {
    try {
      if (!shots || shots.length < MIN_SHOTS) {
        alert("Add at least 3 shots");
        return;
      }

      const result = {
        shots: shots.length,
        windage_clicks:
          typeof windageClicks !== "undefined" ? windageClicks : 0,
        elevation_clicks:
          typeof elevationClicks !== "undefined" ? elevationClicks : 0,
        score:
          typeof scoreValue !== "undefined" ? scoreValue : 0,
        timestamp: Date.now()
      };

      // 🔑 SAVE FOR SEC
      sessionStorage.setItem(
        "sczn3_last_result",
        JSON.stringify(result)
      );

      // 🔁 REDIRECT (cache-busted)
      window.location.href = "sec.html?cb=" + Date.now();
    } catch (err) {
      console.error("RESULT FLOW ERROR:", err);
      alert("Error processing results");
    }
  });
})();
