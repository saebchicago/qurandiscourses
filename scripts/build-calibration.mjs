#!/usr/bin/env node
//
// build-calibration.mjs: how often does each null-tested method on the site
// report something when there is nothing to find?
//
//   node scripts/build-calibration.mjs                  # rewrite (~3 min)
//   node scripts/build-calibration.mjs --check          # fast: digests
//   node scripts/build-calibration.mjs --check --full   # recompute and compare
//
// Every statistic the site tests against a null is run again on data where
// the null is true by construction, and what it reports there is published
// beside what it reports on the real text (data/calibration/report.json,
// shown on the Validation page):
//
//   one/two/three-slot templates   already run on 100 verse-shuffled copies
//                                  by build-formulaic-templates.mjs; read back
//   period keyness                 already run on 40 relabeled chronologies
//                                  by compute-period-keyness.mjs; read back
//   surah distance                 verses shuffled across the WHOLE text, each
//                                  pseudo-surah keeping a real surah's verse
//                                  count; the full pairwise pipeline
//                                  (lib/surah-distance.mjs, 200 draws per
//                                  pair) is run on 10 such texts
//   period association (Q test)    each verse given a random period with the
//                                  period sizes kept; the pipeline of
//                                  lib/association-by-period.mjs on 5 such
//                                  assignments
//
// A false-positive count is only informative next to the nominal level it
// should be near. For the two that report a raw p-value rate, that level is
// 5% at p <= 0.05; a rate far below it means the test is conservative (it
// will miss real effects), far above means it overstates.
//
// Deterministic: fixed seeds. Output: data/calibration/report.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32, shuffle } from "./lib/permute.mjs";
import { pairwiseDistances } from "./lib/surah-distance.mjs";
import { associationByPeriod, PERIODS } from "./lib/association-by-period.mjs";
import { inputDigest, bodyDigest } from "./lib/input-digest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "calibration", "report.json");
const CHECK = process.argv.includes("--check");
const FULL = process.argv.includes("--full");
const INPUTS = [
  join(ROOT, "data", "morphology"),
  join(ROOT, "data", "chronology.json"),
  join(ROOT, "data", "formulaic-templates.json"),
  join(ROOT, "data", "keyness", "period-keyness.json"),
  join(ROOT, "data", "root-analytics"),
  join(ROOT, "data", "exports", "association-pairs.csv"),
  join(ROOT, "scripts", "build-calibration.mjs"),
  join(ROOT, "scripts", "lib", "surah-distance.mjs"),
  join(ROOT, "scripts", "lib", "association-by-period.mjs"),
  join(ROOT, "scripts", "lib", "association-measures.mjs"),
  join(ROOT, "scripts", "lib", "permute.mjs"),
  join(ROOT, "scripts", "lib", "stats.mjs"),
];
const DIST_RUNS = 10;
const DIST_DRAWS = 200;
const DIST_SEED = 20261020;
const ABP_RUNS = 5;
const ABP_SEED = 20261021;
const LOW_COUNT = 100;

const DIGEST = inputDigest(ROOT, INPUTS);
if (CHECK && !FULL) {
  if (!existsSync(OUT)) {
    console.error("build-calibration --check: FAIL — data/calibration/report.json is missing.\n  Run: node scripts/build-calibration.mjs");
    process.exit(1);
  }
  const stored = JSON.parse(readFileSync(OUT, "utf8"));
  if (stored.inputDigest !== DIGEST) {
    console.error("build-calibration --check: FAIL — an input changed since the report was written.\n  Run: node scripts/build-calibration.mjs");
    process.exit(1);
  }
  if (stored.outputDigest !== bodyDigest(stored)) {
    console.error("build-calibration --check: FAIL — the stored report does not match its outputDigest (hand-edited?).\n  Run: node scripts/build-calibration.mjs");
    process.exit(1);
  }
  console.log(`build-calibration --check: OK (${stored.tests.length} methods; inputs unchanged; the full recompute is --check --full, run weekly).`);
  process.exit(0);
}

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const tests = [];

