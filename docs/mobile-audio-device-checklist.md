# Mobile audio device checklist

_Last updated: 2026-09-17. Status: **not yet executed.** No session that
authored Listen mode has had a physical device or a display, so every case
below is proposed and unverified — nothing on this page is a claim about how
the site behaves, only a plan for finding out._

## Why this exists

`scripts/verify-site.mjs`'s browser audit proves the engine's *state machine*
in headless Chromium: sequencing, repeat, speed, teardown, the English
mismatch note. It cannot prove what a real phone's OS does around that state
machine — lock-screen behavior, background audio, Media Session integration,
audio-route interruptions — because headless Chromium never locks, backgrounds,
or loses Bluetooth. These are the cases that need a device.

## What the code actually does, so a tester knows what "correct" means

Read `assets/audio-engine.js` before running this list; three facts drive most
of the expected results below:

- **One `<audio>` element for the whole session** (`Engine.prototype._wire`,
  around line 380). iOS grants an element permission to play on a user
  gesture and keeps that grant across later `src` changes on the *same*
  element; a fresh element per verse would lose it after the first clip.
- **Media Session action handlers**: `play`, `pause`, `previoustrack`,
  `nexttrack` are registered (`assets/audio-engine.js:406-420`). There is no
  `seekto` or `stop` handler, so an OS control surface offering those has
  nothing wired to it — not a bug to report, just what "correct" means here.
- **Repeat holds the verse, not the clip**: with repeat on, Arabic → English
  → Arabic (same verse) before advancing, per `Engine.prototype.advance`.

## How to run it

For each row: do the numbered action, compare against Expected, write PASS,
FAIL, or PARTIAL with one line of what actually happened. A FAIL is a bug
report against `assets/audio-engine.js` or `assets/listen.js`, not against
this checklist.

| # | Platform | Case | Steps | Expected |
|---|---|---|---|---|
| 1 | iOS Safari | Lock during active verse | Start playback from a tap on `/read`. Lock the phone mid-verse. Wait ≥30s. | Audio continues. Lock-screen shows the current passage. Play/pause works from the lock screen. |
| 2 | iOS Safari | Locked src transition | Lock before a verse ends; let it advance naturally. | Next clip starts with no re-opening Safari or a new gesture. Lock-screen metadata updates to the new verse. No silent stall. |
| 3 | iOS Safari | Arabic → English → next Arabic while locked | Turn on Arabic+English mode; lock before the Arabic leg ends. | Arabic leg hands off to the English (Walk) clip, then to the next verse's Arabic, with no autoplay rejection and no verse played twice. |
| 4 | iOS Safari | Lock-screen next/previous | While locked, use the OS's next/previous controls. | Exactly one verse moves per press. Playback stays active. The engine lands on that verse's Arabic leg (repeat mode's normal start point). Metadata matches. |
| 5 | iOS Safari | Background/foreground reconciliation | Background Safari through several verse transitions; return to it. | The visible UI (verse highlight, play state, language leg, speed) matches what is actually playing. Only one audio stream is audible. |
| 6 | Android Chrome | Media Session controls | Start playback, turn the screen off, use the notification/lock-screen play, pause, previous, next controls. | All four match the in-page button behavior. Metadata and play state stay in sync. |
| 7 | Android Chrome | Multi-verse background run | Background Chrome through at least five natural verse transitions. | Sequential playback continues with no verse skipped or repeated because of a `pause` event fired by a `src` swap. |
| 8 | Android Chrome | Arabic/English metadata transition | In Arabic+English mode, watch the notification at the language handoff. | Title stays the current passage. Artist changes between the reciter and "English translation audio" as the leg changes, then back to the reciter on the next verse. |
| 9 | Comet | Feature-detection branch | Repeat the play/background/next/previous cases. | If Comet exposes the Media Session API, OS controls work. If it does not, the site falls back to in-page controls and playback itself keeps working. Lacking Media Session support is not itself a failure — only a broken fallback is. |
| 10 | iOS + Android | Interruption recovery | During playback, disconnect/reconnect Bluetooth audio, or let another app take audio focus, then return. | One stream resumes from the current item. No double-advance, no stale Media Session metadata, no second audio element. |
| 11 | Any | Network failure at a transition | Lose connectivity just before the next clip would load; restore it shortly after. | No uncontrolled rapid-skip loop. The UI's state stays legible (not silently "playing" while nothing plays). Playback resumes without a full page reload. |
| 12 | Any | Playback-rate persistence | Select 1.25× or 1.5×; let several Arabic/English/verse transitions play in the background. | The selected rate holds on every subsequent clip, including after a `src` change. |

## Recording results

Do not edit this file's table to mark results. Open a
[correction issue](https://github.com/saebchicago/qurandiscourses/issues/new?template=correction.md)
per finding, or a plain issue linking this file's line for a pass/fail
summary, so results carry their own date and device instead of silently
aging in a committed file that looks current forever.
