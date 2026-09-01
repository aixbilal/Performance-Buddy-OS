# 07 — CONSOLIDATED V2 MASTER BLUEPRINT

Date: 2026-09-01
Status: IMPLEMENTATION-LOCKED CONSOLIDATION
V1: frozen at v1.0.0-rc.2
Source: consolidated verbatim from `PBOS-V2-CLAUDE-CODE-MASTER-GIGA-PROMPT.md` §4–§19.
Discovery inputs: Passes 1–6 in this folder (LOCKED).

This document is the single implementation reference for V2. It re-states the
locked architecture from the master prompt without re-interpretation or scope
expansion. Where an older `docs/27 - V2 Adaptive Coach/` note conflicts with this
document, this document wins. For visual language, `DESIGN.md` remains canonical.
For canonical persisted data, the running relational domain model + migration
architecture remain authoritative unless this document explicitly adds a V2
field/table.

---

## §3. V2 PRODUCT MISSION

Central success statement:

> I use PBOS more, but I operate PBOS less.

Canonical operating loop:

GOAL → SYSTEM → ACTION → PLANNER → CALENDAR → TODAY → EXECUTION → EVIDENCE →
DOMAIN STATE → ANALYTICS → REVIEW → INTELLIGENCE → RECOMMENDATION →
USER DECISION → VALIDATED APPLY → RE-PLANNING

Daily product flow:

**PBOS prepares → user lives → user captures reality once → PBOS structures it →
PBOS adapts → user approves meaningful changes.**

Permanent semantic laws:

- ACTION ≠ PLANNING BLOCK ≠ COMPLETION.
- ACTIVITY ≠ OUTCOME ≠ MASTERY.
- PROFESSOR COVERAGE ≠ PERSONAL STUDY ≠ MASTERY.
- UNKNOWN ≠ ZERO.
- CORRELATION ≠ CAUSATION.
- AI SUGGESTION ≠ TRUTH.
- AI proposes. Deterministic rules validate. The user decides. Canonical domain
  systems apply. SQLite remains authoritative.

---

## §4. CONSOLIDATED V2 ARCHITECTURE — SEMANTIC FAMILIES

Three families. They may reuse shared UI primitives but must NOT collapse into
one generic AI card/model.

### §4.1 Capture Proposal — "PBOS thinks this is what the user told it happened."

Tied to raw user input. Persisted classes: `fact`, `interpretation`.

A system-generated recommendation is never stored as an applied Capture fact. If
Natural Capture reasoning proposes "what the user should do", that becomes a
separate **Intelligence Recommendation**.

### §4.2 Intelligence Recommendation — "PBOS thinks this change may help."

Uses/extends the existing durable Recommendation + DecisionEvent architecture:
proposal → Accept/Modify/Reject → deterministic validation → allowlisted Apply.

### §4.3 Planning Diff — "This is how the canonical plan would change."

Separate from an AI Recommendation and from Capture. Contains typed schedule
changes + inverse information. Must support: review, selective
acceptance/modification where valid, final whole-state validation, Apply,
practical Undo.

---

## §5. SHARED EXPLICIT MUTATION ENGINE

Create a shared explicit mutation layer, preferably `app/src/domains/mutations/`
(use repo naming conventions after inspection).

Every mutation in an explicit `MutationKind` registry has:

- kind
- domain
- deterministic `validate`
- entity resolution if needed
- `describeCurrent`
- `preview`
- `apply`
- optional `triggersReplan`
- canonical revision/audit behavior

Unknown mutation kind → rejected. There must be NO generic `applyPatch`,
`writeTable`, arbitrary model-provided Tauri command, raw SQL selected by AI, or
"update any entity" adapter.

Migrate/reuse existing `intelligence/applyAdapters.ts` behavior through this
registry — not two diverging apply systems.

Minimum required kinds:

- `create-action`
- `create-expense`
- `routine-checkin`
- `set-professor-coverage`
- `set-personal-study`
- `create-assessment`
- `update-assessment-date`
- `update-assessment-scope`
- `create-language-session`
- `set-today-capacity`
- `schedule-block`
- `set-knowledge-review`
- `adjust-routine-cadence`
- `adjust-routine-window`
- `adjust-routine-duration`
- `adjust-routine-days`

Do not add a kind unless it maps to a real canonical domain operation with
deterministic validation. Focused tests for every kind added.

---

## §6. DATABASE MIGRATION — SCHEMA V11

