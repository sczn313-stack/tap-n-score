/* ============================================================
   coach.js — THUMB-CHECK COACHMARK (v1)
   Purpose:
   - Shows a green arrow + smiley pointing to the selected thumb checkmark
   API:
   - window.SCOACH.showForElement(el)  // el = the checkmark element (or the thumb)
   - window.SCOACH.hide()
============================================================ */

(() => {
  const NS = {};

  let root = null;
  let arrow = null;
  let bubble = null;
  let targetEl = null;

  function ensure() {
    if (root) return;

    root = document.createElement("div");
    root.id = "coachMark";
    root.className = "hidden";

    // SVG arrow (green)
    arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("id", "coachArrow");
    arrow.setAttribute("viewBox", "0 0 300 240");

    arrow.innerHTML = `
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#60ff9a" stop-opacity="1"/>
          <stop offset="1" stop-color="#10d966" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <path d="M30,170
               C90,70 170,60 230,80
               C250,87 265,98 275,112
               L255,110
               L285,140
               L245,150
               L252,132
               C245,122 234,112 220,106
               C176,88 120,98 68,178
               Z"
            fill="url(#g)" stroke="rgba(0,0,0,.25)" stroke-width="6" />
    `;

    bubble = document.createElement("div");
    bubble.id = "coachBubble";
    bubble.innerHTML = `LOOK FOR THE ✅<span class="smile">🙂</span><span class="small">Then press Results</span>`;

    root.appendChild(arrow);
    root.appendChild(bubble);
    document.body.appendChild(root);

    // keep it locked during rotate/resize/scroll changes
    const relock = () => position();
    window.addEventListener("resize", () => setTimeout(relock, 60));
    window.addEventListener("orientationchange", () => setTimeout(relock, 120));
    window.addEventListener("scroll", () => setTimeout(relock, 30), { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => setTimeout(relock, 60));
      window.visualViewport.addEventListener("scroll", () => setTimeout(relock, 30));
    }
  }

  function position() {
    if (!root || !targetEl) return;

    const r = targetEl.getBoundingClientRect();
    if (!r.width || !r.height) return;

    // Anchor point = center of the checkmark (or element)
    const x = r.left + r.width * 0.55;
    const y = r.top + r.height * 0.45;

    root.classList.remove("hidden");
    root.style.left = `${Math.round(x)}px`;
    root.style.top = `${Math.round(y)}px`;
  }

  NS.showForElement = (el) => {
    if (!el) return;
    ensure();
    targetEl = el;
    position();
  };

  NS.hide = () => {
    if (!root) return;
    targetEl = null;
    root.classList.add("hidden");
  };

  window.SCOACH = NS;
})();
