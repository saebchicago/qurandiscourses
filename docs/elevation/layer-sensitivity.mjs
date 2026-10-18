#!/usr/bin/env node
//
// layer-sensitivity.mjs — SKELETON for the "annotation sensitivity" generator.
//
// Purpose. Every root count on the site inherits one resource's judgments
// (Leeds v0.4). When a second morphological layer is added, readers should
// be able to see how much a count moves between layers WITHOUT the site
// choosing a winner. This computes that movement, and refuses to compare
// layers whose tokens do not align.
//
// A LAYER is a normalized JSON file (see Layer typedef). Adding QAMAR,
// QuranMorph or MASAQ means writing one converter that emits this shape;
// nothing downstream changes, and no existing Leeds-based claim is touched.
//
// Rules this enforces:
//   1. Alignment first. Layers are joined on (surah, verse, word). If token
//      counts differ, or the Arabic string differs after the normalizer, the
//      comparison stops and lists the misalignments. Nothing is skipped
//      silently.
//   2. A missing value is "not annotated", never "no root". A layer that
//      leaves root empty is reported as such, not as disagreement.
//   3. No interpretation. Output is counts and differences only.
//
// Usage:
//   node docs/elevation/layer-sensitivity.mjs --selftest
//   node docs/elevation/layer-sensitivity.mjs --other path/to/layer.json
//
// --selftest uses a SYNTHETIC perturbation of the Leeds layer (exactly 100
// roots removed, exactly 50 roots swapped) purely to prove the comparator
// reports exactly those counts. That perturbed layer is never written to
// disk and must never be published.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOTAL_TOKENS } from "../../scripts/lib/corpus.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @typedef {Object} LayerToken
 * @property {number} s surah 1-114
 * @property {number} v verse number in surah
 * @property {number} w word index in verse (1-based, as in data/morphology)
 * @property {string} ar Arabic form as the layer gives it
 * @property {string|null} root null = layer did not annotate; "" = annotated, rootless
 * @property {string|null} lemma
 * @property {string|null} pos
 *
 * @typedef {Object} Layer
 * @property {{id:string,name:string,version:string,license:string,citation:string,url:string}} meta
 * @property {LayerToken[]} tokens
 */

/** Leeds v0.4 as a Layer, read from the bundled morphology. */
export function leedsLayer() {
  const tokens = [];
  for (let s = 1; s <= 114; s++) {
    const morph = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
    for (const v of Object.keys(morph).map(Number).sort((a, b) => a - b)) {
      for (const w of morph[v]) tokens.push({ s, v, w: w.w, ar: w.ar, root: w.root ?? "", lemma: w.lemma ?? null, pos: w.pos ?? null });
    }
  }
  return {
    meta: { id: "leeds-corpus-v0.4", name: "Quranic Arabic Corpus", version: "0.4", license: "GPL", citation: "Dukes, K. (2013) PhD thesis, Univ. of Leeds", url: "https://corpus.quran.com" },
    tokens,
  };
}

const key = (t) => `${t.s}:${t.v}:${t.w}`;

/** Strip diacritics and tatweel so two layers' spellings can be compared. */
export const arBase = (str) => str.normalize("NFC").replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "").replace(/[ٱآأإ]/g, "ا");

/**
 * Compare two layers. `mapRoot` converts the OTHER layer's root notation into
 * the base layer's (e.g. Arabic letters -> Buckwalter); identity by default.
 * Returns { aligned, misaligned[], summary, rows[] }.
 */
