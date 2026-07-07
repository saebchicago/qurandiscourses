/* Grouped-dropdown primary nav. Progressive enhancement:
   without this script, .nav-menu lists render as visible stacked links. */
(function () {
  var docEl = document.documentElement;
  docEl.classList.add("js-nav");

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function currentPage() {
    var path = (window.location.pathname || "").toLowerCase();
    var last = path.split("/").filter(Boolean).pop() || "";
    if (!last || last.indexOf(".") === -1) return "index.html";
    return last;
  }

  ready(function () {
    var nav = document.querySelector("nav.primary");
    if (!nav) return;
    var groups = Array.prototype.slice.call(nav.querySelectorAll(".nav-group"));
    if (!groups.length) return;

    var here = currentPage();

    var groupData = groups
      .map(function (group) {
        var btn = group.querySelector(".nav-group-btn");
        var menu = group.querySelector(".nav-menu");
        if (!btn || !menu) return null;
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        var links = Array.prototype.slice.call(menu.querySelectorAll("a"));
        var hasCurrent = false;
        links.forEach(function (link) {
          var href = (link.getAttribute("href") || "").toLowerCase();
          if (href === here) {
            link.setAttribute("aria-current", "page");
            hasCurrent = true;
          }
        });
        if (hasCurrent) group.setAttribute("data-current", "true");
        return { group: group, btn: btn, menu: menu, links: links };
      })
      .filter(Boolean);

    function closeAll(except) {
      groupData.forEach(function (g) {
        if (g === except) return;
        if (!g.menu.hidden) {
          g.menu.hidden = true;
          g.btn.setAttribute("aria-expanded", "false");
        }
      });
    }

    function openGroup(g) {
      closeAll(g);
      g.menu.hidden = false;
      g.btn.setAttribute("aria-expanded", "true");
    }

    function closeGroup(g) {
      g.menu.hidden = true;
      g.btn.setAttribute("aria-expanded", "false");
    }

    function toggleGroup(g) {
      if (g.menu.hidden) openGroup(g);
      else closeGroup(g);
    }

    groupData.forEach(function (g) {
      g.btn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleGroup(g);
      });
      g.btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          openGroup(g);
          if (g.links[0]) g.links[0].focus();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          openGroup(g);
          if (g.links[0]) g.links[0].focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          openGroup(g);
          if (g.links[g.links.length - 1]) g.links[g.links.length - 1].focus();
        } else if (e.key === "Escape") {
          if (!g.menu.hidden) closeGroup(g);
        }
      });

      g.menu.addEventListener("keydown", function (e) {
        var idx = g.links.indexOf(document.activeElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          var n = g.links[(idx + 1) % g.links.length];
          if (n) n.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          var p = g.links[(idx - 1 + g.links.length) % g.links.length];
          if (p) p.focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          if (g.links[0]) g.links[0].focus();
        } else if (e.key === "End") {
          e.preventDefault();
          if (g.links[g.links.length - 1]) g.links[g.links.length - 1].focus();
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeGroup(g);
          g.btn.focus();
        } else if (e.key === "Tab") {
          e.preventDefault();
          if (e.shiftKey) {
            if (idx <= 0) g.btn.focus();
            else g.links[idx - 1].focus();
          } else {
            if (idx === g.links.length - 1) g.btn.focus();
            else g.links[idx + 1].focus();
          }
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest("nav.primary .nav-group")) {
        closeAll(null);
      }
    });

    document.addEventListener("focusin", function (e) {
      if (!e.target.closest || !e.target.closest("nav.primary")) {
        closeAll(null);
      }
    });

    /* Mobile hamburger panel: collapses .nav-groups behind a toggle
       below 768px. Injected here rather than in markup so every page
       gets it from this one shared script. */
    var groupsList = nav.querySelector(".nav-groups");
    if (!groupsList.id) groupsList.id = "nav-groups-panel";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", groupsList.id);
    toggle.setAttribute("aria-label", "Menu");
    toggle.innerHTML =
      '<span class="nav-toggle-icon" aria-hidden="true"><span class="nav-toggle-icon-bar"></span></span>' +
      '<span class="nav-toggle-label">Menu</span>';
    nav.insertBefore(toggle, groupsList);

    function isPanelOpen() {
      return groupsList.classList.contains("is-open");
    }

    function openPanel() {
      groupsList.classList.add("is-open");
      toggle.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      toggle.querySelector(".nav-toggle-label").textContent = "Close";
    }

    function closePanel(focusToggle) {
      groupsList.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Menu");
      toggle.querySelector(".nav-toggle-label").textContent = "Menu";
      closeAll(null);
      if (focusToggle) toggle.focus();
    }

    toggle.addEventListener("click", function () {
      if (isPanelOpen()) closePanel(false);
      else openPanel();
    });

    function getPanelFocusable() {
      var els = Array.prototype.slice.call(
        nav.querySelectorAll("button, a[href]"),
      );
      return els.filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!isPanelOpen()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel(true);
        return;
      }
      if (e.key === "Tab") {
        var focusable = getPanelFocusable();
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 768 && isPanelOpen()) {
        closePanel(false);
      }
    });
  });
})();
