# Short cut — "Does a root's company change over 23 years?"

Recording script for the `roots-across-time` entry in `data/videos.json`.
Extends Scene 5 of `docs/video-walkthrough-script.md` (co-occurring
roots) with the chronological breakdown added after that script was
written.

## Production settings
- Record at **1280×800**, light **Parchment** palette.
- Pause a beat after each click so viewers can follow.

## Scenes

| Time | Show | Do | Say |
|---|---|---|---|
| 0:00–0:08 | `/roots.html?root=ruHm`, scrolled to "Co-occurring roots" | Point at gh-f-r (forgiveness) topping the list. | "Mercy's closest companion is forgiveness — but does that pairing hold up across the Qur'an's 23 years?" |
| 0:08–0:20 | Scroll to "Co-occurring roots by period" | Point at the four period columns; trace gh-f-r's count across them. | "Broken out by the traditional revelation periods, the two ideas travel together more and more often — from Middle Meccan to Medinan." |
| 0:20–0:27 | Hover the "Nuanced" method badge | Open the method note briefly. | "Every count here traces back to the same cited corpus — click through and check it yourself." |

## Anti-slop checklist (all mandatory before publishing)
- [ ] Real screen capture of the **live site** — no mockups, no motion graphics.
- [ ] **Human voice** — no AI narration, no text-to-speech.
- [ ] No stock footage; no background music.
- [ ] **Captions** authored from the actual narration (WEBVTT) — `scripts/check-videos.mjs` will refuse to publish without them.
- [ ] Runtime ≤ 28 seconds. Re-record rather than trim awkwardly.
- [ ] Encode H.264/AAC at ~1280×800, target ≤ 25 MB.

## Publishing
Commit `assets/video/roots-across-time.mp4`, `.vtt`, and
`-poster.jpg`; flip `status` to `"published"` in `data/videos.json`; run
`node scripts/check-videos.mjs`.
