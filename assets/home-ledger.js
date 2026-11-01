/* Home page "The claim ledger, counted" (index.html). Reads data/claims.json,
 * the ledger that every worked example on the site points at, and counts how
 * its claims are labeled on four dimensions. Nothing is typed in here except
 * the plain-English names of the labels; every count and every sentence about
 * zero comes from the file, so the panel cannot drift from the ledger.
 * Text is set with textContent.
 */
(function (root) {
  "use strict";

  // Each group lists every value the ledger's checker (scripts/check-claims.mjs)
  // allows, in the order they should read, so an empty row is shown as 0
  // rather than hidden. A value the ledger starts using that is not listed
  // here fails scripts/home-ledger.test.mjs.
  var GROUPS = [
    { key: "reproduction", title: "Reproduced from the data", values: [
      ["independently-reproduced", "Independently reproduced"],
      ["reproduced", "Reproduced by this project"],
      ["not-reproduced", "Not reproduced"],
      ["not-applicable", "Not applicable"],
    ] },
    { key: "sourceCheck", title: "Checked against its source", values: [
      ["source-checked", "Source checked"],
      ["locator-checked", "Location checked only"],
      ["unchecked", "Unchecked"],
    ] },
    { key: "agreement", title: "Agreement across methods", values: [
      ["corroborated", "Corroborated"],
      ["source-dependent", "Depends on the source"],
      ["method-dependent", "Depends on the method"],
      ["classification-dependent", "Depends on the classification"],
      ["contested", "Contested"],
    ] },
    { key: "aiInvolvement", title: "Where AI was involved", values: [
      ["none", "None"],
      ["language-editing", "Language editing"],
      ["research-discovery", "Research discovery"],
    ] },
  ];

  function tally(claims) {
    return GROUPS.map(function (g) {
      var counts = {};
      g.values.forEach(function (v) { counts[v[0]] = 0; });
      var unknown = [];
      claims.forEach(function (c) {
        var v = c[g.key];
        if (Object.prototype.hasOwnProperty.call(counts, v)) counts[v] += 1;
        else unknown.push(String(v));
      });
      return { key: g.key, title: g.title, values: g.values, counts: counts, unknown: unknown };
    });
  }

  var api = { GROUPS: GROUPS, tally: tally };
  root.qdLedger = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  var host = typeof document !== "undefined" ? document.getElementById("ledgerBody") : null;
  if (!host) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  fetch("data/claims.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (d) {
      var claims = d.claims || [];
      var total = claims.length;
      var groups = tally(claims);
      groups.forEach(function (g) {
        var box = el("div", "ledger-group");
        box.appendChild(el("h3", null, g.title));
        g.values.forEach(function (v) {
          var n = g.counts[v[0]];
          var row = el("div", "barwrap");
          row.appendChild(el("span", "lbl", v[1]));
          var bar = el("span", "bar");
          var fill = el("span");
          fill.style.width = (total ? (n / total) * 100 : 0) + "%";
          bar.appendChild(fill);
          row.appendChild(bar);
          row.appendChild(el("span", "count", n + " of " + total));
          box.appendChild(row);
        });
        host.appendChild(box);
      });
      var ind = groups[0].counts["independently-reproduced"];
      var note = document.getElementById("ledgerNote");
      if (note) {
        note.textContent = ind === 0
          ? "None of the " + total + " claims has been independently reproduced yet. That is the check this project most wants from outside readers."
          : ind + " of the " + total + " claims have been independently reproduced.";
      }
    })
    .catch(function (e) {
      host.textContent = "Could not load the ledger (" + e.message + ").";
    });
})(typeof window !== "undefined" ? window : globalThis);