Current schema is v10. Add ONE forward-only **v11** migration after full design.
Do not rewrite migrations 1–10. v11 must be non-destructive and preserve existing
user data. Implement these unless inspection proves an equivalent canonical table
already exists.

### §6.1 `academic_assessment_topics`

Explicit Assessment ↔ Academic Topic scope.

| column | definition |
| --- | --- |
| `assessment_id` | `TEXT NOT NULL REFERENCES academic_assessments(id) ON DELETE CASCADE` |
| `topic_id` | `TEXT NOT NULL REFERENCES academic_topics(id) ON DELETE CASCADE` |
| `source` | `TEXT NOT NULL DEFAULT 'user'` |
| `created_at` | `TEXT NOT NULL` |
| PK | `(assessment_id, topic_id)` |

Add useful indexes. TS/Rust validation must reject a topic that belongs to a
different course from the assessment. Do not infer scope merely because a topic
exists in the course.

### §6.2 `capture_proposals`

One Capture Inbox row may own many reviewable proposals.

| column | definition |
| --- | --- |
| `id` | `TEXT PRIMARY KEY NOT NULL` |
| `capture_id` | `TEXT NOT NULL REFERENCES capture_inbox(id) ON DELETE CASCADE` |
| `proposal_class` | `TEXT NOT NULL` (`fact` \| `interpretation`) |
| `domain` | `TEXT NOT NULL` |
| `mutation_kind` | `TEXT NOT NULL` |
| `title` | `TEXT NOT NULL` |
| `source_text` | `TEXT NOT NULL DEFAULT ''` |
| `confidence` | `TEXT NOT NULL DEFAULT 'needs-review'` (`clear` \| `needs-review` \| `ambiguous`) |
| `ambiguity_reason` | `TEXT` |
| `rationale` | `TEXT NOT NULL DEFAULT ''` |
| `evidence_json` | `TEXT NOT NULL DEFAULT '[]'` |
| `original_params_json` | `TEXT NOT NULL DEFAULT '{}'` |
| `effective_params_json` | `TEXT NOT NULL DEFAULT '{}'` |
| `status` | `TEXT NOT NULL DEFAULT 'proposed'` (`proposed` \| `accepted` \| `modified` \| `rejected` \| `applied` \| `apply-failed`) |
| `validation_json` | `TEXT` |
| `applied_result_json` | `TEXT` |
| `created_at` | `TEXT NOT NULL` |
| `decided_at` | `TEXT` |
| `applied_at` | `TEXT` |

Keep existing `capture_inbox` fields (do not drop V1 `proposed_type` /
`parsed_payload`). Backward-compatible/idempotent repository path for existing
capture rows — existing unresolved V1 captures must not disappear.

### §6.3 `action_scheduling_constraints`

Structured scheduling constraints attach to canonical Actions (not another task
list).

| column | definition |
| --- | --- |
| `action_id` | `TEXT PRIMARY KEY NOT NULL REFERENCES actions(id) ON DELETE CASCADE` |
| `required_before` | `TEXT` |
| `earliest_date` | `TEXT` |
| `preferred_time_window` | `TEXT` (`morning` \| `day` \| `evening` \| `anytime`) |
| `minimum_block_minutes` | `INTEGER` |
| `splittable` | `INTEGER NOT NULL DEFAULT 0` |
| `source` | `TEXT NOT NULL DEFAULT 'user'` |
| `created_at` | `TEXT NOT NULL` |
| `updated_at` | `TEXT NOT NULL` |

`Action.estMinutes` remains the total estimate — do not duplicate it here.
Default `splittable = false`.

### §6.4 `planning_occurrence_exceptions`

A recurring weekly PlanningBlock must not be destroyed when one occurrence
changes.

| column | definition |
| --- | --- |
| `id` | `TEXT PRIMARY KEY NOT NULL` |
| `block_id` | `TEXT NOT NULL REFERENCES planning_blocks(id) ON DELETE CASCADE` |
| `occurrence_date` | `TEXT NOT NULL` |
| `state` | `TEXT NOT NULL` (`skipped` \| `done` \| `deferred`) |
| `replacement_block_id` | `TEXT REFERENCES planning_blocks(id) ON DELETE SET NULL` |
| `source` | `TEXT NOT NULL DEFAULT 'user'` |
| `note` | `TEXT NOT NULL DEFAULT ''` |
| `created_at` | `TEXT NOT NULL` |
| `updated_at` | `TEXT NOT NULL` |
| UNIQUE | `(block_id, occurrence_date)` |

