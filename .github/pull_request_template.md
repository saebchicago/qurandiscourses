<!-- Thanks for contributing. The checklist mirrors the checks CI will
     run; going through it first usually saves a round trip. -->

## What this changes

<!-- One or two sentences. If it closes an issue, say "Closes #NN". -->

## Kind of change

- [ ] Correction (wrong figure, broken link, typo in site-authored copy)
- [ ] Content (new claim, glossary term, exercise, outline, translation)
- [ ] Code (pages, scripts, styles)
- [ ] Data pipeline (a `scripts/build-*` or `compute-*` generator)

## Checklist

- [ ] I did not edit quoted scholarly text (Khan, Mir, Farahi, Islahi,
      Leeds glosses); it is byte-frozen, including punctuation.
- [ ] I did not hand-edit generated artifacts (`netlify.toml` CSP
      hashes, `assets/glossary.js`, `data/citations.bib`,
      `assets/version.js`, the marker regions in pages); I edited the
      source and re-ran the generator.
- [ ] New claims carry sources that exist in `data/sources.json`, and
      new data files are mentioned in `NOTICE.md`.
- [ ] I ran the relevant checkers locally (see
      `docs/maintainer-guide.md` section 6), or I am fine with CI
      telling me.
- [ ] Any generator I touched was run twice and `git diff` was empty
      the second time.

## For structural-hypothesis submissions

Use the issue template instead of a pull request; outlines go through
review before they become site content. See CONTRIBUTING.md.
