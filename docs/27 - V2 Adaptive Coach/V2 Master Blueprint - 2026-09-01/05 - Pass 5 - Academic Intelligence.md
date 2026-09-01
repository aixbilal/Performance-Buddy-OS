# PBOS V2 — PASS 5: ACADEMIC INTELLIGENCE

Status: LOCKED

## Definition

Academic Intelligence is PBOS's evidence-oriented academic decision layer.

It keeps teaching coverage, personal study, execution, mastery, assessments and grade mathematics as distinct truths; combines them into explainable attention requirements; understands assessment urgency and explicitly recorded scope; and hands validated study needs to Adaptive Planning and Adaptive Today without allowing AI to fabricate academic facts or become the authority for grade/CGPA mathematics.

## V1 foundation retained

Current Academics already separates:

- Professor Coverage
- Personal Study
- Knowledge Mastery
- Assessments/marks
- Course attempts/grades

Mastery is read from canonical Knowledge evidence rather than duplicated in Academics.

Grade/CGPA calculations refuse to guess unknown university policy.

The Study engine uses reason codes rather than a mysterious universal score.

## Purpose

Academic Intelligence should answer:

- What should I study next?
- What am I actually weak at?
- What is urgent?
- What can wait?
- What academic activity has the highest useful return now?

It is not merely an academic dashboard.

## Three truths remain separate

Professor Coverage:
what the course has taught.

Personal Study:
what the user personally covered.

Mastery:
what evidence indicates the user can recall/apply.

They may disagree.

Example:
Professor taught = yes
Personal study = 100%
Mastery = weak

This is valid.

## Time spent is a fourth separate truth

Focus 42 minutes proves activity.

It does not automatically prove:
- personal coverage increased
- outcome completed
- mastery improved

## Attention model

Academic Intelligence should determine what deserves attention using factual reasons such as:

- review due
- professor covered but not personally studied
- weak evidence
- no evidence
- assessment imminent
- explicitly in assessment scope
- high assessment weight
- repeated weakness
- previously deferred
- widening professor/user coverage gap
- insufficient preparation opportunities

These are reasons for attention, not mastery.

## No universal opaque academic score

Do not make “Academic Priority 87/100” the core model.

Dimensions remain understandable:
- urgency
- relevance
- importance
- coverage
- personal gap
- mastery evidence
- recent study
- failed resolution
- remaining prep time
- user intent

## Critical new V2 concept: Assessment Scope

Current Assessment has:
- course
- category
- title
- marks
- weight
- date

V2 needs an explicit Assessment ↔ Academic Topic relationship.

Example:

DSA Quiz 2
- AVL insertion
- AVL deletion
- rotations

Scope can come from:
- user entry
- approved Natural Capture extraction
- verified import

Never from unsupported AI guessing.

## Unknown scope remains unknown

If PBOS only knows:
“DSA Quiz Thursday”

it can prioritize the course/assessment.

It cannot truthfully say:
“AVL is on the quiz”

unless scope is explicitly recorded.

## Natural Capture academic example

“Quiz Thursday on AVL insertion, deletion and rotations. We covered deletion today and I'm still confused by the two-child case.”

Potential proposals:
- assessment/date
- assessment scope
- professor coverage
- weakness interpretation

After approval, Academic Intelligence recalculates.

## Assessment urgency is deterministic

Calculate:
- days remaining
- today/past
- prep window remaining
- overlapping assessments
- valid study opportunities before assessment

No AI arithmetic required.

## Assessment importance

WeightPercent is factual input.

It must not become:
“Spend exactly proportional study time.”

Weight is one signal among urgency, weakness, scope and time.

## Grade/CGPA boundary

Deterministic engine remains authoritative for:
- weighted contribution
- assessment-weight configuration
- SGPA
- CGPA where policy is known
- required averages
- reachability

LLM never becomes arithmetic authority.

## Grade policy remains policy-gated

Do not derive a letter grade from percentage unless verified official/user-authoritative interval policy exists.

Do not guess repeat-course replacement rules.

If policy is unresolved:
affected CGPA stays blocked/qualified rather than invented.

## Target/projected grades

Current target/projected grades are user-declared.

AI may reason about the user's target but cannot manufacture authoritative projected grades from partial marks without a verified deterministic policy.

## Remaining grading weight

Safe deterministic intelligence can say:
“50% of course weight remains.”

But marks conclusions must account for incomplete/misconfigured assessment weighting.

## Course status

AI should not silently mutate stored:
- on-track
- at-risk
- off-track

It may surface risk signals/recommendations, but canonical state changes require an explicit product rule/user decision.

## “What should I study next?” pipeline

1. Build eligible topics
2. Attach factual reason codes
3. Attach assessment context/scope
4. Consider study mode
5. exclude satisfied/irrelevant work
6. rank attention
7. return primary recommendation + limited alternatives

Do not send the whole database to an LLM and ask it to invent the answer.

