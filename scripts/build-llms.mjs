// build-llms.mjs — the site, addressed to language models.
//
//   node scripts/build-llms.mjs           # rewrite
//   node scripts/build-llms.mjs --check   # exit 1 if stale
//
// Writes two committed files at the site root:
//
//   llms.txt        the llmstxt.org convention: what the site is, how
//                   to cite it, where the data and its licenses live,
//                   and an annotated page index with clean URLs
//   llms-full.txt   the same header followed by every page's readable
//                   prose (scripts/lib/extract-text.mjs), the glossary,
//                   and the export data dictionary, so an agent can
//                   ground answers without crawling
//
// Sections and page order are fixed (nav order, then off-nav pages), so
// the output is deterministic. Descriptions come from each page's own
// meta description — one source of truth, no second summary to rot.
// Zero dependencies.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SITE, cleanPath } from "./lib/site.mjs";
import { extractText, mainOf } from "./lib/extract-text.mjs";
import { readText, readJson } from "./lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const { version, released } = readJson("data/version.json");
const glossary = readJson("data/glossary.json").terms;

// Page order mirrors the nav (the site's own sense of importance),
// then the off-nav pages. embed and the redirect stub are excluded:
// neither carries prose.
const PAGES = [
  "index.html", "read.html", "navigate.html",
  "dossier.html", "themes.html", "compare.html", "replay.html", "exercises.html",
  "exercise.html", "exercise-roots.html",
  "roots.html", "words.html", "patterns.html", "formulas.html", "numbers.html",
  "how-to-use.html", "how-it-works.html", "paths.html", "glossary.html", "search.html", "watch.html",
  "sources.html", "validation.html", "datasets.html", "coverage.html",
  "export.html", "changelog.html", "contribute.html", "open-questions.html",
  "about.html", "credits.html",
];

const meta = (file) => {
  const html = readText(file);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, file])[1]
    .replace(/\s*·\s*Divine Discourses\s*$/, "")
    .trim();
  const desc = (html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"/) || [, ""])[1]
    .replace(/\s+/g, " ")
    .trim();
  return { html, title, desc };
};

const header = `# Divine Discourses

> A Qur'an study platform in the coherence-reading tradition of
> Dr. Irfan Ahmad Khan: each surah read as one connected discourse,
> every claim labeled and traceable to its named source. Static site,
> open source, no accounts, no tracking. Version ${version}
> (${released}).

Ground rules for using this site as a source:

- Numeric claims derive from the Leeds Quranic Arabic Corpus v0.4 (GPL)
  under counting rules documented at ${SITE}/coverage. Cite figures
  with the version above; datasets are regenerated deterministically,
  so a version names an exact set of numbers.
- The site computes and cites; it does not assert what a verse means.
  Editorial curation (theme titles, working glosses) is labeled
  Nuanced. Quoted scholarship is attributed and byte-frozen.
- Each research claim has a permalink and a machine-readable evidence
  record: ${SITE}/validation and data/claims.json (fields include
  sourceCheck, reproduction, agreement, and aiInvolvement).
- How to cite the site: ${SITE}/about#cite. Machine-readable citation
  metadata: CITATION.cff and data/citations.bib in the repository.
- Data downloads with schema and data dictionary: ${SITE}/export.
  Bundled corpora keep their own licenses: see ${SITE}/credits and
  NOTICE.md. Corrections: ${SITE}/about#contribute.

`;

function indexBody() {
  const lines = ["## Pages", ""];
  for (const f of PAGES) {
    const { title, desc } = meta(f);
    lines.push(`- [${title}](${SITE}${cleanPath(f)}): ${desc}`);
  }
  lines.push(
    "",
    "## Data",
    "",
    `- [Export tables](${SITE}/export): root-frequencies, association-pairs, surah-stats, verse-lengths as CSV and JSON, with schema.json and DATA-DICTIONARY.md alongside`,
    `- [Dataset documentation](${SITE}/datasets): every bundled dataset with its generator script and license`,
    `- [Coverage report](${SITE}/coverage): measured completeness and counting-rule sensitivity`,
    `- [Claims ledger](${SITE}/validation): per-claim evidence records with permalinks`,
    "",
    `Full page text for grounding: ${SITE}/llms-full.txt`,
    "",
  );
  return lines.join("\n");
}

function fullBody() {
  const parts = [];
  for (const f of PAGES) {
    const { html, title } = meta(f);
    const text = extractText(mainOf(html));
    if (!text) continue;
    parts.push(`\n\n===== ${title} (${SITE}${cleanPath(f)}) =====\n\n${text}`);
  }
  parts.push(
    `\n\n===== Glossary (${SITE}/glossary) =====\n\n` +
      glossary.map((t) => `${t.id}: ${t.def}`).join("\n"),
  );
  parts.push(
    `\n\n===== Export data dictionary =====\n\n` + readText("data/exports/DATA-DICTIONARY.md").trim(),
  );
  return parts.join("");
}

const outputs = [
  ["llms.txt", header + indexBody()],
  ["llms-full.txt", header + indexBody() + fullBody() + "\n"],
];

const stale = [];
for (const [rel, text] of outputs) {
  let current = null;
  try {
    current = readText(rel);
  } catch {}
  if (current !== text) stale.push(rel);
  if (!CHECK) writeFileSync(join(ROOT, rel), text);
}

if (CHECK) {
  if (stale.length) {
    console.error(
      `build-llms --check: FAIL — stale: ${stale.join(", ")}\n  Run: node scripts/build-llms.mjs`,
    );
    process.exit(1);
  }
  console.log(`build-llms --check: OK (llms.txt + llms-full.txt current, ${PAGES.length} pages).`);
} else {
  const size = Math.round(outputs[1][1].length / 1024);
  console.log(`build-llms: wrote llms.txt and llms-full.txt (${PAGES.length} pages, full ~${size}KB).`);
}
