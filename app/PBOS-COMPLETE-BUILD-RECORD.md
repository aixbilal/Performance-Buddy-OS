# Performance Buddy OS — Complete Build Record & Handoff

**Purpose of this document:** an exact, honest inventory of everything built so far — no rounding up, no hidden gaps. Written for handoff to Claude Code / ChatGPT to continue testing, filling gaps, and completing V1.

**Last verified:** typecheck clean · 168/168 tests passing (17 test files) · production build succeeds · lint 0 errors (17 harmless known warnings) · 125 source files across 18 active domains.

---

## 1. Tech Stack (locked, per ADR-0001)

- **Desktop runtime:** Tauri (not Electron — this was a real terminology conflict flagged and resolved earlier in the build)
- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS v4, design tokens in `src/tokens/tokens.css`
- **Routing:** `react-router-dom` (hash router)
- **State:** React Context + hooks, one Provider per domain
- **Testing:** Vitest
- **Linting:** oxlint
- **Persistence:** `localStorage`, wrapped in a custom, testable abstraction (see §5) — **not** the eventual SQLite/Rust architecture from ADR-0001, which needs real Rust work that could not be done in the sandbox this was built in (no Rust toolchain available there)

## 2. How to Run This

```
cd app
npm install
npx tauri dev
```

Requires Rust + the Tauri CLI prerequisites installed on the actual machine (this was a real, multi-day struggle earlier in the build — Visual Studio C++ Build Tools are required on Windows for the Rust linker to work). Once `cargo --version` works, `npx tauri dev` should work.

To run just the frontend in a browser (faster iteration, useful for debugging things like the offline-detection banner which is easier to test in DevTools than in the Tauri window):
```
npm run dev
```
then open `http://localhost:5173`.

To run tests / typecheck / build directly:
```
npx vitest run
npx tsc --noEmit
npm run build
npm run lint
```

## 3. Architecture Pattern (applies to every domain, exceptions noted)

Every domain under `src/domains/<name>/` follows the same shape:

```
types.ts       — TypeScript types for this domain's data
engine.ts      — pure, deterministic functions (no React, no AI, no side effects)
engine.test.ts — real tests with known-correct answers for engine.ts
mockData.ts    — seed data (often taken directly from approved design references)
store.tsx      — React Context provider + hook (e.g. useAcademic()), wires engine.ts to state
<Name>Page.tsx — the actual UI screen(s)
```

**Why this matters for whoever continues this:** the `engine.ts` files are the actual business logic and are the safest, highest-value place to add tests or extend behavior. The `store.tsx` files are thin — they mostly just call engine functions and manage React state. UI pages are the least logic-heavy layer.

## 4. Domain-by-Domain Inventory — exactly what exists

