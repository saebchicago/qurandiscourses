#!/usr/bin/env node
//
// build-cooccurrence.mjs: generate filtered per-root co-occurrence JSON.
//
// Source: Leeds Quranic Arabic Corpus v0.4 (Kais Dukes, corpus.quran.com, GPL)
//
// Output: data/cooccurrence/{safeKey}.json (one file per root, ~1,642 files)
//
// This is a SEPARATE, filtered view of root co-occurrence, distinct from the
// unfiltered "coRoots" field already present in data/root-analytics/*.json.
// It does not read or write anything under data/root-analytics.
//
// Computation method:
//   - Window: verse-level. Two roots co-occur once for every verse in which
//     both are attested, regardless of order, distance, or repetition
//     within the verse (a root appearing twice in one verse still counts as
//     one co-occurrence with a verse-mate for that verse).
//   - Exclusion rule: roots whose corpus-wide frequency (roots-summary.json
//     totalCount) exceeds FREQUENCY_CEILING are treated as function-word-like
//     and are never listed as a co-occurring PARTNER for any root (they can
//     still be the subject root of their own file). At the chosen ceiling
//     of 700, this excludes exactly 6 roots: Alh (a-l-h, 2851), qwl
//     (q-w-l, 1722), kwn (k-w-n, 1390), rbb (r-b-b, 980), Amn (a-m-n, 879),
//     Elm (ʿ-l-m, 854). These occur so often that nearly every root
//     co-occurs with them; keeping them in would make every root's top-12
//     list look the same and would add no distinguishing signal.
//   - Ranking: remaining partners sorted by co-occurrence count descending,
//     top 12 kept.
//
// Also writes byChronologyCoRoots: the same verse-level co-occurrence
// computation, partitioned by data/chronology.json's four-period
// classification (meccan-early/middle/late, medinan — Egyptian Standard
// revelation order per Watt's "Bell's Introduction to the Qur'an", already
// used elsewhere on this site for roots-summary.json's byChronology
// counts). Same exclusion rule; top 6 kept per period since each period's
// verse pool is smaller. A period is included only if roots-summary.json
// already reports at least one attestation of the subject root in it.
//
// To reproduce: node scripts/build-cooccurrence.mjs
//

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const OUT = join(DATA, "cooccurrence");

const FREQUENCY_CEILING = 700;
const TOP_N = 12;
const TOP_N_CHRON = 6;
const PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];

mkdirSync(OUT, { recursive: true });

const chronology = JSON.parse(
  readFileSync(join(DATA, "chronology.json"), "utf8"),
);

// Buckwalter encoding is case-sensitive but macOS filesystems are case-insensitive.
// Scheme mirrors scripts/build-root-analytics.mjs exactly, so filenames here
// match the existing data/root-analytics/{safeKey}.json naming.
function safeKey(bw) {
  let out = "";
  for (const c of bw) {
    if (c === "*") out += "dh";
    else if (c === "$") out += "sh";
    else if (c >= "A" && c <= "Z") out += "u" + c;
    else out += c;
  }
  return out;
}

const rootsSummary = JSON.parse(readFileSync(join(DATA, "roots-summary.json"), "utf8"));

const excludedRoots = new Set(
  Object.entries(rootsSummary)
    .filter(([, meta]) => meta.totalCount > FREQUENCY_CEILING)
    .map(([bw]) => bw),
);

console.log(`Function-word frequency ceiling: ${FREQUENCY_CEILING}`);
console.log(`Excluded roots (${excludedRoots.size}):`);
for (const bw of excludedRoots) {
  const meta = rootsSummary[bw];
  console.log(`  ${meta.rootArabic} (${meta.rootLatin}): ${meta.totalCount}`);
}

console.log("\nPass 1: scanning morphology files…");

// rootTokenCount[bw] = number of tokens with this root (for sanity check only)
const rootTokenCount = {};
// verseRoots["s:v"] = Set<bw>
const verseRoots = {};

for (let s = 1; s <= 114; s++) {
  const path = join(DATA, "morphology", `${s}.json`);
  if (!existsSync(path)) {
    console.warn(`  MISSING: morphology/${s}.json`);
    continue;
  }
  const morph = JSON.parse(readFileSync(path, "utf8"));
  for (const [v, words] of Object.entries(morph)) {
    const ref = `${s}:${v}`;
    for (const w of words) {
      const bw = w.root;
      if (!bw) continue;
      rootTokenCount[bw] = (rootTokenCount[bw] || 0) + 1;
      if (!verseRoots[ref]) verseRoots[ref] = new Set();
      verseRoots[ref].add(bw);
    }
  }
}

console.log(`  Roots found: ${Object.keys(rootTokenCount).length} (expected 1,642)`);

console.log("\nPass 2: building verse-level co-occurrence counts…");

// coOcc[r1][r2] = count of verses where both r1 and r2 are attested
const coOcc = {};
// coOccByPeriod[period][r1][r2] = same, restricted to verses in that period
const coOccByPeriod = {};
for (const p of PERIODS) coOccByPeriod[p] = {};

