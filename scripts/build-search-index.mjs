// build-search-index.mjs — the committed full-text index behind /search.
//
//   node scripts/build-search-index.mjs           # rewrite
//   node scripts/build-search-index.mjs --check   # exit 1 if stale
//
// Sources, in this order:
//   pages     every prose page's <main>, split into sections at h2/h3
//             boundaries; a section with an id gets a fragment URL, so
//             a result lands on the section, not the page top
//   glossary  every term in data/glossary.json
//   sources   every work in data/sources.json
//   themes    every theme in data/themes.json
//
// Each document stores a display title, clean URL, kind, a short
// snippet for the results list, and a folded token text for scoring.
// Folding matches assets/search.js (lowercase, transliteration
// diacritics to ASCII, stopwords dropped) so the index and the query
// meet in the same space. The size cap is enforced, not aspirational:
// the generator fails if the index outgrows its budget, because this
// file ships to every searcher. Deterministic; zero dependencies.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanPath } from "./lib/site.mjs";
import { extractText, mainOf } from "./lib/extract-text.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const SIZE_BUDGET = 220 * 1024;
const SECTION_TOKEN_CAP = 90; // tokens kept per section for scoring
const SNIPPET_CAP = 180;

// Mirror of the folding in assets/search.js (and ask.js's diacritic
// handling). Keep the two in sync by hand; check-ask cross-checks the
// stopword lists.
const STOP = new Set(
  "a an and are as at be by for from has have in is it its of on or that the this to was were will with you your not no".split(" "),
);
const fold = (s) =>
  s
    .toLowerCase()
    .replace(/[’'‘`]/g, "")
    .replace(/[āáà]/g, "a")
    .replace(/[īíì]/g, "i")
    .replace(/[ūúù]/g, "u")
    .replace(/[ḥ]/g, "h")
    .replace(/[ṣ]/g, "s")
    .replace(/[ḍ]/g, "d")
    .replace(/[ṭ]/g, "t")
    .replace(/[ẓ]/g, "z")
    .replace(/[ʿʾ]/g, "");
const tokens = (s) =>
  fold(s)
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

const docs = [];
const pageTitle = (html, file) =>
  (html.match(/<title>([\s\S]*?)<\/title>/) || [, file])[1]
    .replace(/\s*·\s*Divine Discourses\s*$/, "")
    .trim();

// ── pages, sectioned ─────────────────────────────────────────────────
const PAGES = [
  "index.html", "read.html", "navigate.html", "dossier.html", "themes.html",
  "compare.html", "replay.html", "exercises.html", "exercise.html",
  "exercise-roots.html", "roots.html", "words.html", "patterns.html",
  "formulas.html", "numbers.html", "how-to-use.html", "how-it-works.html",
  "paths.html", "glossary.html", "watch.html", "sources.html",
  "validation.html", "datasets.html", "coverage.html", "export.html",
  "changelog.html", "about.html", "credits.html",
];

for (const file of PAGES) {
  const html = read(file);
  const title = pageTitle(html, file);
  const url = cleanPath(file);
  const main = mainOf(html);
  // Split at h2/h3 open tags, keeping each heading with its body.
  const parts = main.split(/(?=<h[23][^>]*>)/);
  let sections = 0;
  for (const part of parts) {
    const h = part.match(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/);
    const heading = h ? h[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    const id = h ? (h[2].match(/id="([^"]+)"/) || [])[1] : null;
    const body = extractText(part).replace(/^#+\s.*$/gm, " ").replace(/\s+/g, " ").trim();
    if (!body || body.length < 40) continue;
    const toks = tokens(body).slice(0, SECTION_TOKEN_CAP);
    if (!toks.length) continue;
    docs.push({
      t: heading ? `${heading} (${title})` : title,
      u: id ? `${url}#${id}` : url,
      k: "page",
      s: body.slice(0, SNIPPET_CAP),
      x: [...new Set(toks)].join(" "),
      h: tokens(heading + " " + title).join(" "),
    });
    sections++;
    if (sections >= 14) break; // very long pages: the head sections carry the topic
  }
}

// ── glossary ─────────────────────────────────────────────────────────
for (const t of readJson("data/glossary.json").terms) {
  const label = t.labelHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  docs.push({
    t: label,
    u: `/glossary#${t.id}`,
    k: "glossary",
    s: t.def.slice(0, SNIPPET_CAP),
    x: [...new Set(tokens(t.def))].slice(0, 60).join(" "),
    h: tokens(label + " " + t.matchKeys.join(" ")).join(" "),
  });
}

// ── sources ──────────────────────────────────────────────────────────
for (const s of readJson("data/sources.json").sources) {
  docs.push({
    t: s.name,
    u: "/sources",
    k: "source",
    s: [s.author, s.publisher, s.year].filter(Boolean).join(". ").slice(0, SNIPPET_CAP),
    x: [...new Set(tokens([s.name, s.author, s.publisher].filter(Boolean).join(" ")))].join(" "),
    h: tokens(s.name).join(" "),
  });
}

// ── themes ───────────────────────────────────────────────────────────
for (const th of readJson("data/themes.json").themes) {
  const glosses = th.roots.map((r) => r.gloss).filter(Boolean).join(" ");
  docs.push({
    t: th.title,
    u: `/themes#${th.slug}`,
    k: "theme",
    s: `Root families: ${th.roots.map((r) => r.latin).join(", ")}`.slice(0, SNIPPET_CAP),
    x: [...new Set(tokens(th.title + " " + glosses))].join(" "),
    h: tokens(th.title).join(" "),
  });
}

const index = {
  _generated: "scripts/build-search-index.mjs",
  _note:
    "Folded-token search index for /search. Rebuild whenever page prose, the glossary, sources, or themes change; --check in CI catches drift. Token folding must match assets/search.js.",
  docs,
};
const json = JSON.stringify(index) + "\n";

if (json.length > SIZE_BUDGET)
  throw new Error(
    `search index is ${Math.round(json.length / 1024)}KB, budget ${SIZE_BUDGET / 1024}KB — tighten caps before shipping`,
  );

const abs = join(ROOT, "data/search-index.json");
let current = null;
try {
  current = readFileSync(abs, "utf8");
} catch {}

if (CHECK) {
  if (current !== json) {
    console.error(
      "build-search-index --check: FAIL — data/search-index.json is stale.\n  Run: node scripts/build-search-index.mjs",
    );
    process.exit(1);
  }
  console.log(`build-search-index --check: OK (${docs.length} documents, ${Math.round(json.length / 1024)}KB).`);
} else {
  writeFileSync(abs, json);
  console.log(
    `build-search-index: ${docs.length} documents (${PAGES.length} pages sectioned + glossary + sources + themes), ${Math.round(json.length / 1024)}KB.`,
  );
}
