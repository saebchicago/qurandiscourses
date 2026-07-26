# Changes — research-led home and claim provenance

## Evidence status is now multidimensional

- Added a canonical, versioned claim ledger (`data/claims.json`) for every
  worked verification example. Records distinguish source inspection,
  computational reproduction, corpus/method/classification dependency,
  interpretive status, AI involvement, derivation, and known limits.
- Added `scripts/check-claims.mjs` to reject missing or duplicate claim IDs,
  unknown source references, invalid statuses, missing limitations, nonexistent
  derivation artifacts, case-study drift, and AI-assisted interpretive content.
- Updated worked examples to render evidence chips and expandable claim records
  rather than asking one “Verified” marker to carry several different meanings.
- Tightened the contribution and validation guidance: assistant output may help
  locate candidate material but never becomes an authoritative interpretation,
  citation, translation, gloss, or scholarly attribution.

## The home page now begins with the research workflow

- Replaced the feature-directory opening with a clear reading proposition, a
  primary “Open a surah” action, and a scoped search for surahs, verses, roots,
  and keywords.
- Added a four-part research commitment strip: no generated commentary,
  recomputable evidence, visible limitations, and local-only reader work.
- Consolidated eleven equal-weight destination tiles into four outcome-led
  routes: read a discourse, follow a question, test a pattern, or audit a claim.
- Added responsive, reduced-motion-compatible visual components and expanded
  visible keyboard focus to textareas, summaries, and custom tabindex controls.

# Earlier changes — translation fix + Urdu support

## Landing & onboarding pass (report items U4–U9)

Each remaining report item was verified against the live code before
anything changed (three earlier claims in the same report had already
failed to reproduce).

**Shipped:**

