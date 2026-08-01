(function () {
  "use strict";

  // Shared low-level SVG helpers (window.qdViz). Zero dependencies:
  // hand-rolled via document.createElementNS, no D3, no charting library,
  // no vendored assets. Complements assets/chart.js (window.qdChart, the
  // site's existing higher-level chart renderers for co-occurrence
  // networks, revelation timelines, heat strips, and scatter plots) with
  // the lower-level primitives the association-statistics visualizations
  // need: a scale function, axis rendering, a keyboard-accessible
  // tooltip, an HTML table fallback, and a fetch-with-degrade wrapper.
  //
  // Colors are never hardcoded: every fill/stroke either embeds a
  // var(--custom-property) string directly (so a theme switch repaints
  // with no re-render, exactly like assets/chart.js) or, where an actual
  // computed value is needed (building a gradient legend), reads it at
  // call time via getComputedStyle so it always reflects the active
  // theme/palette.

  var NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) {
      if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  // ── SVG root ────────────────────────────────────────────────────────
  // createSVG({viewBox, width, height, ariaLabel, className}) -> <svg>
  // Every chart's root element: responsive (width 100%, intrinsic aspect
  // ratio from viewBox), role="img" with a descriptive aria-label.
  function createSVG(opts) {
    opts = opts || {};
    var svg = svgEl("svg", {
      viewBox: opts.viewBox,
      width: "100%",
      role: "img",
      "aria-label": opts.ariaLabel || "Chart",
    });
    if (opts.height) svg.style.height = opts.height;
    if (opts.maxWidth) svg.style.maxWidth = opts.maxWidth;
    if (opts.className) svg.setAttribute("class", opts.className);
    return svg;
  }

  // ── Scale ───────────────────────────────────────────────────────────
  // scaleLinear([d0, d1], [r0, r1]) -> fn(value) mapping domain to range,
  // clamped to the range. fn.invert(v) maps range back to domain.
  function scaleLinear(domain, range) {
    var d0 = domain[0],
      d1 = domain[1],
      r0 = range[0],
      r1 = range[1];
    var dSpan = d1 - d0 || 1;
    var rSpan = r1 - r0;
    function fn(v) {
      var t = (v - d0) / dSpan;
      t = Math.max(0, Math.min(1, t));
      return r0 + t * rSpan;
    }
    fn.invert = function (v) {
      var t = (v - r0) / (rSpan || 1);
      return d0 + t * dSpan;
    };
    fn.domain = domain;
    fn.range = range;
    return fn;
  }

  // ── Axis ────────────────────────────────────────────────────────────
  // renderAxis(svg, {orientation: 'x'|'y', scale, pos, ticks, format,
  //   label}) -> appends a recessive axis line + tick labels to svg.
  // pos: the pixel coordinate of the axis line along the cross-axis
  // (y position for an x-axis, x position for a y-axis).
  function renderAxis(svg, opts) {
    var scale = opts.scale;
    var ticks = opts.ticks || scale.domain;
    var format = opts.format || String;
    var isX = opts.orientation === "x";
    var line = isX
      ? svgEl("line", {
          x1: scale.range[0],
          y1: opts.pos,
          x2: scale.range[1],
          y2: opts.pos,
          stroke: "var(--line)",
          "stroke-width": 1,
        })
      : svgEl("line", {
          x1: opts.pos,
          y1: scale.range[0],
          x2: opts.pos,
          y2: scale.range[1],
          stroke: "var(--line)",
          "stroke-width": 1,
        });
    svg.appendChild(line);
    ticks.forEach(function (t) {
      var p = scale(t);
      var text;
      if (isX) {
        text = svgEl("text", {
          x: p,
          y: opts.pos + (opts.tickOffset || 14),
          "text-anchor": "middle",
          "font-size": 9,
          fill: "var(--muted)",
        });
      } else {
        text = svgEl("text", {
          x: opts.pos - (opts.tickOffset || 6),
          y: p + 3,
          "text-anchor": "end",
          "font-size": 9,
          fill: "var(--muted)",
        });
      }
      text.textContent = format(t);
      svg.appendChild(text);
    });
    if (opts.label) {
      var lbl = isX
        ? svgEl("text", {
            x: (scale.range[0] + scale.range[1]) / 2,
            y: opts.pos + (opts.labelOffset || 28),
            "text-anchor": "middle",
            "font-size": 10,
            fill: "var(--muted)",
          })
        : svgEl("text", {
            x: -(scale.range[0] + scale.range[1]) / 2,
            y: opts.pos - (opts.labelOffset || 32),
            "text-anchor": "middle",
            "font-size": 10,
            fill: "var(--muted)",
            transform: "rotate(-90)",
          });
      lbl.textContent = opts.label;
      svg.appendChild(lbl);
    }
  }

  // ── Tooltip: shared floating element, hover AND keyboard focus ──────
  var tipEl = null;
  function tip() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "qd-chart-tip";
      tipEl.setAttribute("role", "status");
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function showTip(text, x, y) {
    var t = tip();
    t.textContent = text;
    t.hidden = false;
    var pad = 12;
    t.style.left = Math.min(x + pad, window.innerWidth - 180) + "px";
    t.style.top = y + window.scrollY + pad + "px";
  }
  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  // attachTooltip(el, textFn, opts) - el must be keyboard-reachable
  // (tabindex="0" is set here unless the element already declares one)
  // so Tab, not just mouse hover, exposes the same content. Escape
  // dismisses; blur/mouseleave dismiss too.
  function attachTooltip(el, textFn, opts) {
    opts = opts || {};
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    if (!el.hasAttribute("role") && opts.role) el.setAttribute("role", opts.role);
    el.addEventListener("mousemove", function (e) {
      showTip(textFn(), e.clientX, e.clientY);
    });
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", function () {
      var r = el.getBoundingClientRect();
      showTip(textFn(), r.left + r.width / 2, r.bottom);
    });
    el.addEventListener("blur", hideTip);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideTip();
    });
  }

  // ── CSS custom property reader ───────────────────────────────────────
  // cssVar('--accent') -> the current computed value (e.g. "#7a5a2b"),
  // read fresh on every call so it always reflects the active
  // theme/palette. Use for cases that need an actual value (a gradient
  // stop, a color computed in JS); plain SVG attributes should instead
  // embed the var(--x) string directly so the browser repaints on theme
  // change with no re-render.
  function cssVar(name, el) {
    return getComputedStyle(el || document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  // ── Disclaimer (verbatim, required beneath every chart) ─────────────
  var DISCLAIMER =
    "This chart visualizes the distribution of words in the text. " +
    "Position, distance, and color indicate statistical measures only. " +
    "They do not indicate thematic, exegetical, or theological " +
    "relationships.";
  function renderDisclaimer(container) {
    var p = document.createElement("p");
    p.className = "chart-disclaimer";
    p.textContent = DISCLAIMER;
    container.appendChild(p);
    return p;
  }

  // ── Table fallback ───────────────────────────────────────────────────
  // renderTableFallback(container, {caption, columns: [{key,label}],
  // rows: [{...}]}) -> a <table class="data"> with the same data the
  // chart renders, for the <details> element every chart carries and
  // for the no-JS / fetch-failed degrade path.
  function renderTableFallback(container, opts) {
    container.innerHTML = "";
    var table = document.createElement("table");
    table.className = "data";
    if (opts.caption) {
      var cap = document.createElement("caption");
      cap.textContent = opts.caption;
      cap.style.textAlign = "left";
      cap.style.fontSize = "0.8rem";
      cap.style.color = "var(--muted)";
      cap.style.marginBottom = "0.3rem";
      table.appendChild(cap);
    }
    var thead = document.createElement("thead");
    var htr = document.createElement("tr");
    opts.columns.forEach(function (c) {
      var th = document.createElement("th");
      if (c.numeric) th.className = "count";
      th.textContent = c.label;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    (opts.rows || []).forEach(function (row) {
      var tr = document.createElement("tr");
      opts.columns.forEach(function (c) {
        var td = document.createElement("td");
        if (c.numeric) td.className = "count";
        var v = row[c.key];
        td.textContent = v == null ? "" : String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    return table;
  }

  // renderDetailsFallback(parent, {summary, caption, columns, rows}) ->
  // a <details class="xref-panel"> wrapping renderTableFallback, the
  // standard collapsible-table shape every chart on this site uses.
  function renderDetailsFallback(parent, opts) {
    var details = document.createElement("details");
    details.className = "xref-panel chart-fallback";
    var summary = document.createElement("summary");
    summary.textContent = opts.summary || "View as table";
    details.appendChild(summary);
    var body = document.createElement("div");
    details.appendChild(body);
    renderTableFallback(body, opts);
    parent.appendChild(details);
    return details;
  }

  // ── Fetch-and-render with graceful degrade ───────────────────────────
  // renderChart({container, url, ariaLabel, buildSvg(data), tableOf(data)
  //   -> {caption, columns, rows}, fallbackSummary}) fetches url; on
  // success calls buildSvg(data) to get an <svg>, appends it, the
  // disclaimer, and the <details> table fallback (same data). On any
  // fetch/parse failure, or if buildSvg returns nothing (e.g. no data
  // for this entity), renders ONLY the table fallback plus disclaimer -
  // the chart degrades, the underlying numbers stay visible.
  function renderChart(opts) {
    var container = opts.container;
    container.innerHTML = "";
    return fetch(opts.url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var svg = opts.buildSvg(data);
        if (svg) container.appendChild(svg);
        if (opts.legend) container.appendChild(opts.legend(data));
        renderDisclaimer(container);
        var t = opts.tableOf(data);
        renderDetailsFallback(container, {
          summary: opts.fallbackSummary || "View as table",
          caption: t.caption,
          columns: t.columns,
          rows: t.rows,
        });
        return data;
      })
      .catch(function (err) {
        container.innerHTML = "";
        var note = document.createElement("p");
        note.className = "chart-fallback-note";
        note.textContent =
          "Chart unavailable (" + err.message + "). Showing the same data as a table.";
        container.appendChild(note);
        renderDisclaimer(container);
        if (opts.tableOnError) {
          var t2 = opts.tableOnError();
          var tableHost = document.createElement("div");
          container.appendChild(tableHost);
          renderTableFallback(tableHost, t2);
        }
        return null;
      });
  }

  window.qdViz = {
    createSVG: createSVG,
    scaleLinear: scaleLinear,
    renderAxis: renderAxis,
    attachTooltip: attachTooltip,
    hideTooltip: hideTip,
    cssVar: cssVar,
    renderDisclaimer: renderDisclaimer,
    DISCLAIMER: DISCLAIMER,
    renderTableFallback: renderTableFallback,
    renderDetailsFallback: renderDetailsFallback,
    renderChart: renderChart,
    svgEl: svgEl,
  };
})();
