# PBOS V2 — IMPLEMENTATION REPORT

Run date: 2026-09-01
Result: **V2 PARTIAL — SAFE CHECKPOINT**
Phases completed this run: **A (baseline + blueprint)** and **B (schema v11 persistence foundation)**.
Repository state: passing, coherent, recoverable. No migration is half-applied. No main flow is broken.

---

## Starting state

| | |
| --- | --- |
| Starting commit | `c1e82a3` — `fix(planning): persist blocks across native relaunch` |
| Starting branch | `main` |
| Working branch created | `v2/adaptive-intelligence-foundation` (off `c1e82a3`) |
| Remote | **not pushed**; no force-push; no reset; V1 tag/history untouched |
| Pre-existing untracked user work preserved | `PBOS-V2-CLAUDE-CODE-MASTER-GIGA-PROMPT.md`, `PBOS-V2-CONSOLIDATED-MASTER-BLUEPRINT.md`, `docs/27 - V2 Adaptive Coach/V2 Master Blueprint - 2026-09-01/` (passes 1–6) — all committed intact in Phase A |
| Pre-existing unrelated `git stash@{0}` (`batch2-pre-money-safety`, authored earlier on `main`) | left untouched |

### Baseline verification (run on `c1e82a3` before any change)

| Check | Command | Result |
| --- | --- | --- |
| Unit / component | `npm test` | **676 passed**, 86 files, exit 0 |
| Lint | `npm run lint` | exit 0 — warnings only (`react(only-export-components)` ×~30, one `react(set-state-in-effect)` in `MasteryCheckPage.tsx`); **pre-existing**, not introduced by V2 |
| Type-check + build | `npm run build` | exit 0 (`tsc -b && vite build`; bundle 884.38 kB / 225.20 kB gzip — pre-existing chunk-size warning) |
| Browser E2E | `npm run test:e2e` | **63 passed**, exit 0 (2.7m) |
| Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | **103 passed**, 0 failed |

No pre-existing test failures. The lint warnings above are the documented baseline and are unchanged by this run.

---

## Architecture delivered

### Schema v11 — the adaptive-intelligence persistence foundation

One forward-only migration appended to `MIGRATIONS` in `app/src-tauri/src/db.rs`; `CURRENT_SCHEMA_VERSION` bumped `10 → 11`. Migrations 1–10 are byte-for-byte unchanged. The migration is **non-destructive** — six brand-new tables, no `ALTER`/`DROP` on any V1 table.

| Table | Purpose | Key shape decisions |
| --- | --- | --- |
| `academic_assessment_topics` | Explicit Assessment ↔ Academic Topic scope | PK `(assessment_id, topic_id)`; both FKs `ON DELETE CASCADE`; `source` default `'user'`. Same-course guard enforced in `academic.rs` (SQLite cannot express a cross-table CHECK). Absence of a row = **unknown**, never "out of scope". |
| `capture_proposals` | Many reviewable `fact`/`interpretation` proposals per `capture_inbox` row | FK `capture_id → capture_inbox(id) ON DELETE CASCADE`. `confidence ∈ {clear, needs-review, ambiguous}` (no numeric confidence). `status ∈ {proposed, accepted, modified, rejected, applied, apply-failed}`. Opaque `original_params_json` / `effective_params_json` / `validation_json` / `applied_result_json`. V1 `capture_inbox.proposed_type` / `parsed_payload` **untouched**. |
| `action_scheduling_constraints` | Structured scheduling metadata on a canonical Action | PK = `action_id`, FK `→ actions(id) ON DELETE CASCADE` (1:1). `splittable INTEGER NOT NULL DEFAULT 0` — work is never assumed fragmentable. **No estimate column** — `actions.est_minutes` stays the single total estimate. `preferred_time_window ∈ {morning, day, evening, anytime}`. |
| `planning_occurrence_exceptions` | State of ONE date of a recurring block without touching the template | FK `block_id → planning_blocks(id) ON DELETE CASCADE`; `replacement_block_id → planning_blocks(id) ON DELETE SET NULL`; `UNIQUE(block_id, occurrence_date)`; `state ∈ {skipped, done, deferred}`. Not a second calendar store. |
| `planning_change_sets` | Durable Planning Diff — proposed + inverse changes for review / audit / undo | `scope ∈ {micro, day, week}`; `status ∈ {proposed, applied, rejected, apply-failed, undone}`; `changes_json` / `inverse_changes_json` / `reason_codes_json` stored opaque in Rust, **typed + validated at the TS boundary** (`PlanningDiffChange` union + `parsePlanningDiffChanges`). Does not store a second copy of the schedule. |
| `today_operating_state` | Subjective daily capacity ONLY | PK = `date` (one row per ISO date); `capacity_level ∈ {low, normal, high}` default `normal`; `source ∈ {user, capture-approved}`. No current/next-block, gap, overload or fragility columns — those stay derived. Persistent Planner capacity (`planning_capacity`) is untouched. |

