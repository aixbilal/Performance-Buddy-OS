\# PBOS V1 — Cross-Domain Integration Matrix



\*\*Day:\*\* 18  

\*\*Status:\*\* V1 LOCKED  

\*\*Purpose:\*\* Define how PBOS domains connect, which engine owns each record, how information moves between domains, and where duplication is forbidden.



\---



\# 1. Purpose



Performance Buddy OS must operate as one connected personal operating system rather than a collection of independent applications.



The fundamental integration model is:



Goal → System → Action → Planner → Calendar → Today → Execution → Evidence → Domain State → Analytics → Review → AI Recommendation → User Decision → Re-planning



Cross-domain integration must preserve:



\- one authoritative source for each record

\- shared engines where concepts are genuinely shared

\- domain-specific semantics where meaning differs

\- deterministic validation

\- local-first operation

\- explicit user control over AI-driven changes

\- resilience when individual capabilities fail



\---



\# 2. Core Integration Principles



\## 2.1 One authoritative record, many views



A record must not be copied merely because multiple PBOS modules need to display it.



Example:



One Action may appear in:



\- Goal Detail

\- System Detail

\- Planner

\- Calendar

\- Today

\- Academics

\- Development

\- Search

\- Analytics



These are views and relationships around the same authoritative Action.



\## 2.2 Shared engine does not mean shared meaning



PBOS should reuse infrastructure without erasing domain semantics.



Examples:



\- Workout Session ≠ Focus Session

\- Routine Check-in ≠ Action Completion

\- Study Time ≠ Mastery

\- Reading Progress ≠ Knowledge Mastery

\- Calendar Block ≠ Action

\- AI Recommendation ≠ Applied Change



\## 2.3 No universal performance score



Evidence from incompatible domains must not be mathematically collapsed into a fake universal score.



Activity ≠ Outcome ≠ Mastery.



Money remains outside performance scoring.



\---



\# 3. Shared Entity Ownership Matrix



| Entity | Authoritative Owner | Common Consumers |

|---|---|---|

| Goal | Goals Engine | Systems, Actions, Today, Analytics, AI |

| System | Systems Engine | Goals, Actions, Today, Analytics |

| Action | Shared Action Engine | Goals, Systems, Planner, Calendar, Today, Domains, Search |

| Scheduled Block | Planner / Calendar Engine | Planner, Calendar, Today |

| Focus Session | Focus Engine | Actions, Academics, Development, Evidence, Analytics |

| Study Session | Academic Study Engine | Academics, Knowledge, Evidence, Analytics |

| Mastery/Test Attempt | Assessment/Mastery Engine | Academics, Knowledge, Development, Analytics |

| Workout Session | Fitness Engine | Fitness, Goals/Systems, Evidence, Analytics |

| Routine Check-in | Routine Engine | Routines, Today, Analytics |

| Reading/Learning Session | Reading \& Language Engine | Learning, Knowledge, Evidence, Analytics |

| Evidence | Evidence Layer | Domains, Analytics, Reviews, AI |

| Knowledge Topic | Knowledge Engine | Academics, Development, Learning, Notes |

| Note Metadata/Link | PBOS Knowledge/Notes Integration | Knowledge, Academics, Development, Learning |

| Markdown Note Body | Obsidian | PBOS via path/link only |

| Academic Course | Academic Engine | Study, Planner, Today, Analytics |

| Academic Assessment | Academic Engine | Academics, Planner, Today, Analytics |

| Development Project | Development Engine | Actions, Skills, Evidence, Analytics |

| Development Skill | Development/Skill Engine | Projects, Knowledge, Evidence |

| Training Plan | Fitness Engine | Fitness, Planner, Today |

| Routine | Routine Engine | Today, Systems, Analytics |

| Book | Reading Engine | Learning, Knowledge, Analytics |

| Language Path | Language Learning Engine | Learning, Knowledge, Analytics |