Exception layer, NOT another Planner/Calendar database. One-off move/defer of a
recurring block: persist an exception for the original occurrence; create a
concrete date-pinned replacement block when applicable; never rewrite the
recurring template unless the user explicitly edits the recurring template.

### §6.5 `planning_change_sets`

Durable Planning Diff / audit / undo unit.

| column | definition |
| --- | --- |
| `id` | `TEXT PRIMARY KEY NOT NULL` |
| `scope` | `TEXT NOT NULL` (`micro` \| `day` \| `week`) |
| `status` | `TEXT NOT NULL` (`proposed` \| `applied` \| `rejected` \| `apply-failed` \| `undone`) |
| `target_start_date` | `TEXT` |
| `target_end_date` | `TEXT` |
| `rationale` | `TEXT NOT NULL DEFAULT ''` |
| `reason_codes_json` | `TEXT NOT NULL DEFAULT '[]'` |
| `changes_json` | `TEXT NOT NULL DEFAULT '[]'` |
| `inverse_changes_json` | `TEXT NOT NULL DEFAULT '[]'` |
| `source` | `TEXT NOT NULL DEFAULT 'adaptive-planning'` |
| `created_at` | `TEXT NOT NULL` |
| `decided_at` | `TEXT` |
| `applied_at` | `TEXT` |
| `undone_at` | `TEXT` |

`changes_json` typed/validated at the TS boundary even if Rust stores opaque
JSON. Do not store another full canonical schedule here — only proposed changes +
inverse changes.

### §6.6 `today_operating_state`

Persist ONLY subjective daily operating capacity.

| column | definition |
| --- | --- |
| `date` | `TEXT PRIMARY KEY NOT NULL` |
| `capacity_level` | `TEXT NOT NULL DEFAULT 'normal'` (`low` \| `normal` \| `high`) |
| `source` | `TEXT NOT NULL DEFAULT 'user'` (`user` \| `capture-approved`) |
| `note` | `TEXT NOT NULL DEFAULT ''` |
| `created_at` | `TEXT NOT NULL` |
| `updated_at` | `TEXT NOT NULL` |

Do not persist current/next block, gaps, overload, fragility, or "what to do
now" — those are derived.

### §6.7 Migration tests (Rust)

Prove: v10 → v11 migrates; migration idempotent; old rows remain; FK
delete/update behavior correct; same-course assessment-scope validator works;
capture proposal rows round-trip; occurrence exception survives close/reopen;
planning change set survives close/reopen; today capacity survives close/reopen;
exact schema version becomes 11.

Do not run a packaged/native app against the user's durable DB until this
migration is final and tests pass.

---

## §7. NATURAL CAPTURE — EVOLVE THE EXISTING CAPTURE DOMAIN

`app/src/domains/capture/` already has a durable Quick Capture inbox with the
correct "raw input owns nothing downstream" philosophy. Evolve it. Do NOT create
`natural-capture-v2` as a parallel store.

### §7.1 Flow

raw text saved locally FIRST → deterministic local segmentation/classification →
permission filtering → optional remote provider enhancement → entity resolution →
duplicate/evidence resolution → multi-proposal bundle → user Accept/Modify/Reject
→ shared Mutation Engine validation → canonical Apply → revision/audit → optional
separate Intelligence Recommendation(s).

### §7.2 Parser / proposal shape

One capture may produce multiple `CaptureProposal`s. Each proposal visibly
distinguishes **You said** (fact) vs **PBOS interpreted** (interpretation). Do
not store "PBOS recommends" as a Capture Proposal. No fake numeric confidence.

### §7.3 Entity resolution

Resolve existing first (e.g. "DSA" → existing Data Structures course if
unambiguous; "German" → existing language path if unambiguous; routine text →
existing routine). If ambiguous: surface selection, do not guess. New canonical
entity creation must be explicit/reviewable.

### §7.4 Duplicate evidence

If PBOS already recorded a matching Focus/session event and the user says
approximately the same thing, detect it. Canonical PBOS event outranks
approximate text. Offer: reuse existing evidence / record separately. Do not
double-log by default.

### §7.5 Multi-domain examples to support

academic professor coverage; assessment/date/scope; personal study
interpretation; expense; language session; routine check-in; Action/planning
intent. Unclassifiable text remains safely in Capture Inbox.

### §7.6 Privacy / permission rule (non-negotiable)

