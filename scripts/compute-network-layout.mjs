#!/usr/bin/env node
//
// compute-network-layout.mjs: precompute a deterministic radial layout
// for each root's ego network (itself + its top association partners),
// so the browser only ever plots static coordinates, it never lays
// anything out.
//
// Source: data/association/{safeKey}.json (written by
// scripts/compute-association-stats.mjs, PR 1), data/roots-summary.json
// (for raw frequency -> node size), data/morphology/, data/chronology.json.
// Reads only; writes only new files under data/network/.
//
// Also writes data/network/heatmap.json: normalized frequency (per 1,000
// tokens) for the top 40 roots by corpus-wide frequency, across all 114
// surahs. Precomputed here, not fetched per-root client-side, because
// the existing per-root data/root-analytics/{safeKey}.json files carry
// far more than a heatmap needs (surface-form and verse-level detail) -
// 40 of them would be a heavy fetch for a rendering pass that only needs
// one number per (root, surah) cell.
//
// Layout method (fully deterministic, no randomness, no simulation):
//   - Center: the root itself, at the canvas center.
//   - Partners (already ranked by LLR, descending, in the association
//     file) are placed on one of 3 concentric rings by LLR rank: rank
//     1-8 on the inner ring, 9-16 on the middle ring, 17-25 (or fewer,
//     if a root has under 25 partners) on the outer ring. Rank ->
//     distance from center is the only thing "computed" about a node's
//     position from its data; nothing here is force-directed or
//     physics-based.
//   - Angle: a pure string hash of the partner's Buckwalter root
//     (FNV-1a, 32-bit) mod 3600, /10 for a tenth-of-a-degree angle. The
//     same partner root always lands at the same angle, on any root's
//     network, in any run. This is what "seeded deterministically from
//     the partner root string" means here: identical input -> identical
//     output, and one root's angular position doesn't depend on array
//     order or which other partners are present.
//   - Node radius (size): sqrt-scaled from the root's raw corpus
//     frequency (data/roots-summary.json totalCount), normalized against
//     the global min/max across all 1,642 roots, so sizes are
//     comparable across different root pages, not just within one page.
//   - Edge weight: the pair's LLR value, stored as-is; the renderer maps
//     it to stroke width with a simple linear scale (visual encoding,
//     not a layout computation).
//
// To reproduce: node scripts/compute-network-layout.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { safeKey } from "./lib/safe-key.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DATA = join(ROOT, "data");
const ASSOC = join(DATA, "association");
const OUT = join(DATA, "network");

const TOTAL_ROOTS = 1642;
const MAX_PARTNERS = 25;
const SIZE_BUDGET_BYTES = 4 * 1024 * 1024;

const VIEWBOX_W = 480;
const VIEWBOX_H = 400;
const CX = VIEWBOX_W / 2;
const CY = VIEWBOX_H / 2;
const RINGS = [80, 130, 180]; // inner, middle, outer radius, by LLR rank tercile
const NODE_SIZE_MIN = 6;
const NODE_SIZE_MAX = 16;
const CHRONOLOGY_SOURCE =
  "Egyptian Standard (Cairo 1924) revelation order, four-period classification " +
  "following the Nöldeke-Bell tradition (Watt, \"Bell's Introduction to the Qur'an\", 1970); " +
  "same source as data/chronology.json.";

mkdirSync(OUT, { recursive: true });

// FNV-1a 32-bit, pure function of the input string. Used only to derive
// a deterministic angle from a root's own identity string, never as a
// spatial force or iterative layout step.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function angleForRoot(bw) {
  const tenthDegrees = fnv1a(bw) % 3600;
  return (tenthDegrees / 10) * (Math.PI / 180);
}
function ringForRank(rank) {
  // rank is 1-based; 1-8 -> ring 0, 9-16 -> ring 1, 17-25 -> ring 2
  if (rank <= 8) return 0;
  if (rank <= 16) return 1;
  return 2;
}

const rootsSummary = JSON.parse(readFileSync(join(DATA, "roots-summary.json"), "utf8"));
if (Object.keys(rootsSummary).length !== TOTAL_ROOTS) {
  throw new Error(`Baseline mismatch: ${Object.keys(rootsSummary).length} roots, expected ${TOTAL_ROOTS}`);
}

