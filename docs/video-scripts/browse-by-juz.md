# Short cut — "Browse by juz"

Recording script for the `browse-by-juz` entry in `data/videos.json`.
New script — covers the juz navigation grid, added after
`docs/video-walkthrough-script.md` was written, so there's no master
scene to derive it from.

## Production settings
- Record at **1280×800**, light **Parchment** palette.
- Pause a beat after each click so viewers can follow.

## Scenes

| Time | Show | Do | Say |
|---|---|---|---|
| 0:00–0:08 | `/navigate.html`, scrolled to the juz grid | Hover a couple of tiles. | "Prefer a daily-reading rhythm? The Qur'an also divides into 30 juz — equal parts for a month of reading." |
| 0:08–0:16 | Click juz 1 | `read.html` opens at 1:1; scroll a couple of verses. | "Click any juz and you land at its first verse — the standard Tanzil division, the same one used in printed copies." |
| 0:16–0:20 | Back to `/navigate.html` | Point at the grid. | "Every juz, one click away." |

## Anti-slop checklist (all mandatory before publishing)
- [ ] Real screen capture of the **live site** — no mockups, no motion graphics.
- [ ] **Human voice** — no AI narration, no text-to-speech.
- [ ] No stock footage; no background music.
- [ ] **Captions** authored from the actual narration (WEBVTT) — `scripts/check-videos.mjs` will refuse to publish without them.
- [ ] Runtime ≤ 20 seconds. Re-record rather than trim awkwardly.
- [ ] Encode H.264/AAC at ~1280×800, target ≤ 25 MB.

## Publishing
Commit `assets/video/browse-by-juz.mp4`, `.vtt`, and `-poster.jpg`;
flip `status` to `"published"` in `data/videos.json`; run
`node scripts/check-videos.mjs`.
