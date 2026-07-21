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

## Site-authored data

The following files in `data/` are authored or computed by this project
and carry the repository's MIT license (their *inputs* keep their own
licenses, listed above): `case-studies.json`, `exercises.json`,
`numbers.json`, `paths.json`, `rhetorical-features.json`,
`root-analytics/`, `cooccurrence/`, `roots-index.json`,
`surah-names.json`, `surah-profiles.json`, `themes.json`,
`videos.json`, `word-index.json`, `sources.json`. Files derived from
the GPL Leeds morphology (`root-analytics/`, `cooccurrence/`,
`roots-index.json`, `word-index.json`, `numbers.json`,
`surah-profiles.json`, `themes.json`, `rhetorical-features.json`)
inherit the GPL for their data content.

## Other sources

See `sources.html` for the full citation list of datasets, translations,
and scholarly works referenced by this site.