Indexes added: `idx_acad_scope_assessment`, `idx_acad_scope_topic`, `idx_capture_proposals_capture`, `idx_capture_proposals_status`, `idx_planning_occ_block`, `idx_planning_occ_date`, `idx_planning_change_sets_status`.

### Rust command wrappers (thin data-access, matching existing module conventions)

| Module | New commands | Guarding logic |
| --- | --- | --- |
| `academic.rs` | `acad_assessment_scope_load`, `_for`, `_add`, `_remove`, `_set` | `scope_add_inner` rejects a topic whose `course_id` ≠ the assessment's `course_id`, and a missing assessment/topic. `scope_set_inner` runs in a transaction — a batch containing a cross-course topic rolls back to the prior scope. |
| `capture.rs` | `capture_proposals_load`, `capture_proposals_for`, `capture_proposal_upsert`, `capture_proposal_delete` | `proposal_validate` rejects unknown `proposal_class` / `confidence` / `status`. Upsert preserves `created_at` on update. |
| `planning.rs` | `plan_action_constraints_load` / `_upsert` / `_delete`, `plan_occurrences_load` / `_upsert` / `_delete`, `plan_change_sets_load` / `_upsert` / `_delete` | constraint upsert rejects an unknown time window and a dangling Action; occurrence upsert rejects an unknown state and upserts on the `(block_id, occurrence_date)` unique key; change-set upsert rejects a bad scope/status and malformed `changes/inverse/reason_codes` JSON. |
| `today.rs` (**new module**, registered `mod today;` in `lib.rs`) | `today_state_load`, `today_state_get`, `today_state_set`, `today_state_clear`, `today_state_reset_for_test` | `set_inner` rejects any level outside `{low, normal, high}` and any source outside `{user, capture-approved}` — a clock- or AI-inferred capacity cannot be persisted. |

All 24 new commands are registered in `app/src-tauri/src/lib.rs` under a `// V2 — adaptive intelligence persistence foundation (schema v11)` block.

### TypeScript foundation — `app/src/domains/adaptive/`

- `types.ts` — row types for all six slices (exact camelCase wire names), the `PlanningDiffChange` typed vocabulary (`keep | add | move | shorten | defer | drop-occurrence | mark-occurrence-done | mark-occurrence-skipped`; `could-not-fit` is deliberately **not** a change), and `parsePlanningDiffChanges(json)` which returns `null` on any malformed entry rather than a partially-trusted list. `DEFAULT_TODAY_CAPACITY = "normal"`.
- `repo.ts` — `SqliteRepo` + `LocalRepo` pairs and `make*Repo()` factories for the four slices (`CaptureProposalsRepo`, `AssessmentScopeRepo`, `AdaptivePlanningRepo`, `TodayStateRepo`). SqliteRepo targets each slice's own domain commands; LocalRepo is the browser-dev fallback matching the pattern used by every existing PBOS repo.
- `index.ts` — barrel.

**Not wired into any store, context, page, or the app bundle** — deliberate. Blueprint 07 §18-B: "No UI dependency should be necessary to prove persistence." The JS bundle size is unchanged (884.38 kB) because nothing imports `domains/adaptive` yet except its test.

