// build-formulas.mjs — deterministic, zero-dependency generator for
// data/formulas-root.json and data/formulas-surface.json.
//
// What this measures, precisely: every sequence of 3, 4, or 5 consecutive
// words that recurs (appears in two or more places) across the whole
// Qur'an, counted two ways in parallel:
//
//   - ROOT stream: sequences of consonantal roots, skipping words that
//     carry no root (particles, pronouns). Catches lexical formulas
//     whose surface inflection varies — e.g. "gardens beneath which
//     rivers flow" recurs with different case endings but one root
//     sequence.
//   - SURFACE stream: sequences of diacritic-stripped surface forms,
//     including particles. Catches particle-heavy liturgical formulas
//     (e.g. the "ya ayyuha alladhina amanu" address) that are invisible
//     to the root stream because their words carry no roots.
//
// Both streams are needed; each catches formulas the other cannot.
//
// What this deliberately does NOT claim: that recurrence makes a phrase
// an oral "formula" in the technical sense of oral-formulaic theory
// (that is a scholarly judgment about composition, argued in the
// literature — see Bannister 2014 on the Sources page), nor anything
// about why a phrase recurs. This file records only the mechanical
// fact of recurrence and where it occurs.
//
// No roots are excluded (unlike build-cooccurrence.mjs's frequency
// ceiling): a formula index that silently dropped high-frequency roots
// would miss exactly the most formulaic language.
//
// Run: node scripts/build-formulas.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const NS = [3, 4, 5];
const MIN_FREQ = 2;

const rootsSummary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);

// Strip Arabic diacritics/tatweel so surface identity ignores vocalization
// (which also drops tanwin/i'rab, the case endings that vary across
// otherwise-identical phrases).
function stripDiacritics(s) {
  return s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/ٱ/g, "ا"); // alif wasla -> plain alif
}

// token streams per verse: [{key, w}] where w = the Leeds word index of
// the token (for locating the phrase inside the verse).
function rootStream(words) {
  return words
    .filter((x) => x.root)
    .map((x) => ({ key: x.root, w: x.w }));
}
function surfaceStream(words) {
  return words.map((x) => ({ key: stripDiacritics(x.ar), w: x.w }));
}

function collect(streamFn, allPositions) {
  // seq join -> { n, seq, count, refs }
  // allPositions=false (surface): refs are [s, a, w] -- the first token's
  // position; the rest of the run is w..w+n-1 since surface tokens are
  // contiguous. allPositions=true (root): refs are [s, a, w1, w2, ...wn] --
  // every matched token's position, since root tokens skip particles and
  // pronouns and so are NOT contiguous; a single first-word index would
  // not identify which words to highlight.
  const grams = new Map();
  for (let s = 1; s <= 114; s++) {
    const morph = JSON.parse(
      readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
    );
    const verseNums = Object.keys(morph)
      .map(Number)
      .sort((a, b) => a - b);
    for (const a of verseNums) {
      const toks = streamFn(morph[String(a)] || []);
      for (const n of NS) {
        for (let i = 0; i + n <= toks.length; i++) {
          const window = toks.slice(i, i + n);
          const seq = window.map((t) => t.key);
          const id = n + "|" + seq.join("");
          let g = grams.get(id);
          if (!g) {
            g = { n, seq, count: 0, refs: [] };
            grams.set(id, g);
          }
          g.count++;
          g.refs.push(
            allPositions
              ? [s, a, ...window.map((t) => t.w)]
              : [s, a, window[0].w],
          );
        }
      }
    }
  }
  const kept = [...grams.values()].filter((g) => g.count >= MIN_FREQ);
  kept.sort(
    (x, y) =>
      y.count - x.count ||
      x.n - y.n ||
      x.seq.join("").localeCompare(y.seq.join("")),
  );
  return kept;
}

const methodShared =
  `every run of ${NS.join("/")} consecutive tokens occurring in ` +
  `${MIN_FREQ}+ places corpus-wide, with all verse locations. Purely ` +
  "mechanical counting from the bundled Leeds morphology — recurrence " +
  "is recorded, not interpreted; whether a recurring phrase is a " +
  '"formula" in the oral-formulaic sense is a scholarly judgment this ' +
  "site does not make (see Bannister 2014 for that literature).";

// ── ROOT stream ─────────────────────────────────────────────────────
const rootGrams = collect(rootStream, true).map((g) => ({
  n: g.n,
  seq: g.seq,
  display: g.seq.map((r) => rootsSummary[r]?.rootLatin || r).join(" · "),
  arabic: g.seq.map((r) => rootsSummary[r]?.rootArabic || "").join(" "),
  count: g.count,
  refs: g.refs,
}));

writeFileSync(
  join(ROOT, "data", "formulas-root.json"),
  JSON.stringify(
    {
      _generated: "build-formulas.mjs",
      _method:
        "ROOT stream: token = consonantal root; words with no root " +
        "(particles, pronouns) are skipped, so a root sequence may span " +
        "them. Because matched words are therefore not consecutive in " +
        "the verse, each ref is [surah, ayah, w1, w2, ...wN] — every " +
        "matched word's 1-based position, not just the first. Then " +
        methodShared,
      _params: { n: NS, minFreq: MIN_FREQ },
      totalRecurring: rootGrams.length,
      ngrams: rootGrams,
    },
  ) + "\n",
);

// ── SURFACE stream ──────────────────────────────────────────────────
const surfaceGrams = collect(surfaceStream, false).map((g) => ({
  n: g.n,
  seq: g.seq,
  display: g.seq.join(" "),
  count: g.count,
  refs: g.refs,
}));

writeFileSync(
  join(ROOT, "data", "formulas-surface.json"),
  JSON.stringify(
    {
      _generated: "build-formulas.mjs",
      _method:
        "SURFACE stream: token = diacritic-stripped surface form, all " +
        "words included (particles too), so matched words are always " +
        "consecutive. Each ref is [surah, ayah, w] — the first matched " +
        "word's 1-based position; the remaining n-1 words are w+1..w+n-1. " +
        "Then " + methodShared,
      _params: { n: NS, minFreq: MIN_FREQ },
      totalRecurring: surfaceGrams.length,
      ngrams: surfaceGrams,
    },
  ) + "\n",
);

for (const n of NS) {
  const r = rootGrams.filter((g) => g.n === n).length;
  const s = surfaceGrams.filter((g) => g.n === n).length;
  console.log(`${n}-grams recurring: root ${r}, surface ${s}`);
}
console.log(
  `top root 4-gram: ${rootGrams.find((g) => g.n === 4)?.display} (${rootGrams.find((g) => g.n === 4)?.count})`,
);
console.log(
  `top surface 4-gram: ${surfaceGrams.find((g) => g.n === 4)?.display} (${surfaceGrams.find((g) => g.n === 4)?.count})`,
);
