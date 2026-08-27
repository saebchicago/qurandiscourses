// build-name-mentions.mjs — the proper-noun mention index.
//
//   node scripts/build-name-mentions.mjs           # rewrite
//   node scripts/build-name-mentions.mjs --check   # exit 1 if stale
//
// Emits data/name-mentions.json from the bundled Leeds morphology:
// every token with pos=PN, grouped by Buckwalter lemma, with per-surah
// counts. This is the only route to the Qur'an's proper names — persons,
// places, the divine name, eschatological names — because PN lemmas
// almost all carry an EMPTY root in the corpus (Firʿawn, Mūsā, Nūḥ are
// not Arabic-root-derived), so the site's root-keyed machinery (themes,
// roots, cooccurrence, dispersion) can never see them. Consumed by the
// history reading lens (assets/lenses.js) on read/dossier/replay.
//
// Determinism: lemmas sorted lexicographically, bySurah keys ascending
// numeric, no date stamp. Run twice; git diff must be empty. `ar` is the
// lemma's most frequent surface form, ties broken by first corpus
// occurrence, so the display form is stable under re-runs.
//
// check-names.mjs (separate, in CI) validates this file's internal
// consistency and that the editorial display map (data/names.json) only
// labels lemmas that exist here.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const lemmas = new Map(); // lemma -> { forms: Map(ar -> {count, first}), bySurah: Map, total }
let seq = 0;

for (let s = 1; s <= 114; s++) {
  const verses = JSON.parse(
    readFileSync(join(ROOT, `data/morphology/${s}.json`), "utf8"),
  );
  for (const verse of Object.keys(verses)) {
    for (const token of verses[verse]) {
      if (token.pos !== "PN" || !token.lemma) continue;
      seq++;
      let e = lemmas.get(token.lemma);
      if (!e) {
        e = { forms: new Map(), bySurah: new Map(), total: 0 };
        lemmas.set(token.lemma, e);
      }
      e.total++;
      e.bySurah.set(s, (e.bySurah.get(s) || 0) + 1);
      let f = e.forms.get(token.ar);
      if (!f) {
        f = { count: 0, first: seq };
        e.forms.set(token.ar, f);
      }
      f.count++;
    }
  }
}

const out = {
  _source: "leeds-corpus-v0.4",
  _method:
    "Every token with pos=PN in data/morphology/{1..114}.json, grouped by " +
    "Buckwalter lemma. ar is the lemma's most frequent surface form, ties " +
    "broken by first corpus occurrence; bySurah counts tokens per surah. " +
    "PN covers all proper names — persons, places, the divine name, " +
    "eschatological names — and PN lemmas mostly carry empty roots in the " +
    "corpus, so this index is the only route to them. Counts measure " +
    "distribution, not meaning, and a name's absence is never a story's " +
    "absence.",
  lemmas: {},
};

for (const lemma of [...lemmas.keys()].sort()) {
  const e = lemmas.get(lemma);
  let bestAr = null;
  let best = null;
  for (const [ar, f] of e.forms) {
    if (!best || f.count > best.count || (f.count === best.count && f.first < best.first)) {
      best = f;
      bestAr = ar;
    }
  }
  const bySurah = {};
  for (const s of [...e.bySurah.keys()].sort((a, b) => a - b)) {
    bySurah[String(s)] = e.bySurah.get(s);
  }
  out.lemmas[lemma] = {
    ar: bestAr,
    total: e.total,
    surahCount: e.bySurah.size,
    bySurah,
  };
}

const json = JSON.stringify(out, null, 1) + "\n";
const abs = join(ROOT, "data/name-mentions.json");
let current = null;
try {
  current = readFileSync(abs, "utf8");
} catch {
  current = null;
}

const summary = `${Object.keys(out.lemmas).length} lemmas, ${seq} PN tokens`;
if (CHECK) {
  if (current !== json) {
    console.error("build-name-mentions --check: FAIL");
    console.error("  - data/name-mentions.json is stale. Run: node scripts/build-name-mentions.mjs");
    process.exit(1);
  }
  console.log(`build-name-mentions --check: OK (${summary})`);
} else {
  writeFileSync(abs, json);
  console.log(
    `build-name-mentions: ${summary} -> data/name-mentions.json` +
      (current === json ? " (no change)" : ""),
  );
}
