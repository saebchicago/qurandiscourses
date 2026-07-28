// check-paths.mjs — integrity guard for the Study Paths registry
// (data/paths.json / paths.html). A path's steps are hand-authored HTML
// strings containing links into other tools (read.html?s=&a=, an exercise
// id, a theme slug, a compare.html passage pair) — none of that is
// schema-checked today, and none of it is caught by verify-site.mjs's
// HTTP-level link crawl, because every one of these pages returns 200
// regardless of whether the surah/verse/id/slug embedded in the query
// string or fragment is real; the page would just render a client-side
// "not found" state. A renumbered exercise id or a typo'd verse range
// would silently break a path with no build-time signal.
//
// Asserts, for every internal href found in every step's html:
//   - exercise.html?id=X → X exists in data/exercises.json
//   - themes.html#X → X exists in data/themes.json as a theme slug
//   - any s=/a= (surah/verse) query param, and any compare.html p1=/p2=
//     passage param, resolves to a real surah (1-114) and, when a verse
//     or verse range is given, verse numbers within that surah's verse
//     count (data/surah-meta.json)
//   - any other internal page reference exists on disk
//
// Run: node scripts/check-paths.mjs   (exit 1 on any failure)

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

const paths = readJson("data/paths.json").paths || [];
const exerciseIds = new Set((readJson("data/exercises.json").exercises || []).map((e) => e.id));
const themeSlugs = new Set((readJson("data/themes.json").themes || []).map((t) => t.slug));
const surahMeta = readJson("data/surah-meta.json").surahs || {};

const failures = [];

function checkSurahVerse(label, surah, verseSpec) {
  const s = Number(surah);
  if (!Number.isInteger(s) || s < 1 || s > 114) {
    failures.push(`${label}: surah ${surah} out of range 1-114`);
    return;
  }
  const meta = surahMeta[String(s)];
  if (!meta) {
    failures.push(`${label}: surah ${s} not found in data/surah-meta.json`);
    return;
  }
  if (verseSpec == null || verseSpec === "" || verseSpec === "end") return;
  for (const token of String(verseSpec).split(",")) {
    for (const part of token.split("-")) {
      if (part === "end" || part === "") continue;
      const v = Number(part);
      if (!Number.isInteger(v) || v < 1 || v > meta.versesCount) {
        failures.push(`${label}: verse ${part} out of range for surah ${s} (${meta.versesCount} verses)`);
      }
    }
  }
}

const HREF_RE = /href="([^"]+)"/g;

for (const path of paths) {
  const pathLabel = path.id || "<missing id>";
  for (const [i, step] of (path.steps || []).entries()) {
    const stepLabel = `${pathLabel} step ${i + 1}`;
    for (const match of (step.html || "").matchAll(HREF_RE)) {
      const href = match[1];
      if (/^https?:\/\//.test(href)) continue;

      const [pageAndQuery, fragment] = href.split("#");
      const [page, query] = pageAndQuery.split("?");

      if (page === "themes.html" && fragment) {
        if (!themeSlugs.has(fragment)) {
          failures.push(`${stepLabel}: themes.html#${fragment} — no theme with that slug`);
        }
        continue;
      }

      if (!query) {
        if (page && !existsSync(join(ROOT, page))) {
          failures.push(`${stepLabel}: page ${page} does not exist`);
        }
        continue;
      }

      const params = new URLSearchParams(query);

      if (page === "exercise.html") {
        const id = params.get("id");
        if (id && !exerciseIds.has(id)) {
          failures.push(`${stepLabel}: exercise.html?id=${id} — no such exercise in data/exercises.json`);
        }
        continue;
      }

      if (params.has("s")) {
        checkSurahVerse(`${stepLabel} (${href})`, params.get("s"), params.get("a"));
      }
      for (const key of ["p1", "p2"]) {
        if (!params.has(key)) continue;
        const [surah, verses] = params.get(key).split(":");
        checkSurahVerse(`${stepLabel} (${href}, ${key})`, surah, verses);
      }
    }
  }
}

if (failures.length) {
  console.error("check-paths: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`check-paths: OK (${paths.length} paths)`);
