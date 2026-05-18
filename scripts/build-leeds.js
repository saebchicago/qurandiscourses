#!/usr/bin/env node
//
// build-leeds.js — generates:
//   data/morphology/{1..114}.json   per-surah word-by-word morphology
//   data/roots-summary.json         per-root aggregated statistics
//   data/chronology.json            surah-to-period mapping
//
// Source: Leeds Quranic Arabic Corpus v0.4 (Kais Dukes, corpus.quran.com, GPL)
// Chronology: Egyptian Standard (Cairo 1924) revelation order, four-period
//   classification following Nöldeke-Bell tradition as documented in
//   Watt, "Bell's Introduction to the Qur'an" (1970).
//
"use strict";
const fs = require("fs");
const path = require("path");

// ── Buckwalter → Arabic Unicode ─────────────────────────────────────────────
const BW_MAP = {
  "'": "ء",
  "|": "آ",
  ">": "أ",
  "&": "ؤ",
  "<": "إ",
  "}": "ئ",
  A: "ا",
  b: "ب",
  p: "ة",
  t: "ت",
  v: "ث",
  j: "ج",
  H: "ح",
  x: "خ",
  d: "د",
  "*": "ذ",
  r: "ر",
  z: "ز",
  s: "س",
  $: "ش",
  S: "ص",
  D: "ض",
  T: "ط",
  Z: "ظ",
  E: "ع",
  g: "غ",
  _: "ـ",
  f: "ف",
  q: "ق",
  k: "ك",
  l: "ل",
  m: "م",
  n: "ن",
  h: "ه",
  w: "و",
  Y: "ى",
  y: "ي",
  F: "ً",
  N: "ٌ",
  K: "ٍ",
  a: "َ",
  u: "ُ",
  i: "ِ",
  "~": "ّ",
  o: "ْ",
  "`": "ٰ",
  "{": "ٱ",
};

function bwToAr(bw) {
  let out = "";
  for (const ch of bw) out += BW_MAP[ch] !== undefined ? BW_MAP[ch] : ch;
  return out;
}

// ── Buckwalter → phonetic Latin (for rootLatin) ──────────────────────────────
const BW_PHON = {
  A: "a",
  ">": "a",
  "<": "a",
  "|": "a",
  "&": "w",
  "}": "y",
  "'": "ʾ",
  b: "b",
  t: "t",
  v: "th",
  j: "j",
  H: "ḥ",
  x: "kh",
  d: "d",
  "*": "dh",
  r: "r",
  z: "z",
  s: "s",
  $: "sh",
  S: "ṣ",
  D: "ḍ",
  T: "ṭ",
  Z: "ẓ",
  E: "ʿ",
  g: "gh",
  f: "f",
  q: "q",
  k: "k",
  l: "l",
  m: "m",
  n: "n",
  h: "h",
  w: "w",
  y: "y",
  Y: "y",
  p: "t",
};

function rootToLatin(bwRoot) {
  return [...bwRoot].map((c) => BW_PHON[c] || c).join("-");
}

function rootToArabic(bwRoot) {
  return [...bwRoot].map((c) => BW_MAP[c] || c).join(" ");
}