Do NOT send a whole mixed capture to a remote provider when it may include a
no-access domain. Local deterministic segmentation/classification first. Only
send a segment for remote enhancement if a domain is identified locally with
sufficient safety AND that domain has at least Read permission. Unclassified /
possibly-no-access segments stay local and marked for review. Money remains
`no-access` by default. No secrets in logs/tests/screenshots.

### §7.7 Provider failure

Raw capture remains durable; deterministic proposals remain usable; unparsed
segments stay unprocessed; user can retry or manually classify. No data loss.

### §7.8 Natural Capture UI

Not a major sidebar nav item. A global accessible drawer/overlay from Today,
Command Palette, keyboard shortcut, contextual Capture update buttons.
`/capture-inbox` stays the durable unresolved/history route (evolve its UI).
Drawer states: idle, typing, parsing, proposal ready, clarification/ambiguity,
editing proposal, validation error, applying, applied, provider unavailable,
offline/local saved, duplicate detected, permission limited, no meaningful
structure. Avoid chatbot bubbles, AI orb graphics, neon/purple/cyan "AI"
styling.

---

## §8. EVIDENCE PROPAGATION / FOCUS

Preserve the existing links Focus Session → Action, PlanningBlock, Course,
Academic Topic, Knowledge Topic. When Focus starts from Today/Study/Planner, pass
all known context.

On completion:

- Focus duration is canonical activity evidence. Do not ask the user to re-enter
  duration.
- Do not mark an Action complete solely because Focus ended.
- Do not increase Knowledge mastery solely because time elapsed.
- Do not automatically increase Personal Study percentage from minutes alone.
- Today derives planned-vs-actual from linked Focus sessions.
- A linked recurring Planning occurrence is resolved by occurrence state, not by
  mutating the recurring template.

Post-study UI asks only missing human truth: outcome/understanding if needed;
personal coverage update if desired; mastery/recall check now/later. No duplicate
activity table.

---

## §9. ASSESSMENT SCOPE + ACADEMIC INTELLIGENCE

Extend the current Academics domain; do not replace it.

### §9.1 Assessment Scope

Update types, repo, Rust commands, store, Course Detail / Assessment form UI,
tests. Store APIs: `getTopicsForAssessment`, `setAssessmentScope` /
`updateAssessmentScope`, assessment scope resolution. Scope editor allows only
topics in the same course. Natural Capture may propose scope links. Unknown scope
remains unknown.

### §9.2 Academic study engine

Preserve current reason-code philosophy. Add factual reason signals: assessment
upcoming; explicitly in nearest relevant assessment scope; higher assessment
weight as a tie-breaker/context; professor-covered-not-studied; weak Knowledge
evidence; no evidence; review due; repeated unresolved weakness; recently
studied.

Do NOT create a universal `priorityScore: 87`. Rank with inspectable
deterministic comparators. Use actual assessment dates directly.

Ordering:

- **Normal**: due review / keeping pace → nearest scoped assessment risk →
  professor covered but not studied → weak/no evidence → in-progress/not-started.
- **Midterm/Final**: topics explicitly in the relevant upcoming assessment scope
  and unresolved → then other taught weak/review items. Never assume all topics
  are in scope; never assume a final is cumulative without scope data.
- **Recovery**: smallest useful restart among weak/covered/no-evidence items; no
  backlog punishment.

Where multiple options are similarly justified, expose alternatives.

### §9.3 Study Requirement

Transient typed `StudyRequirement` / `PlanningCandidate`, not another persisted
task table. May contain: course/topic, reasons, requiredBefore,
estimate/suggested duration, minimum block duration, evidence state, linked
existing Action if found. "Plan this" → reuse an existing Action if appropriate,
else propose/create a canonical Action; attach Action scheduling constraints when
needed; send the candidate to deterministic Planning. Academic Intelligence never
writes arbitrary timestamps.

### §9.4 Course-level attention (derived; never mutates `Course.status`)

- **Immediate**: upcoming assessment AND relevant unresolved prep signal.
- **Watch**: meaningful coverage/evidence/review gap but no immediate assessed
  pressure.
- **Stable**: no material current attention signal.

Expose reasons.

### §9.5 Grades

No AI SGPA/CGPA arithmetic authority; no score→letter inference without verified
policy; no guessed repeat-course replacement; incomplete weighting configuration
limits conclusions.

---

## §10. ADAPTIVE PLANNING

