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

## 2. Site map (28 pages)

| Group | Pages | Notes |
|---|---|---|
| Study | read, navigate, dossier, compare, themes, replay | API-backed reading; local-data everything else. dossier.html?s=N is the per-surah synthesis page (roots.html-style client-side param; invalid/absent ?s= renders a 114-surah picker); its recurring-phrases section reads data/formula-summary.json, and s/surah/{n}.html share pages bounce to it |
| Analyze | words, roots, patterns, numbers, formulas | fully local data |
| Learn | how-to-use, how-it-works, exercises (hub), exercise, exercise-roots, paths, glossary, watch | exercises are data-driven or book-cited; exercise-asr.html is a redirect stub |
| About | index, about, sources, datasets, validation, credits, changelog | credibility pages |
| Unlisted | embed (iframe card, the one frameable page), exercise-asr (redirect stub) | outside nav and sitemap by design |

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
(term popovers), `assets/fonts.css` + `assets/fonts/` (self-hosted Amiri,
Cormorant Garamond, Inter). Chart-bearing pages add `assets/chart.js`
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
| build-cooccurrence.mjs | morphology, roots-summary, chronology | data/cooccurrence/ | roots.html co-occurrence (whole-corpus and per-chronological-period) |
| build-discursive-pivots.mjs | morphology, roots-summary | data/discursive-pivots.json | patterns.html boundary-particle / shared-root list |
| build-symmetry-test.mjs | morphology, roots-summary | data/symmetry-test.json | patterns.html ring-composition proxy test (method + closest candidates) |
| build-surah-meta.mjs | Quran Foundation API | data/surah-meta.json | Makki/Madani |
| build-juz.mjs | Tanzil standard division + surah-meta | data/juz.json | navigate.html juz grid, read.html `?j=` |
| build-csp.mjs | every page's inline `<script>` and `<style>` blocks | netlify.toml `script-src` + `style-src-elem` hashes | CSP authorizes inline scripts/styles without `'unsafe-inline'` (`--check` guards staleness) |
| build-surah-profiles.mjs | morphology, chronology, qursim | data/surah-profiles.json | navigate.html profiles |
| build-themes.mjs | morphology, roots-summary, surah-profiles | data/themes.json, data/theme-surah-index.json | themes.html (each theme's `topSurahs` = where its root-family vocabulary clusters, tokens per 1,000 normalized by surah length); the reverse index feeds dossier.html's "themes touching this surah" line. Absence from a theme's top-8 means "not among its densest", not "vocabulary absent" — the `_method` strings state this |
| build-rhetorical-features.mjs | morphology | data/rhetorical-features.json | patterns.html direct-address list, numbers.html fawatih list |
| build-numbers.mjs | morphology, roots-summary, chronology | data/numbers.json | every corpus figure on numbers.html (`[data-num]` elements) |
| build-surahs-js.mjs | surah-names.json, chronology, surah-meta, surah-profiles | assets/surahs.js | the ONE canonical surah dataset (navigate, read, ask box, refs, embeds) — edit data/surah-names.json, never assets/surahs.js |
| build-share-pages.mjs | roots-summary, themes, chronology, surah-names, surah-profiles | s/ (1,789 pages) | per-entity link previews; share buttons hand these URLs out |
| build-root-refs-index.mjs | roots-summary | assets/root-refs.js | refs.js root-mention detection (ambiguous ASCII folds deliberately absent) |
| build-word-index.mjs | morphology, roots-summary, data/gloss (optional) | data/word-index.json | words.html vocabulary search — rerun after committing a gloss dataset so meanings join the index |
| build-roots-list.mjs | roots-summary | data/roots-list.json | the slim per-root record every list-level consumer fetches (roots list, compare suggestions, refs popovers, embeds, exercise-roots) — rerun whenever roots-summary changes |
| build-formulas.mjs | morphology | data/formulas-root.json, data/formulas-surface.json | formulas.html. Root-stream refs are `[surah, ayah, w1..wn]` — every matched word's position, since root sequences skip particles/pronouns and so are NOT contiguous. Surface-stream refs are `[surah, ayah, w]` — the first matched word only, since surface matches ARE contiguous (`w..w+n-1`). Both are consumed by read.html's `?hl=` deep-link highlighting (§5) |
| build-rhyme-map.mjs | morphology | data/rhyme/{1-114}.json, data/rhyme-summary.json | patterns.html rhyme explorer; rhyme-summary.json also feeds index.html's daily discourse card (below) |
| build-formula-summary.mjs | formulas-root.json, formulas-surface.json | data/formula-summary.json | dossier.html's recurring-phrases section — a ~75 KB per-surah roll-up (counts + top-5 phrases with first-occurrence refs) so the page never fetches the megabyte parent files. Rerun whenever build-formulas.mjs reruns |

Checkers (not generators — they gate shipping):

The repository runs the local integrity checks and the full Playwright E2E
audit on every push and pull request via `.github/workflows/audit.yml`.
Because third-party availability is nondeterministic, external citation-link
and translation-edition checks run on the weekly schedule and by manual
dispatch instead of blocking every contribution.

| Script | Guards |
|---|---|
| check-headers-sync.mjs | netlify.toml per-page CSP structure (fail-open for new pages: a page without its own block ships with NO CSP — run after adding any page) |
| check-nav-sync.mjs | the by-design nav duplication: every page's primary nav must match index.html's (allowlist: embed.html, exercise-asr.html) |
| check-claims.mjs | worked-claim provenance: stable IDs, allowed evidence dimensions, valid source IDs, limitations, derivation paths, and the case-study join |
| check-exercises.mjs | the exercise registry: unique IDs; outline entries have a valid surah number, resolvable sourceIds, a sources.html citation in provenanceHtml, and strictly-increasing in-bounds startVerse values; at most one outline per surah; roots entries' href/surahs are valid; index.html's hand-kept EXERCISE_COUNT matches the registry length |
| check-videos.mjs | the video registry: an entry cannot be 'published' without its mp4, poster, AND a real WEBVTT captions file on disk — the anti-slop covenant, enforced mechanically |
| check-source-links.mjs | external citation liveness: every sources.json `url` and every external href on every page still answers (404/410 = FAIL, 403/429 = WARN for bot-shielding). Needs real outbound network — run from an unrestricted machine, not a sandboxed session; a good habit before any release and every few months |
| check-editions.mjs | every translation edition ID in assets/app.js's TRANSLATIONS array still resolves to itself on alquran.cloud — the API silently substitutes a default Arabic edition for an invalid ID instead of erroring (the "en.haleem" bug), so this catches the next one before a reader does. Needs real outbound network — run from an unrestricted machine, not a sandboxed session; run after adding any new edition ID and every few months otherwise |

Determinism check for any script: run it twice, `git diff` must be empty.

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
design); add a `sitemap.xml` entry; **add a `[[headers]]` CSP block for
it in `netlify.toml`** (the per-page CSP structure is fail-open — a page
without its own block ships with no CSP). Then run
`node scripts/check-nav-sync.mjs && node scripts/check-headers-sync.mjs`.

