---
document_id: P45-README
title: "45 - AI-Assisted Engineering & Agent Guidance"
status: APPROVED
baseline: v1.0
capability: CORE
owner: AI-Assisted Engineering & Agent Guidance
last_updated: 2026-08-22
---

# AI-Assisted Engineering & Agent Guidance

## Purpose

Define one provider-independent engineering contract for humans and AI coding agents working on Performance Buddy OS. AI may accelerate research, explanation, implementation, testing, and review; it never replaces repository authority, engineering judgment, validation, or human ownership.

## Phase map

| Document | Governs |
|---|---|
| 45.01–45.04 | Engineering principles, architecture-first work, responsibility, and understanding |
| 45.05–45.08 | Provider-specific operating guidance |
| 45.09–45.15 | Repository, review, security, data, AI-feature, documentation, and drift controls |
| 45.16 | Human learning checkpoints |

## Authority and invariants

Agents follow the reading order in `00.19 - AI Coding Agent Reading Order.md`. The locked blueprint controls paths; Phase 00 controls authority and conflicts; approved owner documents control behavior; Phase 44 and approved ADRs control technical selections. Provider defaults, chat history, examples, and generated text are not product authority.

CORE must remain useful without an AI provider. Generated code is untrusted until reviewed and validated. Secrets are `NEVER_AI`; meaningful writes require the applicable approval; destructive or irreversible work requires explicit authorization and recovery planning. No agent may silently expand capability, modify the frozen tree, or claim completion without evidence.

## Required completion report

Every engineering task reports scope, files changed, checks run, defects fixed, assumptions, decisions, and blockers. It must distinguish work performed from work merely proposed.

## Acceptance criteria

- All sixteen numbered documents and this README exist at their locked paths.
- Guidance is provider-neutral at its core and consistent across provider-specific files.
- Security, data integrity, offline operation, testing, documentation, and human learning are explicit gates.
- No instruction overrides higher-authority repository or human direction.