| Transaction | Money Engine | Money Analytics, Search |

| Budget/Savings Plan | Money Engine | Money Analytics |

| Analytics Result | Analytics Engine | Reviews, Today summaries, AI |

| Review | Reviews Engine | Analytics, AI, Planning |

| AI Recommendation | AI Recommendation/Decision Layer | User Decision, Planner, Domains |

| Configuration | Settings Engine | All applicable PBOS engines |

| Capture Inbox Item | Capture Inbox | Quick Capture resolution flow |

| Search Index Entry | Search Infrastructure | Global Search |



The Search Index is derived data and is never authoritative.



\---



\# 4. Goal / System / Action Relationships



Goal represents a desired outcome.



System represents a repeatable process intended to move toward an outcome.



Action represents executable work.



Relationship:



Goal

↓

System

↓

Action



A Goal may have multiple Systems.



A System may create or contain multiple Actions.



Actions remain authoritative records in the shared Action Engine.



Goal Detail and System Detail must not maintain separate Action databases.



Routine-like behavior should not automatically become a Goal.



\---



\# 5. Planning \& Scheduling Relationships



PBOS must preserve these distinctions:



Action = what needs to be done.



Scheduled Block = when PBOS intends work to happen.



Calendar = temporal representation of scheduled work and commitments.



Today = current-day operational view.



Execution = what actually happened.



Evidence = proof/result of execution.



Therefore:



Scheduling an Action ≠ completing an Action.



Moving a Calendar block ≠ creating another Action.



Deleting a scheduled block must not automatically delete the underlying Action unless the user explicitly chooses that behavior.



Planner and Calendar consume Actions rather than duplicating them.



Today consumes the relevant current-day state.



\---



\# 6. Execution \& Session Relationships



Execution may occur through:



\- Normal Action completion

\- Focus Session

\- Study Session

\- Mastery/Test Attempt

\- Workout Session

\- Routine Check-in

\- Reading Session

\- Language Learning Session



Shared infrastructure may be reused for:



\- timestamps

\- duration

\- links

\- status

\- evidence attachment



However, domain semantics must remain intact.



A Workout is not represented as a Focus Session merely because both have duration.



A Routine Check-in is not represented as a generic completed Action merely for implementation convenience.



A mastery attempt must preserve its assessment/result semantics.



\---



\# 7. Evidence Relationships



Evidence records what actually happened.



Possible evidence includes:



Academic:

\- assessment results

\- mastery results

\- study completion

\- problem-solving evidence



Development:

\- feature implementation

\- tests

\- commits

\- debugging

\- code explanation

\- architecture work

\- project usage



Fitness:

\- reps

\- sets

\- distance

\- duration

\- load

\- completed workout



Routines:

\- check-in

\- completion/compliance



Reading:

\- pages

\- session completion

\- book progress



Language:

\- practice

\- recall

\- assessment

\- demonstrated capability



Evidence feeds domain state, analytics and reviews.



Evidence types must not be converted into a meaningless common unit.



\---



\# 8. Academic Integration



Academic records connect to:



Course

→ Topics

→ Actions

→ Planner

→ Calendar

→ Today

→ Study/Focus

→ Evidence

→ Mastery

→ Analytics

→ Review



Academic state must preserve three separate concepts:



Professor Coverage



Personal Study Coverage



Mastery



These must never be collapsed into one percentage.



Study completion may update Personal Study Coverage.



It does not automatically update Mastery.



Mastery requires appropriate evidence.



Academic calculations remain deterministic.



AI may explain or recommend but does not calculate authoritative grades.



\---



\# 9. Knowledge \& Obsidian Integration



PBOS Knowledge acts as the structured knowledge/control layer.



A concept should remain canonical when used across multiple domains.



Example:



Binary Trees

↕

Academic Topic

↕

Knowledge Topic

↕

Development Usage

↕

Evidence

↕

Obsidian Note Metadata



