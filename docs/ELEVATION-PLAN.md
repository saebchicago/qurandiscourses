# Divine Discourses elevation plan

Status: proposal written 2026-10-18; see Progress below for what has since shipped. The code under `docs/elevation/` is skeleton code that has been run; parts of it were adopted into `scripts/` and `docs/notebooks/` (see Progress).

Labels used throughout. **[Verified]**: checked in this repository or by running the code here. **[Modeled]**: my estimate (effort, targets); a judgment, not a measurement. **[Unverified]**: from an external source I could only see as a search abstract or listing; check before relying on it.

## Progress (updated 2026-10-18)

Original text below is kept as written on the day of the proposal. This block says what has since happened. **[Verified]** items were checked in this repository or by a run against production.

| Item | Status |
|---|---|
| A1 extended association measures | **Done**, v1.4.0 (export table 19, claim, worked example, Roots panel columns and re-sort). The skeleton `compute-association-extended.mjs` was not adopted as a script: the measures live in `scripts/lib/association-measures.mjs` and `build-exports.mjs` computes the table from published counts. |
| A2 layer-sensitivity harness | **Done.** Adopted as `scripts/compare-layers.mjs` (`--selftest`, `--check`) over `scripts/lib/layers.mjs`; registers Leeds as layer 1 in `data/layers/index.json`; `data/layers/sensitivity.json` is empty until a second layer is added. Tested with a synthetic layer folder (30 removed roots gives exactly 30 changed tokens; a misaligned layer stops the build). No `/layers` page yet. |
| A3 licence verification (MASAQ, QuranMorph, QAMAR) | **Not done.** The authoring sandbox cannot reach Mendeley, arXiv or the ACL Anthology; needs an open-network machine. |
| A4 notebook | **Done.** Moved to `docs/notebooks/`, five checks, executed in CI. |
| A5 gloss source | **Decided** (Penrice 1873 primary, Lane cross-check). Validator, worklist, coverage wiring and a Roots-page display are built; **0 of 1,642 roots transcribed** (owner task). |
| A6 coverage v2 | **Done** (token-weighted view; also fixed seven editorial glosses keyed to non-roots). |
| A7 Zenodo DOI | Not done. |
| B5 concordance v1 | **Done**, with a test that it matches every root's published occurrence count. |
| B6 query builder v1 | **Done** (`/query`, under Analyze). Filters: root (Buckwalter, Latin or Arabic), lemma, POS, surah range, period; counts by surah, occurrences with context, CSV, permalink. State is the URL only. `scripts/query.test.mjs` checks every root's query total against the published count. Not done: lemma search by Arabic, form-level filters. |
| B7 static API | **Done** (`/api/v1/index.json`, `openapi.json`, CORS). |
| C4 surah distance | **Done**, v1.5.0 (export table 20 `surah-distance`, 6,441 pairs, permutation null, claim, worked example). Method as in "C4 method" below; 500 draws, seed 20261018, ~35 s. No page yet: the table is on Export only. |

Production check (2026-10-18, GitHub Actions run against divinediscourses.org, **[Verified]**): 41 passed, 0 failed after one fix. The run found a defect outside this plan's scope: 195 of 411 root pages answered 301 to a lowercase address while their canonical named the capital form; fixed in #174 with `rootPageSlug` and guards in `build-canonicals --check` and the smoke test. A weekly scheduled smoke run now exists.

## Executive summary

The site's moat is not breadth of features but a property no general Qur'an tool has: every number can be regenerated from shipped data, and every claim carries its evidence status. The elevation strategy turns that property into infrastructure other scholars build on. In order: (1) make the existing evidence base legible and reusable (extended statistics, a versioned read-only data interface, notebooks that reproduce published figures); (2) break the single-resource dependency by adding independent morphological layers **beside** Leeds v0.4, never replacing it, and publishing how much each count moves between them as a method-dependent finding; (3) close the coverage gaps honestly (verified glosses and page-cited scholarly overlays, both rights-gated, measured by token-weighted as well as root-weighted coverage); (4) raise analytical depth where the data already supports it (concordance, query builder, formulaic systems, multi-surah comparison) with deterministic layouts instead of runtime simulation. The site stays non-interpretive: every new feature orders evidence and exposes method; none generates meaning.

---

## 1. Strategic Product Vision

### Premise audit (the brief's claims against the repository)

