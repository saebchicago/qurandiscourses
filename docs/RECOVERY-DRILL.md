# Recovery drill receipts

A written runbook is not a restore test. This file records only drills that were run, with the exact version and results.

## 2026-10-03: rebuild-from-git, static checks (not a production restore)

- **Version:** `551241dd1c3bd8c291460bda9e4cef5a78c0bb49` (main, "Isolate Tanzil text checks and expose upstream fetch causes (#158)"), Node v22.22.0, Linux.
- **Scope:** fresh `git clone` into an empty directory, `git checkout` of that SHA, then the offline checks below. Non-destructive: nothing deployed, no Netlify state touched, no files written outside the clone.
- **Results (all exit 0):**
  - `node --test scripts/build-quran-text.test.mjs`: 6 pass
  - `check-headers-sync`: 35 pages x 2 addresses, 36 redirects
  - `check-sw-version`: v19, 89-file manifest in sync
  - `check-notice`, `check-static-server`: OK
  - `check-generated-freshness`: 31 generators match committed output (6 not checkable offline: og images, surah-meta, quran-text, recitation-durations, word-timings, gloss)
  - Committed Arabic text index: sha256 `f502f34512db57fca04ece7dbb76123aaa3cc515ac849137684f976682089254`, 114 surah files
- **Browser audit (same SHA, run in the working checkout, alquran.cloud and cdn.islamic.network aborted so the offline path is tested):** `node scripts/verify-site.mjs` 565 checks, 565 pass, 0 warn, 0 fail.
- **Upstream text check (GitHub runner):** workflow `Bundle Qur'an text` run 37131421225, `workflow_dispatch` on main at the same SHA, concluded success (`--check` against Tanzil's current file). The preceding scheduled run on main (36871876921, 2026-10-01, SHA 3cb37c9) had failed, before #158.

## Not done (needs the owner)

- Netlify rollback or restore to a previous production deploy, and confirming the live site serves this SHA. Requires Netlify access and an owner decision to touch production.
- Restore of user data: none server-side. Reader data (notes, pins, saved surahs) is browser-local; export/delete behavior is covered by `verify-site` features checks, not by a drill.
- Time-to-recover has not been measured.
