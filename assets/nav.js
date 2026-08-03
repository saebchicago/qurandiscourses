/* Primary-nav enhancement.

   The nav itself is plain HTML: five <details> groups, each disclosing
   its own link list. Opening, closing, and keyboard operation are the
   browser's, not this script's, which is what lets the nav work with
   JavaScript disabled and at 375px. The shared name="nav-group"
   attribute makes browsers close sibling groups on their own.

   Everything here is optional polish on top of that:
     - mark the link for the current page, and its group
     - close an open group on outside click or Escape, which <details>
       does not do by itself

   If this file never loads, the nav still navigates. */
(function () {
  "use strict";

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
    if (!last || last.indexOf(".") === -1) return "/";
    return last;
  }

  ready(function () {
    var nav = document.querySelector("nav.primary");
    if (!nav) return;
    var groups = Array.prototype.slice.call(nav.querySelectorAll(".nav-group"));
    if (!groups.length) return;

    var here = currentPage();

    groups.forEach(function (group) {
      var hasCurrent = false;
      group.querySelectorAll(".nav-menu a").forEach(function (link) {
        // Compare paths only: the Read group's "Today's discourse"
        // points at index.html#dailySection, and a fragment must not
        // stop the home page from marking it.
        var href = (link.getAttribute("href") || "").toLowerCase();
        if (href.split("#")[0] === here) {
          link.setAttribute("aria-current", "page");
          hasCurrent = true;
        }
      });
      if (hasCurrent) group.setAttribute("data-current", "true");
    });

    function openDetails() {
      return Array.prototype.slice.call(
        nav.querySelectorAll(".nav-details[open]"),
      );
    }

    function closeAll() {
      openDetails().forEach(function (d) {
        d.open = false;
      });
    }

    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest("nav.primary .nav-group")) {
        closeAll();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var open = openDetails();
      if (!open.length) return;
      // Return focus to the summary the reader opened, the way a
      // dismissed menu should.
      var summary = open[0].querySelector("summary");
      var insideNav = nav.contains(document.activeElement);
      closeAll();
      if (summary && insideNav) summary.focus();
    });
  });
})();