| Claim in the brief | Finding |
|---|---|
| Leeds v0.4 is the only morphological source | **[Verified]** `data/sources.json` registers one morphology source; 77,429 tokens, 1,642 roots, 4,832 lemmas (`data/numbers.json`). |
| 0% verified root glosses | **[Verified]** `data/coverage/report.json`: 0 of 1,642 roots have a verified gloss; 84 editorial glosses exist and are labeled as not verified. |
| Khan outlines incomplete | **[Verified]** Of the 30 surahs (85–114) in Khan's 2013 volume, **1** (surah 103) is transcribed from that volume; 5 more surahs come from his 2011 book. |
| Zero page-cited ring analyses | **[Verified]** `ringAnalyses.transcribed` is empty; all 114 are "wanted". The site's one mechanical symmetry test (345 candidates) has **0** survivors after FDR and Bonferroni. |
| No public API or notebooks | **[Verified]** No API route exists; the data pack (`divinediscourses-data-v1.3.1.tar.gz`, 42 files) and 18 export tables do. The notebook in `docs/elevation/` is the first. |
| 18+ export tables | **[Verified]** 18 in `data/exports/schema.json`. |
| Concordance / KWIC underdeveloped | **[Verified by repository search]** Every-occurrence lists exist (Roots explorer); no windowed concordance or filter builder was found. |
| Association/dispersion are strong | **[Verified]** PMI, Dice, Dunning G2 at verse level; four dispersion measures; centrality; networks; formulaic density with null and Benjamini–Hochberg. |
| Network visuals "not best-in-class" | **[Verified]** The existing network is a deterministic precomputed radial layout (3 rings, FNV-1a angles), no force simulation; some labels overlap in the one I rendered. Interactive depth is the real gap. |
| QAMAR 2026, QuranMorph 2025, MASAQ exist | **[Unverified: search abstracts only]** See §5. None is mentioned anywhere in the repository. |
| Leeds v0.4 is no longer the newest resource | **[Unverified]** The three resources above are newer; I did not verify that no newer Leeds release exists. |

### Positioning statement

Divine Discourses is the open, recomputable workbench for coherence-oriented Qur'anic analytics: every figure regenerates byte-for-byte from shipped data, every claim states what was checked and what depends on a method, and interpretation stays with the reader.

### 12–18 month north-star metrics

Baselines are the repository's own measurements. Targets are **[Modeled]** proposals for the owner to accept or change, not forecasts.

| Metric | Baseline | Target |
|---|---|---|
| Morphological layers, aligned and compared | 1 | 3 (Leeds + two of MASAQ / QuranMorph / QAMAR, licences permitting) |
| Verified root glosses, **by root** | 0 / 1,642 | ≥ 100 roots, each with a source locator |
| Verified root glosses, **by token weight** | 0% of 49,967 rooted tokens | ≥ 60% (top 100 roots = 60.5% of rooted tokens, computed from `root-frequencies.csv`) |
| Page-cited scholarly overlays | 0 ring analyses; 6 per-word-gloss surahs | ≥ 10 surahs with a page-cited overlay; Khan 2013: 1 → ≥ 10 of 30 |
| Export tables with schema | 18 | ≥ 24, each regenerated in CI |
| Claims in the ledger by status | 22 | ≥ 40, with ≥ 3 marked `independently-reproduced` |
| External re-runs of a published figure | unmeasured | ≥ 5 recorded (issues/notebook submissions) |
| Scholarly citations of the site or a data release | unmeasured (no DOI per release today) | measured via DOI; target set after the first 6 months of data |
| Data-pack downloads | unmeasured | measured via Zenodo/GitHub release stats; target set after baseline |
| External contributions merged (corrections, transcriptions, reviews) | `data/corrections.json` and `reviewers.json` shipped empty | ≥ 15 merged, each credited |

### Non-negotiable principles

1. **No generated interpretation.** No tafsir, summaries of meaning, or AI commentary. The site orders evidence.
2. **Determinism.** Every published number regenerates from shipped data and scripts; CI fails on drift.
3. **Label before display.** No figure or overlay renders without its evidence status and source.
4. **Layers beside, never over.** A new resource never replaces or silently edits Leeds-based claims.
5. **Source text verbatim.** Tanzil text unchanged, notice intact.
6. **Rights before data.** A licence is verified from the source itself before anything ships.
7. **Privacy.** Local storage only for reader work; no tracking of reading, notes or searches.
8. **Public correction.** Every change stays in the public changelog.

---

## 2. Prioritized Feature & Resource Roadmap

Effort: S ≈ days, M ≈ 1–3 weeks, L ≈ 1–3 months, XL > 3 months of one maintainer **[Modeled]**. "Acceptance" is what CI or a reviewer can check.

### Phase A: Immediate (0–30 days)

