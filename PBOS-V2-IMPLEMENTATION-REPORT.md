# PBOS V2 — IMPLEMENTATION REPORT

Run date: 2026-09-01
Result: **V2 PARTIAL — SAFE CHECKPOINT**
Phases completed: **A, B, C, D, E, F**. Phases **G, H, I, J, K** not started.
Repository state: passing, coherent, recoverable. No migration is half-applied. No main flow is broken. No half-wired store.

---

## Starting state

| | |
| --- | --- |
| Starting commit | `c1e82a3` — `fix(planning): persist blocks across native relaunch` |
| Working branch | `v2/adaptive-intelligence-foundation` (off `c1e82a3`); V1 `main` untouched at `c1e82a3` |
| Remote | **not pushed**; no force-push; no reset; V1 tag/history intact; release version unchanged (`1.0.0-rc.2`) |
| Pre-existing untracked user work | all preserved and committed in Phase A / C |
| Pre-existing unrelated `git stash@{0}` (`batch2-pre-money-safety`) | left untouched |

### Baseline verification (on `c1e82a3`, before any change)

| Check | Command | Result |
| --- | --- | --- |
| Unit / component | `npm test` | **676 passed**, 86 files, exit 0 |
| Lint | `npm run lint` (oxlint) | exit 0 — warnings only (`react(only-export-components)` ×~30, one `react(set-state-in-effect)`); **pre-existing** |
| Type-check + build | `npm run build` | exit 0 |
| Browser E2E | `npm run test:e2e` | **63 passed**, exit 0 |
| Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | **103 passed**, 0 failed |

No pre-existing test failures. The lint warnings are the documented baseline and are unchanged in kind by this run (a few extra lines of the same `react(globals)` / `only-export-components` categories from new RTL-probe test files).

---

## Commits created this run (newest last)

| Commit | Phase | Summary |
| --- | --- | --- |
| `ffd84f6` | A | `docs(v2): lock consolidated master blueprint` |
| `098099d` | B | `feat(v2): add adaptive intelligence persistence foundation` |
| `2a87c36` | — | `docs(v2): record phase A+B implementation report and C-K resume plan` |
| `c1c109e` | C | `refactor(v2): unify validated canonical mutation adapters` |
| `bcc2ab1` | D | `feat(v2): evolve quick capture into natural capture` |
| `11dfcfa` | E | `feat(v2): add assessment scope and academic attention intelligence` |
| `226282c` | F | `feat(v2): add adaptive planning diffs and occurrence control` |

Final HEAD at time of writing: **`226282c`** (this report commit will follow).

---

## Architecture delivered

### Phase B — Schema v11 persistence foundation

One forward-only, non-destructive migration in `app/src-tauri/src/db.rs`; `CURRENT_SCHEMA_VERSION` `10 → 11`. Migrations 1–10 byte-for-byte unchanged. Six new tables — no `ALTER`/`DROP` on any V1 table:

| Table | Purpose | Key shape decisions |
| --- | --- | --- |
| `academic_assessment_topics` | explicit Assessment ↔ Topic scope | PK `(assessment_id, topic_id)`; both FKs CASCADE; same-course guard in `academic.rs`; absence = **unknown**, never "out of scope" |
| `capture_proposals` | many `fact`/`interpretation` proposals per `capture_inbox` row | FK CASCADE; `confidence ∈ {clear, needs-review, ambiguous}` (no numeric confidence); V1 `proposed_type`/`parsed_payload` untouched |
| `action_scheduling_constraints` | 1:1 scheduling metadata on a canonical Action | PK = `action_id`, FK CASCADE; `splittable` default 0; no estimate column (stays on `actions`) |
| `planning_occurrence_exceptions` | state of ONE date of a recurring block | FK CASCADE; `replacement_block_id` SET NULL; `UNIQUE(block_id, occurrence_date)`; `state ∈ {skipped, done, deferred}` |
| `planning_change_sets` | durable Planning Diff (changes + inverse) | `scope ∈ {micro, day, week}`; `status ∈ {proposed, applied, rejected, apply-failed, undone}`; JSON typed at the TS boundary |
| `today_operating_state` | subjective daily capacity only | PK = `date`; `capacity_level ∈ {low, normal, high}` default normal; `source ∈ {user, capture-approved}`; no derived columns |

