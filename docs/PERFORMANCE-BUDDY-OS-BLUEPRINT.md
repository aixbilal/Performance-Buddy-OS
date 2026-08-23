# Performance Buddy OS — Locked Documentation Blueprint

> **Status:** FROZEN / LOCKED  
> **Baseline:** v1.0  
> **Supersedes:** Personal Performance OS — Documentation Tree Candidate v0.1  
> **Project name:** Performance Buddy OS  
> **Location:** Repository root  
> **Authority:** This file is the structural source of truth for the documentation set.

## 1. Baseline declaration

This blueprint freezes the previously approved **Personal Performance OS — Documentation Tree Candidate v0.1** as the **Performance Buddy OS — Documentation Baseline v1.1**.

For the original v1.0 freeze, the project rename and the Phase 20 language-learning amendment described below were the only changes from Candidate v0.1. Documentation Baseline v1.1 additionally includes the approved 25-document multi-agent and companion extension recorded in Section 9; it adds files only within existing phases and does not rename, reorder, merge, split, or add any top-level phase.

The baseline must not be casually renamed, reordered, merged, split, or expanded. A structural change requires an explicit revision proposal, impact review, approval, a new baseline version, and an entry in the documentation change log. Draft documents may evolve without changing this frozen tree, but their paths must remain stable.

## 2. Complete locked documentation tree

The canonical product name is **Performance Buddy OS**. New documentation must use this name. Historical references may retain **Personal Performance OS** only when identifying the superseded Candidate v0.1 baseline or quoting historical material.

Every folder and file in the frozen baseline is listed below. This manifest is authoritative; omitted files must not be inferred and listed files must not be silently renamed.

