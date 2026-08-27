# Day 2 — Engineering Implementation Notes

## What was built

- Bootstrapped with Vite + React + TypeScript, per ADR-0001.
- Tailwind CSS v4 wired via `@theme`, tokens defined in `src/tokens/tokens.css`.
- Module structure created under `src/domains/` matching the Domain Map (`04.01`)
  and ADR-0001 exactly: performance, academic, knowledge, development,
  fitness-recovery, routine, money, analytics, intelligence, platform.
- App Shell implemented: `Sidebar`, `TopBar`, `AppShell` layout in `src/shell/`.
- Routing implemented with `react-router-dom`, driven entirely by
  `src/shell/navigation.ts` — the sidebar and the router read from the same
  single source, so they cannot drift out of sync with each other again.
- Today page structural skeleton implemented (`src/domains/performance/TodayPage.tsx`)
  — layout matches the approved reference image, but all data is mocked/placeholder.
  No local persistence is wired yet; that is Phase 1 of the semester roadmap, not
  Foundation.
- Reusable component primitives started: `Card`, `Badge` (`src/components/`).
- AI Approval Pattern implemented as a real reusable component:
  `src/domains/intelligence/ProposalCard.tsx`. It renders a `Proposal` object
  and reports Approve/Modify/Reject back to the caller — it does not call any
  AI provider and does not write to domain state itself, per ADR-0001's rule
  that AI proposals pass through the same write path as any other change.
- All remaining nav items (Focus, Goals, Calendar, Academics, Development,
  Fitness, Routine, Language, Money, Knowledge, Analytics, AI Coach, Settings)
  route to a shared `PlaceholderPage` — real, clickable, not dead links.

## Verified, not just claimed

- `npx tsc --noEmit` — passes, zero errors.
- `npm run build` — succeeds, produces a working production bundle.
- `npm run preview` — serves the built app and responds on localhost.

## Design token status — flag, not a blocker

`docs/07 - Visual & Design System/07.03 - Color System.md` states exact color
values are `PROVISIONAL`, not locked. No raw-value "Design System .md" file
exists in the repo. The tokens implemented here were **derived** by sampling
the approved `App-Shell-v1-PRIMARY.png` and `Today-v1-PRIMARY.png` reference
images plus the written Visual Identity doc — not copied from an authoritative
locked source, because none currently exists. See the header comment in
`src/tokens/tokens.css` for the full note. Treat these tokens as Working, not
Approved, until `07.03` is formally updated and reconciled against this file.

## UI ↔ ARCHITECTURE REVIEW REQUIRED — carried forward, now with a decision attached

`App-Shell-v1-PRIMARY.png` and `Today-v1-PRIMARY.png` use two different
sidebar structures (different section labels/groupings; Today has a Calendar
item App Shell lacks). This was flagged on Day 1 and not resolved by the Day 2
UI work. To make routing possible, `src/shell/navigation.ts` merges the two
into one structure (Today's version as the base, App Shell's section labels
normalized on top) — clearly commented as a code-necessity, not a design
decision. **This still needs an explicit answer from the design side**, not
silent acceptance because code now assumes it.

## Explicitly not done (correctly out of scope for Day 2)

- Tauri/Rust desktop shell — **not built in this environment.** The sandbox
  used to generate this code has no Rust toolchain available, so only the
  React frontend could be verified here. This must be wrapped into a real
  Tauri shell on your actual machine — see "Next step" below.
- Local persistence / SQLite — Phase 1, not Foundation.
- Normal Study / Focus-active / Mastery screens — UI references exist
  (Day 2 ChatGPT output) but were not implemented; not requested for Day 2
  engineering scope.
- Any AI provider wiring, V2/V3, mobile, cloud — untouched, as instructed.

## Next step to actually run this as a desktop app

On your machine (which has Rust available, unlike this sandbox):

```
cd app
npm install
npm install -D @tauri-apps/cli
npx tauri init
```

`tauri init` will ask for your dev server command (`npm run dev`), dev URL
(`http://localhost:5173`), and build output dir (`dist`) — answer with those
exact values so it wraps the app already built here rather than starting over.