Rust command wrappers + tests in `academic.rs` (scope + same-course guard, atomic batch), `capture.rs` (proposals), `planning.rs` (constraints / occurrence exceptions / change sets), new `today.rs`. 24 new commands registered in `lib.rs`. TS types + `SqliteRepo`/`LocalRepo` pairs + exact IPC wire-contract tests in new `app/src/domains/adaptive/`.

### Phase C — Shared explicit mutation engine — `app/src/domains/mutations/`

- `types.ts` — `MutationKind` (16), `MutationContext` (the four V1 store slices always present + optional money/academic/language/today slices), `MutationDescriptor` (kind, domain, label, triggersReplan, revisionDomain, validate, describeCurrent, preview, apply). Owns the `ApplyContext` / `ApplyOutcome` types the V1 module used to define.
- `registry.ts` — `MUTATION_REGISTRY` (all 16), `getMutation` (fails closed on unknown), `runMutation` (validate → apply, never throws). The four AI-allowlisted kinds are authored here with byte-identical validation/reason codes to V1. New kinds: `create-expense`, `routine-checkin`, `set-professor-coverage`, `set-personal-study`, `create-assessment`, `update-assessment-date`, `update-assessment-scope` (same-course guard), `create-language-session`, `set-today-capacity`, `adjust-routine-window / -duration / -days`. A kind whose context slice is absent fails validation with `UNAVAILABLE`, never throws.
- `useMutationContext.ts` — assembles the full live `MutationContext` from every domain store + the adaptive repos. One hook so Capture, AI Coach and the engines send the same context.
- `intelligence/applyAdapters.ts` is now a thin projection: `APPLY_ADAPTERS` / `getAdapter` for exactly the four AI kinds, pointing at `MUTATION_REGISTRY`. **Zero behaviour change** — `applyAdapters.test.ts` and the intelligence store / `RecommendationCard` are untouched and pass.
- **No generic write path** anywhere: `applyPatch` / `writeTable` / `runCommand` / model-selected command / raw SQL do not exist.

### Phase D — Natural Capture V2 — `app/src/domains/capture/`

V1 Quick Capture (`capture` / `confirmItem` / `reclassify`) is **untouched and still passes**.

- `naturalCapture.ts` (20 unit tests): `segmentCapture` (split on connectives / newlines / sentences, 1:1 provenance); `classifySegment` (rule-based domain + MutationKind + fact/interpretation + qualitative confidence — covers expense, professor coverage, personal study *without inventing a %*, assessment date move, assessment scope, language session, routine check-in, subjective Today capacity, action intent; unrecognised → domain `unknown`, no mutation kind); `routeForProvider` (a segment is remote-eligible only if its domain is identified AND has ≥ Read permission — Money no-access default and unknown segments stay local); `buildProposals` (segments → `CaptureProposalRecord[]` with injected entity resolvers — existing first, >1 match ⇒ ambiguous — and an injected duplicate-Focus detector that offers reuse instead of a second log).
- `capture/store.tsx`: `captureNatural` persists raw text FIRST, then builds + persists the proposal bundle to the Phase-B `capture_proposals` slice. `decideProposal` / `applyProposal` run the shared mutation engine (`runMutation`) and record a revision. A ref mirror keeps chained same-tick calls consistent.
- UI: `NaturalCaptureDrawer` — global overlay (Ctrl/Cmd+Shift+C, `pbos:open-natural-capture` event, a Command Palette entry, a Today button), no chatbot / orb / neon. Shared `CaptureProposalItem` ("You said" vs "PBOS interpreted", confidence chip, rationale, ambiguity, evidence, Accept & apply / Reject). `CaptureInboxPage` renders the V2 bundle when present, keeps the V1 confirm/reclassify path otherwise.
- `e2e/natural-capture.spec.ts` (3): mixed capture → bundle → selective apply → reload; unclassifiable text keeps the raw capture; axe on the drawer.

### Phase E — Assessment Scope + Academic Intelligence