Keep the current Planning store as the ONE scheduled-block truth. Do not add
another CalendarEvent list.

### §10.1 Concrete-date adaptive engine

Keep existing deterministic conflict/capacity functions. Add a V2 concrete-date
candidate placement engine over a real ISO-date horizon. Inputs: canonical blocks
resolved per date; occurrence exceptions; capacity; fixed/locked/manual protected
blocks; candidate constraints; existing generated flexible blocks; planning scope
(micro/day/week). One-off generated adaptive work is generally date-pinned
(`date != null`), not accidentally recurring weekly.

### §10.2 PlanningCandidate (transient)

id; sourceDomain; sourceEntityType/id; actionId nullable; title; context;
estMinutes; requiredBefore; earliestDate; preferredTimeWindow;
minimumBlockMinutes; splittable; reasonCodes; priority. Do not persist a generic
WorkCandidate table. Persistent user scheduling constraints belong on canonical
Action through `action_scheduling_constraints`.

### §10.3 Placement rules (deterministic)

1. no overlap
2. daily capacity must hold
3. weekly capacity must hold
4. fixed blocks not moved by adaptive generation
5. locked blocks survive
6. manual blocks survive by default
7. only explicitly released manual flexible blocks are eligible for movement
8. generated flexible blocks are safest to reconsider
9. respect required-before
10. respect earliest date
11. honor minimum useful duration
12. split only when `splittable=true`
13. honor preferred time window when feasible
14. minimize plan churn
15. among equally valid plans, prefer healthier buffer/less fragility
16. Could Not Fit remains a valid result

No hidden productivity score. Stable deterministic tie-breakers, tested.

### §10.4 Change cost

Do not move an existing valid block just because another equivalent slot exists.
Prefer stability.

### §10.5 Adaptation scopes

micro = one block/gap/problem; day = one date; week = broad rebalance. Use the
smallest scope that resolves the issue.

### §10.6 Planning Diff

Typed changes: keep, add, move, shorten, defer, drop-occurrence,
mark-occurrence-done, mark-occurrence-skipped. `Could Not Fit` is explanatory
output, not a mutation. Diff UI shows: What changed, Why, Protected items, Could
Not Fit items, What accepting will do. User can select/modify when safe. Then:
build final candidate schedule → validate all selected changes together → only
then Apply. Apply must be atomic (Rust transaction or equivalent repository
transaction command) — never present a partially applied diff as success. Persist
inverse changes for practical Undo.

### §10.7 Recurring occurrence semantics

Do NOT use a recurring `PlanningBlock.status` to represent one week's completion.
Use `planning_occurrence_exceptions`.

- Skip this Tuesday only: create occurrence exception; recurring template
  remains.
- Move this Tuesday only: defer/skip original occurrence exception; create
  date-pinned replacement block; link replacement in exception.
- Edit every Tuesday: user explicitly edits recurring template.

Tests for all three.

---

## §11. ADAPTIVE TODAY

Evolve existing `TodayPage.tsx`. Create a deterministic `todayEngine.ts` (or
equivalent) — pure/testable, accepts `now` explicitly.

Derive: current fixed commitment; current planned block; next planned block;
earlier blocks; linked Action live state; actual Focus minutes linked to planning
block; elapsed unresolved occurrences; free gap; remaining planned minutes;
day/weekly capacity state; fragility/overload; daily Low/Normal/High capacity;
protected/locked state; relevant academic/knowledge/routine attention candidates.

### §11.1 Follow Plan vs Adaptation Needed

FOLLOW PLAN when current intent remains valid — no constant AI noise. ADAPTATION
NEEDED only for material divergence: a block elapsed unresolved; fixed commitment
shifted/appeared through approved capture; remaining plan cannot fit; user
capacity explicitly changed; new assessment/deadline materially changes
priorities; Focus completion changes remaining work; user explicitly asks to
rework today.

### §11.2 Precedence

Fixed commitment > locked/protected user intent > canonical completion/evidence >
explicit user instruction > deterministic urgency/capacity > AI-assisted
prioritization > generic recommendation.

### §11.3 Time passing

Passing the block end time does NOT equal missed. Derived occurrence states:
planned, active, completed/done, elapsed-unresolved, skipped, deferred. Unknown
stays unknown.

### §11.4 Buffer

Do not automatically fill free time. A valid answer: "No urgent work needs this
gap; keep the buffer."

### §11.5 Daily capacity

