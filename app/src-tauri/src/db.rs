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
const CURRENT_SCHEMA_VERSION: i64 = 3;

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
