(function () {
  "use strict";

  // Shared low-level SVG helpers (window.qdViz). Zero dependencies.

  var NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) {
      if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

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
      return d0 + t * rSpan;
    };
    fn.domain = domain;
    fn.range = range;
    return fn;
  }

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

  var tipEl = null;
  function tip() {
    if (!tipEl) tipEl = document.querySelector(".qd-chart-tip");
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
  function attachDelegatedTooltip(container, match, textFn) {
    var current = null;
    container.addEventListener("mousemove", function (e) {
      var el = e.target;
      if (!el || !match(el)) {
        if (current) {
          current = null;
          hideTip();
        }
        return;
      }
      current = el;
      showTip(textFn(el), e.clientX, e.clientY);
    });
    container.addEventListener("mouseleave", function () {
      current = null;
      hideTip();
    });
    container.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideTip();
    });
  }
  function cssVar(name, el) {
    return getComputedStyle(el || document.documentElement)
      .getPropertyValue(name)
      .trim();
  }
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
  function renderDetailsFallback(parent, opts) {
    var details = document.createElement("details");
    details.className = "chart-fallback";
    var summary = document.createElement("summary");
    summary.textContent = opts.summary || "View as table";
    details.appendChild(summary);
    var body = document.createElement("div");
    details.appendChild(body);
    renderTableFallback(body, opts);
    parent.appendChild(details);
    return details;
  }
  function renderChart(opts) {
    var container = opts.container;
    container.innerHTML = "";
    var source =
      opts.url != null
        ? fetch(opts.url).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
        : Promise.resolve(opts.data);
    return source
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

  function renderPositionStrip(container, opts) {
    opts = opts || {};
    if (!container) return;
    container.innerHTML = "";
    var families = (opts.families || []).slice(0, 8);
    var verseCount = opts.verseCount || 0;
    if (!families.length || verseCount < 1) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var rowH = 18;
    var labelW = 72;
    var padL = labelW + 8;
    var padR = 8;
    var padT = 6;
    var padB = 18;
    var width = Math.max(280, Math.min(720, 24 + verseCount * 10));
    var innerW = width - padL - padR;
    var height = padT + families.length * rowH + padB;
    var x = scaleLinear([1, verseCount + 1], [padL, padL + innerW]);
    var colW = Math.max(2, innerW / verseCount - 1);
    var svg = createSVG({
      viewBox: "0 0 " + width + " " + height,
      ariaLabel: opts.ariaLabel || "Recurring root positions by verse",
    });
    var cur = opts.currentVerse;
    if (cur >= 1 && cur <= verseCount) {
      svg.appendChild(
        svgEl("rect", {
          x: x(cur),
          y: padT - 2,
          width: Math.max(colW, 3),
          height: families.length * rowH + 4,
          fill: "var(--accent)",
          opacity: "0.18",
        })
      );
    }
    families.forEach(function (fam, i) {
      var y = padT + i * rowH;
      var label = svgEl("text", {
        x: labelW - 6,
        y: y + 12,
        "text-anchor": "end",
        "font-size": 9,
        fill: "var(--muted)",
      });
      label.textContent = (fam.label || fam.root || "").slice(0, 12);
      svg.appendChild(label);
      var present = {};
      (fam.verses || []).forEach(function (v) {
        present[v] = true;
      });
      for (var v = 1; v <= verseCount; v++) {
        if (!present[v]) continue;
        var mark = svgEl("rect", {
          x: x(v),
          y: y + 4,
          width: Math.max(colW, 3),
          height: 10,
          rx: 1,
          fill: "var(--accent)",
          opacity: cur && v > cur ? "0.28" : "0.85",
        });
        mark.setAttribute("tabindex", "0");
        mark.setAttribute("aria-label", (fam.label || fam.root) + " in verse " + v);
        (function (verse) {
          attachTooltip(mark, function () {
            return (fam.label || fam.root) + " · verse " + verse;
          });
          if (typeof opts.onVerseClick === "function") {
            mark.style.cursor = "pointer";
            mark.addEventListener("click", function () {
              opts.onVerseClick(verse);
            });
            mark.addEventListener("keydown", function (e) {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                opts.onVerseClick(verse);
              }
            });
          }
        })(v);
        svg.appendChild(mark);
      }
    });
    var axisLabel = svgEl("text", {
      x: padL,
      y: height - 4,
      "font-size": 9,
      fill: "var(--muted)",
    });
    axisLabel.textContent = "verse 1 → " + verseCount;
    svg.appendChild(axisLabel);
    container.appendChild(svg);
  }

  window.qdViz = {
    createSVG: createSVG,
    scaleLinear: scaleLinear,
    renderAxis: renderAxis,
    attachTooltip: attachTooltip,
    attachDelegatedTooltip: attachDelegatedTooltip,
    hideTooltip: hideTip,
    cssVar: cssVar,
    renderDisclaimer: renderDisclaimer,
    DISCLAIMER: DISCLAIMER,
    renderTableFallback: renderTableFallback,
    renderDetailsFallback: renderDetailsFallback,
    renderChart: renderChart,
    svgEl: svgEl,
    renderPositionStrip: renderPositionStrip,
  };
})();
