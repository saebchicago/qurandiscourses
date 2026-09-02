# Evidence schema — `data/provenance/`

Two files record what is known about Dr. Irfan Ahmad Khan's life and
work, and how far each statement sits from his own words:

- `data/provenance/sources.json` — the source registry
- `data/provenance/claims.json` — the claim registry

`scripts/validate-evidence.mjs` enforces everything below and runs in CI.

## Relationship to `data/sources.json` and `data/claims.json`

These are **separate registries** and neither reads the other.

`data/sources.json` (39 sources) and `data/claims.json` (22 claims) hold
the site's computed-analysis apparatus. That schema is built for
reproducible computation: every claim carries a `derivation`, a
`reproduction` recipe, and `limitations`, and `scripts/check-claims.mjs`
bonds each one 1:1 to a worked example in `data/case-studies.json`. Those
source ids are also the target of 176 `data-source-ids` badges across 20
pages.

A biographical or bibliographic statement about a person has no
derivation and cannot carry a worked example, so it cannot satisfy that
schema. Rather than weaken the computed registry's guarantees to
accommodate a different kind of record, provenance claims live in their
own files with their own schema and their own validator.

Where both registries describe the same object, they share the id. The
three Khan books are `khan-reflections-2005`, `khan-introduction-2011`
and `khan-exercise-2013` in both files.

## `provenance_distance`

An integer 0–3 on every source, stated verbatim as the registry defines
it:

```
0 = Dr. Khan's own words, in a source he authored or authorized
1 = Dr. Khan's own words quoted verbatim inside another author's work
2 = another author's characterization of Dr. Khan's position
3 = general-audience or press restatement
```

Distance describes how many steps separate a statement from Dr. Khan's
own words. It is a record of documentation, not an assessment of
accuracy. A distance-2 statement is not less likely to be true than a
distance-0 statement; it is differently evidenced.

## Source record

Every key is required. A key not listed here is a validation failure.

| Key | Type | Notes |
|---|---|---|
| `id` | string | kebab-case, unique within the file |
| `class` | enum | see below |
| `provenance_distance` | integer | 0–3 |
| `author` | string \| null | |
| `title` | string \| null | |
| `container` | string \| null | journal, publisher, channel, outlet |
| `volume` | string \| null | |
| `issue` | string \| null | |
| `year` | integer \| null | |
| `pages` | string \| null | |
| `isbn` | string \| null | |
| `url` | string \| null | |
| `url_status` | enum \| null | `resolves`, `unconfirmed`, `paywalled` |
| `accessed` | string \| null | `YYYY-MM-DD` |
| `status` | enum | `verified`, `nuanced`, `pending` |
| `notes` | string \| null | factual notes about the record itself only |

`class` is one of: `khan-text`, `khan-correspondence`, `khan-recording`,
`azmat-scholarship`, `third-party-scholarship`, `press`,
`retail-catalog`, `corpus`.

A `null` means the field has not been seen stated in a source. It is
never a placeholder for a value that could be inferred, converted, or
reconstructed. Two of the three books carry `isbn: null` for exactly
this reason, and their `notes` record why.

`notes` carries factual observations about the bibliographic record —
conflicting catalog metadata, a publisher prefix that does not match the
stated publisher, an edition ambiguity. It never carries a description
or assessment of the work's content.

## Claim record

| Key | Type | Notes |
|---|---|---|
| `id` | string | kebab-case, unique within the file |
| `statement` | string | neutral factual statement |
| `kind` | enum | `biographical`, `bibliographic`, `institutional`, `methodological`, `structural` |
| `status` | enum | `verified`, `nuanced`, `pending` |
| `sources` | array | source ids; non-empty unless `status` is `pending` |
| `conflict` | object \| null | see below |
| `quote` | object \| null | see below |

`conflict`:

```
{
  "field": string,
  "positions": [ { "value": string, "sources": ["source-id", ...] }, ... ],
  "resolution": string | null
}
```

A `positions` entry may carry an **empty** `sources` array. That is
legal and deliberate: it records a position that circulates without a
registered source behind it, which is information worth keeping rather
than discarding.

`quote`:

```
{ "text": string, "source": "source-id", "locator": string | null }
```

`text` is byte-frozen. Punctuation, diacritics, capitalization,
hyphenation and typographical artifacts are preserved exactly as they
appear in the source. Apostrophes are not normalized. `Qur'an` /
`Quran` / `Qur'ān` are not reconciled inside a quotation.

## Validator rules

`scripts/validate-evidence.mjs` exits non-zero on any of:

1. Duplicate `id` within either file.
2. A record missing a schema key, or carrying a key not in the schema.
3. `class` outside the enumerated set.
4. `provenance_distance` not an integer 0–3.
5. `status` outside `{verified, nuanced, pending}`.
6. A claim with status `verified` or `nuanced` and an empty `sources`.
7. A `sources` entry that resolves to no source `id`.
8. A `quote` whose `source` resolves to no source `id`.
9. A `conflict.positions` entry citing an unresolvable id. (An empty
   `sources` array inside a position is legal — see above.)
10. A source with `url` set but `url_status` null.

It then prints a summary — counts by class, status, distance, and kind,
plus conflicts, quotes and open questions. Every figure is counted from
the files at run time.

## Where it runs

CI, in the "Validate claims and site registries" step of
`.github/workflows/audit.yml`, alongside `check-claims.mjs` and the other
registry checkers. A failure blocks the merge.

It is not wired into a Netlify build command because the site has no
build step — `netlify.toml`'s first line records this, and there is no
`package.json`. See `docs/DEFERRED.md` for what adding deploy-time
blocking would require.

## Adding a record

1. Add the source or claim to the relevant file.
2. Leave unknown fields `null`. Do not infer, convert, or reconstruct.
3. Run `node scripts/validate-evidence.mjs`.
4. If a statement cannot be traced to a source, set `status` to
   `pending` with an empty `sources` array rather than omitting it. The
   open-questions register surfaces those deliberately.
