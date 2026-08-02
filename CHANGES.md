# Changes — one share button that always shares the right thing

## Why this pass exists

The site already had good sharing bones: a floating share button on
every page, 1,789 generated link-preview pages under `s/` (one per
root, theme, and surah), an embed system, and URLs that reproduce
state. What it lacked was consistency. themes.html carried 66 inline
chips — Share and Embed inside every one of 33 card headings — while
its floating button shared the wrong URL. dossier.html never pointed
the button at its surah's preview page even though all 114
`s/surah/` pages redirect *to* it. Two affordances, two answers.

Sharing improves here by **removing** buttons, not adding them.

## One affordance, always right

The 33 per-card Share chips on themes.html are gone; the floating
button now owns sharing everywhere. It follows the page's hash: when
a theme card is on screen (`themes.html#patience`), it hands out that
theme's link-preview page; on any other hash (like the in-page
`#study-kit` anchor) it falls back to the live URL. The Embed chip
moves out of each card's heading into a study-only row at the card
bottom, matching the Roots page's existing pattern — at the default
Simple depth a theme card now shows zero buttons instead of two.

dossier.html points the button at `s/surah/N.html` once a real
dossier renders (the picker and example views keep the live URL).
coverage.html and export.html, the only two pages without share.js,
now load it, so the button exists sitewide.

## The verse reference is the link

On the Read page each verse's reference (`103:1`) is now itself a
link to that verse's canonical single-verse URL — the classic
anchor-link convention. Right-click or long-press to copy, click to
land on it. No new buttons; the reference was already there.

Where the native share sheet is available, sharing from the Read
page now carries a human label ("al-'Asr 103:1-3") alongside the
URL, built from the same API surah name already on screen. The
clipboard fallback stays URL-only: a pasted link should be a link.

## Richer unfurls

The `s/` page template gains `og:image:alt`, `twitter:title`, and
`twitter:description`; all 1,789 pages are regenerated (run-twice
deterministic, as before). The one site-wide OG card no longer
headlines "1,642 roots / 114 surahs" — the count-flexing this series
of passes has been retiring — and instead says what the site is for:
read a surah as one connected discourse, every claim traceable to
its source. The PNG is regenerated from the committed template.

## The citation you can take with you

The citation popover (any source badge) gains a "Copy citation"
action: the same Chicago-style line the popover shows, as plain text
with the source URL, via the existing clipboard helper. It appears
only on pages that load share.js, and degrades to nothing elsewhere.

## Verified

All checkers pass (`check-nav-sync`, `check-headers-sync`,
`build-csp --check`, `check-claims`, `check-data-nums`,
`check-paths`, `check-exercises`, `check-videos`, `check-notice`),
`build-share-pages` is run-twice deterministic, and the full
verify-site Playwright suite reports 179 checks, all passing.

Targeted spot-checks (Playwright): themes shows 0 chips at Simple
and 33 study-only Embed chips at Study; the floating button's URL
tracks hash changes, deep-linked arrival (`themes.html#<slug>`
despite the fetch/defer race), and `#study-kit` correctly; the
dossier button is set after DOMContentLoaded on real dossiers and
unset on the picker; the verse self-link navigates and the meta row
does not overflow at 375px; "Copy citation" copies plain text (no
markup) and toasts; coverage and export load clean with the button
present.
