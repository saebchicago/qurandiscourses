/* Wires the click-first picker into the Read page.

   Deliberately an adapter, not a rewrite. The page's typed form is the
   no-JS baseline and stays exactly as it was; this unhides a "Choose a
   surah" entry above it, and everything the picker selects is written
   back into those same two inputs. Loading happens by clicking the
   page's own Load button, so read.html's load() keeps sole ownership
   of fetching, URL rewriting, and error handling: nothing here
   duplicates or reaches into it.

   With JavaScript off, #pickerEntry stays hidden and the form is the
   whole interface, unchanged. */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var entry = document.getElementById("pickerEntry");
    var openBtn = document.getElementById("openPicker");
    var rangeHost = document.getElementById("pickerRange");
    var current = document.getElementById("pickerCurrent");
    var surahInput = document.getElementById("surahInput");
    var ayahInput = document.getElementById("ayahInput");
    var loadBtn = document.getElementById("loadBtn");
    if (!entry || !openBtn || !surahInput || !ayahInput || !loadBtn) return;
    if (!window.qdPicker || !window.qdRange || !window.SURAHS) return;

    entry.hidden = false;
    // Open in the markup so a no-JS reader gets the full typed form;
    // closed here, where the picker above it is known to work.
    var typed = document.getElementById("typeRef");
    if (typed) typed.open = false;

    function surahById(id) {
      return window.SURAHS.find(function (s) {
        return s.id === Number(id);
      });
    }

    // Read the form's current state. The surah box accepts a name or a
    // number, so resolve names through the canonical dataset the same
    // way the page's own resolver does.
    //
    // Names go through read.html's own resolveSurah, not a second
    // matcher of our own: load() calls it too, so a private copy that
    // disagreed would put a different surah on screen from the one the
    // summary names ("Nas" resolves to an-Nasr there, an-Nas under a
    // naive exact match). The local fallback only covers resolveSurah
    // being absent, since this file loads independently of that script.
    //
    // The resolved id is part of the return value, and every caller uses
    // it rather than re-parsing the box. Re-parsing loses the answer:
    // parseInt("Baqarah") is NaN, so a named deep link like
    // /read?s=Baqarah&a=255 fell back to surah 1, and because painting
    // the range control writes its clamped value back into the form,
    // "Baqarah" and "255" became "1" and "7" before load() ever ran.
    function resolve(raw) {
      if (typeof window.resolveSurah === "function") {
        var byPage = window.resolveSurah(raw);
        return byPage >= 1 && byPage <= 114 ? byPage : 0;
      }
      var id = parseInt(raw, 10);
      if (id >= 1 && id <= 114) return id;
      var needle = raw.toLowerCase();
      var hit = window.SURAHS.find(function (s) {
        return (
          s.translit.toLowerCase() === needle ||
          (s.names || []).indexOf(needle) !== -1
        );
      });
      return hit ? hit.id : 0;
    }

    function readForm() {
      var raw = (surahInput.value || "").trim();
      var id = resolve(raw);
      var a = (ayahInput.value || "").trim();
      // Accept every range form read.html's own parser accepts,
      // including the open "1-" and "1-end" that mean the surah's last
      // verse. This parser used to be narrower than that one, so an
      // open range typed in the box was silently rewritten to a single
      // verse before load() ever saw it.
      var m = a.match(/^(\d+)\s*[-–—]\s*(\d+|end)?$/i);
      // An EMPTY box means the whole surah, the same as it does in
      // read.html's own parser. Reading it as verse 1 here would make
      // this control disagree with the page it writes into.
      var blank = a === "";
      var from = blank ? 1 : m ? Number(m[1]) : parseInt(a, 10) || 1;
      var openEnded = blank || (Boolean(m) && !(m[2] && /^\d+$/.test(m[2])));
      var to = blank ? NaN : m ? (openEnded ? NaN : Number(m[2])) : from;
      // clampRange turns a non-numeric `to` into the surah's last verse
      // — the one place "to end" is defined.
      var c = window.qdPicker.clampRange(id || 1, from, to);
      return {
        surah: id || 1,
        from: c.from,
        to: c.to,
        resolved: !!id,
        empty: raw === "",
      };
    }

    function label(id, from, to) {
      var s = surahById(id);
      var ref = window.qdPicker.refLabel(id, from, to);
      if (!s) return ref;
      // The verse count belongs HERE, not two taps deep in the dialog:
      // a reader choosing a range cannot judge one without knowing where
      // the surah ends, and nothing else on the page said.
      var whole = from === 1 && to === s.verseCount;
      return (
        s.translit + ", " + ref + " \u00b7 " +
        (whole
          ? "the whole surah, " + s.verseCount +
            (s.verseCount === 1 ? " verse" : " verses")
          : s.verseCount + (s.verseCount === 1 ? " verse" : " verses") + " in all")
      );
    }

    // The hint under the verse box names the surah the box resolves to
    // right now, so the length is on screen while the range is typed.
    function paintHint(id) {
      var hint = document.getElementById("ayahHint");
      var s = surahById(id);
      if (!hint || !s) return;
      hint.textContent =
        s.translit + " has " + s.verseCount +
        (s.verseCount === 1 ? " verse" : " verses") +
        ". Leave the verse box empty to read all of it; a single verse (5) or a range (1-7) also work.";
    }

    var rangeCtl = null;
    // The range control fires onChange the moment it is created, and that
    // callback writes back into the form. Cleared for the first paint
    // when the box holds text no resolver recognises, so a mistyped
    // ?s=zzzz keeps the reader's text and gets read.html's "not found"
    // message instead of being silently replaced by surah 1.
    var writeBack = true;

    function paint(id, from, to) {
      current.textContent = label(id, from, to);
      paintHint(id);
      if (!rangeCtl) {
        rangeCtl = window.qdRange.create(rangeHost, {
          surah: id,
          from: from,
          to: to,
          onChange: function (v) {
            if (writeBack) writeForm(v.surah, v.from, v.to);
            current.textContent = label(v.surah, v.from, v.to);
            paintHint(v.surah);
          },
        });
      } else {
        rangeCtl.set(id, from, to);
      }
    }

    function writeForm(id, from, to) {
      surahInput.value = String(id);
      ayahInput.value = from === to ? String(from) : from + "-" + to;
    }

    openBtn.addEventListener("click", function () {
      var cur = readForm();
      window.qdPicker.open({
        trigger: openBtn,
        surah: cur.surah,
        from: cur.from,
        to: cur.to,
        onSelect: function (v) {
          writeForm(v.surah, v.from, v.to);
          paint(v.surah, v.from, v.to);
          loadBtn.click();
        },
      });
    });

    // Keep the summary line honest when the reader uses the typed form,
    // Prev/Next, or arrives on a deep link.
    // Painting writes the clamped range back into the form, so a box the
    // reader is still typing into must be left alone until it names a
    // real surah.
    function sync() {
      var cur = readForm();
      if (!cur.resolved) return;
      paint(cur.surah, cur.from, cur.to);
    }
    surahInput.addEventListener("change", sync);
    ayahInput.addEventListener("change", sync);
    loadBtn.addEventListener("click", function () {
      setTimeout(sync, 0);
    });

    // On a bare /read the form is empty and surah 1 is the right default
    // to show and to seed the form with. On a deep link the box holds
    // whatever ?s= carried, already resolved above.
    var start = readForm();
    writeBack = start.resolved || start.empty;
    paint(start.surah, start.from, start.to);
    writeBack = true;
  });
})();
