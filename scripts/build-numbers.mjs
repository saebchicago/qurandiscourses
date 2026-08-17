// build-numbers.mjs — deterministic, zero-dependency generator for
// data/numbers.json, which backs the statistic cards on numbers.html.
//
// Rationale: the Numbers page used to hard-code its figures as literal
// HTML text, which could silently drift from the bundled corpus. Every
// figure below is recomputed mechanically from data/morphology/,
// data/roots-summary.json, and data/chronology.json — the same inputs the
// rest of the site ships — so the page renders exactly what the data
// says. Figures that depend on external sources (e.g. the popular 13/32
// land/sea surface-form count) stay as prose claims on the page with
// their own citations; this script only computes what the corpus itself
// can answer.
//
// Run: node scripts/build-numbers.mjs
// Determinism check: run twice, `git diff` must be empty.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mattr, mtld, partialFactor } from "./lib/lexical-diversity.mjs";
import { makeEq } from "./lib/stats.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// MATTR window: 100 tokens. Covington & McFall (2010) leave window size
// a free parameter; corpus-linguistics practice commonly uses a larger
// window (around 100) for corpus-scale text than for short clinical
// samples (commonly 50), favoring a stabler estimate over sensitivity
// to local variation. All four chronological periods (2,704-30,572
// tokens) are comfortably larger than this window either way.
const MATTR_WINDOW_PERIOD = 100;

