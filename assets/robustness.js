/* "Do the period results survive other choices?" on the Validation page
 * (data/robustness/period-keyness.json, scripts/build-robustness.mjs). Every
 * figure and every sentence about a figure comes from that file; text is set
 * with textContent.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  function cell(tr, text) {
    var td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  }
  function pct(x) { return (x * 100).toFixed(1) + "%"; }

  function init() {
    var body = $("robBody");
    if (!body) return;
    fetch("data/robustness/period-keyness.json")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        var s = d.summary;
        var worst = d.variants.filter(function (v) { return v.id === s.worstVariant; })[0];
        $("robVerdict").textContent =
          "Verdict: " + s.verdict + ". The harshest variant (" + worst.label + ") keeps " + pct(s.worstRetainedShare) +
          " of the " + d.baseline.significant + " significant results, and " + s.heldInAllVariants + " of the " +
          d.baseline.significant + " hold in every variant that can test them. Rule, fixed before the run: " + d.method.verdictRule;
        var ranked = d.variants.slice().sort(function (a, b) { return a.retainedShare - b.retainedShare; });
        $("robSecond").textContent =
          "Without that variant, the harshest remaining one, " + ranked[1].label + ", keeps " + pct(ranked[1].retainedShare) + ".";
        d.variants.forEach(function (v) {
          var tr = document.createElement("tr");
          cell(tr, v.label);
          cell(tr, v.touchedSurahs.length
            ? v.touchedSurahs.length + " surah" + (v.touchedSurahs.length === 1 ? "" : "s") + ", " + pct(v.touchedShareOfAllTokens) + " of the words"
            : "none moved");
          cell(tr, v.retained + " of " + v.baselineSignificant + " (" + pct(v.retainedShare) + ")");
          cell(tr, v.spearmanSignedG2.toFixed(3));
          body.appendChild(tr);
          var li = document.createElement("li");
          li.textContent = v.label + ": " + v.perPeriod.map(function (p) { return p.period + " " + p.held + " of " + p.baseline; }).join("; ") + ".";
          $("robPeriods").appendChild(li);
        });
      })
      .catch(function (e) { $("robStatus").textContent = "Could not load the robustness report (" + e.message + ")."; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
