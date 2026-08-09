#!/usr/bin/env node
//
// build-exports.mjs: generate the public CSV/JSON download set under
// data/exports/, plus its schema and data dictionary.
//
// This is a downstream export step: it reads existing data/ files
// (data/roots-summary.json, data/numbers.json, data/chronology.json,
// data/surah-profiles.json, data/surah-names.json, data/morphology/) and
// the per-root files written by scripts/compute-association-stats.mjs
// (data/association/*.json). It does not recompute association
// statistics itself, and it does not modify any of those inputs. It only
// writes new files under data/exports/.
//
// Output (both a CSV and a JSON array of the same rows, for every table):
//   data/exports/root-frequencies.{csv,json}: every root, raw count,
//     overall normalized frequency, and per-period count + normalized
//     frequency (4 revelation periods).
//   data/exports/association-pairs.{csv,json}: every root-pair
//     association entry that appears in any root's top-25-by-LLR list
//     (data/association/*.json), deduplicated by unordered pair.
//   data/exports/surah-stats.{csv,json}: per-surah corpus fingerprint,
//     verse/token/root counts, diversity ratios, POS mix, revelation
//     order and period.
//   data/exports/verse-lengths.{csv,json}: every verse's token length
//     and revelation period (6,236 rows).
//   data/exports/schema.json: machine-readable field-level schema for
//     all four tables above.
//   data/exports/DATA-DICTIONARY.md: the same schema in prose.
//
// To reproduce: node scripts/build-exports.mjs (run
// scripts/compute-association-stats.mjs first if data/association/ is
// missing or stale).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { safeKey } from "./lib/safe-key.mjs";
import { computedDate } from "./lib/computed-date.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const OUT = join(DATA, "exports");
const ASSOC = join(DATA, "association");

const TOTAL_VERSES = 6236;
const TOTAL_TOKENS = 77429;
const TOTAL_ROOTS = 1642;
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
  "\"Bell's Introduction to the Qur'an\", 1970).";
const LEEDS_CITATION =
  "Dukes, Kais. The Quranic Arabic Corpus, version 0.4. Leeds: Language Research Group, University of Leeds, 2009-2017. https://corpus.quran.com/. GNU GPL.";

mkdirSync(OUT, { recursive: true });

// ── CSV helpers (no dependency: quote only when needed, RFC 4180-ish) ──

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => csvCell(r[c])).join(","));
  return [header, ...lines].join("\n") + "\n";
}

function writeTable(name, rows, columns) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(rows));
  writeFileSync(join(OUT, `${name}.csv`), toCsv(rows, columns));
  console.log(`  ${name}: ${rows.length} rows`);
}

// ── Load existing data (read-only) ──────────────────────────────────────

console.log("Loading existing data…");
const rootsSummary = JSON.parse(readFileSync(join(DATA, "roots-summary.json"), "utf8"));
const chronology = JSON.parse(readFileSync(join(DATA, "chronology.json"), "utf8"));
const numbers = JSON.parse(readFileSync(join(DATA, "numbers.json"), "utf8"));
const surahProfiles = JSON.parse(readFileSync(join(DATA, "surah-profiles.json"), "utf8"));
const surahNames = JSON.parse(readFileSync(join(DATA, "surah-names.json"), "utf8"));

if (Object.keys(rootsSummary).length !== TOTAL_ROOTS) {
  throw new Error(`Baseline mismatch: ${Object.keys(rootsSummary).length} roots, expected ${TOTAL_ROOTS}`);
}
if (numbers.totals.tokens !== TOTAL_TOKENS || numbers.totals.verses !== TOTAL_VERSES) {
  throw new Error("Baseline mismatch against data/numbers.json totals. STOPPING.");
}

const periodTokens = {};
for (const p of numbers.posByPeriod) periodTokens[p.period] = p.tokens;

// ── Table 1: root-frequencies ───────────────────────────────────────────

console.log("\nBuilding root-frequencies…");
const rootFreqRows = [];
for (const [bw, meta] of Object.entries(rootsSummary)) {
  const row = {
    root: bw,
    safeKey: safeKey(bw),
    arabic: meta.rootArabic,
    rootLatin: meta.rootLatin,
    totalCount: meta.totalCount,
    normalizedFrequencyOverall: Math.round((meta.totalCount / TOTAL_TOKENS) * 1000 * 1000) / 1000,
  };
  for (const p of PERIODS) {
    const count = (meta.byChronology && meta.byChronology[p]) || 0;
    row[`count_${p}`] = count;
    row[`normalizedFrequency_${p}`] = periodTokens[p]
      ? Math.round((count / periodTokens[p]) * 1000 * 1000) / 1000
      : 0;
  }
  rootFreqRows.push(row);
}
rootFreqRows.sort((a, b) => b.totalCount - a.totalCount || a.root.localeCompare(b.root));
const rootFreqColumns = [
  "root",
  "safeKey",
  "arabic",
  "rootLatin",
  "totalCount",
  "normalizedFrequencyOverall",
  ...PERIODS.flatMap((p) => [`count_${p}`, `normalizedFrequency_${p}`]),
];
writeTable("root-frequencies", rootFreqRows, rootFreqColumns);

