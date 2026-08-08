// build-structure-tests.mjs — deterministic, zero-dependency generator for
// data/structure-tests.json.
//
// What this tests: whether the sections a surah was mechanically divided
// into (data/structure/{s}.json, built by build-structure.mjs) exhibit
// block-level mirror symmetry — the shape ring composition and inclusio
// scholarship describes, as opposed to build-symmetry-test.mjs's much
// narrower point-pair proxy (whether individual rare roots occurring
// exactly twice sit at mirror distances). Four tests, all over the SAME
// sections, none touching build-symmetry-test.mjs's own result:
//
//   concentricParallelism  mean Jaccard similarity of content-root sets
//                          between section i and section (K+1-i), for
//                          every mirrored pair (K = section count; an odd
//                          middle section is left unpaired)
//   inclusio               Jaccard similarity of the first section against
//                          the last — the classic bookend, a special case
//                          of the pairing above restricted to the outer
//                          two
//   formulaBookending      how many phrases that recur at least twice
//                          within the surah (data/formulas-root.json /
//                          -surface.json) have an occurrence in BOTH the
//                          first and last section
//   lengthSymmetry         Pearson correlation of the surah's per-verse
//                          token-count sequence against its own reverse
//
// Null model: for the first three tests, an EXACT permutation test over
// the K! orderings of the surah's own sections when K! <= 40320 (8!;
// covers every surah up to 8 sections), otherwise 10,000 Monte Carlo
// section-order shuffles via the seeded PRNG in scripts/lib/permute.mjs.
// This is BLOCK-order permutation — the sections themselves, and every
// verse's membership in one, stay fixed; only which position (first,
// second, ..., last) each section is evaluated in changes. A pilot run
// during design confirmed why this matters: permuting individual VERSES
// and re-blocking (the naive approach) destroys local topical cohesion
// and INFLATES cross-block similarity, so real structure would score
// BELOW its own null and never reach significance. Block-order
// permutation was also verified against a synthetic 9-section planted
// ring (detected at p < 0.002 down to 25% shared vocabulary under heavy
// noise) and against unstructured controls (correctly non-significant).
// lengthSymmetry uses a separate, verse-level Monte Carlo null (shuffling
// the raw length sequence, 10,000 draws) since it has no section
// structure to permute.
//
// All candidate (surah, test) p-values from all four tests, across every
// surah where the test applies, are pooled into ONE Benjamini-Hochberg
// FDR correction at q < 0.05 (not four separate corrections, and not one
// per surah — the same reasoning as build-symmetry-test.mjs: testing many
// candidates guarantees some will look significant by chance alone unless
// judged jointly). Bonferroni is reported alongside, for comparison.
//
// What this deliberately does NOT claim: that a surviving result IS ring
// composition, inclusio, or any named literary pattern — only that the
// computed sections from build-structure.mjs show more of this mechanical
// property than their own random reordering would, corrected for testing
// many surahs at once. Never attributed to a scholar. See
// docs/maintainer-guide.md's rule on named-scholar structural outlines.
// A null result here is reported exactly as loudly as a survivor.
//
// To reproduce: node scripts/build-structure-tests.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mulberry32, shuffle } from "./lib/permute.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FREQUENCY_CEILING = 700; // same rule as build-cooccurrence.mjs etc.
const MAX_EXACT_FACTORIAL = 40320; // 8!; covers every surah up to 8 sections
const MONTE_CARLO_B = 10000;
const FDR_Q = 0.05;
const MIN_VERSES_FOR_LENGTH_TEST = 6;
// Fixed literal seeds, per the determinism contract (Math.random() is
// forbidden in generators) — two independent streams per surah so the
// section-order test and the verse-length test never share randomness.
const SEED_BASE_SECTIONS = 20260809;
const SEED_BASE_LENGTHS = 20260810;

const round = (x) => Math.round(x * 1e4) / 1e4;

// ── Step 1: embedded unit tests ────────────────────────────────────────

