# Deferred

Items skipped rather than blocking a PR, with the reason and what would
unblock them. Append; do not rewrite history.

---

## Netlify deploy-time blocking for `validate-evidence.mjs`

**From:** PR 1, evidence layer.

The brief asked for the validator to be wired into the Netlify build so
a failure blocks deploy. It is wired into CI instead, where it blocks
the merge.

**Why not the Netlify build.** There is no build. `netlify.toml`'s first
line reads "no build step; deploy = push", there is no `package.json`,
and the publish root is the repo root. Introducing a `[build]` section
would make Netlify start running builds for a site that has never had
one, and a mistake in `publish` would take the whole site down. It also
contradicts the standing constraint "No build step".

**What it would take, if wanted.** Add to `netlify.toml`:

```toml
[build]
  command = "node scripts/validate-evidence.mjs"
  publish = "."
```

Verify on a deploy preview that the publish root still resolves and that
every page and data file is still served, before merging it to `main`.

**Current gate:** `.github/workflows/audit.yml`, step "Validate claims
and site registries". A failure blocks the merge, which is the point at
which bad data would otherwise reach `main`.

---

## PR 5 — surah contextual panel

**From:** the provenance brief, PR 5.

Section B needs the surah 85–114 grouping from *An Exercise in
Understanding the Qur'an*. **No such data exists in the repo.** Verified:
`data/khan-interpretations.json` carries excerpts for six surahs (96,
103, 107, 108, 109 and one more), `data/exercises.json` holds seven
outline/roots exercises, and nothing anywhere encodes a grouping. The
brief forbids constructing it, correctly — a group assignment is a
scholarly claim, not something to infer.

Built as specified, Section B would render "Group assignment not yet
encoded." on all 114 surahs. The brief's own note calls that a wasted
PR, and the owner chose to defer.

**Unblocker:** the grouping transcribed from the 2013 book, page-cited,
encoded as data. Section A (ayah, token and root counts plus corpus
share, all computable today from the Leeds corpus) can ship at the same
time.

## The Works page

**From:** the provenance brief, PR 2. Opened as #104, closed unmerged.

Closed for process reasons — the owner confirmed the page content itself
was fine, the stacking was not wanted. The work is complete and verified
on the unmerged branch `feat/works-page`: three books generated from
`data/provenance/sources.json`, two ISBNs rendering "unresolved" with
byte-frozen record notes explaining why, `verify-site` 318/318, full
page-addition recipe done.

**To revive:** branch from current `main` and cherry-pick
`feat/works-page`. It needs `data/provenance/sources.json`, which is now
on `main` via #103, so it no longer depends on anything unmerged.

---

## Corpus-wide grammatical person (iltifat), and the fork that was rejected

**From:** the textual-analysis round of 2026-08-16. Owner decision:
fetch the Leeds file "not now", and "wait for the full corpus" rather
than ship a partial analysis.

### What the bundled corpus can and cannot see

Measured against the committed `data/morphology/*.json`, not estimated:

| Measurement | Value |
|---|---|
| Committed corpus | 77,429 words, 6,236 verses, 33 POS tags |
| Words tagged `PRON` | 3,301 (4.26% of tokens) |
| Distinct `PRON` surface forms | 147 |
| Those forms carrying more than one grammatical person | 0 |
| Verses with at least one `PRON` word | 2,359 (37.8%) |
| Surahs with at least 10 pronominal tokens | 62 of 114 |

Person is therefore recoverable *with certainty* for the pronouns the
corpus can see — every one of the 147 forms is unambiguous, so a
hand-authored mapping table would be exhaustively auditable. The gap is
scope, not ambiguity: one entry per orthographic word hides every
pronoun attached to a verb or noun, and verb agreement — the dominant
signal in iltifat — is absent entirely. See §9 of
`docs/maintainer-guide.md` for the parser detail and the unblock recipe.

### Why nothing partial shipped

A dataset covering 4.26% of tokens and blind to verb agreement would
invite exactly the reading it cannot support. The owner chose to wait.
The design is recorded here so it is not re-derived: per-verse person
sets from a shipped `_mapping` table, a generator that fails loudly on
any unmapped form, per-surah profiles, a seeded within-surah verse
permutation null via `scripts/lib/permute.mjs`, and BH-FDR across 114
surahs via `scripts/lib/stats.mjs` — both modules already export
everything needed.

### The fork: evaluated, verified, rejected

