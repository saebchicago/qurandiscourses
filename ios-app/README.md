# iOS wrapper (Capacitor)

Wraps https://divinediscourses.org in a WKWebView. Own folder so the site stays zero-dependency. Not served publicly (404 rule in `netlify.toml`).

Status: project generated on Linux; **never opened in Xcode or run**. Treat as unbuilt.

## Build (Mac with Xcode)

```bash
cd ios-app
npm ci
npx cap sync ios
npx cap open ios
```

In Xcode: App target > Signing & Capabilities > choose your Team; confirm bundle id `org.divinediscourses.app` (change in `capacitor.config.json` and Xcode together if taken). Run on a device, then Product > Archive > Distribute to App Store Connect (TestFlight first).

## Mode: remote URL (current)

`capacitor.config.json` sets `server.url` to the live site. Lowest lift, always current, but: no offline at launch, and Apple guideline 4.2 risk is highest in this mode. Native bridge plugins are installed (local notifications, haptics, app, share) but **no site code calls them yet**. Web `navigator.share` already opens the iOS share sheet.

## Native features (site-side, `assets/native-bridge.js`)

Loaded by `assets/nav.js` only when `window.Capacitor.isNativePlatform()` is true; the web site never requests it. It provides:

- **Durability**: reader notes, worksheets, lens answers, pins, preferences mirrored to `Documents/divine-discourses-backup.json` on background, page hide, and every 45 s; restored on launch when localStorage is empty.
- **Universal links**: `appUrlOpen` routes a divinediscourses.org URL to that page.
- **Daily reminder**: opt-in button in the home page's daily section, local notification at 07:00 device time. Tap opens `/#dailySection`.
- **Haptics**: light impact on share and the reminder button.

Not yet run on a device. Verify each on first TestFlight build.

## One-time setup in Xcode and on the site

1. **Associated Domains**: App target > Signing & Capabilities > + Capability > Associated Domains > add `applinks:divinediscourses.org`.
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

- Bundled offline mode (copy the site into `www`, drop `server.url`). Needs a clean-URL strategy (`/read` -> `read.html`) and a size budget (repo is ~120 MB); unverified on-device.
- App Review notes and privacy answers: `docs/STORE-SUBMISSION.md`.
