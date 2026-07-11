# Short cut — "Find your theme — from a life question to the text"

Recording script for the `find-your-theme` entry in `data/videos.json`.
Derived from Scene 6 of `docs/video-walkthrough-script.md` (narration
carried over).

## Production settings
- Record at **1280×800**, light **Parchment** palette.
- Pause a beat after each click so viewers can follow.

## Scenes

| Time | Show | Do | Say |
|---|---|---|---|
| 0:00–0:10 | `/themes.html` | Scroll the jump-nav chips slowly. | "Themes are gateways: pick forgiveness, marriage, trade, peace." |
| 0:10–0:40 | Forgiveness card | Jump to Forgiveness; show the root chips, then the computed key passages; open 24:22. | "Each maps to its root families and to passages where that vocabulary clusters — computed from the corpus, not hand-picked." |
| 0:40–0:55 | Back on the card | Click "Open the top two passages side by side" (Compare); return. | "The label is honest: these are lexical starting points, not a complete index of the theme." |
| 0:55–1:15 | Self-study kit + distribution map | Open the card's distribution map; point at the self-study kit steps. | "The study kit turns each gateway into your own analysis — read the whole discourse, follow one root, and write down what the passages agree on. That record is yours." |

## Anti-slop checklist (all mandatory before publishing)
- [ ] Real screen capture of the **live site** — no mockups, no motion graphics.
- [ ] **Human voice** — no AI narration, no text-to-speech.
- [ ] No stock footage; no background music.
- [ ] **Captions** authored from the actual narration (WEBVTT) — `scripts/check-videos.mjs` will refuse to publish without them.
- [ ] Runtime ≤ 75 seconds. Re-record rather than trim awkwardly.
- [ ] Encode H.264/AAC at ~1280×800, target ≤ 25 MB.

## Publishing
Commit `assets/video/find-your-theme.mp4`, `.vtt`, and `-poster.jpg`;
flip `status` to `"published"` in `data/videos.json`; run
`node scripts/check-videos.mjs`.
