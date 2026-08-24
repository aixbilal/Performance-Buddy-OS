---
document_id: P44-ADR-0001
title: "Foundation Architecture Proposal v1"
status: PROPOSED
baseline: v1.0
capability: CORE
owner: Technical Research & Architecture Decisions
reviewers: []
date: 2026-08-24
last_updated: 2026-08-24
supersedes: null
superseded_by: null
affected_documents:
  - "44.03 - Desktop Framework Research.md"
  - "44.04 - Frontend Stack Research.md"
  - "44.05 - Local Database Research.md"
  - "04.01 - Domain Map.md"
  - "24.12 - Provider Abstraction.md"
  - "38.06 - Secrets Management.md"
---

# ADR-0001 — Foundation Architecture Proposal v1

**Status: PROPOSED — no implementation authority until reviewed and approved, per `44.02` and the ADR folder governance rules.**

## Decision scope and capability

Scope: the technical foundation for the Semester-3 CORE desktop release only. Excludes LOCAL AI runtime selection, V2/V3 architecture, mobile, and cloud sync — those remain out of scope and untouched.

## Context and problem

The repository currently contains documentation only — no application code exists yet. `44.03` and `44.05` are marked `RESEARCH REQUIRED`, with no framework or persistence technology selected. Foundation Day 1 requires a concrete, defensible recommendation the owner can build on immediately, not an open comparison.

## Approved requirements and constraints (from existing documentation)

- Desktop-first, offline-first (`Section 24`, `33.01`)
- Single-user personal application — avoid premature enterprise/distributed complexity (`Product Reality` doc, Section 33)
- Deterministic domain logic never guessed by AI (`23.02`, `30.02`)
- AI proposes, rules validate, human approves — no silent writes (`30.02`)
- Provider-independent AI integration — no vendor lock-in (`Section 18`, `24.12`)
- Local data security and permission zoning (`30.06–30.08`, `38.08`)

## Recommendation 1 — Desktop Runtime: Tauri

**Decision: Tauri, not Electron.**

| Criterion | Tauri | Electron |
|---|---|---|
| Memory/battery footprint | Low — native webview, no bundled Chromium | High — ships full Chromium + Node per app |
| Local-data attack surface | Smaller — Rust backend mediates filesystem/DB access | Larger — full Node.js runtime exposed |
| Fit for "runs all day" personal app | Strong | Weaker — resource cost compounds over a full day of use |
| Plugin/ecosystem maturity | Smaller, but sufficient for tray/notifications/shortcuts/keychain | Larger, more examples available |
| Learning cost | Adds a thin Rust boundary layer | Pure JS/TS, no new language |

**Rationale:** this is a personal, always-open, laptop-resident application handling sensitive personal data (academic records, routines, money). Tauri's smaller footprint and Rust-mediated system boundary directly serve the "local-first, security-conscious, avoid unnecessary complexity" requirements already approved in the documentation. The honest cost: a small amount of Rust is unavoidable at the OS-integration boundary (filesystem, keychain, tray). This is confined to a thin shell layer, not the application's business logic — see Recommendation 4.

**Consequence for `44.03`:** this ADR, once approved, resolves `44.03` from `RESEARCH REQUIRED` to `APPROVED`, referencing this record.

## Recommendation 2 — Frontend Stack

**Decision: React + TypeScript, built with Vite, styled against the frozen design tokens using Tailwind CSS.**

- React + TypeScript: largest ecosystem, matches the owner's stated full-stack learning path (`18.01–18.03`), and is the default first-class target for Tauri.
- Vite: fast local dev loop, native Tauri integration, no meaningful alternative at this scope.
- Tailwind: consumes the design-token file directly as its theme config, so Design and Code stay mechanically in sync rather than drifting — directly supports the "tokens are the locked contract" approach already agreed with the UI track.
- State management: deferred — see Unresolved Decisions. Do not select Redux by default; that scale of tooling is not justified for a single-user local app (Section 33, avoid enterprise over-engineering).

