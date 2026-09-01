//! Performance Buddy OS — durable local persistence (SQLite via Rust).
//!
//! This is the Batch 0 persistence foundation. Architecture:
//!
//!   React / domain store
//!     -> persistence backend interface (TS)
//!     -> Tauri command boundary (this file's `#[tauri::command]` fns)
//!     -> Rust data-access (this module)
//!     -> SQLite (bundled, single file in the app data dir)
//!
//! TRANSITIONAL SCHEMA NOTE: Batch 0 deliberately keeps a single generic
//! `kv_store(key, value)` table that mirrors the domains' existing
//! `pbos:<domain>-<slice>` JSON blobs. This is the *justified transitional
//! reason* called out in the Batch 0 brief — canonical relational tables for
//! Goals/Systems/Actions/etc. are Batch 1+ work and must not be designed here.
//! The migration runner + schema versioning below is the seam that lets later
//! batches add real tables without touching domain code.

use std::fs;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

/// Bumped whenever a migration is added to `MIGRATIONS`.
const CURRENT_SCHEMA_VERSION: i64 = 10;

/// Ordered, forward-only migrations. `version` must be contiguous from 1.
const MIGRATIONS: &[(i64, &str)] = &[
    (
        1,
        r#"
    CREATE TABLE IF NOT EXISTS kv_store (
        key        TEXT PRIMARY KEY NOT NULL,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
    );
    "#,
    ),
    (
        2,
        // Batch 1 — canonical relational persistence for the Performance spine
        // (Goal -> System -> Action). ONE source of truth per relationship:
        //   goal <-> system  : the `goal_system_links` join table (many-to-many)
        //   system -> action : `actions.system_id` (the FK; NULL = direct commitment)
        // No reverse-collection columns anywhere. Derived state (health,
        // progress, attention) is NEVER stored — it is computed in the engine.
        r#"
    CREATE TABLE IF NOT EXISTS goals (
        id             TEXT PRIMARY KEY NOT NULL,
        title          TEXT NOT NULL,
        type           TEXT NOT NULL,
        domain         TEXT NOT NULL,
        lifecycle      TEXT NOT NULL,
        priority       TEXT NOT NULL,
        deadline       TEXT,
        metric_current REAL,
        metric_target  REAL,
        metric_unit    TEXT,
        detail         TEXT NOT NULL DEFAULT '',
        created_by     TEXT NOT NULL,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS systems (
        id          TEXT PRIMARY KEY NOT NULL,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        domain      TEXT NOT NULL,
        cadence     TEXT NOT NULL DEFAULT '',
        tags        TEXT NOT NULL DEFAULT '[]',
        starred     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
        id          TEXT PRIMARY KEY NOT NULL,
        system_id   TEXT REFERENCES systems(id) ON DELETE SET NULL,
        title       TEXT NOT NULL,
        context     TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL,
        est_minutes INTEGER,
        priority    TEXT NOT NULL,
        timing      TEXT NOT NULL DEFAULT '',
        position    INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goal_system_links (
        goal_id   TEXT NOT NULL REFERENCES goals(id)   ON DELETE CASCADE,
        system_id TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        PRIMARY KEY (goal_id, system_id)
    );

    CREATE INDEX IF NOT EXISTS idx_actions_system   ON actions(system_id);
    CREATE INDEX IF NOT EXISTS idx_links_system     ON goal_system_links(system_id);
    "#,
    ),
    (
        3,
        // Batch 2A — user-owned configuration CRUD for ACADEMICS + KNOWLEDGE.
        //
        // Relationship truth (one source each, no reverse-collection columns):
        //   semester -> course        : `academic_courses.semester_id` (FK; NULL = unassigned)
        //   course   -> topic         : `academic_topics.course_id` (FK; CASCADE)
        //   course   -> assessment    : `academic_assessments.course_id` (FK; CASCADE)
        //   course   -> attempt       : `academic_attempts.course_id` (FK; CASCADE)
        //   academic topic <-> knowledge concept : `academic_topics.knowledge_topic_id`
        //       (FK; NULL = not linked). This is the ONE cross-domain link — mastery
        //       for a linked academic topic is READ from the knowledge concept's
        //       evidence-derived confidence, never stored a second time here.
        //   knowledge topic -> source   : `knowledge_sources.topic_id` (FK; CASCADE)
        //   knowledge topic -> evidence : `knowledge_evidence.topic_id` (FK; CASCADE)
        //
        // NO score->letter thresholds and NO repeat/replacement policy are encoded
        // here (docs/13.09, 13.10 mark both RESEARCH REQUIRED). `final_grade` /
        // `target_grade` / `projected_grade` hold a user-entered letter or NULL.
        // Knowledge tables are created first so the academic->knowledge FK resolves.
        r#"
    CREATE TABLE IF NOT EXISTS knowledge_topics (
        id               TEXT PRIMARY KEY NOT NULL,
        title            TEXT NOT NULL,
        category         TEXT NOT NULL DEFAULT 'general',
        context          TEXT NOT NULL DEFAULT '',
        last_studied     TEXT,
        next_review_date TEXT,
        related_goal_id  TEXT,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_sources (
        id         TEXT PRIMARY KEY NOT NULL,
        topic_id   TEXT NOT NULL REFERENCES knowledge_topics(id) ON DELETE CASCADE,
        type       TEXT NOT NULL DEFAULT 'article',
        title      TEXT NOT NULL,
        reference  TEXT NOT NULL DEFAULT '',
        added_date TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_evidence (
        id         TEXT PRIMARY KEY NOT NULL,
        topic_id   TEXT NOT NULL REFERENCES knowledge_topics(id) ON DELETE CASCADE,
        type       TEXT NOT NULL DEFAULT 'recall',
        title      TEXT NOT NULL,
        score      REAL NOT NULL,
        max_score  REAL NOT NULL DEFAULT 10,
        date       TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_semesters (
        id         TEXT PRIMARY KEY NOT NULL,
        label      TEXT NOT NULL,
        position   INTEGER NOT NULL DEFAULT 0,
        is_current INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_courses (
        id              TEXT PRIMARY KEY NOT NULL,
        semester_id     TEXT REFERENCES academic_semesters(id) ON DELETE SET NULL,
        code            TEXT NOT NULL DEFAULT '',
        title           TEXT NOT NULL,
        credit_hours    REAL NOT NULL DEFAULT 3,
        professor_name  TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'on-track',
        target_grade    TEXT,
        projected_grade TEXT,
        archived        INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_topics (
        id                    TEXT PRIMARY KEY NOT NULL,
        course_id             TEXT NOT NULL REFERENCES academic_courses(id) ON DELETE CASCADE,
        title                 TEXT NOT NULL,
        position              INTEGER NOT NULL DEFAULT 0,
        professor_coverage    TEXT NOT NULL DEFAULT 'not-taught',
        personal_study_percent REAL NOT NULL DEFAULT 0,
        -- legacy self-assessment ONLY (migrated from the pre-2A seed model).
        -- Never edited in-app, never aggregated into a deterministic result,
        -- superseded by the linked knowledge concept's evidence when present.
        mastery_self_assessed REAL,
        knowledge_topic_id    TEXT REFERENCES knowledge_topics(id) ON DELETE SET NULL,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_assessments (
        id             TEXT PRIMARY KEY NOT NULL,
        course_id      TEXT NOT NULL REFERENCES academic_courses(id) ON DELETE CASCADE,
        category       TEXT NOT NULL DEFAULT 'quiz',
        title          TEXT NOT NULL,
        obtained_marks REAL,
        total_marks    REAL NOT NULL DEFAULT 100,
        weight_percent REAL NOT NULL DEFAULT 0,
        date           TEXT NOT NULL DEFAULT '',
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_attempts (
        id             TEXT PRIMARY KEY NOT NULL,
        course_id      TEXT NOT NULL REFERENCES academic_courses(id) ON DELETE CASCADE,
        attempt_number INTEGER NOT NULL DEFAULT 1,
        term           TEXT NOT NULL DEFAULT '',
        final_grade    TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_acad_courses_sem    ON academic_courses(semester_id);
    CREATE INDEX IF NOT EXISTS idx_acad_topics_course  ON academic_topics(course_id);
    CREATE INDEX IF NOT EXISTS idx_acad_topics_know    ON academic_topics(knowledge_topic_id);
    CREATE INDEX IF NOT EXISTS idx_acad_assess_course  ON academic_assessments(course_id);
    CREATE INDEX IF NOT EXISTS idx_acad_attempt_course ON academic_attempts(course_id);
    CREATE INDEX IF NOT EXISTS idx_know_sources_topic  ON knowledge_sources(topic_id);
    CREATE INDEX IF NOT EXISTS idx_know_evidence_topic ON knowledge_evidence(topic_id);
    "#,
    ),
    (
        4,
        // Batch 2B — user-owned configuration CRUD for DEVELOPMENT + FITNESS + ROUTINES.
        //
        // Relationship truth (one source each, no reverse-collection columns):
        //   project -> milestone       : `development_milestones.project_id` (FK; CASCADE)
        //   skill   -> evidence        : `development_skill_evidence.skill_id` (FK; CASCADE)
        //   evidence -> project        : `development_skill_evidence.project_id` (FK; SET NULL)
        //   project <-> skill          : `development_project_skill_links` (many-to-many)
        //   plan    -> planned session : `fitness_planned_sessions.plan_id` (FK; CASCADE)
        //   plan    -> workout session : `fitness_workout_sessions.plan_id` (FK; SET NULL)
        //       — the ACTUAL session is an independent record; editing the Base Plan
        //         never rewrites it and vice-versa (Master Handoff §15).
        //   routine -> log             : `routine_logs.routine_id` (FK; CASCADE)
        //   routine -> system          : `routines.related_system_id` (FK -> systems.id; SET NULL)
        //
        // NOT stored (derived in the TS engine): skill `evidencePercent` (from
        // provenance-weighted evidence), readiness score (from check-ins),
        // routine consistency/streak (from logs). No fabricated numbers.
        r#"
    CREATE TABLE IF NOT EXISTS development_projects (
        id          TEXT PRIMARY KEY NOT NULL,
        title       TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'active',
        description TEXT NOT NULL DEFAULT '',
        archived    INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS development_skills (
        id                  TEXT PRIMARY KEY NOT NULL,
        title               TEXT NOT NULL,
        category            TEXT NOT NULL DEFAULT '',
        knowledge_percent   REAL NOT NULL DEFAULT 0,
        practice_percent    REAL NOT NULL DEFAULT 0,
        -- Learning Path / Skill Roadmap: NULL position = not on the path.
        roadmap_position     INTEGER,
        roadmap_target_level TEXT,
        archived            INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS development_milestones (
        id         TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL REFERENCES development_projects(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        completed  INTEGER NOT NULL DEFAULT 0,
        position   INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS development_skill_evidence (
        id         TEXT PRIMARY KEY NOT NULL,
        skill_id   TEXT NOT NULL REFERENCES development_skills(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES development_projects(id) ON DELETE SET NULL,
        title      TEXT NOT NULL,
        provenance TEXT NOT NULL DEFAULT 'independent',
        date       TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS development_project_skill_links (
        project_id TEXT NOT NULL REFERENCES development_projects(id) ON DELETE CASCADE,
        skill_id   TEXT NOT NULL REFERENCES development_skills(id)   ON DELETE CASCADE,
        PRIMARY KEY (project_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS fitness_plans (
        id            TEXT PRIMARY KEY NOT NULL,
        title         TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'active',
        current_week  INTEGER NOT NULL DEFAULT 1,
        total_weeks   INTEGER NOT NULL DEFAULT 1,
        days_per_week INTEGER NOT NULL DEFAULT 3,
        archived      INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fitness_planned_sessions (
        id          TEXT PRIMARY KEY NOT NULL,
        plan_id     TEXT NOT NULL REFERENCES fitness_plans(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL DEFAULT 0,
        title       TEXT NOT NULL,
        exercises   TEXT NOT NULL DEFAULT '[]',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fitness_workout_sessions (
        id                 TEXT PRIMARY KEY NOT NULL,
        plan_id            TEXT REFERENCES fitness_plans(id) ON DELETE SET NULL,
        planned_session_id TEXT REFERENCES fitness_planned_sessions(id) ON DELETE SET NULL,
        date               TEXT NOT NULL DEFAULT '',
        title              TEXT NOT NULL,
        exercises_performed TEXT NOT NULL DEFAULT '[]',
        notes              TEXT NOT NULL DEFAULT '',
        completed          INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fitness_recovery_checkins (
        id           TEXT PRIMARY KEY NOT NULL,
        date         TEXT NOT NULL DEFAULT '',
        sleep_hours  REAL NOT NULL DEFAULT 0,
        soreness     TEXT NOT NULL DEFAULT 'none',
        energy       TEXT NOT NULL DEFAULT 'normal',
        motivation   TEXT NOT NULL DEFAULT 'normal',
        stress_level TEXT NOT NULL DEFAULT 'normal',
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routines (
        id                       TEXT PRIMARY KEY NOT NULL,
        title                    TEXT NOT NULL,
        category                 TEXT NOT NULL DEFAULT '',
        time_window              TEXT NOT NULL DEFAULT 'anytime',
        -- Cadence (V1 Routine Builder spec): 'daily' | 'weekly-days' | 'times-per-week'.
        -- schedule_days is a JSON int array (0=Mon..6=Sun) used by 'weekly-days';
        -- schedule_target is the per-ISO-week count used by 'times-per-week'.
        -- This is the semantic cadence; `time_window` is only the day-part and a
        -- reminder layer is intentionally NOT modelled here (spec: keep separate).
        schedule_type            TEXT NOT NULL DEFAULT 'daily',
        schedule_days            TEXT NOT NULL DEFAULT '[]',
        schedule_target          INTEGER,
        completion_type          TEXT NOT NULL DEFAULT 'boolean',
        target_quantity          REAL,
        target_unit              TEXT,
        target_duration_minutes  INTEGER,
        priority                 TEXT NOT NULL DEFAULT 'important',
        related_system_id        TEXT REFERENCES systems(id) ON DELETE SET NULL,
        paused                   INTEGER NOT NULL DEFAULT 0,
        archived                 INTEGER NOT NULL DEFAULT 0,
        created_at               TEXT NOT NULL,
        updated_at               TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routine_logs (
        id                        TEXT PRIMARY KEY NOT NULL,
        routine_id                TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        date                      TEXT NOT NULL,
        state                     TEXT NOT NULL DEFAULT 'pending',
        quantity_completed        REAL,
        duration_completed_minutes INTEGER,
        completed_at              TEXT,
        created_at                TEXT NOT NULL,
        updated_at                TEXT NOT NULL
    );

    -- Reading & Language Learning (V1 Day 09). Boundaries locked:
    --   Reading & Language = WHAT was read/learned + curriculum/path progress.
    --   Knowledge          = evidence of understanding/retention (its own tables).
    --   Routine            = WHEN/how often practice happens (its own tables).
    -- Path/reading progress is deterministic arithmetic here and is NEVER
    -- mastery. Cross-domain links are references only (SET NULL on delete):
    --   language_paths.related_routine_id  -> routines(id)
    --   language_units.knowledge_topic_id  -> knowledge_topics(id)
    --   books.knowledge_topic_id           -> knowledge_topics(id)
    -- `books.note_ref` is a free-text pointer only — no Obsidian integration.
    CREATE TABLE IF NOT EXISTS language_paths (
        id                 TEXT PRIMARY KEY NOT NULL,
        language           TEXT NOT NULL,
        title              TEXT NOT NULL,
        target_level       TEXT NOT NULL DEFAULT '',
        status             TEXT NOT NULL DEFAULT 'active',
        related_routine_id TEXT REFERENCES routines(id) ON DELETE SET NULL,
        archived           INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS language_units (
        id                 TEXT PRIMARY KEY NOT NULL,
        path_id            TEXT NOT NULL REFERENCES language_paths(id) ON DELETE CASCADE,
        title              TEXT NOT NULL,
        kind               TEXT NOT NULL DEFAULT 'lesson',
        position           INTEGER NOT NULL DEFAULT 0,
        completed          INTEGER NOT NULL DEFAULT 0,
        knowledge_topic_id TEXT REFERENCES knowledge_topics(id) ON DELETE SET NULL,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS language_sessions (
        id               TEXT PRIMARY KEY NOT NULL,
        path_id          TEXT NOT NULL REFERENCES language_paths(id) ON DELETE CASCADE,
        unit_id          TEXT REFERENCES language_units(id) ON DELETE SET NULL,
        date             TEXT NOT NULL DEFAULT '',
        duration_minutes INTEGER NOT NULL DEFAULT 0,
        activity         TEXT NOT NULL DEFAULT 'lesson',
        notes            TEXT NOT NULL DEFAULT '',
        -- only set when a genuine recall/test check happened; minutes alone are
        -- never mastery. Consumed by the caller to add Knowledge evidence.
        recall_score     REAL,
        recall_max       REAL NOT NULL DEFAULT 10,
        completed        INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
        id                 TEXT PRIMARY KEY NOT NULL,
        title              TEXT NOT NULL,
        author             TEXT NOT NULL DEFAULT '',
        status             TEXT NOT NULL DEFAULT 'to-read',
        current_page       INTEGER NOT NULL DEFAULT 0,
        -- NULL total_pages = unknown; NOT 0% (the engine returns a null percent).
        total_pages        INTEGER,
        current_chapter    INTEGER NOT NULL DEFAULT 0,
        started_date       TEXT,
        finished_date      TEXT,
        knowledge_topic_id TEXT REFERENCES knowledge_topics(id) ON DELETE SET NULL,
        note_ref           TEXT NOT NULL DEFAULT '',
        archived           INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
        id               TEXT PRIMARY KEY NOT NULL,
        book_id          TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        date             TEXT NOT NULL DEFAULT '',
        from_page        INTEGER NOT NULL DEFAULT 0,
        to_page          INTEGER NOT NULL DEFAULT 0,
        duration_minutes INTEGER NOT NULL DEFAULT 0,
        notes            TEXT NOT NULL DEFAULT '',
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
    );

    -- Money OS (V1 Day 10) — lightweight MANUAL personal-finance awareness.
    -- Product locks enforced by shape here:
    --   ACTUAL TRANSACTION (`money_transactions`) ≠ PLANNED EXPENSE (`money_planned_expenses`).
    --     A planned expense is a future intention; it MAY link to the actual
    --     transaction that realised it (`transaction_id`, SET NULL) but the two
    --     stay distinct rows — planned amounts never enter a spending total.
    --   SAVINGS TRANSFER ≠ EXPENSE — a distinct `type` value; the TS engine
    --     excludes it from every spending / budget total.
    --   PBOS BALANCE ≠ VERIFIED BANK BALANCE — the balance is derived
    --     (income − expenses − transfers, + a user-entered opening amount on
    --     savings goals only); nothing here asserts bank verification.
    --   Savings-goal progress has ONE truth: `opening_amount` (user-entered)
    --     + the sum of linked `savings-transfer` transactions — there is no
    --     stored `current_amount` competing with the ledger.
    --   Money is NEVER part of any performance score (no such column exists).
    CREATE TABLE IF NOT EXISTS money_savings_goals (
        id             TEXT PRIMARY KEY NOT NULL,
        title          TEXT NOT NULL,
        target_amount  REAL NOT NULL DEFAULT 0,
        target_date    TEXT,
        monthly_target REAL NOT NULL DEFAULT 0,
        -- money the user already had toward this goal before tracking started
        -- (user-entered, not fabricated). current = opening + linked transfers.
        opening_amount REAL NOT NULL DEFAULT 0,
        status         TEXT NOT NULL DEFAULT 'active',
        archived       INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS money_transactions (
        id              TEXT PRIMARY KEY NOT NULL,
        date            TEXT NOT NULL DEFAULT '',
        type            TEXT NOT NULL DEFAULT 'expense',
        amount          REAL NOT NULL DEFAULT 0,
        category        TEXT NOT NULL DEFAULT '',
        description     TEXT NOT NULL DEFAULT '',
        -- only meaningful for a 'savings-transfer'; SET NULL if the goal is deleted
        savings_goal_id TEXT REFERENCES money_savings_goals(id) ON DELETE SET NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS money_planned_expenses (
        id             TEXT PRIMARY KEY NOT NULL,
        title          TEXT NOT NULL,
        amount         REAL NOT NULL DEFAULT 0,
        category       TEXT NOT NULL DEFAULT '',
        due_date       TEXT NOT NULL DEFAULT '',
        status         TEXT NOT NULL DEFAULT 'upcoming',
        -- the ACTUAL transaction that realised this plan, if any (SET NULL on delete).
        -- The planned row is never mutated into an expense.
        transaction_id TEXT REFERENCES money_transactions(id) ON DELETE SET NULL,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS money_budgets (
        id           TEXT PRIMARY KEY NOT NULL,
        category     TEXT NOT NULL,
        period       TEXT NOT NULL DEFAULT '',
        limit_amount REAL NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dev_milestones_project ON development_milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_dev_evidence_skill     ON development_skill_evidence(skill_id);
    CREATE INDEX IF NOT EXISTS idx_dev_evidence_project   ON development_skill_evidence(project_id);
    CREATE INDEX IF NOT EXISTS idx_dev_links_skill        ON development_project_skill_links(skill_id);
    CREATE INDEX IF NOT EXISTS idx_fit_planned_plan       ON fitness_planned_sessions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_fit_workout_plan       ON fitness_workout_sessions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_rtn_logs_routine       ON routine_logs(routine_id);
    CREATE INDEX IF NOT EXISTS idx_rtn_logs_date          ON routine_logs(date);
    CREATE INDEX IF NOT EXISTS idx_rtn_system             ON routines(related_system_id);
    CREATE INDEX IF NOT EXISTS idx_lang_units_path        ON language_units(path_id);
    CREATE INDEX IF NOT EXISTS idx_lang_units_topic       ON language_units(knowledge_topic_id);
    CREATE INDEX IF NOT EXISTS idx_lang_sessions_path     ON language_sessions(path_id);
    CREATE INDEX IF NOT EXISTS idx_lang_sessions_unit     ON language_sessions(unit_id);
    CREATE INDEX IF NOT EXISTS idx_lang_paths_routine     ON language_paths(related_routine_id);
    CREATE INDEX IF NOT EXISTS idx_books_topic            ON books(knowledge_topic_id);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_book  ON reading_sessions(book_id);
    CREATE INDEX IF NOT EXISTS idx_money_tx_date          ON money_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_money_tx_goal          ON money_transactions(savings_goal_id);
    CREATE INDEX IF NOT EXISTS idx_money_planned_tx       ON money_planned_expenses(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_money_budgets_cat      ON money_budgets(category, period);
    "#,
    ),
    (
        5,
        // Batch 3 — the PLAN stage of the operating loop (Planner / Calendar)
        // plus durable Quick Capture.
        //
        // Relationship truth (one source, no reverse-collection columns):
        //   action -> planning block : `planning_blocks.action_id`
        //       (FK -> actions.id; ON DELETE SET NULL). An Action has zero or
        //       more scheduled blocks; deleting the Action keeps the planning
        //       history (link nulled). The block's `title`/`domain` are its own
        //       label — linked Action data is READ live, never a duplicated
        //       authoritative copy of Action title/status/deadline.
        //
        // Product locks enforced by shape:
        //   ACTION ≠ PLANNING BLOCK ≠ CALENDAR EVENT ≠ COMPLETION.
        //     `planning_blocks.status` ('scheduled'|'done'|'skipped') is
        //     block-local — it is NOT Action completion. Scheduling an Action
        //     never sets the Action to done; there is one scheduled-block truth
        //     (no separate PlannerBlock / CalendarBlock entities).
        //   `locked` = a manual/locked decision that MUST survive plan
        //     regeneration (§9.12). `source` ('manual'|'generated') is provenance.
        //   deadline ≠ work session: a deadline is never modelled as a block.
        //
        // `day_of_week` (0=Mon..6=Sun) drives the weekly Calendar grid and the
        // deterministic conflict/capacity engine. `date` is an OPTIONAL absolute
        // yyyy-mm-dd pin — NULL means "recurs weekly on that weekday"; a value
        // means "this specific date" (what Today matches on).
        //
        // `planning_capacity` is a single-row config ('default'); empty time is
        // not the same as available capacity, so the limit is explicit.
        //
        // `capture_inbox` is DURABLE raw capture only — never a second Action /
        // Transaction / Knowledge / Routine store. A confirmed capture is
        // delegated to the existing canonical domain engine; the inbox row is
        // marked resolved, it does not hold the resulting entity.
        r#"
    CREATE TABLE IF NOT EXISTS planning_blocks (
        id           TEXT PRIMARY KEY NOT NULL,
        title        TEXT NOT NULL,
        domain       TEXT NOT NULL DEFAULT '',
        action_id    TEXT REFERENCES actions(id) ON DELETE SET NULL,
        day_of_week  INTEGER NOT NULL DEFAULT 0,
        date         TEXT,
        start_minute INTEGER NOT NULL DEFAULT 0,
        end_minute   INTEGER NOT NULL DEFAULT 0,
        block_type   TEXT NOT NULL DEFAULT 'flexible',
        locked       INTEGER NOT NULL DEFAULT 0,
        source       TEXT NOT NULL DEFAULT 'manual',
        status       TEXT NOT NULL DEFAULT 'scheduled',
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS planning_capacity (
        id             TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
        daily_minutes  INTEGER NOT NULL DEFAULT 150,
        weekly_minutes INTEGER NOT NULL DEFAULT 840,
        updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capture_inbox (
        id             TEXT PRIMARY KEY NOT NULL,
        raw_text       TEXT NOT NULL,
        proposed_type  TEXT,
        parsed_payload TEXT,
        status         TEXT NOT NULL DEFAULT 'unprocessed',
        resolution     TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_planning_blocks_action ON planning_blocks(action_id);
    CREATE INDEX IF NOT EXISTS idx_planning_blocks_day    ON planning_blocks(day_of_week);
    CREATE INDEX IF NOT EXISTS idx_planning_blocks_date   ON planning_blocks(date);
    CREATE INDEX IF NOT EXISTS idx_capture_inbox_status   ON capture_inbox(status);
    "#,
    ),
    (
        6,
        // Batch 4 — the ACADEMIC EXECUTION loop: STUDY -> FOCUS -> MASTERY CHECK
        // -> EVIDENCE -> KNOWLEDGE MASTERY.
        //
        // Product locks enforced by shape:
        //   FOCUS TIME ≠ MASTERY. `focus_sessions` records ACTIVITY evidence
        //     (duration + method) and a self-reported `recall_score` only when a
        //     genuine recall check was done — a completed timer never marks a
        //     topic mastered (docs 14.09 / 09.07). It carries OPTIONAL context
        //     links (course / academic topic / knowledge topic / action /
        //     planning block), all SET NULL on delete — the session is its own
        //     execution record, not a copy of any of them.
        //   ACADEMIC ASSESSMENT / MARK ≠ MASTERY CHECK. `mastery_checks` is a
        //     PERSONAL learning check (self-check / recall), never an official
        //     course assessment and never a grade. It has a `score` / `max_score`
        //     but NO academic mastery column — the Academic Topic still has no
        //     mastery of its own.
        //   KNOWLEDGE EVIDENCE owns mastery truth. A mastery check may create
        //     exactly ONE Knowledge Evidence row, and only on an explicit user
        //     action: `mastery_checks.evidence_id` is the idempotency guard —
        //     once set it is never overwritten (see study.rs mastery_link_evidence).
        //     Deleting that evidence (or its topic) SET NULLs the link; it does
        //     not delete the check.
        r#"
    CREATE TABLE IF NOT EXISTS focus_sessions (
        id                 TEXT PRIMARY KEY NOT NULL,
        title              TEXT NOT NULL,
        status             TEXT NOT NULL DEFAULT 'completed',
        method             TEXT NOT NULL DEFAULT '',
        course_id          TEXT REFERENCES academic_courses(id) ON DELETE SET NULL,
        academic_topic_id  TEXT REFERENCES academic_topics(id) ON DELETE SET NULL,
        knowledge_topic_id TEXT REFERENCES knowledge_topics(id) ON DELETE SET NULL,
        action_id          TEXT REFERENCES actions(id) ON DELETE SET NULL,
        planning_block_id  TEXT REFERENCES planning_blocks(id) ON DELETE SET NULL,
        target_minutes     INTEGER NOT NULL DEFAULT 0,
        duration_minutes   INTEGER NOT NULL DEFAULT 0,
        -- only set when a genuine recall/test check happened; minutes alone are
        -- never mastery. Consumed by the caller to add Knowledge evidence.
        recall_score       REAL,
        recall_max         REAL NOT NULL DEFAULT 10,
        notes              TEXT NOT NULL DEFAULT '',
        started_at         TEXT,
        completed_at       TEXT,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mastery_checks (
        id                 TEXT PRIMARY KEY NOT NULL,
        academic_topic_id  TEXT REFERENCES academic_topics(id) ON DELETE SET NULL,
        knowledge_topic_id TEXT REFERENCES knowledge_topics(id) ON DELETE SET NULL,
        course_id          TEXT REFERENCES academic_courses(id) ON DELETE SET NULL,
        topic_title        TEXT NOT NULL DEFAULT '',
        kind               TEXT NOT NULL DEFAULT 'self-check',
        -- JSON: [{ id, prompt, response, rating }] — the raw check, kept so the
        -- Result screen survives reload. Not a queryable question bank.
        items              TEXT NOT NULL DEFAULT '[]',
        score              REAL NOT NULL DEFAULT 0,
        max_score          REAL NOT NULL DEFAULT 0,
        status             TEXT NOT NULL DEFAULT 'in-progress',
        -- the ONE Knowledge Evidence row this check produced, if any. Idempotency
        -- guard: set once, never overwritten. SET NULL if that evidence is deleted.
        evidence_id        TEXT REFERENCES knowledge_evidence(id) ON DELETE SET NULL,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL,
        completed_at       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_focus_sessions_ktopic  ON focus_sessions(knowledge_topic_id);
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_atopic  ON focus_sessions(academic_topic_id);
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_course  ON focus_sessions(course_id);
    CREATE INDEX IF NOT EXISTS idx_mastery_checks_atopic  ON mastery_checks(academic_topic_id);
    CREATE INDEX IF NOT EXISTS idx_mastery_checks_ktopic  ON mastery_checks(knowledge_topic_id);
    CREATE INDEX IF NOT EXISTS idx_mastery_checks_evid    ON mastery_checks(evidence_id);
    "#,
    ),
    (
        7,
        // Batch 5 — the KNOWLEDGE / OBSIDIAN boundary + shared cross-domain
        // Evidence wiring.
        //
        // Ownership lock enforced by shape:
        //   OBSIDIAN owns the authoritative Markdown note body. PBOS stores
        //     METADATA ONLY — path, title, filesystem mtime/size, existence.
        //     There is deliberately NO `content` / `body` column: a preview is
        //     read on demand from disk, never cached here as a second truth.
        //   The index is DISPOSABLE (docs 16.05 / 16.09): `obsidian_notes` can
        //     be wiped and rebuilt by a rescan without any data loss.
        //   `knowledge_topic_note_links` is a GOVERNED REFERENCE keyed by the
        //     stable relative path, so a link SURVIVES a rescan and a missing
        //     file (the Knowledge Topic, its Evidence and its mastery are never
        //     touched because a note moved). CASCADE only on the Topic side.
        //
        //   DEVELOPMENT ↔ KNOWLEDGE (docs 15.02 / 18.08): a Skill may REFERENCE
        //     one canonical Knowledge concept (`development_skills.knowledge_topic_id`,
        //     SET NULL) — Development still owns practice/capability, Knowledge
        //     still owns conceptual mastery. A single Skill-evidence row may be
        //     handed to Knowledge exactly once
        //     (`development_skill_evidence.knowledge_evidence_id`, set-once guard,
        //     SET NULL if that evidence is deleted).
        r#"
    CREATE TABLE IF NOT EXISTS obsidian_config (
        id           INTEGER PRIMARY KEY CHECK (id = 1),
        vault_path   TEXT NOT NULL,
        vault_id     TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'connected',
        connected_at TEXT,
        last_scan_at TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS obsidian_notes (
        id            TEXT PRIMARY KEY NOT NULL,   -- stable: derived from relative_path
        relative_path TEXT NOT NULL UNIQUE,
        title         TEXT NOT NULL DEFAULT '',
        filename      TEXT NOT NULL DEFAULT '',
        modified_at   TEXT,                        -- filesystem mtime marker
        size_bytes    INTEGER NOT NULL DEFAULT 0,
        exists_on_disk INTEGER NOT NULL DEFAULT 1, -- 0 = indexed before, now missing/stale
        indexed_at    TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_topic_note_links (
        id            TEXT PRIMARY KEY NOT NULL,
        topic_id      TEXT NOT NULL REFERENCES knowledge_topics(id) ON DELETE CASCADE,
        relative_path TEXT NOT NULL,               -- the durable reference (survives rescan)
        title         TEXT NOT NULL DEFAULT '',
        linked_at     TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        UNIQUE (topic_id, relative_path)
    );

    CREATE INDEX IF NOT EXISTS idx_obsidian_notes_path  ON obsidian_notes(relative_path);
    CREATE INDEX IF NOT EXISTS idx_ktnl_topic           ON knowledge_topic_note_links(topic_id);
    CREATE INDEX IF NOT EXISTS idx_ktnl_path            ON knowledge_topic_note_links(relative_path);

    ALTER TABLE development_skills
        ADD COLUMN knowledge_topic_id TEXT REFERENCES knowledge_topics(id) ON DELETE SET NULL;
    ALTER TABLE development_skill_evidence
        ADD COLUMN knowledge_evidence_id TEXT REFERENCES knowledge_evidence(id) ON DELETE SET NULL;
    "#,
    ),
    (
        8,
        // Batch 6 — the INTELLIGENCE / DECISION loop: Analytics facts -> AI
        // proposal -> user decision -> deterministic validation -> safe
        // allowlisted canonical Apply -> optional re-plan.
        //
        // Architecture locks enforced by shape (docs 23 / 24.12 / 26 / 30):
        //   AI HAS NO DIRECT WRITE CREDENTIAL. `ai_recommendations` holds
        //     PROPOSALS only; a proposal's `proposed_params` is opaque JSON that
        //     a TS Apply ADAPTER (allowlisted by `kind`) validates and then
        //     hands to a canonical domain store — nothing here executes SQL or a
        //     Tauri command chosen by a model.
        //   DECISION HISTORY IS APPEND-ONLY. `ai_decision_events` has no update
        //     path (the module exposes append + read only). A recommendation's
        //     status column is the current state; the events are the trail.
        //   SECRETS NEVER LAND HERE. `ai_config` stores provider id / model /
        //     base URL / enabled — never an API key (the key is read from the
        //     PBOS_AI_API_KEY environment variable by the caller, never persisted
        //     and never returned to the renderer).
        //   PER-DOMAIN PERMISSIONS ARE DURABLE. `ai_permissions` is one row per
        //     domain label; "no-access" is the default for anything absent.
        //   REVIEWS ARE IMMUTABLE SNAPSHOTS (docs 22.04 / 22.05). An
        //     `analytics_reviews` row is written once and never updated.
        r#"
    CREATE TABLE IF NOT EXISTS ai_config (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        provider_id TEXT NOT NULL DEFAULT 'fake',
        model       TEXT NOT NULL DEFAULT '',
        base_url    TEXT NOT NULL DEFAULT '',
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_permissions (
        domain     TEXT PRIMARY KEY NOT NULL,
        level      TEXT NOT NULL DEFAULT 'no-access', -- no-access | read | read-recommend
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_recommendations (
        id             TEXT PRIMARY KEY NOT NULL,
        kind           TEXT NOT NULL,                 -- allowlisted Apply-adapter key
        domain         TEXT NOT NULL,
        title          TEXT NOT NULL,
        rationale      TEXT NOT NULL DEFAULT '',
        evidence       TEXT NOT NULL DEFAULT '[]',    -- JSON string[]
        confidence     TEXT NOT NULL DEFAULT 'limited',
        source         TEXT NOT NULL DEFAULT 'workspace',
        generated_from TEXT NOT NULL DEFAULT '',
        proposed_params TEXT NOT NULL DEFAULT '{}',   -- opaque JSON, adapter-validated
        current_params  TEXT NOT NULL DEFAULT '{}',   -- before-values for the preview
        status         TEXT NOT NULL DEFAULT 'proposed',
        validation     TEXT,                          -- JSON { ok, reasonCodes[], message }
        applied_result TEXT,                          -- JSON
        created_at     TEXT NOT NULL,
        decided_at     TEXT,
        applied_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_decision_events (
        id                TEXT PRIMARY KEY NOT NULL,
        recommendation_id TEXT NOT NULL REFERENCES ai_recommendations(id) ON DELETE CASCADE,
        event             TEXT NOT NULL,   -- proposed|accepted|modified|rejected|applied|apply-failed
        detail            TEXT NOT NULL DEFAULT '{}',
        created_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_reviews (
        id           TEXT PRIMARY KEY NOT NULL,
        kind         TEXT NOT NULL,        -- weekly | monthly
        period_start TEXT NOT NULL,
        period_end   TEXT NOT NULL,
        snapshot     TEXT NOT NULL DEFAULT '{}',  -- immutable JSON of the deterministic facts
        notes        TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_recs_status  ON ai_recommendations(status);
    CREATE INDEX IF NOT EXISTS idx_ai_events_rec   ON ai_decision_events(recommendation_id);
    CREATE INDEX IF NOT EXISTS idx_ana_reviews_kind ON analytics_reviews(kind, period_start);
    "#,
    ),
    (
        9,
        // Batch 7 — the entry / configuration lifecycle: first-run onboarding
        // state + the canonical Settings config.
        //
        // Locks enforced by shape (docs 14 / 15):
        //   ONE onboarding truth. `onboarding_state` is a single row (CHECK id=1)
        //     — status / current step / the cinematic first-boot flag (played
        //     once, ever) / entered personal setup / recorded system choices /
        //     timestamps. Completion is NOT inferred from domain entity counts.
        //   ONE settings truth. `settings_config` is a single row holding the
        //     BASE configuration + the active operating mode + the list of
        //     temporary overrides + notification/appearance preferences. The
        //     EFFECTIVE value is derived deterministically at read time
        //     (Base -> Mode -> Temporary) and is never stored here.
        //   Settings CONFIGURES canonical domains; it does not copy planning
        //     capacity, AI permissions, or the Obsidian vault path (those stay
        //     in their own tables). Onboarding INITIALISES via the same stores.
        r#"
    CREATE TABLE IF NOT EXISTS onboarding_state (
        id                        INTEGER PRIMARY KEY CHECK (id = 1),
        status                    TEXT NOT NULL DEFAULT 'not_started', -- not_started|in_progress|completed|skipped
        current_step              TEXT NOT NULL DEFAULT 'welcome',
        first_boot_experience_seen INTEGER NOT NULL DEFAULT 0,
        flow_version              INTEGER NOT NULL DEFAULT 1,
        personal_setup            TEXT NOT NULL DEFAULT '{}',  -- JSON: name/weekStart/sleep/capacity/priorities/defaultMode
        system_choices            TEXT NOT NULL DEFAULT '{}',  -- JSON: { obsidian, ai } -> connected|skipped|not-set
        started_at                TEXT,
        completed_at              TEXT,
        created_at                TEXT NOT NULL,
        updated_at                TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings_config (
        id                  INTEGER PRIMARY KEY CHECK (id = 1),
        base_config         TEXT NOT NULL DEFAULT '{}',  -- JSON BaseConfig
        mode                TEXT NOT NULL DEFAULT 'normal',
        temporary_overrides TEXT NOT NULL DEFAULT '[]',  -- JSON TemporaryOverride[]
        notifications       TEXT NOT NULL DEFAULT '{}',  -- JSON NotificationSettings
        appearance          TEXT NOT NULL DEFAULT '{}',  -- JSON AppearanceSettings
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
    );
    "#,
    ),
    (
        10,
        // Batch 8 — the general cross-domain revision / audit event store
        // (`docs/32` data class 3, audit finding P1-20's non-AI slice).
        //
        // Locks enforced by shape:
        //   APPEND-ONLY. `revision_events` has a stable primary key and is
        //     written with INSERT OR IGNORE only — `revision.rs` exposes no
        //     update-one or delete-one command. It is a history log, never an
        //     authoritative domain state (mastery / grades / balances are still
        //     derived from their own canonical tables).
        //   NOT event-sourcing. A row records that an important user-visible
        //     change happened (domain / entity / operation / source / a short
        //     human summary) plus a SMALL optional `metadata` blob for a
        //     targeted before/after — never a full entity snapshot.
        //   The AI decision trail keeps its own `ai_decision_events` table
        //     (migration v8); an AI-applied canonical mutation also appends one
        //     row here with `source = 'ai-applied'` so a user sees every
        //     domain's changes in one place, but the two are not merged.
        r#"
    CREATE TABLE IF NOT EXISTS revision_events (
        id           TEXT PRIMARY KEY NOT NULL,
        domain       TEXT NOT NULL,   -- performance|academic|knowledge|planning|routine|settings|development|fitness|language|money
        entity_type  TEXT NOT NULL,   -- goal|system|action|course|topic|evidence|block|routine|settings-config|...
        entity_id    TEXT NOT NULL,
        operation    TEXT NOT NULL,   -- create|update|delete|status-change|apply|reschedule|check-in
        source       TEXT NOT NULL DEFAULT 'user',  -- user|ai-applied|import|system
        summary      TEXT NOT NULL DEFAULT '',
        metadata     TEXT NOT NULL DEFAULT '{}',    -- small JSON { before?, after?, ... } — NOT a full snapshot
        created_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_revision_entity  ON revision_events(domain, entity_type, entity_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_revision_domain  ON revision_events(domain, created_at);
    CREATE INDEX IF NOT EXISTS idx_revision_created ON revision_events(created_at);
    "#,
    ),
];

/// Key in `meta` recording that the one-time localStorage import ran.
const META_LOCALSTORAGE_MIGRATION: &str = "localstorage_migration";

pub struct Db(pub Mutex<Connection>);

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("app data dir unavailable: {0}")]
    Path(String),
    #[error("forbidden: {0}")]
    Forbidden(String),
}

// Tauri commands need the error to be Serialize.
impl Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

type DbResult<T> = Result<T, DbError>;

/// Open (creating if needed) the PBOS database and run pending migrations.
pub fn open_and_migrate(app: &AppHandle) -> DbResult<Connection> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DbError::Path(e.to_string()))?;
    fs::create_dir_all(&dir)?;
    let path = dir.join("pbos.sqlite3");
    let conn = Connection::open(&path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    run_migrations(&conn)?;
    Ok(conn)
}

fn run_migrations(conn: &Connection) -> DbResult<()> {
    debug_assert_eq!(
        MIGRATIONS.last().map(|(v, _)| *v).unwrap_or(0),
        CURRENT_SCHEMA_VERSION,
        "CURRENT_SCHEMA_VERSION must match the highest migration"
    );
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version    INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;
    let applied: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    for (version, sql) in MIGRATIONS {
        if *version > applied {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?1)",
                params![version],
            )?;
        }
    }
    Ok(())
}

/// Exposed for the `performance` module's Rust tests (in-memory DB).
#[cfg(test)]
pub(crate) fn run_migrations_for_test(conn: &Connection) -> DbResult<()> {
    run_migrations(conn)
}

fn schema_version(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |r| r.get(0),
    )
    .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// KV operations (take &Connection so they are unit-testable in Rust)
// ---------------------------------------------------------------------------

fn kv_get_all_inner(conn: &Connection) -> DbResult<Vec<KvEntry>> {
    let mut stmt = conn.prepare("SELECT key, value FROM kv_store ORDER BY key")?;
    let rows = stmt.query_map([], |r| {
        Ok(KvEntry {
            key: r.get(0)?,
            value: r.get(1)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn kv_set_inner(conn: &Connection, key: &str, value: &str) -> DbResult<()> {
    conn.execute(
        "INSERT INTO kv_store (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )?;
    Ok(())
}

fn kv_delete_inner(conn: &Connection, key: &str) -> DbResult<()> {
    conn.execute("DELETE FROM kv_store WHERE key = ?1", params![key])?;
    Ok(())
}

fn meta_get(conn: &Connection, key: &str) -> DbResult<Option<String>> {
    Ok(conn
        .query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| {
            r.get::<_, String>(0)
        })
        .optional()?)
}

/// Runs the validated, idempotent, non-destructive localStorage import.
/// Split out from the command so Rust tests can drive it with a bare `&Db`.
fn migrate_from_localstorage_inner(db: &Db, entries: &[KvEntry]) -> DbResult<MigrationReport> {
    let mut conn = db.0.lock().unwrap();

    if meta_get(&conn, META_LOCALSTORAGE_MIGRATION)?.is_some() {
        return Ok(MigrationReport {
            ran: false,
            imported: 0,
            skipped_existing: 0,
            skipped_invalid: vec![],
            schema_version: schema_version(&conn),
        });
    }

    let mut imported = 0usize;
    let mut skipped_existing = 0usize;
    let mut skipped_invalid: Vec<InvalidKey> = Vec::new();

    let tx = conn.transaction()?;
    for e in entries {
        // Legacy values are JSON.stringify output; anything that won't parse is
        // corrupt legacy data — report it, do not import it. The JS side is
        // instructed never to delete the legacy key either.
        if serde_json::from_str::<serde_json::Value>(&e.value).is_err() {
            skipped_invalid.push(InvalidKey {
                key: e.key.clone(),
                reason: "value is not valid JSON".to_string(),
            });
            continue;
        }
        // DO NOTHING on conflict => never overwrite newer SQLite data.
        let changed = tx.execute(
            "INSERT INTO kv_store (key, value, updated_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO NOTHING",
            params![e.key, e.value],
        )?;
        if changed == 1 {
            imported += 1;
        } else {
            skipped_existing += 1;
        }
    }

    let sv = schema_version(&tx);
    let marker = serde_json::json!({
        "version": 1,
        "schemaVersion": sv,
        "imported": imported,
        "skippedExisting": skipped_existing,
        "skippedInvalid": skipped_invalid.iter().map(|k| &k.key).collect::<Vec<_>>(),
        "sourceKeyCount": entries.len(),
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_LOCALSTORAGE_MIGRATION, marker.to_string()],
    )?;
    tx.commit()?;

    Ok(MigrationReport {
        ran: true,
        imported,
        skipped_existing,
        skipped_invalid,
        schema_version: sv,
    })
}

// ---------------------------------------------------------------------------
// Types crossing the Tauri boundary
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KvEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct DbStatus {
    pub schema_version: i64,
    pub kv_count: i64,
    pub localstorage_migrated: bool,
    pub localstorage_migration: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct MigrationReport {
    /// True when this call actually performed the import (false = already done).
    pub ran: bool,
    pub imported: usize,
    pub skipped_existing: usize,
    pub skipped_invalid: Vec<InvalidKey>,
    pub schema_version: i64,
}

#[derive(Debug, Serialize)]
pub struct InvalidKey {
    pub key: String,
    pub reason: String,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn kv_get_all(db: State<'_, Db>) -> DbResult<Vec<KvEntry>> {
    let conn = db.0.lock().unwrap();
    kv_get_all_inner(&conn)
}

#[tauri::command]
pub fn kv_set(db: State<'_, Db>, key: String, value: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    kv_set_inner(&conn, &key, &value)
}

#[tauri::command]
pub fn kv_delete(db: State<'_, Db>, key: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    kv_delete_inner(&conn, &key)
}

#[tauri::command]
pub fn db_status(db: State<'_, Db>) -> DbResult<DbStatus> {
    let conn = db.0.lock().unwrap();
    let kv_count: i64 = conn.query_row("SELECT COUNT(*) FROM kv_store", [], |r| r.get(0))?;
    let raw = meta_get(&conn, META_LOCALSTORAGE_MIGRATION)?;
    let parsed = raw
        .as_deref()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());
    Ok(DbStatus {
        schema_version: schema_version(&conn),
        kv_count,
        localstorage_migrated: raw.is_some(),
        localstorage_migration: parsed,
    })
}

/// One-time, idempotent, validated import of legacy `localStorage` PBOS state.
#[tauri::command]
pub fn migrate_from_localstorage(
    db: State<'_, Db>,
    entries: Vec<KvEntry>,
) -> DbResult<MigrationReport> {
    migrate_from_localstorage_inner(&db, &entries)
}

// ---------------------------------------------------------------------------
// Rust unit tests — no Tauri, in-memory SQLite
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn mem_db() -> Db {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        Db(Mutex::new(c))
    }

    #[test]
    fn migrations_are_idempotent() {
        let db = mem_db();
        let conn = db.0.lock().unwrap();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        assert_eq!(schema_version(&conn), CURRENT_SCHEMA_VERSION);
    }

    #[test]
    fn kv_roundtrip_and_upsert() {
        let db = mem_db();
        let conn = db.0.lock().unwrap();
        kv_set_inner(&conn, "pbos:performance-goals", "[{\"id\":\"g1\"}]").unwrap();
        kv_set_inner(
            &conn,
            "pbos:performance-goals",
            "[{\"id\":\"g1\"},{\"id\":\"g2\"}]",
        )
        .unwrap();
        let all = kv_get_all_inner(&conn).unwrap();
        assert_eq!(all.len(), 1);
        assert!(all[0].value.contains("g2"));
        kv_delete_inner(&conn, "pbos:performance-goals").unwrap();
        assert_eq!(kv_get_all_inner(&conn).unwrap().len(), 0);
    }

    #[test]
    fn localstorage_migration_is_idempotent_validated_and_non_destructive() {
        let db = mem_db();

        let entries = vec![
            KvEntry {
                key: "pbos:money-transactions".into(),
                value: "[]".into(),
            },
            KvEntry {
                key: "pbos:routine-logs".into(),
                value: "{\"a\":1}".into(),
            },
            KvEntry {
                key: "pbos:broken".into(),
                value: "{not json".into(),
            },
        ];

        let r1 = migrate_from_localstorage_inner(&db, &entries).unwrap();
        assert!(r1.ran);
        assert_eq!(r1.imported, 2);
        assert_eq!(r1.skipped_invalid.len(), 1);
        assert_eq!(r1.skipped_invalid[0].key, "pbos:broken");

        // Simulate newer SQLite data, then re-run: must be a no-op that
        // preserves the newer value.
        {
            let conn = db.0.lock().unwrap();
            kv_set_inner(&conn, "pbos:money-transactions", "[{\"id\":\"newer\"}]").unwrap();
        }
        let r2 = migrate_from_localstorage_inner(&db, &entries).unwrap();
        assert!(!r2.ran);
        assert_eq!(r2.imported, 0);
        {
            let conn = db.0.lock().unwrap();
            let all = kv_get_all_inner(&conn).unwrap();
            let txn = all
                .iter()
                .find(|e| e.key == "pbos:money-transactions")
                .unwrap();
            assert!(
                txn.value.contains("newer"),
                "newer SQLite value must survive re-migration"
            );
        }
    }
}
