# Engagement research plan

## North star

Help a reader **open the Qur'an, notice relationships, test a reading, and
return**. The product succeeds when it deepens direct attention to a discourse,
not when it maximizes time on site.

Three constraints govern every experiment:

1. **Show before explaining.** Put a passage, pattern, comparison, or action
   before a feature description.
2. **Keep interface language brief.** Preserve the full Divine Discourses and
   source text; compress navigation, instructions, labels, and credibility
   copy.
3. **Do not manufacture authority.** Clearly separate corpus facts, sourced
   scholarly claims, editorial groupings, and the reader's observations.

The primary behavioral sequence is:

> **Read → Notice → Test → Record → Revisit**

This is a research programme, not a predetermined feature list. Each proposal
below must earn its place through observation and evidence.

## Questions to answer

### Value and audience

- Which first job brings each audience here: reading a known surah, following
  a question, preparing a lesson, exploring Arabic, or checking a claim?
- What does “direct engagement” look like in observable behavior?
- Where do beginners need orientation, and where does orientation delay the
  text?
- Which tools deepen a reading, and which merely invite browsing?
- What makes a reader return without streak pressure, guilt, or gamification?

### Comprehension and trust

- Can readers distinguish text, translation, corpus output, editorial framing,
  and scholarly interpretation without reading a methodology page?
- Do evidence markers build calibrated trust, or simply look like seals of
  approval?
- What minimum explanation establishes credibility at the point of need?
- Can a reader reproduce one claim from its source and derivation?
- Are “discourse,” “root,” “coherence,” and the three depth levels understood
  after use rather than definition alone?

### Interaction and learning

- Which prompts produce specific textual observations rather than opinions?
- Does writing an observation improve later recall and structural
  understanding?
- When should an answer be revealed, if at all?
- Do comparisons, recurrence maps, and structure outlines help readers form and
  revise hypotheses?
- How should prior notes reappear so that revisiting becomes reflection rather
  than repetition?

### Access and inclusion

- Can keyboard-only, screen-reader, low-vision, mobile, reduced-motion, and
  low-bandwidth readers complete the core sequence?
- What differs for Arabic readers, non-Arabic readers, new readers, advanced
  students, teachers, and readers using Urdu translations?
- Do transliteration and root notation help entry or add a second layer of
  jargon?
- Does local-only storage create confusion or loss across devices?

## Evidence base to review

The research lead should build a short evidence memo for each area, recording
the population studied, intervention, outcome, effect limits, and relevance to
this site. Start with primary studies and standards, then use practitioner
guidance only to translate findings into prototypes.

