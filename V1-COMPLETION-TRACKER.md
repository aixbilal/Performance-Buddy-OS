# PBOS V1 Completion Tracker

Living execution tracker for turning the decided PBOS V1 into a usable desktop app.
Derived directly from `PBOS-V1-RECONCILIATION-AUDIT.md` — it does **not** add or change requirements.

**States:** `NOT STARTED` · `IN PROGRESS` · `IMPLEMENTED` · `VERIFIED` · `BLOCKED` · `DEFERRED V2+`
A finding is `VERIFIED` only when runtime and/or automated-test evidence exists for it.

**Baseline at start of Batch 0:** Overall V1 38% · Functional 30% · Visual/UX 55%.

---

## Batch Map

| Batch | Scope | Status |
|---|---|---|
| **0** | Foundation lock: SQLite persistence, localStorage migration, native renderer E2E, UI test pattern, dev-control cleanup | **VERIFIED** (commit `59e629a`) |
| **1** | PBOS Spine: Goal → System → Action (engines + CRUD + relational SQLite + tests) | **VERIFIED** |
| 2 | Creation/edit across the remaining configuration entities + Quick Capture repair | NOT STARTED |
| 3 | Planner / Calendar / Plan Builder + Today (scheduled blocks, collapse model, open-day state) | NOT STARTED |
| 4 | Focus & Academic completeness (Normal Study, Mastery Assessment/Results, Course Detail depth) | NOT STARTED |
| 5 | Knowledge & Obsidian V1 slice (vault select, filesystem read, markdown index, Notes Hub) | NOT STARTED |
| 6 | Analytics / Reviews / AI Coach — Monthly & Patterns screens, recommendation **Apply** path, decision persistence, real AI provider | NOT STARTED |
| 7 | Settings (4 decided surfaces) / Onboarding (persisted, real connect-systems) | NOT STARTED |
| 8 | Resilience & loading/partial/stale states across all screens | NOT STARTED |
| 9 | Global visual normalization (token reconcile, fonts, shared components, App Shell regions) | NOT STARTED |
| 10 | Full V1 QA & stabilization (Playwright workflow suites, native E2E expansion, a11y, signed release report) | NOT STARTED |

---

## Batch 0 — Foundation Lock (acceptance detail)

