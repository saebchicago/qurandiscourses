#!/usr/bin/env node
//
// build-surah-pages.mjs — one static, indexable reference page per surah
// at /surah/<n> (surah/<n>.html), built entirely from data the site
// already ships.
//
//   node scripts/build-surah-pages.mjs           # write surah/*.html
//   node scripts/build-surah-pages.mjs --check   # exit 1 if any is stale
//
// WHY. Everything the site knows about a surah was rendered by
// JavaScript behind one address (/dossier?s=36), so search engines and
// answer engines saw a surah picker and nothing else. These pages carry
// the same facts as plain HTML: the name, verse and word-unit counts,
// classification and revelation order, juz and mushaf pages, listening
// time per reciter, top roots, the computed sections, the themes whose
// vocabulary clusters here, recurring phrases, verse endings, and the
// full Arabic text (Tanzil, verbatim). Every figure is read from a data
// file named in the page's own sources list; nothing is written by hand
// per surah, and nothing interpretive is added.
//
// The page chrome (header, primary nav, footer, settings) is copied from
// navigate.html at build time, so the nav stays byte-identical to the
// root pages without a second copy to maintain. Asset paths are made
// absolute, since these pages live one directory down. No inline
// scripts or <style> elements: the /surah/* CSP block in netlify.toml
// allows none. Also writes the surah-pages list into navigate.html
// (between static:surah-pages markers) and the <url> entries into
// sitemap.xml (between surah-pages comments); build-canonicals then
// sets their <lastmod> from data/page-dates.json.
//
// Run order: this, then build-page-dates, build-canonicals, build-csp,
// build-sw-manifest. Deterministic.

import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "./lib/site.mjs";
import { safeKey } from "./lib/safe-key.mjs";
import { ordinal } from "./lib/ordinal.mjs";
import { readJson } from "./lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "surah");
const CHECK = process.argv.includes("--check");

const names = readJson("data/surah-names.json");
const chronology = readJson("data/chronology.json");
const meta = readJson("data/surah-meta.json");
const profiles = readJson("data/surah-profiles.json").surahs;
const themeIndex = readJson("data/theme-surah-index.json");
const formulaSummary = readJson("data/formula-summary.json").surahs;
const rhyme = readJson("data/rhyme-summary.json").surahs;
const pace = readJson("data/recitation/pace.json");
const fawatih = readJson("data/rhetorical-features.json").fawatih.entries;
const exercises = readJson("data/exercises.json").exercises;
const khan = readJson("data/khan-interpretations.json");
const textIndex = readJson("data/quran-text/index.json");

const esc = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n0 = (x) => Number(x).toLocaleString("en-US");
const PERIOD = {
  "meccan-early": "Early Meccan",
  "meccan-middle": "Middle Meccan",
  "meccan-late": "Late Meccan",
  medinan: "Medinan",
};

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
const bottomChrome = absolutize(slice('<footer class="site">', "</footer>") + "\n" + slice('<div class="settings">', "</div>\n    </div>"));

// ── Per-surah content ────────────────────────────────────────────────
const badge = (ids, kind = "ok") =>
  kind === "ok"
    ? `<span class="badge ok" data-source-ids="${ids}" aria-label="Verified" tabindex="0" title="Verified · computed from the cited source">●</span>`
    : `<span class="badge nuanced" data-source-ids="${ids}" aria-label="Nuanced" tabindex="0" title="Nuanced · depends on a classification or method">~</span>`;

