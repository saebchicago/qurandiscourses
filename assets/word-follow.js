/* Word-by-word highlighting while the Arabic recitation plays (Read).
   ────────────────────────────────────────────────────────────────
   Word timings are quran-align's (Collin Fair, CC BY 4.0), made for the
   everyayah.com recordings. Read plays cdn.islamic.network's files, so
   only reciters whose timings were measured to fit those files are used:
   scripts/build-word-timings.mjs tested every candidate against our own
   verse lengths (criteria fixed before the data was seen) and lists the
   passing ones in data/recitation/word-timings-report.json `bundled`.
   Any other reciter simply gets no highlighting.

   Two more guards, per verse:
     - Only the Arabic leg is followed, never the translation.
     - quran-align numbers the words of Tanzil's text, pause marks not
       counted. The verse on screen is tokenized the same way, and a verse
       whose word count differs from the timing data is not highlighted
       (about 2% of verses), rather than highlighted on the wrong word.

   The page's markup is never rewritten: the highlight is a CSS Custom
   Highlight (::highlight(qd-word) in style.css) over a Range of the
   verse's own text. Browsers without that API show no highlighting and
   lose nothing else. */
(function () {
  "use strict";

  var REPORT = "/data/recitation/word-timings-report.json";
  var MARK_ONLY = /^[ۖ-ۭ۞۩؀-؅]+$/;
  var supported = !!(window.CSS && CSS.highlights && window.Highlight);

  var report = null;
  var reportP = null;
  var timings = {}; // "reciter/surah" -> Promise<{ayah: segments}>
  var tokenCache = typeof WeakMap === "function" ? new WeakMap() : null;

  function loadReport() {
    if (!reportP) {
      reportP = fetch(REPORT)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (j) {
          report = j;
          return j;
        })
        .catch(function () {
          reportP = null;
          return null;
        });
    }
    return reportP;
  }

  function available(reciter) {
    return !!(report && report.bundled && report.bundled.indexOf(reciter) >= 0);
  }

  function surahTimings(reciter, surah) {
    var key = reciter + "/" + surah;
    if (!timings[key]) {
      timings[key] = fetch("/data/recitation/words/" + encodeURIComponent(reciter) + "/" + surah + ".json")
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .catch(function () {
          delete timings[key];
          return null;
        });
    }
    return timings[key];
  }

  // Word ranges of a verse's Arabic, pause marks skipped, in text order.
  function wordRanges(p) {
    var text = p.textContent;
    var hit = tokenCache && tokenCache.get(p);
    if (hit && hit.text === text) return hit.ranges;
    var ranges = [];
    var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var re = /\S+/g;
      var m;
      while ((m = re.exec(node.data))) {
        if (MARK_ONLY.test(m[0])) continue;
        ranges.push({ node: node, start: m.index, end: m.index + m[0].length });
      }
    }
    if (tokenCache) tokenCache.set(p, { text: text, ranges: ranges });
    return ranges;
  }

  function clear(engine) {
    if (supported) CSS.highlights.delete("qd-word");
    if (engine && engine._followEl) {
      engine._followEl.removeAttribute("data-word-follow");
      engine._followEl = null;
    }
  }

  function tick(engine) {
    if (!supported || engine.dead) return;
    var st = engine.state();
    var item = st.item;
    var reciter = engine.reciterId();
    if (!st.playing || st.leg !== "ar" || !item || !available(reciter)) return clear(engine);
    var key = reciter + "/" + item.surah;
    var loaded = engine._followData && engine._followData.key === key ? engine._followData.data : undefined;
    if (loaded === undefined) {
      if (engine._followPending !== key) {
        engine._followPending = key;
        surahTimings(reciter, item.surah).then(function (data) {
          engine._followData = { key: key, data: data };
          engine._followPending = null;
        });
      }
      return;
    }
    var segs = loaded && loaded[item.ayah];
    var el = item.el || document.querySelector('.verse[data-ar-number="' + item.arNumber + '"]');
    var p = el && el.querySelector("p.ar");
    if (!segs || !segs.length || !p) return clear(engine);
    var words = wordRanges(p);
    var expected = 0;
    for (var i = 0; i < segs.length; i++) expected = Math.max(expected, segs[i][1]);
    if (words.length !== expected) {
      clear(engine);
      el.setAttribute("data-word-follow", "mismatch");
      engine._followEl = el;
      return;
    }
    var ms = engine.audio.currentTime * 1000;
    var seg = null;
    for (var j = 0; j < segs.length; j++) {
      if (segs[j][2] <= ms) seg = segs[j];
      else break;
    }
    if (!seg || ms > seg[3] + 400) return CSS.highlights.delete("qd-word");
    var a = words[seg[0]];
    var b = words[seg[1] - 1];
    if (!a || !b) return clear(engine);
    var range = document.createRange();
    range.setStart(a.node, a.start);
    range.setEnd(b.node, b.end);
    CSS.highlights.set("qd-word", new Highlight(range));
    if (engine._followEl && engine._followEl !== el) engine._followEl.removeAttribute("data-word-follow");
    el.setAttribute("data-word-follow", seg[0] + "-" + seg[1]);
    engine._followEl = el;
  }

  function attach(engine) {
    if (!engine || engine._follow) return;
    engine._follow = true;
    loadReport();
    if (!supported) return;
    var raf = 0;
    function loop() {
      raf = 0;
      tick(engine);
      if (engine.playing && !engine.dead) raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (!raf) raf = requestAnimationFrame(loop);
    }
    ["play", "playing", "seeked", "timeupdate"].forEach(function (ev) {
      engine.audio.addEventListener(ev, kick);
    });
    ["pause", "ended", "emptied"].forEach(function (ev) {
      engine.audio.addEventListener(ev, function () {
        tick(engine);
      });
    });
  }

  // For the Listen sheet: one line saying whether this reciter is followed.
  function describe(reciter) {
    return loadReport().then(function () {
      if (!supported) return "";
      if (available(reciter))
        return "Words are highlighted as they are recited, from quran-align's timings (Collin Fair, CC BY 4.0), checked against these recordings.";
      var names = (report && report.bundled) || [];
      return names.length
        ? "Word highlighting is available with " +
            names
              .map(function (id) {
                var r = (window.qdReciters || []).filter(function (x) {
                  return x.id === id;
                })[0];
                return (r && r.name) || id;
              })
              .join(", ") +
            "; this reciter's timings did not fit the recordings Read plays."
        : "";
    });
  }

  window.qdWordFollow = { attach: attach, describe: describe, available: available };
})();