```text
Performance-Buddy-OS/
│
├── README.md
├── PERFORMANCE-BUDDY-OS-BLUEPRINT.md
│
├── 00 - Control & Source of Truth/
│   ├── README.md
│   ├── 00.01 - Documentation Map.md
│   ├── 00.02 - Source of Truth Rules.md
│   ├── 00.03 - Documentation Standard.md
│   ├── 00.04 - Document Metadata Standard.md
│   ├── 00.05 - Capability & Version Labels.md
│   ├── 00.06 - Source Classification & Authority.md
│   ├── 00.07 - Product Glossary.md
│   ├── 00.08 - Naming & Terminology Rules.md
│   ├── 00.09 - Decision Log.md
│   ├── 00.10 - Assumptions Register.md
│   ├── 00.11 - Open Questions Register.md
│   ├── 00.12 - Risks Register.md
│   ├── 00.13 - Dependencies Register.md
│   ├── 00.14 - Non-Goals Register.md
│   ├── 00.15 - Documentation Change Log.md
│   ├── 00.16 - Documentation Freeze & Revision Policy.md
│   ├── 00.17 - Architecture Drift Prevention.md
│   ├── 00.18 - Cross-Document Conflict Resolution.md
│   └── 00.19 - AI Coding Agent Reading Order.md
│
├── 01 - Product Foundation/
│   ├── README.md
│   ├── 01.01 - Product Vision.md
│   ├── 01.02 - Product Definition.md
│   ├── 01.03 - Why This Product Exists.md
│   ├── 01.04 - Core Product Principles.md
│   ├── 01.05 - Single Most Important Product Idea.md
│   ├── 01.06 - Target User & Personal-First Strategy.md
│   ├── 01.07 - Jobs To Be Done.md
│   ├── 01.08 - Target User Experience.md
│   ├── 01.09 - Product Success Criteria.md
│   ├── 01.10 - What the Product Is Not.md
│   ├── 01.11 - Product Boundaries.md
│   ├── 01.12 - Long-Term Product Direction.md
│   ├── 01.13 - Portfolio & Learning Objectives.md
│   └── 01.14 - Product Naming Status.md
│
├── 02 - Capability & Version Architecture/
│   ├── README.md
│   ├── 02.01 - Capability Registry.md
│   ├── 02.02 - Version Ownership Matrix.md
│   ├── 02.03 - Surface Ownership Matrix.md
│   ├── 02.04 - Offline vs Cloud Capability Matrix.md
│   ├── 02.05 - Intelligence Level Matrix.md
│   ├── 02.06 - CORE - Deterministic Core.md
│   ├── 02.07 - LOCAL - Local Intelligence.md
│   ├── 02.08 - V1 - Smart Assistant.md
│   ├── 02.09 - V2 - Adaptive Coach.md
│   ├── 02.10 - V3 - Personal Performance Intelligence.md
│   ├── 02.11 - CLOUD - Optional Cloud Capabilities.md
│   ├── 02.12 - MOBILE - Companion Capabilities.md
│   ├── 02.13 - FUTURE - Deferred Capabilities.md
│   ├── 02.14 - Capability Promotion Rules.md
│   └── 02.15 - Backward Compatibility Strategy.md
│
├── 03 - Personal Operating Model/
│   ├── README.md
│   ├── 03.01 - Personal Performance Philosophy.md
│   ├── 03.02 - Priority Hierarchy.md
│   ├── 03.03 - Academic Objectives.md
│   ├── 03.04 - Development Objectives.md
│   ├── 03.05 - Fitness & Endurance Objectives.md
│   ├── 03.06 - Sleep & Recovery Boundaries.md
│   ├── 03.07 - Spiritual & Routine Objectives.md
│   ├── 03.08 - Secondary Skills Strategy.md
│   ├── 03.09 - Consistency Over Perfection.md
│   ├── 03.10 - Independence in Self-Study.md
│   └── 03.11 - Personal Configuration vs Product Logic.md
│
├── 04 - Domain Architecture/
│   ├── README.md
│   ├── 04.01 - Domain Map.md
│   ├── 04.02 - Domain Ownership Rules.md
│   ├── 04.03 - Cross-Domain Interaction Map.md
│   ├── 04.04 - Performance Domain.md
│   ├── 04.05 - Academic Domain.md
│   ├── 04.06 - Knowledge Domain.md
│   ├── 04.07 - Development Domain.md
│   ├── 04.08 - Fitness & Recovery Domain.md
│   ├── 04.09 - Routine & Spiritual Domain.md
│   ├── 04.10 - Money Domain.md
│   ├── 04.11 - Analytics Domain.md
│   ├── 04.12 - Intelligence Domain.md
│   └── 04.13 - Platform Domain.md
│
├── 05 - Information Architecture & Navigation/
│   ├── README.md
│   ├── 05.01 - Application Information Architecture.md
│   ├── 05.02 - Desktop Navigation Model.md
│   ├── 05.03 - Mobile Navigation Model.md
│   ├── 05.04 - Command Center Structure.md
│   ├── 05.05 - Global Search Architecture.md
│   ├── 05.06 - Command Palette Architecture.md
│   ├── 05.07 - Contextual Navigation.md
│   ├── 05.08 - Entity Detail Pattern.md
│   ├── 05.09 - Dashboard Philosophy.md
│   └── 05.10 - Progressive Disclosure Rules.md
│
├── 06 - UX & Interaction Architecture/
│   ├── README.md
│   ├── 06.01 - UX Principles.md
│   ├── 06.02 - Calm Intelligence Principle.md
│   ├── 06.03 - Human Control Principle.md
│   ├── 06.04 - Explainability UX.md
│   ├── 06.05 - Desktop Interaction Model.md
│   ├── 06.06 - Mobile Capture Interaction Model.md
│   ├── 06.07 - Fluid UI & Motion Principles.md
│   ├── 06.08 - Loading Empty Error States.md
│   ├── 06.09 - Confirmation & Approval Patterns.md
│   ├── 06.10 - Undo & Recovery Patterns.md
│   ├── 06.11 - Notification & Interruption Principles.md
│   ├── 06.12 - Accessibility Requirements.md
│   ├── 06.13 - Keyboard-First UX.md
│   ├── 06.14 - Large Monitor Experience.md
│   ├── 06.15 - Companion Interaction Model.md
│   └── 06.16 - Proactive Interruption & Break Interaction.md
│
├── 07 - Visual & Design System/
│   ├── README.md
│   ├── 07.01 - Visual Direction.md
│   ├── 07.02 - Design Principles.md
│   ├── 07.03 - Color System.md
│   ├── 07.04 - Typography System.md
│   ├── 07.05 - Spacing & Layout System.md
│   ├── 07.06 - Grid System.md
│   ├── 07.07 - Surface & Depth System.md
│   ├── 07.08 - Borders Dividers & Elevation.md
│   ├── 07.09 - Iconography.md
│   ├── 07.10 - Data Visualization Style.md
│   ├── 07.11 - Motion System.md
│   ├── 07.12 - Focus Mode Visual Language.md
│   ├── 07.13 - Desktop Design Patterns.md
│   ├── 07.14 - Mobile Design Patterns.md
│   ├── 07.15 - Component Taxonomy.md
│   ├── 07.16 - Design Tokens.md
│   ├── 07.17 - Design Acceptance Criteria.md
│   └── 07.18 - Companion Avatar & Persona Visual System.md
│
├── 08 - Today & Adaptive Planning/
│   ├── README.md
│   ├── 08.01 - Today Experience.md
│   ├── 08.02 - Day Lifecycle.md
│   ├── 08.03 - Daily Planning Model.md
│   ├── 08.04 - Living Plan Principle.md
│   ├── 08.05 - Plan vs Reality Reconciliation.md
│   ├── 08.06 - Adaptive Recalculation Engine.md
│   ├── 08.07 - Evidence-Based Completion.md
│   ├── 08.08 - Priority Calculation Concepts.md
│   ├── 08.09 - Schedule Constraints.md
│   ├── 08.10 - Fixed vs Flexible Commitments.md
│   ├── 08.11 - Normal Semester Mode.md
│   ├── 08.12 - Midterm Mode.md
│   ├── 08.13 - Terminal Mode.md
│   ├── 08.14 - Weekend Mode.md
│   ├── 08.15 - Recovery Mode.md
│   ├── 08.16 - University Day Reconciliation.md
│   ├── 08.17 - Evening Replanning.md
│   ├── 08.18 - Day Closure.md
│   └── 08.19 - Plan Change Explainability.md
│
├── 09 - Focus & Session Execution/
│   ├── README.md
│   ├── 09.01 - Focus Mode Overview.md
│   ├── 09.02 - Session Lifecycle.md
│   ├── 09.03 - Session Types.md
│   ├── 09.04 - Timers & Pauses.md
│   ├── 09.05 - Session Notes.md
│   ├── 09.06 - Planned vs Unplanned Sessions.md
│   ├── 09.07 - University Study Sessions.md
│   ├── 09.08 - Development Sessions.md
│   ├── 09.09 - Fitness Sessions.md
│   ├── 09.10 - Session Completion Evidence.md
│   ├── 09.11 - Interruption Handling.md
│   └── 09.12 - AI-Off Practice Mode.md
│
├── 10 - Tracker & Routine Engine/
│   ├── README.md
│   ├── 10.01 - Tracker Engine Overview.md
│   ├── 10.02 - Boolean Trackers.md
│   ├── 10.03 - Count Trackers.md
│   ├── 10.04 - Duration Trackers.md
│   ├── 10.05 - Numeric Target Trackers.md
│   ├── 10.06 - Multi-Check Trackers.md
│   ├── 10.07 - Milestone Trackers.md
│   ├── 10.08 - Reflection Trackers.md
│   ├── 10.09 - Recurrence & Scheduling.md
│   ├── 10.10 - Completion States.md
│   ├── 10.11 - Rest & Excused States.md
│   ├── 10.12 - Partial Completion.md
│   ├── 10.13 - Consistency Metrics.md
│   ├── 10.14 - Streak Policy.md
│   └── 10.15 - Tracker Customization.md
│
├── 11 - Goals Systems & Paths/
│   ├── README.md
│   ├── 11.01 - Goal System Action Model.md
│   ├── 11.02 - Goal Types.md
│   ├── 11.03 - Systems.md
│   ├── 11.04 - Actions.md
│   ├── 11.05 - Milestones.md
│   ├── 11.06 - Goal Progress Evidence.md
│   ├── 11.07 - Goal Priority.md
│   ├── 11.08 - Conflicting Goals.md
│   ├── 11.09 - Goal Review Lifecycle.md
│   ├── 11.10 - Learning Paths.md
│   └── 11.11 - Long-Term Progress Visualization.md
│
├── 12 - Academic OS/
│   ├── README.md
│   ├── 12.01 - Academic OS Overview.md
│   ├── 12.02 - University & Program Model.md
│   ├── 12.03 - Curriculum Versioning.md
│   ├── 12.04 - Eight-Semester Degree Model.md
│   ├── 12.05 - Semester Model.md
│   ├── 12.06 - Course Model.md
│   ├── 12.07 - Credit Hours.md
│   ├── 12.08 - Course Attempts.md
│   ├── 12.09 - Passed Failed Repeated Courses.md
│   ├── 12.10 - Prerequisite Graph.md
│   ├── 12.11 - Prerequisite Risk Analysis.md
│   ├── 12.12 - Current Enrollment.md
│   ├── 12.13 - Course Status Lifecycle.md
│   ├── 12.14 - Curriculum Import Strategy.md
│   ├── 12.15 - Official CUI Source Handling.md
│   ├── 12.16 - Personal Academic Record Import.md
│   └── 12.17 - Academic Dashboard.md
│
├── 13 - Assessment Grades & CGPA/
│   ├── README.md
│   ├── 13.01 - Assessment Engine Overview.md
│   ├── 13.02 - Assessment Categories.md
│   ├── 13.03 - CUI Default Assessment Templates.md
│   ├── 13.04 - Course-Level Assessment Overrides.md
│   ├── 13.05 - Theory Course Assessments.md
│   ├── 13.06 - Lab Course Assessments.md
│   ├── 13.07 - Marks Entry.md
│   ├── 13.08 - Weighted Score Calculation.md
│   ├── 13.09 - Grade Policy Model.md
│   ├── 13.10 - Grade Replacement Model.md
│   ├── 13.11 - Semester GPA Engine.md
│   ├── 13.12 - CGPA Engine.md
│   ├── 13.13 - Grade Projection Engine.md
│   ├── 13.14 - Target Grade Scenarios.md
│   ├── 13.15 - Graduation CGPA Projection.md
│   ├── 13.16 - Formula Explainability.md
│   ├── 13.17 - Academic Calculation Validation.md
│   └── 13.18 - Score Sheet Migration Reference.md
│
├── 14 - Academic Planning & Study Intelligence/
│   ├── README.md
│   ├── 14.01 - Academic Planning Overview.md
│   ├── 14.02 - Course Difficulty Heuristics.md
│   ├── 14.03 - Academic Risk Model.md
│   ├── 14.04 - Study Allocation Model.md
│   ├── 14.05 - Marginal Academic Return.md
│   ├── 14.06 - Study Modes.md
│   ├── 14.07 - Topic Coverage Tracking.md
│   ├── 14.08 - Class Exposure Evidence.md
│   ├── 14.09 - Study Session Evidence.md
│   ├── 14.10 - Assessment Evidence.md
│   ├── 14.11 - Study Requirement Recalculation.md
│   ├── 14.12 - Exam Ramp-Up Strategy.md
│   ├── 14.13 - Midterm Preparation Logic.md
│   ├── 14.14 - Terminal Preparation Logic.md
│   └── 14.15 - University Mode.md
│
├── 15 - Knowledge OS/
│   ├── README.md
│   ├── 15.01 - Knowledge OS Overview.md
│   ├── 15.02 - Knowledge Entity Model.md
│   ├── 15.03 - Topics & Subtopics.md
│   ├── 15.04 - Knowledge Sources.md
│   ├── 15.05 - Notes References.md
│   ├── 15.06 - Lecture Materials.md
│   ├── 15.07 - Assignments & Quizzes as Knowledge Evidence.md
│   ├── 15.08 - Learning Evidence Model.md
│   ├── 15.09 - Knowledge Confidence.md
│   ├── 15.10 - Evidence Weighting.md
│   ├── 15.11 - Knowledge Confidence Explainability.md
│   ├── 15.12 - Knowledge Search.md
│   ├── 15.13 - Knowledge Retrieval.md
│   └── 15.14 - Knowledge Graph Possibilities.md
│
├── 16 - Obsidian Integration/
│   ├── README.md
│   ├── 16.01 - Obsidian Integration Overview.md
│   ├── 16.02 - Vault Selection.md
│   ├── 16.03 - Recommended Vault Structure.md
│   ├── 16.04 - Filesystem Access.md
│   ├── 16.05 - Markdown Indexing.md
│   ├── 16.06 - Metadata & Frontmatter Mapping.md
│   ├── 16.07 - Course-to-Note Linking.md
│   ├── 16.08 - Attachment Handling.md
│   ├── 16.09 - Local Search Index.md
│   ├── 16.10 - Embedding Index Strategy.md
│   ├── 16.11 - Incremental Reindexing.md
│   ├── 16.12 - File Change Detection.md
│   ├── 16.13 - Vault Permission Boundaries.md
│   └── 16.14 - Obsidian Failure & Recovery.md
│
├── 17 - Adaptive Testing & Past Papers/
│   ├── README.md
│   ├── 17.01 - Adaptive Testing Overview.md
│   ├── 17.02 - Test Generation.md
│   ├── 17.03 - Question Types.md
│   ├── 17.04 - Difficulty Selection.md
│   ├── 17.05 - Source-Grounded Testing.md
│   ├── 17.06 - Test Attempts.md
│   ├── 17.07 - Scoring.md
│   ├── 17.08 - Mistake Analysis.md
│   ├── 17.09 - Weakness Detection.md
│   ├── 17.10 - Knowledge Feedback Loop.md
│   ├── 17.11 - Past Paper Storage.md
│   ├── 17.12 - Past Paper Extraction.md
│   ├── 17.13 - Past Paper Frequency Analysis.md
│   ├── 17.14 - Source vs Inference Boundaries.md
│   └── 17.15 - Revision Priority Generation.md
│
├── 18 - Development OS/
│   ├── README.md
│   ├── 18.01 - Development OS Overview.md
│   ├── 18.02 - Chained Learning Philosophy.md
│   ├── 18.03 - Learning Path Model.md
│   ├── 18.04 - Sessions & Modules.md
│   ├── 18.05 - Learn Practice Build Cycle.md
│   ├── 18.06 - Development Notes.md
│   ├── 18.07 - Project Milestones.md
│   ├── 18.08 - Skill Evidence.md
│   ├── 18.09 - AI-Assisted Coding Policy.md
│   ├── 18.10 - AI-Off Practice.md
│   ├── 18.11 - Debugging Practice.md
│   ├── 18.12 - Architecture Practice.md
│   ├── 18.13 - Development Load Management.md
│   └── 18.14 - Development vs Academic Priority.md
│
├── 19 - Fitness & Recovery/
│   ├── README.md
│   ├── 19.01 - Fitness Domain Overview.md
│   ├── 19.02 - Running.md
│   ├── 19.03 - Strength.md
│   ├── 19.04 - Calisthenics.md
│   ├── 19.05 - Explosive Training.md
│   ├── 19.06 - Mobility.md
│   ├── 19.07 - Stretching.md
│   ├── 19.08 - Wrist Forearm & Hand Training.md
│   ├── 19.09 - Recovery Sessions.md
│   ├── 19.10 - Rest Days.md
│   ├── 19.11 - Training Load Representation.md
│   ├── 19.12 - Progressive Improvement.md
│   ├── 19.13 - Sleep Integration.md
│   ├── 19.14 - Recovery Signals.md
│   ├── 19.15 - Fitness Evidence.md
│   └── 19.16 - Health & Safety Boundaries.md
│
├── 20 - Spiritual & Personal Routines/
│   ├── README.md
│   ├── 20.01 - Routine Domain Overview.md
│   ├── 20.02 - Prayer Tracking.md
│   ├── 20.03 - Multi-Check Prayer Model.md
│   ├── 20.04 - Hydration.md
│   ├── 20.05 - Nutrition Habits.md
│   ├── 20.06 - Skincare.md
│   ├── 20.07 - Smoking Avoidance.md
│   ├── 20.08 - Reading.md
│   ├── 20.09 - Language Learning.md
│   ├── 20.10 - Daily Reflection.md
│   ├── 20.11 - Routine Priority & Flexibility.md
│   └── 20.12 - Private Routine Data Handling.md
│
├── 21 - Money Tracker/
│   ├── README.md
│   ├── 21.01 - Money Tracker Scope.md
│   ├── 21.02 - Money Tracker Non-Goals.md
│   ├── 21.03 - Income.md
│   ├── 21.04 - Expenses.md
│   ├── 21.05 - Categories.md
│   ├── 21.06 - Balance.md
│   ├── 21.07 - Savings.md
│   ├── 21.08 - Savings Goals.md
│   ├── 21.09 - Recurring Expenses.md
│   ├── 21.10 - Weekly Spending Review.md
│   ├── 21.11 - Monthly Spending Review.md
│   ├── 21.12 - Money AI Suggestions.md
│   ├── 21.13 - Leisure Spending Philosophy.md
│   ├── 21.14 - Financial Advice Boundaries.md
│   └── 21.15 - Separation From Performance Score.md
│
├── 22 - Analytics Reviews & Insights/
│   ├── README.md
│   ├── 22.01 - Analytics Philosophy.md
│   ├── 22.02 - Metrics Taxonomy.md
│   ├── 22.03 - Daily Analytics.md
│   ├── 22.04 - Weekly Review.md
│   ├── 22.05 - Monthly Review.md
│   ├── 22.06 - Semester Review.md
│   ├── 22.07 - Academic Analytics.md
│   ├── 22.08 - Knowledge Analytics.md
│   ├── 22.09 - Development Analytics.md
│   ├── 22.10 - Fitness Analytics.md
│   ├── 22.11 - Routine Analytics.md
│   ├── 22.12 - Money Analytics.md
│   ├── 22.13 - Cross-Domain Analytics.md
│   ├── 22.14 - Trend Analysis.md
│   ├── 22.15 - Friction Analysis.md
│   ├── 22.16 - Risk Signals.md
│   ├── 22.17 - Time Allocation Analysis.md
│   └── 22.18 - Performance Review Language.md
│
├── 23 - Deterministic Rules & Decision Engine/
│   ├── README.md
│   ├── 23.01 - Rules Engine Overview.md
│   ├── 23.02 - Deterministic vs Probabilistic Logic.md
│   ├── 23.03 - Rule Priority.md
│   ├── 23.04 - Protected Constraints.md
│   ├── 23.05 - Sleep Protection Rules.md
│   ├── 23.06 - Fixed Commitment Rules.md
│   ├── 23.07 - Academic Calculation Rules.md
│   ├── 23.08 - Scheduling Rules.md
│   ├── 23.09 - Budget Rules.md
│   ├── 23.10 - Validation Pipeline.md
│   ├── 23.11 - Recommendation Validation.md
│   ├── 23.12 - Rule Conflicts.md
│   ├── 23.13 - User Overrides.md
│   ├── 23.14 - Reason Codes.md
│   └── 23.15 - Rule Versioning.md
│
├── 24 - AI Foundations/
│   ├── README.md
│   ├── 24.01 - AI Architecture Overview.md
│   ├── 24.02 - AI Application Model.md
│   ├── 24.03 - Model Context Data Tools Memory Rules.md
│   ├── 24.04 - AI Capability Boundaries.md
│   ├── 24.05 - Structured Outputs.md
│   ├── 24.06 - Tool Calling.md
│   ├── 24.07 - Prompt Architecture.md
│   ├── 24.08 - Prompt Versioning.md
│   ├── 24.09 - Retrieval Architecture.md
│   ├── 24.10 - AI Memory Architecture.md
│   ├── 24.11 - AI Run Lifecycle.md
│   ├── 24.12 - Provider Abstraction.md
│   ├── 24.13 - Provider Failure Handling.md
│   ├── 24.14 - Token & Cost Awareness.md
│   ├── 24.15 - Rate Limit Awareness.md
│   ├── 24.16 - AI Scheduling & Background Runs.md
│   ├── 24.17 - AI Feature Evaluation Gates.md
│   ├── 24.18 - Agent Identity vs Model Provider.md
│   ├── 24.19 - Multi-Provider AI Architecture.md
│   └── 24.20 - Agent Memory & Continuity.md
│
├── 25 - Local AI/
│   ├── README.md
│   ├── 25.01 - Local AI Overview.md
│   ├── 25.02 - Local AI Responsibilities.md
│   ├── 25.03 - Local vs Cloud Decision Boundary.md
│   ├── 25.04 - Local Model Evaluation Criteria.md
│   ├── 25.05 - Hardware Constraints.md
│   ├── 25.06 - Local Inference Runtime Options.md
│   ├── 25.07 - Command Parsing.md
│   ├── 25.08 - Classification.md
│   ├── 25.09 - Extraction.md
│   ├── 25.10 - Local Knowledge Retrieval.md
│   ├── 25.11 - Structured Output Reliability.md
│   ├── 25.12 - Local Model Benchmark Plan.md
│   └── 25.13 - Local AI Fallbacks.md
│
├── 26 - V1 Smart Assistant/
│   ├── README.md
│   ├── 26.01 - V1 Scope.md
│   ├── 26.02 - V1 Non-Goals.md
│   ├── 26.03 - Natural Language Commands.md
│   ├── 26.04 - Intent Interpretation.md
│   ├── 26.05 - Read Operations.md
│   ├── 26.06 - Proposed Write Operations.md
│   ├── 26.07 - Human Approval Workflow.md
│   ├── 26.08 - Habit & Plan Modification.md
│   ├── 26.09 - Academic Assistance.md
│   ├── 26.10 - Explanation & Tutoring.md
│   ├── 26.11 - Test Generation.md
│   ├── 26.12 - Schedule Change Proposals.md
│   └── 26.13 - V1 Acceptance Criteria.md
│
├── 27 - V2 Adaptive Coach/
│   ├── README.md
│   ├── 27.01 - V2 Scope.md
│   ├── 27.02 - V2 Historical Analysis.md
│   ├── 27.03 - Analysis Windows.md
│   ├── 27.04 - Pattern Detection.md
│   ├── 27.05 - Cross-Domain Correlation.md
│   ├── 27.06 - Behavioral Friction Detection.md
│   ├── 27.07 - Study Effectiveness Analysis.md
│   ├── 27.08 - Workload Analysis.md
│   ├── 27.09 - Predictive Risk Signals.md
│   ├── 27.10 - Adaptive Schedule Proposals.md
│   ├── 27.11 - Recommendation Memory.md
│   ├── 27.12 - Recommendation Outcome Analysis.md
│   ├── 27.13 - Scheduled Analysis Runs.md
│   └── 27.14 - V2 Acceptance Criteria.md
│
├── 28 - V3 Personal Performance Intelligence/
│   ├── README.md
│   ├── 28.01 - V3 Vision.md
│   ├── 28.02 - V3 Scope.md
│   ├── 28.03 - V3 Non-Goals.md
│   ├── 28.04 - Highest-Value Next Action.md
│   ├── 28.05 - Cross-Domain Planning.md
│   ├── 28.06 - Academic Reallocation.md
│   ├── 28.07 - Development Reallocation.md
│   ├── 28.08 - Recovery Reallocation.md
│   ├── 28.09 - Long-Horizon Reasoning.md
│   ├── 28.10 - Standard Reasoning Mode.md
│   ├── 28.11 - Deep Reasoning Mode.md
│   ├── 28.12 - Specialist Architecture.md
│   ├── 28.13 - Manager Synthesis.md
│   ├── 28.14 - V3 Recommendation Contract.md
│   ├── 28.15 - V3 Failure Modes.md
│   └── 28.16 - V3 Acceptance Criteria.md
│
├── 29 - Context Routing & Orchestration/
│   ├── README.md
│   ├── 29.01 - Intent Router.md
│   ├── 29.02 - Model Router.md
│   ├── 29.03 - Context Builder.md
│   ├── 29.04 - Shared Context State.md
│   ├── 29.05 - Context Schema.md
│   ├── 29.06 - Context Selection.md
│   ├── 29.07 - Context Compression.md
│   ├── 29.08 - Context Provenance.md
│   ├── 29.09 - Sequential Specialist Pipeline.md
│   ├── 29.10 - Native Orchestration.md
│   ├── 29.11 - Single-Call Reasoning.md
│   ├── 29.12 - Deep Specialist Activation Rules.md
│   ├── 29.13 - Orchestration State Machine.md
│   ├── 29.14 - Checkpoints & Resumability.md
│   ├── 29.15 - Framework Adoption Criteria.md
│   ├── 29.16 - LangGraph Evaluation Criteria.md
│   ├── 29.17 - Agent Registry.md
│   ├── 29.18 - Coach Team Architecture.md
│   ├── 29.19 - Agent-to-Agent Communication.md
│   ├── 29.20 - Head Coach & Consensus Resolution.md
│   ├── 29.21 - Hidden Specialist Pool.md
│   ├── 29.22 - Provider Assignment & Failover.md
│   └── 29.23 - Agent Council & Coach Room.md
│
├── 30 - AI Governance Permissions & Explainability/
│   ├── README.md
│   ├── 30.01 - AI Governance Charter.md
│   ├── 30.02 - AI Suggests Rules Validate Human Decides.md
│   ├── 30.03 - Human Approval Policy.md
│   ├── 30.04 - AI Write Permission Levels.md
│   ├── 30.05 - Per-Domain AI Permissions.md
│   ├── 30.06 - Local-Only Data.md
│   ├── 30.07 - Ask-Every-Time Data.md
│   ├── 30.08 - Never-AI Data.md
│   ├── 30.09 - Cloud AI Disclosure.md
│   ├── 30.10 - Recommendation Explainability.md
│   ├── 30.11 - Evidence Citation.md
│   ├── 30.12 - Confidence & Uncertainty.md
│   ├── 30.13 - Hallucination Boundaries.md
│   ├── 30.14 - Emotional Tone & Non-Manipulation.md
│   ├── 30.15 - Safety Boundaries.md
│   ├── 30.16 - Recommendation Audit Trail.md
│   ├── 30.17 - AI Governance Testing.md
│   ├── 30.18 - Inter-Agent Data Sharing Policy.md
│   ├── 30.19 - Agent Memory Access Scopes.md
│   └── 30.20 - Agent Autonomy & Communication Limits.md
│
├── 31 - External AI & Deep Work Handoffs/
│   ├── README.md
│   ├── 31.01 - External Intelligence Philosophy.md
│   ├── 31.02 - Control Plane Model.md
│   ├── 31.03 - External Tool Selection.md
│   ├── 31.04 - ChatGPT Handoff.md
│   ├── 31.05 - NotebookLM Handoff.md
│   ├── 31.06 - Gemini Handoff.md
│   ├── 31.07 - Claude Handoff.md
│   ├── 31.08 - Deep Study Packs.md
│   ├── 31.09 - Context Export Packages.md
│   ├── 31.10 - External Tool Permission Boundaries.md
│   ├── 31.11 - Manual Handoff Workflow.md
│   ├── 31.12 - API-Based Handoff Future.md
│   ├── 31.13 - Result Re-Import.md
│   ├── 31.14 - External Provider Pool.md
│   └── 31.15 - Provider Onboarding & Replacement.md
│
├── 32 - Data Architecture/
│   ├── README.md
│   ├── 32.01 - Data Architecture Overview.md
│   ├── 32.02 - Canonical Entity Model.md
│   ├── 32.03 - Entity Relationship Map.md
│   ├── 32.04 - IDs & Identity.md
│   ├── 32.05 - Goals Systems Actions Schema.md
│   ├── 32.06 - Plans & Plan Items Schema.md
│   ├── 32.07 - Sessions & Execution Logs Schema.md
│   ├── 32.08 - Tracker Schema.md
│   ├── 32.09 - Academic Schema.md
│   ├── 32.10 - Curriculum Schema.md
│   ├── 32.11 - Assessments & Marks Schema.md
│   ├── 32.12 - Knowledge Schema.md
│   ├── 32.13 - Learning Evidence Schema.md
│   ├── 32.14 - Development Schema.md
│   ├── 32.15 - Fitness Schema.md
│   ├── 32.16 - Routine Schema.md
│   ├── 32.17 - Money Schema.md
│   ├── 32.18 - AI Recommendation Schema.md
│   ├── 32.19 - AI Run Schema.md
│   ├── 32.20 - Approval & Rejection Schema.md
│   ├── 32.21 - Analytics Event Schema.md
│   ├── 32.22 - Source Provenance Schema.md
│   ├── 32.23 - Device & Sync Metadata.md
│   ├── 32.24 - Data Versioning.md
│   ├── 32.25 - Schema Migration Strategy.md
│   ├── 32.26 - Data Retention.md
│   ├── 32.27 - Soft Delete & Restoration.md
│   ├── 32.28 - Data Integrity Constraints.md
│   ├── 32.29 - Agent Profiles & Personas Schema.md
│   ├── 32.30 - Agent Memory Schema.md
│   ├── 32.31 - Agent Conversations & Council Schema.md
│   └── 32.32 - Provider & Model Configuration Schema.md
│
├── 33 - Offline-First Architecture/
│   ├── README.md
│   ├── 33.01 - Offline-First Principle.md
│   ├── 33.02 - Local Authority Model.md
│   ├── 33.03 - Local Database Requirements.md
│   ├── 33.04 - Local File Storage.md
│   ├── 33.05 - Offline Feature Matrix.md
│   ├── 33.06 - Local Scheduling.md
│   ├── 33.07 - Offline Search.md
│   ├── 33.08 - Offline AI.md
│   ├── 33.09 - Network Detection.md
│   ├── 33.10 - Offline Queue.md
│   ├── 33.11 - Recovery After Connectivity.md
│   └── 33.12 - Offline Failure Modes.md
│
├── 34 - Cloud Sync & Multi-Device/
│   ├── README.md
│   ├── 34.01 - Cloud Philosophy.md
│   ├── 34.02 - Optional Cloud Principle.md
│   ├── 34.03 - Sync Architecture Requirements.md
│   ├── 34.04 - Local vs Cloud Authority.md
│   ├── 34.05 - Sync State Model.md
│   ├── 34.06 - Change Tracking.md
│   ├── 34.07 - Conflict Detection.md
│   ├── 34.08 - Conflict Resolution.md
│   ├── 34.09 - Offline Edit Reconciliation.md
│   ├── 34.10 - Device Registration.md
│   ├── 34.11 - Encrypted Sync.md
│   ├── 34.12 - Sync Failure Handling.md
│   ├── 34.13 - Backup vs Sync.md
│   └── 34.14 - Cloud Provider Evaluation.md
│
├── 35 - Desktop Platform/
│   ├── README.md
│   ├── 35.01 - Desktop Command Center.md
│   ├── 35.02 - Desktop Responsibilities.md
│   ├── 35.03 - Desktop Architecture Requirements.md
│   ├── 35.04 - Desktop Framework Evaluation.md
│   ├── 35.05 - Electron Evaluation.md
│   ├── 35.06 - Tauri Evaluation.md
│   ├── 35.07 - Filesystem Integration.md
│   ├── 35.08 - Local Database Integration.md
│   ├── 35.09 - Local AI Integration.md
│   ├── 35.10 - Window Management.md
│   ├── 35.11 - Background Processes.md
│   ├── 35.12 - System Tray & Quick Capture.md
│   ├── 35.13 - Notifications.md
│   ├── 35.14 - Keyboard Shortcuts.md
│   └── 35.15 - Desktop Packaging Requirements.md
│
├── 36 - Mobile Platform/
│   ├── README.md
│   ├── 36.01 - Mobile Companion Vision.md
│   ├── 36.02 - Mobile Responsibilities.md
│   ├── 36.03 - Capture Device Principle.md
│   ├── 36.04 - University Mode.md
│   ├── 36.05 - Quick Study Session.md
│   ├── 36.06 - Lecture Logging.md
│   ├── 36.07 - Marks Capture.md
│   ├── 36.08 - Assignment & Deadline Capture.md
│   ├── 36.09 - Routine Quick Capture.md
│   ├── 36.10 - Expense Quick Capture.md
│   ├── 36.11 - Quick Test.md
│   ├── 36.12 - Mobile Offline Requirements.md
│   ├── 36.13 - Mobile Sync.md
│   └── 36.14 - Mobile Framework Evaluation.md
│
├── 37 - Integrations APIs & Services/
│   ├── README.md
│   ├── 37.01 - Integration Architecture.md
│   ├── 37.02 - Integration Permission Model.md
│   ├── 37.03 - Calendar Integration.md
│   ├── 37.04 - File System Integration.md
│   ├── 37.05 - Obsidian Integration Contract.md
│   ├── 37.06 - AI Provider Interface.md
│   ├── 37.07 - Embedding Provider Interface.md
│   ├── 37.08 - Cloud Sync Interface.md
│   ├── 37.09 - Import Export Interface.md
│   ├── 37.10 - Internal API Contracts.md
│   ├── 37.11 - Events & Domain Events.md
│   ├── 37.12 - Background Jobs.md
│   └── 37.13 - Future Integration Registry.md
│
├── 38 - Security & Privacy/
│   ├── README.md
│   ├── 38.01 - Security Philosophy.md
│   ├── 38.02 - Threat Model.md
│   ├── 38.03 - Local Data Security.md
│   ├── 38.04 - Database Encryption.md
│   ├── 38.05 - File Encryption.md
│   ├── 38.06 - Secrets Management.md
│   ├── 38.07 - AI Provider Data Exposure.md
│   ├── 38.08 - Data Permission Zones.md
│   ├── 38.09 - Cloud Security.md
│   ├── 38.10 - Authentication Future.md
│   ├── 38.11 - Device Security.md
│   ├── 38.12 - Logging Privacy.md
│   ├── 38.13 - Sensitive Data Redaction.md
│   ├── 38.14 - Security Incident Recovery.md
│   └── 38.15 - Security Review Checklist.md
│
├── 39 - Backup Export Import & Recovery/
│   ├── README.md
│   ├── 39.01 - Backup Strategy.md
│   ├── 39.02 - Automatic Local Backups.md
│   ├── 39.03 - Manual Backup.md
│   ├── 39.04 - Backup Encryption.md
│   ├── 39.05 - Restore Process.md
│   ├── 39.06 - Data Export.md
│   ├── 39.07 - Data Import.md
│   ├── 39.08 - Academic Data Import.md
│   ├── 39.09 - Score Sheet Import.md
│   ├── 39.10 - Corrupt Database Recovery.md
│   ├── 39.11 - Disaster Recovery.md
│   └── 39.12 - Portability Requirements.md
│
├── 40 - Testing QA & AI Evaluation/
│   ├── README.md
│   ├── 40.01 - Quality Strategy.md
│   ├── 40.02 - Unit Testing.md
│   ├── 40.03 - Integration Testing.md
│   ├── 40.04 - End-to-End Testing.md
│   ├── 40.05 - Offline Testing.md
│   ├── 40.06 - Sync Testing.md
│   ├── 40.07 - Academic Calculation Tests.md
│   ├── 40.08 - Curriculum & Prerequisite Tests.md
│   ├── 40.09 - Adaptive Planning Tests.md
│   ├── 40.10 - Rules Engine Tests.md
│   ├── 40.11 - AI Structured Output Tests.md
│   ├── 40.12 - AI Recommendation Evaluation.md
│   ├── 40.13 - Hallucination Tests.md
│   ├── 40.14 - Retrieval Evaluation.md
│   ├── 40.15 - Recommendation Safety Tests.md
│   ├── 40.16 - Model Comparison Benchmarks.md
│   ├── 40.17 - UX Acceptance Tests.md
│   ├── 40.18 - Performance Tests.md
│   ├── 40.19 - Regression Test Matrix.md
│   ├── 40.20 - Multi-Agent Coordination Tests.md
│   ├── 40.21 - Provider Failover Tests.md
│   └── 40.22 - Companion Consistency Tests.md
│
├── 41 - Performance Observability & Diagnostics/
│   ├── README.md
│   ├── 41.01 - Performance Requirements.md
│   ├── 41.02 - Desktop Performance Budgets.md
│   ├── 41.03 - Database Performance.md
│   ├── 41.04 - Search Performance.md
│   ├── 41.05 - Local AI Performance.md
│   ├── 41.06 - Cloud AI Latency.md
│   ├── 41.07 - Sync Performance.md
│   ├── 41.08 - Resource Usage.md
│   ├── 41.09 - Local Logging.md
│   ├── 41.10 - AI Run Tracing.md
│   ├── 41.11 - Error Diagnostics.md
│   ├── 41.12 - Privacy-Safe Telemetry.md
│   └── 41.13 - Performance Regression Policy.md
│
├── 42 - Release Deployment & Updates/
│   ├── README.md
│   ├── 42.01 - Release Strategy.md
│   ├── 42.02 - Versioning Strategy.md
│   ├── 42.03 - Release Channels.md
│   ├── 42.04 - Desktop Packaging.md
│   ├── 42.05 - Application Updates.md
│   ├── 42.06 - Database Migration During Updates.md
│   ├── 42.07 - Rollback Strategy.md
│   ├── 42.08 - Data Compatibility.md
│   ├── 42.09 - Mobile Release Future.md
│   └── 42.10 - Release Acceptance Checklist.md
│
├── 43 - Roadmap & Build Phases/
│   ├── README.md
│   ├── 43.01 - Master Roadmap.md
│   ├── 43.02 - Scope Control.md
│   ├── 43.03 - 30-60 Hour Initial Build Strategy.md
│   ├── 43.04 - Prototype Definition.md
│   ├── 43.05 - CORE Build Phase.md
│   ├── 43.06 - Local AI Phase.md
│   ├── 43.07 - V1 Build Phase.md
│   ├── 43.08 - V2 Build Phase.md
│   ├── 43.09 - V3 Build Phase.md
│   ├── 43.10 - Cloud Phase.md
│   ├── 43.11 - Mobile Phase.md
│   ├── 43.12 - Feature Dependency Graph.md
│   ├── 43.13 - Definition of Ready.md
│   ├── 43.14 - Definition of Done.md
│   └── 43.15 - Deferred Features.md
│
├── 44 - Technical Research & Architecture Decisions/
│   ├── README.md
│   ├── 44.01 - Research Method.md
│   ├── 44.02 - Architecture Decision Record Template.md
│   ├── 44.03 - Desktop Framework Research.md
│   ├── 44.04 - Frontend Stack Research.md
│   ├── 44.05 - Local Database Research.md
│   ├── 44.06 - Mobile Framework Research.md
│   ├── 44.07 - Cloud Provider Research.md
│   ├── 44.08 - Sync Architecture Research.md
│   ├── 44.09 - Local Model Research.md
│   ├── 44.10 - Cloud Model Provider Research.md
│   ├── 44.11 - Embedding Model Research.md
│   ├── 44.12 - Vector Search Research.md
│   ├── 44.13 - AI SDK Research.md
│   ├── 44.14 - Orchestration Framework Research.md
│   ├── 44.15 - UI Library Research.md
│   ├── 44.16 - Charting Library Research.md
│   ├── 44.17 - Encryption Research.md
│   ├── 44.18 - Provider Pricing & Quota Research.md
│   └── ADR/
│       └── README.md
│
├── 45 - AI-Assisted Engineering & Agent Guidance/
│   ├── README.md
│   ├── 45.01 - Engineering Principles.md
│   ├── 45.02 - Architecture Before Code.md
│   ├── 45.03 - AI Coding Responsibility Boundaries.md
│   ├── 45.04 - Code Understanding Requirements.md
│   ├── 45.05 - Claude Instructions.md
│   ├── 45.06 - Codex Instructions.md
│   ├── 45.07 - ChatGPT Instructions.md
│   ├── 45.08 - Gemini Instructions.md
│   ├── 45.09 - Repository Agent Rules.md
│   ├── 45.10 - Code Review Rules.md
│   ├── 45.11 - Security Engineering Rules.md
│   ├── 45.12 - Database Engineering Rules.md
│   ├── 45.13 - AI Feature Engineering Rules.md
│   ├── 45.14 - Documentation Update Requirement.md
│   ├── 45.15 - Architecture Drift Detection.md
│   └── 45.16 - Human Learning Checkpoints.md
│
├── 46 - Design References & Product Inputs/
│   ├── README.md
│   ├── 46.01 - Reference Governance.md
│   ├── 01 - Academic References/
│   │   ├── README.md
│   │   ├── CUI Curriculum/
│   │   ├── Academic Policies/
│   │   └── Personal Academic Records/
│   ├── 02 - Marks References/
│   │   └── SCORE SHEET.xlsx
│   ├── 03 - AI Architecture References/
│   │   ├── Gemini Architecture Report/
│   │   └── Other Research/
│   ├── 04 - UX References/
│   ├── 05 - Visual References/
│   ├── 06 - Generated Concepts/
│   └── 07 - Research Notes/
│
├── 47 - Future Distribution & Productization/
│   ├── README.md
│   ├── 47.01 - Personal-First Boundary.md
│   ├── 47.02 - Future Distribution Options.md
│   ├── 47.03 - Portfolio Presentation.md
│   ├── 47.04 - Single-User to Multi-User Risks.md
│   ├── 47.05 - Multi-User Architecture Future.md
│   ├── 47.06 - Account System Future.md
│   ├── 47.07 - Commercialization Non-Requirements.md
│   └── 47.08 - Migration Path If Productized.md
│
└── 99 - Archive/
    ├── README.md
    ├── 01 - Deprecated Decisions/
    ├── 02 - Rejected Architecture/
    ├── 03 - Rejected Features/
    ├── 04 - Rejected AI Concepts/
    ├── 05 - Old UX/
    ├── 06 - Old Design Concepts/
    ├── 07 - Superseded Documentation/
    ├── 08 - Historical Research/
    ├── 09 - Previous Roadmaps/
    └── 10 - Historical Reports/
```
## 3. Phase 20 — frozen v1.0 manifest

