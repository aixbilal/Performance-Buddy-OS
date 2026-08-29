\# Performance Buddy OS — Global Search \& Commands



\*\*Status:\*\* V1 PRODUCT/UI LOCKED  

\*\*Phase:\*\* Day 16  

\*\*Scope:\*\* Global Search, Command Palette, Quick Capture, global navigation and command infrastructure



\---



\## 1. Purpose



Day 16 defines the universal access layer for Performance Buddy OS.



Its purpose is to make PBOS feel like one connected operating system rather than a collection of separate modules.



From anywhere in PBOS, the user should be able to quickly:



\*\*Find → Navigate → Create → Execute\*\*



without duplicating the underlying domain systems.



Day 16 introduces:



\- Global Search

\- Command Palette

\- Quick Capture

\- global keyboard behavior

\- local search infrastructure

\- command registry

\- capture routing

\- recent history

\- canonical navigation behavior



The system must remain fast and useful even when AI is disabled or unavailable.



\---



\# 2. Approved References



Approved V1 structural/functional references:



1\. `PBOS-Global-Search-Command-Palette-v1-REFERENCE.png`

2\. `PBOS-Quick-Capture-v1-REFERENCE.png`



These references define:



\- hierarchy

\- information architecture

\- interaction model

\- major states

\- approximate composition



They are NOT final pixel-perfect UI specifications.



The locked PBOS Design System and Visual Identity remain authoritative.



\---



\# 3. Core Architecture



Day 16 consists of three connected capabilities.



\## Global Search



Find existing PBOS entities.



\## Commands



Navigate to or invoke existing PBOS capabilities.



\## Quick Capture



Capture raw information and route it into the appropriate existing PBOS system.



Conceptually:



