// lexical-diversity.mjs — length-robust alternatives to raw type-token
// ratio (TTR), shared by build-numbers.mjs (four chronological periods)
// and build-surah-profiles.mjs (114 surahs). Extracted here because both
// need the identical formula, not two independent copies of it (the
// mistake scripts/lib/stats.mjs was extracted to stop repeating).
//
// Why this module exists: raw TTR (distinct forms / token count) falls
// mechanically as a text gets longer, because a longer text has more
// chances to repeat a word it has already used, independent of how
// varied its vocabulary actually is. This site's own numbers.json shows
// the artifact directly — formTTR 0.6202 -> 0.4081 -> 0.3073 across
// Early/Middle/Late Meccan periods of 2,704 -> 14,163 -> 30,572 tokens,
// tracking token count far more than any real vocabulary difference.
// Both measures below are immune to this by construction.
//
// MATTR (Moving-Average Type-Token Ratio): Covington, M.A. & McFall,
// J.D. (2010). "Cutting the Gordian Knot: The Moving-Average
// Type-Token Ratio (MATTR)." Journal of Quantitative Linguistics,
// 17(2), 94-100. Slide a fixed-size window of W consecutive tokens
// across the text one token at a time; compute TTR (distinct types in
// the window / W) for every window; MATTR is the mean of those window
// TTRs. Every window is the same length, so the result does not depend
// on how long the whole text is -- but it is undefined for a text
// shorter than W (no complete window exists).
//
// MTLD (Measure of Textual Lexical Diversity): McCarthy, P.M. &
// Jarvis, S. (2010). "MTLD, vocd-D, and HD-D: A validation study of
// sophisticated approaches to lexical diversity assessment." Behavior
// Research Methods, 42(2), 381-392. Walk the text left to right,
// tracking a running TTR from the start of the current "factor"; every
// time that running TTR drops to or below a threshold (0.72, the value
// McCarthy & Jarvis validated), count one whole factor and restart the
// running TTR from the next token. Any tokens left over at the end
// count as a PARTIAL factor, sized by how close their own running TTR
// got to the threshold: partialFactor = (1 - finalTTR) / (1 -
// threshold). MTLD for one direction = token count / total factors
// (whole + partial). The reported MTLD is the mean of the forward pass
// and the pass over the reversed token sequence, per McCarthy &
// Jarvis's own bidirectional method -- a single direction is sensitive
// to exactly where the text happens to end.
//
// Both take an array of already-tokenized strings (this site's own
// normalized surface forms) and return a number, or null when the
// measure is not computable for that text (MATTR: fewer tokens than
// the window; MTLD: the running TTR never reaches the threshold even
// once, so there is no complete factor to divide by -- only ever seen
// on very short, fully-unique-vocabulary texts).

export function mattr(tokens, window) {
  const n = tokens.length;
  if (n < window) return null;
  const windowCount = n - window + 1;
  let sumTtr = 0;
  // Sliding-window type count via an incremental multiset: add the
  // entering token, remove the token leaving the back of the window,
  // track how many distinct types currently have count > 0. O(n), not
  // O(n*window).
  const counts = new Map();
  let distinct = 0;
  for (let i = 0; i < window; i++) {
    const t = tokens[i];
    const c = (counts.get(t) || 0) + 1;
    counts.set(t, c);
    if (c === 1) distinct++;
  }
  sumTtr += distinct / window;
  for (let i = window; i < n; i++) {
    const entering = tokens[i];
    const leaving = tokens[i - window];
    const ec = (counts.get(entering) || 0) + 1;
    counts.set(entering, ec);
    if (ec === 1) distinct++;
    const lc = counts.get(leaving) - 1;
    counts.set(leaving, lc);
    if (lc === 0) distinct--;
    sumTtr += distinct / window;
  }
  return sumTtr / windowCount;
}

// The fractional credit a partially-completed factor at the end of a
// pass contributes, given the running TTR it reached (finalTtr) and
// the factor threshold. Exposed separately so it is directly
// unit-testable without re-deriving a full token walk by hand.
export function partialFactor(finalTtr, threshold) {
  return (1 - finalTtr) / (1 - threshold);
}

function mtldOneDirection(tokens, threshold) {
  let factors = 0;
  const counts = new Map();
  let distinct = 0;
  let segLen = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const c = (counts.get(t) || 0) + 1;
    counts.set(t, c);
    if (c === 1) distinct++;
    segLen++;
    const ttr = distinct / segLen;
    if (ttr <= threshold) {
      factors++;
      counts.clear();
      distinct = 0;
      segLen = 0;
    }
  }
  if (segLen > 0) {
    const finalTtr = distinct / segLen;
    factors += partialFactor(finalTtr, threshold);
  }
  if (factors === 0) return null; // never reached even one factor
  return tokens.length / factors;
}

export function mtld(tokens, threshold = 0.72) {
  if (tokens.length === 0) return null;
  const forward = mtldOneDirection(tokens, threshold);
  const backward = mtldOneDirection([...tokens].reverse(), threshold);
  if (forward === null || backward === null) return null;
  return (forward + backward) / 2;
}
