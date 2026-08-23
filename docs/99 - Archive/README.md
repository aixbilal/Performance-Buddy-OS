---
document_id: P99-README
title: "99 - Archive"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Archive
last_updated: 2026-08-23
---

# Archive

## Purpose

Preserve rejected, deprecated, and superseded Performance Buddy OS material so historical reasoning remains traceable without allowing obsolete content to compete with active authority.

## Authority boundary

Nothing in Phase 99 is current product authority solely because it is retained. The locked blueprint and approved active documents govern. An archived artifact preserves what was believed, proposed, rejected, or used at a particular time; it must not be used to resolve a current conflict without checking its status, applicability, and supersession chain.

Archiving is not deletion, approval, endorsement, or concealment. It is a controlled lifecycle transition performed only after active references are migrated and the relevant decision, ADR, documentation change, or rejection record is updated.

## Folder map

| Folder | Intended material |
|---|---|
| `01 - Deprecated Decisions/` | Decisions no longer recommended but retained for historical context |
| `02 - Rejected Architecture/` | Architecture proposals or ADRs rejected after review |
| `03 - Rejected Features/` | Feature proposals rejected rather than merely deferred |
| `04 - Rejected AI Concepts/` | AI ideas rejected for value, safety, privacy, reliability, or scope reasons |
| `05 - Old UX/` | Superseded interaction flows, wireframes, and UX specifications |
| `06 - Old Design Concepts/` | Superseded visual directions and design explorations |
| `07 - Superseded Documentation/` | Replaced approved documents whose history must remain available |
| `08 - Historical Research/` | Research no longer current but useful for decision provenance |
| `09 - Previous Roadmaps/` | Superseded roadmap snapshots and scope plans |
| `10 - Historical Reports/` | Past audits, reviews, evaluations, and status reports |

## Required archive metadata

Each archived artifact or accompanying record should identify:

- original path, title, owner, status, version, and capability;
- archive date, actor, reason, and approving decision or change record;
- replacement or superseding artifact when one exists;
- affected references and confirmation that active links were migrated;
- source class, provenance, checksum, license, and sensitivity where applicable;
- retention, access, deletion, and restoration restrictions.

Rejected and superseded decisions retain their original rationale. Do not rewrite history to make the current outcome appear inevitable.

## Movement and restoration rules

Never move an active source-of-truth document into Phase 99 until its replacement is approved, cross-references are updated, change history is recorded, and validation passes. Preserve filenames where practical; if collision handling changes a stored name, record the original path explicitly.

Restoration creates a new proposal. It requires current evidence, owner review, conflict analysis, and the normal approval process. Copying, linking, or citing an archived item does not reactivate it.

Sensitive archived content retains the same or stricter privacy, encryption, permission, retention, backup, and deletion controls as its active form. Secrets and credentials must never be archived.

## Empty-folder rule

An empty archive category means no material has been formally archived there. It does not prove that no idea was ever discussed, rejected, or superseded.

## Acceptance criteria

- `README.md` and all ten locked archive folders exist at their exact paths.
- Archived artifacts are visibly non-authoritative and retain provenance and lifecycle status.
- Active references are migrated before superseded material is archived.
- Rejection, supersession, retention, privacy, and restoration decisions remain auditable.
- No active document, historical artifact, or user data is moved during initial Phase 99 generation.

