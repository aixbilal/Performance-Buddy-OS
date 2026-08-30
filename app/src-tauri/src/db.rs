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
const CURRENT_SCHEMA_VERSION: i64 = 1;

/// Ordered, forward-only migrations. `version` must be contiguous from 1.
const MIGRATIONS: &[(i64, &str)] = &[(
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
)];

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
    let kv_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM kv_store", [], |r| r.get(0))?;
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
        kv_set_inner(&conn, "pbos:performance-goals", "[{\"id\":\"g1\"},{\"id\":\"g2\"}]").unwrap();
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
            KvEntry { key: "pbos:money-transactions".into(), value: "[]".into() },
            KvEntry { key: "pbos:routine-logs".into(), value: "{\"a\":1}".into() },
            KvEntry { key: "pbos:broken".into(), value: "{not json".into() },
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
            let txn = all.iter().find(|e| e.key == "pbos:money-transactions").unwrap();
            assert!(txn.value.contains("newer"), "newer SQLite value must survive re-migration");
        }
    }
}
