# Multidisciplinary public-engagement and excellence review

**Review date:** 29 July 2026
**Scope:** the current static website, repository documentation, public data,
and automated integrity checks
**Purpose:** turn a multidisciplinary expert review into a sequenced,
testable action register without displacing direct attention from the Qur'an

> This is a structured heuristic review, not a claim that named external
> experts, representative users, counsel, or an accessibility auditor have
> signed off on the site. Reader research, assistive-technology testing, and
> jurisdiction-specific legal advice remain explicit gates below.

## Executive decision

The site already has an unusually strong foundation for public trust: it is
reader-led, makes evidence inspectable, ships reproducible data, avoids
surveillance, and documents uncertainty. Its largest opportunity is therefore
**not more functionality**. It is to make the value legible sooner, establish a
small and visible governance surface, validate the core journey with contrasting
readers, and convert the present integrity discipline into routinely published
assurance.

The recommended order is:

1. **Protect:** close governance, accessibility, legal-review, and recovery
   gaps before increasing reach.
2. **Clarify:** reduce choice at entry points and explain status, provenance,
   privacy, and local storage at the moment they matter.
3. **Validate:** observe whether readers can complete **Read → Notice → Test →
   Record → Revisit**, including with assistive technology and low bandwidth.
4. **Reach:** build search, social, educator, and institutional distribution
   only after the core journey and trust model are demonstrated.
5. **Learn:** publish a compact, privacy-preserving scorecard and remove work
   that does not deepen direct engagement.

## Review principles

| Principle | Operational interpretation | Guardrail |
|---|---|---|
| Sacred-text primacy | Put passage, evidence, and reader action before institutional explanation. | Never optimize raw time, clicks, streaks, or devotional performance. |
| Epistemic humility | Distinguish revealed text, translation, corpus result, sourced interpretation, editorial framing, and personal note. | No visual badge may imply certainty beyond its documented status. |
| Progressive disclosure | Offer one clear next action; reveal method and technical detail on demand. | Advanced auditability must remain one action away. |
| Inclusive universality | Treat keyboard, screen reader, zoom, forced colors, reduced motion, mobile, Urdu, and low bandwidth as core scenarios. | No “accessible alternative” may be a lesser research experience. |
| Privacy by design | Learn from volunteered, coarse, local or aggregated signals. | Never collect passage content, notes, belief, searches, or reading history by default. |
| Reversibility | Every experiment has a removal condition and accountable owner. | More engagement is not sufficient evidence to retain a feature. |
| Evidence before scale | Test comprehension and behavior with readers before promotion. | Reach work cannot outrun integrity and incident-response capacity. |

## Multidisciplinary scorecard

Scores are directional hypotheses from repository inspection, not certification.
The first research cycle should replace them with observed evidence.

