// check-data-nums.mjs — integrity guard for data-num="dot.path" bindings.
//
// assets/app.js's initDataNums() walks every [data-num] element, resolves
// its dot-path against data/numbers.json, and overwrites the static
// fallback text with the live value — but only when the path resolves to
// a number. A typo'd path, a renamed field, or a stale fallback number
// left behind after data/numbers.json regenerates all fail silently in
// the browser: the old static text just stays put, exactly the "display
// drift" data-num exists to prevent (see maintainer-guide.md §1).
//
// Asserts, for every data-num="path" found in the root HTML pages:
//   1. the path resolves to a number in data/numbers.json
//   2. the element's static fallback text matches that number under the
//      same formatting initDataNums() applies (toLocaleString for
//      integers, toFixed(1) otherwise) — so a page can never silently
//      drift from the generated data it claims to bind to
//
// SECOND FAMILY: coverage.html's report-backed fallbacks. Those are
// bound by bespoke JS (getElementById(id).textContent = …) against
// data/coverage/report.json rather than by the data-num convention, so
// the assertions above never saw them — and they drifted. #107 shipped
// three different wrong numbers for the same figure: report.json said
// 29 of 31 sources reachable, the no-JS fallback said 25 of 31, and the
// truth was 34 of 36. This is the same guarantee extended to that page.
//
// The SET of ids is read from coverage.html itself, so a fallback added
// later cannot slip past unnoticed; how each id resolves into
// report.json is declared below, because the JS expressions are not
// mechanically invertible. An id with no declared resolution FAILS
// rather than being skipped.
//
// THIRD FAMILY: figures that SHOULD be bound and are not. The two
// families above only see figures a page already opted into binding.
// The convention was applied unevenly — one sentence on numbers.html
// reads "Of <bound> word-tokens, 25,135 are nouns and 19,356 are verbs",
// where the two hand-typed numbers both exist in numbers.json as
// posProfile.byTag.N and .V. So a comma-formatted number >= 1,000 in
// page prose that equals a numbers.json value must sit inside a
// data-num span, or be named in SHOULD_BIND_SKIP with a reason.
//
// WHY >= 1,000 AND COMMA-FORMATTED, which is the whole design of this
// rule rather than a detail. A first version flagged any unbound number
// matching a numbers.json value and produced 97 hits, most of them
// nonsense: 114 is usually a surah number, 103 and 104 are surah numbers
// that collide with unrelated counts. Restricting to values a reader
// would only ever write as a corpus figure drops that to 34 with a
// single genuine coincidence. A rule with a rotting allowlist is worse
// than no rule; this one needs two entries.
//
// Run: node scripts/check-data-nums.mjs   (exit 1 on any failure)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const numbers = JSON.parse(readFileSync(join(ROOT, "data", "numbers.json"), "utf8"));

const format = (v) =>
  Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1);

const resolve = (path) => {
  let v = numbers;
  for (const part of path.split(".")) {
    if (v == null) return undefined;
    v = v[part];
  }
  return v;
};

const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const failures = [];
const PATTERN = /data-num="([^"]+)"[^>]*>([^<]*)</g;

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), "utf8");
  for (const match of html.matchAll(PATTERN)) {
    const [, path, text] = match;
    const label = `${page}: data-num="${path}"`;
    const value = resolve(path);
    if (typeof value !== "number") {
      failures.push(`${label} does not resolve to a number in data/numbers.json`);
      continue;
    }
    const expected = format(value);
    const actual = text.trim();
    if (actual !== expected) {
      failures.push(`${label}: static text "${actual}" does not match live value "${expected}" (${value})`);
    }
  }
}

// ── coverage.html ⇄ data/coverage/report.json ────────────────────────
const COVERAGE_PAGE = "coverage.html";
const report = JSON.parse(
  readFileSync(join(ROOT, "data", "coverage", "report.json"), "utf8"),
);
const n = (v) => Number(v).toLocaleString("en-US");

