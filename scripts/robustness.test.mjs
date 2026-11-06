// robustness.test.mjs — data/robustness/period-keyness.json and its Validation section.
//   node scripts/robustness.test.mjs
// The generator is slow (about 12 minutes), so this checks the published file
// for internal consistency, that its verdict follows the declared rule, that
// its baseline matches the keyness file it perturbs, and that the page script
// uses only ids that exist.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const d = JSON.parse(read("data/robustness/period-keyness.json"));
const base = JSON.parse(read("data/keyness/period-keyness.json"));
const round3 = (x) => Math.round(x * 1000) / 1000;

assert.equal(d.variants.length, 11);
assert.equal(new Set(d.variants.map((v) => v.id)).size, 11, "variant ids must be unique");
const sig = base.rows.filter((r) => r.bhQ <= 0.05).length;
assert.equal(d.baseline.significant, sig, "baseline significant count differs from data/keyness/period-keyness.json");
assert.equal(d.tests.length, sig);

for (const v of d.variants) {
  assert.equal(v.perPeriod.reduce((n, p) => n + p.held, 0), v.retained, `${v.id}: retained must sum its periods`);
  assert.equal(v.perPeriod.reduce((n, p) => n + p.baseline, 0), v.baselineSignificant, `${v.id}: baseline must sum its periods`);
  assert.equal(v.retainedShare, round3(v.retained / v.baselineSignificant), `${v.id}: retainedShare`);
  assert.ok(v.spearmanSignedG2 >= -1 && v.spearmanSignedG2 <= 1);
  assert.ok(v.touchedShareOfAllTokens >= 0 && v.touchedShareOfAllTokens < 1);
  assert.equal(v.touchedSurahs.length > 0, v.kind !== "twoperiod", `${v.id}: touched surahs`);
}

// The verdict must follow the rule that was declared in advance.
const { holds, partly } = d.method.thresholds;
const worst = d.variants.reduce((a, b) => (b.retainedShare < a.retainedShare ? b : a));
const verdict = worst.retainedShare >= holds ? "Survives" : worst.retainedShare >= partly ? "Partly" : "Fragile";
assert.equal(d.summary.verdict, verdict, "verdict does not follow the declared rule");
assert.equal(d.summary.worstVariant, worst.id);
assert.equal(d.summary.worstRetainedShare, worst.retainedShare);
assert.equal(d.summary.heldInAllVariants, d.tests.filter((t) => t.heldIn === t.of).length);
for (const t of d.tests) assert.ok(t.heldIn >= 0 && t.heldIn <= t.of && t.of > 0);

const html = read("validation.html");
const js = read("assets/robustness.js");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, "duplicate ids on validation.html");
for (const m of js.matchAll(/\$\("([A-Za-z]+)"\)/g)) assert.ok(ids.includes(m[1]), `robustness.js uses missing #${m[1]}`);
assert.ok(ids.includes("robSecond"));
assert.match(html, /<script src="assets\/robustness\.js" defer><\/script>/);
console.log(`robustness.test: OK (${d.variants.length} variants; verdict ${d.summary.verdict} follows the rule; baseline matches the keyness file).`);
