/* Home page "Tested against noise" table (index.html). Reads
 * data/calibration/report.json (scripts/build-calibration.mjs) and shows, for
 * each method, what it finds on the Qur'an beside what it finds on text where
 * the pattern cannot be real. The wording of every cell is the report's own;
 * nothing is computed here. Text is set with textContent.
 */
(function () {
  "use strict";
  var body = document.getElementById("trustBody");
  if (!body) return;
  fetch("data/calibration/report.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (d) {
      (d.tests || []).forEach(function (t) {
        var tr = document.createElement("tr");
        [t.method, t.realFindings, t.nullFindings].forEach(function (text) {
          var td = document.createElement("td");
          td.textContent = text == null ? "" : String(text);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    })
    .catch(function () {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "The checks could not be loaded here; they are on the Validation page.";
      tr.appendChild(td);
      body.appendChild(tr);
    });
})();