| # | Item | Status | Verification | Tests / Evidence | Deps / Blockers |
|---|---|---|---|---|---|
| 0.1 | SQLite is the authoritative production persistence layer | IMPLEMENTED | pending real-Tauri launch check | `src-tauri/src/db.rs`; `SqliteBackend` chosen when `isTauri()`; `bootstrap.ts` loads from SQLite before render | — |
| 0.2 | Tauri/Rust data-access boundary exists (no SQL in React) | IMPLEMENTED | `cargo build` clean; commands registered | `db::{kv_get_all,kv_set,kv_delete,db_status,migrate_from_localstorage}` in `lib.rs` `invoke_handler`; React only calls `invoke(...)` via `backend.ts` | — |
| 0.3 | Schema / migration mechanism with versioning | IMPLEMENTED | `cargo test` 3/3 | `db.rs` `run_migrations` + `schema_migrations` table; `MIGRATIONS` array; `migrations_are_idempotent` test | — |
| 0.4 | Existing localStorage data has a safe migration path | IMPLEMENTED | `cargo test` + `vitest` | `migrate_from_localstorage` (Rust, transactional, `ON CONFLICT DO NOTHING`) + `migration.ts` `planLocalStorageMigration` + `bootstrap.ts` orchestration | — |
| 0.5 | Migration is tested and idempotent; no duplication; no overwrite of newer data; invalid data reported not reset; version recorded; legacy kept as backup | IMPLEMENTED | `cargo test` `localstorage_migration_is_idempotent_validated_and_non_destructive`; `vitest` `migration.test.ts` (6) | marker row `meta.localstorage_migration`; belt marker `pbos.__sqlite_migrated__`; legacy keys never deleted (cleanup deferred — see note) | — |
| 0.6 | Persistence errors are truthful (loading/loaded/saving/saved/failed; degraded ≠ silent memory) | IMPLEMENTED | `vitest` `bootstrap.test.ts` (degradation path), `usePersistedState.dom.test.tsx` (saved/failed) | `PersistenceStatus` (`phase`, `degradedFrom`, `durable`, `error`); `SaveIndicator` drives off real mirror outcome; `PersistenceStatusLine` shown in Settings → "Data & Storage" | — |
| 0.7 | Dev-only storage-failure control removed from production UI, kept behind a dev mechanism | IMPLEMENTED | grep: no "Simulate Storage Failure" in `src/`; prod bundle has no `__PBOS_DEV__` | removed from `RoutinesOverviewPage.tsx`; `installDevControls()` → `window.__PBOS_DEV__` only under `import.meta.env.MODE === 'development'` | — |
| 0.8 | WebdriverIO can interact with the actual PBOS renderer (launch, see renderer, locate element, interact, navigate 2 routes, assert) | VERIFIED | `npm run test:e2e:tauri` → **2 passing** on a real `webview2 151.0.4129.107` session | `tauri-plugin-wdio` (debug-only registration in `lib.rs`); `withGlobalTauri:true`; `wdio:default` capability; `wdio.conf.ts` external provider (`tauri-driver` + `msedgedriver`) driving the renderer via `browser.tauri.execute`; `wdio/specs/app.e2e.ts` (renders real app · fires real Start button · navigates Focus→Goals · round-trips through Tauri→Rust→SQLite) | `tauri-driver` + `msedgedriver` on PATH |
| 0.9 | Baseline UI/workflow testing pattern established | VERIFIED | `vitest run` + `npm run test:e2e` + `npm run test:e2e:tauri` all green | engine test (existing 17) + React interaction test (`usePersistedState.dom.test.tsx`) + pure async logic tests (`migration/backend/bootstrap.test.ts`) + browser workflow test (`e2e/*.spec.ts`) + native E2E (`wdio/specs/app.e2e.ts`) | — |
| 0.10 | `V1-COMPLETION-TRACKER.md` exists | IMPLEMENTED | this file | — | — |
| 0.11 | Previous tests still pass | VERIFIED | `vitest run` 23 files / 190 tests pass (was 19/172) | — | — |
| 0.12 | Build + lint pass | VERIFIED | `npm run build` ✓, `npm run lint` ✓ (0 errors), `cargo build` ✓ (0 warnings), `cargo test` ✓ | — | — |
| 0.13 | No unrelated domain functionality changed | VERIFIED | `git diff` review — persistence layer + Rust + main.tsx + RoutinesOverviewPage (control removal only) + SettingsPage (status line add) + wdio/e2e config only | — | — |

**Legacy-data cleanup strategy (documented, not yet executed):** after a successful SQLite migration the legacy `pbos:*` localStorage keys are **kept** as a recovery backup. A future maintenance step (earliest Batch 8) will clear them once (a) `db_status().localstorage_migrated` is true and (b) the app has launched cleanly ≥N times, writing a `meta.localstorage_cleanup` marker. Never cleared on the strength of "migration returned success" alone.

---

## Batch 1 — PBOS Spine: Goal → System → Action (acceptance detail)