// ── Table 2: association-pairs (from data/association/*.json) ──────────

console.log("\nBuilding association-pairs…");
let assocFiles;
try {
  assocFiles = readdirSync(ASSOC).filter((f) => f.endsWith(".json") && f !== "keyness-top.json" && f !== "methods.json");
} catch {
  throw new Error("data/association/ not found. Run scripts/compute-association-stats.mjs first. STOPPING.");
}
if (assocFiles.length !== TOTAL_ROOTS) {
  throw new Error(`Expected ${TOTAL_ROOTS} per-root association files, found ${assocFiles.length}. STOPPING.`);
}

function pairKey(a, b) {
  return a < b ? `${a} ${b}` : `${b} ${a}`;
}

const seenPairs = new Set();
const pairRows = [];
for (const f of assocFiles) {
  const data = JSON.parse(readFileSync(join(ASSOC, f), "utf8"));
  for (const p of data.partners || []) {
    const key = pairKey(data.root, p.root);
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    pairRows.push({
      rootA: data.root,
      rootASafeKey: data.safeKey,
      rootALatin: data.rootLatin,
      rootB: p.root,
      rootBSafeKey: p.safeKey,
      rootBLatin: p.rootLatin,
      sharedVerses: p.k11,
      pmi: p.pmi,
      dice: p.dice,
      llr: p.llr,
    });
  }
}
pairRows.sort((a, b) => b.llr - a.llr);
const pairColumns = [
  "rootA",
  "rootASafeKey",
  "rootALatin",
  "rootB",
  "rootBSafeKey",
  "rootBLatin",
  "sharedVerses",
  "pmi",
  "dice",
  "llr",
];
writeTable("association-pairs", pairRows, pairColumns);

// ── Table 3: surah-stats (surah-profiles.json + chronology + names) ────

console.log("\nBuilding surah-stats…");
const surahRows = [];
for (let s = 1; s <= 114; s++) {
  const profile = surahProfiles.surahs[String(s)];
  const chron = chronology[String(s)];
  const names = surahNames[String(s)];
  if (!profile || !chron || !names) throw new Error(`Missing surah metadata for surah ${s}. STOPPING.`);
  surahRows.push({
    surah: s,
    nameTranslit: names.translit,
    nameArabic: names.ar,
    nameEnglish: names.en,
    revelationOrder: chron.revelationOrder,
    period: chron.period,
    verseCount: profile.verseCount,
    tokenCount: profile.tokenCount,
    distinctRootCount: profile.distinctRootCount,
    rootDiversityRatio: profile.rootDiversityRatio,
    distinctFormCount: profile.distinctFormCount,
    formDiversityRatio: profile.formDiversityRatio,
    distinctLemmaCount: profile.distinctLemmaCount,
    lemmaDiversityRatio: profile.lemmaDiversityRatio,
    nounPct: profile.posMix ? profile.posMix.nounPct : null,
    verbPct: profile.posMix ? profile.posMix.verbPct : null,
  });
}
const surahColumns = [
  "surah",
  "nameTranslit",
  "nameArabic",
  "nameEnglish",
  "revelationOrder",
  "period",
  "verseCount",
  "tokenCount",
  "distinctRootCount",
  "rootDiversityRatio",
  "distinctFormCount",
  "formDiversityRatio",
  "distinctLemmaCount",
  "lemmaDiversityRatio",
  "nounPct",
  "verbPct",
];
writeTable("surah-stats", surahRows, surahColumns);
if (surahRows.length !== 114) throw new Error(`Expected 114 surah rows, got ${surahRows.length}`);
const surahVerseSum = surahRows.reduce((s, r) => s + r.verseCount, 0);
if (surahVerseSum !== TOTAL_VERSES) {
  throw new Error(`Surah verse counts sum to ${surahVerseSum}, expected ${TOTAL_VERSES}. STOPPING.`);
}

// ── Table 4: verse-lengths (own morphology scan, cross-checked) ────────

console.log("\nBuilding verse-lengths…");
const verseRows = [];
let scannedTokens = 0;
for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(readFileSync(join(DATA, "morphology", `${s}.json`), "utf8"));
  const period = chronology[String(s)] ? chronology[String(s)].period : null;
  for (const [v, words] of Object.entries(morph)) {
    scannedTokens += words.length;
    verseRows.push({ surah: s, verse: Number(v), tokens: words.length, period });
  }
}
verseRows.sort((a, b) => a.surah - b.surah || a.verse - b.verse);
if (verseRows.length !== TOTAL_VERSES) {
  throw new Error(`Scanned ${verseRows.length} verses, expected ${TOTAL_VERSES}. STOPPING.`);
}
if (scannedTokens !== TOTAL_TOKENS) {
  throw new Error(`Scanned ${scannedTokens} tokens, expected ${TOTAL_TOKENS}. STOPPING.`);
}
writeTable("verse-lengths", verseRows, ["surah", "verse", "tokens", "period"]);

