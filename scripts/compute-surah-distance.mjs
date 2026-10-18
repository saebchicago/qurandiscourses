#!/usr/bin/env node
//
// compute-surah-distance.mjs: how far apart two surahs' root vocabularies
// are, with a permutation null so the number can be read against what
// chance and surah length alone produce.
//
//   node scripts/compute-surah-distance.mjs           # rewrite
//   node scripts/compute-surah-distance.mjs --check   # exit 1 if stale
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
//                recompute the distance; R = 500 draws, seeded
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
import { mulberry32 } from "./lib/permute.mjs";
import { jsDistance } from "./lib/surah-distance.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "surah-distance", "surah-distance.json");
const CHECK = process.argv.includes("--check");
const SEED = 20261018;
const DRAWS = 500;
const LOW_COUNT = 100;

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

// ── per pair ────────────────────────────────────────────────────────────
const rnd = mulberry32(SEED);
const A = new Float64Array(K);
const B = new Float64Array(K);
const mark = new Uint8Array(K);

function addVerse(arr, v) {
  for (let i = 0; i < v.keys.length; i++) arr[v.keys[i]] += v.counts[i];
}

function pairStats(i, j) {
  const sa = surahs[i], sb = surahs[j];
  const pool = sa.verses.concat(sb.verses);
  const nA = sa.verses.length;
  // pool keys and totals
  const keys = [];
  const total = new Float64Array(K);
  let nTotal = 0;
  for (const v of pool) {
    for (let t = 0; t < v.keys.length; t++) {
      const k = v.keys[t];
      if (!mark[k]) { mark[k] = 1; keys.push(k); }
      total[k] += v.counts[t];
      nTotal += v.counts[t];
    }
  }
  const observedA = new Float64Array(K);
  for (const v of sa.verses) addVerse(observedA, v);
  const observedB = new Float64Array(K);
  for (const v of sb.verses) addVerse(observedB, v);
  const obs = jsDistance(observedA, observedB, keys, sa.tokens, sb.tokens);

  const idx = pool.map((_, k) => k);
  let ge = 0, sum = 0;
  for (let r = 0; r < DRAWS; r++) {
    for (let k = idx.length - 1; k > 0; k--) {
      const m = Math.floor(rnd() * (k + 1));
      const tmp = idx[k]; idx[k] = idx[m]; idx[m] = tmp;
    }
    for (let q = 0; q < keys.length; q++) A[keys[q]] = 0;
    let na = 0;
    for (let k = 0; k < nA; k++) {
      const v = pool[idx[k]];
      for (let t = 0; t < v.keys.length; t++) { A[v.keys[t]] += v.counts[t]; na += v.counts[t]; }
    }
    for (let q = 0; q < keys.length; q++) B[keys[q]] = total[keys[q]] - A[keys[q]];
    const d = jsDistance(A, B, keys, na, nTotal - na);
    if (Number.isNaN(d)) throw new Error(`Empty side in a permutation draw for surahs ${i + 1} and ${j + 1}. STOPPING.`);
    sum += d;
    if (d >= obs - 1e-12) ge++;
  }
  for (const k of keys) { mark[k] = 0; A[k] = 0; B[k] = 0; }
  return { obs, nullMean: sum / DRAWS, p: (1 + ge) / (DRAWS + 1) };
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const rows = [];
for (let i = 0; i < 114; i++) {
  for (let j = i + 1; j < 114; j++) {
    const st = pairStats(i, j);
    rows.push({
      surahA: i + 1,
      surahB: j + 1,
      rootedTokensA: surahs[i].tokens,
      rootedTokensB: surahs[j].tokens,
      distance: st.obs,
      nullMean: st.nullMean,
      excess: round(st.obs, 4) - round(st.nullMean, 4),
      permutationP: st.p,
      lowCount: surahs[i].tokens < LOW_COUNT || surahs[j].tokens < LOW_COUNT,
    });
  }
}

// Benjamini-Hochberg adjusted q-values over all pairs.
const order = rows.map((_, k) => k).sort((x, y) => rows[x].permutationP - rows[y].permutationP || x - y);
const m = rows.length;
let running = 1;
for (let r = m - 1; r >= 0; r--) {
  const k = order[r];
  running = Math.min(running, (rows[k].permutationP * m) / (r + 1));
  rows[k].bhQ = running;
}

const out = {
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
  pairs: rows.map((r) => ({
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
  })),
};
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
