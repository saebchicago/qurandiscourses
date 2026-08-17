#!/usr/bin/env node
//
// build-root-analytics.mjs — generate per-root analytics JSON from Leeds data.
//
// Source: Leeds Quranic Arabic Corpus v0.4 (Kais Dukes, corpus.quran.com, GPL)
// Chronology: Egyptian Standard (Cairo 1924) revelation order.
//
// Output: data/root-analytics/{safeKey}.json (one file per root, ~1,642 files)
//
// Computation method:
//   - Pass 1: scan all 114 morphology files, recording every token by root
//   - Pass 2: build co-occurrence counts (roots sharing the same verse)
//   - Pass 3: write per-root JSON files sharded by Buckwalter key
//
// To reproduce: node scripts/build-root-analytics.mjs
//

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { safeKey } from "./lib/safe-key.mjs";
import { computedDate } from "./lib/computed-date.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const OUT = join(DATA, "root-analytics");

mkdirSync(OUT, { recursive: true });

// Buckwalter encoding is case-sensitive but macOS filesystems are case-insensitive.
// Scheme: uppercase BW letters get a 'u' prefix (e.g. H→uH, E→uE), preserving
// case distinctness without relying on filesystem case-sensitivity.
// * (ذ) → dh, $ (ش) → sh. No BW root contains lowercase 'u'.
// (Imported from the shared lib so every generator uses one mapping.)

const chronology = JSON.parse(readFileSync(join(DATA, "chronology.json"), "utf8"));
const rootsSummary = JSON.parse(readFileSync(join(DATA, "roots-summary.json"), "utf8"));

// Determine Makki / Madani from period field (all Meccan variants → makki)
function isMakki(surahNum) {
  const p = chronology[String(surahNum)]?.period || "";
  return p.startsWith("meccan");
}

console.log("Pass 1: scanning morphology files…");

// rootTokens[bw] = [{surah, verse, form, pos}]
const rootTokens = {};
// verseRoots["s:v"] = Set<bw>
const verseRoots = {};

for (let s = 1; s <= 114; s++) {
  const path = join(DATA, "morphology", `${s}.json`);
  if (!existsSync(path)) {
    // Fail rather than skip. Twenty of the twenty-two morphology loaders
    // throw here; these two warned and continued, which produces a
    // complete-looking dataset computed over less than the corpus — every
    // per-root figure quietly low, with an exit code of 0.
    throw new Error(
      `data/morphology/${s}.json is missing. Refusing to write a partial ` +
        "dataset: every figure here is computed over the whole corpus.",
    );
  }
  const morph = JSON.parse(readFileSync(path, "utf8"));
  for (const [v, words] of Object.entries(morph)) {
    const ref = `${s}:${v}`;
    for (const w of words) {
      const bw = w.root;
      if (!bw) continue;

      if (!rootTokens[bw]) rootTokens[bw] = [];
      rootTokens[bw].push({ surah: s, verse: Number(v), ref, form: w.ar, pos: w.pos, lemma: w.lemma });

      if (!verseRoots[ref]) verseRoots[ref] = new Set();
      verseRoots[ref].add(bw);
    }
  }
}

const rootsFound = Object.keys(rootTokens).length;
const totalTokens = Object.values(rootTokens).reduce((n, a) => n + a.length, 0);
console.log(`  Roots found: ${rootsFound}  (expected ~1,642)`);
console.log(`  Rooted tokens: ${totalTokens}`);

// Sanity check against roots-summary for 3 known roots
const SANITY = ["rHm", "ktb", "qwl"];
console.log("\nSanity check (computed vs roots-summary):");
for (const bw of SANITY) {
  const computed = (rootTokens[bw] || []).length;
  const summary = rootsSummary[bw]?.totalCount ?? "N/A";
  const arabic = rootsSummary[bw]?.rootArabic ?? bw;
  const match = computed === summary ? "✓" : "✗";
  console.log(`  ${arabic} (${bw}): computed=${computed}, summary=${summary} ${match}`);
}

console.log("\nPass 2: building co-occurrence counts…");

