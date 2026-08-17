// build-rhyme-map.mjs — deterministic, zero-dependency generator for
// data/rhyme/{1..114}.json and data/rhyme-summary.json.
//
// What this measures, precisely: the verse-final word of every verse,
// reduced to an approximate pausal (waqf) form, then grouped by two
// mechanical ending keys:
//
//   pausal form: the last word's Uthmani text with diacritics and
//     tatweel stripped — which also drops tanwin and the short case
//     vowels (i'rab), approximating how a verse ending is actually
//     pronounced at pause — plus two orthographic normalizations
//     (word-final ta marbuta -> ha, alif wasla -> alif).
//   fine key (k2): the last two letters of the key-normalized pausal
//     form (hamza seats collapsed to alif, word-final alif maqsura ->
//     alif, so that -a endings written with ya-shaped alif match those
//     written with alif).
//   coarse key (k1): the final letter alone — pure end-assonance.
//
// Verses whose fine key differs from the previous verse's are recorded
// as "shifts"; identical whole pausal forms recurring 3+ times in a
// surah are recorded as "refrains" (e.g. Surah 55's refrain verse).
//
// What this deliberately does NOT claim: these keys are orthographic
// proxies, not a phonological transcription of recitation — assonance
// that classical treatments of saj'/fawasil would group by actual
// pausal vowel length can split across fine keys (the coarse key
// exists precisely to show that tension). Nor is any claim made that a
// rhyme shift IS a structural boundary: scholarship (e.g. Neuwirth
// 1981, cited on Sources) argues from rhyme among many other features;
// this file records only where the mechanical ending-pattern changes.
//
// Run: node scripts/build-rhyme-map.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pausalForm } from "./lib/arabic.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function keyNormalize(pausal) {
  return pausal
    .replace(/[أإآ]/g, "ا") // hamza seats on alif
    .replace(/ى$/, "ا"); // word-final alif maqsura: -a written ya-shaped
}

function k2of(pausal) {
  const n = keyNormalize(pausal);
  return n.length >= 2 ? n.slice(-2) : n;
}
function k1of(pausal) {
  const n = keyNormalize(pausal);
  return n.slice(-1);
}

function familiesFrom(verses, keyField) {
  const fams = new Map();
  for (const v of verses) {
    const k = v[keyField];
    if (!fams.has(k)) fams.set(k, []);
    fams.get(k).push(v.a);
  }
  return [...fams.entries()]
    .map(([key, vs]) => ({ key, count: vs.length, verses: vs }))
    .sort((x, y) => y.count - x.count || x.key.localeCompare(y.key));
}

mkdirSync(join(ROOT, "data", "rhyme"), { recursive: true });

const summary = {};

for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );
  const verseNums = Object.keys(morph)
    .map(Number)
    .sort((a, b) => a - b);

  const verses = [];
  for (const a of verseNums) {
    const words = morph[String(a)];
    if (!words || words.length === 0) continue;
    const last = words[words.length - 1];
    const pausal = pausalForm(last.ar);
    verses.push({ a, ar: last.ar, pausal, k2: k2of(pausal), k1: k1of(pausal) });
  }

  const families = familiesFrom(verses, "k2");
  const familiesCoarse = familiesFrom(verses, "k1");

  const shifts = [];
  for (let i = 1; i < verses.length; i++) {
    if (verses[i].k2 !== verses[i - 1].k2) shifts.push(verses[i].a);
  }

  const refrainMap = new Map();
  for (const v of verses) {
    if (!refrainMap.has(v.pausal)) refrainMap.set(v.pausal, []);
    refrainMap.get(v.pausal).push(v.a);
  }
  const refrains = [...refrainMap.entries()]
    .filter(([, vs]) => vs.length >= 3)
    .map(([pausal, vs]) => ({ pausal, count: vs.length, verses: vs }))
    .sort((x, y) => y.count - x.count || x.pausal.localeCompare(y.pausal));

  // Regularity index: mean run length = how many consecutive verses, on
  // average, share the same fine key before it shifts. A shift divides
  // the surah into (shifts.length + 1) runs; verses.length / runs is the
  // mean of those run lengths. Purely a function of the shift count
  // already computed above — no new source data, no new claim about
  // structure, just a single summary scalar for cross-surah comparison
  // (the per-surah view above only ever shows one surah at a time).
  const meanRunLength = verses.length
    ? Math.round((verses.length / (shifts.length + 1)) * 100) / 100
    : 0;

  const out = {
    _generated: "build-rhyme-map.mjs",
    _source: "leeds-corpus-v0.4",
    _method:
      "Verse-final word per verse, diacritics/tatweel stripped (drops " +
      "tanwin and short case vowels, approximating pausal form), final " +
      "ta marbuta -> ha, alif wasla -> alif. Fine key = last two letters " +
      "after collapsing hamza seats and word-final alif maqsura to alif; " +
      "coarse key = final letter. Orthographic proxy, not a phonological " +
      "transcription of recitation; rhyme shifts are mechanical " +
      "ending-pattern changes, not asserted structural boundaries. Mean " +
      "run length = verseCount / (shiftCount + 1): the average number of " +
      "consecutive verses sharing a fine key before it changes — higher " +
      "means a more sustained, regular rhyme scheme.",
    surah: s,
    verseCount: verses.length,
    verses,
    families,
    familiesCoarse,
    shifts,
    refrains,
    meanRunLength,
  };

  writeFileSync(
    join(ROOT, "data", "rhyme", `${s}.json`),
    JSON.stringify(out, null, 1) + "\n",
  );

  const dom = families[0] || { key: "", count: 0 };
  summary[s] = {
    verseCount: verses.length,
    familyCount: families.length,
    dominantKey: dom.key,
    dominantShare: verses.length
      ? Math.round((dom.count / verses.length) * 1000) / 1000
      : 0,
    shiftCount: shifts.length,
    topRefrain: refrains[0]
      ? { pausal: refrains[0].pausal, count: refrains[0].count }
      : null,
    meanRunLength,
  };
}

writeFileSync(
  join(ROOT, "data", "rhyme-summary.json"),
  JSON.stringify(
    {
      _generated: "build-rhyme-map.mjs",
      _source: "leeds-corpus-v0.4",
      _method:
        "Per-surah roll-up of data/rhyme/{n}.json: family count and " +
        "dominant fine-key share of verse endings, shift count, top " +
        "refrain, mean run length (verseCount / (shiftCount + 1), the " +
        "average consecutive-verse run before the rhyme changes — a " +
        "regularity index for comparing across surahs). See any " +
        "per-surah file for the full method note.",
      surahs: summary,
    },
    null,
    1,
  ) + "\n",
);

// Spot summary for the console
const s91 = summary[91];
const s55 = summary[55];
const s2 = summary[2];
console.log(
  `Surah 91: ${s91.familyCount} families, dominant "${s91.dominantKey}" share ${s91.dominantShare}`,
);
console.log(
  `Surah 55: top refrain ${s55.topRefrain ? `"${s55.topRefrain.pausal}" x${s55.topRefrain.count}` : "none"}`,
);
console.log(
  `Surah 2: dominant "${s2.dominantKey}" share ${s2.dominantShare}, ${s2.shiftCount} shifts, meanRunLength ${s2.meanRunLength}`,
);
console.log(
  `Surah 91 meanRunLength: ${s91.meanRunLength}; Surah 55 meanRunLength: ${s55.meanRunLength}`,
);
