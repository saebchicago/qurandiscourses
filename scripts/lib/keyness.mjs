// keyness.mjs — Dunning G2 keyness per root per period, and the permutation
// null that tests it.
//
// Keyness asks whether a root's share of a period's tokens differs from its
// share of the rest of the text. The published G2 (compute-association-stats)
// treats every token as an independent draw, but tokens cluster inside surahs:
// one long surah that uses a root heavily makes it "key" for its period
// without the period as such mattering. The null here assigns whole SURAHS
// to periods at random, keeping the number of surahs in each period, and
// recomputes G2; the observed statistic is read against that distribution.
//
//   rows     per surah, sparse root counts: Map(rootIndex -> count)
//   tokens   per surah, all tokens (rooted or not): the keyness universe is
//            all Leeds tokens, as in compute-association-stats.mjs
//   labels   per surah, its period index 0..P-1
const xlx = (o, e) => (o > 0 ? o * Math.log(o / e) : 0);

// Dunning's log-likelihood ratio over the 2x2 {a b / c d}.
export function g2(a, b, c, d) {
  const n = a + b + c + d;
  const e1 = ((a + b) * (a + c)) / n;
  const e2 = ((a + b) * (b + d)) / n;
  const e3 = ((c + d) * (a + c)) / n;
  const e4 = ((c + d) * (b + d)) / n;
  return 2 * (xlx(a, e1) + xlx(b, e2) + xlx(c, e3) + xlx(d, e4));
}

// G2 for every (period, root): Float64Array of length P*K, index p*K + k.
// Also returns the counts, for direction and for the published table.
export function periodStats(rows, tokens, labels, K, P, rootTotals, totalTokens) {
  const cnt = new Float64Array(P * K);
  const ptok = new Array(P).fill(0);
  for (let s = 0; s < rows.length; s++) {
    ptok[labels[s]] += tokens[s];
    for (const [k, x] of rows[s]) cnt[labels[s] * K + k] += x;
  }
  const out = new Float64Array(P * K);
  for (let p = 0; p < P; p++) {
    for (let k = 0; k < K; k++) {
      const a = cnt[p * K + k];
      const b = rootTotals[k] - a;
      const c = ptok[p] - a;
      const d = totalTokens - ptok[p] - rootTotals[k] + a;
      out[p * K + k] = g2(a, b, c, d);
    }
  }
  return { g2: out, counts: cnt, periodTokens: ptok };
}

// Permutation counts: for each (period, root), the number of `draws`
// relabelings whose G2 is at least the observed one. shuffle(labels, rng) is
// the Fisher-Yates in permute.mjs. labels0 is not modified.
export function permutationGE(rows, tokens, labels0, observed, K, P, rootTotals, totalTokens, draws, rng, shuffle) {
  const ge = new Float64Array(P * K);
  const labels = labels0.slice();
  for (let r = 0; r < draws; r++) {
    shuffle(labels, rng);
    const ns = periodStats(rows, tokens, labels, K, P, rootTotals, totalTokens).g2;
    for (let i = 0; i < P * K; i++) if (ns[i] >= observed[i] - 1e-12) ge[i]++;
  }
  return ge;
}
