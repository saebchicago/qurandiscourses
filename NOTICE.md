# Notices

## Leeds Quranic Arabic Corpus

Files in `data/morphology/` and `data/roots-summary.json` are derived from
the Quranic Arabic Corpus v0.4 maintained by Kais Dukes at the University
of Leeds (2009–2017), distributed under the GNU General Public License.

Source: https://corpus.quran.com/

Derived files are redistributed under the same license. The morphology
directory and roots summary are GPL-licensed. The rest of this site's
source code (HTML, CSS, JavaScript) remains under its existing license.
Users redistributing or modifying the morphology data must comply with GPL.

## Tanzil chronology

`data/chronology.json` uses the Egyptian Standard (Cairo 1924) revelation
order, four-period classification following the Nöldeke-Bell tradition as
documented in Watt, "Bell's Introduction to the Qur'an" (1970). This is
public-domain reference data.

## Recitation durations (measured)

`data/recitation/` holds how long each verse's recitation lasts, per
reciter, in milliseconds. The figures are measurements read from the
headers of the per-verse audio files served by Islamic Network
(cdn.islamic.network), the same files the Read page plays; see
`scripts/build-recitation-durations.mjs`. No audio is bundled or
redistributed. The recordings remain the property of their reciters and
publishers.

## Tanzil Quran text (bundled)

Verse text rendered on the Read and Compare pages is the Tanzil Uthmani
text (Version 1.1), bundled in `data/quran-text/` as a verbatim copy of
Tanzil's own download. `scripts/build-quran-text.mjs` writes it, run by
`.github/workflows/quran-text.yml`. Tanzil's terms, as its file states
them: Creative Commons Attribution 3.0; verbatim copies may be copied and
distributed, but changing the text is not allowed; the source must be
indicated with a link to tanzil.net; and the copyright notice must be
included in every copy. The notice is reproduced verbatim in
`data/quran-text/index.json` (`notice`), and below. This site does not
modify the text and attributes Tanzil on every passage and in
sources.html. Surah names and each verse's juz, page, ruku, hizb and
sajda fields in those files come from the alquran.cloud API.

```
#  Tanzil Quran Text (Uthmani, Version 1.1)
#  Copyright (C) 2007-2026 Tanzil Project
#  License: Creative Commons Attribution 3.0
```

The full notice, including the terms of use, is in
`data/quran-text/index.json`. Until September 2026 the text was fetched
at runtime from alquran.cloud instead; that copy differed from Tanzil's
current file in marks (not words) in 3,617 verses, recorded in the
index as `servedCopyComparison`.

