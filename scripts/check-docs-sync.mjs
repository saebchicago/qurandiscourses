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

// ── §3: every checker must be documented somewhere in the guide ──────
// Matched against the whole guide, not one table: a checker explained in
// prose is documented, which is what matters to a reader.
const checkers = readdirSync(join(ROOT, "scripts"))
  .filter((f) => /^(check|validate)-.*\.mjs$/.test(f))
  .sort();

for (const c of checkers) {
  if (!guide.includes(c) && !guide.includes(c.replace(/\.mjs$/, ""))) {
    fail("checkers", `scripts/${c} appears nowhere in the guide`);
  }
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

console.log(
  `check-docs-sync: OK (${pages.length} pages listed in §2, ` +
    `${checkers.length} checkers documented).`,
);
