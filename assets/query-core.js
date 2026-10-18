/* Query builder: the pure parts.
 *
 * A query is a set of filters over the Leeds v0.4 word-by-word morphology
 * (data/morphology/{surah}.json). Its whole state is the URL query string:
 * nothing is stored, and the same string always reproduces the same result.
 *
 *   root    Buckwalter root key (e.g. rHm); a Latin root such as r-h-m is
 *           resolved by the page through data/roots-list.json
 *   lemma   Buckwalter lemma (qaAla) or the same lemma in Arabic letters
 *   form    a written word in Arabic, matched on its letters (vowel marks and
 *           alif wasla folded), e.g. \u0642\u0627\u0644
 *   pos     one or more Leeds part-of-speech tags, comma separated (V,N)
 *   from/to first and last surah, 1..114, inclusive
 *   period  one of meccan-early, meccan-middle, meccan-late, medinan
 *           (data/chronology.json, the Noldeke-Bell scheme)
 *
 * Filters combine with AND; an empty filter matches everything. A query
 * needs a root, a lemma or a part of speech: a surah range or a period
 * alone only narrows, and on its own would list every token in it.
 */
(function (root) {
  "use strict";

  var PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
  var KEYS = ["root", "lemma", "form", "pos", "from", "to", "period"];
  var WINDOW = 3;

  // Letters only: vowel marks, tatweel and small high marks removed, alif wasla
  // as alif (the same folding as the Formulas data, scripts/lib/arabic.mjs).
  function fold(s) {
    return String(s).replace(/[\u064b-\u0670\u065f\u06d6-\u06ed\u0640]/g, "").replace(/\u0671/g, "\u0627");
  }

  // Buckwalter transliteration to Arabic letters (the scheme the Leeds corpus
  // uses). Checked against the published Arabic lemmas in scripts/query.test.mjs.
  var BW = {
    "'": "\u0621", "|": "\u0622", ">": "\u0623", "&": "\u0624", "<": "\u0625", "}": "\u0626", A: "\u0627",
    b: "\u0628", p: "\u0629", t: "\u062a", v: "\u062b", j: "\u062c", H: "\u062d", x: "\u062e", d: "\u062f",
    "*": "\u0630", r: "\u0631", z: "\u0632", s: "\u0633", "$": "\u0634", S: "\u0635", D: "\u0636", T: "\u0637",
    Z: "\u0638", E: "\u0639", g: "\u063a", _: "\u0640", f: "\u0641", q: "\u0642", k: "\u0643", l: "\u0644",
    m: "\u0645", n: "\u0646", h: "\u0647", w: "\u0648", Y: "\u0649", y: "\u064a", F: "\u064b", N: "\u064c",
    K: "\u064d", a: "\u064e", u: "\u064f", i: "\u0650", "~": "\u0651", o: "\u0652", "`": "\u0670", "{": "\u0671",
  };
  function bwToArabic(bw) {
    var out = "";
    for (var i = 0; i < bw.length; i++) out += BW[bw.charAt(i)] || bw.charAt(i);
    return out;
  }

  // Lemmas typed in Arabic are compared on letters only: vowel marks gone, alif
  // and hamza seats, alif maqsura and ta marbuta folded, and the corpus's own
  // extension marks and homograph digits dropped. Looser than the Buckwalter
  // match on purpose (a reader types hamza one of several ways), so an Arabic
  // lemma can match more than one Buckwalter lemma; the Buckwalter form stays
  // exact. Agreement with the published Arabic lemmas: scripts/query.test.mjs.
  function lemmaLetters(s) {
    return fold(s)
      .replace(/[\u0622\u0623\u0625\u0624\u0626\u0621]/g, "\u0627")
      .replace(/\u0649/g, "\u064a")
      .replace(/\u0629/g, "\u0647")
      .replace(/[0-9]/g, "")
      .replace(/\u0627+/g, "\u0627");
  }
  function tokenLemmaLetters(bw) {
    return lemmaLetters(bwToArabic(bw.replace(/[\^#@.\[,]/g, "")));
  }
  function lemmaMatches(want, tokLemma) {
    if (!want) return true;
    if (/[\u0600-\u06ff]/.test(want)) return tokenLemmaLetters(tokLemma) === lemmaLetters(want);
    return tokLemma === want;
  }

  function clampSurah(x) {
    var n = parseInt(x, 10);
    return n >= 1 && n <= 114 ? n : null;
  }

  // URLSearchParams-like string in, normalized filters out. Unknown keys and
  // out-of-range values are dropped, never guessed at.
  function parse(search) {
    var p = new URLSearchParams(search || "");
    var f = { root: "", lemma: "", form: "", pos: [], from: null, to: null, period: "" };
    f.root = (p.get("root") || "").trim();
    f.lemma = (p.get("lemma") || "").trim();
    f.form = fold((p.get("form") || "").trim());
    f.pos = p.getAll("pos").join(",")
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
    if (f.form) p.set("form", f.form);
    if (f.pos && f.pos.length) p.set("pos", f.pos.slice().sort().join(","));
    if (f.from) p.set("from", String(f.from));
    if (f.to) p.set("to", String(f.to));
    if (f.period) p.set("period", f.period);
    return p.toString();
  }

  function isEmpty(f) {
    return !f.root && !f.lemma && !f.form && !(f.pos && f.pos.length) && !f.from && !f.to && !f.period;
  }

  function hasAnchor(f) {
    return !!(f.root || f.lemma || f.form || (f.pos && f.pos.length));
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
    if (f.lemma && !lemmaMatches(f.lemma, tok.lemma)) return false;
    if (f.form && fold(tok.ar) !== f.form) return false;
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
          var c = root.qdKwic.context(words, i, WINDOW);
          rows.push({
            s: s,
            v: vs[b],
            w: words[i].w,
            before: c.before,
            key: c.key,
            after: c.after,
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
    parse: parse, serialize: serialize, isEmpty: isEmpty, hasAnchor: hasAnchor,
    surahsToScan: surahsToScan, matches: matches, run: run, csv: csv,
    fold: fold, bwToArabic: bwToArabic, lemmaLetters: lemmaLetters, tokenLemmaLetters: tokenLemmaLetters,
  };
  root.qdQueryCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
