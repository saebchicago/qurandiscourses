// check-sw-version.mjs — the SW_VERSION convention's two mechanical
// halves, enforced.
//
// The service worker's caches are named by SW_VERSION; bumping it is
// what prunes a returning visitor's stale offline copy. The bump
// itself is a reviewed judgment call (schema and contract changes,
// not every content edit), so no checker can force it — but two
// failure modes ARE mechanical, and both have silently shipped
// broken offline states on other projects:
//
// Asserts:
//   1. freshness — regenerating from the current tree reproduces
//      sw.js's precache block and data/sw-manifest.json byte for
//      byte (catches "changed content, forgot to regenerate", which
//      would otherwise hide the hash churn from review)
//   2. sync — data/sw-manifest.json's version equals sw.js's
//      SW_VERSION (catches bumping one side without the other)
//
// Run: node scripts/check-sw-version.mjs   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeSwArtifacts } from "./lib/sw-precache.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const { version, swNext, manifestText, counts } = computeSwArtifacts(ROOT);

const swCurrent = readFileSync(join(ROOT, "sw.js"), "utf8");
if (swCurrent !== swNext)
  failures.push("sw.js precache block is stale — run: node scripts/build-sw-manifest.mjs");

let manifest = null;
try {
  const raw = readFileSync(join(ROOT, "data/sw-manifest.json"), "utf8");
  if (raw !== manifestText)
    failures.push("data/sw-manifest.json is stale — run: node scripts/build-sw-manifest.mjs");
  manifest = JSON.parse(raw);
} catch {
  failures.push("data/sw-manifest.json is missing — run: node scripts/build-sw-manifest.mjs");
}

if (manifest && manifest.version !== version)
  failures.push(
    `version drift: sw.js says ${version}, data/sw-manifest.json says ${manifest.version}`,
  );

if (failures.length) {
  console.error("check-sw-version: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-sw-version: OK (${version}; precache block and ${counts.hashed}-file manifest current and in sync)`,
);
