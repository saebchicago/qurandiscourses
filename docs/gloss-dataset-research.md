# Word-by-word gloss dataset: licensing research

Prepared 2026-07-11 for the owner's sign-off. **Nothing ships until a
license is verified — this document exists to make that verification a
ten-minute task instead of a research project.** The build pipeline
(`scripts/build-gloss.mjs`), the Read page's Meaning column, and the
words.html live-gloss card all ship dormant and activate the moment a
licensed dataset is committed to `data/gloss/` (see the maintainer
guide, "Add word-by-word glosses").

Research constraint, disclosed: this was compiled from a sandboxed
session whose network could reach github.com/raw.githubusercontent.com
and a web-search index, but NOT qul.tarteel.ai, quranwbw.com,
archive.org, or support.tarteel.ai (all 403 at the proxy). Claims below
are marked **verified** (fetched directly, quotable) or **unverified**
(search-result synthesis — treat as a pointer, never as a citation).

## The one candidate that matters

All roads converge on a single English word-by-word text: **Dr. Shehnaz
Shaikh & Ms. Kausar Khatri, *The Glorious Qur'an Word-for-Word
Translation to facilitate learning of Quranic Arabic*** (3 volumes).

- It is the text QuranWBW.com uses ("Dr. Shehnaz Shaikh and Ms. Kausar
  Khatri are credited for their English word by word compilation" —
  **unverified**, from search synthesis of quranwbw.com/about, which is
  Cloudflare-blocked here).
- QuranWBW contributed word-by-word translations to QUL (**unverified**,
  search synthesis of QUL materials).
- QUL (qul.tarteel.ai) hosts downloadable word-by-word translation
  datasets keyed by word position, per its public description
  (**unverified** at the per-resource level; the site is
  Cloudflare-blocked here).

### The reported permission statement (the crux)

Search results attribute this statement to the published work
(**unverified — this exact text MUST be found in the volume itself
before it is relied on**):

> "You are free to use, copy, edit, improve, transform, share, store,
> print, publish, sell or distribute it partly or wholly in any manner,
> for any Halaal purpose, with or without acknowledging the source."

If the printed volume carries this (or equivalent) wording on its
copyright page, it is one of the most permissive grants a published
translation can carry, and comfortably covers this site's use
(non-commercial study tool, full attribution given regardless).

## What IS verified (fetched directly, 2026-07-11)

- **TarteelAI/quranic-universal-library (GitHub): MIT License,
  "Copyright (c) 2024-present Tarteel, Inc"** — but this is the QUL
  *platform code*. It says nothing about any dataset's license; QUL
  labels licenses per resource on each resource page.
- **QuranWBW's current site repo (github.com/marwan/quranwbw)**: no
  license file; README says its data is "pre-generated static JSON…
  served via our private CDN" and points data-seekers to QUL. So
  QuranWBW itself is NOT a redistribution source; QUL is the intended
  channel.
- **The old quranwbw repo (qazasaz/quranwbw)**: no license file; credits
  quran.com, tanzil.net, seventysixnine.com ("words database"),
  everyayah.com.
- **corpus.quran.com's glosses are NOT in the GPL v0.4 dump** this site
  already uses — our own `build-leeds.js` documents "no glosses in
  source file". Getting them would mean scraping the website, whose
  terms have not been examined and whose tokenization is the same
  (Leeds) but whose grant is murkier than the dump's GPL. Fallback only,
  not recommended.

## What the owner must do (≈10 minutes, any normal connection)

1. Open <https://qul.tarteel.ai/resources/translation>, find the
   **English word-by-word** resource. Record: exact resource name,
   translator attribution, and the **license label QUL shows for that
   specific resource** (QUL labels vary per resource: some open, some
   copyrighted — one search synthesis suggested the English WBW may be
   marked "©", which is precisely why this check gates everything).
   Download the dataset (JSON/SQLite/CSV) if the label permits reuse.
2. Open the published volume (archive.org hosts scans:
   "Glorious Quran Word For Word Shehnaz Shaikh Kausar Khatri") and
   photograph/quote the **copyright-page permission statement
   verbatim**. If it matches the reported wording above, that statement
   is the primary grant and belongs in sources.html.
3. Decide. Green light = both of: a QUL license label (or the volume's
   own permission statement) permitting reuse with attribution, and the
   permission wording confirmed from the work itself.

## After sign-off (already-built path)

Shape the download as documented at the top of
`scripts/build-gloss.mjs` (`_source` = the new sources.json id,
`_license` = the verified short license text), run it, review the
alignment report (it fails above 2% verse misalignment), and commit
`data/gloss/` **in the same commit as** the sources.json entry, the
sources.html Chicago line, the NOTICE.md addition, and a changelog
note. Glosses render with a **Nuanced** badge: a gloss is a
translator's choice, not "the meaning."

Suggested sources.json id: `shaikh-khatri-wbw` (author-attributed, like
`khan-exercise-2013`), with QUL noted as the digital source in the
citation body.