| ID | Item | Why it elevates | Data / licence | Effort | Risk → mitigation | Acceptance |
|---|---|---|---|---|---|---|
| A1 | **Extended association measures**: logDice, t-score, log odds ratio with 95% interval, directional ΔP, beside PMI/Dice/G2 (new export table `association-extended`, measure toggle in Roots explorer) | Shows method-dependence instead of picking a winner; matches the site's dispersion convention | Leeds only | S–M (script exists: `docs/elevation/compute-association-extended.mjs`) | Readers over-read a "winner" → every ranking shows which measure; a claim record with `agreement: method-dependent` | Script in `scripts/` with `--check`; shared measures equal the published file within its rounding; table in `schema.json`; claim 1:1 with a worked example |
| A2 | **Layer-sensitivity harness** in the build, with Leeds as layer 1 (no new data yet) | Makes the later layers a converter, not a rewrite | None | S (exists: `layer-sensitivity.mjs`) | Premature surface area → ship as generator + empty-state page only | Identity test passes; misaligned layer refused; unannotated ≠ disagreement |
| A3 | **Licence and fit verification** for MASAQ, QuranMorph, QAMAR | Gates all of Phase B | Read-only research | S | Misreading a licence → quote the grant verbatim from the source, record sha256 | `sources.json` entries as ○ Pending with licence text, URL, retrieval date, file hash, tokenization notes |
| A4 | **Notebook + data-pack guide** (`docs/notebooks/reproduce-numbers.ipynb`) published on Export | Lets an outsider reproduce a Numbers figure in minutes | Data pack (Leeds GPL notice included) | S | Notebook rot → CI runs its cells against the committed pack | CI executes the notebook; 5 checks pass |
| A5 | **Gloss source decision** (the owner task in `docs/gloss-dataset-research.md`) | Unblocks the 0% | Per that memo: verify QUL label and the volume's permission page | S (owner) | Shipping without verified licence → memo's own gate stands | Decision recorded in `DEFERRED.md` |
| A6 | **Coverage report v2**: add token-weighted gloss coverage, layer count, overlay count, claims by status | Honest accounting that can't be gamed by glossing rare roots | None | S | None | `compute-coverage.mjs --check` passes; `coverage.html` figures are bound spans |
| A7 | **Zenodo DOI per release** (CITATION.cff exists) | Makes citation measurable | None | S | Version/date drift → release script checks `version.json`, `CITATION.cff`, tag together | DOI in `CITATION.cff` and About |

### Phase B: Near-term (1–3 months)

| ID | Item | Why | Data / licence | Effort | Risk → mitigation | Acceptance |
|---|---|---|---|---|---|---|
| B1 | **MASAQ as layer 2** (if CC BY 3.0 is confirmed from the dataset) | Independent morphology + syntax on the same Tanzil base text, so alignment should be tractable **[Unverified]** | [Unverified] CC BY 3.0 per the Mendeley listing | M–L | Tokenization differs → alignment audit refuses, lists mismatches; per-token mapping table | Alignment report 100% or a published, itemized exception list; layer badge on affected figures |
| B2 | **QuranMorph as a layer** (lemma and POS; roots only if the release carries them) | Manually annotated, same token count as Leeds **[Unverified]** | [Unverified] "open-source"; licence name not seen | M | Missing roots read as disagreement → `root: null` means "not annotated" | As B1; sensitivity reports lemma/POS divergence separately from root divergence |
| B3 | **QAMAR as a layer** | Stem, lemma, root, POS plus a Modern Standard Arabic equivalent, manually verified **[Unverified]** | [Unverified] licence, size, tagset not seen | M–L | MSA equivalents mistaken for classical glosses → label them "modern equivalent, QAMAR", a separate field | As B1 |
| B4 | **Verified root glosses v1**, top roots first | The 0% is the largest credibility gap; 100 roots = 60.5% of rooted tokens | Public-domain classical lexica or a verified-licence dataset; never a copyrighted dictionary without permission | L | Transcription error, rights → `GlossRecord` schema forces locator + second reader; Transcription Gate | ≥ 100 roots; every gloss has source, locator, `checkedBy`; label Nuanced; coverage report moves |
| B5 | **Concordance (KWIC) v1** | Core corpus-tool expectation; uses existing morphology | Leeds + Tanzil, no new data | M | Large payloads → per-root shards generated at build time | Query by root / lemma / surface form; ±N words; verbatim text; export CSV; works without server |
| B6 | **Query builder v1** | Moves from browsing to asking | Existing | M | Query state mistaken for storage → state lives in the URL only | Filters (root, lemma, POS, surah, period) → counts + occurrences + CSV; permalink reproduces the result |
| B7 | **Static read-only API** (`/api/v1/…`, OpenAPI 3.1) | Third-party reuse without a server | Existing exports | S–M | Cache poisoning → immutable only at versioned paths, never unversioned | Index lists every table with version and sha256; CORS read-only on `/api/v1/*` |
| B8 | **Interactive network v2** | Best-in-class exploration, still exportable | Existing | M | Hairballs → cap nodes, precomputed layouts, label-collision pass | Deterministic layout; SVG download equals the on-screen picture; keyboard traversal |
| B9 | **Scholar contribution workflow** | Turns the empty corrections/reviewers files into a pipeline | None | M | Unreviewed data → issue form → schema validation → PR → reviewer credit | A submitted gloss/overlay fails CI without locator; accepted ones are credited |

