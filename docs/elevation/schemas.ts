// schemas.ts — Zod schemas + inferred TypeScript types for the new tables
// and the multi-layer morphology format proposed in docs/ELEVATION-PLAN.md.
//
// Where this lives. The site itself is zero-dependency and does not run
// TypeScript, so these are NOT imported by the site. They are for (a) the
// optional `@divinediscourses/schema` npm package that external users
// install, and (b) the notebooks/validators that read the exports. The
// canonical contract stays data/exports/schema.json (JSON, human-readable,
// already checked by scripts/check-exports-sync.mjs); `npm run gen:schema`
// (to be written) must emit schema.json FROM these so the two cannot drift,
// and CI must fail if the emitted file differs from the committed one.
//
// Status: typechecked with tsc 7.0.2 (--strict) and zod 4.6.7; accept/reject behavior exercised (valid gloss passes; a gloss with no locator or the wrong evidence label, an overlay with to < from, and an incomplete layer manifest are all rejected).

import { z } from "zod";

// ── shared vocabulary ────────────────────────────────────────────────
/** Evidence labels, exactly as the site renders them. */
export const Evidence = z.enum(["verified", "pending", "nuanced"]);

/** Stable id: kebab-case, versioned suffix is carried separately. */
const Kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9.]+)*$/);
const Semver = z.string().regex(/^\d+\.\d+\.\d+$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ── a morphological LAYER (one resource, one version) ────────────────
export const LayerManifest = z.object({
  id: Kebab, // e.g. "leeds-corpus-v0.4"
  name: z.string(),
  version: z.string(),
  license: z.string(), // short SPDX-like text, e.g. "GPL-3.0", "CC-BY-3.0"
  licenseVerifiedFrom: z.string().url().nullable(), // the page or file that states it; null = not yet verified
  citation: z.string(), // Chicago line, mirrored into data/sources.json
  retrieved: IsoDate,
  sha256: z.string().regex(/^[a-f0-9]{64}$/), // of the upstream artifact as downloaded
  tokenCount: z.number().int().positive(),
  rootNotation: z.enum(["buckwalter", "arabic-letters", "latin-hyphenated"]),
  alignsTo: z.literal("leeds-word-index"), // the join key is (s, v, w)
});
export type LayerManifest = z.infer<typeof LayerManifest>;

export const LayerToken = z.object({
  s: z.number().int().min(1).max(114),
  v: z.number().int().min(1),
  w: z.number().int().min(1),
  ar: z.string().min(1),
  // null = this layer did not annotate; "" = annotated and rootless.
  root: z.string().nullable(),
  lemma: z.string().nullable(),
  pos: z.string().nullable(),
});
export type LayerToken = z.infer<typeof LayerToken>;

// ── new export table: annotation sensitivity ─────────────────────────
export const SensitivityRow = z.object({
  root: z.string(), // Leeds Buckwalter key, the site's canonical root id
  baseLayer: Kebab,
  otherLayer: Kebab,
  baseCount: z.number().int().nonnegative(),
  otherCount: z.number().int().nonnegative(),
  diff: z.number().int(),
  relDiff: z.number().nullable(), // null when baseCount = 0
});
export type SensitivityRow = z.infer<typeof SensitivityRow>;

// ── new export table: extended association measures ──────────────────
export const AssociationExtendedRow = z.object({
  rootA: z.string(),
  rootB: z.string(),
  k11: z.number().int().min(5), // same threshold as association-pairs
  fA: z.number().int().positive(),
  fB: z.number().int().positive(),
  pmi: z.number(),
  dice: z.number().min(0).max(1),
  llr: z.number().nonnegative(),
  logDice: z.number().max(14),
  tScore: z.number(),
  logOddsRatio: z.number(),
  logOddsRatioLo: z.number(),
  logOddsRatioHi: z.number(),
  deltaP_bGivenA: z.number().min(-1).max(1),
  deltaP_aGivenB: z.number().min(-1).max(1),
});
export type AssociationExtendedRow = z.infer<typeof AssociationExtendedRow>;

// ── verified gloss (root or lemma) — never rendered without a citation ──
export const GlossRecord = z
  .object({
    key: z.string(), // root key or lemma key
    keyKind: z.enum(["root", "lemma"]),
    text: z.string().min(1), // the source's wording, verbatim
    sourceId: Kebab, // must exist in data/sources.json
    locator: z.object({
      // The page or entry that states it. A gloss with no locator cannot ship.
      page: z.string().optional(),
      entry: z.string().optional(),
      url: z.string().url().optional(),
    }).refine((l) => Boolean(l.page || l.entry || l.url), "a locator is required"),
    transcribedBy: z.string(), // person or script that entered it
    checkedBy: z.string().nullable(), // second reader; null = single-entered
    evidence: z.literal("nuanced"), // a gloss is a lexicographer's choice, never "the meaning"
  })
  .strict();
export type GlossRecord = z.infer<typeof GlossRecord>;

// ── scholarly structural overlay (outline / ring), page-cited ────────
export const OverlayRecord = z
  .object({
    surah: z.number().int().min(1).max(114),
    scholar: z.string(),
    sourceId: Kebab,
    kind: z.enum(["outline", "ring", "section-list"]),
    // Each unit names the verse range the SCHOLAR assigned it, and the page.
    units: z
      .array(z.object({ label: z.string(), from: z.number().int().min(1), to: z.number().int().min(1), page: z.string() }))
      .min(1),
    transcriptionGate: z.literal("passed"), // docs/maintainer-guide.md "Transcription Gate"
    checkedBy: z.string(),
  })
  .strict()
  .superRefine((o, ctx) => {
    o.units.forEach((u, i) => {
      if (u.to < u.from) ctx.addIssue({ code: "custom", path: ["units", i], message: "to < from" });
    });
  });
export type OverlayRecord = z.infer<typeof OverlayRecord>;
