# PBOS V2 — PASS 4: ADAPTIVE PLANNING

Status: LOCKED

## Definition

Adaptive Planning is PBOS's controlled planning layer that converts prioritized work requirements into realistic schedule proposals.

Domain intelligence determines WHAT deserves attention and WHY.
Deterministic Planning determines WHERE and WHETHER it fits.

Fixed, locked and user-owned intent are preserved, capacity and buffer remain authoritative, impossible work is explicitly reported, and meaningful schedule changes are reviewable before canonical Planner state mutates.

## V1 foundation retained

Current Planning already has:
- one canonical PlanningBlock truth
- manual/generated provenance
- fixed/flexible blocks
- locks
- conflict detection
- daily/weekly capacity
- fragility
- deterministic fit checks
- deterministic proposal generation
- Could Not Fit
- Generate → Review → Apply
- revision history

V2 upgrades intelligence feeding this engine instead of replacing it.

## Planner vs Today

Adaptive Planning:
where should work fit over today/week/near-term?

Adaptive Today:
given reality now, what should happen next?

Today can request targeted re-planning but does not own schedule state.

## Core pipeline

Goals / Systems / Actions
+ Academic requirements
+ Routine/Knowledge requirements
+ existing Planner state
+ execution evidence
+ user intent
→ Work Candidates
→ prioritization/constraints
→ deterministic placement
→ schedule diff
→ user review
→ whole-plan validation
→ canonical apply

## Deterministic placement remains authoritative

AI can recommend:
“AVL review is high priority.”

AI cannot authoritatively decide:
“Wednesday 17:15.”

Planning checks:
- overlap
- daily capacity
- weekly capacity
- locks
- fixed commitments
- relevant constraints

## Work Candidate concept

A Work Candidate means:

> This piece of work deserves consideration for scheduling.

It is not yet a PlanningBlock.

Potential fields/concepts:
- source
- why
- estimate
- priority
- due-before
- scheduling window
- splittable
- minimum useful duration

Exact schema is deferred to Master Blueprint consolidation.

## Candidate sources

- existing Actions
- Academic Intelligence
- Knowledge reviews/evidence gaps
- Development
- Language
- Routine commitments
- deferred work
- explicit user request
- approved Natural Capture planning requirements

## Candidate ≠ automatically new Action

Resolve/reuse existing Actions first.

Do not create:
- Review AVL
- Study AVL
- AVL Quiz Prep
- AVL Revision

as duplicate Actions for the same work.

## Authority classes

Hard:
fixed external commitments.

Protected:
user intentionally preserves.

Preferred:
strong intention but potentially negotiable if explicitly released.

Flexible:
safe for intelligent placement/reconsideration.

## Manual block rule

Manual blocks survive automatic regeneration by default.

A manual flexible block may become eligible for replanning only after the user explicitly releases it.

Manual ≠ eternally immutable.
Manual = protected from automatic replacement by default.

## Locked block rule

Locked means:
Do not move during regeneration.

If a lock causes infeasibility:
show Could Not Fit/trade-off.
Do not silently unlock.

## Fixed commitments

Do not optimize them away.

## Generated blocks

Keep `source: generated`.

Generated flexible blocks are the safest items to reconsider when plan conditions change.

## Regeneration behavior

Do not:
delete week and rebuild blindly.

Prefer:

KEEP:
- fixed
- locked
- manual by default

RECONSIDER:
- eligible generated flexible work
- explicitly released manual flexible work

ADD:
- newly required work

REMOVE/DEFER:
- obsolete generated work

REPORT:
- anything that cannot fit

## Smallest useful adaptation scope

Three scopes:

MICRO:
one block/gap.

DAY:
one day's plan.

WEEK:
broad regeneration.

Use the smallest scope that solves the problem.

## Stability / change cost

Existing valid placements have value because the user already expects them.

Do not move a valid Tuesday 6 PM block to Tuesday 6:30 PM without a meaningful reason.

Adaptive Planning should minimize unnecessary churn.

## Priority dimensions

