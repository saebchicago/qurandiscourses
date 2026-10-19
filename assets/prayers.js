/* Prayers page (prayers.html). Reads data/prayers/prayers.json
 * (scripts/build-prayers.mjs) and fills the tables. Every number shown is a
 * field of that file; nothing is recomputed here. Text is set with
 * textContent.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var PERIODS = {
    "meccan-early": "Early Meccan",
    "meccan-middle": "Middle Meccan",
    "meccan-late": "Late Meccan",
    "medinan": "Medinan",
  };

  function cell(tr, text, ar) {
    var td = document.createElement("td");
    td.textContent = text;
    if (ar) { td.setAttribute("lang", "ar"); td.setAttribute("dir", "rtl"); }
    tr.appendChild(td);
    return td;
  }
  function surahName(n) {
    var s = window.SURAHS && window.SURAHS[n - 1];
    return n + (s ? " " + s.translit : "");
  }

  function drawVerses(v) {
    var body = $("pBody");
    v.entries.forEach(function (e) {
      var tr = document.createElement("tr");
      cell(tr, surahName(e.s) + ":" + e.a);
      cell(tr, e.form, true);
      cell(tr, e.nextAr || "", true);
      cell(tr, PERIODS[e.period] || e.period);
      var td = document.createElement("td");
      var a = document.createElement("a");
      a.href = "/read?s=" + e.s + "&a=" + e.a;
      a.textContent = "Read in context";
      td.appendChild(a);
      tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  function drawNext(v) {
    var example = Object.create(null);
    v.entries.forEach(function (e) { if (e.nextLemma && !example[e.nextLemma]) example[e.nextLemma] = e.nextAr; });
    var body = $("pNext");
    v.nextWord.slice(0, 12).forEach(function (x) {
      var tr = document.createElement("tr");
      cell(tr, x.lemma);
      cell(tr, example[x.lemma] || "", true);
      cell(tr, String(x.n));
      body.appendChild(tr);
    });
  }

  function drawRemembrance(r) {
    var body = $("pRemembrance");
    ["sbH", "Hmd", "*kr", "gfr"].forEach(function (root) {
      var x = r[root];
      if (!x) return;
      var tr = document.createElement("tr");
      cell(tr, root);
      cell(tr, x.tokens.toLocaleString());
      cell(tr, x.verses.toLocaleString());
      cell(tr, x.lemmas.map(function (l) { return l.lemma + " " + l.n; }).join(" · "));
      body.appendChild(tr);
    });
  }

  function init() {
    if (!$("pBody")) return;
    fetch("data/prayers/prayers.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        var v = d.vocative;
        $("pTokens").textContent = v.tokens.toLocaleString();
        $("pVerses").textContent = v.verses.toLocaleString();
        $("pSurahs").textContent = v.surahs.toLocaleString();
        $("pNom").textContent = v.nominativeForms.toLocaleString();
        $("pGen").textContent = v.genitiveForms.toLocaleString();
        $("pPeriods").textContent =
          "By the period the site assigns to the surah, with the number of verses in each period (periods are contested, and they differ a lot in size; see Sources): " +
          Object.keys(PERIODS)
            .map(function (p) {
              return PERIODS[p] + " " + (v.versesByPeriod[p] || 0) + " of " + (d.totals.versesPerPeriod[p] || 0).toLocaleString() + " verses";
            })
            .join(", ") + ".";
        drawVerses(v);
        drawNext(v);
        drawRemembrance(d.remembrance);
      })
      .catch(function (e) {
        var s = $("pPeriods");
        if (s) s.textContent = "Could not load the table (" + e.message + ").";
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
