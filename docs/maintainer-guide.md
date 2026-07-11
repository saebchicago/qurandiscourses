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
     clicking it shows the full Chicago-style citation.
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

## 2. Site map (21 pages)

| Group | Pages | Notes |
|---|---|---|
| Study | read, navigate, compare, themes | API-backed reading; local-data everything else |
| Analyze | words, roots, patterns, numbers | fully local data |
| Learn | how-to-use, how-it-works, exercises (hub), exercise-asr, exercise-roots, paths, glossary | exercises are data-driven or book-cited |
| About | index, about, sources, validation, credits, changelog | credibility pages |

Shared building blocks every page uses: `assets/nav.js` (menus, hamburger,
aria-current), `assets/app.js` (settings gear: depth / palette / theme /
translations, keyboard shortcuts 1/2/3, back-to-top, `qdEsc` HTML escaper,
API fetch helpers, `qd_state.progress` — see below), `assets/cite-badge.js`
(citation popovers, the *only* citation-popover implementation — do not
add a second one bound to `.badge[data-source-ids]`), `assets/glossary.js`
(term popovers), `assets/fonts.css` + `assets/fonts/` (self-hosted Amiri,
Cormorant Garamond, Inter).

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
2. Copy `exercise-asr.html`, change the surah number in the API fetch and
   the outline `<ol>`; keep the reveal flow and the
   `data-source-ids="khan-exercise-2013"` provenance line.
3. Add a tile to `exercises.html`; add the page to `sitemap.xml`; give it
   canonical/OG tags like every page.

### Add or adjust a theme gateway
1. Edit the `THEMES` table at the top of `scripts/build-themes.mjs` —
   roots are Buckwalter keys; the script fails loudly if a root doesn't
   exist in the corpus.
2. `node scripts/build-themes.mjs`, sanity-check the printed top passages
   against your expectation, commit `data/themes.json`.
3. If the theme should be reachable from the Ask box, add its keywords to
   `THEME_WORDS` in `assets/ask.js`.

### Add a new page
Copy an existing page's `<head>` (canonical + OG + favicon + fonts.css)
and nav/footer blocks verbatim; add the page to the right nav group **on
every page** (the nav is static HTML, duplicated by design); add a
`sitemap.xml` entry.

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

```bash
python3 -m http.server 8000    # then drive the site in a real browser
```

1. **Zero horizontal overflow** at 375px and 1280px on every page
   (`document.documentElement.scrollWidth === clientWidth`).
2. **Zero console errors** with the network up *and* with
   api.alquran.cloud blocked (the site must degrade to its offline
   fallbacks, not break).
3. **Internal link crawl**: every `href`/`src` returns 200 locally.
4. Badges: every `data-source-ids` value exists in `data/sources.json`;
   popovers open by mouse *and* Enter/Space.
5. Keyboard: hamburger menu, dropdown menus, Escape behavior, focus rings.
6. If you touched palettes/themes: check all palette × light/dark
   combinations actually change the background.
7. Dark mode screenshots of any page you changed.

## 7. Deployment

Push to `main` → Netlify deploys production. Every PR gets a deploy
preview (the netlify bot comments the URL). Rollback = revert the merge
commit and push; Netlify redeploys the previous state.

## 8. Optimization backlog (known, deliberate deferrals)

- External citation-link liveness checking (needs unrestricted network).
- Verse-reference pagination beyond the current show-all pattern.
- `words.html` is a static explainer; a real word-search would need a
  gloss dataset with a license worth citing.
- Badge dot glyphs are at the WCAG 2.5.8 24px minimum, not 44px.
