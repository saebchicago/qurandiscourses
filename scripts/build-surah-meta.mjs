#!/usr/bin/env node
//
// build-surah-meta.mjs — generate data/surah-meta.json with Makki/Madani
// classification, verse counts and names for all 114 surahs.
//
// Built offline from files this repository already ships, so no
// third-party API content is redistributed:
//   - data/quran-text/<n>.json   revelationType and numberOfAyahs: the
//     bundled Tanzil text's surah metadata, as served by alquran.cloud
//     (see scripts/build-quran-text.mjs)
//   - data/chronology.json       revelation order (Cairo 1924)
//   - data/surah-names.json      transliteration and Arabic display name
//
// Until October 2026 this file came from the Quran.com Foundation Content
// API v4 /chapters endpoint. Before switching, all 114 revelation places,
// verse counts and revelation orders were compared against that output
// and matched exactly; only the name spellings changed, to the curated
// forms in surah-names.json.
//
// --check: exit 1 if data/surah-meta.json differs from a fresh build
// (ignoring the _generated date).
//

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { computedDate } from "./lib/computed-date.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const OUT = join(DATA, "surah-meta.json");
const CHECK = process.argv.includes("--check");

const readJson = (p) => JSON.parse(readFileSync(join(DATA, p), "utf8"));

const SOURCE =
  "Bundled Tanzil text metadata via alquran.cloud (data/quran-text/: revelationType, numberOfAyahs); " +
  "revelation order from Cairo 1924 (data/chronology.json); names from data/surah-names.json";

const PLACE = { Meccan: "makkah", Medinan: "madinah" };
const CLASS = { makkah: "makki", madinah: "madani" };

function build() {
  const chronology = readJson("chronology.json");
  const names = readJson("surah-names.json");
  const surahs = {};
  for (let n = 1; n <= 114; n++) {
    const k = String(n);
    const text = readJson(`quran-text/${k}.json`);
    const c = chronology[k];
    const nm = names[k];
    if (!c || !nm) throw new Error(`Surah ${n}: missing in chronology.json or surah-names.json`);
    const revelationPlace = PLACE[text.revelationType];
    if (!revelationPlace) throw new Error(`Surah ${n}: unknown revelationType "${text.revelationType}"`);
    if (!Number.isInteger(text.numberOfAyahs) || text.numberOfAyahs < 3)
      throw new Error(`Surah ${n}: bad numberOfAyahs ${text.numberOfAyahs}`);
    surahs[k] = {
      surah: n,
      name: nm.translit,
      nameArabic: nm.ar,
      revelationOrder: c.revelationOrder,
      classification: CLASS[revelationPlace],
      revelationPlace,
      versesCount: text.numberOfAyahs,
    };
  }
  return {
    _source: SOURCE,
    _generated: computedDate(),
    _note:
      "Classification: 'makki' = revealed before the Hijra (622 CE); 'madani' = revealed after. Where a surah has mixed opinions in tradition, the predominant classification in the source is used.",
    surahs,
  };
}

const output = build();
const body = JSON.stringify(output, null, 2);

if (CHECK) {
  const strip = (s) => s.replace(/"_generated": "[^"]*"/, "");
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {}
  if (strip(current) !== strip(body)) {
    console.error("build-surah-meta --check: FAIL — data/surah-meta.json is stale.\n  Run: node scripts/build-surah-meta.mjs");
    process.exit(1);
  }
  console.log("build-surah-meta --check: OK (114 surahs)");
} else {
  writeFileSync(OUT, body);
  console.log(`Wrote ${OUT} (114 surahs)`);
}