// ── Table 5: formulas (data/formulas-root.json + data/formulas-surface.json) ──

console.log("\nBuilding formulas…");
const formulasRoot = JSON.parse(readFileSync(join(DATA, "formulas-root.json"), "utf8"));
const formulasSurface = JSON.parse(readFileSync(join(DATA, "formulas-surface.json"), "utf8"));
const formulaRows = [];
for (const g of formulasRoot.ngrams) {
  formulaRows.push({
    stream: "root",
    n: g.n,
    display: g.display,
    arabic: g.arabic,
    count: g.count,
    firstSurah: g.refs[0][0],
    firstVerse: g.refs[0][1],
  });
}
for (const g of formulasSurface.ngrams) {
  formulaRows.push({
    stream: "surface",
    n: g.n,
    display: g.display,
    arabic: g.display,
    count: g.count,
    firstSurah: g.refs[0][0],
    firstVerse: g.refs[0][1],
  });
}
formulaRows.sort((a, b) => b.count - a.count || a.stream.localeCompare(b.stream));
const formulaColumns = ["stream", "n", "display", "arabic", "count", "firstSurah", "firstVerse"];
writeTable("formulas", formulaRows, formulaColumns);

// ── Table 6: centrality (data/centrality/*.json) ────────────────────────

console.log("\nBuilding centrality…");
const centralityRows = [];
for (const bw of Object.keys(rootsSummary)) {
  const c = JSON.parse(readFileSync(join(DATA, "centrality", `${safeKey(bw)}.json`), "utf8"));
  centralityRows.push({
    root: bw,
    safeKey: c.safeKey,
    rootLatin: c.rootLatin,
    degree: c.degree,
    degreeRank: c.degreeRank,
    weightedDegree: c.weightedDegree,
    weightedDegreeRank: c.weightedDegreeRank,
    betweenness: c.betweenness,
    betweennessRank: c.betweennessRank,
    eigenvector: c.eigenvector,
    eigenvectorRank: c.eigenvectorRank,
  });
}
if (centralityRows.length !== TOTAL_ROOTS)
  throw new Error(`Expected ${TOTAL_ROOTS} centrality rows, found ${centralityRows.length}. STOPPING.`);
centralityRows.sort((a, b) => a.degreeRank - b.degreeRank);
const centralityColumns = [
  "root", "safeKey", "rootLatin", "degree", "degreeRank",
  "weightedDegree", "weightedDegreeRank", "betweenness", "betweennessRank",
  "eigenvector", "eigenvectorRank",
];
writeTable("centrality", centralityRows, centralityColumns);

// ── Table 7: rhyme-summary (data/rhyme-summary.json) ────────────────────

console.log("\nBuilding rhyme-summary…");
const rhymeSummary = JSON.parse(readFileSync(join(DATA, "rhyme-summary.json"), "utf8"));
const rhymeRows = [];
for (let s = 1; s <= 114; s++) {
  const r = rhymeSummary.surahs[String(s)];
  if (!r) throw new Error(`Missing rhyme summary for surah ${s}. STOPPING.`);
  rhymeRows.push({
    surah: s,
    verseCount: r.verseCount,
    familyCount: r.familyCount,
    dominantKey: r.dominantKey,
    dominantShare: r.dominantShare,
    shiftCount: r.shiftCount,
    topRefrainPausal: r.topRefrain ? r.topRefrain.pausal : null,
    topRefrainCount: r.topRefrain ? r.topRefrain.count : null,
    meanRunLength: r.meanRunLength,
  });
}
writeTable("rhyme-summary", rhymeRows, [
  "surah", "verseCount", "familyCount", "dominantKey", "dominantShare",
  "shiftCount", "topRefrainPausal", "topRefrainCount", "meanRunLength",
]);

// ── Table 8: fawatih (data/rhetorical-features.json .fawatih) ───────────

console.log("\nBuilding fawatih…");
const rhetFeatures = JSON.parse(readFileSync(join(DATA, "rhetorical-features.json"), "utf8"));
const fawatihRows = rhetFeatures.fawatih.entries.map((e) => ({
  surah: e.s,
  verse: e.verses[0],
  letters: e.letters,
}));
if (fawatihRows.length !== rhetFeatures.fawatih.surahCount)
  throw new Error(`fawatih row count ${fawatihRows.length} does not match surahCount ${rhetFeatures.fawatih.surahCount}. STOPPING.`);
writeTable("fawatih", fawatihRows, ["surah", "verse", "letters"]);

// ── Table 9: discursive-pivots (data/discursive-pivots.json) ────────────