| Item | Status | Verification / evidence |
|---|---|---|
| Real Goal / System / Action engine, tested | VERIFIED | `performance/engine.ts` (pure; validation, `canTransitionGoal`, relationship resolution, `deriveSystemHealth`/`deriveGoalProgress`/`deriveGoalAttention`). `engine.test.ts` 24 tests. |
| Goals user-creatable / -editable + safe status transitions | VERIFIED | `/goals/new` + `/goals/:id/edit` (`GoalBuilderPage` + shared `GoalForm`); `store.createGoal/updateGoal/transitionGoal`; Playwright + native E2E. |
| One shared Goal Builder for manual + AI-proposed goals; AI never auto-creates | VERIFIED | `GoalBuilderPage` Manual/AI tabs; Accept/Modify only *prefill* the same form (`createdBy: "ai-approved"`); Reject creates nothing. `performance.dom.test.tsx` asserts both paths. |
| Systems user-creatable / -editable; link to 0..n Goals | VERIFIED | `SystemForm` (inline sheet) on Systems Overview + System Detail; `?newFor=<goalId>` creates-and-links from Goal Detail; `store.createSystem/updateSystem/deleteSystem/toggleSystemStar`. |
| Actions user-creatable / -editable; genuine status control; canonical + reused | VERIFIED | `ActionForm` on System Detail; explicit status `<select>` (not a hidden click-cycle), Edit, Delete, keyboard reorder; `capture/store` routes through the same `addAction` shim → `createAction` (no second task type). |
| ONE relationship truth | VERIFIED | `goal_system_links` join table (goal↔system, many-to-many) + `actions.system_id` FK (`ON DELETE SET NULL` → direct commitment). No reverse arrays anywhere. `cargo test` `crud_and_one_relationship_truth`, `repo.test.ts`, native E2E `perf_load` assertion. |
| Derived health not stored as competing state; Unknown ≠ Zero | VERIFIED | `System` has no `healthPercent`/`consistency`/`streak` columns; `deriveSystemHealth([])` → `insufficient-data`, ratio `null`; `deriveGoalProgress` with no metric → `{kind:"none"}`. Engine tests + UI ("Not enough activity yet"). |
| Fresh profile does not depend on seed data | VERIFIED | store initial state `[]`; no `SEED_*` import; `mockData.ts` reduced to a test-only `LEGACY_KV` fixture; honest empty states on both overviews. |
| Relational SQLite persistence for the spine | VERIFIED | `db.rs` migration **v2** (`goals`, `systems`, `actions`, `goal_system_links` + indexes, FKs on); `performance.rs` commands `perf_load/goal_upsert/goal_delete/system_upsert/system_delete/action_upsert/action_delete/link_set/actions_reorder/import_graph`. |
| Legacy performance-data migration — safe, idempotent, non-destructive | VERIFIED | `legacyImport.ts` (pure: parses the Batch 0 `pbos:performance-*` blobs, unions the dueling `Goal.systemIds`/`System.goalId` into one link list, `Action.systemId` wins over `System.actionIds`, drops fabricated consistency/streak numbers, preserves IDs, reports repairs). `perf_import_graph` is `INSERT OR IGNORE` + a `meta.performance_relational_import` marker. `cargo test` `import_is_idempotent_and_non_destructive`, `legacyImport.test.ts` 9, `repo.test.ts`. |
| Created data survives Tauri restart | VERIFIED | native E2E: `perf_reset_for_test` → `location.reload()` → create spine via UI → `perf_load` reads the canonical rows back out of SQLite with correct relationships. |
| Today keeps consuming canonical Actions; no domain rebuilt | VERIFIED | `TodayPage` diff is 3 lines (`"completed"`→`"done"`, `computeSystemHealth`→`systemHealth`, honest "—" for insufficient data). `search/store` diff 1 line (`g.status`→`g.lifecycle`). No other domain touched. |
| Tests / lint / build / cargo / axe | VERIFIED | vitest 27 files / 231 (was 190, +41); lint 0 errors; `npm run build` ✓; `cargo build` debug+release 0 warnings; `cargo test` 6/6; Playwright 4/4 (incl. scoped form axe = 0 critical/serious); native E2E 3/3. |

---

## P0 Findings → Batch assignment

