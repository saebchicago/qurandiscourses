// check-headers-sync.mjs — guard for the per-page CSP structure in
// netlify.toml. That structure is FAIL-OPEN: a new HTML page without
// its own [[headers]] block ships with no Content-Security-Policy at
// all. This checker makes that impossible to miss. Run it after adding
// any page or touching netlify.toml; it is part of the pre-ship
// checklist in docs/maintainer-guide.md.
//
// Asserts:
//   1. every root-level *.html file has exactly one CSP block
//      (plus "/" for index.html)
//   2. a /s/* block exists for the generated share pages
//   3. only /embed.html carries frame-ancestors *
//      (every other CSP says frame-ancestors 'none')
//   4. X-Frame-Options appears nowhere (it cannot be relaxed per-path
//      on Netlify and would break embedding site-wide)
//   5. the /* residual security headers are present
//
// Run: node scripts/check-headers-sync.mjs   (exit 1 on any failure)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");

const failures = [];

// Parse [[headers]] blocks. Comments are stripped first so prose that
// mentions header names (like this file's structure note) can't trip
// the checks; the file is ours, so line-level parsing is enough.
const stripped = toml
  .split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");
const blocks = [];
for (const chunk of stripped.split("[[headers]]").slice(1)) {
  const pathMatch = chunk.match(/for\s*=\s*"([^"]+)"/);
  if (!pathMatch) {
    failures.push("a [[headers]] block has no for= path");
    continue;
  }
  blocks.push({ path: pathMatch[1], values: chunk });
}
if (blocks.length === 0) failures.push("no [[headers]] blocks parsed");

const cspBlocks = blocks.filter((b) =>
  /Content-Security-Policy\s*=/.test(b.values),
);
const cspByPath = new Map();
for (const b of cspBlocks) {
  cspByPath.set(b.path, (cspByPath.get(b.path) || 0) + 1);
}

// 1. every root page has exactly one CSP block
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
for (const p of pages) {
  const n = cspByPath.get("/" + p) || 0;
  if (n !== 1) failures.push(`/${p}: ${n} CSP blocks (want exactly 1)`);
}
if ((cspByPath.get("/") || 0) !== 1)
  failures.push(`"/": ${cspByPath.get("/") || 0} CSP blocks (want exactly 1)`);

// no CSP on catch-alls other than /s/*
for (const b of cspBlocks) {
  if (b.path.includes("*") && b.path !== "/s/*")
    failures.push(`${b.path}: CSP on a wildcard path other than /s/*`);
}

// 2. /s/* exists
if (!cspByPath.has("/s/*")) failures.push("missing /s/* CSP block");

// 3. frame-ancestors: * only on /embed.html
for (const b of cspBlocks) {
  const csp = b.values.match(/Content-Security-Policy\s*=\s*"((?:[^"\\]|\\.)*)"/)[1];
  const fa = csp.match(/frame-ancestors ([^;]+)/);
  if (!fa) {
    failures.push(`${b.path}: CSP without frame-ancestors`);
  } else if (b.path === "/embed.html") {
    if (fa[1].trim() !== "*")
      failures.push(`/embed.html: frame-ancestors is "${fa[1].trim()}", want *`);
  } else if (fa[1].trim() !== "'none'") {
    failures.push(`${b.path}: frame-ancestors is "${fa[1].trim()}", want 'none'`);
  }
}

// 4. no X-Frame-Options anywhere (checked against the comment-stripped
// source so prose mentions don't trip it)
if (/X-Frame-Options/i.test(stripped))
  failures.push("X-Frame-Options present — it breaks per-path embedding and must stay removed");

// 5. residual headers on /*
const star = blocks.find((b) => b.path === "/*");
if (!star) {
  failures.push("missing /* block for residual security headers");
} else {
  for (const h of [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
  ]) {
    if (!star.values.includes(h)) failures.push(`/*: missing ${h}`);
  }
  if (/Content-Security-Policy/.test(star.values))
    failures.push("/*: carries a CSP — it would merge with every per-page CSP");
}

if (failures.length) {
  console.error("check-headers-sync: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-headers-sync: OK (${pages.length} pages + "/" + /s/* + embed exception)`,
);