| Area | Product question | Starting sources |
|---|---|---|
| Retrieval practice | Should a reader recall a theme or structure before reopening notes? | Roediger & Karpicke, 2006, *Psychological Science*, [doi:10.1111/j.1467-9280.2006.01693.x](https://doi.org/10.1111/j.1467-9280.2006.01693.x); Karpicke & Blunt, 2011, *Science*, [doi:10.1126/science.1199327](https://doi.org/10.1126/science.1199327) |
| Self-explanation | Which prompts help readers explain textual connections to themselves? | Chi et al., 1989, *Cognitive Science*, [doi:10.1207/s15516709cog1302_1](https://doi.org/10.1207/s15516709cog1302_1) |
| Generation | Should readers predict a relationship before seeing a computed pattern? | Slamecka & Graf, 1978, *Journal of Experimental Psychology: Human Learning and Memory*, [doi:10.1037/0278-7393.4.6.592](https://doi.org/10.1037/0278-7393.4.6.592) |
| Spacing | When should a saved observation be resurfaced? | Cepeda et al., 2006, *Psychological Bulletin*, [doi:10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354) |
| Productive struggle | How much evidence should be withheld before a prompt becomes frustrating? | Kapur, 2008, *Cognition and Instruction*, [doi:10.1080/07370000802212669](https://doi.org/10.1080/07370000802212669) |
| Motivation | Do choice, competence, and purpose support return better than rewards? | Ryan & Deci, 2000, *American Psychologist*, [doi:10.1037/0003-066X.55.1.68](https://doi.org/10.1037/0003-066X.55.1.68) |
| Multimedia learning | When do a map or comparison clarify, and when do they split attention? | Mayer & Moreno, 2003, *Educational Psychologist*, [doi:10.1207/S15326985EP3801_6](https://doi.org/10.1207/S15326985EP3801_6) |
| Accessibility | What is the testable baseline for every core flow? | W3C, [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) and [Cognitive Accessibility Guidance](https://www.w3.org/TR/coga-usable/) |
| Ethical measurement | What can be learned without surveillance? | UK ICO, [data minimisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/) |

Do not assume that a result from general education transfers to Qur'anic study.
The site's readers, material, intentions, and reverence for the text matter.
Validate every translation into product design with readers.

## Phase 0 — instrument the questions, not the people (week 1)

### Establish outcome definitions

Use a privacy-preserving research scorecard. Avoid page views, raw time on
page, streaks, and total clicks as success metrics.

**Core outcomes**

- **Meaningful start:** opens a passage and performs one study action.
- **Observation:** saves a note anchored to a verse, root, recurrence, or
  structural section.
- **Evidence test:** opens the source or derivation behind a claim.
- **Revisit:** returns to a saved passage or observation on a later day.
- **Transfer:** can explain or apply the method to a different surah.

**Guardrails**

- completion by keyboard and screen reader;
- reading text remains visible and primary;
- no increase in mistaken certainty about editorial or computed claims;
- no coercive reminders, competitive scores, or public performance;
- no personal reading or note content leaves the browser without explicit
  export;
- page weight and interaction latency do not materially regress.

### Create a local research event logger

For moderated sessions and opt-in dogfooding only, store coarse event names and
timestamps locally: `passage_opened`, `prompt_attempted`, `note_saved`,
`evidence_opened`, `revisit_opened`, and `export_used`. Never capture verse
notes, search text, or translation content. Provide **Copy session summary** and
**Delete session** controls. Do not add third-party analytics.

### Baseline audit

Complete the core sequence at 320, 375, 768, and 1280 CSS pixels; 200% and 400%
zoom; keyboard only; VoiceOver or NVDA; forced colors; reduced motion; slow 3G;
JavaScript failure; API failure; and empty/stale local storage. Record:

- first visible Qur'anic text and first useful action;
- steps to open a named surah;
- steps to save and find an observation;
- every point where a reader must understand unexplained vocabulary;
- every repeated promise, feature description, and credibility claim;
- every dead end, empty state, and recovery path.

## Phase 1 — understand readers (weeks 1–3)

### Recruit for contrast, not averages

Run 18–24 sessions across six deliberately different groups:

1. new to Qur'anic study;
2. regular non-Arabic readers;
3. Arabic learners;
4. advanced Arabic or Qur'anic studies readers;
5. teachers or study-circle facilitators;
6. accessibility and low-bandwidth users.

Include English and Urdu interface-adjacent needs. Recruit varied ages and
mobile confidence. Do not ask participants to disclose belief, devotion, or
private notes unless volunteered and essential.

### Session structure (45 minutes)

1. **First impression, 3 minutes:** “Show me what you think you can do here.”
2. **Natural task, 10 minutes:** participant pursues their own question.
3. **Standard tasks, 15 minutes:** open a named surah; find a recurrence; make
   an observation; check one claim.
4. **Teach-back, 7 minutes:** explain the method and one evidence marker.
5. **Return trigger, 5 minutes:** identify what would make the work worth
   revisiting.
6. **Debrief, 5 minutes:** what felt supportive, distracting, authoritative, or
   uncomfortable?

Ask participants to think aloud. Do not explain until a breakdown is observed.
Record behavior before preference. Tag findings by severity, frequency,
audience, and the core sequence stage.

### Companion methods

- **Five-day diary (8–10 readers):** one sentence after each visit: intention,
  action, unresolved question, reason to return.
- **Content comprehension test:** show current and compressed credibility copy;
  test what readers believe is sourced, computed, editorial, or personal.
- **Navigation tree test:** give six goals without showing page design.
- **Search log study, moderated only:** observe vocabulary readers actually use;
  do not collect production queries.
- **Teacher workshop:** map a real 20-minute lesson and identify what the site
  should prepare, show, and export.

### Synthesis outputs

- jobs-to-be-done by audience;
- a breakdown map for Read → Notice → Test → Record → Revisit;
- vocabulary map: reader words versus site words;
- trust model showing what evidence each audience needs and when;
- opportunity scores based on observed obstruction, reach, mission fit, and
  implementation cost;
- explicit non-goals.

## Phase 2 — prototype “show, then explain” (weeks 3–6)

Test rough prototypes before production code. Each concept needs a control, a
single behavioral hypothesis, a comprehension check, and an accessibility
review.

### A. Passage-first home

Show a short passage or today's discourse, then three actions: **Read**,
**Notice repeats**, **See its shape**. Move institutional explanation below the
first interaction. Test against the current proposition-plus-search hero.

**Success:** more meaningful starts, equal or better mission comprehension,
and no reduction in trust calibration.

### B. Guided first reading

Offer one optional sequence inside Read:

1. Read without overlays.
2. Mark a word or shift you notice.
3. Reveal recurrence and structure evidence.
4. Write or revise one sentence.

Keep **Skip guidance** persistent. Never announce a “correct” personal reading.

**Success:** readers create more text-anchored observations and can explain why
they changed or retained one.

### C. Evidence before conclusion

For a selected structural or recurrence claim, initially show the relevant
verses and ask “What changes?” or “What repeats?” Then reveal the sourced claim,
status, method, and limit in that order.

**Success:** stronger recall and better separation of observation from claim,
without excess effort or frustration.

### D. Discourse map

Prototype a compact, synchronized map of sections beside the passage. Selecting
a section scrolls to its verses; scrolling updates the map. Reader labels stay
visually distinct from published outlines.

**Success:** readers can locate a turning point and describe the whole-surah
shape faster than with headings alone.

### E. Return to an unresolved question

Let a reader pin one question to a surah. On return, show the passage and the
question—not a generic streak or congratulation. Offer **Continue**, **Revise**,
or **Resolve**.

**Success:** later revisits lead back to text and notes, while readers report no
pressure or guilt.

### F. Comparison as an action

Replace explanatory copy with a directly manipulable two-translation excerpt.
Highlight only reader-selected differences; allow a brief observation.

**Success:** readers identify a meaningful translation difference and follow it
to Arabic morphology or a source rather than treating one rendering as final.

### G. Credibility in layers

At the claim, show a concise status and named source. On demand, show method,
dependencies, limits, and reproducibility. Reserve the full validation page for
auditing the system.

**Success:** readers correctly classify claims after the brief layer; advanced
readers can still audit the full chain.

## Phase 3 — evaluate learning, not attraction (weeks 5–8)

Use within-subject moderated comparisons where possible; small samples are for
finding failures, not declaring universal winners.

### Task measures

- task completion without moderator rescue;
- time to first relevant text (diagnostic, not a target to game);
- number and nature of wrong turns;
- observation specificity: anchored, comparative, and revisable;
- source-status comprehension;
- delayed recall after 48–72 hours;
- transfer to an unfamiliar surah;
- confidence paired with accuracy to detect false certainty;
- Single Ease Question after each task, plus open explanation.

### Decision rules

Ship only when a concept:

1. improves a core outcome in observed behavior;
2. does not harm trust calibration or access;
3. keeps the Qur'anic text visually primary;
4. works without an account;
5. has a clear removal condition.

If evidence is mixed, release behind an explicit local preference and continue
research. If the benefit is merely more clicks or more time, do not ship.

## Prioritized opportunity backlog

### Now — low risk, high mission fit

1. **Copy inventory and compression.** Give each page one promise, one primary
   action, and credibility only where a claim appears. Remove duplicate “how it
   works” prose.
2. **Passage-first entry points.** Turn home and empty states into usable excerpts
   rather than destination descriptions.
3. **Resume a question.** Extend the existing local continue state to a reader's
   chosen passage or unresolved question.
4. **Observation prompts.** Add optional, text-specific prompts to a small set of
   published exercises; test before scaling.
5. **Search recovery.** Show interpreted input, likely routes, examples, and a
   direct browse fallback when no match is found.
6. **Credibility compression.** Status + source first; method + limits on demand.

### Next — test with prototypes

7. **Guided first reading** with a persistent skip.
8. **Reader-authored discourse map** separated from published outlines.
9. **Recall on revisit** before revealing a saved note.
10. **Side-by-side translation noticing** linked to morphology.
11. **Teacher mode:** a clean passage, selected evidence, prompts, and printable
    or local-export handout—never a public learner dashboard.
12. **Study-path checkpoints** based on demonstrated method transfer, not page
    completion.

### Later — only after demand is proven

13. Encrypted, user-controlled cross-device sync.
14. Small private study circles with invitation, consent, attribution, and
    granular sharing per note.
15. Community-contributed structural readings with transparent review and
    version history.
16. Offline installation and downloadable surah study packs.

### Do not build by default

- streaks, points, leaderboards, badges for devotion, or shame-based reminders;
- endless feeds or engagement notifications;
- automatic interpretations or personalized doctrinal conclusions;
- public notes, social graphs, or reading histories;
- opaque recommendation ranking;
- account walls before reading;
- dashboards that turn sacred engagement into productivity metrics.

## Content design standard

### Page pattern

1. **Object:** passage, root, comparison, map, or claim.
2. **Action:** one verb-led primary control.
3. **Response:** immediate visible change.
4. **Context:** one brief sentence only if the action is not self-evident.
5. **Credibility:** source and status beside the relevant claim.
6. **Depth:** method and caveat on request.

### Copy rules

- Prefer **Open Al-Fatihah** over **Begin your exploration**.
- Prefer **Show repeats** over **Explore recurring lexical patterns**.
- Prefer **Why this count differs** over a paragraph before the number.
- Use one term consistently; define it at first necessary use.
- Button labels predict the result. Avoid “Learn more” when a specific result is
  available.
- Headings carry information; introductory paragraphs should not restate them.
- Put limits beside the affected claim, not in a distant disclaimer.
- Aim for one sentence per interface explanation. Longer Divine Discourse,
  scholarly, methodological, and source material remains intact.

### Credibility template

Use the smallest layer that answers the reader's current question:

- **At a glance:** `Computed · Leeds Corpus v0.4`
- **Why it matters:** one sentence connecting the evidence to the visible view.
- **Inspect:** inputs, rule, script, output, version, known limit.
- **Correct:** a visible route to report an error and see revision history.

## Research operations

### Repository artifacts

Keep these versioned:

- `/docs/research/briefs/` — one-page study briefs;
- `/docs/research/scripts/` — moderator scripts and task cards;
- `/docs/research/findings/` — de-identified observations and synthesis;
- `/docs/research/decisions.md` — hypothesis, evidence, decision, owner, date,
  and removal condition;
- `/docs/research/copy-inventory.csv` — page, audience, promise, primary action,
  jargon, credibility layer, proposed cut;
- `/docs/research/accessibility-audit.md` — scenario, result, evidence, fix.

Never commit participant names, contact details, recordings, private notes,
search text, or sensitive demographic data.

### Experiment brief template

Every experiment must state:

- reader and job;
- observed problem and evidence;
- hypothesis;
- smallest prototype;
- control or current experience;
- primary outcome and guardrails;
- recruitment and accessibility coverage;
- analysis method;
- ship, revise, stop, and removal criteria;
- result and decision, including contrary evidence.

### Cadence

- **Weekly:** two reader sessions, issue synthesis, copy/accessibility review.
- **Fortnightly:** prototype decision review and public research changelog.
- **Monthly:** test a delayed-learning or transfer question, not only usability.
- **Quarterly:** remove features that do not support the core sequence; review
  privacy, source integrity, performance, and accessibility.

## First 30 days

### Week 1

- baseline the five core outcomes and guardrails;
- audit the full core sequence across devices and assistive technology;
- inventory every public promise, instruction, credibility statement, and empty
  state;
- prepare recruitment screener, consent language, and session script.

### Week 2

- run six contrasting reader sessions;
- conduct navigation and claim-status comprehension tests;
- prototype passage-first home and concise credibility layers;
- fix severe blockers immediately rather than waiting for the study to end.

### Week 3

- run six more sessions, including teachers and accessibility users;
- test guided reading, evidence-before-conclusion, and unresolved-question
  return;
- score opportunities and publish a de-identified findings memo.

### Week 4

- ship only validated low-risk copy and recovery improvements;
- choose one learning prototype for a 48–72-hour delayed test;
- document rejected concepts and why;
- set the next six-week research cycle from evidence, not backlog momentum.

## Definition of success after one quarter

- Readers reach relevant Qur'anic text with fewer unproductive steps.
- More readers complete Read → Notice → Test → Record in moderated tasks.
- Participants accurately distinguish computed, sourced, editorial, and personal
  material.
- Returning readers resume a passage or question rather than merely revisit a
  homepage.
- Delayed tests show improved recall or method transfer for at least one shipped
  interaction.
- Keyboard, screen-reader, mobile, and low-bandwidth readers can complete the
  same core work.
- Public interface copy is materially shorter while credibility comprehension
  is maintained or improved.
- No success depends on surveillance, compulsion, or displaced attention from
  the Qur'an.