// ── templates: read back ────────────────────────────────────────────────
const tpl = readJson("data/formulaic-templates.json");
for (const sh of tpl.shapes) {
  tests.push({
    id: `templates-${sh.slots}-slot`,
    method: `Templates with ${sh.slots} open slot${sh.slots === 1 ? "" : "s"}`,
    nullDescription: `${sh.null.shuffles} copies of the text with the words shuffled inside every verse`,
    realFindings: `${sh.observed.systems} of ${sh.observed.candidates} candidates pass BH at q <= 0.05`,
    nullFindings: `${sh.null.systems.mean} pass on average (at most ${sh.null.systems.max}); ${sh.null.shufflesWithAnySystem} of ${sh.null.shuffles} copies have any`,
    anyFindingRate: round(sh.null.shufflesWithAnySystem / sh.null.shuffles, 3),
    nominal: 0.05,
    reading: "The share of null copies with any finding estimates how often the whole analysis would report something in noise; Benjamini-Hochberg aims to keep it near 0.05.",
  });
}

// ── period keyness: read back ───────────────────────────────────────────
const key = readJson("data/keyness/period-keyness.json");
tests.push({
  id: "period-keyness",
  method: "Period keyness (G2 against a surah-to-period permutation null)",
  nullDescription: `${key.calibration.runs.length} random relabelings of the surahs, each tested against its own fresh permutations`,
  realFindings: `${key.observed.passingBH} of ${key.observed.tests} root-period tests pass BH at q <= 0.05`,
  nullFindings: `${key.calibration.testsPassingBH.mean} pass on average (at most ${key.calibration.testsPassingBH.max}); ${key.calibration.runsWithAnyPassing} of ${key.calibration.runs.length} relabelings have any`,
  anyFindingRate: round(key.calibration.runsWithAnyPassing / key.calibration.runs.length, 3),
  nominal: 0.05,
  reading: "Findings arrive in bursts (several roots at once) because roots share surahs; the share of relabelings with any finding is the figure to compare with 0.05.",
});

