# Global reach plan

How Divine Discourses grows toward native Arabic speakers, new translation
languages (Bengali, Malay, Indonesian, French, Spanish), and audiences who
have never heard of it — without loosening the method that makes it worth
trusting. Written July 2026; cross-references `docs/maintainer-guide.md`
(the method and its rules) and `docs/engagement-research-plan.md` (how we
evaluate whether any of this works).

## 1. Purpose and constraints

Reach is only worth having if what spreads is the method. Four rules from
the maintainer guide §1 are therefore hard constraints on everything below:

1. Research claims expose evidence dimensions (`data/claims.json`), never
   an undifferentiated promise.
2. No generated commentary; editorial curation is always labeled. Anything
   presented as Khan's reading is transcribed verbatim from his published
   books, with a citation (the Transcription Gate).
3. AI output is never authoritative content. It may not originate a theme,
   structure, interpretation, **translation**, root meaning, citation, or
   scholarly attribution.
4. Reproduction has a precise scope.

The third rule settles the biggest question in this document before it is
asked: **machine-translating the site's editorial prose, Khan's outlines,
the word glosses, or the theme titles into any language is categorically
excluded.** Not deferred — excluded. Every expansion path below is designed
around that boundary: ship translations that named human translators
published, and ship computed layers that carry no language at all.

## 2. Native Arabic speakers

The pitch to an Arabic reader is the site's pitch inverted. Every other
audience needs a translation layer before the text opens up; an Arabic
reader does not. What they usually cannot get elsewhere is the rest of the
site: the computed, language-neutral layers —

- root families and their distribution across the corpus (Roots),
- verse-level co-occurrence and PMI partner rankings,
- recurring-phrase detection in two streams (Formulas),
- verse-ending rhyme families and regularity (Patterns),
- chronology and period distribution,
- the per-surah Dossier that gathers all of it in one place.

None of these depends on English to be useful; the English around them is
navigation chrome, not content. For an Arabic reader the site is already a
research instrument for the text they read natively — that is the value
proposition, and outreach material aimed at Arabic-speaking audiences
should lead with it.

**Shipped:** the Ask box routes Arabic-script surah names — `الفاتحة`,
`سورة يس`, `فاتحة` (article dropped), names typed with tashkeel, and
Arabic-Indic verse references like `٢:٥` — via the same deterministic
character mapping the box uses for transliteration. No model involved
(`assets/ask.js`).

**Shipped: Arabic-script root entry.** The root is an Arabic reader's
natural way into the corpus, so `رحم`, `ر ح م`, and `رَحِمَ` now route to
the Roots page, which resolves the letters against `rootArabic` and
selects the root directly. `roots.html`'s live filter compares skeletons
too, so `سمو` matches the stored `س م و`. All 1,642 root skeletons are
unique, so an exact match is never ambiguous. Ordering matters and is
asserted in the routing tests: `نوح` and `فجر` are each three Arabic
letters *and* plausible roots, and the surah wins — the same precedence
the Latin path already gives `fajr`.

### 2.1 Arabic orientation note — specified, awaiting a translator

The one thing an Arabic reader still meets in English is the explanation
of *why* these tools exist. That note should be written, but under §1's
third rule this project does not author it: interface and editorial prose
in any language comes from a named human translator, credited like any
other contributor.

- **Home:** a new `how-it-works.html#arabic-readers` section, linked from
  the Arabic-script routing hint in the Ask box help text.
- **Source text to translate** (English, final — a translator renders this
  and nothing more): *"If you read Arabic, you do not need this site's
  translations. What it offers you is the text's structure made countable:
  every root and where it recurs, which words keep company with which,
  the phrases that repeat across surahs, the rhyme families that close
  verses, and the order in which surahs were revealed. Each figure is
  computed from a named corpus and carries a badge showing what has been
  verified and what has not. The site does not tell you what a verse
  means; it shows you what is there, and leaves the reading to you."*
- **Requirement:** a named translator, credited on `credits.html`. Until
  one supplies it, the section does not ship — an untranslated placeholder
  is worse than its absence. See `CONTRIBUTING.md` for the call.

