// ============================================================
// BRICK 7 (FULL REPLACEMENT) — MOMA WIRING (LIVE + IN⇄M CONVERT)
// Replace your entire existing MOMA wiring section with this.
// ============================================================

// ----- MOMA wiring (LIVE feel; session-only; no duplicate inside SEC)
function syncMomaUIFromSession() {
  const isMetric = session.unit === "m";

  unitToggle.checked = isMetric;
  unitLabel.textContent = isMetric ? "M" : "IN";
  distanceUnit.textContent = isMetric ? "m" : "yd";

  // Keep inputs normalized to current session values
  distanceInput.value = isMetric
    ? fmt2(session.distanceYds / YARDS_PER_METER) // show meters
    : fmt2(session.distanceYds);                 // show yards

  clickInput.value = fmt2(session.clickMoa);
}

function normalizeAndApplyMomaFromUI() {
  const wantsMetric = !!unitToggle.checked;

  // 1) Unit
  session.unit = wantsMetric ? "m" : "in";
  unitLabel.textContent = wantsMetric ? "M" : "IN";
  distanceUnit.textContent = wantsMetric ? "m" : "yd";

  // 2) Distance (what user sees is either yards or meters)
  const distRaw = (distanceInput.value || "").trim();
  const distFallback = wantsMetric ? (100 / YARDS_PER_METER) : 100;
  const distNum = clampNum(distRaw, distFallback);

  session.distanceYds = wantsMetric ? (distNum * YARDS_PER_METER) : distNum;
  if (session.distanceYds <= 0) session.distanceYds = 100;

  // 3) Click value
  const clickRaw = (clickInput.value || "").trim();
  const clickNum = clampNum(clickRaw, 0.25);
  session.clickMoa = (clickNum > 0) ? clickNum : 0.25;

  // 4) Normalize UI fields back to clean formatted values
  syncMomaUIFromSession();

  // 5) Live re-render SEC if we have computed state
  if (bullPx && hitsPx.length > 0 && pxPerInchX && pxPerInchY) {
    lastResult = computeResult();
    renderSEC(lastResult);
  }
}

// Convert ONLY the distance field when the unit toggle flips (instant feel)
function convertDistanceFieldOnUnitFlip() {
  const currentlyMetric = session.unit === "m";  // what session is right now
  const nextMetric = !!unitToggle.checked;       // what user just selected

  if (currentlyMetric === nextMetric) return;

  // Read what’s currently displayed in the distance box
  const raw = (distanceInput.value || "").trim();
  let val = clampNum(raw, currentlyMetric ? (100 / YARDS_PER_METER) : 100);

  // Convert displayed value:
  // - switching yards->meters: divide by YARDS_PER_METER
  // - switching meters->yards: multiply by YARDS_PER_METER
  if (!currentlyMetric && nextMetric) {
    // yards -> meters (display)
    val = val / YARDS_PER_METER;
  } else if (currentlyMetric && !nextMetric) {
    // meters -> yards (display)
    val = val * YARDS_PER_METER;
  }

  distanceInput.value = fmt2(val);

  // Apply everything (sets session.unit, updates labels, re-renders SEC)
  normalizeAndApplyMomaFromUI();
}

// Events
unitToggle.addEventListener("change", convertDistanceFieldOnUnitFlip);
momaApplyBtn.addEventListener("click", normalizeAndApplyMomaFromUI);

// Enter key applies
distanceInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    normalizeAndApplyMomaFromUI();
    distanceInput.blur();
  }
});
clickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    normalizeAndApplyMomaFromUI();
    clickInput.blur();
  }
});

// Blur applies (feels live)
distanceInput.addEventListener("blur", normalizeAndApplyMomaFromUI);
clickInput.addEventListener("blur", normalizeAndApplyMomaFromUI);