// ── Chronology — Egyptian Standard (Cairo 1924) four-period classification ───
// period values: meccan-early | meccan-middle | meccan-late | medinan
// revelationOrder: position in the Egyptian Standard sequence (1–114)
const SURAH_NAMES = {
  1: "al-Fatihah",
  2: "al-Baqarah",
  3: "al-Imran",
  4: "an-Nisa",
  5: "al-Maidah",
  6: "al-Anam",
  7: "al-Araf",
  8: "al-Anfal",
  9: "at-Tawbah",
  10: "Yunus",
  11: "Hud",
  12: "Yusuf",
  13: "ar-Rad",
  14: "Ibrahim",
  15: "al-Hijr",
  16: "an-Nahl",
  17: "al-Isra",
  18: "al-Kahf",
  19: "Maryam",
  20: "Ta-Ha",
  21: "al-Anbiya",
  22: "al-Hajj",
  23: "al-Muminun",
  24: "an-Nur",
  25: "al-Furqan",
  26: "ash-Shuara",
  27: "an-Naml",
  28: "al-Qasas",
  29: "al-Ankabut",
  30: "ar-Rum",
  31: "Luqman",
  32: "as-Sajdah",
  33: "al-Ahzab",
  34: "Saba",
  35: "Fatir",
  36: "Ya-Sin",
  37: "as-Saffat",
  38: "Sad",
  39: "az-Zumar",
  40: "Ghafir",
  41: "Fussilat",
  42: "ash-Shura",
  43: "az-Zukhruf",
  44: "ad-Dukhan",
  45: "al-Jathiyah",
  46: "al-Ahqaf",
  47: "Muhammad",
  48: "al-Fath",
  49: "al-Hujurat",
  50: "Qaf",
  51: "adh-Dhariyat",
  52: "at-Tur",
  53: "an-Najm",
  54: "al-Qamar",
  55: "ar-Rahman",
  56: "al-Waqiah",
  57: "al-Hadid",
  58: "al-Mujadila",
  59: "al-Hashr",
  60: "al-Mumtahanah",
  61: "as-Saf",
  62: "al-Jumuah",
  63: "al-Munafiqun",
  64: "at-Taghabun",
  65: "at-Talaq",
  66: "at-Tahrim",
  67: "al-Mulk",
  68: "al-Qalam",
  69: "al-Haqqah",
  70: "al-Maarij",
  71: "Nuh",
  72: "al-Jinn",
  73: "al-Muzzammil",
  74: "al-Muddaththir",
  75: "al-Qiyamah",
  76: "al-Insan",
  77: "al-Mursalat",
  78: "an-Naba",
  79: "an-Naziat",
  80: "Abasa",
  81: "at-Takwir",
  82: "al-Infitar",
  83: "al-Mutaffifin",
  84: "al-Inshiqaq",
  85: "al-Buruj",
  86: "at-Tariq",
  87: "al-Ala",
  88: "al-Ghashiyah",
  89: "al-Fajr",
  90: "al-Balad",
  91: "ash-Shams",
  92: "al-Layl",
  93: "ad-Duha",
  94: "ash-Sharh",
  95: "at-Tin",
  96: "al-Alaq",
  97: "al-Qadr",
  98: "al-Bayyinah",
  99: "az-Zalzalah",
  100: "al-Adiyat",
  101: "al-Qariah",
  102: "at-Takathur",
  103: "al-Asr",
  104: "al-Humaza",
  105: "al-Fil",
  106: "Quraysh",
  107: "al-Maun",
  108: "al-Kawthar",
  109: "al-Kafirun",
  110: "an-Nasr",
  111: "al-Masad",
  112: "al-Ikhlas",
  113: "al-Falaq",
  114: "an-Nas",
};

// Revelation order → { surah, period }
// meccan-early: rev 1–33 | meccan-middle: rev 34–49
// meccan-late: rev 50–86 | medinan: rev 87–114
const REV_ORDER = [
  // Egyptian Standard sequence (position = revelation order index, 1-based)
  96,
  68,
  73,
  74,
  1,
  111,
  81,
  87,
  92,
  89, // 1–10
  93,
  94,
  103,
  100,
  108,
  102,
  107,
  109,
  105,
  113, // 11–20
  114,
  112,
  53,
  80,
  97,
  91,
  85,
  95,
  106,
  101, // 21–30
  75,
  104,
  77,
  50,
  90,
  86,
  54,
  38,
  7,
  72, // 31–40
  36,
  25,
  35,
  19,
  20,
  56,
  26,
  27,
  28,
  17, // 41–50
  10,
  11,
  12,
  15,
  6,
  37,
  31,
  34,
  39,
  40, // 51–60
  41,
  42,
  43,
  44,
  45,
  46,
  51,
  88,
  18,
  16, // 61–70
  71,
  14,
  21,
  23,
  32,
  52,
  67,
  69,
  70,
  78, // 71–80
  79,
  82,
  84,
  30,
  29,
  83,
  2,
  8,
  3,
  33, // 81–90
  60,
  4,
  99,
  57,
  47,
  13,
  55,
  76,
  65,
  98, // 91–100
  59,
  24,
  22,
  63,
  58,
  49,
  66,
  64,
  61,
  62, // 101–110
  48,
  5,
  9,
  110, // 111–114
];

