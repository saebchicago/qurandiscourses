// page-headings.mjs — the headings of an authored page, located by offset.
//
// WHY THIS IS NOT A REGEX. Two hazards this repo has already been bitten
// by, both recorded rather than rediscovered:
//
//   1. Inline <script> bodies contain bare ">" (and "<") characters, so
//      splitting a page into tags with a regex silently mis-parses every
//      page carrying one. numbers.html bound zero figures the first time
//      check-data-nums tried it (#114). Script and style ranges are
//      therefore computed FIRST and every tag inside them is discarded.
//   2. A non-greedy /<div ...>[\s\S]*?<\/div>/ stops at the first
//      closing tag, not the matching one, so a nested container is
//      under-removed. Ranges here are found by counting depth.
//
// Offsets are returned rather than substrings because the caller writes
// ids back into the page and must splice from the end.

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// Ranges [start, end) of every <script>/<style> element, tags included.
export function maskedRanges(text) {
  const out = [];
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  let m;
  while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
  return out;
}

const inAny = (ranges, i) => ranges.some(([a, b]) => i >= a && i < b);

// Every tag in the document that is not inside a masked range.
// The attribute pattern skips quoted values so a ">" inside one does not
// end the tag.
function tags(text, masked) {
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    if (inAny(masked, m.index)) continue;
    out.push({
      close: m[1] === "/",
      name: m[2].toLowerCase(),
      attrs: m[3] || "",
      start: m.index,
      end: m.index + m[0].length,
      self: /\/\s*$/.test(m[3] || "") || VOID.has(m[2].toLowerCase()),
    });
  }
  return out;
}

// The [start, end) of the element opened by tags[i], counting depth over
// same-named tags. end is the index after the closing tag.
function elementRange(list, i) {
  const open = list[i];
  if (open.self) return [open.start, open.end];
  let depth = 1;
  for (let j = i + 1; j < list.length; j++) {
    if (list[j].name !== open.name || list[j].self) continue;
    depth += list[j].close ? -1 : 1;
    if (depth === 0) return [open.start, list[j].end];
  }
  return [open.start, list.length ? list[list.length - 1].end : open.end];
}

// scanHeadings(text, {skipAttrs}) -> the h2/h3 elements inside <main>
// that are not inside a skipped container.
//
// skipAttrs is a list of bare attribute names (e.g. "data-case-studies").
// An element carrying one is a region the page's JavaScript replaces at
// runtime, so its authored headings are a fallback that will not exist
// in the rendered DOM. A table of contents must never point into one.
export function scanHeadings(text, opts = {}) {
  const skipAttrs = opts.skipAttrs || [];
  const masked = maskedRanges(text);
  const list = tags(text, masked);

  const mainAt = list.findIndex((t) => !t.close && t.name === "main");
  if (mainAt === -1) return [];
  const [mainStart, mainEnd] = elementRange(list, mainAt);

  const skipped = [];
  list.forEach((t, i) => {
    if (t.close) return;
    if (!skipAttrs.some((a) => new RegExp(`\\s${a}(=|\\s|$)`).test(t.attrs))) return;
    skipped.push(elementRange(list, i));
  });

  // The depth gate an element inherits, tracked with an open-element
  // stack in document order. A section marked .encyclopedic-only is
  // display:none until the reader raises their depth level, so an entry
  // pointing at it must be hidden exactly when the section is — measured
  // rather than assumed: at the default "simple" depth, 9 of
  // numbers.html's 22 headings and 5 of patterns.html's 8 are not
  // displayed, and a list entry for one of them scrolls nowhere.
  const stack = [];
  const gateOf = (attrs) => {
    const cls = /\sclass="([^"]*)"/.exec(attrs);
    if (!cls) return null;
    if (/\bencyclopedic-only\b/.test(cls[1])) return "encyclopedic-only";
    if (/\bstudy-only\b/.test(cls[1])) return "study-only";
    return null;
  };

  const heads = [];
  list.forEach((t, i) => {
    if (t.close) {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name === t.name) {
          stack.length = k;
          break;
        }
      }
      return;
    }
    if (!t.self) stack.push({ name: t.name, gate: gateOf(t.attrs) });
    if (t.name !== "h2" && t.name !== "h3") return;
    if (t.start < mainStart || t.start >= mainEnd) return;
    if (inAny(skipped, t.start)) return;
    const [s, e] = elementRange(list, i);
    const idMatch = /\sid="([^"]*)"/.exec(t.attrs);
    // Nearest gate wins: encyclopedic inside study is still encyclopedic.
    let gate = null;
    for (let k = stack.length - 1; k >= 0; k--)
      if (stack[k].gate) {
        gate = stack[k].gate;
        break;
      }
    heads.push({
      level: t.name,
      id: idMatch ? idMatch[1] : null,
      gate,
      // Where an id would be inserted: just after the tag name.
      insertAt: t.start + 1 + t.name.length,
      openEnd: t.end,
      inner: text.slice(t.end, e - (t.name.length + 3)),
      start: s,
      end: e,
    });
  });
  return heads;
}

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", sect: "§",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

// The reader-visible text of a heading, with the provenance badge
// removed. Badges are inline marks (● ~ ○) that belong to the claim, not
// to the section's name; validation.html puts one before the title and
// numbers.html after it, so neither position can be assumed.
export function headingLabel(inner) {
  return inner
    .replace(/<span[^>]*\sclass="[^"]*\bbadge\b[^"]*"[^>]*>[\s\S]*?<\/span\s*>/g, " ")
    .replace(/<a[^>]*\sclass="[^"]*\bclaim-anchor\b[^"]*"[^>]*>[\s\S]*?<\/a\s*>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENTITIES ? ENTITIES[n] : m))
    .replace(/\s+/g, " ")
    .replace(/^[\s·–—-]+|[\s·–—-]+$/g, "")
    .trim();
}

// A url fragment from a heading's text. Marks are stripped rather than
// transliterated, so "fawāṣil" and "fawasil" give the same slug.
export function slugify(label) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['‘’ʿʾ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
