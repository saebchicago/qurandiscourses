/* Core vocabulary practice cards (vocabulary.html).
   ────────────────────────────────────────────────────────────────
   The ranked list is static HTML, built by scripts/build-vocabulary.mjs.
   This script adds the practice section on top: one card at a time,
   the lemma's most common written form first, its meaning on request.

   The meaning is fetched, never bundled: the Quran.com word-by-word
   English for that form at its first occurrence, from the same endpoint
   Read's word-by-word strip uses (assets/wordbw.js). One contextual
   rendering, labeled as such on the page. Before showing it, the
   Arabic Quran.com serves at that position is compared with ours
   (normAr below); a mismatch shows no meaning rather than a wrong one.
   scripts/check-vocab-wbw.mjs runs the same comparison for every lemma
   from CI, reading normAr out of this file.

   Scheduling is a small Leitner scheme: "Not yet" puts a word in box 1,
   "I knew it" moves it up a box (to 5). Cards alternate between box-1
   reviews and the next unseen word in frequency order; once every word
   has been seen, the lowest box comes first. Progress lives in this
   browser's localStorage only, and the page works without it. */
(function () {
  "use strict";

  var API = "https://api.quran.com/api/v4/verses/by_chapter/";
  var PER_PAGE = 50;
  var STORE = "qd_vocab";

  var root = document.getElementById("vocabPractice");
  if (!root || !window.fetch) return;

  function esc(v) {
    return window.qdEsc
      ? window.qdEsc(v)
      : String(v == null ? "" : v).replace(/[&<>"]/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
  }

  // Letters only: drop harakat, Qur'anic annotation marks and tatweel,
  // and fold the letter variants two Uthmani encodings spell differently.
  function normAr(s) {
    return String(s || "")
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ‌‍]/g, "")
      .replace(/[ٱآأإ]/g, "ا")
      .replace(/[ىی]/g, "ي")
      .replace(/[ؤ]/g, "و")
      .replace(/[ئ]/g, "ي")
      .replace(/[ء]/g, "")
      .replace(/\s+/g, "");
  }

  var state = { v: 1, box: {}, turn: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && saved.v === 1 && saved.box) state = saved;
  } catch (e) {}
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (e) {}
  }

  var el = {
    set: document.getElementById("vocabSet"),
    form: document.getElementById("vocabForm"),
    meta: document.getElementById("vocabMeta"),
    answer: document.getElementById("vocabAnswer"),
    meaning: document.getElementById("vocabMeaning"),
    links: document.getElementById("vocabLinks"),
    show: document.getElementById("vocabShow"),
    knew: document.getElementById("vocabKnew"),
    again: document.getElementById("vocabAgain"),
    progress: document.getElementById("vocabProgress"),
    reset: document.getElementById("vocabReset"),
  };

  var data = null;
  var rows = [];
  var current = null;
  var pages = {};

  function row(a) {
    var c = data.columns;
    var o = {};
    for (var i = 0; i < c.length; i++) o[c[i]] = a[i];
    return o;
  }

  function inSet() {
    var n = parseInt(el.set.value, 10) || rows.length;
    return rows.slice(0, n);
  }

  function pick() {
    var set = inSet();
    var last = current && current.lemma;
    var reviews = set.filter(function (r) {
      return state.box[r.lemma] === 1 && r.lemma !== last;
    });
    var unseen = set.filter(function (r) {
      return !state.box[r.lemma];
    });
    state.turn = (state.turn || 0) + 1;
    if (reviews.length && (state.turn % 2 === 0 || !unseen.length)) return reviews[0];
    if (unseen.length) return unseen[0];
    var rest = set.filter(function (r) {
      return r.lemma !== last;
    });
    if (!rest.length) rest = set;
    rest.sort(function (a, b) {
      return state.box[a.lemma] - state.box[b.lemma] || a.rank - b.rank;
    });
    return rest[0];
  }

  function progress() {
    var known = 0;
    var units = 0;
    rows.forEach(function (r) {
      if ((state.box[r.lemma] || 0) >= 2) {
        known++;
        units += r.count;
      }
    });
    el.progress.textContent =
      "Marked known: " +
      known +
      " of " +
      rows.length +
      " lemmas, together " +
      ((100 * units) / data.lemmatized).toFixed(1) +
      "% of the Qur'an's lemmatized word-units.";
  }

  function show(r) {
    current = r;
    var at = r.at.split(":");
    el.form.textContent = r.form;
    el.meta.textContent =
      "#" + r.rank + " · " + (r.posOther ? "mostly " : "") + r.pos + (r.rootLatin ? " · root " + r.rootLatin : "") + " · " + r.count.toLocaleString("en-US") + " times";
    el.answer.hidden = true;
    el.meaning.textContent = "";
    el.links.innerHTML =
      'First seen at <a href="/read?s=' +
      at[0] +
      "&amp;a=" +
      at[1] +
      '">' +
      esc(at[0] + ":" + at[1]) +
      "</a>, word " +
      esc(at[2]) +
      (r.rootHref ? ' · <a href="' + esc(r.rootHref) + '">every word from this root</a>' : "") +
      ' · <a href="/vocabulary#v' +
      r.rank +
      '">in the list</a>';
    el.show.hidden = false;
    el.knew.hidden = true;
    el.again.hidden = true;
    progress();
  }

  function fetchWords(surah, ayah) {
    var page = Math.ceil(ayah / PER_PAGE);
    var key = surah + ":" + page;
    if (!pages[key]) {
      pages[key] = fetch(
        API + encodeURIComponent(surah) + "?language=en&words=true&word_fields=text_uthmani&per_page=" + PER_PAGE + "&page=" + page,
      )
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function (e) {
          delete pages[key];
          throw e;
        });
    }
    return pages[key].then(function (json) {
      var v = ((json && json.verses) || []).filter(function (x) {
        return x && x.verse_key === surah + ":" + ayah;
      })[0];
      return ((v && v.words) || []).filter(function (w) {
        return w && w.char_type_name === "word";
      });
    });
  }

  function reveal() {
    var r = current;
    var at = r.at.split(":");
    el.answer.hidden = false;
    el.meaning.textContent = "Fetching the word-by-word meaning…";
    el.show.hidden = true;
    el.knew.hidden = false;
    el.again.hidden = false;
    el.knew.focus();
    fetchWords(+at[0], +at[1])
      .then(function (words) {
        if (current !== r) return;
        var w = words[+at[2] - 1];
        var en = w && w.translation && w.translation.text;
        if (!w || !en || normAr(w.text_uthmani || w.text) !== normAr(r.form)) {
          el.meaning.textContent =
            "No meaning shown: the word-by-word source numbers this verse's words differently. Follow the verse link to read it in context.";
          return;
        }
        el.meaning.innerHTML =
          "<strong>" + esc(en) + "</strong> " + '<span class="t-annotation">(at ' + esc(at[0] + ":" + at[1]) + ", word by word; Quran data provided by <a href=\"https://quran.foundation\" rel=\"noopener\">Quran Foundation</a>)</span>";
      })
      .catch(function () {
        if (current !== r) return;
        el.meaning.textContent = "The word-by-word meaning could not be fetched. Follow the verse link to read it in context.";
      });
  }

  function grade(knew) {
    var b = state.box[current.lemma] || 0;
    state.box[current.lemma] = knew ? Math.min(5, Math.max(2, b + 1)) : 1;
    save();
    show(pick());
  }

  function init(json) {
    data = json;
    rows = data.lemmas.map(row);
    data.milestones.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.lemmas;
      o.textContent = "Top " + m.lemmas + " (" + Math.round(m.share * 100) + "% coverage)";
      if (m.lemmas > rows.length) return;
      el.set.appendChild(o);
    });
    try {
      var s = localStorage.getItem(STORE + "_set");
      if (s && el.set.querySelector('option[value="' + s + '"]')) el.set.value = s;
    } catch (e) {}
    el.set.addEventListener("change", function () {
      try {
        localStorage.setItem(STORE + "_set", el.set.value);
      } catch (e) {}
      current = null;
      show(pick());
    });
    el.show.addEventListener("click", reveal);
    el.knew.addEventListener("click", function () {
      grade(true);
    });
    el.again.addEventListener("click", function () {
      grade(false);
    });
    el.reset.addEventListener("click", function () {
      state = { v: 1, box: {}, turn: 0 };
      save();
      current = null;
      show(pick());
    });
    root.hidden = false;
    show(pick());
  }

  fetch("/data/vocabulary.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(init)
    .catch(function () {});

  window.qdVocab = { normAr: normAr };
})();
