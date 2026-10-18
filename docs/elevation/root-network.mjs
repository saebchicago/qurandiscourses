// root-network.mjs — SKELETON for an interactive-but-exportable root network.
//
// Stack decision (see docs/ELEVATION-PLAN.md §3): no React. The site is
// static HTML with vanilla modules and a strict CSP; a framework would add a
// build step, a bundle and a CSP surface for no analytical gain. Instead:
//
//   1. LAYOUT is computed offline, in Node, deterministically, and shipped as
//      data (as data/network/*.json already is). The browser never runs a
//      physics simulation, so the picture is identical for every reader and
//      every re-run, and the export IS the picture.
//   2. RENDERING is a pure function from layout JSON to an SVG string. It
//      touches no DOM, so the same code produces the page figure, a
//      downloadable .svg, and a build-time static fallback for no-JS readers.
//   3. INTERACTION is a thin progressive-enhancement layer (hover/focus
//      highlight, keyboard traversal) added to that SVG by assets/*.js; it
//      is not in this file.
//
// This file ships (a) `forceLayout`, a seeded force-directed layout for graphs
// larger than the 25-partner radial ego networks, and (b) `networkToSvg`.
// Both are verified: determinism (identical bytes on re-run), bounds, and
// rendering of a real data/network/*.json file.

/** mulberry32: tiny seeded PRNG so "random" initial positions are reproducible. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Deterministic force-directed layout.
 * nodes: [{id}], edges: [{a, b, w}] (w > 0, larger = closer).
 * Fixed iteration count, fixed cooling, seeded start, nodes processed in
 * sorted-id order, coordinates rounded to 2 places: same input, same bytes.
 */
export function forceLayout(nodes, edges, { width = 800, height = 600, seed = 1, iterations = 300 } = {}) {
  const ids = nodes.map((n) => n.id).sort();
  const rnd = mulberry32(seed);
  const pos = new Map(ids.map((id) => [id, { x: rnd() * width, y: rnd() * height, dx: 0, dy: 0 }]));
  const k = Math.sqrt((width * height) / Math.max(1, ids.length)) * 0.8;
  const ordered = [...edges].sort((p, q) => (p.a + "\0" + p.b < q.a + "\0" + q.b ? -1 : 1));
  for (let it = 0; it < iterations; it++) {
    const temp = (1 - it / iterations) * (Math.min(width, height) / 10);
    for (const id of ids) { const p = pos.get(id); p.dx = 0; p.dy = 0; }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const p = pos.get(ids[i]), q = pos.get(ids[j]);
        let dx = p.x - q.x, dy = p.y - q.y;
        let d = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / d;
        dx /= d; dy /= d;
        p.dx += dx * f; p.dy += dy * f; q.dx -= dx * f; q.dy -= dy * f;
      }
    }
    for (const e of ordered) {
      const p = pos.get(e.a), q = pos.get(e.b);
      if (!p || !q) continue;
      let dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = ((d * d) / k) * Math.min(1, e.w);
      dx /= d; dy /= d;
      p.dx -= dx * f; p.dy -= dy * f; q.dx += dx * f; q.dy += dy * f;
    }
    for (const id of ids) {
      const p = pos.get(id);
      const d = Math.hypot(p.dx, p.dy) || 0.01;
      const step = Math.min(d, temp);
      p.x = Math.min(width - 20, Math.max(20, p.x + (p.dx / d) * step));
      p.y = Math.min(height - 20, Math.max(20, p.y + (p.dy / d) * step));
    }
  }
  return ids.map((id) => ({ id, x: r2(pos.get(id).x), y: r2(pos.get(id).y) }));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Render a data/network/<root>.json-shaped layout to an SVG string.
 * Pure: same input, same bytes. No scripts, no external references, so it is
 * valid under the site's strict CSP and safe to offer as a download.
 */
export function networkToSvg(layout, { title } = {}) {
  const [, , w, h] = layout.viewBox.split(" ").map(Number);
  const c = layout.center;
  const heading = title || `Root ${layout.rootLatin}: strongest verse-level partners by log-likelihood`;
  const edges = layout.nodes
    .map((n) => `<line x1="${c.x}" y1="${c.y}" x2="${n.x}" y2="${n.y}" stroke="currentColor" stroke-opacity="0.25"/>`)
    .join("");
  const nodes = layout.nodes
    .map(
      (n) =>
        `<g><circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="currentColor" fill-opacity="0.15" stroke="currentColor"><title>${esc(n.rootLatin)}: ${n.k11} shared verses, LLR ${n.llr}</title></circle>` +
        `<text x="${n.x}" y="${r2(n.y + n.r + 11)}" font-size="10" text-anchor="middle">${esc(n.rootLatin)}</text></g>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d">` +
    `<title id="t">${esc(heading)}</title>` +
    `<desc id="d">${layout.nodes.length} partner roots around ${esc(layout.rootLatin)}; position encodes rank by log-likelihood, not meaning.</desc>` +
    edges +
    `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="currentColor"/>` +
    `<text x="${c.x}" y="${r2(c.y + c.r + 12)}" font-size="12" font-weight="600" text-anchor="middle">${esc(layout.rootLatin)}</text>` +
    nodes +
    `</svg>`
  );
}
