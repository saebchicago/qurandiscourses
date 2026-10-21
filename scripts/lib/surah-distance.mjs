import { mulberry32 } from "./permute.mjs";
import { bhAdjust } from "./stats.mjs";

// surah-distance.mjs — Jensen-Shannon distance between two root-count
// vectors, over a shared key list. Shared by compute-surah-distance.mjs
// and its unit test.
//
// Distance = sqrt(JSD), JSD in base 2, so the value lies in [0, 1]
// (Lin 1991; the square root is a metric, Endres & Schindelin 2003).
// a and b are count arrays indexed by key; keys lists the indexes with a
// nonzero count in either; na and nb are the vector totals. Returns NaN
// when either total is zero.
export function jsDistance(a, b, keys, na, nb) {
  if (!na || !nb) return NaN;
  let d = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const p = a[k] / na;
    const q = b[k] / nb;
    const m = (p + q) / 2;
    if (p) d += 0.5 * p * Math.log2(p / m);
    if (q) d += 0.5 * q * Math.log2(q / m);
  }
  return Math.sqrt(Math.max(0, d));
}

// surahs: [{ verses: [{ keys: Int32Array, counts: Int32Array }], tokens }] with
// root indexes in 0..K-1 (a verse's sparse root counts). For every pair i < j:
//   obs      the distance between the two surahs' root distributions
//   null     pool both surahs' verses, reassign verses to the two sides at
//            random with side sizes in verses fixed, recompute: `draws` draws
//   p        (1 + draws at least as large as obs) / (draws + 1)
//   bhQ      Benjamini-Hochberg over all pairs
// One seeded generator is consumed pair by pair in order, so the result is a
// pure function of (surahs, draws, seed). Also used to calibrate the method on
// pseudo-surahs (scripts/build-calibration.mjs).
export function pairwiseDistances(surahs, K, { draws, seed, lowCount }) {
  const n = surahs.length;
  const rnd = mulberry32(seed);
  const A = new Float64Array(K);
  const B = new Float64Array(K);
  const mark = new Uint8Array(K);
  const addVerse = (arr, v) => { for (let i = 0; i < v.keys.length; i++) arr[v.keys[i]] += v.counts[i]; };

  function pairStats(i, j) {
    const sa = surahs[i], sb = surahs[j];
    const pool = sa.verses.concat(sb.verses);
    const nA = sa.verses.length;
    const keys = [];
    const total = new Float64Array(K);
    let nTotal = 0;
    for (const v of pool) {
      for (let t = 0; t < v.keys.length; t++) {
        const k = v.keys[t];
        if (!mark[k]) { mark[k] = 1; keys.push(k); }
        total[k] += v.counts[t];
        nTotal += v.counts[t];
      }
    }
    const observedA = new Float64Array(K);
    for (const v of sa.verses) addVerse(observedA, v);
    const observedB = new Float64Array(K);
    for (const v of sb.verses) addVerse(observedB, v);
    const obs = jsDistance(observedA, observedB, keys, sa.tokens, sb.tokens);

    const idx = pool.map((_, k) => k);
    let ge = 0, sum = 0;
    for (let r = 0; r < draws; r++) {
      for (let k = idx.length - 1; k > 0; k--) {
        const m = Math.floor(rnd() * (k + 1));
        const tmp = idx[k]; idx[k] = idx[m]; idx[m] = tmp;
      }
      for (let q = 0; q < keys.length; q++) A[keys[q]] = 0;
      let na = 0;
      for (let k = 0; k < nA; k++) {
        const v = pool[idx[k]];
        for (let t = 0; t < v.keys.length; t++) { A[v.keys[t]] += v.counts[t]; na += v.counts[t]; }
      }
      for (let q = 0; q < keys.length; q++) B[keys[q]] = total[keys[q]] - A[keys[q]];
      const d = jsDistance(A, B, keys, na, nTotal - na);
      if (Number.isNaN(d)) throw new Error(`Empty side in a permutation draw for surahs ${i + 1} and ${j + 1}. STOPPING.`);
      sum += d;
      if (d >= obs - 1e-12) ge++;
    }
    for (const k of keys) { mark[k] = 0; A[k] = 0; B[k] = 0; }
    return { obs, nullMean: sum / draws, p: (1 + ge) / (draws + 1) };
  }

  const rows = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const st = pairStats(i, j);
      rows.push({
        surahA: i + 1,
        surahB: j + 1,
        rootedTokensA: surahs[i].tokens,
        rootedTokensB: surahs[j].tokens,
        distance: st.obs,
        nullMean: st.nullMean,
        excess: Math.round(st.obs * 1e4) / 1e4 - Math.round(st.nullMean * 1e4) / 1e4,
        permutationP: st.p,
        lowCount: surahs[i].tokens < lowCount || surahs[j].tokens < lowCount,
      });
    }
  }
  const q = bhAdjust(rows.map((r) => r.permutationP));
  rows.forEach((r, k) => { r.bhQ = q[k]; });
  return rows;
}
