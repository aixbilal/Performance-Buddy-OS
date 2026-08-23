---
document_id: P44-ADR-README
title: "Architecture Decision Records"
status: APPROVED
baseline: v1.0
capability: CORE
owner: Technical Research & Architecture Decisions
last_updated: 2026-08-21
---

# Architecture Decision Records

## Purpose

This folder stores one immutable Markdown record per material architecture decision proposed through `44.02 - Architecture Decision Record Template.md`.

## Naming

Use `ADR-NNNN - Short Decision Title.md` with monotonic four-digit IDs. IDs are never reused. A filename remains stable after approval; a later decision supersedes rather than renames history.

## Status lifecycle

`PROPOSED → APPROVED` or `PROPOSED → REJECTED`; an approved record may later become `SUPERSEDED`. Proposed records are research artifacts and provide no implementation authority. Approved/rejected/superseded records remain preserved.

## Indexing and authority

Each ADR identifies owner, reviewers, date, evidence, consequences, affected documents, review trigger, and supersession links. Approved ADRs are referenced from Phase 00 Decision Log; until that linkage and approval exist, the technology remains `RESEARCH REQUIRED`.

Do not store credentials, licensed/proprietary content, personal data, or volatile vendor facts without dated references. Supporting benchmark artifacts use governed references and reproducible manifests.

## Acceptance criteria

- IDs/status/supersession chains are unambiguous.
- Approved rationale is never rewritten to fit later outcomes.
- Every implemented material technology choice resolves to an approved ADR or Phase 00 decision.
