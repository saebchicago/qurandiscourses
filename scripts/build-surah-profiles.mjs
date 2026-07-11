#!/usr/bin/env node
//
// build-surah-profiles.mjs — generate data/surah-profiles.json, a per-surah
// analytics fingerprint: verse count, word-token count, distinct root count,
// root diversity ratio, top 10 roots by frequency, chronology period, and
// QurSim cross-reference connectivity.
//
// Sources (all local, already-committed data; no network access):
//   data/morphology/{1..114}.json — Leeds Quranic Arabic Corpus v0.4 tokens
//   data/roots-summary.json       — Buckwalter root -> Latin/Arabic lookup
//   data/chronology.json          — Egyptian Standard (Cairo 1924) order
//   data/qursim/{n}.json          — Mishkat cross-reference data (110/114)
//
// Counting rules (see method disclosure in navigate.html for the reader-
// facing version of these same rules):
//   - Verse count: number of verse keys in the surah's morphology file.
//   - Word-token count: total token entries across all verses in the
//     surah's morphology file (Uthmani tokenization as segmented by Leeds).
//   - Distinct root count: number of unique non-empty `root` values among
//     that surah's tokens.
//   - Root diversity ratio: distinct root count / word-token count. The
//     denominator is ALL tokens, including function words with no tagged
//     root, not just rooted tokens.
//   - Top 10 roots: per-surah frequency tally of the `root` field, sorted
//     descending, ties broken by first appearance order.
//   - Chronology period: chronology.json's period field (Cairo 1924
//     Meccan/Medinan + four-period classification).
//   - QurSim connectivity: count of distinct OTHER surahs appearing as a
//     cross-reference target in data/qursim/{n}.json (self-references to
//     the same surah are excluded, since they are intra-surah, not
//     cross-surah, connections). null when the surah has no qursim file
//     (104, 105, 106, 110 are not covered).
//
// To reproduce: node scripts/build-surah-profiles.mjs
//

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");

const chronology = JSON.parse(
  readFileSync(join(DATA, "chronology.json"), "utf8"),
);
const rootsSummary = JSON.parse(
  readFileSync(join(DATA, "roots-summary.json"), "utf8"),
);

function buildProfile(surahNum) {
  const morph = JSON.parse(
    readFileSync(join(DATA, "morphology", `${surahNum}.json`), "utf8"),
  );

  const verseCount = Object.keys(morph).length;
  let tokenCount = 0;
  const rootFreq = new Map();
  // Grammatical texture: exact counts of the two unambiguous single POS
  // tags (N nouns, V verbs) and prepositions (P). "other" is the residual
  // (all remaining function/particle tags), so no family taxonomy is
  // asserted — every figure is a plain Leeds POS tally.
  let posN = 0;
  let posV = 0;
  let posP = 0;

  for (const words of Object.values(morph)) {
    for (const word of words) {
      tokenCount++;
      const root = word.root;
      if (root) {
        rootFreq.set(root, (rootFreq.get(root) || 0) + 1);
      }
      if (word.pos === "N") posN++;
      else if (word.pos === "V") posV++;
      else if (word.pos === "P") posP++;
    }
  }

  const posMix = {
    total: tokenCount,
    nouns: posN,
    verbs: posV,
    prepositions: posP,
    other: tokenCount - posN - posV - posP,
    nounPct: tokenCount ? Math.round((posN / tokenCount) * 1000) / 10 : 0,
    verbPct: tokenCount ? Math.round((posV / tokenCount) * 1000) / 10 : 0,
  };

  const distinctRootCount = rootFreq.size;
  const rootDiversityRatio =
    tokenCount > 0
      ? Math.round((distinctRootCount / tokenCount) * 10000) / 10000
      : 0;

  const topRoots = [...rootFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([root, count]) => {
      const info = rootsSummary[root];
      return {
        root,
        rootLatin: info ? info.rootLatin : root,
        rootArabic: info ? info.rootArabic : "",
        count,
      };
    });

  const chronologyPeriod = chronology[String(surahNum)]?.period || null;

  const qursimPath = join(DATA, "qursim", `${surahNum}.json`);
  let qursimConnectivity = null;
  if (existsSync(qursimPath)) {
    const xrefs = JSON.parse(readFileSync(qursimPath, "utf8"));
    const linked = new Set();
    for (const refs of Object.values(xrefs)) {
      for (const ref of refs) {
        if (ref.s !== surahNum) linked.add(ref.s);
      }
    }
    qursimConnectivity = linked.size;
  }

  return {
    surah: surahNum,
    verseCount,
    tokenCount,
    distinctRootCount,
    rootDiversityRatio,
    topRoots,
    posMix,
    chronologyPeriod,
    qursimConnectivity,
  };
}

function main() {
  const surahs = {};
  for (let s = 1; s <= 114; s++) {
    surahs[String(s)] = buildProfile(s);
  }

  const count = Object.keys(surahs).length;
  if (count !== 114) {
    console.error(`ERROR: expected 114 entries, got ${count}`);
    process.exit(1);
  }

  const noQursim = Object.values(surahs)
    .filter((p) => p.qursimConnectivity === null)
    .map((p) => p.surah);
  const expectedNoQursim = [104, 105, 106, 110];
  const matches =
    noQursim.length === expectedNoQursim.length &&
    noQursim.every((s, i) => s === expectedNoQursim[i]);
  if (!matches) {
    console.error(
      `ERROR: expected null qursimConnectivity for [${expectedNoQursim.join(", ")}], got [${noQursim.join(", ")}]`,
    );
    process.exit(1);
  }

  const output = {
    _source:
      "Leeds Quranic Arabic Corpus v0.4 (morphology/roots); chronology.json (Egyptian Standard, Cairo 1924); data/qursim (Mishkat cross-reference index, 110/114 surahs)",
    _generated: new Date().toISOString().slice(0, 10),
    _note:
      "Descriptive corpus statistics only. Root diversity ratio divides distinct roots by all word-tokens, including function words with no tagged root. QurSim connectivity counts distinct other surahs cross-referenced; null means the surah is outside current QurSim/Mishkat coverage (104, 105, 106, 110), not zero connections.",
    surahs,
  };

  const outPath = join(DATA, "surah-profiles.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath}`);

  console.log("\nSpot-check:");
  for (const n of [2, 103, 110, 104]) {
    const p = surahs[String(n)];
    console.log(
      `  Surah ${n}: verses=${p.verseCount} tokens=${p.tokenCount} distinctRoots=${p.distinctRootCount} ratio=${p.rootDiversityRatio} period=${p.chronologyPeriod} qursim=${p.qursimConnectivity} topRoot=${p.topRoots[0]?.root || "n/a"}(${p.topRoots[0]?.count || 0})`,
    );
  }
}

main();
