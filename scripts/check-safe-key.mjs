// check-safe-key.mjs — the browser's safeKey() and the generators'
// safeKey() must agree, forever.
//
//   node scripts/check-safe-key.mjs
//
// WHY THIS EXISTS. safeKey(buckwalterRoot) is the contract between the
// pages and the data on disk: it produces the filename every per-root
// fetch uses (data/root-analytics/{safeKey}.json and five sibling
// directories, 1,642 files each, all named by the generators' copy). If
// the browser's copy and the generators' copy ever disagree by one
// character, the reader gets a 404 — or, worse, a DIFFERENT root's
// statistics under a "Verified · computed from the cited corpus" badge.
// That exact failure class already shipped once (see check-root-datasets
// and the F1 finding behind it), which is the whole argument for
// checking this mechanically rather than trusting a comment.
//
// The browser copy used to be SEVEN copies — roots.html, themes.html,
// dossier.html, words.html, compare.html (twice), assets/embed.js — kept
// in step by a note in scripts/lib/safe-key.mjs asking future editors to
// change all of them. This checker replaces that note with a test. The
// pages now call window.qdSafeKey from assets/lang-labels.js; this
// asserts that implementation matches scripts/lib/safe-key.mjs on a
// vector that exercises every branch, and that no page has quietly
// reintroduced a local copy.
//
// Precedent: check-nav-sync.mjs and check-headers-sync.mjs exist for the
// same reason — two places that must agree, with nothing but discipline
// otherwise keeping them agreeing.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { safeKey as canonical } from "./lib/safe-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];

// ── 1. Load the browser implementation the way a browser would ───────
// assets/lang-labels.js is a plain IIFE that assigns to window; give it
// a window object and run it, rather than re-implementing or regexing
// the function out (either would test a copy, not the shipped code).
const src = readFileSync(join(ROOT, "assets/lang-labels.js"), "utf8");
const sandbox = { window: {} };
try {
  new Function("window", src)(sandbox.window);
} catch (e) {
  console.error(`check-safe-key: FAIL — assets/lang-labels.js did not run: ${e.message}`);
  process.exit(1);
}
const browserSafeKey = sandbox.window.qdSafeKey;
if (typeof browserSafeKey !== "function") {
  console.error(
    "check-safe-key: FAIL — assets/lang-labels.js does not export window.qdSafeKey.",
  );
  process.exit(1);
}

// ── 2. Agreement on a branch-covering vector ─────────────────────────
// Every uppercase letter (the 'u'-prefix branch), both digraph escapes,
// lowercase passthrough, the empty string, and a set of real roots that
// exercise combinations — including the ones behind the original
// collision bug.
const VECTOR = [
  "",
  "rHm",
  "Alh",
  "*kr",
  "$jr",
  "*$A",
  "ktb",
  "slm",
  "qwl",
  "ElmY",
  "HqQ",
  "ZlM",
  "xnzr",
  "hjr",
  "Sbr",
  "Drb",
  "Tyb",
  "EbD",
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)),
];

let mismatches = 0;
for (const bw of VECTOR) {
  const a = canonical(bw);
  const b = browserSafeKey(bw);
  if (a !== b) {
    mismatches++;
    if (mismatches <= 5) {
      fail.push(
        `  safeKey(${JSON.stringify(bw)}): lib/safe-key.mjs -> ${JSON.stringify(a)}, ` +
          `assets/lang-labels.js -> ${JSON.stringify(b)}`,
      );
    }
  }
}
if (mismatches > 5) fail.push(`  …and ${mismatches - 5} more`);

// ── 3. Every real root round-trips to a file that exists ─────────────
// Agreement between two functions is necessary but not sufficient: both
// could agree and both be wrong for the corpus. Check the browser copy
// against the filenames actually on disk.
const analyticsDir = join(ROOT, "data/root-analytics");
const onDisk = new Set(
  readdirSync(analyticsDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_") && f !== "methods.json")
    .map((f) => f.slice(0, -5)),
);
const summary = JSON.parse(readFileSync(join(ROOT, "data/roots-summary.json"), "utf8"));
const roots = Object.keys(summary).filter((k) => !k.startsWith("_"));
let missing = 0;
for (const bw of roots) {
  if (!onDisk.has(browserSafeKey(bw))) {
    missing++;
    if (missing <= 5) fail.push(`  root ${JSON.stringify(bw)} -> no data/root-analytics/${browserSafeKey(bw)}.json`);
  }
}
if (missing > 5) fail.push(`  …and ${missing - 5} more roots with no file`);

// ── 4. No page has reintroduced a local copy ─────────────────────────
// The point of the shared function is that there is one. A page-local
// `function safeKey(` is exactly the drift this checker exists to stop.
const htmlFiles = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const jsFiles = readdirSync(join(ROOT, "assets"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => join("assets", f));
// A thin wrapper that delegates to window.qdSafeKey is fine and in fact
// required: assets/lang-labels.js is deferred, so a page cannot alias
// the function at parse time and must call through at use time. What is
// NOT fine is a body that reimplements the mapping — that is the drift.
// Distinguished by looking at what the body actually does.
const LOCAL_DEF =
  /(?:function\s+safeKey\w*\s*\(|(?:const|let|var)\s+safeKey\w*\s*=\s*(?:function|\())/g;
for (const rel of [...htmlFiles, ...jsFiles]) {
  // lang-labels.js is where the one real implementation lives.
  if (rel === join("assets", "lang-labels.js")) continue;
  const text = readFileSync(join(ROOT, rel), "utf8");
  for (const m of text.matchAll(LOCAL_DEF)) {
    const body = text.slice(m.index, m.index + 200);
    if (body.includes("window.qdSafeKey")) continue; // delegating wrapper
    fail.push(
      `  ${rel} reimplements safeKey — call window.qdSafeKey ` +
        `(assets/lang-labels.js) instead`,
    );
  }
}

if (fail.length) {
  console.error("check-safe-key: FAIL\n" + fail.join("\n"));
  process.exit(1);
}
console.log(
  `check-safe-key: OK (browser and generator agree on ${VECTOR.length} inputs; ` +
    `all ${roots.length} roots resolve to an existing file; no page-local copies).`,
);