console.log("\nBuilding discursive-pivots…");
const pivots = JSON.parse(readFileSync(join(DATA, "discursive-pivots.json"), "utf8"));
const pivotRows = pivots.occurrences.map((o) => ({
  surah: o.s,
  verse: o.a,
  marker: o.marker,
  previousVerse: o.prevA,
  sharedRoots: o.sharedRoots.map((r) => r.rootLatin).join("; "),
}));
writeTable("discursive-pivots", pivotRows, ["surah", "verse", "marker", "previousVerse", "sharedRoots"]);

// ── Table 10: structure (data/structure/{s}.json .sections) ─────────────

console.log("\nBuilding structure…");
const structureRows = [];
for (let s = 1; s <= 114; s++) {
  const st = JSON.parse(readFileSync(join(DATA, "structure", `${s}.json`), "utf8"));
  for (const sec of st.sections) {
    structureRows.push({
      surah: s,
      sectionIndex: sec.index,
      fromVerse: sec.fromVerse,
      toVerse: sec.toVerse,
      verseCount: sec.verseCount,
    });
  }
}
writeTable("structure", structureRows, ["surah", "sectionIndex", "fromVerse", "toVerse", "verseCount"]);

// ── Table 11: structure-tests (data/structure-tests.json .perSurah) ─────

console.log("\nBuilding structure-tests…");
const structureTestsData = JSON.parse(readFileSync(join(DATA, "structure-tests.json"), "utf8"));
const survivorIds = new Set(
  (structureTestsData.survivors || []).map((v) => `${v.surah}:${v.test}`),
);
const TEST_KEYS = ["concentricParallelism", "inclusio", "formulaBookending", "lengthSymmetry"];
const structureTestRows = structureTestsData.perSurah.map((row) => {
  const out = { surah: row.surah, verseCount: row.verseCount, sections: row.sections };
  for (const key of TEST_KEYS) {
    const t = row[key];
    out[`${key}_observed`] = t ? t.observed : null;
    out[`${key}_pValue`] = t ? t.pValue : null;
    out[`${key}_survivor`] = t ? survivorIds.has(`${row.surah}:${key}`) : null;
  }
  return out;
});
writeTable(
  "structure-tests",
  structureTestRows,
  ["surah", "verseCount", "sections", ...TEST_KEYS.flatMap((k) => [`${k}_observed`, `${k}_pValue`, `${k}_survivor`])],
);

// ── Table 12: theme-surah-density (data/theme-surah-index.json) ─────────

console.log("\nBuilding theme-surah-density…");
const themeSurahIndex = JSON.parse(readFileSync(join(DATA, "theme-surah-index.json"), "utf8"));
const themeDensityRows = [];
for (let s = 1; s <= 114; s++) {
  for (const t of themeSurahIndex.surahs[String(s)] || []) {
    themeDensityRows.push({
      surah: s,
      themeSlug: t.slug,
      themeTitle: t.title,
      perThousand: t.perThousand,
    });
  }
}
writeTable("theme-surah-density", themeDensityRows, ["surah", "themeSlug", "themeTitle", "perThousand"]);

// ── schema.json ──────────────────────────────────────────────────────

console.log("\nWriting schema.json and DATA-DICTIONARY.md…");

const COMPUTED_DATE = computedDate();