PBOS owns:



\- structured metadata

\- topic relationships

\- context

\- note paths

\- backlinks/links

\- evidence relationships

\- review state



Obsidian owns:



\- authoritative Markdown note body



PBOS must not silently create a second authoritative copy of the Markdown note body.



A missing Obsidian file does not mean the PBOS knowledge record should be deleted.



\---



\# 10. Development Integration



Development connects:



Project

→ Milestone/Module

→ Action

→ Planner/Today

→ Execution

→ Evidence

→ Skill State

→ Knowledge

→ Analytics



Project Progress and Skill Progress remain distinct.



AI-assisted implementation does not automatically prove independent capability.



Evidence provenance may identify:



\- AI-assisted

\- personally reviewed

\- can explain

\- independently implemented

\- test verified



Exposure ≠ Learning ≠ Practice ≠ Demonstrated capability.



\---



\# 11. Fitness Integration



Fitness connects:



Fitness Goal

→ Training Plan

→ Planned Session

→ Today

→ Workout Session

→ Evidence

→ Fitness State

→ Analytics

→ Adaptation



Three states must remain separate:



Base Plan



Today’s Prescription



Actual Session



Example:



Base Plan: 3.5 km



Today’s Prescription: 2.5 km easy



Actual Session: 2.7 km



Adaptation must not rewrite historical truth.



Recovery may influence recommendations.



PBOS must not present recovery recommendations as medical diagnosis.



\---



\# 12. Routines Integration



Routine represents repeatable daily-life behavior.



Examples include:



\- prayers

\- hydration

\- skincare

\- morning routine

\- evening routine

\- nutrition-related routines



Routine Engine owns routine cadence and check-ins.



Routine check-ins may appear in Today.



Routine completion may feed Analytics.



Routine ≠ Goal by default.



Routine check-in ≠ generic Action completion.



\---



\# 13. Reading \& Language Integration



Reading and Language Learning own curriculum/progress semantics.



They connect to:



Goals/Systems

Actions

Planner

Today

Learning Sessions

Knowledge

Evidence

Analytics



Routine determines when/how consistently practice occurs.



Reading/Language determines what was studied/read.



Knowledge/Mastery determines what is understood or retained.



Lesson completion/pages/time ≠ mastery.



\---



\# 14. Money Integration



Money OS remains a lightweight personal finance awareness system.



It owns:



\- transactions

\- budgets

\- savings plans

\- money insights



Money may connect to:



\- Quick Capture

\- Search

\- Actions

\- planning

\- Today where appropriate



Actual Transaction ≠ Planned Expense.



Savings Transfer ≠ Expense.



PBOS-calculated balance ≠ verified bank balance.



Money analytics remain separate from performance scoring.



\---



\# 15. Analytics \& Review Integration



Analytics consumes:



\- evidence

\- domain states

\- Actions

\- execution history

\- relevant planning history



Analytics does not become the source of truth for underlying records.



Reviews interpret analytics over meaningful periods.



Weekly Review = tactical.



Monthly Review = strategic.



Analytics must preserve:



Activity ≠ Outcome ≠ Mastery.



Correlation/association ≠ causation.



Missing data lowers confidence.



Insufficient evidence should be shown as insufficient evidence rather than replaced with fabricated metrics.



\---



\# 16. AI Recommendation Integration



AI operates through:



PBOS structured data

↓

Permission check

↓

Context minimization

↓

AI interpretation

↓

Recommendation / Proposal

↓

User Accept / Modify / Reject

↓

Deterministic PBOS validation

↓

Authoritative Engine



AI does not directly own domain records.



AI conversation does not automatically mutate PBOS.



Recommendation ≠ Action.



Conversation ≠ Database Mutation.



AI failure must not disable deterministic PBOS functionality.



\---



\# 17. Search \& Quick Capture Integration



Global Search is an access layer.



It searches/indexes PBOS-known structured entities.



