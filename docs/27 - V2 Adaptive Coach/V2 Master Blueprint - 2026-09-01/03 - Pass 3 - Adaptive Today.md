# PBOS V2 — PASS 3: ADAPTIVE TODAY

Status: LOCKED

## Definition

Adaptive Today is PBOS's live execution layer over canonical Planning.

It derives temporal truth deterministically, combines it with current evidence, priority, capacity and user intent, quietly follows the plan when reality matches it, and generates explainable, validated, user-approved deltas only when reality materially diverges.

## Repo foundation retained

V1 Today already:
- reads canonical `usePlanning().todaysBlocks`
- does not own a second schedule
- promotes current/next work
- reads live Action state
- offers Start Focus
- preserves planning history when Action status changes

These are V2 invariants.

## Planner / Today separation

Planner:
canonical intended schedule.

Today:
live execution interpretation.

Adaptive proposal:
suggested change when reality diverges.

Today never becomes a second planning database.

## Two modes

### Follow Plan

If reality still matches the schedule, do not create unnecessary AI intervention.

Show current/next work and let the user continue.

### Adaptation Needed

Only when a meaningful divergence appears:
- delay
- unfinished work
- capacity change
- new deadline
- urgent academic state
- major gap/opportunity
- explicit user request

## Adaptation triggers

Potential triggers:

Time:
- block start/end passes
- material gap appears
- remaining usable time shrinks significantly

Execution:
- Focus completes
- Action completes
- planned work unresolved after its block
- work finishes early

Natural Capture:
- class ran late
- quiz announced
- user explicitly says capacity is low/high
- unexpected free time

Domain state:
- new academic pressure
- weakness evidence
- routine state
- new deadline

User:
- “Rework the rest of today.”

## Do not over-trigger

Do not generate replans because:
- a few minutes passed
- a metric changed slightly
- AI found an interesting observation
- the day is proceeding normally

Question:

> Does this state change materially affect today's execution?

If no, remain quiet.

## Five input classes

### A. Hard temporal state

Deterministic:
- current date/time
- fixed/flexible/locked blocks
- gaps
- remaining usable day

### B. Execution state

Canonical:
- Action status
- Focus evidence
- completed/incomplete work
- current session

### C. Priority state

Derived from domains:
- assessments/deadlines
- academic weakness
- overdue work
- important Goals/Systems
- due reviews

### D. Capacity state

- remaining minutes
- remaining planned load
- persistent planning capacity
- plan fragility
- temporary Low / Normal / High capacity
- legitimate recovery signals

### E. User intent

Highest-value constraints:
- fixed commitments
- locks
- protected blocks
- explicit override
- user-set priorities

## Authority hierarchy

Fixed commitment
> locked user intent
> canonical completed evidence
> explicit user instruction
> deterministic urgency/capacity
> AI-assisted prioritization
> generic recommendation

## Fixed / Protected / Flexible

Fixed:
cannot casually move.

Protected:
technically movable but user intent says preserve.

Flexible:
candidate for adaptation.

## Plan vs recommendation must be visible

Today must not silently replace Planner intent.

Example:

Planned:
Calculus 5:00 PM

PBOS recommends:
AVL review instead

User can:
- Follow recommendation
- Keep plan

Planner changes only after validated approval.

## “What should I do now?” answer types

1. Current fixed commitment
2. Current planned work
3. Best use of a valid free gap
4. Replan required

## Fit remains deterministic

AI/domain intelligence may recommend WHAT.

Planning engine determines WHERE/WHETHER it actually fits.

No LLM timestamp is authoritative.

## Decision dimensions

- urgency
- importance
- weakness/evidence
- commitment
- fit
- capacity cost
- consequence of delay
- recency
- dependency

No fixed numeric weights are locked here.

## Temporary daily capacity

Use a lightweight:

- Low
- Normal
- High

Default Normal.

This is temporary day execution state, not a rewrite of persistent Planner capacity.

Natural language:
“I'm exhausted.”
may propose:
Capacity → Low

User confirms.

## Late blocks

Avoid judgmental “you are late” behavior.

