# Settings & Preferences

## Purpose

This area covers Settings Overview, Performance & Planning settings, AI/Privacy/Data settings, and Notifications/Appearance/App Behavior settings — the configuration layer for existing systems, per the Day 14 Engineering Handoff.

## Status

**No visual reference assets currently exist in this folder.** Unlike prior domains (where approved reference screenshots existed before engineering began), no `PBOS-Settings-*-v1-REFERENCE.png` files have been generated yet. Per the handoff's own rule ("do not invent missing assets"), this README does not claim any exist. Engineering for Day 14 proceeds from the written specification in the Day 14 Engineering Handoff directly, not from a visual reference — consistent with how Money's missing Budget & Savings image and Analytics' missing Overview image were handled in earlier days.

## Expected Assets (not yet present)

- `Approved/PBOS-Settings-Overview-v1-REFERENCE.png`
- `Approved/PBOS-Settings-Performance-Planning-v1-REFERENCE.png`
- `Approved/PBOS-Settings-AI-Privacy-Data-v1-REFERENCE.png`
- `Approved/PBOS-Settings-Notifications-Appearance-v1-REFERENCE.png`

When these are generated and placed here, this README should be updated to describe them, following the pattern used in every other domain folder (e.g. `08 - Fitness & Recovery/README.md`).

## Product / UX Intent

Settings configure existing systems — they never duplicate domain functionality. The Planner owns schedules; Settings owns planning constraints/preferences. Routine OS owns routine schedules; Settings owns notification defaults. AI Coach owns AI interaction; Settings owns provider/privacy/access configuration.

## What Is Locked

- Configuration precedence: Base Configuration → Mode Override → Temporary Override → Effective Configuration. The baseline is never overwritten by an active override.
- The hard-constraint vs preference distinction (sleep protection and fixed commitments are hard; scheduling preferences may be broken when necessary).
- Permission levels for AI reuse the Day 12 model exactly: No Access / Read / Read + Recommend.

## What Is NOT Permanently Locked

Exact screen layout, card grouping, and visual presentation — since no reference exists yet, these are entirely open pending Day 14B or later visual design work.

## Source-of-Truth Rules

The Day 14 Engineering Handoff defines settings behavior and precedence rules; the Design System defines tokens; source code implements. No generated screenshot exists here to potentially conflict with requirements.

## Naming / Versioning

When real references are added, follow `Working → Review → Approved → Implementation`; prefer `PBOS-Settings-[Screen]-v#-REFERENCE.png`.
