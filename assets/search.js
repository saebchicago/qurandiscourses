/* Client for /search: matches the query against the committed
   data/search-index.json entirely in the browser. Nothing leaves the
   page; there is no server to send it to.

   Folding here MUST mirror scripts/build-search-index.mjs (the index
   stores folded tokens) — lowercase, transliteration diacritics to
   ASCII, the same stopword list. Scoring is deliberately simple and
   inspectable: exact token in a document's heading tokens counts 5, in
   its body tokens 3, a prefix match 1; every query token must match
   somewhere (AND), falling back to any-token (OR) when AND finds
   nothing, so a long query degrades instead of dead-ending. */
(function () {
  "use strict";

  var STOP =
    "a an and are as at be by for from has have in is it its of on or that the this to was were will with you your not no".split(" ");
  var STOPSET = {};
  STOP.forEach(function (w) {
    STOPSET[w] = true;
  });

  function fold(s) {
    return s
      .toLowerCase()
      .replace(/[’'‘`]/g, "")
      .replace(/[āáà]/g, "a")
      .replace(/[īíì]/g, "i")
      .replace(/[ūúù]/g, "u")
      .replace(/[ḥ]/g, "h")
      .replace(/[ṣ]/g, "s")
      .replace(/[ḍ]/g, "d")
      .replace(/[ṭ]/g, "t")
      .replace(/[ẓ]/g, "z")
      .replace(/[ʿʾ]/g, "");
  }
  function tokenize(s) {
    return fold(s)
      .split(/[^a-z0-9؀-ۿ]+/)
      .filter(function (t) {
        return t.length > 1 && !STOPSET[t];
      });
  }

  var esc = window.qdEsc || function (v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  var KINDS = [
    ["page", "Pages"],
    ["glossary", "Glossary"],
    ["theme", "Themes"],
    ["source", "Sources"],
  ];

  function scoreDoc(doc, terms) {
    var h = " " + doc.h + " ";
    var x = " " + doc.x + " ";
    var total = 0;
    var matched = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var s = 0;
      if (h.indexOf(" " + t + " ") !== -1) s += 5;
      if (x.indexOf(" " + t + " ") !== -1) s += 3;
      if (!s && (h.indexOf(" " + t) !== -1 || x.indexOf(" " + t) !== -1)) s += 1;
      if (s) matched++;
      total += s;
    }
    return { total: total, matched: matched };
  }

  function search(index, query) {
    var terms = tokenize(query);
    if (!terms.length) return { terms: terms, hits: [] };
    var scored = [];
    for (var i = 0; i < index.docs.length; i++) {
      var r = scoreDoc(index.docs[i], terms);
      if (r.matched) scored.push({ doc: index.docs[i], score: r.total, matched: r.matched });
    }
    var all = terms.length;
    var strict = scored.filter(function (s) {
      return s.matched === all;
    });
    var hits = (strict.length ? strict : scored).sort(function (a, b) {
      return b.score - a.score || (a.doc.t < b.doc.t ? -1 : 1);
    });
    return { terms: terms, hits: hits, relaxed: !strict.length && scored.length > 0 };
  }

  function render(result, query, status, out) {
    if (!result.hits.length) {
      status.textContent = query
        ? 'No matches for "' + query + '".'
        : "";
      out.innerHTML = query
        ? '<p>Nothing in the index matches. For a verse reference, surah name, or Arabic root, try the <a href="/">Ask box</a>; or browse the <a href="/glossary">Glossary</a> and <a href="/themes">Themes</a>.</p>'
        : "";
      return;
    }
    var note = result.relaxed ? " (closest matches; not every word matched)" : "";
    status.textContent = result.hits.length + " result" + (result.hits.length === 1 ? "" : "s") + note;
    var html = "";
    for (var g = 0; g < KINDS.length; g++) {
      var kind = KINDS[g][0];
      var group = result.hits.filter(function (h) {
        return h.doc.k === kind;
      }).slice(0, 12);
      if (!group.length) continue;
      html += '<h3 class="search-group">' + KINDS[g][1] + "</h3><ul class=\"search-hits\">";
      for (var i = 0; i < group.length; i++) {
        var d = group[i].doc;
        html +=
          '<li><a href="' + esc(d.u) + '">' + esc(d.t) + "</a>" +
          '<span class="search-snippet">' + esc(d.s) + "</span></li>";
      }
      html += "</ul>";
    }
    out.innerHTML = html;
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var input = document.getElementById("search-input");
    var form = document.getElementById("searchForm");
    var status = document.getElementById("searchStatus");
    var out = document.getElementById("searchResults");
    if (!input || !form || !status || !out) return;

    var index = null;
    var pending = null;

    function run(query) {
      if (!index) {
        pending = query;
        return;
      }
      render(search(index, query), query, status, out);
    }

    var q = new URLSearchParams(location.search).get("q") || "";
    if (q) input.value = q;
    status.textContent = "Loading the index...";

    fetch("data/search-index.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        index = data;
        status.textContent = "";
        run(pending !== null ? pending : input.value.trim());
      })
      .catch(function () {
        status.textContent =
          "The search index could not be loaded. Reload to retry, or browse the Glossary and Themes instead.";
      });

    if (q) pending = q;

    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var query = input.value.trim();
        var url = query ? "/search?q=" + encodeURIComponent(query) : "/search";
        history.replaceState(null, "", url);
        run(query);
      }, 150);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearTimeout(timer);
      run(input.value.trim());
    });
  });
})();