### Semantic families — status

| Family | Blueprint | This run |
| --- | --- | --- |
| **Capture Proposal** (§4.1) | fact / interpretation, tied to raw input, distinct from recommendations | Table + Rust repo + TS types/repo + tests. **Parser, bundle UI and apply pipeline: Phase D.** |
| **Intelligence Recommendation** (§4.2) | existing durable Recommendation + DecisionEvent architecture | **Unchanged this run.** `RecommendationKind` / `applyAdapters.ts` still the V1 four kinds. Extension is Phase C + I. |
| **Planning Diff** (§4.3) | typed schedule changes + inverse info, whole-state validation, Apply, Undo | Durable `planning_change_sets` table + typed `PlanningDiffChange` + validator + repo + tests. **Diff engine, review UI, atomic Apply/Undo: Phase F.** |

### Not started this run (Phases C–K)

Shared explicit mutation engine (`app/src/domains/mutations/`); Natural Capture V2 (parser, segmentation, permission filtering, entity resolution, duplicate detection, drawer, inbox evolution); Assessment Scope UI + academic attention/study-requirement engine; Adaptive Planning concrete-date placement engine + Planning Diff review/apply/undo; Adaptive Today `todayEngine.ts` + follow-plan/adapt UI + Focus evidence propagation; Knowledge "Generate Recall" + governed mastery path; Routine pattern engine + thresholds; AI Coach contextualization + new recommendation sources; Weekly Review prepopulation; screen refinement + visual QA.

---

## Data migration

### Exact tables / columns added

See the schema table above. Every column, type, default, FK action and index is per blueprint 07 §6.1–§6.6. Deviations from the blueprint's "suggested columns": **none**.

### Migration tests (`app/src-tauri/src/db.rs`, module `db::tests`)

| Test | Proves |
| --- | --- |
| `v11_schema_version_is_eleven_and_matches_the_last_migration` | `CURRENT_SCHEMA_VERSION == 11`, `schema_version(conn) == 11`, `MIGRATIONS.last().0 == 11` |
| `v11_adds_the_six_adaptive_tables_and_keeps_every_v1_table` | builds a real v10 DB (migrations 1–10 only), then applies v11: every v10 table still present, exactly the six new tables added, `after.len() == before.len() + 6` |
| `v11_is_idempotent_and_preserves_pre_existing_rows` | seeded `academic_courses` / `academic_topics` / `capture_inbox` rows survive; `run_migrations` run 3× is a no-op; V1 `capture_inbox.proposed_type` / `parsed_payload` columns still present |
| `v11_capture_proposals_round_trip_and_cascade_with_the_inbox_row` | fact + interpretation rows round-trip; deleting the inbox row CASCADEs its proposals |
| `v11_assessment_topic_scope_cascades_from_both_sides` | deleting a topic removes only its scope link; deleting the assessment clears all its scope |
| `v11_action_constraints_are_one_to_one_and_cascade_with_the_action` | `splittable` defaults to 0; deleting the Action removes the constraint |
| `v11_occurrence_exception_keeps_the_recurring_template_and_survives_reopen` | real file DB **close + reopen**: exception + `replacement_block_id` persist; recurring template row (`date IS NULL`) untouched; deleting the replacement block SET NULLs the link; deleting the template CASCADEs exceptions |
| `v11_occurrence_exception_is_unique_per_block_and_date` | second row for the same `(block_id, occurrence_date)` is rejected |
| `v11_planning_change_set_and_today_capacity_survive_close_and_reopen` | real file DB **close + reopen**: change-set `scope` + `changes_json` and today `capacity_level` persist; `today_operating_state` has no `current_block` / `next_block` / `gaps` / `overload` / `fragility` column |
| `v11_action_constraints_do_not_restate_the_action_estimate` | `action_scheduling_constraints` has no `est_minutes` / `estimate_minutes` / `total_minutes` column |

Plus the pre-existing `migrations_are_idempotent` still passes at v11.

### Per-slice Rust round-trip / FK / wire tests

