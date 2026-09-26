#!/usr/bin/env node
//
// build-juz-pages.mjs — one static, indexable reference page per juz at
// /juz/<n> (juz/<n>.html), built from data the site already ships.
//
//   node scripts/build-juz-pages.mjs           # write juz/*.html
//   node scripts/build-juz-pages.mjs --check   # exit 1 if any is stale
//
// A juz is the site's main listening unit, but it existed only as
// /read?j=<n>, rendered by JavaScript. Each page states where the juz
// starts and ends, how many verses and word-units it holds, which
// surahs it spans (whole or in part), its mushaf pages, and how long it
// takes with each reciter, with links into Read, Listen and the surah
// pages. No Arabic text here: it lives once, on the surah pages.
//
// Shares the page frame with build-surah-pages.mjs (scripts/lib/
// page-shell.mjs). Also writes navigate.html's static:juz-pages list and
// sitemap.xml's juz-pages entries. Run before build-page-dates.

import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "./lib/site.mjs";
import { readJson } from "./lib/io.mjs";
import { ROOT, esc, n0, badge, hm, range, ar, renderPage, replaceRegion, sitemapRegion, writeFamily } from "./lib/page-shell.mjs";

const CHECK = process.argv.includes("--check");
const juzList = readJson("data/juz.json").juz;
const names = readJson("data/surah-names.json");
const pace = readJson("data/recitation/pace.json");
const verseLengths = readJson("data/exports/verse-lengths.json");
const tokens = new Map(verseLengths.map((v) => [`${v.surah}:${v.verse}`, v.tokens]));

const text = new Map();
const surahText = (n) => {
  if (!text.has(n)) text.set(n, readJson(`data/quran-text/${n}.json`));
  return text.get(n);
};