| Domain | Current signal | Main risk | 90-day target | Priority |
|---|---|---|---|---|
| Mission and proposition | **Strong:** reader agency and direct engagement are consistently stated. | New visitors may still need to decode “discourse,” evidence levels, and the large toolset before acting. | At least 80% of test participants accurately explain the site's purpose after one core task. | P0 |
| Content and scholarship | **Strong:** sources, limitations, validation, datasets, and claim statuses are public. | Readers may mistake computed, editorial, and scholarly layers when badges are seen without context. | At least 90% correctly classify a representative set of claims; no high-severity source defects open beyond the response target. | P0 |
| Accessibility | **Promising:** semantic landmarks, skip links, labels, and documented intent are present. | Conformance cannot be inferred from markup or automated checks; Arabic, charts, dialogs, zoom, and dynamic states need manual testing. | Core journey passes a documented WCAG 2.2 AA audit with disabled-reader validation and zero critical blockers. | P0 |
| Privacy and data ethics | **Strong:** no analytics, tracking, cookies, or accounts; preferences and notes stay local. | Users may not understand browser-storage loss, device boundaries, exports, third-party API/audio requests, or future research consent. | A plain-language data map and just-in-time storage notice are reviewed; deletion/export recovery succeeds in every test. | P0 |
| Legal and governance | **Partial:** code/data licenses and credits are unusually explicit. | No consolidated policy/governance surface, jurisdiction matrix, formal takedown/correction route, or counsel sign-off is evident. | Counsel-scoped legal register, correction SLA, accessibility contact, and governance owner are published. | P0 |
| Navigation and information architecture | **Feature-rich:** tools are logically grouped. | Four menu groups and many specialist destinations may create choice overload and obscure the primary journey. | 85% complete six top tasks in tree tests without backtracking; passage access remains at most two actions away. | P1 |
| Onboarding and learning design | **Strong concept:** method, exercises, paths, tour, and return state exist. | Parallel entry modes can compete; instruction may precede lived understanding. | 75% complete Read → Notice → Test → Record without moderator rescue; delayed transfer tested at 48–72 hours. | P1 |
| Search and discovery | **Useful:** surah, verse, root, and keyword starting points are supported. | Vocabulary mismatch, zero-result recovery, and Arabic/Urdu/transliteration variants need observed testing. | 90% task success across a published query set; every zero result offers a useful recovery route. | P1 |
| Visual and interaction design | **Coherent:** distinctive scholarly tone and reusable design system. | Dense pages, chart interpretation, touch targets, bidirectional content, and focus/hover states may vary across contexts. | Design QA passes all core templates at 320–1280 px, 200/400% zoom, dark mode, RTL content, and forced colors. | P1 |
| Performance and resilience | **Strong architecture:** static, dependency-light, self-hosted fonts, progressive intent. | Dataset-heavy views and optional remote translation/audio can fail on low-end devices or weak networks. | Published budgets: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at the 75th percentile; all core pages retain a useful failure state. | P1 |
| Search-engine and sharing reach | **Good basics:** canonical, description, Open Graph, sitemap, and share pages exist. | Rich results, image consistency, duplicate intent, and search-console coverage require operational ownership. | All indexable templates validate; coverage and top landing-page intent are reviewed monthly. | P2 |
| Educator and community utility | **High potential:** exercises, study paths, datasets, and citations support teaching. | Public collaboration could expose beliefs, notes, minors, copyrighted material, or unreviewed interpretations. | Test printable/exportable private lesson packs; no community feature ships without moderation and safeguarding design. | P2 |
| Sustainability and operations | **Promising:** deterministic checks and maintainer guidance exist. | Bus factor, review authority, release cadence, incident handling, and data update ownership are not obvious to visitors. | Named responsibility matrix, release checklist, restore drill, and quarterly transparency note are in operation. | P1 |

## Comprehensive action register

**Priority:** P0 = protect/urgent, P1 = next, P2 = scale after validation.
**Effort:** S = up to 2 days, M = 3–10 days, L = multiple weeks.
“Owner” is a role to assign, not a claim that the role presently exists.

