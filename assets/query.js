/* Query builder runtime (query.html). The logic is in assets/query-core.js;
 * this file reads the URL, fetches only the surah files a query needs
 * (data/morphology/{surah}.json) and draws the result. The address bar is
 * the only state: submitting pushes the canonical query string, and loading
 * a link runs it. Everything is inserted with textContent.
 */
(function () {
  "use strict";
  var Q = window.qdQueryCore;
  if (!Q) return;

  var POS = [
    ["N", "noun"], ["PN", "proper noun"], ["ADJ", "adjective"], ["V", "verb"], ["PRON", "pronoun"],
    ["DEM", "demonstrative"], ["REL", "relative"], ["P", "preposition"], ["CONJ", "conjunction"],
    ["NEG", "negative"], ["COND", "conditional"], ["T", "time adverb"], ["LOC", "location adverb"],
    ["ACC", "ACC"], ["AMD", "AMD"], ["ANS", "ANS"], ["CERT", "CERT"], ["EXH", "EXH"], ["EXL", "EXL"],
    ["EXP", "EXP"], ["INC", "INC"], ["INL", "INL"], ["INT", "INT"], ["INTG", "INTG"], ["PRO", "PRO"],
    ["RES", "RES"], ["RET", "RET"], ["SUB", "SUB"], ["SUP", "SUP"],
  ];
  var PAGE = 200;
  var CONCURRENCY = 6;

  var $ = function (id) { return document.getElementById(id); };
  var chronology = null;
  var rootsList = null;
  var morph = {};
  var current = null; // { filters, result, shown }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ": HTTP " + r.status);
      return r.json();
    });
  }

  function ensureChronology() {
    if (chronology) return Promise.resolve(chronology);
    return fetchJson("data/chronology.json").then(function (c) { chronology = c; return c; });
  }

  // A root may be typed as its Buckwalter key (rHm, case-sensitive), as Latin
  // (r-\u1e25-m, or r-h-m / rhm without the dots) or in Arabic letters (\u0631\u062d\u0645,
  // with or without spaces or vowel marks). An unmarked spelling is accepted
  // only when it names exactly one root; otherwise the candidates are listed.
  var plainLatin = function (x) { return x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z\u02bf\u02be']/g, ""); };
  var plainArabic = function (x) { return x.replace(/[\u064b-\u0670\u065f\u06d6-\u06ed\u0640\s]/g, "").replace(/\u0671/g, "\u0627"); };
  function resolveRoot(text) {
    if (!text) return Promise.resolve(text);
    var want = text.replace(/\s+/g, " ").trim();
    var load = rootsList ? Promise.resolve(rootsList) : fetchJson("data/roots-list.json").then(function (l) { rootsList = l; return l; });
    return load.then(function (list) {
      if (Object.prototype.hasOwnProperty.call(list, want)) return want;
      var keys = Object.keys(list);
      var i;
      for (i = 0; i < keys.length; i++) {
        var e = list[keys[i]];
        if (e.rootLatin === want || e.rootArabic === want) return keys[i];
      }
      var isArabic = /[\u0600-\u06ff]/.test(want);
      var hits = keys.filter(function (k) {
        return isArabic ? plainArabic(list[k].rootArabic) === plainArabic(want) : plainLatin(list[k].rootLatin) === plainLatin(want);
      });
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) {
        throw new Error("\u201c" + text + "\u201d fits more than one root: " + hits.map(function (k) { return list[k].rootLatin + " (" + k + ")"; }).join(", ") + ". Use one of those.");
      }
      throw new Error("No root matches \u201c" + text + "\u201d. Try the Buckwalter key (rHm), the Latin form (r-\u1e25-m) or the Arabic letters (\u0631 \u062d \u0645).");
    });
  }

  // Each surah file is fetched once per page view; the promise is cached, so
  // a query that overlaps one still loading waits for it instead of refetching.
  function loadSurah(s) {
    if (!morph[s]) {
      morph[s] = fetchJson("data/morphology/" + s + ".json").catch(function (e) { delete morph[s]; throw e; });
    }
    return morph[s];
  }

  function loadSurahs(scan, onProgress) {
    var data = {};
    var done = 0;
    var i = 0;
    return new Promise(function (resolve, reject) {
      if (!scan.length) return resolve(data);
      var active = 0;
      var failed = false;
      function next() {
        if (failed) return;
        if (i >= scan.length && active === 0) return resolve(data);
        while (active < CONCURRENCY && i < scan.length) {
          (function (s) {
            active++;
            loadSurah(s).then(function (d) {
              data[s] = d;
              done++;
              active--;
              onProgress(done, scan.length);
              next();
            }).catch(function (e) { failed = true; reject(e); });
          })(scan[i++]);
        }
      }
      next();
    });
  }

  function cell(tr, text, cls, attrs) {
    var td = document.createElement("td");
    td.textContent = text;
    if (cls) td.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { td.setAttribute(k, attrs[k]); });
    tr.appendChild(td);
    return td;
  }

  function drawRows() {
    var body = $("qRows");
    var rows = current.result.rows;
    var upto = Math.min(current.shown + PAGE, rows.length);
    for (var i = current.shown; i < upto; i++) {
      var r = rows[i];
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      var a = document.createElement("a");
      a.href = "/read?s=" + r.s + "&a=" + r.v;
      a.textContent = r.s + ":" + r.v;
      td.appendChild(a);
      tr.appendChild(td);
      var ar = { lang: "ar", dir: "rtl" };
      cell(tr, r.before.join(" "), "", ar);
      var k = cell(tr, r.key, "", ar);
      k.style.fontWeight = "bold";
      cell(tr, r.after.join(" "), "", ar);
      cell(tr, r.root);
      cell(tr, r.lemma);
      cell(tr, r.pos);
      body.appendChild(tr);
    }
    current.shown = upto;
    $("qMore").hidden = upto >= rows.length;
  }

  function draw(f, result) {
    current = { filters: f, result: result, shown: 0 };
    var bySurah = $("qBySurah");
    bySurah.textContent = "";
    result.bySurah.forEach(function (b) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      var a = document.createElement("a");
      a.href = "/surah/" + b.s;
      a.textContent = b.s + (window.SURAHS && window.SURAHS[b.s - 1] ? " · " + window.SURAHS[b.s - 1].translit : "");
      td.appendChild(a);
      tr.appendChild(td);
      cell(tr, b.n.toLocaleString());
      bySurah.appendChild(tr);
    });
    $("qRows").textContent = "";
    $("qSummary").textContent =
      result.total.toLocaleString() + " occurrence" + (result.total === 1 ? "" : "s") + " in " +
      result.bySurah.length.toLocaleString() + " surah" + (result.bySurah.length === 1 ? "" : "s") +
      " (" + result.surahsScanned.toLocaleString() + " searched).";
    drawRows();
    $("qResults").hidden = false;
  }

  function fillForm(f) {
    $("qRoot").value = f.root;
    $("qLemma").value = f.lemma;
    $("qFrom").value = f.from || "";
    $("qTo").value = f.to || "";
    $("qPeriod").value = f.period;
    var boxes = $("qPos").querySelectorAll("input");
    for (var i = 0; i < boxes.length; i++) boxes[i].checked = f.pos.indexOf(boxes[i].value) >= 0;
  }

  function readForm() {
    var pos = [];
    var boxes = $("qPos").querySelectorAll("input");
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) pos.push(boxes[i].value);
    var p = new URLSearchParams();
    p.set("root", $("qRoot").value);
    p.set("lemma", $("qLemma").value);
    p.set("pos", pos.join(","));
    p.set("from", $("qFrom").value);
    p.set("to", $("qTo").value);
    p.set("period", $("qPeriod").value);
    return Q.parse(p.toString());
  }

  var runId = 0;
  function execute(f) {
    var id = ++runId;
    var status = $("qStatus");
    $("qResults").hidden = true;
    if (Q.isEmpty(f)) {
      status.textContent = "";
      return;
    }
    if (!Q.hasAnchor(f)) {
      status.textContent = "Choose a root, a lemma or a part of speech. A surah range or a period only narrows a query; on its own it would list every word in it.";
      return;
    }
    status.textContent = "Reading…";
    return ensureChronology()
      .then(function () { return resolveRoot(f.root); })
      .then(function (bw) {
        var g = Object.assign({}, f, { root: bw });
        var scan = Q.surahsToScan(g, chronology);
        return loadSurahs(scan, function (d, n) {
          if (id === runId) status.textContent = "Reading surah files: " + d + " of " + n + "…";
        }).then(function (data) {
          if (id !== runId) return;
          draw(f, Q.run(data, scan, g));
          status.textContent = "";
        });
      })
      .catch(function (e) {
        if (id === runId) status.textContent = e.message;
      });
  }

  function init() {
    if (!$("qForm")) return;
    var posBox = $("qPos");
    POS.forEach(function (p) {
      var l = document.createElement("label");
      var i = document.createElement("input");
      i.type = "checkbox";
      i.name = "pos";
      i.value = p[0];
      l.appendChild(i);
      l.appendChild(document.createTextNode(" " + p[0] + (p[1] !== p[0] ? " " + p[1] : "")));
      posBox.appendChild(l);
    });

    $("qForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = readForm();
      fillForm(f);
      var qs = Q.serialize(f);
      history.pushState(null, "", qs ? "?" + qs : location.pathname);
      execute(f);
    });
    $("qReset").addEventListener("click", function () {
      fillForm(Q.parse(""));
      history.pushState(null, "", location.pathname);
      runId++;
      $("qResults").hidden = true;
      $("qStatus").textContent = "";
    });
    $("qMore").addEventListener("click", drawRows);
    $("qCopy").addEventListener("click", function () {
      var url = location.href;
      var done = function () { $("qStatus").textContent = "Link copied."; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { $("qStatus").textContent = url; });
      else $("qStatus").textContent = url;
    });
    $("qCsv").addEventListener("click", function () {
      if (!current) return;
      var blob = new Blob(["﻿" + Q.csv(current.result)], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "query-" + (Q.serialize(current.filters).replace(/[^A-Za-z0-9=,&.-]+/g, "_") || "all") + ".csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    });
    window.addEventListener("popstate", function () {
      var f = Q.parse(location.search);
      fillForm(f);
      execute(f);
    });
    // Empty submit: say what is needed (execute stays silent for a bare page).
    $("qForm").addEventListener("submit", function () {
      if (Q.isEmpty(readForm())) $("qStatus").textContent = "Choose a root, a lemma or a part of speech.";
    });

    var f0 = Q.parse(location.search);
    fillForm(f0);
    if (!Q.isEmpty(f0)) execute(f0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
