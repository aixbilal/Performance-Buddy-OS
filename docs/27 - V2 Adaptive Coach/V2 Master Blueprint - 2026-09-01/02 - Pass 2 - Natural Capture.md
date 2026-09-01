# PBOS V2 — PASS 2: NATURAL CAPTURE

Status: LOCKED

## Definition

Natural Capture is PBOS's global, permission-aware natural-language transaction builder.

It converts real-world statements into reviewable structured proposals, resolves them against existing PBOS state, reuses canonical evidence, exposes ambiguity instead of guessing, and applies only user-approved changes through deterministic domain systems.

## Purpose

> Tell PBOS what happened once.

Natural Capture reduces the need to open Academics, Study, Money, Language, Routine, Planner and Knowledge separately for simple real-world updates.

It is not:

- a general chatbot
- a note editor
- an autonomous agent
- a silent domain mutator
- a new large sidebar module

## Core flow

Natural statement
→ AI parses meaning
→ PBOS resolves existing entities
→ structured proposal draft
→ ambiguity/confidence check
→ user reviews meaningful changes
→ deterministic validators
→ canonical domain methods
→ SQLite
→ revision/audit

## Entry points

Primary:
- Today compact capture input

Also:
- global keyboard shortcut
- Command Palette action
- contextual “Capture update” actions on relevant domain screens

All entry points use one capture engine.

## Proposal classes

### 1. Extracted Fact

The user explicitly said it.

Example:
“Spent Rs 450 on food.”

### 2. Interpretation

The statement implies structured meaning.

Example:
“AVL deletion still confuses me.”
→ mastery/weakness interpretation proposal

### 3. Recommendation

PBOS reasons beyond the literal statement.

Example:
“Quiz Thursday + AVL weak”
→ recommend scheduling AVL review

These classes must not look identical in the UI.

## Ambiguity

Unknown information is never fabricated.

“Spent 450.”
Valid:
- amount: 450
- category: unspecified

Invalid:
- category: Food, unless stated or explicitly resolved

“Quiz next week.”
If course is unclear, the proposal must request the missing course rather than inventing one.

## Confidence presentation

Do not show fake numeric certainty such as “87% confidence”.

Use qualitative states when necessary:

- Clear
- Needs review
- Ambiguous

## Entity resolution

Rule:

> Resolve existing → ask if ambiguous → create new only with explicit intent.

Examples:

“DSA” should resolve to an existing Data Structures course when sufficiently clear.

Natural Capture must not create duplicate courses, topics, projects, routines, Actions or languages simply because aliases were used.

## Duplicate detection

If PBOS already recorded a likely event, Natural Capture should detect possible duplication.

Example:

PBOS Focus:
41m 18s DSA

User:
“Studied DSA for about 40 minutes.”

PBOS should offer:
- Use existing evidence
- Record separately

It should not blindly create a second study event.

## Evidence authority hierarchy

Canonical PBOS event
> explicit user statement
> AI interpretation
> AI recommendation

A PBOS-measured 41m18s session should not be overwritten by the user's approximate “40 minutes”.

## Multi-domain capture

One statement can create multiple proposals.

Example:

“DSA covered AVL deletion. I studied it for 40 minutes but deletion cases are still confusing. Quiz Thursday. Spent 450 on lunch and did German for 20 minutes.”

Potential outputs:

- Academics: professor coverage
- Study: study activity
- Knowledge/Mastery: weakness interpretation
- Assessment: quiz date
- Money: expense
- Language: session
- Planner: optional recommendation

## Apply behavior

A capture produces a proposal bundle.

User can:

- Accept all
- Accept selected
- Modify individual proposal
- Reject individual proposal
- Reject all

Accepted proposals must be validated as the final selected set before canonical mutation.

Where technically appropriate, bundle application should be transactional so PBOS does not pretend a partially broken apply succeeded.

## Modify behavior

The user should edit fields/selectors directly rather than rewrite the original natural-language statement.

## Confirmation boundary

Meaningful external/canonical mutations require user approval, but confirmation should be bundled to avoid fatigue.

One clear statement:
“Spent 450 on food and German 20 min.”
should be able to become:
“Apply 2 updates”

not two separate confirmation mazes.

## PBOS-native events bypass Capture

If PBOS itself measured:

- Focus start/end
- duration
- linked Action
- linked Course/Topic

those facts should propagate directly through deterministic systems and not require Natural Capture.

## Planning requests

Natural language can request replanning:

“I can't do Calculus tonight. Move it tomorrow if possible.”

Natural Capture turns that into a planning proposal/request. It does not silently move the block itself.

## Knowledge boundary

Natural Capture may propose:

- weakness evidence
- review topic
- knowledge-topic relation

It must not silently author or rewrite long-form Obsidian notes.

## Offline/provider unavailable

If parsing is unavailable:

- Save Capture locally
- Enter manually
- Retry

Raw text can be stored as an Unprocessed Capture in SQLite.

PBOS core remains usable.

## Capture Inbox

Use a lightweight Unprocessed Captures area accessible from Today/Capture/Command Palette.

Do not create another heavyweight productivity-inbox subsystem.

## Permissions/privacy

Natural Capture must respect per-domain AI permissions.

If Money permission is disabled, Money details must not be silently included in remote AI context.

Raw local capture storage and remote AI processing must be conceptually distinct.

## Reversibility

Applied captures should create a visible audit/revision result:

- what changed
- which domains changed
- what was reused
- what was rejected

Undo/restore should reuse canonical revision mechanisms where practical.

## States the component must support

- Idle
- Typing
- Parsing
- Proposal ready
- Needs clarification
- Editing proposal
- Validation failure
- Applying
- Applied
- Partially selected
- Provider unavailable
- Offline saved
- Duplicate detected
- Permission-limited
- No meaningful structure detected

## Deferred

Not core V2:

- continuous microphone capture
- email ingestion
- WhatsApp ingestion
- browser-history ingestion
- passive location tracking
- OCR-everything
- mobile capture app
- autonomous scheduled extraction
- heavy RAG/vector infrastructure
- automatic Obsidian rewriting
- multi-agent parsing
- passive surveillance

## Acceptance

Natural Capture must eventually prove:

- one statement can update multiple domains
- no proposal silently becomes truth
- unknown data is never fabricated
- existing entities/evidence are reused
- facts / interpretations / recommendations are distinct
- proposals can be individually modified/accepted/rejected
- final mutations are validated
- changes are auditable/reversible where practical
- provider failure does not lose the capture
- permissions are respected
- Capture never becomes another chatbot module