| ID | Finding (audit §20) | Batch | Status | Verified when |
|---|---|---|---|---|
| P0-1 | No create/edit UI for any configuration entity | 1 (Goal/System/Action — **DONE**), 2 (all others) | IN PROGRESS | user can create + edit each entity in-app, persisted, no seed/code edit — runtime + Playwright per entity. **Batch 1: Goal, System, Action fully create/edit/delete + status + link; verified by React interaction tests, Playwright, native E2E + SQLite read-back. Remaining entities are Batch 2.** |
| P0-2 | Planner / Calendar / Plan Builder do not exist; planning has no mutations | 3 | NOT STARTED | user builds a plan, schedules blocks, Generate→Apply works, locks survive regen — runtime + tests |
| P0-3 | Quick Capture broken (unreachable, non-persisted inbox; `/capture-inbox` 404) | 2 | NOT STARTED | capture from palette → persisted inbox → confirm → routes to real engine — runtime + test |
| P0-4 | Core operating loop cannot be completed | spans 1–3, 6 | IN PROGRESS | full loop Goal→…→Re-plan demonstrated end to end — native E2E in Batch 10. **Batch 1 restored the creation stages: (create) GOAL, GOAL→SYSTEM, SYSTEM→ACTION are now PASS (audit §8). PLAN stage still MISSING (Batch 3).** |
| P0-5 | No real AI provider anywhere | 6 | NOT STARTED | provider abstraction + one real call path (capture classification) with key/error handling — tests + runtime |
| P0-6 | Zero UI / workflow / integration test coverage | 0 (pattern), then every batch, full in 10 | IN PROGRESS | pattern exists now; each batch ships tests for its surface |

---

## P1 Findings → Batch assignment (audit §21)

