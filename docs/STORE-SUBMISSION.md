# App store submission plan

Status: Phase 0 assets in `store/`; `/privacy` redirect added. No native build exists yet.
Labels: **verified** = checked in this repo; **to verify** = from general knowledge, confirm against current store docs before submitting.

## Gate 0: rights (blocks both stores)

`docs/RIGHTS-REGISTER.md` (verified) lists terms as unresolved for: translation editions (row 3), recitation audio (rows 8-9), Khan glosses and excerpts (rows 5-6), alquran.cloud and Islamic Network service terms (rows 2, 15). Store distribution is wider than a website.

**Decision (owner, 2026-10-12): ship the app with content online-only where no storage permission is on record.**

| Item | State | Basis |
|---|---|---|
| Translations (row 3) | In the app: fetched live and held in memory only. Not written to device storage, not included in "Save for offline" (which keeps the Arabic and word data). Website unchanged. | `assets/app.js` (`IN_APP` skips the `qd_apicache` write), `assets/read-polish.js` (no translation URL in-app). Verified in Playwright with a stubbed shell. |
| Recitation audio (rows 8-9) | Streamed only, never stored, on the website and in the app alike (unchanged). Rights holder and terms still unstated. | Same exposure as the website. Residual risk: a rights holder could object to app distribution. |
| GPL corpus data (row 7) | Not in the app binary. The app loads the live site (`server.url`); the bundle holds only a one-page connection fallback (`ios-app/www/index.html`). | Engineering reading of the build, verified by listing the bundled files; not legal advice. Counsel review is optional rather than blocking. |
| Khan glosses and excerpts (rows 5-6) | Shown as on the website, from the live site. | Unchanged; no written permission in the repo. |
| Word-by-word (row 4) | Production still calls the legacy unauthenticated route; the credentialed proxy is deployed but switched off. | Open. `node scripts/smoke-deployed.mjs` reports whether the proxy has its credentials. |

**App Store Connect "third-party content" question:** answer Yes (the app shows third-party text and audio). Whether to confirm "I have the necessary rights" is the owner's call, made from the table above; the browser-agent prompt stops and asks rather than answering it.

## Shared assets (done, in `store/`)

| File | Use |
|---|---|
| `store/icon-1024.png` | App Store icon (1024, opaque, no alpha). Also usable as Play 512 source. |
| `store/play-feature-graphic-1024x500.png` | Play feature graphic. |
| `store/android/*.png` (1080x1920) | Play phone screenshots (4 of 2-8 allowed). |
| `store/ios-6.9in/*.png` (1320x2868) | App Store 6.9" iPhone screenshots (to verify current required sizes in App Store Connect). |

Gaps: tablet screenshots if targeting tablets, a Read-page screenshot with translations loaded (the capture sandbox could not reach api.alquran.cloud, so the Read shot was dropped rather than show an error banner). Retake on a networked device.

Privacy policy URL: `https://divinediscourses.org/privacy` (301 to `/about#privacy`). If a store reviewer rejects a fragment redirect, promote it to a standalone page.

## Listing copy (draft, edit freely)

- Name: Divine Discourses
- Subtitle / short description (30 / 80 chars): "Study the Qur'an by structure" / "Read each surah as one discourse. Every claim sourced and citable."
- Category: Education (Books & Reference as alternative). Age rating: expect 4+/Everyone; answer questionnaires honestly (no UGC chat, no purchases, no ads).
- Support URL: https://divinediscourses.org/about
- Claims rule: keep store text to what the site's claim registry labels as verified.

## Data disclosures (derived from `/about#privacy` and `assets/ah-init.js`, verified)

**Decision (placeholder, owner may reverse): analytics are off in the app.** `assets/ah-init.js` (the site's own first-party analytics loader) sends and adds nothing when `window.Capacitor.isNativePlatform()` is true. The web site runs only the first-party analytics described on About (opt-out, Global Privacy Control and Do Not Track honored); it runs no Google analytics.

- App Store privacy label: **Data Not Collected** (the app contacts providers named below for content, not for tracking; confirm against Apple's definitions at submission).
- Play Data safety: no data collected or shared for analytics. Declare that content requests go to third parties without user identifiers beyond what any HTTPS request carries (IP address, to verify wording against Play's definition: IP-derived approximate location counts if collected, which is why analytics stay off in the app).
- If analytics are ever turned on in the app, declare what the first-party analytics records per About (page views, clicks, downloads, scroll depth, engaged time, error counts; a per-tab session id; no cookies, no stored IP address), purpose Analytics, not used for advertising.
- Stored on device only: preferences, progress, notes, worksheets, 30-day plan start date, cache. The app also writes a backup JSON to its Documents folder (never leaves the device unless the user enables iCloud/device backup).
- Third parties contacted by the app: api.alquran.cloud, Quran Foundation (word-by-word), cdn.islamic.network (audio).
- Not collected: accounts, contacts, purchases, advertising ID.

## Account status (from the owner's email, verified 2026-10-10)

- Apple Developer Program: individual membership purchased 2026-09-27 (auto-renew on). Paid Applications Agreement accepted. EU Digital Services Act trader contact verified (live in the EU). A different app (DecisionPlay) is already in TestFlight and has been through App Review with changes requested twice (2026-09-28, 2026-09-30); read its feedback in App Store Connect before submitting this one, since reviewers' notes carry over as a preview of what they check.
- Individual membership: the seller name shown on the App Store is the owner's personal name. An organization account (needs a D-U-N-S number) would show the organization instead.
- Apple Team ID: not in the email; find it at developer.apple.com > Membership details.
- Google Play Console: **no developer-account emails found.** Only consumer Google Play mail. Treat Android as not yet started: it needs a Play Console registration (about $25 one time, identity verification; to verify current terms), and a personal account may require closed testing with a minimum number of testers for a set period before production access (to verify current rule). Apple is the critical path.

## Android (Phase 1, TWA)

1. Easiest path: pwabuilder.com, enter `https://divinediscourses.org`, generate the Android package (signed AAB). Alternative: Bubblewrap CLI (needs JDK and Android SDK).
2. Use Play App Signing. Upload key stays with the owner; never commit keystores.
3. Create the app in Play Console, upload the AAB to Internal testing.
4. Digital Asset Links: Play Console > Setup > App signing shows the app signing SHA-256. Add `/.well-known/assetlinks.json` with that fingerprint and the package id, plus a `Content-Type: application/json` header rule in `netlify.toml`, then run `node scripts/build-csp.mjs` and `node scripts/check-headers-sync.mjs`. Not committed yet because the fingerprint does not exist until the app is created; no placeholder is shipped.
5. Verify the TWA opens without a browser URL bar on a real device.
6. New personal accounts may require closed testing with a minimum number of testers for a set period before production access (to verify current rule); organization accounts differ.
7. Complete Data safety, content rating, target audience, and the policy URL; submit.

## iOS (Phase 2, Capacitor)

1. Capacitor project scaffolded in `ios-app/` (see its README). Currently remote-URL mode; bundled offline mode is a later option. Never built on a Mac yet. Needs a Mac with Xcode or a cloud Mac CI.
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
