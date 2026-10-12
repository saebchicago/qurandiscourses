# Route inventory and index policy

Counts measured from the repository on 2026-10-12 (2,526 HTML files, 589 sitemap URLs). Production was confirmed through Netlify to be serving main at `e9e2893` (45 redirect rules, 95 header rules, the `wbw` function); this sandbox could not fetch the live site, so live HTTP behavior is checked by `scripts/smoke-deployed.mjs`, run where the network allows.

## Policy in one paragraph

One canonical host, `https://divinediscourses.org`, and one address per page: the clean path (`/read`, never `/read.html`, which 301s). `divinediscourses.com`, `www.` and `http://` 301 to the same path on the canonical host. Query states (`/read?s=2&a=255`, `/dossier?s=103`, `/search?q=…`) are functional and shareable but canonicalize to their page; the indexable per-entity content lives on the static `/surah/`, `/juz/` and `/root/` pages, not on query permutations. Utility, share and template pages are `noindex` and outside the sitemap. `lastmod` is the date a page's visible text or links last changed (`build-page-dates.mjs`), not the deploy date.

## Route families

| Family | Count | Purpose and audience | Index | Canonical | Sitemap | Static HTML | Structured data |
|---|---|---|---|---|---|---|---|
| `/` | 1 | Entry: today's discourse, ways to study | index | self | yes | yes (static fallbacks) | WebSite, WebPage |
| Study and analyze pages (`/read`, `/navigate`, `/dossier`, `/themes`, `/compare`, `/replay`, `/roots`, `/words`, `/patterns`, `/formulas`, `/numbers`) | 11 | Readers and students working with the text | index | self (query states fold in) | yes | prose and fallbacks; interactive parts need JS | WebPage, BreadcrumbList |
| Learn pages (`/how-to-use`, `/how-it-works`, `/exercises`, `/exercise`, `/exercise-roots`, `/paths`, `/glossary`, `/vocabulary`, `/watch`) | 9 | Newcomers learning the method | index | self | yes | yes | WebPage; DefinedTermSet (glossary), LearningResource (paths) |
| Trust pages (`/about`, `/sources`, `/datasets`, `/validation`, `/credits`, `/changelog`, `/coverage`, `/export`, `/contribute`, `/review`, `/corrections`, `/open-questions`, `/search`) | 13 | Researchers checking sources, methods, corrections | index | self | yes | yes | WebPage; Person (about), Book/ScholarlyArticle/Dataset (sources), Dataset (datasets, export), Claim (validation) |
| `/surah/1`–`/surah/114` | 114 | "Surah X" searches: identity, published readings available, counts, computed structure, full Tanzil text | index | self | yes | yes, fully | WebPage (about a CreativeWork), BreadcrumbList |
| `/juz/1`–`/juz/30` | 30 | "Juz N" searches: boundaries, surahs, pages, listening time | index | self | yes | yes, fully | WebPage, BreadcrumbList |
| `/root/<key>` | 411 | Root searches, for roots with 20 or more occurrences | index | self | yes | yes, fully | WebPage, BreadcrumbList |
| `/s/{surah,juz,read,root,theme}/…` | 1,933 | Share stubs: social-card image, then a bounce to the real page | noindex,follow | n/a | no | stub | none |
| `/embed`, `/exercise-asr` | 2 | Iframe card; redirect stub | noindex | n/a | no | stub | none |
| `/404` | 1 | Served at any unknown address with a 404 status | noindex,follow | none (by design) | no | yes | none |
| `/docs/*`, `/scripts/*`, `*.md`, `/ios-app/*`, `/store/*`, asset templates | | Repository material | noindex header, or 404 (ios-app, store), or meta noindex (templates) | n/a | no | n/a | n/a |

## Headings

Every page has exactly one h1. On the home page it is the site name; everywhere else the header shows the site name as text and the page's own title is the h1 inside `<main>` (enforced by `verify-site.mjs --only=a11y` and `smoke-deployed.mjs`).

## Not measured

Indexing coverage, impressions, rankings and any AI-system citation are not visible from this repository. Search Console is not connected to this workspace. Nothing here claims search impact.