for (const [ref, roots] of Object.entries(verseRoots)) {
  const surah = ref.split(":")[0];
  const period = chronology[surah]?.period;
  const arr = [...roots];
  for (const r1 of arr) {
    if (!coOcc[r1]) coOcc[r1] = {};
    for (const r2 of arr) {
      if (r1 !== r2) {
        coOcc[r1][r2] = (coOcc[r1][r2] || 0) + 1;
      }
    }
    if (period) {
      if (!coOccByPeriod[period][r1]) coOccByPeriod[period][r1] = {};
      for (const r2 of arr) {
        if (r1 !== r2) {
          coOccByPeriod[period][r1][r2] =
            (coOccByPeriod[period][r1][r2] || 0) + 1;
        }
      }
    }
  }
}

console.log("\nPass 3: writing filtered co-occurrence files…");

const COMPUTED_DATE = new Date().toISOString().slice(0, 10);
const METHOD_NOTE =
  "Counted at verse level: two roots co-occur once for each verse in which " +
  "both are attested. Roots occurring more than " +
  FREQUENCY_CEILING +
  " times across the whole corpus are excluded as counting partners " +
  "(treated as function-word-like given their extreme frequency); the top " +
  TOP_N +
  " remaining partners are kept, ranked by co-occurrence count. " +
  "Co-occurrence describes distribution in the text. It does not by " +
  "itself establish meaning.";

let written = 0;

for (const bw of Object.keys(rootsSummary)) {
  const meta = rootsSummary[bw];
  const coMap = coOcc[bw] || {};

  const coRoots = Object.entries(coMap)
    .filter(([r2]) => !excludedRoots.has(r2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([r, count]) => ({
      root: r,
      safeKey: safeKey(r),
      arabic: rootsSummary[r]?.rootArabic || "",
      rootLatin: rootsSummary[r]?.rootLatin || r,
      count,
    }));

  const byChronologyCoRoots = {};
  for (const p of PERIODS) {
    if (!meta.byChronology || !meta.byChronology[p]) continue;
    const pMap = coOccByPeriod[p][bw] || {};
    const partners = Object.entries(pMap)
      .filter(([r2]) => !excludedRoots.has(r2))
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N_CHRON)
      .map(([r, count]) => ({
        root: r,
        safeKey: safeKey(r),
        arabic: rootsSummary[r]?.rootArabic || "",
        rootLatin: rootsSummary[r]?.rootLatin || r,
        count,
      }));
    if (partners.length) byChronologyCoRoots[p] = partners;
  }

  const output = {
    root: bw,
    safeKey: safeKey(bw),
    arabic: meta.rootArabic,
    rootLatin: meta.rootLatin,
    coRoots,
    byChronologyCoRoots,
    _source: "Leeds Quranic Arabic Corpus v0.4 (Kais Dukes, corpus.quran.com, GPL)",
    _window: "verse-level (same-verse attestation)",
    _exclusionRule: `Corpus-wide frequency > ${FREQUENCY_CEILING} treated as function-word-like and excluded as a partner`,
    _excludedRoots: [...excludedRoots].map((r) => rootsSummary[r]?.rootLatin || r),
    _topN: TOP_N,
    _chronologySource:
      "Egyptian Standard (Cairo 1924) revelation order, four-period classification following Nöldeke-Bell tradition (Watt, \"Bell's Introduction to the Qur'an\", 1970) — same periodization as data/chronology.json.",
    _chronologyTopN: TOP_N_CHRON,
    _method: METHOD_NOTE,
    _computed: COMPUTED_DATE,
  };

  writeFileSync(join(OUT, safeKey(bw) + ".json"), JSON.stringify(output));
  written++;
  if (written % 400 === 0) console.log(`  ${written} files written…`);
}

console.log(`\nDone. Wrote ${written} co-occurrence files to data/cooccurrence/`);

// Sanity check against expected count
if (written !== 1642) {
  console.error(`ERROR: expected 1,642 files, wrote ${written}`);
  process.exit(1);
}

// Report total output size
let totalBytes = 0;
for (const f of readdirSync(OUT)) {
  totalBytes += statSync(join(OUT, f)).size;
}
const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`Total data/cooccurrence size: ${totalMB} MB`);
if (totalBytes > 15 * 1024 * 1024) {
  console.warn(`WARNING: output exceeds 15MB budget (${totalMB} MB).`);
}

// Spot-check roots named in the task
console.log("\nSpot-check (top 5 shown):");
for (const bw of ["rHm", "Sbr"]) {
  const sk = safeKey(bw);
  const data = JSON.parse(readFileSync(join(OUT, sk + ".json"), "utf8"));
  console.log(`  ${data.arabic} (${data.rootLatin}):`);
  for (const cr of data.coRoots.slice(0, 5)) {
    console.log(`    ${cr.arabic} (${cr.rootLatin}): ${cr.count}`);
  }
}