| # | Domain | Route(s) | Engine tests | What it actually enforces |
|---|---|---|---|---|
| 1 | `performance` | `/`, `/goals`, `/goals/:id`, `/systems`, `/systems/:id` | (uses shared patterns, no dedicated engine.test.ts — logic is simple CRUD) | Goal → System → Action hierarchy; `addAction` is the one real creation path |
| 2 | `academic` | `/academics`, `/academics/:id`, `/academics/sgpa-cgpa` | 12 | Deterministic SGPA/CGPA math; **repeat-grade policy is deliberately unresolved** (excluded from CGPA, not guessed) because the real CUI policy was never verified — this is a genuine open product decision, not a bug |
| 3 | `knowledge` | `/knowledge`, `/knowledge/:id` | 11 | Mastery only comes from real evidence; a topic can be "Strong" AND "Review Due" simultaneously (not collapsed into one flag); Obsidian owns note bodies, PBOS only stores references |
| 4 | `development` | `/development`, `/development/skills/:id` | 9 | Knowledge/Practice/Evidence tracked as 3 separate numbers; **unreviewed AI-assisted evidence is excluded from the Evidence score** — the single most distinctive rule in this domain |
| 5 | `fitness-recovery` | `/fitness`, `/fitness/recovery` | 7 | Base Plan / Prescription / Actual kept as 3 separate immutable records; readiness requires ≥3 check-ins or shows "insufficient data" honestly instead of a fake percentage |
| 6 | `routine` | `/routine` | 8 | One shared engine for all routine types (no separate hydration/prayer/etc. engines); consistency computed with **no streak counter anywhere** |
| 7 | `language` | `/language` | 7 | Exercises alone never produce Knowledge evidence — only a real recall check does; reuses Day 5's Knowledge topic directly, no duplicate mastery tracking |
| 8 | `money` | `/money` | 8 | Savings transfers never counted as expenses; planned expenses never counted as actual until a real transaction records them |
| 9 | `analytics` | `/analytics` | 10 | No fake combined "performance score" across domains; real Pearson correlation math with a minimum sample size before reporting anything; Weekly Review snapshots are provably immutable |
| 10 | `intelligence` (AI Coach) | `/ai-coach` | 9 | Permission model (No Access / Read / Read+Recommend); **AI may recommend nothing** — proven by filtering out a real candidate when permission is denied, not just hidden in the UI; combined-impact capacity validation |
| 11 | `planning` | `/calendar` | 13 | Direct conflicts vs. capacity violations are checked as genuinely separate problems; "Could Not Fit" is a real returnable outcome; manual locks survive plan regeneration; `ScheduleBlock.actionId` links back to real canonical Actions |
| 12 | `settings` | `/settings` | 6 | Base → Mode Override → Temporary Override → Effective Configuration precedence, matching your product doc's own worked example exactly; "Restore Interface Defaults" is structurally incapable of touching academic/goal/routine data |
| 13 | `onboarding` | `/onboarding` | 18 | Full resumable state machine (not_started/in_progress/completed/skipped); the complete Day 15B startup routing tree (6 branches, all tested); existing-data protection (never silently overwrites) |
| 14 | `focus` | `/focus` | 10 | Session lifecycle state machine (idle→active→paused→completed) with invalid transitions rejected; completing a session never proves mastery unless a real recall score is entered |
| 15 | `search` | (global, via Ctrl+K) | 11 | Deterministic ranking (exact > prefix > contains > metadata); context/recency can only ever break ties within a tier, never override a better match |
| 16 | `capture` | `/capture-inbox` (+ Ctrl+K) | 8 | Deterministic rule-based classification (honestly not real AI); routes into **existing** domain functions, no duplicate creation forms |
| 17 | `resilience` | (shared infra, no own route) | 15 | The exact empty-state priority order from your approved reference (Loading→Error→Configured→Data→Filters→Otherwise); AI availability as 3 genuinely distinct states; connectivity banner logic |
| 18 | `persistence` | (shared infra, no own route) | 6 | Real save/load with genuine error handling (tested against an adapter that actually throws); distinguishes "key never existed" from "key existed but corrupted" |

**Total: 168 tests across 17 test files** (one domain — `performance` — has no dedicated engine test file since its logic is straightforward CRUD covered adequately by integration; every other domain with real calculation/decision logic has one).

## 5. Persistence — exact current state

**Every domain's state is now backed by real `localStorage`**, via one shared hook: `src/domains/persistence/usePersistedState.ts`. This genuinely survives an app restart in the real Tauri window (Tauri's webview persists localStorage to disk, same guarantee any browser gives).

**This is explicitly NOT the final architecture.** `ADR-0001` calls for SQLite via a Rust data-access layer. That was never built — it requires a real Rust development environment, which the sandbox this was built in did not have. The `usePersistedState` hook was deliberately designed with a swappable `StorageAdapter` interface (`src/domains/persistence/types.ts`) specifically so a future SQLite implementation can slot in underneath it without changing a single line of any domain's `store.tsx`.