## Recommendation 3 — Local Persistence

**Decision: SQLite, accessed through a Rust data-access layer, exposed to the frontend via Tauri commands. Migrations managed by a dedicated migration tool from day one, not ad hoc schema edits.**

- SQLite: file-based, ACID, zero-server, matches offline-first requirement exactly (`33.03`).
- Rust-side access (not direct frontend SQL): keeps the "who can touch the database" boundary narrow and auditable — relevant given the personal/sensitive data this app will hold.
- Migrations tool from day one: the documentation places heavy weight on backup/restore and data integrity (`Phase 39`, `32.25`) — retrofitting migrations after schema exists is the expensive path; starting with one is not.
- Encryption (SQLCipher or equivalent) is **not** decided here — see Unresolved Decisions. Foundation phase uses placeholder/non-sensitive data only, so this is not blocking, but it must be resolved before real academic or financial data enters the database (Phase 2 onward).

**Consequence for `44.05`:** this ADR, once approved, resolves `44.05` from `RESEARCH REQUIRED` to `APPROVED`, referencing this record.

## Application Layers and Responsibilities

```text
Presentation        React components, consumes design tokens only, no business rules
     ↓
Command Layer        Tauri commands — thin orchestration, no domain logic lives here
     ↓
Domain Layer         Deterministic business rules (goals, trackers, later: GPA/rules engine)
     ↓
Persistence Layer     SQLite access + migrations, owned by Rust data-access module
     ↓
Integration Layer     AI provider abstraction, external tool handoffs — reads domain via
                       contracts only, never writes directly (see Recommendation 5)
     ↓
Platform Layer        Settings, backup/export, secrets, logging, permission zoning
```

**Domain layer language decision: TypeScript, not Rust, for now.** Business rules (goal/action state, tracker logic, and later the academic calculation engine) live in TypeScript alongside the UI, not in Rust. Rationale: a single language across UI and domain logic is simpler to build, test, and — importantly — for the owner to fully understand and defend, which is an explicit project requirement (`45.04`). Rust is confined to OS/system integration (filesystem, keychain, native dialogs). This is a real trade-off, not a default: Rust-side domain logic would be more defensible for a portfolio "systems" story, but adds real complexity this semester doesn't need yet. Flagged as revisitable — see Unresolved Decisions.

## Module / Domain Boundaries

Directly mirrors the approved Domain Map (`04.01`) — no new boundaries invented:

```text
/domains
  /performance      goals, systems, actions, today, focus, trackers
  /academic         courses, marks, SGPA/CGPA, prerequisites
  /knowledge        Obsidian linking, topic evidence, quizzes
  /development      learning paths, sessions, milestones
  /fitness-recovery activities, recovery state
  /routine          prayer, hydration, nutrition, reflection
  /money            income, expenses, savings
  /analytics        aggregation, trends, risk signals
  /intelligence     AI provider abstraction, V1/V2/V3-lite, approval workflow
  /platform         settings, backup, security, logging
```

Each domain folder owns its own data model, rules, and read/write contracts. Cross-domain reads go through the domain's published contract, never through direct database access from another domain — this is the same "boundary test" already defined in `04.01`, applied literally to folder structure.

## Repository Structure (proposed)

```text
/src
  /domains/...           (as above)
  /shell                 AppShell, Sidebar, TopBar, Router
  /components            shared UI primitives (grows from real screens, per UI track note)
  /tokens                design tokens consumed by Tailwind config
  /platform              settings, backup, secrets, logging
/src-tauri
  /commands               thin Tauri command handlers
  /data                   Rust SQLite access + migrations
  /system                 filesystem, keychain, tray, native integration
/docs                     existing documentation tree (unchanged)
```

## Deterministic Logic vs AI/Provider Integration

