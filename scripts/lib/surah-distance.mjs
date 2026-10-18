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
