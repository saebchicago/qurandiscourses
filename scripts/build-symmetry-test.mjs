// build-symmetry-test.mjs — deterministic, zero-dependency generator for
// data/symmetry-test.json.
//
// What this tests: a specific, narrow, mechanical proxy for "positional
// symmetry" — do a surah's rarest content roots (occurring exactly twice in
// that surah) tend to sit at matching distances from the surah's start and
// end? For a root at verses (a, b) in a surah of n verses:
//   distanceFromStart = a
//   distanceFromEnd   = n - b + 1
//   variance          = |distanceFromStart - distanceFromEnd|
// A smaller variance means the two occurrences are closer to mirror
// positions.
//
// This is NOT a test of literary ring composition as studied by scholars
// (Cuypers 2015 et al.), which analyzes thematic and semantic parallels
// across a chapter, not raw lexical position. It only checks whether this
// one narrow, easily-computed proxy shows a signal beyond chance — see
// patterns.html for how this result is presented alongside that
// literature.
//
// Method (a proper significance test, not a fixed arbitrary tolerance):
//   1. For every surah of length n, enumerate the EXACT null distribution
//      of `variance` over all C(n,2) equally likely position pairs (not a
//      Monte Carlo approximation — n <= 286, so exhaustive enumeration is
//      cheap and exact).
//   2. For each observed rare-root pair with variance v, its one-sided
//      p-value is P(variance <= v) under that surah's exact null — i.e.
//      "how often would a randomly placed pair be at least this
//      well-matched, in a surah this long?"
//   3. Roots occurring more than FREQUENCY_CEILING times corpus-wide are
//      excluded (same rule as build-cooccurrence.mjs / build-discursive-
//      pivots.mjs) — irrelevant in practice here, since a root that
//      frequent essentially never occurs exactly twice in one surah, but
//      kept for consistency.
//   4. Benjamini-Hochberg FDR correction at q < 0.05 across ALL candidate
//      pairs corpus-wide (not per-surah — testing thousands of roots
//      guarantees some will look "significant" by luck alone if each
//      surah is judged in isolation).
//
// To reproduce: node scripts/build-symmetry-test.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const rootsSummary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);

const FREQUENCY_CEILING = 700;
const excludedRoots = new Set(
  Object.entries(rootsSummary)
    .filter(([, meta]) => meta.totalCount > FREQUENCY_CEILING)
    .map(([bw]) => bw),
);

const FDR_Q = 0.05;

// Exact null distribution of `variance` for a surah of length n, sorted
// ascending. Memoized since many surahs share a length.
const nullCache = new Map();
function exactNullVariances(n) {
  if (nullCache.has(n)) return nullCache.get(n);
  const vs = [];
  for (let a = 1; a <= n; a++) {
    for (let b = a + 1; b <= n; b++) {
      vs.push(Math.abs(a - (n - b + 1)));
    }
  }
  vs.sort((x, y) => x - y);
  nullCache.set(n, vs);
  return vs;
}

// Count of values <= target in a sorted array (binary search).
function countLE(sortedArr, target) {
  let lo = 0,
    hi = sortedArr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedArr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const candidates = [];

for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );
  const n = Object.keys(morph).length;

  const rootPositions = {};
  for (const [v, words] of Object.entries(morph)) {
    for (const w of words) {
      const r = w.root;
      if (!r || excludedRoots.has(r)) continue;
      if (!rootPositions[r]) rootPositions[r] = new Set();
      rootPositions[r].add(Number(v));
    }
  }

  const nullVs = exactNullVariances(n);
  const totalPairs = nullVs.length;

  for (const [r, positions] of Object.entries(rootPositions)) {
    if (positions.size !== 2) continue;
    const [a, b] = [...positions].sort((x, y) => x - y);
    const variance = Math.abs(a - (n - b + 1));
    const p = countLE(nullVs, variance) / totalPairs;
    candidates.push({
      surah: s,
      root: r,
      rootLatin: rootsSummary[r]?.rootLatin || r,
      arabic: rootsSummary[r]?.rootArabic || "",
      verseA: a,
      verseB: b,
      surahVerseCount: n,
      variance,
      pValue: p,
    });
  }
}

// Benjamini-Hochberg: sort by p ascending, find the largest rank k where
// p(k) <= (k/m) * FDR_Q; everything at or before that rank survives.
const m = candidates.length;
const sorted = [...candidates].sort((x, y) => x.pValue - y.pValue);
let maxK = 0;
for (let i = 0; i < m; i++) {
  const rank = i + 1;
  if (sorted[i].pValue <= (rank / m) * FDR_Q) maxK = rank;
}
const survivors = sorted.slice(0, maxK);

// Bonferroni, for comparison (stricter, reported alongside BH).
const bonferroniAlpha = 0.05 / m;
const bonferroniSurvivors = candidates.filter(
  (c) => c.pValue <= bonferroniAlpha,
);

// Closest misses: lowest p-values that did NOT survive correction — kept
// for transparency (so a reader can see how close the strongest candidate
// actually got), never presented as a finding.
const closestMisses = sorted.slice(0, 5).map((c) => ({
  surah: c.surah,
  root: c.root,
  rootLatin: c.rootLatin,
  arabic: c.arabic,
  verseA: c.verseA,
  verseB: c.verseB,
  surahVerseCount: c.surahVerseCount,
  variance: c.variance,
  pValue: Math.round(c.pValue * 1e6) / 1e6,
}));

const out = {
  _generated: "build-symmetry-test.mjs",
  _hypothesis:
    "Do a surah's rarest content roots (occurring exactly twice) sit at " +
    "matching distances from the surah's start and end, more often than " +
    "chance placement would predict?",
  _method:
    "Exact per-surah-length null distribution of position-pair variance " +
    "(exhaustive enumeration, not simulation); one-sided p-value per " +
    "candidate root pair; Benjamini-Hochberg FDR correction at q<0.05 " +
    "across all candidates corpus-wide. Roots with corpus-wide frequency " +
    `> ${FREQUENCY_CEILING} excluded as counting subjects (consistent with ` +
    "build-cooccurrence.mjs), though such roots essentially never occur " +
    "exactly twice in one surah in practice.",
  _scope:
    "This tests one narrow, mechanical proxy for positional symmetry, not " +
    "the literary ring-composition scholarship cited on patterns.html " +
    "(which analyzes thematic and semantic parallels, not raw lexical " +
    "position). A null result here says nothing about that literature.",
  totalCandidates: m,
  fdrQThreshold: FDR_Q,
  fdrSurvivors: survivors.length,
  bonferroniAlpha,
  bonferroniSurvivors: bonferroniSurvivors.length,
  survivors,
  closestMisses,
};

writeFileSync(
  join(ROOT, "data", "symmetry-test.json"),
  JSON.stringify(out, null, 1) + "\n",
);

console.log(`Candidates tested: ${m}`);
console.log(`BH-FDR (q<${FDR_Q}) survivors: ${survivors.length}`);
console.log(
  `Bonferroni (p<${bonferroniAlpha.toExponential(2)}) survivors: ${bonferroniSurvivors.length}`,
);
console.log("Closest misses:");
for (const c of closestMisses) {
  console.log(
    `  surah ${c.surah} ${c.rootLatin} verses ${c.verseA}-${c.verseB} (n=${c.surahVerseCount}) variance=${c.variance} p=${c.pValue}`,
  );
}