let globalMinCount = Infinity;
let globalMaxCount = -Infinity;
for (const meta of Object.values(rootsSummary)) {
  if (meta.totalCount < globalMinCount) globalMinCount = meta.totalCount;
  if (meta.totalCount > globalMaxCount) globalMaxCount = meta.totalCount;
}
const sqrtMin = Math.sqrt(globalMinCount);
const sqrtMax = Math.sqrt(globalMaxCount);
function nodeSize(count) {
  const t = sqrtMax > sqrtMin ? (Math.sqrt(count) - sqrtMin) / (sqrtMax - sqrtMin) : 0;
  return Math.round((NODE_SIZE_MIN + t * (NODE_SIZE_MAX - NODE_SIZE_MIN)) * 100) / 100;
}

console.log(`Global raw-frequency range: ${globalMinCount}..${globalMaxCount}`);
console.log(`Computing network layout for ${TOTAL_ROOTS} roots...`);

const COMPUTED_DATE = new Date().toISOString().slice(0, 10);

const methodsDoc = {
  _script: "scripts/compute-network-layout.mjs",
  _source: "data/association/*.json (PR 1) and data/roots-summary.json",
  _method:
    "Deterministic radial layout, no force simulation. Center = the root itself. " +
    `Up to ${MAX_PARTNERS} partners (already ranked by LLR descending in the association file) ` +
    "placed on 3 concentric rings by LLR-rank tercile (1-8 inner, 9-16 middle, 17-25 outer). " +
    "Angle = FNV-1a 32-bit hash of the partner's Buckwalter root string, mod 3600, " +
    "converted to a tenth-of-a-degree angle: a pure function of the root's own identity string, " +
    "so the same partner always lands at the same angle on any root's network, in any run. " +
    "Node size = sqrt-scaled raw corpus frequency, normalized against the global min/max " +
    "across all 1,642 roots so sizes are comparable across pages. Edge weight = LLR, stored as-is; " +
    "the renderer maps it to stroke width, a visual encoding, not a layout computation.",
  viewBox: `0 0 ${VIEWBOX_W} ${VIEWBOX_H}`,
  rings: RINGS,
  nodeSizeRange: [NODE_SIZE_MIN, NODE_SIZE_MAX],
  globalFrequencyRange: [globalMinCount, globalMaxCount],
  _computed: COMPUTED_DATE,
};
writeFileSync(join(OUT, "methods.json"), JSON.stringify(methodsDoc, null, 1) + "\n");

let written = 0;
let skipped = 0;

for (const bw of Object.keys(rootsSummary)) {
  const sk = safeKey(bw);
  const assocPath = join(ASSOC, sk + ".json");
  let assoc;
  try {
    assoc = JSON.parse(readFileSync(assocPath, "utf8"));
  } catch {
    skipped++;
    continue;
  }

  const meta = rootsSummary[bw];
  const partners = (assoc.partners || []).slice(0, MAX_PARTNERS);

  const nodes = partners.map((p, i) => {
    const rank = i + 1;
    const ring = ringForRank(rank);
    const radius = RINGS[ring];
    const angle = angleForRoot(p.root);
    const partnerMeta = rootsSummary[p.root];
    const totalCount = partnerMeta ? partnerMeta.totalCount : 0;
    return {
      root: p.root,
      safeKey: p.safeKey,
      arabic: p.arabic,
      rootLatin: p.rootLatin,
      rank,
      ring,
      x: Math.round((CX + radius * Math.cos(angle)) * 100) / 100,
      y: Math.round((CY + radius * Math.sin(angle)) * 100) / 100,
      r: nodeSize(totalCount),
      totalCount,
      k11: p.k11,
      pmi: p.pmi,
      dice: p.dice,
      llr: p.llr,
    };
  });

  const output = {
    root: bw,
    safeKey: sk,
    arabic: meta.rootArabic,
    rootLatin: meta.rootLatin,
    viewBox: `0 0 ${VIEWBOX_W} ${VIEWBOX_H}`,
    center: {
      x: CX,
      y: CY,
      r: nodeSize(meta.totalCount),
      totalCount: meta.totalCount,
    },
    nodes,
    _computed: COMPUTED_DATE,
    _methodsFile: "data/network/methods.json",
  };

  writeFileSync(join(OUT, sk + ".json"), JSON.stringify(output));
  written++;
  if (written % 400 === 0) console.log(`  ${written} files written...`);
}