**Storage keys currently in use** (all prefixed `pbos:`): `performance-actions`, `performance-goals`, `performance-systems`, `academic-assessments`, `academic-courses`, `academic-topics`, `academic-attempts`, `knowledge-evidence`, `knowledge-topics`, `knowledge-sources`, `development-evidence`, `development-projects`, `development-milestones`, `development-skills`, `fitness-checkins`, `fitness-plan`, `fitness-sessions`, `fitness-prescriptions`, `routine-logs`, `routine-definitions`, `language-units`, `language-lessons`, `language-books`, `money-transactions`, `money-budgets`, `money-planned-expenses`, `money-savings-goals`, `planning-blocks`, `planning-capacity`, `settings-mode`, `settings-temporary-overrides`, `settings-notifications`, `settings-appearance`.

**A genuine, real test control exists**: `src/domains/persistence/testControls.ts` lets you flip `setSimulateStorageFailure(true)` to make storage genuinely throw on write, for testing the save-failure UI path live. **This must never ship enabled** — it's a test tool, same category as Onboarding's "Simulate Relaunch."

## 6. Shared UI Components (built to eliminate real, measured duplication)

- `components/Card.tsx`, `Badge.tsx` — base primitives, used everywhere
- `components/StatCard.tsx` — built after finding the exact same label/value pattern **hand-repeated 40 times** across the app (verified by grep, not a guess); wired into Today, Academics, and Money as proof; **not yet wired into the other ~15 screens that still hand-roll the same pattern** — this is real, findable, low-risk follow-up work
- `components/EmptyState.tsx` — one shared empty/setup/error presentation component; wired into `GoalsOverviewPage` (true-empty) and `CaptureInboxPage` (positive-empty); **deliberately not wired into ~9 other small inline "nothing here yet" text lines** elsewhere, since those are small contextual notes inside already-populated cards, not full page-level empty states — converting them would be over-decorating, not simplifying
- `components/SaveIndicator.tsx` — truthful Saving/Saved/Save Failed label, wired into Routines, Money, Academics, Recovery & Readiness pages; **not yet wired into every other persisted domain's page** (Language, Development, Knowledge, Planning, Settings all persist data but don't yet show a save indicator on screen)
- `shell/CommandPalette.tsx` — real Ctrl+K, arrow nav, Enter-to-navigate, Esc-to-close
- `shell/ConnectivityBanner.tsx` — real `navigator.onLine` + browser events, not simulated
- `shell/RouteErrorBoundary.tsx` — a genuine React error boundary wrapping each routed page individually (uses real `componentDidCatch`), so one broken page can't crash the whole app

## 7. What Was Explicitly Flagged as Unresolved (real product decisions, not bugs)

1. **Academic repeat-grade policy** — your own docs mark this `RESEARCH REQUIRED`; the engine correctly refuses to guess and excludes repeated courses from CGPA rather than picking "best grade." Needs your actual institution's real policy document to resolve.
2. **Score-to-letter-grade automation** — same reasoning; grades are entered as a judgment call (`projectedGrade`/`targetGrade`), never auto-computed from a percentage, because the real grading scale was never verified.
3. **Electron vs. Tauri terminology conflict** — a later product-track handoff referred to "Electron" repeatedly; the actual locked architecture is Tauri. Flagged explicitly; nothing was built against Electron.
4. **Nav structure inconsistency** — early design references showed 3-4 different sidebar groupings across different screens. `shell/navigation.ts` picked one canonical structure (documented in a comment in that file) and every route uses it — but this was never explicitly re-confirmed by the design/product track.

## 8. What Is Genuinely Not Built (real gaps, not just "could be nicer")