| ID | Domain | Evidence / opportunity | Action and concrete deliverable | Acceptance measure | Owner | Priority | Effort | Dependency |
|---|---|---|---|---|---|---|---|---|
| G01 | Governance | Trust practices are distributed across About, Credits, Validation, datasets, and maintainer documentation. | Publish one **Trust & governance** hub linking privacy/data handling, accessibility, corrections, source policy, licenses, changelog, maintainers, and response targets. | A first-time reader finds how to question a claim, report an access barrier, and inspect data handling in ≤2 actions. | Product steward + editor | P0 | M | Legal review |
| G02 | Accountability | Excellence depends on recurring ownership, not a one-time audit. | Add a public RACI: editorial authority, source verification, accessibility, security, privacy, release approval, incident response, and succession. | Every critical process has one accountable owner and backup; reviewed quarterly. | Project lead | P0 | S | None |
| G03 | Corrections | The project invites corrections but the reader-facing route and service level should be uniform at each claim. | Add **Report an issue with this claim/page** using a prefilled, non-sensitive template; publish triage states and response targets. | Link appears at claims/method surfaces; critical provenance issue acknowledged in 2 working days and resolved, withdrawn, or caveated in 10. | Scholarly editor | P0 | M | G01 |
| G04 | Transparency | Changelog is detailed, but assurance outcomes are not summarized for general readers. | Publish a quarterly one-page transparency note: corrections, withdrawn claims, accessibility issues, dataset changes, incidents, research completed, and next risks. | Four notes/year; counts reconcile with public issues and releases; no participant data disclosed. | Project lead | P1 | S | G02 |
| L01 | Legal scope | Public global access creates jurisdictional questions; a repository review cannot provide legal clearance. | Commission scoped counsel review covering publisher identity/contact, applicable law, privacy notice requirements, consumer representations, accessibility duties, intermediary links, liability language, and dispute/takedown process. | Dated advice, jurisdiction assumptions, decisions, owners, and annual/triggered review recorded in a non-public legal register; public copy updated. | Counsel + project lead | P0 | M | Data map |
| L02 | Copyright and licenses | Licensing is carefully documented, including pending sources, but the end-to-end rights chain needs an auditable register. | Create a machine-readable rights register for every text, dataset, font, image, audio/link, excerpt, derived file, license, attribution, territory/term limit, and removal contact. | 100% of shipped third-party assets have source, right/basis, required notice, and review date; unknown rights block release. | Rights editor | P0 | M | Counsel |
| L03 | Representations | “Verified,” “recomputed,” counts, and scholarly descriptions can be read as warranties. | Have scholarly and legal reviewers approve a controlled vocabulary for evidence status, limitations, “direct engagement,” and non-affiliation; test comprehension rather than adding blanket disclaimers. | ≥90% classification accuracy and no material mismatch between visible label and claim ledger. | Scholarly editor + counsel | P0 | M | C03 |
| L04 | Children/safeguarding | The content is broadly accessible and may be used by teachers; future research or community features increase risk. | Define whether services are directed to children, minimum research-participation rules, parental/guardian process where applicable, educator guidance, and a strict no-public-profiles/no-direct-messaging baseline. | Counsel-approved position published before recruiting minors or adding accounts/community; safeguarding lead named for any minor research. | Counsel + safeguarding lead | P0 | S | L01 |
| P01 | Data inventory | “No analytics/cookies” is clear, while localStorage, exports, service worker/cache, optional remote API, and audio need one lifecycle view. | Produce a data-flow map listing data item, source, location, purpose, retention, deletion, export, third party, failure mode, and lawful basis if applicable. | Map covers every storage key and network destination; network observation matches documentation. | Privacy lead + engineer | P0 | M | None |
| P02 | Just-in-time clarity | Local-only storage protects privacy but can surprise users after clearing data or switching devices. | At first save, say where the note lives, how to export/delete it, and that clearing browser data loses it; provide a non-coercive “do not show again.” | 90% of testers predict device/clearing behavior; all can export and delete without help. | Content designer | P0 | S | P01 |
| P03 | Research ethics | The research plan correctly rejects production query collection and private-note capture. | Create consent, withdrawal, recording, retention, redaction, incentive, researcher-access, and deletion templates; separate product consent from research consent. | Ethics checklist completed for every study; raw data deletion verified on schedule; no belief or note content in repository. | Research lead + privacy lead | P0 | M | L01, P01 |
| P04 | Third parties | Optional translation and recitation calls can disclose IP address and request metadata to external providers. | Inventory endpoints; show just-in-time notice before the first optional request if warranted; offer bundled/no-request paths and graceful failure. | A reader can complete the core study sequence with all third-party requests blocked; policy names each recipient and purpose. | Engineer + privacy lead | P0 | M | P01 |
| A01 | Conformance baseline | Automated integrity checks cannot establish accessibility conformance. | Audit representative templates and the full core journey to WCAG 2.2 AA using automated tools plus manual keyboard, screen-reader, zoom/reflow, contrast, target-size, error, and cognitive checks. | Auditable issue log contains criterion, steps, evidence, severity, owner, regression test, and disabled-user validation; no critical/high issue open at release. | Accessibility lead | P0 | L | Representative-template list |
| A02 | Assistive technology | Dynamic search, dropdown navigation, charts, badges, note controls, dialogs, and live feedback are high-risk interactions. | Test NVDA/Firefox, NVDA/Chrome, VoiceOver/Safari on macOS and iOS, TalkBack/Chrome, keyboard only, voice control, and switch/alternative input on agreed representative flows. | Each supported combination completes Read → Notice → Test → Record → Revisit and correction reporting without moderator rescue. | Accessibility lead + QA | P0 | L | A01 |
| A03 | Arabic and bidirectionality | Arabic text, transliteration, English/Urdu framing, roots, punctuation, and numerals can create reading-order and pronunciation defects. | Conduct bilingual screen-reader and visual bidi review; set language/direction at phrase level; publish transliteration pronunciation help without making it mandatory. | Native Arabic/Urdu reviewers and screen-reader users report correct order and intelligible announcements on sampled pages. | Arabic editor + accessibility lead | P0 | M | A01 |
| A04 | Data visualizations | Visual recurrence, structure, rhyme, and comparison tools may encode meaning through color, position, or pointer interaction alone. | Give every chart a purpose sentence, text/table equivalent, keyboard operability, focus state, non-color encoding, and sonification only if research supports it. | The same substantive conclusion is obtainable without sight, color, fine pointer control, or animation. | Data-viz designer + engineer | P0 | L | A01 |
| A05 | Accessibility support | Users need a human route when conformance fails. | Publish an accessibility statement with scope, known limitations, test date/method, contact channel, expected response, and escalation; avoid claiming full conformance prematurely. | Contact tested quarterly; barrier acknowledged within 2 working days; statement updated on material releases. | Accessibility lead | P0 | S | G01, A01 |
| U01 | First-use clarity | The homepage offers search, examples, a welcome banner, tour, method, navigation, and daily/continued routes. | Prototype a single dominant path: **Open a surah**, with search as the instrument and tour/method secondary; keep a control version and test rather than assuming simplification wins. | More participants reach relevant text and perform one study action, with equal or better mission comprehension and trust calibration. | Product designer + researcher | P1 | M | Baseline study |
| U02 | Information architecture | Specialist pages are coherent individually but the breadth may obscure user goals. | Run open card sorting and tree testing around jobs: read, investigate a word/root, test a structure, prepare a lesson, resume work, audit a claim, and download data. | ≥85% first-choice success on top tasks; final labels work for new, advanced, Arabic-learning, and teacher cohorts. | Information architect | P1 | M | Recruitment |
| U03 | Terminology | “Discourse,” “root,” “lemma,” “coherence,” “computed,” and status labels are necessary but specialist. | Build a controlled vocabulary: preferred term, plain-language microdefinition, Arabic/Urdu equivalent where useful, examples, prohibited synonyms, and first-use rule. | 80% explain essential terms after using a feature without opening the glossary; terminology scan finds no unintended variants. | Content designer + scholarly editor | P1 | M | C03 |
| U04 | Search recovery | Search supports multiple input types, but real vocabulary and misspellings are not yet validated. | Build a de-identified synthetic query suite spanning names, numbers, Arabic, transliteration systems, Urdu/English, roots, themes, misspellings, and ambiguous terms; show interpreted query and undoable alternatives. | ≥90% correct-route success; zero results always explain interpretation and offer browse/help without storing the query. | Search engineer + linguist | P1 | M | P03 |
| U05 | Return journey | Local continuation supports return without accounts; the mission calls for unresolved-question revisits rather than generic retention. | Prototype one pinned question with **Continue / Revise / Resolve**, export/deletion, and no streaks or reminders. | Returning testers resume relevant text/notes; no reported guilt or mistaken sync expectations; P02 measure passes. | Product designer | P1 | M | P02 |
| U06 | Empty/error states | Remote content, missing data, corrupt/stale storage, offline mode, and JavaScript failure can interrupt study. | Inventory every loading/empty/error state; state what happened, preserve entered work, offer retry/alternative, and never show fabricated or stale evidence as current. | Scripted fault matrix passes; no dead end in core journey; saved work survives recoverable faults. | Engineer + content designer | P1 | M | R02 |
| C01 | Content architecture | Long explanations are valuable for audit but can compete with the object of study. | Inventory each page's audience, promise, primary action, prerequisites, repeated copy, evidence layer, and next step; cut repetition, not scholarly/source text. | Every page has one primary purpose/action; interface copy decreases measurably while comprehension does not. | Content designer | P1 | M | U02 |
| C02 | Reader-led pedagogy | Exercises and method support active learning; effectiveness has not been established by usage alone. | Test guided **read → predict/notice → reveal evidence → revise** against unguided reading, including delayed recall and transfer to an unfamiliar surah. | Improvement in anchored observations and 48–72-hour transfer without increased false certainty or frustration. | Learning scientist + researcher | P1 | L | P03 |
| C03 | Epistemic labeling | Claims may be corpus facts, sourced interpretations, editorial groupings, or personal observations. | Establish mutually distinguishable text + shape + accessible-name labels; reveal source, method, dependencies, limits, and revision history progressively. | ≥90% classify examples accurately across color vision, screen reader, mobile, and simple/advanced depth settings. | Scholarly editor + designer | P0 | M | A01 |
| C04 | Translation posture | Translations are aids with interpretive choices; remote availability and licensing vary. | Explain edition, translator, source, license/availability, limitations, and why renderings differ beside comparison tools; never imply a single rendering settles the Arabic. | Readers identify provenance and one material difference without mistaking translation for source text. | Translation editor | P0 | M | L02, P04 |
| C05 | Sensitive disagreement | Structural readings and thematic groupings can be contested across traditions. | Add a documented disagreement protocol: inclusion threshold, neutral summary, primary citation, status, author/reviewer, version history, response route, and no doctrinal personalization. | Sample contested entries pass review by at least two relevant scholars with disagreements preserved rather than collapsed. | Scholarly board | P1 | L | G02, G03 |
| R01 | Performance budgets | Static architecture is favorable, but large datasets/fonts and interactive analysis can affect low-end mobile use. | Establish per-template budgets and measure lab + consented aggregate field data only if a privacy review approves it; otherwise use repeatable device/network lab tests. | At p75 target or equivalent lab profile: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; budgets enforced in CI. | Performance engineer | P1 | M | P01 |
| R02 | Offline/resilience | Service worker and local data create offline potential and cache-version risks. | Document cache strategy, offline boundary, update behavior, stale-data indicator, migration/rollback, and “reset local data”; run an offline/update recovery matrix. | Core bundled content remains readable offline as promised; version changes do not lose notes; stale evidence is visibly labeled. | Engineer | P1 | M | P01 |
| R03 | Security | A static site reduces attack surface but supply chain, hosting headers, external links, DOM injection, and stored note rendering still matter. | Threat-model stored/displayed text, DOM sinks, service worker, build scripts, deployment credentials, third-party origins, framing, and dependency/repository permissions; add disclosure instructions. | No unresolved critical/high finding; CSP/header checks pass; secret and branch-protection review documented; disclosure channel tested. | Security reviewer | P0 | M | G01 |
| R04 | Release quality | Deterministic integrity scripts exist, but one command and a release record should make the gate obvious. | Provide a single documented CI/release command covering claims, data numbers, editions, exercises, headers/nav, paths, source links, videos, HTML/accessibility smoke, and broken internal links. | Clean checkout produces one pass/fail report; network-dependent checks are isolated and recorded; releases cannot bypass a failed critical gate silently. | Maintainer | P1 | M | A01, R01 |
| D01 | Search discovery | Metadata and sitemap exist; search intent and template quality need ongoing validation. | Map one search intent per indexable template; validate canonical, title, description, headings, language, structured data eligibility, sitemap freshness, status code, and social preview. | 100% indexable URLs pass template checks; no accidental duplicates/orphans; monthly coverage review has an owner. | SEO/content lead | P2 | M | C01 |
| D02 | Share with context | Deep links can reach complex material without method or evidence context. | Ensure shared passage/root/theme/claim previews include human-readable object, source/status, limitation when material, canonical URL, descriptive image/alt, and a safe fallback. | Representative previews render correctly across major platforms and never overstate claim certainty. | Content designer + engineer | P2 | M | C03 |
| D03 | Educator enablement | Teachers can be ethical multipliers without turning the site into a learner-surveillance platform. | Co-design private, printable/exportable lesson packs: passage, selected evidence, prompts, citations, access notes, and local answer space; no learner dashboard. | 6–8 contrasting educators run a real 20-minute lesson; pack is usable, cited, accessible, and creates no student data store. | Education lead | P2 | L | C02, A01 |
| D04 | Community boundaries | Contributions can broaden readings but introduce moderation, safety, authority, privacy, and rights risks. | Before any social feature, publish contribution scope, scholarly review, conflicts, attribution/pseudonymity, rights grant, appeals, abuse response, archival/versioning, and shutdown plan. | Independent safety, legal, privacy, accessibility, and scholarly reviews approve a limited pilot; moderation capacity exists before launch. | Community lead + counsel | P2 | L | L01–L04, C05 |
| M01 | Outcomes | Page views and time-on-site conflict with the mission. | Adopt the existing mission measures: meaningful start, anchored observation, evidence test, revisit, transfer; pair all with accessibility, privacy, performance, and false-certainty guardrails. | Every experiment names one primary outcome, guardrails, decision threshold, owner, and removal condition before data collection. | Research lead | P0 | S | P03 |
| M02 | Baseline | Current scores are heuristic and must not become unearned claims. | Run 18–24 moderated sessions across new readers, regular readers, Arabic learners, advanced study, teachers, and access/low-bandwidth users; record behavior before preference. | Breakdown map is tagged by severity, frequency, audience, core stage, evidence, and confidence; findings are de-identified. | Research lead | P0 | L | P03, A01 |
| M03 | Decision discipline | Small studies reveal breakdowns but do not establish universal effects. | Predefine **ship / revise / stop** rules; triangulate task behavior, comprehension, accessibility, and delayed transfer; publish contrary findings and limitations. | Decision log exists for every production experiment; no feature ships solely because clicks/time increase. | Research lead + project lead | P1 | S | M01 |
| S01 | Sustainability | A highly specialized platform faces bus-factor and continuity risk. | Document restore-from-backup, domain/hosting access, deployment, source acquisition, key rotation, data regeneration, emergency banner, maintainer succession, and archive/read-only mode. | A backup maintainer completes a clean-room restore drill; recovery time and unresolved gaps are recorded annually. | Project lead + maintainer | P1 | M | G02, R04 |

