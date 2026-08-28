# Day 15A — Onboarding & Initial Setup — Changelog

**Built**
- `OnboardingState`/`PersonalSetupData`/`SystemConnectionStatus`/`LaunchCheck` types.
- `resumeAtStep` — the concrete **"resume, not restart"** rule (§20/§22):
  test proves an interrupted onboarding resumes at its exact saved step
  (`connect-systems`), not step one.
- `determineStartupRoute` — all four real outcomes, including the one most
  builds skip: **existing data on a `not_started` state routes to
  `existing-data-choice`, never straight to a fresh Welcome** — starting
  over must be deliberate (§39), proven by a dedicated test.
- `validateMinimumViableLaunch` — §38's core-vs-optional split enforced
  *structurally*, not just by convention: the function's signature only
  accepts core checks at all. A test documents this boundary directly —
  AI/Obsidian/Money availability have no path into the blocking logic,
  not just "happen not to" in today's data.
- `OnboardingPage` — a real 4-step flow (Welcome → Personal Setup → Connect
  Systems → Review & Launch) with working Save & Exit, and — importantly —
  **Connect Systems reads live state from the real Academic/Fitness/Money
  stores** (§28), not a duplicate onboarding-only model.

**An honest tension worth naming directly, not glossed over**

§36 requires truthful empty states — no fake first-day data. But every
domain built across Days 3–14 was deliberately seeded with rich example
data for demonstration purposes. Running this onboarding flow inside the
same app instance means "Connect Your Systems" shows Academics and Fitness
as already **Configured** — accurate to this build's actual current state,
but not representative of what a genuinely first-time user would see on a
real fresh install (which would show `not-set-up` everywhere, correctly,
because §36 would apply for real). This isn't a bug to silently patch — a
truly fresh state and a rich demo state are different modes this codebase
doesn't yet distinguish, and shouldn't be conflated. Flagging it plainly
here for whenever you want to build a real "seed only for demo builds"
switch.

**Two things genuinely can't be demonstrated yet, and I'm not claiming
otherwise:**
- Real "existing data on disk" detection — depends on the SQLite
  persistence layer, deferred since Day 2. `startupRoute` is computed with
  `hasExistingData` hardcoded to `false` in the store, honestly labeled as
  such rather than faked.
- Real root-level startup routing (Launch → Splash → Welcome/Today) — this
  intersects with Day 15B's splash/motion sequence, which the handoff
  explicitly says not to invent yet. The routing *logic* (§21) is real and
  tested; wiring it to actual app startup is left for Day 15B, per clean
  hooks left in `router.tsx`.

**Verified**
- `npx tsc --noEmit` — clean
- `npx vitest run` — **12/12 new, 111/111 total** across all 12 domains
- `npm run build` — clean
- `npm run lint` — 0 errors, 14 known harmless warnings

**Deferred, not forgotten**
- Academics/Fitness quick-setup forms during onboarding (§29/§30) — Connect
  Systems shows status, doesn't yet let you configure a course or training
  plan inline; the real domain screens already do this, reachable after launch
- AI configuration step (§33) — AI Coach correctly shows Disabled/Optional;
  no provider-selection UI exists here (matches Day 12's own scope boundary)
- Onboarding is reachable at `#/onboarding` for now — not yet the actual
  app entry point, per the Day 15B note above

---

## This closes the Day 14 + Day 15A handoff

12 domains now share the same tested-deterministic-core discipline. Total:
**111 tests, 12 test files, all passing.** Ready to receive Day 15B
(splash/startup/motion) whenever that handoff arrives — the routing hooks
it needs are in place and clearly marked, nothing about them was guessed.
