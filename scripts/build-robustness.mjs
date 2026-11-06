#!/usr/bin/env node
//
// build-robustness.mjs: do the period-keyness findings survive other
// reasonable choices?
//
//   node scripts/build-robustness.mjs                 # rewrite (~12 min)
//   node scripts/build-robustness.mjs --check         # fast: digests
//   node scripts/build-robustness.mjs --check --full  # recompute and compare
//
// data/keyness/period-keyness.json reports which roots are key to a
// revelation period, conditional on ONE chronology (Noldeke-Bell, four
// periods). That is a modeling choice, and a reader should know how much of
// the finding depends on it. This script re-runs the SAME test (the same
// functions, draws and seed, lib/keyness.mjs) under eleven perturbations
// that were fixed before any result was seen, and publishes how many of the
// baseline's significant results each one keeps.
//
// The perturbations (periods are contiguous in Cairo revelation order:
// early 1-33, middle 34-49, late 50-86, Medinan 87-114):
//   shift      each of the three period boundaries moved 5 places earlier and
//              5 later, one at a time (6 variants)
//   drop       the largest surah (by Leeds tokens) of one period removed
//              from everything, one period at a time (4 variants). Keyness is
//              read at surah level, so this asks whether one long surah is
//              carrying a period's result
//   twoperiod  Meccan (revelation order 1-86) against Medinan (87-114); only
//              the Medinan result is comparable with the baseline's Medinan
//
// Checked and set aside: the surah classification in data/surah-meta.json
// (Makki/Madani) disagrees with the baseline periods for 0 of 114 surahs, so
// it is not an independent alternative and is not a perturbation.
//
// For each variant: of the baseline tests with BH q <= 0.05, the share that
// are still q <= 0.05 with the same direction ("retained"), per period and
// overall; and the Spearman correlation of signed G2 across all comparable
// tests.
//
// Verdict thresholds, declared in advance and applied to the WORST variant:
//   Survives  every variant retains at least HOLDS (80%) of baseline results
//   Partly    every variant retains at least PARTLY (50%)
//   Fragile   some variant retains less than that
// "Survives" means robust to these perturbations only; it does not mean the
// result is meaningful or true.
//
// Faithfulness: the script first re-derives the baseline with its own loader
// and refuses to continue unless every G2 and permutation p matches
// data/keyness/period-keyness.json exactly.
//
// Deterministic: the baseline's seed. Output: data/robustness/period-keyness.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32, shuffle } from "./lib/permute.mjs";
import { bhAdjust, spearman } from "./lib/stats.mjs";
import { periodStats, permutationGE } from "./lib/keyness.mjs";
import { inputDigest, bodyDigest } from "./lib/input-digest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "robustness", "period-keyness.json");
const BASE = join(ROOT, "data", "keyness", "period-keyness.json");
const CHECK = process.argv.includes("--check");
const FULL = process.argv.includes("--full");
const INPUTS = [
  join(ROOT, "data", "morphology"),
  join(ROOT, "data", "chronology.json"),
  join(ROOT, "data", "keyness", "period-keyness.json"),
  join(ROOT, "scripts", "build-robustness.mjs"),
  join(ROOT, "scripts", "lib", "keyness.mjs"),
  join(ROOT, "scripts", "lib", "permute.mjs"),
  join(ROOT, "scripts", "lib", "stats.mjs"),
];
const DRAWS = 100000;
const SEED = 20261018; // the baseline's seed, so the baseline reproduces exactly
const ALPHA = 0.05;
const HOLDS = 0.8;
const PARTLY = 0.5;
const SHIFT = 5;
const PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
const CUTS = [33, 49, 86]; // last revelation order of early, middle, late

const DIGEST = inputDigest(ROOT, INPUTS);
if (CHECK && !FULL) {
  if (!existsSync(OUT)) {
    console.error("build-robustness --check: FAIL — data/robustness/period-keyness.json is missing.\n  Run: node scripts/build-robustness.mjs");
    process.exit(1);
  }
  const stored = JSON.parse(readFileSync(OUT, "utf8"));
  if (stored.inputDigest !== DIGEST) {
    console.error("build-robustness --check: FAIL — the morphology, chronology, baseline, script or libraries changed since the output was written.\n  Run: node scripts/build-robustness.mjs");
    process.exit(1);
  }
  if (stored.outputDigest !== bodyDigest(stored)) {
    console.error("build-robustness --check: FAIL — the stored file does not match its outputDigest (hand-edited?).\n  Run: node scripts/build-robustness.mjs");
    process.exit(1);
  }
  console.log(`build-robustness --check: OK (${stored.variants.length} variants; inputs unchanged; the full recompute is --check --full).`);
  process.exit(0);
}

