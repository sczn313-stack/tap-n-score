// ------------------------------------------------------------
// SEC (Shooter Experience Card) — demo payload endpoint
// Purpose: give the frontend ONE stable object to render as SEC.
// Later we can swap this to return a PNG/PDF, but the shape stays.
// ------------------------------------------------------------
app.get("/api/sec-demo", (req, res) => {
  // SCZN3 defaults (v1.2)
  const distanceYds = 100;
  const moaPerClick = 0.25;

  // Demo inputs (normalized 0..1)
  const anchor = { x: 0.5, y: 0.5 };
  const hits = [
    { x: 0.55, y: 0.48 },
    { x: 0.52, y: 0.50 },
    { x: 0.58, y: 0.46 },
  ];

  // Compute POIB (mean)
  const poib = {
    x: hits.reduce((s, p) => s + p.x, 0) / hits.length,
    y: hits.reduce((s, p) => s + p.y, 0) / hits.length,
  };

  // Vector from POIB -> bull/anchor (bull - poib)
  const dx = anchor.x - poib.x;
  const dy = anchor.y - poib.y;

  // Direction labels (screen-space): +x = right, +y = down
  // If dy is positive (POIB is above bull in screen-space), correction is DOWN? No:
  // We’re moving POI to the bull: if bull is BELOW POIB (dy>0), shooter must move impact DOWN.
  const windage = dx >= 0 ? "RIGHT" : "LEFT";
  const elevation = dy >= 0 ? "DOWN" : "UP";

  // Placeholder inches conversion (we’ll replace with real scale from target profile)
  // For now, treat normalized delta as “inches” just so the card wiring works end-to-end.
  const dxIn = Math.abs(dx).toFixed(4);
  const dyIn = Math.abs(dy).toFixed(4);

  // Convert inches -> MOA -> clicks (placeholder math until scale is real)
  // 1 MOA ~ 1.047" at 100 yards (general)
  const inchesPerMOA = (1.047 * distanceYds) / 100;
  const moaX = Math.abs(dx) / inchesPerMOA;
  const moaY = Math.abs(dy) / inchesPerMOA;
  const clicksX = (moaX / moaPerClick).toFixed(2);
  const clicksY = (moaY / moaPerClick).toFixed(2);

  res.json({
    ok: true,
    sec: {
      version: "sec-payload-v1",
      defaults: { distanceYds, moaPerClick },
      input: { anchor, hits },
      poib,
      delta: {
        dx, dy,
        dxAbs: Number(Math.abs(dx).toFixed(6)),
        dyAbs: Number(Math.abs(dy).toFixed(6)),
        dxIn: Number(dxIn),
        dyIn: Number(dyIn),
      },
      correction: {
        windage,
        elevation,
        clicks: {
          windage: Number(clicksX),
          elevation: Number(clicksY),
        },
      },
      next: {
        prompt: "Run the Next 5-Shot Challenge after applying the correction.",
      },
    },
  });
});