function jaccard(a, b) {
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function pearson(x, y) {
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    denX = 0,
    denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// All K! orderings of [0..K-1], as index arrays. Memoized: many surahs
// share the same section count.
const exactPermCache = new Map();
function exactPermutations(K) {
  if (exactPermCache.has(K)) return exactPermCache.get(K);
  let perms = [[]];
  for (let size = 1; size <= K; size++) {
    const next = [];
    for (const p of perms) {
      for (let i = 0; i <= p.length; i++) next.push([...p.slice(0, i), size - 1, ...p.slice(i)]);
    }
    perms = next;
  }
  exactPermCache.set(K, perms);
  return perms;
}

function concentric(order, sets) {
  const K = order.length;
  let sum = 0,
    pairs = 0;
  for (let i = 0; i < Math.floor(K / 2); i++) {
    sum += jaccard(sets[order[i]], sets[order[K - 1 - i]]);
    pairs++;
  }
  return pairs ? sum / pairs : 0;
}

function inclusio(order, sets) {
  const K = order.length;
  return K >= 2 ? jaccard(sets[order[0]], sets[order[K - 1]]) : 0;
}

function bracketCount(order, refrainSectionSets) {
  const K = order.length;
  const first = order[0],
    last = order[K - 1];
  let count = 0;
  for (const secSet of refrainSectionSets) if (secSet.has(first) && secSet.has(last)) count++;
  return count;
}

// Benjamini-Hochberg: sort p-values ascending, find the largest rank k
// where p(k) <= (k/m) * q; everything at or before that rank survives.
// Returns the count of survivors (the first `count` entries of the
// ascending-sorted input are the survivors).
function benjaminiHochbergSurvivorCount(sortedPValues, q) {
  const m = sortedPValues.length;
  let maxK = 0;
  for (let i = 0; i < m; i++) {
    const rank = i + 1;
    if (sortedPValues[i] <= (rank / m) * q) maxK = rank;
  }
  return maxK;
}

{
  const failures = [];
  const eq = (got, want, label, eps = 1e-9) => {
    if (Math.abs(got - want) > eps) failures.push(`${label}: got ${got}, want ${want}`);
  };
  eq(jaccard(new Set(["A", "B"]), new Set(["A", "B"])), 1, "jaccard identical");
  eq(jaccard(new Set(["A"]), new Set(["B"])), 0, "jaccard disjoint");
  eq(pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 1, "pearson identical");
  eq(pearson([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1, "pearson reversed");
  eq(factorial(5), 120, "factorial(5)");
  if (exactPermutations(3).length !== 6) failures.push("exactPermutations(3) length");
  if (exactPermutations(4).length !== 24) failures.push("exactPermutations(4) length");
  // Every generated permutation must itself be a valid permutation of
  // [0..K-1] — catches an index-generation bug that produces the right
  // COUNT by coincidence but the wrong contents.
  for (const K of [3, 4, 5]) {
    for (const p of exactPermutations(K)) {
      if (p.slice().sort((a, b) => a - b).join(",") !== Array.from({ length: K }, (_, i) => i).join(","))
        failures.push(`exactPermutations(${K}) produced an invalid permutation: [${p}]`);
    }
  }

  // Concentric: 4 sections, mirrored pair (0,3) share everything, (1,2)
  // share nothing. The identity order should score the mean of 1 and 0.
  const sets4 = [new Set(["a"]), new Set(["x"]), new Set(["y"]), new Set(["a"])];
  eq(concentric([0, 1, 2, 3], sets4), 0.5, "concentric mirrored pair");
  eq(inclusio([0, 1, 2, 3], sets4), 1, "inclusio matching bookends");
  eq(inclusio([1, 0, 2, 3], sets4), 0, "inclusio broken bookends under reorder");

  // Bracket count: a refrain present in sections {0,3} brackets the
  // identity order (first=0, last=3); reordering so neither endpoint
  // slot holds a section either refrain touches drops the count to 0.
  const refrains = [new Set([0, 3]), new Set([0, 1])];
  if (bracketCount([0, 1, 2, 3], refrains) !== 1) failures.push("bracketCount identity order");
  if (bracketCount([2, 0, 1, 3], refrains) !== 0) failures.push("bracketCount reordered (no bracket)");

  // BH-FDR, hand-computed: p = [0.001, 0.2, 0.3, 0.3, 0.04], q = 0.05.
  // Sorted: [0.001, 0.04, 0.2, 0.3, 0.3]; per-rank thresholds are 0.01,
  // 0.02, 0.03, 0.04, 0.05. Rank 1 clears (0.001 <= 0.01); rank 2 does
  // NOT (0.04 > 0.02), so only 1 survives. This case specifically pins
  // the RANK-SCALED threshold, not just "p <= q": 0.04 is under the flat
  // q = 0.05 bound (so a mutant that dropped the rank scaling and
  // compared every p-value against q directly would wrongly admit it,
  // yielding 2) but correctly fails its own, stricter, rank-2 bound.
  const bhCount = benjaminiHochbergSurvivorCount([0.001, 0.2, 0.3, 0.3, 0.04].sort((a, b) => a - b), 0.05);
  if (bhCount !== 1) failures.push(`BH-FDR hand-computed case: got ${bhCount} survivors, want 1`);
  // A single p-value at exactly q survives (rank 1, m=1: q/1 = q).
  if (benjaminiHochbergSurvivorCount([0.05], 0.05) !== 1) failures.push("BH-FDR single p-value at threshold");
  // Nothing survives when every p-value exceeds its own rank threshold.
  if (benjaminiHochbergSurvivorCount([0.9, 0.95], 0.05) !== 0) failures.push("BH-FDR all p-values too high");

  if (failures.length) {
    console.error("build-structure-tests: unit tests FAILED");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("Unit tests passed: jaccard, pearson, exact permutations, concentric/inclusio/bracket.");
}

// ── Step 2: shared corpus data, loaded once ────────────────────────────

const rootsSummary = JSON.parse(readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"));
const excludedRoots = new Set(
  Object.entries(rootsSummary)
    .filter(([, meta]) => meta.totalCount > FREQUENCY_CEILING)
    .map(([bw]) => bw),
);

// Pre-index both formula streams by surah, keeping only phrases that
// recur at least twice WITHIN that surah (a local refrain — the same
// definition build-structure.mjs uses for its formulaOnset signal).
function indexRefrainsBySurah(ngramsFile) {
  const data = JSON.parse(readFileSync(join(ROOT, "data", ngramsFile), "utf8"));
  const bySurah = new Map();
  for (const entry of data.ngrams) {
    const perSurah = new Map();
    for (const r of entry.refs) {
      if (!perSurah.has(r[0])) perSurah.set(r[0], []);
      perSurah.get(r[0]).push(r[1]);
    }
    for (const [s, verses] of perSurah) {
      if (verses.length < 2) continue;
      if (!bySurah.has(s)) bySurah.set(s, []);
      bySurah.get(s).push(verses);
    }
  }
  return bySurah;
}
const rootRefrainsBySurah = indexRefrainsBySurah("formulas-root.json");
const surfaceRefrainsBySurah = indexRefrainsBySurah("formulas-surface.json");

function sectionOf(verse, sections) {
  for (let i = 0; i < sections.length; i++) {
    if (verse >= sections[i].fromVerse && verse <= sections[i].toVerse) return i;
  }
  return -1;
}

// ── Step 3: per-surah tests ─────────────────────────────────────────────

const perSurah = [];
const candidates = []; // {surah, test, observed, pValue}

for (let s = 1; s <= 114; s++) {
  const struct = JSON.parse(readFileSync(join(ROOT, "data", "structure", `${s}.json`), "utf8"));
  const morph = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
  const n = struct.verseCount;
  const K = struct.sections.length;
  const entry = { surah: s, verseCount: n, sections: K };

  if (K >= 2) {
    const sectionSets = struct.sections.map((sec) => {
      const set = new Set();
      for (let a = sec.fromVerse; a <= sec.toVerse; a++)
        for (const w of morph[String(a)]) if (w.root && !excludedRoots.has(w.root)) set.add(w.root);
      return set;
    });
    const identity = Array.from({ length: K }, (_, i) => i);

    const refrainSectionSets = [
      ...(rootRefrainsBySurah.get(s) || []),
      ...(surfaceRefrainsBySurah.get(s) || []),
    ].map((verses) => new Set(verses.map((v) => sectionOf(v, struct.sections))));

    const obsConcentric = concentric(identity, sectionSets);
    const obsInclusio = inclusio(identity, sectionSets);
    const obsBracket = bracketCount(identity, refrainSectionSets);

    const exact = factorial(K) <= MAX_EXACT_FACTORIAL;
    let orders;
    if (exact) {
      orders = exactPermutations(K);
    } else {
      const rng = mulberry32(SEED_BASE_SECTIONS + s);
      orders = Array.from({ length: MONTE_CARLO_B }, () => shuffle(identity.slice(), rng));
    }
    let geConcentric = 0,
      geInclusio = 0,
      geBracket = 0;
    for (const order of orders) {
      if (concentric(order, sectionSets) >= obsConcentric) geConcentric++;
      if (inclusio(order, sectionSets) >= obsInclusio) geInclusio++;
      if (bracketCount(order, refrainSectionSets) >= obsBracket) geBracket++;
    }
    const B = orders.length;
    // Exact enumeration is the full sample space, so the count is already
    // an exact probability. Monte Carlo uses the standard add-one
    // correction (North, Curtis & Sham 2002) so an estimated p can never
    // round to exactly zero from a finite sample.
    const pConcentric = exact ? geConcentric / B : (geConcentric + 1) / (B + 1);
    const pInclusio = exact ? geInclusio / B : (geInclusio + 1) / (B + 1);
    const pBracket = exact ? geBracket / B : (geBracket + 1) / (B + 1);

    entry.concentricParallelism = { observed: round(obsConcentric), pValue: round(pConcentric), permutations: B, exact };
    entry.inclusio = { observed: round(obsInclusio), pValue: round(pInclusio), permutations: B, exact };
    entry.formulaBookending = {
      observed: obsBracket,
      candidatePhrases: refrainSectionSets.length,
      pValue: round(pBracket),
      permutations: B,
      exact,
    };
    candidates.push({ surah: s, test: "concentricParallelism", observed: obsConcentric, pValue: pConcentric });
    candidates.push({ surah: s, test: "inclusio", observed: obsInclusio, pValue: pInclusio });
    candidates.push({ surah: s, test: "formulaBookending", observed: obsBracket, pValue: pBracket });
  } else {
    entry.concentricParallelism = null;
    entry.inclusio = null;
    entry.formulaBookending = null;
  }

  if (n >= MIN_VERSES_FOR_LENGTH_TEST) {
    const lengths = Array.from({ length: n }, (_, i) => morph[String(i + 1)].length);
    const reversed = lengths.slice().reverse();
    const obs = pearson(lengths, reversed);
    const rng = mulberry32(SEED_BASE_LENGTHS + s);
    let ge = 0;
    for (let b = 0; b < MONTE_CARLO_B; b++) {
      const shuffled = shuffle(lengths.slice(), rng);
      if (pearson(shuffled, shuffled.slice().reverse()) >= obs) ge++;
    }
    const p = (ge + 1) / (MONTE_CARLO_B + 1);
    entry.lengthSymmetry = { observed: round(obs), pValue: round(p), permutations: MONTE_CARLO_B };
    candidates.push({ surah: s, test: "lengthSymmetry", observed: obs, pValue: p });
  } else {
    entry.lengthSymmetry = null;
  }

  perSurah.push(entry);
}

// ── Step 4: one pooled Benjamini-Hochberg correction across all four tests ──

const m = candidates.length;
const sorted = [...candidates].sort((a, b) => a.pValue - b.pValue);
const survivorCount = benjaminiHochbergSurvivorCount(
  sorted.map((c) => c.pValue),
  FDR_Q,
);
const survivors = sorted.slice(0, survivorCount);
const bonferroniAlpha = 0.05 / m;
const bonferroniSurvivors = candidates.filter((c) => c.pValue <= bonferroniAlpha);

const survivorKeys = new Set(survivors.map((c) => `${c.surah}:${c.test}`));
const TEST_NAMES = ["concentricParallelism", "inclusio", "formulaBookending", "lengthSymmetry"];
const closestMisses = {};
for (const test of TEST_NAMES) {
  closestMisses[test] = candidates
    .filter((c) => c.test === test && !survivorKeys.has(`${c.surah}:${c.test}`))
    .sort((a, b) => a.pValue - b.pValue)
    .slice(0, 5)
    .map((c) => ({ surah: c.surah, observed: round(c.observed), pValue: round(c.pValue) }));
}

const out = {
  _generated: "build-structure-tests.mjs",
  _hypothesis:
    "Do the sections build-structure.mjs computed for a surah show more block-level " +
    "mirror symmetry (mirrored-section vocabulary overlap, first/last-section bookending " +
    "by vocabulary and by recurring phrases, verse-length palindrome) than the same " +
    "sections in a random order would, more often than testing 114 surahs at once " +
    "would produce by chance?",
  _method:
    "Four tests per surah (concentricParallelism, inclusio, formulaBookending over the " +
    "sections in data/structure/{surah}.json; lengthSymmetry over raw per-verse token " +
    "counts, independent of sections). Null: exact enumeration of all section orderings " +
    `when count! <= ${MAX_EXACT_FACTORIAL} (8!), else ${MONTE_CARLO_B} block-order Monte ` +
    `Carlo shuffles (verse-length test always uses ${MONTE_CARLO_B} verse-order shuffles, ` +
    "seeded, via scripts/lib/permute.mjs). Content roots exclude corpus-wide frequency > " +
    `${FREQUENCY_CEILING} (build-cooccurrence.mjs's rule). All candidate p-values from all ` +
    "four tests, across every surah where a test applies, are pooled into one Benjamini-" +
    `Hochberg correction at q < ${FDR_Q} (not corrected per test or per surah), with ` +
    "Bonferroni reported alongside.",
  _scope:
    "A surviving result says these sections show more of this mechanical property than " +
    "chance reordering, corrected for testing many surahs jointly — nothing more. Not " +
    "literary ring composition, not inclusio as the term is used in the scholarship cited " +
    "on patterns.html, not attributed to any scholar. build-symmetry-test.mjs's separate, " +
    "narrower point-pair test (data/symmetry-test.json) is unrelated and unchanged by this.",
  totalCandidates: m,
  fdrQThreshold: FDR_Q,
  fdrSurvivors: survivors.length,
  bonferroniAlpha,
  bonferroniSurvivors: bonferroniSurvivors.length,
  survivors: survivors.map((c) => ({
    surah: c.surah,
    test: c.test,
    observed: round(c.observed),
    pValue: round(c.pValue),
  })),
  closestMisses,
  perSurah,
};

writeFileSync(join(ROOT, "data", "structure-tests.json"), JSON.stringify(out, null, 1) + "\n");

const applicableSectionTests = perSurah.filter((e) => e.sections >= 2).length;
const applicableLengthTests = perSurah.filter((e) => e.lengthSymmetry).length;
console.log(
  `build-structure-tests: wrote data/structure-tests.json. ${m} candidates ` +
    `(${applicableSectionTests} surahs with >=2 sections x 3 section tests, ` +
    `${applicableLengthTests} surahs eligible for the length test). ` +
    `BH-FDR (q<${FDR_Q}) survivors: ${survivors.length}. Bonferroni (p<${bonferroniAlpha.toExponential(2)}) survivors: ${bonferroniSurvivors.length}.`,
);
if (survivors.length) {
  console.log("Survivors:");
  for (const v of survivors) console.log(`  surah ${v.surah} ${v.test}: observed=${v.observed} p=${v.pValue}`);
}
