// build-share-pages.mjs — deterministic, zero-dependency generator for
// the entity share pages under s/ (committed, like every generator
// output). Purpose: a pasted link to a root, theme, or surah should
// unfurl in WhatsApp/Slack/etc. with that entity's own title and
// stats. Crawlers read static <head> tags only, so the interactive
// pages (roots.html?root=..., themes.html#..., read.html?s=...) can
// never unfurl per-entity; these tiny pages carry the tags and bounce
// humans straight to the interactive page.
//
//   s/root/<safeKey>.html   -> roots.html?root=<safeKey>   (1,642)
//   s/theme/<slug>.html     -> themes.html#<slug>          (33)
//   s/surah/<n>.html        -> read.html?s=<n>&a=1         (114)
//
// Share pages are noindex and deliberately NOT in sitemap.xml (1,789
// thin near-duplicates would hurt search, and noindex requires
// crawlability, so robots.txt must not Disallow /s/ either). The share
// buttons on roots/themes/read hand out these URLs (share.js
// qdSetShareUrl).
//
// Run: node scripts/build-share-pages.mjs
// Determinism check: run twice, `git diff` must be empty. Stale files
// from renamed/removed entities are pruned.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { safeKey } from "./lib/safe-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://qurandiscourse.netlify.app";
const OG_IMG = `${SITE}/assets/og/site-og.png`;

const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const rootsSummary = read("data/roots-summary.json");
const themes = read("data/themes.json").themes;
const chronology = read("data/chronology.json");
const names = read("data/surah-names.json");
const profiles = read("data/surah-profiles.json").surahs;

const esc = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function page({ path, title, description, target }) {
  // og:url points at the share page itself so platforms that re-fetch
  // og:url still land on the entity-specific tags; the redirect is for
  // humans only.
  const url = `${SITE}/${path}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Divine Discourses" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${OG_IMG}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta http-equiv="refresh" content="0; url=${esc(target)}" />
  </head>
  <body>
    <p style="font-family: Georgia, serif; padding: 2rem; text-align: center">
      <a href="${esc(target)}">${esc(title)}</a>
    </p>
  </body>
</html>
`;
}

const wanted = new Map(); // relative path -> content

// ── Roots ───────────────────────────────────────────────────────────
for (const bw of Object.keys(rootsSummary).sort()) {
  const r = rootsSummary[bw];
  const sk = safeKey(bw);
  const top = r.topLemmas && r.topLemmas[0];
  const description =
    `${r.totalCount.toLocaleString("en-US")} occurrence${r.totalCount === 1 ? "" : "s"} in the Qur'an` +
    (top ? ` · most frequent form ${top.lemmaArabic} (${top.count}×)` : "") +
    ` · every occurrence, derived form, and distribution chart, verified against the Leeds Quranic Arabic Corpus.`;
  wanted.set(
    `s/root/${sk}.html`,
    page({
      path: `s/root/${sk}.html`,
      title: `Root ${r.rootLatin} (${r.rootArabic}) · Divine Discourses`,
      description,
      target: `../../roots.html?root=${sk}`,
    }),
  );
}

// ── Themes ──────────────────────────────────────────────────────────
for (const t of themes.slice().sort((a, b) => a.slug.localeCompare(b.slug))) {
  const rootList = t.roots.map((r) => r.latin).join(", ");
  const description =
    `A gateway into the Qur'an's vocabulary of ${t.title.toLowerCase()}: ` +
    `root families ${rootList} and ${t.passages.length} key passages where they cluster, computed from the Leeds corpus.`;
  wanted.set(
    `s/theme/${t.slug}.html`,
    page({
      path: `s/theme/${t.slug}.html`,
      title: `${t.title} · Divine Discourses`,
      description,
      target: `../../themes.html#${t.slug}`,
    }),
  );
}

// ── Surahs ──────────────────────────────────────────────────────────
for (let n = 1; n <= 114; n++) {
  const k = String(n);
  const c = chronology[k];
  const nm = names[k];
  const p = profiles[k];
  const cls = c.period === "medinan" ? "Medinan" : "Meccan";
  const description =
    `Surah ${n} · ${nm.en} · ${p.verseCount} verses · ${cls}, ` +
    `${ordinal(c.revelationOrder)} in the Cairo 1924 revelation order. Read it verse by verse with word-level morphology and verified sources.`;
  wanted.set(
    `s/surah/${n}.html`,
    page({
      path: `s/surah/${n}.html`,
      title: `${nm.translit} (${nm.ar}) · Divine Discourses`,
      description,
      target: `../../read.html?s=${n}&a=1`,
    }),
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Write + prune ───────────────────────────────────────────────────
for (const dir of ["s", "s/root", "s/theme", "s/surah"]) {
  mkdirSync(join(ROOT, dir), { recursive: true });
}
let written = 0;
for (const [rel, content] of wanted) {
  writeFileSync(join(ROOT, rel), content);
  written++;
}
let pruned = 0;
for (const dir of ["s/root", "s/theme", "s/surah"]) {
  for (const f of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${f}`;
    if (!wanted.has(rel)) {
      unlinkSync(join(ROOT, rel));
      pruned++;
    }
  }
}
console.log(`Share pages: ${written} written (${pruned} stale pruned)`);
