# App Store runbook (iOS first)

Owner steps only. Everything else is already in the repo. Labels: **verified** = checked in this repo or the owner's email on 2026-10-10; **to verify** = confirm in App Store Connect (ASC) at the time, since Apple changes forms.

## Readiness (repo, verified)

| Area | State |
|---|---|
| Xcode project | `ios-app/ios/App`, bundle id `org.divinediscourses.app`, version 1.0 (1), iPhone only, iOS 15+ |
| Signing | Automatic; Team not set (owner picks in Xcode) |
| Entitlements | Associated Domains `applinks:divinediscourses.org` (`App/App.entitlements`) |
| Privacy manifest | `App/PrivacyInfo.xcprivacy`: no tracking, no data collected; FileTimestamp C617.1, UserDefaults CA92.1 |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` (HTTPS only), so ASC asks nothing |
| Offline | App-Bound Domains let the site's service worker run in-app |
| Analytics | None in the app: `ga-init.js` does not even load Google's script inside the shell |
| Native features | Backups to Documents, universal-link routing, daily 07:00 reminder (repeats), haptics |
| Icon | 1024 px, opaque (`store/icon-1024.png`, also in the asset catalog) |
| Screenshots | 4 at 1320x2868 (`store/ios-6.9in/`) |
| Privacy policy URL | `https://divinediscourses.org/privacy` |
| Listing copy | `docs/STORE-LISTINGS.md` (English final; other languages unreviewed drafts) |
| Universal links file | **Missing**: needs Team ID |
| On-device test | **Never run** |

## Owner steps

| # | Step | Who | Time | Blocks |
|---|---|---|---|---|
| 0 | Gate 0 decided 2026-10-12: translations live-only in the app, audio streamed only (`docs/STORE-SUBMISSION.md`). You still answer ASC's "necessary rights" question yourself from that table | You | 5 min | Submission |
| 1 | Paste `docs/AGENT-BROWSER-PROMPT.md` into your browser agent, approve sign-in and 2FA when it asks | You + agent | 5 min of yours | 2, 5 |
| 2 | Send Claude the Team ID the agent reports; Claude adds `/.well-known/apple-app-site-association` and merges | You (paste) + Claude | 1 min | Universal links only |
| 3 | On a Mac: `git pull`, then `cd ios-app && npm ci && npx cap sync ios && npx cap open ios` | You | 10 min | 4 |
| 4 | Xcode: App target > Signing & Capabilities > Team = yours. Select "Any iOS Device (arm64)". Product > Archive > Distribute App > App Store Connect > Upload | You | 15 min | 5 |
| 5 | TestFlight on your iPhone, run the 6 checks below | You | 15 min | 6 |
| 6 | ASC > Divine Discourses > iOS App 1.0 > Build: select the build > Add for Review > Submit | You | 2 min | Release |

No Mac? Use a cloud Mac build (Codemagic or Xcode Cloud). Ask Claude for the config; it is not set up yet.

## TestFlight checks (step 5)

1. Opens to the home page, no browser bar, safe-area insets look right.
2. Home > "Remind me daily at 7:00" > allow > button says on. Next morning it fires; tap opens Today's discourse.
3. Write a note on any verse, force-quit, reopen: note is there.
4. Airplane mode after one online launch: home and a previously opened passage still load (Arabic and word data; translations are online-only in the app by design).
5. Share button opens the iOS share sheet with a divinediscourses.org link.
6. Read any surah: translations appear, and Listen plays recitation (audio streams from cdn.islamic.network; checks that App-Bound Domains do not block it).

If 6 fails (no translations or no audio), App-Bound Domains are blocking third-party requests: tell Claude before submitting.
If 4 fails, the service worker did not register under App-Bound Domains: tell Claude before submitting (fallback is bundling the site; bigger change).
If 2 or 3 fails, `window.Capacitor` is not reaching the remote page: tell Claude.

## Known review risks

| Risk | Mitigation in place | Residual |
|---|---|---|
| 4.2 minimum functionality (web wrapper) | Notifications, offline, backups, haptics, share sheet; review notes explain | Medium. Reviewer judgment |
| 5.2 third-party content rights | Attribution on every passage; rights register | Depends on Gate 0 |
| First launch offline shows nothing | Stated in review notes | Low |
| DecisionPlay had changes requested twice | Agent reads those reasons first so they are not repeated | Unknown until read |

## Android (later)

No Play Console account found in email. When registered: PWABuilder package from the live site, then send Claude the signing SHA-256 for `assetlinks.json`.
