(function () {
  "use strict";

  // Draws a position strip on /exercise-roots AFTER reveal only.
  // Does not touch the scoring script; watches #rsAnswer becoming visible.

  function collectFamilies() {
    var verses = document.querySelectorAll("#rsStack .rs-verse");
    var byRoot = {};
    var verseCount = 0;
    verses.forEach(function (verse) {
      var label = verse.querySelector(".vnum");
      var n = 0;
      if (label && label.textContent) {
        var parts = label.textContent.split(":");
        n = parseInt(parts[1], 10) || 0;
      }
      if (n > verseCount) verseCount = n;
      verse.querySelectorAll(".rs-word").forEach(function (w) {
        var root = w.dataset.root;
        if (!root) return;
        if (!byRoot[root]) byRoot[root] = { root: root, verses: {}, count: 0 };
        byRoot[root].count += 1;
        if (n) byRoot[root].verses[n] = true;
      });
    });
    var families = Object.keys(byRoot)
      .map(function (r) {
        return byRoot[r];
      })
      .filter(function (f) {
        return f.count >= 2;
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, 8)
      .map(function (f) {
        return {
          root: f.root,
          label: f.root,
          count: f.count,
          verses: Object.keys(f.verses)
            .map(Number)
            .sort(function (a, b) {
              return a - b;
            }),
        };
      });
    return { families: families, verseCount: verseCount };
  }

  function draw() {
    var host = document.getElementById("rsMap");
    var note = document.getElementById("rsMapNote");
    if (!host || !window.qdViz || !window.qdViz.renderPositionStrip) return;
    var data = collectFamilies();
    if (!data.families.length) {
      host.hidden = true;
      if (note) note.hidden = true;
      return;
    }
    if (note) note.hidden = false;
    window.qdViz.renderPositionStrip(host, {
      verseCount: data.verseCount,
      families: data.families,
      ariaLabel: "Where recurring roots sit in this surah",
    });
  }

  function watch() {
    var answer = document.getElementById("rsAnswer");
    if (!answer || !window.MutationObserver) return;
    var obs = new MutationObserver(function () {
      if (!answer.hidden) draw();
      else {
        var host = document.getElementById("rsMap");
        var note = document.getElementById("rsMapNote");
        if (host) {
          host.hidden = true;
          host.innerHTML = "";
        }
        if (note) note.hidden = true;
      }
    });
    obs.observe(answer, { attributes: true, attributeFilter: ["hidden"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch);
  } else {
    watch();
  }
})();