1. **No real AI provider is wired anywhere.** Every "AI" behavior in this app (Quick Capture classification, AI Coach recommendations) is deterministic, rule-based, and honestly labeled as a stand-in. There is no API key handling, no actual call to Claude/GPT/Gemini/etc. This is the single largest gap between "V1 skeleton" and "V1 product" as originally scoped.
2. **No real SQLite/Rust persistence.** Covered in §5.
3. **No creation/edit UI for most "configuration" data** — Courses, Projects, Training Plans, Budgets, Savings Goals, Language Units all exist as seed data with no in-app way to create or edit them (only their *activity* — marks, check-ins, transactions — has a real creation path).
4. **The final Day 18 simplification sweep is partial** — `StatCard` and `EmptyState` address the two biggest measured duplications; a full pass across every screen wasn't done.
5. **No real desktop runtime QA from this side.** Every check above (tests, build, bundle-grep) was run in a sandboxed Linux container with no Rust toolchain — never once run in the actual Tauri window by the AI doing the building. The human user did occasional spot-checks (Onboarding flow, Focus Mode, the video splash) that worked, but a full click-through of all 18 domains in the real desktop app has not happened.
6. **Error/recovery states beyond save-failure are untested against real conditions** — the Resilience engine (`resolveResilienceState`, `deriveAIAvailability`, connectivity banner) is fully tested at the logic level, but things like "Search Index failure" or "Obsidian path missing" have no real trigger condition to test against yet (no real search index persistence, no real Obsidian filesystem integration exists).
7. **No Obsidian filesystem integration** — Knowledge domain's "Source" records are metadata-only; nothing actually reads a real Obsidian vault from disk.

## 9. Instructions for Claude Code / Next Session

1. **Read this file first**, then `git log --oneline` to see the actual commit history — many commits map directly to sections of this document.
2. **Run the full verification suite before touching anything**: `npx tsc --noEmit && npx vitest run && npm run build && npm run lint`. If any of these fail, something regressed since this document was written — find out what changed, don't just fix forward blindly.
3. **The highest-value next steps, in priority order:**
   - Real desktop QA: run `npx tauri dev`, click through all 18 routes, note anything broken
   - Wire a real AI provider (start with just Quick Capture classification, since `domains/capture/engine.ts`'s `classifyCapture` function has a clean interface a real API call could replace)
   - Build creation/edit UI for at least Courses and Projects (the two most central "configuration" gaps)
   - Extend `StatCard`/`SaveIndicator` to the remaining screens (mechanical, low-risk)
4. **Do not rebuild what already works.** Every domain listed in §4 has real tests — if something seems wrong, write a failing test first to confirm it's actually broken before changing engine logic.
5. **Preserve the honesty pattern.** Every domain here has at least one place where the engine deliberately says "I don't know" or "not enough evidence" instead of guessing. Don't remove these to make a demo look more finished — they're load-bearing for the product's actual trustworthiness.

## 10. Honest Estimate: Days to an Actual Working V1

Based on real, measured gaps above — not vibes:

| Remaining work | Est. days |
|---|---|
| Real desktop QA + bug-fixing across all 18 domains (the actual "Day 19" from the handoffs) | 3–5 |
| Real SQLite/Rust persistence, migrating off localStorage | 4–7 |
| Real AI provider integration (Quick Capture + AI Coach, with proper key/error handling) | 3–5 |
| Creation/edit UI for the missing configuration data (Courses, Projects, Training Plans, Budgets at minimum) | 3–5 |
| Remaining Day 18 simplification (StatCard/SaveIndicator to all screens, further audit) | 1–2 |
| Buffer (this project's own track record: Rust/toolchain setup alone cost multiple real days earlier) | 2–3 |

**Total: roughly 16–27 days**, realistically call it **~3–4 more weeks** at the pace this project has actually run at (a few hours a day, with real environment friction along the way).

**The honest caveat, stated the same way every day-estimate in this project has been:** this is for a genuinely complete, daily-usable V1 matching the original product vision — real AI, real persistence, all domains editable. If "V1" is redefined to mean "the current skeleton, verified working in the real desktop app, with localStorage persistence accepted as good enough for now" — that's much closer, realistically **5–8 days** (mostly the QA pass plus the smaller polish items), since everything else described in this document is already real, tested, and working.
