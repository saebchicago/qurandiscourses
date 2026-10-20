/* Table explorer: the pure parts.
 *
 * Reads one of the published export tables (data/exports/<name>.csv) and
 * sorts, filters and summarizes it in the browser. Nothing is stored or sent:
 * the whole view is the URL query string, and the same string always
 * reproduces the same rows. Every number shown comes from the table itself.
 *
 *   t   table name        s   sort, "column" or "column:desc"
 *   f.<column>  a filter  p   page (1-based)
 *
 * Filters: text columns match a substring (case and Arabic vowel marks
 * folded); number columns take  >=2  <0.5  =3  5..10  or a bare number.
 */
(function (root) {
  "use strict";

  var PAGE_SIZE = 50;
  // Arabic vowel marks, Quranic marks and tatweel: dropped so a plain
  // search letter matches the pointed word, like the Query page.
  var MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

  function fold(s) {
    return String(s).replace(MARKS, "").replace(/ٱ/g, "ا").toLowerCase();
  }

  // RFC 4180: quoted fields, "" for a quote, CR/LF or LF rows, optional BOM.
  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    var rows = [];
    var row = [];
    var field = "";
    var inQ = false;
    var i = 0;
    var n = text.length;
    while (i < n) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function quote(v) {
    var s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(header, rows) {
    var out = [header.map(quote).join(",")];
    for (var i = 0; i < rows.length; i++) out.push(rows[i].map(quote).join(","));
    return out.join("\n") + "\n";
  }

  // Cell value for a column type: numbers become numbers, an empty cell is
  // null ("not available"), everything else stays text.
  function coerce(v, type) {
    if (v === "" || v == null) return null;
    if (type === "integer" || type === "number") {
      var x = Number(v);
      return isFinite(x) ? x : null;
    }
    return v;
  }

  function load(text, fields) {
    var all = parseCsv(text);
    var header = all[0] || [];
    var types = header.map(function (h) {
      for (var i = 0; i < fields.length; i++) if (fields[i].name === h) return fields[i].type;
      return "string";
    });
    var rows = [];
    for (var r = 1; r < all.length; r++) {
      if (all[r].length === 1 && all[r][0] === "") continue;
      rows.push(all[r].map(function (v, i) { return coerce(v, types[i]); }));
    }
    return { header: header, types: types, rows: rows };
  }

  // A number filter: ">=2", "<0.5", "=3", "5..10" or "7". null when unusable.
  function parseNumFilter(expr) {
    var s = String(expr).trim();
    if (!s) return null;
    var m = /^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)$/.exec(s);
    if (m) {
      var lo = Number(m[1]), hi = Number(m[2]);
      return function (v) { return v >= lo && v <= hi; };
    }
    m = /^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(s);
    if (!m) return null;
    var k = Number(m[2]);
    var op = m[1] || "=";
    return {
      ">=": function (v) { return v >= k; },
      "<=": function (v) { return v <= k; },
      ">": function (v) { return v > k; },
      "<": function (v) { return v < k; },
      "=": function (v) { return v === k; },
    }[op];
  }

  // filters: { column: expression }. Rows with no value never match a
  // filter on that column. Returns { rows, bad } where bad lists columns
  // whose expression could not be read (their filter is ignored).
  function filterRows(table, filters) {
    var checks = [];
    var bad = [];
    Object.keys(filters).forEach(function (col) {
      var expr = filters[col];
      if (expr == null || String(expr).trim() === "") return;
      var idx = table.header.indexOf(col);
      if (idx < 0) return;
      var t = table.types[idx];
      if (t === "integer" || t === "number") {
        var f = parseNumFilter(expr);
        if (!f) { bad.push(col); return; }
        checks.push(function (row) { var v = row[idx]; return v != null && f(v); });
      } else {
        var needle = fold(expr);
        checks.push(function (row) { var v = row[idx]; return v != null && fold(v).indexOf(needle) >= 0; });
      }
    });
    var rows = table.rows.filter(function (row) {
      for (var i = 0; i < checks.length; i++) if (!checks[i](row)) return false;
      return true;
    });
    return { rows: rows, bad: bad };
  }

  // Stable sort by one column; missing values last in either direction.
  function sortRows(table, rows, col, dir) {
    var idx = table.header.indexOf(col);
    if (idx < 0) return rows.slice();
    var mult = dir === "desc" ? -1 : 1;
    var numeric = table.types[idx] === "integer" || table.types[idx] === "number";
    return rows
      .map(function (r, i) { return [r, i]; })
      .sort(function (a, b) {
        var x = a[0][idx], y = b[0][idx];
        if (x == null && y == null) return a[1] - b[1];
        if (x == null) return 1;
        if (y == null) return -1;
        var c = numeric ? x - y : (x < y ? -1 : x > y ? 1 : 0);
        return c ? c * mult : a[1] - b[1];
      })
      .map(function (p) { return p[0]; });
  }

  // Summary of one column over the given rows.
  function summarize(table, rows, col) {
    var idx = table.header.indexOf(col);
    var vals = [];
    var missing = 0;
    rows.forEach(function (r) { if (r[idx] == null) missing++; else vals.push(r[idx]); });
    var t = table.types[idx];
    var out = { column: col, type: t, rows: rows.length, missing: missing };
    if (t === "integer" || t === "number") {
      var s = vals.slice().sort(function (a, b) { return a - b; });
      var n = s.length;
      out.n = n;
      if (n) {
        var sum = 0;
        for (var i = 0; i < n; i++) sum += s[i];
        out.min = s[0];
        out.max = s[n - 1];
        out.mean = sum / n;
        out.median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      }
    } else {
      var counts = Object.create(null);
      vals.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
      var keys = Object.keys(counts);
      out.n = vals.length;
      out.distinct = keys.length;
      out.top = keys
        .sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); })
        .slice(0, 5)
        .map(function (k) { return { value: k, count: counts[k] }; });
    }
    return out;
  }

  // Equal-width bins over the present values; a column with few distinct
  // values gets one bin per value. Returns [{from, to, count}].
  function histogram(table, rows, col, maxBins) {
    var idx = table.header.indexOf(col);
    var vals = [];
    rows.forEach(function (r) { if (r[idx] != null) vals.push(r[idx]); });
    if (!vals.length) return [];
    var distinct = {};
    vals.forEach(function (v) { distinct[v] = (distinct[v] || 0) + 1; });
    var keys = Object.keys(distinct).map(Number).sort(function (a, b) { return a - b; });
    var cap = maxBins || 20;
    if (keys.length <= cap) {
      return keys.map(function (k) { return { from: k, to: k, count: distinct[k] }; });
    }
    var lo = keys[0], hi = keys[keys.length - 1];
    var w = (hi - lo) / cap;
    var bins = [];
    for (var b = 0; b < cap; b++) bins.push({ from: lo + b * w, to: lo + (b + 1) * w, count: 0 });
    vals.forEach(function (v) {
      var b = Math.min(cap - 1, Math.floor((v - lo) / w));
      bins[b].count++;
    });
    return bins;
  }

  function pageOf(rows, page) {
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    var p = Math.min(Math.max(1, page | 0 || 1), pages);
    return { page: p, pages: pages, rows: rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE) };
  }

  // URL state <-> object. Unknown keys are ignored.
  function parseState(search) {
    var p = new URLSearchParams(search || "");
    var st = { table: p.get("t") || "", sort: "", dir: "asc", filters: {}, page: 1 };
    var s = p.get("s") || "";
    if (s) {
      var i = s.lastIndexOf(":");
      if (i > 0 && (s.slice(i + 1) === "desc" || s.slice(i + 1) === "asc")) {
        st.sort = s.slice(0, i);
        st.dir = s.slice(i + 1);
      } else st.sort = s;
    }
    p.forEach(function (v, k) { if (k.indexOf("f.") === 0 && v !== "") st.filters[k.slice(2)] = v; });
    st.page = Math.max(1, parseInt(p.get("p"), 10) || 1);
    return st;
  }

  function serializeState(st) {
    var p = new URLSearchParams();
    if (st.table) p.set("t", st.table);
    if (st.sort) p.set("s", st.sort + (st.dir === "desc" ? ":desc" : ""));
    Object.keys(st.filters || {}).forEach(function (k) {
      if (st.filters[k] !== "") p.set("f." + k, st.filters[k]);
    });
    if (st.page > 1) p.set("p", String(st.page));
    return p.toString();
  }

  var api = {
    PAGE_SIZE: PAGE_SIZE,
    fold: fold, parseCsv: parseCsv, toCsv: toCsv, coerce: coerce, load: load,
    parseNumFilter: parseNumFilter, filterRows: filterRows, sortRows: sortRows,
    summarize: summarize, histogram: histogram, pageOf: pageOf,
    parseState: parseState, serializeState: serializeState,
  };
  root.qdExplorer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
