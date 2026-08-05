// build-jsonld.mjs — schema.org structured data on every page.
//
//   node scripts/build-jsonld.mjs           # rewrite
//   node scripts/build-jsonld.mjs --check   # exit 1 if stale
//
// Injects one <script type="application/ld+json"> block per page,
// between JSONLD markers in the <head>, generated from the same
// registries the pages themselves render:
//
//   every page      WebPage (name, description, canonical URL, version,
//                   isPartOf WebSite) + BreadcrumbList
//   index.html      WebSite with a SearchAction wired to the Ask box's
//                   /read?s= routing surface
//   datasets/export Dataset per export table, from data/exports/schema.json
//   glossary.html   DefinedTermSet from data/glossary.json
//   sources.html    Book / ScholarlyArticle / Dataset per typed source
//   paths.html      LearningResource per path in data/paths.json
//   validation.html Claim per ledger entry, each with its permalink id
//
// ld+json blocks are DATA, not script: browsers never execute them, so
// CSP script-src ignores them, and build-csp.mjs's attribute-free regex
// deliberately skips them (documented there). Ordering contract: run
// AFTER build-canonicals (URLs feed this) and BEFORE build-csp (which
// hashes real inline scripts on the same pages). Deterministic:
// key order is fixed by construction; run twice, git diff is empty.
// Zero dependencies.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SITE, cleanPath, canonicalUrl, NO_CANONICAL } from "./lib/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

const { version } = read("data/version.json");
const sources = read("data/sources.json").sources;
const glossary = read("data/glossary.json").terms;
const paths = read("data/paths.json").paths;
const claims = read("data/claims.json").claims;
const schema = read("data/exports/schema.json");

const OPEN = "<!-- JSONLD (build-jsonld.mjs) -->";
const CLOSE = "<!-- /JSONLD -->";

const SITE_NODE = {
  "@type": "WebSite",
  "@id": `${SITE}/#website`,
  name: "Divine Discourses",
  url: `${SITE}/`,
  description:
    "A Qur'an study platform in the coherence-reading tradition: each surah read as one discourse, every claim labeled and traceable to its source.",
  inLanguage: "en",
  license: "https://opensource.org/licenses/MIT",
};

// The one query surface a crawler can use directly: the Read page's
// s= parameter accepts a surah number or name (assets/ask.js and
// read.html's resolveSurah share the grammar).
const SEARCH_ACTION = {
  ...SITE_NODE,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE}/read?s={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const plain = (h) =>
  h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function pageMeta(file) {
  const html = readFileSync(join(ROOT, file), "utf8");
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1].trim();
  const desc = (html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"/) || [, ""])[1]
    .replace(/\s+/g, " ")
    .trim();
  return { html, title, desc };
}

function datasetNodes() {
  return Object.keys(schema.tables)
    .sort()
    .map((name) => {
      const t = schema.tables[name];
      return {
        "@type": "Dataset",
        "@id": `${SITE}/export#${name}`,
        name: `Divine Discourses: ${name}`,
        description: t.description,
        url: `${SITE}/export`,
        version,
        creator: { "@type": "Organization", name: "Divine Discourses project", url: `${SITE}/about` },
        isBasedOn: "https://corpus.quran.com",
        license: "https://www.gnu.org/licenses/gpl-3.0.html",
        distribution: ["csv", "json"].map((ext) => ({
          "@type": "DataDownload",
          encodingFormat: ext === "csv" ? "text/csv" : "application/json",
          contentUrl: `${SITE}/data/exports/${name}.${ext}`,
        })),
      };
    });
}

function sourceNode(s) {
  const kind =
    s.type === "book" ? "Book" : s.type === "paper" ? "ScholarlyArticle" : "Dataset";
  const node = { "@type": kind, name: s.name };
  if (s.author) node.author = { "@type": "Person", name: s.author };
  if (s.publisher) node.publisher = s.publisher;
  if (s.year) node.datePublished = String(s.year);
  if (s.isbn) node.isbn = s.isbn;
  if (s.url) node.url = s.url;
  return node;
}

function perPageNodes(file) {
  const nodes = [];
  if (file === "index.html") {
    nodes.push(SEARCH_ACTION);
  } else {
    nodes.push({ ...SITE_NODE });
  }
  if (file === "datasets.html" || file === "export.html") nodes.push(...datasetNodes());
  if (file === "glossary.html") {
    nodes.push({
      "@type": "DefinedTermSet",
      "@id": `${SITE}/glossary`,
      name: "Divine Discourses glossary",
      hasDefinedTerm: glossary.map((t) => ({
        "@type": "DefinedTerm",
        "@id": `${SITE}/glossary#${t.id}`,
        name: plain(t.labelHtml),
        description: t.def,
      })),
    });
  }
  if (file === "sources.html") nodes.push(...sources.map(sourceNode));
  if (file === "paths.html") {
    nodes.push(
      ...paths.map((p) => ({
        "@type": "LearningResource",
        "@id": `${SITE}/paths#${p.id}`,
        name: p.title,
        description: plain(p.intro || ""),
        url: `${SITE}/paths#${p.id}`,
        teaches: "Coherence-based Qur'an reading",
        learningResourceType: "guided walkthrough",
        ...(p.minutes ? { timeRequired: `PT${p.minutes}M` } : {}),
        hasPart: p.steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.label,
        })),
        provider: { "@type": "Organization", name: "Divine Discourses project" },
      })),
    );
  }
  if (file === "validation.html") {
    nodes.push(
      ...claims.map((c) => ({
        "@type": "Claim",
        "@id": `${SITE}/validation#${c.id}`,
        url: `${SITE}/validation#${c.id}`,
        appearance: { "@type": "WebPage", url: `${SITE}/validation` },
        // The 6-axis evidence vector, flattened to what schema.org can say.
        additionalType: c.claimType,
        creativeWorkStatus: c.reproduction,
      })),
    );
  }
  return nodes;
}

