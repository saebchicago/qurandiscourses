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

if (failures.length) {
  console.error("check-data-nums: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-data-nums: OK (${pages.length} pages scanned; ` +
    `${Object.keys(COVERAGE_BINDINGS).length} coverage-report fallbacks current)`,
);
