# PBOS V2 — PASS 6: KNOWLEDGE + ROUTINE + AI COACH BOUNDARIES

Status: LOCKED

## Core principle

> Intelligence should be distributed; authority remains centralized in deterministic/domain engines.

AI is a reasoning capability across permitted domains, not a new master domain or master database.

---

# A. Knowledge Intelligence

## Definition

Knowledge Intelligence is PBOS's learning-evidence and review reasoning layer.

It answers:
- What do I genuinely know?
- What evidence is weak/missing?
- What is due for review?
- What should I test rather than reread?
- Which permitted sources can help?

It is not another note-taking app.

## Knowledge vs Obsidian

Knowledge Topic:
concept + context + evidence + review state.

Obsidian Note:
authoritative long-form Markdown.

They may be linked.
They are not the same object.

## Obsidian authority

PBOS may store:
- title
- relative path
- metadata
- Knowledge link
- on-demand preview

PBOS does not maintain a second authoritative editable note body.

## No silent vault rewriting

AI may:
- draft
- summarize
- suggest
- generate content for explicit approval

It must not silently replace existing Markdown.

## Mastery authority

Keep the existing rule:

saving source ≠ mastery  
reading ≠ mastery  
studying ≠ mastery  
professor coverage ≠ mastery  
completing Action ≠ mastery

Only governed recorded Evidence changes canonical Knowledge mastery.

## AI output is not evidence by itself

AI explanation:
not evidence.

Generated recall questions:
not evidence.

User completes a governed recall/practice check:
may create evidence.

Then deterministic Knowledge engine recalculates mastery.

## Recall generation

V2 capability:
Generate Recall for a selected Knowledge Topic using permitted context.

Possible types:
- definition
- conceptual
- comparison
- application
- short problem
- explain in own words

## Review scheduling ≠ mastery

A review occurring changes review scheduling only.

A topic may validly be:
Strong + Review Due.

## Source intelligence

AI may recommend among:
- professor material
- Obsidian note
- book
- article
- other governed source

No heavy vector/RAG architecture is required for core V2.

## Knowledge output types

- Review requirement
- Evidence gap
- Method recommendation
- Recall set
- Source recommendation

These may feed Today/Planning when relevant.

---

# B. Routine Intelligence

## Definition

Routine Intelligence is PBOS's pattern interpretation layer for sustainable recurring behavior.

It asks:
- Is this routine working?
- Is timing/cadence realistic?
- Are misses clustered in a context?
- Should structure change?

It is not streak optimization.

## No-streak model

Retain schedule-aware 7/30-day consistency.

No:
- XP
- badges
- fragile streak pressure
- punishment

## Routine states remain semantically honest

- complete
- partial
- skipped
- rest
- missed
- pending

Rest ≠ missed.
Skipped ≠ missed.
Pending ≠ missed.

## Time passing ≠ missed

A routine remains pending until actual truth resolves it.

## Pattern detection

Potential patterns:
- evening routine repeatedly fails on university days
- morning placement performs better
- cadence is consistently unrealistic
- target duration is too high
- specific days work better

Patterns must require sufficient comparable history.

Weak evidence produces tentative/no conclusion.

## Explain patterns with evidence

Example:

Wrist Mobility
Last 8 university evenings:
- completed 2
- partial 1
- missed 5

Morning opportunities:
- completed 4 of 5

Suggestion:
consider moving university-day mobility to morning.

## Structural fixes preferred

Useful routine proposals:
- cadence
- time window
- target duration
- scheduled days
- pause
- priority

Avoid “try harder” coaching.

## Approval required

AI may propose routine structure changes.

Every change goes through an explicit validated adapter/canonical domain method.

No generic updateRoutine(anything) AI access.

## Before/after preview

Show:
Current structure
→ Suggested structure
Why

Then:
Accept / Modify / Reject

## Routine vs Today

Routine Intelligence:
How should recurring behavior be structured?

Today:
Is this routine relevant right now?

## Completion evidence reuse

If PBOS measured a linked routine duration/activity, reuse it.

If it happened outside PBOS, user/Natural Capture/check-in supplies truth.

Never infer completion from schedule alone.

---

# C. AI Coach

## Definition

AI Coach is PBOS's permission-scoped deep reasoning and exploration workspace.

It is not the only place intelligence lives.

## Contextual intelligence first

Today:
what now?

Academics:
what study need?

Planner:
where can work fit?

Knowledge:
what review/evidence need?

Routine:
what pattern/change?

AI Coach:
why, alternatives, cross-domain trade-offs, deeper exploration.

## Good AI Coach use

Example:
“If I protect 2 hours of development every day this week, what academic trade-offs does that create?”

Bad product design:
forcing the user to open AI Coach just to ask “what should I study?”

Academics should answer that contextually.

## Task-scoped conversation

Conversation is transient by default.

Chat appearing in AI Coach does not automatically become:
- memory
- canonical state
- changed priority
- routine/Planner mutation

Useful changes become explicit proposals.

## Conversation ≠ memory

“I’m tired of German lately.”
should not silently become:
Language priority changed.