## Recommendation format

Study next:
AVL deletion

Why:
- quiz Thursday
- AVL explicitly in scope
- professor covered it
- evidence remains weak
- last session did not resolve the two-child case

Next action:
- Start Focus
- Plan this

## Multiple good options

When evidence does not justify one definitive answer, show a small set of good choices.

No fake certainty.

## Study modes

Normal:
- stay current with professor
- review due
- weak evidence
- steady progression

Midterm:
- explicit midterm scope
- unresolved taught material
- evidence gaps
- proximity

Final:
- explicit final scope
- unresolved/high-impact material
- cumulative review only when scope says it is cumulative

Recovery:
- smallest useful academic restart
- weakest meaningful item
- no backlog punishment

Mode changes ordering strategy, not syllabus facts.

## Personal Study percentage

Natural Capture may propose an explicit update.

Focus duration cannot automatically calculate percentage coverage.

## Post-study flow

After a linked Focus session, PBOS already knows:
- course
- topic
- duration
- date

Ask only missing truth:
- outcome/understanding
- personal coverage update if desired
- mastery check now/later

## Mastery remains evidence-based

User comfort can be one kind of self-report/proposal, but canonical Knowledge mastery remains governed by evidence.

Repeated unresolved weakness is especially important.

If repeated study does not improve evidence, Academic Intelligence may recommend changing method rather than just scheduling the same session again.

## Method recommendations

Good AI role:
- worked problems
- recall questions
- explain in own words
- targeted practice

AI suggests method.
It does not rewrite mastery.

## Academic → Planning handoff

Academic Intelligence should emit a Study Requirement, conceptually:

Course: Data Structures
Topic: AVL deletion
Reason: quiz + weak
Required before: Thursday
Priority: high
Suggested need: 45m
Source: Academic Intelligence

Adaptive Planning decides when/where it can fit.

## Duration authority

1. user estimate
2. existing Action/requirement estimate
3. configured study default
4. AI suggested duration, explicitly advisory
5. unknown

## Requirement ≠ duplicate Action

Resolve against existing Actions before creating new work.

## Assessment decomposition

An assessment scope may contain many topics.

Academic Intelligence should determine which actually need attention from evidence, rather than blindly turning every syllabus topic into multiple tasks.

## Academic return

Definition:

> The study activity most likely to reduce meaningful academic risk or improve preparation, given current evidence and available time.

Not:
“AI predicts this gives the most marks.”

## Learn / Strengthen / Review / Verify

Different states should produce different recommended work:

Learn:
not adequately studied.

Strengthen:
studied but weak.

Review:
previously strong but due.

Verify:
appears strong but evidence stale/insufficient.

## Knowledge relationship

Academic Topic gives academic context.

Knowledge Topic gives learning/evidence context.

Link them.
Do not merge databases.

## Past papers

Do not build a giant Past Paper subsystem as core V2.

Controlled capability may allow:
- user-provided questions/paper
- topic association
- practice session
- governed evidence

## Recall generation

AI may generate practice/recall questions from approved context.

Questions are practice material.

Only validated answered checks can become evidence.

## Course-level intelligence

Academics Overview should increasingly answer:
“Which courses need attention?”

Derived attention states may include:
- Immediate
- Watch
- Stable

These do not automatically mutate stored Course.status.

## Screen implications

Major evolution:
- Academics Overview
- Course Detail
- Normal Study

Moderate:
- Mastery Check
- Assessment form/scope
- topic edit

Mostly preserve:
- SGPA/CGPA deterministic surfaces

## Offline/provider unavailable

Without remote AI, PBOS can still use:
- coverage
- study reasons
- study modes
- assessment dates
- marks math
- Knowledge evidence
- review due

AI improves natural-language interpretation, explanations, method suggestions and practice generation.

## AI allowed

- interpret academic natural-language updates
- extract scope
- explain structured state
- suggest study methods
- summarize permitted notes
- generate recall questions
- compare study options
- propose Actions/requirements

## AI forbidden as authority

- SGPA/CGPA calculation
- official grade boundary guessing
- repeat-policy guessing
- scope fabrication
- professor coverage fabrication
- personal-study completion fabrication
- mastery from time spent
- marks invention
- silent assessment/state mutation
- causal claims unsupported by evidence

## Acceptance

Academic Intelligence must prove:
- coverage / personal study / mastery remain separate
- time spent never equals mastery
- mastery remains Knowledge-authoritative
- urgency is deterministic
- scope is explicit
- unknown scope stays unknown
- recommendations have reasons
- no universal opaque score is required
- modes do not fabricate syllabus facts
- repeated weakness can change method
- existing Actions are reused
- Academic requirements feed Planning, not raw calendar writes
- marks math remains deterministic
- bad weighting limits conclusions
- grade/repeat policy is never guessed
- AI can explain but not become academic arithmetic authority
- provider failure preserves core study prioritization
