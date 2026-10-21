// Hand-computed checks for scripts/lib/association-measures.mjs.
//   node --test scripts/association-measures.test.mjs
//
// 2x2 with k11=10 k12=5 k21=5 k22=10 (N=30, fA=fB=15), worked by hand:
//   logDice = 14 + log2(20/30)
//   tScore  = (10 - 7.5)/sqrt(10)
//   deltaP  = 10/15 - 5/15 = 1/3 in both directions
//   logOR   = ln((10.5*10.5)/(5.5*5.5))

import test from "node:test";
import assert from "node:assert/strict";
import { cochranQ, cells, logDice, tScore, logOddsRatio, deltaP } from "./lib/association-measures.mjs";

const near = (got, want) => assert.ok(Math.abs(got - want) < 1e-9, `got ${got}, want ${want}`);
const c = cells(10, 15, 15, 30);

test("cells from marginals", () => {
  assert.deepEqual(c, { k11: 10, k12: 5, k21: 5, k22: 10 });
});
test("logDice", () => near(logDice(c), 14 + Math.log2(20 / 30)));
test("tScore", () => near(tScore(c), 2.5 / Math.sqrt(10)));
test("deltaP is symmetric on a symmetric table", () => {
  near(deltaP(c).bGivenA, 1 / 3);
  near(deltaP(c).aGivenB, 1 / 3);
});
test("deltaP is asymmetric when marginals differ", () => {
  // A in 20 verses, B in 10, together in 8, N=100: P(B|A)=.4, P(B|!A)=2/80; P(A|B)=.8, P(A|!B)=12/90.
  const d = deltaP(cells(8, 20, 10, 100));
  near(d.bGivenA, 0.4 - 2 / 80);
  near(d.aGivenB, 0.8 - 12 / 90);
});
test("logOR centre and interval", () => {
  const r = logOddsRatio(c);
  near(r.lor, Math.log((10.5 * 10.5) / (5.5 * 5.5)));
  near(r.hi - r.lor, r.lor - r.lo);
  assert.ok(r.lo < r.lor && r.lor < r.hi);
});

test("cochranQ by hand", () => {
  // Two estimates 0 and 2, each with se 1: weights 1 and 1, pooled 1, Q = 1 + 1 = 2, df 1.
  const r = cochranQ([{ lor: 0, se: 1 }, { lor: 2, se: 1 }]);
  near(r.q, 2);
  near(r.pooled, 1);
  assert.equal(r.df, 1);
  // Identical estimates are perfectly homogeneous.
  near(cochranQ([{ lor: 1.5, se: 0.3 }, { lor: 1.5, se: 0.7 }, { lor: 1.5, se: 0.2 }]).q, 0);
  // Unequal precision: lor 0 (se 1, w 1) and lor 3 (se 0.5, w 4): pooled = 12/5 = 2.4; Q = 1*2.4^2 + 4*0.6^2 = 5.76 + 1.44 = 7.2.
  near(cochranQ([{ lor: 0, se: 1 }, { lor: 3, se: 0.5 }]).q, 7.2);
});
