// check-ask.mjs — every Ask-box route must point at something real.
//
// The router's tables live in data/ask-routes.json. Each kind of
// target rots differently: a renamed theme slug 404s a fragment on
// /themes, a renamed glossary id strands its anchor, a removed page
// leaves a word routing to a redirect-less path. All of it fails
// silently in the browser — the page loads, the fragment just finds
// nothing — which is why this runs in CI instead of trusting review.
//
// Run: node scripts/check-ask.mjs   (exit 1 on any failure)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const failures = [];

const routes = read("data/ask-routes.json");
const themeSlugs = new Set(read("data/themes.json").themes.map((t) => t.slug));
const glossaryIds = new Set(read("data/glossary.json").terms.map((t) => t.id));
const pages = new Set(
  readdirSync(ROOT)
    .filter((f) => f.endsWith(".html"))
    .map((f) => (f === "index.html" ? "/" : "/" + f.replace(/\.html$/, ""))),
);

// Page anchors referenced by page routes (like /about#cite) must exist.
const anchorCache = new Map();
function hasAnchor(path, id) {
  const file = path === "/" ? "index.html" : path.slice(1) + ".html";
  if (!anchorCache.has(file))
    anchorCache.set(file, readFileSync(join(ROOT, file), "utf8"));
  return anchorCache.get(file).includes(`id="${id}"`);
}

for (const [word, slug] of Object.entries(routes.themes)) {
  if (!themeSlugs.has(slug))
    failures.push(`themes["${word}"]: no theme slug "${slug}" in data/themes.json`);
}

for (const [word, target] of Object.entries(routes.pages)) {
  const [path, frag] = target.split("#");
  if (!pages.has(path)) failures.push(`pages["${word}"]: no page at ${path}`);
  else if (frag && !hasAnchor(path, frag))
    failures.push(`pages["${word}"]: ${path} has no id="${frag}"`);
}

