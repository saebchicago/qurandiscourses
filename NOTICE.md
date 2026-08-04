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

## Tanzil Quran text (runtime)

Verse text rendered on the Read and Compare pages is the Tanzil Uthmani
text, served at runtime through the alquran.cloud API and cached in the
visitor's browser. Tanzil distributes its text under **CC BY-ND 3.0**
(attribution, no derivatives). This site does not modify the text and
attributes Tanzil on every verse footer and in sources.html. No Tanzil
text is bundled in this repository.

The translation editions registered in `assets/app.js` (Saheeh
International, Pickthall, Yusuf Ali, Muhammad Asad, and others across
seven languages) are likewise fetched at runtime from the alquran.cloud
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

## Cross-reference data (`data/qursim/` = Mishkat corpus)

`data/qursim/` (110 per-surah files) powers the Related-verses feature.
Despite the directory's historical name, the data it contains is derived
from the **Mishkat Mutashābihāt corpus**
(github.com/Alhassan777/Mishkat, 13 classical books,
scholarly-attested), not from the QurSim dataset — QurSim (Sharaf &
Atwell, LREC 2012) is cited as the methodological reference only, and
none of its data is bundled. The Mishkat repository publishes **no
license**; its status is recorded as license-pending in
`data/sources.json`, the compiler is credited, and if the rights holder
objects the data will be removed.

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
licenses, listed above): `case-studies.json`, `citations.bib` (generated
citation metadata for the site, its export tables, and its cited
sources), `claims.json`, `exercises.json`, `juz.json`, `paths.json`,
`sources.json`, `surah-names.json`, `version.json` (the site's release
version), `videos.json`, plus the computed datasets in the next
paragraph.

Files computed from the GPL Leeds morphology inherit the GPL for their
data content: `association/`, `centrality/`, `cooccurrence/`,
`coverage/`, `exports/`, `network/`, `rhyme/`, `root-analytics/`,
`discursive-pivots.json`, `formula-summary.json`, `formulas-root.json`,
`formulas-surface.json`, `numbers.json`, `rhetorical-features.json`,
`rhyme-summary.json`, `roots-index.json`, `roots-list.json`,
`surah-profiles.json`, `symmetry-test.json`, `theme-surah-index.json`,
`themes.json`, `word-index.json`. Each generator script under
`scripts/` names its inputs in its header. Two of these additionally
draw on other inputs: `data/coverage/report.json` includes file-count
measurements of the license-pending `data/qursim/` directory (counts
only, no Mishkat content), and `data/exports/` republishes
Leeds-derived tables as downloadable CSV/JSON under the GPL, as stated
on the export page.

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
