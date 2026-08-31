//! Batch 7 — the entry / configuration lifecycle. Thin data-access over the
//! single-row `onboarding_state` and `settings_config` tables in migration v9.
//!
//! Locks enforced by shape (docs 14 / 15):
//!   * ONE onboarding truth — `onboarding_state` is a single row. Completion is
//!     stored explicitly, never inferred from domain entity counts.
//!   * ONE settings truth — `settings_config` holds BASE config + active mode +
//!     temporary overrides + notification/appearance prefs. The EFFECTIVE value
//!     is derived at read time by the TS engine, never persisted here.
//!   * `setup_reset_onboarding` touches ONLY `onboarding_state` — it never
//!     deletes Goals / Courses / Knowledge / Plans / Money / the Obsidian index
//!     / AI settings.
//!   * `existing_user_marker` is the deterministic signal that a real profile
//!     migrated from an earlier build (the `meta.localstorage_migration` key),
//!     so an established user is never forced back through first-run.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingRow {
    pub status: String,
    pub current_step: String,
    pub first_boot_experience_seen: bool,
    pub flow_version: i64,
    /// JSON blob — the entered Personal Setup baseline.
    pub personal_setup: String,
    /// JSON blob — { obsidian, ai } connection choices.
    pub system_choices: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsRow {
    pub base_config: String,
    pub mode: String,
    pub temporary_overrides: String,
    pub notifications: String,
    pub appearance: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupGraph {
    pub onboarding: Option<OnboardingRow>,
    pub settings: Option<SettingsRow>,
    /// A real profile migrated from an earlier build — see module docs.
    pub existing_user_marker: bool,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_onboarding(conn: &Connection) -> DbResult<Option<OnboardingRow>> {
    Ok(conn
        .query_row(
            "SELECT status,current_step,first_boot_experience_seen,flow_version,personal_setup,
                    system_choices,started_at,completed_at,created_at,updated_at
             FROM onboarding_state WHERE id = 1",
            [],
            |r| {
                Ok(OnboardingRow {
                    status: r.get(0)?,
                    current_step: r.get(1)?,
                    first_boot_experience_seen: r.get::<_, i64>(2)? != 0,
                    flow_version: r.get(3)?,
                    personal_setup: r.get(4)?,
                    system_choices: r.get(5)?,
                    started_at: r.get(6)?,
                    completed_at: r.get(7)?,
                    created_at: r.get(8)?,
                    updated_at: r.get(9)?,
                })
            },
        )
        .optional()?)
}

fn load_settings(conn: &Connection) -> DbResult<Option<SettingsRow>> {
    Ok(conn
        .query_row(
            "SELECT base_config,mode,temporary_overrides,notifications,appearance,created_at,updated_at
             FROM settings_config WHERE id = 1",
            [],
            |r| {
                Ok(SettingsRow {
                    base_config: r.get(0)?,
                    mode: r.get(1)?,
                    temporary_overrides: r.get(2)?,
                    notifications: r.get(3)?,
                    appearance: r.get(4)?,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                })
            },
        )
        .optional()?)
}

fn existing_user_marker(conn: &Connection) -> DbResult<bool> {
    let present: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM meta WHERE key = 'localstorage_migration'",
            [],
            |r| r.get(0),
        )
        .optional()?;
    Ok(present.is_some())
}

fn load_inner(conn: &Connection) -> DbResult<SetupGraph> {
    Ok(SetupGraph {
        onboarding: load_onboarding(conn)?,
        settings: load_settings(conn)?,
        existing_user_marker: existing_user_marker(conn)?,
    })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

fn onboarding_upsert_inner(conn: &Connection, o: &OnboardingRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO onboarding_state
            (id,status,current_step,first_boot_experience_seen,flow_version,personal_setup,
             system_choices,started_at,completed_at,created_at,updated_at)
         VALUES (1,?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            status=excluded.status, current_step=excluded.current_step,
            first_boot_experience_seen=excluded.first_boot_experience_seen,
            flow_version=excluded.flow_version, personal_setup=excluded.personal_setup,
            system_choices=excluded.system_choices, started_at=excluded.started_at,
            completed_at=excluded.completed_at, updated_at=excluded.updated_at",
        params![
            o.status,
            o.current_step,
            o.first_boot_experience_seen as i64,
            o.flow_version,
            o.personal_setup,
            o.system_choices,
            o.started_at,
            o.completed_at,
            o.created_at,
            o.updated_at
        ],
    )?;
    Ok(())
}

fn settings_upsert_inner(conn: &Connection, s: &SettingsRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO settings_config
            (id,base_config,mode,temporary_overrides,notifications,appearance,created_at,updated_at)
         VALUES (1,?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(id) DO UPDATE SET
            base_config=excluded.base_config, mode=excluded.mode,
            temporary_overrides=excluded.temporary_overrides,
            notifications=excluded.notifications, appearance=excluded.appearance,
            updated_at=excluded.updated_at",
        params![
            s.base_config,
            s.mode,
            s.temporary_overrides,
            s.notifications,
            s.appearance,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

/// Reset ONLY the onboarding workflow state. Domain data + Settings are untouched.
fn reset_onboarding_inner(conn: &Connection) -> DbResult<()> {
    conn.execute("DELETE FROM onboarding_state", [])?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn setup_load(db: State<'_, Db>) -> DbResult<SetupGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn setup_onboarding_upsert(db: State<'_, Db>, onboarding: OnboardingRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    onboarding_upsert_inner(&conn, &onboarding)
}

#[tauri::command]
pub fn setup_settings_upsert(db: State<'_, Db>, settings: SettingsRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    settings_upsert_inner(&conn, &settings)
}

#[tauri::command]
pub fn setup_reset_onboarding(db: State<'_, Db>) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    reset_onboarding_inner(&conn)
}

/// DEBUG ONLY — wipes both single-row tables (never domain data).
#[tauri::command]
pub fn setup_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "setup_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch("DELETE FROM onboarding_state; DELETE FROM settings_config;")?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Rust unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations_for_test;
    use std::sync::Mutex;

    fn mem() -> Db {
        let c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        run_migrations_for_test(&c).unwrap();
        Db(Mutex::new(c))
    }

    fn ob(status: &str, step: &str) -> OnboardingRow {
        OnboardingRow {
            status: status.into(),
            current_step: step.into(),
            first_boot_experience_seen: false,
            flow_version: 1,
            personal_setup: "{\"name\":\"Bilal\"}".into(),
            system_choices: "{}".into(),
            started_at: Some("2026-01-01T00:00:00Z".into()),
            completed_at: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }
    fn settings() -> SettingsRow {
        SettingsRow {
            base_config: "{\"weekdayAcademicCapacityMinutes\":90}".into(),
            mode: "midterm".into(),
            temporary_overrides: "[]".into(),
            notifications: "{}".into(),
            appearance: "{\"reducedMotion\":true}".into(),
            created_at: "t".into(),
            updated_at: "t".into(),
        }
    }

    #[test]
    fn fresh_db_has_no_onboarding_or_settings_row_and_no_existing_marker() {
        let db = mem();
        let g = load_inner(&db.0.lock().unwrap()).unwrap();
        assert!(g.onboarding.is_none());
        assert!(g.settings.is_none());
        assert!(!g.existing_user_marker);
    }

    #[test]
    fn onboarding_state_is_a_single_row_that_round_trips() {
        let db = mem();
        {
            let conn = db.0.lock().unwrap();
            onboarding_upsert_inner(&conn, &ob("in_progress", "personal-setup")).unwrap();
        }
        {
            // a second upsert updates the same row, never inserts a duplicate
            let conn = db.0.lock().unwrap();
            let mut o = ob("in_progress", "connect-systems");
            o.first_boot_experience_seen = true;
            onboarding_upsert_inner(&conn, &o).unwrap();
        }
        let conn = db.0.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM onboarding_state", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let row = load_onboarding(&conn).unwrap().unwrap();
        assert_eq!(row.current_step, "connect-systems");
        assert!(row.first_boot_experience_seen);
        assert!(
            row.personal_setup.contains("Bilal"),
            "entered setup is kept"
        );
    }

    #[test]
    fn reset_onboarding_clears_only_onboarding_never_settings_or_domain_data() {
        let db = mem();
        let conn = db.0.lock().unwrap();
        onboarding_upsert_inner(&conn, &ob("completed", "review-launch")).unwrap();
        settings_upsert_inner(&conn, &settings()).unwrap();
        // seed a domain row that must survive
        conn.execute(
            "INSERT INTO knowledge_topics
                (id,title,category,context,last_studied,next_review_date,related_goal_id,created_at,updated_at)
             VALUES ('kt1','Binary Trees','academic','',NULL,NULL,NULL,'t','t')",
            [],
        )
        .unwrap();

        reset_onboarding_inner(&conn).unwrap();

        assert!(
            load_onboarding(&conn).unwrap().is_none(),
            "onboarding cleared"
        );
        assert!(
            load_settings(&conn).unwrap().is_some(),
            "settings untouched"
        );
        let topics: i64 = conn
            .query_row("SELECT COUNT(*) FROM knowledge_topics", [], |r| r.get(0))
            .unwrap();
        assert_eq!(topics, 1, "domain data untouched");
    }

    #[test]
    fn settings_config_round_trips_as_one_row_with_no_effective_column() {
        let db = mem();
        {
            let conn = db.0.lock().unwrap();
            settings_upsert_inner(&conn, &settings()).unwrap();
            let mut s = settings();
            s.mode = "recovery".into();
            settings_upsert_inner(&conn, &s).unwrap();
        }
        let conn = db.0.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM settings_config", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        assert_eq!(load_settings(&conn).unwrap().unwrap().mode, "recovery");
        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(settings_config)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for banned in ["effective", "effective_config", "effective_capacity"] {
            assert!(
                !cols.iter().any(|c| c == banned),
                "effective config must be derived, not stored — found '{banned}'"
            );
        }
    }

    #[test]
    fn existing_user_marker_follows_the_localstorage_migration_meta_key() {
        let db = mem();
        {
            let conn = db.0.lock().unwrap();
            assert!(!existing_user_marker(&conn).unwrap());
            conn.execute(
                "INSERT INTO meta (key,value) VALUES ('localstorage_migration','{\"version\":1}')",
                [],
            )
            .unwrap();
        }
        let conn = db.0.lock().unwrap();
        assert!(existing_user_marker(&conn).unwrap());
    }
}