```text
20 - Spiritual & Personal Routines/
├── README.md
├── 20.01 - Routine Domain Overview.md
├── 20.02 - Prayer Tracking.md
├── 20.03 - Multi-Check Prayer Model.md
├── 20.04 - Hydration.md
├── 20.05 - Nutrition Habits.md
├── 20.06 - Skincare.md
├── 20.07 - Smoking Avoidance.md
├── 20.08 - Reading.md
├── 20.09 - Language Learning.md
├── 20.10 - Daily Reflection.md
├── 20.11 - Routine Priority & Flexibility.md
└── 20.12 - Private Routine Data Handling.md
```

For the v1.0 amendment, this replaced the Candidate v0.1 sequence in which reading and language learning shared `20.08 - Reading & Language Learning.md`. Reading remains at `20.08`, language learning has the dedicated `20.09` document, and the three subsequent documents shifted forward by one number. The later v1.1 additions are separately recorded in Section 9.

## 4. Language-learning scope

`20.09 - Language Learning.md` owns the personal routine and daily practice contract for language learning. Generic path mechanics remain supported by `11.10 - Learning Paths.md`; consistency and progress analysis remain supported by Phase 22; AI assistance and cross-domain adaptation remain supported by Phases 26–29.

### Purpose

The initial supported choices are **German** and **Italian**, with one language normally designated as the primary active language. The goal is functional, real-world communication for living or studying abroad—not grammar study for its own sake.