// ── Step 0: embedded unit tests for mattr/mtld, hand-computed ──────────
// The only place these two functions are unit-tested; build-surah-
// profiles.mjs imports the same lib module without repeating this block.
{
  const failures = [];
  const eq = makeEq(failures);
  // MTLD: two independent 6-token "factor blocks" (disjoint vocabularies),
  // each dropping running TTR to exactly 4/6=0.6667 (<=0.72) at its 6th
  // token -- by hand: block "a b c d a b" hits TTR=4/6 at token 6, one
  // whole factor, no remainder. Two such blocks back to back -> exactly
  // 2 factors over 12 tokens -> MTLD (one direction) = 12/2 = 6. The
  // reverse-order pass on this same 12-token sequence was independently
  // hand-traced and also gives exactly 2 factors, 0 remainder -> 6, so
  // the bidirectional average is 6 too.
  const block1 = ["a", "b", "c", "d", "a", "b"];
  const block2 = ["e", "f", "g", "h", "e", "f"];
  eq(mtld([...block1, ...block2]), 6, "mtld: two 6-token factor blocks");
  eq(mtld(block1), 6, "mtld: single 6-token factor block (forward=backward=6)");
  // Partial-factor arithmetic in isolation: a remainder segment whose
  // running TTR reached 0.86 against the 0.72 threshold contributes
  // (1-0.86)/(1-0.72) = 0.14/0.28 = 0.5 of a factor, by hand.
  eq(partialFactor(0.86, 0.72), 0.5, "mtld: partial-factor arithmetic");
  // MATTR: 8 alternating tokens, window 4 -> every window has exactly 2
  // distinct types -> TTR=0.5 in every window -> MATTR=0.5 exactly.
  eq(mattr(["a", "b", "a", "b", "a", "b", "a", "b"], 4), 0.5, "mattr: alternating pair, constant TTR");
  // MATTR: 10 fully-unique tokens, window 5 -> every window TTR=1.0.
  eq(
    mattr(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"], 5),
    1,
    "mattr: all-unique tokens, constant TTR=1",
  );
  // MATTR: undefined (null) when the text is shorter than the window.
  eq(mattr(["a", "b", "c"], 10), null, "mattr: null when shorter than window");
  if (failures.length) {
    console.error("build-numbers: mattr/mtld unit tests FAILED");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("Unit tests passed: mattr (alternating/unique/too-short), mtld (factor blocks, partial factor).");
}

const rootsSummary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);
const chronology = JSON.parse(
  readFileSync(join(ROOT, "data", "chronology.json"), "utf8"),
);

// ── Named root counts used by the cards (Buckwalter keys) ──────────
const NAMED_ROOTS = [
  "ArD", // a-r-ḍ earth
  "bHr", // b-ḥ-r sea
  "ywm", // y-w-m day
  "$hr", // sh-h-r month
  "Edl", // ʿ-d-l justice
  "Sbr", // ṣ-b-r patience
  "Elm", // ʿ-l-m knowledge
  "$kr", // sh-k-r gratitude
  "wqy", // w-q-y taqwa
];
const namedRoots = {};
for (const bw of NAMED_ROOTS) {
  const e = rootsSummary[bw];
  if (!e) throw new Error(`Root ${bw} not found in roots-summary.json`);
  namedRoots[bw] = { latin: e.rootLatin, count: e.totalCount };
}

// ── Top five roots by total occurrences ────────────────────────────
const topRoots = Object.values(rootsSummary)
  .slice()
  .sort(
    (a, b) =>
      b.totalCount - a.totalCount ||
      a.rootBuckwalter.localeCompare(b.rootBuckwalter),
  )
  .slice(0, 5)
  .map((e) => ({
    bw: e.rootBuckwalter,
    latin: e.rootLatin,
    count: e.totalCount,
  }));

// ── Hapax + period-unique roots from the summary ───────────────────
let hapaxRoots = 0;
let meccanOnly = 0;
let medinanOnly = 0;
for (const e of Object.values(rootsSummary)) {
  if (e.totalCount === 1) hapaxRoots++;
  const c = e.byChronology || {};
  const meccan =
    (c["meccan-early"] || 0) + (c["meccan-middle"] || 0) + (c["meccan-late"] || 0);
  const medinan = c["medinan"] || 0;
  if (meccan > 0 && medinan === 0) meccanOnly++;
  if (medinan > 0 && meccan === 0) medinanOnly++;
}

// ── Revelation-period order + labels (used throughout below) ───────
const PERIOD_ORDER = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
const PERIOD_LABELS = {
  "meccan-early": "Early Meccan",
  "meccan-middle": "Middle Meccan",
  "meccan-late": "Late Meccan",
  medinan: "Medinan",
};

// ── Morphology sweep: surface forms, verse counts, tokens/period ───
const formCounts = new Map();
const verseCounts = [];
const periodTokens = {};
const periodVerses = {};
const lemmaSet = new Set();
const lemmaCounts = new Map(); // for lemma-level hapax
let totalTokens = 0;
let rootedTokens = 0;

// Additional collectors for the extended analytics blocks below. Every
// figure is a plain tally of a Leeds field (root/lemma/pos) or a verse
// token length — no classification or interpretation, so all remain
// "Verified · computed from the cited corpus".
const posCounts = {}; // POS tag -> global count (all 33 Leeds tags)
const posByPeriodCounts = {}; // period -> { tag -> count }
const verseLengths = []; // { tokens, period } per verse, all 6236 verses
const rootMinOrder = new Map(); // root (Buckwalter) -> earliest revelation order it appears in
const periodFormSets = {}; // period -> Set<word.ar>, for type-token ratio by period
const periodLemmaSets = {}; // period -> Set<word.lemma>, same
const periodFormTokens = {}; // period -> [word.ar, ...] in canonical surah order, for MATTR/MTLD

for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );
  const period = chronology[s] ? chronology[s].period : "unclassified";
  const revOrder = chronology[s] ? chronology[s].revelationOrder : null;
  const ayahs = Object.keys(morph);
  verseCounts.push({ s, verses: ayahs.length });
  if (!posByPeriodCounts[period]) posByPeriodCounts[period] = {};
  for (const a of ayahs) {
    periodTokens[period] = (periodTokens[period] || 0) + morph[a].length;
    periodVerses[period] = (periodVerses[period] || 0) + 1;
    verseLengths.push({ tokens: morph[a].length, period });
    for (const w of morph[a]) {
      formCounts.set(w.ar, (formCounts.get(w.ar) || 0) + 1);
      totalTokens++;
      if (!periodFormSets[period]) periodFormSets[period] = new Set();
      if (w.ar) periodFormSets[period].add(w.ar);
      if (w.ar) {
        if (!periodFormTokens[period]) periodFormTokens[period] = [];
        periodFormTokens[period].push(w.ar);
      }
      if (w.root) {
        rootedTokens++;
        if (revOrder != null) {
          const prev = rootMinOrder.get(w.root);
          if (prev == null || revOrder < prev) rootMinOrder.set(w.root, revOrder);
        }
      }
      if (w.lemma) {
        lemmaSet.add(w.lemma);
        lemmaCounts.set(w.lemma, (lemmaCounts.get(w.lemma) || 0) + 1);
        if (!periodLemmaSets[period]) periodLemmaSets[period] = new Set();
        periodLemmaSets[period].add(w.lemma);
      }
      if (w.pos) {
        posCounts[w.pos] = (posCounts[w.pos] || 0) + 1;
        posByPeriodCounts[period][w.pos] =
          (posByPeriodCounts[period][w.pos] || 0) + 1;
      }
    }
  }
}

