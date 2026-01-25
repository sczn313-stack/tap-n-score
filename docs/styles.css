:root{
  --bg: #06070a;
  --panel: rgba(12,14,20,0.72);
  --panel2: rgba(16,18,28,0.82);
  --stroke: rgba(255,255,255,0.10);
  --text: rgba(255,255,255,0.92);
  --muted: rgba(255,255,255,0.62);
  --accent: #2563eb;        /* blue */
  --accent2: #0ea5e9;       /* sky */
  --danger: #dc2626;        /* red */
  --good: #22c55e;          /* green */
  --shadow: 0 18px 55px rgba(0,0,0,0.55);
  --radius: 18px;
  --radius2: 14px;
  --font: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

*{ box-sizing: border-box; }
html,body{ height:100%; }
body{
  margin:0;
  font-family: var(--font);
  background:
    radial-gradient(1200px 700px at 15% 5%, rgba(220,38,38,0.18), transparent 55%),
    radial-gradient(1200px 700px at 55% 10%, rgba(37,99,235,0.20), transparent 55%),
    radial-gradient(900px 600px at 85% 25%, rgba(14,165,233,0.12), transparent 55%),
    var(--bg);
  color: var(--text);
}

/* ===== Header ===== */
.topHeader{
  position: sticky;
  top: 0;
  z-index: 50;
  display:flex;
  align-items:center;
  gap: 12px;
  padding: 14px 14px;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--stroke);
}

.brandLeft{ display:flex; flex-direction:column; gap:4px; }
.brandLine{ font-weight: 900; letter-spacing: 1px; font-size: 28px; }
.brandTap{ color:#ef4444; }
.brandN{ color: rgba(255,255,255,0.85); }
.brandScore{ color:#3b82f6; }
.brandTm{ color: rgba(255,255,255,0.75); font-weight: 800; font-size: 18px; margin-left: 6px; }
.brandSub{ color: var(--muted); font-weight: 600; }

.vendorSlot{
  margin-left: auto;
  display:flex;
  align-items:center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.06);
  text-decoration:none;
  color: var(--text);
  min-height: 44px;
}
.vendorLogo{
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 10px;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.10);
  display:none; /* shown when vendor.json loads */
}
.vendorText{ display:flex; flex-direction:column; line-height: 1.1; }
.vendorName{ font-weight: 850; font-size: 14px; }
.vendorHint{ color: var(--muted); font-size: 12px; }

.pillBtn{
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  padding: 10px 14px;
  border-radius: 999px;
  font-weight: 750;
}

/* ===== Page ===== */
.page{
  padding: 14px;
  max-width: 980px;
  margin: 0 auto;
}

.actionsTop{
  display:flex;
  align-items:center;
  gap: 12px;
  margin-top: 10px;
}

.pillGroup{
  margin-left: auto;
  display:flex;
  gap: 10px;
}
.pill{
  display:inline-flex;
  align-items:center;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,0.05);
  color: var(--muted);
  font-weight: 750;
}

/* ===== Shared action button style (match by using this everywhere) ===== */
.actionBtn{
  appearance:none;
  border: 1px solid rgba(255,255,255,0.16);
  background: linear-gradient(180deg, rgba(37,99,235,0.85), rgba(37,99,235,0.55));
  color: white;
  padding: 12px 14px;
  border-radius: 14px;
  font-weight: 850;
  letter-spacing: 0.2px;
  box-shadow: 0 12px 35px rgba(0,0,0,0.45);
  cursor: pointer;
  user-select: none;
  min-height: 44px;
}
.actionBtn:active{ transform: translateY(1px); }

.actionBtn.secondaryBtn{
  background: rgba(255,255,255,0.06);
  color: var(--text);
  border: 1px solid var(--stroke);
  box-shadow: none;
}

.actionBtn.primaryBtn{
  background: linear-gradient(180deg, rgba(37,99,235,0.95), rgba(14,165,233,0.60));
}

.actionBtn.secBtn{
  background: linear-gradient(180deg, rgba(220,38,38,0.95), rgba(37,99,235,0.65));
}

/* ===== Stage / target ===== */
.stage{ margin-top: 12px; }

.instructionLine{
  color: var(--muted);
  font-weight: 650;
  margin: 10px 2px 12px;
}

.targetWrap{
  position: relative;
  background: var(--panel);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}

.targetImg{
  display:block;
  width:100%;
  height:auto;
  background: rgba(0,0,0,0.25);
}

.dotsLayer{
  position:absolute;
  left:0; top:0; right:0; bottom:0;
  pointer-events: none;
}

.dot{
  position:absolute;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  transform: translate(-50%,-50%);
  border: 3px solid rgba(255,255,255,0.90);
  background: rgba(34,197,94,0.85);
  box-shadow: 0 8px 18px rgba(0,0,0,0.45);
}
.dot.bull{
  background: rgba(245,158,11,0.85);
  border-color: rgba(255,255,255,0.90);
}

.controlsRow{
  display:flex;
  align-items:center;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.spacer{ flex: 1; min-width: 10px; }

/* ===== Results ===== */
.results{
  margin-top: 18px;
  padding-top: 8px;
}
.resultsTitle{
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 900;
  color: rgba(255,255,255,0.90);
}

.card{
  border: 1px solid var(--stroke);
  background: var(--panel2);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow);
}

.cardTitle{
  font-weight: 900;
  margin-bottom: 10px;
  color: rgba(255,255,255,0.88);
}

.row{
  display:grid;
  grid-template-columns: 120px 1fr 40px 140px;
  align-items:center;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.row:first-of-type{ border-top: none; }

.label{ color: var(--muted); font-weight: 700; }
.value{ font-weight: 950; letter-spacing: 0.8px; }
.arrow{ color: rgba(255,255,255,0.55); text-align:center; }
.right{ text-align:right; font-weight: 850; color: rgba(255,255,255,0.86); }

@media (max-width: 520px){
  .row{ grid-template-columns: 110px 1fr 28px 120px; }
  .brandLine{ font-size: 24px; }
}

/* ===== SEC overlay ===== */
.secOverlay{
  position: fixed;
  inset: 0;
  z-index: 1000;
  display:none;
  align-items:center;
  justify-content:center;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(10px);
  padding: 18px;
}
.secOverlay.show{ display:flex; }

.secPanel{
  width: min(980px, 100%);
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(0,0,0,0.55);
  box-shadow: 0 30px 120px rgba(0,0,0,0.65);
  overflow:hidden;
}

#secCanvas{
  display:block;
  width: 100%;
  height: auto;
  background: #0b0c10;
}

.secActions{
  display:flex;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,0.10);
}

/* ===== SEC MODE: Tap-n-Score disappears while SEC is shown ===== */
body.secMode .tapnscoreHeader{
  display:none !important;
}
