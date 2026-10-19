#!/usr/bin/env node
//
// compute-period-keyness.mjs: which roots are key to a revelation period
// beyond what random assignment of whole surahs to periods would produce.
//
//   node scripts/compute-period-keyness.mjs                  # rewrite (~90 s)
//   node scripts/compute-period-keyness.mjs --check          # fast: digests
//   node scripts/compute-period-keyness.mjs --check --full   # recompute and compare
//
// Source: Leeds Quranic Arabic Corpus v0.4 (GPL), data/morphology/, and the
// four-period Noldeke-Bell chronology in data/chronology.json (one scheme
// among several; every figure here is conditional on it).
//
// For each of the 1,642 roots and each of 4 periods: the token-level G2 of
// compute-association-stats.mjs (period against the rest), its direction
// (enriched or depleted), and a permutation p-value: draw 100,000 random
// assignments of the 114 surahs to the four periods with each period's number
// of surahs held fixed, recompute G2, p = (1 + draws >= observed) / 100,001.
// BH over all 6,568 root-period tests. The smallest possible p is 1e-5.
//
// CALIBRATION. The same procedure is run on 40 pseudo-chronologies (random
// relabelings standing in for the observed one, each against its own 5,000
// fresh draws). Every pseudo-chronology is a draw from the null, so the
// number of tests passing BH there is the method's false-positive count; it
// is published beside the real count (data/keyness/period-keyness.json,
// .calibration) and on the Validation page.
//
// Deterministic: seeds 20261018 (real) and 20261019 (calibration).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32, shuffle } from "./lib/permute.mjs";
import { bhAdjust } from "./lib/stats.mjs";
import { periodStats, permutationGE } from "./lib/keyness.mjs";
import { inputDigest, bodyDigest } from "./lib/input-digest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "keyness", "period-keyness.json");
const CHECK = process.argv.includes("--check");
const FULL = process.argv.includes("--full");
const INPUTS = [
  join(ROOT, "data", "morphology"),
  join(ROOT, "data", "chronology.json"),
  join(ROOT, "data", "association", "keyness-top.json"),
  join(ROOT, "scripts", "compute-period-keyness.mjs"),
  join(ROOT, "scripts", "lib", "keyness.mjs"),
  join(ROOT, "scripts", "lib", "permute.mjs"),
  join(ROOT, "scripts", "lib", "stats.mjs"),
];
const PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
const DRAWS = 100000;
const SEED = 20261018;
const CAL_RUNS = 40;
const CAL_DRAWS = 5000;
const CAL_SEED = 20261019;
const ALPHA = 0.05;

const DIGEST = inputDigest(ROOT, INPUTS);
if (CHECK && !FULL) {
  if (!existsSync(OUT)) {
    console.error("compute-period-keyness --check: FAIL — data/keyness/period-keyness.json is missing.\n  Run: node scripts/compute-period-keyness.mjs");
    process.exit(1);
  }
  const stored = JSON.parse(readFileSync(OUT, "utf8"));
  if (stored.inputDigest !== DIGEST) {
    console.error("compute-period-keyness --check: FAIL — the morphology, chronology, script or libraries changed since the output was written.\n  Run: node scripts/compute-period-keyness.mjs");
    process.exit(1);
  }
  if (stored.outputDigest !== bodyDigest(stored)) {
    console.error("compute-period-keyness --check: FAIL — the stored file does not match its outputDigest (hand-edited?).\n  Run: node scripts/compute-period-keyness.mjs");
    process.exit(1);
  }
  console.log(`compute-period-keyness --check: OK (${stored.rows.length} tests; inputs unchanged; the full recompute is --check --full, run weekly).`);
  process.exit(0);
}

// ── load ────────────────────────────────────────────────────────────────
const chron = JSON.parse(readFileSync(join(ROOT, "data", "chronology.json"), "utf8"));
const rootIndex = new Map();
const rootNames = [];
const rows = [];
const tokens = [];
for (let s = 1; s <= 114; s++) {
  const m = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
  const c = new Map();
  let t = 0;
  for (const v of Object.values(m)) {
    for (const w of v) {
      t++;
      if (!w.root) continue;
      if (!rootIndex.has(w.root)) { rootIndex.set(w.root, rootIndex.size); rootNames.push(w.root); }
      const i = rootIndex.get(w.root);
      c.set(i, (c.get(i) || 0) + 1);
    }
  }
  rows.push(c);
  tokens.push(t);
}
const K = rootNames.length;
const P = PERIODS.length;
const rootTotals = new Float64Array(K);
rows.forEach((c) => { for (const [k, x] of c) rootTotals[k] += x; });
const totalTokens = tokens.reduce((a, b) => a + b, 0);
const labels0 = Array.from({ length: 114 }, (_, i) => {
  const p = PERIODS.indexOf(chron[i + 1].period);
  if (p < 0) throw new Error(`surah ${i + 1} has unknown period "${chron[i + 1].period}". STOPPING.`);
  return p;
});

// ── real run ────────────────────────────────────────────────────────────
const obs = periodStats(rows, tokens, labels0, K, P, rootTotals, totalTokens);
const ge = permutationGE(rows, tokens, labels0, obs.g2, K, P, rootTotals, totalTokens, DRAWS, mulberry32(SEED), shuffle);
const p = Array.from(ge, (x) => (1 + x) / (DRAWS + 1));
const q = bhAdjust(p);