| # | Finding | Batch | Status |
|---|---|---|---|
| P1-1 | Goal Detail is a shell | 1 | **IMPLEMENTED** — now a real management surface: Edit Goal, meta (type/priority/deadline/progress), Why-this-goal, Linked Systems with Manage (link existing / create-for-goal / unlink), actions-from-linked-systems view, safe lifecycle transitions, delete. Milestones + Evidence panel + AI Insight remain deferred (docs 11.05 milestones = later; Evidence infra = P1-17). |
| P1-2 | 19 decided screens have no route | 2–6 (per domain) | NOT STARTED |
| P1-3 | Obsidian V1 integration entirely absent | 5 | NOT STARTED |
| P1-4 | No workout session logging (Actual side of Base≠Prescription≠Actual) | 2 | NOT STARTED |
| P1-5 | AI recommendation "Apply" step missing; no persisted decision history/audit | 6 | NOT STARTED |
| P1-6 | Onboarding not persisted (not resumable across restart) | 7 | NOT STARTED |
| P1-7 | Capture Inbox not persisted (compounds P0-3) | 2 | NOT STARTED |
| P1-8 | AI decision / recommendation history not persisted | 6 | NOT STARTED |
| P1-9 | No loading / partial / stale states in the UI | 8 (naturally easier once async SQLite lands — foundation from Batch 0) | NOT STARTED |
| P1-10 | `/calendar` route is wrong (sidebar "Calendar" → conflict checker) | 3 | NOT STARTED |
| P1-11 | Nav structure conflict unresolved (`UI ↔ ARCHITECTURE REVIEW REQUIRED`; Systems missing from sidebar) | 3 (needs product decision — see below) | BLOCKED (product decision) |
| P1-12 | `setSimulateStorageFailure` in production Routines UI | 0 | IMPLEMENTED (0.7) |
| P1-13 | Typography incomplete — Space Grotesk & JetBrains Mono not loaded | 9 | NOT STARTED |
| P1-14 | App Shell missing regions (context rail, notifications, companion entry) | 9 | NOT STARTED |
| P1-15 | Today missing collapse model / priority bands / open-day state | 3 | NOT STARTED |
| P1-16 | `performance` domain has zero tests | 1 | **VERIFIED** — `engine.test.ts` (24: validation, transitions, relationship resolution, health/insufficient-data, progress, attention), `legacyImport.test.ts` (9), `repo.test.ts` (7: CRUD, FK integrity, cascade, reorder, import idempotence), `performance.dom.test.tsx` (6: create/edit/link/add-action/status/validation-preserves-input, AI-proposal-never-auto-creates), plus `cargo test` (3: relational CRUD, FK rejection, import idempotence), Playwright + native E2E. |
| P1-17 | No shared Evidence infrastructure | 4–6 (introduce + adopt) | NOT STARTED — deferred out of Batch 1. The spine's health/consistency is derived deterministically in `engine.ts` (`deriveSystemHealth`, honest `insufficient-data`) without an Evidence layer; a shared Evidence model is introduced when the first evidence-producing domain lands (Batch 4). |
| P1-18 | Per-entity create/edit gaps (Course/attempt, Topic/Source, Project/Skill/Milestone, Budget/Savings, Book, Block, Capacity) | 2 | NOT STARTED |
| P1-19 | Analytics Weekly Review not persisted; Monthly Review absent | 6 | NOT STARTED |
| P1-20 | No append-only revision / audit event store (`docs/32` data class 3) | 6 (with AI audit trail) or 8 | NOT STARTED |
| P1-21 | Native desktop QA unautomatable (couldn't reach renderer) | 0 | VERIFIED (0.8 — `browser.tauri.execute` drives the real renderer) |
| P1-22 | No accessibility verification beyond first-paint axe on `/` | 10 (a11y pass), incremental per batch | NOT STARTED |

---

## P2 / P3 / V2+

P2 (audit §22, 15 items) — folded into Batch 9 (visual normalization) and the owning domain's batch. Not individually tracked until their batch starts.
P3 (audit §23) — Batch 9 / deferred to the post-V1 manual redesign phase.
V2+ (audit §24) — `DEFERRED V2+`, out of scope. Not tracked here.

---

## Open product decisions blocking specific findings

| Decision (audit §19) | Blocks | Needed for batch |
|---|---|---|
| Navigation IA — one canonical sidebar structure; is Systems top-level | P1-11 | 3 |
| Academic repeat-grade policy (`RESEARCH REQUIRED`) | accurate CGPA | 4 |
| Score→letter-grade scale | grade automation | 4 |
| AI provider for V1 (LOCAL vs approved CLOUD vs CORE-only ship) | P0-5 | 6 |
| `tokens.css` reconcile to locked palette + promote `docs/07.03` to APPROVED | P2 visual | 9 |
| Authoritative `Normal Study` reference; status of Mastery screens (under `/Review/`) | Batch 4 screens | 4 |
| Onboarding scope — 4 screens vs 1 page; minimum persisted baseline | P1-6 | 7 |

SQLite-for-V1 was an open decision in the audit; **resolved by this batch** — SQLite/Rust is now the implemented durable architecture, localStorage is dev-only fallback.

---

## Score movement log

| Date | Batch | Overall | Functional | Visual/UX | Note |
|---|---|---|---|---|---|
| — | pre-0 | 38% | 30% | 55% | audit baseline |
| — | 0 | 38% | 30% | 55% | **infrastructure only — headline % deliberately unchanged.** Durable persistence, migration, native E2E capability, and a UI test pattern do not by themselves complete any decided user workflow. |
| — | 1 | **45%** | **38%** | **57%** | Goal→System→Action spine now genuinely operable. Changed audited gaps: audit §3 problems A (read-only), B (dueling relationship arrays), C (health stored twice), D (seed masquerading as user data) — all resolved. §8 core loop: (create) GOAL, GOAL→SYSTEM, SYSTEM→ACTION BROKEN → PASS. §9 CRUD matrix: Goal C/U, System C/U, Action C/U + full status, Goal↔System link — all now ✓. §12: "No Goal Engine / No System Engine" ABSENT → PRESENT (relational model + `engine.ts`). §6 screens: Goal Builder MISSING→PASS, Goal Detail SHELL→operational, Systems Overview + System Detail PARTIAL→operational. Test coverage: a formerly-zero-test domain now has 46 tests across 6 layers. **Not moved:** Planner (Batch 3), 12 other config entities (Batch 2), AI apply (Batch 6), global visual normalization (Batch 9). |
