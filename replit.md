# Replit setup

This repository is a zero-dependency static website.

## Run

The **Start application** workflow runs:

```bash
node scripts/serve.mjs 5000
```

The custom server is required because it resolves clean URLs such as `/read`
to their corresponding `.html` files, matching the production hosting setup.

## Sync workflow (GitHub is the source of truth)

- Production: GitHub `main` auto-deploys to Netlify (divinediscourses.org). Never commit or push to `main` from Replit.
- Work on the `replit-edits` branch. Start every session with Git pane > Pull. End with Commit > Sync Changes, then open a pull request into `main` on GitHub.
- Do not use Replit Publish. Hosting and the custom domain stay on Netlify.
- The Replit preview does not apply netlify.toml headers. After editing any inline script or style block, run `node scripts/build-csp.mjs` then `node scripts/check-headers-sync.mjs`, and commit the resulting netlify.toml changes.
- Before pushing, run the checks listed in `.github/workflows/audit.yml`.
- This file is blocked from public serving by a 404 rule in netlify.toml.