- `capture.rs::tests` — `one_capture_owns_many_fact_and_interpretation_proposals`, `proposals_cascade_when_the_inbox_row_is_deleted`, `proposal_upsert_preserves_created_at_and_moves_status`, `proposal_rejects_unknown_class_confidence_or_status`, `proposal_wire_shape_matches_the_frontend_payload`.
- `academic.rs::tests` — `scope_accepts_same_course_topics_and_is_explicit_only`, `scope_rejects_a_topic_from_a_different_course`, `scope_rejects_a_missing_assessment_or_topic`, `scope_set_replaces_atomically_and_rejects_the_whole_batch_on_a_bad_topic`, `scope_links_cascade_from_assessment_and_topic`, `scope_wire_shape_matches_the_frontend_payload`.
- `planning.rs::tests` — `action_constraint_round_trips_and_defaults_to_unsplittable`, `action_constraint_cascades_with_its_action_and_rejects_a_ghost`, `action_constraint_rejects_an_unknown_time_window`, `skip_one_occurrence_does_not_touch_the_recurring_template`, `defer_one_occurrence_links_a_pinned_replacement_that_set_nulls_on_delete`, `occurrence_upsert_is_unique_per_block_date_and_rejects_a_bad_state`, `change_set_stores_only_changes_and_inverse_changes_with_valid_json`, `change_set_rejects_a_bad_scope_status_or_malformed_json`, `v2_planning_wire_shapes_match_the_frontend_payloads`.
- `today.rs::tests` — `set_get_and_default_absence_is_not_zero`, `upsert_is_one_row_per_date`, `rejects_an_unknown_level_or_source`, `capture_approved_source_is_allowed`, `wire_shape_matches_the_frontend_payload`.

### Backward compatibility

- Migrations 1–10 unchanged; v11 is additive only.
- `capture_inbox` V1 columns and rows are untouched; existing unresolved captures keep loading through the unchanged `capture_load` / `CaptureRepo`.
- No existing Rust struct, Tauri command, TS type, store or repo signature changed. All 103 pre-existing Rust tests and 676 pre-existing Vitest tests still pass.

### SQLite reopen verification

Three real on-disk `Connection::open(path)` → write → drop → reopen tests (occurrence exceptions, planning change sets, today capacity) pass, following the same pattern as the RC1 planning-block regression test.

---

## Screen impact delivered

| Screen | Blueprint tier | This run |
| --- | --- | --- |
| Every screen listed in blueprint §15 (Today, Capture Inbox, Planner, Academics Overview, Course Detail, Normal Study, Knowledge Topic Detail, AI Coach, Weekly Review, Calendar, Mastery Check, Routines, Focus, Analytics, Settings, Command Palette, …) | major / moderate / minor | **not reached — unchanged.** Phase B is persistence-only with no UI dependency by design. |
| Splash / startup | keep | unchanged |

No component, page, route, style token or `DESIGN.md`-governed surface was modified.

---

## Tests

All commands run from `app/` on branch `v2/adaptive-intelligence-foundation` at `098099d`.

| Check | Command | Result |
| --- | --- | --- |
| Vitest | `npm test` | **693 passed**, 87 files, exit 0 (+17 vs baseline: `src/domains/adaptive/repo.test.ts`) |
| Lint | `npm run lint` | exit 0 — same pre-existing warning set as baseline, no new warnings/errors from V2 files (`oxlint src/domains/adaptive src-tauri` is clean) |
| Type-check + build | `npm run build` | exit 0; bundle unchanged at 884.38 kB (adaptive module not imported by the app yet) |
| Rust unit | `cargo test --manifest-path src-tauri/Cargo.toml` | **138 passed**, 0 failed (+35 vs baseline) |
| Release check | `cargo check --release --manifest-path src-tauri/Cargo.toml` | exit 0 (finished in 2m38s) |
| Browser E2E | `npm run test:e2e` | **63 passed**, exit 0 (3.1m) |
| Tauri build | `npm run tauri:build` | **not run this checkpoint.** Deferred deliberately: it produces an installer that would run migrations against the packaged app; per blueprint §6/§19 and `CLAUDE.md` ("Do not launch a native packaged app against the user's durable SQLite until the V2 migration is finalized"), a native/packaged build is appropriate only once the V2 schema is final across all phases. `cargo check --release` (compile parity for the release profile) passes. |
| WDIO native E2E | `npm run test:e2e:tauri` | **not run.** No renderer-facing change this run; the documented `tauri-plugin-wdio` renderer limitation in `CLAUDE.md` still stands and is unrelated to V2. |
| Accessibility (axe) | via Playwright | the existing axe assertions across the E2E suite pass; no new screens to audit this run. |

