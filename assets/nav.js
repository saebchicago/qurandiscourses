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

  // Flagged before first paint (this file loads in <head>) so a phone
  // never flashes the five-pill row before the tab bar replaces it.
  document.documentElement.classList.add("qd-tabs");

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  // Clean-URL hrefs (/read, never /read.html) mean this must normalize
  // the path itself rather than looking for a file extension: a bare
  // last-segment check used to fall through to "/" on every real page,
  // marking the wrong nav link everywhere but the home page itself.
  function currentPage() {
    var path = (window.location.pathname || "/").toLowerCase();
    path = path.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
    if (path.length > 1 && path.charAt(path.length - 1) === "/") {
      path = path.slice(0, -1);
    }
    return path || "/";
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
  /* ── Phone tab bar ───────────────────────────────────────────────
     Below 768px the five dropdowns give way to four tabs at the foot of
     the screen, where a thumb reaches: Read, Listen, Search, Menu. Menu
     is a sheet holding every link the dropdowns hold (cloned from them,
     so the nav markup stays the one source) plus the page's own tools,
     which on a phone no longer float over the text: Display, Share,
     Pinned and the tour. CSS shows the bar only at phone widths, so
     desktop keeps the dropdowns and the corner buttons as they were. */
  var ICONS = {
    read: '<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',
    listen: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };
  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      ICONS[name] +
      "</svg>"
    );
  }

  // Where Read and Listen go from a page about one surah or juz: that
  // surah or juz. Elsewhere, Read's own resume (its last-read passage).
  // (Read used to be a bare /read everywhere, so on /surah/36 the tab
  // opened whatever the reader last read instead of Yasin.)
  function passageQuery(here) {
    var m = here.match(/^\/surah\/(\d+)$/);
    if (m) return "?s=" + m[1];
    m = here.match(/^\/juz\/(\d+)$/);
    if (m) return "?j=" + m[1];
    return "";
  }
  function listenHref(here) {
    return "/read" + passageQuery(here) + "#listen";
  }

  function scrollTop() {
    var reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function buildTabs(nav, here) {
    if (document.querySelector(".qd-tabbar")) return;
    var readHere = /^\/(read|navigate|surah\/\d+|juz\/\d+)$/.test(here);
    var bar = document.createElement("nav");
    bar.className = "qd-tabbar";
    bar.setAttribute("aria-label", "Main");
    bar.innerHTML =
      '<a class="qd-tab" data-tab="read" href="/read' + passageQuery(here) + '"' +
      (readHere ? ' aria-current="page"' : "") +
      ">" + icon("read") + "<span>Read</span></a>" +
      '<a class="qd-tab" data-tab="listen" href="' + listenHref(here) + '">' +
      icon("listen") + "<span>Listen</span></a>" +
      '<a class="qd-tab" data-tab="search" href="/search"' +
      (here === "/search" ? ' aria-current="page"' : "") +
      ">" + icon("search") + "<span>Search</span></a>" +
      '<button type="button" class="qd-tab" data-tab="menu" aria-expanded="false" aria-controls="qdMenuSheet">' +
      icon("menu") + "<span>Menu</span></button>";
    document.body.appendChild(bar);

    bar.addEventListener("click", function (e) {
      var tab = e.target.closest && e.target.closest(".qd-tab");
      if (!tab) return;
      var which = tab.getAttribute("data-tab");
      if (which === "menu") {
        toggleMenu(nav, tab);
        return;
      }
      closeMenu();
      if (which === "listen") {
        // With a player on the page, Listen opens its options sheet
        // (reciter, voice, repeat, speed, sleep) instead of reloading.
        var more = document.querySelector("#listenPanel:not([hidden]) [data-listen-more]");
        if (more) {
          e.preventDefault();
          e.stopPropagation();
          more.click();
        }
        return;
      }
      // The current tab, tapped again, returns to the top: the phone
      // convention, and what the corner back-to-top button did.
      var href = tab.getAttribute("href") || "";
      if (href.split(/[?#]/)[0] === here) {
        e.preventDefault();
        scrollTop();
      }
    });
  }

  var sheet = null;
  var backdrop = null;
  var opener = null;

  // Page tools that float in the corners on wide screens. Each entry
  // proxies a click to the real control, so every behavior (and every
  // test of it) stays in the script that owns it.
  var TOOLS = [
    { sel: "#gearBtn", label: "Display" },
    { sel: ".share-fab", label: "Share" },
    { sel: "#notebookToggle", label: "Pinned" },
    { sel: ".tour-fab", label: "Tour" },
    { sel: "#saveOfflineBtn", label: "Save offline" },
  ];

  function renderTools() {
    var row = sheet.querySelector(".qd-menu-tools");
    row.innerHTML = "";
    TOOLS.forEach(function (t) {
      var target = document.querySelector(t.sel);
      if (!target) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "button secondary qd-menu-tool";
      var label = t.label;
      if (t.sel === "#notebookToggle") {
        var n = parseInt((document.getElementById("notebookCount") || {}).textContent, 10);
        if (n > 0) label += " (" + n + ")";
      }
      b.textContent = label;
      b.addEventListener("click", function (e) {
        // Synchronous, so Share keeps the tap's user activation for the
        // native share sheet; stopped, so the pinned tray's
        // outside-click handler does not close what this just opened.
        e.stopPropagation();
        closeMenu(true);
        target.click();
      });
      row.appendChild(b);
    });
    row.hidden = !row.children.length;
  }

  function buildMenu(nav) {
    backdrop = document.createElement("div");
    backdrop.className = "qd-sheet-backdrop";
    backdrop.hidden = true;
    backdrop.addEventListener("click", function () {
      closeMenu();
    });
    sheet = document.createElement("div");
    sheet.className = "qd-menu-sheet";
    sheet.id = "qdMenuSheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Menu");
    sheet.hidden = true;
    var html =
      '<div class="qd-menu-head"><a class="qd-menu-home" href="/">Home</a>' +
      '<button type="button" class="button secondary qd-menu-close" aria-label="Close menu">✕</button></div>' +
      '<div class="qd-menu-tools" role="group" aria-label="This page"></div>' +
      '<nav class="qd-menu-groups" aria-label="All sections">';
    nav.querySelectorAll(".nav-group").forEach(function (g) {
      var name = g.querySelector(".nav-group-btn");
      html += '<section class="qd-menu-group"><h2>' + (name ? name.textContent.trim() : "") + "</h2><ul>";
      g.querySelectorAll(".nav-menu a").forEach(function (a) {
        html +=
          '<li><a href="' + a.getAttribute("href") + '"' +
          (a.getAttribute("aria-current") ? ' aria-current="page"' : "") +
          ">" + a.textContent.trim() + "</a></li>";
      });
      html += "</ul></section>";
    });
    sheet.innerHTML = html + "</nav>";
    sheet.querySelector(".qd-menu-close").addEventListener("click", function () {
      closeMenu();
    });
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    document.addEventListener("keydown", function (e) {
      if (!sheet || sheet.hidden) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
        return;
      }
      // Modal: Tab cycles through the sheet and the Menu tab that
      // closes it, never out to the page behind the backdrop.
      if (e.key !== "Tab") return;
      var list = Array.prototype.slice.call(sheet.querySelectorAll("a[href], button"));
      if (opener) list.push(opener);
      var i = list.indexOf(document.activeElement);
      var next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i === -1 || i === list.length - 1 ? 0 : i + 1);
      e.preventDefault();
      list[next].focus();
    }, true);
  }

  function toggleMenu(nav, tab) {
    if (sheet && !sheet.hidden) {
      closeMenu();
      return;
    }
    if (!sheet) buildMenu(nav);
    renderTools();
    opener = tab;
    sheet.hidden = false;
    backdrop.hidden = false;
    tab.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("qd-menu-open");
    var first = sheet.querySelector(".qd-menu-close");
    if (first) first.focus({ preventScroll: true });
  }

  function closeMenu(keepFocus) {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    backdrop.hidden = true;
    document.documentElement.classList.remove("qd-menu-open");
    if (opener) {
      opener.setAttribute("aria-expanded", "false");
      if (!keepFocus) opener.focus({ preventScroll: true });
    }
  }

  ready(function () {
    var nav = document.querySelector("nav.primary");
    if (!nav) {
      document.documentElement.classList.remove("qd-tabs");
      return;
    }
    buildTabs(nav, currentPage());
  });
})();
