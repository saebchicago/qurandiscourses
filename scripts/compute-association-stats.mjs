#!/usr/bin/env node
//
// compute-association-stats.mjs: generate root-pair association statistics
// and normalized frequencies as static JSON.
//
// Source: Leeds Quranic Arabic Corpus v0.4 (Kais Dukes, corpus.quran.com, GPL)
// Chronology source: Egyptian Standard (Cairo 1924) revelation order,
// four-period classification following the Nöldeke-Bell tradition (Watt,
// "Bell's Introduction to the Qur'an", 1970); the same data/chronology.json
// already used by scripts/build-cooccurrence.mjs and scripts/build-numbers.mjs.
//
// This script does not read or modify any existing data/*.json output. It
// reads data/morphology/, data/roots-summary.json, data/chronology.json, and
// data/numbers.json (for period token totals already computed there) and
// writes only new files under data/association/.
//
// Output (kept under the 3 MB budget by NOT repeating metadata or
// per-period breakdowns in every one of the 1,642 per-root files; a
// separate export script, scripts/build-exports.mjs, reads this
// script's in-repo outputs plus the existing data/ files to produce the
// larger, unbounded root-frequency and full-pair CSV/JSON downloads
// under data/exports/):
//   data/association/{safeKey}.json: per root, overall normalized
//     frequency and the top 25 association partners by log-likelihood
//     ratio (k11, PMI, Dice, LLR).
//   data/association/keyness-top.json: top 15 roots per period by
//     keyness (G2), for the Numbers page.
//   data/association/methods.json: the shared metadata block (script
//     name, formulas, thresholds, source, chronology source, generation
//     date) referenced by every per-root file instead of repeating it.
//
// Formulas (root pair association, verse-level 2x2 over N = 6,236 verses):
//   k11 = verses containing both roots
//   k12 = verses containing root A only
//   k21 = verses containing root B only
//   k22 = verses containing neither (N - k11 - k12 - k21)
//   PMI  = log2( (k11 * N) / ((k11 + k12) * (k11 + k21)) )
//   Dice = 2*k11 / (2*k11 + k12 + k21)
//   LLR  = Dunning's G2 = 2 * sum( O * ln(O / E) ) over the four 2x2
//          cells, E from row/column marginals over N. A cell with O = 0
//          contributes 0 (the limit of x*ln(x) as x -> 0).
//   A pair is only computed/kept if k11 >= 5.
//
// Formulas (keyness, token-level 2x2 per root per period):
//   a = root's token count in the period (data/roots-summary.json byChronology)
//   b = root's token count in the rest of the corpus (totalCount - a)
//   c = other tokens in the period (periodTokens - a)
//   d = other tokens in the rest of the corpus (totalTokens - periodTokens - b)
//   G2 = same Dunning log-likelihood formula as above, over {a, b, c, d}.
//
// Normalized frequency: (count / totalTokens) * 1000, i.e. per 1,000 tokens.
// Overall normalized frequency is Verified (direct computation from the
// corpus). Per-period normalized frequency and keyness are Nuanced: they
// depend on the four-period chronology above, one scheme among several
// competing scholarly chronologies.
//
// To reproduce: node scripts/compute-association-stats.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { safeKey } from "./lib/safe-key.mjs";
import { computedDate } from "./lib/computed-date.mjs";
import { TOTAL_VERSES, TOTAL_TOKENS, TOTAL_ROOTS } from "./lib/corpus.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const OUT = join(DATA, "association");

const ANCHOR_PAIR = { a: "rHm", b: "gfr", expectedK11: 91 };
const MIN_SHARED_VERSES = 5;
const TOP_N_PARTNERS = 25;
const TOP_N_KEYNESS = 15;
const PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
const PERIOD_LABELS = {
  "meccan-early": "Early Meccan",
  "meccan-middle": "Middle Meccan",
  "meccan-late": "Late Meccan",
  medinan: "Medinan",
};
const CHRONOLOGY_SOURCE =
  "Egyptian Standard (Cairo 1924) revelation order, four-period " +
  "classification following the Nöldeke-Bell tradition (Watt, " +
  "\"Bell's Introduction to the Qur'an\", 1970); same periodization " +
  "as data/chronology.json.";

mkdirSync(OUT, { recursive: true });

// ── Formulas, unit-tested below against a hand-computed 2x2 ───────────

function pmi(k11, k12, k21, n) {
  return Math.log2((k11 * n) / ((k11 + k12) * (k11 + k21)));
}

