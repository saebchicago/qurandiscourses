# Verified root glosses: transcription guide

Source decision (owner, 2026-10-18): **Penrice (1873) is the primary source; Lane's Lexicon (1863–93) is the cross-check.** Both are public domain by age. Registered as `penrice-1873` and `lane-lexicon` in `data/sources.json`.

Records go in `data/root-glosses/roots.json`. `node scripts/build-root-glosses.mjs --check` (run in CI) rejects any incomplete record. `data/coverage/report.json` counts what passes.

## What "verified" means here

A record is a **checked transcription**: the English is quoted exactly from Penrice, the page is given, and a second person has compared it with the scan. It does not mean the English is the meaning of the root. Every gloss renders with the **Nuanced (~)** label, never Verified (●). The site's rule against generated interpretation applies: no paraphrase, no summary, no gloss written by us or by a model.

## Order of work

Follow `data/root-glosses/worklist.json`: the 200 most frequent roots, ranked by token count. The top 63 cover 50% of rooted tokens and the top 100 cover 60.49% (`data/coverage/report.json`, `rootGloss.tokenWeighted`). The worklist deliberately lists no page numbers: look each root up in the printed books.

## Steps for one root

1. **Find the Penrice entry.** Use a scan of the printed 1873 edition (London: Henry S. King & Co.), not a modern retyped edition, which may carry its own terms. Penrice arranges entries by root. Note the page number printed on the page.
2. **Quote.** Copy the English of the root's leading sense or senses exactly, at most 200 characters. Keep Penrice's spelling and punctuation. Mark an omission with `...`. Add nothing.
3. **Cross-check in Lane.** Use scans of the printed Lexicon. Record the part (1–8) and the page where the root's entry begins. Then set `finding`:
   - `agrees`: Lane's leading senses include Penrice's.
   - `adds-senses`: Lane agrees and gives further senses Penrice omits.
   - `differs`: Lane's senses do not include Penrice's. Flag it in the PR; the record still ships, and the difference is the finding.
   - `not-found`: no entry in Lane. Set `part` and `page` to `null`.
4. **Second reader.** A different person opens both scans at the recorded pages and confirms the quotation and the finding. Their name goes in `checkedBy`.
5. **Run** `node scripts/build-root-glosses.mjs`, then `node scripts/compute-coverage.mjs`, and open a PR.

## Record template

```json
{
  "root": "rHm",
  "gloss": "<exact words from Penrice>",
  "source": "penrice-1873",
  "locator": { "page": 0 },
  "crossCheck": { "source": "lane-lexicon", "part": 0, "page": 0, "finding": "agrees" },
  "transcribedBy": "<name>",
  "checkedBy": "<a different name>",
  "checkedOn": "YYYY-MM-DD",
  "label": "nuanced"
}
```

The zeros are placeholders, and the validator rejects them on purpose: every page number must come from the scan. `root` is the Buckwalter key used in `data/roots-summary.json`; the worklist gives it with the Arabic and the transliteration.

## Not yet built

The Roots page does not display these glosses yet. Once the first batch merges, a follow-up will show them beside the editorial glosses, labeled ~ with the Penrice page.
