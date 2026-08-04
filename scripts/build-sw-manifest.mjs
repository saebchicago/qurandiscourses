// build-sw-manifest.mjs — the service worker's precache block and hash
// manifest.
//
//   node scripts/build-sw-manifest.mjs           # rewrite both
//   node scripts/build-sw-manifest.mjs --check   # exit 1 if stale
//
// Rewrites the GENERATED:sw-precache region in sw.js (core pages, the
// stylesheets/scripts those pages reference, the small always-needed
// data files) and emits data/sw-manifest.json: {version, hashes} over
// every precached file plus every top-level data/*.json.
//
// The manifest is the reviewable form of the SW_VERSION convention:
// the bump itself stays a judgment call (schema or contract changes,
// not every content edit — docs/maintainer-guide.md), but a PR that
// churns hashes while the version sits still now SHOWS that in its
// diff. check-sw-version.mjs enforces the two mechanical halves:
// regeneration freshness and version parity between sw.js and the
// manifest. All logic lives in scripts/lib/sw-precache.mjs, shared
// with the checker. Deterministic; zero dependencies.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeSwArtifacts } from "./lib/sw-precache.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const { version, swNext, manifestText, counts } = computeSwArtifacts(ROOT);

const outputs = [
  [join(ROOT, "sw.js"), swNext],
  [join(ROOT, "data/sw-manifest.json"), manifestText],
];

const stale = [];
for (const [abs, text] of outputs) {
  let current = null;
  try {
    current = readFileSync(abs, "utf8");
  } catch {
    current = null;
  }
  if (current !== text) stale.push(abs.slice(ROOT.length + 1));
}

const summary = `${counts.pages} pages + ${counts.assets} assets + ${counts.data} data precached, ${counts.hashed} files hashed, ${version}`;

if (CHECK) {
  if (stale.length) {
    console.error("build-sw-manifest --check: FAIL");
    for (const f of stale) console.error(`  - ${f} is stale`);
    console.error("  Run: node scripts/build-sw-manifest.mjs");
    process.exit(1);
  }
  console.log(`build-sw-manifest --check: OK (${summary})`);
} else {
  for (const [abs, text] of outputs) {
    let current = null;
    try {
      current = readFileSync(abs, "utf8");
    } catch {
      current = null;
    }
    if (current !== text) writeFileSync(abs, text);
  }
  console.log(
    `build-sw-manifest: ${summary}${stale.length ? "" : " (no change)"}.`,
  );
}