function dice(k11, k12, k21) {
  return (2 * k11) / (2 * k11 + k12 + k21);
}

function xlnx_ratio(o, e) {
  if (o === 0) return 0;
  return o * Math.log(o / e);
}

function g2(o11, o12, o21, o22) {
  const n = o11 + o12 + o21 + o22;
  const row1 = o11 + o12;
  const row2 = o21 + o22;
  const col1 = o11 + o21;
  const col2 = o12 + o22;
  const e11 = (row1 * col1) / n;
  const e12 = (row1 * col2) / n;
  const e21 = (row2 * col1) / n;
  const e22 = (row2 * col2) / n;
  return (
    2 *
    (xlnx_ratio(o11, e11) +
      xlnx_ratio(o12, e12) +
      xlnx_ratio(o21, e21) +
      xlnx_ratio(o22, e22))
  );
}

// ── Step 1: embedded unit test against a hand-computed 2x2 ────────────
// O11=10, O12=5, O21=5, O22=10, N=30. All expected E = 15*15/30 = 7.5.
// By hand: G2 = 2*(2*10*ln(4/3) + 2*5*ln(2/3)) ≈ 3.39798072
// PMI = log2(10*30/(15*15)) = log2(4/3) ≈ 0.41503750
// Dice = 2*10/(2*10+5+5) = 20/30 ≈ 0.66666667
{
  const testG2 = g2(10, 5, 5, 10);
  const testPmi = pmi(10, 5, 5, 30);
  const testDice = dice(10, 5, 5);
  const expectedG2 = 3.39798072;
  const expectedPmi = 0.4150374993;
  const expectedDice = 0.6666666667;
  const eps = 1e-6;
  if (Math.abs(testG2 - expectedG2) > eps)
    throw new Error(`Unit test FAILED: G2 = ${testG2}, expected ${expectedG2}`);
  if (Math.abs(testPmi - expectedPmi) > eps)
    throw new Error(`Unit test FAILED: PMI = ${testPmi}, expected ${expectedPmi}`);
  if (Math.abs(testDice - expectedDice) > eps)
    throw new Error(`Unit test FAILED: Dice = ${testDice}, expected ${expectedDice}`);
  console.log(
    `Unit test passed: G2=${testG2.toFixed(6)} PMI=${testPmi.toFixed(6)} Dice=${testDice.toFixed(6)}`,
  );
}

// ── Step 2: load existing data (read-only) ─────────────────────────────

const rootsSummary = JSON.parse(readFileSync(join(DATA, "roots-summary.json"), "utf8"));
const chronology = JSON.parse(readFileSync(join(DATA, "chronology.json"), "utf8"));
const numbers = JSON.parse(readFileSync(join(DATA, "numbers.json"), "utf8"));

if (Object.keys(rootsSummary).length !== TOTAL_ROOTS) {
  throw new Error(
    `Baseline mismatch: roots-summary.json has ${Object.keys(rootsSummary).length} roots, expected ${TOTAL_ROOTS}`,
  );
}
if (numbers.totals.tokens !== TOTAL_TOKENS) {
  throw new Error(
    `Baseline mismatch: numbers.json totals.tokens = ${numbers.totals.tokens}, expected ${TOTAL_TOKENS}`,
  );
}
if (numbers.totals.verses !== TOTAL_VERSES) {
  throw new Error(
    `Baseline mismatch: numbers.json totals.verses = ${numbers.totals.verses}, expected ${TOTAL_VERSES}`,
  );
}

const periodTokens = {};
for (const p of numbers.posByPeriod) periodTokens[p.period] = p.tokens;
for (const p of PERIODS) {
  if (!periodTokens[p]) throw new Error(`Missing period token total for ${p} in numbers.json`);
}

console.log(
  `Loaded ${Object.keys(rootsSummary).length} roots, ${TOTAL_TOKENS} tokens, ${TOTAL_VERSES} verses.`,
);
console.log(`Period token totals: ${PERIODS.map((p) => `${p}=${periodTokens[p]}`).join(", ")}`);

// ── Step 3: scan morphology, build verse-level root sets (self-contained,
//    does not read data/cooccurrence/; recomputed independently so it can
//    be cross-checked against it) ────────────────────────────────────────

console.log("\nScanning morphology for verse-level root attestation…");

const verseRoots = {}; // "s:v" -> Set<bw>
let scannedTokens = 0;