If a block can still fit:
show current usable duration.

If it cannot:
show that the original block can no longer fit and offer adjustment.

## Partial completion

Planned 60 min, executed 35 min:

PBOS can know:
35 minutes completed, 25 planned minutes remain.

It cannot conclude:
- outcome complete
- mastery achieved

Activity, outcome and mastery remain separate.

## Early completion and buffer

If work finishes early, PBOS may:
- suggest a small useful item
- preserve the buffer

Do not fill every free minute.

## Buffer is a first-class good

A valid empty period is not a scheduling failure.

Today can legitimately say:
“No urgent work needs this gap.”

Plan fragility remains meaningful.

## Controlled adaptation types

- KEEP
- START NOW
- SHORTEN
- MOVE
- DEFER
- SUBSTITUTE
- DROP FOR TODAY
- ADD
- PRESERVE BUFFER

Dropping from Today never means deleting the underlying Action.

## Diffs

Meaningful adaptation should show:

- what changed
- why
- what was protected
- what remained unchanged

Example:
Move Reading tonight → tomorrow
Shorten German 20m → 10m
Keep Calculus
Protected Development
Add AVL review

## Explainability

Compact:

What?
Why?
Evidence?
What changed?
What happens if accepted?

No chain-of-thought walls.

## Uncertainty

PBOS may present multiple good options when the evidence does not justify one definitive answer.

No fake certainty percentages.

## Natural Capture connection

Approved Capture updates should cause Today to reevaluate when they materially change current-day reality.

## Focus connection

Start Focus from Today should carry:
- Action ID
- PlanningBlock ID
- Course/topic when relevant
- expected duration
- origin

Focus completion generates canonical evidence and Today recalculates.

## AI Coach boundary

Today itself becomes intelligently composed.

The user should not need to mentally merge a dumb Today page with a separate generic AI card.

AI Coach remains deeper reasoning, not the primary Today brain.

## Morning / Midday / Evening behavior

Morning:
- orientation
- commitments
- academic pressure
- plan health/fragility

Midday:
- Now
- Next
- changed reality
- valid gap use

Evening:
- remaining capacity
- meaningful unfinished work
- deferrals
- handoff to Review

## Offline/provider unavailable

Core Today remains useful via deterministic:
- current/next block
- gaps
- remaining time
- Action state
- capacity
- conflicts
- fit
- fragility

Remote AI only improves nuanced prioritization/explanation.

## Deterministic Today State

V2 should derive a canonical/derived TodayState layer able to answer:
- current block
- next block
- gap length
- remaining planned minutes
- remaining available minutes
- overloaded/fragile
- elapsed unresolved blocks
- completed evidence
- candidate fit

AI is not required for temporal truth.

## Replanning authority

Today can:
- read state
- recommend
- ask Planning to validate
- apply meaningful schedule changes only after user approval

It cannot silently regenerate Planner, move locks, delete Actions or exceed capacity.

## Elapsed unresolved

Time passing does not automatically mean missed.

Possible states:
- completed
- active
- planned
- elapsed-unresolved
- skipped
- deferred

Unknown stays unknown until evidence/user input resolves it.

## Adaptation frequency

Local deterministic state can recalculate often.

Full intelligence proposals should run only when:
- significant divergence is detected
- important context arrives
- user requests it
- selected transition points justify it

## Today is not Planner-lite, Analytics-lite or Chatbot-lite

Complex scheduling belongs in Planner/Calendar.
Long-term trends belong in Analytics.
Deep reasoning belongs in AI Coach.

## Acceptance

Adaptive Today must eventually prove:
- valid plans remain quiet/stable
- current/next remains default
- gap recommendations actually fit
- fixed/locked intent survives
- impossible remaining load is admitted
- buffer can be preserved
- time passing does not fabricate misses
- existing completion evidence prevents duplicates
- subjective capacity is never invented
- temporary capacity does not rewrite persistent planning capacity
- meaningful adaptation appears as a diff
- user approves meaningful changes
- Today remains useful offline
- Today never owns a duplicate schedule
