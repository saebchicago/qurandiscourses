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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// ── Morphology sweep: surface forms, verse counts, tokens/period ───
const formCounts = new Map();
const verseCounts = [];
const periodTokens = {};
const periodVerses = {};
const lemmaSet = new Set();
let totalTokens = 0;
let rootedTokens = 0;
for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );
  const period = chronology[s] ? chronology[s].period : "unclassified";
  const ayahs = Object.keys(morph);
  verseCounts.push({ s, verses: ayahs.length });
  for (const a of ayahs) {
    periodTokens[period] = (periodTokens[period] || 0) + morph[a].length;
    periodVerses[period] = (periodVerses[period] || 0) + 1;
    for (const w of morph[a]) {
      formCounts.set(w.ar, (formCounts.get(w.ar) || 0) + 1);
      totalTokens++;
      if (w.root) rootedTokens++;
      if (w.lemma) lemmaSet.add(w.lemma);
    }
  }
}

let hapaxForms = 0;
for (const c of formCounts.values()) if (c === 1) hapaxForms++;

const totalVerses = verseCounts.reduce((sum, v) => sum + v.verses, 0);
const sortedLengths = verseCounts.map((v) => v.verses).sort((a, b) => a - b);
const median =
  (sortedLengths[56] + sortedLengths[57]) / 2; // 114 surahs → mean of ranks 57,58
const minLen = sortedLengths[0];
const maxEntry = verseCounts.reduce((a, b) => (b.verses > a.verses ? b : a));

const PERIOD_ORDER = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
const PERIOD_LABELS = {
  "meccan-early": "Early Meccan",
  "meccan-middle": "Middle Meccan",
  "meccan-late": "Late Meccan",
  medinan: "Medinan",
};
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
  },
  periodUniqueRoots: {
    meccanOnly,
    medinanOnly,
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
  `Verse length by period: ${verseLengthByPeriod
    .map((v) => `${v.label}=${v.avgTokensPerVerse}`)
    .join(", ")}`,
);
