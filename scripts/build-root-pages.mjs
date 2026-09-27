#!/usr/bin/env node
//
// build-root-pages.mjs — one static, indexable reference page per root
// with at least MIN occurrences, at /root/<safeKey> (root/<safeKey>.html).
//
//   node scripts/build-root-pages.mjs           # write root/*.html
//   node scripts/build-root-pages.mjs --check   # exit 1 if any is stale
//
// Roots were readable only through /roots?root=<key>, rendered by
// JavaScript. Each page states the root's count and rank, how many verses
// and surahs it occurs in, its split by period and by classification,
// its lemmas and most frequent written forms, the surahs where it
// concentrates, the roots it keeps company with, and its first verses,
// every figure read from the committed data files.
//
// Only roots with MIN or more occurrences get a page: below that a page
// would be a handful of numbers, the thin kind search engines treat as
// doorway pages. Every root stays reachable in the Roots explorer.
//
// Shares the page frame with the surah and juz pages (scripts/lib/
// page-shell.mjs). Also writes roots.html's static:root-pages list and
// sitemap.xml's root-pages entries. Run before build-page-dates.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE } from "./lib/site.mjs";
import { safeKey } from "./lib/safe-key.mjs";
import { ordinal } from "./lib/ordinal.mjs";
import { readJson } from "./lib/io.mjs";
import { ROOT, ROOT_PAGE_MIN, esc, n0, PERIOD, badge, ar, posLabel, renderPage, replaceRegion, sitemapRegion, writeFamily } from "./lib/page-shell.mjs";

const MIN = ROOT_PAGE_MIN;
const CHECK = process.argv.includes("--check");

const summary = readJson("data/roots-summary.json");
const freq = readJson("data/exports/root-frequencies.json");
const lemmas = readJson("data/exports/lemma-frequencies.json");
const rootSurah = readJson("data/exports/root-surah-counts.json");
const names = readJson("data/surah-names.json");

const rank = new Map(freq.map((r, i) => [r.root, i + 1]));
const pageRoots = freq.filter((r) => r.totalCount >= MIN).map((r) => r.root);
const hasPage = new Set(pageRoots);
const lemmasByRoot = new Map();
for (const l of lemmas) if (l.root) (lemmasByRoot.get(l.root) || lemmasByRoot.set(l.root, []).get(l.root)).push(l);
const surahsByRoot = new Map();
for (const r of rootSurah) (surahsByRoot.get(r.root) || surahsByRoot.set(r.root, []).get(r.root)).push(r);

const rootHref = (bw) => (hasPage.has(bw) ? `/root/${safeKey(bw)}` : `/roots?root=${safeKey(bw)}`);