function hm(sec) {
  const m = Math.round(sec / 60);
  if (m < 1) return "under 1 min";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function range(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

function pageFor(n) {
  const k = String(n);
  const nm = names[k];
  const ch = chronology[k];
  const mt = meta[k] || (meta.surahs && meta.surahs[k]);
  const pr = profiles[k];
  const text = readJson(`data/quran-text/${n}.json`);
  const ayahs = text.ayahs;
  if (ayahs.length !== pr.verseCount) throw new Error(`surah ${n}: ${ayahs.length} verses in the text, ${pr.verseCount} in the profile`);
  const cls = mt && mt.classification === "madani" ? "Medinan" : "Meccan";
  const juz = range(ayahs.map((a) => a.juz));
  const pages = range(ayahs.map((a) => a.page));
  const sajda = ayahs.filter((a) => a.sajda).map((a) => a.numberInSurah);
  const opening = fawatih.find((f) => f.s === n);
  const themes = (themeIndex[k] || []).slice(0, 5);
  const fs = formulaSummary[k] || {};
  const rh = rhyme[k];
  const struct = readJson(`data/structure/${n}.json`);
  const outline = exercises.find((e) => e.surah === n && e.type === "outline");
  const hasKhan = Object.prototype.hasOwnProperty.call(khan, k);
  const title = `Surah ${nm.translit} (${nm.ar}), ${pr.verseCount} verses · Divine Discourses`;
  let description =
    `Surah ${nm.translit} (${nm.ar}), surah ${n} of the Qur'an: ${pr.verseCount} verses, ${cls}, ` +
    `${ordinal(ch.revelationOrder)} in revelation order. Arabic text, roots, structure and listening time.`;
  if (description.length > 160) description = description.replace(" Arabic text, roots, structure and listening time.", " Arabic text, roots and structure.");
  const url = `${SITE}/surah/${n}`;
  const prev = n > 1 ? n - 1 : null;
  const next = n < 114 ? n + 1 : null;
  const og = existsSync(join(ROOT, `assets/og/surah/${n}.png`)) ? `${SITE}/assets/og/surah/${n}.png` : `${SITE}/assets/og/site-og.png`;

  const reciterRows = pace.reciters
    .map((r) => `<tr><td>${esc(r.name)}</td><td class="count">${hm(pace.surahSeconds[r.id][n - 1])}</td></tr>`)
    .join("");
  const roots = (pr.topRoots || [])
    .slice(0, 8)
    .map(
      (r) =>
        `<li><a href="/roots?root=${safeKey(r.root)}"><span class="ar-inline ar notranslate" translate="no" lang="ar" dir="rtl">${esc(r.rootArabic)}</span> ${esc(r.rootLatin)}</a> <span class="t-annotation">${n0(r.count)}×</span></li>`,
    )
    .join("");
  const sections = (struct.sections || [])
    .map((s) => `<li><a href="/read?s=${n}&amp;a=${s.fromVerse}-${s.toVerse}">Verses ${s.fromVerse}–${s.toVerse}</a> <span class="t-annotation">(${s.verseCount})</span></li>`)
    .join("");
  const themeItems = themes
    .map((t) => `<li><a href="/themes#${esc(t.slug)}">${esc(t.title)}</a> <span class="t-annotation">${t.perThousand} per 1,000 word-units</span></li>`)
    .join("");
  const verses = ayahs
    .map(
      (a) =>
        `<span class="surah-verse" id="v${a.numberInSurah}">${esc(a.text)} <a class="surah-verse-num" href="/read?s=${n}&amp;a=${a.numberInSurah}" aria-label="Verse ${a.numberInSurah}">﴿${a.numberInSurah.toLocaleString("ar-EG")}﴾</a></span>`,
    )
    .join(" ");

  const facts = [
    ["Arabic name", `<span class="ar-inline ar notranslate" translate="no" lang="ar" dir="rtl">${esc(nm.ar)}</span>`, ""],
    ["English name", esc(nm.en), ""],
    ["Position in the mushaf", `${n} of 114`, ""],
    ["Verses", n0(pr.verseCount), badge("leeds-corpus-v0.4 tanzil")],
    ["Word-units", n0(pr.tokenCount), badge("leeds-corpus-v0.4")],
    ["Distinct roots", n0(pr.distinctRootCount), badge("leeds-corpus-v0.4")],
    ["Classification", cls, badge("quran-foundation-api-v4", "nuanced")],
    ["Revelation order (Cairo 1924)", ordinal(ch.revelationOrder), badge("cairo-1924", "nuanced")],
    ["Period (Nöldeke-Bell four-period scheme)", PERIOD[ch.period] || esc(ch.period), badge("cairo-1924 noldeke-schwally-1909", "nuanced")],
    ["Juz", juz, badge("tanzil alquran-cloud-api")],
    ["Mushaf pages (Madani 604-page)", pages, badge("tanzil alquran-cloud-api")],
    ...(sajda.length ? [["Prostration (sajda) verse", sajda.join(", "), badge("tanzil alquran-cloud-api")]] : []),
    ...(opening ? [["Opening letters", `<span class="ar-inline ar notranslate" translate="no" lang="ar" dir="rtl">${esc(opening.letters)}</span>`, badge("leeds-corpus-v0.4")]] : []),
  ]
    .map(([t, d, b]) => `<tr><th scope="row">${t}</th><td>${d} ${b}</td></tr>`)
    .join("\n              ");

  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: title,
        description,
        inLanguage: "en",
        isPartOf: { "@id": `${SITE}/#website` },
        about: {
          "@type": "CreativeWork",
          name: `Surah ${nm.translit}`,
          alternateName: [nm.ar, nm.en].filter((x, i, a) => x && a.indexOf(x) === i),
          position: n,
          inLanguage: "ar",
          isPartOf: { "@type": "Book", name: "The Qur'an" },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Browse all 114 surahs", item: `${SITE}/navigate` },
          { "@type": "ListItem", position: 3, name: `Surah ${nm.translit}`, item: url },
        ],
      },
    ],
  };

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
    <script type="application/ld+json">
