// build-rhetorical-features.mjs — deterministic, zero-dependency generator
// for data/rhetorical-features.json, which backs the browsable detail on
// Patterns' "Other documented features" card.
//
// Each feature below is detected mechanically from the bundled Leeds
// morphology (lemma sequences or POS tags) — no interpretation, only a
// literal search. The counts here must match the numbers already cited in
// patterns.html; if they don't, the citation (not this script) is wrong
// and needs to be corrected.
//
// Run: node scripts/build-rhetorical-features.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// "ya ayyuha al-ladhina amanu" — O you who believe — as three consecutive
// word lemmas. Matches the existing "89 verses" claim in patterns.html.
const DIRECT_ADDRESS_LEMMAS = [">ay~uhaA", "{l~a*iY", "'aAmana"];

const directAddress = [];
const fawatih = [];

for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );

  for (const [a, words] of Object.entries(morph)) {
    const lemmas = words.map((w) => w.lemma || "");
    for (let i = 0; i <= lemmas.length - 3; i++) {
      if (
        lemmas[i] === DIRECT_ADDRESS_LEMMAS[0] &&
        lemmas[i + 1] === DIRECT_ADDRESS_LEMMAS[1] &&
        lemmas[i + 2] === DIRECT_ADDRESS_LEMMAS[2]
      ) {
        directAddress.push({ s, a: Number(a) });
      }
    }
  }

  // Fawatih: disconnected letters opening a surah. The Leeds corpus tags
  // these words POS "INL". Surah 42 splits its combination across verses
  // 1 and 2 (ha-mim, then ain-sin-qaf) — both are collected so its combo
  // reads distinctly from the plain ha-mim surahs (40, 41, 43-46).
  const v1 = morph["1"] || [];
  const inl1 = v1.filter((w) => w.pos === "INL");
  if (inl1.length) {
    let letters = inl1.map((w) => w.ar).join("");
    let verses = [1];
    const v2 = morph["2"] || [];
    const inl2 = v2.filter((w) => w.pos === "INL");
    if (inl2.length) {
      letters += " " + inl2.map((w) => w.ar).join("");
      verses.push(2);
    }
    fawatih.push({ s, verses, letters });
  }
}

directAddress.sort((a, b) => a.s - b.s || a.a - b.a);
fawatih.sort((a, b) => a.s - b.s);

const uniqueCombos = new Set(fawatih.map((f) => f.letters));

const out = {
  _generated: "build-rhetorical-features.mjs",
  directAddress: {
    phrase: "ya ayyuha al-ladhina amanu",
    translation: "O you who believe",
    count: directAddress.length,
    verses: directAddress,
  },
  fawatih: {
    surahCount: fawatih.length,
    uniqueCombinations: uniqueCombos.size,
    entries: fawatih,
  },
};

writeFileSync(
  join(ROOT, "data", "rhetorical-features.json"),
  JSON.stringify(out, null, 1) + "\n",
);

console.log(
  `Believers' vocative (ya ayyuha al-ladhina amanu): ${directAddress.length} verses (patterns.html claims 89)`,
);
console.log(
  `Fawatih: ${fawatih.length} surahs, ${uniqueCombos.size} unique combinations (numbers.html claims 29 surahs, 14 combinations)`,
);
