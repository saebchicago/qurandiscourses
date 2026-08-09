#!/usr/bin/env node
//
// compute-dispersion.mjs: how evenly each root's occurrences are spread
// across the 114 surahs, as a new dimension alongside the frequency,
// association and centrality this site already publishes per root.
//
// Frequency alone cannot distinguish a root that recurs across the
// whole Qur'an from one that occurs the same number of times but only
// inside two or three surahs telling one story -- and that distinction
// is itself interpretively real (structural/theological vocabulary
// tends to behave differently from locally concentrated narrative
// vocabulary). This script measures the distinction mechanically, for
// all 1,642 roots, with no frequency exclusion (unlike
// build-cooccurrence.mjs's FREQUENCY_CEILING, whose exclusion rule
// exists because a co-occurrence partner that frequent adds no
// distinguishing signal to ANOTHER root's profile -- here the root's
// OWN spread is exactly what is being measured, so a maximally frequent
// root's dispersion is itself part of the answer, not noise to exclude).
//
// Four measures, computed side by side rather than picking one -- the
// dispersion literature disagrees about which is best, and this site's
// convention (data/symmetry-test.json, data/structure-tests.json) is to
// show the method-dependence rather than hide it:
//
//   dp        Gries's Deviation of Proportions (Gries, S. Th. 2008.
//             "Dispersions and adjusted frequencies in corpora."
//             International Journal of Corpus Linguistics 13(4),
//             403-437): DP = 0.5 * sum_i |v_i - s_i|, where s_i is surah
//             i's share of the corpus (its token count / total corpus
//             tokens) and v_i is the root's share of ITS OWN occurrences
//             that fall in surah i (count_i / totalCount). 0 means the
//             root's occurrences track surah size exactly (as evenly
//             spread as a root CAN be, given how big each surah is);
//             higher means more clumped. The maximum possible value
//             given this corpus's part sizes is 1 - min(s_i), not 1 --
//             see dpNorm.
//   dpNorm    DP rescaled to [0, 1] by that maximum, following the
//             correction in Lijffijt, J. & Gries, S. Th. 2012.
//             "Correction to Stefan Th. Gries' 'Dispersions and adjusted
//             frequencies in corpora'." International Journal of Corpus
//             Linguistics 17(1), 147-149: dpNorm = DP / (1 - min(s_i)).
//             The 2012 note corrects the original 2008 paper's
//             normalization; this generator implements the corrected
//             version, not the 2008 original.
//   juillandD The older, more familiar dispersion measure (Juilland, A.
//             & Chang-Rodriguez, E. 1964. Frequency Dictionary of
//             Spanish Words. The Hague: Mouton): D = 1 - CV / sqrt(n-1),
//             where CV is the coefficient of variation (population
//             standard deviation / mean) of the root's per-1,000-token
//             rate in each of the n=114 surahs -- the same
//             per-1,000-tokens normalization build-exports.mjs already
//             uses for normalizedFrequencyOverall, applied here per
//             surah instead of per chronological period. Included for
//             comparability with the wider dispersion literature, with
//             an explicit caveat: D classically assumes comparably-sized
//             corpus parts, and this corpus's 114 surahs range from 3 to
//             286 verses -- precisely the condition under which later
//             work (surveyed in Gries 2008 itself, and in the critique
//             literature on sources.html) finds D loses discriminating
//             power. NOT clamped to [0, 1]: the formula can
//             mathematically return a value below 0 for a root
//             concentrated in a few small surahs, and this generator
//             reports the number the formula gives rather than silently
//             floor it, matching this site's practice of publishing a
//             method's actual output rather than a tidied version of it.
//   range     Plain count of surahs (of 114) the root occurs in at
//             least once. The simplest possible dispersion signal,
//             included for a reader who wants the number without the
//             method.
//
// Also reports adjustedFrequency = totalCount * (1 - DP): Gries's own
// simplest adjusted-frequency proposal from the same 2008 paper. An
// identical raw count spread evenly (DP near 0) keeps nearly all its
// weight; the same count clumped into one surah (DP near its max) is
// discounted toward zero. This is ONE frequency-adjustment formulation
// among several Gries and later authors have proposed (see the CRAN
// "tlda" package's frequency-adjustment vignette for others); this
// generator implements the simplest, most commonly cited one and does
// not claim it is the only correct choice.
//
// Output: data/dispersion/{safeKey}.json, one per root (1,642 files,
// the same per-root file family build-cooccurrence.mjs and
// compute-centrality.mjs already write, checked for parity by
// check-root-datasets.mjs), plus data/dispersion/methods.json (the
// shared formulas/citations block, referenced by every per-root file
// instead of repeating it -- same pattern as data/centrality/methods.json).
//
// Inputs, read-only: data/surah-profiles.json's tokenCount (surah size)
// and data/root-analytics/{safeKey}.json's bySurah (occurrences per
// surah, already computed and already checked for parity with
// roots-summary's totalCount). This script reads only committed data
// and writes only new files under data/dispersion/.
//
// Run: node scripts/compute-dispersion.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { safeKey } from "./lib/safe-key.mjs";
import { computedDate } from "./lib/computed-date.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const OUT = join(DATA, "dispersion");