- **One sequenced first-visit path (U6 + U4).** The welcome banner had
  three competing actions — a demanded depth question, a tour button, and
  a "new to the Qur'an?" link. It now leads with one plain sentence, then
  exactly two outcome-labeled choices ("New to the Qur'an? Start here" →
  the About page's no-background-assumed intro; "Take the 60-second
  tour"), and a demoted one-line note that you start in Simple and can go
  deeper anytime (gear or keys 1/2/3). The depth toggle is gone from the
  banner — it remains in the gear, the depth-cards section, and How to
  use. Clicking "Start here" also marks the banner as seen so it doesn't
  re-nag on return (`assets/tour.js`).
- **Plain language before jargon (U5).** Banner copy drops "workbench";
  "discourse" — the one core term in the site's own name with no
  definition wired — is now in `assets/glossary.js` (auto-wrapped for
  tap-definitions on every page, including the banner itself) and has a
  static entry on `glossary.html`. `surah`, `khitab`, `root`, and
  `coherence` were already auto-glossed.
- **Depth meaning at the point of choice (U7).** The gear panel's depth
  select now reads "Simple — just read / Scholar — study / Encyclopedic —
  verify," the same microcopy the depth cards and How-to-use teach.
- **Worksheet gated to Scholar+ (U9).** The discovery worksheet rendered
  its full structural-hypothesis form at Simple depth, contradicting the
  site's own "Simple = the reading layer" contract. It now carries the
  existing `scholar-only` class: hidden at Simple, appears live the
  moment the reader steps up to Scholar or Encyclopedic (verified with
  key-2 switch, no reload). The lightweight notes card stays at all
  depths — the reader's own record is central to the method.

**Verified, not a defect (no change):**

- **U8 "6 of 9 inputs lack explicit programmatic labels"** — audited
  every static `<input>/<select>/<textarea>` across all pages: the six
  flagged inputs are each wrapped in a `<label>` element, which is a
  valid programmatic association. No accessibility gap.

**Deliberately not done:**

- Scroll-triggered progressive reveal of the Begin grid — gimmicky,
  layout-shift risk; the grid is already grouped into three labeled
  outcome clusters.
- Nav restructuring — the 21 links are already collapsed behind four
  group buttons; the nav was not the overload source, the banner was.
- Adding explicit `for=` attributes to the six wrapped-label inputs —
  already programmatically labeled; churn without benefit.

## Follow-up (consolidated UX & technical report)

A follow-up report reiterated the `en.haleem` fix and Urdu support below
(both already shipped) and added three concrete asks, resolved here:

- **Reduced default translations from 5 to 2** (`assets/app.js`): only
  `en.sahih` (Saheeh International) and `en.yusufali` (Yusuf Ali) —
  the report's own "trusted standard" pairing — now carry `default:
  true`. `en.pickthall`, `en.maududi`, and `en.asad` stay fully
  selectable in the picker, just not pre-checked for new visitors. Note
  the report said "4 → 2"; the actual prior count was 5 (verified
  against the array), not 4.
- **Removed the Khattab "Clear Quran" citation entirely** (`data/
  sources.json`, `sources.html`) — the report's own investigation
  confirmed it's exclusively licensed (Furqaan Institute) and not on
  alquran.cloud under any ID; it also carried an over-claimed ● Verified
  badge despite never being rendered. If a license is obtained later
  (see theclearquran.org/copyright-information, QUL translation #426),
  it would need to be self-hosted as a local JSON edition, not fetched
  via alquran.cloud. `en.itani` (a genuinely different, already-free
  "Clear Qur'an" by Talal Itani) is untouched.
- **Fixed a real Escape-key bug in the welcome tour** (`assets/tour.js`):
  reproduced and confirmed via a fresh-browser-context test — with a nav
  dropdown open during the tour, pressing Escape closed both the
  dropdown and the entire tour in one press, because the tour's Escape
  listener runs on `document` with capture (so it always fires before
  the dropdown's own bubble-phase handler). Fixed by having the tour
  defer to an open dropdown as the topmost layer; a second Escape press
  (nothing else open) now closes the tour as expected.

**Two other claims in that report did not reproduce against the current
code, verified empirically rather than assumed either way:**
- "First-time visitors default to Encyclopedic depth" — a fresh
  browser context (`localStorage` genuinely empty) loads `read.html`
  with `data-depth="simple"`, matching `assets/app.js`'s `state.depth:
  "simple"` default. Most likely explanation: the report's own manual
  testing picked up leftover state from earlier exploration in the same
  browser session, which would make a prior manual "Encyclopedic" click
  look like "the default" on a later visit.
- "Tour won't advance past Step 1 of 5" — a scripted run through all 5
  steps via the Next button advanced cleanly every time
  (1→2→3→4→5→done). Not reproduced; no change made.

**Not touched in this pass** — the report's broader landing-page/
onboarding UX items (navigation density, jargon before definition,
merging the tour with the "new to the Qur'an?" page, depth-toggle
previews, a few unlabeled inputs, hiding the discovery worksheet in
Simple depth). These are legitimate P1–P3 findings but are design
decisions, not verifiable bugs — worth a dedicated pass with explicit
sign-off on the direction rather than a unilateral redesign bundled
into a translation-bug fix.

## Removed dead edition, added its replacement

`en.haleem` ("Abdel Haleem") was registered in `assets/app.js`'s
`TRANSLATIONS` array but does not exist on alquran.cloud — the API
silently substitutes its default Arabic edition (`quran-simple`) instead
of erroring, so a reader who picked "Abdel Haleem" was shown Arabic text
labeled as an English translation. Removed. This sandbox's outbound
network is proxy-blocked to `api.alquran.cloud` specifically (confirmed:
policy-level 403 on the CONNECT tunnel, not a code issue — the live site's
own users hit this API fine from their browsers), so the exact substitution
behavior is taken on trust from the task's own testing rather than
independently reproduced here; the guard below makes that trust
unnecessary going forward regardless.

Replacement: **`en.wahiduddin`** (Wahiduddin Khan) — the task's own
recommended default. Independently corroborated as a real alquran.cloud
edition ID across a dozen+ unrelated public repos that reference the same
identifier (Raycast's Quran extension, several Quran API wrapper libraries,
etc.), since this sandbox couldn't query the live catalog directly.

## Hardening: edition-mismatch guard

`qdFetchVerse`/`qdFetchSurah` (`assets/app.js`) now compare each returned
`edition.identifier` against the identifier that was actually requested,
by array position (the API returns editions in request order). A mismatch
— any future dead edition ID, not just this one — gets a non-enumerable
`_mismatchOf` marker instead of being silently trusted, plus a
`console.warn`. Every render path that consumes translation data was
updated to check for it and show a placeholder instead of the substituted
text:

- `read.html`'s main verse/translation renderer
- `read.html`'s cross-reference panel (`fetchXrefTranslations`) — a
  separate code path that also renders translation snippets and would
  otherwise have leaked the substitution independently of the fix above
  (caught by the test below, not anticipated up front)
- `assets/embed.js`'s embed-card renderer
- `compare.html`'s passage-comparison view, which picks the first
  available *valid* translation edition rather than assuming index 1 is
  trustworthy

`replay.js` only ever touches the Arabic (`quran-uthmani`) edition, so it
was unaffected.

### Test

`node scripts/check-editions.mjs` — maintainer-run live check (mirrors
`check-source-links.mjs`'s pattern): fetches all registered editions for
one verse and asserts each returned `edition.identifier` matches what was
requested. **Not runnable from this sandbox** (same proxy block); run it
from an unrestricted machine before merging.

A Playwright functional test (not committed — lives in this session's
scratchpad, matching this repo's established ad hoc-verification pattern)
exercised the guard against a fixture that deliberately simulates the
exact `en.haleem` failure mode (API substitutes a different edition than
requested) and confirmed: the main translation block shows a placeholder
and never renders the substituted text; the cross-reference panel and
console warning both behave correctly; Urdu renders with `dir="rtl"`,
`lang="ur"`, and the Nastaliq font; the language-grouped picker shows both
headers and a language chip; no horizontal overflow at 375px; zero CSP
violations.

## Urdu translations added

Registered in `assets/app.js`, none pre-selected by default (see note
below): `ur.jalandhry` (Fateh Muhammad Jalandhry), `ur.kanzuliman` (Ahmed
Raza Khan — Kanz-ul-Iman), `ur.maududi` (Abul A'la Maududi), plus
`ur.junagarhi`, `ur.qadri`, `ur.jawadi`, `ur.ahmedali`, `ur.najafi` as
additional opt-in options. All corroborated the same way as
`en.wahiduddin` above.

**Interpretation note on "ship by default":** the task asked to "ship
these three by default." I registered all three (and the five others) as
selectable in the picker, but did **not** mark any of them
`default: true` — that flag controls which translations a brand-new
visitor sees pre-checked, and setting it would mean every new reader,
regardless of language, gets 3 Urdu translations added to their initial
view alongside the 5 existing English defaults. That reads as an
unintended UX change rather than what was asked. If pre-selecting them for
everyone was actually the intent, that's a one-line flip per entry — flag
it and I'll make the change.

### RTL + Nastaliq rendering

Each translation's `dir`/`lang` attributes are now driven directly from
the API response's own `edition.direction`/`edition.language` fields, not
a hard-coded language list — a future RTL edition in any language renders
correctly with no code change. Urdu specifically (`language === "ur"`)
additionally gets a `nastaliq` class pulling in a self-hosted **Noto
Nastaliq Urdu** webfont (`assets/fonts/notonastaliqurdu-arabic.woff2`,
`assets/fonts.css`) at `line-height: 2.1` — Nastaliq's diagonal stacking
clips against the site's normal 1.6 line-height. The Qur'anic Arabic
ayah text is untouched — it keeps the existing Naskh-style Amiri face,
which is correct for Arabic but would read as wrong for Urdu.

### Picker

The "Choose Translations" modal (`read.html`) now groups entries under
"English"/"Urdu" headers with a small language chip per row, derived from
each entry's own `lang` field so a future third language groups itself
automatically.

## Sources

`sources.html`'s "Translations rendered on this site" list: removed the
Abdel Haleem citation (no longer rendered), added Wahiduddin Khan and all
8 Urdu translators. `data/sources.json` was **not** touched — individual
translator citations for API-rendered editions were never tracked there
(confirmed: none of the existing ~14 English translations have an entry
either, only the anomalous `the-clear-quran` one — see below), so the new
entries follow the same plain-bibliography convention as the existing
Pickthall/Yusuf Ali/etc. entries rather than introducing a new pattern.

## Open question: "The Clear Quran" — Khattab vs. Itani

Per the task's own stop instruction, **not implemented, flagging only.**

- `en.itani` (Talal Itani's "Clear Qur'an") is already shipping,
  unaffected by anything in this change.
- `data/sources.json`'s `the-clear-quran` entry cites Dr. Mustafa
  Khattab's *The Clear Quran* (Book of Signs Foundation, 2016, ISBN
  9780998539003) — confirmed still genuinely unavailable on
  alquran.cloud (zero Khattab-style edition found anywhere in the public
  repos cross-checked for this change either). It is in copyright;
  wiring it in would need a licensed data source and permission, not an
  API call.
- Additionally confirmed (not just suspected): that entry currently
  carries a **● Verified badge** on `sources.html`
  (`data-source-ids="the-clear-quran"`) despite the translation not
  actually being rendered anywhere on the site — exactly the over-claim
  the task flagged. Left as-is pending your answer on which "Clear Quran"
  you meant, since the fix (downgrade the badge vs. wire a licensed
  source) depends on that answer.

## Not touched

Word-by-word morphology/gloss tables (English-only by design, per the
task's scope guardrails); file permissions, sharing settings, credentials.
No new tracking, no new network domains — the guard and Urdu additions
only touch the existing `api.alquran.cloud` calls.