// id → the value coverage.html renders into it, in the same shape the
// page's own JS produces. Kept beside the assertion rather than in a
// data file: it is a statement about one page's markup.
const COVERAGE_BINDINGS = {
  covTotalTokens: () => n(report.morphology.totalTokens),
  glossCount: () => String(report.rootGloss.withVerifiedGloss),
  glossTotal: () => n(report.rootGloss.totalRoots),
  glossPercent: () => report.rootGloss.percentWith + "%",
  qursimCovered: () => String(report.qursim.covered),
  qursimTotal: () => String(report.qursim.totalSurahs),
  qursimUncovered: () => report.qursim.uncovered.join(", "),
  perWordGlossCovered: () => String(report.perWordGloss.covered),
  perWordGlossTotal: () => String(report.perWordGloss.totalSurahs),
  perWordGlossPercent: () => report.perWordGloss.percentWith + "%",
  sourceUsageUsed: () => String(report.sourceUsage.used),
  sourceUsageTotal: () => String(report.sourceUsage.totalSources),
};

// Ids whose rendered text is prose assembled at run time ("Reason: …",
// "Covered surahs: …") or a count of a list rather than a value. Their
// static fallback is empty by design, so there is nothing to compare.
const COVERAGE_PROSE = new Set([
  "glossReason",
  "perWordGlossSurahs",
  "sourceUsageUnused",
]);

const coverageHtml = readFileSync(join(ROOT, COVERAGE_PAGE), "utf8");
const boundIds = [
  ...coverageHtml.matchAll(
    /getElementById\(\s*["']([A-Za-z0-9_-]+)["']\s*\)\s*\.textContent\s*=/g,
  ),
].map((m) => m[1]);

for (const id of new Set(boundIds)) {
  if (COVERAGE_PROSE.has(id)) continue;
  const resolveBinding = COVERAGE_BINDINGS[id];
  if (!resolveBinding) {
    failures.push(
      `${COVERAGE_PAGE}: #${id} is filled from the coverage report but this check ` +
        "does not know how to resolve it — add it to COVERAGE_BINDINGS (or to " +
        "COVERAGE_PROSE if its text is assembled prose)",
    );
    continue;
  }
  const m = new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(coverageHtml);
  if (!m) {
    failures.push(`${COVERAGE_PAGE}: #${id} is assigned by script but no element carries that id`);
    continue;
  }
  const actual = m[1].trim();
  const expected = resolveBinding();
  if (actual !== expected) {
    failures.push(
      `${COVERAGE_PAGE}: #${id} static fallback "${actual}" does not match ` +
        `data/coverage/report.json's "${expected}"`,
    );
  }
}

// ── figures that should be bound and are not ─────────────────────────
// Named, printed, and checked for staleness: an entry here that turns
// out to be bound after all fails, so the list cannot quietly outlive
// its reason. Same shape as check-generated-freshness's EXCLUDED and
// check-docs-sync's exclusion map.
const SHOULD_BIND_SKIP = {
  "patterns.html|7,679":
    "QurSim's published pair count (Sharaf & Atwell 2012), which happens to " +
    "equal posProfile.byTag.P — a coincidence, not this corpus's figure",
};

// Every numbers.json integer >= 1,000, in the rendering initDataNums uses.
const bindable = new Map();
(function collect(node, path) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("_")) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) collect(v, path + k + ".");
    else if (Number.isInteger(v) && v >= 1000 && !bindable.has(v.toLocaleString("en-US")))
      bindable.set(v.toLocaleString("en-US"), path + k);
  }
})(numbers, "");

// changelog.html is exempt as a whole, and the reason is not
// convenience. Its entries are a historical record: each states what was
// true when it was written, so binding them to today's values would
// rewrite history the first time a figure moved. It is also generated
// from data/changelog.json, so a binding would have to live in the
// registry's frozen HTML strings.
const EXEMPT_PAGES = {
  "changelog.html": "a historical record — its figures are frozen at the date of the entry",
};

