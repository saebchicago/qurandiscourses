# Changes — the text first: real word meanings, quieter pages

## Why this pass exists

The previous release made the depth system real and cut duplicated
analysis. This one changes what the pages are *about*. Three things
were getting between the reader and the Qur'an:

The Read page could not say what a word means. It answered with a link
to an external dictionary, because the bundled Leeds morphology
carries no English at all: its `gloss` field is empty on every one of
the 77,429 tokens, since the corpus word translations are not part of
the GPL dump. Six surahs of Khan (2011) glosses shipped; the other 108
sent the reader away.

The home page spent most of its length explaining the site rather than
opening the text, and every analysis card ended with a sentence naming
a corpus, its version, its compiler, and its license, repeated fifteen
times on a single page.

## Word meanings, shown in place

A new `assets/wordbw.js` fetches a published word-by-word English
translation from the Quran.com Foundation Content API and renders an
interlinear strip beneath each verse: the written word above its
meaning, reading right to left like the verse. Nothing is machine
translated.

This follows the posture the site already took with verse
translations: fetched per passage at runtime, rendered exactly as
served, cached only in the reader's browser, never bundled in this
repository, rights holders credited. `data/sources.json` gains
`qcf-wbw-en`, sources.html gains its bibliography line, NOTICE.md
gains a runtime section, and the Read page's privacy caption names
both endpoints. Every strip carries a Nuanced badge pointing at that
citation, because a word-by-word gloss is a translator's choice.

The strip renders at every depth, Simple included. Knowing what the
words say is reading, not analysis, so the depth descriptions across
index, how-it-works, how-to-use, and the gear tooltip now say so.

Quran.com segments by written word while the Leeds corpus segments
morphologically (*bismi* is one written word but two Leeds tokens), so
the API text keeps its own surface and is never merged row by row into
the Leeds table. In that table the Meaning column now falls back
through what the site can cite: a published gloss, then the root's
editorial orientation gloss (marked `~`, never a dictionary
definition), then nothing. The per-row "look up" and "see entry" links
are gone, replaced by one dictionary link in the caption. The Lemma
column is dropped: it rendered raw Buckwalter (`{som`), which reads as
noise. The Words page gets the same treatment.

## Pages about the text, not about the site

Three home-page sections explained the site at length, and all three
already existed in full on the method pages: "How we verify" is
validation.html in miniature (both render the same
`data/case-studies.json`), "Three depth levels" was triplicated, and
"Purpose, audience, and scope" restated about.html's lede almost
verbatim. The trust bar's four commitments are the same four rows as
how-it-works' comparison table. All are gone from the home page and
none is lost. What remains is a reading path: hero, welcome, continue,
today's discourse, ways into the text. On a phone the daily passage
now sits about 1,200px down instead of past three screens of prose.

how-it-works gains two anchors to receive the moved material: "Where
the numbers come from" (the scripts ship, the build fails if a page
drifts from its data, and counting recurrence is not claiming
composition) and "How themes are built". numbers.html, themes.html,
formulas.html, and dossier.html link there instead of restating it;
about.html#contribute absorbs the exercises page's maintainer-facing
"Planned" note. The "the site only ordered the evidence" refrain now
appears once instead of six times, and the per-verse footer drops the
interpretive coda that fired on every verse render.

## The badge carries the citation

Clicking a source badge already opened a popover with the full Chicago
citation, the license, and a report link, generated from
`data/sources.json`. The sentence beside it was a paraphrase of that
popover. One pattern now applies sitewide: the badge stays visible
with the shortest name that identifies the source ("Leeds corpus
v0.4.", "Tanzil.", "Cairo 1924."), and the sentences move into a
collapsed "How this is computed" note, the convention the Roots page
already used thirteen times. Where the sentence was pure attribution,
it is deleted rather than collapsed.

Measured at 375px: Numbers loses 250px of provenance prose, Export
146px, Words 115px, Patterns 58px. The verbose corpus name appears
four times across the ten analysis pages instead of twelve. Export's
456-character hand-maintained citation, a verbatim duplicate of the
popover two characters to its left, is gone. Nothing explaining a
method, caveat, or counting rule was removed, and every
`data-source-ids` value, all three verbatim statistical disclaimers,
and the pinned figures the data checker validates are untouched.

## Verified

All nine checkers pass (`check-nav-sync`, `check-headers-sync`,
`build-csp --check`, `check-claims`, `check-data-nums`, `check-paths`,
`check-exercises`, `check-videos`, `check-notice`) and the full
verify-site Playwright suite reports 179 checks, all passing.

verify-site gains a Quran.com fixture (including an ayah-marker
pseudo-word and a hostile payload) and three checks: the strip renders
at Simple depth, the marker is not rendered as a word, and API text is
escaped like every other external string. Its badge-popover regression
now targets the first *visible* cited badge rather than the first in
DOM order, so a page whose first badge sits inside a closed disclosure
is still covered, and reports a warning instead of skipping silently
when no badge is visible at all.

That change immediately surfaced a genuine pre-existing gap:
compare.html renders no provenance until a comparison is run, so its
popover interaction had never been exercised. It is now covered by a
targeted check that drives the page through its own `?roots=` deep
link, so the suite reports 179 checks with no warnings and no
failures.

`SW_VERSION` is bumped to v8. One step needs an unrestricted network:
confirm from a live response which translator credit the Quran.com
word-by-word endpoint exposes, and record that credit in the
`qcf-wbw-en` source entry.