**Settled: no tafsir edition.** The question was whether an Arabic edition
such as Tafsīr al-Muyassar should join the Translations panel for Arabic
readers wanting a modern-Arabic paraphrase alongside the Uthmani text. It
would be useful, and it is a tafsir, not a translation — listing it under
"Translations" would blur exactly the line this site's method draws between
text and interpretation, and no labeling scheme removes the ambiguity
entirely once it sits in that list. Decision (owner, July 2026): **leave it
out.** The Translations panel stays strictly translations; the site carries
no commentary surface. Revisit only as a deliberately separate, differently
named surface — never as an entry in the translation list.

**Deferred:** Arabic UI chrome (navigation, buttons, explanatory prose in
Arabic). See §4 — the same reasoning applies to every interface language,
Arabic included.

## 3. Translation-language expansion

**Shipped with this plan:** six editions in five new languages, all
published human translations served by the existing alquran.cloud API:

| Language | Edition id | Translator |
| --- | --- | --- |
| Bengali | `bn.bengali` | Muhiuddin Khan |
| Bengali | `bn.hoque` | Zohurul Hoque |
| Malay | `ms.basmeih` | Abdullah Muhammad Basmeih |
| Indonesian | `id.indonesian` | Kementerian Agama |
| French | `fr.hamidullah` | Muhammad Hamidullah |
| Spanish | `es.cortes` | Julio Cortés |

(Indonesian is included alongside Malay: the audiences overlap and the API
carries the official Kementerian Agama text.)

The architecture made this nearly free, by design: the reader page takes
each edition's direction and language from the API's own edition object
rather than a hardcoded list, so any script renders correctly without code
changes. The full recipe for adding a language, now and in the future:

1. Append the edition to `TRANSLATIONS` in `assets/app.js` (keep the
   two-space formatting — `scripts/check-editions.mjs` parses the literal).
2. Add the language's display name to `LANG_LABELS` in `read.html`
   (regenerate CSP hashes: `node scripts/build-csp.mjs`).
3. Non-Latin scripts only: a self-hosted woff2 subset in `assets/fonts/`,
   an `@font-face` in `assets/fonts.css`, and a `.verse .translation
   .text.<class>` rule in `assets/style.css` with a line-height suited to
   the script — the Urdu Nastaliq rule is the model. Bengali ships with
   this plan (Noto Serif Bengali, OFL, Bengali-block subset). Latin-script
   languages need nothing.
4. Run `node scripts/check-editions.mjs` from an unrestricted connection.

Step 4 is not optional. alquran.cloud silently substitutes the Arabic
`quran-simple` text for edition ids it no longer serves — this is exactly
how the `en.haleem` bug once shipped Arabic mislabeled as an English
translation. The weekly `external-evidence` CI job runs the same check as
a standing safety net.

What expansion deliberately does **not** include: translating the site
around the translations. A Bengali reader gets Bengali *Qur'an text* in an
English interface. That is the honest version of the product today, and it
is more respectful of Bengali readers than a machine-translated interface
would be (§1, rule 3).

## 4. Interface localization: deferred, and why

Full localization — per-language pages, routing, `hreflang`, a language
switcher — is deferred, not because it lacks value but because every
currently available path fails a constraint:

- **Per-locale page forks** multiply every integrity-guarded surface (28
  pages, sitemap parity, nav-sync, per-page CSP hash blocks) by the number
  of locales, as hand-maintained HTML with no translation source we are
  permitted to use (§1, rule 3 excludes machine translation; no named
  human translators have volunteered).
