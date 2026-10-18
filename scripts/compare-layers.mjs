// compare-layers.mjs — the morphological-layer registry and the
// annotation-sensitivity comparison between layers.
//
//   node scripts/compare-layers.mjs             # rewrite data/layers/*.json
//   node scripts/compare-layers.mjs --check     # exit 1 if stale
//   node scripts/compare-layers.mjs --selftest  # prove the comparator on synthetic input
//
// WHY THIS EXISTS. Every root count on the site inherits the judgments of one
// resource, the Leeds Quranic Arabic Corpus v0.4. Other resources annotate
// the same text differently. Before any of them is added, the site needs a
// place that (1) records which layers exist, with licence and provenance,
// (2) refuses to compare layers whose tokens do not align, and (3) reports
// how much a count moves between layers without picking a winner. This is
// that place. Today it registers Leeds alone, so the sensitivity file is
// empty by construction; adding a layer fills it, and nothing already
// published changes.
//
// OUTPUT
//   data/layers/index.json        registry: one entry per layer
//   data/layers/sensitivity.json  one comparison per non-base layer
//
// ADDING A LAYER (see docs/ELEVATION-PLAN.md section 5)
//   data/layers/<id>/manifest.json   LayerManifest fields (see below)
//   data/layers/<id>/tokens.json     [{s, v, w, ar, root, lemma, pos}, ...]
// written by that layer's ingest script, after its licence was read from the
// source and its upstream file hashed. root: null means "not annotated";
// "" means "annotated, no root". Only rootNotation "buckwalter" is accepted
// until a converter exists for another notation, because comparing roots in
// different notations without one would report disagreement that is only
// spelling. Misaligned layers stop the build; they are never skipped.
//
// Deterministic: no dates, no randomness, no network. Leeds is registered
// from data/sources.json and the bundled morphology; its digest moves when
// any token does.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOTAL_TOKENS } from "./lib/corpus.mjs";
import { leedsLayer, leedsSource, leedsContentDigest, compareLayers } from "./lib/layers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "data", "layers");
const ARGS = process.argv.slice(2);
const CHECK = ARGS.includes("--check");
const MAX_ROWS = 50; // top differences kept per comparison; the summary counts all

const MANIFEST_FIELDS = ["id", "name", "version", "license", "licenseVerifiedFrom", "citation", "retrieved", "sha256", "tokenCount", "rootNotation", "alignsTo"];
const NOTATIONS = new Set(["buckwalter", "arabic-letters", "latin-hyphenated"]);

function validateManifest(m, where) {
  const bad = (msg) => { throw new Error(`${where}: ${msg}. STOPPING.`); };
  for (const f of MANIFEST_FIELDS) if (!(f in m)) bad(`manifest is missing "${f}"`);
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(m.id)) bad("id must be kebab-case");
  if (!NOTATIONS.has(m.rootNotation)) bad(`rootNotation must be one of ${[...NOTATIONS].join(", ")}`);
  if (m.alignsTo !== "leeds-word-index") bad('alignsTo must be "leeds-word-index"');
  if (!/^[a-f0-9]{64}$/.test(m.sha256)) bad("sha256 must be 64 hex characters (the upstream artifact as downloaded)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.retrieved)) bad("retrieved must be YYYY-MM-DD");
  if (!Number.isInteger(m.tokenCount) || m.tokenCount <= 0) bad("tokenCount must be a positive integer");
  if (m.licenseVerifiedFrom !== null && typeof m.licenseVerifiedFrom !== "string") bad("licenseVerifiedFrom must be a URL or null (null = not yet verified)");
}

// ── registry ─────────────────────────────────────────────────────────
function leedsEntry() {
  const src = leedsSource();
  return {
    id: src.id,
    name: src.name,
    version: src.edition,
    license: src.license,
    // The licence statement shipped with the data, in this repository.
    licenseVerifiedFrom: "data/exports/NOTICE-LEEDS.txt",
    citation: `${src.author}. ${src.name}, ${src.edition}. ${src.publisher}, ${src.year}.`,
    retrieved: src.accessed,
    // The bundled morphology is the artifact; this digest moves when a token does.
    sha256: leedsContentDigest(),
    tokenCount: TOTAL_TOKENS,
    rootNotation: "buckwalter",
    alignsTo: "leeds-word-index",
    role: "base",
    tokens: "data/morphology/{surah}.json",
  };
}

function otherLayerDirs() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function build() {
  const base = leedsLayer();
  const layers = [leedsEntry()];
  const comparisons = [];
  for (const id of otherLayerDirs()) {
    const where = `data/layers/${id}`;
    const manifest = JSON.parse(readFileSync(join(DIR, id, "manifest.json"), "utf8"));
    validateManifest(manifest, `${where}/manifest.json`);
    if (manifest.id !== id) throw new Error(`${where}: manifest id "${manifest.id}" does not match its folder. STOPPING.`);
    if (manifest.rootNotation !== "buckwalter") throw new Error(`${where}: rootNotation "${manifest.rootNotation}" needs a converter before it can be compared; only buckwalter is accepted. STOPPING.`);
    const tokens = JSON.parse(readFileSync(join(DIR, id, "tokens.json"), "utf8"));
    if (tokens.length !== manifest.tokenCount) throw new Error(`${where}: tokens.json has ${tokens.length} tokens, manifest says ${manifest.tokenCount}. STOPPING.`);
    const cmp = compareLayers(base, { meta: { ...manifest }, tokens });
    if (!cmp.aligned) {
      throw new Error(`${where}: layer does not align with Leeds (${JSON.stringify(cmp.misaligned.slice(0, 5))}). Fix the converter; nothing is skipped silently. STOPPING.`);
    }
    layers.push({ ...manifest, role: "compared", tokens: `${where}/tokens.json` });
    comparisons.push({
      baseLayer: base.meta.id,
      otherLayer: manifest.id,
      summary: cmp.summary,
      // Differences only, largest first. No layer is called correct.
      topRootCountDifferences: cmp.rows.slice(0, MAX_ROWS).map((r) => ({ root: r.root, baseCount: r.base, otherCount: r.other, diff: r.diff, relDiff: r.relDiff })),
      note: "Counts of roots per layer over the same aligned tokens. A difference means the two resources annotate that token differently; it does not say which is right.",
    });
  }
  const index = {
    _comment:
      "GENERATED by scripts/compare-layers.mjs. The morphological layers the site knows about. Leeds is the base: every published root count comes from it. " +
      "A layer listed as compared has passed an alignment audit against Leeds token for token. See docs/ELEVATION-PLAN.md section 5 to add one.",
    layers,
  };
  const sensitivity = {
    _comment:
      "GENERATED by scripts/compare-layers.mjs. How root counts move between morphological layers over the same aligned tokens. " +
      "Empty until a second layer is registered. Differences are reported, never ranked.",
    baseLayer: base.meta.id,
    comparisons,
  };
  return { index, sensitivity };
}

