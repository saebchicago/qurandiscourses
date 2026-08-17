// extract-text.mjs — turn a page's <main> into readable plain text.
//
// Shared by build-llms.mjs (llms-full.txt) and, later, the search-index
// generator: both need the same answer to "what does this page say",
// and two extractors would give two answers.
//
// Deliberately not a DOM: a small tag-aware pass is enough for this
// repo's hand-written HTML, and it keeps the zero-dependency rule. The
// contract is lossy by design — scripts, styles, and template markup
// vanish; headings keep a marker so structure survives; block elements
// become line breaks; entities are decoded; whitespace collapses.

const BLOCK = /^(p|div|section|article|li|ul|ol|dl|dt|dd|table|tr|h[1-6]|blockquote|details|summary|figure|figcaption|nav|footer|header)$/i;

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&sect;": "§",
  "&middot;": "·",
};

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m] ?? m);
}

// Extract the readable text of an HTML string (usually a <main> slice).
// Headings come out as "## text" lines so downstream consumers can keep
// or strip the structure.
export function extractText(html) {
  let s = html;
  // Whole subtrees that are never prose.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<template[\s\S]*?<\/template>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // The "On this page" list (scripts/build-page-toc.mjs) is chrome: it
  // restates, verbatim, headings that appear again a few lines later in
  // this same extraction. Left in, every page carrying one would open
  // llms-full.txt and its own search-index sections with a duplicate of
  // its own table of contents. Only this one nav is dropped — the site's
  // other <nav> elements are outside <main> and never reach here.
  s = s.replace(/<nav[^>]*\sclass="[^"]*\bpage-toc\b[^"]*"[^>]*>[\s\S]*?<\/nav\s*>/gi, " ");
  // Headings keep a structural marker.
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, inner) => {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return `\n\n${"#".repeat(Number(n))} ${text}\n\n`;
  });
  // Block boundaries become newlines, inline tags vanish.
  s = s.replace(/<\/?([a-z0-9-]+)(\s[^>]*)?>/gi, (m, tag) =>
    BLOCK.test(tag) ? "\n" : " ",
  );
  s = decodeEntities(s);
  // Collapse: spaces within lines, at most one blank line between blocks.
  return s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The <main> element of a full page, or "" when absent (embed stubs).
export function mainOf(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return m ? m[1] : "";
}