### Phase C: Medium-term (3–9 months)

| ID | Item | Why | Data / licence | Effort | Risk → mitigation | Acceptance |
|---|---|---|---|---|---|---|
| C1 | **Annotation-sensitivity dashboard** (`/layers`) | The site's distinctive finding: how much counts move between resources | Layers from B1–B3 | M | Reads as ranking resources → no "best layer"; differences only, with claim `method-dependent` | Per-root divergence table; rooted-token share per layer; export table `layer-sensitivity` |
| C2 | **Page-cited scholarly overlays** (Khan 2013 first; then Islahi, Cuypers, Farrin) | The scholarly record readers actually want next to the computed structure | Rights-gated: factual section divisions with page cites; counsel/permission per work | L (ongoing) | Transcription as interpretation → never the site's words, only the scholar's divisions with page; Transcription Gate | `OverlayRecord` validates; ring analyses count > 0 only with a page cite; coverage report moves |
| C3 | **Formulaic systems** (templates with one variable slot, skip-grams) | Moves from fixed n-grams toward Bannister-style systems | Leeds | L | Over-claiming orality → report only coverage vs a length-matched null with Benjamini–Hochberg; no claim about composition | Null-tested; every system lists its occurrences; claim records |
| C4 | **Multi-surah fingerprint compare** | Compare surahs by root distributions without prose | Leeds | M | Spurious distance → permutation null, not bootstrap (see "C4 method" below); show root-frequency vectors, not a verdict | Pairwise distance with its permutation null and excess; method note; export |
| C5 | **Versioned data diffs** between releases | Reproducibility over time | `RELEASES.json` + packs | M | Noise from date stamps → compare with `SOURCE_DATE_EPOCH` pinned | Release page lists every numeric change |
| C6 | **Saved local workspaces** (queries, pins) | Study continuity, privacy intact | None | M | Storage loss → export/import JSON | Local only; no network; included in app backups |
| C7 | **Analytic learning paths** | Pedagogy: how to read a collocation table, a sensitivity table | None | M | Interpretive drift → steps teach method, not meaning | Paths validate (`check-paths.mjs`) |
| C8 | **TEI-lite and RDF/CSVW export** | Interoperability with DH tooling | Layers + exports | L | Format drift → generated from `schema.json`, validated | Validates against published schema; round-trips the pack |

### Phase D: Aspirational (9–18+ months)