## Sequenced 90-day roadmap

### Implementation record — first protection-and-clarity wave

The first implementation wave converts several P0 recommendations into visible
reader controls. “Shipped” records implementation, not proof of effectiveness;
the acceptance measures in the action register still require reader and
assistive-technology validation.

| Action | Shipped control | Remaining validation gate |
|---|---|---|
| G01, G03 | A reader-facing trust hub now joins verification, correction, accessibility, rights, changes, privacy, and response targets; claim popovers link directly to a prefilled correction route. | Test whether new and expert readers can find all three routes in no more than two actions; audit correction response times. |
| P01, P02, P04 | The privacy/data section now distinguishes preferences/progress, passage cache, pinned references, worksheets, and notes; it explains clearing boundaries, device loss, export/deletion, the optional external passage service, connection metadata, cache, and offline fallback. Read provides notice at the point of request, and Settings names exactly what it clears. | Verify every storage key/network destination against browser observation; test reader predictions and third-party-blocked flows. |
| A05 | A candid accessibility statement publishes the intended baseline, known manual-test areas, barrier-report route, and service targets without claiming certification. | Complete A01–A04 with disabled readers and update the statement with dated results. |
| R03 | Dedicated public issue templates steer corrections and accessibility reports away from private notes and unnecessary sensitive data. | Threat-model all public intake and test triage/escalation. |
| U05 | Notes now state their device boundary beside the writing surface and offer export, single deletion, and explicit delete-all. | Test export/deletion, accidental-loss comprehension, keyboard/screen-reader flow, and recoverable error states. |

