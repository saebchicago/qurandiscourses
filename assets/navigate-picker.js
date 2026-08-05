/* Navigate: make the verse count actionable.

   The 114-surah table has printed a Verses column since it was built,
   and every surah link went to /read?s=N — verse 1, no range. So the
   one page that already told a reader al-Saffat has 182 verses gave
   them no way to act on it, and a reader who wanted 37:100-120 had to
   go somewhere else and type numbers they had no way to check.

   This is the adapter, in the same shape as read-picker.js and
   compare-picker.js: the page keeps its table, the picker does the
   choosing, and navigation is one href built here. No new data. */
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
    if (!window.qdPicker) return;

    function go(v) {
      window.location.href =
        "/read?s=" + v.surah + "&a=" + (v.from === v.to ? v.from : v.from + "-" + v.to);
    }

    var entry = document.getElementById("navPickerEntry");
    var choose = document.getElementById("navChoose");
    if (entry && choose) {
      entry.hidden = false;
      choose.addEventListener("click", function () {
        var st = window.qdState;
        var recent =
          st && st.progress && Array.isArray(st.progress.recentSurahs)
            ? st.progress.recentSurahs[0]
            : null;
        window.qdPicker.open({ surah: recent || 1, trigger: choose, onSelect: go });
      });
    }

    // Delegated, because the table body is re-rendered on every filter
    // and sort: binding per row would go stale on the first keystroke.
    var table = document.getElementById("surahTable");
    if (!table) return;
    table.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".verse-count-btn");
      if (!btn) return;
      var id = Number(btn.getAttribute("data-verses"));
      if (!(id >= 1 && id <= 114)) return;
      window.qdPicker.open({ surah: id, trigger: btn, onSelect: go });
    });
  });
})();
