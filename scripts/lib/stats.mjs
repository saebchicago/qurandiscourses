// stats.mjs — shared statistics primitives used by the corpus-analysis
// generators. Extracted from three places that had independently
// reimplemented the same math: benjaminiHochbergSurvivorCount existed
// verbatim in build-structure-tests.mjs and as an inlined loop in
// build-symmetry-test.mjs; pearson existed verbatim in both
// build-structure-tests.mjs and compute-centrality.mjs; FREQUENCY_CEILING
// (the corpus-wide occurrence count above which a root is treated as
// function-word-like and excluded from a counting subject) was a
// redeclared literal in five generators. This module is the one place
// those definitions live now — every caller must import from here rather
// than redeclare.
//
// Pure functions, no I/O, no generator-style unit-test block: the
// generators that import this module already carry embedded self-tests
// (build-structure-tests.mjs, compute-association-stats.mjs) that
// exercise these functions through their own fixtures, per the repo's
// existing convention (see scripts/lib/permute.mjs for the same
// pure-library-no-self-test shape).

// Corpus-wide occurrence threshold above which a root is excluded as a
// counting subject in association/structure/symmetry analyses (particles,
// pronouns and other function-word-like roots dominate raw frequency and
// would otherwise swamp every pairwise or positional statistic). Originally
// declared independently as the literal 700 in build-cooccurrence.mjs,
// build-discursive-pivots.mjs, build-structure.mjs, build-structure-tests.mjs
// and build-symmetry-test.mjs.
export const FREQUENCY_CEILING = 700;

// Pearson product-moment correlation coefficient. Returns 0 when either
// input has zero variance (undefined correlation, treated as "no linear
// relationship" rather than NaN so downstream arithmetic stays finite).
export function pearson(x, y) {
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

// 1-based ascending ranks, ties broken by averaging (the standard
// tie-correction: a run of k equal values each get the mean of the k
// consecutive ranks they jointly occupy).
export function averageRanks(values) {
  const n = values.length;
  const idx = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based
    for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank;
    i = j + 1;
  }
  return ranks;
}

// Tie-corrected Spearman rank correlation: Pearson's r computed over
// average ranks rather than raw values.
export function spearman(x, y) {
  return pearson(averageRanks(x), averageRanks(y));
}

// Benjamini-Hochberg false discovery rate procedure. Takes p-values
// already sorted ascending and the target FDR q, and returns the number
// of survivors: the largest rank k such that p(k) <= (k/m) * q, where m
// is the total candidate count. Every candidate at or before that rank
// survives (the caller slices its own sorted candidate list by this
// count — this function only returns the count, not the slice, so it
// stays agnostic to what a "candidate" object looks like across callers).
export function benjaminiHochbergSurvivorCount(sortedPValues, q) {
  const m = sortedPValues.length;
  let maxK = 0;
  for (let i = 0; i < m; i++) {
    const rank = i + 1;
    if (sortedPValues[i] <= (rank / m) * q) maxK = rank;
  }
  return maxK;
}

// Bonferroni-corrected per-candidate significance threshold for m
// simultaneous tests at family-wise alpha (default 0.05): alpha / m.
// Reported alongside BH-FDR throughout this codebase as the stricter,
// more conservative comparison.
export function bonferroniAlpha(m, familyAlpha = 0.05) {
  return familyAlpha / m;
}

// Jaccard similarity of two Sets: |A ∩ B| / |A ∪ B|. Two empty sets are
// treated as identical (1) rather than undefined, which is what both
// callers relied on. Was byte-identical in build-structure.mjs and
// build-structure-tests.mjs — the second file computes its concentric
// statistic over sections the first produced, so a divergence between
// the two copies would have compared sections by one rule and tested
// them by another.
export function jaccard(a, b) {
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// The assertion helper the generators' embedded self-tests use. Takes
// the caller's own `failures` array so a failed expectation is reported
// through that generator's existing reporting, unchanged.
//
// Existed in five copies with three behaviours: four defaulted eps to
// 1e-9, build-structure.mjs hardcoded it, and only build-numbers.mjs
// handled nulls. This is build-numbers' version, which is a superset —
// identical for the non-null numbers every current call site passes.
export function makeEq(failures) {
  return (got, want, label, eps = 1e-9) => {
    if (got === null || want === null) {
      if (got !== want) failures.push(`${label}: got ${got}, want ${want}`);
      return;
    }
    if (Math.abs(got - want) > eps) failures.push(`${label}: got ${got}, want ${want}`);
  };
}
