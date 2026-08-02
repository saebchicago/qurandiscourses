# Changes — a citation you can check, a card per surah, an app that installs

## Why this pass exists

The previous release made sharing consistent: one affordance that
always hands out the right preview URL. Two things it left open are
what this one closes.

The word-by-word meanings are credited to the Quran.com Foundation with
a note saying an individual translator credit replaces that if the
endpoint names one. That sentence was written from the API's documented
behavior, not from a live response, because the environment that built
the feature could not reach `api.quran.com`. The rule in this
repository is that nothing is cited from memory, so the entry carried
an honest note and an open question — phrased, unhelpfully, as a
research task.

And every shared link, whichever surah or theme it pointed at, unfurled
with the same site-wide image.

## The citation question becomes one command

`scripts/check-wbw-credit.mjs` turns "inspect the resource metadata"
into `node scripts/check-wbw-credit.mjs`. It parses the endpoint out of
`assets/wordbw.js` — the same way the edition checker parses
`assets/app.js` — so the check can never drift from what the site
actually requests. It fetches a short surah, prints the first word
entry exactly as served plus every attribution-shaped field it can
find, probes candidate resource endpoints, and ends in one of three
verdicts: **OK** (the served credit matches what is recorded),
**ACTION NEEDED** (a different credit is served — it prints the JSON to
paste), or **REVIEW** (nothing conclusive; read the payload).

Two decisions in it are worth stating. It **discovers rather than
asserts**: the response shape for word-level attribution could not be
verified when it was written, so it prints what it finds and labels
anything speculative "candidate (unverified)" in its own output. And
**only a contradiction fails** — ambiguity exits 0 — so the weekly
scheduled run stays quiet unless the endpoint's attribution really
changed. It runs alongside the existing citation-link and edition
checks in the scheduled audit job, and the maintainer guide carries the
three-verdict recipe.

Building it caught a bug worth recording: an early version read the
gloss itself as a credit. The English meaning of the first word of
al-'Asr is "By the time", which matched both a broad
`/translat/`-shaped key rule and a name-shaped value rule — so the
check would have cried wolf on literally every run. Credit candidates
are now selected by key, with content fields and language labels
excluded by name rather than guessed at by value.

## A card per surah and theme

`assets/og/surah/<n>.png` (114) and `assets/og/theme/<slug>.png` (33)
now carry the surah's Arabic name, transliteration, verse count,
Meccan/Medinan class and revelation-order position, or the theme's
title and root families. They are rendered from
`assets/og/entity-template.html` by `scripts/build-og-images.mjs`,
using the same committed JSON the share-page generator reads, so a card
and its share page can never describe an entity differently. The
Arabic uses the repository's own bundled Amiri rather than a system
fallback, so a name renders identically wherever the cards are
generated — and never as tofu.

The 1,642 root pages deliberately keep the site-wide card: the
least-shared tail, where per-entity PNGs would be indefensible repo
weight, and the page title already names the root. `build-share-pages`
picks up a card when the file exists and falls back to the site card
when it does not, so the image step stays optional for a fresh clone
and a deleted card degrades instead of 404ing in someone's preview.
The generator prunes stale cards on a full run, exactly as the share
pages are pruned.

Like the site image and the PWA icons before it, this generator is
explicitly **outside the deterministic pipeline** — PNG encoding and
font rasterization are not byte-stable across machines — so it is
owner-run and reviewed by eye, never wired into CI. The share pages
themselves remain run-twice identical.

## An install surface

The manifest gains three shortcuts (Read a passage, Today's discourse,
Browse surahs) and narrow/wide install screenshots. Shortcuts carry no
icons of their own, so the richer install and long-press surface costs
three JSON entries and two images.

Nothing renders the manifest, which means nothing would have noticed it
rotting: a shortcut pointing at a deleted page, a screenshot whose
declared size stopped matching the file, or a missing icon all degrade
or silently reject the install prompt rather than erroring. verify-site
gains a `manifest` check that resolves every icon and screenshot at its
declared pixel size (read from the PNG header, no dependency) and
asserts every shortcut is in scope, resolves to a page, and — where it
carries a fragment — to a real id on that page. Each of those five
failure modes was verified to fail the check.

## Verified

All checkers pass (`check-nav-sync`, `check-headers-sync`, `build-csp
--check`, `check-claims`, `check-data-nums`, `check-paths`,
`check-exercises`, `check-videos`, `check-notice`) and the full
verify-site suite reports **180 checks, all passing** — 179 plus the
new manifest group.

`scripts/verify-site.mjs` gave up two blocks it had held alone: the
Playwright resolution and the local static server now live in
`scripts/lib/`, shared with the image generator. The suite running
unchanged at 179 before the manifest check was added is the evidence
that extraction was behavior-neutral.

The share pages regenerate byte-identically across runs (147 with an
entity card, 1,642 with the site card), the credit checker's parsing,
comparison and three verdicts were exercised against a stubbed server,
and NOTICE.md now states the licensing standing of the generated
images.

One step still needs an unrestricted network, and it is now a single
command: confirm the word-by-word translator credit with
`node scripts/check-wbw-credit.mjs`.
