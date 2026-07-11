// build-roots-list.mjs — deterministic, zero-dependency generator for
// data/roots-list.json: the slim subset of data/roots-summary.json that
// the list/suggestion/popover/embed views actually render.
//
// Why: roots-summary.json is 1.9 MB and was fetched eagerly by
// roots.html before anything rendered (and lazily by compare.html,
// refs.js, and embed.js). The full per-root record (topSurahs, POS
// distribution, all top lemmas, first occurrence) is only needed by the
// detail panel, which already fetches data/root-analytics/{key}.json
// per root. This file keeps just what list-level consumers read:
//   { "<bw>": { rootBuckwalter, rootLatin, rootArabic, totalCount,
//               byChronology, topLemmas: [ {lemmaArabic, count} ] } }
// Same keying and field names as roots-summary, so consumers switch by
// changing one fetch URL. topLemmas is truncated to the single most
// frequent form (what the root embed shows).
//
// Run:  node scripts/build-roots-list.mjs
// Determinism check: run twice, git diff must be empty.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const summary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);

const out = {};
for (const bw of Object.keys(summary)) {
  const e = summary[bw];
  const top = (e.topLemmas || [])[0];
  out[bw] = {
    rootBuckwalter: e.rootBuckwalter,
    rootLatin: e.rootLatin,
    rootArabic: e.rootArabic,
    totalCount: e.totalCount,
    byChronology: e.byChronology,
    topLemmas: top ? [{ lemmaArabic: top.lemmaArabic, count: top.count }] : [],
  };
}

writeFileSync(
  join(ROOT, "data", "roots-list.json"),
  JSON.stringify(out) + "\n",
);
console.log(
  `roots-list: ${Object.keys(out).length} roots written to data/roots-list.json`,
);
