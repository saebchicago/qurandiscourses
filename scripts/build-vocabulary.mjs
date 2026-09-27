#!/usr/bin/env node
//
// build-vocabulary.mjs — the core-vocabulary track: the smallest set of
// lemmas that accounts for 80% of the Qur'an's lemmatized word-units,
// ranked by frequency, with a first example of each in context.
//
//   node scripts/build-vocabulary.mjs           # write
//   node scripts/build-vocabulary.mjs --check   # exit 1 if stale
//
// Writes data/vocabulary.json (read by assets/vocabulary.js for the
// practice cards) and vocabulary.html's static:vocab-milestones and
// static:vocab-list regions, so the whole list reads with JavaScript off.
//
// The denominator is every word-unit that carries a lemma in the Leeds
// corpus: 74,122 of the 77,429. The rest are standalone pronouns and the
// disconnected letters that open 29 surahs, which the corpus gives no
// lemma. Counted, not estimated; the script throws if the figures drift
// from the lemma-frequencies export it builds on.
//
// No meanings are bundled. For each lemma the example is the first
// place, in mushaf order, where its most common written form occurs;
// the practice cards fetch the Quran.com word-by-word English for that
// one word at runtime, as Read does, and label it as one contextual
// rendering.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./lib/io.mjs";
import { safeKey } from "./lib/safe-key.mjs";
import { TOTAL_TOKENS } from "./lib/corpus.mjs";
import { ROOT, ROOT_PAGE_MIN, esc, n0, ar, posLabel, replaceRegion } from "./lib/page-shell.mjs";

const CHECK = process.argv.includes("--check");
const TARGET = 0.8;
const MILESTONES = [0.5, 0.7, 0.8, 0.9];

const lemmas = readJson("data/exports/lemma-frequencies.json");
const summary = readJson("data/roots-summary.json");
const freq = readJson("data/exports/root-frequencies.json");
const rootCount = new Map(freq.map((r) => [r.root, r.totalCount]));

// Walk the corpus once: lemmatized total, and the first occurrence of
// each (lemma, written form) pair in mushaf order.
let lemmatized = 0;
let unlemmatized = 0;
const firstAt = new Map(); // lemma \u0000 form -> "s:a:w"
for (let s = 1; s <= 114; s++) {
  const m = readJson(`data/morphology/${s}.json`);
  const verses = Object.keys(m).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b);
  for (const a of verses) {
    for (const w of m[a]) {
      if (!w.lemma) {
        unlemmatized++;
        continue;
      }
      lemmatized++;
      const key = `${w.lemma}\u0000${w.ar}`;
      if (!firstAt.has(key)) firstAt.set(key, `${s}:${a}:${w.w}`);
    }
  }
}
const exportTotal = lemmas.reduce((t, l) => t + l.count, 0);
if (exportTotal !== lemmatized) throw new Error(`lemma-frequencies sums to ${exportTotal}, morphology has ${lemmatized} lemmatized word-units`);
if (lemmatized + unlemmatized !== TOTAL_TOKENS) throw new Error(`${lemmatized} + ${unlemmatized} != ${TOTAL_TOKENS}`);

// lemma-frequencies is already sorted by count desc, then lemma.
const cut = [];
const milestones = [];
let cum = 0;
for (const [i, l] of lemmas.entries()) {
  const before = cum;
  cum += l.count;
  for (const t of MILESTONES) if (before / lemmatized < t && cum / lemmatized >= t) milestones.push({ share: t, lemmas: i + 1, units: cum });
  if (before / lemmatized < TARGET) cut.push({ ...l, cum });
}
const N = cut.length;

const rows = cut.map((l, i) => {
  const at = firstAt.get(`${l.lemma}\u0000${l.topForm}`);
  if (!at) throw new Error(`no occurrence of ${l.lemma} as ${l.topForm}`);
  const s = l.root ? summary[l.root] : null;
  return {
    rank: i + 1,
    lemma: l.lemma,
    form: l.topForm,
    // Tags come most frequent first (build-exports.mjs); the page shows the
    // main one and how many others the corpus also assigns this lemma.
    pos: posLabel(l.pos.split("/")[0]),
    posOther: l.pos.split("/").length - 1,
    root: l.root || "",
    rootLatin: s ? s.rootLatin : "",
    rootArabic: s ? s.rootArabic : "",
    rootHref: l.root ? (rootCount.get(l.root) >= ROOT_PAGE_MIN ? `/root/${safeKey(l.root)}` : `/roots?root=${safeKey(l.root)}`) : "",
    count: l.count,
    cum: +((100 * l.cum) / lemmatized).toFixed(1),
    at,
  };
});

