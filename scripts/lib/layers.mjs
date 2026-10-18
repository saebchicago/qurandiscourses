// layers.mjs — morphological LAYERS and the comparison between them.
//
// Every root count on the site inherits one resource's judgments (Leeds
// v0.4). When a second morphological layer is added, readers should see how
// much a count moves between layers WITHOUT the site choosing a winner.
// This library does that comparison and refuses to compare layers whose
// tokens do not align. scripts/compare-layers.mjs is the generator that
// uses it; the design is in docs/ELEVATION-PLAN.md (section 3).
//
// A LAYER is a normalized set of tokens (see the typedefs). Adding QAMAR,
// QuranMorph or MASAQ means writing one converter that emits this shape;
// nothing downstream changes, and no existing Leeds-based claim is touched.
//
// Rules this enforces:
//   1. Alignment first. Layers are joined on (surah, verse, word). If token
//      counts differ, or the Arabic string differs after the normalizer, the
//      comparison stops and lists the misalignments. Nothing is skipped
//      silently.
//   2. A missing value is "not annotated" (root null), never "no root" (""),
//      and is reported as such, not as disagreement.
//   3. No interpretation. Output is counts and differences only.
//
// Pure apart from leedsLayer(), which reads the bundled morphology. No
// dates, no randomness, no network.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

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

/** The registered Leeds source entry (data/sources.json), the one place its facts live. */
export function leedsSource() {
  const src = JSON.parse(readFileSync(join(ROOT, "data", "sources.json"), "utf8")).sources.find((x) => x.id === "leeds-corpus-v0.4");
  if (!src) throw new Error("data/sources.json has no leeds-corpus-v0.4 entry");
  return src;
}

/** sha256 over the bundled Leeds morphology files, in surah order: moves when any token does. */
export function leedsContentDigest() {
  const h = createHash("sha256");
  for (let s = 1; s <= 114; s++) h.update(readFileSync(join(ROOT, "data", "morphology", `${s}.json`)));
  return h.digest("hex");
}

/** Leeds v0.4 as a Layer, read from the bundled morphology. */
export function leedsLayer() {
  const tokens = [];
  for (let s = 1; s <= 114; s++) {
    const morph = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
    for (const v of Object.keys(morph).map(Number).sort((a, b) => a - b)) {
      for (const w of morph[v]) tokens.push({ s, v, w: w.w, ar: w.ar, root: w.root ?? "", lemma: w.lemma ?? null, pos: w.pos ?? null });
    }
  }
  const src = leedsSource();
  return {
    meta: { id: src.id, name: src.name, version: src.edition, license: src.license, citation: `${src.author}. ${src.name}, ${src.edition}. ${src.publisher}, ${src.year}.`, url: src.url },
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
