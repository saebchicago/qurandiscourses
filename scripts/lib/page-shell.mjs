// page-shell.mjs — the shared frame for the generated reference-page
// families (surah/, juz/, root/): the site chrome copied from
// navigate.html, the head, the badges, and the write-or-check loop.
//
// One place, so the three generators cannot drift from each other or
// from the root pages. Chrome is read from navigate.html at build time
// (header, primary nav, footer, settings panel), with asset paths made
// absolute because these pages live one directory down. The pages carry
// no inline scripts and no <style> elements: their CSP blocks in
// netlify.toml allow neither.

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReviewers, reviewersFor, renderReviewedBy, withContributors } from "./review-credit.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const esc = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const n0 = (x) => Number(x).toLocaleString("en-US");
// Roots with at least this many occurrences get a page under root/
// (build-root-pages.mjs); every other link to a root goes to the explorer.
export const ROOT_PAGE_MIN = 20;

export const PERIOD = {
  "meccan-early": "Early Meccan",
  "meccan-middle": "Middle Meccan",
  "meccan-late": "Late Meccan",
  medinan: "Medinan",
};

export const badge = (ids, kind = "ok") =>
  kind === "ok"
    ? `<span class="badge ok" data-source-ids="${ids}" aria-label="Verified" tabindex="0" title="Verified · computed from the cited source">●</span>`
    : `<span class="badge nuanced" data-source-ids="${ids}" aria-label="Nuanced" tabindex="0" title="Nuanced · depends on a classification or method">~</span>`;

export const ar = (text) => `<span class="ar-inline ar notranslate" translate="no" lang="ar" dir="rtl">${esc(text)}</span>`;