// ── load (the same reading of the corpus as compute-period-keyness.mjs) ──
const chron = JSON.parse(readFileSync(join(ROOT, "data", "chronology.json"), "utf8"));
const rootIndex = new Map();
const rootNames = [];
const allRows = [];
const allTokens = [];
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
  allRows.push(c);
  allTokens.push(t);
}
const K = rootNames.length;
const order = Array.from({ length: 114 }, (_, i) => chron[i + 1].revelationOrder);
const baseLabels = Array.from({ length: 114 }, (_, i) => {
  const p = PERIODS.indexOf(chron[i + 1].period);
  if (p < 0) throw new Error(`surah ${i + 1} has unknown period "${chron[i + 1].period}". STOPPING.`);
  return p;
});

// Run the baseline test on a set of surahs (indexes into 0..113) with their
// period labels. Returns, per (period, root), signed G2, p and BH q.
function runTest(keep, labels, P, periodNames) {
  const rows = keep.map((s) => allRows[s]);
  const tokens = keep.map((s) => allTokens[s]);
  const totals = new Float64Array(K);
  rows.forEach((c) => { for (const [k, x] of c) totals[k] += x; });
  const totalTokens = tokens.reduce((a, b) => a + b, 0);
  const obs = periodStats(rows, tokens, labels, K, P, totals, totalTokens);
  const ge = permutationGE(rows, tokens, labels, obs.g2, K, P, totals, totalTokens, DRAWS, mulberry32(SEED), shuffle);
  const p = Array.from(ge, (x) => (1 + x) / (DRAWS + 1));
  const q = bhAdjust(p);
  const out = new Map();
  for (let pi = 0; pi < P; pi++) {
    for (let k = 0; k < K; k++) {
      const i = pi * K + k;
      const a = obs.counts[i];
      const rest = totals[k] - a;
      const enriched = a / obs.periodTokens[pi] > rest / (totalTokens - obs.periodTokens[pi]);
      out.set(`${periodNames[pi]}|${rootNames[k]}`, { g2: obs.g2[i], p: p[i], q: q[i], enriched });
    }
  }
  return out;
}

const log = (msg) => process.stderr.write(msg + "\n");

// ── faithfulness: the baseline must reproduce exactly ────────────────────
const stored = JSON.parse(readFileSync(BASE, "utf8"));
log("baseline re-derivation...");
const all = Array.from({ length: 114 }, (_, i) => i);
const mine = runTest(all, baseLabels, 4, PERIODS);
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
for (const r of stored.rows) {
  const m = mine.get(`${r.period}|${r.root}`);
  if (!m || round(m.g2, 3) !== r.g2 || round(m.p, 6) !== r.permutationP) {
    console.error(`build-robustness: the re-derived baseline differs from data/keyness/period-keyness.json at ${r.root} / ${r.period}. STOPPING.`);
    process.exit(1);
  }
}
const baseSig = stored.rows.filter((r) => r.bhQ <= ALPHA);

// ── variants ─────────────────────────────────────────────────────────────
function byCuts(cuts) {
  return order.map((o) => (o <= cuts[0] ? 0 : o <= cuts[1] ? 1 : o <= cuts[2] ? 2 : 3));
}
const variants = [];
const names = ["early/middle", "middle/late", "late/Medinan"];
for (let c = 0; c < 3; c++) {
  for (const sign of [-1, 1]) {
    const cuts = CUTS.slice();
    cuts[c] += sign * SHIFT;
    variants.push({
      id: `shift-${c}-${sign < 0 ? "earlier" : "later"}`,
      kind: "shift",
      label: `${names[c]} boundary ${SHIFT} places ${sign < 0 ? "earlier" : "later"}`,
      keep: all,
      labels: byCuts(cuts),
      P: 4,
      periodNames: PERIODS,
    });
  }
}
for (let pi = 0; pi < 4; pi++) {
  const members = all.filter((s) => baseLabels[s] === pi);
  const biggest = members.reduce((a, b) => (allTokens[b] > allTokens[a] ? b : a));
  const keep = all.filter((s) => s !== biggest);
  variants.push({
    id: `drop-${PERIODS[pi]}`,
    kind: "drop",
    label: `largest ${PERIODS[pi]} surah removed (surah ${biggest + 1}, ${allTokens[biggest].toLocaleString("en-US")} tokens)`,
    keep,
    labels: keep.map((s) => baseLabels[s]),
    P: 4,
    periodNames: PERIODS,
    droppedSurah: biggest + 1,
  });
}
variants.push({
  id: "two-period",
  kind: "twoperiod",
  label: "Meccan (order 1-86) against Medinan (order 87-114); Medinan compared",
  keep: all,
  labels: order.map((o) => (o <= CUTS[2] ? 0 : 1)),
  P: 2,
  periodNames: ["meccan", "medinan"],
  comparable: ["medinan"],
});