// ── self-test ────────────────────────────────────────────────────────
function selfTest() {
  const base = leedsLayer();
  if (base.tokens.length !== TOTAL_TOKENS) throw new Error(`leeds tokens ${base.tokens.length} != ${TOTAL_TOKENS}`);

  // 1. Identity: a layer compared with itself differs nowhere.
  const same = compareLayers(base, base);
  if (!same.aligned || same.summary.tokensWithChangedRoot !== 0 || same.rows.length !== 0) throw new Error("identity test failed");

  // 2. Synthetic perturbation (never written to disk or published): remove
  //    the root from the first 100 rooted tokens and swap the next 50 to a
  //    fixed different root; the comparator must report exactly 150.
  const rooted = base.tokens.map((t, i) => [t, i]).filter(([t]) => t.root);
  const perturbed = { meta: { ...base.meta, id: "synthetic-selftest" }, tokens: base.tokens.map((t) => ({ ...t })) };
  const SWAP_TO = "Alh";
  let removed = 0, swapped = 0;
  for (const [, i] of rooted.slice(0, 100)) { perturbed.tokens[i].root = ""; removed++; }
  for (const [t, i] of rooted.slice(100)) {
    if (swapped === 50) break;
    if (t.root === SWAP_TO) continue;
    perturbed.tokens[i].root = SWAP_TO;
    swapped++;
  }
  const cmp = compareLayers(base, perturbed);
  if (!cmp.aligned) throw new Error("perturbed layer should still align");
  if (cmp.summary.tokensWithChangedRoot !== removed + swapped) throw new Error(`expected ${removed + swapped} changed, got ${cmp.summary.tokensWithChangedRoot}`);
  if (cmp.summary.rootPresentInBaseAbsentInOther !== removed) throw new Error(`expected ${removed} lost, got ${cmp.summary.rootPresentInBaseAbsentInOther}`);

  // 3. Misalignment is refused, not skipped: a short layer, and a layer whose Arabic differs.
  if (compareLayers(base, { meta: base.meta, tokens: base.tokens.slice(0, -1) }).aligned) throw new Error("a short layer must not align");
  const wrongArabic = { meta: base.meta, tokens: base.tokens.map((t, i) => (i === 10 ? { ...t, ar: "ZZZ" } : t)) };
  const wa = compareLayers(base, wrongArabic);
  if (wa.aligned || wa.misaligned[0].reason !== "arabic-differs") throw new Error("a layer with different Arabic must not align");

  // 4. An unannotated layer is "not annotated", not "every root lost".
  const blank = { meta: { ...base.meta, id: "blank" }, tokens: base.tokens.map((t) => ({ ...t, root: null })) };
  const bl = compareLayers(base, blank);
  if (!bl.aligned || bl.summary.otherUnannotated !== base.tokens.length || bl.summary.tokensWithChangedRoot !== 0) throw new Error("unannotated test failed");

  console.log(JSON.stringify({ ok: true, identity: "0 differences", perturbation: { removed, swapped, reported: cmp.summary.tokensWithChangedRoot }, shortLayerRefused: true, differentArabicRefused: true, unannotatedNotCountedAsDisagreement: true }));
}

// ── main ─────────────────────────────────────────────────────────────
if (ARGS.includes("--selftest")) {
  selfTest();
} else {
  const { index, sensitivity } = build();
  const outputs = [
    ["index.json", JSON.stringify(index, null, 1) + "\n"],
    ["sensitivity.json", JSON.stringify(sensitivity, null, 1) + "\n"],
  ];
  if (CHECK) {
    const stale = outputs.filter(([f, text]) => !existsSync(join(DIR, f)) || readFileSync(join(DIR, f), "utf8") !== text);
    if (stale.length) {
      console.error(`compare-layers --check: FAIL — stale: ${stale.map(([f]) => `data/layers/${f}`).join(", ")}\n  Run: node scripts/compare-layers.mjs`);
      process.exit(1);
    }
    console.log(`compare-layers --check: OK (${index.layers.length} layer${index.layers.length === 1 ? "" : "s"}, ${sensitivity.comparisons.length} comparison${sensitivity.comparisons.length === 1 ? "" : "s"}).`);
  } else {
    mkdirSync(DIR, { recursive: true });
    for (const [f, text] of outputs) writeFileSync(join(DIR, f), text);
    console.log(`compare-layers: wrote data/layers/index.json and sensitivity.json (${index.layers.length} layer, ${sensitivity.comparisons.length} comparisons).`);
  }
}
