# Maintainer's Guide

How Divine Discourses works, how to change it without breaking its credibility
system, and how to verify before shipping. Written for the site owner and
any future contributor (human or AI assistant).

---

## 1. The method, in one page

The site's value is trust. Four rules protect it:

1. **Research claims expose dimensions, not an undifferentiated promise.**
   Worked research claims have canonical records in `data/claims.json`.
   Each record separately declares its claim type, source check, computational
   reproduction, agreement/dependency, interpretive status, AI involvement,
   derivation, and known limits. `scripts/check-claims.mjs` enforces this
   structure and joins each record to `data/case-studies.json`. The legacy
   ●/○/~ glyph remains a compact summary and opens source citations; it is not
   a claim that every evidence dimension is independently verified. Every
   visible ● must still carry `data-source-ids` (verify-site enforces this).
   Corpus figures in prose continue to bind to `data/numbers.json` through
   `data-num="dot.path"`, preventing display drift from generated data.
2. **No generated commentary; editorial curation is always labeled.** The
   site computes and cites; it never asserts what a verse *means*. But be
   precise about what that claim covers: theme groupings and titles,
   working root glosses, and similar curation ARE editorial choices — the
   rule is that such curation must always be labeled Nuanced with its
   editorial nature stated in the adjacent text, never presented as
   computed data. Anything presented as Khan's reading must be
   transcribed from his published books with a citation. Structural
   observations (counts, co-occurrence, repetition) always carry a note
   that distribution does not by itself establish meaning.
3. **AI output is never authoritative content.** An assistant may help locate
   a candidate source, check code, or flag unclear language. It may not
   originate a theme, structure, interpretation, translation, root meaning,
   citation, or scholarly attribution. Assistant agreement is not a review
   stage. A human must inspect the artifact and write from that evidence.
4. **Reproduction has a precise scope.** Recomputing a result establishes that
   it follows from named inputs under the recorded method. It does not validate
   the corpus annotations, counting unit, chronology, or an interpretation.

Citations follow the **Chicago Manual of Style, bibliography form**:
`Author-inverted. Title, edition. Place: Publisher, year. URL. License.`
When a detail can't be confirmed against the work itself, omit it — never
guess. sources.html is the reference implementation.

## 2. Site map (33 pages)

