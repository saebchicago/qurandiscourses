# Changes — a rhyme-regularity index, ranked across all 114 surahs

## patterns.html's rhyme explorer gains a cross-surah view

- The existing rhyme explorer (`data/rhyme/{n}.json`, built by
  `scripts/build-rhyme-map.mjs`) only ever shows one surah at a time — its
  `shiftCount` (how many times the verse-final rhyme key changes) had no
  way to be compared across surahs. Added **mean run length** —
  `verseCount / (shiftCount + 1)`, the average number of consecutive
  verses sharing a fine rhyme key before it changes — as a single
  regularity scalar per surah, computed purely from the shift data the
  generator already produces (no new source data, no new claim about
  structure).
- New "Rhyme regularity across surahs" card on `patterns.html`: ranks all
  114 surahs by mean run length, showing the 8 most regular (longest
  sustained runs — surah 91, "The Sun", tops the list at 15 with zero
  shifts across all 15 verses, i.e. one rhyme key the whole surah) and the
  8 most varied (shortest runs — several 3-verse surahs land here
  trivially, and are shown with their verse/shift counts alongside so
  that's visible, not hidden). Labeled ~ Nuanced, same orthographic-proxy
  caveats as the per-surah panel above it.
- Verified the formula by hand for two surahs at opposite extremes: surah
  91 (15 verses, 0 shifts → 15/1 = 15, exact match) and surah 103 (3
  verses, 2 shifts → 3/3 = 1, exact match). Verified the generator is
  deterministic (identical file hashes across two full regenerations of
  all 114 `data/rhyme/*.json` files plus the summary). Verified live in
  the browser: both ranked lists render with the expected surahs at the
  extremes, correct per-row detail, zero console errors.
- Regenerated CSP hashes (`patterns.html`'s inline script changed). Full
  check suite and the full `verify-site.mjs` suite (161 checks) pass with
  zero regressions.

# Earlier changes — lexical diversity (type-token ratio) by surah and by period

## A new corpus-linguistics measure: vocabulary variety vs. repetition

- Added type-token ratio (TTR) — distinct surface forms, and distinct
  lemmas, each divided by all word-tokens — at two granularities:
  - **Per surah**, in `scripts/build-surah-profiles.mjs` /
    `data/surah-profiles.json`: `distinctFormCount`, `formDiversityRatio`,
    `distinctLemmaCount`, `lemmaDiversityRatio`, computed from the same
    per-token pass the existing `rootDiversityRatio` already uses, so all
    three ratios (root/form/lemma) are directly comparable. Surfaced on
    `dossier.html`'s Vocab section, next to the existing root diversity
    ratio.
  - **Per chronological period**, in `scripts/build-numbers.mjs` /
    `data/numbers.json`'s new `ttrByPeriod` array: mirrors the existing
    `posByPeriod` structure (same four Cairo 1924 periods, same token
    counts). Surfaced on `numbers.html` as a new "Lexical diversity by
    period" table, showing tokens alongside form/lemma TTR at full
    (4-decimal) precision — the site-wide `[data-num]` 1-decimal
    convention would have flattened these into visually-identical values,
    so this table fills its ratio cells via a small dedicated script
    instead.
- TTR is well known to be sensitive to sample size — it falls mechanically
  as text grows, independent of any real change in vocabulary richness.
  Both surfaced views state this caveat plainly (~ Nuanced) rather than
  present the numbers as a clean ranking: the per-surah ratio is framed as
  a within-similar-length comparison, and the per-period table shows each
  period's token count right next to its ratio so the length confound is
  visible, not hidden.
- Verified the exact formula by hand against raw morphology data for one
  surah (103: 14 tokens, 13 distinct forms, 13 distinct lemmas → 0.9286 /
  0.9286, exact match) and one period (Early Meccan: 2,704 tokens, 1,677
  distinct forms, 954 distinct lemmas → 0.6202 / 0.3528, exact match).
  Cross-checked that `ttrByPeriod`'s token counts exactly match the
  pre-existing `posByPeriod` counts for the same periods (internal
  consistency between two independently-built aggregates). Verified both
  generators are deterministic (identical file hashes across two runs).
  Verified live in the browser on both pages: correct values render,
  matching the hand calculations exactly, with zero console errors.
- Regenerated CSP hashes (`numbers.html`'s inline script changed). Full
  check suite (`check-claims`, `check-exercises`, `check-data-nums`,
  `check-paths`, `check-nav-sync`, `check-headers-sync`,
  `build-csp --check`) and the full `verify-site.mjs` suite (161 checks)
  pass with zero regressions.

# Earlier changes — a distinctiveness ranking for root co-occurrence (PMI)

## roots.html now ranks co-occurring roots by distinctiveness, not just frequency

- Added pointwise mutual information (PMI) as a second ranking of the same
  verse-level co-occurrence data already computed in
  `scripts/build-cooccurrence.mjs`: PMI(r1,r2) = log2(P(r1,r2) /
  (P(r1)·P(r2))), where each root's marginal probability is its share of
  all 6,236 verses (computed independently from the exact same verse-root
  pass the existing count is built from — not from `roots-summary.json`'s
  `totalCount`, which is a token count and the wrong unit for a verse-level
  probability model). A pair needs ≥3 shared verses before it's ranked, to
  keep a single coincidental shared verse between two rare roots from
  producing an enormous but meaningless score.
- This asks a different question than the existing count-sorted list — how
  much *more than chance* two roots co-occur, not how *often* — and can
  disagree with it: r-ḥ-m/gh-f-r (mercy/forgiveness, the site's own
  flagship co-occurrence example) is r-ḥ-m's highest-count partner at 91
  shared verses, but ranks only 5th by PMI (score 3.17) behind several
  much rarer, more tightly-paired roots — exactly the "frequent ≠
  distinctive" tension PMI exists to surface. Both lists are kept side by
  side; neither replaces the other.
- New `roots.html` panel, "Distinctive partners (PMI)", labeled ~ Nuanced
  (a chosen statistic, not a settled count) with its own method note.
  Hidden entirely for roots with no partner reaching the 3-shared-verse
  floor.
- Verified the exact PMI formula by an independent hand calculation
  against the r-ḥ-m/gh-f-r pair (script: 3.17, manual: 3.1660 → matches to
  rounding); verified the generator is deterministic (identical file
  hashes across two runs); verified live in the browser that the panel
  renders correctly, hides correctly for a sparse root, and produces no
  console errors.
- Regenerated all 1,642 `data/cooccurrence/*.json` files (adds
  `coRootsPmi` and `verseCount` fields; existing `coRoots` and
  `byChronologyCoRoots` fields unchanged). Regenerated CSP hashes. Full
  `verify-site.mjs` suite (161 checks) passes with zero regressions.

# Earlier changes — a study path chaining Khan's method with the site's own tools

## New Study Path + a static-fallback drift bug found and fixed along the way

- Added a fifth Study Path, "Test a Khan outline against the site's own
  computed signals": work the al-'Asr outline exercise, open that surah's
  Dossier (now showing its computed structural signals per the prior
  entry), follow any signal to its full method on Patterns, then record in
  the discovery worksheet where Khan's outline and the computed signals
  agree, diverge, or don't overlap at all. Zero new claims — it only
  chains existing, already-verified tools, per the "Add a study path"
  recipe.
- While adding it, found that `paths.html`'s static fallback markup (shown
  only if the `data/paths.json` fetch fails) had already silently fallen
  behind the registry — the fourth path, "Study a theme end to end", had
  no matching card at all. Added it, and the new fifth path's card.
- `scripts/check-paths.mjs` now also asserts every path's title appears in
  `paths.html`'s static fallback, so this class of drift fails the build
  instead of sitting invisible until a reader hits it with the network
  down. Verified the check catches the exact bug just found (removed a
  title, confirmed the failure, restored it).
- Verified the new path renders correctly from the live JSON (5 cards,
  screenshot confirms clean layout) and reran the full `verify-site.mjs`
  suite (161 checks, zero regressions).

# Earlier changes — the Dossier now shows its own computed structure alongside Khan's

## Two already-computed, already-labeled signals were siloed on Patterns — now they're on every surah's Dossier too

- `data/rhetorical-features.json` (fawātiḥ letters, the believers'-vocative
  direct-address count) and `data/symmetry-test.json` (the ring-composition
  proxy test's closest, still-not-significant candidates) were each fully
  computed and already rendered — but only on `patterns.html`, reachable
  only by a reader who already knew to look there. Neither ever appeared
  on `dossier.html`, the page whose whole premise is "everything the site
  knows about one surah, on one page" — so a reader testing Khan's outline
  (or proposing their own structure in the discovery worksheet) had no way
  to see the site's own mechanical tooling corroborate or diverge from it,
  for that same surah, without a separate trip to Patterns.
- `dossier.html`'s `renderStructure()` now also fetches both files and, for
  surahs where they have something to say, renders them in the same
  Structure section as the outline/pivots/interpretation: a ●-Verified
  "Rhetorical features" block (fawātiḥ, direct-address verses with links)
  and a ~-Nuanced "Ring-composition proxy test" block (explicitly stated as
  not significant — this must never read as a positive finding). Surahs
  with nothing in either dataset show nothing extra, same as the existing
  pivots/interpretation sections' honest-empty pattern.
- No new computation, no new claims — both datasets and their labels
  already existed and already passed `check-claims.mjs`; this is purely
  cross-linking. Reuses the page's existing `fill()` helper, so citation
  badges on the new content are automatically wired up
  (`qdCiteEnhance`) — verified live that the new badge's popover opens.
- Found and built from a broader audit of how tightly the site's own
  computed tooling is cross-linked with Khan's transcribed outlines (see
  also the Replay citation fix, below).
- Regenerated CSP `script-src` hashes; full `verify-site.mjs` suite (161
  checks) passes with zero regressions.

# Earlier changes — fix Replay's hardcoded outline citation

## Replay was citing the wrong Khan book for 5 of its 6 outlines

- `replay.html`'s outline-provenance badge and citation sentence were
  hardcoded to always name *An Exercise in Understanding the Qur'an*
  (2013, `khan-exercise-2013`) — correct for surah 103 (al-'Asr), but
  wrong for the other five surahs with a transcribed outline (96, 107,
  108, 109, 112), which are all sourced from the different volume *An
  Introduction to Understanding the Qur'an with Examples* (2011,
  `khan-introduction-2011`). Every one of those five showed a ● Verified
  badge citing a book that isn't where that outline actually came from —
  a real provenance error on a page whose premise is that everything
  shown is traceable.
- `assets/replay.js` now sets the badge's `data-source-ids` and the
  citation text from the matched outline's own `sourceIds`/
  `provenanceHtml` fields, the same fields `exercise.html` already reads
  correctly per entry, instead of hardcoding one book in the HTML.
- Verified live for surah 96 (now correctly cites khan-introduction-2011),
  surah 103 (still correctly cites khan-exercise-2013 — no regression),
  and surah 90 (no outline — the citation stays hidden, as before).
- Found during a broader audit of how tightly the site's own computed
  tooling is cross-linked with Khan's transcribed outlines.

# Earlier changes — the middle depth tier is now "Study," not "Scholar"

## Renamed the analytical depth tier site-wide

- Renamed the middle depth tier (Simple / **Scholar** / Encyclopedic) to
  Simple / **Study** / Encyclopedic, at the maintainer's request. "Scholar"
  read as gatekeeping for a site whose whole premise is that any reader can
  do this work; "Study" names what the tier actually does (word-by-word
  morphology, root links, chronological period distribution) without
  implying a credential.
- Renamed everywhere the tier is represented, not just its visible label:
  the `.scholar-only` CSS class → `.study-only`, the `data-depth="scholar"`
  attribute/state value → `"study"`, the settings-gear option, the
  `read.html` depth-toggle button, every `data-tip="depth-scholar"` /
  `aria-label` reference, the onboarding tour copy, `how-to-use.html`'s and
  `how-it-works.html`'s explainer cards, and every "at Scholar depth" prose
  mention across `dossier.html`, `words.html`, `patterns.html`, `paths.html`
  (registry and static fallback), `validation.html`, and
  `data/case-studies.json`. Left untouched, deliberately: `CHANGES.md` and
  `changelog.html`'s existing historical entries (they describe the site as
  it was on the date they were written), and every generic use of
  "scholar/scholarly/scholarship" as an ordinary English word (Khan's own
  scholarly lineage, bibliography descriptions, claim-type vocabulary like
  `scholarly-attribution` — none of those name the UI tier).
- The settings-gear option text needed new copy, not just a relabel:
  "Scholar — study" would have become the redundant "Study — study." It's
  now "Study — analyze," matching the terse verb-phrase pattern of the
  other two options ("Simple — just read," "Encyclopedic — verify").
- Added a one-time migration in `assets/app.js`'s state loader: a
  returning visitor's `localStorage` may still hold the old `"scholar"`
  value, which would otherwise match none of the three valid depths and
  silently fall back to Simple. The migration rewrites and persists the
  value on first load post-deploy.
- Verified live with Playwright: the renamed button sets `data-depth`
  correctly, `.study-only` content toggles correctly at each tier, the
  migration both applies mid-session and persists to `localStorage` (not
  just once per page load), and the full `verify-site.mjs` suite (161
  checks across all 28 pages) passes with zero regressions.
- Regenerated `netlify.toml`'s CSP script-src hashes (`build-csp.mjs`) —
  several inline `<script>` blocks changed.

# Earlier changes — wider badge tap targets

## Citation badges are easier to tap without risking accidental clicks nearby

- Widened every ●/○/~ citation badge's tap target horizontally toward the
  WCAG 2.5.8 AAA 44px guidance (`.badge::before`, an invisible pseudo-element
  — the rendered glyph is unchanged, still ~21x20px). Vertical expansion was
  attempted and reverted: a full Playwright sweep of every badge-bearing page
  at desktop and mobile widths found the site's fluid text reflow puts some
  badges within ~2px of an interactive element on the next wrapped line at
  certain viewport widths (e.g. numbers.html's citation line), which no
  static margin can stay safely clear of everywhere — so height stays at the
  glyph's already WCAG-2.5.8-compliant ~20px.
- Before widening, the same sweep found the horizontal expansion would have
  intercepted clicks meant for something else in 4 places where a badge sat
  right against a link or another badge: `about.html`'s badge legend,
  `sources.html`'s bibliography (two citations) and its own badge legend,
  and `datasets.html`'s Formulas citation. Added real spacing (a small
  margin on the badge, not a layout change) at each. `how-to-use.html`'s
  legend table needed slightly more cell padding for the same reason on
  mobile widths specifically.
- Verified with real click simulation (`document.elementFromPoint` just
  outside the visible glyph resolves to the badge) and screenshots in both
  light and dark mode, not just bounding-box math.
- Documented the axis-specific reasoning in `docs/maintainer-guide.md`'s
  optimization backlog, replacing the old "not 44px" note.

# Earlier changes — Study Paths integrity guard

## A study path's links into other tools can no longer silently rot

- Added `scripts/check-paths.mjs`. Each of the four registered study paths
  (`data/paths.json`) chains hand-authored links into other tools — an
  exercise id, a theme slug, a surah/verse reference, a `compare.html`
  passage pair. None of that was schema-checked, and none of it is caught
  by `verify-site.mjs`'s HTTP-level link crawl: every one of those pages
  returns 200 regardless of whether the id/slug/verse embedded in it is
  real, since the page just renders a client-side "not found" state.
- The new checker resolves every `exercise.html?id=` against
  `data/exercises.json`, every `themes.html#slug` against
  `data/themes.json`, and every surah/verse number (including
  `compare.html`'s `p1=`/`p2=` passage pairs) against
  `data/surah-meta.json`'s verse counts. Verified it catches breakage by
  deliberately corrupting an id, a slug, and two verse references, then
  restoring the file.
- Wired into `.github/workflows/audit.yml` alongside the other registry
  checks. Documented in the maintainer guide's checker table, a new "Add a
  study path" recipe, and the pre-ship checklist.
- No path content changed; all 4 current paths pass.

# Earlier changes — data-num drift guard

## Corpus figures in prose can no longer silently fall out of sync with the generated data

- Added `scripts/check-data-nums.mjs`. Every `data-num="dot.path"` binding
  (sources.html, validation.html, words.html, roots.html, numbers.html,
  credits.html) is supposed to bind a prose figure to `data/numbers.json` so
  it can never drift — but `assets/app.js`'s `initDataNums()` only overwrites
  the static fallback text when the path resolves to a number, and fails
  silently otherwise. A typo'd path or a stale fallback left behind after
  `data/numbers.json` regenerates would previously go undetected.
- The new checker resolves every binding's path and recomputes the expected
  display value with `initDataNums()`'s own formatting (`toLocaleString` for
  integers, `.toFixed(1)` otherwise), then fails if the static text doesn't
  match. Verified it actually catches drift by deliberately corrupting a
  figure and confirming the failure, then restoring the file.
- Wired into `.github/workflows/audit.yml` alongside the other registry
  checks, and documented in the maintainer guide's checker table and
  pre-ship checklist.
- No page content changed; all current bindings across all 28 pages pass.

# Earlier changes — the Transcription Gate

## Documented the human-in-the-loop process that keeps Khan transcriptions mechanical

- Added "The Transcription Gate" to `docs/maintainer-guide.md`: a required
  3-step process before any Khan outline or interpretation excerpt is added —
  a human supplies the exact source text from the physical/licensed volume
  first; an assistant only structures already-supplied text into the data
  schema, never originating or paraphrasing; and a pre-merge checklist
  (source IDs resolve, labels are honest, `check-exercises.mjs` passes, the
  human re-reads the rendered page against the source) closes the loop.
- Both the "Add a Khan outline exercise" and "Add a Khan interpretation
  excerpt" recipes now open with a step 0 pointing at the gate, so the
  requirement is unmissable rather than implied by scattered wording.
- Corrected two review findings before merge: the gate's structuring step
  now describes the outline and excerpt schemas separately (they don't
  share fields), and its labeling guidance now matches the actual UI — a
  transcribed excerpt's ● badge (dossier.html, exercise.html) verifies the
  transcription's fidelity to its cited source, not the interpretive
  content, rather than claiming quoted text carries no ●/○/~ at all.
- No exercise or interpretation content changed; this formalizes an existing
  practice, it doesn't introduce a new one.

# Earlier changes — exercise registry integrity check

## Every exercise now stays source-traceable by construction, not by review

- Added `scripts/check-exercises.mjs`, a deterministic guard for
  `data/exercises.json` in the same family as `check-claims.mjs` and
  `check-videos.mjs`: unique entry IDs; outline entries carry a valid
  1–114 surah number, sourceIds that resolve in `data/sources.json`, a
  `provenanceHtml` citation linking to sources.html, and an `outline`
  array whose `startVerse` values strictly increase and stay within the
  surah's verse count (`data/surah-meta.json`); at most one outline entry
  per surah, matching the maintainer guide's "consumers take the first
  match" rule; roots entries' `href` and `surahs` are valid; and
  `index.html`'s hand-kept `EXERCISE_COUNT` matches the registry length.
- Wired the new check into `.github/workflows/audit.yml` alongside the
  other registry validators, and documented it in the maintainer guide's
  checker table, the "Add a Khan outline exercise" recipe, and the
  pre-ship checklist.
- No exercise content changed; the current 7 registry entries (6 Khan
  outlines, 1 root-spotting configuration) all pass.

# Earlier changes — evidence audit corrections

## Unsupported numerical totals are no longer presented as findings

- Retained the reproducible Leeds root totals for y-w-m (405) and sh-h-r
  (21), but explicitly identified the popular 365, 475, and 12 totals as
  unreproduced surface-form claims rather than equally supported results.
- Corrected the y-w-m worked example and canonical claim record so its
  reproduction method describes only what the bundled build actually computes.
- Synchronized the home and Validation fallback copy with the canonical case
  study, preserving the same caveat if the JSON request fails.

# Earlier changes — research-led home and claim provenance

## Evidence status is now multidimensional

- Added a canonical, versioned claim ledger (`data/claims.json`) for every
  worked verification example. Records distinguish source inspection,
  computational reproduction, corpus/method/classification dependency,
  interpretive status, AI involvement, derivation, and known limits.
- Added `scripts/check-claims.mjs` to reject missing or duplicate claim IDs,
  unknown source references, invalid statuses, missing limitations, nonexistent
  derivation artifacts, case-study drift, and AI-assisted interpretive content.
- Updated worked examples to render evidence chips and expandable claim records
  rather than asking one “Verified” marker to carry several different meanings.
- Tightened the contribution and validation guidance: assistant output may help
  locate candidate material but never becomes an authoritative interpretation,
  citation, translation, gloss, or scholarly attribution.

## The home page now begins with the research workflow

- Replaced the feature-directory opening with a clear reading proposition, a
  primary “Open a surah” action, and a scoped search for surahs, verses, roots,
  and keywords.
- Added a four-part research commitment strip: no generated commentary,
  recomputable evidence, visible limitations, and local-only reader work.
- Consolidated eleven equal-weight destination tiles into four outcome-led
  routes: read a discourse, follow a question, test a pattern, or audit a claim.
- Added responsive, reduced-motion-compatible visual components and expanded
  visible keyboard focus to textareas, summaries, and custom tabindex controls.

# Earlier changes — translation fix + Urdu support

## Landing & onboarding pass (report items U4–U9)

Each remaining report item was verified against the live code before
anything changed (three earlier claims in the same report had already
failed to reproduce).

**Shipped:**

- **One sequenced first-visit path (U6 + U4).** The welcome banner had
  three competing actions — a demanded depth question, a tour button, and
  a "new to the Qur'an?" link. It now leads with one plain sentence, then
  exactly two outcome-labeled choices ("New to the Qur'an? Start here" →
  the About page's no-background-assumed intro; "Take the 60-second
  tour"), and a demoted one-line note that you start in Simple and can go
  deeper anytime (gear or keys 1/2/3). The depth toggle is gone from the
  banner — it remains in the gear, the depth-cards section, and How to
  use. Clicking "Start here" also marks the banner as seen so it doesn't
  re-nag on return (`assets/tour.js`).
- **Plain language before jargon (U5).** Banner copy drops "workbench";
  "discourse" — the one core term in the site's own name with no
  definition wired — is now in `assets/glossary.js` (auto-wrapped for
  tap-definitions on every page, including the banner itself) and has a
  static entry on `glossary.html`. `surah`, `khitab`, `root`, and
  `coherence` were already auto-glossed.
- **Depth meaning at the point of choice (U7).** The gear panel's depth
  select now reads "Simple — just read / Scholar — study / Encyclopedic —
  verify," the same microcopy the depth cards and How-to-use teach.
- **Worksheet gated to Scholar+ (U9).** The discovery worksheet rendered
  its full structural-hypothesis form at Simple depth, contradicting the
  site's own "Simple = the reading layer" contract. It now carries the
  existing `scholar-only` class: hidden at Simple, appears live the
  moment the reader steps up to Scholar or Encyclopedic (verified with
  key-2 switch, no reload). The lightweight notes card stays at all
  depths — the reader's own record is central to the method.

**Verified, not a defect (no change):**

- **U8 "6 of 9 inputs lack explicit programmatic labels"** — audited
  every static `<input>/<select>/<textarea>` across all pages: the six
  flagged inputs are each wrapped in a `<label>` element, which is a
  valid programmatic association. No accessibility gap.

**Deliberately not done:**

- Scroll-triggered progressive reveal of the Begin grid — gimmicky,
  layout-shift risk; the grid is already grouped into three labeled
  outcome clusters.
- Nav restructuring — the 21 links are already collapsed behind four
  group buttons; the nav was not the overload source, the banner was.
- Adding explicit `for=` attributes to the six wrapped-label inputs —
  already programmatically labeled; churn without benefit.

## Follow-up (consolidated UX & technical report)

A follow-up report reiterated the `en.haleem` fix and Urdu support below
(both already shipped) and added three concrete asks, resolved here:

- **Reduced default translations from 5 to 2** (`assets/app.js`): only
  `en.sahih` (Saheeh International) and `en.yusufali` (Yusuf Ali) —
  the report's own "trusted standard" pairing — now carry `default:
  true`. `en.pickthall`, `en.maududi`, and `en.asad` stay fully
  selectable in the picker, just not pre-checked for new visitors. Note
  the report said "4 → 2"; the actual prior count was 5 (verified
  against the array), not 4.
- **Removed the Khattab "Clear Quran" citation entirely** (`data/
  sources.json`, `sources.html`) — the report's own investigation
  confirmed it's exclusively licensed (Furqaan Institute) and not on
  alquran.cloud under any ID; it also carried an over-claimed ● Verified
  badge despite never being rendered. If a license is obtained later
  (see theclearquran.org/copyright-information, QUL translation #426),
  it would need to be self-hosted as a local JSON edition, not fetched
  via alquran.cloud. `en.itani` (a genuinely different, already-free
  "Clear Qur'an" by Talal Itani) is untouched.
- **Fixed a real Escape-key bug in the welcome tour** (`assets/tour.js`):
  reproduced and confirmed via a fresh-browser-context test — with a nav
  dropdown open during the tour, pressing Escape closed both the
  dropdown and the entire tour in one press, because the tour's Escape
  listener runs on `document` with capture (so it always fires before
  the dropdown's own bubble-phase handler). Fixed by having the tour
  defer to an open dropdown as the topmost layer; a second Escape press
  (nothing else open) now closes the tour as expected.

**Two other claims in that report did not reproduce against the current
code, verified empirically rather than assumed either way:**
- "First-time visitors default to Encyclopedic depth" — a fresh
  browser context (`localStorage` genuinely empty) loads `read.html`
  with `data-depth="simple"`, matching `assets/app.js`'s `state.depth:
  "simple"` default. Most likely explanation: the report's own manual
  testing picked up leftover state from earlier exploration in the same
  browser session, which would make a prior manual "Encyclopedic" click
  look like "the default" on a later visit.
- "Tour won't advance past Step 1 of 5" — a scripted run through all 5
  steps via the Next button advanced cleanly every time
  (1→2→3→4→5→done). Not reproduced; no change made.

**Not touched in this pass** — the report's broader landing-page/
onboarding UX items (navigation density, jargon before definition,
merging the tour with the "new to the Qur'an?" page, depth-toggle
previews, a few unlabeled inputs, hiding the discovery worksheet in
Simple depth). These are legitimate P1–P3 findings but are design
decisions, not verifiable bugs — worth a dedicated pass with explicit
sign-off on the direction rather than a unilateral redesign bundled
into a translation-bug fix.

## Removed dead edition, added its replacement

`en.haleem` ("Abdel Haleem") was registered in `assets/app.js`'s
`TRANSLATIONS` array but does not exist on alquran.cloud — the API
silently substitutes its default Arabic edition (`quran-simple`) instead
of erroring, so a reader who picked "Abdel Haleem" was shown Arabic text
labeled as an English translation. Removed. This sandbox's outbound
network is proxy-blocked to `api.alquran.cloud` specifically (confirmed:
policy-level 403 on the CONNECT tunnel, not a code issue — the live site's
own users hit this API fine from their browsers), so the exact substitution
behavior is taken on trust from the task's own testing rather than
independently reproduced here; the guard below makes that trust
unnecessary going forward regardless.

Replacement: **`en.wahiduddin`** (Wahiduddin Khan) — the task's own
recommended default. Independently corroborated as a real alquran.cloud
edition ID across a dozen+ unrelated public repos that reference the same
identifier (Raycast's Quran extension, several Quran API wrapper libraries,
etc.), since this sandbox couldn't query the live catalog directly.

## Hardening: edition-mismatch guard

`qdFetchVerse`/`qdFetchSurah` (`assets/app.js`) now compare each returned
`edition.identifier` against the identifier that was actually requested,
by array position (the API returns editions in request order). A mismatch
— any future dead edition ID, not just this one — gets a non-enumerable
`_mismatchOf` marker instead of being silently trusted, plus a
`console.warn`. Every render path that consumes translation data was
updated to check for it and show a placeholder instead of the substituted
text:

- `read.html`'s main verse/translation renderer
- `read.html`'s cross-reference panel (`fetchXrefTranslations`) — a
  separate code path that also renders translation snippets and would
  otherwise have leaked the substitution independently of the fix above
  (caught by the test below, not anticipated up front)
- `assets/embed.js`'s embed-card renderer
- `compare.html`'s passage-comparison view, which picks the first
  available *valid* translation edition rather than assuming index 1 is
  trustworthy

`replay.js` only ever touches the Arabic (`quran-uthmani`) edition, so it
was unaffected.

### Test

`node scripts/check-editions.mjs` — maintainer-run live check (mirrors
`check-source-links.mjs`'s pattern): fetches all registered editions for
one verse and asserts each returned `edition.identifier` matches what was
requested. **Not runnable from this sandbox** (same proxy block); run it
from an unrestricted machine before merging.

A Playwright functional test (not committed — lives in this session's
scratchpad, matching this repo's established ad hoc-verification pattern)
exercised the guard against a fixture that deliberately simulates the
exact `en.haleem` failure mode (API substitutes a different edition than
requested) and confirmed: the main translation block shows a placeholder
and never renders the substituted text; the cross-reference panel and
console warning both behave correctly; Urdu renders with `dir="rtl"`,
`lang="ur"`, and the Nastaliq font; the language-grouped picker shows both
headers and a language chip; no horizontal overflow at 375px; zero CSP
violations.

## Urdu translations added

Registered in `assets/app.js`, none pre-selected by default (see note
below): `ur.jalandhry` (Fateh Muhammad Jalandhry), `ur.kanzuliman` (Ahmed
Raza Khan — Kanz-ul-Iman), `ur.maududi` (Abul A'la Maududi), plus
`ur.junagarhi`, `ur.qadri`, `ur.jawadi`, `ur.ahmedali`, `ur.najafi` as
additional opt-in options. All corroborated the same way as
`en.wahiduddin` above.

**Interpretation note on "ship by default":** the task asked to "ship
these three by default." I registered all three (and the five others) as
selectable in the picker, but did **not** mark any of them
`default: true` — that flag controls which translations a brand-new
visitor sees pre-checked, and setting it would mean every new reader,
regardless of language, gets 3 Urdu translations added to their initial
view alongside the 5 existing English defaults. That reads as an
unintended UX change rather than what was asked. If pre-selecting them for
everyone was actually the intent, that's a one-line flip per entry — flag
it and I'll make the change.

### RTL + Nastaliq rendering

Each translation's `dir`/`lang` attributes are now driven directly from
the API response's own `edition.direction`/`edition.language` fields, not
a hard-coded language list — a future RTL edition in any language renders
correctly with no code change. Urdu specifically (`language === "ur"`)
additionally gets a `nastaliq` class pulling in a self-hosted **Noto
Nastaliq Urdu** webfont (`assets/fonts/notonastaliqurdu-arabic.woff2`,
`assets/fonts.css`) at `line-height: 2.1` — Nastaliq's diagonal stacking
clips against the site's normal 1.6 line-height. The Qur'anic Arabic
ayah text is untouched — it keeps the existing Naskh-style Amiri face,
which is correct for Arabic but would read as wrong for Urdu.

### Picker

The "Choose Translations" modal (`read.html`) now groups entries under
"English"/"Urdu" headers with a small language chip per row, derived from
each entry's own `lang` field so a future third language groups itself
automatically.

## Sources

`sources.html`'s "Translations rendered on this site" list: removed the
Abdel Haleem citation (no longer rendered), added Wahiduddin Khan and all
8 Urdu translators. `data/sources.json` was **not** touched — individual
translator citations for API-rendered editions were never tracked there
(confirmed: none of the existing ~14 English translations have an entry
either, only the anomalous `the-clear-quran` one — see below), so the new
entries follow the same plain-bibliography convention as the existing
Pickthall/Yusuf Ali/etc. entries rather than introducing a new pattern.

## Open question: "The Clear Quran" — Khattab vs. Itani

Per the task's own stop instruction, **not implemented, flagging only.**

- `en.itani` (Talal Itani's "Clear Qur'an") is already shipping,
  unaffected by anything in this change.
- `data/sources.json`'s `the-clear-quran` entry cites Dr. Mustafa
  Khattab's *The Clear Quran* (Book of Signs Foundation, 2016, ISBN
  9780998539003) — confirmed still genuinely unavailable on
  alquran.cloud (zero Khattab-style edition found anywhere in the public
  repos cross-checked for this change either). It is in copyright;
  wiring it in would need a licensed data source and permission, not an
  API call.
- Additionally confirmed (not just suspected): that entry currently
  carries a **● Verified badge** on `sources.html`
  (`data-source-ids="the-clear-quran"`) despite the translation not
  actually being rendered anywhere on the site — exactly the over-claim
  the task flagged. Left as-is pending your answer on which "Clear Quran"
  you meant, since the fix (downgrade the badge vs. wire a licensed
  source) depends on that answer.

## Not touched

Word-by-word morphology/gloss tables (English-only by design, per the
task's scope guardrails); file permissions, sharing settings, credentials.
No new tracking, no new network domains — the guard and Urdu additions
only touch the existing `api.alquran.cloud` calls.
