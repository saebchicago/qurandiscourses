// templates.mjs — one-slot templates ("a _ c") and their chance expectation.
//
// A template is two surface forms at distance two inside one verse, with
// any word between them. Its support k is the number of verse windows
// (i, i+1, i+2) where word i is a and word i+2 is c. Its distinct fillers
// d is the number of different words found in the slot.
//
// NULL. Shuffle the words inside each verse. That keeps every verse's
// length and word multiset (length-matched) and destroys order. Under it
// the expected support of (a, c) has a closed form, summed over verses of
// length L with n_a copies of a and n_c copies of c:
//     a != c:  (L - 2) * n_a * n_c / (L * (L - 1))
//     a == c:  (L - 2) * n_a * (n_a - 1) / (L * (L - 1))
// (each ordered pair of distinct positions holds a then c with probability
// 1 / (L (L - 1)); there are L - 2 windows). The p-value treats support as
// Poisson with that mean, an approximation that the build checks against
// repeated shuffles rather than assumes.

// P(X >= k) for X ~ Poisson(mu), summed from the upper side so tiny tails
// do not cancel to zero.
export function poissonUpperTail(k, mu) {
  if (k <= 0) return 1;
  if (mu <= 0) return 0;
  // first term e^-mu mu^k / k!, in logs
  let lf = 0;
  for (let i = 2; i <= k; i++) lf += Math.log(i);
  let term = Math.exp(-mu + k * Math.log(mu) - lf);
  let sum = term;
  for (let i = k + 1; i < k + 2000; i++) {
    term *= mu / i;
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return Math.min(1, sum);
}

// Benjamini-Hochberg adjusted q-values, same order as the input.
export function bhAdjust(ps) {
  const m = ps.length;
  const order = ps.map((_, i) => i).sort((x, y) => ps[x] - ps[y] || x - y);
  const q = new Array(m);
  let running = 1;
  for (let r = m - 1; r >= 0; r--) {
    const i = order[r];
    running = Math.min(running, (ps[i] * m) / (r + 1));
    q[i] = running;
  }
  return q;
}

// verses: [{ s, v, t: [tokenId, ...] }]. Returns Map(key -> { a, c, k, fill: Map, refs: [] })
// for every (a, c) seen, key = a * nTypes + c.
export function observe(verses, nTypes) {
  const out = new Map();
  for (const x of verses) {
    const t = x.t;
    for (let i = 0; i + 2 < t.length; i++) {
      const key = t[i] * nTypes + t[i + 2];
      let o = out.get(key);
      if (!o) { o = { a: t[i], c: t[i + 2], k: 0, fill: new Map(), refs: [] }; out.set(key, o); }
      o.k++;
      o.fill.set(t[i + 1], (o.fill.get(t[i + 1]) || 0) + 1);
      o.refs.push([x.s, x.v, i + 1]);
    }
  }
  return out;
}

// Expected support of (a, c) under the within-verse shuffle null.
export function expectedSupport(verseIndex, a, c) {
  let e = 0;
  const list = verseIndex.byToken.get(a);
  if (!list) return 0;
  for (const [vi, na] of list) {
    const L = verseIndex.lengths[vi];
    if (L < 3) continue;
    const nc = a === c ? na - 1 : verseIndex.counts[vi].get(c) || 0;
    if (nc <= 0) continue;
    e += ((L - 2) * na * nc) / (L * (L - 1));
  }
  return e;
}

export function indexVerses(verses) {
  const counts = verses.map((x) => {
    const c = new Map();
    for (const a of x.t) c.set(a, (c.get(a) || 0) + 1);
    return c;
  });
  const byToken = new Map();
  counts.forEach((c, vi) => {
    for (const [a, n] of c) {
      let l = byToken.get(a);
      if (!l) byToken.set(a, (l = []));
      l.push([vi, n]);
    }
  });
  return { counts, byToken, lengths: verses.map((x) => x.t.length) };
}

// The whole pipeline on one corpus: candidates (support >= minSupport and
// >= minFillers distinct fillers), Poisson p against the shuffle
// expectation, BH q over all candidates. Same function runs on the real
// text and on every shuffled copy, so the null sees the same selection.
export function analyze(verses, nTypes, { minSupport = 3, minFillers = 2, alpha = 0.05 } = {}) {
  const obs = observe(verses, nTypes);
  const idx = indexVerses(verses);
  const cands = [];
  for (const o of obs.values()) {
    if (o.k < minSupport || o.fill.size < minFillers) continue;
    const e = expectedSupport(idx, o.a, o.c);
    cands.push({ ...o, expected: e, p: poissonUpperTail(o.k, e) });
  }
  cands.sort((x, y) => x.a - y.a || x.c - y.c);
  const q = bhAdjust(cands.map((c) => c.p));
  cands.forEach((c, i) => { c.q = q[i]; });
  const significant = cands.filter((c) => c.q <= alpha);
  // tokens covered by at least one significant window (positions i..i+2)
  const covered = new Set();
  for (const c of significant) for (const [s, v, w] of c.refs) for (let d = 0; d < 3; d++) covered.add(`${s}:${v}:${w + d}`);
  return { candidates: cands, significant, coveredTokens: covered.size };
}
