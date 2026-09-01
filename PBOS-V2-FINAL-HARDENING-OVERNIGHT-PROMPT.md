# PERFORMANCE BUDDY OS V2 — FINAL HARDENING / COMPLETION RUN
## Resume from HEAD `50e2435` on `v2/adaptive-intelligence-foundation`

You are continuing an already-built PBOS V2 implementation.

This is **NOT another architecture-discovery run** and **NOT a rewrite**.

Phases A–K have already been executed. The current repository is reported at:

- Branch: `v2/adaptive-intelligence-foundation`
- HEAD: `50e2435`
- `main` remains untouched at `c1e82a3`
- Nothing has been pushed
- V1 release history/tag remains intact
- Schema v11 is already implemented
- Tauri packaged build already succeeds
- Final checkpoint regression:
  - Vitest: 814 passed / 98 files
  - Playwright: 69 passed + 1 conditional skip
  - Cargo: 138 passed
  - lint: exit 0
  - build: exit 0
  - cargo check --release: exit 0
  - tauri build: exit 0

The existing `PBOS-V2-IMPLEMENTATION-REPORT.md` documents five remaining items:

1. single transactional Rust `plan_apply_change_set` command
2. Agent Browser / Impeccable visual hardening pass
3. contextual recommendation generation surfaced appropriately across domain surfaces
4. `test:e2e:tauri` execution / documented WDIO limitation
5. provider-wired Obsidian note-preview support for Generate Recall

Your job is to close these gaps carefully, audit the complete V2 implementation for cross-domain correctness, and leave a release-candidate-quality safe checkpoint.

Do **not** broaden V2 scope.

---

# 0. ABSOLUTE RULES

Read and follow completely:

- `CLAUDE.md`
- `DESIGN.md`
- `PBOS-V2-IMPLEMENTATION-REPORT.md`
- `PBOS-V2-CLAUDE-CODE-MASTER-GIGA-PROMPT.md`
- `PBOS-V2-PHASE-C-TO-K-CONTINUATION-PROMPT.md` if present
- `docs/27 - V2 Adaptive Coach/V2 Master Blueprint - 2026-09-01/07 - Consolidated V2 Master Blueprint.md`
- Passes 1–6 in the V2 Master Blueprint folder

Do not restart A–K.

Do not rewrite schema v11 unless a concrete correctness defect exists.

Do not:
- create new product pillars
- redesign all screens
- create a second schedule
- create duplicate Action/task truth
- create duplicate mastery truth
- create generic AI database writes
- change version/tag/release history
- push remote
- force push
- reset/discard user work
- enable live paid-provider calls in acceptance tests
- loosen permission/privacy boundaries
- silently send Obsidian note bodies to generic AI context

Default loop:

**inspect → verify → implement → test → visually inspect → fix → retest → commit**

When one item is complete and green, continue automatically to the next.

---

# 1. VERIFY CURRENT CHECKPOINT FIRST