Search result

→ canonical entity route



Search must not create duplicate entity-detail implementations.



The local Search Index is derived from authoritative PBOS records.



If the index is corrupted, it may be rebuilt without changing authoritative data.



Quick Capture is an input layer.



Flow:



Raw Capture

↓

Interpret / Classify

↓

Structured Proposal

↓

User Confirmation

↓

Deterministic Validation

↓

Existing Authoritative Domain Engine



V1 Quick Capture types:



\- Action

\- Academic event/deadline

\- Knowledge item

\- Quick Note

\- Expense

\- Routine check-in



If AI is unavailable:



Raw Capture

→ Capture Inbox

→ Manual classification/resolution



Capture Inbox owns unresolved raw captures only.



\---



\# 18. Settings \& Configuration Integration



Settings owns shared configuration.



Configuration hierarchy:



Base Configuration

↓

Mode Override

↓

Temporary Override

↓

Effective Configuration



Domains consume Effective Configuration.



Domains must not create independent copies of shared settings.



Temporary overrides must not overwrite baseline configuration.



AI cannot silently change mode, capacity or protected constraints.



\---



\# 19. Resilience Integration



Failure should remain at the smallest reasonable scope.



AI failure ≠ PBOS failure.



Search Index failure ≠ authoritative data loss.



Obsidian path failure ≠ PBOS metadata deletion.



Analytics failure ≠ execution failure.



One domain failure ≠ whole application failure.



Offline ≠ Broken.



Loading ≠ Empty.



Unknown ≠ Zero.



Partial ≠ Failed.



Stale ≠ Current.



Failed save ≠ Lost Draft.



Critical storage/database failure is one of the few states allowed to block the whole application when PBOS cannot safely operate on authoritative data.



\---



\# 20. Cross-Domain Update Rules



\## Study completion



Study Session completes

↓

Session saved

↓

Linked Action updated where applicable

↓

Study Evidence created

↓

Personal Study Coverage may update

↓

Knowledge evidence/state may update

↓

Analytics receives evidence



Mastery does not automatically increase merely because time was spent.



\## Mastery assessment



Assessment completes

↓

Result saved

↓

Mastery Evidence created

↓

Relevant Academic/Knowledge state updates

↓

Analytics receives result

↓

Weakness may become visible to Review/AI



\## Focus completion



Focus Session completes

↓

Focus record saved

↓

Linked Action updated according to actual result

↓

Relevant Evidence created

↓

Domain receives evidence

↓

Analytics receives evidence



Focus duration alone does not prove task success or mastery.



\## Workout completion



Workout Session completes

↓

Actual Session preserved

↓

Evidence created

↓

Fitness state updates

↓

Analytics receives evidence

↓

Future prescription may adapt



Base Plan remains historically intact.



\## Routine check-in



Check-in

↓

Routine Engine records state

↓

Today reflects completion

↓

Analytics receives compliance evidence



No duplicate Action is required merely to record a routine check-in.



\## Reading/Language session



Session completes

↓

Progress updates

↓

Evidence created

↓

Knowledge may receive linked evidence

↓

Analytics updates



Completion does not automatically equal mastery.



\## AI recommendation accepted



Recommendation

↓

User Accepts/Modifies

↓

PBOS validates

↓

Correct authoritative engine applies change

↓

Planner/domain state refreshes



AI does not directly bypass the authoritative engine.



\---



\# 21. Forbidden Duplication Rules



PBOS V1 must not introduce:



\- separate Action databases per domain

\- separate Goal engines per domain

\- duplicate Planner and Calendar task records

\- duplicate Today task records

\- duplicate Knowledge topics for the same canonical concept without a genuine semantic reason

\- duplicated Obsidian Markdown bodies inside PBOS

\- separate Quick Capture creation engines

\- separate Search-owned entity records

\- AI-owned copies of domain records

\- Analytics-owned copies of source records

