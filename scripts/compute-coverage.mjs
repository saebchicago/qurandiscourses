#!/usr/bin/env node
//
// compute-coverage.mjs: measure data coverage directly from the repo's
// own data files. Every number here is either counted fresh from a data
// file at run time, or copied verbatim from an existing repo file
// (data/sources.json, numbers.html's own documented prose) with its
// exact source named. Nothing is inferred, generated, or carried over
// from memory. Where a fact is not available in the repo, the output
// says so explicitly instead of guessing.
//
// Reads: data/morphology/, data/roots-summary.json, data/qursim/,
// data/sources.json, assets/root-meanings.js (existence check only).
// Writes only new files under data/coverage/.
//
// To reproduce: node scripts/compute-coverage.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { computedDate } from "./lib/computed-date.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const OUT = join(DATA, "coverage");

const TOTAL_TOKENS = 77429;
const TOTAL_ROOTS = 1642;
const TOTAL_SURAHS = 114;

mkdirSync(OUT, { recursive: true });

// ── Step A: morphology field coverage (measured, all 77,429 tokens) ──

console.log("Measuring morphology field coverage...");

let scannedTokens = 0;
let withRoot = 0;
let withLemma = 0;
let withPos = 0;
const posDistributionNoRoot = {};
const posDistributionNoLemma = {};

for (let s = 1; s <= TOTAL_SURAHS; s++) {
  const path = join(DATA, "morphology", `${s}.json`);
  const morph = JSON.parse(readFileSync(path, "utf8"));
  for (const words of Object.values(morph)) {
    for (const w of words) {
      scannedTokens++;
      const hasRoot = w.root && w.root.length > 0;
      const hasLemma = w.lemma && w.lemma.length > 0;
      if (hasRoot) withRoot++;
      else posDistributionNoRoot[w.pos] = (posDistributionNoRoot[w.pos] || 0) + 1;
      if (hasLemma) withLemma++;
      else posDistributionNoLemma[w.pos] = (posDistributionNoLemma[w.pos] || 0) + 1;
      if (w.pos && w.pos.length > 0) withPos++;
    }
  }
}

if (scannedTokens !== TOTAL_TOKENS) {
  throw new Error(`Scanned ${scannedTokens} tokens, expected ${TOTAL_TOKENS}. STOPPING.`);
}

function pct(n, total) {
  return Math.round((n / total) * 10000) / 100;
}

function sortedDistribution(dist, total) {
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([pos, count]) => ({ pos, count, percent: pct(count, total) }));
}

const withoutRoot = scannedTokens - withRoot;
const withoutLemma = scannedTokens - withLemma;

const morphology = {
  totalTokens: scannedTokens,
  fields: {
    root: {
      label: "Tokens carrying a triliteral root",
      withField: withRoot,
      withoutField: withoutRoot,
      percentWith: pct(withRoot, scannedTokens),
      posDistributionWithoutField: sortedDistribution(posDistributionNoRoot, withoutRoot),
    },
    lemma: {
      label: "Tokens with a lemma",
      withField: withLemma,
      withoutField: withoutLemma,
      percentWith: pct(withLemma, scannedTokens),
      posDistributionWithoutField: sortedDistribution(posDistributionNoLemma, withoutLemma),
    },
    pos: {
      label: "Tokens with a part-of-speech tag",
      withField: withPos,
      withoutField: scannedTokens - withPos,
      percentWith: pct(withPos, scannedTokens),
    },
  },
  _method:
    "Every token in data/morphology/{1..114}.json scanned directly; a field counts as present if its value is a " +
    "non-empty string. The morphology 'gloss' field exists on every token but is empty on all of them " +
    "(0% populated) and is not reported as a field here, since it is never populated. For the root and lemma " +
    "fields, the part-of-speech distribution of the tokens WITHOUT that field is also measured and reported " +
    "(posDistributionWithoutField), directly from the same scan.",
};

console.log(
  `  root: ${withRoot}/${scannedTokens} (${morphology.fields.root.percentWith}%)  ` +
    `lemma: ${withLemma}/${scannedTokens} (${morphology.fields.lemma.percentWith}%)  ` +
    `pos: ${withPos}/${scannedTokens} (${morphology.fields.pos.percentWith}%)`,
);
console.log("  POS distribution of tokens without a root (top 5):");
for (const row of morphology.fields.root.posDistributionWithoutField.slice(0, 5)) {
  console.log(`    ${row.pos}: ${row.count} (${row.percent}%)`);
}
console.log("  POS distribution of tokens without a lemma:");
for (const row of morphology.fields.lemma.posDistributionWithoutField) {
  console.log(`    ${row.pos}: ${row.count} (${row.percent}%)`);
}

