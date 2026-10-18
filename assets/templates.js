/* One-slot templates on the Formulas page (data/formulaic-templates.json,
 * scripts/build-formulaic-templates.mjs). Loaded when the panel is opened.
 * Sort and filter only reorder the published list; every figure is the one
 * in the file. Text is inserted with textContent.
 */
(function () {
  "use strict";
  var PAGE = 25;
  var data = null;
  var shown = 0;
  var rows = [];

  function el(id) { return document.getElementById(id); }
  function fmt(x) { return typeof x === "number" ? x.toLocaleString() : String(x); }

  function td(tr, text, ar) {
    var c = document.createElement("td");
    c.textContent = text;
    if (ar) { c.setAttribute("lang", "ar"); c.setAttribute("dir", "rtl"); }
    tr.appendChild(c);
    return c;
  }

  function sortRows(list, how) {
    var cmp = {
      support: function (a, b) { return b.support - a.support || a.q - b.q; },
      ratio: function (a, b) { return b.support / Math.max(b.expected, 1e-9) - a.support / Math.max(a.expected, 1e-9) || b.support - a.support; },
      q: function (a, b) { return a.q - b.q || b.support - a.support; },
      fillers: function (a, b) { return b.fillers - a.fillers || b.support - a.support; },
    }[how] || null;
    return cmp ? list.slice().sort(cmp) : list.slice();
  }

  function occurrences(sys) {
    var tr = document.createElement("tr");
    var c = document.createElement("td");
    c.colSpan = 6;
    var p = document.createElement("p");
    p.className = "small";
    p.textContent = "Where it occurs (first word of each window): ";
    sys.refs.forEach(function (r, i) {
      if (i) p.appendChild(document.createTextNode(" · "));
      var a = document.createElement("a");
      a.href = "/read?s=" + r[0] + "&a=" + r[1];
      a.textContent = r[0] + ":" + r[1] + "." + r[2];
      p.appendChild(a);
    });
    c.appendChild(p);
    tr.appendChild(c);
    return tr;
  }

  function drawMore() {
    var body = el("tplBody");
    var upto = Math.min(shown + PAGE, rows.length);
    rows.slice(shown, upto).forEach(function (s) {
      var tr = document.createElement("tr");
      var tc = td(tr, s.template, true);
      tc.style.fontWeight = "bold";
      td(tr, fmt(s.support));
      td(tr, s.expected.toLocaleString(undefined, { maximumFractionDigits: 1 }));
      td(tr, fmt(s.fillers));
      var fc = td(tr, s.topFillers.map(function (f) { return f[0] + " " + f[1]; }).join("  ·  "), true);
      fc.style.fontSize = "0.85rem";
      var last = document.createElement("td");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "button secondary";
      b.textContent = "Occurrences";
      b.setAttribute("aria-expanded", "false");
      var detail = null;
      b.addEventListener("click", function () {
        if (detail) { detail.remove(); detail = null; b.setAttribute("aria-expanded", "false"); return; }
        detail = occurrences(s);
        tr.after(detail);
        b.setAttribute("aria-expanded", "true");
      });
      last.appendChild(b);
      tr.appendChild(last);
      body.appendChild(tr);
    });
    shown = upto;
    el("tplMore").hidden = shown >= rows.length;
    el("tplCount").textContent = "Showing " + shown.toLocaleString() + " of " + rows.length.toLocaleString() + ".";
  }

  function refresh() {
    var how = el("tplSort").value;
    var q = el("tplFilter").value.trim();
    var list = data.systems;
    if (q) list = list.filter(function (s) { return s.template.indexOf(q) >= 0; });
    rows = sortRows(list, how);
    shown = 0;
    el("tplBody").textContent = "";
    drawMore();
  }

  function summary() {
    var o = data.observed;
    var n = data.null;
    el("tplSummary").textContent =
      o.systems.toLocaleString() + " of " + o.candidates.toLocaleString() + " candidate templates recur more than word order predicts (BH q ≤ 0.05), " +
      "covering " + (o.coveredShare * 100).toFixed(1) + "% of the corpus's " + o.tokens.toLocaleString() + " words. " +
      "The same procedure on " + n.shuffles + " verse-shuffled copies of the text finds " + n.systems.mean + " on average (at most " + n.systems.max + "), " +
      "covering " + n.coveredTokens.mean + " words on average.";
  }

  function load() {
    if (data) return;
    el("tplStatus").textContent = "Loading…";
    fetch("data/formulaic-templates.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        data = d;
        el("tplStatus").textContent = "";
        summary();
        refresh();
      })
      .catch(function (e) {
        el("tplStatus").textContent = "Could not load the templates (" + e.message + ").";
      });
  }

  function init() {
    var det = el("tplDetails");
    if (!det) return;
    det.addEventListener("toggle", function () { if (det.open) load(); });
    el("tplSort").addEventListener("change", function () { if (data) refresh(); });
    el("tplFilter").addEventListener("input", function () { if (data) refresh(); });
    el("tplMore").addEventListener("click", drawMore);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