### Normal daily commitment

The normal target is **30–40 minutes per day**. A balanced session should include:

- vocabulary;
- listening;
- speaking or pronunciation practice;
- basic grammar and review.

A useful default is 10 minutes of vocabulary, 10 minutes of listening, 10 minutes of speaking, and 5–10 minutes of grammar or spaced review. This is a flexible template, not a rigid scoring requirement.

### Practical situations

The path should prioritize introductions, numbers, dates and time, food and shopping, asking prices, directions, public transport, accommodation, asking for help, emergencies, doctor and pharmacy basics, university situations, workplace situations, and everyday conversation. Progress should gradually move from an A1-style foundation toward useful A2/B1 communication where appropriate.

### Evidence and adaptation

The system may record practice time, completed sessions, vocabulary exposure, listening practice, speaking practice, review history, current level, and skill-area confidence. Time spent alone must not be treated as proof of communication ability.

The assistant may generate short conversations, role-play real situations, test recent vocabulary, identify neglected skill areas, and recommend the next session. Recommendations must remain explainable and must respect the user's protected constraints, academic load, development work, fitness, recovery, and other routines.

### Exam maintenance mode

During midterms, terminal/final examinations, or acute academic pressure, the language path enters **maintenance mode** instead of being marked as failed. The normal 30–40-minute session may be reduced to approximately **10–15 minutes** of light vocabulary, listening, or speaking review. Full progression resumes when examination pressure falls.