// ── surah distance: pseudo-surahs ───────────────────────────────────────
const rootIndex = new Map();
const verseList = []; // every verse's sparse root counts, in text order
const surahSizes = [];
for (let s = 1; s <= 114; s++) {
  const m = readJson(`data/morphology/${s}.json`);
  const vs = Object.keys(m).map(Number).sort((a, b) => a - b);
  surahSizes.push(vs.length);
  for (const v of vs) {
    const c = new Map();
    for (const w of m[v]) {
      if (!w.root) continue;
      if (!rootIndex.has(w.root)) rootIndex.set(w.root, rootIndex.size);
      const i = rootIndex.get(w.root);
      c.set(i, (c.get(i) || 0) + 1);
    }
    verseList.push({ keys: Int32Array.from(c.keys()), counts: Int32Array.from(c.values()) });
  }
}
const K = rootIndex.size;
const distRng = mulberry32(DIST_SEED);
const distRuns = [];
for (let r = 0; r < DIST_RUNS; r++) {
  const order = verseList.slice();
  shuffle(order, distRng);
  const surahs = [];
  let at = 0;
  for (const n of surahSizes) {
    const verses = order.slice(at, at + n);
    at += n;
    surahs.push({ verses, tokens: verses.reduce((t, v) => t + v.counts.reduce((a, b) => a + b, 0), 0) });
  }
  const rows = pairwiseDistances(surahs, K, { draws: DIST_DRAWS, seed: DIST_SEED + 1 + r, lowCount: LOW_COUNT });
  distRuns.push({
    pairs: rows.length,
    shareP05: round(rows.filter((x) => x.permutationP <= 0.05).length / rows.length, 4),
    passingBH: rows.filter((x) => x.bhQ <= 0.05).length,
    meanExcess: round(rows.reduce((a, x) => a + x.excess, 0) / rows.length, 4),
  });
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dist = readJson("data/surah-distance/surah-distance.json");
tests.push({
  id: "surah-distance",
  method: "Surah distance (permutation null, BH over 6,441 pairs)",
  nullDescription: `${DIST_RUNS} texts in which all 6,236 verses are shuffled across the whole Qur'an and cut into pseudo-surahs of the real surahs' verse counts; the full pairwise pipeline at ${DIST_DRAWS} draws per pair`,
  realFindings: `${dist.pairs.filter((x) => x.bhQ <= 0.05).length} of ${dist.pairs.length} pairs pass BH at q <= 0.05`,
  nullFindings: `${round(mean(distRuns.map((x) => x.passingBH)), 2)} pairs pass on average (at most ${Math.max(...distRuns.map((x) => x.passingBH))}); ${round(100 * mean(distRuns.map((x) => x.shareP05)), 2)}% of pairs have p <= 0.05; mean excess ${round(mean(distRuns.map((x) => x.meanExcess)), 4)}`,
  anyFindingRate: round(distRuns.filter((x) => x.passingBH > 0).length / DIST_RUNS, 3),
  rawPRate: round(mean(distRuns.map((x) => x.shareP05)), 4),
  nominal: 0.05,
  reading: "On a text where verse order carries no surah structure the share of raw p <= 0.05 should be near 5% and the mean excess near 0. This checks the code and the BH step; it says nothing about whether real surahs are exchangeable collections of verses, which they are not, and that is the finding.",
  runs: distRuns,
});

// ── period association heterogeneity (Cochran Q) ────────────────────────
const chron = readJson("data/chronology.json");
const refs = [];
for (let s = 1; s <= 114; s++) for (const v of Object.keys(readJson(`data/morphology/${s}.json`))) refs.push(`${s}:${v}`);
const labels0 = refs.map((r) => PERIODS.indexOf(chron[r.split(":")[0]].period));
const abpRng = mulberry32(ABP_SEED);
const abpRuns = [];
for (let r = 0; r < ABP_RUNS; r++) {
  const l = labels0.slice();
  shuffle(l, abpRng);
  const map = new Map(refs.map((x, i) => [x, PERIODS[l[i]]]));
  const res = associationByPeriod(ROOT, { periodOfRef: (ref) => map.get(ref) });
  const t = res.rows.filter((x) => x.heterogeneityP != null);
  abpRuns.push({
    tested: t.length,
    shareP05: round(t.filter((x) => x.heterogeneityP <= 0.05).length / t.length, 4),
    passingBH: res.summary.heterogeneousBH,
  });
}
const real = associationByPeriod(ROOT).summary;
tests.push({
  id: "association-by-period",
  method: "Period heterogeneity of root-pair association (Cochran Q)",
  nullDescription: `${ABP_RUNS} assignments of a random period to every verse, period sizes kept; the same pipeline`,
  realFindings: `${real.heterogeneousBH} of ${real.tested} pairs pass BH at q <= 0.05`,
  nullFindings: `${round(100 * mean(abpRuns.map((x) => x.shareP05)), 2)}% of pairs have raw p <= 0.05 (nominal 5%); ${round(mean(abpRuns.map((x) => x.passingBH)), 2)} pass BH on average`,
  anyFindingRate: round(abpRuns.filter((x) => x.passingBH > 0).length / ABP_RUNS, 3),
  rawPRate: round(mean(abpRuns.map((x) => x.shareP05)), 4),
  nominal: 0.05,
  reading: "A raw rate well below 0.05 means the test is conservative: with sparse counts in the smaller periods the chi-square reference over-states the variance of the estimates, so the pairs that pass are real but many period-specific pairs will be missed. The count of significant pairs is a lower bound.",
  runs: abpRuns,
});

const body = {
  _comment:
    "GENERATED by scripts/build-calibration.mjs. What each null-tested method on the site reports on data where the null is true by construction, beside what it reports on the real text.",
  tests,
};
const out = { inputDigest: DIGEST, outputDigest: bodyDigest(body), ...body };
const text = JSON.stringify(out) + "\n";

if (CHECK) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
    console.error("build-calibration --check --full: FAIL — data/calibration/report.json is stale.\n  Run: node scripts/build-calibration.mjs");
    process.exit(1);
  }
  console.log(`build-calibration --check --full: OK (${tests.length} methods).`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  for (const t of tests) console.log(`${t.id}: real: ${t.realFindings}. null: ${t.nullFindings}.`);
}
