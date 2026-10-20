/* Table explorer (explore.html). Reads data/exports/schema.json and one
 * data/exports/<name>.csv on demand, and uses assets/explorer-core.js for
 * everything that is computed. Every figure shown is a cell of the published
 * table or a count over its rows; the page's whole state is the URL query
 * string. Text is set with textContent.
 */
(function () {
  "use strict";
  var X = window.qdExplorer;
  var $ = function (id) { return document.getElementById(id); };
  if (!X || !$("exTable")) return;

  var NS = "http://www.w3.org/2000/svg";
  var schema = null;
  var cache = Object.create(null); // name -> loaded table
  var state = X.parseState(location.search);
  var table = null;
  var view = [];
  var summaryCol = "";

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function isArabic(v) { return typeof v === "string" && /[؀-ۿ]/.test(v); }
  function status(msg) { $("exStatus").textContent = msg; }
  function fmt(x) {
    return typeof x === "number" ? (Math.abs(x) >= 1000 || Number.isInteger(x) ? x.toLocaleString() : String(Math.round(x * 1e6) / 1e6)) : String(x);
  }

  function pushState() {
    var q = X.serializeState(state);
    try { history.replaceState(null, "", location.pathname + (q ? "?" + q : "")); } catch (e) { /* the view still works */ }
  }

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  function loadTable(name) {
    if (cache[name]) return Promise.resolve(cache[name]);
    var meta = schema.tables[name];
    return fetchText("data/exports/" + name + ".csv").then(function (text) {
      cache[name] = X.load(text, meta.fields);
      return cache[name];
    });
  }

  // ── rendering ────────────────────────────────────────────────────────
  function drawHeader() {
    var head = $("exHead");
    head.textContent = "";
    var tr = document.createElement("tr");
    var tf = document.createElement("tr");
    table.header.forEach(function (col, i) {
      var th = document.createElement("th");
      th.scope = "col";
      var b = el("button", col, "ex-sort");
      b.type = "button";
      var dir = state.sort === col ? state.dir : "";
      th.setAttribute("aria-sort", dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none");
      if (dir) b.textContent = col + (dir === "asc" ? " ▲" : " ▼");
      b.addEventListener("click", function () {
        if (state.sort === col) state.dir = state.dir === "asc" ? "desc" : "asc";
        else { state.sort = col; state.dir = table.types[i] === "string" ? "asc" : "desc"; }
        state.page = 1;
        drawHeader();
        refresh();
      });
      th.appendChild(b);
      tr.appendChild(th);

      var tc = document.createElement("th");
      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "ex-filter";
      inp.setAttribute("aria-label", "Filter " + col);
      inp.placeholder = table.types[i] === "integer" || table.types[i] === "number" ? ">=  <  =  a..b" : "contains";
      inp.value = state.filters[col] || "";
      var timer = null;
      inp.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (inp.value.trim() === "") delete state.filters[col];
          else state.filters[col] = inp.value;
          state.page = 1;
          refresh();
        }, 200);
      });
      tc.appendChild(inp);
      tf.appendChild(tc);
    });
    head.appendChild(tr);
    head.appendChild(tf);
  }

  function drawBody(pg) {
    var body = $("exBody");
    body.textContent = "";
    pg.rows.forEach(function (row) {
      var tr = document.createElement("tr");
      row.forEach(function (v) {
        var td = document.createElement("td");
        if (v == null) { td.textContent = "–"; td.className = "ex-missing"; td.title = "not available"; }
        else {
          td.textContent = typeof v === "number" ? fmt(v) : v;
          if (isArabic(v)) { td.setAttribute("lang", "ar"); td.setAttribute("dir", "rtl"); }
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function drawChart() {
    var host = $("exChart");
    host.textContent = "";
    $("exChartNote").hidden = true;
    var sum = $("exSummary");
    sum.textContent = "";
    if (!table || !summaryCol) { sum.textContent = "Pick a column above."; return; }
    var s = X.summarize(table, view, summaryCol);
    var lines = [s.column + " · " + s.type + " · " + s.rows.toLocaleString() + " rows in view, " + s.missing.toLocaleString() + " with no value"];
    if (s.type === "integer" || s.type === "number") {
      if (s.n) lines.push("min " + fmt(s.min) + " · median " + fmt(s.median) + " · mean " + fmt(s.mean) + " · max " + fmt(s.max));
    } else {
      lines.push(s.distinct.toLocaleString() + " distinct values" + (s.top.length ? "; most common: " + s.top.map(function (t) { return t.value + " (" + t.count + ")"; }).join(", ") : ""));
    }
    lines.forEach(function (l) { sum.appendChild(el("div", l)); });
    if (s.type !== "integer" && s.type !== "number") return;
    var bins = X.histogram(table, view, summaryCol, 20);
    if (!bins.length) return;
    var W = 560, H = 170, padL = 36, padB = 24, padT = 8;
    var max = Math.max.apply(null, bins.map(function (b) { return b.count; }));
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Histogram of " + summaryCol + ": " + bins.length + " bars, largest bar " + max + " rows");
    svg.setAttribute("class", "ex-hist");
    var bw = (W - padL - 8) / bins.length;
    bins.forEach(function (b, i) {
      var h = max ? (b.count / max) * (H - padB - padT) : 0;
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", String(padL + i * bw + 1));
      r.setAttribute("y", String(H - padB - h));
      r.setAttribute("width", String(Math.max(1, bw - 2)));
      r.setAttribute("height", String(h));
      r.setAttribute("fill", "var(--chart-1)");
      var t = document.createElementNS(NS, "title");
      t.textContent = (b.from === b.to ? fmt(b.from) : fmt(b.from) + " to " + fmt(b.to)) + ": " + b.count.toLocaleString() + " rows";
      r.appendChild(t);
      svg.appendChild(r);
    });
    [[padL, fmt(bins[0].from), "start"], [W - 8, fmt(bins[bins.length - 1].to), "end"]].forEach(function (a) {
      var tx = document.createElementNS(NS, "text");
      tx.setAttribute("x", String(a[0]));
      tx.setAttribute("y", String(H - 6));
      tx.setAttribute("text-anchor", a[2]);
      tx.setAttribute("class", "ex-axis");
      tx.textContent = a[1];
      svg.appendChild(tx);
    });
    var my = document.createElementNS(NS, "text");
    my.setAttribute("x", "2");
    my.setAttribute("y", String(padT + 8));
    my.setAttribute("class", "ex-axis");
    my.textContent = max.toLocaleString();
    svg.appendChild(my);
    host.appendChild(svg);
    if (window.qdDownloadSvg) {
      var dl = el("button", "Download chart (SVG)", "button secondary");
      dl.type = "button";
      dl.addEventListener("click", function () { window.qdDownloadSvg(svg, state.table + "-" + summaryCol + "-histogram.svg"); });
      host.appendChild(dl);
    }
    $("exChartNote").hidden = false;
  }

  function refresh() {
    if (!table) return;
    var f = X.filterRows(table, state.filters);
    var rows = f.rows;
    if (state.sort) rows = X.sortRows(table, rows, state.sort, state.dir);
    view = rows;
    var pg = X.pageOf(rows, state.page);
    state.page = pg.page;
    drawBody(pg);
    var total = table.rows.length;
    status(
      rows.length.toLocaleString() + " of " + total.toLocaleString() + " rows" +
      (f.bad.length ? " · could not read the filter on " + f.bad.join(", ") + " (ignored)" : "") + "."
    );
    $("exPage").textContent = "Page " + pg.page + " of " + pg.pages;
    $("exPrev").disabled = pg.page <= 1;
    $("exNext").disabled = pg.page >= pg.pages;
    $("exClear").hidden = !Object.keys(state.filters).length;
    $("exDownload").disabled = !rows.length;
    pushState();
    drawChart();
  }

  function showTable(name) {
    var meta = schema.tables[name];
    $("exDesc").textContent = meta.description || "";
    var links = $("exLinks");
    links.textContent = "";
    links.appendChild(document.createTextNode(meta.rowCount.toLocaleString() + " rows · " + meta.fields.length + " columns · download the whole table: "));
    ["csv", "json"].forEach(function (fmtName, i) {
      if (i) links.appendChild(document.createTextNode(" · "));
      var a = el("a", fmtName.toUpperCase());
      a.href = "data/exports/" + name + "." + fmtName;
      a.setAttribute("download", "");
      links.appendChild(a);
    });
    status("Loading " + name + "…");
    loadTable(name).then(function (t) {
      if (state.table !== name) return;
      table = t;
      var sel = $("exCol");
      sel.textContent = "";
      sel.appendChild(el("option", "Choose…")).value = "";
      t.header.forEach(function (h) { var o = el("option", h); o.value = h; sel.appendChild(o); });
      sel.disabled = false;
      if (summaryCol && t.header.indexOf(summaryCol) < 0) summaryCol = "";
      sel.value = summaryCol;
      drawHeader();
      refresh();
    }).catch(function (e) {
      status("Could not load " + name + " (" + e.message + "). The file is on Export.");
    });
  }

  function chooseTable(name) {
    state.table = name;
    state.sort = "";
    state.dir = "asc";
    state.filters = {};
    state.page = 1;
    summaryCol = "";
    table = null;
    $("exHead").textContent = "";
    $("exBody").textContent = "";
    $("exCol").textContent = "";
    $("exCol").disabled = true;
    drawChart();
    if (!name) { status("Choose a table to begin."); $("exDesc").textContent = ""; $("exLinks").textContent = ""; pushState(); return; }
    pushState();
    showTable(name);
  }

  function downloadFiltered() {
    if (!table) return;
    var rows = view.map(function (r) { return r.map(function (v) { return v == null ? "" : v; }); });
    var blob = new Blob([X.toCsv(table.header, rows)], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.table + "-filtered.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function init() {
    fetchText("data/exports/schema.json").then(function (t) {
      schema = JSON.parse(t);
      var sel = $("exTable");
      sel.textContent = "";
      var o0 = el("option", "Choose a table…");
      o0.value = "";
      sel.appendChild(o0);
      Object.keys(schema.tables).forEach(function (name) {
        var m = schema.tables[name];
        var o = el("option", name + " (" + m.rowCount.toLocaleString() + " rows)");
        o.value = name;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { chooseTable(sel.value); });
      $("exCol").addEventListener("change", function () { summaryCol = $("exCol").value; drawChart(); });
      $("exPrev").addEventListener("click", function () { state.page--; refresh(); });
      $("exNext").addEventListener("click", function () { state.page++; refresh(); });
      $("exClear").addEventListener("click", function () { state.filters = {}; state.page = 1; drawHeader(); refresh(); });
      $("exDownload").addEventListener("click", downloadFiltered);
      if (state.table && schema.tables[state.table]) {
        var keep = { sort: state.sort, dir: state.dir, filters: state.filters, page: state.page };
        sel.value = state.table;
        showTable(state.table);
        state.sort = keep.sort; state.dir = keep.dir; state.filters = keep.filters; state.page = keep.page;
      } else {
        state = X.parseState("");
        status("Choose a table to begin.");
      }
    }).catch(function (e) {
      status("Could not load the table list (" + e.message + "). The tables are on Export.");
    });
  }

  init();
})();