function pageFor(j) {
  const n = j.juz;
  const parts = [];
  let verses = 0;
  let words = 0;
  const pages = [];
  for (let s = j.startSurah; s <= j.endSurah; s++) {
    const t = surahText(s);
    const from = s === j.startSurah ? j.startAyah : 1;
    const to = s === j.endSurah ? j.endAyah : t.numberOfAyahs;
    for (const a of t.ayahs) {
      if (a.numberInSurah < from || a.numberInSurah > to) continue;
      if (a.juz !== n) throw new Error(`juz ${n}: ${s}:${a.numberInSurah} is marked juz ${a.juz} in the text metadata`);
      verses++;
      words += tokens.get(`${s}:${a.numberInSurah}`);
      pages.push(a.page);
    }
    parts.push({ s, from, to, whole: from === 1 && to === t.numberOfAyahs, total: t.numberOfAyahs });
  }
  const a = names[String(j.startSurah)];
  const b = names[String(j.endSurah)];
  const span = `${a.translit} ${j.startSurah}:${j.startAyah} to ${b.translit} ${j.endSurah}:${j.endAyah}`;
  const title = `Juz ${n}: ${a.translit} ${j.startSurah}:${j.startAyah} to ${j.endSurah}:${j.endAyah} · Divine Discourses`;
  const description =
    `Juz ${n} of 30 runs from ${span}: ${n0(verses)} verses in ${parts.length} surah${parts.length === 1 ? "" : "s"}. ` +
    `Listening time per reciter, mushaf pages, read and listen links.`;
  const url = `${SITE}/juz/${n}`;
  const first = pace.reciters[0];
  const fastest = pace.reciters.reduce((m, r) => (pace.juzSeconds[r.id][n - 1] < pace.juzSeconds[m.id][n - 1] ? r : m));
  const rows = pace.reciters
    .map((r) => `<tr><td>${esc(r.name)}</td><td class="count">${hm(pace.juzSeconds[r.id][n - 1])}</td></tr>`)
    .join("");
  const surahItems = parts
    .map(
      (p) =>
        `<li><a href="/surah/${p.s}">${esc(names[String(p.s)].translit)} ${ar(names[String(p.s)].ar)}</a> ` +
        `<span class="t-annotation">${p.whole ? `whole surah, ${p.total} verses` : `verses ${p.from}–${p.to} of ${p.total}`}</span> · ` +
        `<a href="/read?s=${p.s}&amp;a=${p.from}-${p.to}">read</a></li>`,
    )
    .join("\n            ");
  const facts = [
    ["Starts", `${esc(a.translit)} ${j.startSurah}:${j.startAyah}`, badge("tanzil", "nuanced")],
    ["Ends", `${esc(b.translit)} ${j.endSurah}:${j.endAyah}`, badge("tanzil", "nuanced")],
    ["Verses", n0(verses), badge("tanzil")],
    ["Word-units", n0(words), badge("leeds-corpus-v0.4")],
    ["Surahs", `${parts.length} (${parts.filter((p) => p.whole).length} whole)`, ""],
    ["Mushaf pages (Madani 604-page)", range(pages), badge("tanzil alquran-cloud-api")],
  ]
    .map(([t, d, bd]) => `<tr><th scope="row">${t}</th><td>${d} ${bd}</td></tr>`)
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
        about: { "@type": "CreativeWork", name: `Juz ${n}`, position: n, isPartOf: { "@type": "Book", name: "The Qur'an" } },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Browse all 114 surahs", item: `${SITE}/navigate` },
          { "@type": "ListItem", position: 3, name: `Juz ${n}`, item: url },
        ],
      },
    ],
  };
  const main = `      <nav class="surah-crumbs t-annotation" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/navigate#juz">All juz</a> › Juz ${n}</nav>
      <h2 class="surah-title">Juz ${n}</h2>
      <p class="lede">
        Juz ${n} of 30 runs from ${esc(span)}. It holds ${n0(verses)} verses and
        ${n0(words)} word-units across ${parts.length} surah${parts.length === 1 ? "" : "s"}.
        With ${esc(first.name)} its recitation lasts about ${hm(pace.juzSeconds[first.id][n - 1])};
        with ${esc(fastest.name)}, about ${hm(pace.juzSeconds[fastest.id][n - 1])}.
      </p>
      <p class="surah-actions">
        <a class="button btn-primary" href="/read?j=${n}">Read this juz</a>
        <a class="button secondary" href="/read?j=${n}#listen">Listen</a>
      </p>

      <div class="grid">
        <section class="card" aria-labelledby="facts">
          <h3 id="facts">At a glance</h3>
          <table class="data surah-facts">
            <tbody>
              ${facts}
            </tbody>
          </table>
          <p class="prov t-annotation">Boundaries follow the standard Hafs division in the Tanzil metadata, a reading convention rather than part of the text. Word-units from the Leeds Quranic Arabic Corpus v0.4.</p>
        </section>

        <section class="card" aria-labelledby="listening">
          <h3 id="listening">Listening time</h3>
          <table class="data">
            <thead><tr><th>Reciter</th><th class="count">Whole juz</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="prov t-annotation">${badge("islamic-network-audio", "nuanced")} Measured from the audio files <a href="/read?j=${n}">Read</a> plays. A recording's pace, not a property of the text. <a href="/numbers#recitation-pace">How this is measured</a>.</p>
        </section>

        <section class="card" aria-labelledby="surahs">
          <h3 id="surahs">Surahs in this juz</h3>
          <ul class="surah-themes">
            ${surahItems}
          </ul>
        </section>
      </div>

      <nav class="surah-pager" aria-label="Neighboring juz">
        ${n > 1 ? `<a href="/juz/${n - 1}" rel="prev">‹ Juz ${n - 1}</a>` : "<span></span>"}
        <a href="/navigate#juz">All 30 juz</a>
        ${n < 30 ? `<a href="/juz/${n + 1}" rel="next">Juz ${n + 1} ›</a>` : "<span></span>"}
      </nav>`;
  return renderPage({
    title,
    description,
    url,
    og: `${SITE}/assets/og/site-og.png`,
    jsonld,
    mainClass: "surah-page",
    main,
  });
}

function navigateList() {
  const items = juzList.map((j) => `<li><a href="/juz/${j.juz}"><span class="n">${j.juz}</span>${esc(names[String(j.startSurah)].translit)} ${j.startSurah}:${j.startAyah}</a></li>`);
  return `            <ul class="surah-page-list">\n              ${items.join("\n              ")}\n            </ul>`;
}

const wanted = new Map(juzList.map((j) => [`juz/${j.juz}.html`, pageFor(j)]));
const navHtml = readFileSync(join(ROOT, "navigate.html"), "utf8");
const sm = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
if (!existsSync(join(ROOT, "data/recitation/pace.json"))) throw new Error("data/recitation/pace.json missing");
writeFamily({
  script: "build-juz-pages",
  dir: "juz",
  wanted,
  edits: new Map([
    ["navigate.html", replaceRegion(navHtml, "juz-pages", navigateList(), "navigate.html")],
    ["sitemap.xml", sitemapRegion(sm, "juz-pages", juzList.map((j) => `${SITE}/juz/${j.juz}`), "0.6")],
  ]),
  check: CHECK,
});