```text

&#x20;                   CTRL + K

&#x20;                      │

&#x20;         ┌────────────┴────────────┐

&#x20;         │                         │

&#x20;      SEARCH                    COMMAND

&#x20;         │                         │

&#x20;  Local Search Index        Command Registry

&#x20;         │                         │

&#x20;  Canonical Entity          Existing PBOS Engine

&#x20;         │                         │

&#x20;         └────────────┬────────────┘

&#x20;                      │

&#x20;                   PBOS UI





&#x20;                QUICK CAPTURE

&#x20;                      │

&#x20;                   Raw Input

&#x20;                      │

&#x20;               Interpret / Route

&#x20;                ↙             ↘

&#x20;       Structured Proposal   Capture Inbox

&#x20;                │

&#x20;              Review

&#x20;                │

&#x20;      Deterministic Validation

&#x20;                │

&#x20;       Existing Domain Engine

4\. Global Search / Command Palette

Primary shortcut:

Ctrl + K

The palette opens as a centered overlay above the current PBOS workspace.

The underlying workspace remains intact.

Primary input:

Search PBOS or run a command…

The user should not need to decide whether they are using Search Mode or Command Mode.

One input handles both.

Examples:

Binary Trees

→ search PBOS

Go to Academics

→ navigation command

Start Focus

→ operational command

New Action

→ creation command

Settings notifications

→ navigate directly to the relevant Settings destination

5\. Default Palette State

Opening the palette without a query should provide useful starting points rather than an empty interface.

Recommended sections:

Recent

Examples:

\- recently opened entity

\- recent search

\- recent useful command

Quick Commands

Examples:

\- Go to Today

\- Start Focus

\- New Action

\- Quick Capture

\- Open Planner

Footer hints may include:

↑ ↓ Navigate

Enter Open / Execute

Esc Close

Keep the default state compact.

Do not turn the palette into another dashboard.

6\. Search Scope

V1 search should cover useful structured PBOS entities.

Core

\- Actions

\- Goals

\- Systems

Academics

\- Courses

\- Topics

\- Assessments

\- Academic events

\- Deadlines

Knowledge

\- Knowledge topics

\- Review items

\- linked-note metadata

Development

\- Projects

\- Milestones/modules

\- Skills

\- Learning topics

Fitness

\- Training plans

\- relevant workout/session records

Daily Life

\- Routines

Reading \& Language

\- Books

\- Language paths/topics

Money

\- useful transaction/category metadata

Application

\- PBOS pages

\- Settings destinations

\- registered commands

Do not index every database record merely because it exists.

7\. Search Index

Use a lightweight local searchable projection derived from authoritative PBOS data.

Conceptually:

Authoritative PBOS Data

&#x20;       ↓

Searchable Metadata Projection

&#x20;       ↓

Local Search Index

&#x20;       ↓

Global Search

The Search Index is NOT a source of truth.

It should be safe to rebuild from authoritative PBOS records.

Deleting or rebuilding the Search Index must not delete actual user data.

8\. Searchable Metadata

A typical searchable entity may expose:

id

entity\_type

title

subtitle

keywords/tags

domain

status

canonical\_route

updated\_at

Add small amounts of type-specific metadata only when useful.

Do not copy complete domain records into the Search Index unnecessarily.

9\. Search Results

Results should be grouped by meaningful entity type.

Example query:

Binary Trees

Possible groups:

Academics

Binary Trees

Data Structures • Topic

Knowledge

Binary Trees

Knowledge Topic • Review Due

Notes

Binary Trees — Traversals

Obsidian Note

Actions

Practice Binary Tree Problems

Due Today

Avoid one large undifferentiated result list.

10\. Result Behavior

Each result should remain compact.

A result may contain:

\- type indicator

\- title

\- contextual metadata

\- status/state where useful

Default:

Enter

→ open the real entity.

Search must resolve to the entity's canonical PBOS destination.

Do not create duplicate Search-specific detail pages.

Example:

Search Result

Binary Trees

Academic Topic

&#x20;       ↓

Canonical Route

&#x20;       ↓

Actual Academic Topic Detail

11\. Search Ranking

V1 ranking should remain deterministic.

Approximate priority:

Exact title match

→ Title prefix match

→ Title contains

→ Keyword/tag match

→ Metadata relevance

→ Recent usage

→ Current-context boost

Current context may influence ranking.

Example:

while inside:

Academics → Data Structures

the Data Structures version of Binary Trees may receive a modest boost.

Context must NOT become a hard filter.

The user should still be able to find similarly named entities from other domains.

Do not expose artificial search-match percentages to the user.

12\. Obsidian Boundary

PBOS may search Obsidian-related metadata it legitimately maintains or has access to, including:

\- note title

\- path

\- linked PBOS entity

\- available tags/metadata

\- timestamps

Day 16 does NOT introduce:

\- full-vault semantic retrieval

\- embeddings

\- vector database

\- mature RAG

\- unrestricted AI reading of the vault

Obsidian remains authoritative for long-form Markdown note bodies.

13\. Command Registry

Commands should be registered through a shared command architecture rather than hardcoded independently throughout the palette.

Conceptually:

Command

├── id

├── title

├── keywords

├── category

├── shortcut

├── availability()

├── execute()

└── safetyLevel

Example command IDs:

command.today.open

command.focus.start

command.action.create

command.capture.open

command.planner.open

command.settings.notifications.open

Exact implementation may follow existing repository conventions.

14\. Command Categories

V1 uses four conceptual command categories.

Navigate

Open a PBOS destination.

Examples:

\- Go to Today

\- Open Academics

\- Open Development

\- Open Fitness

\- Open Planner

\- Open Settings

Create

Invoke an existing creation flow.

Examples:

\- New Action

\- New Goal

\- New System

\- Quick Capture

\- Add Expense

Execute

Start or invoke an existing PBOS capability.

Examples:

\- Start Focus

\- Start Workout

\- Open Today's Plan

Application

Control PBOS itself.

Examples:

\- Toggle sidebar

\- Open shortcuts

\- Open notification settings

\- review/change Operating Mode

15\. Command Safety

Commands must respect existing PBOS safeguards.

Level 1 — Immediate Navigation

Examples:

Go to Academics

Open Today

May execute immediately.

Level 2 — Safe / Reversible UI Action

Examples:

Collapse Sidebar

Open Quick Capture

May execute immediately with lightweight feedback.

Level 3 — Confirmed / Delegated Action

Commands that materially affect persistent state must invoke the appropriate existing PBOS workflow.

Examples:

Change Operating Mode

Create Academic Event

The Command Palette must not bypass confirmation or validation.

Destructive commands should not be exposed as normal V1 palette commands.

Examples that should remain in protected domain/Settings surfaces:

\- delete all data

\- reset PBOS

\- destructive bulk deletion

16\. No Duplicate Engines

The Command Palette is an access layer.

It does NOT own domain functionality.

Example:

Ctrl + K

→ New Action

→ Existing Action Creation Engine

NOT:

Ctrl + K

→ Separate Command-Palette Action Engine

The same rule applies to:

\- Goals

\- Systems

\- Focus

\- Planner

\- Money

\- Academics

\- Routines

\- Fitness

\- other PBOS domains

One engine may have multiple entry points.

17\. Quick Capture

Quick Capture is a lightweight universal inbox for getting information into PBOS quickly.

It is NOT another full editor or dashboard.

The user may enter natural text such as:

DSA quiz next Tuesday on binary trees

PBOS may interpret this as a structured proposal.

Example:

Academic Event



Course: Data Structures

Type: Quiz

Topic: Binary Trees

Date: Tuesday

Linked Action: Prepare for Quiz

The user reviews before saving.

18\. Quick Capture Pipeline

Lock the conceptual pipeline:

Raw Input

&#x20;  ↓

Interpret

&#x20;  ↓

Structured Proposal

&#x20;  ↓

User Review

&#x20;  ↓

Deterministic Validation

&#x20;  ↓

Existing Domain Engine

&#x20;  ↓

Authoritative PBOS Record

Interpretation does NOT equal persistence.

AI may propose.

The user decides.

PBOS validates.

The existing domain engine saves.

19\. Supported V1 Capture Types

Keep V1 deliberately limited.

Supported Quick Capture destinations:

\- Action

\- Academic Event / Deadline

\- Knowledge Item

\- Quick Note

\- Expense

\- Routine Check-in

Complex entities such as Goals and Systems should normally invoke their proper builders rather than attempting to create an entire structure from one sentence.

20\. Capture Inbox

If PBOS cannot confidently or safely classify an entry, preserve it.

Conceptually:

Raw Input

&#x20;  ↓

Capture Inbox

A lightweight Capture Inbox record may contain:

id

raw\_text

created\_at

source/context

processing\_state

Suggested states:

\- Unprocessed

\- Proposed

\- Resolved

Do not turn Capture Inbox into another task-management system.

Its job is to prevent thoughts from being lost.

21\. AI Boundary

Global Search is NOT AI Coach.

Opening Ctrl + K must not automatically send the query to an external AI provider.

Normal search:

Query

→ Local Search

→ Results

AI may assist when interpretation is explicitly useful and permitted.

AI-assisted flow:

Input

→ AI permission/context rules

→ minimized context

→ AI interpretation

→ structured proposal

→ user review

AI is an optional interpretation layer.

It is NOT the foundation of Global Search.

22\. AI-Unavailable Behavior

If AI is:

\- disabled

\- offline

\- rate-limited

\- unavailable

\- unconfigured

the following must continue working:

\- Global Search

\- Navigation commands

\- deterministic registered commands

\- manual creation flows

\- Capture Inbox

If Quick Capture cannot interpret an entry:

offer manual classification or preserve it in Capture Inbox.

Capture must not fail merely because AI failed.

23\. Recent History

Maintain a small local convenience history for useful items such as:

\- recent searches

\- recent commands

\- recently opened entities

Keep this bounded and lightweight.

The exact limit may follow implementation needs.

Approximately 10–20 useful recent entries is sufficient for V1.

Recent Search/Command history is convenience data.

It is NOT performance evidence.

Provide a way to clear relevant history through Privacy/Settings controls.

24\. Navigation Model

PBOS navigation has complementary layers.

Sidebar

Provides discoverability.

Domain Navigation

Provides context within a domain.

Example:

Academics → Course → Topic

Global Search / Command Palette

Provides speed.

Quick Capture

Provides immediate capture.

These mechanisms should complement each other rather than compete.

25\. Navigation Context

Opening an overlay must preserve the underlying workspace.

Example:

User is at:

Academics → Data Structures → Binary Trees

User opens:

Ctrl + K

Then presses:

Esc

The user should return to the same Binary Trees context.

Do not reset the domain merely because a temporary overlay was opened.

26\. Back Navigation

Search overlays should not pollute meaningful application navigation history unnecessarily.

Example:

Today

→ Data Structures

→ Binary Trees

Back should move through meaningful destinations.

Temporary Search/Command overlay state does not need to behave like a permanent route.

27\. Quick Capture Completion

After a successful capture:

Default:

Save

→ subtle confirmation

→ close overlay

→ return to previous workspace

Where useful, support:

Save \& Open

→ save

→ open the canonical newly created entity

Do not force navigation away from the user's current work after every capture.

28\. Unsaved Work

Global navigation must respect existing unsaved-work protections.

The Command Palette cannot bypass:

\- Save

\- Discard

\- Cancel

guards where meaningful unsaved edits exist.

29\. Active Sessions

Global navigation should not terminate active execution state.

Examples may include:

\- Focus session

\- active workout/session

\- applicable timers

Opening Search, navigating elsewhere or closing an overlay should not silently destroy an active session.

Use existing session architecture.

Do not create another session engine for Day 16.

30\. Command Availability

Commands may respond to current context.

Example:

inside a course, relevant academic commands may rank higher.

Inside Development, project-related commands may rank higher.

Context should influence ranking without hiding normal global commands.

If a command cannot currently run, expose an understandable unavailable state where appropriate rather than mysteriously disappearing.

Example:

Start Focus — unavailable while another Focus session is active

31\. Keyboard Behavior

V1 keeps keyboard behavior intentionally small.

Primary controls:

Ctrl + K — Open Global Search / Command Palette

Esc — Close current temporary overlay

↑ / ↓ — Navigate results

Enter — Open / execute selected item

Tab — Move through available controls where necessary

Do not create dozens of power-user shortcuts before real usage demonstrates a need.

32\. Search Freshness

When authoritative PBOS data changes, its searchable projection should update.

Example:

Rename Goal

→ Authoritative Goal Updated

→ Search Projection Updated

If the Search Index becomes invalid or out of sync:

rebuild it from authoritative PBOS data.

Again:

Search Index ≠ Source of Truth

33\. Performance

Global Search should feel effectively instantaneous for normal personal PBOS datasets.

The primary interaction should feel like:

Ctrl + K

→ Type

→ Results

NOT:

Ctrl + K

→ Spinner

→ Network

→ AI

→ Results

Do not put external network calls or AI inference into the normal keystroke search loop.

34\. Visual Direction

Global Search and Quick Capture should be among the simplest PBOS interfaces.

Use:

\- matte PBOS surfaces

\- restrained depth

\- clear hierarchy

\- compact results

\- subtle state illumination

\- strong keyboard usability

\- minimal visual noise

Avoid:

\- dashboard cards everywhere

\- charts

\- gauges

\- AI avatars

\- excessive glass

\- gaming RGB

\- neon cyberpunk

\- unnecessary side panels

\- decorative technical information

Generated references may contain more supporting explanation than the final runtime surface requires.

Implementation should preserve the product structure while keeping the actual experience compact.

35\. V1 Explicit Exclusions

Day 16 does NOT include:

\- vector database

\- mature semantic search

\- mature RAG

\- AI-first search dependency

\- universal chatbot inside Search

\- full Obsidian-vault semantic retrieval

\- plugin marketplace

\- terminal scripting

\- command chaining

\- macro language

\- destructive command shortcuts

\- separate duplicate creation engines

\- complex search analytics

\- huge keyboard shortcut library

Do not expand scope into these areas.

36\. Implementation Boundary

Engineering may:

\- implement the local search projection/index

\- implement deterministic ranking

\- implement the Command Registry

\- implement canonical routing

\- implement Global Search overlay

\- implement command execution

\- implement Quick Capture

\- implement Capture Inbox

\- implement optional AI interpretation using existing permission architecture

\- implement recent history

\- implement keyboard behavior

\- implement navigation-context preservation

\- implement safe fallbacks

Engineering must NOT:

\- redesign approved product behavior

\- duplicate domain engines

\- make AI mandatory

\- add unrestricted AI context

\- bypass confirmation rules

\- introduce mature RAG/vector architecture

\- expose destructive commands casually

\- turn Search into AI Coach

If a genuine architecture conflict appears:

UI ↔ ARCHITECTURE REVIEW REQUIRED

37\. V1 Acceptance Checklist

Global Search

\- Ctrl + K opens palette

\- overlay preserves current workspace

\- local search works without AI

\- results are grouped meaningfully

\- deterministic ranking works

\- canonical routes open real entities

\- recent items work

\- search history can be cleared

\- search remains responsive

Commands

\- Command Registry implemented

\- Navigate commands work

\- Create commands invoke existing builders

\- Execute commands invoke existing engines

\- Application commands work where supported

\- unavailable commands are handled clearly

\- confirmation/safety rules are preserved

\- destructive commands are not casually exposed

Quick Capture

\- raw capture works

\- structured proposal can be reviewed

\- user confirmation occurs before persistence

\- deterministic validation occurs

\- existing domain engines receive confirmed data

\- Capture Inbox fallback works

\- AI-disabled fallback works

\- Save returns to previous workspace

\- Save \& Open works where implemented

Navigation

\- Esc restores previous context

\- overlays do not pollute navigation unnecessarily

\- unsaved-work guards remain respected

\- active sessions survive ordinary navigation

\- keyboard navigation works

Final V1 Principle

Sidebar provides discoverability.

Global Search provides speed.

Quick Capture removes friction.

Existing PBOS engines remain authoritative.

Day 16 should make the entire application easier to reach and operate without becoming another complicated system of its own.



With this README, \*\*Day 16 product definition is complete\*\*. The next step is the Day 16 Claude implementation handoff; after that we move to \*\*Day 17 — resilience and edge states\*\*.

