// Hand-computed and brute-force checks for scripts/lib/templates.mjs.
//   node scripts/templates.test.mjs
import { poissonUpperTail, bhAdjust, observe, indexVerses, expectedSupport, analyze } from "./lib/templates.mjs";

let failures = 0;
const near = (got, want, label, tol = 1e-9) => {
  if (!(Math.abs(got - want) <= tol)) { failures++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
};

// Poisson tails worked by hand.
near(poissonUpperTail(1, 1), 1 - Math.exp(-1), "P(X>=1 | 1)");
near(poissonUpperTail(3, 2), 1 - 5 * Math.exp(-2), "P(X>=3 | 2)");
near(poissonUpperTail(0, 5), 1, "P(X>=0)");
// far tail does not cancel to zero: P(X>=30 | 2) is about 1.2e-24
const far = poissonUpperTail(30, 2);
if (!(far > 1e-26 && far < 1e-22)) { failures++; console.error(`FAIL far tail: ${far}`); }

// A support far below a large expectation is not significant (no underflow to p = 0).
near(poissonUpperTail(3, 800), 1, "P(X>=3 | 800)");
near(poissonUpperTail(5, 5), 1 - Math.exp(-5) * (1 + 5 + 12.5 + 125 / 6 + 625 / 24), "P(X>=5 | 5)");

// BH: p = .01 .02 .03 .04 .05 -> q all .05 (m=5): .01*5/1=.05, .02*5/2=.05, ...
bhAdjust([0.03, 0.01, 0.05, 0.02, 0.04]).forEach((q, i) => near(q, 0.05, `bh ${i}`));
near(bhAdjust([0.5, 0.001])[1], 0.002, "bh small");

// Expected support equals the exact mean over ALL permutations of a verse.
function permutations(a) {
  if (a.length <= 1) return [a.slice()];
  const out = [];
  a.forEach((x, i) => { for (const p of permutations(a.slice(0, i).concat(a.slice(i + 1)))) out.push([x].concat(p)); });
  return out;
}
const cases = [
  { t: [0, 1, 0], a: 0, c: 0 },          // a == c: expected 1/3 for the multiset {0,0,1}
  { t: [0, 1, 2, 3], a: 0, c: 2 },
  { t: [0, 1, 0, 1, 2], a: 0, c: 1 },
  { t: [0, 0, 0, 1], a: 0, c: 0 },
];
for (const cs of cases) {
  const v = [{ s: 1, v: 1, t: cs.t }];
  const idx = indexVerses(v);
  const perms = permutations(cs.t);
  let total = 0;
  for (const p of perms) {
    const o = observe([{ s: 1, v: 1, t: p }], 10).get(cs.a * 10 + cs.c);
    total += o ? o.k : 0;
  }
  near(expectedSupport(idx, cs.a, cs.c), total / perms.length, `expected ${JSON.stringify(cs.t)} ${cs.a}_${cs.c}`);
}
near(expectedSupport(indexVerses([{ s: 1, v: 1, t: [0, 1, 0] }]), 0, 0), 1 / 3, "a==c hand value 1/3");

// The same exact-mean check for wider gaps (two and three open slots).
for (const gap of [3, 4]) {
  for (const cs of [{ t: [0, 1, 2, 3, 4], a: 0, c: 3 }, { t: [0, 1, 0, 1, 0], a: 0, c: 0 }, { t: [0, 0, 1, 2, 0, 3], a: 0, c: 0 }]) {
    const idx = indexVerses([{ s: 1, v: 1, t: cs.t }]);
    const perms = permutations(cs.t);
    let total = 0;
    for (const p of perms) {
      const o = observe([{ s: 1, v: 1, t: p }], 10, gap).get(cs.a * 10 + cs.c);
      total += o ? o.k : 0;
    }
    near(expectedSupport(idx, cs.a, cs.c, gap), total / perms.length, `expected gap ${gap} ${JSON.stringify(cs.t)} ${cs.a}_${cs.c}`);
  }
}

// A planted template is found; a fixed trigram (one filler) is not a candidate.
const verses = [];
for (let i = 0; i < 12; i++) verses.push({ s: 1, v: i + 1, t: [5, 10 + (i % 3), 6, 20 + i, 21 + i] });   // 5 _ 6, three fillers
for (let i = 0; i < 12; i++) verses.push({ s: 2, v: i + 1, t: [7, 8, 9, 40 + i] });                     // 7 8 9 fixed
const r = analyze(verses, 100);
if (!r.candidates.some((c) => c.a === 5 && c.c === 6 && c.fill.size === 3 && c.k === 12)) { failures++; console.error("FAIL planted template not a candidate"); }
if (r.candidates.some((c) => c.a === 7 && c.c === 9)) { failures++; console.error("FAIL single-filler trigram should not be a candidate"); }
if (!r.significant.some((c) => c.a === 5 && c.c === 6)) { failures++; console.error("FAIL planted template not significant"); }

if (failures) { console.error(`templates.test: ${failures} failure(s)`); process.exit(1); }
console.log("templates.test: OK.");