// ── Step B: root gloss coverage ────────────────────────────────────
//
// A "verified" gloss source means: an English gloss keyed by root
// (Buckwalter code), sourced from a citable, licensed reference, and
// documented as such in the repo. No such file exists.
// data/gloss/{surah}.json is per-word (not per-root) and covers 6 of
// 114 surahs (transcribed from Khan 2011, per NOTICE.md); it cannot
// answer "does root X have a gloss." assets/root-meanings.js provides
// short glosses for 82 roots, but its own file header states they are
// "editorial working glosses... NOT quotations from a citable
// dictionary" and instructs "Do not present these as Verified" - so
// they are reported here as a separate, explicitly-unverified note,
// never folded into the coverage count.

console.log("\nChecking for a verified root-level gloss source...");

const rootsSummary = JSON.parse(readFileSync(join(DATA, "roots-summary.json"), "utf8"));
if (Object.keys(rootsSummary).length !== TOTAL_ROOTS) {
  throw new Error(`Baseline mismatch: ${Object.keys(rootsSummary).length} roots, expected ${TOTAL_ROOTS}. STOPPING.`);
}

const rootHasGlossField = Object.values(rootsSummary).some((meta) => "gloss" in meta);
const verifiedGlossSourceExists = rootHasGlossField; // no other candidate file found in data/

let editorialGlossCount = 0;
const rootMeaningsPath = join(ROOT, "assets", "root-meanings.js");
if (existsSync(rootMeaningsPath)) {
  const src = readFileSync(rootMeaningsPath, "utf8");
  // Matches both bare-identifier keys (Alh:) and quoted keys ("E*b":),
  // each followed by a string value, one entry per line by convention.
  const matches = src.match(/^\s*(?:"[^"]*"|[A-Za-z$*]+)\s*:\s*"/gm);
  editorialGlossCount = matches ? matches.length : 0;
}

