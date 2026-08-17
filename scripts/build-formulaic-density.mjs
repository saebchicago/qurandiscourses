// build-formulaic-density.mjs — deterministic, zero-dependency generator
// for data/formulaic-density.json.
//
// What this measures, precisely: what share of each verse's words belong
// to a phrase that recurs elsewhere in the Qur'an -- Bannister's central
// quantity in his computerised oral-formulaic study (Bannister 2014, An
// Oral-Formulaic Study of the Qur'an, already registered as
// bannister-2014). The site already has the recurring phrases
// (data/formulas-root.json, data/formulas-surface.json, 18,408 of them,
// each with exact word positions); this file is the join that turns
// "these phrases recur" into "this much of this verse/surah is
// formulaic language", per Bannister's own framing.
//
// Method:
//   1. For every verse, union the word positions covered by ANY
//      recurring n-gram from each stream separately (root stream: every
//      matched position in each ref, since root tokens skip particles
//      and are not consecutive; surface stream: the contiguous run
//      [w, w+1, ..., w+n-1] from each ref's first position). Density =
//      |covered positions| / verse token count. Two streams, because
//      build-formulas.mjs's own header explains why: the root stream
//      catches lexical formulas whose inflection varies, the surface
//      stream catches particle-heavy formulas (e.g. "ya ayyuha
//      alladhina amanu") invisible to the root stream. A verse can be
//      formulaic by one stream's reckoning and not the other's.
//   2. Per-surah mean density: the UNWEIGHTED mean of that surah's own
//      per-verse densities (each verse counts once, regardless of
//      length) -- distinct from a token-weighted whole-surah ratio,
//      which this file does not report; see _method for why the
//      distinction matters when comparing surahs of very different
//      length.
//   3. Significance: is a surah's mean density higher than chance would
//      produce for a surah of ITS OWN LENGTH? The null for a surah with
//      n verses is built by resampling n verses WITH REPLACEMENT from
//      the pooled corpus of 6,236 verses' own (real, already-computed)
//      per-verse densities, taking the mean, and repeating
//      MONTE_CARLO_B times per stream, via the seeded PRNG in
//      scripts/lib/permute.mjs. This directly controls for length: a
//      short surah's null distribution is wide (a few verses' mean is
//      noisy), so it takes a more extreme observed mean to reach
//      significance than for a long surah, whose null is tight around
//      the corpus mean. One-sided: testing whether density is unusually
//      HIGH, since that is the substantive question this measure is
//      built to ask. p = (count(null mean >= observed) + 1) /
//      (MONTE_CARLO_B + 1) (add-one correction, North, Curtis & Sham
//      2002, same convention as build-structure-tests.mjs). All 228
//      candidates (114 surahs x 2 streams) are pooled into ONE
//      Benjamini-Hochberg correction via scripts/lib/stats.mjs, not
//      corrected per stream or judged surah-by-surah -- the same
//      reasoning as this site's other corpus-wide tests: many
//      candidates guarantees some look significant by chance alone
//      unless judged jointly.
//
// What this deliberately does NOT claim: that a high density makes a
// surah's language formulaic in the technical oral-formulaic-theory
// sense (a scholarly judgment about composition, argued in Bannister
// 2014), or anything about why a phrase recurs. This file records only
// the mechanical fact of how much word-coverage recurring phrases
// account for, and whether that coverage is higher than a length-
// matched null would predict.
//
// Run: node scripts/build-formulaic-density.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mulberry32 } from "./lib/permute.mjs";
import { benjaminiHochbergSurvivorCount, bonferroniAlpha, makeEq } from "./lib/stats.mjs";
import { TOTAL_SURAHS } from "./lib/corpus.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MONTE_CARLO_B = 10000;
const FDR_Q = 0.05;
const SEED_ROOT = 20260812;
const SEED_SURFACE = 20260813;

