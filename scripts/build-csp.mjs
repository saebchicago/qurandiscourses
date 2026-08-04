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

import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

function scriptSrcFor(path) {
  const file = fileForPath(path);
  const parts = ["'self'"];
  if (file) parts.push(...hashBlocks(file, "script"));
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