Persist only Low / Normal / High. Default Normal. Never infer Low from clock time
alone. Natural Capture may propose Low/High from an explicit statement; user
confirms. Do not rewrite persistent Planner capacity.

### §11.6 Today UI hierarchy (DESIGN.md; Primary → Secondary → Tertiary)

- **Primary — NOW**: exact current/best action; duration/context; Start/Continue
  Focus; short reason only if adaptive.
- **Secondary — TODAY**: earlier / now / next / later; planned vs actual.
- **Conditional — ADAPTATION** (only when meaningful): changed facts; diff
  summary; Review changes.
- **Input — NATURAL CAPTURE**: compact entry.
- **Tertiary**: small metrics/state strip.

Do not regress to equal stat cards.

---

## §12. KNOWLEDGE INTELLIGENCE

Preserve: mastery computed from Knowledge Evidence; review date separate from
mastery; Obsidian note-body ownership.

### §12.1 Generate Recall

Contextual Knowledge action "Generate Recall". Use the existing AI provider only
when AI is enabled/available, Knowledge has appropriate permission, and the user
explicitly invokes it. Generic AI context must NOT contain Obsidian note bodies.
If the user selects a linked Obsidian note/source, an on-demand preview may be
included in this scoped request (not persisted as another note body). Generate
structured recall/practice items. Reuse existing `mastery_checks` for the
governed session — no permanent AI question bank table. AI-generated questions
alone do NOT create Knowledge Evidence or change mastery. Only after the user
completes/evaluates a governed check may the existing explicit evidence path
create Knowledge Evidence. Tests must prove this.

### §12.2 Contextual Knowledge intelligence

Surface: evidence gap; review due; method suggestion; source suggestion. Compact,
evidence-based explanation. No vector database / heavy RAG in this run.

---

## §13. ROUTINE INTELLIGENCE

Keep current schedule-aware streak-free consistency. Create deterministic pattern
candidate logic.

Conservative minimum evidence:

- No structural pattern recommendation with fewer than **6 comparable expected
  opportunities**.
- Direct bucket comparison (e.g. morning vs evening) requires at least **4
  comparable opportunities in each bucket**.

Keep thresholds in one obvious constant/config module + tests.

Potential deterministic pattern facts: repeated missed/partial cluster in a time
window; consistent underperformance on specific scheduled days; cadence appears
too aggressive; duration target repeatedly only partially completed.

Remember: rest is excused; skipped is excused; pending today is not missed;
schedule passage is not completion.

AI may explain a pattern and propose: cadence, time window, duration, scheduled
days, pause. Every structural change requires Accept / Modify / Reject and goes
through explicit mutation validation. No streaks, XP, badges or moral scoring.

---

## §14. AI COACH + CONTEXTUAL INTELLIGENCE