for (const [key, target] of Object.entries(routes.glossary)) {
  const id = (target.match(/^\/glossary#(.+)$/) || [])[1];
  if (!id || !glossaryIds.has(id))
    failures.push(`glossary["${key}"]: target ${target} not in data/glossary.json`);
}

// The juz table is what "juz 5" and "para 3" route on. A wrong start
// verse is invisible in the browser — the page loads, at the wrong
// place — so it is checked against the same source it is derived from.
const juzSource = read("data/juz.json").juz;
const surahMeta = read("data/surah-meta.json").surahs;
if (!Array.isArray(routes.juz) || routes.juz.length !== 30) {
  failures.push(
    `juz: expected 30 entries, found ${Array.isArray(routes.juz) ? routes.juz.length : "none"} — rerun build-ask-routes`,
  );
} else {
  for (const j of routes.juz) {
    const src = juzSource.find((s) => s.juz === j.juz);
    if (!src) {
      failures.push(`juz[${j.juz}]: no such juz in data/juz.json`);
      continue;
    }
    if (src.startSurah !== j.startSurah || src.startAyah !== j.startAyah)
      failures.push(
        `juz[${j.juz}]: routes to ${j.startSurah}:${j.startAyah}, data/juz.json says ${src.startSurah}:${src.startAyah}`,
      );
    const m = surahMeta[String(j.startSurah)];
    if (!m) failures.push(`juz[${j.juz}]: start surah ${j.startSurah} is not 1-114`);
    else if (j.startAyah < 1 || j.startAyah > m.versesCount)
      failures.push(
        `juz[${j.juz}]: verse ${j.startAyah} is outside surah ${j.startSurah} (${m.versesCount} verses)`,
      );
  }
}

// The generated JS mirror must be current (build-ask-routes --check
// also guards this; asserting here too keeps this checker sufficient
// on its own).
const generated = readFileSync(join(ROOT, "assets/ask-routes.js"), "utf8");
for (const table of ["themes", "pages", "glossary"]) {
  for (const key of Object.keys(routes[table])) {
    if (!generated.includes(JSON.stringify(key)))
      failures.push(`assets/ask-routes.js: missing ${table} key ${key} — rerun build-ask-routes`);
  }
}
if (!/"juz":\s*\[/.test(generated))
  failures.push("assets/ask-routes.js: no juz table — rerun build-ask-routes");

// The passage panel is FAIL-OPEN in exactly the way the per-page CSP
// is: a page can carry the Ask box or the search box, look completely
// correct in review, and silently never offer the verse control because
// one script tag is missing. The panel is also the only place a reader
// learns how many verses a surah has, so its absence is invisible until
// someone needs the number. Hence a checker, not a convention.
// Applies to pages that ANSWER a query themselves. 404.html carries a
// search box too, but it only forwards to /search with a plain GET, so
// the panel is the destination's job, not its own — requiring the
// scripts there would be cargo cult.
const PANEL_DEPS = ["assets/picker.js", "assets/passage.js"];
for (const file of readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(ROOT, file), "utf8");
  const box = html.includes('id="ask-input"')
    ? "Ask box"
    : html.includes('id="search-input"') && html.includes('src="assets/search.js"')
      ? "search box"
      : null;
  if (!box) continue;
  for (const dep of PANEL_DEPS) {
    if (!html.includes(`src="${dep}"`))
      failures.push(`${file}: carries the ${box} but does not load ${dep} — the verse panel would never render`);
  }
  if (!html.includes('id="ask-passage"') && !html.includes('id="searchPassage"'))
    failures.push(`${file}: carries the ${box} but has no panel container (ask-passage / searchPassage)`);
}

// The search index and its client fold and stem tokens independently,
// in two languages. They must agree exactly or a query lands in a
// space the index does not occupy: the stopword list, the diacritic
// folding and the suffix stripper are compared rule by rule.
const builder = readFileSync(join(ROOT, "scripts/build-search-index.mjs"), "utf8");
const client = readFileSync(join(ROOT, "assets/search.js"), "utf8");
const stopOf = (src) => {
  const m = src.match(/"(a an and are[^"]*)"/);
  return m ? m[1] : null;
};
const bStop = stopOf(builder);
const cStop = stopOf(client);
if (!bStop || !cStop) failures.push("search folding: stopword list not found in one of the two files");
else if (bStop !== cStop)
  failures.push("search folding: stopword lists differ between build-search-index.mjs and assets/search.js");

const foldRules = (src) =>
  (src.match(/\.replace\(\/\[[^\]]*\]\/g?u?,\s*"[^"]*"\)/g) || []).join("|");
if (foldRules(builder) !== foldRules(client))
  failures.push(
    "search folding: diacritic replace() chains differ between build-search-index.mjs and assets/search.js",
  );

// Suffix rules, normalized across the two spellings (endsWith in the
// builder, slice() in the client) to the pair (suffix, replacement).
const stemRules = (src) => {
  const body = (src.match(/stem\s*(?:=|\()[\s\S]*?\n(?:};|  \})/) || [""])[0];
  const out = [];
  for (const m of body.matchAll(
    /(?:endsWith\("([a-z]+)"\)|slice\(-\d+\)\s*===\s*"([a-z]+)")\)\s*return\s+t(?:\.slice\(0,\s*(-\d+)\)(?:\s*\+\s*"([a-z]+)")?)?/g,
  ))
    out.push([m[1] || m[2], m[3] || "0", m[4] || ""].join(":"));
  return out.join("|");
};
const bStem = stemRules(builder);
const cStem = stemRules(client);
if (!bStem) failures.push("search folding: no stem() rules found in build-search-index.mjs");
else if (bStem !== cStem)
  failures.push(
    `search folding: stem() rules differ — builder [${bStem}] vs client [${cStem}]`,
  );

if (failures.length) {
  console.error("check-ask: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-ask: OK (${Object.keys(routes.themes).length} theme words, ${Object.keys(routes.pages).length} page words, ${Object.keys(routes.glossary).length} glossary keys all resolve).`,
);
