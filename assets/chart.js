(function () {
  "use strict";

  // Shared chart helpers (window.qdChart). Vanilla SVG, no dependencies,
  // theme-aware through CSS custom properties (--chart-1..4 categorical,
  // color-mix on --accent for sequential). Every chart: recessive axes,
  // thin marks with surface gaps, hover tooltip, ARIA labels, and an
  // optional "Download SVG" affordance via window.qdDownloadSvg.
  //
  // Editorial rule carried from the rest of the site: a chart is a claim.
  // Callers must place a method/provenance note next to any chart, and
  // distribution never by itself establishes meaning.

  var NS = "http://www.w3.org/2000/svg";

  // Chronology period → categorical token + label, fixed order (an
  // entity's color never depends on what else is displayed).
  var PERIODS = [
    { key: "meccan-early", label: "Early Meccan", token: "var(--chart-1)" },
    { key: "meccan-middle", label: "Middle Meccan", token: "var(--chart-2)" },
    { key: "meccan-late", label: "Late Meccan", token: "var(--chart-3)" },
    { key: "medinan", label: "Medinan", token: "var(--chart-4)" },
  ];
  function periodToken(key) {
    var p = PERIODS.find(function (x) {
      return x.key === key;
    });
    return p ? p.token : "var(--muted)";
  }
  function periodLabel(key) {
    var p = PERIODS.find(function (x) {
      return x.key === key;
    });
    return p ? p.label : key || "Unclassified";
  }

  // ── Shared tooltip ─────────────────────────────────────────────────
  // One .qd-chart-tip element is shared with js/viz.js (both modules
  // look up an existing element before creating one), so dismissing a
  // tooltip from either layer clears the only tooltip on screen.
  var tipEl = null;
  function tip() {
    if (!tipEl) {
      tipEl = document.querySelector(".qd-chart-tip");
    }
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
  function bindTip(el, textFn) {
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

  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function legend(entries) {
    var div = document.createElement("div");
    div.className = "qd-chart-legend";
    entries.forEach(function (e) {
      var item = document.createElement("span");
      item.className = "qd-chart-legend-item";
      var chip = document.createElement("span");
      chip.className = "qd-chart-legend-chip";
      chip.style.background = e.token;
      item.appendChild(chip);
      item.appendChild(document.createTextNode(e.label));
      div.appendChild(item);
    });
    return div;
  }

  function downloadRow(svg, filename) {
    var row = document.createElement("div");
    row.className = "share-row";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button secondary share-btn";
    btn.textContent = "Download chart image (SVG)";
    btn.addEventListener("click", function () {
      if (window.qdDownloadSvg) window.qdDownloadSvg(svg, filename);
    });
    row.appendChild(btn);
    return row;
  }

  // ── Revelation-order timeline ──────────────────────────────────────
  // points: [{ order, surah, name, count, period }] (order = revelation
  // order 1..114). One thin bar per surah in revelation order, colored
  // by period. Zero-count surahs render as a hairline baseline tick so
  // absence is visible but not shouted.
  function revTimeline(container, opts) {
    container.innerHTML = "";
    var points = opts.points.slice().sort(function (a, b) {
      return a.order - b.order;
    });
    var W = 660,
      H = 130,
      padL = 30,
      padB = 22,
      padT = 8;
    var plotW = W - padL - 6,
      plotH = H - padB - padT;
    var max = Math.max(1, opts.max || Math.max.apply(null, points.map(function (p) { return p.count; })));
    var bw = plotW / points.length;

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label":
        (opts.ariaLabel || "Occurrences by revelation order") +
        ": max " + max + " in one surah",
    });
    svg.style.maxWidth = W + "px";

    // y axis: baseline + max gridline only (recessive)
    svg.appendChild(svgEl("line", { x1: padL, y1: padT + plotH, x2: W - 6, y2: padT + plotH, stroke: "var(--line)", "stroke-width": 1 }));
    svg.appendChild(svgEl("line", { x1: padL, y1: padT, x2: W - 6, y2: padT, stroke: "var(--line)", "stroke-width": 0.5, "stroke-dasharray": "3 4" }));
    var maxLbl = svgEl("text", { x: padL - 4, y: padT + 4, "text-anchor": "end", "font-size": 9, fill: "var(--muted)" });
    maxLbl.textContent = max;
    svg.appendChild(maxLbl);
    var zeroLbl = svgEl("text", { x: padL - 4, y: padT + plotH + 3, "text-anchor": "end", "font-size": 9, fill: "var(--muted)" });
    zeroLbl.textContent = "0";
    svg.appendChild(zeroLbl);
    [1, 57, 114].forEach(function (o) {
      var t = svgEl("text", { x: padL + (o - 0.5) * bw, y: H - 8, "text-anchor": o === 1 ? "start" : o === 114 ? "end" : "middle", "font-size": 9, fill: "var(--muted)" });
      t.textContent = o === 1 ? "1st revealed" : o === 114 ? "114th" : "57th";
      svg.appendChild(t);
    });

    points.forEach(function (p, i) {
      var h = p.count > 0 ? Math.max(2, (p.count / max) * plotH) : 0;
      var x = padL + i * bw;
      var rect = svgEl("rect", {
        x: x + 0.25,
        y: padT + plotH - h,
        width: Math.max(0.8, bw - 0.5),
        height: Math.max(h, p.count > 0 ? 2 : 0.8),
        rx: h > 3 ? 1 : 0,
        fill: p.count > 0 ? periodToken(p.period) : "var(--line)",
        tabindex: "-1",
      });
      var label =
        "Surah " + p.surah + (p.name ? " (" + p.name + ")" : "") +
        " · revealed " + ordinal(p.order) + " · " + periodLabel(p.period) +
        " · " + p.count + " occurrence" + (p.count === 1 ? "" : "s");
      var t = svgEl("title", {});
      t.textContent = label;
      rect.appendChild(t);
      bindTip(rect, function () {
        return label;
      });
      if (opts.onSurahClick) {
        rect.style.cursor = "pointer";
        rect.addEventListener("click", function () {
          opts.onSurahClick(p.surah);
        });
      }
      svg.appendChild(rect);
    });

    container.appendChild(svg);
    container.appendChild(legend(PERIODS));
    if (opts.download !== false)
      container.appendChild(downloadRow(svg, opts.filename || "timeline.svg"));
  }

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ── Heat strip ─────────────────────────────────────────────────────
  // cells: [{ surah, name, count }] for all 114 surahs in mushaf order.
  // Sequential: one hue (accent) light→dark via color-mix; zero = surface
  // with a hairline border so absence reads as absence.
  function heatStrip(container, opts) {
    container.innerHTML = "";
    var cells = opts.cells;
    var max = Math.max(1, Math.max.apply(null, cells.map(function (c) { return c.count; })));
    var W = 660, H = 34, padT = 2, cellH = 18;
    var cw = W / cells.length;
    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label": (opts.ariaLabel || "Distribution across the 114 surahs") + " (darker = more occurrences, max " + max + ")",
    });
    svg.style.maxWidth = W + "px";
    cells.forEach(function (c, i) {
      // 4-step sequential ramp on the accent hue (monotonic light→dark).
      var pct = c.count === 0 ? 0 : 25 + Math.round((c.count / max) * 75);
      var rect = svgEl("rect", {
        x: i * cw + 0.3,
        y: padT,
        width: cw - 0.6,
        height: cellH,
        fill: c.count === 0 ? "var(--bg)" : "color-mix(in oklab, var(--accent) " + pct + "%, var(--bg))",
        stroke: c.count === 0 ? "var(--line)" : "none",
        "stroke-width": c.count === 0 ? 0.3 : 0,
      });
      var label = "Surah " + c.surah + (c.name ? " (" + c.name + ")" : "") + " · " + c.count + " occurrence" + (c.count === 1 ? "" : "s");
      var t = svgEl("title", {});
      t.textContent = label;
      rect.appendChild(t);
      bindTip(rect, function () { return label; });
      if (opts.onSurahClick) {
        rect.style.cursor = "pointer";
        rect.addEventListener("click", function () { opts.onSurahClick(c.surah); });
      }
      svg.appendChild(rect);
    });
    [1, 57, 114].forEach(function (s) {
      var t = svgEl("text", { x: (s - 0.5) * cw, y: H - 3, "text-anchor": s === 1 ? "start" : s === 114 ? "end" : "middle", "font-size": 9, fill: "var(--muted)" });
      t.textContent = "s." + s;
      svg.appendChild(t);
    });
    container.appendChild(svg);
    if (opts.download !== false)
      container.appendChild(downloadRow(svg, opts.filename || "distribution.svg"));
  }

  // ── Scatter ────────────────────────────────────────────────────────
  // points: [{ x, y, period, label, sublabel }], log-x supported with
  // labeled ticks. Color = chronology period (fixed categorical order).
  function scatter(container, opts) {
    container.innerHTML = "";
    var W = 660, H = 360, padL = 46, padB = 40, padT = 10, padR = 10;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var pts = opts.points;
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var xMin = opts.xLog ? Math.min.apply(null, xs) : 0;
    var xMax = Math.max.apply(null, xs);
    var yMin = 0, yMax = Math.max.apply(null, ys) * 1.06;

    function xPos(v) {
      if (opts.xLog) {
        var lo = Math.log10(xMin), hi = Math.log10(xMax);
        return padL + ((Math.log10(v) - lo) / (hi - lo)) * plotW;
      }
      return padL + ((v - xMin) / (xMax - xMin)) * plotW;
    }
    function yPos(v) {
      return padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    }

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label": opts.ariaLabel || "Scatter plot",
    });
    svg.style.maxWidth = W + "px";

    // frame + recessive grid
    svg.appendChild(svgEl("line", { x1: padL, y1: padT + plotH, x2: W - padR, y2: padT + plotH, stroke: "var(--line)", "stroke-width": 1 }));
    svg.appendChild(svgEl("line", { x1: padL, y1: padT, x2: padL, y2: padT + plotH, stroke: "var(--line)", "stroke-width": 1 }));

    (opts.xTicks || []).forEach(function (v) {
      var x = xPos(v);
      svg.appendChild(svgEl("line", { x1: x, y1: padT, x2: x, y2: padT + plotH, stroke: "var(--line)", "stroke-width": 0.4, "stroke-dasharray": "2 5" }));
      var t = svgEl("text", { x: x, y: padT + plotH + 14, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" });
      t.textContent = opts.xFormat ? opts.xFormat(v) : v;
      svg.appendChild(t);
    });
    (opts.yTicks || []).forEach(function (v) {
      var y = yPos(v);
      svg.appendChild(svgEl("line", { x1: padL, y1: y, x2: W - padR, y2: y, stroke: "var(--line)", "stroke-width": 0.4, "stroke-dasharray": "2 5" }));
      var t = svgEl("text", { x: padL - 5, y: y + 3, "text-anchor": "end", "font-size": 10, fill: "var(--muted)" });
      t.textContent = opts.yFormat ? opts.yFormat(v) : v;
      svg.appendChild(t);
    });

    var xl = svgEl("text", { x: padL + plotW / 2, y: H - 6, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" });
    xl.textContent = opts.xLabel || "";
    svg.appendChild(xl);
    var yl = svgEl("text", { x: 12, y: padT + plotH / 2, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)", transform: "rotate(-90 12 " + (padT + plotH / 2) + ")" });
    yl.textContent = opts.yLabel || "";
    svg.appendChild(yl);

    pts.forEach(function (p) {
      var c = svgEl("circle", {
        cx: xPos(p.x),
        cy: yPos(p.y),
        r: 4.5,
        fill: periodToken(p.period),
        stroke: "var(--card)",
        "stroke-width": 1,
        tabindex: "-1",
      });
      var label = p.label + (p.sublabel ? " · " + p.sublabel : "") + " · " + periodLabel(p.period);
      var t = svgEl("title", {});
      t.textContent = label;
      c.appendChild(t);
      bindTip(c, function () { return label; });
      if (opts.onPointClick) {
        c.style.cursor = "pointer";
        c.addEventListener("click", function () { opts.onPointClick(p); });
      }
      svg.appendChild(c);
    });

    container.appendChild(svg);
    container.appendChild(legend(PERIODS));
    if (opts.download !== false)
      container.appendChild(downloadRow(svg, opts.filename || "scatter.svg"));
  }

  // ── Ego network ────────────────────────────────────────────────────
  // Center root + its top co-occurring roots on a ring, deterministic
  // radial layout (strongest at 12 o'clock, clockwise by weight). Edge
  // width and node size encode co-occurrence count; identity is the
  // node's own label, so color stays single-hue.
  function egoNetwork(container, opts) {
    container.innerHTML = "";
    var nodes = opts.nodes.slice(0, opts.maxNodes || 12);
    if (!nodes.length) return;
    var W = 480, H = 380;
    var cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) / 2 - 58;
    var maxW = Math.max.apply(null, nodes.map(function (n) { return n.weight; }));

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label":
        opts.ariaLabel ||
        ("Co-occurrence network: " + opts.centerLabel + " with its " + nodes.length + " most frequent companion roots"),
    });
    svg.style.maxWidth = W + "px";

    nodes.forEach(function (n, i) {
      var angle = -Math.PI / 2 + (i / nodes.length) * 2 * Math.PI;
      n._x = cx + R * Math.cos(angle);
      n._y = cy + R * Math.sin(angle);
    });

    // edges under nodes
    nodes.forEach(function (n) {
      svg.appendChild(svgEl("line", {
        x1: cx, y1: cy, x2: n._x, y2: n._y,
        stroke: "var(--accent)",
        "stroke-opacity": 0.25 + 0.55 * (n.weight / maxW),
        "stroke-width": (0.8 + 3.2 * (n.weight / maxW)).toFixed(1),
      }));
    });

    // center node
    var center = svgEl("circle", { cx: cx, cy: cy, r: 26, fill: "var(--accent)", stroke: "var(--card)", "stroke-width": 2 });
    svg.appendChild(center);
    var cLbl = svgEl("text", { x: cx, y: cy + 4, "text-anchor": "middle", "font-size": 12, "font-weight": 600, fill: "var(--bg)" });
    cLbl.textContent = opts.centerLabel;
    svg.appendChild(cLbl);

    nodes.forEach(function (n) {
      var r = 8 + 10 * (n.weight / maxW);
      var g = svgEl("g", { tabindex: "-1" });
      var c = svgEl("circle", {
        cx: n._x, cy: n._y, r: r,
        fill: "color-mix(in oklab, var(--accent) " + Math.round(35 + 55 * (n.weight / maxW)) + "%, var(--bg))",
        stroke: "var(--card)", "stroke-width": 2,
      });
      var label = opts.tooltipFn
        ? opts.tooltipFn(n)
        : n.label + " · appears in " + n.weight + " shared verse" + (n.weight === 1 ? "" : "s") + " with " + opts.centerLabel;
      var t = svgEl("title", {});
      t.textContent = label;
      c.appendChild(t);
      g.appendChild(c);
      var outside = n._y < cy ? -(r + 6) : r + 14;
      var lbl = svgEl("text", { x: n._x, y: n._y + outside, "text-anchor": "middle", "font-size": 11, fill: "var(--ink)" });
      lbl.textContent = n.label;
      g.appendChild(lbl);
      bindTip(g, function () { return label; });
      if (n.href) {
        g.style.cursor = "pointer";
        g.addEventListener("click", function () { location.href = n.href; });
        g.setAttribute("role", "link");
        g.setAttribute("aria-label", label);
      }
      svg.appendChild(g);
    });

    container.appendChild(svg);
    if (opts.download !== false)
      container.appendChild(downloadRow(svg, opts.filename || "cooccurrence.svg"));
  }

  window.qdChart = {
    revTimeline: revTimeline,
    heatStrip: heatStrip,
    scatter: scatter,
    egoNetwork: egoNetwork,
    PERIODS: PERIODS,
  };
})();