${JSON.stringify(jsonld)}
    </script>
  </head>
  <body>
    ${topChrome}
    <main id="main" class="surah-page">
      <nav class="surah-crumbs t-annotation" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/navigate">All surahs</a> › Surah ${n}</nav>
      <h2 class="surah-title">Surah ${esc(nm.translit)} <span class="ar-inline ar notranslate" translate="no" lang="ar" dir="rtl">${esc(nm.ar)}</span></h2>
      <p class="lede">
        ${esc(nm.translit)} is surah ${n} of the Qur'an's 114. It has
        ${n0(pr.verseCount)} verses and ${n0(pr.tokenCount)} word-units, is classified
        ${cls}, and is ${ordinal(ch.revelationOrder)} in the Cairo 1924 revelation order.
        With ${esc(pace.reciters[0].name)}, its recitation lasts about ${hm(pace.surahSeconds[pace.reciters[0].id][n - 1])}.
      </p>
      <p class="surah-actions">
        <a class="button btn-primary" href="/read?s=${n}">Read with translation</a>
        <a class="button secondary" href="/read?s=${n}#listen">Listen</a>
        <a class="button secondary" href="/dossier?s=${n}">Full profile</a>
        <a class="button secondary" href="/replay?s=${n}">Watch it unfold</a>
      </p>

      <div class="grid">
        <section class="card" aria-labelledby="facts">
          <h3 id="facts">At a glance</h3>
          <table class="data surah-facts">
            <tbody>
              ${facts}
            </tbody>
          </table>
          <p class="prov t-annotation">Counts from the Leeds Quranic Arabic Corpus v0.4; verses, juz and pages from the bundled Tanzil text and its alquran.cloud metadata. Classification and period are one scholarly convention among several.</p>
        </section>

        <section class="card" aria-labelledby="listening">
          <h3 id="listening">Listening time</h3>
          <table class="data">
            <thead><tr><th>Reciter</th><th class="count">Whole surah</th></tr></thead>
            <tbody>${reciterRows}</tbody>
          </table>
          <p class="prov t-annotation">${badge("islamic-network-audio", "nuanced")} Measured from the audio files <a href="/read?s=${n}">Read</a> plays. A recording's pace, not a property of the text. <a href="/numbers#recitation-pace">How this is measured</a>.</p>
        </section>

        <section class="card" aria-labelledby="roots">
          <h3 id="roots">Most frequent roots</h3>
          <ol class="surah-roots">${roots}</ol>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4")} Word-units per root in this surah, Leeds corpus v0.4. Each opens every occurrence on <a href="/roots">Roots</a>.</p>
        </section>

        <section class="card" aria-labelledby="sections">
          <h3 id="sections">Computed sections</h3>
          <ol class="surah-sections">${sections}</ol>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4", "nuanced")} Found mechanically, where shared vocabulary between neighboring verses drops. A starting point for reading structure, not a scholarly outline.${outline ? ` Dr. Khan's outline of this surah is an <a href="/exercise?id=${esc(outline.id)}">exercise</a>.` : ""}${hasKhan ? ` His reading of it is quoted in the <a href="/dossier?s=${n}">full profile</a>.` : ""}</p>
        </section>

        ${themeItems ? `<section class="card" aria-labelledby="themes">
          <h3 id="themes">Themes whose vocabulary clusters here</h3>
          <ul class="surah-themes">${themeItems}</ul>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4", "nuanced")} Theme groupings are editorial; the densities are computed. See <a href="/themes">Themes</a>.</p>
        </section>` : ""}

        <section class="card" aria-labelledby="patterns">
          <h3 id="patterns">Sound and repetition</h3>
          <ul class="surah-patterns">
            <li>${n0(fs.rootCount || 0)} recurring root-sequence phrases and ${n0(fs.surfaceCount || 0)} recurring surface phrases occur here (<a href="/formulas">Formulas</a>).</li>
            ${rh ? `<li>Most verses end in <span class="ar-inline ar notranslate" translate="no" lang="ar" dir="rtl">${esc(rh.dominantKey)}</span> (${Math.round(rh.dominantShare * 100)}% of verses); the ending changes ${n0(rh.shiftCount)} times (<a href="/patterns">Patterns</a>).</li>` : ""}
          </ul>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4")} Counted from the Leeds corpus v0.4.</p>
        </section>
      </div>

      <section class="card surah-text-card" aria-labelledby="text">
        <h3 id="text">The Arabic text</h3>
        <p class="surah-text ar notranslate" translate="no" lang="ar" dir="rtl">${verses}</p>
        <p class="prov t-annotation">${badge("tanzil")} Tanzil Quran Text (Uthmani, Version 1.1), copied verbatim; Creative Commons Attribution 3.0, changes not allowed. Source: <a href="https://tanzil.net" rel="noopener">tanzil.net</a>. Translations are on <a href="/read?s=${n}">Read</a>.</p>
        <details class="method-note">
          <summary>Tanzil's copyright notice</summary>
          <pre class="tanzil-notice">${esc(textIndex.notice.join("\n"))}</pre>
        </details>
      </section>

      <nav class="surah-pager" aria-label="Neighboring surahs">
        ${prev ? `<a href="/surah/${prev}" rel="prev">‹ Surah ${prev}: ${esc(names[String(prev)].translit)}</a>` : "<span></span>"}
        <a href="/navigate">All 114 surahs</a>
        ${next ? `<a href="/surah/${next}" rel="next">Surah ${next}: ${esc(names[String(next)].translit)} ›</a>` : "<span></span>"}
      </nav>
    </main>
    ${bottomChrome}
    <script src="/assets/surahs.js"></script>
    <script src="/assets/app.js"></script>
    <script src="/assets/share.js" defer></script>
  </body>