AI can propose a change.
User decides.

## Permissions

Keep domain permission levels:

- no-access
- read
- read-recommend

Context sent to AI is:
task-requested domains
INTERSECTED with
user-permitted domains.

No hidden expansion.

Money remains no-access by default unless user explicitly enables it.

## No direct DB authority

Canonical pipeline:

permitted context
→ AI proposal
→ user decision
→ deterministic validation
→ allowlisted apply adapter
→ canonical domain method
→ SQLite
→ audit/revision

No:
- raw SQL from model
- generic writeTable
- generic applyPatch
- arbitrary command executor

## Allowlisted mutation paths

Every new V2 intelligence mutation type gets an explicit, governed apply path.

Example future kinds may include:
- assessment-scope update
- routine time-window adjustment
- Today/Planner diff application

Each requires deterministic validation.

## Recommendation history

Keep durable states/events:
- proposed
- accepted
- modified
- rejected
- applied
- apply-failed

History stays append-only/auditable.

## Critical distinction: Capture Proposal vs Intelligence Recommendation

Capture Proposal:
“I think this is what you told PBOS happened.”

Examples:
- expense
- professor coverage
- German session

Intelligence Recommendation:
“PBOS thinks this change may help.”

Examples:
- move Reading
- reduce routine cadence
- schedule review
- create Action

These may share interaction patterns but must remain semantically separate.

## Third proposal family: Planning Diff

V2 should conceptually distinguish:

1. Capture Proposal
2. Domain/Intelligence Recommendation
3. Planning Diff

Shared:
- Accept
- Modify
- Reject
- explanation
- validation
- audit

But do not collapse them into one generic AI card.

## Shared mutation safety pipeline

After approval, all structured changes should converge toward:

structured mutation request
→ domain validator
→ permission/authority checks
→ canonical method
→ SQLite
→ revision/audit

## AI consumes derived truths

Prefer feeding AI:

“AVL state: learning; review due”

instead of raw evidence and asking it to calculate mastery.

Prefer:

“Wednesday has 50 usable minutes before a fixed commitment”

instead of asking AI to calculate overlaps.

Deterministic engines calculate deterministic truth first.
AI reasons over trusted derived facts.

## Provider model

Remain provider-agnostic.

Provider implementation is replaceable.

Canonical PBOS behavior/state must not depend on one vendor-specific model.

## Provider failure

If disabled/not configured/unavailable:

Knowledge still has:
- topics
- evidence
- mastery
- review due

Routine still has:
- schedule
- logs
- consistency

Today/Planning still have:
- canonical deterministic operation

AI features degrade gracefully rather than disabling PBOS.

## AI Coach screen direction

Keep AI Coach, but evolve it toward:

ASK / EXPLORE  
CONTEXT  
ACTIVE PROPOSALS  
HISTORY

Generic deterministic insights should increasingly surface in their own domains.

## AI Workspace

Keep as optional deep-reasoning surface for:
- rebalance week
- explain fragility
- compare routine structures
- compare cross-domain trade-offs
- interpret changes over time

Natural Capture should not route through Workspace.

Contextual domain AI actions should not force Workspace.

## Combined impact

Accepted recommendations must be validated as a combined state when they interact.

Several individually valid schedule/cadence recommendations may exceed capacity together.

## Calm intelligence

Avoid:
- 14 AI insights
- 9 recommendations badges everywhere
- AI notification spam

Important intelligence should surface where relevant and only demand attention when material.

## Deterministic-first pattern philosophy

Routine:
“5 of last 7 evening opportunities missed” = deterministic fact.
AI:
“evening placement may be the problem” = interpretation.

Knowledge:
“no evidence exists” = deterministic.
AI:
“try active recall” = recommendation.

This is the preferred V2 architecture.

## Deferred / rejected for core V2

- autonomous durable AI memory
- heavy RAG/vector stack
- silent Obsidian rewriting
- autonomous routine mutations
- streak gamification
- emotional/personality scoring
- AI-generated mastery without evidence
- unrestricted generic DB writes
- autonomous agents editing PBOS
- multi-agent life-decision negotiation
- provider-specific canonical architecture

## Acceptance

Pass 6 requires V2 to preserve:
- evidence-derived Knowledge mastery
- review/mastery separation
- Obsidian note-body authority
- explicit AI content approval
- practice generation without fake mastery
- no-streak Routine model
- honest routine states
- evidence-backed pattern claims
- approved structural routine changes
- contextual intelligence inside domains
- AI Coach as deeper reasoning, not central operating bottleneck
- conversation ≠ memory/state
- permission-scoped context
- Money no-access default
- no arbitrary AI DB writes
- allowlisted mutations only
- durable recommendation/audit history
- Capture vs Recommendation vs Planning Diff semantics
- deterministic derived truth before AI reasoning
- graceful provider failure
- provider-agnostic architecture
- combined-change validation
- quiet, user-controlled intelligence

## Final architectural law from Pass 6

> Intelligence is distributed across PBOS. Authority remains with canonical domain stores and deterministic engines.
