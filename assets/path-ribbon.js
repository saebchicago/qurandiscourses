// path-ribbon.js — the "Step N of M" ribbon for study paths.
//
// When a page is opened with ?path=<id>&step=<n> (1-based, appended by
// paths.html's step links), this renders a slim banner at the top of
// <main>: which path, which step, what it's called, with Previous /
// Next / All-paths links that carry the params onward. Next also marks
// the current step done through the existing window.qdMarkPathStep, so
// the checkboxes on /paths stay the single progress record inside the
// one qd_state key — this file adds no storage of its own.
//
// The tables come from assets/path-data.js (window.QD_PATHS), generated
// by scripts/build-path-data.mjs — synchronous, no fetch race, same
// pattern as version.js and ask-routes.js. Unknown path ids or
// out-of-range steps render nothing: the ribbon is an extra, never an
// error surface.
//
// location.search is captured at evaluation time: roots.html and
// exercise.html rewrite their query string after async loads (they
// preserve path/step now, but the capture makes the ribbon independent
// of that timing).

(function () {
  var SEARCH = window.location.search;
  var PATHS = window.QD_PATHS || {};

  var esc =
    window.qdEsc ||
    function (v) {
      return String(v).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    };

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(SEARCH);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Build the href for a step: its own page (or the current page when
  // the step happens in place), carrying path and step params.
  function stepHref(pathId, stepNum, step) {
    var page = step.page || window.location.pathname.replace(/\.html$/, "").replace(/^\/index$/, "/");
    return page + "?path=" + encodeURIComponent(pathId) + "&step=" + stepNum;
  }

  function init() {
    var pathId = param("path");
    var stepRaw = param("step");
    if (!pathId || !stepRaw || !/^\d{1,2}$/.test(stepRaw)) return;
    var p = PATHS[pathId];
    var n = parseInt(stepRaw, 10);
    if (!p || n < 1 || n > p.steps.length) return;
    var main = document.querySelector("main");
    if (!main) return;

    var step = p.steps[n - 1];
    var total = p.steps.length;

    var ribbon = document.createElement("div");
    ribbon.className = "banner soft path-ribbon";
    ribbon.setAttribute("role", "status");
    ribbon.setAttribute("aria-live", "polite");

    var prevHtml =
      n > 1
        ? '<a href="' + esc(stepHref(pathId, n - 1, p.steps[n - 2])) + '">&larr; Previous</a>'
        : "";
    var nextHtml =
      n < total
        ? '<a id="pathRibbonNext" href="' + esc(stepHref(pathId, n + 1, p.steps[n])) + '">Next step &rarr;</a>'
        : '<a id="pathRibbonNext" href="/paths#' + esc(pathId) + '">Finish &rarr;</a>';

    ribbon.innerHTML =
      '<span class="path-ribbon-what"><strong>' +
      esc(p.title) +
      "</strong> · step " + n + " of " + total + ": " +
      esc(step.label) +
      "</span>" +
      '<span class="path-ribbon-nav">' +
      prevHtml +
      nextHtml +
      '<a href="/paths#' + esc(pathId) + '">All paths</a>' +
      '<button type="button" class="path-ribbon-close" aria-label="Hide the path ribbon">&times;</button>' +
      "</span>";

    ribbon.querySelector(".path-ribbon-close").addEventListener("click", function () {
      ribbon.remove();
    });
    // Moving forward (or finishing) records the step you are leaving as
    // done — the same write the /paths checkboxes make.
    ribbon.querySelector("#pathRibbonNext").addEventListener("click", function () {
      if (window.qdMarkPathStep) window.qdMarkPathStep(pathId, String(n - 1), true);
    });

    main.insertBefore(ribbon, main.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