The domain layer never calls an AI provider directly, and no code path allows an AI response to write to domain state without passing through the same write path a human-initiated change uses. Concretely: the Intelligence module reads domain data through the same published read contracts every other consumer uses, produces a `Proposal` object (recommendation + reason + evidence + confidence), and that proposal is written only after passing through the standard approval workflow — never a shortcut path. This directly implements the already-approved "AI Suggests, Rules Validate, Human Decides" principle (`30.02`) as an actual code boundary, not just a UI convention.

## AI Provider Integration Point

A single `AIProvider` interface (structured-output request in, structured response out) is defined in `/domains/intelligence`. Each real provider (Claude, Gemini, Groq, a future local model) implements this interface separately; the rest of the application never references a specific vendor. Provider selection is a config value, not a code branch. This satisfies the documented requirement that the system remain provider-independent (`Section 18`, `24.12`) without building the full multi-provider routing/failover machinery — that remains explicitly out of scope for this semester.

## Security / Privacy Boundaries

- API keys: OS keychain only (Tauri's keychain plugin), never plaintext, never in the SQLite database.
- Data permission zoning (`30.06–30.08`) is enforced at the Intelligence module's read boundary in code — not only hidden in the UI. A domain field tagged `never-AI` is structurally unreadable by the Intelligence module's contract, so a UI bug cannot leak it to an external AI call.
- External AI calls cross a single, auditable boundary (the `AIProvider` interface) — this is also where future logging/redaction (`38.13`) attaches.

## Unresolved Decisions — genuinely open, not invented

- **State management library** (Zustand vs Jotai vs plain Context) — low-stakes, decide when Phase 1 (Today/Focus) is actually being built, not now.
- **Migrations tool specifics** (e.g. `sqlx migrate` vs a lightweight custom runner) — low-stakes, decide Day 2.
- **Whether any domain logic ever moves into Rust** — deferred until the Academic OS build (Phase 2), once real performance/correctness needs are visible. Not resolved here.
- **Local AI runtime selection** — remains `RESEARCH REQUIRED` per `44.06`/`44.09`. Out of scope for Foundation.
- **Database encryption approach (SQLCipher or equivalent)** — not resolved. Must be decided before real personal academic/financial data enters the database — i.e., before Phase 2, not before Foundation.

## UI ↔ Architecture Review Required

Flagged per the stated integration checkpoint — not guessed at:

- **Routing/navigation structure** — depends on the App Shell's actual sidebar/collapse/command-palette behavior once designed.
- **Desktop window behavior** — single-window vs multi-window, tray-to-window restore behavior — depends on shell/tray design intent, not yet known.
- **State ownership boundary** — where UI-local state (panel open/closed) ends and domain state (goals/actions) begins — needs the real Today composition to draw this line correctly.
- **Component granularity** — since components are being derived from real screens rather than built upfront, architecture needs the actual Today/App Shell composition to know how atomic components should be and whether they carry any local data access.

These are not blocking Foundation work — they are logged here for the joint review once both tracks have real output to compare.

## Consequences and Accepted Risks

Choosing Tauri accepts a smaller plugin ecosystem and one additional language (Rust) at the system boundary, in exchange for a materially smaller resource footprint and a narrower, more auditable data-access surface — judged the correct trade for a security-conscious, always-on personal application. Keeping domain logic in TypeScript accepts a less "impressive" systems story for portfolio purposes, in exchange for a single language the owner can fully understand and defend this semester, consistent with the project's own learning-checkpoint requirement.

## Implementation / Validation Plan

Foundation Day 2 proceeds once this ADR is reviewed: repository scaffold, TypeScript config, lint/test baseline, SQLite + migrations tool init — per the Foundation Phase 0 roadmap already in place. No feature/domain implementation begins until Day 3's shell is complete.

## Review Trigger

Revisit this ADR if: Tauri's plugin ecosystem proves insufficient for a required Phase 0–2 feature, or if Academic OS (Phase 2) reveals a genuine performance/correctness case for Rust-side domain logic.
