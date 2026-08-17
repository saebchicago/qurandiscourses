// build-page-toc.mjs — the "On this page" list, generated from the
// headings the page already has.
//
//   node scripts/build-page-toc.mjs           # rewrite
//   node scripts/build-page-toc.mjs --check   # exit 1 if stale
//
// WHY THIS EXISTS. validation.html runs about 18.5 screens at 375px and
// offers no map of itself; four other pages are close behind. The site
// already knows the answer — how-it-works.html hand-authors
// <nav class="page-toc"> and assets/style.css carries the rules for it,
// whose comment states the intent: "the point is that every section of a
// long method page is citable by URL." This generator applies that one
// page's convention to the pages long enough to need it, and holds it
// against the headings so the two cannot drift.
//
// IDS. An existing id is read and reused, NEVER rewritten. This is not a
// preference: how-it-works.html's nine ids are hand-chosen and short
// (#regenerated for "Where the numbers come from") and are linked from
// other pages — #cite alone is linked 34 times. Slugifying them would
// break every one of those links. Only a heading with no id gets a
// minted slug, and because the id is written into the page, a later
// prose edit that moves it shows up as an id="…" diff on the heading
// line in review rather than as a silent break.
//
// The page's own title heading is not an entry: it sits immediately
// above the list. That falls out of the rule that only headings AFTER
// the marker region are considered, which is also what how-it-works.html
// does by hand.
//
// DEPTH. numbers.html and patterns.html hide sections behind the
// reader's depth level, so an entry for one of them scrolls nowhere
// until the reader raises it — measured at the default "simple" depth,
// 9 of numbers.html's 22 headings and 5 of patterns.html's 8 are not
// displayed. Each entry therefore inherits its section's .study-only /
// .encyclopedic-only class, which assets/style.css already applies to
// list items (`li.study-only` at :1767). No new CSS, no runtime
// measurement, and with scripts off the list hides exactly what the
// page body hides.
//
// Deterministic: run twice, `git diff` is empty. Zero dependencies.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanHeadings, headingLabel, slugify } from "./lib/page-headings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const OPEN = "<!-- static:page-toc -->";
const CLOSE = "<!-- /static:page-toc -->";

// A page with this many headings under its title has sections a reader
// would jump between. Deliberately a heading count and not a rendered
// height: navigate.html is 15.6 screens at 375px with 5 headings because
// it is a grid of 30 juz, and roots.html 9.8 screens with 3 because it is
// a search surface. Neither has sections; both would get a useless
// four-item list. A count is also the only signal a build-time generator
// can measure. The gap at the boundary is real — seven pages sit at 7 or
// above, the next two at 6 — and every page's count is printed below so
// the boundary stays visible rather than becoming folklore.
const THRESHOLD = 7;

// Containers whose contents the page's JavaScript replaces at runtime.
// Their authored headings are a fallback that will not exist in the
// rendered DOM, so a list pointing into one would break the moment
// scripts run. validation.html is the case that proves it: seven worked
// examples are authored as a fallback and replaced by
// assets/case-studies.js with articles built from data/case-studies.json
// — which give each example a better anchor anyway, the claim id, with a
// visible § permalink already beside it.
const RUNTIME_REGIONS = {
  "data-case-studies": "assets/case-studies.js replaces this block from data/case-studies.json",
};

// A page at or above THRESHOLD may go without a list only by being named
// here, with a reason, printed on every run. Same shape as
// check-generated-freshness's EXCLUDED and check-data-nums's
// SHOULD_BIND_SKIP. An entry naming a page that HAS a region is stale and
// fails, so this list cannot quietly outlive its reason.
const NO_TOC = {};

const pages = readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();

const failures = [];
const writes = new Map();
const report = [];