let hapaxForms = 0;
for (const c of formCounts.values()) if (c === 1) hapaxForms++;
let hapaxLemmas = 0;
for (const c of lemmaCounts.values()) if (c === 1) hapaxLemmas++;

// ── POS profile (grammatical texture) ──────────────────────────────
// Full per-tag distribution (exact counts) plus a per-period noun/verb
// density view built from the two unambiguous single tags N and V, so
// nothing depends on a family taxonomy.
const posProfile = {
  totalTokens,
  byTag: Object.fromEntries(
    Object.entries(posCounts).sort((a, b) => b[1] - a[1]),
  ),
};
const posByPeriod = PERIOD_ORDER.map((p) => {
  const tags = posByPeriodCounts[p] || {};
  const total = periodTokens[p] || 0;
  const nouns = tags["N"] || 0;
  const verbs = tags["V"] || 0;
  return {
    period: p,
    label: PERIOD_LABELS[p],
    tokens: total,
    nouns,
    verbs,
    nounPct: total ? Math.round((nouns / total) * 1000) / 10 : 0,
    verbPct: total ? Math.round((verbs / total) * 1000) / 10 : 0,
    verbToNoun: nouns ? Math.round((verbs / nouns) * 100) / 100 : 0,
  };
});

// ── Vocabulary richness by period (type-token ratio) ────────────────
// Distinct surface forms and distinct lemmas as a fraction of all tokens
// in that period — the same two-level TTR as data/surah-profiles.json's
// per-surah formDiversityRatio/lemmaDiversityRatio, aggregated instead by
// chronological period. Sensitive to token-pool size like any TTR (the
// four periods are similar orders of magnitude in token count, unlike
// individual surahs, which is why this aggregate view is meaningful
// where a single corpus-wide per-surah ranking would not be).
const ttrByPeriod = PERIOD_ORDER.map((p) => {
  const total = periodTokens[p] || 0;
  const forms = periodFormSets[p] ? periodFormSets[p].size : 0;
  const lemmas = periodLemmaSets[p] ? periodLemmaSets[p].size : 0;
  const formTokens = periodFormTokens[p] || [];
  const formMattr = mattr(formTokens, MATTR_WINDOW_PERIOD);
  const formMtld = mtld(formTokens);
  return {
    period: p,
    label: PERIOD_LABELS[p],
    tokens: total,
    distinctForms: forms,
    distinctLemmas: lemmas,
    formTTR: total ? Math.round((forms / total) * 10000) / 10000 : 0,
    lemmaTTR: total ? Math.round((lemmas / total) * 10000) / 10000 : 0,
    formMATTR: formMattr === null ? null : Math.round(formMattr * 10000) / 10000,
    formMTLD: formMtld === null ? null : Math.round(formMtld * 100) / 100,
  };
});

