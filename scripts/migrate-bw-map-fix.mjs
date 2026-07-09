// migrate-bw-map-fix.mjs — one-time migration patching the "ar"/"lemmaArabic"
// fields already committed under data/, to match what build-leeds.js would
// have produced had its BW_MAP always included the 14 extended Quranic-
// Uthmani characters it was missing (see scripts/build-leeds.js history).
//
// Why a patch script and not a re-run of build-leeds.js: build-leeds.js
// reads scripts/leeds-raw.txt, the raw Leeds corpus dump, which is
// gitignored and not present in every checkout. This script instead fixes
// the two files build-leeds.js produces directly (data/morphology/*.json,
// data/roots-summary.json) by applying the exact same character-for-
// character substitution the corrected BW_MAP now performs — restricted to
// the fields those characters can legitimately appear in as *encoded*
// Buckwalter (never touches data/morphology/*.json's "lemma" field, which
// intentionally stores raw Buckwalter text for corpus.quran.com lookups,
// not display Arabic).
//
// Downstream generators (build-roots-index.py, build-root-analytics.mjs,
// build-rhetorical-features.mjs) read from the two files this script
// patches, so re-run them after this script to propagate the fix — see
// docs/maintainer-guide.md.
//
// This script is idempotent: running it again on already-patched data is a
// no-op (none of the 14 characters remain to match).
//
// Run once: node scripts/migrate-bw-map-fix.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Must match the 14 entries added to BW_MAP in build-leeds.js.
const FIX_MAP = {
  "^": "ٓ",
  "#": "ٔ",
  ":": "ۜ",
  "@": "۟",
  '"': "۠",
  "[": "ۢ",
  ";": "ۣ",
  ",": "ۥ",
  ".": "ۦ",
  "!": "ۨ",
  "-": "۪",
  "+": "۫",
  "%": "۬",
  "]": "ۭ",
};
const FIX_RE = new RegExp(
  "[" + Object.keys(FIX_MAP).map((c) => "\\" + c).join("") + "]",
  "g",
);

function fix(s) {
  return s.replace(FIX_RE, (ch) => FIX_MAP[ch]);
}

// Only touch a JSON value if it actually contains Arabic script text —
// guards against ever touching a field that happens to hold plain
// Buckwalter (like morphology's "lemma"), even by future accident.
function isArabicText(s) {
  return typeof s === "string" && /[؀-ۿ]/.test(s);
}

let morphChanged = 0;
let morphWords = 0;
for (let s = 1; s <= 114; s++) {
  const path = join(ROOT, "data", "morphology", `${s}.json`);
  const data = JSON.parse(readFileSync(path, "utf8"));
  let fileChanged = 0;
  for (const words of Object.values(data)) {
    for (const w of words) {
      if (isArabicText(w.ar) && FIX_RE.test(w.ar)) {
        w.ar = fix(w.ar);
        fileChanged++;
      }
    }
  }
  if (fileChanged) {
    writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
    morphChanged += fileChanged;
  }
  morphWords += Object.values(data).flat().length;
}
console.log(
  `data/morphology: patched ${morphChanged} word "ar" fields (of ${morphWords} total words)`,
);

const summaryPath = join(ROOT, "data", "roots-summary.json");
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
let lemmaChanged = 0;
for (const root of Object.values(summary)) {
  for (const tl of root.topLemmas || []) {
    if (isArabicText(tl.lemmaArabic) && FIX_RE.test(tl.lemmaArabic)) {
      tl.lemmaArabic = fix(tl.lemmaArabic);
      lemmaChanged++;
    }
  }
}
writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
console.log(`data/roots-summary.json: patched ${lemmaChanged} lemmaArabic fields`);