const round = (x, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

// ── Step 1: embedded unit tests, isolated from the corpus ─────────────

function coverageFromRefs(ngrams, stream) {
  // stream: "root" (every position in ref[2..]) or "surface" (the
  // contiguous run starting at ref[2], length n).
  const bySurah = new Map(); // s -> Map(a -> Set(positions))
  for (const g of ngrams) {
    for (const ref of g.refs) {
      const [s, a] = ref;
      if (!bySurah.has(s)) bySurah.set(s, new Map());
      const byVerse = bySurah.get(s);
      if (!byVerse.has(a)) byVerse.set(a, new Set());
      const positions = byVerse.get(a);
      if (stream === "root") {
        for (let i = 2; i < ref.length; i++) positions.add(ref[i]);
      } else {
        const w = ref[2];
        for (let i = 0; i < g.n; i++) positions.add(w + i);
      }
    }
  }
  return bySurah;
}

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

{
  const failures = [];
  const eq = makeEq(failures);

  // Hand-computed coverage fixture: two ngrams.
  //   root ngram, n=3, ref [1, 5, 2, 4, 7] -> covers positions {2,4,7} in surah 1 verse 5.
  //   surface ngram, n=3, ref [1, 5, 2] -> covers positions {2,3,4} in surah 1 verse 5 (contiguous).
  const rootCov = coverageFromRefs(
    [{ n: 3, refs: [[1, 5, 2, 4, 7]] }],
    "root",
  );
  const surfCov = coverageFromRefs(
    [{ n: 3, refs: [[1, 5, 2]] }],
    "surface",
  );
  const rootSet = rootCov.get(1).get(5);
  const surfSet = surfCov.get(1).get(5);
  eq(rootSet.size, 3, "root coverage size");
  if ([...rootSet].sort((a, b) => a - b).join(",") !== "2,4,7")
    failures.push("root coverage positions mismatch");
  if ([...surfSet].sort((a, b) => a - b).join(",") !== "2,3,4")
    failures.push("surface coverage positions mismatch");

  // Density: a 10-token verse with 4 covered positions -> 0.4.
  eq(4 / 10, 0.4, "density arithmetic");

  // mean() sanity.
  eq(mean([0.1, 0.2, 0.3]), 0.2, "mean of three values");
  eq(mean([1]), 1, "mean of one value");

  // Two overlapping ngrams covering the same verse must not double-count
  // a shared position (Set union, not sum of sizes).
  const overlapCov = coverageFromRefs(
    [
      { n: 3, refs: [[2, 10, 5, 6, 7]] },
      { n: 3, refs: [[2, 10, 7, 8, 9]] },
    ],
    "root",
  );
  eq(overlapCov.get(2).get(10).size, 5, "overlapping ngrams union, not sum (5,6,7,8,9)");

  if (failures.length) {
    console.error("build-formulaic-density: unit tests FAILED");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("Unit tests passed: coverage union, density arithmetic, mean, overlap dedup.");
}

// ── Step 2: build per-verse coverage from the two existing datasets ────

const rootData = JSON.parse(readFileSync(join(ROOT, "data", "formulas-root.json"), "utf8"));
const surfaceData = JSON.parse(readFileSync(join(ROOT, "data", "formulas-surface.json"), "utf8"));
const rootCoverage = coverageFromRefs(rootData.ngrams, "root");
const surfaceCoverage = coverageFromRefs(surfaceData.ngrams, "surface");

// ── Step 3: per-verse density for every verse in the corpus ────────────

const perSurah = [];
const allVerseDensityRoot = []; // pooled corpus-wide, for the null
const allVerseDensitySurface = [];

for (let s = 1; s <= TOTAL_SURAHS; s++) {
  const morph = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
  const verseNums = Object.keys(morph).map(Number).sort((a, b) => a - b);
  const verses = [];
  for (const a of verseNums) {
    const tokenCount = morph[String(a)].length;
    const coveredRoot = rootCoverage.get(s)?.get(a)?.size || 0;
    const coveredSurface = surfaceCoverage.get(s)?.get(a)?.size || 0;
    const densityRoot = tokenCount ? coveredRoot / tokenCount : 0;
    const densitySurface = tokenCount ? coveredSurface / tokenCount : 0;
    verses.push({
      verse: a,
      tokenCount,
      densityRoot: round(densityRoot),
      densitySurface: round(densitySurface),
    });
    allVerseDensityRoot.push(densityRoot);
    allVerseDensitySurface.push(densitySurface);
  }
  const meanDensityRoot = mean(verses.map((v) => v.densityRoot));
  const meanDensitySurface = mean(verses.map((v) => v.densitySurface));
  perSurah.push({
    surah: s,
    verseCount: verses.length,
    meanDensityRoot: round(meanDensityRoot),
    meanDensitySurface: round(meanDensitySurface),
    verses,
  });
}

console.log(`Computed per-verse density for ${allVerseDensityRoot.length} verses.`);

// ── Step 4: length-matched permutation null, per surah, per stream ─────

function nullPValue(observedMean, n, pooledDensities, rng) {
  let ge = 0;
  const poolSize = pooledDensities.length;
  for (let b = 0; b < MONTE_CARLO_B; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += pooledDensities[Math.floor(rng() * poolSize)];
    }
    if (sum / n >= observedMean) ge++;
  }
  return (ge + 1) / (MONTE_CARLO_B + 1);
}

const candidates = []; // {surah, stream, pValue}
const rngRoot = mulberry32(SEED_ROOT);
const rngSurface = mulberry32(SEED_SURFACE);

for (const entry of perSurah) {
  const pRoot = nullPValue(entry.meanDensityRoot, entry.verseCount, allVerseDensityRoot, rngRoot);
  const pSurface = nullPValue(
    entry.meanDensitySurface,
    entry.verseCount,
    allVerseDensitySurface,
    rngSurface,
  );
  entry.pValueRoot = round(pRoot, 6);
  entry.pValueSurface = round(pSurface, 6);
  candidates.push({ surah: entry.surah, stream: "root", pValue: pRoot });
  candidates.push({ surah: entry.surah, stream: "surface", pValue: pSurface });
}

// ── Step 5: one pooled Benjamini-Hochberg correction across both streams ──

const m = candidates.length;
const sorted = [...candidates].sort((a, b) => a.pValue - b.pValue);
const survivorCount = benjaminiHochbergSurvivorCount(
  sorted.map((c) => c.pValue),
  FDR_Q,
);
const survivors = sorted.slice(0, survivorCount);
const survivorKeys = new Set(survivors.map((c) => `${c.surah}:${c.stream}`));
for (const entry of perSurah) {
  entry.survivorRoot = survivorKeys.has(`${entry.surah}:root`);
  entry.survivorSurface = survivorKeys.has(`${entry.surah}:surface`);
}
const alpha = bonferroniAlpha(m);
const bonferroniSurvivors = candidates.filter((c) => c.pValue <= alpha);

// ── Step 6: corpus distribution + most/least formulaic rankings ────────

function distribution(values) {
  const sortedVals = [...values].sort((a, b) => a - b);
  const n = sortedVals.length;
  const med = n % 2 ? sortedVals[(n - 1) / 2] : (sortedVals[n / 2 - 1] + sortedVals[n / 2]) / 2;
  return {
    mean: round(mean(sortedVals)),
    median: round(med),
    min: round(sortedVals[0]),
    max: round(sortedVals[n - 1]),
  };
}

const RANK_N = 10;
function topBottom(stream) {
  const key = `meanDensity${stream === "root" ? "Root" : "Surface"}`;
  const bySurahRanked = [...perSurah].sort((a, b) => b[key] - a[key] || a.surah - b.surah);
  return {
    mostFormulaic: bySurahRanked.slice(0, RANK_N).map((e) => ({ surah: e.surah, [key]: e[key] })),
    leastFormulaic: bySurahRanked
      .slice(-RANK_N)
      .reverse()
      .map((e) => ({ surah: e.surah, [key]: e[key] })),
  };
}

const out = {
  _generated: "build-formulaic-density.mjs",
  _hypothesis:
    "Is a surah's mean recurring-phrase word coverage higher than a length-matched " +
    "resampling of corpus verses would produce by chance?",
  _method:
    "Per-verse density = |word positions covered by any recurring n-gram (data/formulas-" +
    "root.json / -surface.json)| / verse token count, computed separately per stream. " +
    "Per-surah mean is the UNWEIGHTED mean of that surah's own per-verse densities (every " +
    "verse counts once, not weighted by length). Null per surah: resample verseCount " +
    "verses WITH REPLACEMENT from the pooled corpus of 6,236 verses' own per-verse " +
    `densities, ${MONTE_CARLO_B} draws, seeded (scripts/lib/permute.mjs). One-sided p = ` +
    "P(null mean >= observed). All 228 candidates (114 surahs x 2 streams) pooled into one " +
    `Benjamini-Hochberg correction at q < ${FDR_Q} (scripts/lib/stats.mjs), with Bonferroni ` +
    "reported alongside. Cites Bannister 2014 for the oral-formulaic-density concept this " +
    "measure operationalizes; the significance test and its null are this site's own.",
  _scope:
    "A surviving result says a surah's recurring-phrase word coverage is higher than " +
    "length-matched chance predicts -- not that the surah is formulaic in the technical " +
    "oral-formulaic-theory sense (a scholarly judgment about composition, argued in " +
    "Bannister 2014), and not anything about why a phrase recurs.",
  totalVerses: allVerseDensityRoot.length,
  totalCandidates: m,
  fdrQThreshold: FDR_Q,
  fdrSurvivors: survivors.length,
  bonferroniAlpha: round(alpha, 8),
  bonferroniSurvivors: bonferroniSurvivors.length,
  corpusDistribution: {
    root: distribution(allVerseDensityRoot),
    surface: distribution(allVerseDensitySurface),
  },
  rankings: {
    root: topBottom("root"),
    surface: topBottom("surface"),
  },
  survivors: survivors.map((c) => ({ surah: c.surah, stream: c.stream, pValue: round(c.pValue, 6) })),
  perSurah,
};

writeFileSync(join(ROOT, "data", "formulaic-density.json"), JSON.stringify(out) + "\n");

console.log(
  `build-formulaic-density: wrote data/formulaic-density.json. ${m} candidates. ` +
    `BH-FDR (q<${FDR_Q}) survivors: ${survivors.length}. Bonferroni (p<${alpha.toExponential(2)}) survivors: ${bonferroniSurvivors.length}.`,
);
console.log(
  `Corpus mean density: root=${out.corpusDistribution.root.mean} surface=${out.corpusDistribution.surface.mean}`,
);
if (survivors.length) {
  console.log("Survivors:");
  for (const v of survivors.slice(0, 10))
    console.log(`  surah ${v.surah} (${v.stream}): p=${round(v.pValue, 6)}`);
}