\- separate preference systems where Effective Configuration already applies

\- generic session abstraction that destroys important domain semantics

\- duplicate mastery systems for Academics and Knowledge when the evidence can be linked appropriately

\- automatic conversion of routine check-ins into duplicate Actions

\- automatic creation of new Actions when a scheduled block is merely moved

\- universal performance scoring across incompatible domains

\- silent AI database mutations

\- silent rewriting of historical plans/evidence after adaptation

\- fake values when source information is unknown



If implementation convenience requires duplication of cached or indexed data, it must be explicitly treated as derived/rebuildable data rather than a second source of truth.



\---



\# 22. Claude Implementation Audit Checklist



Claude must verify:



\- \[ ] Goals use one authoritative Goal Engine.

\- \[ ] Systems use one authoritative System Engine.

\- \[ ] Actions use one shared Action Engine.

\- \[ ] Domains reference Actions instead of cloning them.

\- \[ ] Planner and Calendar schedule existing Actions correctly.

\- \[ ] Scheduled Blocks remain distinct from Actions.

\- \[ ] Today consumes existing canonical records.

\- \[ ] Navigation opens canonical entity routes.

\- \[ ] Focus Sessions preserve their own semantics.

\- \[ ] Study Sessions preserve their own semantics.

\- \[ ] Workout Sessions preserve their own semantics.

\- \[ ] Routine Check-ins preserve their own semantics.

\- \[ ] Reading/Language Sessions preserve their own semantics.

\- \[ ] Mastery/Test Attempts preserve assessment semantics.

\- \[ ] Evidence links correctly to originating records.

\- \[ ] Academic Professor Coverage, Personal Study Coverage and Mastery remain separate.

\- \[ ] Knowledge concepts are canonical where appropriate.

\- \[ ] Development project progress and skill capability remain separate.

\- \[ ] Fitness Base Plan, Today’s Prescription and Actual Session remain separate.

\- \[ ] Routine completion does not require duplicate Actions.

\- \[ ] Reading/Language completion does not automatically imply mastery.

\- \[ ] Money remains outside universal performance scoring.

\- \[ ] PBOS does not duplicate authoritative Obsidian note bodies.

\- \[ ] Analytics consumes source data rather than replacing it.

\- \[ ] Reviews consume Analytics/Evidence correctly.

\- \[ ] AI uses only permitted/minimized context.

\- \[ ] AI recommendations require user decision.

\- \[ ] AI cannot directly bypass authoritative engines.

\- \[ ] Global Search routes to canonical entities.

\- \[ ] Search Index is derived and rebuildable.

\- \[ ] Quick Capture resolves into existing domain engines.

\- \[ ] Capture Inbox safely preserves unresolved captures.

\- \[ ] Settings provide shared Effective Configuration.

\- \[ ] Mode/temporary overrides do not overwrite baseline settings.

\- \[ ] Offline operation preserves local deterministic PBOS features.

\- \[ ] AI failure remains isolated.

\- \[ ] Component/domain failure does not unnecessarily block the application.

\- \[ ] Unknown values are never represented as zero.

\- \[ ] Loading is never represented as empty.

\- \[ ] Failed saves preserve user input.

\- \[ ] Derived/cached/indexed data is never treated as authoritative.

\- \[ ] Cross-domain records maintain canonical IDs and relationships.

\- \[ ] No duplicate engine has been introduced merely for UI convenience.



\---



\# Day 18 Integration Lock



PBOS V1 follows:



\*\*Shared Engines → Canonical Records → Domain-Specific Meaning → Evidence → Intelligence → User-Controlled Adaptation\*\*



The application must behave as one connected operating system.



A feature appearing in multiple places does not justify multiple sources of truth.



A shared infrastructure does not justify destroying domain-specific meaning.



AI may interpret and recommend.



Deterministic PBOS engines validate.



The user decides.



Authoritative records remain authoritative.

