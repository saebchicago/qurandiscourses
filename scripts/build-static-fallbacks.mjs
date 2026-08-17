// build-static-fallbacks.mjs — fill the page regions that used to say
// "Loading…" with the real content, generated from the same bundled data
// the page's JavaScript reads at runtime.
//
//   node scripts/build-static-fallbacks.mjs           # rewrite
//   node scripts/build-static-fallbacks.mjs --check   # exit 1 if stale
//
// Three regions were lists or facts that a browser could have had
// immediately and instead waited for a fetch to produce. With scripts
// off they never arrived at all: navigate.html showed "Loading juz…"
// forever, dossier.html never listed a single surah, and the home page's
// daily card stayed three grey lines. Now the markup ships filled in and
// the page's own JS overwrites it, which is the ordinary enhancement
// order rather than a fallback bolted on.
//
// Regions are delimited by <!-- static:NAME --> … <!-- /static:NAME -->.
// Everything between the markers is generated, so hand edits inside them
// are lost; edit the generator. Numbers here (verse counts, root counts)
// come from data/, so they cannot drift from the figures the rest of the
// site publishes. Deterministic: run twice, `git diff` is empty.
//
// NOT covered, deliberately: compare.html and export.html compute their
// results in the browser from a fetched corpus. There is no static form
// of a comparison that has not been computed, so those pages say so
// instead of rendering a form that cannot work. Zero dependencies.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readJson } from "./lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const juz = readJson("data/juz.json").juz;
const names = readJson("data/surah-names.json");
const meta = readJson("data/surah-meta.json").surahs;
const profiles = readJson("data/surah-profiles.json").surahs;

const esc = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const translit = (n) => names[String(n)].translit;
const ar = (v) =>
  `<span class="ar notranslate" translate="no" lang="ar" dir="rtl">${esc(v)}</span>`;

// ── navigate.html: the 30 juz ────────────────────────────────────────
// Same markup and same href the page's own renderer produces, so the
// grid does not reflow when the fetch lands.
const juzGrid = juz
  .map((j) => {
    const range =
      j.startSurah === j.endSurah
        ? `${translit(j.startSurah)} ${j.startSurah}:${j.startAyah}–${j.endAyah}`
        : `${translit(j.startSurah)} ${j.startSurah}:${j.startAyah} → ${j.endSurah}:${j.endAyah}`;
    return (
      // ?j= reads the WHOLE juz. These cells used to advertise a span
      // like "78:1 → 114:6" and link to 78:1 alone.
      `<a class="juz-cell" href="/read?j=${j.juz}">` +
      `<span class="juz-n">Juz ${j.juz}</span>` +
      `<span class="juz-range">${esc(range)}</span>` +
      `</a>`
    );
  })
  .join("\n            ");

// ── dossier.html: all 114 surahs ─────────────────────────────────────
// surah-names.json carries a "_comment" key alongside the 114 numbered
// ones, so the ids are filtered rather than assumed.
const surahPicker = Object.keys(names)
  .filter((k) => /^\d+$/.test(k))
  .map(Number)
  .sort((a, b) => a - b)
  .map(
    (n) =>
      `<li><a href="/dossier?s=${n}"><span class="n">${n}</span>${esc(translit(n))}</a></li>`,
  )
  .join("\n            ");

// ── index.html: the daily card ───────────────────────────────────────
// The card's passage rotates by UTC day, which only a script can know.
// Surah 1 is the standing answer to "where do I start", so the markup
// ships it, says plainly that the rotation needs scripts, and carries a
// real fact and a real citation rather than a placeholder.
const DEFAULT_SURAH = 1;
const dm = meta[String(DEFAULT_SURAH)];
const dp = profiles[String(DEFAULT_SURAH)];
const dn = names[String(DEFAULT_SURAH)];
const topRoot = dp.topRoots[0];

const dailyIntro =
  `<strong>Surah ${DEFAULT_SURAH} · ${esc(dn.translit)}</strong> ` +
  `(${ar(dn.ar)}), “${esc(dn.en)}”, ${dm.versesCount} verses, ` +
  `${dm.classification === "makki" ? "Meccan" : "Medinan"}. ` +
  `A different passage is chosen each day in the browser; with ` +
  `JavaScript off, this is where to start.`;

const dailyLens =
  `Its most repeated root: ${ar(topRoot.rootArabic)} ` +
  `(${esc(topRoot.rootLatin)}), appearing ${topRoot.count}×.`;

const dailyProv =
  `<span class="badge ok" data-source-ids="leeds-corpus-v0.4" aria-label="Verified" ` +
  `tabindex="0" title="Verified · computed from the cited corpus">●</span> ` +
  `Root frequency from the Leeds Quranic Arabic Corpus v0.4.`;

const dailyLinks =
  `<a id="dailyReadLink" class="button" href="/read?s=${DEFAULT_SURAH}&amp;a=1"\n` +
  `              >Read this surah</a\n            >\n` +
  `            <a id="dailyDossierLink" class="button secondary" href="/dossier?s=${DEFAULT_SURAH}"\n` +
  `              >Its full dossier</a\n            >\n` +
  `            <a id="dailyLensLink" class="button secondary" href="/roots?root=${encodeURIComponent(topRoot.root)}"\n` +
  `              >Explore this root</a\n            >`;

// ── apply ─────────────────────────────────────────────────────────────

// credits.html contributor roster, from the registry.
const contributors = readJson("data/contributors.json").contributors;
const roster = contributors
  .map((c) => {
    const name = c.url
      ? `<a href="${esc(c.url)}" rel="noopener">${esc(c.name)}</a>`
      : esc(c.name);
    return `<li>${name}: ${esc(c.role)}</li>`;
  })
  .join("\n            ");

const REGIONS = [
  ["navigate.html", "juz-grid", juzGrid],
  ["dossier.html", "surah-picker", surahPicker],
  ["index.html", "daily-intro", dailyIntro],
  ["index.html", "daily-lens", dailyLens],
  ["index.html", "daily-prov", dailyProv],
  ["index.html", "daily-links", dailyLinks],
  ["credits.html", "contributors", roster],
];

const failures = [];
const writes = new Map();

for (const [file, name, body] of REGIONS) {
  const abs = join(ROOT, file);
  const before = writes.get(abs) ?? readFileSync(abs, "utf8");
  const open = `<!-- static:${name} -->`;
  const close = `<!-- /static:${name} -->`;
  const i = before.indexOf(open);
  const j = before.indexOf(close);
  if (i === -1 || j === -1 || j < i) {
    failures.push(`${file}: no ${open} … ${close} region`);
    continue;
  }
  const after =
    before.slice(0, i + open.length) + "\n            " + body + "\n            " + before.slice(j);
  writes.set(abs, after);
}

const changed = [...writes].filter(([abs, text]) => text !== readFileSync(abs, "utf8"));

if (CHECK) {
  for (const [abs] of changed)
    failures.push(`${abs.slice(ROOT.length + 1)}: static region is stale`);
  if (failures.length) {
    console.error("build-static-fallbacks --check: FAIL");
    for (const f of failures) console.error("  - " + f);
    console.error("  Run: node scripts/build-static-fallbacks.mjs");
    process.exit(1);
  }
  console.log(`build-static-fallbacks --check: OK (${REGIONS.length} regions current)`);
} else {
  if (failures.length) {
    console.error("build-static-fallbacks: FAIL");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  for (const [abs, text] of changed) writeFileSync(abs, text);
  console.log(
    `build-static-fallbacks: ${REGIONS.length} regions written (${changed.length} file(s) changed).`,
  );
}
