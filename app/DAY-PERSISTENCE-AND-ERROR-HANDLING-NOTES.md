# Real Persistence + Error/Save-Failure Handling — Changelog

## The two gaps, both closed honestly

### 1. Persistence — real, but scoped honestly

**Built:** `domains/persistence/` — `types.ts`, `engine.ts` (`attemptSave`/
`attemptLoad`, testable via an injectable `StorageAdapter`),
`usePersistedState.ts` (the real hook, backed by actual
`window.localStorage`), `testControls.ts` (an honest "simulate failure"
switch, same pattern as Onboarding's "Simulate Relaunch").

**What this actually is:** real, working persistence — Routine check-ins
now genuinely survive closing and reopening the app, because Tauri's
webview backs `localStorage` with real on-disk storage, the same guarantee
any browser gives you.

**What this is NOT, stated plainly:** this is not the authoritative SQLite
architecture from ADR-0001. That still needs real Rust-side work this
sandbox cannot do (no Rust toolchain — the same limitation flagged every
day since Day 2). This is an honest, working V1 step — the simplest thing
that's actually true today — built with a swappable adapter interface so
moving to SQLite later doesn't require changing any domain's consuming
code, only what's inside `usePersistedState`.

**Wired into:** Routine logs only, this pass. Every other domain still
resets on restart. Extending to more domains is the same pattern
(swap `useState` for `usePersistedState`), mechanical follow-up work.

### 2. Error / Save-Failure handling — real, using a real failing operation

**Built:**
- `RouteErrorBoundary.tsx` — a genuine React error boundary (uses React's
  actual `componentDidCatch`/`getDerivedStateFromError` lifecycle, not a
  simulation), wrapping each routed page individually in `AppShell`. A
  crash in one page's render cannot take down the sidebar, top bar, or any
  other page — matches §34's "smallest reasonable failing surface"
  literally, not just in spirit.
- `SaveIndicator.tsx` — the one reusable component for Saving/Saved/Save
  Failed, reusing the already-tested `saveStateLabel` from Day 17.
- The Routines page now shows real save state, and — critically — a
  genuine "Simulate Storage Failure" control that makes `localStorage`
  actually throw on write, so you can watch the real failure path: the
  indicator shows "Save Failed," and your check-in **stays checked in the
  UI** — the draft is never lost or reverted, per §36.

## Verified

- `npx tsc --noEmit` — clean
- `npx vitest run` — **6 new persistence tests, 168/168 total**, 17 test files
- `npm run build` — clean (one real import-path error was caught and fixed
  first — `components/SaveIndicator.tsx` had the wrong relative path to
  `domains/resilience`, caught by `tsc -b`, same lesson as every prior day)
- **Confirmed in the actual compiled `dist/` bundle**, not just source:
  "Simulate Storage Failure," "Simulated storage failure," and "couldn't
  load" (the error boundary's message) are all genuinely present in the
  built output

## How to actually see both working

1. Go to Routines, check a couple of items, close and reopen the app (or
   just refresh in dev) — they're still checked. That's real persistence.
2. Click "Simulate Storage Failure," then check another routine — the
   indicator shows "Save Failed" in red, but the checkbox state doesn't
   revert. Click "Stop Simulating Failure" and check something again — it
   goes back to saving normally.

## Still genuinely open

- Most domains (Goals, Academics, Money, everything else) still reset on
  restart — only Routine logs are persisted this pass
- The real SQLite/Rust persistence layer — still not buildable in this
  sandbox
- AI availability banner (engine exists, tested, not wired into AICoachPage)
- The rest of Day 18's simplification sweep beyond the 3 screens touched so far