const seenSkips = new Set();
for (const page of pages) {
  if (EXEMPT_PAGES[page]) continue;
  let text = readFileSync(join(ROOT, page), "utf8");
  // JSON-LD and inline scripts restate these figures; they are generated
  // and are not prose a reader binds.
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/g, " ");
  // An existing binding satisfies the rule — on ANY element. numbers.html
  // binds with <strong> and <td> as well as <span>, and a span-only
  // stripper reported 10 already-bound figures there as unbound.
  text = text.replace(/<(\w+)[^>]*\sdata-num="[^"]*"[^>]*>[\s\S]*?<\/\1>/g, " ");
  // coverage.html's figures are bound by the report.json mechanism above,
  // which writes textContent — a data-num span inside one of those
  // elements would be a second, competing binding that the first wipes.
  // Found the hard way: adding one made family two fail with an empty
  // fallback.
  // Generated marker regions are not hand-written prose. glossary.html's
  // definition list is emitted from data/glossary.json by
  // build-glossary.mjs, and the same strings are rendered into the
  // tooltip via textContent by assets/glossary.js — so a data-num span
  // could not live in the registry either; it would show as literal
  // markup in the popover. Found by build-glossary --check going red
  // after the bindings were added by hand.
  text = text.replace(/<!--\s*static:([a-z-]+)\s*-->[\s\S]*?<!--\s*\/static:\1\s*-->/g, " ");
  if (page === COVERAGE_PAGE)
    for (const id of Object.keys(COVERAGE_BINDINGS))
      text = text.replace(new RegExp(`<(\\w+)[^>]*\\sid="${id}"[^>]*>[\\s\\S]*?<\\/\\1>`), " ");

  // export.html's download-card row counts live in .export-links and are
  // held against the actual tables by check-exports-sync.mjs — the table
  // is the right authority for a row count, and a second binding to
  // totals.roots would fight it the first time a table legitimately
  // diverged. Stripped by ELEMENT, not by value: a page-and-value skip
  // would also exempt the page's "All 1,642 roots" prose claims, which
  // are ordinary corpus figures and must stay guarded. (Codex caught
  // exactly that on the first version of this rule.)
  text = text.replace(/<p[^>]*class="export-links"[^>]*>[\s\S]*?<\/p>/g, " ");
  text = text.replace(/<[^>]+>/g, " ");

  for (const [formatted, path] of bindable) {
    const re = new RegExp(`(?<![\\d,.])${formatted.replace(/,/g, ",")}(?![\\d,.])`, "g");
    for (const m of text.matchAll(re)) {
      const key = `${page}|${formatted}`;
      if (SHOULD_BIND_SKIP[key]) { seenSkips.add(key); continue; }
      const around = text.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, " ").trim();
      failures.push(
        `${page}: "${formatted}" is data/numbers.json's ${path} but is written by hand — ` +
          `bind it as <span data-num="${path}">${formatted}</span>, or add "${key}" to ` +
          `SHOULD_BIND_SKIP with a reason. Context: …${around}…`,
      );
    }
  }
}
for (const key of Object.keys(SHOULD_BIND_SKIP)) {
  if (!seenSkips.has(key))
    failures.push(
      `SHOULD_BIND_SKIP has "${key}", but no unbound occurrence of it remains — drop the entry`,
    );
}

if (failures.length) {
  console.error("check-data-nums: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
for (const [page, why] of Object.entries(EXEMPT_PAGES))
  console.log(`check-data-nums: ${page} exempt from the should-bind rule — ${why}`);

const skips = Object.entries(SHOULD_BIND_SKIP);
if (skips.length) {
  console.log(`check-data-nums: ${skips.length} unbound figure(s) deliberately allowed:`);
  for (const [k, why] of skips) console.log(`  - ${k} — ${why}`);
}
console.log(
  `check-data-nums: OK (${pages.length} pages scanned; ` +
    `${Object.keys(COVERAGE_BINDINGS).length} coverage-report fallbacks current; ` +
    `${bindable.size} bindable figures, every prose occurrence bound or declared)`,
);
