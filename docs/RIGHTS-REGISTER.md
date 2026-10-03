# Asset, access and rights register

Reconciled against what the repository ships and what the pages request at runtime. Status as of this commit; sources are the repo's own `NOTICE.md`, `data/sources.json`, `assets/app.js`, `sw.js`, `assets/read-polish.js`, `netlify.toml` and the generator scripts named below. Nothing here records a permission as obtained unless the cited text states it. "Unresolved" means the repository holds no statement either way. This is an engineering inventory, not legal advice.

Public availability is not proof of redistribution or caching rights.

## Register

| # | Asset | Source / edition | Where it lives | Attribution shown | Stated terms (verified in repo) | Caching / redistribution boundary as shipped | Unresolved |
|---|---|---|---|---|---|---|---|
| 1 | Arabic Quran text | Tanzil Uthmani, v1.1 (`data/quran-text/index.json`, sha256 pinned, monthly `--check`) | Bundled; precached/saved offline | Tanzil notice on every passage, footer, `sources.html` | CC BY 3.0; verbatim copies only; source link and notice in every copy | Redistributed verbatim; never edited; integrity check refuses mismatch | None recorded. Text-change workflow: owner decision only |
| 2 | Verse structure (names, juz, page, ruku, hizb, sajda) | alquran.cloud `quran-uthmani` fields | Bundled in `data/quran-text/N.json` | `sources.html`, NOTICE | Not stated by the service in repo | Bundled factual fields | Redistribution terms of alquran.cloud not stated |
| 3 | Translations (47 editions, `assets/app.js` `TRANSLATIONS`) | alquran.cloud API editions | Runtime fetch; `qd_apicache` (localStorage, 200 entries, **no expiry**); **offline Save writes selected translations to Cache Storage `dd-saved` with no expiry** (`assets/read-polish.js`) | Translator named beside every verse (ja/ko: none named by source, none invented) | NOTICE: copyright stays with translators; per-edition licenses not recorded | Not bundled in the repo. Browser-side persistence is longer than the 1-week cap that applies to word-by-word data | Per-edition permission to cache offline. Alternative if refused: offline Save keeps Arabic and morphology only, translations stay online-only (owner decision; changes supported offline behavior) |
| 4 | Word-by-word English | Quran Foundation Content API (successor to api.quran.com v4) | Runtime; `qd_wbwcache` (7-day TTL enforced in `assets/wordbw.js`) | "Quran data provided by Quran Foundation" per passage and card | Developer terms dated 2026-09-14 per NOTICE: attribution; 1-week cache cap | Not bundled. Production still calls the legacy unauthenticated route; credentialed proxy in PR #159, credentials not provisioned | Terms/rate limits not independently re-read (docs unreachable from the authoring sandbox); underlying translator license |
| 5 | Khan word glosses (`data/gloss/`, 6 surahs) | Irfan Ahmad Khan, *An Introduction to Understanding the Qur'an with Examples*, AQU 2011 | Bundled | NOTICE, `sources.html` | Book "distributed free of charge" per NOTICE; transcription by the maintainer | Bundled quoted material | No written permission from the copyright holder in repo |
| 6 | Khan interpretation excerpts | Same 2011 volume | Bundled `data/khan-interpretations.json` | NOTICE | Short verbatim excerpts | Bundled | As row 5 |
| 7 | Leeds morphology | Quranic Arabic Corpus v0.4 | Bundled; derived datasets | Footer, `NOTICE-LEEDS.txt` | GPL; copyright block reproduced | GPL for derived data | Upstream pins no GPL version (v3 text bundled) |
| 8 | Arabic recitation audio (5 reciters: Husary 128, Minshawi 128, Abdul Basit 64, Sudais 64, Shuraim 64 kbps) | cdn.islamic.network per-ayah MP3 | **Streamed only**; cross-origin, not touched by the service worker; offline Save excludes it | Listen panel names the audio source | `data/sources.json`: CDN and registry **state no rights holder or terms** | Not stored or redistributed | Rights holder and terms for the recordings; alternative: a source with stated terms |
| 9 | Translation audio (en.walk, ur.khan, fr.leclerc, ru.kuliev-audio, zh.chinese, kk.khalifahaltai-audio, uz.sodik-audio) | cdn.islamic.network | Streamed only | Reader names in Listen | Identity and availability checked by `scripts/check-audio-editions.mjs`; license **Pending** | Not stored | As row 8 |
| 10 | Recitation durations, pace, per-verse seconds (`data/recitation/`) | Measured from MP3 headers of row 8 files (first 16 KB each) | Bundled numbers only | NOTICE | Facts about the performance, not audio | No audio bundled | Whether derived measurements need any permission is not stated |
| 11 | Word-level timings | quran-align, release 2016-11-24 (Collin Fair), made for everyayah.com recordings | **Not bundled**: `data/recitation/words/` is absent, report `bundled: []` | Credited in code/NOTICE if ever bundled | CC BY 4.0 (README quoted in report) | Nothing shipped | None to ship; see timing result below |
| 12 | Surah metadata | Quran Foundation Content API v4 | Bundled `data/surah-meta.json` (build-time) | `sources.html` | Terms as row 4 | Bundled factual field | Whether build-time bundling fits the developer terms' caching cap is not stated |
| 13 | Chronology | Cairo 1924 order (Nöldeke-Bell periods) | Bundled | NOTICE | Described as public-domain reference data | Bundled | None recorded |
| 14 | Fonts | Noto Serif Bengali/Devanagari, Noto Nastaliq Urdu, Amiri, Cormorant Garamond, Inter | Bundled `assets/fonts/` | OFL texts beside binaries | SIL OFL 1.1 | Redistributed unmodified | None |
| 15 | Third-party services at runtime | api.alquran.cloud, api.quran.com (to be `/api/wbw` proxy), cdn.islamic.network (CSP `connect-src`/`media-src` allowlist); Tanzil only at build/CI | `netlify.toml` | Footer / `sources.html` | Service terms not recorded in repo | No secrets in static assets; proxy credentials only in Netlify env | Service-level terms for alquran.cloud and Islamic Network |

## Timing result (served audio)

Served: `ar.husary` at 128 kbps from cdn.islamic.network (default reciter), plus the other four above. Timing candidates were tested by `scripts/build-word-timings.mjs` (criteria v2, fixed before data was seen), report `data/recitation/word-timings-report.json` dated 2026-09-27.

| Reciter | Speed fit | Onset match (tolerance 150 ms, n=100) | Result |
|---|---|---|---|
| ar.husary (Husary_64kbps.json; the Husary_Muallim file also failed agreement) | fail | 91% (needs 95%) | not enabled |
| ar.minshawi | fail | 97% | not enabled |
| ar.abdulbasitmurattal | fail | 100% | not enabled |
| ar.saoodshuraym | fail | 83% | not enabled |
| ar.abdurrahmaansudais | not testable: the quran-align Sudais file was unreadable (not valid JSON, per the report's `unreadable` entry) | n/a | not enabled |

No reciter passes, so word highlighting is off everywhere. No claim of verified word alignment is made. Passage-level samples (beginning/middle/end, difficult boundaries) were not run against audio in this review: audio hosts are unreachable from the authoring sandbox. `scripts/build-word-timings.mjs` on a networked runner is the reproducible path.

## Recovery receipt

Not yet performed. See `docs/maintainer-guide.md`; no written runbook here counts as a completed restore test.