// coOcc[bw][otherBw] = count of verses they share
const coOcc = {};
for (const [ref, roots] of Object.entries(verseRoots)) {
  const arr = [...roots];
  for (const r1 of arr) {
    if (!coOcc[r1]) coOcc[r1] = {};
    for (const r2 of arr) {
      if (r1 !== r2) {
        coOcc[r1][r2] = (coOcc[r1][r2] || 0) + 1;
      }
    }
  }
}

console.log("\nPass 3: writing root analytics files…");

let written = 0;
const COMPUTED_DATE = computedDate();

for (const [bw, meta] of Object.entries(rootsSummary)) {
  const tokens = rootTokens[bw] || [];
  if (tokens.length === 0) continue;

  // Per-surah occurrence counts
  const bySurah = {};
  for (const t of tokens) {
    bySurah[t.surah] = (bySurah[t.surah] || 0) + 1;
  }

  // Makki / Madani split
  let makki = 0;
  let madani = 0;
  for (const [surahStr, count] of Object.entries(bySurah)) {
    if (isMakki(Number(surahStr))) makki += count;
    else madani += count;
  }

  // Derived forms: group by (form, pos)
  const formMap = {};
  for (const t of tokens) {
    const key = `${t.form}|${t.pos}`;
    if (!formMap[key]) formMap[key] = { form: t.form, pos: t.pos, count: 0, verses: [] };
    formMap[key].count++;
    formMap[key].verses.push(t.ref);
  }
  const derivedForms = Object.values(formMap).sort((a, b) => b.count - a.count);

  // Lemma families: the derivational level between root and surface form.
  // Group by (lemma, pos) — every root-bearing token carries a lemma in
  // Leeds v0.4 (verified 100% coverage), so nothing is dropped. Each
  // family lists its most frequent surface forms (top 5) and sample
  // verse refs (first 10 in mushaf order).
  const lemmaMap = {};
  for (const t of tokens) {
    const key = `${t.lemma}|${t.pos}`;
    if (!lemmaMap[key]) {
      lemmaMap[key] = { lemma: t.lemma, pos: t.pos, count: 0, formCounts: {}, verses: [] };
    }
    const fam = lemmaMap[key];
    fam.count++;
    fam.formCounts[t.form] = (fam.formCounts[t.form] || 0) + 1;
    if (fam.verses.length < 10 && !fam.verses.includes(t.ref)) fam.verses.push(t.ref);
  }
  const lemmaFamilies = Object.values(lemmaMap)
    .map((f) => ({
      lemma: f.lemma,
      pos: f.pos,
      count: f.count,
      forms: Object.entries(f.formCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([form, count]) => ({ form, count })),
      verses: f.verses,
    }))
    .sort((a, b) => b.count - a.count || a.lemma.localeCompare(b.lemma));

  // Full verse list (unique, sorted)
  const verseSet = new Set(tokens.map((t) => t.ref));
  const verses = [...verseSet].sort((a, b) => {
    const [as, av] = a.split(":").map(Number);
    const [bs, bv] = b.split(":").map(Number);
    return as !== bs ? as - bs : av - bv;
  });

  // Co-occurring roots: top 10 by count
  const coMap = coOcc[bw] || {};
  const coRoots = Object.entries(coMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([r, count]) => ({
      root: r,
      safeKey: safeKey(r),
      arabic: rootsSummary[r]?.rootArabic || "",
      rootLatin: rootsSummary[r]?.rootLatin || r,
      count,
    }));

  const output = {
    bw,
    safeKey: safeKey(bw),
    arabic: meta.rootArabic,
    rootLatin: meta.rootLatin,
    totalOccurrences: tokens.length,
    makki,
    madani,
    bySurah,
    derivedForms,
    lemmaFamilies,
    coRoots,
    verses,
    _source: "Leeds Quranic Arabic Corpus v0.4 (Kais Dukes, corpus.quran.com, GPL)",
    _method:
      "Tokenized all 77,429 morphological entries across 114 morphology files; grouped by root field (Buckwalter); co-occurrence counted per-verse; lemma families grouped by (lemma, pos) — the derivational level between root and surface form.",
    _computed: COMPUTED_DATE,
  };

  const filename = safeKey(bw) + ".json";
  writeFileSync(join(OUT, filename), JSON.stringify(output));
  written++;

  if (written % 200 === 0) console.log(`  ${written} files written…`);
}

console.log(`\nDone. Wrote ${written} root analytics files to data/root-analytics/`);