export function compareLayers(base, other, { mapRoot = (r) => r, maxMisaligned = 20 } = {}) {
  const byKey = new Map(other.tokens.map((t) => [key(t), t]));
  const misaligned = [];
  if (base.tokens.length !== other.tokens.length) misaligned.push({ reason: "token-count", base: base.tokens.length, other: other.tokens.length });
  const counts = new Map(); // root -> {base, other}
  const bump = (r, side) => {
    if (!r) return;
    const e = counts.get(r) || { base: 0, other: 0 };
    e[side]++;
    counts.set(r, e);
  };
  let changedRoot = 0, bothAnnotated = 0, otherUnannotated = 0, rootLostInOther = 0;
  for (const b of base.tokens) {
    const o = byKey.get(key(b));
    if (!o) { if (misaligned.length < maxMisaligned) misaligned.push({ reason: "missing-in-other", at: key(b) }); continue; }
    if (arBase(b.ar) !== arBase(o.ar)) { if (misaligned.length < maxMisaligned) misaligned.push({ reason: "arabic-differs", at: key(b), base: b.ar, other: o.ar }); continue; }
    const br = b.root || "";
    bump(br, "base");
    if (o.root === null) { otherUnannotated++; continue; }
    const or = mapRoot(o.root) || "";
    bump(or, "other");
    bothAnnotated++;
    if (br !== or) { changedRoot++; if (br && !or) rootLostInOther++; }
  }
  if (misaligned.length) return { aligned: false, misaligned, summary: null, rows: [] };
  const rows = [...counts]
    .map(([root, c]) => ({ root, base: c.base, other: c.other, diff: c.other - c.base, relDiff: c.base ? (c.other - c.base) / c.base : null }))
    .filter((r) => r.diff !== 0)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || (x.root < y.root ? -1 : 1));
  return {
    aligned: true,
    misaligned: [],
    summary: { baseLayer: base.meta.id, otherLayer: other.meta.id, tokens: base.tokens.length, bothAnnotated, otherUnannotated, tokensWithChangedRoot: changedRoot, rootPresentInBaseAbsentInOther: rootLostInOther, rootsWithDifferentCount: rows.length },
    rows,
  };
}

// ── self-test ────────────────────────────────────────────────────────
function selfTest() {
  const base = leedsLayer();
  if (base.tokens.length !== TOTAL_TOKENS) throw new Error(`leeds tokens ${base.tokens.length} != ${TOTAL_TOKENS}`);

  // 1. Identity: a layer compared with itself differs nowhere.
  const same = compareLayers(base, base);
  if (!same.aligned || same.summary.tokensWithChangedRoot !== 0 || same.rows.length !== 0) throw new Error("identity test failed");

  // 2. Synthetic perturbation (NEVER written to disk or published).
  //    Remove the root from the first 100 rooted tokens, and swap the root
  //    on the next 50 rooted tokens to a fixed different root.
  const rooted = base.tokens.map((t, i) => [t, i]).filter(([t]) => t.root);
  const perturbed = { meta: { ...base.meta, id: "synthetic-selftest" }, tokens: base.tokens.map((t) => ({ ...t })) };
  const SWAP_TO = "Alh";
  let removed = 0, swapped = 0;
  for (const [, i] of rooted.slice(0, 100)) { perturbed.tokens[i].root = ""; removed++; }
  for (const [t, i] of rooted.slice(100)) {
    if (swapped === 50) break;
    if (t.root === SWAP_TO) continue; // a swap to itself would not be a change
    perturbed.tokens[i].root = SWAP_TO;
    swapped++;
  }
  const cmp = compareLayers(base, perturbed);
  if (!cmp.aligned) throw new Error("perturbed layer should still align");
  if (cmp.summary.tokensWithChangedRoot !== removed + swapped) throw new Error(`expected ${removed + swapped} changed, got ${cmp.summary.tokensWithChangedRoot}`);
  if (cmp.summary.rootPresentInBaseAbsentInOther !== removed) throw new Error(`expected ${removed} lost, got ${cmp.summary.rootPresentInBaseAbsentInOther}`);

  // 3. Misalignment is refused, not skipped.
  const short = { meta: base.meta, tokens: base.tokens.slice(0, -1) };
  if (compareLayers(base, short).aligned) throw new Error("a short layer must not align");

  // 4. An unannotated layer is "not annotated", not "all roots lost".
  const blank = { meta: { ...base.meta, id: "blank" }, tokens: base.tokens.map((t) => ({ ...t, root: null })) };
  const bl = compareLayers(base, blank);
  if (!bl.aligned || bl.summary.otherUnannotated !== base.tokens.length || bl.summary.tokensWithChangedRoot !== 0) throw new Error("unannotated test failed");

  console.log(JSON.stringify({ ok: true, identity: "0 differences", perturbation: { removed, swapped, reported: cmp.summary.tokensWithChangedRoot }, misalignmentRefused: true, unannotatedNotCountedAsDisagreement: true }));
}

if (process.argv.includes("--selftest")) selfTest();
else if (process.argv.includes("--other")) {
  const other = JSON.parse(readFileSync(process.argv[process.argv.indexOf("--other") + 1], "utf8"));
  const out = compareLayers(leedsLayer(), other);
  process.stdout.write(JSON.stringify(out, null, 1) + "\n");
  process.exit(out.aligned ? 0 : 1);
}
