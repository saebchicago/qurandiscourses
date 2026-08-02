# Changes — UX overhaul: a Simple depth that is simple, with visible avenues into depth

## Why this pass exists

Two full-site audits (one of the entry and reading experience, one of
the analysis pages' information density) established that the site's
three-tier depth system was a promise the pages did not keep: every
visitor starts at Simple, but outside the Read page almost nothing was
gated, so the heaviest pages delivered their full encyclopedic payload
to everyone. Selecting one root produced sixteen stacked panels across
roughly fifteen screens, with "which roots co-occur" rendered six
separate times and two charts plotting identical data in different
orders. The depth control itself lived only in an unlabeled gear
panel; four of its five feature checkboxes were wired to nothing; the
site's best entry control (the Ask box) existed on one page while the
how-to guide pointed at it from another; and two floating buttons
shared the same fixed corner on mobile. This release makes "simple
with avenues for depth" real. Nothing is deleted from the deepest tier
except true duplicates; the verbatim statistical disclaimers, the
Verified/Nuanced labeling, Arabic rendering, and the byte-identical
nav are untouched.

## The depth system, made honest and visible

- A tiny render-blocking `assets/depth-boot.js` applies the saved
  depth before first paint on all 29 depth-aware pages, ending the
  flash of Simple that returning Study readers saw on every load.
- The inline depth control (previously Read only) now sits under the
  heading of Roots, Numbers, Patterns, Dossier, and Themes, with the
  1/2/3 hotkeys documented beside it; the gear panel leads with Depth
  and the gear button gained a visible "Display" label.
- The three inert display checkboxes are wired (word-by-word,
  pattern notes, transliteration now actually apply on Read); the
  never-read fourth one is removed.

## Density surgery

- Roots: the by-surah distribution, revelation-order timeline, and
  per-period rate merged into one "Where it appears" block with a view
  toggle; the three filtered co-occurrence rankings merged the same
  way; the association network graph moved inside the Statistical
  associations block whose 25 partners it plots. Statistical
  associations and Network position are Encyclopedic; forms and
  distributions are Study; Simple keeps the header, counts,
  Makki/Madani bar, companion-roots list, and verse references.
- Numbers: fifteen cards regrouped under four anchored headings
  (Scale, Vocabulary, Structure, Across revelation) with a jump row;
  the duplicate CSS-bar verse-length rendering and the twin hapax
  cards merged away; Simple shows seven cards instead of ten.
- Themes: the self-study kit is rendered once, up top, instead of
  verbatim in all 33 cards.
- Dossier: the Vocabulary card stops duplicating Navigate's profile
  panel; the Structure card's mechanical pattern evidence follows the
  depth system with a visible link out.

## Nobody arrives to nothing

Roots opens on a worked example (r-h-m) with a dismissible note;
Dossier renders an example dossier (Surah 55) under its picker; Words
gained one-tap example searches; Compare's four one-click examples are
no longer hidden at Simple; the Read start card and How-to-use both
carry the Ask box, which previously existed only on the home page.

## Wayfinding and language

- Words, Patterns, Formulas, and Numbers each end with a contextual
  "Explore further" card; Roots' equivalent card was inverted-gated
  encyclopedic-only (the page's one wayfinding card, hidden from most
  readers) and is now visible at every depth with the selected root
  prefilled into its links.
- The home page leads first-visit orientation before the commitments
  strip, folds its worked verification examples behind a disclosure
  (the tour still opens them), and adds the guided study paths as a
  fifth way in.
- Statistical column and row labels lead with plain language
  ("Strength of evidence (LLR)", "Bridge position (betweenness)"),
  with one-tap glossary definitions for LLR, PMI, Dice, keyness, TTR,
  betweenness, and eigenvector. Ledes lead with what the reader can
  do, not corpus totals.
- Prev/Next on Read continue across surah boundaries, stopping at 1:1
  and 114:6; Focus mode's F/Escape keys are documented on the page.

## Mobile and pattern-language cleanup

- The back-to-top button no longer overlaps the notebook toggle; nav
  buttons keep 44px tap targets at small widths; wide tables sit in
  the shared scroll wrapper; the open settings panel hides the
  buttons it covered; the home page clears its three-button stack.
- One disclosure vocabulary: collapsed method notes all read "How
  this is computed"; always-visible captions moved from
  `.method-note` to `.caption-note`; chart table fallbacks got their
  own `.chart-fallback` class instead of borrowing `.xref-panel`.

## Verified

All checkers pass (`check-nav-sync`, `check-headers-sync`,
`build-csp --check`, `check-claims`, `check-data-nums`,
`check-notice`, `check-paths`, `check-exercises`, `check-videos`) and
the full verify-site Playwright suite passes (175 checks, all 30
pages). Additional Playwright passes covered: all three depths on
Roots and Numbers, view toggles, deep links (`?root=`, `?q=` in Latin
and Arabic), both verbatim disclaimers visible at Encyclopedic, the
five-step tour, Ask routing from all three pages, boundary
navigation, and 375x812 / 360x740 viewports (no floating-button
overlap, 44px nav targets). SW_VERSION bumped to v7.