- **A build step / i18n framework** contradicts the zero-build
  architecture the maintainer guide treats as a feature ("no build step;
  deploy = push"), and would be adopted to serve content we do not have.
- **Client-side dictionary swap** is the eventual path if demand proves
  out: the ~100 strings of navigation chrome (menu labels, button text,
  settings) sourced from **named human contributors** — credited the same
  way the README solicits contributor structural readings — stored as
  `data/i18n/<lang>.json` with a `check-i18n.mjs` guard for key parity.
  Worth building only after translation editions demonstrate sustained
  non-English readership.

Sequencing, in other words: translations first (shipped, §3), evidence of
demand second (the engagement research plan's instruments), chrome
localization third, and only with human translators. Recorded as a
deliberate deferral in maintainer-guide §8.

## 5. Demo videos: production runbook

The six walkthrough videos are already scripted (`docs/video-scripts/`)
and registered (`data/videos.json`, all `status: "planned"`). The registry
header states the standard: every video is a real screen recording of the
live site with a human voice — no generated footage, no stock music,
captions always. What remains is production, which requires the owner's
screen and voice:

1. **Record** the live site at 1280×800, cursor visible, dwelling ~2× on
   badge clicks and popovers (OBS or the OS recorder). Follow the shot
   list in the video's script file.
2. **Narrate** per the script — the scripts are written to be read aloud.
3. **Encode**: `ffmpeg -i in.mov -c:v libx264 -crf 23 -preset slow
   -vf scale=1280:-2 -c:a aac -b:a 128k out.mp4`, targeting ≤ 25 MB.
4. **Captions**: author the `.vtt` from the script text (near-verbatim, so
   this is minutes, not hours). First line must be `WEBVTT` —
   `scripts/check-videos.mjs` enforces it.
5. **Poster**: export the first meaningful frame as a jpg.
6. Commit mp4 + vtt + poster under `assets/video/`, flip the entry's
   `status` to `"published"`, run `node scripts/check-videos.mjs`.

Hosting is already solved: `media-src 'self'` in every CSP block covers
self-hosted video, so nothing in `netlify.toml` changes.

**Production order:** `trust-in-90s` first — it is the differentiation
video, and the one to link from README, About, and outreach. Then
`find-your-theme` (the strongest first-job hook), then the three short
clips (`browse-by-juz`, `pin-your-workspace`, `roots-across-time`), then
`train-your-eye`.

**Multilingual captions** are the cheapest future language surface the
site has (captions for a 90-second video are a page of text a human
translator can review in one sitting). Deferred until the English videos
exist; requires widening the registry's `captions` field to an array with
per-track `srclang`, a `<track>` loop in `watch.html`, and a
`check-videos.mjs` update.

## 6. Non-video resources

- **"How this compares to other Qur'an tools"** — shipped with this plan
  as a section on the How It Works page (`how-it-works.html#different`).
  It states the site's design policies (no generated commentary, no AI
  answers, provenance badges, no accounts) as differences a reader can
  weigh, not as verdicts on other tools. This anchor is the link to use
  in outreach when someone asks "how is this different?".
- **The embed page** (`embed.html`, the one page served with
  `frame-ancestors *`) is the shareable artifact for partners — a teacher
  or site can embed a passage without the reader leaving their page.
- **Deferred:** a printable one-pager. The `#different` section covers the
  need at zero new-page cost (every new page adds sitemap, nav-sync, and
  CSP surface); revisit if outreach shows a genuine print use case.

## 7. Sequencing and verification

Shipped together in this change: §2's Ask-box Arabic routing, §3's six
editions and the Bengali font, §6's comparison section, the service-worker
version bump, and regenerated CSP hashes.

Verification checklist for this change and any future language addition:

- `node scripts/check-editions.mjs` — from an unrestricted connection, or
  dispatch the `external-evidence` CI job; every registered id must return
  its own identity.
- `node scripts/build-csp.mjs --check` and `node
  scripts/check-headers-sync.mjs` — CSP hashes match every inline script.
- `node scripts/verify-site.mjs`, `node scripts/check-nav-sync.mjs` —
  page/sitemap/nav parity.
- Manual: the Choose Translations modal groups the new languages; a
  Bengali edition renders in the subset font with intact conjuncts; the
  Ask box routes `الفاتحة` and `سورة يس`.

Non-goals, restated once: machine-translated content of any kind (§1);
tafsir presented as translation (§2, pending the owner's decision);
interface forks per locale (§4); generated or stock video footage (§5).
