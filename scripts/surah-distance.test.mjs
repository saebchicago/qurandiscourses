// Hand-computed checks for jsDistance and the permutation logic.
import { jsDistance } from "./lib/surah-distance.mjs";

let failures = 0;
const near = (got, want, label, tol = 1e-9) => {
  if (!(Math.abs(got - want) <= tol)) { failures++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
};

// Identical distributions: distance 0.
near(jsDistance([3, 1], [6, 2], [0, 1], 4, 8), 0, "identical");
// Disjoint support: JSD = 1 bit, distance 1.
near(jsDistance([5, 0], [0, 7], [0, 1], 5, 7), 1, "disjoint");
// p = (.5,.5), q = (1,0): m = (.75,.25).
// KL(p||m) = .5*log2(.5/.75) + .5*log2(.5/.25) = .5*(-0.5849625007) + .5 = 0.2075187496
// KL(q||m) = log2(1/.75) = 0.4150374993
// JSD = (0.2075187496 + 0.4150374993)/2 = 0.31127812445; sqrt = 0.5579...
near(jsDistance([1, 1], [4, 0], [0, 1], 2, 4), Math.sqrt(0.31127812445), "half vs all", 1e-9);
// Symmetric.
near(jsDistance([4, 0], [1, 1], [0, 1], 4, 2), jsDistance([1, 1], [4, 0], [0, 1], 2, 4), "symmetric");
// Empty side.
if (!Number.isNaN(jsDistance([0, 0], [1, 1], [0, 1], 0, 2))) { failures++; console.error("FAIL empty side should be NaN"); }

if (failures) { console.error(`surah-distance.test: ${failures} failure(s)`); process.exit(1); }
console.log("surah-distance.test: OK (5 cases).");
