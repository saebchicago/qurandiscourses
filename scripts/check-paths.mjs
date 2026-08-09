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
// Also asserts every path's title appears in paths.html's static fallback
// markup (the cards shown if the data/paths.json fetch fails) — nothing
// else catches that fallback silently falling behind the registry (a path
// added to the JSON without a matching card, as happened once already).
//
// v2 structured fields (the path ribbon's contract):
//   - schema: unique ids; title, intro, minutes, steps present; every
//     step carries label, minutes (integer >= 1), page, html; a path's
//     minutes equals the sum of its steps'
//   - page: null, or a clean path that resolves to a file on disk AND
//     to a page that loads assets/path-ribbon.js — a step pointing at
//     a page with no ribbon would silently drop the walkthrough
//   - href/page consistency: when a step's html links a tool page,
//     the first internal href's page must BE step.page (normalized:
//     read.html?s=1 → /read); page: null is legal only for steps whose
//     html links nothing internal. This is the drift this checker
//     exists to prevent: the ribbon and the rendered link diverging.
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

const pathsHtml = readFileSync(join(ROOT, "paths.html"), "utf8");
for (const path of paths) {
  if (path.title && !pathsHtml.includes(path.title)) {
    failures.push(`${path.id}: title "${path.title}" not found in paths.html's static fallback markup — add or update its card`);
  }
}

// ── v2 structured fields ─────────────────────────────────────────────

// Clean path → file on disk, the same mapping build-csp.mjs uses.
const fileForPath = (p) =>
  p === "/" ? "index.html" : p.replace(/^\//, "") + ".html";

// Normalize an internal href to its clean page path.
const pageOfHref = (href) => {
  const bare = href.split(/[?#]/)[0];
  if (bare === "" || bare === "/") return null; // fragment/query-only: same page
  const clean = "/" + bare.replace(/^\//, "").replace(/\.html$/, "");
  return clean === "/index" ? "/" : clean;
};

// The query string an internal href carries, "" if none — the ribbon's
// stepHref() reads this straight from step.query rather than parsing
// html at render time, so this is what has to stay in sync.
const queryOfHref = (href) => href.split("#")[0].split("?")[1] || "";

// Pages that load the ribbon script; a step's page must be one of them.
const ribbonPages = new Set(
  ["about", "changelog", "compare", "contribute", "coverage", "credits",
   "datasets", "dossier", "exercise", "exercise-roots", "exercises",
   "export", "formulas", "glossary", "how-it-works", "how-to-use",
   "index", "navigate", "numbers", "paths", "patterns", "read", "replay",
   "roots", "search", "sources", "themes", "validation", "watch", "words"]
    .filter((n) => {
      try {
        return readFileSync(join(ROOT, n + ".html"), "utf8").includes(
          'src="assets/path-ribbon.js"',
        );
      } catch {
        return false;
      }
    })
    .map((n) => (n === "index" ? "/" : "/" + n)),
);

const seenIds = new Set();
for (const path of paths) {
  const label = path.id || "<missing id>";
  if (!path.id) failures.push("a path is missing its id");
  else if (seenIds.has(path.id)) failures.push(`${label}: duplicate path id`);
  seenIds.add(path.id);
  for (const key of ["title", "intro"]) {
    if (!path[key]) failures.push(`${label}: missing ${key}`);
  }
  if (!Array.isArray(path.steps) || !path.steps.length) {
    failures.push(`${label}: no steps`);
    continue;
  }
  if (!Number.isInteger(path.minutes) || path.minutes < 1) {
    failures.push(`${label}: minutes must be an integer >= 1`);
  }
  let sum = 0;
  for (const [i, step] of path.steps.entries()) {
    const stepLabel = `${label} step ${i + 1}`;
    if (!step.label) failures.push(`${stepLabel}: missing label`);
    if (!step.html) failures.push(`${stepLabel}: missing html`);
    if (!("page" in step)) failures.push(`${stepLabel}: missing page (use null for in-place steps)`);
    if (!Number.isInteger(step.minutes) || step.minutes < 1) {
      failures.push(`${stepLabel}: minutes must be an integer >= 1`);
    } else {
      sum += step.minutes;
    }

    // href/page consistency: the first internal href decides.
    const firstInternal = [...(step.html || "").matchAll(HREF_RE)]
      .map((m) => m[1])
      .find((h) => !/^https?:\/\//.test(h));
    const hrefPage = firstInternal ? pageOfHref(firstInternal) : null;
    if (hrefPage && step.page !== hrefPage) {
      failures.push(
        `${stepLabel}: html links ${hrefPage} but page is ${JSON.stringify(step.page)}`,
      );
    }
    if (!hrefPage && step.page != null) {
      failures.push(`${stepLabel}: page ${step.page} but html links nothing internal — use null`);
    }

    // query/href consistency: the ribbon builds Previous/Next from
    // step.query, never from html, so a drift here would silently ship
    // a link that loses whatever params the step's real destination
    // needs (the bug this field exists to prevent).
    if (hrefPage) {
      const hrefQuery = queryOfHref(firstInternal);
      const stepQuery = step.query;
      if (typeof stepQuery !== "string") {
        failures.push(`${stepLabel}: missing query (use "" when the href has no query string)`);
      } else if (stepQuery !== hrefQuery) {
        failures.push(
          `${stepLabel}: html links ${firstInternal} (query ${JSON.stringify(hrefQuery)}) but query is ${JSON.stringify(stepQuery)}`,
        );
      }
    } else if ("query" in step) {
      failures.push(`${stepLabel}: query is set but html links nothing internal — remove it`);
    }

    if (step.page != null) {
      if (!existsSync(join(ROOT, fileForPath(step.page)))) {
        failures.push(`${stepLabel}: page ${step.page} has no file on disk`);
      } else if (!ribbonPages.has(step.page)) {
        failures.push(
          `${stepLabel}: page ${step.page} does not load assets/path-ribbon.js — the ribbon would never render there`,
        );
      }
    }
  }
  if (Number.isInteger(path.minutes) && sum && path.minutes !== sum) {
    failures.push(`${label}: minutes ${path.minutes} != sum of step minutes ${sum}`);
  }
}

if (failures.length) {
  console.error("check-paths: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-paths: OK (${paths.length} paths, ${paths.reduce((n, p) => n + p.steps.length, 0)} steps, minutes sums and ribbon pages consistent)`,
);