No AI provider (fake or live) was exercised — Phase B touches no AI path.

---

## Visual QA

Not performed — no UI changed this run. Agent Browser / Impeccable audit is Phase J work, to run after the V2 screen behavior lands. Remaining visual debt: none introduced.

---

## Git

| | |
| --- | --- |
| Branch | `v2/adaptive-intelligence-foundation` (local only) |
| Commits created this run | `ffd84f6` `docs(v2): lock consolidated master blueprint` · `098099d` `feat(v2): add adaptive intelligence persistence foundation` |
| Final HEAD | `098099d` |
| Files changed (Phase B) | `app/src-tauri/src/{db,academic,capture,planning,lib}.rs` (modified), `app/src-tauri/src/today.rs` (new), `app/src/domains/adaptive/{types,repo,repo.test,index}.ts` (new) — 10 files, +3094 / −2 |
| Files added (Phase A) | the six extracted blueprint passes + root consolidated blueprint + master prompt + new `07 - Consolidated V2 Master Blueprint.md` — 10 files, +5872 |
| Force push | none |
| Remote push | none |
| V1 release history / tag | untouched; no "V1 Batch 11" created; release version unchanged (`1.0.0-rc.2`) |
| Pre-existing `stash@{0}` | left as-is |

---

## Remaining work — resume plan

The blueprint's Phase order (07 §18) is unchanged. Resume at **Phase C**. Each phase must be tested before the next, per §16.

### Phase C — shared explicit mutation engine  *(next; highest priority)*
- Create `app/src/domains/mutations/` with a `MutationKind` registry: `{ kind, domain, validate, resolveEntity?, describeCurrent, preview, apply, triggersReplan?, revision behavior }`. Unknown kind rejected; **no** generic `applyPatch` / `writeTable` / model-chosen command.
- Migrate the four existing `intelligence/applyAdapters.ts` adapters (`create-action`, `schedule-block`, `set-knowledge-review`, `adjust-routine-cadence`) onto the registry **without changing V1 AI Apply behavior** — keep `applyAdapters.ts` as a thin shim over the registry until Phase I, or re-point its consumers. Parity test the existing `applyAdapters.test.ts` expectations.
- Add the remaining blueprint kinds as real canonical operations only where a deterministic domain method exists: `create-expense`, `routine-checkin`, `set-professor-coverage`, `set-personal-study`, `create-assessment`, `update-assessment-date`, `update-assessment-scope` (uses `acad_assessment_scope_set` from this run), `create-language-session`, `set-today-capacity` (uses `today_state_set` from this run), `adjust-routine-window` / `-duration` / `-days`.
- Focused test per kind (§16.7); commit `refactor(v2): unify validated canonical mutation adapters`.
- Safest next step if interrupted: land the registry + the four migrated adapters + parity tests first, commit, then add new kinds incrementally.

### Phase D — Natural Capture V2
Evolve `app/src/domains/capture/` (do **not** fork a `natural-capture-v2` store). Deterministic local segmentation/classification → permission filter → optional provider enhancement → entity resolution → duplicate detection against canonical Focus/session evidence → multi-`CaptureProposalRecord` bundle → Accept/Modify/Reject → shared mutation validation (Phase C) → canonical apply → revision → optional separate Intelligence Recommendation(s). Global drawer + evolve `/capture-inbox`. Persistence for this already exists (`capture_proposals` + `adaptive` repo). Tests per §16.1. Commit `feat(v2): evolve quick capture into natural capture`.