Keep the current provider abstraction and permission model. AI Coach V2 role:
deep reasoning / exploration / alternatives / cross-domain trade-offs. Ordinary
domain intelligence answers in-domain (Academics: "What should I study next?";
Today: "What should I do now?"; Planner: "Where can this fit?"; Knowledge: "What
needs review/evidence?"; Routine: "What pattern may need adjustment?"). AI Coach
is for "Why?", "Compare alternatives.", "What happens if I protect X?",
"Rebalance with these constraints."

### §14.1 Recommendation sources

Extend TS source union while preserving compatibility. New sources: contextual,
capture, adaptive-today, academic, knowledge, routine, planning. Existing values
stay valid.

### §14.2 AI context

Feed AI deterministic derived facts. Good: `AVL: evidence state learning; review
due`. Bad: send all raw evidence and ask the model to calculate mastery. Good:
`Wednesday: 50 usable minutes before fixed class`. Bad: ask model to calculate
calendar overlap. No raw note bodies or unnecessary sensitive data in generic
`domainFacts`.

### §14.3 Permissions

Maintain no-access / read / read-recommend. Context = requested domains INTERSECT
permitted domains. Money remains no-access by default. Do not broaden permission
defaults to make Capture/AI work.

### §14.4 Provider failure

When provider unavailable: Today deterministic engine works; Planning
deterministic engine works; Academics study engine works; Knowledge
evidence/review works; Routine consistency/pattern facts work; Natural Capture
raw text persists and deterministic parsing works. AI provider availability is
never a core app availability condition.

---

## §15. SCREEN IMPACT / UI WORK

Do not rebuild every screen.

**Major evolution**: TodayPage, CaptureInboxPage, PlannerPage,
AcademicsOverviewPage, CourseDetailPage, NormalStudyPage,
Knowledge/TopicDetailPage, AICoachPage, WeeklyReviewPage.

**Moderate evolution**: CalendarWeekPage, MasteryCheckPage, KnowledgeOverviewPage,
NotesHubPage, RoutinesOverviewPage, RoutineDetailPage, AICoachWorkspacePage,
AICoachPermissionsPage, FocusPage, AnalyticsOverviewPage, PatternsPage,
SettingsPage, Command Palette/search surfaces.

**Minor contextual integration**: Goals / Goal Detail, Development, Fitness,
Reading & Language, Money, Daily Routine Check-In, SGPA/CGPA, builder forms except
Assessment scope changes, Onboarding only if existing AI setup needs a tiny V2
text/permission adjustment.

**Keep**: Splash/startup behavior unless a real implementation requirement
appears.

### §15.1 Reusable primitives

Search existing PBOS components first. Add only if needed: `NaturalCaptureDrawer`,
`CaptureProposalBundle`, `CaptureProposalItem`, `ProposalOriginLabel`,
`ReasonList`, `PlanningDiffReview`, `PlanningDiffRow`, `AdaptiveNowSurface`,
`ContextualInsight`, `AttentionSignal`, `ConfidenceLabel`, `ChangePreview`. Use
existing `Button`, `Card`, `Badge`, forms, dialogs/drawers, icons. External
sourcing order: existing PBOS → 21st.dev → Magic UI → Vengeance UI → UILora →
DevUI (borrow interaction behavior only; remap to PBOS tokens; strip decorative
effects/deps; do not redesign identity). Agent Browser for interactive visual QA.
Impeccable as refinement/audit vocabulary within DESIGN.md.

### §15.2 Visual locks

matte black / graphite / gunmetal; restrained steel blue-grey; calm / engineered
/ premium; primary-secondary-tertiary hierarchy; fewer equal cards; state glow
only; no gaming; no cyberpunk; no RGB; no purple/cyan "AI"; no giant AI orb; no
glass-everywhere; no generic AI-dashboard aesthetic; no raw hex values in
components; preserve reduced motion; keyboard/focus accessible; status never
color-only.

---

## §16. TESTING — TEST EACH PHASE AS COMPLETED

### §16.1 Natural Capture

one raw input → multiple proposals; fact vs interpretation; recommendation
separated into AI Recommendation; unknown field remains unknown; ambiguous entity
needs selection; existing entity resolves without duplicate; existing
Focus/session evidence detected as possible duplicate; selective
Accept/Modify/Reject; final selected bundle validation; provider failure
preserves raw capture; no-access domain segment is not sent remotely;
unclassified segment remains local; existing V1 capture row still loads.

### §16.2 Academic

same-course assessment scope allowed; cross-course scope rejected; unknown scope
not guessed; scoped weak topic receives explainable priority over irrelevant
topic; exam/final mode does not invent scope; grade math unchanged; repeated
unresolved weakness creates method-change reason, not fake mastery change.

### §16.3 Planning

concrete date placement; locked block preserved; manual block preserved by
default; released manual block can be considered; generated block can be
reconsidered; required-before enforced; minimum duration enforced; unsplittable
task not fragmented; splittable task can fragment only when explicitly true;
daily/weekly capacity enforced; Could Not Fit reason; stability/change-cost
tie-breaker; micro/day/week scope; final selected diff validates together; diff
Apply and Undo; recurring skip one occurrence does not alter template; recurring
defer creates replacement + exception; edit recurring template remains explicit
separate operation.

### §16.4 Today

valid plan → no unnecessary adaptation; current fixed commitment wins; current
planned block shown when valid; free-gap candidate fits; buffer can remain empty
intentionally; elapsed without evidence → unresolved, not missed; daily capacity
defaults Normal and is never inferred; Low capacity changes recommendation but
not persistent Planner capacity; linked Focus evidence appears without duplicate
logging; Today does not create second schedule.

### §16.5 Knowledge

Generate Recall with AI off has honest unavailable state; generated questions
alone leave mastery unchanged; completed governed mastery check can create
evidence through explicit action; generic AI context never includes note bodies;
selected note preview is only sent for explicit permitted request.

### §16.6 Routine

fewer than 6 opportunities → no structural pattern recommendation; qualifying
data → explainable pattern; comparison requires 4 per bucket; rest/skipped
excluded correctly; pending today not missed; structural change requires approved
mutation.

### §16.7 Shared mutation registry

unknown kind rejected; invalid params rejected; permission/authority respected;
current/after preview correct; canonical store method called; revision event
created where required; no generic mutation entry point exists.

### §16.8 Rust / Tauri boundary

For every new/changed Tauri command: Rust unit test; TS repo test; exact IPC
payload mock test where relevant. TypeScript field names and Rust serde names are
a real contract (RC1 lesson) — explicitly test exact frontend JSON for every new
wire shape. At least one real SQLite close/reopen persistence test for each new
persisted slice.

### §16.9 E2E (Playwright)

1. Natural Capture mixed-domain text → proposal bundle → selective apply → reload
2. assessment scope → academic study recommendation
3. Adaptive Planning diff → apply → reload
4. recurring occurrence defer/skip → recurring template survives
5. Today follow-plan path
6. Today adaptation-needed path
7. AI provider unavailable → deterministic fallback
8. permissions keep disallowed domain out of AI context
9. Knowledge Generate Recall → explicit evidence path
10. Routine pattern → proposal → approved structure change

Fake provider/deterministic fixtures; never a live paid AI service. Run axe on
materially changed major screens.

---

## §17. UI / VISUAL QA

After functional tests pass for major screens, use the dev build + Agent Browser.
Audit: Today, Natural Capture drawer, Capture Inbox, Planner, Calendar, Academics
Overview, Course Detail, Normal Study, Knowledge Topic Detail, Routine Detail, AI
Coach, Weekly Review. Primary desktop viewport **1440×900**; sanity-check
**1280×800**. Desktop app — no mobile redesigns.

Check: one obvious primary focus; no equal-card regression; calm precise copy; no
UI clipping/overflow; long titles/data; empty states; loading/error states;
keyboard behavior; focus visibility; reduced motion; accessible contrast; AI
proposal styling does not imply authority. Impeccable
critique/layout/quieter/distill/polish/harden only after behavior is correct.

---

## §18. IMPLEMENTATION PHASE ORDER (test after each phase)

| Phase | Scope | Suggested commit |
| --- | --- | --- |
| A | inspect repo/status; baseline tests; write this doc; commit blueprint docs | `docs(v2): lock consolidated master blueprint` |
| B | schema v11 + tables/repos/Rust commands/types/tests — no UI dependency | `feat(v2): add adaptive intelligence persistence foundation` |
| C | shared mutation engine — migrate AI Apply adapters + Capture destinations onto explicit registry, no V1 regression | `refactor(v2): unify validated canonical mutation adapters` |
| D | Natural Capture V2 — multi-proposal, ambiguity, duplicate resolution, permissions, optional provider enhancement, drawer, inbox | `feat(v2): evolve quick capture into natural capture` |
| E | Assessment Scope + Academic Intelligence — schema/store/UI + study reason engine + planning candidate output | `feat(v2): add assessment scope and academic attention intelligence` |
| F | Adaptive Planning — concrete-date placement, constraints, occurrence exceptions, Planning Diff, Apply/Undo | `feat(v2): add adaptive planning diffs and occurrence control` |
| G | Adaptive Today + Focus evidence propagation — pure Today engine + daily capacity + follow-plan/adapt UI | `feat(v2): make Today an adaptive execution surface` |
| H | Knowledge + Routine contextual intelligence — Generate Recall, governed mastery path, routine pattern engine | `feat(v2): add contextual knowledge and routine intelligence` |
| I | AI Coach contextual integration — shared mutations, contextual recommendation sources, deep-reasoning role | `feat(v2): evolve ai coach into contextual reasoning layer` |
| J | Reviews / screen refinement / visual QA — Weekly Review prepopulates factual state; polish major V2 screens within DESIGN.md | `feat(v2): complete review flow and v2 interface integration` |
| K | Full regression — run all required tests/checks and fix failures | — |

---

## §19. REQUIRED COMMANDS BEFORE FINAL REPORT

From `app/`: `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`.
Then: `cargo test --manifest-path src-tauri/Cargo.toml`,
`cargo check --release --manifest-path src-tauri/Cargo.toml`. If those pass and
migration v11 is finalized: `npm run tauri:build`. Native E2E: run
`npm run test:e2e:tauri` if appropriate; respect the known WDIO/Tauri renderer
limitation documented in `CLAUDE.md` (not a V2 product failure); report the exact
result. Do not use a live remote AI provider as acceptance evidence.
