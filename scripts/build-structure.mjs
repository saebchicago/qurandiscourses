// build-structure.mjs — deterministic, zero-dependency generator for
// data/structure/{1..114}.json: a mechanical segmentation of each surah
// into contiguous verse blocks, with the evidence for each boundary.
//
// What this measures, precisely: for every pair of adjacent verses, the
// Jaccard similarity of their surrounding content-vocabulary windows (2
// verses either side, root non-empty, corpus-wide frequency <= 700 — the
// same stoplist convention as build-cooccurrence.mjs, build-discursive-
// pivots.mjs and build-symmetry-test.mjs). This is the lexical-cohesion
// approach to topic segmentation described by Hearst 1997 ("TextTiling:
// Segmenting Text into Multi-Paragraph Subtopic Passages"), adapted here
// to a fixed corpus of morphologically-tagged verses rather than running
// paragraphs of prose: a "depth score" is computed for each candidate
// boundary as how far the similarity dips below the nearest local peak on
// each side — a LOCAL measure, not a comparison against the whole surah's
// average, so a genuine subtopic shift registers even inside a generally
// cohesive surah.
//
// Depth scores are converted into boundaries by an exact dynamic-program
// that selects the subset of candidates (each at least 3 verses from its
// neighbors) maximizing total depth above a per-surah threshold. That
// threshold is the surah's own mean depth score plus 0.5 * sqrt(2 *
// ln(verseCount)) standard deviations — a half-scale version of the
// Donoho-Johnstone universal threshold used for peak detection in signal
// processing, chosen so evidence is judged against each surah's OWN
// distribution (not a fixed cutoff) while still discounting the more
// numerous candidates a longer surah offers by chance. The window (2),
// minimum segment length (3) and threshold scale (0.5) are fixed a
// priori and checked against the full corpus for a sane range (not tuned
// to hit a target segment count): window={2,3,4} and scale={0.25,0.5,
// 0.75,1.0} were each run corpus-wide before choosing; window=2/scale=0.5
// was the smallest, least-smoothed combination that did not also produce
// implausible outliers (a single surah split into 40+ blocks). A surah
// with no candidate above its own threshold gets one section — the
// whole surah — reported exactly like every other result, not omitted:
// see data/symmetry-test.json for the same convention applied to a
// different, narrower test.
//
// Four more signals are recorded ALONGSIDE each selected boundary as
// corroborating evidence, but do not drive the selection itself (folding
// heterogeneous signals into one score without a principled combination
// rule was tried and rejected — see the branch history for the earlier,
// wrongly-designed attempt):
//   rhymeShift        the coarse rhyme family (data/rhyme/{s}.json k1)
//                      changes across the boundary
//   lengthJump        the verse-length delta in root-tagged word tokens
//                      across the boundary (signed integer, not a
//                      threshold — the reader judges what counts as big)
//   formulaOnset      a phrase that recurs at least twice within THIS
//                      surah (data/formulas-root.json / -surface.json)
//                      begins at the first word of this verse
//   discursivePivot   this verse is one of the 137 occurrences in
//                      data/discursive-pivots.json
//
// What this deliberately does NOT claim: that a computed boundary is a
// literary section, a rhetorical division, or evidence for or against
// ring composition or any other named structural pattern. It is not
// attributed to any scholar and is not a substitute for one. See
// docs/maintainer-guide.md's rule on named-scholar structural outlines
// (mapping verse ranges under a real scholar's name requires transcribing
// their published, page-cited work, never computing it) and patterns.html
// for what the site does and does not assert about ring composition.
//
// Run: node scripts/build-structure.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FREQUENCY_CEILING } from "./lib/stats.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "structure");
mkdirSync(OUT_DIR, { recursive: true });

// Same rule as build-cooccurrence.mjs / build-discursive-pivots.mjs /
// build-symmetry-test.mjs: roots this frequent co-occur with nearly
// everything, so they carry no topical signal.
const rootsSummary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);
const excludedRoots = new Set(
  Object.entries(rootsSummary)
    .filter(([, meta]) => meta.totalCount > FREQUENCY_CEILING)
    .map(([bw]) => bw),
);