for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(readFileSync(join(DATA, "morphology", `${s}.json`), "utf8"));
  for (const [v, words] of Object.entries(morph)) {
    const ref = `${s}:${v}`;
    for (const w of words) {
      scannedTokens++;
      if (!w.root) continue;
      if (!verseRoots[ref]) verseRoots[ref] = new Set();
      verseRoots[ref].add(w.root);
    }
  }
}

if (scannedTokens !== TOTAL_TOKENS) {
  throw new Error(`Baseline mismatch: scanned ${scannedTokens} tokens, expected ${TOTAL_TOKENS}`);
}
if (Object.keys(verseRoots).length > TOTAL_VERSES) {
  throw new Error(
    `Scanned more verses (${Object.keys(verseRoots).length}) than the corpus has (${TOTAL_VERSES})`,
  );
}

console.log(`Scanned ${scannedTokens} tokens across ${Object.keys(verseRoots).length} rooted verses.`);

// ── Step 4: verse-level co-occurrence matrix + per-root verse counts ──

console.log("\nBuilding verse-level co-occurrence matrix…");

const rootVerseCount = {}; // bw -> distinct verses attesting it (out of TOTAL_VERSES)
const coOcc = {}; // coOcc.get(pairKey) -> k11, pairKey = "a\u0000b" (NUL separator) with a<b

function pairKey(a, b) {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

for (const roots of Object.values(verseRoots)) {
  const arr = [...roots];
  for (const r of arr) rootVerseCount[r] = (rootVerseCount[r] || 0) + 1;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const k = pairKey(arr[i], arr[j]);
      coOcc[k] = (coOcc[k] || 0) + 1;
    }
  }
}

console.log(`Distinct pairs with k11 >= 1: ${Object.keys(coOcc).length}`);

// ── Step 5: verify the anchor pair before doing anything else ─────────

const anchorK11 = coOcc[pairKey(ANCHOR_PAIR.a, ANCHOR_PAIR.b)] || 0;
if (anchorK11 !== ANCHOR_PAIR.expectedK11) {
  throw new Error(
    `Anchor pair mismatch: computed k11(${ANCHOR_PAIR.a}, ${ANCHOR_PAIR.b}) = ${anchorK11}, expected ${ANCHOR_PAIR.expectedK11}. STOPPING.`,
  );
}
console.log(
  `Anchor check passed: r-ḥ-m + gh-f-r co-occur in ${anchorK11} verses (matches published baseline).`,
);

// Cross-check against a sample of data/cooccurrence/*.json's own counts,
// which were computed independently by build-cooccurrence.mjs. This is a
// second, broader confirmation beyond the single anchor pair.
console.log("\nCross-checking against data/cooccurrence/ sample…");
{
  const sampleRoots = ["rHm", "Sbr", "Elm", "hdy", "Alh"];
  let checked = 0;
  let mismatches = 0;
  for (const bw of sampleRoots) {
    const path = join(DATA, "cooccurrence", `${safeKey(bw)}.json`);
    let coFile;
    try {
      coFile = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue;
    }
    for (const cr of coFile.coRoots || []) {
      checked++;
      const computed = coOcc[pairKey(bw, cr.root)] || 0;
      if (computed !== cr.count) {
        mismatches++;
        console.error(
          `  MISMATCH: ${bw} x ${cr.root}: computed ${computed}, published ${cr.count}`,
        );
      }
    }
  }
  if (mismatches > 0) {
    throw new Error(`${mismatches}/${checked} cross-checked pairs diverge from published co-occurrence counts. STOPPING.`);
  }
  console.log(`Cross-check passed: ${checked} published pairs match computed k11 exactly.`);
}

// ── Step 6: per-pair association statistics (k11 >= 5) ─────────────────

console.log(`\nComputing association statistics for pairs with k11 >= ${MIN_SHARED_VERSES}…`);

const pairStats = []; // { a, b, k11, k12, k21, k22, pmiVal, diceVal, llrVal }

for (const [key, k11] of Object.entries(coOcc)) {
  if (k11 < MIN_SHARED_VERSES) continue;
  const [a, b] = key.split("\u0000");
  const va = rootVerseCount[a] || 0;
  const vb = rootVerseCount[b] || 0;
  const k12 = va - k11;
  const k21 = vb - k11;
  const k22 = TOTAL_VERSES - k11 - k12 - k21;
  const pmiVal = pmi(k11, k12, k21, TOTAL_VERSES);
  const diceVal = dice(k11, k12, k21);
  const llrVal = g2(k11, k12, k21, k22);
  pairStats.push({ a, b, k11, k12, k21, k22, pmiVal, diceVal, llrVal });
}

