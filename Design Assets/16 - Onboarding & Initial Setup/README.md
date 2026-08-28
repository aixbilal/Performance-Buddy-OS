# Onboarding & Initial Setup

## Purpose

This area covers Welcome, Personal Setup, Connect Your Systems, and Review & Launch — the guided first-run entry point into PBOS, per the Day 15A Engineering Handoff. Day 15B (Splash/Startup/Motion) is explicitly out of scope here and covered by a separate future handoff.

## Status

**No visual reference assets currently exist in this folder.** No `PBOS-Onboarding-*-v1-REFERENCE.png` files have been generated yet. Per the handoff's own rule, this README does not claim any exist. Day 15A engineering proceeds from the written specification directly.

## Expected Assets (not yet present)

- `Approved/PBOS-Onboarding-Welcome-v1-REFERENCE.png`
- `Approved/PBOS-Onboarding-Personal-Setup-v1-REFERENCE.png`
- `Approved/PBOS-Onboarding-Connect-Systems-v1-REFERENCE.png`
- `Approved/PBOS-Onboarding-Review-Launch-v1-REFERENCE.png`

## Product / UX Intent

Onboarding is a guided entry point into the same authoritative domain configuration services used later by Settings and domain screens — never a separate onboarding-only Goal engine, routine engine, academic model, or AI permission system. Minimum viable launch requires only a functioning local PBOS environment, not every domain configured.

## What Is Locked

- No login wall — local-first, no account/signup requirement before onboarding.
- Onboarding state is resumable: `not_started` / `in_progress` / `completed` / `skipped`, with step and entered configuration preserved.
- No fake first-day data — empty/initial states stay truthful (no fabricated workouts, sessions, transactions, or history).
- Existing PBOS data is never overwritten by onboarding; Continue/Resume/Restore are offered instead of silently starting fresh.
- Core launch blockers (database/storage/schema failure) are distinct from optional ones (AI unavailable, Obsidian not connected, backup not configured) — only core failures may block launch.

## What Is NOT Permanently Locked

Exact screen layout and visual presentation — no reference exists yet. Day 15B's splash/motion/transition experience is explicitly deferred and must not be invented here; this folder only defines clean hooks for it.

## Source-of-Truth Rules

The Day 15A Engineering Handoff defines onboarding behavior; domain-specific setup steps (Academics, Fitness, AI, Money, Obsidian) defer to each domain's own already-implemented rules rather than inventing onboarding-specific versions.

## Naming / Versioning

When real references are added, follow `Working → Review → Approved → Implementation`; prefer `PBOS-Onboarding-[Screen]-v#-REFERENCE.png`.
