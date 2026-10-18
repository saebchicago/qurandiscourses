/* Query builder: the pure parts.
 *
 * A query is a set of filters over the Leeds v0.4 word-by-word morphology
 * (data/morphology/{surah}.json). Its whole state is the URL query string:
 * nothing is stored, and the same string always reproduces the same result.
 *
 *   root    Buckwalter root key (e.g. rHm); a Latin root such as r-h-m is
 *           resolved by the page through data/roots-list.json
 *   lemma   Buckwalter lemma, exact match (e.g. qaAla)
 *   pos     one or more Leeds part-of-speech tags, comma separated (V,N)
 *   from/to first and last surah, 1..114, inclusive
 *   period  one of meccan-early, meccan-middle, meccan-late, medinan
 *           (data/chronology.json, the Noldeke-Bell scheme)
 *
 * Filters combine with AND; an empty filter matches everything. A query
 * with no filter at all is refused, because it would list every token.
 */
(function (root) {
  "use strict";

  var PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
  var KEYS = ["root", "lemma", "pos", "from", "to", "period"];
  var WINDOW = 3;

  function clampSurah(x) {
    var n = parseInt(x, 10);
    return n >= 1 && n <= 114 ? n : null;
  }

  // URLSearchParams-like string in, normalized filters out. Unknown keys and
  // out-of-range values are dropped, never guessed at.
  function parse(search) {
    var p = new URLSearchParams(search || "");
    var f = { root: "", lemma: "", pos: [], from: null, to: null, period: "" };
    f.root = (p.get("root") || "").trim();
    f.lemma = (p.get("lemma") || "").trim();
    f.pos = (p.get("pos") || "")
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return /^[A-Z]{1,5}$/.test(s); })
      .filter(function (s, i, a) { return a.indexOf(s) === i; })
      .sort();
    f.from = clampSurah(p.get("from"));
    f.to = clampSurah(p.get("to"));
    if (f.from && f.to && f.from > f.to) { var t = f.from; f.from = f.to; f.to = t; }
    var per = (p.get("period") || "").trim();
    f.period = PERIODS.indexOf(per) >= 0 ? per : "";
    return f;
  }

  // Canonical string: fixed key order, empty filters omitted, so one query
  // has exactly one permalink.
  function serialize(f) {
    var p = new URLSearchParams();
    if (f.root) p.set("root", f.root);
    if (f.lemma) p.set("lemma", f.lemma);
    if (f.pos && f.pos.length) p.set("pos", f.pos.slice().sort().join(","));
    if (f.from) p.set("from", String(f.from));
    if (f.to) p.set("to", String(f.to));
    if (f.period) p.set("period", f.period);
    return p.toString();
  }

  function isEmpty(f) {
    return !f.root && !f.lemma && !(f.pos && f.pos.length) && !f.from && !f.to && !f.period;
  }

  // Surah numbers a query has to read. chronology maps "1".."114" to {period}.
  function surahsToScan(f, chronology) {
    var lo = f.from || 1;
    var hi = f.to || 114;
    var out = [];
    for (var s = lo; s <= hi; s++) {
      if (f.period && (!chronology[s] || chronology[s].period !== f.period)) continue;
      out.push(s);
    }
    return out;
  }

  function matches(tok, f) {
    if (f.root && tok.root !== f.root) return false;
    if (f.lemma && tok.lemma !== f.lemma) return false;
    if (f.pos && f.pos.length && f.pos.indexOf(tok.pos) < 0) return false;
    return true;
  }

  // morphBySurah: { "2": { "1": [tokens], ... }, ... }, only surahs in `scan`.
  // Returns every matching token with up to WINDOW words of same-verse context.
  function run(morphBySurah, scan, f) {
    var rows = [];
    var bySurah = [];
    for (var a = 0; a < scan.length; a++) {
      var s = scan[a];
      var verses = morphBySurah[s] || {};
      var vs = Object.keys(verses).map(Number).sort(function (x, y) { return x - y; });
      var n = 0;
      for (var b = 0; b < vs.length; b++) {
        var words = verses[vs[b]];
        for (var i = 0; i < words.length; i++) {
          if (!matches(words[i], f)) continue;
          n++;
          rows.push({
            s: s,
            v: vs[b],
            w: words[i].w,
            before: words.slice(Math.max(0, i - WINDOW), i).map(function (x) { return x.ar; }),
            key: words[i].ar,
            after: words.slice(i + 1, i + 1 + WINDOW).map(function (x) { return x.ar; }),
            root: words[i].root,
            lemma: words[i].lemma,
            pos: words[i].pos,
          });
        }
      }
      if (n) bySurah.push({ s: s, n: n });
    }
    return { total: rows.length, bySurah: bySurah, rows: rows, surahsScanned: scan.length };
  }

  function csv(result) {
    var q = function (x) {
      var s = String(x == null ? "" : x);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var head = ["surah", "verse", "word", "before", "keyword", "after", "root", "lemma", "pos"];
    var lines = result.rows.map(function (r) {
      return [r.s, r.v, r.w, r.before.join(" "), r.key, r.after.join(" "), r.root, r.lemma, r.pos].map(q).join(",");
    });
    return head.join(",") + "\n" + lines.join("\n") + "\n";
  }

  var api = {
    PERIODS: PERIODS, KEYS: KEYS, WINDOW: WINDOW,
    parse: parse, serialize: serialize, isEmpty: isEmpty,
    surahsToScan: surahsToScan, matches: matches, run: run, csv: csv,
  };
  root.qdQueryCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