function getPeriod(revOrder) {
  if (revOrder <= 33) return "meccan-early";
  if (revOrder <= 49) return "meccan-middle";
  if (revOrder <= 86) return "meccan-late";
  return "medinan";
}

const CHRONOLOGY = {};
REV_ORDER.forEach((surah, idx) => {
  const rev = idx + 1;
  CHRONOLOGY[surah] = {
    name: SURAH_NAMES[surah],
    period: getPeriod(rev),
    revelationOrder: rev,
  };
});

// ── Paths ────────────────────────────────────────────────────────────────────
const rawPath = path.join(__dirname, "leeds-raw.txt");
const outDir = path.join(__dirname, "..", "data", "morphology");
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(outDir, { recursive: true });

// ── Parse Leeds raw file ─────────────────────────────────────────────────────
const lines = fs.readFileSync(rawPath, "utf8").split(/\r?\n/);

// chapters[ch][vs][wd] = { segs:[{seg,form},...], stem:{root,lemma,pos}|null }
const chapters = {};

for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const cols = t.split("\t");
  if (cols.length < 4) continue;

  const locMatch = cols[0].match(/\((\d+):(\d+):(\d+):(\d+)\)/);
  if (!locMatch) continue;

  const ch = +locMatch[1];
  const vs = +locMatch[2];
  const wd = +locMatch[3];
  const seg = +locMatch[4];
  const form = cols[1];
  const tag = cols[2];
  const features = cols[3];

  if (!chapters[ch]) chapters[ch] = {};
  if (!chapters[ch][vs]) chapters[ch][vs] = {};
  if (!chapters[ch][vs][wd]) chapters[ch][vs][wd] = { segs: [], stem: null };

  chapters[ch][vs][wd].segs.push({ seg, form });

  if (features.startsWith("STEM|") && !chapters[ch][vs][wd].stem) {
    const fp = features.split("|");
    let root = "",
      lemma = "",
      pos = tag;
    for (const f of fp) {
      if (f.startsWith("ROOT:")) root = f.slice(5);
      else if (f.startsWith("LEM:")) lemma = f.slice(4);
      else if (f.startsWith("POS:")) pos = f.slice(4);
    }
    chapters[ch][vs][wd].stem = { root, lemma, pos };
  }
}

// ── Root aggregation structures ───────────────────────────────────────────────
const roots = {}; // root → { totalCount, lemmas, lemmaFirst, pos, byChron, surahs, first }

function ensureRoot(r) {
  if (!roots[r])
    roots[r] = {
      totalCount: 0,
      lemmas: {},
      lemmaFirst: {}, // lemma → { surah, verse }
      pos: {},
      byChron: {
        "meccan-early": 0,
        "meccan-middle": 0,
        "meccan-late": 0,
        medinan: 0,
      },
      surahs: {},
      first: null,
    };
}

// ── Write morphology files + accumulate root stats ───────────────────────────
let totalVerses = 0,
  totalWords = 0,
  totalBytes = 0;
let largestFile = { surah: 0, size: 0 };

