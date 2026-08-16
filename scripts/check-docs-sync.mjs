// check-docs-sync.mjs — the maintainer guide's inventories must list
// what actually exists.
//
//   node scripts/check-docs-sync.mjs
//
// WHY THIS EXISTS. docs/maintainer-guide.md §2 presents a site-map table
// and §3 a checker table, both written as authoritative inventories, and
// both maintained by hand. Nothing checked them, and both drifted: the
// §2 heading said "33 pages" when there were 34, `contribute` and
// `open-questions` were missing from the table (the latter since the PR
// that added the page), and four checkers appeared nowhere in the guide
// at all.
//
// That is the same failure as a stale generated artifact, one layer out
// — a list a human updates when adding something, with no check that
// they did. The page-addition recipe in §4 enforces CSP blocks, the
// redirect, the sitemap entry and the nav link, all mechanically. This
// adds the guide's own inventory to that set.
//
// Deliberately NOT folded into check-nav-sync.mjs: that checker is about
// nav markup being byte-identical across pages, and documentation
// coverage would be an unrelated concern living in the same file.
//
// A checker, not a generator: writes nothing.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GUIDE_PATH = "docs/maintainer-guide.md";
const guide = readFileSync(join(ROOT, GUIDE_PATH), "utf8");

const failures = [];
const fail = (rule, detail) => failures.push({ rule, detail });

// ── §2: the site-map table ───────────────────────────────────────────
// Bounded to the section so a page merely mentioned in passing further
// down the guide cannot satisfy the inventory.
const secStart = guide.indexOf("## 2. Site map");
const secEnd = guide.indexOf("## 3.", secStart === -1 ? 0 : secStart);
if (secStart === -1 || secEnd === -1) {
  console.error(`check-docs-sync: FAIL — could not locate §2 in ${GUIDE_PATH}.`);
  process.exit(1);
}
const siteMap = guide.slice(secStart, secEnd);

const pages = readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\.html$/, ""))
  .sort();

for (const page of pages) {
  // Word-boundary match: "read" must not be satisfied by "already".
  const re = new RegExp(`(^|[^a-z0-9-])${page.replace(/-/g, "-")}([^a-z0-9-]|$)`, "m");
  if (!re.test(siteMap)) {
    fail("site map", `${page}.html is not listed in §2's table`);
  }
}

// The heading states a count. A count in prose is exactly the kind of
// figure that goes stale silently, so it is checked rather than trusted.
const headingCount = /## 2\. Site map \((\d+) pages\)/.exec(siteMap);
if (!headingCount) {
  fail("site map", "§2's heading does not state a page count in the form \"(N pages)\"");
} else if (Number(headingCount[1]) !== pages.length) {
  fail(
    "site map",
    `§2's heading says ${headingCount[1]} pages; there are ${pages.length}`,
  );
}

// ── §3: every script must be documented somewhere in the guide ───────
// Matched against the whole guide, not one table: a script explained in
// prose is documented, which is what matters to a reader. The
// no-extension form counts too — `check-citation` is written that way.
// The no-extension form counts ONLY for hyphenated names — `check-citation`
// and `verify-site` are written that way in the guide and are distinctive
// enough to match on. A bare name like `serve` or `ordinal` is an ordinary
// English word, so requiring the extension is the difference between a real
// assertion and one that passes on prose. Mutation-testing caught this: a
// scratch `scripts/lib/nothing.mjs` passed, because "nothing" appears in the
// guide's prose.
const documented = (f) => {
  if (guide.includes(f)) return true;
  const bare = f.replace(/\.(mjs|js)$/, "");
  return bare.includes("-") && guide.includes(bare);
};

// A script may go undocumented only by being named here, with a reason,
// and the reason is printed on every run. Same shape as
// check-generated-freshness's EXCLUDED and build-root-refs-index's
// OPTED_OUT: a checker that cannot be silenced quietly.
const EXCLUDED = {};

const scripts = readdirSync(join(ROOT, "scripts"))
  .filter((f) => /\.(mjs|js)$/.test(f))
  .sort();
const checkers = scripts.filter((f) => /^(check|validate)-/.test(f));

for (const f of scripts) {
  if (Object.prototype.hasOwnProperty.call(EXCLUDED, f)) {
    if (documented(f))
      fail("exclusions", `scripts/${f} is documented AND listed as excluded — drop the exclusion`);
    continue;
  }
  if (!documented(f)) {
    const kind = /^(check|validate)-/.test(f) ? "checkers" : "scripts";
    fail(kind, `scripts/${f} appears nowhere in the guide`);
  }
}

// ── §3: the shared library ───────────────────────────────────────────
// The lib modules are the repo's single-source-of-truth layer — safe-key,
// corpus totals, stats, the SW precache computation. A module nobody can
// find in the guide gets reimplemented, which is the exact failure each
// of them was extracted to end.
const libs = readdirSync(join(ROOT, "scripts", "lib"))
  .filter((f) => f.endsWith(".mjs"))
  .sort();

for (const f of libs) {
  if (!documented(f)) fail("lib", `scripts/lib/${f} appears nowhere in the guide`);
}

// ── Report ───────────────────────────────────────────────────────────
if (failures.length) {
  console.error("check-docs-sync: FAIL");
  for (const f of failures) console.error(`  [${f.rule}] ${f.detail}`);
  console.error(
    `\n  ${failures.length} inventory gap(s) in ${GUIDE_PATH}.\n` +
      "  The guide's tables are read as authoritative; a missing entry is a\n" +
      "  reader being told something does not exist.",
  );
  process.exit(1);
}

const excluded = Object.entries(EXCLUDED);
if (excluded.length) {
  console.log(`check-docs-sync: ${excluded.length} script(s) deliberately undocumented:`);
  for (const [f, why] of excluded) console.log(`  - ${f} (${why})`);
}

console.log(
  `check-docs-sync: OK (${pages.length} pages listed in §2, ` +
    `${scripts.length - excluded.length} scripts documented, of which ` +
    `${checkers.length} checkers, plus ${libs.length} lib modules).`,
);