- Academic store: `getAssessmentScopeTopicIds` / `getAssessmentScopeTopics` / `addAssessmentScopeTopic` / `removeAssessmentScopeTopic` / `setAssessmentScope`, backed by the adaptive `AssessmentScopeRepo`. Same-course guard in the store (localStorage path) mirroring the Rust guard; a cross-course topic — or a batch containing one — is rejected whole. Deleting a topic / assessment / course prunes only the affected scope links. Empty scope = "unknown". `useMutationContext` now sources scope from the academic store (one cache).
- `academic/attentionEngine.ts` (15 unit tests): extends `studyEngine.ts` (unchanged) with reasons `assessment-imminent`, `in-assessment-scope`, `high-weight-assessment`, `repeated-unresolved-weakness`, `recently-studied`, `user-priority`. **No universal priorityScore** — mode-specific inspectable predicate lists. `selectStudyRequirements` → transient typed `StudyRequirement` (reasons, requiredBefore = nearest scoped assessment date, suggestedMinutes, minimumBlockMinutes, evidenceState, linkedActionId, methodSuggestion). Exam/midterm-final mode ranks explicitly-scoped unresolved topics first and never invents scope; recovery surfaces only the weakest. Repeated weakness → a method-change suggestion, never a mastery change. `deriveCourseAttention` → `immediate | watch | stable` with reasons; never mutates `Course.status`. Grade / SGPA / CGPA math untouched.
- UI: `AssessmentScopeEditor` — a collapsed per-assessment checklist on Course Detail that only offers same-course topics.

### Phase F — Adaptive Planning

- `planning/adaptiveEngine.ts` (13 unit tests): pure, deterministic, ISO date horizon (never the weekly grid, never an LLM timestamp). `placeCandidates()` honours blueprint §10.3 rules 1–16 (no overlap; daily + weekly capacity; fixed never moved; locked/manual preserved; only released-manual or generated-flexible nudged; required-before; earliest-date; minimum useful duration; split only when splittable; preferred window when feasible; minimise churn; Could Not Fit is valid). `PlanningCandidate` is a transient type. `buildPlanningDiff()` → typed `PlanningDiffChange[]` + inverse; `could-not-fit` rides on the diff, never as a change.
- `planning/store.tsx` (5 dom tests): `resolveOccurrence(blockId, date, kind, toDate?)` writes a `planning_occurrence_exceptions` row WITHOUT mutating the recurring template; `deferred` also creates a concrete date-pinned replacement and links it. `applyPlanningDiff()` applies a reviewed diff as one unit with a compensating rollback on any failure (never half-applied), then persists a `planning_change_sets` row + its inverse. `undoPlanningChangeSet()` replays the stored inverse. All new slices load from the adaptive repos on mount and survive a remount.
- UI: the Calendar block-detail panel gains a "this week's occurrence" control (Skip / Mark done / Move this occurrence) for recurring blocks.
- `e2e/adaptive-planning.spec.ts` (1): skip one occurrence of a weekly block → template survives, exception persists, survives a hard reload.

### Semantic families — status

| Family | This run |
| --- | --- |
| **Capture Proposal** (§4.1) | table + engine + store + drawer + inbox + tests (Phase B + D) — **complete** |
| **Intelligence Recommendation** (§4.2) | still the durable V1 architecture; the 4 AI kinds now route through the shared registry (Phase C). Contextual sources + AI-Coach re-point are **Phase I** |
| **Planning Diff** (§4.3) | durable table + typed vocabulary + engine + builder + atomic apply + undo + occurrence controls (Phase B + F). A dedicated diff-review screen surface is **Phase F/J polish, not yet built** — apply/undo currently run from the store + Calendar occurrence panel |

---

## Data migration

Exact tables / columns are per blueprint 07 §6.1–§6.6 with **no deviation** from the suggested columns. Indexes added: `idx_acad_scope_assessment`, `idx_acad_scope_topic`, `idx_capture_proposals_capture`, `idx_capture_proposals_status`, `idx_planning_occ_block`, `idx_planning_occ_date`, `idx_planning_change_sets_status`.

### Migration tests (`db.rs`, module `db::tests`) — all pass

`v11_schema_version_is_eleven_and_matches_the_last_migration`, `v11_adds_the_six_adaptive_tables_and_keeps_every_v1_table` (builds a real v10 DB then applies v11: every v10 table kept, exactly six added), `v11_is_idempotent_and_preserves_pre_existing_rows` (seeded rows + V1 capture columns survive; `run_migrations` ×3 no-op), `v11_capture_proposals_round_trip_and_cascade_with_the_inbox_row`, `v11_assessment_topic_scope_cascades_from_both_sides`, `v11_action_constraints_are_one_to_one_and_cascade_with_the_action`, `v11_occurrence_exception_keeps_the_recurring_template_and_survives_reopen` (real file DB close + reopen), `v11_occurrence_exception_is_unique_per_block_and_date`, `v11_planning_change_set_and_today_capacity_survive_close_and_reopen` (real file DB close + reopen), `v11_action_constraints_do_not_restate_the_action_estimate`. Pre-existing `migrations_are_idempotent` still passes at v11.

