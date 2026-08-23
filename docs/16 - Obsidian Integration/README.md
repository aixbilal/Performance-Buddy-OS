---
document_id: P16-README
title: "README"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Obsidian Integration
last_updated: 2026-08-17
---

# Phase 16 — Obsidian Integration

## Purpose

Phase 16 defines safe local integration between Performance Buddy OS and a user-selected Obsidian vault. The vault remains user-owned external storage; the application maintains references and disposable indexes and does not silently reorganize or rewrite notes.

## Document map

| Range | Responsibility |
|---|---|
| 16.01–16.04 | Integration scope, vault selection, structure, access |
| 16.05–16.08 | Markdown, metadata, links, and attachments |
| 16.09–16.12 | Lexical/embedding indexes and change processing |
| 16.13–16.14 | Permission boundaries and recovery |

## Ownership boundaries

Knowledge OS owns topics, references, evidence, search semantics, and retrieval. Platform owns filesystem adapters, storage, background work, and security enforcement. Obsidian and the filesystem own note content. This phase defines the integration contract between them.

## Invariants

1. Vault access is explicit, revocable, and least-privilege.
2. Baseline indexing is read-only; writes require a separate approved action.
3. Paths are validated against the selected vault, including symlinks and junctions.
4. Lexical indexes are `CORE`, local, rebuildable projections.
5. Embeddings are optional `LOCAL` or `CLOUD` capability, never required for search.
6. File loss, moves, parse errors, and permission changes remain visible and recoverable.
7. No vault content reaches an external provider without explicit task-scoped permission.

