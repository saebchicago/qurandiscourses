// build-canonicals.mjs — one canonical address per page, written from
// scripts/lib/site.mjs rather than typed 30 times.
//
//   node scripts/build-canonicals.mjs           # rewrite
//   node scripts/build-canonicals.mjs --check   # exit 1 if anything drifted
//
// Rewrites, idempotently:
//   *.html      <link rel="canonical">, og:url, any absolute URL on the
//               site's own origin (og:image and friends), and every
//               internal link, so a reader clicking through the site
//               never pays for the .html -> clean 301
//   assets/*.js the same internal links, built at runtime
//   sitemap.xml every <loc>, keeping lastmod/changefreq/priority
//   robots.txt  the Sitemap: line
//
// --check additionally asserts the invariants that make the canonical
// tag worth having at all: exactly one per page, pointing at that
// page's own clean address, matching og:url, with no page missing from
// the sitemap and no noindex page in it.
//
// Share pages under s/ are NOT touched here; scripts/build-share-pages.mjs
// generates them and imports the same lib. Zero dependencies.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SITE, cleanPath, url, canonicalUrl, NO_CANONICAL, CANONICAL_OVERRIDE } from "./lib/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

// Any origin the site has published under. Old ones are rewritten to
// SITE so a moved domain leaves nothing behind; keep retired origins
// listed here rather than deleting them, or a stale tag in a file
// nobody opened will survive the next move too.
const ORIGINS = [SITE, "https://qurandiscourse.netlify.app"];
const ORIGIN_RE = new RegExp(
  "(" + ORIGINS.map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")",
  "g",
);

const pages = readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();
const failures = [];
const writes = [];

// Internal links. Matching "<page>.html" anywhere would be wrong: the
// repo is full of prose and comments that name these files, and
// paths.html has a data field literally called `s.html`. So a match
// needs three things at once — a known page name, a .html immediately
// after it, and a string delimiter immediately before it. That last
// condition is what separates a URL from a mention: `href="read.html"`
// and `location.href = "read.html?s=1"` qualify, while `Mirrors
// roots.html.`, `<code>embed.html</code>` and `s.html +` do not.
const PAGE_NAMES = pages.map((f) => f.replace(/\.html$/, ""));
// `url=` is in the set for the one unquoted URL on the site, the
// <meta http-equiv="refresh"> target on exercise-asr.html.
const LINK_RE = new RegExp(
  `(^|["'\`]|url=)(${PAGE_NAMES.join("|")})\\.html`,
  "g",
);
const toCleanLinks = (text) =>
  text.replace(LINK_RE, (m, delim, name) =>
    name === "index" ? `${delim}/` : `${delim}/${name}`,
  );

function rewritePage(file) {
  const abs = join(ROOT, file);
  const before = readFileSync(abs, "utf8");
  const want = canonicalUrl(file);
  let after = toCleanLinks(before.replace(ORIGIN_RE, SITE));

  // The page's own address: canonical and og:url both name it, and both
  // must survive the .html -> clean move. Prettier wraps long tags, so
  // the attributes are matched across newlines rather than on one line.
  after = after.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
    (_m, a, b) => a + want + b,
  );
  after = after.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    (_m, a, b) => a + want + b,
  );

  if (after !== before) writes.push([abs, after]);
  return after;
}

function checkPage(file, html) {
  const canon = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)];
  const want = canonicalUrl(file);
  if (NO_CANONICAL.has(file)) {
    if (canon.length) failures.push(`${file}: has a canonical but is listed as exempt`);
  } else if (canon.length !== 1) {
    failures.push(`${file}: ${canon.length} canonical tags (want exactly 1)`);
  } else if (canon[0][1] !== want) {
    failures.push(`${file}: canonical is "${canon[0][1]}", want "${want}"`);
  }

  const og = html.match(/<meta\s+property="og:url"\s+content="([^"]*)"/);
  if (og && og[1] !== want) failures.push(`${file}: og:url is "${og[1]}", want "${want}"`);
  // og:url is only worth insisting on for a page a crawler will index.
  // exercise-asr.html is noindex and canonicalizes to the generic
  // exercise page, so it carries no social tags of its own.
  if (!og && !NO_CANONICAL.has(file) && !noindex.has(file))
    failures.push(`${file}: no og:url`);

  for (const stale of ORIGINS.slice(1)) {
    if (html.includes(stale)) failures.push(`${file}: still names the retired origin ${stale}`);
  }
  // A canonical pointing at a .html address would undo the redirect: the
  // page would tell crawlers to prefer the address it 301s away from.
  if (canon.length && /\.html(\?|#|$)/.test(canon[0][1]))
    failures.push(`${file}: canonical points at a .html address`);
}

// --- runtime-built links ----------------------------------------------

// The shared modules build the same links in JS. Their own filenames are
// not page names, so nothing here can match a module path.
const scriptFiles = ["assets", "js"].flatMap((dir) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".js"))
    .map((f) => `${dir}/${f}`),
);

