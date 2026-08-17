// check-exercises.mjs — integrity guard for the exercise registry
// (data/exercises.json / exercise.html / exercise-roots.html / exercises.html).
// Mirrors check-claims.mjs and check-videos.mjs: it does not judge whether an
// outline is a good reading, only that every entry stays source-traceable and
// the registry stays internally consistent.
//
// Asserts:
//   1. every entry has a unique, non-empty id and a known type
//      (outline | roots)
//   2. outline entries: surah is a valid 1-114 surah number, sourceIds
//      resolve in data/sources.json, provenanceHtml cites sources.html,
//      and the outline array is non-empty with strictly increasing
//      startVerse values that stay within the surah's verse count
//      (data/surah-meta.json)
//   3. at most one outline entry per surah (the maintainer guide's "one
//      entry per surah" rule — consumers look up by surah and take the
//      first, so a second entry would silently never be reached)
//   4. roots entries: href points at a file that exists, surahs are valid
//      1-114 numbers with no duplicates
//   5. index.html's hand-kept EXERCISE_COUNT matches the registry length
//
// Run: node scripts/check-exercises.mjs   (exit 1 on any failure)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readJson } from "./lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const registry = readJson("data/exercises.json");
const exercises = registry.exercises || [];
const sourceIds = new Set((readJson("data/sources.json").sources || []).map((s) => s.id));
const surahMeta = readJson("data/surah-meta.json").surahs || {};

const failures = [];
const seenIds = new Set();
const seenOutlineSurahs = new Map();

for (const ex of exercises) {
  const label = ex.id || "<missing id>";
  if (!ex.id || typeof ex.id !== "string") failures.push(`${label}: missing or invalid id`);
  if (seenIds.has(ex.id)) failures.push(`${label}: duplicate id`);
  seenIds.add(ex.id);

  if (!["outline", "roots"].includes(ex.type)) {
    failures.push(`${label}: unknown type "${ex.type}" (expected outline|roots)`);
    continue;
  }

  if (ex.type === "outline") {
    const meta = surahMeta[String(ex.surah)];
    if (!Number.isInteger(ex.surah) || ex.surah < 1 || ex.surah > 114) {
      failures.push(`${label}: surah must be an integer 1-114`);
    } else if (!meta) {
      failures.push(`${label}: surah ${ex.surah} not found in data/surah-meta.json`);
    }
    for (const field of ["surahName", "title", "tileName", "tileDesc", "provenanceHtml"]) {
      if (!ex[field] || typeof ex[field] !== "string") failures.push(`${label}: missing ${field}`);
    }
    if (!ex.provenanceHtml?.includes('href="sources.html"')) {
      failures.push(`${label}: provenanceHtml must link to sources.html`);
    }

    const ids = (ex.sourceIds || "").split(/\s+/).filter(Boolean);
    if (!ids.length) failures.push(`${label}: sourceIds must be a non-empty space-separated string`);
    for (const id of ids) if (!sourceIds.has(id)) failures.push(`${label}: unknown source id ${id}`);

    if (!Array.isArray(ex.outline) || !ex.outline.length) {
      failures.push(`${label}: outline must be a non-empty array`);
    } else {
      let prevVerse = 0;
      ex.outline.forEach((item, i) => {
        const itemLabel = `${label}: outline[${i}]`;
        if (!Number.isInteger(item.startVerse) || item.startVerse < 1) {
          failures.push(`${itemLabel}: startVerse must be a positive integer`);
        } else {
          if (item.startVerse <= prevVerse) failures.push(`${itemLabel}: startVerse must strictly increase`);
          if (meta && item.startVerse > meta.versesCount) {
            failures.push(`${itemLabel}: startVerse ${item.startVerse} exceeds surah ${ex.surah}'s ${meta.versesCount} verses`);
          }
          prevVerse = item.startVerse;
        }
        if (!item.heading || typeof item.heading !== "string") failures.push(`${itemLabel}: missing heading`);
        if (!item.note || typeof item.note !== "string") failures.push(`${itemLabel}: missing note`);
      });
    }

    if (Number.isInteger(ex.surah)) {
      if (seenOutlineSurahs.has(ex.surah)) {
        failures.push(`${label}: surah ${ex.surah} already has outline entry ${seenOutlineSurahs.get(ex.surah)} — one entry per surah`);
      } else {
        seenOutlineSurahs.set(ex.surah, ex.id);
      }
    }
  }

  if (ex.type === "roots") {
    if (!ex.href || !existsSync(join(ROOT, ex.href))) failures.push(`${label}: href ${ex.href} does not exist`);
    for (const field of ["tileName", "tileDesc"]) {
      if (!ex[field] || typeof ex[field] !== "string") failures.push(`${label}: missing ${field}`);
    }
    if (!Array.isArray(ex.surahs) || !ex.surahs.length) {
      failures.push(`${label}: surahs must be a non-empty array`);
    } else {
      const seen = new Set();
      for (const s of ex.surahs) {
        if (!Number.isInteger(s) || s < 1 || s > 114) failures.push(`${label}: surah ${s} out of range 1-114`);
        if (seen.has(s)) failures.push(`${label}: duplicate surah ${s} in surahs`);
        seen.add(s);
      }
    }
  }
}

const indexHtml = readFileSync(join(ROOT, "index.html"), "utf8");
const countMatch = indexHtml.match(/var EXERCISE_COUNT = (\d+);/);
if (!countMatch) {
  failures.push("index.html: could not find `var EXERCISE_COUNT = N;`");
} else if (Number(countMatch[1]) !== exercises.length) {
  failures.push(`index.html: EXERCISE_COUNT is ${countMatch[1]} but data/exercises.json has ${exercises.length} entries`);
}

if (failures.length) {
  console.error("check-exercises: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`check-exercises: OK (${exercises.length} entries, ${seenOutlineSurahs.size} outlines)`);