This record should be extended only when a recommendation becomes a concrete
control; validated outcomes belong in the public transparency note and research
decision log, not in promotional copy.

| Window | Must complete | Exit gate |
|---|---|---|
| **Days 0–14: establish safety and evidence** | Assign RACI (G02); build data map (P01); open legal/rights review (L01–L04); define outcomes (M01); list representative templates; create accessibility, security, and fault audit briefs (A01, R03, U06); specify one release command (R04). | No unknown owner for a P0 risk; research cannot begin without privacy/ethics artifacts; critical release checks are identified. |
| **Days 15–30: test the actual journey** | Run accessibility/assistive-tech review (A01–A04); start contrasting reader baseline (M02); test trust labels (C03); prototype storage notice (P02); inventory content/IA (C01, U02); publish accessibility and correction routes in the governance hub (G01, G03, A05). | Critical access/security/source defects are fixed or affected functions are transparently limited; baseline evidence replaces heuristic assumptions. |
| **Days 31–60: clarify and harden** | Prototype focused entry (U01), search recovery (U04), return question (U05), error recovery (U06), translation posture (C04); implement resilience/performance budgets (R01–R02); finalize controlled vocabulary (U03, L03); counsel reviews public policy copy. | Each change beats/control-matches mission comprehension and guardrails; core journey works with third parties blocked and on target access scenarios. |
| **Days 61–90: validate learning and prepare responsible reach** | Run guided-learning delayed test (C02); complete release gate (R04); publish first transparency note (G04); validate metadata/share templates (D01–D02); co-design educator pack without student data (D03); conduct restore drill (S01). | Quarterly decision review ships, revises, or removes each experiment; no reach initiative launches with an open critical P0 issue. |