| ID | Item | Why | Notes |
|---|---|---|---|
| D1 | Syntactic layer (MASAQ i'rab) as a fourth dimension | Dependency-based collocation | Needs B1 first; syntactic labels are a theory choice, so labeled method-dependent |
| D2 | Independent-reproduction programme | `independently-reproduced` already exists in the claims enum | Invite external re-runs; credit them |
| D3 | Methods paper per release series | Scholarly standing | Not an accuracy claim; descriptive |
| D4 | Cross-corpus comparison (other Classical Arabic corpora) | Context for frequency claims | Licensing unknown; research first |
| D5 | Chart accessibility conformance audit | Charts are the riskiest a11y surface | Conformance is not inferable from automated checks |

---

## 3. Technical Architecture Recommendations

**Keep the stack.** Static HTML, vanilla JS modules, deterministic zero-dependency Node generators, Netlify, strict per-page CSP. Reasons, from the repository: determinism and the CSP model both depend on there being no build step and no runtime framework; the repo has 590+ generated pages and ~40 `--check` gates that assume it; a framework would add a bundle and a CSP surface without any analytical gain. **Evolve around it, not through it:**

- **TypeScript and Zod only outside the site**: an optional `@divinediscourses/schema` package and notebooks, generated from, and CI-checked against, `data/exports/schema.json` (the canonical contract stays JSON). `docs/elevation/schemas.ts` is the starting point.
- **Python only in notebooks.** Never in the pipeline (the repo already has one tolerated Python helper).
- **No React.** Interaction is progressive enhancement on pure-function SVG (§4, `root-network.mjs`).

### Multi-layer pipeline that preserves determinism

```
data/layers/<layer-id>/
  upstream/         # NOT committed if the licence forbids; sha256 + URL + retrieval date are
  manifest.json     # LayerManifest (id, version, licence, licenseVerifiedFrom, sha256, rootNotation)
  tokens.json       # normalized LayerToken[] keyed (s, v, w), one file per surah like data/morphology/
scripts/ingest-layer-<id>.mjs      # upstream -> tokens.json, pure and offline after download
scripts/compare-layers.mjs         # alignment audit + sensitivity (adopted, see Progress)
```

1. Ingest is the only step that reads an upstream file; it verifies the recorded sha256 first and fails on mismatch.
2. Alignment is a build gate: tokens join on `(surah, verse, word)`; a different token count or Arabic string stops the build and lists the mismatches. Nothing is skipped silently.
3. `null` = not annotated, `""` = annotated and rootless. Only this distinction prevents an unannotated layer from reading as total disagreement.
4. Existing Leeds claims keep `sourceIds: ["leeds-corpus-v0.4"]` and are not regenerated from any other layer. New cross-layer claims get their own ids and `agreement: "method-dependent"`.

### Schema extensions (new export tables)

`layer-manifest`, `layer-sensitivity`, `association-extended`, `root-gloss`, `lemma-gloss`, `overlay` (scholar structural divisions), `formula-systems`, `surah-fingerprint-distance`. Types in `docs/elevation/schemas.ts`.

### Keeping every number bound to generated data

The mechanisms already exist; the plan extends them rather than adding new ones: bound spans filled by a generator (`applyCoverageBindings`, `check-data-nums.mjs`); every generator supports `--check`; `check-generated-freshness.mjs` and the audit workflow run them; `check-exports-sync.mjs` ties `schema.json` to files and download cards; `check-claims.mjs` bonds each claim to a worked example. **Additions:** (a) each new generator ships with an embedded hand-computed unit test and an "anchor" assertion, as `compute-association-stats.mjs` does; (b) a new page must declare its bound figures or be listed with a reason (as `NO_TOC` does); (c) layer ingest verifies upstream sha256; (d) the notebook runs in CI.

### Privacy and CSP implications

New features add **no third-party origins**. The API is same-origin static JSON; notebooks are downloaded, not embedded from Binder/Colab/Observable (embedding would widen `script-src` and `frame-src`). CORS `*` on `/api/v1/*` is read-only public data. Saved workspaces use local storage like notes. Analytics stay as today.

### Performance for larger graphs **[Modeled]**

Precompute layouts offline (seeded, fixed iterations, rounded coordinates); ship coordinates, not a simulation. SVG is adequate to a few hundred nodes; above that, cluster or filter before drawing, not after. Per-root shards for concordance keep first paint independent of corpus size. Lazy-load the heavy modules (the site already has `assets/lazy.js`).

---

### C4 method (prototype result, 2026-10-18, **[Verified]**; shipped in v1.5.0)

The plan first said "bootstrap intervals" for the surah-to-surah distance. A prototype over the real data showed that does not work: with Jensen-Shannon distance between two surahs' root distributions and a verse-block bootstrap, **47% of the 6,441 surah pairs had their own observed distance outside the bootstrap's 95% interval** (surahs 2 and 3: observed 0.384, interval 0.432 to 0.464). Resampling verses with replacement concentrates each sample, and the plug-in distance is biased upward in small samples, so the interval is shifted away from the estimate it is meant to bracket.

The design that works is a **permutation null**: for each pair, pool both surahs' verses, reshuffle which verses belong to which side (sizes fixed, seeded `mulberry32`), recompute the distance, and report the observed distance, the null mean, the excess (observed minus null mean), and a permutation p with Benjamini-Hochberg q across the 6,441 pairs. Prototype behavior on real data:

| Pair | Rooted tokens | Observed | Null mean | Excess | p |
|---|---|---|---|---|---|
| 2 vs 3 | 3,884 / 2,274 | 0.384 | 0.346 | 0.038 | 0.010 |
| 2 vs 9 | 3,884 / 1,646 | 0.482 | 0.375 | 0.107 | 0.010 |
| 1 vs 112 | 23 / 10 | 0.934 | 0.871 | 0.063 | 0.139 |
| 103 vs 104 | 10 / 21 | 1.000 | 0.974 | 0.026 | 0.178 |

Short surahs sit near 1.0 under the null, so most of their raw distance is sampling noise; the table says so instead of ranking them. Cost: about 50 seconds per 100 permutations for all pairs. Limits to state on the page: verses within a surah are not independent draws, so the p-value answers "more different than shuffling verses between these two surahs would produce", not a claim about the text's composition; and a distance between root distributions is not a similarity of meaning.

## 4. Concrete Implementation Artifacts

All files are in `docs/elevation/`. Each was run here; results are under "What was verified".

| Artifact | File | Notes |
|---|---|---|
| Zod schemas + TypeScript types: layers, sensitivity rows, extended association rows, verified gloss (locator required, label fixed to Nuanced), scholarly overlay (page per unit) | `schemas.ts` | Not imported by the site |
| Deterministic generator: extended association measures | `compute-association-extended.mjs` | Follows repo conventions: embedded hand-computed test, `--check` against the published file |
| Deterministic generator: annotation sensitivity between layers | `scripts/compare-layers.mjs` + `scripts/lib/layers.mjs` (adopted from `layer-sensitivity.mjs`) | `--selftest`; refuses misaligned layers |
| Deterministic root-network layout + pure SVG renderer | `root-network.mjs` | Replaces "a React component" |
| Claim record for the new statistic | `claim.example.json` | Field values are exactly what `check-claims.mjs` enforces |
| Notebook reproducing Numbers-page figures from the data pack | `docs/notebooks/reproduce-numbers.ipynb` (moved; runs in CI) | Five checks |

### API sketch (static, no server)

```yaml
openapi: 3.1.0
info: { title: Divine Discourses data, version: "1.3.1" }
servers: [{ url: https://divinediscourses.org/api/v1 }]
paths:
  /index.json:                  # every table, its version, sha256, licence, schema pointer
    get: { responses: { "200": { description: manifest } } }
  /versions/{version}/tables/{name}.{ext}:   # immutable: a release never changes
    get: { parameters: [version, name, { name: ext, schema: { enum: [csv, json] } }] }
  /tables/{name}.{ext}:         # always the current release; short cache, never immutable
  /roots/{safeKey}.json:        # assembled at build time from the per-root files
  /surahs/{n}.json:
```

Implementation: Netlify `status = 200` rewrites to existing files plus header rules (`Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=31536000, immutable` **only** under `/versions/`). Add the blocks to `check-headers-sync.mjs`'s `REQUIRED_BLOCKS` so they cannot be deleted by a merge. A thin function is unnecessary and would add an attack surface.

### Updated coverage-report outline

Extend `compute-coverage.mjs` (keep `--check`, ignore the date stamp) with: `layers` (id, version, licence verified yes/no, alignment %); `rootGloss` split into `byRoot` and `byTokenWeight` (rooted tokens covered / 49,967); `lemmaGloss`; `overlays` (surahs with a page-cited overlay, by scholar); `claims` by `sourceCheck`/`reproduction`/`agreement`; `independentReproductions`. Missing facts stay "not stated in repository", never inferred (the script's existing rule).

### What was verified

| Check | Result |
|---|---|
| `compute-association-extended.mjs --check` for roots `qwl`, `rHm`, `Alh` (25 partners each) | k11 exact; PMI, Dice, G2 within the published file's rounding (worst PMI 0.0049, Dice 0.0005, G2 0.0048) |
| Same script run twice | Identical SHA-256 |
| Embedded unit test | Hand-computed 2×2 (10/5/5/10, N = 30) matches |
| `layer-sensitivity.mjs --selftest` | Identity: 0 differences. A synthetic perturbation (never written to disk) of exactly 100 removed and 50 swapped roots reports exactly 150. A short layer is refused. An unannotated layer is not counted as disagreement |
| `schemas.ts` | Strict `tsc` 7.0.2 with zod 4.6.7; a valid gloss passes; a gloss without a locator or with the wrong label, an overlay with `to < from`, and an incomplete manifest are all rejected |
| `root-network.mjs` | Seeded force layout: same seed, same bytes; different seed differs; all nodes in bounds. The SVG renderer is deterministic, has no script, and rendered a real `data/network/qwl.json` (screenshot reviewed; label overlap exists in the shipped layout) |
| `claim.example.json` | Structurally valid under today's rules. Blocked only by the four conditions listed in its header (script, output, source registration, worked example) |
| `reproduce-numbers.ipynb` code cells | Ran against the committed pack: rooted tokens 49,967 over 1,642 roots; 77,429 word-units (64.53% rooted); top five roots; per-root and per-surah tables agree |

---

## 5. Data Acquisition & Licensing Playbook

**Rule: no layer ships until its licence is read from the resource itself and its file is hashed.** Search abstracts below are leads.

| Resource | What I found | Licence | Status |
|---|---|---|---|
| **MASAQ** (Mendeley Data `9yvrzxktmr`, latest version seen: v6, Dec 2024) | Whole Quran; >131K morphological and >123K syntactic items; expert-checked with traditional i'rab; built on Tanzil text; txt/CSV/XLSX/XML/JSON | **CC BY 3.0** per the dataset listing | [Unverified] listing seen, not opened; copy the exact citation from the dataset page |
| **QuranMorph** (arXiv 2506.18148; SinaLab, Birzeit; `sina.birzeit.edu/quran`) | 77,429 tokens, each manually lemmatized and POS-tagged by three linguists; lemmas from Qabas; SAMA/Qabas tagset (40 tags) | Paper says open-source and publicly available; **licence name not seen** | [Unverified]; confirm what fields the download carries, especially roots |
| **QAMAR** (ACL Anthology `2026.abjadnlp-1.38`, AbjadNLP 2026, pp. 301–312; Faqihi, Bouzoubaa, Tajmout, Namly) | Manually verified, multi-task: per word an MSA equivalent, stem, lemma, root, POS | **Not seen** | [Unverified]; size and tagset unseen |
| **Leeds v0.4** (current) | Root, lemma, POS; no glosses in the dump (the repo's `build-leeds.js` says so) | GPL | [Verified] |
| **Word-by-word English gloss** (Shaikh & Khatri via QUL) | Research memo already in the repo | Per-resource label unverified; permission wording unverified | Owner task A5 |
| **Classical lexica** for root glosses | Lane's *Arabic–English Lexicon* (1863–93) is public domain by age; digital editions carry their own terms | Verify the edition's terms before using any transcription | [Modeled] suitable first source; **do not** use *Hans Wehr* or other in-copyright dictionaries without written permission |
| **"Project Root List dictionaries"** (named in the brief) | I did not search for or verify this | Unknown | Lead only |
| **Scholarly overlays**: Khan 2013 (owner's Transcription Gate); Islahi, Cuypers, Farrin | Works exist; their rights and fair-use position for page-cited section divisions are unreviewed | Rights-gated | Counsel/permission first; start with Khan |
| **Bannister**, *An Oral-Formulaic Study of the Qur'an* (2014) | Method citation for formulaic density; already referenced in `datasets.html` | n/a (cite, don't reproduce) | [Verified] cited |

### Citation and badge strategy

- Each resource gets a `data/sources.json` entry (kebab id, e.g. `masaq-2024`) with Chicago line, licence text quoted from the source, URL, retrieval date, and (for layers) file sha256; it appears in `sources.html` and `NOTICE.md`.
- Existing badges keep their meaning (● verified, ○ pending, ~ nuanced). A layer adds a **layer chip** naming resource and version next to any figure computed from it. Cross-layer comparisons are always `~` (method-dependent). A gloss is always `~`: a lexicographer's choice, never "the meaning".
- Per-file attribution in the export: `layer` and `sourceIds` columns, `NOTICE-<layer>.txt` in the pack.

### Adding a layer without breaking Leeds-based claims

1. Verify and record the licence; save the upstream hash.
2. Write `ingest-layer-<id>.mjs` (offline, deterministic) emitting `LayerToken` files.
3. Run the alignment audit; fix by mapping, never by editing Leeds.
4. Run `compare-layers`; review divergences as data, not as errors.
5. Add `sources.json`, `NOTICE.md`, changelog entry, claim(s) + worked example.
6. Confirm **zero** diff in every existing Leeds-derived export (`git diff` on `data/exports/` must be empty apart from new files).
7. Bump MINOR in `data/version.json`; cut the release (pack, DOI, tag).

---

## 6. Risk Register & Guardrails

| # | Way the elevation could violate the philosophy | Safeguard |
|---|---|---|
| 1 | A sensitivity table gets read as "resource X is right" | No ranking or best layer; every row is a difference; claim fixed at `method-dependent`; limitations stated beside the table |
| 2 | Lexical co-occurrence presented as theological relatedness | Method notes name the measure and the 2×2 definition; the site's standing "frequency is not meaning" limitation is attached to every collocation claim |
| 3 | A gloss or overlay presented as the site's own interpretation | `GlossRecord`/`OverlayRecord` schemas require source + locator + second reader; label fixed to Nuanced; verbatim only; Transcription Gate |
| 4 | Machine-generated text creeping in (summaries, "explanations") | Claim rule already blocks AI-involved interpretive content (`check-claims.mjs`); no feature may emit prose about meaning; code review checklist item |
| 5 | Determinism lost to randomness, dates or network calls | Seeded PRNG, fixed iterations, no dates in new outputs (or `SOURCE_DATE_EPOCH`), ingest offline after hash check; "run twice, byte-identical" is a CI test |
| 6 | Silent change to existing numbers when a layer is added | Step 6 above: empty `git diff` on every Leeds export; freshness gate in CI |
| 7 | Licence violation (GPL, CC, copyrighted lexica or scholarship) | Licence read from the source; hash recorded; counsel for scholarship overlays; the repo's Gate-0 habit applied to every dataset |
| 8 | Over-claiming novelty or authority | Claims limited to what was run; coverage page reports the 0%s; no ranking, traffic or citation guarantees anywhere |
| 9 | Privacy weakened by workspaces, notebooks or API | Local storage only; no new origins; no per-user server state; downloads, not embeds; analytics unchanged |
| 10 | CSP loosened by interactive features | Pure-function SVG, same-origin modules; any proposal that adds an origin is rejected unless it carries its own review |
| 11 | Becoming a general Qur'an app or chatbot | Scope filter: every feature must produce an auditable table, figure or export; no recitation, prayer, or conversational features; the existing Ask box stays a router |
| 12 | Maintainer burnout (one maintainer) | Roadmap ordered so each phase is useful alone; contribution pipeline (B9) before large transcription efforts |
| 13 | Documentation drift: one repo review says "no analytics" though GA4 has been added | Treat docs as claims: add them to the freshness checks (a stale `docs/multidisciplinary-excellence-review.md` privacy line is an example to fix) |

---

## 7. Success Metrics & Measurement Plan

Principle: measure with public, aggregate, non-invasive sources. Do not add tracking of reading, notes or searches.

| Question | Measure | Source | Baseline |
|---|---|---|---|
| Is the evidence base broader? | Layers aligned; roots/tokens with verified gloss; overlays with page cites; claims by status | `data/coverage/report.json` (generated, `--check`ed) | Verified, see §1 |
| Is it reproducible by others? | External re-runs recorded; notebook CI passing; `independently-reproduced` claims | GitHub issues/PRs; claims ledger | 0 / 0 |
| Is it reused? | Data-pack downloads; DOI citations; API index hits (aggregate, no identifiers) | Zenodo/GitHub release stats; OpenAlex/Crossref; Netlify aggregate logs if enabled | Unmeasured |
| Do scholars trust it? | Number of expert reviews and corrections merged; correction turnaround; time-to-reproduce a figure in a 5-scholar usability test | `corrections.json`, `reviewers.json`; moderated sessions | Both files empty today |
| Did we stay true to the philosophy? | Zero un-labeled figures; zero AI-involved interpretive claims; zero drift in Leeds exports across releases | CI gates | Passing today |
| Did the site get slower or less accessible? | Size/request budgets (`verify-site` budgets); axe-style subset; assistive-technology review of charts | CI; manual | Budgets pass; conformance not claimed |

Qualitative review at 6 and 12 months: a short written assessment per phase against the non-negotiable principles, published in the changelog. Search impact and traffic remain unmeasured until Search Console is connected.

---

## First 30 Days

1. **Days 1–3.** Read the licence text for MASAQ, QuranMorph, QAMAR from the sources themselves; record URL, licence quote, file sha256, tokenization notes as ○ Pending in `sources.json` (A3).
2. **Days 3–7.** Decide the gloss source (A5): verify the QUL resource label and the volume's permission page, or choose a public-domain lexicon edition and verify its terms.
3. **Week 2.** Adopt `compute-association-extended.mjs` into `scripts/` with `--check`, the export table, the claim and its worked example, and the measure toggle (A1). Confirm the existing association files are unchanged.
4. **Week 2.** Adopt `layer-sensitivity.mjs` as a generator with Leeds as layer 1 and an empty-state `/layers` page (A2).
5. **Week 3.** Publish the notebook on the Export page and run it in CI (A4); mint a Zenodo DOI for the next release (A7).
6. **Week 3.** Extend `compute-coverage.mjs` with token-weighted gloss coverage and the layer/overlay counts (A6).
7. **Week 4.** Start the static API (B7) with the index manifest only, and write the issue forms for glosses and overlays (B9) so contributions arrive in schema.
8. **Week 4.** Choose which one layer to ingest first (MASAQ if its licence is confirmed), and write its ingest script against the alignment audit before touching any page.
