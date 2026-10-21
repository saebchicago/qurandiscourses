#!/usr/bin/env node
//
// compute-surah-distance.mjs: how far apart two surahs' root vocabularies
// are, with a permutation null so the number can be read against what
// chance and surah length alone produce.
//
//   node scripts/compute-surah-distance.mjs           # rewrite
//   node scripts/compute-surah-distance.mjs --check   # fast: input digest + stored-rows digest
//   node scripts/compute-surah-distance.mjs --check --full   # recompute everything (~2.5 min), exit 1 if stale
//
// Source: Leeds Quranic Arabic Corpus v0.4 (GPL), data/morphology/. Only
// tokens with an annotated root count.
//
// For each of the 6,441 surah pairs:
//   observed   = Jensen-Shannon distance between the two surahs' root
//                distributions (sqrt of base-2 JSD, range 0..1; Lin 1991;
//                a metric, Endres & Schindelin 2003)
//   null       = pool the verses of both surahs, reassign verses to the two
//                sides at random with side sizes (in verses) held fixed,
//                recompute the distance; R = 2,000 draws, seeded
//   nullMean   = mean of those draws. Plug-in JSD from finite samples is
//                biased upward, more so for short surahs, so the observed
//                value is read as excess over this null, never alone.
//   excess     = observed - nullMean
//   p          = (1 + #draws with distance >= observed) / (R + 1)
//   q          = Benjamini-Hochberg over all 6,441 pairs
// The null holds verse COUNTS per side fixed, not token counts: a pair whose
// verses differ in length draws token splits unlike the observed one, so the
// excess is calibrated for verse assignment, not for token totals.
// A verse-block bootstrap interval was tried first and rejected: the
// plug-in statistic is biased, so the resampled distribution does not
// bracket the observed value (see docs/ELEVATION-PLAN.md, C4 method).
//
// lowCount marks pairs where either surah has fewer than 100 rooted tokens;
// the distance is still reported, flagged, never dropped.
//
// Deterministic: seed 20261018, fixed draw order, no dates. Output:
//   data/surah-distance/surah-distance.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pairwiseDistances } from "./lib/surah-distance.mjs";
import { inputDigest, bodyDigest } from "./lib/input-digest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "surah-distance", "surah-distance.json");
const CHECK = process.argv.includes("--check");
const FULL = process.argv.includes("--full");
const INPUTS = [
  join(ROOT, "data", "morphology"),
  join(ROOT, "scripts", "compute-surah-distance.mjs"),
  join(ROOT, "scripts", "lib", "surah-distance.mjs"),
  join(ROOT, "scripts", "lib", "permute.mjs"),
  join(ROOT, "scripts", "lib", "stats.mjs"),
];
const SEED = 20261018;
const DRAWS = 2000;
const LOW_COUNT = 100;

// ── fast check: inputs unchanged and the stored rows untampered ─────────
const DIGEST = inputDigest(ROOT, INPUTS);
if (CHECK && !FULL) {
  if (!existsSync(OUT)) {
    console.error("compute-surah-distance --check: FAIL — data/surah-distance/surah-distance.json is missing.\n  Run: node scripts/compute-surah-distance.mjs");
    process.exit(1);
  }
  const stored = JSON.parse(readFileSync(OUT, "utf8"));
  if (stored.inputDigest !== DIGEST) {
    console.error("compute-surah-distance --check: FAIL — the morphology, script or libraries changed since the output was written.\n  Run: node scripts/compute-surah-distance.mjs");
    process.exit(1);
  }
  if (stored.outputDigest !== bodyDigest(stored)) {
    console.error("compute-surah-distance --check: FAIL — the stored file does not match its outputDigest (hand-edited?).\n  Run: node scripts/compute-surah-distance.mjs");
    process.exit(1);
  }
  console.log(`compute-surah-distance --check: OK (${stored.pairs.length} pairs; inputs unchanged; the full recompute is --check --full, run weekly).`);
  process.exit(0);
}

// ── load: per surah, per verse, sparse root counts ──────────────────────
const rootIndex = new Map();
const surahs = []; // [{ keys: Int32Array[], counts: Int32Array[], tokens }]
for (let s = 1; s <= 114; s++) {
  const m = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
  const verses = [];
  let tokens = 0;
  for (const v of Object.keys(m).map(Number).sort((a, b) => a - b)) {
    const c = new Map();
    for (const w of m[v]) {
      if (!w.root) continue;
      if (!rootIndex.has(w.root)) rootIndex.set(w.root, rootIndex.size);
      const i = rootIndex.get(w.root);
      c.set(i, (c.get(i) || 0) + 1);
      tokens++;
    }
    verses.push({ keys: Int32Array.from(c.keys()), counts: Int32Array.from(c.values()) });
  }
  surahs.push({ verses, tokens });
}
const K = rootIndex.size;

// ── every pair: distance, permutation null, p, BH q ─────────────────────
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const rows = pairwiseDistances(surahs, K, { draws: DRAWS, seed: SEED, lowCount: LOW_COUNT });
const m = rows.length;

const pairsOut = rows.map((r) => ({
    surahA: r.surahA,
    surahB: r.surahB,
    rootedTokensA: r.rootedTokensA,
    rootedTokensB: r.rootedTokensB,
    distance: round(r.distance, 4),
    nullMean: round(r.nullMean, 4),
    excess: round(r.excess, 4), // difference of the two rounded columns, so the published columns agree
    permutationP: round(r.permutationP, 5),
    bhQ: round(r.bhQ, 5),
    lowCount: r.lowCount,
  }));
const body = {
  _comment:
    "GENERATED by scripts/compute-surah-distance.mjs. Jensen-Shannon distance between surahs' root distributions with a permutation null; read excess over null, not the raw distance. See the script header.",
  source: "Leeds Quranic Arabic Corpus v0.4 (GPL), rooted tokens only",
  method: {
    distance: "sqrt of base-2 Jensen-Shannon divergence, range 0..1",
    null: `pool both surahs' verses, reassign verses at random with side sizes in verses fixed, ${DRAWS} draws, mulberry32 seed ${SEED}`,
    p: "(1 + draws with null distance >= observed) / (draws + 1)",
    q: `Benjamini-Hochberg over all ${m} pairs`,
    lowCountRule: `either surah has fewer than ${LOW_COUNT} rooted tokens`,
  },
  pairs: pairsOut,
};
const out = { inputDigest: DIGEST, outputDigest: bodyDigest(body), ...body };
const text = JSON.stringify(out) + "\n";

if (CHECK) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
    console.error("compute-surah-distance --check: FAIL — data/surah-distance/surah-distance.json is stale.\n  Run: node scripts/compute-surah-distance.mjs");
    process.exit(1);
  }
  console.log(`compute-surah-distance --check: OK (${m} pairs).`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  const sig = rows.filter((r) => r.bhQ <= 0.05).length;
  console.log(`compute-surah-distance: wrote ${m} pairs (${sig} with q <= 0.05).`);
}
