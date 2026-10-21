// association-measures.mjs — verse-level 2x2 association measures.
//
// The published table (association-pairs) carries PMI, Dice and Dunning's
// G2. The collocation literature does not agree on a single best measure,
// and the site's convention (see compute-dispersion.mjs) is to show the
// method-dependence rather than pick a winner. This module adds four more
// measures over the SAME 2x2 table, so build-exports.mjs can publish them
// beside the originals:
//
//   logDice   14 + log2(2*k11 / (fA + fB))          Rychly 2008. Bounded
//             above by 14 and independent of corpus size N.
//   tScore    (k11 - E11) / sqrt(k11)                standard collocation t-score
//   logOR     ln((k11+.5)(k22+.5) / ((k12+.5)(k21+.5)))   Haldane-Anscombe
//             correction, with a Wald 95% half-width 1.96*sqrt(sum 1/(cell+.5))
//   deltaP    P(B|A) - P(B|not A) and P(A|B) - P(A|not B)  (asymmetric)
//
// The 2x2 is the one scripts/compute-association-stats.mjs uses: N =
// TOTAL_VERSES, a root "occurs" in a verse if any token carries it, cells
// k11/k12/k21/k22 count verses. Pure functions, no I/O, no dates: the same
// cells always give the same numbers.

/** Build the four cells from the joint count and the two marginals. */
export const cells = (k11, fA, fB, N) => ({
  k11,
  k12: fA - k11,
  k21: fB - k11,
  k22: N - fA - fB + k11,
});

export const logDice = ({ k11, k12, k21 }) => 14 + Math.log2((2 * k11) / (2 * k11 + k12 + k21));

export function tScore({ k11, k12, k21, k22 }) {
  const n = k11 + k12 + k21 + k22;
  const e11 = ((k11 + k12) * (k11 + k21)) / n;
  return (k11 - e11) / Math.sqrt(k11);
}

/** Log odds ratio with the Haldane-Anscombe 0.5 correction and a Wald 95% interval. */
export function logOddsRatio({ k11, k12, k21, k22 }) {
  const [a, b, c, d] = [k11 + 0.5, k12 + 0.5, k21 + 0.5, k22 + 0.5];
  const lor = Math.log((a * d) / (b * c));
  const half = 1.96 * Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
  return { lor, lo: lor - half, hi: lor + half };
}

/** Directional association: bGivenA = P(B|A) - P(B|not A); aGivenB is the reverse. */
export function deltaP({ k11, k12, k21, k22 }) {
  return {
    bGivenA: k11 / (k11 + k12) - k21 / (k21 + k22),
    aGivenB: k11 / (k11 + k21) - k12 / (k12 + k22),
  };
}

/**
 * Cochran's Q for the homogeneity of several log odds ratios: do the periods
 * estimate one common association? Inverse-variance weights, Q = sum w_i
 * (lor_i - pooled)^2, referred to chi-square with (n - 1) degrees of freedom.
 * `estimates` is [{ lor, se }], se > 0. Returns { q, df, pooled }.
 */
export function cochranQ(estimates) {
  const w = estimates.map((e) => 1 / (e.se * e.se));
  const sw = w.reduce((a, b) => a + b, 0);
  const pooled = estimates.reduce((s, e, i) => s + w[i] * e.lor, 0) / sw;
  const q = estimates.reduce((s, e, i) => s + w[i] * (e.lor - pooled) ** 2, 0);
  return { q, df: estimates.length - 1, pooled };
}