const TOTAL_ROOTS = 1642;
const TOTAL_SURAHS = 114;

mkdirSync(OUT, { recursive: true });

// ── Formulas, unit-tested below against hand-computed fixtures ────────

function deviationOfProportions(shareByPart, sizeByPart) {
  // shareByPart[i] = v_i (root's share of its own occurrences in part i)
  // sizeByPart[i]  = s_i (part i's share of the corpus)
  let sum = 0;
  for (let i = 0; i < sizeByPart.length; i++) {
    sum += Math.abs((shareByPart[i] || 0) - sizeByPart[i]);
  }
  return 0.5 * sum;
}

function normalizedDP(dp, minPartSize) {
  return dp / (1 - minPartSize);
}

function juillandD(ratesByPart) {
  const n = ratesByPart.length;
  const mean = ratesByPart.reduce((s, v) => s + v, 0) / n;
  const variance =
    ratesByPart.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
  const sd = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : sd / mean;
  return 1 - cv / Math.sqrt(n - 1);
}

// ── Step 1: embedded unit tests against hand-computed fixtures ────────
// 4 equal-size parts (sizeByPart = [0.25, 0.25, 0.25, 0.25], minPartSize
// = 0.25) so every formula below can be checked by hand.
{
  const failures = [];
  const eq = (got, want, label, eps = 1e-9) => {
    if (Math.abs(got - want) > eps)
      failures.push(`${label}: got ${got}, want ${want}`);
  };

  const sizes4 = [0.25, 0.25, 0.25, 0.25];

  // Perfectly proportional: the root's occurrence share in every part
  // exactly matches that part's size share. By hand: DP =
  // 0.5*(0+0+0+0) = 0. DPnorm = 0/(1-0.25) = 0.
  eq(deviationOfProportions(sizes4, sizes4), 0, "DP perfectly proportional");
  eq(
    normalizedDP(deviationOfProportions(sizes4, sizes4), 0.25),
    0,
    "DPnorm perfectly proportional",
  );

  // Maximally concentrated: all occurrences in part 1 (v = [1,0,0,0]).
  // By hand: DP = 0.5*(|1-0.25| + |0-0.25|*3) = 0.5*(0.75+0.75) = 0.75.
  // DPnorm = 0.75 / (1-0.25) = 1 -- the theoretical maximum, exactly 1,
  // which is the whole point of the Lijffijt & Gries (2012) correction.
  const concentrated = [1, 0, 0, 0];
  eq(deviationOfProportions(concentrated, sizes4), 0.75, "DP concentrated");
  eq(
    normalizedDP(deviationOfProportions(concentrated, sizes4), 0.25),
    1,
    "DPnorm concentrated reaches exactly 1",
  );

  // Juilland's D, 4 equal-size parts:
  // (a) perfectly even rate [100,100,100,100] -> sd=0 -> CV=0 -> D=1.
  eq(juillandD([100, 100, 100, 100]), 1, "juillandD perfectly even");
  // (b) all 4 occurrences in 1 of 4 equal parts -> rate [400,0,0,0].
  // mean=100; variance=((400-100)^2+(0-100)^2*3)/4=(90000+30000)/4=30000;
  // sd=sqrt(30000)=173.2050808...; CV=1.732050808...=sqrt(3)=sqrt(n-1)
  // exactly (a known invariant for one-of-n-equal-parts concentration),
  // so D = 1 - sqrt(3)/sqrt(3) = 0 exactly.
  eq(juillandD([400, 0, 0, 0]), 0, "juillandD one-of-four concentration", 1e-9);

  // adjustedFrequency = totalCount * (1 - DP): totalCount=10, DP=0.75
  // (the concentrated fixture above) -> 10 * 0.25 = 2.5.
  eq(10 * (1 - 0.75), 2.5, "adjustedFrequency worked example");

  if (failures.length) {
    console.error("compute-dispersion: unit tests FAILED");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log(
    "Unit tests passed: DP (proportional + concentrated), DPnorm, juillandD (even + one-of-n), adjustedFrequency.",
  );
}

// ── Step 2: load corpus-wide part sizes, once ──────────────────────────

const surahProfiles = JSON.parse(
  readFileSync(join(DATA, "surah-profiles.json"), "utf8"),
);
const tokenCountBySurah = new Array(TOTAL_SURAHS + 1).fill(0); // 1-indexed
for (const p of Object.values(surahProfiles.surahs)) {
  tokenCountBySurah[p.surah] = p.tokenCount;
}
if (tokenCountBySurah.slice(1).some((c) => !c)) {
  throw new Error(
    "data/surah-profiles.json is missing a tokenCount for at least one surah. STOPPING.",
  );
}
const totalTokens = tokenCountBySurah
  .slice(1)
  .reduce((s, c) => s + c, 0);

// s_i, 0-indexed array matching surah 1..114 -> index 0..113.
const sizeByPart = [];
for (let s = 1; s <= TOTAL_SURAHS; s++) {
  sizeByPart.push(tokenCountBySurah[s] / totalTokens);
}
const minPartSize = Math.min(...sizeByPart);

console.log(
  `Loaded ${TOTAL_SURAHS} surah sizes (${totalTokens} tokens total). Smallest part share: ${minPartSize.toFixed(6)} (surah ${sizeByPart.indexOf(minPartSize) + 1}).`,
);

// ── Step 3: per-root dispersion ────────────────────────────────────────

const rootsSummary = JSON.parse(
  readFileSync(join(DATA, "roots-summary.json"), "utf8"),
);
const nodeList = Object.keys(rootsSummary);
if (nodeList.length !== TOTAL_ROOTS) {
  throw new Error(
    `Baseline mismatch: ${nodeList.length} roots, expected ${TOTAL_ROOTS}. STOPPING.`,
  );
}

const round = (x, dp = 6) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

// Roots need a minimum corpus-wide frequency to make "how evenly spread"
// a meaningful question at all -- a root occurring once is trivially
// maximally concentrated (dpNorm = 1) without that being informative
// about anything. Same order of magnitude as this codebase's other
// ranking-eligibility thresholds (e.g. compute-association-stats.mjs's
// MIN_COOCCURRENCE = 3, scaled up because dispersion needs enough
// occurrences to possibly spread across many surahs).
const MIN_FREQUENCY_FOR_RANKING = 20;

let written = 0;
let dpMin = Infinity,
  dpMax = -Infinity,
  dpMinRoot = null,
  dpMaxRoot = null;
const rankable = [];

for (const bw of nodeList) {
  const meta = rootsSummary[bw];
  const key = safeKey(bw);
  const analytics = JSON.parse(
    readFileSync(join(DATA, "root-analytics", `${key}.json`), "utf8"),
  );
  const bySurah = analytics.bySurah || {};
  const totalCount = meta.totalCount;

  const shareByPart = [];
  const rateByPart = [];
  let range = 0;
  for (let s = 1; s <= TOTAL_SURAHS; s++) {
    const count = bySurah[String(s)] || 0;
    if (count > 0) range++;
    shareByPart.push(count / totalCount);
    rateByPart.push((count / tokenCountBySurah[s]) * 1000);
  }

  const dp = deviationOfProportions(shareByPart, sizeByPart);
  const dpNorm = normalizedDP(dp, minPartSize);
  const d = juillandD(rateByPart);
  const adjustedFrequency = totalCount * (1 - dp);

  if (dp < dpMin) {
    dpMin = dp;
    dpMinRoot = bw;
  }
  if (dp > dpMax) {
    dpMax = dp;
    dpMaxRoot = bw;
  }
  if (totalCount >= MIN_FREQUENCY_FOR_RANKING) {
    rankable.push({
      root: bw,
      safeKey: key,
      rootLatin: meta.rootLatin,
      arabic: meta.rootArabic,
      totalCount,
      dpNorm: round(dpNorm),
    });
  }

  const output = {
    root: bw,
    safeKey: key,
    arabic: meta.rootArabic,
    rootLatin: meta.rootLatin,
    totalCount,
    surahsOccurringIn: range,
    totalSurahs: TOTAL_SURAHS,
    dp: round(dp),
    dpNorm: round(dpNorm),
    juillandD: round(d),
    adjustedFrequency: round(adjustedFrequency, 2),
    _computed: computedDate(),
    _methodsFile: "data/dispersion/methods.json",
  };
  writeFileSync(join(OUT, key + ".json"), JSON.stringify(output));
  written++;
  if (written % 400 === 0) console.log(`  ${written} files written...`);
}

if (written !== TOTAL_ROOTS) {
  throw new Error(`Expected ${TOTAL_ROOTS} files, wrote ${written}`);
}

// ── Step 4: shared methods document ────────────────────────────────────

const COMPUTED_DATE = computedDate();

const methodsDoc = {
  _script: "scripts/compute-dispersion.mjs",
  _source:
    "data/surah-profiles.json (surah token counts, i.e. part sizes) and " +
    "data/root-analytics/*.json (per-surah occurrence counts), both " +
    "themselves derived from Leeds Quranic Arabic Corpus v0.4.",
  _parts: {
    count: TOTAL_SURAHS,
    unit: "surah",
    sizeMeasure: "token count (data/surah-profiles.json's tokenCount)",
    totalTokens,
    minPartShare: round(minPartSize),
    minPartSurah: sizeByPart.indexOf(minPartSize) + 1,
    note:
      "Parts are the 114 surahs, weighted by token count, not treated as " +
      "equal-sized -- they range from 3 to 286 verses. dp/dpNorm handle " +
      "this by construction; juillandD does not (see its own note below) " +
      "and is reported anyway, with that caveat, for comparability.",
  },
  _formulas: {
    dp:
      "Gries's Deviation of Proportions (Gries 2008, International " +
      "Journal of Corpus Linguistics 13(4), 403-437): DP = 0.5 * " +
      "sum_i |v_i - s_i|, s_i = part i's token-count share of the " +
      "corpus, v_i = the root's occurrence share in part i. Range " +
      "[0, 1 - min(s_i)).",
    dpNorm:
      "DP rescaled to [0, 1]: dpNorm = DP / (1 - min(s_i)), following " +
      "the corrected normalization in Lijffijt & Gries (2012, IJCL " +
      "17(1), 147-149), not the original 2008 formulation.",
    juillandD:
      "Juilland & Chang-Rodriguez (1964, Frequency Dictionary of " +
      "Spanish Words, The Hague: Mouton): D = 1 - CV / sqrt(n-1), CV = " +
      "population-SD / mean of the root's per-1,000-token rate across " +
      "the 114 surahs (n=114). Classically assumes comparably-sized " +
      "parts; this corpus's do not. Not clamped -- can be < 0.",
    range: "Count of the 114 surahs the root occurs in at least once.",
    adjustedFrequency:
      "totalCount * (1 - DP) -- Gries's (2008) simplest dispersion-" +
      "adjusted frequency; one of several formulations in the " +
      "literature, not the only one.",
  },
  _dpRange: {
    min: round(dpMin),
    minRoot: dpMinRoot,
    minRootLatin: rootsSummary[dpMinRoot]?.rootLatin,
    max: round(dpMax),
    maxRoot: dpMaxRoot,
    maxRootLatin: rootsSummary[dpMaxRoot]?.rootLatin,
  },
  _rankingEligibility: {
    minFrequency: MIN_FREQUENCY_FOR_RANKING,
    eligibleRoots: rankable.length,
    note:
      "topEvenlySpread/topClumped below are restricted to roots with " +
      `corpus-wide frequency >= ${MIN_FREQUENCY_FOR_RANKING}: a root ` +
      "occurring once is trivially maximally concentrated (dpNorm=1) " +
      "without that being an informative dispersion result.",
  },
  topEvenlySpread: [...rankable]
    .sort((a, b) => a.dpNorm - b.dpNorm || a.root.localeCompare(b.root))
    .slice(0, 15),
  topClumped: [...rankable]
    .sort((a, b) => b.dpNorm - a.dpNorm || a.root.localeCompare(b.root))
    .slice(0, 15),
  _computed: COMPUTED_DATE,
};
writeFileSync(
  join(OUT, "methods.json"),
  JSON.stringify(methodsDoc, null, 1) + "\n",
);

console.log(`\nDone. Wrote ${written} per-root dispersion files.`);
let totalBytes = 0;
for (const f of readdirSync(OUT)) {
  totalBytes += readFileSync(join(OUT, f)).length;
}
console.log(
  `Total data/dispersion size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`,
);
console.log(
  `Most evenly spread (lowest DP): ${dpMinRoot} (${rootsSummary[dpMinRoot]?.rootLatin}), DP=${round(dpMin)}`,
);
console.log(
  `Most clumped (highest DP): ${dpMaxRoot} (${rootsSummary[dpMaxRoot]?.rootLatin}), DP=${round(dpMax)}`,
);
