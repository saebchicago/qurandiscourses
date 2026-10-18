/* Concordance (key word in context) for the Roots explorer. Needs assets/kwic.js.
 *
 * For the selected root, lists each occurrence with up to WINDOW words
 * before and after it in the same verse, sortable by reference, by lemma,
 * by the word before or by the word after, and downloadable as CSV.
 *
 * DATA. Nothing is precomputed for this view. The verse list comes from
 * data/root-analytics/{safeKey}.json (the same file the occurrence list
 * uses); the words come from data/morphology/{surah}.json, the Leeds v0.4
 * word segmentation the rest of the page counts from, so every line here
 * is one of the root's counted tokens. Surah files are fetched only when
 * a page of verses needs them and kept for the session, so a rare root
 * costs a few small requests and a frequent one loads page by page.
 *
 * Context stops at the verse boundary on purpose: a window that ran into
 * the next verse would present text as adjacent that the verse division
 * separates. Words are shown exactly as segmented in the morphology file.
 *
 * Usage (roots.html): qdConcordance.show(bw, safeKey) on each root view.
 * The panel is a <details>; nothing is fetched until it is opened.
 */
(function () {
  "use strict";

  var WINDOW = 5;
  var PAGE_VERSES = 40;
  var surahCache = new Map();
  var state = null;

  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function loadSurah(n) {
    if (!surahCache.has(n)) {
      surahCache.set(
        n,
        fetch("data/morphology/" + n + ".json").then(function (r) {
          if (!r.ok) throw new Error("morphology " + n + ": HTTP " + r.status);
          return r.json();
        }),
      );
    }
    return surahCache.get(n);
  }

  // Build the lines for one verse: one per token of the root.
  function linesForVerse(words, bw, s, v) {
    var out = [];
    for (var i = 0; i < words.length; i++) {
      if (words[i].root !== bw) continue;
      var c = window.qdKwic.context(words, i, WINDOW);
      out.push({
        s: s,
        v: v,
        w: words[i].w,
        before: c.before,
        key: c.key,
        after: c.after,
        lemma: words[i].lemma,
        pos: words[i].pos,
      });
    }
    return out;
  }

  // Arabic comparison for sorting by the adjacent word; ties fall back to
  // reference order so the sort is stable and repeatable.
  var collator = typeof Intl !== "undefined" ? new Intl.Collator("ar") : null;
  function cmpText(a, b) {
    return collator ? collator.compare(a || "", b || "") : (a || "") < (b || "") ? -1 : (a || "") > (b || "") ? 1 : 0;
  }
  function cmpRef(a, b) {
    return a.s - b.s || a.v - b.v || a.w - b.w;
  }
  var SORTS = {
    ref: cmpRef,
    lemma: function (a, b) { return cmpText(a.lemma, b.lemma) || cmpRef(a, b); },
    before: function (a, b) { return cmpText(a.before[a.before.length - 1], b.before[b.before.length - 1]) || cmpRef(a, b); },
    after: function (a, b) { return cmpText(a.after[0], b.after[0]) || cmpRef(a, b); },
  };

  function render() {
    var body = el("concBody");
    var status = el("concStatus");
    var more = el("concMore");
    if (!body || !state) return;
    var sortKey = (el("concSort") && el("concSort").value) || "ref";
    var rows = state.lines.slice().sort(SORTS[sortKey] || cmpRef);
    body.innerHTML = rows
      .map(function (l) {
        var ref = l.s + ":" + l.v;
        return (
          "<tr>" +
          '<td><a href="/read?s=' + l.s + "&amp;a=" + l.v + '">' + ref + "</a></td>" +
          '<td class="conc-ctx" lang="ar" dir="rtl">' + esc(l.before.join(" ")) + "</td>" +
          '<td class="conc-key" lang="ar" dir="rtl"><strong>' + esc(l.key) + "</strong></td>" +
          '<td class="conc-ctx" lang="ar" dir="rtl">' + esc(l.after.join(" ")) + "</td>" +
          "<td>" + esc(l.lemma) + "</td>" +
          "<td>" + esc(l.pos) + "</td>" +
          "</tr>"
        );
      })
      .join("");
    var done = state.next >= state.verses.length;
    status.textContent =
      state.lines.length.toLocaleString() + " occurrence" + (state.lines.length === 1 ? "" : "s") +
      " in " + Math.min(state.next, state.verses.length).toLocaleString() + " of " +
      state.verses.length.toLocaleString() + " verses" + (done ? "." : " loaded so far.");
    more.hidden = done;
  }

  function loadNextPage() {
    if (!state || state.loading) return Promise.resolve();
    var token = state;
    var slice = state.verses.slice(state.next, state.next + PAGE_VERSES);
    if (!slice.length) return Promise.resolve();
    state.loading = true;
    var refs = slice.map(function (r) {
      var p = r.split(":");
      return { s: +p[0], v: p[1] };
    });
    var surahs = Array.from(new Set(refs.map(function (r) { return r.s; })));
    return Promise.all(surahs.map(loadSurah))
      .then(function (files) {
        if (state !== token) return; // the reader moved to another root
        var bySurah = new Map();
        surahs.forEach(function (n, i) { bySurah.set(n, files[i]); });
        refs.forEach(function (r) {
          var words = (bySurah.get(r.s) || {})[r.v] || [];
          Array.prototype.push.apply(state.lines, linesForVerse(words, state.bw, r.s, +r.v));
        });
        state.next += slice.length;
        state.loading = false;
        render();
      })
      .catch(function (e) {
        if (state !== token) return;
        state.loading = false;
        el("concStatus").textContent = "Could not load the concordance (" + e.message + ").";
      });
  }

  function start() {
    if (!state || state.started) return;
    state.started = true;
    var token = state;
    el("concStatus").textContent = "Loading…";
    fetch("data/root-analytics/" + state.safeKey + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        if (state !== token) return;
        state.verses = d.verses || [];
        return loadNextPage();
      })
      .catch(function (e) {
        if (state !== token) return;
        el("concStatus").textContent = "Could not load the concordance (" + e.message + ").";
      });
  }

  function toCsv() {
    var head = ["surah", "verse", "word", "before", "keyword", "after", "lemma", "pos"];
    var q = function (x) {
      var s = String(x);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var rows = state.lines.slice().sort(cmpRef).map(function (l) {
      return [l.s, l.v, l.w, l.before.join(" "), l.key, l.after.join(" "), l.lemma, l.pos].map(q).join(",");
    });
    return head.join(",") + "\n" + rows.join("\n") + "\n";
  }

  function download() {
    if (!state || !state.lines.length) return;
    var blob = new Blob(["﻿" + toCsv()], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "concordance-" + state.safeKey + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function show(bw, safeKey) {
    state = { bw: bw, safeKey: safeKey, verses: [], next: 0, lines: [], loading: false, started: false };
    var body = el("concBody");
    if (body) body.innerHTML = "";
    var status = el("concStatus");
    if (status) status.textContent = "";
    var more = el("concMore");
    if (more) more.hidden = true;
    var details = el("concDetails");
    if (details && details.open) start();
  }

  function init() {
    var details = el("concDetails");
    if (!details) return;
    details.addEventListener("toggle", function () {
      if (details.open) start();
    });
    var sort = el("concSort");
    if (sort) sort.addEventListener("change", render);
    var more = el("concMore");
    if (more) more.addEventListener("click", loadNextPage);
    var dl = el("concCsv");
    if (dl) dl.addEventListener("click", download);
  }

  window.qdConcordance = { show: show, _linesForVerse: linesForVerse, WINDOW: WINDOW };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