export function hm(sec) {
  const m = Math.round(sec / 60);
  if (m < 1) return "under 1 min";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

// ── Chrome from navigate.html ────────────────────────────────────────
const nav = readFileSync(join(ROOT, "navigate.html"), "utf8");
const absolutize = (html) =>
  html.replace(/(href|src)="(assets\/|manifest\.webmanifest)/g, (m, attr, p) => `${attr}="/${p}`);
function slice(from, to) {
  const i = nav.indexOf(from);
  const j = nav.indexOf(to, i);
  if (i < 0 || j < 0) throw new Error(`navigate.html: could not find ${from} … ${to}`);
  return nav.slice(i, j + to.length);
}
const headLinks = absolutize(
  [
    /<link rel="stylesheet" href="assets\/fonts\.css" \/>/,
    /<link rel="stylesheet" href="assets\/style\.css" \/>/,
    /<script src="assets\/depth-boot\.js"><\/script>/,
    /<script src="assets\/nav\.js"><\/script>/,
  ]
    .map((re) => {
      const m = re.exec(nav);
      if (!m) throw new Error(`navigate.html: missing ${re}`);
      return "    " + m[0];
    })
    .join("\n") +
    "\n" +
    [...nav.matchAll(/^\s*<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>\s*$/gm)].map((m) => m[0]).join("\n") +
    "\n" +
    ((/^\s*<meta name="theme-color"[^>]*>\s*$/m.exec(nav) || [""])[0]),
);
const topChrome = absolutize(slice('<a href="#main" class="skip">', "</nav>"));
const bottomChrome = absolutize(
  slice('<footer class="site">', "</footer>") + "\n" + slice('<div class="settings">', "</div>\n    </div>"),
);

// A whole page. `main` is the inner HTML of <main>; `mainClass` its class.
export function renderPage({ title, description, url, og, jsonld, main, mainClass, scripts = [] }) {
  const path = new URL(url).pathname;
  // Reviewer credit (data/reviewers.json). With no reviewer in scope both
  // pieces are no-ops and the page is byte-identical to one without them.
  const reviewers = reviewersFor(loadReviewers(), path);
  const reviewedBy = renderReviewedBy(reviewers);
  const graph = jsonld["@graph"].map((n) => (n["@type"] === "WebPage" ? withContributors(n, reviewers) : n));
  jsonld = { ...jsonld, "@graph": graph };
  // The footer's "Report an issue" link carries the page it was clicked on.
  const footer = bottomChrome.replace("page=%2Fnavigate", "page=" + encodeURIComponent(path));
  return `<!doctype html>
<html lang="en" dir="ltr" data-depth="simple">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index,follow" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Divine Discourses" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${og}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
${headLinks}
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-QEQGD1980R"></script>
    <script src="/assets/ga-init.js"></script>
    <script type="application/ld+json">
${JSON.stringify(jsonld)}
    </script>
  </head>
  <body>
    ${topChrome}
    <main id="main" class="${mainClass}">
${main}${reviewedBy ? "\n        " + reviewedBy : ""}
    </main>
    ${footer}
    <script src="/assets/surahs.js"></script>
    <script src="/assets/app.js"></script>
    <script src="/assets/share.js" defer></script>
${scripts.map((s) => `    <script src="${s}" defer></script>`).join("\n")}${scripts.length ? "\n" : ""}  </body>
</html>
`;
}

// Replace the content between <!-- static:NAME --> markers.
export function replaceRegion(html, name, inner, file) {
  const open = `<!-- static:${name} -->`;
  const close = `<!-- /static:${name} -->`;
  if (!html.includes(open) || !html.includes(close)) throw new Error(`${file}: static:${name} markers missing`);
  const re = new RegExp(`${open}[\\s\\S]*?${close}`);
  return html.replace(re, `${open}\n${inner}\n            ${close}`);
}

// The sitemap block for one family, keeping each URL's <lastmod> (which
// build-canonicals owns) across rewrites.
export function sitemapRegion(xml, name, locs, priority) {
  const old = new Map();
  for (const m of xml.matchAll(/<url>[\s\S]*?<loc>([^<]*)<\/loc>[\s\S]*?<\/url>/g)) old.set(m[1], m[0]);
  const urls = locs.map((loc) => {
    const kept = old.get(loc);
    const lastmod = kept && /<lastmod>([^<]*)<\/lastmod>/.exec(kept);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod ? lastmod[1] : "2026-09-26"}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  });
  const block = `  <!-- ${name} (build-${name}.mjs) -->\n${urls.join("\n")}\n  <!-- /${name} -->`;
  const re = new RegExp(`  <!-- ${name}[\\s\\S]*?<!-- \\/${name} -->`);
  return re.test(xml) ? xml.replace(re, block) : xml.replace("</urlset>", `${block}\n</urlset>`);
}

// Write a page family, or check it. `wanted` maps repo-relative path to
// HTML; `edits` maps other repo-relative files to their new content.
export function writeFamily({ script, dir, wanted, edits, check }) {
  const stale = [];
  for (const [rel, html] of wanted) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs) || readFileSync(abs, "utf8") !== html) stale.push(rel);
  }
  const extra = existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir)).filter((f) => !wanted.has(`${dir}/${f}`))
    : [];
  for (const [rel, content] of edits) if (readFileSync(join(ROOT, rel), "utf8") !== content) stale.push(rel);
  if (check) {
    if (stale.length || extra.length) {
      const all = [...stale, ...extra.map((f) => `${dir}/${f} (stray)`)];
      console.error(`${script} --check: FAIL — ${all.length} stale: ${all.slice(0, 6).join(", ")}${all.length > 6 ? "…" : ""}`);
      console.error(`  Run: node scripts/${script}.mjs`);
      process.exit(1);
    }
    console.log(`${script} --check: OK (${wanted.size} pages current)`);
    return;
  }
  mkdirSync(join(ROOT, dir), { recursive: true });
  for (const [rel, html] of wanted) writeFileSync(join(ROOT, rel), html);
  for (const f of extra) unlinkSync(join(ROOT, dir, f));
  for (const [rel, content] of edits) writeFileSync(join(ROOT, rel), content);
  console.log(`${script}: ${wanted.size} pages, ${stale.length} changed${extra.length ? `, ${extra.length} pruned` : ""}.`);
}

// "3" or "3–5" for a set of integers.
export function range(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

// Leeds Quranic Arabic Corpus part-of-speech tags, as plain words. Checked
// against the corpus's own examples (EXP is illa, EXL amma/imma, EXH lawla).
export const POS = {
  N: "noun", PN: "proper noun", ADJ: "adjective", V: "verb", IMPN: "imperative verbal noun",
  PRON: "pronoun", DEM: "demonstrative", REL: "relative pronoun", T: "time adverb", LOC: "location adverb",
  P: "preposition", CONJ: "conjunction", SUB: "subordinating conjunction", ACC: "accusative particle",
  AMD: "amendment particle", ANS: "answer particle", AVR: "aversion particle", CERT: "particle of certainty",
  COND: "conditional particle", EXH: "exhortation particle", EXL: "explanation particle", EXP: "exceptive particle",
  FUT: "future particle", INC: "inceptive particle", INT: "particle of interpretation", INTG: "interrogative particle",
  NEG: "negative particle", PRO: "prohibition particle", RES: "restriction particle", RET: "retraction particle",
  SUP: "supplemental particle", SUR: "surprise particle",
};
export const posLabel = (tags) => String(tags).split("/").map((t) => POS[t] || t).join(" / ");
