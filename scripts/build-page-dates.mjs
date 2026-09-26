#!/usr/bin/env node
//
// build-page-dates.mjs — when each page's reader-visible content last
// changed, for sitemap.xml <lastmod> and each page's JSON-LD
// dateModified.
//
//   node scripts/build-page-dates.mjs           # update data/page-dates.json
//   node scripts/build-page-dates.mjs --check   # exit 1 if a page changed unrecorded
//
// WHY A HASH, NOT git log. The sitemap's dates were typed by hand and
// had drifted 9 to 77 days behind the pages. Reading dates from git
// history would fix that locally but not in CI, whose checkout is one
// commit deep, so every page would look changed today. Instead each
// page's <main> (scripts and runs of whitespace removed, so a reformat
// or a CSP-hash change is not a content change) is hashed; the date
// moves only when the hash does. The first run seeds each date from the
// page's last commit when git history is available, else today.
//
// data/page-dates.json is read by build-canonicals.mjs (sitemap
// <lastmod>) and build-jsonld.mjs (WebPage dateModified). Run this
// before both. Deterministic apart from the date stamped on a page
// whose content changed, which is the point.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computedDate } from "./lib/computed-date.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "page-dates.json");
const CHECK = process.argv.includes("--check");

const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

function contentHash(html) {
  const m = /<main\b[\s\S]*?<\/main>/i.exec(html);
  const body = (m ? m[0] : html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

function gitDate(file) {
  try {
    const d = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: ROOT, encoding: "utf8" }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  } catch {
    return null;
  }
}

const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).pages || {} : {};
const today = computedDate();
const next = {};
const changed = [];
for (const f of pages) {
  const hash = contentHash(readFileSync(join(ROOT, f), "utf8"));
  const p = prior[f];
  if (p && p.hash === hash) {
    next[f] = p;
    continue;
  }
  changed.push(f);
  next[f] = { hash, lastmod: p ? today : gitDate(f) || today };
}
const removed = Object.keys(prior).filter((f) => !next[f]);

if (CHECK) {
  if (changed.length || removed.length) {
    console.error("build-page-dates --check: FAIL — page content changed without a new date:");
    for (const f of changed) console.error(`  - ${f}`);
    for (const f of removed) console.error(`  - ${f} (removed)`);
    console.error("  Run: node scripts/build-page-dates.mjs, then build-canonicals and build-jsonld.");
    process.exit(1);
  }
  console.log(`build-page-dates --check: OK (${pages.length} pages)`);
} else {
  const out = {
    _generated: "scripts/build-page-dates.mjs",
    _method:
      "lastmod = the date a page's <main> content (scripts and whitespace runs removed) last changed, detected by hash. " +
      "Seeded from each page's last commit on first run.",
    pages: next,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(`build-page-dates: ${pages.length} pages, ${changed.length} dated today or seeded${removed.length ? `, ${removed.length} removed` : ""}.`);
}
