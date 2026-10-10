# Browser agent prompt: App Store Connect setup

Paste everything below the line into a browser agent (Claude in Chrome or similar) while signed in to your Apple ID in that browser.

---

You are setting up an App Store Connect record for an iOS app. Work in the browser I am signed in to. I will handle sign-in, two-factor codes, and any payment or legal-agreement screens myself; when you hit one, stop and tell me exactly what is on screen.

## Hard rules

- Never click "Submit for Review", "Add for Review", "Release", or anything that sends an app to Apple review or the public. I do that myself.
- Never change anything on the existing app **DecisionPlay** (read only).
- Never accept agreements, change payment, banking, tax, or membership settings.
- Never enter passwords or one-time codes; ask me.
- If a field is not listed below, leave it at its default and add it to your report.
- If a form asks something you are not sure how to answer truthfully, stop and ask me rather than guessing.
- Prefer saving drafts often. If a save fails, report the exact error text.

## Part A: read-only facts (report these back verbatim)

1. Go to https://developer.apple.com/account > Membership details. Report: **Team ID**, Entity name, Program type.
2. Go to https://appstoreconnect.apple.com > Apps > DecisionPlay > App Review (and Resolution Center / messages). Copy the **full text of every rejection or "changes needed" message**, with guideline numbers and dates. Do not reply to them.
3. In DecisionPlay > App Information / App Review Information, note the contact first name, last name, phone, and email used there (we reuse them in Part C).

## Part B: register the bundle ID (skip if it already exists)

1. https://developer.apple.com/account/resources/identifiers/list > "+" > App IDs > App.
2. Description: `Divine Discourses`. Bundle ID: Explicit, `org.divinediscourses.app`.
3. Capabilities: check **Associated Domains** only (plus anything already checked by default). Do not enable Push Notifications.
4. Continue > Register. If it says the ID is taken, stop and report.

## Part C: create the app record

1. App Store Connect > Apps > "+" > New App.
   - Platforms: iOS
   - Name: `Divine Discourses` (if taken, try `Divine Discourses: Qur'an Study`; report which worked)
   - Primary language: English (U.S.)
   - Bundle ID: `org.divinediscourses.app`
   - SKU: `divinediscourses-ios-1`
   - User access: Full access
2. **App Information**
   - Subtitle: `Read each surah as one discourse`
   - Category: Primary **Education**, Secondary **Reference**
   - Content Rights: answer "Yes, it contains, shows, or accesses third-party content" and confirm rights **only if I have told you in this chat that I hold them**. Otherwise stop here and ask me.
   - Age Rating: open the questionnaire; answer None/No to every item (no violence, mature themes, gambling, unrestricted web access, user-generated content, messaging, or contests). If the questionnaire asks about unrestricted web browsing: answer No (the app only shows its own site). Report the resulting rating.
3. **Pricing and Availability**: Price Free (USD 0). Availability: all countries and regions.
4. **App Privacy**
   - Privacy Policy URL: `https://divinediscourses.org/privacy`
   - Data collection: "No, we do not collect data from this app". Publish the privacy answers.
5. **iOS App 1.0 (version page)**
   - Promotional text: `A 30-day plan, one juz a day. Read the Qur'an by its structure.`
   - Description:
     ```
     Divine Discourses is a study tool for reading the Qur'an surah by surah in a coherence-reading tradition: structure first, every claim sourced and citable.

     - Read any of the 114 surahs with parallel translations and word-by-word meanings.
     - Trace a word to its root across the whole text.
     - Follow a 30-day plan: one juz a day.
     - Keep your own notes, worksheets and pinned references on your device.
     - A public corrections log and open review process show what changed and why.

     No account. No advertising. No analytics in the app.
     ```
   - Keywords: `quran,surah,juz,study,roots,tafsir,translation,arabic,coherence,reading plan`
   - Support URL: `https://divinediscourses.org/about`
   - Marketing URL: `https://divinediscourses.org`
   - Copyright: `2026 Saeb Ahsan`
   - Screenshots (iPhone 6.9" display): upload these four in this order, downloading each from the link first if your browser needs a local file:
     1. https://raw.githubusercontent.com/saebchicago/qurandiscourses/main/store/ios-6.9in/01-home.png
     2. https://raw.githubusercontent.com/saebchicago/qurandiscourses/main/store/ios-6.9in/03-navigate.png
     3. https://raw.githubusercontent.com/saebchicago/qurandiscourses/main/store/ios-6.9in/04-roots.png
     4. https://raw.githubusercontent.com/saebchicago/qurandiscourses/main/store/ios-6.9in/05-themes.png
     If uploads are not possible for you, skip and list it in the report.
   - App Review Information: Sign-in required: **No**. Contact: reuse the DecisionPlay contact from Part A step 3. Notes:
     ```
     Scholarly Qur'an study tool. No login, no purchases, no ads, no analytics in the app.
     Native features: daily reading reminder (local notification, opt-in on the home page), offline reading via the site's service worker, on-device backup of notes, share sheet, haptics.
     Content: Arabic text from Tanzil (bundled), translations and word meanings from the providers named in About > Sources; each passage shows its attribution.
     The app needs a connection on first launch; after that, opened passages and notes work offline.
     Privacy policy: https://divinediscourses.org/privacy
     ```
   - Version release: "Manually release this version".
   - Build: leave empty (I upload it from Xcode).
6. Save. Do not submit.

## Part D: report

Reply with one table: each step above, status (done / skipped / blocked), and the value used or the error text. Then list: Team ID, the app's Apple ID (number in the app URL), the age rating result, and the DecisionPlay rejection texts from Part A.