const pct = (x) => `${((100 * x) / lemmatized).toFixed(1)}%`;
const data = {
  _source:
    "Leeds Quranic Arabic Corpus v0.4 via data/exports/lemma-frequencies.json and data/morphology/. Built by scripts/build-vocabulary.mjs. Meanings are not bundled.",
  wordUnits: TOTAL_TOKENS,
  lemmatized,
  unlemmatized,
  target: TARGET,
  milestones,
  // rank, lemma (Buckwalter), most common written form, main part of
  // speech and how many other tags the lemma also carries,
  // root (Latin), root link, count, cumulative % of lemmatized word-units,
  // first occurrence of that form (surah:verse:word).
  columns: ["rank", "lemma", "form", "pos", "posOther", "rootLatin", "rootHref", "count", "cum", "at"],
  lemmas: rows.map((r) => [r.rank, r.lemma, r.form, r.pos, r.posOther, r.rootLatin, r.rootHref, r.count, r.cum, r.at]),
};

const milestoneRows = milestones
  .map(
    (m) =>
      `<tr><td>${Math.round(m.share * 100)}%</td><td class="count">${n0(m.lemmas)}</td><td class="count">${n0(m.units)}</td></tr>`,
  )
  .join("\n                ");
const milestonesHtml = `              <table class="data">
                <thead><tr><th>Share of lemmatized word-units</th><th class="count">Lemmas needed</th><th class="count">Word-units they cover</th></tr></thead>
                <tbody>
                ${milestoneRows}
                </tbody>
              </table>`;

const listRows = rows
  .map((r) => {
    const [s, a] = r.at.split(":");
    const root = r.root ? `<a href="${r.rootHref}">${esc(r.rootLatin)}</a>` : `<span class="t-annotation">none</span>`;
    return `<tr id="v${r.rank}"><td class="count">${r.rank}</td><td>${ar(r.form)}</td><td>${esc(r.pos)}${r.posOther ? `<br><span class="t-annotation">and ${r.posOther} other tag${r.posOther === 1 ? "" : "s"}</span>` : ""}</td><td>${root}</td><td class="count">${n0(r.count)}</td><td class="count">${r.cum}%</td><td><a href="/read?s=${s}&amp;a=${a}">${s}:${a}</a></td></tr>`;
  })
  .join("\n                ");
const listHtml = `              <table class="data vocab-table">
                <thead><tr><th class="count">#</th><th>Most common form</th><th>Part of speech</th><th>Root</th><th class="count">Count</th><th class="count">Running total</th><th>First seen</th></tr></thead>
                <tbody>
                ${listRows}
                </tbody>
              </table>`;

const ledeHtml = `          A small set of words carries most of the Qur'an. Of its
          <span data-num="totals.tokens">${n0(TOTAL_TOKENS)}</span> word-units in the Leeds corpus,
          ${n0(lemmatized)} carry a lemma (a dictionary headword); the other
          ${n0(unlemmatized)} are standalone pronouns and the disconnected letters
          that open 29 surahs. The ${N} most frequent lemmas account for
          ${Math.round(TARGET * 100)}% of those ${n0(lemmatized)}.
          <span class="badge ok" data-source-ids="leeds-corpus-v0.4" aria-label="Verified" tabindex="0" title="Verified · computed from the cited source">●</span>`;

let html = readFileSync(join(ROOT, "vocabulary.html"), "utf8");
// The title, description and list heading name the count; hold them to it.
for (const needle of [`<title>Core Qur'an vocabulary: ${N} lemmas, ${Math.round(TARGET * 100)}% of lemmatized words`, `The ${N} most frequent lemmas account for ${Math.round(TARGET * 100)}%`, `The ${N} lemmas, most frequent first`])
  if (!html.includes(needle)) throw new Error(`vocabulary.html: expected "${needle}" (the count changed; update the page's hand-written text)`);
html = replaceRegion(html, "vocab-lede", ledeHtml, "vocabulary.html");
html = replaceRegion(html, "vocab-milestones", milestonesHtml, "vocabulary.html");
html = replaceRegion(html, "vocab-list", listHtml, "vocabulary.html");
const json = JSON.stringify(data) + "\n";

const stale = [];
if (readFileSync(join(ROOT, "vocabulary.html"), "utf8") !== html) stale.push("vocabulary.html");
let old = "";
try {
  old = readFileSync(join(ROOT, "data/vocabulary.json"), "utf8");
} catch {}
if (old !== json) stale.push("data/vocabulary.json");
if (CHECK) {
  if (stale.length) {
    console.error(`build-vocabulary --check: FAIL — stale: ${stale.join(", ")}\n  Run: node scripts/build-vocabulary.mjs`);
    process.exit(1);
  }
  console.log(`build-vocabulary --check: OK (${N} lemmas cover ${pct(cut[N - 1].cum)})`);
} else {
  writeFileSync(join(ROOT, "vocabulary.html"), html);
  writeFileSync(join(ROOT, "data/vocabulary.json"), json);
  console.log(`build-vocabulary: ${N} lemmas cover ${pct(cut[N - 1].cum)} of ${n0(lemmatized)} lemmatized word-units; ${stale.length} file(s) changed.`);
}
