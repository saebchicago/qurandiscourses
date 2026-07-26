(function () {
  "use strict";

  // Renders the "how we verify" worked examples from data/case-studies.json
  // and joins each example to its canonical provenance record in
  // data/claims.json. The two files separate presentation copy from the
  // integrity fields that scripts/check-claims.mjs enforces.
  // index.html (home subset, short traces) and validation.html (all
  // entries, full traces). The JSON is site-authored, trusted content;
  // never route API or user text through it.
  //
  // Usage: a container with data-case-studies="home" or "full".
  // The container's existing children are the loading/fallback state.

  var BADGE_TITLES = {
    ok: "Evidence record available",
    pending: "Evidence record pending further review",
    nuanced: "Evidence record has a method or classification dependency",
  };
  var BADGE_GLYPHS = { ok: "●", pending: "○", nuanced: "~" };

  var FIELD_LABELS = {
    "source-checked": "Source checked",
    "locator-checked": "Locator checked",
    unchecked: "Source unchecked",
    reproduced: "Recomputed",
    "independently-reproduced": "Independently recomputed",
    "not-reproduced": "Not recomputed",
    "not-applicable": "No computation",
    corroborated: "Corroborated",
    "source-dependent": "Corpus-dependent",
    "method-dependent": "Method-dependent",
    "classification-dependent": "Classification-dependent",
    contested: "Contested",
    none: "No generated content",
    "research-discovery": "AI-assisted discovery disclosed",
    "language-editing": "AI-assisted language edit disclosed",
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

  function statusHTML(claim, mode) {
    if (!claim) return "";
    var statuses = [claim.sourceCheck, claim.reproduction, claim.agreement];
    if (mode === "full") statuses.push(claim.aiInvolvement);
    var chips = statuses
      .map(function (value) {
        return '<span class="evidence-chip evidence-' + esc(value) + '">' + esc(FIELD_LABELS[value] || value) + "</span>";
      })
      .join("");
    var details = "";
    if (mode === "full") {
      var method = claim.derivation
        ? '<p><strong>Reproduction method.</strong> ' + esc(claim.derivation.method) +
          ' <code>' + esc(claim.derivation.script) + "</code> → <code>" + esc(claim.derivation.output) + "</code>.</p>"
        : "";
      var limits = (claim.limitations || []).map(function (item) {
        return "<li>" + esc(item) + "</li>";
      }).join("");
      details = '<details class="claim-record"><summary>Open the claim record</summary>' +
        '<div class="claim-record-body"><p class="claim-id"><strong>Stable ID</strong> <code>' + esc(claim.id) + "</code></p>" +
        method + '<p><strong>Known limits.</strong></p><ul>' + limits + "</ul></div></details>";
    }
    return '<div class="evidence-status" aria-label="Evidence status">' + chips + "</div>" + details;
  }

  function exampleHTML(cs, claim, mode) {
    var heading =
      mode === "home"
        ? cs.labelText
        : cs.labelText + " · " + cs.title;
    var claimText = mode === "home" && cs.claimHome ? cs.claimHome : cs.claim;
    var trace = mode === "home" ? cs.traceShort : cs.traceFull;
    return (
      '<article class="verify-example" data-claim-id="' + esc(cs.claimId) + '">' +
      "<h3>" +
      badgeHTML(cs) +
      " " +
      heading +
      "</h3>" +
      '<p class="claim">' +
      claimText +
      "</p>" +
      '<p class="trace">' +
      trace +
      "</p>" + statusHTML(claim, mode) + "</article>"
    );
  }

  function render() {
    var containers = document.querySelectorAll("[data-case-studies]");
    if (!containers.length) return;
    Promise.all([fetch("data/case-studies.json"), fetch("data/claims.json")])
      .then(function (responses) {
        responses.forEach(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); });
        return Promise.all(responses.map(function (r) { return r.json(); }));
      })
      .then(function (records) {
        var data = records[0];
        var claims = new Map(records[1].claims.map(function (claim) { return [claim.id, claim]; }));
        containers.forEach(function (el) {
          var mode = el.getAttribute("data-case-studies");
          var list = data.caseStudies.filter(function (cs) {
            return mode === "home" ? cs.onHome : true;
          });
          el.innerHTML = list
            .map(function (cs) {
              return exampleHTML(cs, claims.get(cs.claimId), mode);
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