for (let c = 1; c <= 114; c++) {
  if (!chapters[c]) {
    fs.writeFileSync(path.join(outDir, `${c}.json`), "{}", "utf8");
    continue;
  }

  const surahData = {};
  const surahChron = CHRONOLOGY[c];
  const period = surahChron ? surahChron.period : null;

  const verseNums = Object.keys(chapters[c])
    .map(Number)
    .sort((a, b) => a - b);
  for (const vs of verseNums) {
    totalVerses++;
    const wordNums = Object.keys(chapters[c][vs])
      .map(Number)
      .sort((a, b) => a - b);
    const verseWords = [];

    for (const wd of wordNums) {
      totalWords++;
      const { segs, stem } = chapters[c][vs][wd];
      segs.sort((a, b) => a.seg - b.seg);
      const bwFull = segs.map((s) => s.form).join("");
      const ar = bwToAr(bwFull);
      const root = stem ? stem.root : "";
      const lemma = stem ? stem.lemma : "";
      const pos = stem ? stem.pos : "";

      verseWords.push({ w: wd, ar, root, lemma, pos, gloss: "" });

      // Accumulate root stats
      if (root) {
        ensureRoot(root);
        const rd = roots[root];
        rd.totalCount++;
        if (lemma) {
          rd.lemmas[lemma] = (rd.lemmas[lemma] || 0) + 1;
          if (!rd.lemmaFirst[lemma])
            rd.lemmaFirst[lemma] = { surah: c, verse: vs };
        }
        if (pos) rd.pos[pos] = (rd.pos[pos] || 0) + 1;
        if (period) rd.byChron[period] = (rd.byChron[period] || 0) + 1;
        rd.surahs[c] = (rd.surahs[c] || 0) + 1;
        if (!rd.first) rd.first = { surah: c, verse: vs };
      }
    }
    surahData[String(vs)] = verseWords;
  }

  const json = JSON.stringify(surahData, null, 2);
  const outPath = path.join(outDir, `${c}.json`);
  fs.writeFileSync(outPath, json, "utf8");

  const size = Buffer.byteLength(json, "utf8");
  totalBytes += size;
  if (size > largestFile.size) largestFile = { surah: c, size };
}

// ── Write chronology.json ────────────────────────────────────────────────────
const chronOut = {};
for (let s = 1; s <= 114; s++) {
  const c = CHRONOLOGY[s];
  if (c)
    chronOut[String(s)] = {
      name: c.name,
      period: c.period,
      revelationOrder: c.revelationOrder,
    };
}
fs.writeFileSync(
  path.join(dataDir, "chronology.json"),
  JSON.stringify(chronOut, null, 2),
  "utf8",
);

// ── Write roots-summary.json ─────────────────────────────────────────────────
const rootsSummary = {};
for (const [rootBW, rd] of Object.entries(roots)) {
  const topLemmas = Object.entries(rd.lemmas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lemma, count]) => ({
      lemma,
      lemmaArabic: bwToAr(lemma),
      count,
      firstOccurrence: rd.lemmaFirst[lemma] || null,
    }));

  const topSurahs = Object.entries(rd.surahs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s, count]) => ({ surah: +s, name: SURAH_NAMES[+s] || "", count }));

  rootsSummary[rootBW] = {
    rootBuckwalter: rootBW,
    rootLatin: rootToLatin(rootBW),
    rootArabic: rootToArabic(rootBW),
    totalCount: rd.totalCount,
    topLemmas,
    posDistribution: rd.pos,
    byChronology: rd.byChron,
    topSurahs,
    firstOccurrence: rd.first,
  };
}
fs.writeFileSync(
  path.join(dataDir, "roots-summary.json"),
  JSON.stringify(rootsSummary, null, 2),
  "utf8",
);

// ── Summary ──────────────────────────────────────────────────────────────────
const avgKB = (totalBytes / 114 / 1024).toFixed(1);
const rootsSize = (
  fs.statSync(path.join(dataDir, "roots-summary.json")).size / 1024
).toFixed(1);
const uniqueRoots = Object.keys(rootsSummary).length;
const top5 = Object.entries(rootsSummary)
  .sort((a, b) => b[1].totalCount - a[1].totalCount)
  .slice(0, 5);

console.log(`Total verses covered  : ${totalVerses}`);
console.log(`Total words processed : ${totalWords}`);
console.log(`Total unique roots    : ${uniqueRoots}`);
console.log(
  `Words with empty gloss: ${totalWords} (all — no glosses in source file)`,
);
console.log(`Avg morphology file   : ${avgKB} KB`);
console.log(
  `Largest morph file    : surah ${largestFile.surah} (${(largestFile.size / 1024).toFixed(1)} KB)`,
);
console.log(`roots-summary.json    : ${rootsSize} KB`);
console.log(`Top 5 roots by count:`);
for (const [bw, rd] of top5) {
  console.log(
    `  ${bw.padEnd(8)} ${rd.rootLatin.padEnd(10)} ${String(rd.totalCount).padStart(5)}`,
  );
}
