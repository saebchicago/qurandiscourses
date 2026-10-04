// build-csp.mjs — keep the per-page Content-Security-Policy script-src in
// netlify.toml in sync with each page's inline <script> blocks.
//
// The site drops `script-src 'unsafe-inline'`: every inline <script> is
// instead authorized by its SHA-256 hash. This script computes those
// hashes from the actual page bytes and writes them into each page's CSP
// block, so the policy can never drift from the code it authorizes.
//
//   node scripts/build-csp.mjs           # rewrite netlify.toml
//   node scripts/build-csp.mjs --check   # exit 1 if netlify.toml is stale
//
// A browser hashes the exact text between <script> and </script> (inline
// tags only — anything with a src=/type= attribute is covered by 'self').
// If you edit an inline script, rerun this; --check runs in the ship
// checklist so a stale policy fails before deploy. Zero dependencies.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOML = join(ROOT, "netlify.toml");
const CHECK = process.argv.includes("--check");

// Map a CSP block's `for=` path to the HTML file whose inline scripts it
// must authorize. Every page has two blocks, one per address: the clean
// path it is served at ("/read") and the .html path that redirects to it
// ("/read.html"). Both resolve to the same file, so both get the same
// hashes and can never drift apart. "/s/*" → the generated share pages,
// which carry no inline script (see build-share-pages.mjs), so 'self'
// alone.
function fileForPath(p) {
  if (p === "/") return "index.html";
  if (p === "/s/*") return null; // no inline scripts by construction
  if (!p.startsWith("/") || p.includes("*")) return null;
  if (p.endsWith(".html")) return p.slice(1);
  return p.slice(1) + ".html";
}

// Every inline <tag>…</tag> block (no attributes) hash, in page order.
// A browser hashes the exact text between the tags. Used for both inline
// <script> (script-src) and inline <style> (style-src-elem).
//
// <script type="application/ld+json"> blocks are deliberately NOT
// hashed: a data block is never executed, so browsers do not check it
// against script-src, and hashing it would bloat every page's header
// with dead entries (Netlify caps header size). The attribute-free
// regex below already skips them — this comment exists so nobody
// "fixes" that by widening the match.
function hashBlocks(file, tag) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) throw new Error(`page not found: ${file}`);
  const html = readFileSync(abs, "utf8");
  const hashes = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes(`<${tag}`)) {
      throw new Error(`nested/broken <${tag}> in ${file}; cannot hash safely`);
    }
    const digest = createHash("sha256").update(m[1], "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

// Google Analytics (assets/ga-init.js + the async gtag.js tag in each page
// head). Only a block whose pages carry the tag gets these hosts; the tag
// is in the page source, so the hosts are written here at build time and
// not left to anything injected after the build, which no hash covers.
const GA_TAG = "/assets/ga-init.js";
const GA_SCRIPT = ["https://www.googletagmanager.com"];
const GA_CONNECT = ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com"];
const GA_IMG = ["https://*.google-analytics.com", "https://www.googletagmanager.com"];

// Generated families are one CSP block for a directory of pages: GA is
// allowed only if every page in it carries the tag.
const FAMILY = /^\/(surah|juz|root)\/\*$/;
function pageHasGa(path) {
  const fam = FAMILY.exec(path);
  if (fam) {
    const dir = join(ROOT, fam[1]);
    const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
    return files.length > 0 && files.every((f) => readFileSync(join(dir, f), "utf8").includes(GA_TAG));
  }
  const file = fileForPath(path);
  return Boolean(file) && existsSync(join(ROOT, file)) && readFileSync(join(ROOT, file), "utf8").includes(GA_TAG);
}

// Set a directive's GA hosts to exactly `hosts` (none when the page has no
// tag), leaving every other source untouched. Idempotent.
function withGa(csp, directive, hosts, on) {
  const re = new RegExp(`(${directive} )([^;]*)`);
  return csp.replace(re, (_, head, list) => {
    const kept = list.split(/\s+/).filter((t) => t && ![...GA_SCRIPT, ...GA_CONNECT, ...GA_IMG].includes(t));
    return head + [...kept, ...(on ? hosts : [])].join(" ");
  });
}

function scriptSrcFor(path) {
  const file = fileForPath(path);
  const parts = ["'self'"];
  if (file) parts.push(...hashBlocks(file, "script"));
  if (pageHasGa(path)) parts.push(...GA_SCRIPT);
  return `script-src ${parts.join(" ")}`;
}

// style-src-elem governs <style> elements and stylesheet <link>s on
// modern browsers, so injected <style>/foreign CSS are blocked while our
// own static <style> blocks are hash-authorized. Inline `style=` attrs
// (incl. dynamically computed ones) fall back to style-src, which keeps
// 'unsafe-inline'; old browsers ignore style-src-elem and use that same
// fallback, so there is no regression anywhere.
function styleSrcElemFor(path) {
  const file = fileForPath(path);
  const parts = ["'self'"];
  if (file) parts.push(...hashBlocks(file, "style"));
  return `style-src-elem ${parts.join(" ")}`;
}

const original = readFileSync(TOML, "utf8");
// Rewrite each block's `script-src …;` in place. Blocks are separated by
// the literal `[[headers]]` marker; we only touch the script-src token.
const chunks = original.split("[[headers]]");
let changed = 0;
const out = chunks.map((chunk, i) => {
  if (i === 0) return chunk; // preamble before the first block
  const pathMatch = chunk.match(/for\s*=\s*"([^"]+)"/);
  if (!pathMatch || !/Content-Security-Policy\s*=/.test(chunk)) return chunk;
  let c = chunk;
  // script-src: replace the whole directive with 'self' + inline hashes.
  c = c.replace(/script-src [^;]*/, scriptSrcFor(pathMatch[1]));
  // connect-src / img-src: GA hosts on pages that carry the tag, nothing else.
  const ga = pageHasGa(pathMatch[1]);
  c = withGa(c, "connect-src", GA_CONNECT, ga);
  c = withGa(c, "img-src", GA_IMG, ga);
  // style-src-elem: drop any prior copy (idempotent), then insert a fresh
  // one right after style-src so element styles are hash-authorized.
  c = c.replace(/;\s*style-src-elem [^;]*/g, "");
  c = c.replace(/style-src '[^;]*/, (found) => `${found}; ${styleSrcElemFor(pathMatch[1])}`);
  if (c !== chunk) changed++;
  return c;
});
const updated = chunks.length ? out.join("[[headers]]") : original;

if (CHECK) {
  if (updated !== original) {
    console.error(
      "build-csp --check: FAIL — netlify.toml script-src hashes are stale.\n" +
        "  Run: node scripts/build-csp.mjs (an inline <script> changed).",
    );
    process.exit(1);
  }
  console.log("build-csp --check: OK — every page CSP authorizes its inline scripts.");
} else {
  writeFileSync(TOML, updated);
  console.log(
    `build-csp: netlify.toml updated (${changed} script-src directive${changed === 1 ? "" : "s"} rewritten).`,
  );
}