If German and Italian are both configured, the normal strategy is one primary progression language and one secondary maintenance/exposure language rather than aggressive simultaneous progression in both.

## 5. Version conventions

Documentation baseline versions use semantic labels:

- **v1.0** — first frozen and authoritative documentation baseline;
- **v1.x** — backward-compatible clarifications or approved additions that do not reorganize the tree;
- **v2.0+** — structural or breaking changes to phase ownership, paths, names, numbering, or authority.

Draft revisions must be marked `DRAFT` and are not authoritative until approved and frozen. A document's content revision must not be confused with the product capability level it describes.

## 6. Capability label conventions

Capability labels identify where a feature belongs; they are not document-version numbers.

| Label | Meaning |
|---|---|
| `CORE` | Deterministic, offline-first product behavior and rules |
| `LOCAL` | Intelligence executed locally on the user's device |
| `V1` | Smart Assistant: commands, explanations, tutoring, and proposed actions with human approval |
| `V2` | Adaptive Coach: historical analysis, pattern detection, risk signals, and adaptive proposals |
| `V3` | Personal Performance Intelligence: cross-domain, long-horizon reasoning and highest-value-next-action guidance |
| `CLOUD` | Optional services that require cloud infrastructure or remote providers |
| `MOBILE` | Companion capture, review, notification, and mobile-specific capabilities |
| `FUTURE` | Explicitly deferred ideas that are outside the committed implementation scope |