| Group | Pages | Notes |
|---|---|---|
| Study | read, navigate, dossier, compare, themes, replay | API-backed reading; local-data everything else. dossier.html?s=N is the per-surah synthesis page (roots.html-style client-side param; invalid/absent ?s= renders a 114-surah picker); its recurring-phrases section reads data/formula-summary.json, and s/surah/{n}.html share pages bounce to it |
| Analyze | words, roots, patterns, numbers, formulas | fully local data |
| Learn | how-to-use, how-it-works, exercises (hub), exercise, exercise-roots, paths, glossary, watch | exercises are data-driven or book-cited; exercise-asr.html is a redirect stub |
| About | index, about, sources, datasets, validation, credits, changelog | credibility pages |
| Off-nav, in sitemap | export (CSV/JSON downloads + schema), coverage (measured data-coverage dashboard) | reachable via contextual links (roots.html, numbers.html, datasets.html), not the primary nav — adding them to nav means editing EVERY page's nav block (check-nav-sync.mjs enforces byte-identical navs) |
| Unlisted | embed (iframe card, the one frameable page), exercise-asr (redirect stub), 404 (Netlify's not-found page: search box, wayfinding cards, correction form) | outside nav and sitemap by design; 404.html carries no canonical and no JSON-LD because Netlify serves it at whatever address failed |

Site-wide, not pages: `manifest.webmanifest` + `sw.js` (repo root) make
the site installable and give it an offline shell — see "Service worker
(sw.js) and SW_VERSION" in §4.

Shared building blocks every page uses: `assets/nav.js` (menus, hamburger,
aria-current), `assets/app.js` (settings gear: depth / palette / theme /
translations, keyboard shortcuts 1/2/3, back-to-top, `qdEsc` HTML escaper,
API fetch helpers, `qd_state.progress` — see below), `assets/cite-badge.js`
(citation popovers, the *only* citation-popover implementation — do not
add a second one bound to `.badge[data-source-ids]`; handling is
event-delegated, so dynamically inserted badges work — call
`qdCiteEnhance(container)` after inserting to set role/tabindex),
`assets/share.js` (floating share button, `[data-share]`/
`[data-copy-target]` buttons, toast, `qdDownloadSvg`), `assets/glossary.js`
(term popovers — note it wraps only the FIRST occurrence of each term per
page, so a term used early in a page gets no popover in later sections;
popover "Glossary →" links resolve via slugified ids plus the ANCHORS
alias map in that file), `assets/fonts.css` + `assets/fonts/` (self-hosted
Amiri, Cormorant Garamond, Inter, Noto Nastaliq Urdu, Noto Serif Bengali —
each face's OFL text is bundled beside the binaries). Chart-bearing pages add `assets/chart.js`
(`qdChart`: revelation timeline, heat strip, scatter, ego network —
theme-aware via `--chart-1..4`, which are dataviz-validated mark colors;
every chart needs a method note beside it). `assets/notes.js` renders the
Read page's local-only notes panel (storage key `qd_notes`, deliberately
NOT cleared with preferences). `assets/discovery-worksheet.js` renders a
per-surah "propose your own structure" form on the Read page (storage key
`qd_discovery_v1`, keyed by surah number: theme, sectional divisions,
evidence, cross-references, a reader-chosen confidence level) — distinct
from both notes.js (per-verse free text) and notebook.js (bookmarks).
Its content is deliberately never rendered with a ●/○/~ badge: it is the
reader's own hypothesis, not a site claim. It reads `data/exercises.json`
client-side to tell surahs 85–114 whether Khan's outline for that surah is
already transcribed (link to the exercise), awaiting transcription, or (for
surahs 1–84) that no Khan outline exists at all for that surah. Content registries rendered by pages:
`data/exercises.json`, `data/paths.json`, `data/case-studies.json`, and
`data/claims.json` — edit
the JSON, not the pages' static fallback markup.

`qd_state.progress` (in `assets/app.js`) remembers reading position and
exercise attempts, browser-only, same as every other preference: `{
lastRead: { s, a } | null, exercises: { [exerciseId]: { at: isoString } }
}`. `window.qdSaveLastRead(s, a)` is called by `read.html` after a verse
loads successfully; `window.qdMarkExerciseDone(id)` is called by exercise
pages when the reader reveals an answer. `index.html` reads
`qdState.progress` to show a dismissible "continue where you left off"
card. `clear()` resets it along with every other preference.

## 3. Data pipeline

All generators are deterministic, zero-dependency Node scripts. Re-run
them only when their inputs change; commit their outputs.

| Script | Reads | Writes | Feeds |
|---|---|---|---|
| build-leeds.js | Leeds corpus dump | data/morphology/, roots-summary.json | everything |
| build-root-analytics.mjs | morphology | data/root-analytics/ | roots.html detail |
| build-cooccurrence.mjs | morphology, roots-summary, chronology | data/cooccurrence/ | roots.html co-occurrence (whole-corpus and per-chronological-period), plus `coRootsPmi` — the same partners ranked by pointwise mutual information (distinctiveness) instead of raw count, minimum 3 shared verses to rank, roots.html's "Distinctive partners (PMI)" panel |
| build-discursive-pivots.mjs | morphology, roots-summary | data/discursive-pivots.json | patterns.html boundary-particle / shared-root list — three clause-initial temporal subordinators (idh, idha, lamma); deliberately excludes sequencing conjunctions (e.g. thumma), which mark continuation, not a new temporal clause |
| build-symmetry-test.mjs | morphology, roots-summary | data/symmetry-test.json | patterns.html ring-composition proxy test (method + closest candidates) |
| build-surah-meta.mjs | Quran Foundation API | data/surah-meta.json | Makki/Madani |
| build-juz.mjs | Tanzil standard division + surah-meta | data/juz.json | navigate.html juz grid, read.html `?j=` |
| build-csp.mjs | every page's inline `<script>` and `<style>` blocks | netlify.toml `script-src` + `style-src-elem` hashes | CSP authorizes inline scripts/styles without `'unsafe-inline'` (`--check` guards staleness) |
| build-canonicals.mjs | `scripts/lib/site.mjs` (origin + clean-path rule) | every page's canonical/og:url, every internal link, sitemap.xml `<loc>`, robots.txt | one address per page. `--check` fails on a canonical that is missing, duplicated, points elsewhere, disagrees with og:url, or names a `.html` address; also on an internal link that still ends in `.html` |
| build-surah-profiles.mjs | morphology, chronology, qursim | data/surah-profiles.json | navigate.html profiles; also `formDiversityRatio`/`lemmaDiversityRatio` (type-token ratio at the surface-form and lemma level, alongside the existing root-level ratio), surfaced on dossier.html's Vocab section |
| build-themes.mjs | morphology, roots-summary, surah-profiles | data/themes.json, data/theme-surah-index.json | themes.html (each theme's `topSurahs` = where its root-family vocabulary clusters, tokens per 1,000 normalized by surah length); the reverse index feeds dossier.html's "themes touching this surah" line. Absence from a theme's top-8 means "not among its densest", not "vocabulary absent" — the `_method` strings state this |
| build-rhetorical-features.mjs | morphology | data/rhetorical-features.json | patterns.html direct-address list, numbers.html fawatih list |
| build-numbers.mjs | morphology, roots-summary, chronology | data/numbers.json | every corpus figure on numbers.html (`[data-num]` elements); also `ttrByPeriod` — form/lemma type-token ratio by Cairo 1924 period, numbers.html's "Lexical diversity by period" table (filled at 4-decimal precision outside the `[data-num]` convention, since that convention rounds to 1 decimal) |
| build-surahs-js.mjs | surah-names.json, chronology, surah-meta, surah-profiles | assets/surahs.js | the ONE canonical surah dataset (navigate, read, ask box, refs, embeds) — edit data/surah-names.json, never assets/surahs.js |
| build-share-pages.mjs | roots-summary, themes, chronology, surah-names, surah-profiles | s/ (1,789 pages) | per-entity link previews; share buttons hand these URLs out |
| build-root-refs-index.mjs | roots-summary | assets/root-refs.js | refs.js root-mention detection (ambiguous ASCII folds deliberately absent) |
| build-word-index.mjs | morphology, roots-summary, data/gloss (optional) | data/word-index.json | words.html vocabulary search — rerun after committing a gloss dataset so meanings join the index |
| build-roots-list.mjs | roots-summary | data/roots-list.json | the slim per-root record every list-level consumer fetches (roots list, compare suggestions, refs popovers, embeds, exercise-roots) — rerun whenever roots-summary changes |
| build-formulas.mjs | morphology | data/formulas-root.json, data/formulas-surface.json | formulas.html. Root-stream refs are `[surah, ayah, w1..wn]` — every matched word's position, since root sequences skip particles/pronouns and so are NOT contiguous. Surface-stream refs are `[surah, ayah, w]` — the first matched word only, since surface matches ARE contiguous (`w..w+n-1`). Both are consumed by read.html's `?hl=` deep-link highlighting (§5) |
| build-rhyme-map.mjs | morphology | data/rhyme/{1-114}.json, data/rhyme-summary.json | patterns.html rhyme explorer; rhyme-summary.json also feeds index.html's daily discourse card (below), plus `meanRunLength` (verseCount / (shiftCount + 1), a regularity index) feeding patterns.html's cross-surah "Rhyme regularity across surahs" ranking |
| build-formula-summary.mjs | formulas-root.json, formulas-surface.json | data/formula-summary.json | dossier.html's recurring-phrases section — a ~75 KB per-surah roll-up (counts + top-5 phrases with first-occurrence refs) so the page never fetches the megabyte parent files. Rerun whenever build-formulas.mjs reruns |
| build-roots-index.py | morphology | data/roots-index.json | read.html root lookups. The one Python script in the pipeline (historical; everything else is Node) |
| build-gloss.mjs | an owner-supplied gloss source file | data/gloss/{surah}.json, data/gloss/index.json | read.html Meaning column, words.html meaning search (via build-word-index.mjs rerun). Six Khan-2011 surahs ship today; full-corpus rerun is licensing-gated (§ "Add word-by-word glosses") |
| compute-association-stats.mjs | morphology, roots-summary, chronology, numbers.json | data/association/ | roots.html "Statistical associations" panel, numbers.html keyness card. Rerun after build-numbers.mjs when morphology changes |
| compute-network-layout.mjs | association/, roots-summary, morphology, chronology | data/network/ | roots.html association-network graph, numbers.html root-density heatmap. Rerun after compute-association-stats.mjs |
| compute-centrality.mjs | association/, roots-summary | data/centrality/ | roots.html "Network position" panel. Rerun after compute-association-stats.mjs |
| compute-dispersion.mjs | morphology/, roots-summary, chronology | data/dispersion/ (1,642 + methods.json) | How evenly a root spreads across the 114 surahs: Gries's DP and DP-norm, Juilland's D, range, and a dispersion-adjusted frequency. Surfaces on the roots detail panel and numbers.html. Rerun after any morphology change |
| build-structure.mjs | rhyme/, morphology/, formulas-*, discursive-pivots | data/structure/{1..114}.json | Computed section boundaries per surah (penalized multi-signal changepoint, MDL/BIC). NOT a scholar's outline — see the attribution policy below |
| build-structure-tests.mjs | structure/, morphology/ | data/structure-tests.json | Four ring/symmetry tests over those sections, pooled BH-FDR. Rerun after build-structure.mjs |
| build-formulaic-density.mjs | formulas-root, formulas-surface, morphology/ | data/formulaic-density.json | Per-verse and per-surah formulaic density (Bannister). Rerun after build-formulas.mjs |
| compute-coverage.mjs | morphology, roots-summary, qursim/ (file counts), sources.json | data/coverage/report.json | coverage.html dashboard — every number there traces to this report |
| build-exports.mjs | roots-summary, numbers.json, chronology, surah-profiles, surah-names, morphology, association/ | data/exports/ (CSV+JSON tables, schema.json, DATA-DICTIONARY.md) | export.html downloads. Rerun after compute-association-stats.mjs |

Dependency order for the analytics chain: `build-numbers.mjs` →
`compute-association-stats.mjs` → (`compute-network-layout.mjs`,
`compute-centrality.mjs`, `build-exports.mjs` in any order) →
`compute-coverage.mjs` (independent of the middle three, but run it
last so its measurements reflect the final state).

Checkers (not generators — they gate shipping):

The repository runs the local integrity checks and the full Playwright E2E
audit on every push and pull request via `.github/workflows/audit.yml`.
Because third-party availability is nondeterministic, external citation-link
and translation-edition checks run on the weekly schedule and by manual
dispatch instead of blocking every contribution.

| Script | Guards |
|---|---|
| check-headers-sync.mjs | netlify.toml per-page CSP structure (fail-open for new pages: a page without its own block ships with NO CSP — run after adding any page), the clean-URL redirects, and the hand-authored non-CSP `[[headers]]` blocks (`/assets/*`, `/data/*`, `/docs/*`, `/sw.js`) that no generator would restore |
| check-nav-sync.mjs | the by-design nav duplication: every page's primary nav must match index.html's (allowlist: embed.html, exercise-asr.html) |
| check-claims.mjs | worked-claim provenance: stable IDs, allowed evidence dimensions, valid source IDs, limitations, derivation paths, and the case-study join |
| check-data-nums.mjs | every `data-num="dot.path"` binding across every page: the path must resolve to a number in `data/numbers.json`, and the element's static fallback text must match that number under `initDataNums()`'s own formatting — catches a stale prose figure or a typo'd path, both of which `initDataNums()` fails on silently in the browser (it only overwrites when the path resolves to a number) |
| check-exercises.mjs | the exercise registry: unique IDs; outline entries have a valid surah number, resolvable sourceIds, a sources.html citation in provenanceHtml, and strictly-increasing in-bounds startVerse values; at most one outline per surah; roots entries' href/surahs are valid; index.html's hand-kept EXERCISE_COUNT matches the registry length |
| build-canonicals.mjs --check | one canonical address per page and no internal link left on a `.html` address; also that the sitemap holds every indexable page and no noindex one |
| check-notice.mjs | the licensing inventory: every top-level `data/` entry must be mentioned by name in NOTICE.md, so a new dataset cannot ship without its license standing declared (this drifted three releases running before the checker existed) |
| check-paths.mjs | the Study Paths registry (`data/paths.json`): every step's hand-authored `html` linking into another tool — an `exercise.html?id=` resolves in `data/exercises.json`, a `themes.html#slug` resolves in `data/themes.json`, and every embedded surah/verse (`s=`/`a=`, and `compare.html`'s `p1=`/`p2=` passage pairs) is in range — none of which verify-site.mjs's HTTP-level link crawl catches, since every one of those pages returns 200 regardless of whether the id/slug/verse embedded in it is real |
| check-videos.mjs | the video registry: an entry cannot be 'published' without its mp4, poster, AND a real WEBVTT captions file on disk — the anti-slop covenant, enforced mechanically |
| check-source-links.mjs | external citation liveness: every sources.json `url` and every external href on every page still answers (404/410 = FAIL, 403/429 = WARN for bot-shielding). Needs real outbound network — run from an unrestricted machine, not a sandboxed session; a good habit before any release and every few months |
| check-editions.mjs | every translation edition ID in assets/app.js's TRANSLATIONS array still resolves to itself on alquran.cloud — the API silently substitutes a default Arabic edition for an invalid ID instead of erroring (the "en.haleem" bug), so this catches the next one before a reader does. Needs real outbound network — run from an unrestricted machine, not a sandboxed session; run after adding any new edition ID and every few months otherwise |
| check-root-datasets.mjs | the six parallel root datasets: all carry the same 1,642 keys, `rootBuckwalter`↔`rootLatin` agrees across roots-summary/roots-list, every `rootLatin` is a roots-index key, and every per-root filename is `safeKey(bw)`. Written after a fuzzy root matcher served 205 roots' statistics under the WRONG root's name behind a Verified badge |
| check-generated-freshness.mjs | the 25 generators that have no `--check` of their own: copies the repo to a temp directory, runs them there in dependency order, and compares their output against what is committed, ignoring the `_computed` date stamp. ~20s. Written after `data/coverage/report.json` published a wrong source count for two releases because nothing re-ran its generator. Never writes to the working tree — that property is the reason it copies, and must be preserved |
| check-safe-key.mjs | the client↔data-file contract: the browser's `window.qdSafeKey` (assets/lang-labels.js) and the generators' `scripts/lib/safe-key.mjs` must agree on a branch-covering vector, every one of the 1,642 roots must resolve to a file that exists, and no page may reimplement the mapping locally (it lived in seven copies before this) |

Determinism check for any script: run it twice, `git diff` must be
empty.

**That rule holds only within a single UTC day, and knowing why matters.**
Twelve generators stamp a `_computed` date into their output via
`scripts/lib/computed-date.mjs`. Rerun one tomorrow and you get a diff of
nothing but date stamps — 9,862 files, measured — in which a real content
change is invisible. Set `SOURCE_DATE_EPOCH` (the reproducible-builds.org
convention, a Unix timestamp in seconds) to pin the stamp:

```sh
SOURCE_DATE_EPOCH=$(date -u -d 2026-08-01 +%s) node scripts/compute-association-stats.mjs
```

**Use the date already in the artifact you are diffing against, not the
last commit's date.** The committed tree carries stamps from several
different days at once — `data/root-analytics/` says 2026-07-20,
`data/association/` says 2026-08-01, `data/coverage/report.json` says
whenever it was last regenerated — so no single epoch reproduces the
whole tree, and `$(git log -1 --format=%ct)` reproduces none of it.
Read the target's own `_computed` field first:

```sh
grep -o '"_computed":"[^"]*"' data/association/brk.json
```

Verified: with the epoch set to that artifact's own stamp, rerunning
`compute-association-stats.mjs` reproduces all 1,642 files
byte-identically; with the last commit's epoch, all 1,642 differ.

A generator whose `--check` must survive this should compare content with
the stamp removed rather than comparing bytes — see
`compute-coverage.mjs`, which does exactly that, and whose absence of a
`--check` is how a wrong source count reached the coverage dashboard.

**BW_MAP note.** `build-leeds.js`'s Buckwalter→Arabic table (`BW_MAP`) was
missing 14 characters used by the Leeds corpus v0.4's extended
Quranic-Uthmani encoding (`^ # : @ " [ ; , . ! - + %`), so ~15% of words'
displayed Arabic text carried a stray literal ASCII character instead of
the diacritic it stood for (visible on read.html word-by-word, roots.html
derived forms, and anywhere else `w.ar`/`lemmaArabic` is rendered). The
table is now complete — verified byte-for-byte against an independent
project's conversion script for the identical source file. Since
`scripts/leeds-raw.txt` (gitignored, not always present) is needed to
regenerate `data/morphology/` and `data/roots-summary.json` from scratch,
`scripts/migrate-bw-map-fix.mjs` was run once instead to patch those two
files' already-committed `ar`/`lemmaArabic` fields directly — it does not
need to be run again unless a future contributor reverts `BW_MAP` or
reruns `build-leeds.js` against a raw dump older than this fix. If you
ever do have `leeds-raw.txt` and re-run `build-leeds.js` from scratch, its
output will already be correct and the migration script becomes a no-op.

**Daily discourse card (index.html) determinism.** The surah shown is
`1 + (days-since-Unix-epoch mod 114)`. `Date.now()` is always
milliseconds since the epoch in UTC regardless of the visitor's local
timezone, so this changes at midnight UTC for every visitor everywhere —
the card's "same passage for everyone" claim is literally true, not
timezone-forked. The rotating "lens" (top root / root-diversity ratio /
dominant rhyme family) is chosen by `new Date().getUTCDay() % 3` and
reads only `surah-profiles.json` and `rhyme-summary.json` — the
multi-megabyte formula files are deliberately excluded as too heavy for
a homepage fetch. No localStorage/sessionStorage writes; degrades to
just the header line (from the already-loaded `assets/surahs.js`) if the
data fetch fails.

## 4. Recipes

### Add a cited source
1. Add a Chicago-format entry to the right section of `sources.html`.
2. If statistics elsewhere will cite it, add a registry object to
   `data/sources.json` (id, author inverted, name, publisher = "Place:
   Publisher", year, url, license, accessed).
3. Reference it from a badge: `data-source-ids="your-id"` (space-separate
   multiple ids for multi-source claims).

### Add a case study (a "how we verify" example)
The worked examples on the home page and `validation.html` come from one
registry: `data/case-studies.json` (rendered by `assets/case-studies.js`).
1. Pick a claim you can actually verify from a source or from the bundled
   data — a count, a distribution, a bibliographic fact. Never an
   interpretation of what a verse *means*. If it is a corpus number,
   compute it first (e.g. from `data/cooccurrence/`, `data/roots-summary.json`)
   and record how, so the trace is honest.
2. First append a canonical record to `data/claims.json`. Use a stable,
   versioned `claim.*.vN` ID; choose the claim/evidence dimensions honestly;
   list at least one limitation; and, for a reproduced computation, name the
   existing script, output, and method. AI involvement describes process only
   and can never authorize AI-originated content.
3. Append an object to `caseStudies[]` with: `id`, `claimId`, `label`
   (`ok`/`pending`/`nuanced`), `labelText` (Verified/Pending/Nuanced),
   `title`, `sourceIds` (space-separated, each must exist in
   `data/sources.json`; may be `""` only for Pending), `onHome`
   (true→also shows on the home page), `claim`, and `traceFull`. If
   `onHome`, also add `claimHome` and `traceShort`. `claim`/`trace` values
   are trusted site-authored HTML — never route API or user text through
   them.
4. Choose the badge that is *actually* honest: `ok` when it is traceable
   to a source or recomputable from bundled data; `nuanced` when it depends
   on a counting rule (say so, and give the real numbers); `pending` when
   it is sourced but awaiting a second independent citation (state what
   would upgrade it). The label is the teaching point.
5. Keep the static fallback markup in `index.html` and `validation.html`
   in step with the JSON (it only shows if the fetch fails, but should not
   go stale). The JS renders from the JSON on the normal path.
6. Run `node scripts/check-claims.mjs`, then `node scripts/verify-site.mjs` —
   the first validates the canonical record; the second re-renders badges and
   checks that source IDs resolve and popovers open.

### Add a study path
Paths chain existing, already-verified tools into a guided sequence; they
must never introduce a new claim (`data/paths.json`, rendered by
`paths.html`).
1. Pick a sequence of 3-5 steps across existing pages that teaches the
   method — each step's `html` is trusted site-authored markup linking
   into a tool the site already has (Read, Roots, Compare, an exercise,
   Validation, ...). Never assert a new fact in a step; every claim a
   step touches must already carry its own badge on its own page.
2. Append an object to `paths[]`: `id`, `title`, `intro`, and `steps[]`
   (each `{ "html": "..." }`). No new page is needed — `paths.html`
   renders the registry.
3. `node scripts/check-paths.mjs` — validates every embedded
   `exercise.html?id=`, `themes.html#slug`, and surah/verse reference
   (including `compare.html`'s `p1=`/`p2=` passage pairs) actually
   resolves; these silently 200 even when broken, so this is the only
   thing that catches a stale reference.

### Regenerate the juz (para) divisions
`data/juz.json` holds the 30 traditional juz boundaries, browsable on
`navigate.html#juz` and deep-linkable as `read.html?j=<n>`.
1. The start boundaries are the Tanzil standard division, transcribed in
   the `STARTS` table of `scripts/build-juz.mjs` (cited to `tanzil`). End
   boundaries are derived from `data/surah-meta.json` verse counts.
2. `node scripts/build-juz.mjs` → writes `data/juz.json`. Only edit
   `STARTS` if correcting a boundary; the file is otherwise stable.

### The Transcription Gate (required before any Khan outline or interpretation excerpt)
Both recipes below turn a page of a published Khan volume into site data.
This gate is what keeps that mechanical, not generative — it applies
identically to "Add a Khan outline exercise" and "Add a Khan interpretation
excerpt".

1. **Human supplies the source.** A person with the physical or licensed
   digital volume in hand transcribes or pastes the exact text — heading
   wording, verse groupings, excerpt sentences — with the page number(s).
   An assistant (human or AI) never originates, paraphrases, summarizes,
   or reconstructs this content from memory or inference; if the exact
   text isn't in hand, the entry doesn't get added yet.
2. **The assistant only structures it.** Fitting the supplied text into
   the outline schema (`data/exercises.json`: `startVerse`/`heading`/`note`
   items, `sourceIds`, `provenanceHtml`) or the excerpt schema
   (`data/khan-interpretations.json`: `{ "excerpt", "page" }`, plus the
   NOTICE.md line) is a mechanical transcription-formatting step. It must
   not add, drop, reorder, or reword anything from what was supplied.
3. **Verify before merge:**
   - Every `sourceIds` value resolves in `data/sources.json`; every
     citation has a real page number from the actual volume.
   - The label is honest: the ● Verified badge on a transcribed
     outline/excerpt (per §1.1) claims only that the text is a faithful,
     source-traceable transcription — never that its structural or
     interpretive content is settled. A structural or interpretive claim
     built *from* the transcription is ○ Pending or ~ Nuanced, never ●.
   - `node scripts/check-exercises.mjs` (outlines) passes, and for
     interpretation excerpts the NOTICE.md entry exists alongside the
     citation.
   - The human who supplied the source re-reads the rendered page
     against the physical/licensed text once before merge — the gate is
     a process, not just a script, and a checker can't catch a
     mistranscription it has no ground truth to compare against.

### Add a Khan outline exercise (surahs 85–114)
0. Pass the Transcription Gate above — the outline text must already be
   supplied by a human from the actual volume before starting here.
1. Transcribe the outline from a published Khan volume — never
   paraphrase from memory. Two volumes are transcribed so far: *An
   Exercise in Understanding the Qur'an* (2013, all thirty surahs
   85–114; `sourceIds: khan-exercise-2013`) and *An Introduction to
   Understanding the Qur'an with Examples* (2011, six worked surahs —
   96, 103, 107, 108, 109, 112; `sourceIds: khan-introduction-2011`,
   outline page number in provenanceHtml). Where both books cover a
   surah, one entry per surah: the consumers (dossier, worksheet,
   replay) look up outlines by surah number and take the first.
2. Add an entry of `"type": "outline"` to `data/exercises.json`: id,
   surah number, title, tileName/tileDesc, the outline items
   (`startVerse`, `heading`, `note` — the transcription), the matching
   `sourceIds`, and a provenanceHtml line. No new
   page is needed: `exercise.html?id=<your-id>` renders it, and the tile
   appears on `exercises.html` automatically.
   Bump `EXERCISE_COUNT` in index.html's continue-card script — it is a
   hand-kept count of the registry entries.
3. Open the exercise locally and check the reveal flow, the break
   scoring, and that the provenance badge opens its citation.
4. `node scripts/check-exercises.mjs` — validates the new entry's surah
   number, sourceIds, provenance citation, and strictly-increasing
   in-bounds `startVerse` values, and that `EXERCISE_COUNT` was bumped.
   Catches the schema mistakes by construction instead of at review time.

### Add a Khan interpretation excerpt (dossier "Khan's reading of this surah")
0. Pass the Transcription Gate above — the excerpt text must already be
   supplied by a human from the actual volume before starting here.
1. Transcribe a short excerpt verbatim from the "Understanding and
   Interpretation" essay in the source volume — mark any omitted
   material with an ellipsis (`…` or `[…]`), never paraphrase or
   summarize into your own words.
2. Add an entry to `data/khan-interpretations.json` keyed by surah
   number: `{ "excerpt": "...", "page": N }` — `page` may be a single
   number or a range string (e.g. `"49–50"`) when the excerpt spans
   pages. dossier.html's `renderStructure` picks it up automatically —
   no new page needed.
3. This is quoted source material, not site-authored data — record it
   in NOTICE.md alongside the citation, not the site-authored-data
   list.
4. If the excerpt is long, re-measure `#secStructure`'s reserved
   `min-height` at 375px and >600px against all 114 surahs (a
   Playwright sweep — see prior CLS calibrations in this guide) before
   committing; a taller excerpt than previously calibrated will shift
   layout on load for every surah that now has one.

### Add or adjust a theme gateway
1. Edit the `THEMES` table at the top of `scripts/build-themes.mjs` —
   roots are Buckwalter keys; the script fails loudly if a root doesn't
   exist in the corpus.
2. `node scripts/build-themes.mjs`, sanity-check the printed top passages
   against your expectation, commit `data/themes.json`.
3. If the theme should be reachable from the Ask box, add its keywords to
   `THEME_WORDS` in `assets/ask.js`.

### Add a new page
Copy an existing page's `<head>` (canonical + OG incl. og:image + favicon
+ fonts.css) and nav/footer blocks verbatim; add the page to the right
nav group **on every page** (the nav is static HTML, duplicated by
design); add a `sitemap.xml` entry (clean path: `/newpage`, not
`/newpage.html`); **add TWO `[[headers]]` CSP blocks for it in
`netlify.toml`, one per address**, `/newpage.html` and `/newpage`,
plus a `[[redirects]]` rule 301ing the first to the second with
`force = true`. The per-page CSP structure is fail-open, and Netlify
matches headers on the request path, so a clean path without its own
block ships with no CSP. Then run
`node scripts/check-nav-sync.mjs && node scripts/check-headers-sync.mjs
&& node scripts/build-canonicals.mjs && node scripts/build-jsonld.mjs
&& node scripts/build-csp.mjs`.