### Backward compatibility

Migrations 1–10 unchanged; v11 additive only. No existing Rust struct, Tauri command, TS type, store or repo signature was removed or repurposed. All 103 pre-existing Rust tests and 676 pre-existing Vitest tests still pass. `capture_inbox` V1 columns and rows are untouched.

---

## Screen impact delivered

| Screen | Tier (blueprint §15) | This run |
| --- | --- | --- |
| CaptureInboxPage | major | **moderate** — renders V2 proposal bundles; V1 path retained |
| CourseDetailPage | major | **minor** — collapsed `AssessmentScopeEditor` per assessment |
| CalendarWeekPage | moderate | **minor** — per-occurrence Skip / Done / Move panel for recurring blocks |
| TodayPage | major | **trivial** — a "Capture what happened" button (full Adaptive Today is Phase G) |
| Command Palette | moderate | **minor** — a Natural Capture entry |
| App shell | — | mounts the global `NaturalCaptureDrawer` |
| New surfaces | — | `NaturalCaptureDrawer`, `CaptureProposalItem`, `AssessmentScopeEditor` |
| PlannerPage, AcademicsOverviewPage, NormalStudyPage, Knowledge/TopicDetailPage, AICoachPage, WeeklyReviewPage, MasteryCheckPage, RoutinesOverviewPage, RoutineDetailPage, FocusPage, AnalyticsOverviewPage, PatternsPage, SettingsPage | major/moderate | **not reached — unchanged** |
| Splash / startup | keep | unchanged |

No `DESIGN.md` token was hard-coded; new components use existing primitives (`Button`, `Badge`, `Card`) and design tokens. The drawer is keyboard-accessible with `role="dialog"`, and its e2e includes an axe assertion (no critical/serious violations).

---

## Tests

All commands from `app/` on `v2/adaptive-intelligence-foundation`.

| Check | Command | Baseline | After Phase F |
| --- | --- | --- | --- |
| Vitest | `npm test` | 676 / 86 files | **781 passed / 93 files** (+105) |
| Lint | `npm run lint` | exit 0, ~30 warns | exit 0, same warning **categories** (a few extra `react(globals)` lines from new RTL-probe files; no errors) |
| Type-check + build | `npm run build` | exit 0 | **exit 0** |
| Rust unit | `cargo test --manifest-path src-tauri/Cargo.toml` | 103 | **138 passed** (+35; all from Phase B — Phases C–F touched no Rust) |
| Release check | `cargo check --release …` | (n/a) | **exit 0** (run after Phase B) |
| Browser E2E | `npm run test:e2e` | 63 | **67 passed** (+4: `natural-capture.spec.ts` ×3, `adaptive-planning.spec.ts` ×1) |
| Tauri build | `npm run tauri:build` | — | **not run** — deferred until the V2 schema is final across all phases (`CLAUDE.md` rule); `cargo check --release` covers release-profile compile parity |
| WDIO native E2E | `npm run test:e2e:tauri` | — | **not run** — no renderer contract changed by Phases C–F; the documented `tauri-plugin-wdio` renderer limitation still stands and is unrelated to V2 |
| Accessibility (axe) | via Playwright | passing | passing; the new Natural Capture drawer carries its own axe assertion |

No AI provider (fake or live) was used as acceptance evidence.

---

## Visual QA

Not performed as a dedicated pass — Phase J work. New surfaces were built with existing PBOS primitives and tokens, and the drawer's e2e runs axe. No visual debt introduced; no new visual language. Full Agent Browser / Impeccable audit at 1440×900 and 1280×800 is Phase J.

---

## Git

| | |
| --- | --- |
| Branch | `v2/adaptive-intelligence-foundation` (local only) |
| Commits this run | 7 (listed above) + this report |
| Final HEAD | `226282c` (before this report commit) |
| Force push / remote push | none |
| V1 release history / tag | untouched; no "V1 Batch 11"; version unchanged |
| Working tree | clean at each phase boundary |

---

## Remaining work — resume plan

Blueprint phase order (07 §18) is unchanged. Resume at **Phase G**.