## Measurement framework

| Outcome | Exact operational definition | Collection method | Never collect | Decision use |
|---|---|---|---|---|
| Meaningful start | Reader opens a passage and performs one substantive study action. | Moderated task coding; optional coarse local session counter with explicit research consent. | Search text, verse content, identity, belief. | Entry and navigation experiments. |
| Anchored observation | Reader records a note tied to a verse, root, recurrence, comparison, or section. | Count event only; human rubric on volunteered research artifacts. | Production note text. | Learning prompts and tool relevance. |
| Evidence test | Reader opens and can accurately explain a claim's source/status/method or limit. | Task completion plus comprehension question. | General browsing history. | Trust-layer decisions. |
| Revisit | On a later day, reader returns to a saved passage/question and takes a relevant action. | Local, coarse event or a consented diary. | Cross-site/device fingerprinting. | Return experience, never reminders or streaks. |
| Transfer | After 48–72 hours, reader applies the method to an unfamiliar passage. | Consented moderated follow-up scored with a preregistered rubric. | Unnecessary demographics or devotional judgments. | Strongest evidence for learning-value claims. |
| Trust calibration | Confidence tracks correct classification of computed, sourced, editorial, and personal material. | Confidence + accuracy paired per task. | Ideological profiling. | Guardrail for every evidence/design change. |
| Equitable completion | Core outcome completion and rescue rate by access scenario and study background. | Small-sample diagnostic comparison; report uncertainty, not rankings of people. | Sensitive category data without necessity and explicit consent. | Blocks release when a core group loses access. |