const WINDOW = 2; // verses either side of a candidate boundary
const MIN_SEGMENT_LENGTH = 3; // verses; also the DP's neighbor spacing
const MAX_SECTIONS = 20; // safety cap; the threshold design should never reach it
const THRESHOLD_SCALE = 0.5; // half the Donoho-Johnstone universal-threshold constant

// ── Step 1: embedded unit tests, isolated from the corpus ─────────────
// These validate the two load-bearing functions on hand-computable
// inputs, independent of any real surah, so a change to the corpus data
// can never mask a break in the method itself.

function jaccard(a, b) {
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// Optimal partitioning by exact DP: choose the subset of candidate
// boundaries i in [2, n] (each at least minLen verses from the next)
// maximizing sum(bonus(i)) over the chosen set. f[i] is the best total
// achievable with the current segment starting at verse i (i = n + 1
// closes the surah, contributing no bonus of its own). Ties are broken
// toward FEWER boundaries: j is scanned ascending and only a STRICTLY
// better total replaces the incumbent, so the direct start-to-end path
// (checked first, at j = 1) is never displaced by an equal-scoring
// detour — the method never manufactures structure it has no net
// evidence for.
function optimalPartition(n, bonus, minLen) {
  const f = new Array(n + 2).fill(-Infinity);
  const choice = new Array(n + 2).fill(null);
  f[1] = 0;
  for (let i = 2; i <= n + 1; i++) {
    for (let j = 1; j <= i - minLen; j++) {
      if (f[j] === -Infinity) continue;
      const add = i <= n ? bonus(i) : 0;
      const value = f[j] + add;
      if (value > f[i]) {
        f[i] = value;
        choice[i] = j;
      }
    }
  }
  const boundaries = [];
  let cur = n + 1;
  while (choice[cur] !== null) {
    const j = choice[cur];
    if (cur <= n) boundaries.push(cur);
    cur = j;
  }
  boundaries.reverse();
  return boundaries;
}

{
  const failures = [];
  const eq = (got, want, label) => {
    if (Math.abs(got - want) > 1e-9) failures.push(`${label}: got ${got}, want ${want}`);
  };
  eq(jaccard(new Set(["A", "B", "C"]), new Set(["A", "B", "C"])), 1, "jaccard identical sets");
  eq(jaccard(new Set(["A", "B", "C"]), new Set(["X", "Y", "Z"])), 0, "jaccard disjoint sets");
  eq(jaccard(new Set(["A", "B"]), new Set(["B", "C"])), 1 / 3, "jaccard partial overlap");
  eq(jaccard(new Set(), new Set()), 1, "jaccard both empty");

  const single = optimalPartition(10, (i) => (i === 6 ? 1.0 : -1.0), 3);
  if (single.join(",") !== "6") failures.push(`DP single-peak: got [${single}], want [6]`);

  // 5 and 6 are only 1 verse apart, below minLen=3, so they cannot both
  // be chosen: the DP must take the higher-scoring one (5) and correctly
  // reject 6 on spacing, not merely on score.
  const spaced = optimalPartition(10, (i) => (i === 5 ? 1.0 : i === 6 ? 0.9 : -1.0), 3);
  if (spaced.join(",") !== "5") failures.push(`DP spacing: got [${spaced}], want [5]`);

  const zero = optimalPartition(10, () => 0, 3);
  if (zero.length !== 0) failures.push(`DP all-zero: got [${zero}], want [] (no net evidence)`);

  const twoPeak = optimalPartition(20, (i) => (i === 7 || i === 14 ? 1.0 : -1.0), 3);
  if (twoPeak.join(",") !== "7,14") failures.push(`DP two-peak: got [${twoPeak}], want [7,14]`);

  // Exact spacing boundary, not merely "close together": positions
  // exactly minLen (3) apart must be allowed together (a segment of the
  // minimum legal length); positions minLen - 1 apart must not be. An
  // off-by-one in the DP's spacing bound passes the two tests above
  // (which use gaps of 1) but changes the corpus-wide segment count —
  // this pair is what actually pins the boundary condition.
  const exactGap = optimalPartition(15, (i) => (i === 5 || i === 8 ? 1.0 : -1.0), 3);
  if (exactGap.join(",") !== "5,8")
    failures.push(`DP exact-minLen gap: got [${exactGap}], want [5,8] (both should fit)`);
  const underGap = optimalPartition(15, (i) => (i === 5 ? 1.0 : i === 7 ? 0.9 : -1.0), 3);
  if (underGap.join(",") !== "5")
    failures.push(`DP under-minLen gap: got [${underGap}], want [5] (7 is too close to fit)`);

  if (failures.length) {
    console.error("build-structure: unit tests FAILED");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("Unit tests passed: jaccard (4 cases), optimal partition (4 cases).");
}

// ── Step 2: per-surah data loaders ─────────────────────────────────────

function contentRootSetsAndLengths(s) {
  const morph = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
  const n = Object.keys(morph).length;
  const rootSets = new Array(n + 1); // 1-indexed
  const lengths = new Array(n + 1).fill(0);
  for (let a = 1; a <= n; a++) {
    const words = morph[String(a)];
    lengths[a] = words.length;
    const set = new Set();
    for (const w of words) if (w.root && !excludedRoots.has(w.root)) set.add(w.root);
    rootSets[a] = set;
  }
  return { n, rootSets, lengths };
}

function windowUnion(rootSets, from, to, n) {
  const union = new Set();
  from = Math.max(1, from);
  to = Math.min(n, to);
  for (let v = from; v <= to; v++) for (const r of rootSets[v]) union.add(r);
  return union;
}

function rhymeKeys(s) {
  const rhyme = JSON.parse(readFileSync(join(ROOT, "data", "rhyme", `${s}.json`), "utf8"));
  const k1 = {};
  for (const v of rhyme.verses) k1[v.a] = v.k1;
  return k1;
}

// A phrase counts as a local refrain if it recurs at least twice WITHIN
// this surah; every word-1 occurrence of such a phrase is an "onset".
function formulaOnsets(s, ngramsFile) {
  const data = JSON.parse(readFileSync(join(ROOT, "data", ngramsFile), "utf8"));
  const onsets = new Set();
  for (const entry of data.ngrams) {
    const inSurah = entry.refs.filter((r) => r[0] === s);
    if (inSurah.length < 2) continue;
    for (const r of inSurah) if (r[2] === 1) onsets.add(r[1]);
  }
  return onsets;
}

function discursivePivotVerses(s, pivots) {
  return new Set(pivots.occurrences.filter((o) => o.s === s).map((o) => o.a));
}

// ── Step 3: per-surah segmentation ─────────────────────────────────────

const pivots = JSON.parse(readFileSync(join(ROOT, "data", "discursive-pivots.json"), "utf8"));

const results = {};
let corpusOneSection = 0;
let corpusMaxSections = 0;
let corpusTotalSections = 0;

for (let s = 1; s <= 114; s++) {
  const { n, rootSets, lengths } = contentRootSetsAndLengths(s);
  const k1 = rhymeKeys(s);
  const rootOnsets = formulaOnsets(s, "formulas-root.json");
  const surfaceOnsets = formulaOnsets(s, "formulas-surface.json");
  const pivotVerses = discursivePivotVerses(s, pivots);

  // Similarity at each internal gap i (between verse i-1 and verse i),
  // i ranging over every verse from 2 to n.
  const sim = new Array(n + 2).fill(1);
  for (let i = 2; i <= n; i++) {
    const before = windowUnion(rootSets, i - WINDOW, i - 1, n);
    const after = windowUnion(rootSets, i, i + WINDOW - 1, n);
    sim[i] = jaccard(before, after);
  }

  // TextTiling-style depth score: how far this gap dips below the
  // nearest local peak on each side, walking outward until similarity
  // stops rising. A boundary deep inside an otherwise cohesive stretch
  // registers even if the surah's overall similarity never gets low.
  const depth = new Array(n + 2).fill(0);
  for (let i = 2; i <= n; i++) {
    let leftPeak = sim[i];
    for (let j = i; j >= 2; j--) {
      if (sim[j] >= leftPeak) leftPeak = sim[j];
      else break;
    }
    let rightPeak = sim[i];
    for (let j = i; j <= n; j++) {
      if (sim[j] >= rightPeak) rightPeak = sim[j];
      else break;
    }
    depth[i] = Math.max(0, leftPeak - sim[i] + (rightPeak - sim[i]));
  }

  const depthValues = [];
  for (let i = 2; i <= n; i++) depthValues.push(depth[i]);
  const mean = depthValues.reduce((a, b) => a + b, 0) / depthValues.length;
  const variance = depthValues.reduce((a, b) => a + (b - mean) ** 2, 0) / depthValues.length;
  const std = Math.sqrt(variance);
  const threshold = mean + THRESHOLD_SCALE * Math.sqrt(2 * Math.log(Math.max(n, 2))) * std;

  let boundaries =
    n >= 2 * MIN_SEGMENT_LENGTH
      ? optimalPartition(n, (i) => depth[i] - threshold, MIN_SEGMENT_LENGTH)
      : [];
  // Safety cap: the threshold design has never produced more than
  // MAX_SECTIONS - 1 boundaries on this corpus, but a future edit to
  // the underlying data should degrade gracefully, not silently balloon.
  if (boundaries.length > MAX_SECTIONS - 1) {
    boundaries = boundaries
      .map((i) => ({ i, d: depth[i] - threshold }))
      .sort((a, b) => b.d - a.d)
      .slice(0, MAX_SECTIONS - 1)
      .map((x) => x.i)
      .sort((a, b) => a - b);
  }

  const sections = [];
  let start = 1;
  for (const b of [...boundaries, n + 1]) {
    sections.push({ index: sections.length + 1, fromVerse: start, toVerse: b - 1, verseCount: b - start });
    start = b;
  }

  const boundaryDetails = boundaries.map((i) => ({
    beforeVerse: i,
    depthScore: Math.round(depth[i] * 1e4) / 1e4,
    threshold: Math.round(threshold * 1e4) / 1e4,
    corroboration: {
      rhymeShift: k1[i] !== k1[i - 1],
      lengthJump: lengths[i] - lengths[i - 1],
      formulaOnset: rootOnsets.has(i) || surfaceOnsets.has(i),
      discursivePivot: pivotVerses.has(i),
    },
  }));

  results[s] = {
    _generated: "build-structure.mjs",
    _method:
      "Lexical-cohesion depth scoring (Hearst 1997 TextTiling, adapted to " +
      "verses): Jaccard similarity between 2-verse content-root windows on " +
      "each side of every candidate boundary, converted to a local depth " +
      `score, then an exact dynamic-programming optimal partition selects ` +
      `boundaries (minimum ${MIN_SEGMENT_LENGTH} verses apart) whose depth ` +
      `clears this surah's own mean plus ${THRESHOLD_SCALE} * sqrt(2 * ` +
      "ln(verseCount)) standard deviations. Content roots exclude corpus-" +
      `wide frequency > ${FREQUENCY_CEILING} (build-cooccurrence.mjs's rule). ` +
      "Four further signals (rhyme-family change, verse-length delta, " +
      "local-refrain onset, discursive-pivot marker) are reported per " +
      "boundary as corroborating evidence; none of them drives selection.",
    _scope:
      "A computed vocabulary-cohesion boundary, nothing more. Not a " +
      "literary section, rhetorical division, or evidence for or against " +
      "ring composition; not attributed to any scholar. A surah with no " +
      "boundary above its own threshold gets one section, reported the " +
      "same as every other result.",
    surah: s,
    verseCount: n,
    sections,
    boundaries: boundaryDetails,
    _candidateSummary: {
      totalCandidates: Math.max(0, n - 1),
      meanDepth: Math.round(mean * 1e4) / 1e4,
      stdDepth: Math.round(std * 1e4) / 1e4,
      threshold: Math.round(threshold * 1e4) / 1e4,
    },
  };

  corpusTotalSections += sections.length;
  if (sections.length === 1) corpusOneSection++;
  if (sections.length > corpusMaxSections) corpusMaxSections = sections.length;
}

for (let s = 1; s <= 114; s++) {
  writeFileSync(join(OUT_DIR, `${s}.json`), JSON.stringify(results[s], null, 1) + "\n");
}

console.log(
  `build-structure: wrote data/structure/{1..114}.json. ` +
    `${corpusOneSection} of 114 surahs have no boundary above their own threshold ` +
    `(reported as one section, not a gap); max ${corpusMaxSections} sections; ` +
    `mean ${(corpusTotalSections / 114).toFixed(2)} sections/surah.`,
);
