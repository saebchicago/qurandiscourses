// arabic.mjs — the Arabic text normalizations two generators must share.
//
// WHY THIS EXISTS, and why it was easy to miss. build-formulas.mjs
// defined stripDiacritics(); build-rhyme-map.mjs's pausalForm() opened
// with the SAME two replaces, the same character class and the same
// alif-wasla fold, then added one rule of its own. A grep for the
// function name found one copy, because the other lives under a
// different name — a duplicated body is invisible to a search for the
// identifier.
//
// The two callers decide what counts as "the same word": build-formulas
// for n-gram identity, build-rhyme-map for the pausal form a verse ends
// in. If one gained a mark the other did not, the formulas dataset and
// the rhyme dataset would silently disagree about that question, with no
// checker able to see it — they are separate outputs, each internally
// consistent.

/**
 * Strip Arabic diacritics and tatweel so surface identity ignores
 * vocalization — which also drops tanwin and i'rab, the case endings
 * that vary across otherwise-identical phrases. Alif wasla folds to a
 * plain alif.
 */
export function stripDiacritics(s) {
  return s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/ٱ/g, "ا");
}

/**
 * The pausal form of a verse-final word: stripDiacritics plus the one
 * rule specific to pausa — a final ta marbuta is pronounced -ah.
 */
export function pausalForm(ar) {
  return stripDiacritics(ar).replace(/ة$/, "ه");
}
