#!/usr/bin/env node
//
// build-surah-meta.mjs — generate data/surah-meta.json with Makki/Madani
// classification for all 114 surahs.
//
// Primary source: Quran.com Foundation Content API v4, /chapters endpoint.
// Fallback (if API unreachable): chronology.json + Nöldeke-Bell period mapping
//   (meccan-early/middle/late → makki, medinan → madani).
//
// The source used is recorded in the output file's _source field.
//

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");

async function fetchChaptersFromApi() {
  const url = "https://api.quran.com/api/v4/chapters?language=en";
  console.log(`  Fetching ${url} …`);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildFromChronology() {
  const chronology = JSON.parse(readFileSync(join(DATA, "chronology.json"), "utf8"));
  const result = {};
  for (const [num, s] of Object.entries(chronology)) {
    const period = s.period || "";
    const classification = period.startsWith("meccan") ? "makki" : period === "medinan" ? "madani" : "unclassified";
    result[num] = {
      surah: Number(num),
      name: s.name,
      revelationOrder: s.revelationOrder,
      classification,
      period,
    };
  }
  return { entries: result, source: "chronology.json (Leeds Quranic Arabic Corpus v0.4 + Egyptian Standard revelation order, Nöldeke-Bell classification)" };
}

async function main() {
  let entries = {};
  let sourceStr = "";

  try {
    console.log("Trying Quran.com API v4…");
    const apiData = await fetchChaptersFromApi();
    const chapters = apiData.chapters || [];
    if (!chapters.length) throw new Error("Empty chapters array");

    for (const ch of chapters) {
      const num = String(ch.id);
      const classification = ch.revelation_place === "makkah" ? "makki" : ch.revelation_place === "madinah" ? "madani" : "unclassified (source unavailable)";
      entries[num] = {
        surah: ch.id,
        name: ch.name_simple,
        nameArabic: ch.name_arabic,
        revelationOrder: ch.revelation_order,
        classification,
        revelationPlace: ch.revelation_place,
        versesCount: ch.verses_count,
      };
    }

    sourceStr = "Quran.com Foundation Content API v4, /chapters endpoint, accessed " + new Date().toISOString().slice(0, 10);
    console.log(`  API succeeded: ${Object.keys(entries).length} chapters`);
  } catch (err) {
    console.warn(`  API failed (${err.message}); falling back to chronology.json`);
    const fallback = buildFromChronology();
    entries = fallback.entries;
    sourceStr = fallback.source;
  }

  // Validate: 114 entries required
  const count = Object.keys(entries).length;
  if (count !== 114) {
    console.error(`ERROR: expected 114 entries, got ${count}`);
    process.exit(1);
  }

  // Mark any missing classifications explicitly
  for (const [num, e] of Object.entries(entries)) {
    if (!e.classification) {
      e.classification = "unclassified (source unavailable)";
      console.warn(`  Surah ${num}: classification missing, marked unclassified`);
    }
  }

  const output = {
    _source: sourceStr,
    _generated: new Date().toISOString().slice(0, 10),
    _note: "Classification: 'makki' = revealed before the Hijra (622 CE); 'madani' = revealed after. Where a surah has mixed opinions in tradition, the predominant classification in the source is used.",
    surahs: entries,
  };

  const outPath = join(DATA, "surah-meta.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${outPath}`);

  // Spot-check
  console.log("\nSpot-check:");
  for (const n of [1, 2, 3, 96, 114]) {
    const e = entries[String(n)];
    console.log(`  Surah ${n} (${e?.name}): ${e?.classification}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