// ── calibration: pseudo-chronologies stand in for the observed one ──────
const calRng = mulberry32(CAL_SEED);
const calRuns = [];
for (let r = 0; r < CAL_RUNS; r++) {
  const pseudo = labels0.slice();
  shuffle(pseudo, calRng);
  const o = periodStats(rows, tokens, pseudo, K, P, rootTotals, totalTokens);
  const g = permutationGE(rows, tokens, pseudo, o.g2, K, P, rootTotals, totalTokens, CAL_DRAWS, calRng, shuffle);
  const pp = Array.from(g, (x) => (1 + x) / (CAL_DRAWS + 1));
  const qq = bhAdjust(pp);
  calRuns.push({
    testsWithP05: pp.filter((x) => x <= 0.05).length,
    testsPassingBH: qq.filter((x) => x <= ALPHA).length,
  });
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const outRows = [];
for (let pi = 0; pi < P; pi++) {
  for (let k = 0; k < K; k++) {
    const i = pi * K + k;
    const a = obs.counts[i];
    const rest = rootTotals[k] - a;
    // enriched if the root's rate inside the period exceeds its rate outside
    const enriched = a / obs.periodTokens[pi] > rest / (totalTokens - obs.periodTokens[pi]);
    outRows.push({
      root: rootNames[k],
      period: PERIODS[pi],
      count: a,
      countRest: rest,
      g2: round(obs.g2[i], 3),
      direction: enriched ? "enriched" : "depleted",
      permutationP: round(p[i], 6),
      bhQ: round(q[i], 6),
    });
  }
}
const passing = outRows.filter((r) => r.bhQ <= ALPHA);

// The roots the Numbers page lists as most key per period (top 15 by G2,
// data/association/keyness-top.json), with what this test says about each, so
// the page can mark them without loading all 6,568 rows.
const displayed = JSON.parse(readFileSync(join(ROOT, "data", "association", "keyness-top.json"), "utf8")).byPeriod.map((bp) => ({
  period: bp.period,
  roots: bp.roots.map((r) => {
    const row = outRows.find((x) => x.period === bp.period && x.root === r.root);
    return { root: r.root, g2: row.g2, direction: row.direction, permutationP: row.permutationP, bhQ: row.bhQ, passes: row.bhQ <= ALPHA };
  }),
}));
const perPeriod = PERIODS.map((per) => ({ period: per, passing: passing.filter((r) => r.period === per).length }));

const body = {
  _comment:
    "GENERATED by scripts/compute-period-keyness.mjs. Dunning G2 keyness per root per revelation period, tested against random assignment of whole surahs to periods. Conditional on the Noldeke-Bell four-period chronology in data/chronology.json, one scheme among several.",
  source: "Leeds Quranic Arabic Corpus v0.4 (GPL); data/chronology.json",
  method: {
    statistic: "Dunning G2 over the token-level 2x2 (root in period / root elsewhere), all Leeds tokens as the universe",
    null: `assign the 114 surahs to the four periods at random keeping each period's number of surahs; ${DRAWS.toLocaleString("en-US")} draws, mulberry32 seed ${SEED}`,
    p: `(1 + draws with G2 >= observed) / (${DRAWS} + 1); smallest possible 1e-5`,
    q: `Benjamini-Hochberg over all ${outRows.length} root-period tests; passing = q <= ${ALPHA}`,
    direction: "enriched when the root's rate in the period exceeds its rate elsewhere, else depleted",
  },
  periods: PERIODS.map((per, pi) => ({
    period: per,
    surahs: labels0.filter((x) => x === pi).length,
    tokens: obs.periodTokens[pi],
  })),
  observed: { tests: outRows.length, passingBH: passing.length, perPeriod },
  displayedOnNumbersPage: displayed,
  calibration: {
    method: `${CAL_RUNS} random relabelings of the surahs stand in for the observed chronology; each is tested against ${CAL_DRAWS.toLocaleString("en-US")} fresh draws with the same BH step (seed ${CAL_SEED})`,
    runs: calRuns,
    testsPassingBH: { mean: round(calRuns.reduce((a, r) => a + r.testsPassingBH, 0) / calRuns.length, 2), max: Math.max(...calRuns.map((r) => r.testsPassingBH)) },
    runsWithAnyPassing: calRuns.filter((r) => r.testsPassingBH > 0).length,
    note: "Because each pseudo-chronology is itself a draw from the null, tests passing BH here are false positives. Roots share surahs, so the tests are strongly dependent: false positives arrive in bursts (several roots at once when one large surah lands in a period) rather than one at a time. The share of runs with any passing test estimates how often a whole-chronology analysis would report something in noise; Benjamini-Hochberg is designed to keep that near the 0.05 level. The p-value floor is 1/(draws + 1), so the calibration runs with fewer draws are the harder case.",
  },
  rows: outRows,
};
const out = { inputDigest: DIGEST, outputDigest: bodyDigest(body), ...body };
const text = JSON.stringify(out) + "\n";

if (CHECK) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
    console.error("compute-period-keyness --check --full: FAIL — data/keyness/period-keyness.json is stale.\n  Run: node scripts/compute-period-keyness.mjs");
    process.exit(1);
  }
  console.log(`compute-period-keyness --check --full: OK (${outRows.length} tests).`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  console.log(
    `compute-period-keyness: ${outRows.length} tests, ${passing.length} pass BH (${perPeriod.map((x) => x.period + " " + x.passing).join(", ")}). ` +
    `Calibration: ${calRuns.filter((r) => r.testsPassingBH > 0).length} of ${CAL_RUNS} pseudo-chronologies pass anything (max ${Math.max(...calRuns.map((r) => r.testsPassingBH))}).`,
  );
}
