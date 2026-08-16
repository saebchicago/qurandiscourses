// corpus.mjs — the size of the corpus, in one place.
//
// These four numbers are the denominators under most of what this site
// publishes: normalized frequency per 1,000 tokens, keyness, dispersion,
// every "N of 114" coverage percentage. They were declared as literals
// in eight generators — twelve declarations of three numbers — and in a
// checker, which is fifteen copies that nothing held against each other.
//
// HOW BADLY A DRIFTED CONSTANT ACTUALLY FAILS, measured rather than
// assumed — the answer is narrower than it first looks, and worth
// recording so nobody re-derives it:
//
//   TOTAL_ROOTS   all four consumers ERROR. They carry their own count
//                 assertions, so the drift is loud.
//   TOTAL_TOKENS  both consumers ERROR, on build-exports.mjs's baseline
//                 check against data/numbers.json totals.
//   TOTAL_VERSES  build-exports.mjs errors, but build-cooccurrence.mjs
//                 SILENTLY rewrites all 1,642 co-occurrence files with
//                 different PMI values — TOTAL_VERSES is the N in that
//                 computation, and nothing downstream re-derives it.
//                 This is the one genuinely quiet case, and it feeds
//                 roots.html's "Distinctive partners (PMI)" panel.
//
// So the pipeline is better defended than a bare count of copies
// suggests; the reason to centralize is not that every drift is silent
// but that fifteen copies of three numbers had nothing holding them
// against each other, and one of them fails without saying so.
//
// The same asymmetry is why the bare loop bounds (`s <= 114`, in
// twenty-five scripts) deliberately stay where they are: a wrong loop
// bound reads a file that does not exist and fails immediately, so
// converting them would be churn for a class of bug that already
// announces itself.
//
// WHY THESE ARE FROZEN LITERALS AND MUST STAY THAT WAY. Computing them
// from data/morphology/ at import time would look tidier and would be
// wrong: the corpus changing is not a routine event to absorb silently,
// it is an event that invalidates every published figure keyed to these
// denominators, every claim record citing one, and the frozen archives
// that pinned them. The correct behaviour is a loud failure, and that is
// what scripts/check-exports-sync.mjs provides — it measures the corpus
// and compares it against these constants, so a corpus that moves fails
// CI here rather than quietly re-normalizing the site.
//
// Same shape and same rule as FREQUENCY_CEILING in scripts/lib/stats.mjs:
// every caller must import from here rather than redeclare.

// Verses in the corpus. Counted from data/morphology/{1..114}.json.
export const TOTAL_VERSES = 6236;

// Orthographic words. One entry per word in data/morphology/, which is
// per-word rather than per-segment — an attached pronoun is not counted
// separately (see docs/maintainer-guide.md §9).
export const TOTAL_TOKENS = 77429;

// Distinct roots, i.e. keys in data/roots-summary.json, and the row
// count of every per-root dataset and published per-root table.
export const TOTAL_ROOTS = 1642;

// Surahs. Constant by definition rather than by measurement, exported
// alongside the others so a percentage's denominator is never a literal
// at the point of use.
export const TOTAL_SURAHS = 114;
