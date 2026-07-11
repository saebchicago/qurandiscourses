// build-word-index.mjs — deterministic, zero-dependency generator for
// data/word-index.json: one entry per lemma in the Leeds morphology,
// powering the word search on words.html.
//
// Everything here is Leeds-corpus-derived (already cited as
// leeds-corpus-v0.4) EXCEPT the optional gloss strings, which are
// merged in from data/gloss/{surah}.json only when the owner has
// committed a licensed gloss dataset (see the maintainer guide, "Add
// word-by-word glosses", and docs/gloss-dataset-research.md). With
// data/gloss/ empty the index ships with empty gloss lists and the
// search works over Arabic / transliteration / root — never blocked on
// the license gate, never shipping unlicensed text.
//
// Entry shape (kept terse — ~4.8k entries):
//   { l: "buckwalter lemma", ar: "أَرَبِيّ", r: "root BW" | "",
//     rl: "r-o-ot latin" | "", pos: "N", n: 123,
//     refs: [[s,a], ...up to 8 first occurrences],
//     g: ["gloss", ...up to 5 distinct, most frequent first] }
//
// Run:  node scripts/build-word-index.mjs
// Determinism check: run twice, git diff must be empty.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// lemma → canonical Arabic rendering, where roots-summary carries one.
const rootsSummary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);
const lemmaArabic = new Map();
const rootLatin = new Map();
for (const [bw, r] of Object.entries(rootsSummary)) {
  rootLatin.set(bw, r.rootLatin || "");
  for (const tl of r.topLemmas || []) {
    if (tl.lemma && tl.lemmaArabic) lemmaArabic.set(tl.lemma, tl.lemmaArabic);
  }
}

// Optional licensed glosses (dormant until data/gloss/ is populated).
let glossSurahs = [];
try {
  glossSurahs = JSON.parse(
    readFileSync(join(ROOT, "data", "gloss", "index.json"), "utf8"),
  ).surahs || [];
} catch (e) {}
const glossFiles = new Map();
for (const s of glossSurahs) {
  glossFiles.set(s, JSON.parse(readFileSync(join(ROOT, "data", "gloss", `${s}.json`), "utf8")));
}

const lemmas = new Map();
for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );
  const gl = glossFiles.get(s);
  for (const a of Object.keys(morph)
    .filter((k) => !isNaN(+k))
    .map(Number)
    .sort((x, y) => x - y)) {
    const words = morph[String(a)];
    words.forEach((w, wi) => {
      if (!w.lemma) return;
      let e = lemmas.get(w.lemma);
      if (!e) {
        e = { l: w.lemma, surface: new Map(), r: w.root || "", pos: new Map(), n: 0, refs: [], g: new Map() };
        lemmas.set(w.lemma, e);
      }
      e.n++;
      e.surface.set(w.ar, (e.surface.get(w.ar) || 0) + 1);
      if (w.pos) e.pos.set(w.pos, (e.pos.get(w.pos) || 0) + 1);
      const last = e.refs[e.refs.length - 1];
      if (e.refs.length < 8 && !(last && last[0] === s && last[1] === a)) {
        e.refs.push([s, a]);
      }
      const gloss = (gl && gl[String(a)] && gl[String(a)][wi]) || w.gloss || null;
      if (gloss) e.g.set(gloss, (e.g.get(gloss) || 0) + 1);
    });
  }
}

function top(map, k) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, k)
    .map((x) => x[0]);
}

const entries = [...lemmas.values()]
  .sort((a, b) => b.n - a.n || (a.l < b.l ? -1 : 1))
  .map((e) => ({
    l: e.l,
    ar: lemmaArabic.get(e.l) || top(e.surface, 1)[0] || "",
    r: e.r,
    rl: rootLatin.get(e.r) || "",
    pos: top(e.pos, 1)[0] || "",
    n: e.n,
    refs: e.refs,
    g: top(e.g, 5),
  }));

const glossed = entries.filter((e) => e.g.length).length;
writeFileSync(
  join(ROOT, "data", "word-index.json"),
  JSON.stringify({ _source: "leeds-corpus-v0.4", lemmas: entries }) + "\n",
);
console.log(
  `word-index: ${entries.length} lemmas, ${entries.reduce((t, e) => t + e.n, 0)} tokens, ` +
    `${glossed} lemmas carry glosses (gloss surahs available: ${glossSurahs.length})`,
);
