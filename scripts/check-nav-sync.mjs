// check-nav-sync.mjs — drift guard for the primary navigation. The nav
// is static HTML duplicated on every page BY DESIGN (progressive
// enhancement, no build step); this checker keeps that deliberate
// duplication honest by failing when any page's nav diverges from
// index.html's. Run it after adding a page or touching the nav; it is
// part of the pre-ship checklist in docs/maintainer-guide.md.
//
// Allowlisted (deliberately nav-less): embed.html (iframe card),
// exercise-asr.html (redirect stub). Share pages under s/ are not
// scanned (generated, nav-less by design).
//
// Run: node scripts/check-nav-sync.mjs   (exit 1 on any divergence)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NO_NAV_OK = new Set(["embed.html", "exercise-asr.html"]);

function navOf(file) {
  const html = readFileSync(join(ROOT, file), "utf8");
  const m = html.match(/<nav class="primary"[\s\S]*?<\/nav>/);
  if (!m) return null;
  // Normalize formatting (multi-line vs single-line markup) so only
  // semantic drift fails: collapse whitespace, then drop the spaces
  // that pure reformatting introduces around tag boundaries.
  return m[0]
    .replace(/\s+/g, " ")
    .replace(/ >/g, ">")
    .replace(/> /g, ">")
    .replace(/ </g, "<")
    .trim();
}

const reference = navOf("index.html");
if (!reference) {
  console.error("check-nav-sync: FAIL — index.html has no primary nav");
  process.exit(1);
}

const failures = [];
for (const f of readdirSync(ROOT).filter((x) => x.endsWith(".html")).sort()) {
  if (f === "index.html") continue;
  const nav = navOf(f);
  if (!nav) {
    if (!NO_NAV_OK.has(f)) failures.push(`${f}: no primary nav (not allowlisted)`);
    continue;
  }
  if (NO_NAV_OK.has(f)) {
    failures.push(`${f}: allowlisted as nav-less but has a nav`);
    continue;
  }
  if (nav !== reference) failures.push(`${f}: nav diverges from index.html`);
}

if (failures.length) {
  console.error("check-nav-sync: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("check-nav-sync: OK (all pages match index.html's nav)");
