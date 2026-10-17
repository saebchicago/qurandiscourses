# iOS wrapper (Capacitor)

Wraps https://divinediscourses.org in a WKWebView. Own folder so the site stays zero-dependency. Not served publicly (404 rule in `netlify.toml`).

Status: project generated on Linux and validated with a pbxproj parser; **never opened in Xcode or run**. iPhone only, privacy manifest and export-compliance key included. Owner steps: `docs/APP-STORE-RUNBOOK.md`.

## Build (Mac with Xcode)

```bash
cd ios-app
npm ci
npx cap sync ios
npx cap open ios
```

In Xcode: App target > Signing & Capabilities > choose your Team; confirm bundle id `org.divinediscourses.app` (change in `capacitor.config.json` and Xcode together if taken). Run on a device, then Product > Archive > Distribute to App Store Connect (TestFlight first).

## Mode: remote URL with App-Bound Domains (current)

`capacitor.config.json` sets `server.url` to the live site, and `ios.limitsNavigationsToAppBoundDomains: true` with `WKAppBoundDomains` (divinediscourses.org, localhost) in `Info.plist`. App-Bound Domains are what let a WKWebView register the site's existing service worker, so offline Save, the precached pages and the cached passages work in the app with no code changes and with `location.href` still on https://divinediscourses.org (shared links stay correct).

Chosen over bundling the site into `www` because bundled mode would change every `location.href`-based share and citation link to `capacitor://localhost`, break the `/api/wbw` proxy path, and need a clean-URL router in Swift. Revisit only if on-device testing shows the service worker does not register.

**Unverified on a device.** First TestFlight check, in order: (1) airplane mode after one online launch still opens `/` and a precached page; (2) `navigator.serviceWorker.controller` is set; (3) `window.Capacitor` is present on the remote page (the bridge depends on it). First launch with no connection shows no site content; that is expected and should be in the review notes.

Native bridge plugins are installed (local notifications, haptics, app, filesystem, share). Web `navigator.share` already opens the iOS share sheet. Analytics are off in the app: `assets/ga-init.js` injects Google's script only when analytics are on, so the app never contacts Google, and `assets/ah-init.js` applies the same Capacitor test before adding the site's first-party analytics script, so the app sends nothing to `/_ah/` either.

## Native features (site-side, `assets/native-bridge.js`)

Loaded by `assets/nav.js` only when `window.Capacitor.isNativePlatform()` is true; the web site never requests it. It provides:

- **Durability**: reader notes, worksheets, lens answers, pins, 30-day plan start date, preferences mirrored to `Documents/divine-discourses-backup.json` on background, page hide, and every 45 s; restored on launch when localStorage is empty.
- **Universal links**: `appUrlOpen` routes a divinediscourses.org URL to that page.
- **Daily reminder**: opt-in button in the home page's daily section, local notification at 07:00 device time. Tap opens `/#dailySection`.
- **Haptics**: light impact on share and the reminder button.

Not yet run on a device. Verify each on first TestFlight build.

## One-time setup in Xcode and on the site

1. **Associated Domains**: already declared in `App/App.entitlements` (`applinks:divinediscourses.org`); automatic signing registers it. Nothing to click.
2. **`/.well-known/apple-app-site-association`** (site repo, no extension; header rule already in `netlify.toml`). Replace `TEAMID` with the Apple Team ID from developer.apple.com > Membership:

```json
{ "applinks": { "details": [ { "appIDs": [ "TEAMID.org.divinediscourses.app" ], "components": [ { "/": "/*" } ] } ] } }
```

3. **`/.well-known/assetlinks.json`** (Android, same folder). Fingerprint from Play Console > Setup > App signing:

```json
[ { "relation": [ "delegate_permission/common.handle_all_urls" ], "target": { "namespace": "android_app", "package_name": "org.divinediscourses.app", "sha256_cert_fingerprints": [ "AA:BB:..." ] } } ]
```

Add a `Content-Type: application/json` header rule for it in `netlify.toml`, then run `node scripts/build-csp.mjs` and `node scripts/check-headers-sync.mjs`.

## Later

- App Review notes and privacy answers: `docs/STORE-SUBMISSION.md`.
