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

## Next, to strengthen the 4.2 case

1. `assets/native-bridge.js` (site repo): if `window.Capacitor?.isNativePlatform()`, add an opt-in "Daily discourse reminder" using `LocalNotifications`, and light `Haptics` on key actions. Include it from `scripts/lib/page-shell.mjs`, then rerun `build-csp`, `build-sw-manifest`, and the audit checks.
2. Consider bundled mode (copy the site into `www`, drop `server.url`). Needs a clean-URL strategy (`/read` -> `read.html`) and a size budget (repo is ~120 MB); unverified on-device.
3. App Review notes and privacy answers: `docs/STORE-SUBMISSION.md`.
