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

// 1. every root page has exactly one CSP block per address. Pages are
// served at a clean path (/read) and redirected to it from the .html
// path (/read.html); Netlify matches headers on the request path, so
// both need a block or one of the two addresses ships with no CSP.
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const cleanOf = (p) => (p === "index.html" ? "/" : "/" + p.replace(/\.html$/, ""));
for (const p of pages) {
  for (const addr of ["/" + p, cleanOf(p)]) {
    const n = cspByPath.get(addr) || 0;
    if (n !== 1) failures.push(`${addr}: ${n} CSP blocks (want exactly 1)`);
  }
}

// The two blocks of a pair must carry byte-identical values, or the
// address a reader lands on would decide which policy they get.
for (const p of pages) {
  const a = cspBlocks.find((b) => b.path === "/" + p);
  const b = cspBlocks.find((x) => x.path === cleanOf(p));
  if (!a || !b) continue;
  const csp = (blk) =>
    blk.values.match(/Content-Security-Policy\s*=\s*"((?:[^"\\]|\\.)*)"/)[1];
  if (csp(a) !== csp(b))
    failures.push(`/${p}: CSP differs between "${a.path}" and "${b.path}"`);
}

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
  } else if (b.path === "/embed.html" || b.path === "/embed") {
    if (fa[1].trim() !== "*")
      failures.push(`${b.path}: frame-ancestors is "${fa[1].trim()}", want *`);
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

// 6. every page's .html address 301s to its clean one. Without force the
// rule never fires, because the .html file exists; without the rule the
// page would answer on two addresses and the canonical tag would be the
// only thing distinguishing them.
const redirects = [];
for (const chunk of stripped.split("[[redirects]]").slice(1)) {
  const from = chunk.match(/from\s*=\s*"([^"]+)"/);
  const to = chunk.match(/to\s*=\s*"([^"]+)"/);
  const status = chunk.match(/status\s*=\s*(\d+)/);
  const force = /force\s*=\s*true/.test(chunk);
  if (from && to) redirects.push({ from: from[1], to: to[1], status: status && +status[1], force });
}
const byFrom = new Map(redirects.map((r) => [r.from, r]));
for (const p of pages) {
  const r = byFrom.get("/" + p);
  const want = cleanOf(p);
  if (!r) failures.push(`/${p}: no redirect to its clean path ${want}`);
  else if (r.to !== want) failures.push(`/${p}: redirects to "${r.to}", want "${want}"`);
  else if (r.status !== 301) failures.push(`/${p}: redirect status ${r.status}, want 301`);
  else if (!r.force) failures.push(`/${p}: redirect lacks force = true, so it never fires`);
}
// A redirect whose target is itself served by another redirect is a loop.
for (const r of redirects) {
  const next = byFrom.get(r.to);
  if (next) failures.push(`${r.from} -> ${r.to} -> ${next.to}: redirect chain`);
}

if (failures.length) {
  console.error("check-headers-sync: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-headers-sync: OK (${pages.length} pages x 2 addresses + /s/* + embed exception, ` +
    `${redirects.length} clean-URL redirects)`,
);