**`netlify.toml` is a hybrid file, and that makes its merge conflicts
dangerous.** `build-csp.mjs` owns only the `script-src` and
`style-src-elem` tokens *inside* CSP blocks; every other line — the
redirects, the `/*` security headers, the `Cache-Control` and
`X-Robots-Tag` blocks — is hand-authored and no generator will ever put
it back. So resolving a conflict here by taking one side wholesale and
re-running `build-csp.mjs` is **not** a safe resolution: the generator
will faithfully rebuild the CSP hashes and say nothing about a
hand-authored block that existed only on the other side. That is not
hypothetical — it silently deleted the `/assets/*` and `/data/*`
`Cache-Control` blocks between the commit that added them and the merge
that shipped, with every checker green. Resolve by **merging both sides'
hand-authored blocks first**, then regenerating, then diffing the
non-CSP lines (`git diff <before> -- netlify.toml | grep -v
Content-Security-Policy`) to confirm nothing but hashes moved.
`check-headers-sync.mjs` now names the blocks that must exist, so this
particular loss fails CI — but it can only guard blocks it knows about,
so add new ones to its `REQUIRED_BLOCKS` table when they matter.

That ordering is a contract, not a habit: build-canonicals fixes the
URLs that build-jsonld embeds, and build-jsonld rewrites head regions on
pages whose real inline scripts build-csp then hashes. Canonicals, then
jsonld, then csp, always. (ld+json blocks themselves are data, never
hashed; build-csp documents why.) `build-sw-manifest.mjs` runs after
all of them — it fingerprints the settled page bytes and data files
into the service worker's precache manifest.

