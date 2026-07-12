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

  // Popover styles live in assets/style.css (.cite-popover*), not a runtime
  // <style> injection, so the CSP can keep style-src-elem free of
  // 'unsafe-inline'.

  let sourcesCache = null;
  let activePopover = null;

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

  // Chicago bibliography order:
  // Author. Title, edition. Place: Publisher, year. ISBN. License. Accessed.
  function formatCitation(src) {
    const parts = [];
    if (src.author) parts.push(src.author + ".");
    if (src.name) {
      const namePart = src.edition
        ? `<em>${src.name}</em>, ${src.edition}`
        : `<em>${src.name}</em>`;
      parts.push(namePart + ".");
    }
    if (src.publisher) {
      parts.push(src.publisher + (src.year ? ", " + src.year : "") + ".");
    } else if (src.year) {
      parts.push(src.year + ".");
    }
    if (src.isbn) parts.push("ISBN " + src.isbn + ".");
    if (src.license) parts.push(src.license + ".");
    if (src.accessed) parts.push("Accessed " + src.accessed + ".");
    if (src.note) parts.push(src.note);
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

  // Guards the async open: role="button" makes some browsers synthesize a
  // click on Enter, so a keypress can invoke this twice before the first
  // call has set activePopover.
  let opening = false;

  async function handleBadgeClick(e) {
    const badge = e.currentTarget;
    if (activePopover) {
      closePopover();
      return;
    }
    if (opening) return;
    opening = true;
    try {
      const ids = (badge.dataset.sourceIds || "").split(/\s+/).filter(Boolean);
      if (ids.length === 0) return;

      const map = await loadSources();
      const sources = ids.map((id) => map[id]).filter(Boolean);
      if (sources.length === 0) return;

      e.stopPropagation();
      const pop = buildPopover(sources);
      activePopover = pop;
      positionPopover(pop, badge);
    } finally {
      opening = false;
    }
  }

  // Badges are focusable spans, not buttons: without role/tabindex,
  // keyboard users can reach a badge but never open its citation. Pages
  // that render badges dynamically (Roots detail, Patterns browser, the
  // verify examples) can call window.qdCiteEnhance(container) after
  // inserting HTML; click/keydown handling itself is delegated at the
  // document level, so it needs no rebinding.
  function enhance(root) {
    (root || document)
      .querySelectorAll(".badge[data-source-ids]")
      .forEach((badge) => {
        if (!badge.hasAttribute("role")) badge.setAttribute("role", "button");
        if (!badge.hasAttribute("tabindex")) badge.setAttribute("tabindex", "0");
      });
  }

  function init() {
    enhance(document);
    // Browsers may synthesize a click after Enter/Space on role="button"
    // (Chromium fires it on Space keyup), which would immediately toggle
    // the popover the keydown handler just opened.
    let lastKeyActivation = 0;
    document.addEventListener("click", (e) => {
      const badge =
        e.target.closest && e.target.closest(".badge[data-source-ids]");
      if (badge) {
        if (Date.now() - lastKeyActivation < 500) return;
        handleBadgeClick({
          currentTarget: badge,
          stopPropagation() {
            e.stopPropagation();
          },
        });
        return;
      }
      if (activePopover && !activePopover.contains(e.target)) closePopover();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePopover();
        return;
      }
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        const badge =
          e.target.closest && e.target.closest(".badge[data-source-ids]");
        if (badge) {
          e.preventDefault();
          lastKeyActivation = Date.now();
          handleBadgeClick({ currentTarget: badge, stopPropagation() {} });
        }
      }
    });
  }

  window.qdCiteEnhance = enhance;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