### Phase G — Adaptive Today + Focus evidence propagation  *(next)*
First module to inspect: `app/src/domains/performance/TodayPage.tsx` + `app/src/domains/focus/store.tsx`.
- Create a pure `todayEngine.ts` taking `now` explicitly; derive current fixed commitment, current/next/earlier blocks, linked Action live state, actual Focus minutes per planning block, elapsed-unresolved occurrences (read `planning.occurrenceStateFor`), free gap, remaining planned minutes, day/weekly capacity + fragility, daily Low/Normal/High capacity (from `today_operating_state` via a `useMutationContext`-style bridge or a small `useTodayCapacity` hook), protected/locked state, contextual academic/knowledge/routine attention candidates (reuse `attentionEngine`).
- Follow-Plan vs Adaptation-Needed with the §11.2 precedence; passing time ≠ missed; buffer may stay empty.
- Daily capacity: persist only low/normal/high, default Normal, never inferred; Natural Capture may propose (already wired via `set-today-capacity`), user confirms; never rewrite Planner capacity.
- Focus context propagation: pass all known context from Today/Study/Planner; on completion, Focus duration is the evidence — never infer Action-done / mastery / personal-study % from elapsed minutes; Today derives planned-vs-actual from linked Focus sessions.
- Today UI hierarchy: NOW (primary) → TODAY timeline (secondary) → ADAPTATION (conditional) → compact Natural Capture → tertiary metrics. Do not regress to equal stat cards.
- Tests per §16.4; e2e for follow-plan and adaptation-needed paths.
- Commit `feat(v2): make Today an adaptive execution surface`.

### Phase H — Knowledge + Routine contextual intelligence
`knowledge/` + `routine/`. "Generate Recall" reusing `mastery_checks` (no AI question-bank table; generated questions alone never move mastery; only a completed governed check creates evidence via the existing explicit path; generic AI context never includes Obsidian note bodies). Routine deterministic pattern engine with centralised thresholds (≥6 comparable opportunities; ≥4 per compared bucket) — structural changes only through the Phase-C mutation kinds (`adjust-routine-*`). Tests per §16.5–§16.6. Commit `feat(v2): add contextual knowledge and routine intelligence`.

### Phase I — AI Coach contextual integration
`intelligence/`. Extend `RecommendationSource` (add `contextual`, `capture`, `adaptive-today`, `academic`, `knowledge`, `routine`, `planning`; keep existing). Route contextual recommendations through `MUTATION_REGISTRY`; migrate the AI-Coach `applyCtx` onto `useMutationContext`; deterministic derived facts in AI context; provider-failure fallback verified. Refine hierarchy toward Ask/Explore · Context · Active Proposals · Decision History. Commit `feat(v2): evolve ai coach into contextual reasoning layer`.

### Phase J — Weekly Review + screen refinement + visual QA
Weekly Review prepopulates factual state, asks mainly for reflection/corrections/decisions. A dedicated `PlanningDiffReview` screen surface (What changed / Why / Protected / Could Not Fit / Apply / Undo) building on the Phase-F engine. Polish the major V2 screens within `DESIGN.md`; Agent Browser audit at 1440×900 and 1280×800; axe on materially changed screens; Impeccable last. Commit `feat(v2): complete review flow and v2 interface integration`.

### Phase K — Full regression
`npm test` / `npm run lint` / `npm run build` / `npm run test:e2e` / `cargo test` / `cargo check --release`; then `npm run tauri:build` (schema now final); `npm run test:e2e:tauri` reporting the known renderer limitation truthfully. E2E flows 1–10 from §16.9.

### Assumptions recorded (Phases A–F)
- **New Rust module `today.rs`**; **new TS folder `app/src/domains/adaptive/`** groups the V2 persistence types/repos as one reviewable unit; **new `app/src/domains/mutations/`** is the shared engine's home.
- `capture_proposals`' TS type is `CaptureProposalRecord` (a V1 `CaptureProposal` type already exists; nothing renamed).
- `academic_assessment_topics.source` also allows `'ai-applied'` (blueprint lists `user`/`capture-approved`); default `'user'`.
- **Atomicity of `applyPlanningDiff`** is implemented as a store-level sequential apply with a compensating rollback, not yet a single Rust/repository transaction command. A true transactional apply command is a **Phase F/K hardening item** — noted so it is not mistaken for done. Undo is real (stored inverse changes).
- No dedicated Planning-Diff review *screen* yet — apply/undo run from the store and the Calendar occurrence panel. The review surface is Phase J.

Nothing is hidden. Phases A–F are complete and verified; G–K are not started.