Link to it as `/newpage`, never `newpage.html`: the `.html` address is
a 301 away, and `build-canonicals.mjs --check` rejects a link that
still carries the extension.

### Add word-by-word glosses (owner-gated by licensing)
The Read page's word table renders a Meaning column for any surah with
a `data/gloss/{surah}.json` file. Six surahs (96, 103, 107, 108, 109,
112) ship today, transcribed from Khan (2011) — see NOTICE.md. The
remaining 108 stay gated on a licensed full-corpus dataset (this
backlog item has always been "needs a license worth citing").
Candidate sources to evaluate — verify the license text yourself,
never from memory:
1. **QUL word-by-word translation datasets** (qul.tarteel.ai; already in
   sources.json as `qul`) — check the license on the specific resource
   page before downloading.
2. **Shaikh & Khatri, *The Glorious Qur'an Word-for-Word Translation*** —
   widely mirrored with a stated reproduction permission; confirm the
   permission statement in the published volume itself.
3. **corpus.quran.com word-by-word translations** (same project as the
   Leeds corpus, GPL) — confirm the word-translation layer is actually
   part of the GPL dump.

Once licensed: download the dump locally, shape it as documented at the
top of `scripts/build-gloss.mjs` (with `_source` = a sources.json id you
add and `_license`), run `node scripts/build-gloss.mjs <dump>` and
review the alignment report (the script null-fills mismatched verses
and fails above 2% — never ship a silently shifted alignment). Then
rerun `node scripts/build-word-index.mjs` so the meanings join the
words.html search index. Commit `data/gloss/` and the regenerated
`data/word-index.json` together with the sources.json entry, the
sources.html bibliography line, the NOTICE.md addition, and a changelog
note — one commit, so the data never exists uncited.
docs/gloss-dataset-research.md pre-chews the licensing legwork. Glosses render with a
**Nuanced** badge: a gloss is a translator's choice, not "the meaning".
Test path without any license: `node scripts/build-gloss.mjs
scripts/fixtures/gloss-raw-sample.json --out /tmp/gloss-test` (the
fixture is refused for data/gloss/ by design).

