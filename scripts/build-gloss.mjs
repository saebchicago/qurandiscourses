// build-gloss.mjs — deterministic, zero-dependency generator for
// data/gloss/{surah}.json: per-word English glosses aligned to the
// bundled Leeds morphology token order, for the word-by-word table on
// the Read page (which already renders w.gloss when present).
//
// ── LICENSING GATE — read before running for real ──────────────────
// A gloss dataset ships on this site ONLY after the owner has obtained
// and confirmed a license worth citing (maintainer guide backlog rule).
// Candidate sources are documented in the maintainer guide ("Add
// word-by-word glosses"); when real data is first committed, the same
// commit MUST add the dataset to data/sources.json, sources.html, and
// NOTICE.md, and note it in the changelog. This script refuses to
// write into data/gloss/ from a fixture input.
//
// Input: a LOCAL raw dump (path passed as the first argument) with the
// expected shape (adapt the parse step if a chosen source differs):
//   { "_source": "<sources.json id>", "_license": "<short license text>",
//     "surahs": { "<n>": { "<ayah>": ["gloss for word 1", ...] } } }
//
// Alignment guard: for every verse, the source's word count must equal
// the Leeds morphology token count. Mismatched verses get null glosses
// (the Read page simply shows nothing for them) and are listed in a
// mandatory mismatch report; the run FAILS if more than 2% of verses
// misalign — never silently shift word indices.
//
// Run:  node scripts/build-gloss.mjs <raw-dump.json> [--surah N] [--out data/gloss]
// Test: node scripts/build-gloss.mjs scripts/fixtures/gloss-raw-sample.json --out /tmp/gloss-test
// Determinism check: run twice, byte-identical output.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith("--"));
if (!inputPath) {
  console.error(
    "usage: node scripts/build-gloss.mjs <raw-dump.json> [--surah N] [--out dir]",
  );
  process.exit(2);
}
const surahArg = args.includes("--surah")
  ? parseInt(args[args.indexOf("--surah") + 1], 10)
  : null;
const outDir = args.includes("--out")
  ? resolve(args[args.indexOf("--out") + 1])
  : join(ROOT, "data", "gloss");

const raw = JSON.parse(readFileSync(resolve(inputPath), "utf8"));

if (raw._fixture && outDir === join(ROOT, "data", "gloss")) {
  console.error(
    "REFUSED: input is marked _fixture (test data, not a translation). " +
      "Fixtures may only be built with --out pointing outside data/gloss/.",
  );
  process.exit(1);
}
if (!raw._source || !raw._license) {
  console.error(
    "REFUSED: raw dump must carry _source (a data/sources.json id) and " +
      "_license — the licensing gate is not optional.",
  );
  process.exit(1);
}

const surahs = Object.keys(raw.surahs || {})
  .map(Number)
  .filter((n) => n >= 1 && n <= 114 && (!surahArg || n === surahArg))
  .sort((a, b) => a - b);
if (!surahs.length) {
  console.error("No surahs found in the dump (after --surah filter).");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

let totalVerses = 0;
const mismatches = [];

for (const s of surahs) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );
  const src = raw.surahs[String(s)];
  const out = {};
  for (const ayah of Object.keys(morph)
    .map(Number)
    .sort((a, b) => a - b)) {
    totalVerses++;
    const leedsCount = morph[String(ayah)].length;
    const glosses = (src && src[String(ayah)]) || null;
    if (!glosses || glosses.length !== leedsCount) {
      out[String(ayah)] = new Array(leedsCount).fill(null);
      mismatches.push(
        `${s}:${ayah} (leeds ${leedsCount} words, source ${glosses ? glosses.length : "absent"})`,
      );
    } else {
      out[String(ayah)] = glosses.map((g) => String(g));
    }
  }
  out._source = raw._source;
  out._license = raw._license;
  writeFileSync(
    join(outDir, `${s}.json`),
    JSON.stringify(out, Object.keys(out).sort((a, b) => {
      // numeric ayah keys first in order, then _license/_source
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    }), 1) + "\n",
  );
}

// Maintain the manifest (data/gloss/index.json): pages consult it first
// so the dormant/no-data state never issues a failing request. Merge
// with any surahs already present in the output dir's manifest.
let manifest = { surahs: [] };
try {
  manifest = JSON.parse(readFileSync(join(outDir, "index.json"), "utf8"));
} catch (e) {}
const merged = Array.from(new Set([...(manifest.surahs || []), ...surahs])).sort(
  (a, b) => a - b,
);
writeFileSync(
  join(outDir, "index.json"),
  JSON.stringify(
    {
      _comment:
        "Manifest of available per-word gloss files (data/gloss/{surah}.json). Maintained by scripts/build-gloss.mjs — empty until the owner commits a licensed gloss dataset (see the maintainer guide, 'Add word-by-word glosses'). Pages consult this manifest first so the dormant state makes no failing requests.",
      surahs: merged,
    },
    null,
    1,
  ) + "\n",
);

console.log(
  `Gloss files written for ${surahs.length} surah(s) into ${outDir} (manifest: ${merged.length})`,
);
if (mismatches.length) {
  console.error(`ALIGNMENT MISMATCHES (${mismatches.length}/${totalVerses} verses, null-filled):`);
  for (const m of mismatches) console.error("  - " + m);
}
if (mismatches.length / totalVerses > 0.02) {
  console.error(
    "FAIL: more than 2% of verses misaligned — the source's tokenization " +
      "does not match Leeds v0.4; do not ship this dataset without a " +
      "reconciliation step.",
  );
  process.exit(1);
}