// Audit every render path that actually consumes assets/root-meanings.js
// (window.ROOT_MEANINGS), measured by grep, not assumed: pages with a
// direct MEANINGS[...]/ROOT_MEANINGS[...] lookup, plus pages that load
// assets/refs.js (whose reference-popover renders a root's gloss when a
// root reference is present) or assets/embed.js (same, for embed cards).
const htmlFiles = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const directLookupPages = [];
const refsJsPages = [];
const embedJsPages = [];
for (const f of htmlFiles) {
  const src = readFileSync(join(ROOT, f), "utf8");
  if (/\b(?:ROOT_MEANINGS|MEANINGS)\[/.test(src)) directLookupPages.push(f);
  if (src.includes('src="assets/refs.js"')) refsJsPages.push(f);
  if (src.includes('src="assets/embed.js"')) embedJsPages.push(f);
}
const glossRenderPaths = [...new Set([...directLookupPages, ...refsJsPages, ...embedJsPages])].sort();

const rootGloss = {
  totalRoots: TOTAL_ROOTS,
  withVerifiedGloss: 0,
  percentWith: 0,
  reason: verifiedGlossSourceExists
    ? "unexpected: a gloss field was found on data/roots-summary.json entries; script needs updating"
    : "no verified gloss source present in repository",
  editorialGlossCount,
  editorialGlossRenderPaths: glossRenderPaths,
  _note:
    editorialGlossCount > 0
      ? `assets/root-meanings.js provides ${editorialGlossCount} short editorial glosses (out of ${TOTAL_ROOTS} roots). ` +
        "Its own file header states these are editorial working glosses, not quotations from a citable dictionary, " +
        "and instructs that they not be presented as Verified. Not counted toward the coverage figure above. " +
        "data/gloss/{surah}.json provides per-word (not per-root) glosses transcribed from Khan (2011), covering " +
        `${JSON.parse(readFileSync(join(DATA, "gloss", "index.json"), "utf8")).surahs.length} of ${TOTAL_SURAHS} surahs; ` +
        "it cannot answer per-root coverage."
      : "No candidate gloss file found in data/ or assets/.",
  editorialGlossDashboardText:
    glossRenderPaths.length > 0
      ? `${editorialGlossCount} roots carry editorial working glosses maintained in this repository. ` +
        "These are not sourced from a citable dictionary and are not labeled Verified. They are excluded from this count."
      : null,
};

console.log(`  Verified root gloss coverage: 0/${TOTAL_ROOTS} (0%). Reason: ${rootGloss.reason}`);
console.log(`  (Editorial, unverified: ${editorialGlossCount} roots in assets/root-meanings.js, not counted.)`);
console.log(`  Render paths (${glossRenderPaths.length}): ${glossRenderPaths.join(", ")}`);

// ── Step C: QurSim (Mishkat) surah coverage ────────────────────────

console.log("\nMeasuring QurSim/Mishkat surah coverage...");

const qursimDir = join(DATA, "qursim");
const qursimFiles = new Set(
  readdirSync(qursimDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => Number(f.replace(".json", "")))
    .filter((n) => Number.isInteger(n)),
);
const uncoveredSurahs = [];
for (let s = 1; s <= TOTAL_SURAHS; s++) {
  if (!qursimFiles.has(s)) uncoveredSurahs.push(s);
}
const qursim = {
  totalSurahs: TOTAL_SURAHS,
  covered: TOTAL_SURAHS - uncoveredSurahs.length,
  uncovered: uncoveredSurahs,
  _method: "Counted data/qursim/{surah}.json files present for surah numbers 1-114.",
};

console.log(`  Covered: ${qursim.covered}/${TOTAL_SURAHS}. Uncovered: [${uncoveredSurahs.join(", ")}]`);

if (qursim.covered !== 110 || uncoveredSurahs.join(",") !== "104,105,106,110") {
  console.error(
    `MEASURED VALUES DIVERGE FROM EXPECTED SANITY CHECK: covered=${qursim.covered}, ` +
      `uncovered=[${uncoveredSurahs.join(",")}]. Reporting measured values as-is; NOT changing them. STOPPING per instructions.`,
  );
  writeFileSync(join(OUT, "STOP-qursim-mismatch.json"), JSON.stringify(qursim, null, 1));
  process.exit(1);
}

// ── Step D: counting-rule sensitivity ──────────────────────────────
//
// Only entries already documented in the repo's own prose (numbers.html)
// are included. The root-occurrence count for each is measured fresh
// from data/roots-summary.json here; the popular/alternate figure is
// quoted text already present in numbers.html (not independently
// measurable from a data file, and explicitly marked there as not
// reproduced by this site) and is reproduced verbatim, not invented.

console.log("\nBuilding counting-rule sensitivity table (documented entries only)...");

function rootCount(bw) {
  const meta = rootsSummary[bw];
  if (!meta) throw new Error(`Root ${bw} not found in roots-summary.json. STOPPING.`);
  return meta.totalCount;
}

const countingRuleSensitivity = [
  {
    root: "ArD",
    rootLatin: "a-r-ḍ",
    concept: "earth, land",
    counts: [
      { rule: "root occurrence count (Leeds corpus, all derived forms)", value: rootCount("ArD"), verified: true },
      {
        rule: "popular surface-form count, specific noun senses only (not independently reproduced by this site)",
        value: 13,
        verified: false,
      },
    ],
    _documentedIn: "numbers.html, \"Earth and sea\" card",
  },
  {
    root: "bHr",
    rootLatin: "b-ḥ-r",
    concept: "sea",
    counts: [
      { rule: "root occurrence count (Leeds corpus, all derived forms)", value: rootCount("bHr"), verified: true },
      {
        rule: "popular surface-form count, specific noun senses only (not independently reproduced by this site)",
        value: 32,
        verified: false,
      },
    ],
    _documentedIn: "numbers.html, \"Earth and sea\" card",
  },
  {
    root: "ywm",
    rootLatin: "y-w-m",
    concept: "day",
    counts: [
      { rule: "root occurrence count (Leeds corpus, all derived forms)", value: rootCount("ywm"), verified: true },
      {
        rule: "popular surface/compound-form totals (not independently reproduced by this site)",
        value: "365 or 475",
        verified: false,
      },
    ],
    _documentedIn: "numbers.html, \"Day, month, year\" card",
  },
  {
    root: "$hr",
    rootLatin: "sh-h-r",
    concept: "month",
    counts: [
      { rule: "root occurrence count (Leeds corpus, all derived forms)", value: rootCount("$hr"), verified: true },
      {
        rule: "popular surface-form count for singular \"shahr\" (not independently reproduced by this site)",
        value: 12,
        verified: false,
      },
    ],
    _documentedIn: "numbers.html, \"Day, month, year\" card",
  },
];

for (const entry of countingRuleSensitivity) {
  console.log(`  ${entry.rootLatin}: ${entry.counts.map((c) => c.value).join(" vs. ")}`);
}

// ── Step E: source registry ─────────────────────────────────────────
//
// Verbatim from data/sources.json (the site's own bibliography) for the
// datasets that back the coverage figures measured above. Any field not
// present on the entry is recorded as "not stated in repository", never
// inferred. Read from the structured JSON entry only, not from prose
// elsewhere (e.g. NOTICE.md), so this stays a mechanical measurement.

console.log("\nBuilding source registry from data/sources.json...");

const sourcesJson = JSON.parse(readFileSync(join(DATA, "sources.json"), "utf8"));
const sourcesById = new Map(sourcesJson.sources.map((s) => [s.id, s]));

const NOT_STATED = "not stated in repository";
const REGISTRY_IDS = ["leeds-corpus-v0.4", "mishkat", "qursim", "tanzil", "cairo-1924", "quran-foundation-api-v4", "khan-introduction-2011"];

const sourceRegistry = REGISTRY_IDS.map((id) => {
  const s = sourcesById.get(id);
  if (!s) throw new Error(`Expected source id "${id}" in data/sources.json, not found. STOPPING.`);
  return {
    id,
    name: s.name || NOT_STATED,
    version: s.edition || NOT_STATED,
    author: s.author || NOT_STATED,
    year: s.year || NOT_STATED,
    license: s.license || NOT_STATED,
    url: s.url || NOT_STATED,
  };
});

// Track every field on each entry, not just version/license/url: an
// earlier pass here missed cairo-1924.author (no author key on its
// data/sources.json entry) because it only checked three of the six
// fields the registry actually renders. Fixed to check all of them.
const REGISTRY_FIELDS = ["name", "version", "author", "year", "license", "url"];
const notStatedFields = [];
for (const entry of sourceRegistry) {
  for (const field of REGISTRY_FIELDS) {
    if (entry[field] === NOT_STATED) notStatedFields.push(`${entry.id}.${field}`);
  }
}
console.log(
  `  ${sourceRegistry.length} entries. Fields not stated in repository (${notStatedFields.length}): ${notStatedFields.join(", ") || "(none)"}`,
);

// qursim entry's data is, per NOTICE.md, actually the Mishkat corpus
// (data/qursim/ keeps its historical directory name); its license
// field is "not stated in repository" for BOTH the qursim and mishkat
// registry entries. Flagged explicitly as a blocker: any future
// CSV/JSON export of QurSim-derived (i.e. Mishkat-derived) data must
// not ship without resolving this first.
const blockers = [];
const qursimEntry = sourceRegistry.find((e) => e.id === "qursim");
const mishkatEntry = sourceRegistry.find((e) => e.id === "mishkat");
if (qursimEntry && qursimEntry.license === NOT_STATED) {
  blockers.push({
    field: "qursim.license",
    severity: "blocker",
    note:
      "qursim.license is not stated in repository. data/qursim/ actually contains Mishkat Mutashabihat corpus " +
      "data (see NOTICE.md); the mishkat source registry entry records its license as license-pending " +
      "(no license published in the source repository). Any future export of QurSim-derived (Mishkat-derived) " +
      "data must resolve licensing before publication.",
  });
}
if (blockers.length) {
  console.log(`  BLOCKER flagged: ${blockers.map((b) => b.field).join(", ")}`);
}

// ── Write output ─────────────────────────────────────────────────────

const COMPUTED_DATE = computedDate();

// ── Khan outline coverage (the contribution work queue) ─────────────
// Khan's 2013 volume publishes sectional outlines for surahs 85-114
// (data/sources.json khan-exercise-2013). The transcribed set is read
// from data/exercises.json; wanted = published minus transcribed, the
// exact queue the structural-hypothesis pipeline exists to drain. The
// invariant below fails the build rather than shipping a wrong queue.
const KHAN_PUBLISHED_START = 85;
const KHAN_PUBLISHED_END = 114;
const exercisesReg = JSON.parse(
  readFileSync(join(ROOT, "data/exercises.json"), "utf8"),
);
const transcribed = exercisesReg.exercises
  .filter((e) => e.type === "outline")
  .map((e) => e.surah)
  .sort((a, b) => a - b);
const published = [];
for (let s = KHAN_PUBLISHED_START; s <= KHAN_PUBLISHED_END; s++) published.push(s);
const wanted = published.filter((s) => !transcribed.includes(s));
for (const s of transcribed) {
  if (s < KHAN_PUBLISHED_START || s > KHAN_PUBLISHED_END)
    throw new Error(`transcribed outline for surah ${s} is outside Khan's published 85-114 range`);
}
if (wanted.length + transcribed.length !== published.length)
  throw new Error("khan outline sets do not partition the published range");
const khanOutlines = {
  _method:
    "published = surahs 85-114, the range of Khan's 2013 outline volume (source khan-exercise-2013); transcribed is read from data/exercises.json type=outline entries; wanted is the difference. Transcription requires the book and the review checklist in CONTRIBUTING.md.",
  publishedRange: [KHAN_PUBLISHED_START, KHAN_PUBLISHED_END],
  publishedCount: published.length,
  transcribed,
  wanted,
};

// ── Ring / structural analyses ───────────────────────────────────────
// patterns.html names ring composition as documented in the literature
// but the site asserts no ring outline for any surah, and that is a
// deliberate limit, not an oversight: a real outline has to be
// transcribed from a published, page-cited analysis (Cuypers, Farrin,
// Islahi), never computed. docs/maintainer-guide.md records the reason.
//
// Until now that gap was silent — unlike the Khan outlines, it had no
// coverage entry and therefore no visible queue. Zero of 114 is a
// number worth publishing: it tells a reader exactly what the site does
// not claim, and it tells a contributor what to bring.
//
// The narrow positional proxy in data/symmetry-test.json is NOT this.
// It tested one mechanical property and found nothing corpus-wide; its
// own _scope says a null result there says nothing about the literary
// scholarship. Counted separately so the two are never conflated.
const symmetry = JSON.parse(
  readFileSync(join(ROOT, "data/symmetry-test.json"), "utf8"),
);
const ringAnalyses = {
  _method:
    "transcribed counts surahs with a published, page-cited ring/structural outline recorded in repository data. There are none: the site computes no ring structure and will not attribute an outline to a scholar who did not publish it. wanted is therefore all 114. Separately, proxyTest records the one mechanical positional test the site DID run corpus-wide (data/symmetry-test.json), whose null result is not evidence about the literary scholarship.",
  totalSurahs: 114,
  transcribed: [],
  wanted: Array.from({ length: 114 }, (_, i) => i + 1),
  proxyTest: {
    candidatePairs: symmetry.totalCandidates,
    fdrSurvivors: symmetry.fdrSurvivors,
    bonferroniSurvivors: symmetry.bonferroniSurvivors,
    surahsWithClosestMiss: [
      ...new Set((symmetry.closestMisses || []).map((c) => c.surah)),
    ].sort((a, b) => a - b),
  },
};
if (ringAnalyses.transcribed.length + ringAnalyses.wanted.length !== 114)
  throw new Error("ring analysis sets do not partition the 114 surahs");

// A second, separate computed layer: data/structure-tests.json asks
// whether the mechanically segmented sections in data/structure/{s}.json
// show block-level mirror symmetry (concentric pairing, inclusio,
// formula bookending, verse-length symmetry), pooled into one
// corpus-wide FDR correction. Kept apart from ringAnalyses above for the
// same reason the point-pair proxyTest is: it is a computed mechanical
// property, not a transcribed literary outline, and conflating the two
// would misrepresent what either one is.
const structureTests = JSON.parse(
  readFileSync(join(ROOT, "data/structure-tests.json"), "utf8"),
);
const structureTestsSummary = {
  _method:
    "Summary of data/structure-tests.json: four mechanical block-symmetry " +
    "tests over the sections in data/structure/{s}.json, corrected jointly " +
    "across all candidates. Its own _scope explains what a survivor would " +
    "and would not mean; see that file for the per-surah breakdown.",
  totalCandidates: structureTests.totalCandidates,
  fdrSurvivors: structureTests.fdrSurvivors,
  bonferroniSurvivors: structureTests.bonferroniSurvivors,
  surahsWithClosestMiss: [
    ...new Set(
      Object.values(structureTests.closestMisses)
        .flat()
        .map((c) => c.surah),
    ),
  ].sort((a, b) => a - b),
};

const report = {
  _script: "scripts/compute-coverage.mjs",
  _method:
    "Every number in this report is measured directly from repository data files at generation time, except the " +
    "'popular'/alternate values in countingRuleSensitivity, which are quoted verbatim from numbers.html's own " +
    "prose (already-published editorial text, not independently measurable from a data file) and are marked " +
    "verified:false accordingly. Source registry fields are read verbatim from data/sources.json; any field " +
    `absent there is recorded as "${NOT_STATED}", never inferred.`,
  _computed: COMPUTED_DATE,
  morphology,
  rootGloss,
  qursim,
  countingRuleSensitivity,
  khanOutlines,
  ringAnalyses,
  structureTests: structureTestsSummary,
  sourceRegistry,
  sourceRegistryBlockers: blockers,
};

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1) + "\n");
console.log(`\nDone. Wrote data/coverage/report.json.`);