### Minimum experiment card

Every proposed change must record:

1. reader and real job;
2. observed problem and evidence strength;
3. hypothesis and smallest reversible prototype;
4. control/current experience;
5. primary outcome, trust/access/privacy/performance guardrails, and harmful
   side effects;
6. recruitment and exclusion rationale;
7. ship, revise, stop, and removal thresholds;
8. owner, review date, result, contrary evidence, and decision.

## Public-engagement ladder

Do not treat “the public” as one audience or move everyone toward the same
depth. Design voluntary transitions.

| Audience/job | First useful object | First useful action | Evidence needed now | Respectful next step |
|---|---|---|---|---|
| New or curious reader | A short passage with clear surah/verse context | Read, then mark one noticed repeat or shift | Plain distinction between Qur'an, translation, and site prompt | Open the full surah or optional method |
| Regular non-Arabic reader | Familiar surah and translation comparison | Compare a chosen phrase | Translator/edition and Arabic dependency | Inspect root/morphology or save a question |
| Arabic learner | Word in passage and morphology | Trace lemma/root across contexts | Corpus source, tagging limits, pronunciation support | Compare occurrences, not infer meaning from root alone |
| Advanced student/scholar | Claim, structure, data, and cited source | Recompute, challenge, or submit correction | Full derivation, version, source pages, limitations | Review another claim or contribute evidence |
| Teacher/facilitator | Clean passage plus selected prompt/evidence | Prepare a private lesson pack | Citation, access guidance, no student tracking | Print/export and report classroom findings |
| Access/low-bandwidth reader | Lightweight text-first path | Complete the same core journey | Known limitations and direct support route | Choose richer media only on request |
| Skeptical verifier | Canonical claim ledger and reproducible dataset | Follow source → method → output | Rights, provenance, code/data version, correction history | Download/recompute or report a discrepancy |

