# Discourses — qurandiscourses

A Qur'an study platform built in memory of Dr. Irfan Ahmad Khan (1931–2018),
directed at one goal: **direct, personal, evidence-based engagement with the
Qur'an**, in the coherence-reading tradition Khan taught.

Live site: https://qurandiscourse.netlify.app/

## What makes it different

1. **Every factual claim carries a verification badge** — Verified (●),
   Pending (○), or Nuanced (~). Clicking a badge opens the full
   Chicago-style citation of its source. The method is documented on
   [Validation](https://qurandiscourse.netlify.app/validation.html).
2. **The data ships with the site.** Word-by-word morphology for all
   77,430 tokens (Leeds Quranic Arabic Corpus v0.4, GPL — see
   [NOTICE.md](NOTICE.md)) is bundled as JSON, so root counts, theme
   passages, and exercises are recomputable by anyone, offline.
3. **No interpretation is generated.** The site orders evidence (roots,
   frequencies, structure, cross-references) and points to published
   scholarship; the reader does the engagement.

## Architecture

Static site, no framework, no build step for pages, no external runtime
dependencies (fonts self-hosted; the only network calls are the optional
alquran.cloud verse/translation API and recitation audio).

```
*.html               21 pages, vanilla HTML + inline page logic
assets/              shared JS (app, nav, ask, cite-badge, glossary),
                     CSS (3 palettes x light/dark), self-hosted fonts
data/                bundled datasets: morphology/ (per-surah tokens),
                     roots-summary, root-analytics/, cooccurrence/,
                     themes, surah profiles, sources registry
scripts/             deterministic, zero-dependency Node generators
                     that produce data/ artifacts from the morphology
netlify.toml         hosting config + security headers (CSP etc.)
```

## Working on the site

```bash
python3 -m http.server 8000        # serve locally, open localhost:8000
node scripts/build-themes.mjs      # regenerate data/themes.json
node scripts/build-cooccurrence.mjs
node scripts/build-root-analytics.mjs
```

Read **[docs/maintainer-guide.md](docs/maintainer-guide.md)** before making
content changes — it covers the editorial rules (what may be claimed, how
badges are assigned, Chicago citation format), every build script, and the
step-by-step recipes for common tasks (adding a source, an exercise, a
theme). A ready-to-record walkthrough script for a training video is in
**[docs/video-walkthrough-script.md](docs/video-walkthrough-script.md)**.

## Licensing

- Site code (HTML/CSS/JS): [MIT](LICENSE)
- `data/morphology/` and derivatives: GPL, per the Leeds corpus — see
  [NOTICE.md](NOTICE.md)
- Full source list with citations:
  [Sources](https://qurandiscourse.netlify.app/sources.html)

Corrections, citations, and source contributions are welcome via issues
and pull requests.
