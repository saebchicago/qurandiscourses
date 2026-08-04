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

if (failures.length) {
  console.error("check-ask: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-ask: OK (${Object.keys(routes.themes).length} theme words, ${Object.keys(routes.pages).length} page words, ${Object.keys(routes.glossary).length} glossary keys all resolve).`,
);
