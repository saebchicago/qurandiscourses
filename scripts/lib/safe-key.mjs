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

// rootPageSlug — the path segment of a root's reference PAGE (/root/<slug>,
// root/<slug>.html). safeKey keeps the uppercase letter after its 'u'
// ("Alh" -> "uAlh"), which is fine for the {safeKey}.json data files but
// not for HTML pages: the production host answers a mixed-case page URL
// with a 301 to its lowercase form, so /root/uAlh redirected to /root/ualh
// while that page's canonical, the sitemap and every internal link still
// named /root/uAlh (found by scripts/smoke-deployed.mjs, 2026-10-18; 195
// of the 411 root pages). Pages use the lowercase slug so the address that
// is linked, listed and declared canonical is the address that answers 200.
// The 411 slugs are unique (build-root-pages.mjs asserts it). Data files
// keep safeKey: the host does not redirect them.
export const rootPageSlug = (bw) => safeKey(bw).toLowerCase();
