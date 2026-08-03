/* Adds click-first passage selection to the Compare page.

   Strictly an adapter over the rows compare.html already builds. Each
   passage row keeps its surah select and its two verse inputs; this
   appends a "Choose" button that opens the shared picker and writes the
   result back into those same three controls, then fires the change
   events the page already listens for.

   Nothing here touches the comparison engine, its capacity, or its URL
   scheme. The page supports six passages and ?mode=passages&p1..p6
   already; those are left exactly as they are.

   With JavaScript off, or if this file fails to load, the rows behave
   as they always have. */
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
    var container = document.getElementById("passages-rows");
    if (!container || !window.qdPicker || !window.SURAHS) return;

    function verseCount(id) {
      var s = window.SURAHS.find(function (x) {
        return x.id === Number(id);
      });
      return s ? s.verseCount : 1;
    }

    function fire(el) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function decorate(row) {
      if (row.querySelector(".p-choose")) return;
      var sel = row.querySelector(".p-surah");
      var start = row.querySelector(".p-start");
      var end = row.querySelector(".p-end");
      if (!sel || !start || !end) return;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "button secondary btn-secondary p-choose";
      btn.textContent = "Choose";
      // The row's own controls already carry per-passage labels; name
      // this one the same way so a screen reader can tell them apart.
      var n = Array.prototype.indexOf.call(
        container.querySelectorAll(".p-row"),
        row,
      );
      btn.setAttribute(
        "aria-label",
        "Choose passage " + (n + 1) + " by surah and verse range",
      );

      btn.addEventListener("click", function () {
        var cur = Number(sel.value) || 1;
        var from = parseInt(start.value, 10) || 1;
        var to = parseInt(end.value, 10) || from;
        window.qdPicker.open({
          trigger: btn,
          surah: cur,
          from: from,
          to: to,
          onSelect: function (v) {
            sel.value = String(v.surah);
            fire(sel);
            start.value = String(v.from);
            fire(start);
            // The page treats an empty end box as "single verse", so
            // only fill it when the reader actually chose a range.
            end.value = v.to === v.from ? "" : String(v.to);
            fire(end);
          },
        });
      });

      row.appendChild(btn);
    }

    container.querySelectorAll(".p-row").forEach(decorate);

    // "Add passage" builds rows after this runs.
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (node) {
          if (node.nodeType === 1 && node.classList.contains("p-row")) {
            decorate(node);
          }
        });
      });
    }).observe(container, { childList: true });
  });
})();