for (const file of pages) {
  const abs = join(ROOT, file);
  const before = readFileSync(abs, "utf8");
  const i = before.indexOf(OPEN);
  const j = before.indexOf(CLOSE);
  const hasRegion = i !== -1 && j !== -1 && j > i;

  const all = scanHeadings(before, { skipAttrs: Object.keys(RUNTIME_REGIONS) });
  // Everything under the page's title heading.
  const eligible = Math.max(0, all.length - 1);
  report.push([file, eligible, hasRegion]);

  const excused = Object.prototype.hasOwnProperty.call(NO_TOC, file);
  if (excused && hasRegion) {
    failures.push(
      `${file}: listed in NO_TOC ("${NO_TOC[file]}") but carries a ${OPEN} region. ` +
        `Drop the NO_TOC entry or remove the region.`,
    );
  }
  if (!hasRegion) {
    if (eligible >= THRESHOLD && !excused) {
      failures.push(
        `${file}: ${eligible} headings under its title (threshold ${THRESHOLD}) but no ` +
          `${OPEN} … ${CLOSE} region. Add the region where the page title ends, or name ` +
          `the page in NO_TOC with a reason.`,
      );
    }
    continue;
  }

  // Only headings after the region are entries: the page title sits
  // immediately above it.
  const heads = all.filter((h) => h.start > i);
  if (!heads.length) {
    failures.push(`${file}: the ${OPEN} region has no headings after it.`);
    continue;
  }

  // Every id already on the page, so a minted slug cannot collide with a
  // claim permalink, a card id or an element the page's script looks up.
  const taken = new Set();
  for (const m of before.matchAll(/\sid="([^"]+)"/g)) taken.add(m[1]);
  for (const h of heads) if (h.id) taken.delete(h.id);

  const entries = [];
  const mint = [];
  const seen = new Map();
  for (const h of heads) {
    const label = headingLabel(h.inner);
    if (!label) {
      failures.push(`${file}: a <${h.level}> after the region has no text to list.`);
      continue;
    }
    let id = h.id;
    if (!id) {
      id = slugify(label);
      if (!id) {
        failures.push(`${file}: "${label}" does not slugify to anything usable.`);
        continue;
      }
      if (taken.has(id)) {
        failures.push(
          `${file}: "${label}" slugifies to #${id}, which is already used elsewhere on the ` +
            `page. Give the heading an explicit id.`,
        );
        continue;
      }
      taken.add(id);
      mint.push({ at: h.insertAt, id });
    }
    if (seen.has(id)) {
      failures.push(
        `${file}: "${label}" and "${seen.get(id)}" both resolve to #${id}. ` +
          `Two sections cannot share one address; reword one or give it an explicit id.`,
      );
      continue;
    }
    seen.set(id, label);
    entries.push({ id, label, gate: h.gate });
  }

  // Indent the block the way the marker itself is indented.
  const lineStart = before.lastIndexOf("\n", i) + 1;
  const pad = before.slice(lineStart, i).match(/^[ \t]*/)[0];
  const nav =
    `\n${pad}<nav class="page-toc" aria-label="On this page">\n` +
    `${pad}  <p class="t-annotation">On this page:</p>\n` +
    `${pad}  <ul>\n` +
    entries
      .map(
        (e) =>
          `${pad}    <li${e.gate ? ` class="${e.gate}"` : ""}>` +
          `<a href="#${esc(e.id)}">${esc(e.label)}</a></li>`,
      )
      .join("\n") +
    `\n${pad}  </ul>\n${pad}</nav>\n${pad}`;

  // Minted ids go in first, spliced from the end so each insertion
  // leaves the earlier offsets valid. The region is rewritten after, by
  // searching the already-edited text rather than reusing offsets the
  // insertions have moved.
  let text = before;
  for (const m of mint.sort((a, b) => b.at - a.at))
    text = text.slice(0, m.at) + ` id="${esc(m.id)}"` + text.slice(m.at);
  const i2 = text.indexOf(OPEN);
  const j2 = text.indexOf(CLOSE);
  text = text.slice(0, i2 + OPEN.length) + nav + text.slice(j2);

  writes.set(abs, text);
}

function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const changed = [...writes].filter(([abs, text]) => text !== readFileSync(abs, "utf8"));

// No silent caps: the count for every page above the threshold or within
// one of it, so the boundary is visible rather than folklore.
const near = report
  .filter(([, n]) => n >= THRESHOLD - 2)
  .sort((a, b) => b[1] - a[1]);
console.log(`build-page-toc: threshold ${THRESHOLD} headings under the page title.`);
for (const [file, n, has] of near)
  console.log(`  ${has ? "toc" : "   "}  ${String(n).padStart(3)}  ${file}`);
for (const [attr, why] of Object.entries(RUNTIME_REGIONS))
  console.log(`  headings inside [${attr}] are skipped: ${why}`);
for (const [file, why] of Object.entries(NO_TOC))
  console.log(`  ${file} deliberately has no list: ${why}`);

if (CHECK) {
  for (const [abs] of changed)
    failures.push(`${abs.slice(ROOT.length + 1)}: the page-toc region is stale`);
  if (failures.length) {
    console.error("build-page-toc --check: FAIL");
    for (const f of failures) console.error("  - " + f);
    console.error("  Run: node scripts/build-page-toc.mjs");
    process.exit(1);
  }
  console.log(`build-page-toc --check: OK (${writes.size} pages current)`);
} else {
  if (failures.length) {
    console.error("build-page-toc: FAIL");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  for (const [abs, text] of writes) writeFileSync(abs, text);
  console.log(
    `build-page-toc: ${writes.size} pages written (${changed.length} file(s) changed).`,
  );
}
