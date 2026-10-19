// Checks for scripts/lib/keyness.mjs.   node scripts/keyness.test.mjs
import { g2, periodStats, permutationGE } from "./lib/keyness.mjs";
import { mulberry32, shuffle } from "./lib/permute.mjs";

let failures = 0;
const near = (got, want, label, tol = 1e-8) => {
  if (!(Math.abs(got - want) <= tol)) { failures++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
};

// Hand-computed: 2*(2*10*ln(4/3) + 2*5*ln(2/3)) = 3.39798072... (same value as the
// embedded test in compute-association-stats.mjs).
near(g2(10, 5, 5, 10), 3.39798072, "g2 hand value", 1e-7);
near(g2(5, 5, 5, 5), 0, "g2 of independence");

// Tiny corpus: 6 surahs, 2 periods (3 surahs each), 2 roots.
const rows = [new Map([[0, 5]]), new Map([[0, 3], [1, 1]]), new Map([[1, 4]]), new Map([[0, 1]]), new Map([[1, 2]]), new Map([[0, 2], [1, 2]])];
const tokens = [10, 8, 9, 7, 6, 12];
const K = 2, P = 2;
const rootTotals = new Float64Array(K);
rows.forEach((c) => { for (const [k, x] of c) rootTotals[k] += x; });
const total = tokens.reduce((a, b) => a + b, 0);
const labels0 = [0, 0, 0, 1, 1, 1];
const obs = periodStats(rows, tokens, labels0, K, P, rootTotals, total);

// Period 0, root 0: a = 5+3 = 8, rest = 3; period tokens 27; other 25; total 52.
// 2x2 {8, 3, 19, 22} against the table by hand:
near(obs.counts[0], 8, "count p0 r0");
near(obs.g2[0], g2(8, 3, 27 - 8, 52 - 27 - 11 + 8), "G2 p0 r0 from the formula");

// Exact permutation p over all C(6,3) = 20 assignments with three surahs in each period,
// against the seeded Monte Carlo used by the generator.
const labelSets = [];
for (let mask = 0; mask < 64; mask++) {
  const l = Array.from({ length: 6 }, (_, i) => (mask >> i) & 1);
  if (l.reduce((a, b) => a + b, 0) === 3) labelSets.push(l);
}
if (labelSets.length !== 20) { failures++; console.error("FAIL enumeration size"); }
const exactGE = new Float64Array(P * K);
for (const l of labelSets) {
  const g = periodStats(rows, tokens, l, K, P, rootTotals, total).g2;
  for (let i = 0; i < P * K; i++) if (g[i] >= obs.g2[i] - 1e-12) exactGE[i]++;
}
const DRAWS = 40000;
const mc = permutationGE(rows, tokens, labels0, obs.g2, K, P, rootTotals, total, DRAWS, mulberry32(7), shuffle);
for (let i = 0; i < P * K; i++) {
  near((1 + mc[i]) / (DRAWS + 1), exactGE[i] / 20, `Monte Carlo p vs exact, test ${i}`, 0.012);
}
// The observed labeling is one of the 20, so the exact p is at least 1/20.
for (let i = 0; i < P * K; i++) if (!(exactGE[i] >= 1)) { failures++; console.error(`FAIL exact p below 1/20 at ${i}`); }

// Permutations keep the number of surahs per period.
const seen = new Set();
const rng = mulberry32(3);
const l = labels0.slice();
for (let r = 0; r < 200; r++) { shuffle(l, rng); seen.add(l.filter((x) => x === 0).length); }
if (seen.size !== 1 || !seen.has(3)) { failures++; console.error("FAIL label counts not preserved"); }

if (failures) { console.error(`keyness.test: ${failures} failure(s)`); process.exit(1); }
console.log("keyness.test: OK.");