The translation editions registered in `assets/app.js` (Saheeh
International, Pickthall, Yusuf Ali, Muhammad Asad, and others across
23 languages) are likewise fetched at runtime from the alquran.cloud
API and are **not bundled** in this repository. Copyright in each
translation remains with its translator or publisher; the translator is
named beside every rendered verse. Anyone redistributing translation
text (as opposed to this repository's code) must clear the relevant
translation's own license.

## Quran.com word-by-word English (runtime)

The word-by-word meanings shown beneath each verse on the Read page are
fetched at runtime from the Quran.com Foundation Content API v4
(api.quran.com) and cached in the visitor's browser. They are a
published word-by-word translation rendered exactly as served; **no
word-translation text is bundled in this repository**. Copyright
remains with the translation's rights holders, credited in
sources.html and in `data/sources.json` under `qcf-wbw-en`. Anyone
redistributing that text must clear its own license. The bundled Leeds
morphology carries no English glosses, so nothing here overlaps the
GPL corpus data.

## Cross-reference data — removed

Until September 2026 this repository bundled a verse-to-verse
cross-reference dataset under `data/qursim/` (110 per-surah files,
derived from the Mishkat Mutashābihāt corpus) and rendered it as a
"Related verses" panel on the Read page, a browser on the Patterns page,
and a connectivity figure on Navigate, Compare and each surah's dossier.
Its compiler published no license, the source repository later became
unreachable, and no license could be obtained. The data and every
feature built on it were removed rather than kept as an unlicensed
redistribution. Nothing derived from it remains in `data/` or
`data/exports/`. The QurSim paper (Sharaf & Atwell, LREC 2012), which
was only ever cited as a methodological reference, is no longer cited.

## Surah metadata (Quran.com Foundation API)

`data/surah-meta.json` (Makki/Madani classification) was retrieved from
the Quran.com Foundation Content API v4 (`scripts/build-surah-meta.mjs`
records the exact endpoint). It is factual reference metadata cached at
build time; the API is credited in sources.html and data/sources.json.

## Khan word-by-word glosses (`data/gloss/`)

Files in `data/gloss/` carry per-word English glosses transcribed from
Irfan Ahmad Khan, *An Introduction to Understanding the Qur'an with
Examples* (compiled by Tanveer Azmat, Chicago: Association for Qur'anic
Understanding, 2011), © 2011 Association for Qur'anic Understanding.
The volume is distributed free of charge at quranicunderstanding.com;
the transcription was made by the site maintainer (Dr. Khan's
grandson). Where the book glosses sub-word segments (clitics), the
segment glosses are merged per whole word to align with the Leeds
tokenization; each file records this in its `_license` field. These
glosses are quoted source material, not site-authored data.

## Khan interpretation excerpts (`data/khan-interpretations.json`)

`data/khan-interpretations.json` carries short verbatim excerpts (with
ellipses marking omitted material) from the "Understanding and
Interpretation" essays in the same 2011 volume, one per worked surah.
Quoted, not site-authored; see the citation above for the source and
license context.

## Provenance registry (`data/provenance/`)

`data/provenance/sources.json` and `data/provenance/claims.json` are
site-authored bibliographic and biographical records about Dr. Irfan
Ahmad Khan's published work and public roles, compiled from the
publications, catalog records and press reports each entry names. The
records themselves — the compilation, the status assignments and the
provenance-distance field — are site-authored and MIT-licensed with the
rest of the repository.

Two categories inside them are not site-authored and are marked as
such. A claim's `quote.text` is a byte-frozen quotation from the source
its `quote.source` names, reproduced under fair use for citation with
the locator recorded so a reader can check it. A source's `title`,
`author` and `container` are bibliographic facts reproduced from the
work or catalog record described.

Where an entry describes the same object as `data/sources.json`, the two
files share the id; see `docs/EVIDENCE-SCHEMA.md` for why the registries
are kept separate.

## Bundled webfonts (`assets/fonts/`)

The site self-hosts its typefaces rather than calling a font CDN, so the
font binaries are redistributed with the repository and each keeps its
own license. All of them are under the SIL Open Font License 1.1, which
permits redistribution only when the copyright notice and license
accompany the font.

Each face's upstream license text is bundled beside the binaries in
`assets/fonts/`:

- **Noto Serif Bengali** (`notoserifbengali-bengali.woff2`, Bengali-block
  subset) — Copyright 2022 The Noto Project Authors
  (https://github.com/notofonts/bengali) — `OFL-NotoSerifBengali.txt`.
- **Noto Serif Devanagari** (`notoserifdevanagari-devanagari.woff2`,
  Devanagari-block subset) — Copyright 2022 The Noto Project Authors
  (https://github.com/notofonts/devanagari) —
  `OFL-NotoSerifDevanagari.txt`.
- **Noto Nastaliq Urdu** (`notonastaliqurdu-arabic.woff2`) — Copyright
  2022 The Noto Project Authors (https://github.com/notofonts/nastaliq)
  — `OFL-NotoNastaliqUrdu.txt`.
- **Amiri** — Copyright 2010–2022 The Amiri Project Authors
  (https://github.com/aliftype/amiri) — `OFL-Amiri.txt`.
- **Cormorant Garamond** — Copyright 2015 The Cormorant Project Authors
  (https://github.com/CatharsisFonts/Cormorant) —
  `OFL-CormorantGaramond.txt`.
- **Inter** — Copyright 2016 The Inter Project Authors
  (https://github.com/rsms/inter) — `OFL-Inter.txt`.

The OFL requires that the fonts not be sold on their own and that any
derivative keep the license; nothing here modifies the font outlines —
the files are upstream subsets served unchanged.

## Site-authored data

The following files in `data/` are authored or computed by this project
and carry the repository's MIT license (their *inputs* keep their own
licenses, listed above): `ask-routes.json` (the Ask box routing tables),
`case-studies.json`, `citations.bib` (generated
citation metadata for the site, its export tables, and its cited
sources), `changelog.json` (the changelog entry registry behind changelog.html
and feed.xml), `claims.json`, `contributors.json` (the contributor
roster behind credits.html), `exercises.json`, `glossary.json` (the term
registry behind assets/glossary.js and glossary.html), `juz.json`,
`lenses.json` (the reading-lens registry behind assets/lenses.js:
site-authored descriptions of published coherence methods; no source
text is reproduced),
`names.json` (editorial romanized labels for corpus proper-noun
lemmas — working labels for navigation, not dictionary quotations),
`paths.json`, `related.json` (the see-also join behind dossier and
themes panels), `search-index.json` (the folded-token index behind
/search), `sw-manifest.json` (the service worker's precache list and
content fingerprint),
`sources.json`, `surah-names.json`, `version.json` (the site's release
version), `videos.json`, plus the computed datasets in the next
paragraph.

Files computed from the GPL Leeds morphology inherit the GPL for their
data content: `association/`, `centrality/`, `cooccurrence/`,
`coverage/`, `dispersion/`, `exports/`, `network/`, `rhyme/`, `root-analytics/`,
`structure/`, `discursive-pivots.json`, `formula-summary.json`,
`formulaic-density.json`, `formulas-root.json`, `formulas-surface.json`,
`name-mentions.json` (the proper-noun mention index behind the history
reading lens), `numbers.json`,
`rhetorical-features.json`, `rhyme-summary.json`, `roots-index.json`,
`roots-list.json`, `surah-profiles.json`, `structure-tests.json`,
`symmetry-test.json`, `theme-surah-index.json`, `themes.json`,
`word-index.json`. Each
generator script under
`scripts/` names its inputs in its header. One of these additionally
draws on another output: `data/exports/` republishes Leeds-derived
tables as downloadable CSV/JSON under the GPL, as stated on the export
page.

The GNU General Public License text is not bundled in this repository
yet; upstream (corpus.quran.com) states "GNU General Public License"
without pinning a version. Until a copy is added, obtain the license
text from https://www.gnu.org/licenses/.

## Generated images

`assets/og/site-og.png`, the per-entity social cards in
`assets/og/surah/` and `assets/og/theme/`, the PWA icons in
`assets/icons/`, and the install screenshots in `assets/screenshots/`
are rendered by this project from its own HTML templates
(`scripts/build-og-images.mjs` and the one-time manual captures
described in the maintainer guide).

Each card displays committed data and carries that data's standing: the
surah cards show `data/surah-names.json` (site-authored, MIT) alongside
verse counts and revelation order from the Leeds-derived
`data/surah-profiles.json` and the Tanzil-derived
`data/chronology.json`; the theme cards show titles and root families
from the Leeds-derived `data/themes.json`. The bundled OFL fonts are
rasterized into these images, not embedded or redistributed as font
files, which the OFL permits.

## Other sources

See `sources.html` for the full citation list of datasets, translations,
and scholarly works referenced by this site.
