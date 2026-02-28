/* ============================================================
   coach.js (FULL REPLACEMENT) — SCOACH-1
   Purpose:
   - Green arrow + smiley coach mark pointing at a specific element
   - iPad/iOS safe (repositions on resize/orientation/visualViewport)
   API:
     window.SCOACH.showForElement(el)
     window.SCOACH.hide()
============================================================ */

(() => {
  const STATE = {
    root: null,
    bubble: null,
    arrow: null,
    target: null,
    visible: false,
    raf: 0,
    lastRect: null,
  };

  function ensure() {
    if (STATE.root) return;

    const root = document.createElement("div");
    root.id = "scoachRoot";
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "999999";
    root.style.pointerEvents = "none";
    root.style.display = "none";

    const bubble = document.createElement("div");
    bubble.id = "scoachBubble";
    bubble.style.position = "absolute";
    bubble.style.display = "flex";
    bubble.style.alignItems = "center";
    bubble.style.gap = "10px";
    bubble.style.padding = "10px 12px";
    bubble.style.borderRadius = "999px";
    bubble.style.background = "rgba(0,0,0,0.55)";
    bubble.style.backdropFilter = "blur(10px)";
    bubble.style.border = "1px solid rgba(255,255,255,0.14)";
    bubble.style.boxShadow = "0 18px 60px rgba(0,0,0,0.55)";
    bubble.style.color = "rgba(255,255,255,0.92)";
    bubble.style.fontFamily =
      "system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
    bubble.style.fontWeight = "900";
    bubble.style.letterSpacing = "0.2px";
    bubble.style.fontSize = "14px";
    bubble.style.pointerEvents = "none";

    const emoji = document.createElement("div");
    emoji.textContent = "😊";
    emoji.style.fontSize = "18px";
    emoji.style.lineHeight = "1";
    emoji.style.transform = "translateY(1px)";

    const msg = document.createElement("div");
    msg.textContent = "Look for the green check ✓";
    msg.style.opacity = "0.95";

    bubble.appendChild(emoji);
    bubble.appendChild(msg);

    const arrow = document.createElement("div");
    arrow.id = "scoachArrow";
    arrow.style.position = "absolute";
    arrow.style.width = "0";
    arrow.style.height = "0";
    arrow.style.borderLeft = "12px solid transparent";
    arrow.style.borderRight = "12px solid transparent";
    arrow.style.borderTop = "18px solid rgba(80, 255, 150, 0.95)";
    arrow.style.filter = "drop-shadow(0 10px 20px rgba(0,0,0,0.55))";
    arrow.style.transformOrigin = "center";

    root.appendChild(bubble);
    root.appendChild(arrow);
    document.body.appendChild(root);

    STATE.root = root;
    STATE.bubble = bubble;
    STATE.arrow = arrow;
  }

  function rectOf(el) {
    try {
      return el.getBoundingClientRect();
    } catch {
      return null;
    }
  }

  function sameRect(a, b) {
    if (!a || !b) return false;
    return (
      Math.abs(a.left - b.left) < 0.5 &&
      Math.abs(a.top - b.top) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 &&
      Math.abs(a.height - b.height) < 0.5
    );
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function place() {
    if (!STATE.visible || !STATE.target) return;

    const r = rectOf(STATE.target);
    if (!r || r.width === 0 || r.height === 0) return;

    // Skip work if unchanged
    if (sameRect(STATE.lastRect, r)) return;
    STATE.lastRect = r;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Anchor point: near top-right of target element
    const tx = r.left + r.width * 0.85;
    const ty = r.top + r.height * 0.25;

    // Bubble location: slightly above/left of target
    const bubbleW = 240;
    const bubbleH = 44;

    let bx = tx - bubbleW - 18;
    let by = ty - bubbleH - 12;

    // Keep on screen
    bx = clamp(bx, 10, vw - bubbleW - 10);
    by = clamp(by, 10, vh - bubbleH - 10);

    // Arrow location: points to target
    // We’ll place arrow between bubble and target.
    const ax = clamp(tx - 12, 10, vw - 10);
    const ay = clamp(ty - 8, 10, vh - 10);

    STATE.bubble.style.left = `${bx}px`;
    STATE.bubble.style.top = `${by}px`;

    STATE.arrow.style.left = `${ax}px`;
    STATE.arrow.style.top = `${ay}px`;

    // Rotate arrow to “aim” from bubble toward target
    const fromX = bx + bubbleW;
    const fromY = by + bubbleH * 0.65;
    const dx = tx - fromX;
    const dy = ty - fromY;
    const ang = Math.atan2(dy, dx) * (180 / Math.PI);

    STATE.arrow.style.transform = `rotate(${ang - 90}deg)`;
  }

  function schedulePlace() {
    cancelAnimationFrame(STATE.raf);
    STATE.raf = requestAnimationFrame(place);
  }

  function bindListeners() {
    const on = () => schedulePlace();

    window.addEventListener("resize", on, { passive: true });
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(on, 120), {
      passive: true,
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => setTimeout(on, 60), {
        passive: true,
      });
      window.visualViewport.addEventListener("scroll", () => setTimeout(on, 60), {
        passive: true,
      });
    }
  }

  let bound = false;

  function showForElement(el) {
    if (!el) return;

    ensure();
    if (!bound) {
      bindListeners();
      bound = true;
    }

    STATE.target = el;
    STATE.visible = true;
    STATE.lastRect = null;

    STATE.root.style.display = "block";
    schedulePlace();

    // Auto-hide after a bit (keeps it from being annoying)
    setTimeout(() => {
      if (STATE.visible) hide();
    }, 4500);
  }

  function hide() {
    if (!STATE.root) return;
    STATE.visible = false;
    STATE.target = null;
    STATE.lastRect = null;
    STATE.root.style.display = "none";
  }

  window.SCOACH = { showForElement, hide };
})();
