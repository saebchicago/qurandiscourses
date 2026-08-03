// site.mjs — the site's public origin and URL shape, in one place.
//
// Every absolute URL the site emits (canonical tags, og:url, og:image,
// sitemap.xml, robots.txt, the generated share pages under s/) is built
// from these. Before this existed the origin was spelled out in 1,818
// files and two scripts, so moving domains meant a find-and-replace and
// hoping.
//
// Pages are addressed by their CLEAN path: /read, not /read.html.
// netlify.toml 301s the .html address to it. See the redirect section
// there for why that needs force = true and what it does to headers.

export const SITE = "https://divinediscourses.org";

// "read.html" -> "/read", "index.html" -> "/", "s/surah/1.html" ->
// "/s/surah/1.html". Share pages keep their extension: they are noindex
// bounce stubs whose URLs are already in the wild from the share button,
// and netlify.toml deliberately does not redirect them.
export function cleanPath(file) {
  const rel = file.replace(/^\.?\//, "");
  if (rel === "index.html") return "/";
  if (rel.startsWith("s/")) return "/" + rel;
  return "/" + rel.replace(/\.html$/, "");
}

export const url = (file) => SITE + cleanPath(file);

// Pages whose canonical is deliberately NOT their own address, with the
// reason. exercise-asr.html is the generic exercise page with one
// exercise preselected; the two render the same content, so the query
// form is the address search engines should keep.
export const CANONICAL_OVERRIDE = new Map([
  ["exercise-asr.html", "/exercise?id=asr-outline"],
]);

// The address a page should name as canonical, override or own.
export const canonicalUrl = (file) =>
  CANONICAL_OVERRIDE.has(file) ? SITE + CANONICAL_OVERRIDE.get(file) : url(file);

// Pages that carry no canonical tag, with the reason. embed.html is the
// one page meant to live inside a foreign iframe; it is noindex, it is
// not in the sitemap, and third parties already point iframe src at it.
export const NO_CANONICAL = new Set(["embed.html"]);