console.log(`Pairs meeting threshold: ${pairStats.length}`);

// Top 25 by LLR, per root (each pair appears once for "a" and once for "b").
const partnersByRoot = {}; // bw -> [{partnerBw, k11, pmi, dice, llr}]
function addPartner(root, partner, k11, pmiVal, diceVal, llrVal) {
  if (!partnersByRoot[root]) partnersByRoot[root] = [];
  partnersByRoot[root].push({ partner, k11, pmiVal, diceVal, llrVal });
}
for (const p of pairStats) {
  addPartner(p.a, p.b, p.k11, p.pmiVal, p.diceVal, p.llrVal);
  addPartner(p.b, p.a, p.k11, p.pmiVal, p.diceVal, p.llrVal);
}
for (const bw of Object.keys(partnersByRoot)) {
  partnersByRoot[bw].sort((x, y) => y.llrVal - x.llrVal || y.k11 - x.k11);
  partnersByRoot[bw] = partnersByRoot[bw].slice(0, TOP_N_PARTNERS);
}

// ── Step 7: keyness per root per period (token-based 2x2) ──────────────

console.log("\nComputing keyness (G2) per root per period…");

const keynessByRootPeriod = {}; // bw -> period -> g2
for (const [bw, meta] of Object.entries(rootsSummary)) {
  const total = meta.totalCount;
  keynessByRootPeriod[bw] = {};
  for (const p of PERIODS) {
    const a = (meta.byChronology && meta.byChronology[p]) || 0;
    if (a === 0) continue;
    const b = total - a;
    const c = periodTokens[p] - a;
    const d = TOTAL_TOKENS - periodTokens[p] - b;
    keynessByRootPeriod[bw][p] = g2(a, b, c, d);
  }
}

const keynessTop = {};
for (const p of PERIODS) {
  const ranked = Object.entries(rootsSummary)
    .map(([bw, meta]) => ({
      root: bw,
      safeKey: safeKey(bw),
      arabic: meta.rootArabic,
      rootLatin: meta.rootLatin,
      periodTokenCount: (meta.byChronology && meta.byChronology[p]) || 0,
      g2: keynessByRootPeriod[bw][p] || 0,
    }))
    .filter((r) => r.periodTokenCount > 0)
    .sort((x, y) => y.g2 - x.g2)
    .slice(0, TOP_N_KEYNESS);
  keynessTop[p] = ranked;
}

// ── Step 8: write per-root files + aggregates ───────────────────────────
//
// Per-root files carry only their own values, not a repeated copy of the
// shared metadata block (formulas, thresholds, source, chronology,
// generation date; that lives once in methods.json) and no per-period
// breakdown (that belongs to the unbounded exports under data/exports/,
// produced separately by scripts/build-exports.mjs from data/roots-summary.json
// and data/numbers.json directly). This is what keeps 1,642 files times a
// 25-row partner table under the 3 MB budget.

console.log("\nWriting data/association/ output…");

const COMPUTED_DATE = computedDate();

const METHOD_PAIR =
  `Co-occurrence is counted at the verse level over all ${TOTAL_VERSES} verses: two roots co-occur once for each verse in which both are attested. A pair is included only with at least ${MIN_SHARED_VERSES} shared verses. PMI(A,B) = log2(k11*N / ((k11+k12)*(k11+k21))). Dice = 2*k11 / (2*k11+k12+k21). LLR is Dunning's G2 = 2 * sum(O * ln(O/E)) over the four cells of the 2x2 table, E from row/column marginals; a cell with O = 0 contributes 0. The top ${TOP_N_PARTNERS} partners by LLR are kept per root.`;

const METHOD_KEYNESS =
  `Keyness is the same Dunning G2 statistic, computed per root per revelation period from token counts (not verse counts): the root's token count in the period vs. the rest of the corpus, against the period's total token count vs. the rest of the corpus. ${CHRONOLOGY_SOURCE} The top ${TOP_N_KEYNESS} roots per period by G2 are kept. Periodization varies across scholarly chronologies; treat period-based keyness as Nuanced.`;

const METHOD_FREQ =
  `Normalized frequency = (count / total tokens) * 1000, i.e. occurrences per 1,000 tokens. Overall normalized frequency uses ${TOTAL_TOKENS} total tokens and is a direct computation (Verified). Per-period normalized frequency (see data/exports/) uses that period's token total and depends on the four-period chronology named above (Nuanced).`;