### Add word-by-word glosses (owner-gated by licensing)
The Read page's word table renders a Meaning column the moment
`data/gloss/{surah}.json` exists — the integration ships dormant. The
gate is the dataset license (this backlog item has always been "needs a
license worth citing"). Candidate sources to evaluate — verify the
license text yourself, never from memory:
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
`assets/og/site-og.png` (the og:image on every page and share page) is
captured from `assets/og/og-template.html` — a ONE-TIME MANUAL step,
deliberately outside the deterministic pipeline: open the template in a
browser and screenshot at exactly 1200×630 (Playwright viewport capture
or devtools device capture), overwrite the PNG, commit. Do not add a
package.json for this.

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
stale-while-revalidate.

**Bump `SW_VERSION` in `sw.js`** whenever you ship a change that an
old cached copy would render incorrectly against fresh page code:
- any `data/*.json` schema change (field added/removed/renamed, ref
  format changed — e.g. this repo's root-formula refs going from
  first-position-only to all-positions)
- any change to what `assets/*.js`/`.css` expects from the HTML shell

Bumping it prunes every old-version cache on the next `activate` (see
`sw.js`'s `OWN_CACHES` filter) — a returning visitor's stale offline
copy self-heals on their next successful online visit; it does not
require a version-mismatch check anywhere else.

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
7. **Still manual:** dark-mode screenshots of any page you changed
   (`--shots` helps), audio playback, overall visual judgment.
8. `node scripts/check-claims.mjs && node scripts/check-exercises.mjs && node scripts/check-nav-sync.mjs
   && node scripts/check-headers-sync.mjs && node scripts/build-csp.mjs --check` — mandatory after adding a page,
   touching the nav, an inline `<script>` or `<style>`, or netlify.toml.
   The last one fails if any page's inline-script or inline-style hashes
   are stale (rerun `node scripts/build-csp.mjs` to fix).
9. Re-run every generator you touched twice; `git diff` must be empty
   after the second run.
10. If you touched netlify.toml: on the PR's deploy preview, `curl -sI`
    the preview URL for `/`, `/index.html`, a regular page,
    `/embed.html`, and one `s/` page — assert exactly one
    Content-Security-Policy header each, `frame-ancestors *` ONLY on
    embed.html, no X-Frame-Options anywhere, and the `/*` residual
    headers present. Frame embed.html from a foreign origin (renders)
    and any other page (blocked). Do not merge on assumptions — Netlify
    emits every matching rule's headers and browsers enforce multiple
    CSPs as their intersection.
11. **Not covered by `verify-site.mjs` itself** (its browser contexts
    pass `serviceWorkers: "block"`, so none of this runs inside it —
    verify by hand, e.g. a scratch Playwright script, before shipping a
    change to any of these):
    - `?hl=` deep-link highlighting — check it at **Simple depth
      specifically** (the site's default), not just Scholar/
      Encyclopedic: `buildArHtml` early-returns unmodified text
      whenever there's no scholar-depth root data, so a highlight
      implementation that only composed with `buildArHtml`'s output
      would silently do nothing for most first-time visitors following
      a formula/rhyme/KWIC link. `applyHighlight` runs independently of
      it for exactly this reason — don't refactor that away.
    - The daily discourse card — two contexts clocked to the same UTC
      instant should render an identical surah and lens; a different
      UTC weekday should rotate the lens.
    - The service worker — install, `context.setOffline(true)`, reload
      (shell + bundled data should still render); confirm a cross-origin
      request still reaches the network unintercepted; bump
      `SW_VERSION` and confirm the old cache is pruned on activate.
    - Focus mode — toggle hides chrome, `aria-pressed` tracks state,
      Escape/`f`/re-click all exit, and a reload always resets it (no
      persistence).

## 7. Deployment

Push to `main` → Netlify deploys production. Every PR gets a deploy
preview (the netlify bot comments the URL). Rollback = revert the merge
commit and push; Netlify redeploys the previous state.

## 8. Optimization backlog (known, deliberate deferrals)

- words.html search covers Arabic/transliteration/root; searching by
  English *meaning* stays dormant until the owner licenses a gloss
  dataset (see "Add word-by-word glosses" and
  docs/gloss-dataset-research.md — the verification is a ten-minute
  task from an unrestricted connection).
- Badge dot glyphs are at the WCAG 2.5.8 24px minimum, not 44px.

## 9. Content layers deliberately not built (and what would unblock them)

Two structural/rhetorical content layers were scoped and rejected rather
than built with placeholder or invented data, because the site's rule is
that every claim must trace to a real, checkable source (see §1 and the
Verified/Nuanced/Pending framework). Recorded here so a future contributor
with the right input doesn't have to re-derive why these are missing.

**Per-word grammatical person (for iltifat / pronoun-shift tracking).**
`data/morphology/*.json` carries `root`, `lemma`, and `pos` only. Words
tagged `pos: "PRON"` almost never carry a usable `lemma`: a 20-surah sample
found 280 blank vs. 4 filled. Detecting a real 3rd→2nd person (or any
person) shift needs the Leeds corpus's full per-segment feature string
(e.g. `PRON:2MS`), which `scripts/build-leeds.js` never parsed out (it only
reads `ROOT:`/`LEM:`/`POS:` from `STEM|`-prefixed segments — see its
"Parse Leeds raw file" section). The raw source file
(`scripts/leeds-raw.txt`) is gitignored and was not present in the
environment this was scoped in, and fetching it requires network access
this project's CI/session sandbox does not have. To unblock: obtain
`quranic-corpus-morphology-0.4.txt` (or a newer Leeds/QAC release with
person/number/gender features), extend `build-leeds.js` to parse and emit
those features per word, then a pronoun/verb person-shift detector becomes
a straightforward mechanical pass like `build-rhetorical-features.mjs`.
Until then, do not fabricate per-verse pronoun-shift claims — there is no
bundled data backing them.

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