function graphFor(file, meta) {
  const clean = cleanPath(file);
  const crumbs = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
  ];
  if (clean !== "/")
    crumbs.push({ "@type": "ListItem", position: 2, name: meta.title.replace(/\s*·\s*Divine Discourses\s*$/, ""), item: canonicalUrl(file) });
  const graph = [
    {
      "@type": "WebPage",
      "@id": canonicalUrl(file),
      url: canonicalUrl(file),
      name: meta.title,
      description: meta.desc,
      inLanguage: "en",
      isPartOf: { "@id": `${SITE}/#website` },
      version,
    },
    { "@type": "BreadcrumbList", itemListElement: crumbs },
    ...perPageNodes(file),
  ];
  return { "@context": "https://schema.org", "@graph": graph };
}

// ── apply ─────────────────────────────────────────────────────────────
const pages = readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && !NO_CANONICAL.has(f))
  .sort();

let changed = [];
for (const file of pages) {
  const meta = pageMeta(file);
  const block =
    `${OPEN}\n    <script type="application/ld+json">\n` +
    JSON.stringify(graphFor(file, meta)) +
    `\n    </script>\n    ${CLOSE}`;
  let after;
  if (meta.html.includes(OPEN)) {
    const i = meta.html.indexOf(OPEN);
    const j = meta.html.indexOf(CLOSE) + CLOSE.length;
    after = meta.html.slice(0, i) + block + meta.html.slice(j);
  } else {
    // First run: insert just before </head>.
    after = meta.html.replace("</head>", `  ${block}\n  </head>`);
  }
  if (after !== meta.html) {
    changed.push(file);
    if (!CHECK) writeFileSync(join(ROOT, file), after);
  }
}

if (CHECK) {
  if (changed.length) {
    console.error(
      `build-jsonld --check: FAIL — stale on ${changed.length} page(s): ${changed
        .slice(0, 5)
        .join(", ")}${changed.length > 5 ? "..." : ""}\n  Run: node scripts/build-jsonld.mjs`,
    );
    process.exit(1);
  }
  console.log(`build-jsonld --check: OK (${pages.length} pages carry current structured data).`);
} else {
  console.log(`build-jsonld: ${pages.length} pages, ${changed.length} updated.`);
}
