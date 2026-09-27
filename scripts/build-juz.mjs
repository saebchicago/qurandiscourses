// build-juz.mjs — generate data/juz.json, the 30 traditional juz (para)
// divisions of the Qur'an.
//
// The START boundaries are read from the bundled Tanzil text's own
// metadata (data/quran-text/, each verse's `juz` field, supplied by
// alquran.cloud; see scripts/build-quran-text.mjs), so the juz Read shows,
// the translations the text service returns for a juz, the listening
// times, and the juz pages all use one division. They were previously a
// hand-typed table; it agreed with the text metadata everywhere except
// juz 4, which it started at 3:92 where the metadata starts it at 3:93.
// On Read that left 3:92 without a translation in juz 4. The division is
// a reading convention, not part of the revealed text.
//
// Each juz END boundary is DERIVED: the verse immediately before the next
// juz's start (the last juz ends at the last verse of the Qur'an).
//
// Run:  node scripts/build-juz.mjs   → writes data/juz.json
// Zero dependencies, deterministic.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computedDate } from "./lib/computed-date.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Start of each juz = its first verse in the bundled text's metadata,
// which must also be contiguous: every verse from one start to the next
// carries the same juz number.
const STARTS = [];
let lastJuz = 0;
for (let sn = 1; sn <= 114; sn++) {
  const t = JSON.parse(readFileSync(join(ROOT, "data", "quran-text", `${sn}.json`), "utf8"));
  for (const a of t.ayahs) {
    if (a.juz === lastJuz) continue;
    if (a.juz !== lastJuz + 1) throw new Error(`juz metadata jumps from ${lastJuz} to ${a.juz} at ${sn}:${a.numberInSurah}`);
    STARTS.push([sn, a.numberInSurah]);
    lastJuz = a.juz;
  }
}
if (STARTS.length !== 30) throw new Error(`expected 30 juz starts, found ${STARTS.length}`);

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
    "The 30 traditional juz (para) divisions. START boundaries are read " +
    "from the bundled Tanzil text's metadata (data/quran-text/, each " +
    "verse's juz field, supplied by alquran.cloud). END boundaries derived " +
    "as the verse before the next juz's start, using surah-meta.json verse " +
    "counts. Regenerate with scripts/build-juz.mjs.",
  _generated: computedDate(),
  count: juz.length,
  juz,
};

writeFileSync(
  join(ROOT, "data", "juz.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.log(`wrote data/juz.json — ${juz.length} juz`);
