//! V2 — durable persistence for the ADAPTIVE TODAY subjective operating state.
//! Thin data-access over `today_operating_state` (migration v11, see `db.rs`).
//!
//! Product model (blueprint 07 §6.6 / §11.5):
//!   Today DERIVES its execution picture (current block, next block, gaps,
//!   overload, fragility) on every render. The ONLY thing that is persisted is
//!   the user's subjective daily capacity level — `low | normal | high`,
//!   defaulting to `normal`. It is NEVER inferred from the clock; Natural
//!   Capture may PROPOSE a level from an explicit statement, the user confirms,
//!   and an approved capture writes it with `source = 'capture-approved'`.
//!
//!   This table is one row per ISO date. It is not a second Planner capacity
//!   store — the persistent Planner capacity in `planning_capacity` is
//!   untouched.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const ALLOWED_LEVELS: [&str; 3] = ["low", "normal", "high"];
const ALLOWED_SOURCES: [&str; 2] = ["user", "capture-approved"];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayOperatingStateRow {
    pub date: String,
    pub capacity_level: String,
    pub source: String,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

fn load_all_inner(conn: &Connection) -> DbResult<Vec<TodayOperatingStateRow>> {
    let mut s = conn.prepare(
        "SELECT date,capacity_level,source,note,created_at,updated_at
         FROM today_operating_state ORDER BY date DESC",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(TodayOperatingStateRow {
                date: r.get(0)?,
                capacity_level: r.get(1)?,
                source: r.get(2)?,
                note: r.get(3)?,
                created_at: r.get(4)?,
                updated_at: r.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn get_inner(conn: &Connection, date: &str) -> DbResult<Option<TodayOperatingStateRow>> {
    let row = conn
        .query_row(
            "SELECT date,capacity_level,source,note,created_at,updated_at
             FROM today_operating_state WHERE date = ?1",
            params![date],
            |r| {
                Ok(TodayOperatingStateRow {
                    date: r.get(0)?,
                    capacity_level: r.get(1)?,
                    source: r.get(2)?,
                    note: r.get(3)?,
                    created_at: r.get(4)?,
                    updated_at: r.get(5)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

/// Upsert one day's capacity. Rejects an unknown level/source rather than
/// silently coercing — the caller (shared mutation `set-today-capacity`)
/// validates first, this is the persistence guard of last resort.
fn set_inner(conn: &Connection, s: &TodayOperatingStateRow) -> DbResult<()> {
    if !ALLOWED_LEVELS.contains(&s.capacity_level.as_str()) {
        return Err(DbError::Forbidden(format!(
            "capacity_level must be one of {ALLOWED_LEVELS:?}, got `{}`",
            s.capacity_level
        )));
    }
    if !ALLOWED_SOURCES.contains(&s.source.as_str()) {
        return Err(DbError::Forbidden(format!(
            "source must be one of {ALLOWED_SOURCES:?}, got `{}`",
            s.source
        )));
    }
    conn.execute(
        "INSERT INTO today_operating_state (date,capacity_level,source,note,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(date) DO UPDATE SET
            capacity_level=excluded.capacity_level,
            source=excluded.source,
            note=excluded.note,
            updated_at=excluded.updated_at",
        params![
            s.date,
            s.capacity_level,
            s.source,
            s.note,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn today_state_load(db: State<'_, Db>) -> DbResult<Vec<TodayOperatingStateRow>> {
    let conn = db.0.lock().unwrap();
    load_all_inner(&conn)
}

#[tauri::command]
pub fn today_state_get(db: State<'_, Db>, date: String) -> DbResult<Option<TodayOperatingStateRow>> {
    let conn = db.0.lock().unwrap();
    get_inner(&conn, &date)
}

#[tauri::command]
pub fn today_state_set(db: State<'_, Db>, state: TodayOperatingStateRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    set_inner(&conn, &state)
}

#[tauri::command]
pub fn today_state_clear(db: State<'_, Db>, date: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM today_operating_state WHERE date = ?1",
        params![date],
    )?;
    Ok(())
}

/// DEBUG ONLY — wipes the subjective Today state so native E2E starts clean.
#[tauri::command]
pub fn today_state_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "today_state_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM today_operating_state", [])?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Rust unit tests — no Tauri, in-memory SQLite
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::run_migrations_for_test;

    fn mem() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        run_migrations_for_test(&c).unwrap();
        c
    }

    fn row(date: &str, level: &str) -> TodayOperatingStateRow {
        TodayOperatingStateRow {
            date: date.into(),
            capacity_level: level.into(),
            source: "user".into(),
            note: String::new(),
            created_at: "2026-09-01T07:00:00.000Z".into(),
            updated_at: "2026-09-01T07:00:00.000Z".into(),
        }
    }

    #[test]
    fn set_get_and_default_absence_is_not_zero() {
        let c = mem();
        // No row for a date = "unknown", which the engine reads as Normal —
        // never persisted, never inferred.
        assert!(get_inner(&c, "2026-09-01").unwrap().is_none());
        set_inner(&c, &row("2026-09-01", "low")).unwrap();
        assert_eq!(
            get_inner(&c, "2026-09-01").unwrap().unwrap().capacity_level,
            "low"
        );
    }

    #[test]
    fn upsert_is_one_row_per_date() {
        let c = mem();
        set_inner(&c, &row("2026-09-01", "low")).unwrap();
        let mut hi = row("2026-09-01", "high");
        hi.updated_at = "2026-09-01T20:00:00.000Z".into();
        set_inner(&c, &hi).unwrap();
        let all = load_all_inner(&c).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].capacity_level, "high");
    }

    #[test]
    fn rejects_an_unknown_level_or_source() {
        let c = mem();
        let mut bad = row("2026-09-01", "exhausted");
        assert!(set_inner(&c, &bad).is_err());
        bad.capacity_level = "normal".into();
        bad.source = "ai-inferred".into();
        assert!(set_inner(&c, &bad).is_err(), "clock/AI cannot infer capacity");
    }

    #[test]
    fn capture_approved_source_is_allowed() {
        let c = mem();
        let mut r = row("2026-09-02", "high");
        r.source = "capture-approved".into();
        r.note = "said: feeling sharp today".into();
        set_inner(&c, &r).unwrap();
        assert_eq!(get_inner(&c, "2026-09-02").unwrap().unwrap().source, "capture-approved");
    }

    #[test]
    fn wire_shape_matches_the_frontend_payload() {
        let json = serde_json::json!({
            "date": "2026-09-01",
            "capacityLevel": "low",
            "source": "user",
            "note": "short night",
            "createdAt": "2026-09-01T07:00:00.000Z",
            "updatedAt": "2026-09-01T07:00:00.000Z"
        });
        let parsed: TodayOperatingStateRow = serde_json::from_value(json).unwrap();
        assert_eq!(parsed.capacity_level, "low");
        let back = serde_json::to_value(&parsed).unwrap();
        assert_eq!(back["capacityLevel"], "low");
        assert!(back.get("capacity_level").is_none());
    }
}
