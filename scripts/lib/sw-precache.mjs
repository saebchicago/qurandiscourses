// sw-precache.mjs — the ONE computation behind the service worker's
// precache list and its hash manifest, shared by build-sw-manifest.mjs
// (the writer) and check-sw-version.mjs (the CI guard) so the two can
// never disagree about what "current" means.
//
// What gets precached (small by design, ~30 entries):
//   pages   the core shell, CLEAN PATHS ONLY: precaching /read.html on
//           Netlify would store a redirected response that Chrome
//           rejects for navigations, and no internal link uses that
//           form anyway. Clean-path keys are exactly what
//           networkFirstHtml looks up (it strips ?search).
//   assets  every stylesheet and script those pages actually reference
//           (parsed from their HTML), plus the two manifest icons.
//           Font binaries are deliberately NOT precached — they are
//           large and the stale-while-revalidate route caches them on
//           first use.
//   data    the small always-needed files (surah names, juz, version,
//           sources — cite-badge.js loads on 24 of 32 pages, and
//           without this its badges break the same silent way offline
//           as they do on a plain network failure).
//
// The manifest hashes those files PLUS every top-level data/*.json:
// the point is that any content change shows up as a manifest diff in
// review, next to the SW_VERSION that did or did not move with it.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const PRECACHE_PAGES = ["/", "/read", "/navigate", "/paths", "/search"];
// Precaching a PAGE without the data it fetches gives an offline visitor
// a shell that loads and then reports it cannot work. /paths and /search
// were both in that state. surah-names.json, meanwhile, is a build input
// (build-exports, build-og-images, build-search-index) that no runtime
// code has ever fetched -- 18KB of dead precache. Net: -18KB of waste,
// +191KB that two already-precached pages actually need.
export const PRECACHE_DATA = [
  "/data/juz.json",
  "/data/version.json",
  "/data/sources.json",
  "/data/paths.json",
  "/data/search-index.json",
  "/data/lenses.json",
  "/data/exercises.json",
  "/data/chronology.json",
  "/data/name-mentions.json",
  "/data/names.json",
];
const EXTRA_ASSETS = [
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
];

export const fileForPath = (p) =>
  p === "/" ? "index.html" : p.replace(/^\//, "") + ".html";

export function computeSwArtifacts(ROOT) {
  // Assets: the union of what the precached pages load.
  const assets = new Set(EXTRA_ASSETS);
  for (const page of PRECACHE_PAGES) {
    const html = readFileSync(join(ROOT, fileForPath(page)), "utf8");
    for (const m of html.matchAll(/<script src="(assets\/[^"]+\.js)"/g))
      assets.add("/" + m[1]);
    for (const m of html.matchAll(/<link rel="stylesheet" href="(assets\/[^"]+\.css)"/g))
      assets.add("/" + m[1]);
  }
  const precacheAssets = [...assets].sort();

  // The committed sw.js provides the version; the generated block and
  // manifest are derived around it.
  const swPath = join(ROOT, "sw.js");
  const swCurrent = readFileSync(swPath, "utf8");
  const versionMatch = swCurrent.match(/const SW_VERSION = "([^"]+)"/);
  if (!versionMatch) throw new Error("sw.js: SW_VERSION constant not found");
  const version = versionMatch[1];

  const block =
    "// GENERATED:sw-precache (scripts/build-sw-manifest.mjs) — do not edit;\n" +
    "// regenerate with: node scripts/build-sw-manifest.mjs\n" +
    `const PRECACHE_PAGES = ${JSON.stringify(PRECACHE_PAGES)};\n` +
    `const PRECACHE_ASSETS = ${JSON.stringify(precacheAssets)};\n` +
    `const PRECACHE_DATA = ${JSON.stringify(PRECACHE_DATA)};`;

  const open = "// GENERATED:sw-precache";
  const close = "// /GENERATED:sw-precache";
  const i = swCurrent.indexOf(open);
  const j = swCurrent.indexOf(close);
  if (i === -1 || j === -1 || j < i)
    throw new Error(`sw.js: no ${open} … ${close} region`);
  const swNext =
    swCurrent.slice(0, i) + block + "\n" + swCurrent.slice(j);

  // Hash scope: every precached file + every top-level data/*.json.
  const hashTargets = new Set();
  for (const p of PRECACHE_PAGES) hashTargets.add(fileForPath(p));
  for (const a of precacheAssets) hashTargets.add(a.slice(1));
  for (const d of PRECACHE_DATA) hashTargets.add(d.slice(1));
  // The manifest itself is excluded, or its own hash would chase its
  // tail: writing it would change the very file being fingerprinted.
  for (const f of readdirSync(join(ROOT, "data")))
    if (f.endsWith(".json") && f !== "sw-manifest.json")
      hashTargets.add("data/" + f);

  const hashes = {};
  for (const rel of [...hashTargets].sort()) {
    hashes[rel] = createHash("sha256")
      .update(readFileSync(join(ROOT, rel)))
      .digest("hex");
  }

  const manifestText =
    JSON.stringify(
      {
        _generated:
          "scripts/build-sw-manifest.mjs — the service worker's precache list and content fingerprint. A hash diff here alongside an unchanged version is the reviewer's cue to consider a SW_VERSION bump (see docs/maintainer-guide.md).",
        version,
        hashes,
      },
      null,
      1,
    ) + "\n";

  return {
    version,
    swNext,
    manifestText,
    counts: {
      pages: PRECACHE_PAGES.length,
      assets: precacheAssets.length,
      data: PRECACHE_DATA.length,
      hashed: Object.keys(hashes).length,
    },
  };
}