Use uppercase labels exactly as shown. When several labels apply, list them in increasing capability order, for example: `CORE → LOCAL → V1 → V2 → V3`. A later level may build on an earlier level but must not silently weaken deterministic validation, human control, privacy, or explainability.

## 7. Source authority and change control

The authority order is:

1. approved control and source-of-truth documents in Phase 00;
2. this locked blueprint for structural paths and names;
3. approved domain and architecture documents;
4. UX and design requirements;
5. implementation specifications and code;
6. reference images and other inspirational inputs.

If two documents conflict, the higher-authority source governs until the conflict is formally resolved. Reference images guide visual direction but do not override product requirements, UX rules, accessibility, reusable design-system decisions, or buildability.

A proposed baseline change must state the reason, affected paths, cross-document impact, migration requirements, compatibility impact, and proposed new baseline version. The approved v1.1 tree in this blueprint is authoritative.

## 8. Generation rule

Documentation should be generated phase by phase. Each generated phase must include its `README.md` plus every numbered file assigned to that phase, use the exact locked paths, follow Phase 00 authority and reading-order rules, and be reviewed for internal and cross-phase consistency before the next phase is accepted.

The addition of language learning does not create a new top-level phase. It is a personal routine backed by the shared learning-path, analytics, planning, and AI capability architecture.
## 9. Baseline change history

- **v1.1 — 2026-08-23:** Approved backward-compatible multi-agent and companion extension. Added 25 documents within existing Phases 06, 07, 24, 29, 30, 31, 32, and 40. No top-level phase, existing path, or ownership boundary was renamed or reorganized. The extension separates agent identity, model provider, and API credential; defines three persistent companions and hidden specialists; adds scoped inter-agent consultation, Head Coach synthesis, provider routing/failover, schemas, governance, and QA coverage.
