// build-formula-summary.mjs — deterministic, zero-dependency roll-up of
// data/formulas-root.json + data/formulas-surface.json into a small
// per-surah summary (data/formula-summary.json) that pages can fetch
// cheaply. The parent files run 1.2–1.8 MB — far too heavy for a page
// like dossier.html that only needs "how much recurring phrasing does
// this surah share, and what are its top phrases."
//
// Per surah: how many distinct recurring sequences (each stream) have at
// least one occurrence here, plus the top 5 phrases ranked by how often
// they recur WITHIN this surah. Ranking ties break toward longer
// n-grams first — a recurring 5-gram necessarily contains recurring
// sub-3-grams, and preferring the longer run keeps the list from being
// dominated by fragments of one phrase. (A true subsumption filter is a
// possible follow-up; this ordering is the honest cheap version.)
//
// Same epistemic frame as the parents: recurrence is recorded, not
// interpreted — see build-formulas.mjs and Bannister 2014 (Sources).
//
// Run: node scripts/build-formula-summary.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOP_N = 5;

const rootData = JSON.parse(
  readFileSync(join(ROOT, "data", "formulas-root.json"), "utf8"),
);
const surfaceData = JSON.parse(
  readFileSync(join(ROOT, "data", "formulas-surface.json"), "utf8"),
);

// Per-surah accumulators. Refs in the parent files are emitted in mushaf
// order (surah asc, verse asc, position asc — see build-formulas.mjs's
// iteration order), so the first ref seen for a surah is its first
// occurrence; no re-sort needed.
const perSurah = {};
for (let s = 1; s <= 114; s++) {
  perSurah[s] = { rootSeqs: 0, surfaceSeqs: 0, candidates: [] };
}

function collect(streamName, ngrams) {
  for (const g of ngrams) {
    // surah -> { countIn, firstRef }
    const bySurah = new Map();
    for (const ref of g.refs) {
      const s = ref[0];
      let e = bySurah.get(s);
      if (!e) {
        e = { countIn: 0, firstRef: ref };
        bySurah.set(s, e);
      }
      e.countIn++;
    }
    for (const [s, e] of bySurah) {
      const acc = perSurah[s];
      if (streamName === "root") acc.rootSeqs++;
      else acc.surfaceSeqs++;
      acc.candidates.push({
        stream: streamName,
        n: g.n,
        display: g.display,
        arabic: g.arabic || "",
        countIn: e.countIn,
        countTotal: g.count,
        ref: e.firstRef,
      });
    }
  }
}

collect("root", rootData.ngrams);
collect("surface", surfaceData.ngrams);

const surahs = {};
for (let s = 1; s <= 114; s++) {
  const acc = perSurah[s];
  acc.candidates.sort(
    (x, y) =>
      y.countIn - x.countIn ||
      y.n - x.n ||
      y.countTotal - x.countTotal ||
      x.display.localeCompare(y.display),
  );
  surahs[String(s)] = {
    rootCount: acc.rootSeqs,
    surfaceCount: acc.surfaceSeqs,
    top: acc.candidates.slice(0, TOP_N),
  };
}

writeFileSync(
  join(ROOT, "data", "formula-summary.json"),
  JSON.stringify({
    _generated: "build-formula-summary.mjs",
    _source: "data/formulas-root.json + data/formulas-surface.json",
    _method:
      "Per-surah roll-up of the two formula indexes: rootCount/" +
      "surfaceCount = how many distinct recurring sequences (per " +
      "stream) occur at least once in the surah; top = the " +
      TOP_N +
      " phrases ranked by occurrences WITHIN the surah (ties: longer " +
      "n first — a recurring 5-gram contains recurring sub-3-grams, " +
      "and preferring the longer run keeps fragments of one phrase " +
      "from dominating — then corpus-wide count, then display). Each " +
      "entry's ref is the phrase's first occurrence in the surah, in " +
      "the parent file's format (root stream: [surah, ayah, " +
      "w1..wN] — every matched word position; surface stream: " +
      "[surah, ayah, w] — first word, run is w..w+n-1). Purely " +
      "mechanical counting; recurrence is recorded, not interpreted " +
      "(see build-formulas.mjs and Bannister 2014 on the Sources page).",
    _params: { topN: TOP_N },
    surahs,
  }) + "\n",
);

const sizes = Object.values(surahs);
console.log(
  `formula-summary: 114 surahs, top ${TOP_N} each; ` +
    `root seqs min ${Math.min(...sizes.map((x) => x.rootCount))} max ${Math.max(...sizes.map((x) => x.rootCount))}, ` +
    `surface min ${Math.min(...sizes.map((x) => x.surfaceCount))} max ${Math.max(...sizes.map((x) => x.surfaceCount))}`,
);
