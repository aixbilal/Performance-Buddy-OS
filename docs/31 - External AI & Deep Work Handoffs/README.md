---
document_id: P31-README
title: "Phase 31 - External AI & Deep Work Handoffs"
status: APPROVED
baseline: v1.0
capability: CORE
owner: External AI & Deep Work Handoffs
last_updated: 2026-08-21
---

# Phase 31 — External AI and Deep Work Handoffs

## Purpose

Phase 31 defines safe, user-controlled handoffs from Performance Buddy OS to external AI tools for deep study, research, writing, comparison, and other work that is intentionally performed outside the product.

## Authority boundary

Performance Buddy OS is the control plane: it owns source selection, permission checks, redaction, export manifests, and result re-import validation. External tools are optional processors, not sources of truth, trusted extensions, or write authorities. Their outputs return as untrusted drafts with provenance.

## Baseline delivery

The baseline is a manual handoff: preview a generated package, explicitly approve its contents and destination, download/copy it, use the external tool, then manually import selected results. API-based handoffs are `FUTURE` and require separate provider, security, consent, and capability promotion.

## Vendor neutrality

ChatGPT, NotebookLM, Gemini, and Claude are named handoff destinations, not required dependencies or endorsements. Their current features, limits, retention, training, account, regional, and pricing behavior must be verified from primary vendor documentation at handoff time.

## Acceptance criteria

- All 13 numbered files exist with exact locked names.
- Never-AI and local-only data cannot enter an external package.
- Every package and imported result has a manifest and audit record.
- External failure or account unavailability leaves CORE data unchanged.

