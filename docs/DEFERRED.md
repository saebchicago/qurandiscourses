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
