// Checks for the numerical functions in scripts/lib/stats.mjs that have
// closed-form or tabulated values.   node scripts/stats.test.mjs
import { chiSquareUpperTail, lgamma, bhAdjust } from "./lib/stats.mjs";

let failures = 0;
const near = (got, want, label, rel = 1e-9) => {
  const ok = Math.abs(got - want) <= rel * Math.max(1, Math.abs(want)) || Math.abs(got - want) <= rel * Math.abs(want);
  if (!ok) { failures++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
};

// Chi-square critical values at the 5% level (standard tables, 15 digits):
near(chiSquareUpperTail(3.841458820694124, 1), 0.05, "df 1");
near(chiSquareUpperTail(5.991464547107979, 2), 0.05, "df 2");
near(chiSquareUpperTail(7.814727903251179, 3), 0.05, "df 3");
near(chiSquareUpperTail(9.487729036781154, 4), 0.05, "df 4");
// df = 2 has the closed form exp(-x/2) at any x, including far in the tail.
for (const x of [0.5, 10, 100, 700]) near(chiSquareUpperTail(x, 2), Math.exp(-x / 2), `df 2 at ${x}`, 1e-9);
// 1% and 0.1% points, df 3 and df 1.
near(chiSquareUpperTail(11.344866730144373, 3), 0.01, "df 3 at 1%");
near(chiSquareUpperTail(10.827566170662733, 1), 0.001, "df 1 at 0.1%");
near(chiSquareUpperTail(0, 5), 1, "x = 0");

// log-gamma at integers and at 1/2: ln(Gamma(5)) = ln 24, Gamma(1/2) = sqrt(pi).
near(lgamma(5), Math.log(24), "lgamma 5");
near(lgamma(0.5), 0.5 * Math.log(Math.PI), "lgamma 1/2");

// Benjamini-Hochberg: the same worked case as templates.test.mjs.
bhAdjust([0.03, 0.01, 0.05, 0.02, 0.04]).forEach((q, i) => near(q, 0.05, `bh ${i}`));

if (failures) { console.error(`stats.test: ${failures} failure(s)`); process.exit(1); }
console.log("stats.test: OK.");
