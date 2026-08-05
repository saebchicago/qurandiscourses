/* The passage panel: a surah, its real verse count, and a way to read
   any part of it without knowing where it ends.

   The site already had every piece of this. assets/picker.js ships a
   surah dialog whose every row prints "286 verses" and a From/To verse
   control whose max is bound to the true count. Both were mounted on
   two pages only, and on neither of the two boxes a reader actually
   types into. A reader who typed "surah 37" got verse 1 and was never
   told al-Saffat has 182 verses, so asking for the whole surah meant
   typing a number you would have to already know.

   This module is the missing surface, not a new control: it composes
   qdRange (unchanged) with the one fact that was missing from the page,
   and lets qdPicker do the browsing. Data is window.SURAHS
   (assets/surahs.js) — the same source read.html's out-of-range message
   already reads, so the count shown here and the count enforced there
   cannot disagree.

   Public API:
     qdPassage.panel(container, surahId, opts)
       Renders the panel into container. opts.onChange({surah,from,to})
       fires whenever the range moves. Returns {surah, set(id)}.
     qdPassage.surahOf(result, query)
       A parseAsk result (or a raw query) -> a surah id, or null when
       the reader named no chapter or already named a verse.
     qdPassage.clear(container)

   The primary button is the whole design: its label and its href are
   driven by the range control and default to the entire surah, so
   "read all of it" is what you get by not typing anything. */
(function () {
  "use strict";

  var esc = function (v) {
    return window.qdEsc ? window.qdEsc(v) : String(v == null ? "" : v);
  };

  // Above this many verses the panel says the load is large. read.html
  // fetches a whole surah for any 2+ verse range already (qdFetchSurah),
  // so this changes nothing about what happens — it only stops a
  // 286-verse wait from reading as a hang.
  var LONG_SPAN = 50;

  function surahs() {
    return window.SURAHS || [];
  }
  function surahById(id) {
    return surahs().find(function (s) {
      return s.id === Number(id);
    });
  }

  function refLabel(surah, from, to) {
    return surah + ":" + (from === to ? from : from + "-" + to);
  }

  // ── Which surah is the reader asking about? ───────────────────────
  // Only a chapter-level ask counts. "2:255" is a complete reference
  // and must keep going straight to the text; a theme or a root is not
  // a chapter at all. The types come from parseAsk (assets/ask.js).
  var SURAH_TYPES = { surah: 1, "surah-name": 1, "surah-suggest": 1 };

  function surahOf(result, query) {
    if (result && result.route) {
      if (!SURAH_TYPES[result.type]) return null;
      var m = result.route.match(/^\/read\?s=(\d+)/);
      return m ? Number(m[1]) : null;
    }
    // No router on this page: fall back to matching the raw query the
    // way surahs.js documents its aliases (lowercase names + id).
    var q = String(query || "").toLowerCase().trim();
    if (!q) return null;
    if (/^\d{1,3}$/.test(q)) {
      var n = Number(q);
      return n >= 1 && n <= 114 ? n : null;
    }
    var hit = surahs().find(function (s) {
      return s.names.some(function (name) {
        return name === q;
      });
    });
    return hit ? hit.id : null;
  }

  // ── The panel ─────────────────────────────────────────────────────
  function panel(container, surahId, opts) {
    opts = opts || {};
    var s = surahById(surahId);
    if (!container) return null;
    if (!s) {
      container.innerHTML = "";
      return null;
    }

    container.innerHTML =
      '<div class="passage-panel card">' +
      '<p class="passage-id">' +
      "<strong>" + esc(s.translit) + "</strong> " +
      '<span class="ar notranslate" translate="no" lang="ar" dir="rtl">' +
      esc(s.ar) + "</span> " +
      '<span class="passage-en">' + esc(s.en) + "</span>" +
      "</p>" +
      '<p class="passage-meta t-annotation">Surah ' + s.id + " &middot; " +
      s.verseCount + (s.verseCount === 1 ? " verse" : " verses") + " &middot; " +
      (s.cls === "m" ? "Meccan" : "Medinan") + "</p>" +
      '<div class="passage-range"></div>' +
      '<p class="passage-actions">' +
      '<a class="button btn-primary passage-read" href="#">Read</a> ' +
      '<button type="button" class="button secondary passage-browse">Browse all 114 surahs</button> ' +
      '<a class="button secondary" href="/dossier?s=' + s.id + '">Dossier</a>' +
      "</p>" +
      '<p class="passage-note t-annotation" hidden></p>' +
      "</div>";

    var rangeHost = container.querySelector(".passage-range");
    var readLink = container.querySelector(".passage-read");
    var note = container.querySelector(".passage-note");
    var browse = container.querySelector(".passage-browse");

    function paint(v) {
      var span = v.to - v.from + 1;
      var whole = v.from === 1 && v.to === s.verseCount;
      readLink.href = "/read?s=" + v.surah + "&a=" +
        (v.from === v.to ? v.from : v.from + "-" + v.to);
      // Naming the count on the button is the point: a reader who never
      // knew where the surah ended can now read all of it in one click,
      // and can see what "all of it" costs before they ask for it.
      readLink.textContent = whole
        ? "Read all " + s.verseCount + (s.verseCount === 1 ? " verse" : " verses")
        : "Read " + refLabel(v.surah, v.from, v.to);
      if (span > LONG_SPAN) {
        note.textContent =
          "A long passage: loading " + span + " verses in every translation you have selected may take a moment.";
        note.hidden = false;
      } else {
        note.hidden = true;
      }
      if (opts.onChange) opts.onChange(v);
    }

    var ctl = null;
    if (window.qdRange && window.qdRange.create) {
      ctl = window.qdRange.create(rangeHost, {
        surah: s.id,
        from: 1,
        to: s.verseCount,
        onChange: paint,
      });
    } else {
      // picker.js absent: the panel still names the count and still
      // reads the whole surah. check-ask.mjs makes this unreachable in
      // production, but a degraded panel beats a broken one.
      paint({ surah: s.id, from: 1, to: s.verseCount });
    }

    if (browse) {
      browse.addEventListener("click", function () {
        if (!window.qdPicker) return;
        window.qdPicker.open({
          surah: s.id,
          rangeMode: "surah",
          trigger: browse,
          onSelect: function (v) {
            panel(container, v.surah, opts);
            var next = container.querySelector(".passage-read");
            if (next) next.focus();
          },
        });
      });
    }

    return {
      surah: s.id,
      set: function (id) {
        return panel(container, id, opts);
      },
      focus: function () {
        readLink.focus();
      },
      range: ctl,
    };
  }

  function clear(container) {
    if (container) container.innerHTML = "";
  }

  window.qdPassage = { panel: panel, surahOf: surahOf, clear: clear };
})();
