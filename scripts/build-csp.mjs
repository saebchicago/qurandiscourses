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
// must authorize. "/s/*" → the generated share pages, which carry no
// inline script (see build-share-pages.mjs), so 'self' alone.
function fileForPath(p) {
  if (p === "/") return "index.html";
  if (p === "/s/*") return null; // no inline scripts by construction
  if (p.startsWith("/") && p.endsWith(".html")) return p.slice(1);
  return null;
}

// Every inline <script>…</script> (no attributes) hash, in page order.
function hashesFor(file) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) throw new Error(`page not found: ${file}`);
  const html = readFileSync(abs, "utf8");
  const hashes = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes("<script")) {
      throw new Error(`nested/broken <script> in ${file}; cannot hash safely`);
    }
    const digest = createHash("sha256").update(m[1], "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

function scriptSrcFor(path) {
  const file = fileForPath(path);
  const parts = ["'self'"];
  if (file) parts.push(...hashesFor(file));
  return `script-src ${parts.join(" ")}`;
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
  const desired = scriptSrcFor(pathMatch[1]);
  const replaced = chunk.replace(/script-src [^;]*/, (found) => {
    if (found !== desired) changed++;
    return desired;
  });
  return replaced;
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
