(() => {
  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const TRACK_ENDPOINT = "https://tap-n-score-backend.onrender.com/api/track";

  function getParam(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name) || "";
    } catch {
      return "";
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = String(value ?? "");
  }

  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  function arrowForDirection(dir, axis) {
    const d = String(dir || "").toUpperCase();
    if (axis === "vertical") {
      if (d === "UP") return "↑";
      if (d === "DOWN") return "↓";
      return "•";
    }
    if (d === "LEFT") return "←";
    if (d === "RIGHT") return "→";
    return "•";
  }

  function loadPayload() {
    try {
      const raw = localStorage.getItem(KEY_PAYLOAD);
      if (raw) return JSON.parse(raw);
    } catch {}

    const b64 = getParam("payload");
    if (b64) {
      try {
        return JSON.parse(decodeURIComponent(escape(atob(b64))));
      } catch {}
    }

    return null;
  }

  const payload = loadPayload();

  const vendor = (getParam("v") || "unknown").toLowerCase();
  const sku = (getParam("sku") || "unknown").toLowerCase();
  const batch = (getParam("b") || "").toLowerCase();

  const sessionId = (() => {
    const key = "SCZN3_TRACK_SESSION_ID_V1";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, value);
    }
    return value;
  })();

  function trackEvent(eventName, extra = {}) {
    const resolvedVendor =
      vendor !== "unknown"
        ? vendor
        : (payload?.vendor || "").toLowerCase() || "unknown";

    const resolvedSku =
      sku !== "unknown"
        ? sku
        : (payload?.sku || "").toLowerCase() || "unknown";

    const resolvedBatch =
      batch || (payload?.batch || "").toLowerCase() || "";

    const body = {
      event: eventName,
      vendor: resolvedVendor,
      sku: resolvedSku,
      batch: resolvedBatch,
      page: "docs/sec",
      mode: "sec",
      session_id: sessionId,
      ts: new Date().toISOString(),
      ...extra
    };

    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(() => {});
  }

  function renderFallback() {
    setText("scoreValue", "—");
    setText("shotsValue", "—");
    setText("dialValue", "—");
    setText("targetValue", "—");
    setText("distanceValue", "—");
    setText("elevationDir", "NO DATA");
    setText("windageDir", "NO DATA");
    setText("elevationClicks", "0.00");
    setText("windageClicks", "0.00");
    setText("elevationArrow", "•");
    setText("windageArrow", "•");
  }

  function renderViz(debug) {
    const el = byId("targetViz");
    if (!el) return;

    el.innerHTML = "";

    // light grid
    [20, 40, 60, 80].forEach((p) => {
      const v = document.createElement("div");
      v.className = "gridLineV";
      v.style.left = `${p}%`;
      el.appendChild(v);

      const h = document.createElement("div");
      h.className = "gridLineH";
      h.style.top = `${p}%`;
      el.appendChild(h);
    });

    const aim = debug?.aim;
    const poi = debug?.avgPoi;

    if (aim) {
      const v = document.createElement("div");
      v.className = "aimCrossV";
      v.style.left = `${aim.x01 * 100}%`;
      v.style.top = `${aim.y01 * 100}%`;
      el.appendChild(v);

      const h = document.createElement("div");
      h.className = "aimCrossH";
      h.style.left = `${aim.x01 * 100}%`;
      h.style.top = `${aim.y01 * 100}%`;
      el.appendChild(h);

      const dot = document.createElement("div");
      dot.className = "aimDot";
      dot.style.left = `${aim.x01 * 100}%`;
      dot.style.top = `${aim.y01 * 100}%`;
      el.appendChild(dot);
    }

    if (poi) {
      const halo = document.createElement("div");
      halo.className = "poiHalo";
      halo.style.left = `${poi.x01 * 100}%`;
      halo.style.top = `${poi.y01 * 100}%`;
      el.appendChild(halo);

      const dot = document.createElement("div");
      dot.className = "poiDot";
      dot.style.left = `${poi.x01 * 100}%`;
      dot.style.top = `${poi.y01 * 100}%`;
      el.appendChild(dot);
    }
  }

  function wireButtons(vendorUrl) {
    const againBtn = byId("againBtn");
    const saveBtn = byId("saveBtn");
    const vendorBtn = byId("vendorBtn");

    againBtn?.addEventListener("click", () => {
      window.location.href = "./index.html?fresh=" + Date.now();
    });

    saveBtn?.addEventListener("click", async () => {
      try {
        if (window.html2canvas) {
          const canvas = await window.html2canvas(document.body);
          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = "SEC.png";
          a.click();
        } else {
          window.print();
        }
      } catch {
        window.print();
      }
    });

    if (vendorBtn && vendorUrl) {
      vendorBtn.classList.remove("hidden");
      vendorBtn.href = vendorUrl;

      vendorBtn.addEventListener("click", () => {
        trackEvent("vendor_click", {
          source: "sec_page",
          destination: vendorUrl
        });
      });
    }
  }

  if (!payload) {
    renderFallback();
    wireButtons("");
    throw new Error("SEC payload missing");
  }

  const score = Number(payload.score || 0);
  const shots = Number(payload.shots || 0);
  const windageDir = String(payload.windage?.dir || "NONE").toUpperCase();
  const windageClicks = round2(payload.windage?.clicks || 0).toFixed(2);
  const elevationDir = String(payload.elevation?.dir || "NONE").toUpperCase();
  const elevationClicks = round2(payload.elevation?.clicks || 0).toFixed(2);
  const dialUnit = String(payload.dial?.unit || "MOA").toUpperCase();
  const clickValue = round2(payload.dial?.clickValue || 0.25).toFixed(2);
  const targetKey = String(payload.target?.key || "23x35").replace("x", "×");
  const distanceYds = round2(payload.debug?.distanceYds || 100);
  const vendorUrl = String(payload.vendorUrl || "");

  setText("scoreValue", score);
  setText("shotsValue", shots);
  setText("dialValue", `${clickValue} ${dialUnit}`);
  setText("targetValue", targetKey);
  setText("distanceValue", `${distanceYds} yds`);

  setText("elevationDir", elevationDir === "NONE" ? "NO CHANGE" : elevationDir);
  setText("windageDir", windageDir === "NONE" ? "NO CHANGE" : windageDir);
  setText("elevationClicks", elevationClicks);
  setText("windageClicks", windageClicks);
  setText("elevationArrow", arrowForDirection(elevationDir, "vertical"));
  setText("windageArrow", arrowForDirection(windageDir, "horizontal"));

  renderViz(payload.debug || {});
  wireButtons(vendorUrl);
})();