function pageFor(bw) {
  const sk = safeKey(bw);
  const s = summary[bw];
  const an = readJson(`data/root-analytics/${sk}.json`);
  const disp = readJson(`data/dispersion/${sk}.json`);
  const assoc = readJson(`data/association/${sk}.json`);
  const fr = freq.find((r) => r.root === bw);
  const lems = (lemmasByRoot.get(bw) || []).sort((a, b) => b.count - a.count);
  const where = (surahsByRoot.get(bw) || []).sort((a, b) => b.count - a.count || a.surah - b.surah).slice(0, 10);
  const verses = an.verses || [];
  const title = `Root ${s.rootLatin} (${s.rootArabic}), ${n0(s.totalCount)} occurrences · Divine Discourses`;
  const description =
    `The root ${s.rootLatin} (${s.rootArabic}) occurs ${n0(s.totalCount)} times in ${disp.surahsOccurringIn} surahs of the Qur'an, ` +
    `as ${lems.length} lemma${lems.length === 1 ? "" : "s"}. Forms, where it concentrates, and its companion roots.`;
  const url = `${SITE}/root/${sk}`;

  const facts = [
    ["Occurrences", n0(s.totalCount), badge("leeds-corpus-v0.4")],
    ["Rank among 1,642 roots", ordinal(rank.get(bw)), badge("leeds-corpus-v0.4")],
    ["Verses containing it", n0(verses.length), badge("leeds-corpus-v0.4")],
    ["Surahs containing it", `${disp.surahsOccurringIn} of 114`, badge("leeds-corpus-v0.4")],
    ["In Meccan / Medinan surahs", `${n0(an.makki)} / ${n0(an.madani)}`, badge("leeds-corpus-v0.4 quran-foundation-api-v4", "nuanced")],
    ...Object.keys(PERIOD).map((p) => [`${PERIOD[p]} (Cairo 1924 periods)`, n0(fr[`count_${p}`]), badge("leeds-corpus-v0.4 cairo-1924", "nuanced")]),
    ["As verbs / as nouns and adjectives", `${n0((s.posDistribution && s.posDistribution.V) || 0)} / ${n0(s.totalCount - ((s.posDistribution && s.posDistribution.V) || 0))}`, badge("leeds-corpus-v0.4")],
    ["Spread across surahs (DP, normalized)", `${disp.dpNorm} <span class="t-annotation">(0 even, 1 concentrated)</span>`, badge("leeds-corpus-v0.4 gries-dispersion-2008", "nuanced")],
    ["First occurrence", `<a href="/read?s=${s.firstOccurrence.surah}&amp;a=${s.firstOccurrence.verse}">${s.firstOccurrence.surah}:${s.firstOccurrence.verse}</a>`, badge("leeds-corpus-v0.4")],
  ]
    .map(([t, d, b]) => `<tr><th scope="row">${t}</th><td>${d} ${b}</td></tr>`)
    .join("\n              ");

  const lemmaRows = lems
    .slice(0, 12)
    .map((l) => `<tr><td>${ar(l.topForm)}</td><td>${esc(posLabel(l.pos))}</td><td class="count">${n0(l.count)}</td><td class="count">${n0(l.surahCount)}</td></tr>`)
    .join("");
  const forms = (an.derivedForms || [])
    .slice(0, 10)
    .map((f) => `<li>${ar(f.form)} <span class="t-annotation">${n0(f.count)}×</span></li>`)
    .join("");
  const whereItems = where
    .map((w) => `<li><a href="/surah/${w.surah}">${esc(names[String(w.surah)].translit)}</a> <span class="t-annotation">${n0(w.count)}× · ${w.perThousand} per 1,000 word-units</span></li>`)
    .join("");
  const partners = (assoc.partners || [])
    .slice(0, 8)
    .map((p) => `<li><a href="${rootHref(p.root)}">${ar(p.arabic)} ${esc(p.rootLatin)}</a> <span class="t-annotation">${n0(p.k11)} shared verses</span></li>`)
    .join("");
  const firstVerses = verses
    .slice(0, 6)
    .map((v) => {
      const [su, ay] = String(v).split(":");
      return `<li><a href="/read?s=${su}&amp;a=${ay}">${esc(names[su].translit)} ${su}:${ay}</a></li>`;
    })
    .join("");

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
        about: { "@type": "DefinedTerm", name: `${s.rootLatin} (${s.rootArabic})`, inDefinedTermSet: `${SITE}/roots` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Roots", item: `${SITE}/roots` },
          { "@type": "ListItem", position: 3, name: `Root ${s.rootLatin}`, item: url },
        ],
      },
    ],
  };

  const main = `      <nav class="surah-crumbs t-annotation" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/roots">Roots</a> › ${esc(s.rootLatin)}</nav>
      <h2 class="surah-title">Root ${esc(s.rootLatin)} ${ar(s.rootArabic)}</h2>
      <p class="lede">
        The root ${esc(s.rootLatin)} (${esc(s.rootArabic)}) occurs ${n0(s.totalCount)} times in the Qur'an,
        the ${ordinal(rank.get(bw))} most frequent of its 1,642 roots. It appears in ${n0(verses.length)} verses
        across ${disp.surahsOccurringIn} of the 114 surahs, as ${lems.length} lemma${lems.length === 1 ? "" : "s"}
        (dictionary headword${lems.length === 1 ? "" : "s"}).
      </p>
      <p class="surah-actions">
        <a class="button btn-primary" href="/roots?root=${sk}">Every occurrence</a>
        <a class="button secondary" href="/words?q=${encodeURIComponent(s.rootLatin)}">Its words</a>
      </p>

      <div class="grid">
        <section class="card" aria-labelledby="facts">
          <h3 id="facts">At a glance</h3>
          <table class="data surah-facts">
            <tbody>
              ${facts}
            </tbody>
          </table>
          <p class="prov t-annotation">Counts from the Leeds Quranic Arabic Corpus v0.4 root field. Period and Meccan/Medinan splits depend on a classification; the spread measure is one of several (<a href="/numbers#dispersion">Numbers</a>).</p>
        </section>

        <section class="card" aria-labelledby="lemmas">
          <h3 id="lemmas">Lemmas</h3>
          <table class="data">
            <thead><tr><th>Most common form</th><th>Part of speech</th><th class="count">Count</th><th class="count">Surahs</th></tr></thead>
            <tbody>${lemmaRows}</tbody>
          </table>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4")} Grouped by the corpus's lemma field. Every lemma is in the <a href="/export">lemma-frequencies</a> table.</p>
        </section>

        <section class="card" aria-labelledby="forms">
          <h3 id="forms">Most frequent written forms</h3>
          <ul class="surah-patterns root-forms">${forms}</ul>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4")} Surface forms, with attached prefixes and suffixes.</p>
        </section>

        <section class="card" aria-labelledby="where">
          <h3 id="where">Where it concentrates</h3>
          <ol class="surah-themes">${whereItems}</ol>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4")} The ten surahs with the most occurrences, with the rate per 1,000 of each surah's word-units.</p>
        </section>

        <section class="card" aria-labelledby="company">
          <h3 id="company">Roots it keeps company with</h3>
          <ul class="surah-themes">${partners}</ul>
          <p class="prov t-annotation">${badge("leeds-corpus-v0.4", "nuanced")} Ranked by log-likelihood of sharing a verse, one association measure among several (<a href="/roots?root=${sk}">explorer</a>).</p>
        </section>

        <section class="card" aria-labelledby="first">
          <h3 id="first">First verses, in mushaf order</h3>
          <ul class="surah-themes">${firstVerses}</ul>
        </section>
      </div>`;
  return renderPage({ title, description, url, og: `${SITE}/assets/og/site-og.png`, jsonld, mainClass: "surah-page", main });
}

function rootsList() {
  const items = pageRoots.map(
    (bw) => `<li><a href="/root/${safeKey(bw)}">${ar(summary[bw].rootArabic)} ${esc(summary[bw].rootLatin)} <span class="n">${n0(summary[bw].totalCount)}</span></a></li>`,
  );
  return `            <ul class="surah-page-list root-page-list">\n              ${items.join("\n              ")}\n            </ul>`;
}

const wanted = new Map(pageRoots.map((bw) => [`root/${safeKey(bw)}.html`, pageFor(bw)]));
const rootsHtml = readFileSync(join(ROOT, "roots.html"), "utf8");
const sm = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
writeFamily({
  script: "build-root-pages",
  dir: "root",
  wanted,
  edits: new Map([
    ["roots.html", replaceRegion(rootsHtml, "root-pages", rootsList(), "roots.html")],
    ["sitemap.xml", sitemapRegion(sm, "root-pages", pageRoots.map((bw) => `${SITE}/root/${safeKey(bw)}`), "0.5")],
  ]),
  check: CHECK,
});