### Phase E — Assessment Scope + Academic Intelligence
Wire `acad_assessment_scope_*` into the academic store + Course Detail / Assessment form UI (`getTopicsForAssessment`, `setAssessmentScope`). Extend `studyEngine.ts` with inspectable deterministic reason comparators (no `priorityScore`), Normal/Midterm-Final/Recovery ordering, derived course attention (Immediate/Watch/Stable, never mutating `Course.status`), transient `StudyRequirement`/`PlanningCandidate`. Tests per §16.2. Commit `feat(v2): add assessment scope and academic attention intelligence`.

### Phase F — Adaptive Planning
Concrete-date candidate placement engine over an ISO horizon consuming `action_scheduling_constraints` + `planning_occurrence_exceptions` + capacity + protection rules (§10.3 1–16). Planning Diff builder producing `PlanningDiffChange[]` + inverse; review UI (`PlanningDiffReview`/`Row`); **atomic** Apply (Rust transaction command or equivalent) writing `planning_blocks` + occurrence exceptions together; Undo from `inverse_changes_json`. `planning_change_sets` persistence already exists. Tests per §16.3 incl. skip/defer/edit-template. Commit `feat(v2): add adaptive planning diffs and occurrence control`.

### Phase G — Adaptive Today + Focus evidence propagation
Pure `todayEngine.ts` taking `now` explicitly; derive current/next/elapsed-unresolved/gap/remaining/capacity/fragility. Follow-Plan vs Adaptation-Needed with the §11.2 precedence. Daily capacity via `today_state_*` (persist only low/normal/high; never inferred). Focus context propagation + planned-vs-actual from linked sessions. Tests per §16.4. Commit `feat(v2): make Today an adaptive execution surface`.

### Phase H — Knowledge + Routine contextual intelligence
"Generate Recall" reusing `mastery_checks` (no AI question-bank table; questions alone never move mastery); routine deterministic pattern engine with the centralized thresholds (≥6 opportunities; ≥4 per compared bucket). Tests per §16.5–§16.6. Commit `feat(v2): add contextual knowledge and routine intelligence`.

### Phase I — AI Coach contextual integration
Route contextual recommendations through the Phase-C registry; extend `RecommendationSource` union (`contextual`, `capture`, `adaptive-today`, `academic`, `knowledge`, `routine`, `planning`) preserving existing values; deterministic derived facts in AI context; provider-failure fallback. Commit `feat(v2): evolve ai coach into contextual reasoning layer`.

### Phase J — Reviews + screen refinement + visual QA
Weekly Review prepopulation; polish major V2 screens within `DESIGN.md`; Agent Browser audit at 1440×900 and 1280×800; axe on materially changed screens; Impeccable critique/layout/quieter/distill/polish/harden last. Commit `feat(v2): complete review flow and v2 interface integration`.

### Phase K — Full regression
`npm test` / `npm run lint` / `npm run build` / `npm run test:e2e` / `cargo test` / `cargo check --release`; then `npm run tauri:build` (now that the schema is final); `npm run test:e2e:tauri` reporting the known renderer limitation truthfully. E2E flows 1–10 from §16.9.

### Assumptions recorded this run
- **New Rust module `today.rs`** rather than folding today-capacity into `performance.rs` — Today has no existing Rust module and the slice is self-contained; smallest coherent unit.
- **New TS folder `app/src/domains/adaptive/`** houses the V2 persistence types/repos as one reviewable unit instead of scattering edits across four V1 domain type files. Phase C–G may re-export these from their domain stores; no data model changes when they do.
- `capture_proposals`' TS type is named **`CaptureProposalRecord`** because `capture/types.ts` already exports a V1 type named `CaptureProposal` (the deterministic classifier proposal). No V1 type was renamed.
- `academic_assessment_topics.source` allows `'ai-applied'` in addition to the blueprint's `'user'` / `'capture-approved'`, anticipating Phase I; default remains `'user'`.

Nothing is hidden. Phase B is complete and verified; Phases C–K are not started.