const results = [];
for (const v of variants) {
  log(`variant ${results.length + 1}/${variants.length}: ${v.id}`);
  const run = runTest(v.keep, v.labels, v.P, v.periodNames);
  const comparable = v.comparable || PERIODS;
  const base = baseSig.filter((r) => comparable.includes(r.period));
  let held = 0;
  const perPeriod = comparable.map((per) => {
    const b = base.filter((r) => r.period === per);
    const h = b.filter((r) => {
      const m = run.get(`${per}|${r.root}`);
      return m && m.q <= ALPHA && (m.enriched ? "enriched" : "depleted") === r.direction;
    });
    held += h.length;
    return { period: per, baseline: b.length, held: h.length };
  });
  const xs = [];
  const ys = [];
  for (const r of stored.rows) {
    if (!comparable.includes(r.period)) continue;
    const m = run.get(`${r.period}|${r.root}`);
    xs.push(r.direction === "enriched" ? r.g2 : -r.g2);
    ys.push(m.enriched ? m.g2 : -m.g2);
  }
  const retained = base.length ? held / base.length : 1;
  // How much of the text the perturbation touches: surahs whose period
  // differs from the baseline's (shift variants) or that were removed (drop).
  const moved = v.kind === "shift" ? all.filter((s) => v.labels[s] !== baseLabels[s]) : v.kind === "drop" ? [v.droppedSurah - 1] : [];
  const movedTokens = moved.reduce((n, s) => n + allTokens[s], 0);
  results.push({
    id: v.id,
    kind: v.kind,
    label: v.label,
    surahs: v.keep.length,
    touchedSurahs: moved.map((x) => x + 1),
    touchedTokens: movedTokens,
    touchedShareOfAllTokens: round(movedTokens / allTokens.reduce((x, y) => x + y, 0), 3),
    periods: v.P,
    comparablePeriods: comparable,
    baselineSignificant: base.length,
    retained: held,
    retainedShare: round(retained, 3),
    perPeriod,
    spearmanSignedG2: round(spearman(xs, ys), 3),
    _heldKeys: base.filter((r) => { const m = run.get(`${r.period}|${r.root}`); return m && m.q <= ALPHA && (m.enriched ? "enriched" : "depleted") === r.direction; }).map((r) => `${r.period}|${r.root}`),
  });
}

const worst = results.reduce((a, b) => (b.retainedShare < a.retainedShare ? b : a));
const verdict = worst.retainedShare >= HOLDS ? "Survives" : worst.retainedShare >= PARTLY ? "Partly" : "Fragile";

// Which baseline-significant tests held in every variant that could test them.
const coreRows = baseSig.map((r) => {
  const testing = results.filter((x) => x.comparablePeriods.includes(r.period));
  const key = `${r.period}|${r.root}`;
  const heldIn = testing.filter((x) => x._heldKeys.includes(key)).length;
  return { root: r.root, period: r.period, direction: r.direction, heldIn, of: testing.length };
}).sort((a, b) => (b.heldIn / b.of) - (a.heldIn / a.of) || a.period.localeCompare(b.period) || a.root.localeCompare(b.root));
for (const x of results) delete x._heldKeys;

const body = {
  _comment:
    "GENERATED by scripts/build-robustness.mjs. How many of the period-keyness results (data/keyness/period-keyness.json) survive eleven perturbations fixed in advance. Robust to these perturbations only; this does not show a result is meaningful or true.",
  source: "Leeds Quranic Arabic Corpus v0.4 (GPL); data/chronology.json; data/keyness/period-keyness.json",
  method: {
    test: `the baseline test unchanged (lib/keyness.mjs; ${DRAWS.toLocaleString("en-US")} surah-level permutation draws, seed ${SEED}, BH q <= ${ALPHA})`,
    shiftPlaces: SHIFT,
    retained: "of the baseline tests with q <= 0.05, the share still q <= 0.05 with the same direction",
    thresholds: { holds: HOLDS, partly: PARTLY },
    verdictRule: `Survives if every variant retains at least ${HOLDS * 100}%; Partly if every variant retains at least ${PARTLY * 100}%; otherwise Fragile. Applied to the worst variant.`,
    setAside: "data/surah-meta.json Makki/Madani classification disagrees with the baseline periods for 0 of 114 surahs, so it is not an independent alternative.",
    faithfulness: "the baseline is re-derived with this script's own loader and must match data/keyness/period-keyness.json exactly (G2 and p for all 6,568 tests) before any variant runs",
  },
  baseline: { tests: stored.rows.length, significant: baseSig.length, perPeriod: stored.observed.perPeriod },
  summary: {
    verdict,
    worstVariant: worst.id,
    worstRetainedShare: worst.retainedShare,
    heldInAllVariants: coreRows.filter((r) => r.heldIn === r.of).length,
  },
  variants: results,
  tests: coreRows,
};
const outDoc = { inputDigest: DIGEST, outputDigest: bodyDigest(body), ...body };
const text = JSON.stringify(outDoc) + "\n";

if (CHECK) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
    console.error("build-robustness --check --full: FAIL — data/robustness/period-keyness.json is stale.\n  Run: node scripts/build-robustness.mjs");
    process.exit(1);
  }
  console.log(`build-robustness --check --full: OK (verdict ${verdict}).`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  console.log(
    `build-robustness: ${results.length} variants; verdict ${verdict} (worst: ${worst.id} keeps ${(worst.retainedShare * 100).toFixed(1)}% of ${baseSig.length}); ` +
    `${outDoc.summary.heldInAllVariants} of ${baseSig.length} held in every variant that could test them.`,
  );
}