const schema = {
  _generated: "scripts/build-exports.mjs",
  _source: LEEDS_CITATION,
  _chronologySource: CHRONOLOGY_SOURCE,
  _computed: COMPUTED_DATE,
  tables: {
    "root-frequencies": {
      description: "Every one of the 1,642 roots: raw occurrence count, overall normalized frequency, and per-period count and normalized frequency.",
      rowCount: rootFreqRows.length,
      countingRule: "Root occurrence = token count from Leeds morphology (root field non-empty). Normalized frequency = (count / total tokens for the given scope) * 1000, i.e. occurrences per 1,000 tokens.",
      verification: "totalCount and normalizedFrequencyOverall: Verified (direct computation). Per-period fields: Nuanced (depend on the four-period chronology named in _chronologySource).",
      fields: [
        { name: "root", type: "string", unit: null, description: "Buckwalter-transliterated root." },
        { name: "safeKey", type: "string", unit: null, description: "URL/filename-safe encoding of root, used to link to data/association/{safeKey}.json and roots.html?root={safeKey}." },
        { name: "arabic", type: "string", unit: null, description: "Root letters in Arabic script, space-separated." },
        { name: "rootLatin", type: "string", unit: null, description: "Root in Latin transliteration with diacritics." },
        { name: "totalCount", type: "integer", unit: "tokens", description: "Total occurrences of this root across the whole corpus (77,429 tokens)." },
        { name: "normalizedFrequencyOverall", type: "number", unit: "occurrences per 1,000 tokens", description: "(totalCount / 77,429) * 1000." },
        { name: "count_meccan-early", type: "integer", unit: "tokens", description: "Occurrences of this root in the Early Meccan period." },
        { name: "normalizedFrequency_meccan-early", type: "number", unit: "occurrences per 1,000 tokens", description: "(count_meccan-early / period token total) * 1000." },
        { name: "count_meccan-middle", type: "integer", unit: "tokens", description: "Occurrences of this root in the Middle Meccan period." },
        { name: "normalizedFrequency_meccan-middle", type: "number", unit: "occurrences per 1,000 tokens", description: "(count_meccan-middle / period token total) * 1000." },
        { name: "count_meccan-late", type: "integer", unit: "tokens", description: "Occurrences of this root in the Late Meccan period." },
        { name: "normalizedFrequency_meccan-late", type: "number", unit: "occurrences per 1,000 tokens", description: "(count_meccan-late / period token total) * 1000." },
        { name: "count_medinan", type: "integer", unit: "tokens", description: "Occurrences of this root in the Medinan period." },
        { name: "normalizedFrequency_medinan", type: "number", unit: "occurrences per 1,000 tokens", description: "(count_medinan / period token total) * 1000." },
      ],
    },
    "association-pairs": {
      description: "Root-pair association statistics: the union of every pair appearing in any root's top-25-by-LLR partner list, deduplicated by unordered pair.",
      rowCount: pairRows.length,
      countingRule: "Co-occurrence counted at the verse level over N = 6,236 verses. Only pairs with at least 5 shared verses were computed by scripts/compute-association-stats.mjs; only the top 25 partners per root (by LLR) are represented here, so this is not the complete set of all pairs meeting the 5-shared-verse threshold.",
      verification: "Verified: direct computation from Leeds morphology, cross-checked against a hand-computed 2x2 table and against data/cooccurrence/*.json's independently computed counts.",
      fields: [
        { name: "rootA", type: "string", unit: null, description: "First root of the pair (Buckwalter)." },
        { name: "rootASafeKey", type: "string", unit: null, description: "URL/filename-safe encoding of rootA." },
        { name: "rootALatin", type: "string", unit: null, description: "rootA in Latin transliteration." },
        { name: "rootB", type: "string", unit: null, description: "Second root of the pair (Buckwalter)." },
        { name: "rootBSafeKey", type: "string", unit: null, description: "URL/filename-safe encoding of rootB." },
        { name: "rootBLatin", type: "string", unit: null, description: "rootB in Latin transliteration." },
        { name: "sharedVerses", type: "integer", unit: "verses", description: "k11: number of verses in which both roots are attested." },
        { name: "pmi", type: "number", unit: "bits (log base 2)", description: "Pointwise mutual information: log2((k11*N)/((k11+k12)*(k11+k21))), N=6,236, rounded to 2 decimals." },
        { name: "dice", type: "number", unit: null, description: "Dice coefficient: 2*k11/(2*k11+k12+k21), rounded to 3 decimals." },
        { name: "llr", type: "number", unit: null, description: "Dunning's log-likelihood ratio (G2) over the pair's verse-level 2x2 table, rounded to 2 decimals." },
      ],
    },
    "surah-stats": {
      description: "Per-surah corpus fingerprint: all 114 surahs.",
      rowCount: surahRows.length,
      countingRule: "verseCount/tokenCount/distinctRootCount and diversity ratios are read from data/surah-profiles.json (Leeds morphology tally per surah). revelationOrder and period are read from data/chronology.json.",
      verification: "verseCount/tokenCount/distinctRootCount/diversity ratios/nounPct/verbPct: Verified (direct computation). revelationOrder/period: Nuanced (Cairo 1924 / Nöldeke-Bell chronology, one scheme among several).",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number, 1-114, Cairo (mushaf) order." },
        { name: "nameTranslit", type: "string", unit: null, description: "Transliterated surah name." },
        { name: "nameArabic", type: "string", unit: null, description: "Surah name in Arabic script." },
        { name: "nameEnglish", type: "string", unit: null, description: "English meaning of the surah name." },
        { name: "revelationOrder", type: "integer", unit: null, description: "Position in the Cairo 1924 revelation-order sequence (1 = first revealed)." },
        { name: "period", type: "string", unit: null, description: "One of meccan-early, meccan-middle, meccan-late, medinan (Nöldeke-Bell four-period classification)." },
        { name: "verseCount", type: "integer", unit: "verses", description: "Number of verses (ayat) in the surah, Cairo numbering." },
        { name: "tokenCount", type: "integer", unit: "tokens", description: "Total Leeds morphological tokens in the surah." },
        { name: "distinctRootCount", type: "integer", unit: "roots", description: "Count of distinct roots attested in the surah." },
        { name: "rootDiversityRatio", type: "number", unit: null, description: "distinctRootCount / tokenCount." },
        { name: "distinctFormCount", type: "integer", unit: "forms", description: "Count of distinct surface (written) forms in the surah." },
        { name: "formDiversityRatio", type: "number", unit: null, description: "distinctFormCount / tokenCount." },
        { name: "distinctLemmaCount", type: "integer", unit: "lemmas", description: "Count of distinct lemmas in the surah." },
        { name: "lemmaDiversityRatio", type: "number", unit: null, description: "distinctLemmaCount / tokenCount." },
        { name: "nounPct", type: "number", unit: "percent", description: "Percentage of the surah's tokens tagged noun (N) by Leeds POS tagging." },
        { name: "verbPct", type: "number", unit: "percent", description: "Percentage of the surah's tokens tagged verb (V) by Leeds POS tagging." },
      ],
    },
    "verse-lengths": {
      description: "Every verse in the corpus (6,236 rows) with its token length and revelation period.",
      rowCount: verseRows.length,
      countingRule: "tokens = number of Leeds morphological tokens in the verse (data/morphology/{surah}.json entry length). Ordered by surah, then verse.",
      verification: "surah/verse/tokens: Verified (direct tally). period: Nuanced (Cairo 1924 / Nöldeke-Bell chronology).",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number, 1-114." },
        { name: "verse", type: "integer", unit: null, description: "Verse (ayah) number within the surah, Cairo numbering." },
        { name: "tokens", type: "integer", unit: "tokens", description: "Number of Leeds morphological tokens in this verse." },
        { name: "period", type: "string", unit: null, description: "One of meccan-early, meccan-middle, meccan-late, medinan; null if the surah has no chronology entry." },
      ],
    },
    formulas: {
      description: "Every recurring 3-5 word sequence in the Qur'an (18,408 rows: 6,403 root-view + 12,005 surface-view), with its first occurrence.",
      rowCount: formulaRows.length,
      countingRule: "A sequence recurs if it appears 2+ times, counted two independent ways: root stream (words reduced to their consonantal root; unrooted particles skipped, so matched words need not be consecutive) and surface stream (diacritic-stripped written form, all words included, always consecutive). Only the first occurrence's location is included here; full occurrence lists are in data/formulas-root.json and data/formulas-surface.json.",
      verification: "Verified (direct computation from Leeds morphology).",
      fields: [
        { name: "stream", type: "string", unit: null, description: "root or surface." },
        { name: "n", type: "integer", unit: "words", description: "Sequence length, 3-5." },
        { name: "display", type: "string", unit: null, description: "Root stream: dot-separated Latin transliteration. Surface stream: the Arabic phrase itself." },
        { name: "arabic", type: "string", unit: null, description: "Arabic script for the sequence (root stream: root letters; surface stream: same as display)." },
        { name: "count", type: "integer", unit: "occurrences", description: "Total occurrences of this sequence across the corpus." },
        { name: "firstSurah", type: "integer", unit: null, description: "Surah of the sequence's first occurrence." },
        { name: "firstVerse", type: "integer", unit: null, description: "Verse of the sequence's first occurrence." },
      ],
    },
    centrality: {
      description: "Network centrality for all 1,642 roots over the root co-occurrence graph (5,211 edges, built from each root's top-25-by-LLR partners).",
      rowCount: centralityRows.length,
      countingRule: "Degree, weighted degree (sum of incident LLR weights), betweenness (Brandes' algorithm, unweighted shortest paths), and eigenvector centrality (power iteration on the LLR-weighted adjacency matrix), each with its rank among all 1,642 roots. Method detail in data/centrality/methods.json.",
      verification: "Nuanced: the four measures rank roots differently by design, and the graph itself is a subset (each root's top-25 partners, not every pair meeting the underlying 5-shared-verse threshold).",
      fields: [
        { name: "root", type: "string", unit: null, description: "Buckwalter-transliterated root." },
        { name: "safeKey", type: "string", unit: null, description: "URL/filename-safe encoding of root." },
        { name: "rootLatin", type: "string", unit: null, description: "Root in Latin transliteration with diacritics." },
        { name: "degree", type: "integer", unit: "neighbors", description: "Count of distinct partner roots." },
        { name: "degreeRank", type: "integer", unit: null, description: "Rank by degree, 1 = highest, among 1,642 roots." },
        { name: "weightedDegree", type: "number", unit: null, description: "Sum of incident edge weights (LLR)." },
        { name: "weightedDegreeRank", type: "integer", unit: null, description: "Rank by weighted degree." },
        { name: "betweenness", type: "number", unit: null, description: "Betweenness centrality (unweighted shortest paths)." },
        { name: "betweennessRank", type: "integer", unit: null, description: "Rank by betweenness." },
        { name: "eigenvector", type: "number", unit: null, description: "Eigenvector centrality (LLR-weighted, power iteration, L2-normalized)." },
        { name: "eigenvectorRank", type: "integer", unit: null, description: "Rank by eigenvector centrality." },
      ],
    },
    "rhyme-summary": {
      description: "Per-surah roll-up of verse-ending (rhyme) patterns for all 114 surahs.",
      rowCount: rhymeRows.length,
      countingRule: "Verse-final word per verse, diacritics/tatweel stripped (an orthographic proxy for pausal form, not a phonological transcription). familyCount/dominantKey/dominantShare/shiftCount are over the fine rhyme key (last two letters after collapsing hamza seats). meanRunLength = verseCount / (shiftCount + 1). Full method note and per-verse detail in data/rhyme/{surah}.json.",
      verification: "Verified (direct computation from Leeds morphology and the Tanzil Uthmani text).",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number, 1-114." },
        { name: "verseCount", type: "integer", unit: "verses", description: "Number of verses in the surah." },
        { name: "familyCount", type: "integer", unit: null, description: "Count of distinct fine-key rhyme families in the surah." },
        { name: "dominantKey", type: "string", unit: null, description: "The most frequent fine rhyme key in the surah." },
        { name: "dominantShare", type: "number", unit: null, description: "Share of verses ending on the dominant key, 0-1." },
        { name: "shiftCount", type: "integer", unit: null, description: "Number of verse-to-verse changes in the fine rhyme key." },
        { name: "topRefrainPausal", type: "string", unit: null, description: "Pausal form of the most-repeated verse ending recurring 3+ times, if any; null otherwise." },
        { name: "topRefrainCount", type: "integer", unit: null, description: "Occurrences of topRefrainPausal; null if there is no refrain." },
        { name: "meanRunLength", type: "number", unit: "verses", description: "verseCount / (shiftCount + 1): average consecutive-verse run on one ending before it changes." },
      ],
    },
    fawatih: {
      description: "The 29 surahs opening with a sequence of isolated letters (fawatih / al-muqatta'at), and which combination.",
      rowCount: fawatihRows.length,
      countingRule: "Detected from the Leeds morphology: a surah's opening verse consisting solely of isolated-letter tokens. 14 distinct letter combinations recur across the 29 surahs.",
      verification: "Verified (direct detection from Leeds morphology). The letters' meaning is not asserted; the classical tradition has never settled it.",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number." },
        { name: "verse", type: "integer", unit: null, description: "Verse carrying the isolated letters (always 1)." },
        { name: "letters", type: "string", unit: null, description: "The isolated letters in Arabic script, as written." },
      ],
    },
    "discursive-pivots": {
      description: "137 verses mechanically flagged for opening with a temporal particle (idh or idha) while sharing a content root with the immediately preceding verse.",
      rowCount: pivotRows.length,
      countingRule: "A verse qualifies if its first content word is idh or idha (Leeds lemma) and it shares at least one non-stoplisted root with the previous verse. A candidate marker of a discursive turn, not a scholar's identification of one; method note in data/discursive-pivots.json.",
      verification: "Nuanced: depends on the fixed marker list and content-root stoplist; a different choice of either would change the count.",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number." },
        { name: "verse", type: "integer", unit: null, description: "The flagged verse." },
        { name: "marker", type: "string", unit: null, description: "The temporal particle opening the verse: idh or idha." },
        { name: "previousVerse", type: "integer", unit: null, description: "The preceding verse the flagged verse shares a root with." },
        { name: "sharedRoots", type: "string", unit: null, description: "Semicolon-separated list of the shared root(s) in Latin transliteration." },
      ],
    },
    structure: {
      description: "Mechanically segmented sections for all 114 surahs (TextTiling-derived changepoint detection over lexical cohesion), not a transcribed scholarly outline.",
      rowCount: structureRows.length,
      countingRule: "Per-verse boundary scores from five weighted signals (rhyme-family change, verse-length discontinuity, lexical-cohesion drop, formula onset, discursive-pivot markers); section count set by a per-surah significance threshold, not a fixed target. 34 of 114 surahs get exactly one section (no boundary cleared the threshold). Full method and per-boundary evidence in data/structure/{surah}.json.",
      verification: "Nuanced: a computed segmentation, not a scholar's reading; never attributed to any named scholar. See docs/maintainer-guide.md on the named-scholar outline policy.",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number." },
        { name: "sectionIndex", type: "integer", unit: null, description: "1-based section number within the surah." },
        { name: "fromVerse", type: "integer", unit: null, description: "First verse of the section." },
        { name: "toVerse", type: "integer", unit: null, description: "Last verse of the section." },
        { name: "verseCount", type: "integer", unit: "verses", description: "Number of verses in the section." },
      ],
    },
    "structure-tests": {
      description: "Four block-level mirror-symmetry tests (concentric pairing, inclusio, formula bookending, verse-length symmetry) over the computed sections in the structure table, one row per surah.",
      rowCount: structureTestRows.length,
      countingRule: "Each test's p-value comes from a block-order permutation null (blocks kept intact, 10,000 seeded shuffles, or exact enumeration when feasible), corrected jointly across all 345 candidates from all four tests via Benjamini-Hochberg (q<0.05). Null for surahs with too few sections for a given test. 0 of 345 candidates reached significance after correction. Full method in data/structure-tests.json.",
      verification: "Nuanced: a null result describes this specific mechanical test over a computed segmentation, not the scholarly literature on ring composition, which this site never asserts an outline from.",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number." },
        { name: "verseCount", type: "integer", unit: "verses", description: "Verses in the surah." },
        { name: "sections", type: "integer", unit: null, description: "Number of computed sections (from the structure table)." },
        { name: "concentricParallelism_observed", type: "number", unit: null, description: "Observed mean Jaccard similarity of mirrored section pairs; null if the surah has too few sections for this test." },
        { name: "concentricParallelism_pValue", type: "number", unit: null, description: "Permutation p-value for concentricParallelism; null if not applicable." },
        { name: "concentricParallelism_survivor", type: "boolean", unit: null, description: "Whether this candidate survived the pooled Benjamini-Hochberg correction; null if not applicable." },
        { name: "inclusio_observed", type: "number", unit: null, description: "Observed vocabulary overlap between the first and last section; null if not applicable." },
        { name: "inclusio_pValue", type: "number", unit: null, description: "Permutation p-value for inclusio; null if not applicable." },
        { name: "inclusio_survivor", type: "boolean", unit: null, description: "Whether this candidate survived correction; null if not applicable." },
        { name: "formulaBookending_observed", type: "number", unit: null, description: "Observed formula-bracketing statistic; null if not applicable." },
        { name: "formulaBookending_pValue", type: "number", unit: null, description: "Permutation p-value for formulaBookending; null if not applicable." },
        { name: "formulaBookending_survivor", type: "boolean", unit: null, description: "Whether this candidate survived correction; null if not applicable." },
        { name: "lengthSymmetry_observed", type: "number", unit: null, description: "Observed correlation of the verse-length profile with its reverse; null if not applicable." },
        { name: "lengthSymmetry_pValue", type: "number", unit: null, description: "Permutation p-value for lengthSymmetry; null if not applicable." },
        { name: "lengthSymmetry_survivor", type: "boolean", unit: null, description: "Whether this candidate survived correction; null if not applicable." },
      ],
    },
    "theme-surah-density": {
      description: "Sparse theme-by-surah matrix: for each surah, the themes whose root-family vocabulary clusters most densely in it.",
      rowCount: themeDensityRows.length,
      countingRule: "perThousand = theme-root tokens per 1,000 surah tokens (Leeds counts, minimum 2 tokens). Each theme lists at most its top 8 surahs by density, so a surah's absence from this table for a given theme means it is not among that theme's densest, not that the vocabulary is absent entirely. Root-to-theme grouping is editorial (see themes.html); the counting is mechanical.",
      verification: "Nuanced: perThousand is a direct computation, but which roots belong to which theme is an editorial classification, not a computed fact.",
      fields: [
        { name: "surah", type: "integer", unit: null, description: "Surah number." },
        { name: "themeSlug", type: "string", unit: null, description: "Theme identifier, matches themes.html's slug." },
        { name: "themeTitle", type: "string", unit: null, description: "Theme display title." },
        { name: "perThousand", type: "number", unit: "theme-root tokens per 1,000 surah tokens", description: "Density of this theme's root family in this surah." },
      ],
    },
  },
};