Before changes:

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -12 --oneline
```

Confirm:

- branch is `v2/adaptive-intelligence-foundation`
- HEAD includes the A–K commits
- working tree is clean or only contains known safe user files
- implementation report matches current code

Then run a compact checkpoint verification:

From `app/`:

```bash
npm run build
npm test
```

And:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Do not spend the run redoing the whole regression unless checkpoint verification fails.

If green, proceed.

---

# 2. PRIORITY 1 — TRUE TRANSACTIONAL PLANNING CHANGE-SET APPLY

The current store-level rollback is useful but is not the final durability boundary.

Implement one Rust/Tauri transactional command for Planning Diff application.

Preferred conceptual command:

`plan_apply_change_set`

Use the actual repo naming conventions.

## 2.1 Requirements

One SQLite transaction must atomically perform the selected Planning Diff mutations needed by one change set.

It must support the persisted change vocabulary already implemented, including applicable operations such as:

- add concrete/date-pinned block
- move block
- shorten block
- defer recurring occurrence
- mark recurring occurrence skipped/done
- occurrence replacement linkage
- eligible block removal only where the existing diff semantics permit it
- planning change-set status update
- inverse-change persistence needed for Undo

Do NOT implement arbitrary SQL payloads.

The renderer sends a typed validated change-set structure.

Rust must:
1. deserialize an explicit allowlisted shape
2. revalidate critical invariants
3. begin transaction
4. apply all changes
5. update occurrence exceptions/change-set state
6. commit only if every operation succeeds
7. rollback automatically on any error

The user must never see “applied” if only part persisted.

## 2.2 Concurrency / stale state

Add a lightweight stale-state safety mechanism if the current model makes it necessary.

Prefer a deterministic expected-before check for affected rows rather than inventing a large versioning framework.

If the canonical state no longer matches the reviewed change-set:
- fail with a clear validation/stale-plan error
- do not partially apply
- require regeneration/review

Do not silently override newer state.

## 2.3 Undo

If Undo currently applies through multiple non-transactional operations, provide the equivalent atomic Rust path for inverse changes.

Undo must:
- validate current state where necessary
- apply inverse set atomically
- mark change set `undone`
- preserve audit trail

## 2.4 Tests

Add Rust tests for:

- all-or-nothing success
- failure in middle leaves database unchanged
- stale expected state fails
- recurring occurrence defer + replacement atomicity
- undo atomicity
- close/reopen persistence
- exact Tauri wire JSON shape

Add TS repo/store tests proving the frontend command payload matches Rust serde exactly.

After targeted tests:
- `npm run build`
- relevant Vitest
- `cargo test --manifest-path src-tauri/Cargo.toml`

Commit:

`fix(v2): make planning change-set apply atomic`

Continue.

---

# 3. PRIORITY 2 — CONTEXTUAL INTELLIGENCE SURFACE AUDIT

The report says contextual recommendation generation is not surfaced everywhere intended.

Do **not** interpret this as “put AI cards on every screen.”

The locked product principle is:

> Intelligence is distributed; authority remains in canonical domain engines.

And DESIGN.md requires calm hierarchy.

## 3.1 Build a Contextual Intelligence Surface Matrix

Before changing UI, inspect the existing routes/screens and create a concise internal matrix in the implementation report or a temporary engineering note:

For each major/moderate V2 screen classify:

- deterministic intelligence available?
- AI/provider enhancement useful?
- recommendation action useful?
- explanation action useful?
- no AI surface needed?

Required screens to review:

### Primary V2 operational surfaces
- Today
- Planner
- Calendar
- Academics Overview
- Course Detail
- Normal Study
- Knowledge Overview
- Knowledge Topic Detail
- Routines Overview
- Routine Detail
- AI Coach
- Weekly Review

### Secondary / contextual
- Focus
- Analytics Overview
- Patterns
- Language Overview
- Development Overview
- Fitness Overview
- Money Overview
- Settings AI section

Do not add AI to a screen when deterministic state already answers the question adequately.

## 3.2 Required contextual behaviors

Aim for contextual actions like:

Today:
- “Why this?”
- “Explore alternatives”
only when an adaptive recommendation exists.

Planner:
- explanation of Planning Diff
- “consider alternatives” when Could Not Fit/tradeoff exists

Academics:
- “Why this topic?”
- method suggestion on weak/repeated weakness
- plan selected Study Requirement

Knowledge:
- Generate Recall
- explain evidence gap
- source/method suggestion

Routine:
- explain detected pattern
- review structural recommendation

Weekly Review:
- explain major pattern/recommendation
- create proposal from review when appropriate

AI Coach:
- deep reasoning / cross-domain comparison

## 3.3 Avoid recommendation spam

No screen should become:

- 8 AI insight cards
- a permanent “Ask AI” hero
- a generic chat box
- equal recommendation cards everywhere

Use:
- contextual button/link
- compact `ContextualInsight`
- `WhyThis`
- existing RecommendationCard only when there is a real durable recommendation

AI surfaces are subordinate to execution/state.

## 3.4 Permissions

Every remote/contextual generation path must use the existing permission system.

Money remains no-access by default.

No permission widening.

Provider unavailable:
- deterministic state remains
- contextual AI action shows honest unavailable/degraded state
- no broken page

## 3.5 Tests

Add only meaningful tests:
- contextual action appears when relevant
- absent when no recommendation/context
- provider unavailable does not break page
- permission denied prevents context
- recommendation created separately from deterministic fact

Commit:

`feat(v2): complete contextual intelligence surfaces`

Continue.

---

# 4. PRIORITY 3 — PROVIDER-WIRED OBSIDIAN NOTE PREVIEW FOR GENERATE RECALL

The existing product boundary is hard:

> Obsidian owns authoritative Markdown note bodies.

PBOS stores metadata + governed references only.

Generic AI domain context must NOT contain note bodies.

## 4.1 Explicit user-triggered flow only

Implement provider-backed note-preview use only for an explicit Knowledge/Generate Recall action.

Suggested flow:

Knowledge Topic
→ user clicks Generate Recall
→ UI shows/selects permitted linked source(s)
→ PBOS reads selected Obsidian preview on demand
→ permission check
→ scoped AI request
→ structured recall questions
→ governed Mastery Check
→ only completed/evaluated check may create Evidence

Do not automatically send every linked note.

Do not index note bodies into AI memory.

Do not store the note preview in AI recommendation history.

Do not persist generated prompt content as authoritative note content.

## 4.2 Permission boundary

Knowledge permission must allow the scoped operation.

If an additional Obsidian/content permission model already exists, obey it.

If no separate Obsidian permission exists, the explicit source selection + Knowledge permission + user-triggered action is the authority boundary.

Do not invent broad background vault access.

## 4.3 Preview limits

Reuse the existing on-demand preview/truncation behavior.

Do not send an unlimited file.

Keep provider payload bounded.

If the preview is truncated:
- disclose that generated recall used a partial preview
- do not pretend full-note coverage

## 4.4 Provider failure

If provider unavailable:
- user can still use deterministic/manual mastery check path
- no note content is lost
- page remains functional

## 4.5 Tests

Prove:

- generic AI Coach context does not contain note body
- Generate Recall can use explicitly selected preview
- unselected notes are not sent
- permission denied prevents request
- provider failure is graceful
- generated questions alone do not change mastery
- completed check still uses explicit Evidence path
- no note-body persistence introduced

Commit:

`feat(v2): wire scoped obsidian previews into recall generation`

Continue.

---

# 5. PRIORITY 4 — AGENT BROWSER + VISUAL HARDENING PASS

This phase is not a redesign.

Use `DESIGN.md` as the visual constitution.

Use:
- Agent Browser for interactive visual QA
- Impeccable only for critique/layout/quieter/distill/polish/harden/optimize
- existing PBOS components first

Do not run `impeccable init`.

## 5.1 Start the app in the supported dev/browser QA mode

Use the existing repo workflow.

Primary viewport:
- 1440×900

Secondary:
- 1280×800

Reduced-motion pass:
- verify critical screens with reduced motion enabled

## 5.2 Audit these screens

### Tier 1 — must inspect carefully
1. Today
2. Natural Capture drawer
3. Capture Inbox
4. Planner
5. Planning Diff Review
6. Calendar
7. Academics Overview
8. Course Detail
9. Normal Study
10. Knowledge Topic Detail
11. Routine Detail
12. AI Coach
13. Weekly Review

### Tier 2 — quick consistency pass
- Knowledge Overview
- Routines Overview
- Focus
- Analytics Overview
- Patterns
- Settings / AI permissions

## 5.3 Check each for

Hierarchy:
- one obvious primary purpose
- primary → secondary → tertiary
- no equal-card dashboard regression

Visual identity:
- matte graphite/black
- restrained steel-blue accent
- no neon/cyberpunk
- no generic AI-purple
- no decorative AI orb
- no unnecessary glow/glass

Spacing:
- alignment
- consistent spacing scale
- no arbitrary cramped regions
- no giant dead space with tiny floating card unless intentionally calm

Typography:
- headings correct
- dense labels readable
- long text wraps safely
- no clipped IDs/titles

States:
- empty
- populated
- long content
- loading
- error
- provider unavailable
- permission limited
- Could Not Fit
- applied/undo
- ambiguous Capture
- multiple proposals

Interaction:
- keyboard
- focus ring
- escape/close drawer
- no focus trap leaks
- scroll behavior
- disabled state
- reduced motion

Accessibility:
- labels
- aria states
- status not color-only
- axe for materially changed screens

## 5.4 Fix real issues only

Do not change layout merely for novelty.

Prefer:
- whitespace
- typography hierarchy
- dividers
- grouping
- progressive disclosure

before adding cards.

If a component pattern is missing:
1. existing PBOS
2. 21st.dev
3. Magic UI
4. Vengeance
5. UILora
6. DevUI

Borrow behavior only.
Re-map to PBOS tokens.
Do not import another design system wholesale.

## 5.5 Visual evidence

Record in `PBOS-V2-IMPLEMENTATION-REPORT.md`:

- screens inspected
- viewports
- issues found
- fixes made
- screens that required no change
- any remaining visual debt

Commit:

`polish(v2): harden adaptive interface and accessibility`

Continue.

---

# 6. PRIORITY 5 — NATIVE E2E / WDIO VERIFICATION

Run:

```bash
npm run test:e2e:tauri
```

Use the documented `CLAUDE.md` expectation.

Do not alter product source just to force WDIO renderer DOM testing if the known upstream/plugin limitation remains.

Record:

- diagnostic result
- driver/service result
- whether WebView2 session opens
- exact renderer limitation
- whether the limitation is unchanged from V1

If a straightforward non-product configuration fix is available and safe, apply it.

If solving it requires invasive product changes solely for test infrastructure:
- do not do that in this run
- document as infrastructure limitation, not V2 product failure

No commit is required if nothing changes.

---

# 7. CROSS-DOMAIN INTEGRITY AUDIT

After the five remaining items, do an independent V2 correctness audit.

This is NOT another feature phase.

Inspect these end-to-end chains:

## 7.1 Natural Capture

raw input
→ durable inbox
→ proposals
→ permissions
→ resolution
→ Mutation Registry
→ canonical domain
→ revision
→ reload

Confirm:
- no duplicate canonical store
- no silent partial bundle success
- unknown remains unknown

## 7.2 Academic

assessment
→ scope
→ attention
→ Study Requirement
→ Planning Candidate
→ Planner
→ Today
→ Focus
→ Knowledge evidence

Confirm:
- scope never guessed
- duration ≠ mastery
- grade math unaffected

## 7.3 Planning

Action/Requirement
→ constraints
→ candidate
→ diff
→ transactional Apply
→ occurrence exception
→ Today
→ Undo

Confirm:
- recurring template survives one-off changes
- manual/locked intent preserved
- no schedule duplication

## 7.4 Today

Planner
+ actual Focus
+ capacity
+ domain attention
→ Follow Plan or Adaptation

Confirm:
- elapsed ≠ missed
- buffer can remain
- capacity subjective only

## 7.5 Knowledge

topic
→ note/source
→ recall
→ check
→ evidence
→ mastery

Confirm:
- generated question ≠ evidence
- note read ≠ mastery
- note body remains Obsidian-owned

## 7.6 Routine

schedule
→ logs
→ deterministic pattern
→ recommendation
→ user decision
→ Mutation Registry
→ canonical routine

Confirm:
- no streak model
- rest/skipped/pending semantics
- threshold evidence required

## 7.7 AI

permission
→ deterministic context
→ provider
→ parsed recommendation
→ decision
→ Mutation Registry
→ canonical Apply

Confirm:
- model never has arbitrary write authority
- Money remains no-access by default
- provider unavailable does not break PBOS

If you discover a real integration defect:
- fix it
- add regression test
- commit it under a precise bug-fix commit

Do not invent new scope.

---

# 8. FINAL REGRESSION

After all work:

From `app/`:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

Then:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --release --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

Run:

```bash
npm run test:e2e:tauri
```

and report its exact status.

Also run targeted accessibility checks on major changed screens.

Do not require live paid AI provider.

Use fake/test provider for automated acceptance.

---

# 9. FINAL IMPLEMENTATION REPORT

Update:

`PBOS-V2-IMPLEMENTATION-REPORT.md`

Add a final section:

# Final Hardening Run

Include:

## Starting checkpoint
- HEAD
- branch
- clean state

## Remaining-item closure

For each of the five checkpoint items:
- DONE
- PARTIAL
- DEFERRED

with evidence.

## Atomicity
- transaction command name
- all-or-nothing tests
- Undo tests
- stale-state behavior

## Contextual intelligence matrix
- where contextual AI is surfaced
- where intentionally not surfaced
- permission/fallback behavior

## Obsidian / Recall privacy
- explicit note-selection flow
- payload bounds
- no generic note-body context
- no note-body persistence

## Visual QA
- screens/viewports
- Agent Browser
- accessibility
- fixes

## Native E2E
- exact WDIO result
- known limitation

## Full regression
Exact counts/results for:
- Vitest
- Playwright
- Cargo
- lint
- build
- release check
- Tauri build
- WDIO

## Git
- commits
- final HEAD
- working tree
- confirm nothing pushed

## Remaining V2 scope
Be strict.

If every locked V2 acceptance criterion is implemented and verified:
state:

`V2 IMPLEMENTATION PASS — RELEASE CANDIDATE READY FOR PRODUCT-OWNER QA`

If only non-product infrastructure limitations remain and all product acceptance criteria are verified:
state that explicitly.

If a real product acceptance item remains:
state:

`V2 PARTIAL — SAFE CHECKPOINT`

and identify the exact remaining item.

---

# 10. STOP RULES

Do not stop because:
- it is late
- the run is long
- the visual pass finds multiple issues
- WDIO has the already-known limitation
- tests initially fail

Diagnose, fix, retest.

Do not spend hours fighting an upstream infrastructure limitation after proving it is unchanged and non-product.

Do not broaden scope to V3/mobile/cloud/sync/multi-user/vector RAG/etc.

When the final hardening and regression are complete, leave:
- coherent commits
- clean working tree
- no remote push
- updated report
- exact final status

Begin now by reading the report and verifying HEAD `50e2435`.