</html>
`;
}

// ── navigate.html list + sitemap entries ─────────────────────────────
function navigateList() {
  const items = [];
  for (let n = 1; n <= 114; n++)
    items.push(`<li><a href="/surah/${n}"><span class="n">${n}</span>${esc(names[String(n)].translit)}</a></li>`);
  return `<!-- static:surah-pages -->\n            <ul class="surah-page-list">\n              ${items.join("\n              ")}\n            </ul>\n            <!-- /static:surah-pages -->`;
}
function sitemapBlock(prior) {
  const old = new Map();
  for (const m of prior.matchAll(/<url>[\s\S]*?<loc>([^<]*)<\/loc>[\s\S]*?<\/url>/g)) old.set(m[1], m[0]);
  const urls = [];
  for (let n = 1; n <= 114; n++) {
    const loc = `${SITE}/surah/${n}`;
    const kept = old.get(loc);
    const lastmod = kept && /<lastmod>([^<]*)<\/lastmod>/.exec(kept);
    urls.push(
      `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod ? lastmod[1] : "2026-09-26"}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    );
  }
  return `  <!-- surah-pages (build-surah-pages.mjs) -->\n${urls.join("\n")}\n  <!-- /surah-pages -->`;
}

// ── write / check ────────────────────────────────────────────────────
const wanted = new Map();
for (let n = 1; n <= 114; n++) wanted.set(`surah/${n}.html`, pageFor(n));

const navPath = join(ROOT, "navigate.html");
const navHtml = readFileSync(navPath, "utf8");
if (!navHtml.includes("<!-- static:surah-pages -->")) throw new Error("navigate.html: static:surah-pages markers missing");
const navAfter = navHtml.replace(/<!-- static:surah-pages -->[\s\S]*?<!-- \/static:surah-pages -->/, navigateList());

const smPath = join(ROOT, "sitemap.xml");
const sm = readFileSync(smPath, "utf8");
const smAfter = sm.includes("<!-- surah-pages")
  ? sm.replace(/  <!-- surah-pages[\s\S]*?<!-- \/surah-pages -->/, sitemapBlock(sm))
  : sm.replace("</urlset>", `${sitemapBlock(sm)}\n</urlset>`);

const stale = [];
for (const [rel, html] of wanted) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs) || readFileSync(abs, "utf8") !== html) stale.push(rel);
}
const extra = existsSync(OUT) ? readdirSync(OUT).filter((f) => !wanted.has(`surah/${f}`)) : [];
if (navAfter !== navHtml) stale.push("navigate.html (surah-pages list)");
if (smAfter !== sm) stale.push("sitemap.xml (surah-pages entries)");

if (CHECK) {
  if (stale.length || extra.length) {
    console.error(`build-surah-pages --check: FAIL — ${stale.length + extra.length} stale: ${[...stale, ...extra].slice(0, 6).join(", ")}${stale.length + extra.length > 6 ? "…" : ""}`);
    console.error("  Run: node scripts/build-surah-pages.mjs");
    process.exit(1);
  }
  console.log(`build-surah-pages --check: OK (114 pages current)`);
} else {
  mkdirSync(OUT, { recursive: true });
  for (const [rel, html] of wanted) writeFileSync(join(ROOT, rel), html);
  for (const f of extra) unlinkSync(join(OUT, f));
  writeFileSync(navPath, navAfter);
  writeFileSync(smPath, smAfter);
  console.log(`build-surah-pages: 114 pages, ${stale.length} changed${extra.length ? `, ${extra.length} pruned` : ""}. Tanzil text ${textIndex.sha256.slice(0, 12)}.`);
}