writeFileSync(join(OUT, "schema.json"), JSON.stringify(schema, null, 1) + "\n");

// ── DATA-DICTIONARY.md (prose mirror of schema.json) ────────────────────

function fieldTable(fields) {
  const header = "| Field | Type | Unit | Description |\n| --- | --- | --- | --- |";
  const rows = fields.map(
    (f) => `| \`${f.name}\` | ${f.type} | ${f.unit || "n/a"} | ${f.description} |`,
  );
  return [header, ...rows].join("\n");
}

let md = `# Data dictionary: public exports\n\n`;
md += `Generated by \`scripts/build-exports.mjs\` on ${COMPUTED_DATE}. Mirrors \`data/exports/schema.json\` in prose; the JSON file is the machine-readable source of truth.\n\n`;
md += `Source corpus: ${LEEDS_CITATION}\n\n`;
md += `Chronology source (period-based fields): ${CHRONOLOGY_SOURCE}\n\n`;
for (const [name, t] of Object.entries(schema.tables)) {
  md += `## ${name}\n\n`;
  md += `${t.description} (${t.rowCount} rows.)\n\n`;
  md += `**Counting rule:** ${t.countingRule}\n\n`;
  md += `**Verification:** ${t.verification}\n\n`;
  md += fieldTable(t.fields) + "\n\n";
}
md += `## Files\n\nEach table above ships as both \`{name}.csv\` and \`{name}.json\` (a flat JSON array of the same rows) under \`data/exports/\`. CSV values are comma-separated, UTF-8, header row first; fields containing a comma, quote, or newline are quoted per RFC 4180.\n\n`;
md += `## License\n\nData derived from the Leeds Quranic Arabic Corpus is GPL-licensed, per \`NOTICE.md\`. Surah names and the Cairo 1924 chronology are factual/public-domain reference data. Site code (this script included) is MIT-licensed.\n`;

writeFileSync(join(OUT, "DATA-DICTIONARY.md"), md);

console.log("\nDone. data/exports/ written:");
for (const f of readdirSync(OUT).sort()) console.log(`  ${f}`);
