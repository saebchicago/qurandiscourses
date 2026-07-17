# Short cut — "Pin a verse or root to your workspace"

Recording script for the `pin-your-workspace` entry in `data/videos.json`.
New script — covers the pin tray (`assets/notebook.js`), added after
`docs/video-walkthrough-script.md` was written, so there's no master
scene to derive it from.

## Production settings
- Record at **1280×800**, light **Parchment** palette.
- Pause a beat after each click so viewers can follow.

## Scenes

| Time | Show | Do | Say |
|---|---|---|---|
| 0:00–0:08 | `/read.html?s=2&a=255` (Ayat al-Kursi) | Click the 📌 pin button next to the verse. | "See a verse you want to come back to? Click the pin —" |
| 0:08–0:16 | The pin tray opens | Point at the pinned entry. | "— and it's saved, right in your browser. Nothing leaves your device." |
| 0:16–0:24 | `/roots.html?root=ruHm` | Click the 📌 pin button on the root detail header; tray shows both items. | "Pin roots too, and build your own reading list as you go." |

## Anti-slop checklist (all mandatory before publishing)
- [ ] Real screen capture of the **live site** — no mockups, no motion graphics.
- [ ] **Human voice** — no AI narration, no text-to-speech.
- [ ] No stock footage; no background music.
- [ ] **Captions** authored from the actual narration (WEBVTT) — `scripts/check-videos.mjs` will refuse to publish without them.
- [ ] Runtime ≤ 24 seconds. Re-record rather than trim awkwardly.
- [ ] Encode H.264/AAC at ~1280×800, target ≤ 25 MB.

## Publishing
Commit `assets/video/pin-your-workspace.mp4`, `.vtt`, and
`-poster.jpg`; flip `status` to `"published"` in `data/videos.json`; run
`node scripts/check-videos.mjs`.
