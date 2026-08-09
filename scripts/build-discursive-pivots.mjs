// build-discursive-pivots.mjs — deterministic, zero-dependency generator for
// data/discursive-pivots.json.
//
// What this measures, precisely: verses that open with one of three
// temporal clause-subordinating particles — "idh" (past narrative
// "when"/"recall"), "idha" (conditional/general "when"/"if"), and "lamma"
// ("when"/"once") — grammatically the same family (zarf zaman /
// clause-initial temporal subordinators), unlike a sequencing conjunction
// such as "thumma" ("then"), which is deliberately NOT included here since
// it marks continuation rather than a new temporal clause and would blur
// this feature's precise scope. A verse counts only if its content roots
// overlap with the immediately preceding verse in the same surah. Both
// facts — the marker and the shared root — are mechanical lookups against
// the bundled Leeds morphology (lemma match for the marker, set
// intersection for the root) and are reproducible from the data this site
// ships.
//
// What this deliberately does NOT claim: that a verse opening with "idh" or
// "lamma" marks a "thematic pivot", a genre shift, or any other
// interpretive structural event. Whether a boundary is rhetorically
// significant is an editorial judgment this site does not make — see
// docs/maintainer-guide.md, "No independent theological interpretation".
// This file only records where the marker and the lexical overlap occur.
//
// Run: node scripts/build-discursive-pivots.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FREQUENCY_CEILING } from "./lib/stats.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const rootsSummary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);

// Same rule as scripts/build-cooccurrence.mjs: roots this frequent co-occur
// with nearly everything, so "shared root" would be meaningless noise if
// they counted. Kept identical to that script's ceiling for consistency.
const excludedRoots = new Set(
  Object.entries(rootsSummary)
    .filter(([, meta]) => meta.totalCount > FREQUENCY_CEILING)
    .map(([bw]) => bw),
);

// Verse-initial lemma → marker label. All three are pos "T" (particle) in
// the Leeds tagset and carry no root of their own.
const MARKERS = {
  "<i*": { label: "idh", gloss: '"when" / "recall" (temporal, often opens a retrospective narrative unit)' },
  "<i*aA": { label: "idha", gloss: '"when" / "if" (temporal-conditional; same clause-initial subordinator family as "idh", general/future rather than past-narrative)' },
  "lam~aA": { label: "lamma", gloss: '"when" / "once" (temporal)' },
};

const occurrences = [];
const markerTotals = { idh: 0, idha: 0, lamma: 0 };

for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );

  const verseNums = Object.keys(morph)
    .map(Number)
    .sort((a, b) => a - b);

  for (const a of verseNums) {
    const words = morph[String(a)];
    if (!words || words.length === 0) continue;

    const marker = MARKERS[words[0].lemma];
    if (!marker) continue;

    markerTotals[marker.label]++;

    // No preceding verse in this surah to compare against.
    if (a === verseNums[0]) continue;

    const prevWords = morph[String(a - 1)];
    if (!prevWords) continue;

    const curRoots = new Set(
      words.map((w) => w.root).filter((r) => r && !excludedRoots.has(r)),
    );
    const prevRoots = new Set(
      prevWords.map((w) => w.root).filter((r) => r && !excludedRoots.has(r)),
    );

    const shared = [...curRoots].filter((r) => prevRoots.has(r));
    if (shared.length === 0) continue;

    occurrences.push({
      s,
      a,
      marker: marker.label,
      prevA: a - 1,
      sharedRoots: shared.map((r) => ({
        root: r,
        arabic: rootsSummary[r]?.rootArabic || "",
        rootLatin: rootsSummary[r]?.rootLatin || r,
      })),
    });
  }
}

occurrences.sort((x, y) => x.s - y.s || x.a - y.a);

const out = {
  _generated: "build-discursive-pivots.mjs",
  _method:
    'Verse-initial lemma match for three temporal clause-subordinating ' +
    'particles ("idh", "idha", "lamma" — deliberately excluding sequencing ' +
    'conjunctions like "thumma", which mark continuation, not a new ' +
    "temporal clause), then a set intersection of content roots (root " +
    `non-empty, corpus-wide frequency ≤ ${FREQUENCY_CEILING}) between that ` +
    "verse and the immediately preceding verse in the same surah. Both " +
    "steps are mechanical lookups against the bundled morphology; no claim " +
    "is made about thematic or rhetorical significance beyond the marker " +
    "and the shared root.",
  _excludedRoots: [...excludedRoots].map((r) => rootsSummary[r]?.rootLatin || r),
  markers: {
    idh: { lemma: "<i*", gloss: MARKERS["<i*"].gloss, totalOccurrences: markerTotals.idh },
    idha: { lemma: "<i*aA", gloss: MARKERS["<i*aA"].gloss, totalOccurrences: markerTotals.idha },
    lamma: { lemma: "lam~aA", gloss: MARKERS["lam~aA"].gloss, totalOccurrences: markerTotals.lamma },
  },
  continuityCount: occurrences.length,
  occurrences,
};

writeFileSync(
  join(ROOT, "data", "discursive-pivots.json"),
  JSON.stringify(out, null, 1) + "\n",
);

console.log(`idh: ${markerTotals.idh} verse-initial occurrences`);
console.log(`idha: ${markerTotals.idha} verse-initial occurrences`);
console.log(`lamma: ${markerTotals.lamma} verse-initial occurrences`);
console.log(
  `Root continuity with preceding verse: ${occurrences.length} of ${markerTotals.idh + markerTotals.idha + markerTotals.lamma} marker occurrences`,
);
