// check-citation.mjs — one version everywhere, or fail.
//
// data/version.json is the single source; four other surfaces name the
// version and each has drifted-silently potential: CITATION.cff (read by
// GitHub and Zenodo), assets/version.js (read by the footer popover),
// about.html's static citation example (the no-JS fallback), and
// data/citations.bib. build-citations.mjs --check already guards the
// generated two byte-for-byte; this checker covers the hand-maintained
// two, plus the source-type registry that BibTeX generation depends on.
//
// Run: node scripts/check-citation.mjs   (exit 1 on any failure)

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const { version, released } = JSON.parse(readText("data/version.json"));

if (!/^\d+\.\d+\.\d+$/.test(version))
  failures.push(`data/version.json: version "${version}" is not MAJOR.MINOR.PATCH`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(released))
  failures.push(`data/version.json: released "${released}" is not YYYY-MM-DD`);

// CITATION.cff: version and date-released must match, exactly once each.
const cff = readText("CITATION.cff");
const cffVersion = (cff.match(/^version:\s*(.+)$/m) || [])[1];
const cffDate = (cff.match(/^date-released:\s*(.+)$/m) || [])[1];
if (cffVersion !== version)
  failures.push(`CITATION.cff: version is "${cffVersion}", data/version.json says "${version}"`);
if (cffDate !== released)
  failures.push(`CITATION.cff: date-released is "${cffDate}", data/version.json says "${released}"`);

// about.html's static example: the no-JS reader must see the real version.
const about = readText("about.html");
if (!about.includes(`version ${version}`))
  failures.push(`about.html#cite: static citation does not name version ${version}`);

// export.html links the versioned archive by name; a version bump that
// forgets the page would leave it linking the previous release forever.
const exportPage = readText("export.html");
if (!exportPage.includes(`divinediscourses-data-v${version}.tar.gz`))
  failures.push(`export.html: does not link divinediscourses-data-v${version}.tar.gz`);

// Every source carries a valid type (BibTeX generation keys off it; the
// generator throws too, but this reports ALL offenders at once).
const TYPES = new Set(["book", "paper", "dataset", "api"]);
const sources = JSON.parse(readText("data/sources.json")).sources;
for (const s of sources) {
  if (!TYPES.has(s.type))
    failures.push(`data/sources.json: "${s.id}" type "${s.type}" not in {${[...TYPES].join(", ")}}`);
}

// The footer Cite link and its scripts ship together: a page with the
// link but not the scripts has a dead control, and vice versa a hidden
// one. Both are enhancement-only, so embed.html and exercise-asr.html
// (no footer) legitimately have neither.
import { readdirSync } from "node:fs";
import { readText } from "./lib/io.mjs";
for (const f of readdirSync(ROOT).filter((x) => x.endsWith(".html"))) {
  const html = readText(f);
  const hasLink = html.includes('href="/about#cite"');
  const hasScript = html.includes("assets/cite-page.js");
  const hasVersion = html.includes("assets/version.js");
  if (hasLink !== hasScript || hasScript !== hasVersion)
    failures.push(
      `${f}: cite link/${hasLink} cite-page.js/${hasScript} version.js/${hasVersion} must all match`,
    );
}

if (failures.length) {
  console.error("check-citation: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`check-citation: OK (v${version} consistent across cff, about.html, and ${sources.length} typed sources).`);
