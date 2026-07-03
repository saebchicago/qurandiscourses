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
  });
})();
