#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

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

const rawPath = path.join(__dirname, "leeds-raw.txt");
const outDir = path.join(__dirname, "..", "data", "morphology");
fs.mkdirSync(outDir, { recursive: true });

const lines = fs.readFileSync(rawPath, "utf8").split(/\r?\n/);

// chapters[ch][vs][wd] = { segs: [{seg,form},...], stem: {root,lemma,pos}|null }
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

let totalVerses = 0;
let totalWords = 0;
let totalBytes = 0;
let largestFile = { surah: 0, size: 0 };

for (let c = 1; c <= 114; c++) {
  if (!chapters[c]) {
    fs.writeFileSync(path.join(outDir, `${c}.json`), "{}", "utf8");
    continue;
  }

  const surahData = {};
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
      verseWords.push({
        w: wd,
        ar,
        root: stem ? stem.root : "",
        lemma: stem ? stem.lemma : "",
        pos: stem ? stem.pos : "",
        gloss: "",
      });
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

const avgKB = (totalBytes / 114 / 1024).toFixed(1);
console.log(`Total verses covered : ${totalVerses}`);
console.log(`Total words processed: ${totalWords}`);
console.log(
  `Words with empty gloss: ${totalWords} (all — no glosses in source file)`,
);
console.log(`Average file size    : ${avgKB} KB`);
console.log(
  `Largest file         : surah ${largestFile.surah} (${(largestFile.size / 1024).toFixed(1)} KB)`,
);