const methodsDoc = {
  _script: "scripts/compute-association-stats.mjs",
  _source: "Leeds Quranic Arabic Corpus v0.4 (Kais Dukes, corpus.quran.com, GPL)",
  _chronologySource: CHRONOLOGY_SOURCE,
  _formulas: {
    normalizedFrequency: "(count / totalTokens) * 1000",
    pmi: "log2((k11 * N) / ((k11 + k12) * (k11 + k21)))",
    dice: "2*k11 / (2*k11 + k12 + k21)",
    llr: "Dunning's G2 = 2 * sum(O * ln(O/E)) over the 2x2 table; O=0 cells contribute 0",
    keyness: "Same G2 formula, token-based 2x2: root tokens in period vs. rest of corpus",
  },
  _thresholds: {
    minSharedVerses: MIN_SHARED_VERSES,
    topPartnersPerRoot: TOP_N_PARTNERS,
    topRootsPerPeriodKeyness: TOP_N_KEYNESS,
  },
  _totals: { verses: TOTAL_VERSES, tokens: TOTAL_TOKENS, roots: TOTAL_ROOTS },
  _pairsMeetingThreshold: pairStats.length,
  _computed: COMPUTED_DATE,
  methodPairs: METHOD_PAIR,
  methodKeyness: METHOD_KEYNESS,
  methodFrequency: METHOD_FREQ,
};
writeFileSync(join(OUT, "methods.json"), JSON.stringify(methodsDoc, null, 1) + "\n");

let written = 0;

for (const [bw, meta] of Object.entries(rootsSummary)) {
  const sk = safeKey(bw);
  const overallNorm = (meta.totalCount / TOTAL_TOKENS) * 1000;

  const partners = (partnersByRoot[bw] || []).map((p) => ({
    root: p.partner,
    safeKey: safeKey(p.partner),
    arabic: rootsSummary[p.partner]?.rootArabic || "",
    rootLatin: rootsSummary[p.partner]?.rootLatin || p.partner,
    k11: p.k11,
    pmi: Math.round(p.pmiVal * 100) / 100,
    dice: Math.round(p.diceVal * 1000) / 1000,
    llr: Math.round(p.llrVal * 100) / 100,
  }));

  const output = {
    root: bw,
    safeKey: sk,
    arabic: meta.rootArabic,
    rootLatin: meta.rootLatin,
    totalCount: meta.totalCount,
    verseCount: rootVerseCount[bw] || 0,
    normalizedFrequency: Math.round(overallNorm * 1000) / 1000,
    partners,
    _computed: COMPUTED_DATE,
    _methodsFile: "data/association/methods.json",
  };

  writeFileSync(join(OUT, sk + ".json"), JSON.stringify(output));
  written++;
  if (written % 400 === 0) console.log(`  ${written} files written…`);
}

console.log(`\nDone. Wrote ${written} per-root association files.`);
if (written !== TOTAL_ROOTS) {
  throw new Error(`Expected ${TOTAL_ROOTS} per-root files, wrote ${written}`);
}

// Aggregate: keyness-top.json (top 15 per period, for the Numbers page)
writeFileSync(
  join(OUT, "keyness-top.json"),
  JSON.stringify({
    _computed: COMPUTED_DATE,
    _methodsFile: "data/association/methods.json",
    byPeriod: PERIODS.map((p) => ({ period: p, label: PERIOD_LABELS[p], roots: keynessTop[p] })),
  }),
);

console.log(`Wrote methods.json`);
console.log(`Wrote keyness-top.json (top ${TOP_N_KEYNESS} per period)`);

// ── Step 9: size budget check ────────────────────────────────────────

let totalBytes = 0;
for (const f of readdirSync(OUT)) totalBytes += statSync(join(OUT, f)).size;
const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`\nTotal data/association size: ${totalMB} MB`);
if (totalBytes > 3 * 1024 * 1024) {
  console.error(`ERROR: output exceeds 3 MB budget (${totalMB} MB). Tighten thresholds and rerun.`);
  process.exit(1);
}

// ── Step 10: spot-check output ───────────────────────────────────────

console.log("\nSpot-check (r-ḥ-m):");
const spot = JSON.parse(readFileSync(join(OUT, safeKey("rHm") + ".json"), "utf8"));
console.log(`  normalizedFrequency: ${spot.normalizedFrequency}`);
const gfrPartner = spot.partners.find((p) => p.root === "gfr");
console.log(
  `  gh-f-r partner: k11=${gfrPartner?.k11}, pmi=${gfrPartner?.pmi}, dice=${gfrPartner?.dice}, llr=${gfrPartner?.llr}`,
);
