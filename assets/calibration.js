/* "What the methods report in noise" on the Validation page
 * (data/calibration/report.json, scripts/build-calibration.mjs). Every
 * figure is a string or number from that file; text is set with textContent.
 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  function cell(tr, text) {
    var td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  }

  function init() {
    var body = $("calBody");
    if (!body) return;
    fetch("data/calibration/report.json")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        d.tests.forEach(function (t) {
          var tr = document.createElement("tr");
          cell(tr, t.method);
          cell(tr, t.realFindings);
          cell(tr, t.nullFindings);
          cell(tr, (t.anyFindingRate * 100).toFixed(1) + "%");
          body.appendChild(tr);
          var li = document.createElement("li");
          li.textContent = t.method + ". Null data: " + t.nullDescription + ". " + t.reading;
          $("calReadings").appendChild(li);
        });
      })
      .catch(function (e) { $("calStatus").textContent = "Could not load the calibration report (" + e.message + ")."; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
