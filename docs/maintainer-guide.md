# Maintainer's Guide

How Divine Discourses works, how to change it without breaking its credibility
system, and how to verify before shipping. Written for the site owner and
any future contributor (human or AI assistant).

---

## 1. The method, in one page

The site's value is trust. Three rules protect it:

1. **Every factual claim gets a badge.**
   - ● **Verified** — confirmed from the primary source cited. The badge's
     `data-source-ids` attribute names entries in `data/sources.json`;
     clicking it shows the full Chicago-style citation. **Every visible
     Verified badge MUST carry `data-source-ids`** (verify-site.mjs
     enforces this); the only exception is legend/demo chrome, which
     must be marked `data-legend="true"`. Bibliography `<li>` entries in
     sources.html carry no dot at all — the Chicago citation is the
     verification there. Corpus figures quoted in page prose bind to
     `data/numbers.json` via `data-num="dot.path"` (loader in app.js)
     so they cannot drift from the generated data.
   - ○ **Pending** — sourced but awaiting a second independent
     confirmation. No `data-source-ids` needed.
   - ~ **Nuanced** — contested or dependent on a counting convention; the
     surrounding text must say what the disagreement is.
2. **No new interpretive content.** The site computes and cites; it never
   asserts what a verse *means*. Anything presented as Khan's reading must
   be transcribed from his published books with a citation. Structural
   observations (counts, co-occurrence, repetition) always carry a note
   that distribution does not by itself establish meaning.
3. **AI tools screen, primary sources verify.** Chatbot triangulation
   (see validation.html) tells you where to look. A claim becomes
   Verified only when the primary source itself confirms it.

Citations follow the **Chicago Manual of Style, bibliography form**:
`Author-inverted. Title, edition. Place: Publisher, year. URL. License.`
When a detail can't be confirmed against the work itself, omit it — never
guess. sources.html is the reference implementation.

## 2. Site map (25 pages)

| Group | Pages | Notes |
|---|---|---|
| Study | read, navigate, compare, themes, replay | API-backed reading; local-data everything else |
| Analyze | words, roots, patterns, numbers | fully local data |
| Learn | how-to-use, how-it-works, exercises (hub), exercise, exercise-roots, paths, glossary, watch | exercises are data-driven or book-cited; exercise-asr.html is a redirect stub |
| About | index, about, sources, validation, credits, changelog | credibility pages |
| Unlisted | embed (iframe card, the one frameable page), exercise-asr (redirect stub) | outside nav and sitemap by design |

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
NOT cleared with preferences). Content registries rendered by pages:
`data/exercises.json`, `data/paths.json`, `data/case-studies.json` — edit
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
| build-cooccurrence.mjs | morphology, roots-summary | data/cooccurrence/ | roots.html co-occurrence |
| build-surah-meta.mjs | Quran Foundation API | data/surah-meta.json | Makki/Madani |
| build-surah-profiles.mjs | morphology, chronology, qursim | data/surah-profiles.json | navigate.html profiles |
| build-themes.mjs | morphology, roots-summary | data/themes.json | themes.html |
| build-rhetorical-features.mjs | morphology | data/rhetorical-features.json | patterns.html direct-address list, numbers.html fawatih list |
| build-numbers.mjs | morphology, roots-summary, chronology | data/numbers.json | every corpus figure on numbers.html (`[data-num]` elements) |
| build-surahs-js.mjs | surah-names.json, chronology, surah-meta, surah-profiles | assets/surahs.js | the ONE canonical surah dataset (navigate, read, ask box, refs, embeds) — edit data/surah-names.json, never assets/surahs.js |
| build-share-pages.mjs | roots-summary, themes, chronology, surah-names, surah-profiles | s/ (1,789 pages) | per-entity link previews; share buttons hand these URLs out |
| build-root-refs-index.mjs | roots-summary | assets/root-refs.js | refs.js root-mention detection (ambiguous ASCII folds deliberately absent) |
| build-word-index.mjs | morphology, roots-summary, data/gloss (optional) | data/word-index.json | words.html vocabulary search — rerun after committing a gloss dataset so meanings join the index |
| build-roots-list.mjs | roots-summary | data/roots-list.json | the slim per-root record every list-level consumer fetches (roots list, compare suggestions, refs popovers, embeds, exercise-roots) — rerun whenever roots-summary changes |

Checkers (not generators — they gate shipping):

| Script | Guards |
|---|---|
| check-headers-sync.mjs | netlify.toml per-page CSP structure (fail-open for new pages: a page without its own block ships with NO CSP — run after adding any page) |
| check-nav-sync.mjs | the by-design nav duplication: every page's primary nav must match index.html's (allowlist: embed.html, exercise-asr.html) |
| check-videos.mjs | the video registry: an entry cannot be 'published' without its mp4, poster, AND a real WEBVTT captions file on disk — the anti-slop covenant, enforced mechanically |
| check-source-links.mjs | external citation liveness: every sources.json `url` and every external href on every page still answers (404/410 = FAIL, 403/429 = WARN for bot-shielding). Needs real outbound network — run from an unrestricted machine, not a sandboxed session; a good habit before any release and every few months |

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

## 4. Recipes

### Add a cited source
1. Add a Chicago-format entry to the right section of `sources.html`.
2. If statistics elsewhere will cite it, add a registry object to
   `data/sources.json` (id, author inverted, name, publisher = "Place:
   Publisher", year, url, license, accessed).
3. Reference it from a badge: `data-source-ids="your-id"` (space-separate
   multiple ids for multi-source claims).

### Add a Khan outline exercise (surahs 85–114)
1. Transcribe the outline from *An Exercise in Understanding the Qur'an*
   (2013) — never paraphrase from memory.
2. Add an entry of `"type": "outline"` to `data/exercises.json`: id,
   surah number, title, tileName/tileDesc, the outline items
   (`startVerse`, `heading`, `note` — the transcription), and keep
   `"sourceIds": "khan-exercise-2013"` with a provenanceHtml line. No new
   page is needed: `exercise.html?id=<your-id>` renders it, and the tile
   appears on `exercises.html` automatically.
3. Open the exercise locally and check the reveal flow, the break
   scoring, and that the provenance badge opens its citation.

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
- Security headers (CSP, frame-ancestors, nosniff, HSTS) are set in
  `netlify.toml`. If you add an external origin (API, CDN), you must add
  it to `connect-src`/`media-src` there or it will be blocked in
  production — and ask first whether it can be bundled locally instead.
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
8. `node scripts/check-nav-sync.mjs && node scripts/check-headers-sync.mjs`
   — mandatory after adding a page, touching the nav, or touching
   netlify.toml.
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
