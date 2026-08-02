/* Word-by-word meanings for the reading surface.
   ────────────────────────────────────────────────────────────────
   The bundled Leeds morphology carries no English: its `gloss` field
   is empty on all 77,429 tokens (the corpus.quran.com word
   translations are not part of the GPL dump). Rather than send every
   reader out to a dictionary link, this module fetches a published
   word-by-word English translation at runtime from the Quran.com
   Foundation Content API and renders it beneath each verse.

   Same posture as the verse translations in app.js: the text is
   fetched per passage, rendered exactly as served, cached only in
   this browser, and never bundled into this repository. Copyright
   stays with the translation's rights holders, who are credited in
   sources.html and NOTICE.md; every strip carries a Nuanced badge
   pointing at that citation.

   Alignment note: Quran.com segments by WRITTEN WORD while the Leeds
   corpus segments morphologically (bismi is one written word but two
   Leeds tokens). These meanings therefore render on their own
   surface, never merged row-by-row into the Leeds word table.

   Failure is silent by design: a strip that cannot be filled stays
   hidden, exactly as the gloss-absence path has always behaved. */
(function () {
  "use strict";

  var API = "https://api.quran.com/api/v4/verses/by_chapter/";
  var PER_PAGE = 50;

  // Its own cache, not app.js's qd_apicache: that store holds the
  // alquran.cloud response envelope (json.data), a different shape.
  // Entries here are normalized and small — one page of a surah as
  // { "s:a": [[arabic, english], …] } — so a long surah costs a few
  // KB rather than a full v4 payload.
  var CACHE_KEY = "qd_wbwcache";
  var CACHE_MAX = 60;
  var cache = null;

  function esc(v) {
    return window.qdEsc ? window.qdEsc(v) : String(v == null ? "" : v);
  }

  function cacheLoad() {
    if (cache) return cache;
    cache = { v: 1, order: [], entries: {} };
    try {
      var saved = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (saved && saved.v === 1 && saved.entries && saved.order) cache = saved;
    } catch (e) {}
    return cache;
  }

  function cachePut(key, value) {
    var c = cacheLoad();
    if (!c.entries[key]) c.order.push(key);
    c.entries[key] = value;
    while (c.order.length > CACHE_MAX) delete c.entries[c.order.shift()];
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {
      // Quota: evict the older half and retry once, then stay
      // in-memory (mirrors app.js's apiCachePut).
      c.order.splice(0, Math.ceil(c.order.length / 2)).forEach(function (k) {
        delete c.entries[k];
      });
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(c));
      } catch (e2) {}
    }
  }

  // One page of verses -> { "s:a": [[ar, en], …] }. Tolerant of shape
  // drift: anything missing simply yields fewer chips, never a throw.
  function normalize(json) {
    var out = {};
    var verses = (json && json.verses) || [];
    verses.forEach(function (v) {
      var key = v && v.verse_key;
      if (!key) return;
      var pairs = [];
      (v.words || []).forEach(function (w) {
        // "end" entries are the ayah-number ornament, not a word.
        if (!w || w.char_type_name !== "word") return;
        var ar = w.text_uthmani || w.text || "";
        var en = (w.translation && w.translation.text) || "";
        if (!ar && !en) return;
        pairs.push([ar, en]);
      });
      if (pairs.length) out[key] = pairs;
    });
    return out;
  }

  function fetchPage(surah, page) {
    var key = surah + ":" + page;
    var c = cacheLoad();
    if (c.entries[key]) return Promise.resolve(c.entries[key]);
    var url =
      API +
      encodeURIComponent(surah) +
      "?language=en&words=true&word_fields=text_uthmani&per_page=" +
      PER_PAGE +
      "&page=" +
      page;
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        var norm = normalize(json);
        cachePut(key, norm);
        return norm;
      });
  }

  function chipsHtml(pairs) {
    var chips = pairs
      .map(function (p) {
        return (
          '<span class="wbw-word">' +
          '<span class="ar notranslate" translate="no" lang="ar" dir="rtl">' +
          esc(p[0]) +
          "</span>" +
          '<span class="wbw-en" lang="en" dir="ltr">' +
          esc(p[1]) +
          "</span>" +
          "</span>"
        );
      })
      .join("");
    // Attribution rides every render: the badge popover carries the
    // full citation, so no per-verse sentence is needed.
    return (
      chips +
      '<span class="badge nuanced wbw-cite" data-source-ids="qcf-wbw-en" ' +
      'aria-label="Nuanced" tabindex="0" ' +
      "title=\"Nuanced · a word-by-word gloss is a translator's choice\">~</span>"
    );
  }

  // Fills every .wbw-strip[data-vk] inside `container`. Verse numbers
  // decide which API pages are needed, so a three-verse range costs
  // one request, not three.
  function fill(container, surah, ayahNums) {
    if (!container || !ayahNums || !ayahNums.length) return;
    var pages = {};
    ayahNums.forEach(function (a) {
      pages[Math.ceil(a / PER_PAGE)] = true;
    });
    Object.keys(pages).forEach(function (page) {
      fetchPage(surah, page)
        .then(function (byKey) {
          container
            .querySelectorAll(".wbw-strip[data-vk]")
            .forEach(function (strip) {
              if (strip.dataset.filled) return;
              var pairs = byKey[strip.dataset.vk];
              if (!pairs || !pairs.length) return;
              strip.innerHTML = chipsHtml(pairs);
              strip.dataset.filled = "1";
              strip.hidden = false;
              if (window.qdCiteEnhance) window.qdCiteEnhance(strip);
            });
        })
        .catch(function () {
          // Offline, blocked, or an unexpected shape: the strips stay
          // hidden and the verse reads exactly as it did before.
        });
    });
  }

  window.qdWbw = { fill: fill };
})();
