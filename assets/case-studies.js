(function () {
  "use strict";

  // Renders the "how we verify" worked examples from
  // data/case-studies.json — the single source of truth shared by
  // index.html (home subset, short traces) and validation.html (all
  // entries, full traces). The JSON is site-authored, trusted content;
  // never route API or user text through it.
  //
  // Usage: a container with data-case-studies="home" or "full".
  // The container's existing children are the loading/fallback state.

  var BADGE_TITLES = {
    ok: "Verified · confirmed from a primary source",
    pending: "Pending · awaiting a second independent source",
    nuanced: "Nuanced · counting method varies by source",
  };
  var BADGE_GLYPHS = { ok: "●", pending: "○", nuanced: "~" };

  function badgeHTML(cs) {
    var src = cs.sourceIds
      ? ' data-source-ids="' + cs.sourceIds + '"'
      : "";
    return (
      '<span class="badge ' +
      cs.label +
      '"' +
      src +
      ' aria-label="' +
      cs.labelText +
      '" tabindex="0" title="' +
      BADGE_TITLES[cs.label] +
      '">' +
      BADGE_GLYPHS[cs.label] +
      "</span>"
    );
  }

  function exampleHTML(cs, mode) {
    var heading =
      mode === "home"
        ? cs.labelText
        : cs.labelText + " · " + cs.title;
    var claim = mode === "home" && cs.claimHome ? cs.claimHome : cs.claim;
    var trace = mode === "home" ? cs.traceShort : cs.traceFull;
    return (
      '<div class="verify-example">' +
      "<h3>" +
      badgeHTML(cs) +
      " " +
      heading +
      "</h3>" +
      '<p class="claim">' +
      claim +
      "</p>" +
      '<p class="trace">' +
      trace +
      "</p></div>"
    );
  }

  function render() {
    var containers = document.querySelectorAll("[data-case-studies]");
    if (!containers.length) return;
    fetch("data/case-studies.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        containers.forEach(function (el) {
          var mode = el.getAttribute("data-case-studies");
          var list = data.caseStudies.filter(function (cs) {
            return mode === "home" ? cs.onHome : true;
          });
          el.innerHTML = list
            .map(function (cs) {
              return exampleHTML(cs, mode);
            })
            .join("");
          if (window.qdCiteEnhance) window.qdCiteEnhance(el);
        });
      })
      .catch(function () {
        /* keep whatever static fallback the page shipped */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
