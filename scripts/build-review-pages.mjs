// build-review-pages.mjs : the public corrections log and reviewer credit.
//
//   node scripts/build-review-pages.mjs           # rewrite
//   node scripts/build-review-pages.mjs --check   # exit 1 if stale or invalid
//
// Reads data/corrections.json and data/reviewers.json (both shipped as
// empty arrays; shapes and rules in scripts/lib/review-credit.mjs) and
//   1. fills corrections.html between its static:corrections markers,
//      with the empty-state sentence while the array is empty;
//   2. adds a "Reviewed by" line before </main> on each ROOT page a
//      reviewer's scope covers, and removes it from any page it no longer
//      covers. With no reviewers nothing is added anywhere.
// The generated families (surah/, juz/, root/) get the same line, and the
// WebPage `contributor` schema, from lib/page-shell.mjs; root pages get
// the schema from build-jsonld.mjs. --check also fails when a reviewer's
// scope matches no page, so a typo cannot silently credit nothing.
//
// Order: run BEFORE build-page-dates (the line sits inside <main>, which
// the date hash covers), then canonicals, jsonld, csp. Zero dependencies.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanPath } from "./lib/site.mjs";
import {
  loadCorrections,
  loadReviewers,
  renderCorrectionsList,
  renderReviewedBy,
  reviewersFor,
  applyReviewedBy,
} from "./lib/review-credit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const NO_CREDIT = new Set(["embed.html", "404.html", "exercise-asr.html"]);

const corrections = loadCorrections();
const reviewers = loadReviewers();

const family = (dir) =>
  existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".html")).map((f) => `${dir}/${f}`) : [];
const rootPages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const knownPaths = [...rootPages, ...family("surah"), ...family("juz"), ...family("root")].map(cleanPath);

const failures = [];
for (const r of reviewers) {
  for (const s of Array.isArray(r.scope) ? r.scope : [r.scope]) {
    const hit = s.endsWith("*") ? knownPaths.some((p) => p.startsWith(s.slice(0, -1))) : knownPaths.includes(s);
    if (!hit) failures.push(`reviewer "${r.name}": scope ${s} matches no page`);
  }
}

const changed = [];
function write(rel, next) {
  const abs = join(ROOT, rel);
  if (readFileSync(abs, "utf8") === next) return;
  changed.push(rel);
  if (!CHECK) writeFileSync(abs, next);
}

// 1. corrections.html
{
  const html = readFileSync(join(ROOT, "corrections.html"), "utf8");
  const open = "<!-- static:corrections -->";
  const close = "<!-- /static:corrections -->";
  if (!html.includes(open) || !html.includes(close)) throw new Error("corrections.html: static:corrections markers missing");
  const re = new RegExp(`${open}[\\s\\S]*?${close}`);
  write("corrections.html", html.replace(re, `${open}\n        ${renderCorrectionsList(corrections)}\n        ${close}`));
}

// 2. Reviewed-by lines on root pages
for (const file of rootPages) {
  if (NO_CREDIT.has(file)) continue;
  const html = readFileSync(join(ROOT, file), "utf8");
  write(file, applyReviewedBy(html, renderReviewedBy(reviewersFor(reviewers, cleanPath(file)))));
}

if (failures.length) {
  console.error("build-review-pages: FAIL\n  - " + failures.join("\n  - "));
  process.exit(1);
}
if (CHECK) {
  if (changed.length) {
    console.error(`build-review-pages --check: FAIL: stale: ${changed.join(", ")}\n  Run: node scripts/build-review-pages.mjs`);
    process.exit(1);
  }
  console.log(`build-review-pages --check: OK (${corrections.length} corrections, ${reviewers.length} reviewers).`);
} else {
  console.log(`build-review-pages: ${corrections.length} corrections, ${reviewers.length} reviewers, ${changed.length} page(s) updated.`);
}
