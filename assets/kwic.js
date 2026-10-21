/* Key word in context: the one place that cuts a word's neighbours out of a
 * verse. Used by the Roots concordance (window 5) and the Query page
 * (window 3), so the two cannot disagree about what "context" means.
 *
 * Context stops at the verse boundary on purpose: a window that ran into the
 * next verse would present text as adjacent that the verse division
 * separates. Words are shown exactly as segmented in the morphology file.
 */
(function (root) {
  "use strict";

  // words: the verse's tokens from data/morphology/{surah}.json; i: index of
  // the key token; win: words wanted on each side.
  function context(words, i, win) {
    return {
      before: words.slice(Math.max(0, i - win), i).map(function (x) { return x.ar; }),
      key: words[i].ar,
      after: words.slice(i + 1, i + 1 + win).map(function (x) { return x.ar; }),
    };
  }

  root.qdKwic = { context: context };
  if (typeof module !== "undefined" && module.exports) module.exports = root.qdKwic;
})(typeof window !== "undefined" ? window : globalThis);
