/* Surah distance map (distance.html). Reads data/surah-distance/surah-distance.json
 * (scripts/compute-surah-distance.mjs) and draws it. Every number shown is
 * a field of that file; nothing is recomputed here. Text is set with
 * textContent.
 */
(function () {
  "use strict";
  var CELL = 6;
  var MIN_TOKENS = 500;
  var N = 114;
  var data = null;
  var byKey = Object.create(null);
  var $ = function (id) { return document.getElementById(id); };

  function key(a, b) { return a < b ? a + "-" + b : b + "-" + a; }
  function name(n) {
    var s = window.SURAHS && window.SURAHS[n - 1];
    return n + (s ? " " + s.translit : "");
  }
  function fmt(x) { return x.toFixed(3); }

  // Sequential single-hue ramp for excess in [0, max]; negative excess is
  // drawn as the lightest step. The map is drawn on its own light plate so
  // it reads the same in light and dark themes.
  function ramp(t) {
    t = Math.max(0, Math.min(1, t));
    var light = 96 - t * 66; // 96% -> 30%
    return "hsl(28 " + (35 + t * 35) + "% " + light + "%)";
  }

  function draw() {
    var cv = $("dMap");
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#fbf5ea";
    ctx.fillRect(0, 0, cv.width, cv.height);
    var max = 0;
    data.pairs.forEach(function (p) { if (p.excess > max) max = p.excess; });
    if (!(max > 0)) max = 1;
    data.pairs.forEach(function (p) {
      var t = p.excess / max;
      ctx.fillStyle = ramp(t);
      ctx.fillRect((p.surahB - 1) * CELL, (p.surahA - 1) * CELL, CELL, CELL);
      ctx.fillRect((p.surahA - 1) * CELL, (p.surahB - 1) * CELL, CELL, CELL);
      if (p.lowCount) {
        ctx.strokeStyle = "rgba(0,0,0,0.16)";
        ctx.lineWidth = 1;
        [[p.surahB - 1, p.surahA - 1], [p.surahA - 1, p.surahB - 1]].forEach(function (c) {
          ctx.beginPath();
          ctx.moveTo(c[0] * CELL, (c[1] + 1) * CELL);
          ctx.lineTo((c[0] + 1) * CELL, c[1] * CELL);
          ctx.stroke();
        });
      }
    });
    ctx.fillStyle = "rgba(128,128,128,0.25)";
    for (var i = 0; i < N; i++) ctx.fillRect(i * CELL, i * CELL, CELL, CELL);
    $("dLegend").style.background = "linear-gradient(to right," + ramp(0) + "," + ramp(0.5) + "," + ramp(1) + ")";
    $("dLegendText").textContent = "Excess 0 to " + fmt(max) + ". ";
  }

  function show(a, b) {
    $("dA").value = String(a);
    $("dB").value = String(b);
    var out = $("dPair");
    if (a === b) {
      out.textContent = name(a) + " compared with itself.";
      return;
    }
    var p = byKey[key(a, b)];
    if (!p) {
      out.textContent = "No comparison is published for " + name(a) + " and " + name(b) + ".";
      return;
    }
    out.textContent =
      name(Math.min(a, b)) + " and " + name(Math.max(a, b)) + ": distance " + fmt(p.distance) +
      ", null mean " + fmt(p.nullMean) + ", excess " + fmt(p.excess) +
      ", permutation p " + p.permutationP + ", BH q " + p.bhQ +
      ". Rooted tokens " + p.rootedTokensA.toLocaleString() + " and " + p.rootedTokensB.toLocaleString() +
      (p.lowCount ? ". Low count: a surah has under 100 rooted tokens, read with caution." : ".");
  }

  function lists() {
    var ok = data.pairs.filter(function (p) { return p.rootedTokensA >= MIN_TOKENS && p.rootedTokensB >= MIN_TOKENS; });
    function fill(id, arr) {
      var body = $(id);
      body.textContent = "";
      arr.slice(0, 10).forEach(function (p) {
        var tr = document.createElement("tr");
        var td = document.createElement("td");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "linklike";
        btn.textContent = name(p.surahA) + " · " + name(p.surahB);
        btn.addEventListener("click", function () { show(p.surahA, p.surahB); });
        td.appendChild(btn);
        tr.appendChild(td);
        [fmt(p.distance), fmt(p.excess)].forEach(function (t) {
          var c = document.createElement("td");
          c.textContent = t;
          tr.appendChild(c);
        });
        body.appendChild(tr);
      });
    }
    fill("dClose", ok.slice().sort(function (x, y) { return x.excess - y.excess; }));
    fill("dFar", ok.slice().sort(function (x, y) { return y.excess - x.excess; }));
  }

  function init() {
    if (!$("dMap")) return;
    [$("dA"), $("dB")].forEach(function (sel) {
      for (var n = 1; n <= N; n++) {
        var o = document.createElement("option");
        o.value = String(n);
        o.textContent = name(n);
        sel.appendChild(o);
      }
    });
    $("dA").value = "2";
    $("dB").value = "3";
    fetch("data/surah-distance/surah-distance.json")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        data = d;
        d.pairs.forEach(function (p) { byKey[key(p.surahA, p.surahB)] = p; });
        draw();
        lists();
        show(2, 3);
      })
      .catch(function (e) { $("dPair").textContent = "Could not load the distances (" + e.message + ")."; });
    function fromSelects() { if (data) show(parseInt($("dA").value, 10), parseInt($("dB").value, 10)); }
    $("dA").addEventListener("change", fromSelects);
    $("dB").addEventListener("change", fromSelects);
    $("dMap").addEventListener("click", function (e) {
      if (!data) return;
      var r = $("dMap").getBoundingClientRect();
      var scale = $("dMap").width / r.width;
      var col = Math.floor(((e.clientX - r.left) * scale) / CELL) + 1;
      var row = Math.floor(((e.clientY - r.top) * scale) / CELL) + 1;
      if (col >= 1 && col <= N && row >= 1 && row <= N) show(row, col);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