`mustafa0x/quran-morphology` is reachable where `corpus.quran.com` is
not, and self-describes as a fork of QAC v0.4 carrying the full feature
set (person/number/gender, verb form I–X, `PASS`,
`MOOD:IND|JUS|SUBJ`, `IMPV`) across 130,030 segments, including 24,681
pronoun segments against our 3,301 pronoun words.

It is provably the same underlying corpus: it reproduces **77,429 of
77,429** committed Arabic word forms byte-for-byte, with zero
mismatches. It is still not usable:

- **No `LICENSE` file.** Its parent is GPL and GPL is inherited, but the
  fork declares nothing. That is the same undeclared-licence posture the
  site already refuses for `data/qursim/`.
- **It is edited, by its own README** — added roots, "many root and
  lemma fixes", `T`→`SUR` retagging, gender removed from dual pronouns.
  Measured drift against our corpus: **545 of 77,429 words (0.70%)**
  disagree on the root — 374 the fork roots and we do not, 73 the
  reverse, and 98 tokens on the two Arabic roots that map to two
  different committed Buckwalter roots (`عون`, `أنس`). Every published
  root frequency, association, centrality and dispersion figure on this
  site is keyed to the unmodified v0.4; adopting the fork would fork the
  corpus underneath them.

**Unblocker:** the official `quranic-corpus-morphology-0.4.txt`, which
requires submitting a contact e-mail and accepting the GNU licence
terms at `corpus.quran.com/download/` — a human step, not a network
one. Then the reproduction gate and the parser extension in §9 of
`docs/maintainer-guide.md`.

---

## Per-generator `--check` for the 25 guarded only in aggregate

**From:** the audit of 2026-08-16. **Narrowed** after
`scripts/check-generated-freshness.mjs` shipped: the CI gap this entry
originally described is closed. What remains deferred is smaller and
different.

**What is now covered.** `check-generated-freshness.mjs` runs all 25
generators that have no `--check` of their own into a temp copy of the
repo and compares their output against what is committed, ignoring the
`_computed` date stamp. ~20s, wired into CI. Staleness in any of them
now fails the build, which is what the original entry was about.

**What is still missing, and who wants it.** A maintainer who touches
one generator cannot check just that one cheaply — they either re-run it
and read `git diff`, or run the whole 20-second sweep. `--only=` narrows
the sweep, but it still copies the repo. A real per-generator `--check`
would be instant and would follow the house convention that the other 17
generators already use.

**What makes it more than a copy-paste job**, unchanged from the
original assessment:

- Several write **thousands of files** (`compute-association-stats`
  1,642, `build-root-analytics` 1,642, `build-share-pages` 1,789), so
  `--check` must compare a directory and decide what to report when many
  differ at once.
- `build-surahs-js` and `build-root-refs-index` write JavaScript, and
  `build-exports` writes `.csv` and `.md`, so the stamp cannot always be
  stripped by parsing JSON.

A shared `emitOrCheck()` in `scripts/lib/` handling both shapes is the
right form — the same extraction Part 9 §D5 recommended for the 14-copy
`--check` epilogue. The stamp-insensitive comparison it needs already
exists in two places to copy from: `scripts/compute-coverage.mjs` and
`scripts/check-generated-freshness.mjs`. Doing it well means touching 25
generators with the bar "output stays byte-identical", which is its own
reviewable change.

---

## A caution for any future "delete dead CSS" pass

**From:** the same audit, recorded because the obvious method is wrong.

A naive scan — "class defined in `assets/style.css`, mentioned in no
HTML or JS" — reported three dead classes on `main`. **All three were
false positives**, and one would have caused a real regression:

- **`is-verified`** is built by template.
  `scripts/build-provenance.mjs` emits
  `class="claim is-${esc(c.status)}"`, so the literal string never
  appears in any source file. Deleting the rule would have silently
  broken the provenance apparatus the first time a claim with status
  `verified` was marked on a page.
- **`chart-disclaimer`** is set at `js/viz.js:218`. The scan searched
  `assets/*.js` and missed the `js/` directory entirely — the repo has
  browser JavaScript in **two** directories.
- **`research-hero`** had no rule at all, only a stale comment left
  behind when #101 deleted it. (That comment is gone as of this audit.)

Template-constructed class names are invisible to grep by construction.
Any such pass must at minimum search `js/` as well as `assets/`, and
must treat every `is-*` status class as live because
`data/provenance/claims.json`'s status enum can produce all of them.