- user/Goal/Action priority
- urgency
- academic return
- consequence of delay
- dependencies
- recent attention
- estimate
- opportunity fit
- domain balance

No universal weights are locked here.

User priority is not silently overridden by AI.

## Deadline semantics

Deadline ≠ scheduled work block.

Requirements happen at a date/time.
Preparation should be scheduled before them.

## Backward planning

Adaptive Planning should support:
deadline
← prerequisite work
← valid earlier capacity

## Estimates

Hierarchy:

1. user estimate
2. existing Action/requirement estimate
3. user-configured default
4. AI suggested estimate, clearly advisory
5. unknown

Do not permanently convert unknown to a fake precise number simply to satisfy a scheduler.

## Split work

Some work may be split, other work must be contiguous.

Do not assume infinite divisibility.

Future planning candidates likely need:
- splittable
- minimum useful duration

## Time-window constraints/preferences

Examples:
- workout after 5 PM
- German anytime
- deep development not in tiny gaps
- university study preferred during campus breaks

These are planning constraints/preferences, not completion evidence.

## Persistent vs temporary capacity

Planner capacity:
long-term scheduling boundary.

Today capacity:
temporary Low/Normal/High execution state.

Do not let one bad day permanently rewrite planning capacity.

## Fragility / buffer

Existing states:
- valid
- valid-fragile
- exceeds

V2 should preserve buffer intentionally and often prefer a healthier plan over a mathematically fuller plan.

PBOS is not a factory scheduler.

## Could Not Fit

This remains a legitimate successful outcome.

Expanded reasons may include:
- no valid time
- capacity exceeded
- protected blocks
- deadline impossible
- insufficient contiguous window
- prerequisite/order conflict
- minimum session length unavailable

## Trade-offs

When work cannot fit, PBOS may propose options:

- defer lower-priority item
- shorten flexible item
- release protected time
- increase capacity
- leave unresolved

AI can reason about trade-offs.
User decides.

## Planning diffs

V2 proposals should show:

KEEP
ADD
MOVE
SHORTEN
DEFER
REMOVE FROM PLAN
COULD NOT FIT

Do not force the user to compare two whole regenerated calendars mentally.

## Explain placement

Example:

DSA Review — Wednesday 4:00–4:45

Why here:
- before Thursday quiz
- first valid 45-minute slot
- no protected conflict
- within capacity

## Partial selection/modification

The user should be able to reject or edit one proposed change.

After any selection/modification:
validate the final combined schedule.

Individually valid proposals may be invalid together.

## Revision/reversibility

Applied replans should record:
- previous schedule
- what changed
- why
- proposal source
- user decision

Restore/Undo should be supported where practical.

## Offline planning

Without remote AI, PBOS can still:
- schedule explicit Actions
- use deterministic priority rules
- detect conflicts
- enforce capacity
- preserve locks/manual blocks
- generate valid slots
- return Could Not Fit

AI improves candidate selection, trade-off reasoning and explanation.

## Natural Capture / Today / Academics integration

Natural Capture:
creates approved planning requirements.

Academic Intelligence:
determines study needs.

Adaptive Planning:
fits approved/prioritized requirements.

Adaptive Today:
uses the plan and requests local replans when reality changes.

## Not V2

Do not turn Planning into:
- Google Calendar replacement
- Gantt/project-resource software
- multi-user scheduler
- automatic filling of every free minute
- endless AI reshuffling
- autonomous Action deletion
- game-like optimization

## Acceptance

Adaptive Planning must prove:
- one canonical schedule source
- AI cannot directly write arbitrary blocks
- cross-domain candidate intelligence is allowed
- deterministic placement remains authoritative
- fixed/locked/manual intent survives by default
- generated flexible work can adapt
- manual flexibility requires explicit release
- smallest scope is preferred
- unnecessary churn is minimized
- deadlines stay requirements
- estimates preserve unknown
- splitting respects work semantics
- capacity and buffer remain authoritative
- Could Not Fit remains visible
- trade-offs are surfaced
- diffs are understandable
- individual changes can be edited/rejected
- final combined state is validated
- applied changes remain auditable
- Planner remains usable without AI
