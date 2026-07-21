// safe-key.mjs — the ONE filename/URL-safe encoding of a Buckwalter
// root key, shared by every generator. The same mapping is duplicated
// (by necessity, no modules) in the inline JS of roots.html,
// themes.html, and dossier.html — if this ever changes, change those
// too, and re-run build-root-analytics.mjs, build-cooccurrence.mjs, and
// build-share-pages.mjs so filenames stay consistent.
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
