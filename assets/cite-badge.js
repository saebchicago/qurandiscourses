/**
 * cite-badge.js — Reusable citation badge component.
 *
 * Usage: include <script src="assets/cite-badge.js"></script> on any page.
 * Badges with data-source-ids="id1 id2" show full citation popovers on click.
 * Source data is loaded once from data/sources.json and cached.
 *
 * The component is self-initializing; no additional JS is needed.
 */
(function () {
  "use strict";

  const STYLE = `
.cite-popover {
  position: absolute;
  z-index: 9000;
  background: var(--card, #fff);
  border: 1px solid var(--line, #ddd);
  border-radius: 6px;
  padding: 0.65rem 0.85rem;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--ink, #1a1a1a);
  box-shadow: 0 4px 16px rgba(0,0,0,0.16);
  max-width: 320px;
  min-width: 200px;
}
.cite-popover h5 {
  margin: 0 0 0.3rem;
  font-size: 0.85rem;
  font-weight: 600;
}
.cite-popover ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.cite-popover ul + ul {
  margin-top: 0.5rem;
  border-top: 1px solid var(--line, #eee);
  padding-top: 0.5rem;
}
.cite-popover li {
  color: var(--muted, #666);
}
.cite-popover a {
  color: var(--accent, #4a7c59);
  word-break: break-all;
}
.cite-popover .cite-close {
  position: absolute;
  top: 0.3rem;
  right: 0.45rem;
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--muted, #999);
  line-height: 1;
  padding: 0;
}
`;

  let sourcesCache = null;
  let activePopover = null;

  function injectStyle() {
    if (document.getElementById("cite-badge-style")) return;
    const el = document.createElement("style");
    el.id = "cite-badge-style";
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  async function loadSources() {
    if (sourcesCache) return sourcesCache;
    try {
      const resp = await fetch("data/sources.json");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      sourcesCache = {};
      for (const s of data.sources || []) sourcesCache[s.id] = s;
    } catch {
      sourcesCache = {};
    }
    return sourcesCache;
  }

  function formatCitation(src) {
    const parts = [];
    if (src.author) parts.push(src.author + ".");
    if (src.name) {
      const namePart = src.edition
        ? `<em>${src.name}</em>, ${src.edition}`
        : `<em>${src.name}</em>`;
      parts.push(namePart + ".");
    }
    if (src.publisher)
      parts.push(src.publisher + (src.year ? ", " + src.year : "") + ".");
    if (src.isbn) parts.push("ISBN " + src.isbn + ".");
    return parts.join(" ");
  }

  function buildPopover(sources) {
    const pop = document.createElement("div");
    pop.className = "cite-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Citation");

    const closeBtn = document.createElement("button");
    closeBtn.className = "cite-close";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Close citation");
    closeBtn.addEventListener("click", closePopover);
    pop.appendChild(closeBtn);

    const h5 = document.createElement("h5");
    h5.textContent = sources.length === 1 ? "Source" : "Sources";
    pop.appendChild(h5);

    const ul = document.createElement("ul");
    for (const src of sources) {
      const li = document.createElement("li");
      li.innerHTML = formatCitation(src);
      if (src.url) {
        const a = document.createElement("a");
        a.href = src.url;
        a.textContent = src.url;
        a.target = "_blank";
        a.rel = "noopener";
        const linkLi = document.createElement("li");
        linkLi.appendChild(a);
        ul.appendChild(li);
        ul.appendChild(linkLi);
      } else {
        ul.appendChild(li);
      }
    }
    pop.appendChild(ul);
    return pop;
  }

  function positionPopover(pop, anchor) {
    document.body.appendChild(pop);
    const ar = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = ar.top + scrollY - pr.height - 8;
    let left = ar.left + scrollX + ar.width / 2 - pr.width / 2;

    // Flip below if off-screen above
    if (top < scrollY + 8) top = ar.bottom + scrollY + 8;
    // Keep within viewport horizontally
    if (left < 8) left = 8;
    if (left + pr.width > window.innerWidth - 8)
      left = window.innerWidth - 8 - pr.width;

    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  function closePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
  }

  async function handleBadgeClick(e) {
    const badge = e.currentTarget;
    if (activePopover) {
      closePopover();
      return;
    }

    const ids = (badge.dataset.sourceIds || "").split(/\s+/).filter(Boolean);
    if (ids.length === 0) return;

    const map = await loadSources();
    const sources = ids.map((id) => map[id]).filter(Boolean);
    if (sources.length === 0) return;

    e.stopPropagation();
    const pop = buildPopover(sources);
    activePopover = pop;
    positionPopover(pop, badge);
  }

  function init() {
    injectStyle();
    document.querySelectorAll(".badge[data-source-ids]").forEach((badge) => {
      badge.addEventListener("click", handleBadgeClick);
    });
    document.addEventListener("click", (e) => {
      if (activePopover && !activePopover.contains(e.target)) closePopover();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePopover();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
