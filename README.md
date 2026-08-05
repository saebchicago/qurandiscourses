# Divine Discourses — qurandiscourses

A Qur'an study platform directed at one goal: **direct, personal,
evidence-based engagement with the Qur'an**, using a coherence-based reading
method — read each surah as one discourse, not a string of isolated
quotations. Maintained in memory of Dr. Irfan Ahmad Khan (1931–2018), whose
teaching the method follows; see [About](https://divinediscourses.org/about)
for the fuller story.

It exists so that anyone — an independent student, a teacher, a skeptical
reader — can test the coherence of a discourse for themselves instead of
taking assertions on trust. What the project needs is careful work, not
money: corrections (via issues — every one is logged publicly), help
transcribing Khan's remaining published outlines into exercises, scholarly
review of the method pages against their sources, and — for the 84 surahs
Khan never published an outline for — your own structural readings; see
[CONTRIBUTING.md](CONTRIBUTING.md).

Live site: https://divinediscourses.org

## What makes it different

1. **Research claims expose their evidence status.** A compact ●/○/~ marker
   opens the cited source, while canonical records separately state whether
   the source was checked, a computation was reproduced, the result is
   method-dependent, and which limitations remain. The machine-readable
   ledger is `data/claims.json`; its integrity gate is
   `node scripts/check-claims.mjs`. The reader-facing method is documented on
   [Validation](https://divinediscourses.org/validation).
2. **The data ships with the site.** Word-by-word morphology for all
   77,429 tokens (Leeds Quranic Arabic Corpus v0.4, GPL — see
   [NOTICE.md](NOTICE.md)) is bundled as JSON, so root counts, theme
   passages, and exercises are recomputable by anyone, offline.
3. **No commentary is generated.** The site orders evidence (roots,
   frequencies, structure, cross-references) and points to published
   scholarship; the reader does the engagement. Where curation is
   unavoidable — theme groupings and titles, short working glosses — it
   is labeled as editorial (Nuanced), never presented as computed data.

## Architecture

Static site, no framework, no build step for pages, no external runtime
dependencies (fonts self-hosted; the only network calls are the optional
alquran.cloud verse/translation API and recitation audio).

```
*.html               33 pages, vanilla HTML + inline page logic
assets/              shared JS (app, nav, ask, cite-badge, glossary,
                     chart), CSS (3 palettes x light/dark), fonts
js/                  viz.js, the shared zero-dependency SVG chart
                     helpers used by the analytics pages
data/                bundled datasets: morphology/ (per-surah tokens),
                     roots-summary, root-analytics/, cooccurrence/,
                     association/ (PMI/LLR/Dice pair statistics),
                     network/ (precomputed graph layouts), centrality/,
                     coverage/, exports/ (public CSV/JSON downloads),
                     gloss/, qursim/ (cross-references), rhyme/,
                     themes, surah profiles, sources registry
scripts/             deterministic, zero-dependency Node generators
                     that produce data/ artifacts from the morphology
                     (one Python helper, build-roots-index.py)
netlify.toml         hosting config: security headers (CSP etc.) and
                     the .html -> clean-URL redirects
```

## Working on the site

```bash
node scripts/serve.mjs             # serve locally, open localhost:8000
                                   # (resolves /read the way Netlify does;
                                   #  python3 -m http.server cannot)
node scripts/build-themes.mjs      # regenerate data/themes.json
node scripts/build-cooccurrence.mjs
node scripts/build-root-analytics.mjs
node scripts/compute-association-stats.mjs   # data/association/
node scripts/compute-network-layout.mjs      # data/network/ (needs association/)
node scripts/compute-centrality.mjs          # data/centrality/ (needs association/)
node scripts/compute-coverage.mjs            # data/coverage/
node scripts/build-exports.mjs               # data/exports/ (needs association/)
```

Every generator is deterministic: run it twice and `git diff` must be
empty. The full pipeline, in dependency order, is documented in
[docs/maintainer-guide.md](docs/maintainer-guide.md).

Read **[docs/maintainer-guide.md](docs/maintainer-guide.md)** before making
content changes — it covers the editorial rules (what may be claimed, how
badges are assigned, Chicago citation format), every build script, and the
step-by-step recipes for common tasks (adding a source, an exercise, a
theme). A ready-to-record walkthrough script for a training video is in
**[docs/video-walkthrough-script.md](docs/video-walkthrough-script.md)**.
The prioritized cross-disciplinary roadmap for accessibility, scholarship,
governance, privacy, learning, reach, and operational resilience is in the
**[public-engagement and excellence review](docs/multidisciplinary-excellence-review.md)**.

## Licensing

- Site code (HTML/CSS/JS/scripts): [MIT](LICENSE)
- `data/morphology/` and derivatives (including `data/association/`,
  `data/network/`, `data/centrality/`, `data/coverage/`,
  `data/exports/`): GPL, per the Leeds corpus — see
  [NOTICE.md](NOTICE.md)
- Tanzil verse text and the translation editions: fetched at runtime,
  never bundled; Tanzil is CC BY-ND 3.0, translations keep their own
  copyrights — see NOTICE.md
- `data/qursim/` cross-references (Mishkat corpus): no license
  published upstream; recorded as license-pending — see NOTICE.md
- `data/gloss/` and `data/khan-interpretations.json`: quoted from
  Khan (2011), © Association for Qur'anic Understanding — see NOTICE.md
- `assets/fonts/`: SIL Open Font License 1.1, license texts bundled
  beside the binaries
- Full source list with citations:
  [Sources](https://divinediscourses.org/sources)

Corrections, citations, and source contributions are welcome via issues
and pull requests.
