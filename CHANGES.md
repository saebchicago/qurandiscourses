# Changes — open-source readiness audit: licensing scope, offline charts, measured cleanups

## Why this pass exists

Before opening the repository, three independent sweeps were run over
the whole tree: one for secrets and personal information, one for
licensing and attribution consistency, and one for code defects and
technical debt — plus the full in-repo check suite and the complete
Playwright site audit (173 checks across all 30 pages, all passing
before and after this change). The secrets sweep came back clean: no
credentials anywhere in the working tree or the full git history, no
email addresses at all, no personal paths or hostnames, no analytics
(the "No analytics. No tracking." claim on credits.html was verified,
not assumed). The other two sweeps found the items below. Everything
here is a fix for something found, not a feature.

## Licensing: LICENSE now says what it covers

The LICENSE file was a bare MIT grant over "this software," which on
its face covered the GPL-derived Leeds morphology, the quoted Khan
glosses, the license-pending Mishkat cross-references, and the OFL
fonts — all things MIT cannot grant. It now opens with a scope
statement: MIT covers the site's own code and the data NOTICE.md lists
as site-authored; everything bundled from third parties keeps its own
license, with NOTICE.md as the authoritative breakdown.

NOTICE.md itself had drifted: the five analytics directories added in
the last three releases (`data/association/`, `data/network/`,
`data/centrality/`, `data/coverage/`, `data/exports/`) never got a
mention, and several older Leeds-derived datasets (`rhyme/`, the
formulas files, `discursive-pivots.json`, `symmetry-test.json`,
`roots-list.json`, `theme-surah-index.json`) were absent from the
GPL-inheritance list even though datasets.html already labeled them
GPL. The site-authored and GPL-derived lists are now complete, the
coverage report's use of the license-pending `data/qursim/` directory
(file counts only) is disclosed, and a new paragraph covers the
runtime-fetched translation editions, whose copyrights stay with their
translators — previously only the Tanzil Arabic text was addressed.

Because that drift went unnoticed for three releases, a new checker
(`scripts/check-notice.mjs`, wired into CI) now fails the build if any
top-level `data/` entry is missing from NOTICE.md.

One licensing gap is documented rather than resolved: no copy of the
GNU GPL text ships in the repository, and upstream states "GNU General
Public License" without pinning a version. NOTICE.md now says exactly
that and points to gnu.org; bundling a verbatim copy (and choosing
which version's text to include) is a one-command owner decision from
an unrestricted network, deliberately not fabricated from memory here.

README.md's licensing bullets, page count (28 → 30), dataset list, and
generator list were brought current for the same reason; datasets.html
gained cards for the five analytics datasets its own lede claimed to
cover; and the maintainer guide's site map and pipeline table now
include the five compute scripts and the dependency order for
rerunning them.

## Bugs found and fixed

- **numbers.html** rendered "21. Singular Claims of 12…" in the
  day-month-year card — an orphaned word from an old edit, on the page
  whose whole premise is precision. Removed.
- **sw.js** never cached the `js/` directory, so offline visits to the
  three pages that load `js/viz.js` silently rendered without their
  charts (each render guard hides the failure rather than erroring).
  The asset route now covers `/js/`, and SW_VERSION is bumped to v6 —
  a bump that was also due under the guide's own rule after three
  releases of new data schemas shipped without one.
- **assets/chart.js** tooltips could not be dismissed with Escape
  (its younger sibling js/viz.js could), and each module created its
  own floating tooltip element, so two could coexist and one layer's
  dismissal could not clear the other's. Both modules now share one
  element and both honor Escape.
- **navigate.html** was the one place in the site saying "Meccan,
  early period" while the chart legend on the same page said "Early
  Meccan." Labels now match the other seven copies.
- **themes.html**'s per-theme distribution strip had the site's only
  fetch chain without a terminal catch: a throw mid-render stranded
  the panel on "Computing…" forever. It now reports failure like every
  other lazy panel.
- **read.html**'s recurring-word highlights were keyboard-focusable
  spans with no role, so screen readers announced nothing actionable.
  They now carry `role="button"`; the accessible name stays the Arabic
  word itself (an English label would have replaced it).
- **compare.html and roots.html** had three fetches that skipped the
  `response.ok` check, so a 404 surfaced as a JSON parse error instead
  of an honest HTTP status. All three now check.
- **how-it-works.html** loaded refs.js without glossary.js, the only
  page violating refs.js's documented ordering contract ("glossary.js
  runs FIRST"); terms on that page got different popovers than on its
  nine siblings. glossary.js is now loaded there too.
- **scripts/compute-association-stats.mjs** contained four literal NUL
  bytes (a pair-key separator written as the raw character instead of
  the `\u0000` escape), which made git treat the file as binary — no
  reviewable diffs, invisible to grep. Replaced with the escape; the
  regenerated output is byte-identical.

## Reproducibility and hygiene

- Ten generators stamped their output with the run date, so rerunning
  any of them on a later day produced a 1,600+ file diff of nothing
  but date stamps — masking real changes and quietly breaking the
  guide's "run it twice, git diff must be empty" rule across day
  boundaries. All ten now honor `SOURCE_DATE_EPOCH` (the
  reproducible-builds.org convention) via a shared
  `scripts/lib/computed-date.mjs`; behavior without the variable is
  unchanged.
- `build-root-analytics.mjs` and `build-cooccurrence.mjs` carried
  private copies of the safeKey encoding despite being modules; both
  now import the shared lib, and the lib's sync comment now names all
  nine remaining inline copies instead of three.
- `.gitignore` gained the patterns most likely to catch a future
  accidental commit: `.env.*`, `.netlify/` (the CLI writes a state
  file containing the site ID), editor and merge leftovers,
  `__pycache__/`, and key material (`*.pem`, `*.key`, `*.p12`).
- The gloss manifest and two doc passages still described the gloss
  pipeline as "dormant/empty until licensed" even though six surahs of
  Khan (2011) glosses have shipped; the manifest comment, its
  generator template, the maintainer guide, and the gloss research
  memo (now marked partially superseded) all state the shipped
  reality.
- changelog.html gained entries for the three analytics releases and
  this audit — it had not been updated since release #65.

## Verified after the changes

`check-nav-sync`, `check-headers-sync`, `build-csp --check`,
`check-data-nums`, `check-claims`, `check-paths`, `check-exercises`,
`check-videos`, and the new `check-notice` all pass; the full
verify-site Playwright suite passes on every page; every regenerated
dataset is byte-identical to what shipped. The two network-dependent
checkers (`check-source-links`, `check-editions`) cannot run from a
sandboxed session per their own headers and should be run from an
unrestricted machine before release.
