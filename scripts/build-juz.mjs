// build-juz.mjs — generate data/juz.json, the 30 traditional juz (para)
// divisions of the Qur'an, from a single cited table of start boundaries.
//
// The 30 juz START boundaries (surah:ayah) are the standard Hafs/mushaf
// division as published in the Tanzil Project metadata (tanzil.net,
// quran-data.xml, "juz" section) — the same Tanzil text the rest of the
// site cites. They are a fixed reading convention, not part of the
// revealed text, so they are transcribed here rather than computed from
// the morphology. Each juz END boundary is DERIVED: the verse immediately
// before the next juz's start (the last juz ends at the last verse of the
// Qur'an), using per-surah verse counts from data/surah-meta.json so the
// end boundaries can never be mis-keyed by hand.
//
// Run:  node scripts/build-juz.mjs   → writes data/juz.json
// Zero dependencies, deterministic. Re-run after editing STARTS.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computedDate } from "./lib/computed-date.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Canonical juz start boundaries [surah, ayah] — Tanzil standard division.
const STARTS = [
  [1, 1],   [2, 142], [2, 253], [3, 92],  [4, 24],
  [4, 148], [5, 82],  [6, 111], [7, 88],  [8, 41],
  [9, 93],  [11, 6],  [12, 53], [15, 1],  [17, 1],
  [18, 75], [21, 1],  [23, 1],  [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47],
  [46, 1],  [51, 31], [58, 1],  [67, 1],  [78, 1],
];

const meta = JSON.parse(
  readFileSync(join(ROOT, "data", "surah-meta.json"), "utf8"),
);
const verseCount = (s) => meta.surahs[String(s)].versesCount;
const LAST_SURAH = 114;

// End of juz N = the verse right before the start of juz N+1.
function endBefore([surah, ayah]) {
  if (ayah > 1) return [surah, ayah - 1]; // previous verse, same surah
  // Next juz starts at verse 1 of `surah`, so this juz ends at the last
  // verse of the previous surah.
  const prev = surah - 1;
  return [prev, verseCount(prev)];
}

const juz = STARTS.map((start, i) => {
  const num = i + 1;
  const next = STARTS[i + 1];
  const end = next ? endBefore(next) : [LAST_SURAH, verseCount(LAST_SURAH)];
  return {
    juz: num,
    startSurah: start[0],
    startAyah: start[1],
    endSurah: end[0],
    endAyah: end[1],
  };
});

const out = {
  _source: "tanzil",
  _note:
    "The 30 traditional juz (para) divisions. START boundaries are the " +
    "standard Hafs/mushaf division per the Tanzil Project metadata " +
    "(tanzil.net). END boundaries derived as the verse before the next " +
    "juz's start, using surah-meta.json verse counts. Regenerate with " +
    "scripts/build-juz.mjs.",
  _generated: computedDate(),
  count: juz.length,
  juz,
};

writeFileSync(
  join(ROOT, "data", "juz.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(`wrote data/juz.json — ${juz.length} juz`);
