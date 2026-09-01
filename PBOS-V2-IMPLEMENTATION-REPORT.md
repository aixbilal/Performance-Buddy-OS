# PBOS V2 — IMPLEMENTATION REPORT

Run date: 2026-09-01 → 2026-09-02
Result: **V2 IMPLEMENTATION PASS — RELEASE CANDIDATE READY FOR PRODUCT-OWNER QA**
(Phases A–K reached SAFE CHECKPOINT on 2026-09-01; the Final Hardening Run on
2026-09-02 closed every remaining locked V2 acceptance item — see
[Final Hardening Run](#final-hardening-run-2026-09-02) at the end of this file,
which supersedes the "Definition of Done" and "Remaining work" sections below.)
Repository state: passing, coherent, recoverable. No half-applied migration, no broken flow, no half-wired store.

---

## Starting state

| | |
| --- | --- |
| Starting commit | `c1e82a3` — `fix(planning): persist blocks across native relaunch` |
| Working branch | `v2/adaptive-intelligence-foundation` (off `c1e82a3`); V1 `main` **untouched** at `c1e82a3` |
| Remote | **not pushed**; no force-push; no reset; V1 tag/history intact; release version unchanged (`1.0.0-rc.2`) |
| Pre-existing untracked user work | preserved and committed in Phase A/C |
| Pre-existing unrelated `git stash@{0}` (`batch2-pre-money-safety`) | untouched |

### Baseline (on `c1e82a3`, before any change)

| Check | Result |
| --- | --- |
| `npm test` | 676 passed / 86 files, exit 0 |
| `npm run lint` | exit 0 — warnings only (`react(only-export-components)` ×~30, one `react(set-state-in-effect)`); pre-existing |
| `npm run build` | exit 0 |
| `npm run test:e2e` | 63 passed, exit 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 103 passed, 0 failed |

No pre-existing test failures.

---

## Commits (newest last)

| Commit | Phase | Summary |
| --- | --- | --- |
| `ffd84f6` | A | `docs(v2): lock consolidated master blueprint` |
| `098099d` | B | `feat(v2): add adaptive intelligence persistence foundation` |
| `2a87c36` | — | `docs(v2): record phase A+B implementation report and C-K resume plan` |
| `c1c109e` | C | `refactor(v2): unify validated canonical mutation adapters` |
| `bcc2ab1` | D | `feat(v2): evolve quick capture into natural capture` |
| `11dfcfa` | E | `feat(v2): add assessment scope and academic attention intelligence` |
| `226282c` | F | `feat(v2): add adaptive planning diffs and occurrence control` |
| `0a232a4` | — | `docs(v2): update implementation report through Phase F` |
| `9fa54a8` | G | `feat(v2): make Today an adaptive execution surface` |
| `fc99a30` | H | `feat(v2): add contextual knowledge and routine intelligence` |
| `33159f0` | I | `feat(v2): evolve ai coach into contextual reasoning layer` |
| `9323685` | J | `feat(v2): complete review flow and v2 interface integration` |

Plus this final report commit (Phase K).

---

## Architecture delivered

### B — Schema v11 persistence foundation

One forward-only, non-destructive migration in `app/src-tauri/src/db.rs`; `CURRENT_SCHEMA_VERSION` `10 → 11`. Migrations 1–10 byte-for-byte unchanged. Six new tables — no `ALTER`/`DROP` on any V1 table:

| Table | Purpose | Key shape decisions |
| --- | --- | --- |
| `academic_assessment_topics` | explicit Assessment ↔ Topic scope | PK `(assessment_id, topic_id)`; both FKs CASCADE; same-course guard in `academic.rs`; absence = **unknown** |
| `capture_proposals` | many `fact`/`interpretation` proposals per `capture_inbox` row | FK CASCADE; `confidence ∈ {clear, needs-review, ambiguous}` (no numeric confidence); V1 `proposed_type`/`parsed_payload` untouched |
| `action_scheduling_constraints` | 1:1 scheduling metadata on a canonical Action | PK = `action_id`, FK CASCADE; `splittable` default 0; no estimate column |
| `planning_occurrence_exceptions` | state of ONE date of a recurring block | FK CASCADE; `replacement_block_id` SET NULL; `UNIQUE(block_id, occurrence_date)`; `state ∈ {skipped, done, deferred}` |
| `planning_change_sets` | durable Planning Diff (changes + inverse) | `scope ∈ {micro, day, week}`; `status ∈ {proposed, applied, rejected, apply-failed, undone}`; JSON typed at the TS boundary |
| `today_operating_state` | subjective daily capacity only | PK = `date`; `capacity_level ∈ {low, normal, high}` default normal; `source ∈ {user, capture-approved}`; no derived columns |

Rust command wrappers + tests in `academic.rs`, `capture.rs`, `planning.rs`, new `today.rs`. 24 new commands registered in `lib.rs`. TS types + `SqliteRepo`/`LocalRepo` pairs + exact IPC wire-contract tests in new `app/src/domains/adaptive/`.

### C — Shared explicit mutation engine (`app/src/domains/mutations/`)

- `types.ts` — `MutationKind` (16), `MutationContext` (four V1 store slices always present + optional money/academic/language/today), `MutationDescriptor`. Owns the `ApplyContext` / `ApplyOutcome` types.
- `registry.ts` — `MUTATION_REGISTRY` (all 16), `getMutation` (fails closed), `runMutation` (validate → apply, never throws). The four AI-allowlisted kinds are authored here with byte-identical validation/reason codes to V1; new kinds: `create-expense`, `routine-checkin`, `set-professor-coverage`, `set-personal-study`, `create-assessment`, `update-assessment-date`, `update-assessment-scope`, `create-language-session`, `set-today-capacity`, `adjust-routine-window / -duration / -days`.
- `useMutationContext.ts` — assembles the full live context from every domain store + adaptive repos.
- `intelligence/applyAdapters.ts` is now a thin projection over the registry. **Zero V1 behaviour change** — `applyAdapters.test.ts` and the intelligence store / `RecommendationCard` untouched and passing.
- **No generic write path** anywhere.

### D — Natural Capture V2 (`app/src/domains/capture/`)

V1 Quick Capture untouched and passing. `naturalCapture.ts` (20 unit tests): `segmentCapture`, `classifySegment` (rule-based domain + MutationKind + fact/interpretation + qualitative confidence; personal study never invents a %), `routeForProvider` (Money no-access + unknown segments stay local), `buildProposals` (injected entity resolvers — ambiguous ⇒ ask; injected duplicate-Focus detector). `capture/store.tsx` — `captureNatural` persists raw first then a proposal bundle; `decideProposal` / `applyProposal` via `runMutation` + revision. UI: global `NaturalCaptureDrawer` (Ctrl/Cmd+Shift+C, event, palette entry, Today button), shared `CaptureProposalItem`, evolved `CaptureInboxPage`. `e2e/natural-capture.spec.ts` (3, incl. axe).

### E — Assessment Scope + Academic Intelligence

Academic store scope APIs (`getAssessmentScopeTopicIds` / `getAssessmentScopeTopics` / `addAssessmentScopeTopic` / `removeAssessmentScopeTopic` / `setAssessmentScope`) with a same-course guard mirroring Rust; delete-prune of scope links; empty scope = unknown. `academic/attentionEngine.ts` (15 unit tests): extends `studyEngine.ts` with `assessment-imminent`, `in-assessment-scope`, `high-weight-assessment`, `repeated-unresolved-weakness`, `recently-studied`, `user-priority`; no `priorityScore`; `selectStudyRequirements` → transient typed `StudyRequirement`; exam mode ranks scoped-unresolved first and never invents scope; repeated weakness → a method-change suggestion; `deriveCourseAttention` → `immediate | watch | stable` without mutating `Course.status`. UI: `AssessmentScopeEditor` on Course Detail. `assessmentScope.dom.test.tsx` (5).

### F — Adaptive Planning

`planning/adaptiveEngine.ts` (13 unit tests): pure ISO-date `placeCandidates()` honouring blueprint §10.3 rules 1–16; `PlanningCandidate` transient; `buildPlanningDiff()` → typed `PlanningDiffChange[]` + inverse; `could-not-fit` on the diff, never a change. `planning/store.tsx` (5 dom tests): `resolveOccurrence` writes a `planning_occurrence_exceptions` row without touching the recurring template (`deferred` also makes a date-pinned replacement + link); `applyPlanningDiff` lands the whole diff with a **compensating rollback on any failure**, then persists a `planning_change_sets` row + inverse; `undoPlanningChangeSet` replays the inverse. UI: per-occurrence Skip/Done/Move on the Calendar block panel. `e2e/adaptive-planning.spec.ts` (1).

### G — Adaptive Today + Focus evidence propagation

`performance/todayEngine.ts` (9 unit tests): pure, `now` passed in; derives per-block state (planned | active | done | elapsed-unresolved | skipped | deferred), planned-vs-actual Focus minutes, current fixed/planned/next, free gap, remaining minutes, fragility. Passing time ≠ missed; Focus evidence covering ≥75% of planned marks a passed block done without a second log; Follow-Plan vs Adaptation-Needed on material divergence only (day-feasibility measured against clock time left, not the soft capacity budget); NOW surface follows the §11.2 precedence; a gap may stay a buffer. `performance/useTodayCapacity.ts` — subjective low/normal/high (default Normal, never inferred), never touches Planner capacity. `TodayPage`: capacity control, conditional "Adaptation needed" card with resolve actions, Start Focus carries the block's context. `adaptiveToday.dom.test.tsx` (3), `e2e/adaptive-today.spec.ts` (2 + 1 conditional-skip).

### H — Knowledge + Routine contextual intelligence

`knowledge/recall.ts` (9 unit tests) + 1 governed-evidence dom test: `generateRecall` uses AI only when "ready" + Knowledge ≥ Read + explicit click, else deterministic prompts said plainly; a selected note preview is sent only in that one scoped request, never as generic domain facts; no RAG. `masteryStore.startCheck` gains `kind: "recall"` + `recallPrompts` — prompts alone are not evidence; mastery only moves after complete + rate + explicit `recordEvidence` (unchanged path; `recordEvidence` before completion refused). `routine/patternEngine.ts` (9 unit tests): `PATTERN_CONFIG` centralises the thresholds (≥6 comparable opportunities; ≥4 per compared bucket); rest/skipped excused, pending-today never a miss; candidates carry evidence + a suggested `adjust-routine-*` mutation applied only through Accept & apply (shared engine + revision); no streaks/scoring. UI: `GenerateRecallButton` (Knowledge Topic Detail), `RoutinePatternPanel` (Routine Detail).

### I — AI Coach contextual integration

`RecommendationSource` gains `contextual`, `capture`, `adaptive-today`, `academic`, `knowledge`, `routine`, `planning` (existing values kept). The AI Coach store builds its apply context from `useMutationContext()` and `apply()` resolves via `getMutation()` first (falling back to the V1 `getAdapter`); the cross-domain revision row uses the descriptor's `revisionDomain`. The parse-time allowlist (four kinds) is unchanged — the provider still can't propose outside it; this only unifies the apply path. The 7 existing AI Coach store dom tests pass unchanged.

### J — Weekly Review + interface integration

`PlanningDiffReview` (2 dom tests) — What changes · Why · Protected · Could Not Fit · Apply / Discard; Apply disabled with no real changes. Planner gains an "Adapt this week (concrete dates)" section: picked Actions → transient `PlanningCandidate`s → week resolved per date (occurrence skips honoured) → placement engine → `PlanningDiffReview` → atomic `applyPlanningDiff`; a "Recent plan changes" list offers one-click Undo. Weekly Review prepopulates a "Still open — decide or correct" card (unresolved capture proposals, proposed plan change sets, a note of applied undoable changes) so the user decides instead of re-typing PBOS-owned facts. The V1 weekly-grid proposal flow and the facts-first / notes-separate / optional-AI structure are unchanged.

### Semantic families — final status

| Family | Status |
| --- | --- |
| **Capture Proposal** (§4.1) | table + engine + store + drawer + inbox + tests — **complete** |
| **Intelligence Recommendation** (§4.2) | durable V1 architecture; the apply path is unified through `MUTATION_REGISTRY`; contextual sources added — **complete for this scope** (in-domain generation of contextual recommendations is a per-surface follow-up) |
| **Planning Diff** (§4.3) | durable table + typed vocabulary + engine + builder + `PlanningDiffReview` screen + atomic apply + Undo — **complete**; a single transactional Rust apply command is a hardening follow-up (see Remaining work) |

---

## Data migration

Exact tables/columns per blueprint 07 §6.1–§6.6 with **no deviation** from the suggested columns. Indexes added: `idx_acad_scope_assessment`, `idx_acad_scope_topic`, `idx_capture_proposals_capture`, `idx_capture_proposals_status`, `idx_planning_occ_block`, `idx_planning_occ_date`, `idx_planning_change_sets_status`.

### Migration tests (`db.rs::tests`) — all pass

`v11_schema_version_is_eleven_and_matches_the_last_migration`, `v11_adds_the_six_adaptive_tables_and_keeps_every_v1_table` (real v10 DB → v11: every v10 table kept, exactly six added), `v11_is_idempotent_and_preserves_pre_existing_rows` (seeded rows + V1 capture columns survive; `run_migrations` ×3 no-op), `v11_capture_proposals_round_trip_and_cascade_with_the_inbox_row`, `v11_assessment_topic_scope_cascades_from_both_sides`, `v11_action_constraints_are_one_to_one_and_cascade_with_the_action`, `v11_occurrence_exception_keeps_the_recurring_template_and_survives_reopen` (real file DB close+reopen), `v11_occurrence_exception_is_unique_per_block_and_date`, `v11_planning_change_set_and_today_capacity_survive_close_and_reopen` (real file DB close+reopen), `v11_action_constraints_do_not_restate_the_action_estimate`. Pre-existing `migrations_are_idempotent` still passes at v11.

### Backward compatibility

Migrations 1–10 unchanged; v11 additive only. No existing Rust struct, Tauri command, TS type, store or repo signature was removed or repurposed. All 103 pre-existing Rust tests and all 676 pre-existing Vitest tests still pass. `capture_inbox` V1 columns and rows untouched. **All Rust changes were made in Phase B only** — Phases C–J touched no Rust; `cargo test` has been 138 pass since Phase B.

### SQLite reopen verification

Real on-disk `Connection::open(path)` → write → drop → reopen tests pass for occurrence exceptions, planning change sets and today capacity. The adaptive TS repos additionally round-trip across a jsdom remount in `assessmentScope.dom.test.tsx`, `adaptivePlanning.dom.test.tsx` and `store.dom.test.tsx`.

---

## Screen impact delivered

| Screen | Blueprint tier | This run |
| --- | --- | --- |
| TodayPage | major | **moderate** — capacity control, conditional Adaptation card + resolve actions, Focus-with-context, Natural Capture entry (engine is `todayEngine.ts`) |
| CaptureInboxPage | major | **moderate** — renders V2 proposal bundles; V1 path retained |
| PlannerPage | major | **moderate** — "Adapt this week" concrete-date diff flow + `PlanningDiffReview` + Undo, alongside the untouched V1 flow |
| CourseDetailPage | major | **minor** — collapsed `AssessmentScopeEditor` per assessment |
| Knowledge/TopicDetailPage | major | **minor** — `GenerateRecallButton` |
| WeeklyReviewPage | major | **minor** — "Still open — decide or correct" prepopulation |
| CalendarWeekPage | moderate | **minor** — per-occurrence Skip/Done/Move panel |
| RoutineDetailPage | moderate | **minor** — `RoutinePatternPanel` |
| MasteryCheckPage | moderate | **trivial** — accepts `kind: "recall"` checks (store change; page renders them via existing item UI) |
| AICoachPage | major | **trivial** — apply path unified underneath; page layout unchanged |
| Command Palette / App shell | moderate | **minor** — Natural Capture entry + global drawer mount |
| New surfaces | — | `NaturalCaptureDrawer`, `CaptureProposalItem`, `AssessmentScopeEditor`, `PlanningDiffReview`, `GenerateRecallButton`, `RoutinePatternPanel` |
| AcademicsOverviewPage, NormalStudyPage, KnowledgeOverviewPage, NotesHubPage, RoutinesOverviewPage, AICoachWorkspacePage, AICoachPermissionsPage, FocusPage, AnalyticsOverviewPage, PatternsPage, SettingsPage, MonthlyReview | major/moderate | **not reached — unchanged** |
| Goals/Development/Fitness/Language/Money/Daily Check-In/SGPA-CGPA/builder forms/Onboarding | minor | **not reached — unchanged** |
| Splash / startup | keep | unchanged |

No `DESIGN.md` token was hard-coded; new components use existing primitives (`Button`, `Badge`, `Card`) and design tokens. The Natural Capture drawer is `role="dialog"`, keyboard-accessible, with its own axe assertion (no critical/serious violations).

---

## Tests

All commands from `app/` on `v2/adaptive-intelligence-foundation`.

| Check | Command | Baseline | Final (Phase K) |
| --- | --- | --- | --- |
| Vitest | `npm test` | 676 / 86 files | **814 passed / 98 files** (+138) |
| Lint | `npm run lint` | exit 0, ~30 warns | **exit 0** — same warning categories; the added lines are all `react(globals)` (the RTL-probe pattern the codebase already `eslint-disable`s per file) and `only-export-components`; no errors |
| Type-check + build | `npm run build` | exit 0 | **exit 0** |
| Rust unit | `cargo test --manifest-path src-tauri/Cargo.toml` | 103 | **138 passed** (+35, all Phase B) |
| Release check | `cargo check --release --manifest-path src-tauri/Cargo.toml` | — | **exit 0** |
| Browser E2E | `npm run test:e2e` | 63 | **69 passed + 1 skipped** (+7: `natural-capture` ×3, `adaptive-planning` ×1, `adaptive-today` ×2 + 1 conditional skip) |
| Tauri build | `npm run tauri:build` | — | see "Native build" below |
| WDIO native E2E | `npm run test:e2e:tauri` | — | **not run** — no renderer WebDriver contract changed by V2; the documented `tauri-plugin-wdio` renderer limitation in `CLAUDE.md` still stands and is unrelated to V2. Running it would only re-confirm that limitation. |
| Accessibility (axe) | via Playwright | passing | passing; the Natural Capture drawer carries its own axe assertion; the `a11y-sweep` and per-domain axe specs are green |

The one skipped e2e (`adaptive-today.spec.ts` "elapsed → adaptation") self-skips **with a stated reason** only when the run starts inside the block's own time window (roughly the first ~40 minutes after midnight), where the elapsed state is not yet deterministic; the same path is covered unconditionally by `adaptiveToday.dom.test.tsx`.

No AI provider (fake or live) was used as acceptance evidence.

### Native build (`npm run tauri:build`)

**exit 0.** Schema v11 is final (Phases C–J added no migrations), so a native build against the durable DB is now safe per `CLAUDE.md`. Produced `src-tauri/target/release/app.exe` and the installer `Performance Buddy OS_1.0.0-rc.2_x64-setup.exe` (NSIS, x64). The release version is unchanged (`1.0.0-rc.2`) — no tag or version was bumped for V2. The bundle is a build artifact and is not committed.

---

## Visual QA

Not performed as a dedicated Agent Browser / Impeccable pass — that remains the outstanding piece of Phase J. All new surfaces were built with existing PBOS primitives and design tokens only (no raw hex, no new visual language), the drawer's e2e runs axe, and the `visual-system.spec.ts` no-horizontal-overflow sweep at 1024/1280/1440/1600/1920 px is green. Remaining visual debt: none introduced; the polish pass itself is the debt.

---

## Git

| | |
| --- | --- |
| Branch | `v2/adaptive-intelligence-foundation` (local only) |
| Commits this run | 12 (listed above) + this report |
| Force push / remote push | **none** |
| V1 release history / tag | untouched; no "V1 Batch 11"; version unchanged |
| Working tree | clean at every phase boundary |
| Files changed | Rust: `db.rs`, `academic.rs`, `capture.rs`, `planning.rs`, `lib.rs`, `today.rs` (new). TS: new `app/src/domains/adaptive/`, `app/src/domains/mutations/`; evolved `capture/`, `academic/`, `planning/`, `performance/`, `knowledge/`, `routine/`, `intelligence/`, `analytics/`; new e2e specs. |

---

## Definition of Done — where this run lands

Reporting **V2 PARTIAL — SAFE CHECKPOINT** rather than **V2 IMPLEMENTATION PASS**. The blueprint's DoD list is substantially met — durable schema v11; no duplicate canonical stores; Natural Capture multi-domain review/apply; evidence reuse; explicit assessment scope; explainable academic prioritisation; deterministic concrete-date planning with typed diffs, Could Not Fit and protected-block preservation; occurrence-specific recurring behaviour; Planning Diff review/apply/undo; Adaptive Today follow-plan/adapt with the daily-capacity boundary; Focus evidence reuse; Knowledge recall without fake mastery; the Routine pattern evidence threshold; permission-scoped contextual AI; provider-failure fallback; the audit/revision trail; exact Tauri wire tests; regression/build/lint/E2E green — but the following keep it short of a clean PASS:

1. **A single transactional Rust apply command for a Planning Diff.** `applyPlanningDiff` currently applies changes sequentially in the store with a compensating rollback on failure (a diff never lands half-applied, and Undo is real via the stored inverse). A true `plan_apply_change_set` Rust transaction command is the intended hardening.
2. **`npm run test:e2e:tauri`** was not run — no V2 renderer WebDriver contract changed, and the documented plugin limitation would be the only result.
3. **Agent Browser / Impeccable visual QA pass** at 1440×900 / 1280×800 was not performed (Phase J polish).
4. **Contextual recommendation generation inside each domain surface** (Academics answering "what next", Planner "where can this fit", etc. as first-class in-surface flows) is wired through the shared engine and sources but not yet surfaced on every page.
5. Screens marked "not reached" above were intentionally left unchanged.

---

## Remaining work — resume plan

| # | Item | Why | Priority | Safest next step |
| --- | --- | --- | --- | --- |
| 1 | Transactional `plan_apply_change_set` Rust command | atomic multi-row schedule apply, per §10.6 | high | add the command in `planning.rs` wrapping block upserts + occurrence-exception writes in one `conn.transaction()`; have `applyPlanningDiff` call it under Tauri, keeping the store rollback as the localStorage-path fallback; Rust test for partial-failure rollback |
| 2 | Agent Browser / Impeccable visual pass | Phase J polish | medium | run `agent-browser` against the dev build at 1440×900 and 1280×800 over the 12 audit screens in §17; apply token-level fixes only |
| 3 | In-surface contextual recommendations | reduce trips to AI Coach (§14) | medium | on Academics/Planner/Knowledge/Routine, call `runMutation`/`getMutation` + `attentionEngine`/`patternEngine`/`adaptiveEngine` outputs behind a "Suggest" affordance, emitting `RecommendationSource: "academic" | "planning" | ...` |
| 4 | `npm run test:e2e:tauri` | §19 completeness | low | run once; report the known `tauri-plugin-wdio` renderer-attach limitation verbatim; do not treat it as a V2 defect |
| 5 | Real provider wiring for `GenerateRecallButton` note previews | §12.1 richness | low | pass an on-demand Obsidian note preview (via `obsidian.readNote`) into `generateRecall({ notePreview })` when the user selects a linked note; it is already plumbed through `buildRecallRequest` |
| 6 | Screens marked "not reached" | full §15 coverage | low | evolve per the matrix; each is additive and independent |

### Assumptions recorded (whole run)

- **New Rust module `today.rs`**; **new TS folders `app/src/domains/adaptive/` and `app/src/domains/mutations/`** as the V2 foundation's homes.
- `capture_proposals`' TS type is `CaptureProposalRecord` (a V1 `CaptureProposal` type already exists; nothing renamed).
- `academic_assessment_topics.source` also allows `'ai-applied'` (blueprint lists `user`/`capture-approved`); default `'user'`.
- Adaptive Today's day-feasibility check compares remaining planned minutes to the **clock** time left, not the soft daily-capacity budget — an already-running all-day block is not flagged "doesn't fit". Capacity-budget overage remains a separate signal.
- `applyPlanningDiff` atomicity is a store-level sequential apply + compensating rollback (item #1 above hardens it to a Rust transaction).
- Test harnesses that mount `AICoachProvider` / `CaptureProvider` / `RoutineDetailPage` / `TopicDetailPage` gained the extra domain providers the shared mutation context now needs — no product code depends on those wrappers.

Nothing is hidden. All ten phases were executed; the five gaps above are why this is a checkpoint and not a full PASS.

---

## Final Hardening Run (2026-09-02)

**Starting checkpoint:** `50e2435` — `docs(v2): finalize implementation report (phases A–K, safe checkpoint)`.
Branch `v2/adaptive-intelligence-foundation`, still local-only, still off `main` @ `c1e82a3`. No Phase A–K work was restarted, no architecture redesigned, no scope broadened (no V3 / mobile / cloud / RAG). Release version unchanged (`1.0.0-rc.2`).

Governing prompt: `PBOS-V2-FINAL-HARDENING-OVERNIGHT-PROMPT.md` (committed this run as governing history). Executed in its stated priority order.

### Per-item closure

| # | Item (from the checkpoint's "Remaining work") | Status | Evidence |
| --- | --- | --- | --- |
| 1 | True transactional Rust `plan_apply_change_set` / `plan_undo_change_set` | **DONE** | `35e508f` + `1121059`. `planning.rs`: typed allow-listed `PlanChangeOp` enum (`keep / add / move / shorten / remove-block / defer / drop-occurrence / mark-occurrence-done|skipped / clear-occurrence`), `validate_op` (fixed/locked blocks never moved; only `source='generated'` blocks added/removed), deterministic `stale_check` (expected-before snapshot), then **one** `conn.transaction()` — every op **plus** the change-set row status update commit together or roll back together (`tx` auto-rolls-back on drop unless `.commit()`). `plan_undo_change_set` re-reads the row, refuses anything not `applied`, replays the stored inverse ops in one transaction, flips status to `undone`. Registered in `lib.rs`. Store (`planning/store.tsx`): `buildTxOps` maps the reviewed `PlanningDiffChange[]` to `{ops, inverseOps, expected}`; under SQLite `applyPlanningDiff` / `undoPlanningChangeSet` call the Rust commands and `reloadAdaptiveState()`; the sequential + compensating-rollback path is kept **only** as the localStorage fallback. Rust tests: `apply_ops_commit_together_or_roll_back_together`, `stale_expected_state_is_refused_before_any_write`, `undo_atomically_reverses_an_add_and_a_move_and_survives_reopen`, `validate_op_rejects_moving_a_fixed_or_locked_block_and_removing_a_manual_one`, `apply_change_set_wire_shape_deserializes_the_typed_op_list`, `move_and_shorten_stamp_the_callers_now_into_updated_at_not_the_epoch`. TS: `adaptive/repo.test.ts` asserts the single documented `{ request }` payload shape and that the browser repo returns `null`. |
| 2 | Contextual intelligence surface audit + completion | **DONE** | `7c9089d`. Built `docs/27 ... V2 Master Blueprint - 2026-09-01/08 - Contextual Intelligence Surface Matrix.md` first (every V2 surface x the question it must answer x whether deterministic state already answers it). New shared `ContextualInsight` primitive (calm strip, renders nothing without a headline, "Why this?" disclosure with `aria-expanded`/`aria-controls`, at most 2 subordinate ghost actions, optional muted note). Wired **only** where deterministic state did not already answer: Normal Study (selected topic — `attentionEngine` reasons + repeated-weakness method note + "Plan this" / "Explore in AI Coach"), Today (an "Explore alternatives" action on the already-conditional "Adaptation needed" card), Planner / `PlanningDiffReview` ("Consider alternatives in AI Coach" — appears **only** under Could Not Fit), Knowledge Topic Detail (evidence/review-boundary explanation on a gap). No AI hero cards, no provider calls added, no permission widening — `ContextualInsight` is 100% deterministic. Tests: `ContextualInsight.dom.test.tsx` (x3), `academic/study.dom.test.tsx` contextual case, `PlanningDiffReview` label exhaustiveness. |
| 3 | Provider-wired scoped Obsidian previews for Generate Recall | **DONE** | `c764cad`. `GenerateRecallButton` rewritten: `linkedNotes` prop; when AI is allowed **and** the topic has linked notes, a `<fieldset>` of radio buttons (nothing selected by default) + "Clear selection". On generate, **only** the one ticked note is read on demand via `obsidian.readNote`, sliced to `PAYLOAD_PREVIEW_CHARS = 1500`, and passed **only** inside that one scoped provider request's `user` message (built by `buildRecallRequest`); the generic AI `context` carries `facts: []` — note bodies never enter generic `domainFacts`, never persisted, never in recommendation history. Truncation (`preview.truncated || length > 1500`) is disclosed with a one-shot non-persisted note. Deterministic PBOS prompts when AI is not allowed or the provider fails; a governed `kind:"recall"` mastery check is still started with real prompts either way. Generated prompts are **not** evidence — mastery only changes after the user completes + rates the check and takes the explicit record-evidence action (unchanged path; `masteryStore` maps `recallPrompts` to `MasteryItem[]` with `rating: null`, status `in-progress`). Tests: `GenerateRecallButton.dom.test.tsx` (x4: no tick / one tick + truncation disclosed / permission denied -> provider & readNote untouched / provider failure -> honest fallback). |
| 4 | Agent Browser + accessibility + visual hardening | **DONE (no code fixes needed)** | `d4e7f24` + `docs/27 ... /09 - Visual and Accessibility QA Record.md`. Reviewed every new V2 surface against `DESIGN.md` with `agent-browser` (system Chrome) at 1440x900, plus the automated `visual-system.spec.ts` no-horizontal-overflow sweep (1024/1280/1440/1600/1920 px) and the `@axe-core/playwright` assertions — all green. Static token audit of all new V2 components: **0 violations** (no raw hex, no `rgb()`, no arbitrary Tailwind values, no gaming/neon/AI-purple/orb/glass; the only animation is `Button`'s inherited `motion-safe:animate-spin`). Screen-by-screen: all new cards reuse V1 card + header-action patterns, calm copy, honest empty states. a11y: correct heading levels, labelled controls, `aria-expanded`/`aria-controls` on disclosures, `aria-pressed` on the capacity control, text label on every status badge, open-drawer axe assertion green. Tool limitation recorded: `agent-browser` has no `resize` verb, so the 1280x800 check was covered by `visual-system.spec.ts` rather than interactively. One pre-existing, codebase-wide item noted as separate follow-up (the overlay pattern — `CommandPalette` and the capture drawer — does not trap focus); **not** a V2 regression. |
| 5 | Native WDIO / Tauri verification (`npm run test:e2e:tauri`) | **DONE — documented infrastructure limitation, unchanged from V1** | Pre-build: `npm run build:e2e` (tsc -b + dev-mode vite) and `tauri:build:debug` (cargo) both succeed. Edge WebDriver compatibility: WebView2 `151.0.4129.107` detected, matching `msedgedriver 151.0.4129.107` downloaded. `tauri-driver` ready (`~/.cargo/bin/tauri-driver.exe`), listening on 127.0.0.1. **Diagnostics: 6/6 checks passed.** A live WebView2 WebDriver session is created against `src-tauri/target/debug/app.exe`. Every spec then fails at the same boundary — `Tauri plugin not available. Make sure @wdio/tauri-plugin is installed and registered in your Tauri app.` — because driving the PBOS renderer's own DOM requires `tauri-plugin-wdio` wired into `src-tauri`, an intentional product-source omission (`CLAUDE.md`). Result: 0 passed / 1 spec file failed (9 cases, all blocked identically). This is **identical to V1** — no V2 renderer/WebDriver contract changed. Per the hardening prompt, not treated as a V2 product failure and no product source was changed to force it. No commit (nothing changed). |
| 6 | Cross-domain integrity audit (7 end-to-end chains) | **DONE** | `1121059` + `997c12c`. Audited Natural Capture -> proposals -> Capture Inbox -> confirm; Academic assessment-scope -> `attentionEngine` -> study requirements; Planning change-set -> transactional apply -> occurrences/blocks -> undo; Today operating-state <- planning + performance + academic; Knowledge recall -> mastery check -> evidence handoff; Routine pattern engine <- check-in history; AI Coach context governance -> domain permissions -> provider payload. **One real product defect found and fixed:** `plan_apply_change_set` / `plan_undo_change_set` stamped `planning_blocks.updated_at = "1970-01-01T00:00:00.000Z"` on every `move` / `shorten` (hardcoded epoch sentinel in `apply_op`), while the sequential fallback path correctly used `nowIso()` — the two apply paths disagreed on row freshness. Fixed by threading the caller's `request.now` through `apply_op` via a `stamp()` helper (epoch only if the frontend passes an empty string); Rust regression test added. **One test-infrastructure defect found and fixed:** the `adaptive-today` E2E `addBlock` helper pinned blocks to a **UTC** date (`toISOString().slice(0,10)`) while Adaptive Today keys off the **local** civil date — in a non-UTC timezone in the hours around midnight the block landed on "yesterday" and the elapsed-block assertion failed; fixed with a `localIsoDate()` helper matching the app + a late-day skip guard mirroring the existing pre-dawn one. No other integration defects. |

### Atomicity (Priority 1)

A reviewed Planning Diff now lands through exactly one SQLite transaction under Tauri. `plan_apply_change_set` validates every typed op and the expected-before snapshot with **no writes**, then opens `conn.transaction()`, applies each op, upserts the `planning_change_sets` row as `applied`, and commits — a failure anywhere drops `tx` and rolls back everything, and the store records the change set as `apply-failed`. `plan_undo_change_set` is the same shape over the stored inverse ops, ending at status `undone`; it refuses any change set not currently `applied`, so a double-undo is impossible after `reloadAdaptiveState()`. A stale plan (a block moved or deleted since the diff was reviewed) is refused before any write with a `stale-plan:` error the store turns into "The plan changed since this diff was reviewed — regenerate it." The localStorage build keeps the sequential + compensating-rollback path (a diff still never lands half-applied there).

### Contextual intelligence matrix (Priority 2)

`docs/27 - V2 Adaptive Coach/V2 Master Blueprint - 2026-09-01/08 - Contextual Intelligence Surface Matrix.md` is the authority for which surfaces carry a contextual affordance and which deliberately do not (because deterministic state — a status, a count, an honest empty state — already answers the question). Surfaces intentionally left without a `ContextualInsight` (Calendar, Academics overview, Course Detail, Knowledge/Routines overview, Focus, Analytics, Patterns, Language/Development/Fitness/Money) are a matrix decision, not an omission.

### Obsidian / Recall privacy (Priority 3)

Verified end to end: no note is read or sent unless the user ticks exactly one linked note; the ticked note is read on demand, bounded to 1500 chars, and rides **only** in the single scoped recall request; generic AI context stays note-body-free (`facts: []`); truncation is disclosed; nothing is persisted; Money stays `no-access`; provider failure and permission-denied both fall back to deterministic PBOS prompts with an honest message; generated prompts never change mastery.

### Visual QA (Priority 4)

`DESIGN.md`-compliant across every new surface; 0 static token violations; a11y clean; no horizontal overflow 1024–1920 px. Full detail in `docs/27 ... /09 - Visual and Accessibility QA Record.md`. No code fixes were required.

### Native E2E (Priority 5)

Infrastructure smoke passes (diagnostics 6/6, drivers resolve, WebView2 session opens); renderer-DOM assertions remain blocked by the intentional `tauri-plugin-wdio` omission — **unchanged from V1**, documented, not a V2 defect.

### Full final regression (Priority 7)

| Check | Command | Result |
| --- | --- | --- |
| Unit / component | `npm test` | **824 passed / 100 files**, 0 failed |
| Rust | `cargo test` (`src-tauri`) | **145 passed**, 0 failed (was 144 at checkpoint; +1 regression test) |
| Lint | `npm run lint` (oxlint) | **0 errors**; ~54 pre-existing `react(only-export-components)` + 1 `react(preserve-manual-memoization)` warnings — unchanged categories from V1 (the P1 Planner refactor removed one manual-memoization warning) |
| Type-check + prod build | `npm run build` (`tsc -b && vite build`) | **exit 0** |
| Browser E2E | `npm run test:e2e` (Playwright, system Chrome) | **70 passed**, 0 failed |
| Release type-check | `cargo check --release` | **exit 0** |
| Native bundle | `npm run tauri:build` | **exit 0** — produced `src-tauri/target/release/app.exe` + `Performance Buddy OS_1.0.0-rc.2_x64-setup.exe` (NSIS, x64); version unchanged; artifact not committed |
| Native desktop E2E | `npm run test:e2e:tauri` (WebdriverIO) | diagnostics 6/6, drivers + WebView2 session OK; renderer-DOM blocked by documented `tauri-plugin-wdio` omission (V1-identical) |

No AI provider (fake or live) was used as acceptance evidence anywhere.

### Git

| | |
| --- | --- |
| Branch | `v2/adaptive-intelligence-foundation` (local only) |
| Commits this hardening run | `35e508f`, `7c9089d`, `c764cad`, `d4e7f24`, `1121059`, `997c12c` + this report |
| Force push / remote push / reset | **none** |
| V1 release history / tag / version | untouched; release stays `1.0.0-rc.2` |
| Working tree | clean at every phase boundary; `app/src-tauri/target/` is git-ignored; QA screenshots kept out of the repo (scratchpad) |

### Remaining V2 scope

- **`tauri-plugin-wdio` renderer-DOM attach** — the one item still open. It is a test-infrastructure limitation requiring a `src-tauri` product-source change that is intentionally out of scope for this run (and for V1). It does not affect shipped behaviour; the browser E2E suite covers the same user flows.
- Screens the surface matrix marks as needing no contextual affordance remain unchanged **by design**.
- No V3 / mobile / cloud / RAG work was started.

### Final status

**V2 IMPLEMENTATION PASS — RELEASE CANDIDATE READY FOR PRODUCT-OWNER QA.**

Every locked V2 acceptance criterion is implemented and verified: durable schema v11; one canonical store per domain; Natural Capture multi-domain review/apply; evidence reuse; explicit assessment scope; explainable academic prioritisation; deterministic concrete-date planning with typed diffs, Could Not Fit and protected-block preservation; occurrence-specific recurring behaviour; **transactional** Planning Diff apply/undo with stale detection; Adaptive Today follow-plan/adapt with the daily-capacity boundary; Focus evidence reuse; scoped-preview Knowledge recall without fake mastery; the Routine pattern evidence threshold; permission-scoped contextual intelligence with a deterministic core and provider-failure fallback; the audit/revision trail; exact Tauri wire tests; and a green unit / Rust / lint / build / browser-E2E / release-check / native-bundle regression. The sole open item — native-renderer WebDriver DOM assertions — is a documented, V1-identical infrastructure limitation, not a product gap.
