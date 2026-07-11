# Short cut — "How to trust this site — in 90 seconds"

Recording script for the `trust-in-90s` entry in `data/videos.json`.
Derived from Scenes 2 and 4 of `docs/video-walkthrough-script.md`
(narration carried over, lightly condensed for the 90-second target).

## Production settings
- Record at **1280×800**, light **Parchment** palette.
- Pause a beat after each click so viewers can follow.
- If the alquran.cloud API is slow on camera, pre-load the pages first.

## Scenes

| Time | Show | Do | Say |
|---|---|---|---|
| 0:00–0:10 | `/` (home) | Nothing; let the page sit. | "Divine Discourses gives no interpretation. It orders the evidence — and labels every claim so you can check it yourself. Ninety seconds, two things." |
| 0:10–0:40 | Ask box on home | Type `2:255` → Enter (Read). Back. Type `mercy` → Enter (Roots, r-ḥ-m). Back. Type `business` → Enter (Trade & wealth theme). | "One box, four kinds of input: a verse reference, a surah name, a root, an English word — and a life theme. It routes you to the right tool." |
| 0:40–1:15 | `/numbers.html` | Hover a ● badge (tooltip), then click it — the Chicago citation popover opens. | "This is the heart of the method. Every statistic carries a badge: Verified means confirmed from the primary source cited — click and you get the full citation. Pending means awaiting a second source. Nuanced means scholars genuinely count differently, and the note tells you why." |
| 1:15–1:30 | `/validation.html` | Scroll the worked examples. | "The Validation page shows worked examples and gives you prompts to cross-examine our claims — but chatbot agreement never verifies anything; only the primary source does." |

## Anti-slop checklist (all mandatory before publishing)
- [ ] Real screen capture of the **live site** — no mockups, no motion graphics.
- [ ] **Human voice** — no AI narration, no text-to-speech.
- [ ] No stock footage; no background music.
- [ ] **Captions** authored from the actual narration (WEBVTT) — `scripts/check-videos.mjs` will refuse to publish without them.
- [ ] Runtime ≤ 90 seconds. If a take runs long, re-record; don't speed up.
- [ ] Encode H.264/AAC at ~1280×800, target ≤ 25 MB.

## Publishing
Commit `assets/video/trust-in-90s.mp4`, `.vtt`, and `-poster.jpg`; flip
`status` to `"published"` in `data/videos.json`; run
`node scripts/check-videos.mjs`.