console.log(`\nDone. Wrote ${written} per-root network files (${skipped} roots had no association file).`);
if (written + skipped !== TOTAL_ROOTS) {
  throw new Error(`Expected to process ${TOTAL_ROOTS} roots, processed ${written + skipped}`);
}

// ── Heatmap: top 40 roots x 114 surahs, normalized frequency ───────────

console.log("\nComputing root-density heatmap (top 40 roots x 114 surahs)...");

const TOP_HEATMAP_ROOTS = 40;

const chronology = JSON.parse(readFileSync(join(DATA, "chronology.json"), "utf8"));

const topRoots = Object.entries(rootsSummary)
  .sort((a, b) => b[1].totalCount - a[1].totalCount || a[0].localeCompare(b[0]))
  .slice(0, TOP_HEATMAP_ROOTS)
  .map(([bw, meta]) => ({ bw, ...meta }));
const topRootSet = new Set(topRoots.map((r) => r.bw));

const surahTokenTotal = new Array(115).fill(0); // 1-indexed
const cellCount = {}; // bw -> [count per surah, 1-indexed]
for (const r of topRoots) cellCount[r.bw] = new Array(115).fill(0);

for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(readFileSync(join(DATA, "morphology", `${s}.json`), "utf8"));
  for (const words of Object.values(morph)) {
    surahTokenTotal[s] += words.length;
    for (const w of words) {
      if (w.root && topRootSet.has(w.root)) cellCount[w.root][s]++;
    }
  }
}

const surahs = [];
for (let s = 1; s <= 114; s++) {
  const c = chronology[String(s)] || {};
  surahs.push({ surah: s, name: c.name || null, revelationOrder: c.revelationOrder ?? null, period: c.period || null });
}

let maxValue = 0;
const matrix = topRoots.map((r) => {
  const row = [];
  for (let s = 1; s <= 114; s++) {
    const v = surahTokenTotal[s] ? Math.round((cellCount[r.bw][s] / surahTokenTotal[s]) * 1000 * 1000) / 1000 : 0;
    if (v > maxValue) maxValue = v;
    row.push(v);
  }
  return row;
});

const heatmap = {
  root: "heatmap.json (not a per-root file)",
  roots: topRoots.map((r) => ({
    root: r.bw,
    safeKey: safeKey(r.bw),
    arabic: r.rootArabic,
    rootLatin: r.rootLatin,
    totalCount: r.totalCount,
  })),
  surahs,
  matrix,
  maxValue,
  _chronologySource: CHRONOLOGY_SOURCE,
  _method:
    "Cell value = (this root's token count in this surah / this surah's total token count) * 1000, " +
    "i.e. normalized frequency per 1,000 tokens within that surah. Top 40 roots by corpus-wide raw " +
    "frequency (data/roots-summary.json totalCount). Canonical order is Cairo mushaf surah numbering " +
    "(1-114); revelationOrder is the chronology source above - a toggle, not a replacement, since " +
    "periodization varies across scholarly chronologies.",
  _computed: COMPUTED_DATE,
};
writeFileSync(join(OUT, "heatmap.json"), JSON.stringify(heatmap));
console.log(`Wrote heatmap.json: ${topRoots.length} roots x 114 surahs, max cell value ${maxValue}`);

let totalBytes = 0;
for (const f of readdirSync(OUT)) totalBytes += statSync(join(OUT, f)).size;
const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`Total data/network size: ${totalMB} MB`);
if (totalBytes > SIZE_BUDGET_BYTES) {
  console.error(
    `ERROR: output exceeds 4 MB budget (${totalMB} MB). Reduce MAX_PARTNERS to 15 and rerun.`,
  );
  process.exit(1);
}

// Spot-check
console.log("\nSpot-check (r-ḥ-m):");
const spot = JSON.parse(readFileSync(join(OUT, safeKey("rHm") + ".json"), "utf8"));
console.log(`  center r=${spot.center.r}, nodes=${spot.nodes.length}`);
const gfr = spot.nodes.find((n) => n.root === "gfr");
console.log(`  gh-f-r: rank=${gfr?.rank}, ring=${gfr?.ring}, x=${gfr?.x}, y=${gfr?.y}, llr=${gfr?.llr}`);