function rewriteScript(file) {
  const abs = join(ROOT, file);
  const before = readFileSync(abs, "utf8");
  const after = toCleanLinks(before.replace(ORIGIN_RE, SITE));
  if (after !== before) writes.push([abs, after]);
  return after;
}

function checkLinks(file, text) {
  const left = [...text.matchAll(LINK_RE)];
  for (const m of left) failures.push(`${file}: internal link still ends in .html (${m[0]})`);
}

// --- sitemap + robots -------------------------------------------------

const noindex = new Set(
  pages.filter((f) => /<meta name="robots" content="noindex/.test(readFileSync(join(ROOT, f), "utf8"))),
);

function rewriteSitemap() {
  const abs = join(ROOT, "sitemap.xml");
  const before = readFileSync(abs, "utf8");
  // Rewrite each <loc> to the canonical form of the page it names,
  // leaving lastmod/changefreq/priority alone: those are editorial.
  const after = before.replace(/<loc>([^<]*)<\/loc>/g, (m, loc) => {
    const path = loc.replace(ORIGIN_RE, "").replace(/^\//, "") || "index.html";
    const file = path.endsWith(".html") ? path : path + ".html";
    return `<loc>${url(file)}</loc>`;
  });
  if (after !== before) writes.push([abs, after]);
  return after;
}

function checkSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  const seen = new Set();
  for (const loc of locs) {
    if (seen.has(loc)) failures.push(`sitemap.xml: ${loc} listed twice`);
    seen.add(loc);
    if (!loc.startsWith(SITE)) failures.push(`sitemap.xml: ${loc} is not on ${SITE}`);
    if (/\.html(\?|#|$)/.test(loc)) failures.push(`sitemap.xml: ${loc} is a .html address`);
  }
  for (const f of pages) {
    const want = url(f);
    if (noindex.has(f)) {
      if (seen.has(want)) failures.push(`sitemap.xml: lists ${want}, which is noindex`);
    } else if (!seen.has(want)) {
      failures.push(`sitemap.xml: missing ${want}`);
    }
  }
}

function rewriteRobots() {
  const abs = join(ROOT, "robots.txt");
  const before = readFileSync(abs, "utf8");
  const after = before.replace(ORIGIN_RE, SITE);
  if (after !== before) writes.push([abs, after]);
  return after;
}

function checkRobots(txt) {
  if (!txt.includes(`Sitemap: ${SITE}/sitemap.xml`))
    failures.push(`robots.txt: does not point at ${SITE}/sitemap.xml`);
  if (/Disallow:\s*\/s\//.test(txt))
    failures.push("robots.txt: disallows /s/, which would stop crawlers reading its noindex");
}

// --- run --------------------------------------------------------------

for (const f of pages) {
  const html = rewritePage(f);
  checkPage(f, html);
  checkLinks(f, html);
}
for (const f of scriptFiles) checkLinks(f, rewriteScript(f));
checkSitemap(rewriteSitemap());
checkRobots(rewriteRobots());

if (CHECK) {
  if (writes.length)
    failures.unshift(
      `${writes.length} file(s) would change: ${writes
        .map(([p]) => p.slice(ROOT.length + 1))
        .join(", ")}`,
    );
  if (failures.length) {
    console.error("build-canonicals --check: FAIL");
    for (const f of failures) console.error("  - " + f);
    console.error("  Run: node scripts/build-canonicals.mjs");
    process.exit(1);
  }
  console.log(
    `build-canonicals --check: OK (${pages.length - NO_CANONICAL.size} canonicals on ${SITE}, ` +
      `${pages.length - noindex.size} in sitemap.xml)`,
  );
} else {
  for (const [abs, text] of writes) writeFileSync(abs, text);
  if (failures.length) {
    console.error("build-canonicals: wrote files, but invariants still fail:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log(`build-canonicals: ${writes.length} file(s) updated, all on ${SITE}.`);
}
