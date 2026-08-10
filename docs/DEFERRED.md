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
