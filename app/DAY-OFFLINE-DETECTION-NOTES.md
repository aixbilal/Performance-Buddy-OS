# Offline Detection — Changelog

**Built**
- `domains/resilience/engine.ts` — `deriveConnectivityBannerState`, a pure
  function deciding hidden/offline/back-online from two known facts.
- `shell/useConnectivityBanner.ts` — **real** browser detection using
  `navigator.onLine` plus the actual `online`/`offline` window events, not
  a simulated status. Owns the timing of the transient "just reconnected"
  window (3 seconds, per §28's "brief factual Back Online feedback then
  disappear").
- `shell/ConnectivityBanner.tsx` — the restrained pill shown in `AppShell`,
  matching the approved reference's tone exactly. Renders nothing when
  online and settled — never a full-screen failure, never blocks the rest
  of the app underneath it.

**The core §28 principle, actually true in this build, not just claimed:**
every domain (Today, Goals, Academics, Knowledge, Development, Fitness,
Routines, Language, Money, Planner, Focus, local Search) already runs
entirely on in-memory local state with zero network dependency — so "local
features remain available while offline" isn't a new behavior that had to
be built, it's already how the whole app works. This banner just makes that
fact visible instead of silent.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **3 new tests, 162/162 total**, 16 test files
- `npm run build` — clean
- **Confirmed by grepping the actual compiled `dist/` bundle** — "Back
  online" and "Local features available" are genuinely present in the
  built output, not just source (lesson from the prior consistency issue —
  verify the real artifact, not just the source files)
- `npm run lint` — 0 errors, 17 known harmless warnings

**To actually see it work:** in a real browser tab (not necessarily the
Tauri window, since desktop apps don't always reliably fire these events
the same way), open DevTools → Network tab → toggle "Offline" — the banner
should appear within a second, and toggling back online should show "Back
online" for about 3 seconds before it disappears on its own.

**Still genuinely open**
- Error/recovery/save-failure screens — still not built (need a real save
  operation that can fail, which needs the persistence layer)
- AI availability banner — engine exists and is tested (`deriveAIAvailability`),
  not yet wired into `AICoachPage` since there's no real AI-enabled toggle yet
- The rest of Day 18's simplification sweep
