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

    function surahById(id) {
      return window.SURAHS.find(function (s) {
        return s.id === Number(id);
      });
    }

    // Read the form's current state. The surah box accepts a name or a
    // number, so resolve names through the canonical dataset the same
    // way the page's own resolver does.
    function readForm() {
      var raw = (surahInput.value || "").trim();
      var id = parseInt(raw, 10);
      if (!(id >= 1 && id <= 114)) {
        var needle = raw.toLowerCase();
        var hit = window.SURAHS.find(function (s) {
          return (
            s.translit.toLowerCase() === needle ||
            (s.names || []).indexOf(needle) !== -1
          );
        });
        id = hit ? hit.id : 1;
      }
      var a = (ayahInput.value || "").trim();
      var m = a.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      var from = m ? Number(m[1]) : parseInt(a, 10) || 1;
      var to = m ? Number(m[2]) : from;
      return window.qdPicker.clampRange(id, from, to);
    }

    function label(id, from, to) {
      var s = surahById(id);
      var ref = window.qdPicker.refLabel(id, from, to);
      return s ? s.translit + ", " + ref : ref;
    }

    var rangeCtl = null;

    function paint(id, from, to) {
      current.textContent = label(id, from, to);
      if (!rangeCtl) {
        rangeCtl = window.qdRange.create(rangeHost, {
          surah: id,
          from: from,
          to: to,
          onChange: function (v) {
            writeForm(v.surah, v.from, v.to);
            current.textContent = label(v.surah, v.from, v.to);
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
      var id = parseInt(surahInput.value, 10);
      window.qdPicker.open({
        trigger: openBtn,
        surah: id >= 1 && id <= 114 ? id : 1,
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
    function sync() {
      var id = parseInt(surahInput.value, 10);
      if (!(id >= 1 && id <= 114)) return;
      var cur = readForm();
      paint(id, cur.from, cur.to);
    }
    surahInput.addEventListener("change", sync);
    ayahInput.addEventListener("change", sync);
    loadBtn.addEventListener("click", function () {
      setTimeout(sync, 0);
    });

    var startId = parseInt(surahInput.value, 10);
    var start = readForm();
    paint(startId >= 1 && startId <= 114 ? startId : 1, start.from, start.to);
  });
})();
