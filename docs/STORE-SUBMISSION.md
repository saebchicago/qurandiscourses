# App store submission plan

Status: Phase 0 assets in `store/`; `/privacy` redirect added. No native build exists yet.
Labels: **verified** = checked in this repo; **to verify** = from general knowledge, confirm against current store docs before submitting.

## Gate 0: rights (blocks both stores)

`docs/RIGHTS-REGISTER.md` (verified) lists terms as unresolved for: translation editions (row 3), recitation audio (rows 8-9), Khan glosses and excerpts (rows 5-6), alquran.cloud and Islamic Network service terms (rows 2, 15). Store distribution is wider redistribution than a website. Before submitting:

1. Obtain written permission or switch source for audio (rows 8-9) and per-edition translation caching (row 3), or ship the app with those features off or online-only.
2. Quran Foundation credentialed proxy (PR #159) provisioned; production still calls the legacy route (row 4).
3. GPL (Leeds morphology, row 7): confirm with counsel that bundling in a store binary is acceptable. Apple's terms and GPL have a known conflict for third-party GPL code; this is a lawyer question, not an engineering one.

## Shared assets (done, in `store/`)

| File | Use |
|---|---|
| `store/icon-1024.png` | App Store icon (1024, opaque, no alpha). Also usable as Play 512 source. |
| `store/android/*.png` (1080x1920) | Play phone screenshots (4 of 2-8 allowed). |
| `store/ios-6.9in/*.png` (1320x2868) | App Store 6.9" iPhone screenshots (to verify current required sizes in App Store Connect). |

Gaps: Play feature graphic (1024x500), tablet screenshots if targeting tablets, a Read-page screenshot with translations loaded (the capture sandbox could not reach api.alquran.cloud, so the Read shot was dropped rather than show an error banner). Retake on a networked device.

Privacy policy URL: `https://divinediscourses.org/privacy` (301 to `/about#privacy`). If a store reviewer rejects a fragment redirect, promote it to a standalone page.

## Listing copy (draft, edit freely)

- Name: Divine Discourses
- Subtitle / short description (30 / 80 chars): "Study the Qur'an by structure" / "Read each surah as one discourse. Every claim sourced and citable."
- Category: Education (Books & Reference as alternative). Age rating: expect 4+/Everyone; answer questionnaires honestly (no UGC chat, no purchases, no ads).
- Support URL: https://divinediscourses.org/about
- Claims rule: keep store text to what the site's claim registry labels as verified.

## Data disclosures (derived from `/about#privacy` and `assets/ga-init.js`, verified)

- Collected: page-view analytics via Google Analytics 4 (page address without query/fragment, referrer without query, IP and browser headers as part of any request). No names, notes, search text. Google Signals and ad personalization off. Opt-out in About; Global Privacy Control honored.
- Not collected: accounts, location, contacts, purchases, advertising ID use.
- Stored on device only: preferences, progress, notes, worksheets, cache.
- Third parties contacted: api.alquran.cloud, Quran Foundation (word-by-word), cdn.islamic.network (audio), googletagmanager.com / google-analytics.com.
- Play Data safety: declare "App activity" (page views) and "Device or other IDs" (GA cookie/client ID) as collected for Analytics, not shared for advertising; data encrypted in transit; no deletion-request mechanism for server data beyond opt-out (to verify wording). To simplify the form, consider disabling GA4 inside the app builds.
- App Store privacy label: "Usage Data > Product Interaction" and "Identifiers" for Analytics, not linked to identity, no tracking (to verify against how GA4 is configured in the wrapper; if GA is off in-app, answer Data Not Collected).

## Android (Phase 1, TWA)

1. Easiest path: pwabuilder.com, enter `https://divinediscourses.org`, generate the Android package (signed AAB). Alternative: Bubblewrap CLI (needs JDK and Android SDK).
2. Use Play App Signing. Upload key stays with the owner; never commit keystores.
3. Create the app in Play Console, upload the AAB to Internal testing.
4. Digital Asset Links: Play Console > Setup > App signing shows the app signing SHA-256. Add `/.well-known/assetlinks.json` with that fingerprint and the package id, plus a `Content-Type: application/json` header rule in `netlify.toml`, then run `node scripts/build-csp.mjs` and `node scripts/check-headers-sync.mjs`. Not committed yet because the fingerprint does not exist until the app is created; no placeholder is shipped.
5. Verify the TWA opens without a browser URL bar on a real device.
6. New personal accounts may require closed testing with a minimum number of testers for a set period before production access (to verify current rule); organization accounts differ.
7. Complete Data safety, content rating, target audience, and the policy URL; submit.

## iOS (Phase 2, Capacitor)

1. Capacitor project that bundles the static site (offline-capable) instead of loading the remote URL. Needs a Mac with Xcode or a cloud Mac CI.
2. Guideline 4.2 (minimum functionality) is the main rejection risk for web wrappers. Add native value: daily-discourse local notification, native share sheet, background audio, haptics. Keep each small.
3. App Review notes: scholarly study tool, no login, no purchases, sources and corrections public, privacy policy URL, reviewer can test fully offline for text.
4. TestFlight first, then submit.
5. Update the site CSP and `scripts/build-csp.mjs` hosts if the wrapper uses a custom scheme/origin (to verify at build time).

## Release checklist

- [ ] Gate 0 rights items resolved or features gated
- [ ] Offline pass in airplane mode on both platforms (Arabic text, notes, preferences work; online-only features show the existing fallback message)
- [ ] Playwright pass on `/`, `/read`, `/navigate` inside the wrapper
- [ ] Privacy URL loads; data forms match this document
- [ ] Screenshots retaken with translations loaded
- [ ] Keystores and Apple credentials stored outside the repo