// ── Verse-length distribution ──────────────────────────────────────
// Token-length of every verse, binned; overall and by revelation period.
const LEN_BINS = [
  { label: "1–5", lo: 1, hi: 5 },
  { label: "6–10", lo: 6, hi: 10 },
  { label: "11–20", lo: 11, hi: 20 },
  { label: "21–40", lo: 21, hi: 40 },
  { label: "41–80", lo: 41, hi: 80 },
  { label: "81+", lo: 81, hi: Infinity },
];
function binOf(tokens) {
  return LEN_BINS.findIndex((b) => tokens >= b.lo && tokens <= b.hi);
}
const histoOverall = LEN_BINS.map((b) => ({ label: b.label, count: 0 }));
const histoByPeriod = {};
for (const p of PERIOD_ORDER)
  histoByPeriod[p] = LEN_BINS.map((b) => ({ label: b.label, count: 0 }));
let maxVerseTokens = 0;
for (const v of verseLengths) {
  const bi = binOf(v.tokens);
  if (bi >= 0) {
    histoOverall[bi].count++;
    if (histoByPeriod[v.period]) histoByPeriod[v.period][bi].count++;
  }
  if (v.tokens > maxVerseTokens) maxVerseTokens = v.tokens;
}
const verseLengthHistogram = {
  bins: histoOverall,
  byPeriod: PERIOD_ORDER.map((p) => ({
    period: p,
    label: PERIOD_LABELS[p],
    bins: histoByPeriod[p],
  })),
  totalVerses: verseLengths.length,
  maxVerseTokens,
};

// ── Vocabulary growth across revelation ────────────────────────────
// For each of the 114 revelation-order steps, how many DISTINCT rooted
// roots appear for the first time (earliest revelation order they occur
// in), plus the running cumulative total. A "vocabulary accumulation"
// curve grounded in Cairo 1924 order.
const introByOrder = new Array(115).fill(0);
for (const order of rootMinOrder.values()) introByOrder[order]++;
const orderToSurah = {};
for (let s = 1; s <= 114; s++) {
  if (chronology[s]) orderToSurah[chronology[s].revelationOrder] = s;
}
let cumulative = 0;
const rootIntroduction = [];
for (let order = 1; order <= 114; order++) {
  cumulative += introByOrder[order];
  rootIntroduction.push({
    order,
    surah: orderToSurah[order] ?? null,
    newRoots: introByOrder[order],
    cumulativeRoots: cumulative,
  });
}

// ── Hapax localization ─────────────────────────────────────────────
// Every root occurring exactly once, with its single verse reference
// (from roots-summary firstOccurrence), sorted by mushaf position.
const hapaxRootList = Object.values(rootsSummary)
  .filter((e) => e.totalCount === 1)
  .map((e) => ({
    bw: e.rootBuckwalter,
    latin: e.rootLatin,
    arabic: e.rootArabic,
    surah: e.firstOccurrence ? e.firstOccurrence.surah : null,
    verse: e.firstOccurrence ? e.firstOccurrence.verse : null,
  }))
  .sort((a, b) => (a.surah - b.surah) || (a.verse - b.verse));

const totalVerses = verseCounts.reduce((sum, v) => sum + v.verses, 0);
const sortedLengths = verseCounts.map((v) => v.verses).sort((a, b) => a - b);
const median =
  (sortedLengths[56] + sortedLengths[57]) / 2; // 114 surahs → mean of ranks 57,58
const minLen = sortedLengths[0];
const maxEntry = verseCounts.reduce((a, b) => (b.verses > a.verses ? b : a));

const verseLengthByPeriod = PERIOD_ORDER.map((p) => ({
  period: p,
  label: PERIOD_LABELS[p],
  avgTokensPerVerse:
    Math.round((periodTokens[p] / periodVerses[p]) * 10) / 10,
}));

