# Contributing a structural hypothesis

This site's whole method is: order the evidence, let the reader draw the
conclusion. That applies to contributions too. This page is for submitting
your own proposed sectional/structural reading of a surah — especially one
of the 84 surahs Dr. Khan never published an outline for (his 2013 book,
*An Exercise in Understanding the Qur'an*, covers only surahs 85–114).

If you just want to try this on the live site first without opening a PR,
use the [discovery worksheet](https://divinediscourses.org/read)
on the Read page — it saves privately in your own browser and exports to
Markdown, which you can paste into a submission.

## What a submission is, and isn't

- It is **your own reading**, built from this site's bundled open data
  (root frequencies, co-occurrence, the `discursive-pivots.json` boundary
  markers, the `symmetry-test.json` proxy) or from a real, page-cited
  published source.
- It is **not** a reproduction of Dr. Khan's, Islahi's, or any other
  living/copyrighted scholar's published outline. Do not paraphrase or
  summarize a copyrighted outline and submit it as your own reading —
  see [NOTICE.md](NOTICE.md) for what's already licensed in.
- It is **not** presented as settled. Every submission is merged with a
  ○ Pending or ~ Nuanced badge, never ● Verified — "Verified" on this site
  means computed from a cited primary source, and a structural hypothesis
  is an interpretation, not a computation.
- It is **your reading, not a tool's**. Software assistance may help locate a
  candidate source, check code, or flag unclear prose, and that use must be
  disclosed in the PR. It may not originate the proposed theme, sectional
  divisions, interpretation, translation, root meaning, citation, or scholarly
  attribution. Rewrite from your own reading of the source; assistant output
  is never submitted as authoritative content.

## Submission template

Open a PR (or a "New structural hypothesis submission" issue if you'd
rather discuss it first) with:

```
Surah: [number and name]
Proposed theme: [one or two sentences]
Sectional divisions:
  - [verse range]: [what this section is doing]
  - [verse range]: [what this section is doing]
  ...
Supporting evidence: [which roots/frequencies/boundary markers you looked
  at, and what you found — link to the relevant roots.html/patterns.html
  page where possible]
Cross-references: [related verses elsewhere, if any — cite Mishkat or your
  own reading]
Confidence: [draft / tentative / confident — your own rating]
License: [CC0 or CC-BY — your choice; state which]
```

## The other thing this project needs: translators

Structural readings are the main ask, but not the only one. The site now
carries Qur'an translations in seven languages while every word of its own
interface and explanatory prose is English. That gap is deliberate rather
than neglected: this project does not machine-translate its own text, and
it does not let an assistant originate a translation (see
[docs/maintainer-guide.md](docs/maintainer-guide.md) §1, rule 3). Interface
text arrives the same way a structural reading does — from a named person
who takes responsibility for it.

The first concrete piece is a short orientation note for native Arabic
readers, explaining what the computed layers offer someone who does not
need a translation. The exact English source text is specified in
[docs/global-reach-plan.md](docs/global-reach-plan.md) §2.1 — a translator
renders that paragraph and nothing more; it is orientation copy, not
interpretation of the Qur'an, and it must not acquire commentary in
translation. Translators are credited by name on the Credits page.

If you would like to take it — for Arabic or for any of the site's
translation languages (Bengali, Malay, Indonesian, French, Spanish, Urdu)
— open an issue saying which language and how you would like to be
credited.

## License

Pick either **CC0** (public domain dedication) or **CC-BY** (attribution
required) for your submitted text, and say which in your PR. Everything
else in this repository not covered by a third-party license (see
[NOTICE.md](NOTICE.md)) is MIT-licensed; your structural-hypothesis text is
the one kind of contribution where you keep an explicit choice, since it's
your own interpretive work, not a mechanical computation.

## Review checklist

Before a submission is merged, it needs to pass:

1. **No copyright reproduction.** Nothing paraphrased from Khan's,
   Islahi's, or any other actively-copyrighted secondary work beyond a
   short (<15-word) fair-use quote with full citation.
2. **No tool-originated conclusions.** Candidate boundaries, themes,
   translations, glosses, citations, and interpretations originated by
   software assistance are not publishable. Deterministic outputs from
   repository scripts may be published only with their named inputs, method,
   and limitations.
3. **A verification label on every claim.** ● / ○ / ~ — never left
   implicit. A structural hypothesis is Pending or Nuanced by definition,
   not Verified.
4. **Recomputable from open sources.** Either the bundled Tanzil/Leeds/
   Mishkat data, or a newly-added source with documented rights status —
   never invented figures.
5. **No new tracking, analytics, backend, or paywall logic.** This stays a
   static site with client-only persistence.
6. `node scripts/verify-site.mjs` and `node scripts/build-csp.mjs --check`
   both pass.

## Worked example (not an authoritative outline)

Surah 112, al-Ikhlas, is four verses — short enough to check by hand
against the bundled morphology (`data/morphology/112.json`) rather than
just asserted:

| Verse | Text (root gloss) | Roots present |
|---|---|---|
| 1 | *Say: He is God, the One* | q-w-l (say), a-l-h (God), a-H-d (one) |
| 2 | *God, the Eternal Refuge* | a-l-h (God), S-m-d (eternal/self-sufficient) |
| 3 | *He begets not, nor is He begotten* | w-l-d (beget) — twice, active then passive |
| 4 | *Nor is there to Him any equivalent, one* | k-w-n (be), k-f-A (equivalent), a-H-d (one) |

Two mechanically checkable observations follow directly from this table,
with nothing added:

- **a-H-d (one)** is the last root-bearing word of both verse 1 and verse
  4 — the surah opens and closes on the same root, an envelope pattern.
- **w-l-d (beget)** occurs twice within verse 3 alone, in its active and
  passive forms back to back — a repetition internal to a single verse.

That's it — this is a candidate signal, unverified, not a finished outline,
and not attributed to any named scholar's reading. A submission built the
same way — from a table anyone can reproduce from the bundled data, plus
your own stated interpretation of what the pattern suggests about the
surah's structure — is exactly the shape this process is for.