## Explicit non-goals

- No streaks, devotion scores, leaderboards, attention traps, endless feeds, or
  shame-based reminders.
- No personalized doctrinal conclusions, automatic commentary, or opaque
  recommendations.
- No public reading history, notes, profiles, social graph, direct messaging,
  or learner-surveillance dashboard.
- No account wall before reading and no cross-device sync until necessity,
  encryption, consent, recovery, abuse, and deletion are independently reviewed.
- No conformance, legal-compliance, scholarly-consensus, or learning-effect claim
  based only on this document or automated checks.
- No reach campaign whose support, correction, moderation, accessibility, and
  incident-response capacity has not been funded with people and time.

## Standards and authoritative reference set

Use these as baselines, then obtain specialist review for the jurisdictions,
audiences, and actual deployment in scope:

- W3C, [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/),
  [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/), and
  [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/).
- W3C, [Cognitive Accessibility Guidance](https://www.w3.org/TR/coga-usable/)
  and [Internationalization: Authoring HTML](https://www.w3.org/International/techniques/authoring-html).
- web.dev, [Core Web Vitals](https://web.dev/articles/vitals) for the stated
  LCP, INP, and CLS reference thresholds; performance remains a user outcome,
  not an SEO-only score.
- UK ICO, [data protection by design and default](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/accountability-and-governance/data-protection-by-design-and-default/)
  and [children and the UK GDPR](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/).
- European Data Protection Board, [Guidelines 4/2019 on Article 25 Data
  Protection by Design and by Default](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42019-article-25-data-protection-design-and_en).
- U.S. Copyright Office, [Copyright basics](https://www.copyright.gov/circs/circ01.pdf),
  alongside license-specific terms and jurisdiction-specific counsel.

These references do not determine which laws apply and this review is not
legal advice. The legal action register deliberately requires counsel to define
jurisdiction, publisher status, audience, data roles, and obligations before
public compliance claims are made.

## Definition of excellence after one quarter

The programme is succeeding if readers reach relevant Qur'anic text with fewer
wrong turns; complete the core sequence across access scenarios; accurately
distinguish evidence layers; resume an unresolved question without pressure;
show delayed method transfer in at least one tested interaction; can inspect,
correct, export, and delete without surrendering private reading data; and see
public evidence of how the project governs sources, corrections, access, and
change. It is **not** succeeding merely because traffic, clicks, time, or feature
count rises.