const out = {
  _generated: "build-numbers.mjs",
  _method:
    "All figures computed from data/morphology/ (Leeds Quranic Arabic Corpus v0.4, one token per morphology entry), data/roots-summary.json, and data/chronology.json (Cairo 1924 four-period classification). Verse counts follow Cairo numbering as tokenized by Leeds.",
  totals: {
    tokens: totalTokens,
    rootedTokens,
    roots: Object.keys(rootsSummary).length,
    lemmas: lemmaSet.size,
    verses: totalVerses,
    surahs: verseCounts.length,
  },
  namedRoots,
  topRoots,
  surahLength: {
    surahs: verseCounts.length,
    totalVerses,
    meanVerses: Math.round((totalVerses / verseCounts.length) * 10) / 10,
    medianVerses: median,
    longest: { s: maxEntry.s, verses: maxEntry.verses },
    shortest: verseCounts
      .filter((v) => v.verses === minLen)
      .map((v) => ({ s: v.s, verses: v.verses })),
  },
  verseLengthByPeriod,
  hapax: {
    uniqueSurfaceForms: formCounts.size,
    surfaceFormsOccurringOnce: hapaxForms,
    totalRoots: Object.keys(rootsSummary).length,
    rootsOccurringOnce: hapaxRoots,
    lemmasOccurringOnce: hapaxLemmas,
  },
  periodUniqueRoots: {
    meccanOnly,
    medinanOnly,
  },
  posProfile,
  posByPeriod,
  ttrByPeriod,
  verseLengthHistogram,
  rootIntroduction,
  hapaxLocalization: {
    count: hapaxRootList.length,
    lemmasOccurringOnce: hapaxLemmas,
    roots: hapaxRootList,
  },
};

writeFileSync(
  join(ROOT, "data", "numbers.json"),
  JSON.stringify(out, null, 1) + "\n",
);

console.log(
  `Top roots: ${topRoots.map((r) => `${r.latin}=${r.count}`).join(", ")}`,
);
console.log(
  `Surahs: mean ${out.surahLength.meanVerses}, median ${out.surahLength.medianVerses}, ` +
    `longest ${maxEntry.s} (${maxEntry.verses}), shortest ${out.surahLength.shortest
      .map((v) => v.s)
      .join("/")} (${minLen})`,
);
console.log(
  `Hapax: ${hapaxForms}/${formCounts.size} forms, ${hapaxRoots}/${out.hapax.totalRoots} roots`,
);
console.log(`Period-unique roots: ${meccanOnly} Meccan-only, ${medinanOnly} Medinan-only`);
console.log(
  `TTR by period: ${ttrByPeriod
    .map((t) => `${t.label} form=${t.formTTR} lemma=${t.lemmaTTR}`)
    .join(", ")}`,
);
console.log(
  `Verse length by period: ${verseLengthByPeriod
    .map((v) => `${v.label}=${v.avgTokensPerVerse}`)
    .join(", ")}`,
);
console.log(
  `POS: ${Object.entries(posProfile.byTag)
    .slice(0, 4)
    .map(([t, c]) => `${t}=${c}`)
    .join(", ")} (${Object.keys(posProfile.byTag).length} tags)`,
);
console.log(
  `Noun/verb by period: ${posByPeriod
    .map((p) => `${p.label} N=${p.nounPct}% V=${p.verbPct}%`)
    .join("; ")}`,
);
console.log(
  `Verse-length bins: ${verseLengthHistogram.bins
    .map((b) => `${b.label}=${b.count}`)
    .join(", ")} (max ${maxVerseTokens} tokens)`,
);
console.log(
  `Vocabulary growth: ${rootIntroduction[0].cumulativeRoots} roots by step 1, ` +
    `${rootIntroduction[113].cumulativeRoots} by step 114`,
);
console.log(
  `Hapax localization: ${hapaxRootList.length} once-roots, ${hapaxLemmas} once-lemmas`,
);