### Confirm the word-by-word translator credit (needs network)
The Read page's interlinear meanings are fetched at runtime from
api.quran.com and credited through the `qcf-wbw-en` entry in
`data/sources.json`. That entry was written from the API's documented
behavior, not from a live response, because the sandbox that added the
feature could not reach the host. Confirm it once from an unrestricted
machine:

```
node scripts/check-wbw-credit.mjs        # --json to dump the raw first verse
```

It parses the endpoint out of `assets/wordbw.js` (so the check can
never drift from what the site actually requests), fetches surah 103,
prints the first word entry as served plus every attribution-shaped
field it can find, probes candidate resource endpoints, and ends in one
of three verdicts:

- **OK** — the endpoint serves a credit matching `qcf-wbw-en.author`.
  Nothing to do.
- **REVIEW** — nothing conclusive. Read the printed word entry: if no
  translator is named anywhere, the Quran.com Foundation credit stands
  and the entry's existing note is the honest phrasing; if one is named
  in a field the script did not surface, record it as below.
- **ACTION NEEDED** — a different credit is served. The script prints
  the exact JSON to paste over the `qcf-wbw-en` entry. Mirror the author
  in sources.html's bibliography line, then run `node
  scripts/check-claims.mjs && node scripts/check-source-links.mjs`.

Only a contradiction exits non-zero, so the weekly scheduled run of
this check stays quiet unless the endpoint's attribution really changed.

### Publish a video (watch.html)
1. Record from the entry's script in `docs/video-scripts/` — real screen
   capture of the live site, human voice, no stock footage or music, no
   AI narration. Re-record rather than patch.
2. Encode H.264/AAC at ~1280×800 (CRF ≈ 26–28), target ≤ ~25 MB per
   clip (GitHub blocks files over 100 MB; if a cut runs big, re-encode —
   never LFS, the site has no build step).
3. Author captions from the actual narration as WEBVTT; export a poster
   frame as JPG.
4. Commit `assets/video/<id>.mp4`, `<id>.vtt`, `<id>-poster.jpg`; set
   the entry's `status` to `"published"` in `data/videos.json`.
5. `node scripts/check-videos.mjs` — it refuses to publish without the
   files and real captions. Self-hosted only: a YouTube embed would
   break the CSP and the no-tracking promise.

### Regenerate the social-preview image (rare)
`assets/og/site-og.png` (the og:image on every page, and on the share
pages of the 1,642 roots) is captured from
`assets/og/og-template.html` — a ONE-TIME MANUAL step, deliberately
outside the deterministic pipeline: open the template in a browser and
screenshot at exactly 1200×630 (Playwright viewport capture or devtools
device capture), overwrite the PNG, commit. Do not add a package.json
for this.

### Regenerate the per-entity cards and install screenshots (rare)
`assets/og/surah/<n>.png` (114) and `assets/og/theme/<slug>.png` (33)
are the og:image on the matching `s/` share page;
`assets/screenshots/home-{narrow,wide}.png` are what the PWA install
dialog shows. All five sets come from one script:

```
node scripts/build-og-images.mjs                 # everything, ~5s
node scripts/build-og-images.mjs --only=theme    # one set
node scripts/build-og-images.mjs --limit=3       # spot work (skips pruning)
```

Cards are filled from `assets/og/entity-template.html` using the same
committed JSON `build-share-pages.mjs` reads, so a card and its share
page can never describe an entity differently — but **this script is
not deterministic** (PNG encoding and font rasterization vary by machine
and Chromium version), so it is owner-run and eyeballed, never wired
into CI. Review a sample before committing: Arabic must render in Amiri
(the template loads the bundled woff2, so tofu means the font path
broke), and no headline may touch the frame.

Run it after adding or renaming a theme — stale cards are pruned on a
full run — then rerun `node scripts/build-share-pages.mjs`, which picks
up new cards automatically and falls back to the site card for anything
missing. Recapture the screenshots when the home page changes
materially; `verify-site`'s `manifest` check fails if a declared size
stops matching the file.

### Regenerate the PWA icons (rare)
`assets/icons/icon-{192,512}.png` are captured from
`assets/icons/icon-template.html` the same one-time-manual way as the
og-image above: open with `?size=192` or `?size=512`, viewport set to
match, screenshot the full page, overwrite, commit. One PNG per size
covers both the manifest's `"any"` and `"maskable"` purposes — the
letter is sized to Android's ~80% maskable safe zone so it still reads
correctly if the OS applies its own mask shape over the full square.

### Service worker (sw.js) and SW_VERSION
`sw.js` (repo root) gives the site an offline shell: cross-origin
requests (api.alquran.cloud, cdn.islamic.network) are never intercepted
— that's what keeps the existing localStorage API cache and audio
range requests working — while same-origin HTML is network-first with
cache fallback (keyed by path, query string stripped), `data/*.json` is
also network-first with cache fallback (deliberately NOT
stale-while-revalidate, so a data schema change is never paired with a
stale cached copy just because the network was slow), and `assets/*` is
stale-while-revalidate. Install precaches the app shell (core pages
under their CLEAN paths, the stylesheets/scripts those pages load, the
small always-needed data files) tolerantly — one failed entry never
discards the new worker. The precache block in `sw.js` and
`data/sw-manifest.json` are both generated by
`scripts/build-sw-manifest.mjs`; never hand-edit either.

**Bump `SW_VERSION` in `sw.js`** whenever you ship a change that an
old cached copy would render incorrectly against fresh page code:
- any `data/*.json` schema change (field added/removed/renamed, ref
  format changed — e.g. this repo's root-formula refs going from
  first-position-only to all-positions)
- any change to what `assets/*.js`/`.css` expects from the HTML shell
- **and the reverse: any change to what the HTML shell expects from a
  deferred asset.** This direction is easy to miss and shipped a real
  regression once. HTML is served network-first while assets are
  stale-while-revalidate, so a returning visitor gets the NEW page with
  the OLD script out of the previous asset cache. When `read.html`
  gained `?t=` support it began setting `window.__qdUrlOverride` for
  `assets/app.js` to consume — a global that the cached v10 `app.js`
  knew nothing about, so the shared-link fix silently did not apply on
  that visitor's first navigation, and the page then rewrote the address
  bar and destroyed the sender's ids before the background asset
  refresh could land. If a page and a deferred asset start sharing a
  global, an event name, a `data-` attribute, or any other handshake
  that did not exist before, that is a contract change: bump.

Bumping it prunes every old-version cache on the next `activate` (see
`sw.js`'s `OWN_CACHES` filter) — a returning visitor's stale offline
copy self-heals on their next successful online visit. After ANY bump,
and after any change that touches precached files, run
`node scripts/build-sw-manifest.mjs`. What is and is not enforced:

- **Enforced in CI** (`check-sw-version.mjs` + `build-sw-manifest.mjs
  --check`): the precache block and manifest are regenerated (byte
  freshness), and the manifest's `version` equals `SW_VERSION`
  (parity). Forgetting to regenerate, or bumping one side only, fails
  the build.
- **Reviewed, not enforced**: whether a given change DESERVES a bump
  remains a judgment call — the manifest exists to make that judgment
  visible. A PR whose diff churns `data/sw-manifest.json` hashes while
  `SW_VERSION` sits still is the reviewer's cue to ask whether the
  change was schema/contract (bump) or plain content (no bump).
  Ordinary content edits churn hashes constantly; do NOT bump for
  those.

**If you ever add or change what `sw.js` intercepts:**
`scripts/verify-site.mjs` passes `serviceWorkers: "block"` to every
browser context it creates, specifically so the SW can never silently
intercept the abort/stub routing those checks depend on. Do not remove
that option; if a check needs to exercise the SW itself, give it its
own context with SWs allowed rather than changing the shared default.

### Change colors / add a palette
Palettes live in `assets/style.css` as custom-property blocks keyed off
`[data-palette]` × `[data-theme]`. A palette needs three blocks: light,
auto-dark (media query with `:not([data-theme="light"])`), forced-dark.
**Every text token (ink, muted, accent, link, ok, pending, nuanced) must
hold ≥ 4.5:1 contrast against both `--bg` and `--card`** — compute before
committing. Register the palette in the `setPalette` select in
`assets/app.js`.

## 5. Security rules

- **Never interpolate API-response text into `innerHTML` without
  `qdEsc()`** (defined in app.js). URL parameters must be whitelisted
  against a dataset or reduced with `parseInt`/regex before any use.
  These invariants were verified by tracing every source→sink flow and by
  a simulated hostile-API test; keep them true.
- **read.html's `?hl=` deep-link highlight param** follows the same
  whitelist rule: grammar is a comma list (max 50 items) of single
  1-based word indices, ranges, or the literal `end` sentinel —
  `/^(\d{1,3}(-\d{1,3})?|end)(,(\d{1,3}(-\d{1,3})?|end)){0,49}$/` — a
  failed match is silently ignored (never partially applied), resolved
  indices are capped at 200, and every value is used only as a numeric
  array index — never interpolated into HTML or a CSS selector. formulas/
  patterns/words.html are the producers; see build-formulas.mjs's row in
  §3 for the root-vs-surface ref-format distinction that decides what
  each producer emits.
- Security headers (CSP, frame-ancestors, nosniff, HSTS) are set in
  `netlify.toml`. If you add an external origin (API, CDN), you must add
  it to `connect-src`/`media-src` there or it will be blocked in
  production — and ask first whether it can be bundled locally instead.
- **`script-src` carries no `'unsafe-inline'`.** Every inline `<script>`
  is authorized by its SHA-256 hash, generated into each page's CSP by
  `scripts/build-csp.mjs`. If you add, edit, or remove an inline
  `<script>` on any page, rerun `node scripts/build-csp.mjs` or the page's
  scripts will be refused in production. Inline event handlers
  (`onclick=`, `onerror=`, …) are also refused — use `addEventListener`.
  Generated share pages (`s/`) carry no inline script by construction, so
  their CSP is `script-src 'self'`.
- **`style-src-elem` carries no `'unsafe-inline'` either.** `<style>`
  elements and stylesheet `<link>`s are restricted to `'self'` plus
  SHA-256 hashes of the page's static inline `<style>` blocks (also
  generated by `build-csp.mjs`), so injected `<style>`/foreign CSS is
  blocked on modern browsers. Do not inject `<style>` elements from JS —
  put component CSS in `assets/style.css` (as the cite-badge popover does).
  Inline `style=` **attributes** (including dynamically computed ones like
  chart-bar widths) are still permitted: they fall back to `style-src`,
  which keeps `'unsafe-inline'`. Hashing every distinct style attribute
  isn't feasible, and with script-src locked down the residual risk is low.
- No analytics, no cookies, no accounts. Preferences live in
  localStorage only; the privacy copy on about.html/credits.html must
  stay in sync with reality.

## 6. Verify before shipping (the checklist that caught real bugs)

Most of this checklist is now one command:

```bash
node scripts/verify-site.mjs
```

It serves the repo itself and drives headless Chromium (the globally
installed Playwright — a dev-machine tool, never a shipped dependency)
through checks 1–6 below on every root page, plus: sitemap⇄disk sync
(the §4 "add a page" recipe, enforced), read.html's offline fallback
with the API blocked, and a hostile-payload fixture pass that keeps the
§5 qdEsc invariant a permanent regression test. `--page=`/`--only=`
filter for fast iteration; `--shots` dumps palette×theme screenshots
for the visual review; `--live` uses the real API instead of
deterministic abort/stub routing. Exit 1 means do not ship.

What it covers (the old manual list, for reference) and what's left:

1. **Zero horizontal overflow** at 375px and 1280px on every page —
   automated.
2. **Zero console errors** with api.alquran.cloud blocked (offline
   degradation) and with stubbed responses — automated. `--live` for a
   real-network pass.
3. **Internal link crawl**: every `href`/`src` returns 200 locally —
   automated (named `#fragments` must resolve too; external liveness is
   `check-source-links.mjs`, see §3).
4. Badges: every `data-source-ids` value exists in `data/sources.json`;
   popovers open by mouse *and* Enter/Space, close on Escape —
   automated.
5. Keyboard: hamburger, dropdown menus, settings gear, Escape — automated
   (on index.html + read.html; nav-sync guarantees the rest). Focus-ring
   *presence* is proxy-checked; its visual quality stays human.
6. Palette × light/dark combinations actually change the background —
   automated.
6b. Accessibility subset — automated (`--only=a11y`): heading outline
   (one h1, an h2 page title; level skips warn), a programmatic label
   on every form control, no focusable content inside
   `aria-hidden="true"`, img alt, and 4.5:1 contrast for every text
   token in every palette × mode block of `assets/style.css` (computed
   from the stylesheet, so a palette edit fails CI before a human
   squints at it). Chromeless embed surfaces are exempt from the
   outline rules only.
7. **Still manual:** dark-mode screenshots of any page you changed
   (`--shots` helps), audio playback, overall visual judgment, mixed
   Arabic/English reading order, high-zoom layout.
8. `node scripts/check-claims.mjs && node scripts/check-exercises.mjs && node scripts/check-data-nums.mjs
   && node scripts/check-paths.mjs && node scripts/check-nav-sync.mjs && node scripts/check-headers-sync.mjs
   && node scripts/build-canonicals.mjs --check && node scripts/build-csp.mjs --check` is mandatory after adding a page, touching the nav, an inline
   `<script>` or `<style>`, or netlify.toml. Also rerun `check-data-nums.mjs` alone whenever
   `data/numbers.json` regenerates, and `check-paths.mjs` alone whenever an exercise id or theme slug
   changes, to catch what fell out of sync.
   The last one fails if any page's inline-script or inline-style hashes
   are stale (rerun `node scripts/build-csp.mjs` to fix).
9. Re-run every generator you touched twice; `git diff` must be empty
   after the second run. If the generator stamps a `_computed` date and
   you are not on the same UTC day the artifact was written, pin
   `SOURCE_DATE_EPOCH` to that artifact's own stamp first — otherwise the
   diff is all date churn and a real change hides in it. See the
   determinism note in §6.
10. If you touched netlify.toml: on the PR's deploy preview, `curl -sI`
    the preview URL for `/`, `/index.html`, `/read`, `/read.html`,
    `/embed`, and one `s/` page, then assert exactly one
    Content-Security-Policy header each, `frame-ancestors *` ONLY on
    embed, no X-Frame-Options anywhere, and the `/*` residual
    headers present. The `.html` addresses must answer 301 with the
    clean path in `Location`, and a query string must survive it
    (`/read.html?s=34&a=1` -> `/read?s=34&a=1`). Check the CSP on the
    CLEAN path especially: that is the address that serves a 200, and
    it needs its own header block.

    Frame embed from a foreign origin (renders)
    and any other page (blocked). Do not merge on assumptions — Netlify
    emits every matching rule's headers and browsers enforce multiple
    CSPs as their intersection.
11. **Not covered by `verify-site.mjs` itself** (its browser contexts
    pass `serviceWorkers: "block"`, so none of this runs inside it —
    verify by hand, e.g. a scratch Playwright script, before shipping a
    change to any of these):
    - `?hl=` deep-link highlighting — check it at **Simple depth
      specifically** (the site's default), not just Study/
      Encyclopedic: `buildArHtml` early-returns unmodified text
      whenever there's no study-depth root data, so a highlight
      implementation that only composed with `buildArHtml`'s output
      would silently do nothing for most first-time visitors following
      a formula/rhyme/KWIC link. `applyHighlight` runs independently of
      it for exactly this reason — don't refactor that away.
    - The daily discourse card — two contexts clocked to the same UTC
      instant should render an identical surah and lens; a different
      UTC weekday should rotate the lens.
    - The service worker — verify-site's `sw` check now automates the
      core loop (install precaches the shell, an offline navigation to
      a never-visited page renders with the offline indicator, and no
      cache holds a cross-origin entry). Still manual: bump
      `SW_VERSION` and confirm the old cache is pruned on activate.
    - Focus mode — toggle hides chrome, `aria-pressed` tracks state,
      Escape/`f`/re-click all exit, and a reload always resets it (no
      persistence).

## 7. Deployment

Push to `main` → Netlify deploys production. Every PR gets a deploy
preview (the netlify bot comments the URL). Rollback = revert the merge
commit and push; Netlify redeploys the previous state.

### Cutting a release

The site is versioned so a citation can pin an exact set of numbers.
`data/version.json` is the only file you edit; everything else follows.

1. Bump `version` (and `released`) in `data/version.json`. MAJOR for a
   counting-rule or schema change that alters published figures, MINOR
   for new datasets or pages, PATCH for corrections.
2. Update the version in about.html's `#cite` example (check-citation
   fails if you forget).
3. `node scripts/build-citations.mjs` — regenerates `data/citations.bib`
   and `assets/version.js`. Bump CITATION.cff's `version` and
   `date-released` to match. Then `node scripts/build-datapack.mjs`,
   which writes a NEW `data/exports/divinediscourses-data-v<version>.tar.gz`
   (keep the old archives: they are what published citations point at),
   and update export.html's archive link (check-citation fails if you
   forget).
4. Add a changelog entry, run the §6 checklist, merge.
5. Tag the merge commit: `git tag -a v<version> -m "<one-line summary>"`
   and push the tag. The tag is what makes a citation resolvable later:
   `github.com/saebchicago/qurandiscourses/tree/v<version>` is the exact
   data a paper used.

## 8. Optimization backlog (known, deliberate deferrals)

- words.html search covers Arabic/transliteration/root; searching by
  English *meaning* works only for the six Khan-glossed surahs and goes
  corpus-wide only when the owner licenses a full gloss dataset (see
  "Add word-by-word glosses" and docs/gloss-dataset-research.md — the
  verification is a ten-minute task from an unrestricted connection).
- Badge dot glyphs are ~44px wide but ~20px tall for tap purposes: `.badge::before`
  extends the horizontal hit area toward the 44px AAA guidance, but not vertically —
  a full Playwright sweep of every badge-bearing page (desktop + mobile viewports)
  found the site's fluid text reflow puts some badges within ~2px of an interactive
  element on the very next wrapped line at some widths (e.g. numbers.html's citation
  line), which no static margin can stay safely clear of across every viewport. The
  rendered glyph already meets the WCAG 2.5.8 24px minimum on both axes.

- Interface localization (navigation chrome in Bengali, Malay, Indonesian,
  French, Spanish, Urdu, or Arabic) stays deferred until human-translated strings
  exist and the new translation editions show sustained non-English
  readership — machine translation of interface or editorial text is
  excluded by the method's third rule, and per-locale page forks would
  multiply every integrity-guarded surface in this guide. Sequencing and
  the eventual dictionary-swap design are in docs/global-reach-plan.md §4.

## 9. Content layers deliberately not built (and what would unblock them)

Two structural/rhetorical content layers were scoped and rejected rather
than built with placeholder or invented data, because the site's rule is
that every claim must trace to a real, checkable source (see §1 and the
Verified/Nuanced/Pending framework). Recorded here so a future contributor
with the right input doesn't have to re-derive why these are missing.

**Per-word grammatical person (for iltifat / pronoun-shift tracking).**
`data/morphology/*.json` carries `root`, `lemma`, and `pos` only, one
entry per orthographic *word*.

*The blocker is scope, not ambiguity.* An earlier version of this section
attributed the gap to blank lemmas on `PRON` words. That is the wrong
reason: person is carried by the surface form, not the lemma, and all
**147** distinct `PRON` surface forms in the corpus are
person-unambiguous — measured across all 3,301 `PRON` words, **zero**
forms carry more than one grammatical person. What actually blocks a
person-shift detector is granularity:

- One entry per word means a pronoun attached to a verb or noun is
  invisible. Only pronouns that head their own word survive — 3,301 of
  77,429 tokens (**4.26%**), reaching 2,359 of 6,236 verses (37.8%).
- **Verb agreement is absent entirely.** Person carried by verb
  inflection — the dominant signal in iltifat — has no representation
  in the bundled data at all, and cannot be recovered from `ar` + `lemma`
  without inventing a morphological analyser. Do not attempt that: a
  perfect-tense verb ending in نا is genuinely ambiguous between a
  1st-person-plural subject and a 3rd-person verb with a 1st-person-plural
  object suffix, and guessing is exactly what this site's rules forbid.

*The unblocker is a person, not a faster network.* The raw source file
`scripts/leeds-raw.txt` is gitignored and absent. The official download
at `corpus.quran.com/download/` requires submitting a contact e-mail
**and accepting the GNU licence terms** — a human, licence-bearing step.
An unrestricted machine is not sufficient on its own.

To unblock, in this order:

1. Obtain `quranic-corpus-morphology-0.4.txt` from the official download
   and place it at `scripts/leeds-raw.txt`.
2. **Run the reproduction gate before trusting it.** Run
   `node scripts/build-leeds.js` into a scratch tree and require
   *byte-identical* `data/morphology/{1..114}.json` and every root
   dataset it writes, against what is committed. Any diff means the file
   is not the one this site's published figures were derived from — stop
   there rather than re-keying the corpus. This gate is not optional: a
   substituted or edited file would silently change every root frequency,
   association, centrality and dispersion figure the site publishes.
3. Only then extend the parser. `scripts/build-leeds.js` (see its "Parse
   Leeds raw file" section) reads `ROOT:`/`LEM:`/`POS:` from
   `STEM|`-prefixed segments and discards the rest of the feature string;
   it also builds a `segs[]` array per word and then never emits it.
   Retain the full feature string and emit the segments. A pronoun/verb
   person-shift detector then becomes a straightforward mechanical pass
   like `build-rhetorical-features.mjs`.

The payoff is measured, not estimated: the same corpus holds **130,030**
segments against our 77,429 words, and **24,681** pronoun segments
against our 3,301 pronoun words — a 7.5× increase in visible pronominal
reference, plus person/number/gender, verb form I–X, voice and mood.

Until then, do not fabricate per-verse pronoun-shift claims — there is no
bundled data backing them. Reformatted third-party forks of the corpus
are **not** a substitute; see `docs/DEFERRED.md` for one that was
evaluated in detail and rejected.

**Named-scholar structural outlines (ring composition / surah symmetry
comparison).** patterns.html already names ring composition as a
documented phenomenon in the literature (Cuypers 2015 et al.) without
asserting a specific structural breakdown. Going further — mapping actual
verse-range outlines attributed to specific scholars (e.g., Iṣlāḥī, Farrin,
or Dr. Khan's own coherence readings) — requires transcribing real,
page-cited outlines from their published work, one surah at a time. This
is a bibliographic sourcing task, not a data-computation one: it cannot be
generated from the bundled corpus, and inventing verse ranges under a real
scholar's name would misattribute content they never wrote. To unblock:
someone with access to the primary texts (print or licensed digital)
transcribes an outline with an exact edition/page citation per surah;
follow the existing `case-studies.json` schema (`sourceIds` must resolve
in `data/sources.json`) and add scholars incrementally, only for surahs
where a real citation exists.

For the 84 surahs Khan never wrote an outline for at all (his 2013 book
covers only surahs 85–114), `assets/discovery-worksheet.js` gives the
reader a place to attempt their own structural reading using the site's
existing computed tooling (root/co-occurrence data, `discursive-pivots.json`
boundary markers, `symmetry-test.json`) as evidence — explicitly framed as
the reader's own unverified hypothesis, never a site claim, and never
confused with Khan's actual outlines.

A narrower, purely mechanical proxy *was* pursued and shipped:
`build-symmetry-test.mjs` asks whether a surah's rarest content roots
(occurring exactly twice) sit at matching distances from the surah's start
and end more often than chance placement predicts. This is a properly
significance-tested question — an exact per-surah-length null
distribution (exhaustive enumeration, not simulation) plus
Benjamini-Hochberg FDR correction across all 3,067 candidate pairs
corpus-wide — not the naive fixed-tolerance version first proposed (which
a random-shuffle check showed was indistinguishable from chance, 0.86–0.95×
the baseline rate at every tolerance from 0–5). The rigorous version's
result: **zero pairs reach significance at q<0.05** (closest candidate
p≈0.0057, nowhere near the corrected threshold ≈1.6e-5). This is reported
on patterns.html as a null result, not silently dropped — the closest
candidates are listed so a reader can see how close the strongest one
actually got. It answers a different, narrower question than the
named-scholar outlines above and should not be read as evidence for or
against that literary scholarship.
