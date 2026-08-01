// safe-key.mjs — the ONE filename/URL-safe encoding of a Buckwalter
// root key, shared by every generator. The same mapping is duplicated
// (by necessity, no modules in browser inline JS) in roots.html,
// themes.html, dossier.html, words.html, compare.html (twice: safeKey
// and safeKeyS), and assets/embed.js — if this ever changes, change
// ALL of those too, and re-run every generator that writes
// {safeKey}.json filenames (build-root-analytics, build-cooccurrence,
// build-share-pages, compute-association-stats, compute-network-layout,
// compute-centrality) so filenames stay consistent.
//
// Uppercase BW letters → 'u'+letter; * (ذ) → 'dh'; $ (ش) → 'sh'.
export function safeKey(bw) {
  let out = "";
  for (const c of bw) {
    if (c === "*") out += "dh";
    else if (c === "$") out += "sh";
    else if (c >= "A" && c <= "Z") out += "u" + c;
    else out += c;
  }
  return out;
}
