# Short cut — "Train your eye — the exercises"

Recording script for the `train-your-eye` entry in `data/videos.json`.
Derived from Scene 7 of `docs/video-walkthrough-script.md` (narration
carried over; updated to the current exercise URLs and the replay
follow-through).

## Production settings
- Record at **1280×800**, light **Parchment** palette.
- Pause a beat after each click so viewers can follow.

## Scenes

| Time | Show | Do | Say |
|---|---|---|---|
| 0:00–0:25 | `/exercise-roots.html?s=109` | Tap a few words you think repeat; click Reveal — highlights and the score appear. | "The exercises make you commit before you check. Spot-the-roots trains your eye on repetition — al-Kafirun lights up around ʿ-b-d, worship." |
| 0:25–0:45 | `/exercise.html?id=asr-outline` | Mark a break, click "Reveal the outline"; the comparison appears. | "The al-'Asr exercise asks you to outline the discourse yourself, then compares your reading with the outline in Dr. Khan's published book — cited, never invented." |
| 0:45–1:00 | Follow the post-reveal link to `/replay.html?s=103` | Press Play (or step) for a few verses; the outline banner advances. | "And when you've committed, watch it unfold — the recitation plays verse by verse while the recurring roots light up." |

## Anti-slop checklist (all mandatory before publishing)
- [ ] Real screen capture of the **live site** — no mockups, no motion graphics.
- [ ] **Human voice** — no AI narration, no text-to-speech.
- [ ] No stock footage; no background music.
- [ ] **Captions** authored from the actual narration (WEBVTT) — `scripts/check-videos.mjs` will refuse to publish without them.
- [ ] Runtime ≤ 60 seconds. Re-record rather than trim awkwardly.
- [ ] Encode H.264/AAC at ~1280×800, target ≤ 25 MB.

## Publishing
Commit `assets/video/train-your-eye.mp4`, `.vtt`, and `-poster.jpg`;
flip `status` to `"published"` in `data/videos.json`; run
`node scripts/check-videos.mjs`.
