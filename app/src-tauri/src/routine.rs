//! Batch 2B — canonical relational persistence for the Routines & Daily Life
//! domain. Thin data-access over the SQLite tables in migration v4 (see `db.rs`).
//!
//! Product model (V1 Day 08 decision specs):
//!   ROUTINE ≠ ACTION ≠ SYSTEM ≠ GOAL. A Routine is a repeatable personal
//!   behavior. It MAY reference a canonical System (`routines.related_system_id`
//!   -> `systems.id`, ON DELETE SET NULL) but never duplicates System/Action
//!   data, and checking one in never creates an Action row.
//!
//!   Consistency / streak is DERIVED in the TS engine from `routine_logs` +
//!   the schedule — it is NEVER stored. `routine_logs` is the actual history.
//!
//! The weekday schedule crosses the boundary as a JSON int array string in
//! `schedule_days`; it is opaque to SQL and shaped by the TS types.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_RTN_IMPORT: &str = "routine_relational_import";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineRow {
    pub id: String,
    pub title: String,
    pub category: String,
    pub time_window: String,
    pub schedule_type: String,
    /// JSON int array string, weekdays 0=Mon..6=Sun (used by `weekly-days`).
    pub schedule_days: String,
    pub schedule_target: Option<i64>,
    pub completion_type: String,
    pub target_quantity: Option<f64>,
    pub target_unit: Option<String>,
    pub target_duration_minutes: Option<i64>,
    pub priority: String,
    pub related_system_id: Option<String>,
    pub paused: bool,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineLogRow {
    pub id: String,
    pub routine_id: String,
    pub date: String,
    pub state: String,
    pub quantity_completed: Option<f64>,
    pub duration_completed_minutes: Option<i64>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineGraph {
    pub routines: Vec<RoutineRow>,
    pub logs: Vec<RoutineLogRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineImport {
    pub routines: Vec<RoutineRow>,
    pub logs: Vec<RoutineLogRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutineImportReport {
    pub ran: bool,
    pub routines_imported: usize,
    pub logs_imported: usize,
    pub routines_skipped_existing: usize,
    pub logs_skipped_existing: usize,
    pub system_links_cleared: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<RoutineGraph> {
    let mut rs = conn.prepare(
        "SELECT id,title,category,time_window,schedule_type,schedule_days,schedule_target,
                completion_type,target_quantity,target_unit,target_duration_minutes,
                priority,related_system_id,paused,archived,created_at,updated_at
         FROM routines ORDER BY created_at",
    )?;
    let routines = rs
        .query_map([], |r| {
            Ok(RoutineRow {
                id: r.get(0)?,
                title: r.get(1)?,
                category: r.get(2)?,
                time_window: r.get(3)?,
                schedule_type: r.get(4)?,
                schedule_days: r.get(5)?,
                schedule_target: r.get(6)?,
                completion_type: r.get(7)?,
                target_quantity: r.get(8)?,
                target_unit: r.get(9)?,
                target_duration_minutes: r.get(10)?,
                priority: r.get(11)?,
                related_system_id: r.get(12)?,
                paused: r.get::<_, i64>(13)? != 0,
                archived: r.get::<_, i64>(14)? != 0,
                created_at: r.get(15)?,
                updated_at: r.get(16)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ls = conn.prepare(
        "SELECT id,routine_id,date,state,quantity_completed,duration_completed_minutes,
                completed_at,created_at,updated_at
         FROM routine_logs ORDER BY date, created_at",
    )?;
    let logs = ls
        .query_map([], |r| {
            Ok(RoutineLogRow {
                id: r.get(0)?,
                routine_id: r.get(1)?,
                date: r.get(2)?,
                state: r.get(3)?,
                quantity_completed: r.get(4)?,
                duration_completed_minutes: r.get(5)?,
                completed_at: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(RoutineGraph { routines, logs })
}

// ---------------------------------------------------------------------------
// Writes (upsert = create-or-replace by id, preserving created_at on update)
// ---------------------------------------------------------------------------

/// Resolve a candidate system id to `Some(id)` only if that system exists,
/// otherwise `None` — so a dangling reference is stored as NULL rather than
/// rejected by the FK. (Deleting the system later is handled by the schema's
/// ON DELETE SET NULL.)
fn resolve_system(conn: &Connection, candidate: &Option<String>) -> Option<String> {
    match candidate {
        Some(id) if !id.is_empty() => conn
            .query_row("SELECT id FROM systems WHERE id = ?1", params![id], |row| {
                row.get(0)
            })
            .ok(),
        _ => None,
    }
}

fn routine_upsert_inner(conn: &Connection, r: &RoutineRow) -> DbResult<()> {
    let system = resolve_system(conn, &r.related_system_id);
    conn.execute(
        "INSERT INTO routines
            (id,title,category,time_window,schedule_type,schedule_days,schedule_target,
             completion_type,target_quantity,target_unit,target_duration_minutes,
             priority,related_system_id,paused,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, category=excluded.category, time_window=excluded.time_window,
            schedule_type=excluded.schedule_type, schedule_days=excluded.schedule_days,
            schedule_target=excluded.schedule_target, completion_type=excluded.completion_type,
            target_quantity=excluded.target_quantity, target_unit=excluded.target_unit,
            target_duration_minutes=excluded.target_duration_minutes, priority=excluded.priority,
            related_system_id=excluded.related_system_id, paused=excluded.paused,
            archived=excluded.archived, updated_at=excluded.updated_at",
        params![
            r.id,
            r.title,
            r.category,
            r.time_window,
            r.schedule_type,
            r.schedule_days,
            r.schedule_target,
            r.completion_type,
            r.target_quantity,
            r.target_unit,
            r.target_duration_minutes,
            r.priority,
            system,
            r.paused as i64,
            r.archived as i64,
            r.created_at,
            r.updated_at
        ],
    )?;
    Ok(())
}

fn log_upsert_inner(conn: &Connection, l: &RoutineLogRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO routine_logs
            (id,routine_id,date,state,quantity_completed,duration_completed_minutes,
             completed_at,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            routine_id=excluded.routine_id, date=excluded.date, state=excluded.state,
            quantity_completed=excluded.quantity_completed,
            duration_completed_minutes=excluded.duration_completed_minutes,
            completed_at=excluded.completed_at, updated_at=excluded.updated_at",
        params![
            l.id,
            l.routine_id,
            l.date,
            l.state,
            l.quantity_completed,
            l.duration_completed_minutes,
            l.completed_at,
            l.created_at,
            l.updated_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: RoutineImport) -> DbResult<RoutineImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_RTN_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(RoutineImportReport {
            ran: false,
            routines_imported: 0,
            logs_imported: 0,
            routines_skipped_existing: 0,
            logs_skipped_existing: 0,
            system_links_cleared: 0,
        });
    }

    let mut r = RoutineImportReport {
        ran: true,
        routines_imported: 0,
        logs_imported: 0,
        routines_skipped_existing: 0,
        logs_skipped_existing: 0,
        system_links_cleared: 0,
    };

    let tx = conn.transaction()?;

    for rt in &import.routines {
        // Clear a dangling System link rather than dropping the Routine.
        let system: Option<String> = match &rt.related_system_id {
            Some(id) if !id.is_empty() => {
                let ok: Option<String> = tx
                    .query_row("SELECT id FROM systems WHERE id = ?1", params![id], |row| {
                        row.get(0)
                    })
                    .ok();
                if ok.is_none() {
                    r.system_links_cleared += 1;
                }
                ok
            }
            _ => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO routines
                (id,title,category,time_window,schedule_type,schedule_days,schedule_target,
                 completion_type,target_quantity,target_unit,target_duration_minutes,
                 priority,related_system_id,paused,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
            params![
                rt.id,
                rt.title,
                rt.category,
                rt.time_window,
                rt.schedule_type,
                rt.schedule_days,
                rt.schedule_target,
                rt.completion_type,
                rt.target_quantity,
                rt.target_unit,
                rt.target_duration_minutes,
                rt.priority,
                system,
                rt.paused as i64,
                rt.archived as i64,
                rt.created_at,
                rt.updated_at
            ],
        )?;
        if n == 1 {
            r.routines_imported += 1
        } else {
            r.routines_skipped_existing += 1
        }
    }

    for l in &import.logs {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM routines WHERE id = ?1",
                params![l.routine_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO routine_logs
                (id,routine_id,date,state,quantity_completed,duration_completed_minutes,
                 completed_at,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                l.id,
                l.routine_id,
                l.date,
                l.state,
                l.quantity_completed,
                l.duration_completed_minutes,
                l.completed_at,
                l.created_at,
                l.updated_at
            ],
        )?;
        if n == 1 {
            r.logs_imported += 1
        } else {
            r.logs_skipped_existing += 1
        }
    }

    let marker = serde_json::json!({
        "version": 1,
        "routinesImported": r.routines_imported,
        "logsImported": r.logs_imported,
        "systemLinksCleared": r.system_links_cleared,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_RTN_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn rtn_load(db: State<'_, Db>) -> DbResult<RoutineGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn rtn_routine_upsert(db: State<'_, Db>, routine: RoutineRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    routine_upsert_inner(&conn, &routine)
}

#[tauri::command]
pub fn rtn_routine_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: routine_logs CASCADE (history goes with the routine, per the intended
    // policy — a deleted routine is gone, not archived).
    conn.execute("DELETE FROM routines WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn rtn_log_upsert(db: State<'_, Db>, log: RoutineLogRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    log_upsert_inner(&conn, &log)
}

#[tauri::command]
pub fn rtn_log_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM routine_logs WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn rtn_import_graph(db: State<'_, Db>, import: RoutineImport) -> DbResult<RoutineImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Routine graph + its import marker so native E2E can
/// run the real-user scenario from a clean state.
#[tauri::command]
pub fn rtn_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "rtn_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM routine_logs;
         DELETE FROM routines;
         DELETE FROM kv_store WHERE key IN
           ('pbos:routine-definitions','pbos:routine-logs');
         INSERT INTO meta (key,value) VALUES ('routine_relational_import','{\"version\":1,\"reset\":true}')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
    )?;
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

    fn system(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO systems (id,title,description,domain,cadence,tags,starred,created_at,updated_at)
             VALUES (?1,'A System','','fitness','','[]',0,'2026-01-01','2026-01-01')",
            params![id],
        )
        .unwrap();
    }

    fn routine(id: &str, system_id: Option<&str>) -> RoutineRow {
        RoutineRow {
            id: id.into(),
            title: "Morning Mobility".into(),
            category: "Personal Care".into(),
            time_window: "morning".into(),
            schedule_type: "daily".into(),
            schedule_days: "[]".into(),
            schedule_target: None,
            completion_type: "boolean".into(),
            target_quantity: None,
            target_unit: None,
            target_duration_minutes: None,
            priority: "important".into(),
            related_system_id: system_id.map(String::from),
            paused: false,
            archived: false,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }

    fn log(id: &str, routine_id: &str, date: &str, state: &str) -> RoutineLogRow {
        RoutineLogRow {
            id: id.into(),
            routine_id: routine_id.into(),
            date: date.into(),
            state: state.into(),
            quantity_completed: None,
            duration_completed_minutes: None,
            completed_at: Some("2026-02-01T08:00:00Z".into()),
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
        }
    }

    #[test]
    fn crud_and_log_cascade_delete() {
        let c = mem();
        routine_upsert_inner(&c, &routine("r1", None)).unwrap();
        log_upsert_inner(&c, &log("l1", "r1", "2026-02-01", "complete")).unwrap();
        log_upsert_inner(&c, &log("l2", "r1", "2026-02-02", "missed")).unwrap();

        let g = load_inner(&c).unwrap();
        assert_eq!(g.routines.len(), 1);
        assert_eq!(g.logs.len(), 2);

        c.execute("DELETE FROM routines WHERE id = 'r1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.routines.len(), 0);
        assert_eq!(g.logs.len(), 0, "logs cascade with the routine");
    }

    #[test]
    fn deleting_a_system_nulls_the_link_but_keeps_the_routine() {
        let c = mem();
        system(&c, "sys1");
        routine_upsert_inner(&c, &routine("r1", Some("sys1"))).unwrap();
        assert_eq!(
            load_inner(&c).unwrap().routines[0]
                .related_system_id
                .as_deref(),
            Some("sys1")
        );

        c.execute("DELETE FROM systems WHERE id = 'sys1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.routines.len(), 1, "routine survives its system");
        assert!(
            g.routines[0].related_system_id.is_none(),
            "related_system_id is SET NULL, not deleted"
        );
    }

    #[test]
    fn upsert_stores_a_dangling_system_link_as_null_not_an_fk_error() {
        let c = mem();
        // no such system — must not throw, must store NULL
        routine_upsert_inner(&c, &routine("r1", Some("ghost-sys"))).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.routines.len(), 1);
        assert!(g.routines[0].related_system_id.is_none());
    }

    #[test]
    fn no_consistency_or_streak_column_exists() {
        let c = mem();
        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('routines')")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(
            !cols.iter().any(|c| c.contains("consistency")
                || c.contains("streak")
                || c.contains("compliance")),
            "consistency/streak is derived from logs + schedule, never stored"
        );
        assert!(cols.contains(&"schedule_type".to_string()));
    }

    #[test]
    fn fk_rejects_log_on_missing_routine() {
        let c = mem();
        let err = c.execute(
            "INSERT INTO routine_logs (id,routine_id,date,state,created_at,updated_at)
             VALUES ('l1','ghost','2026-02-01','complete','2026-02-01','2026-02-01')",
            [],
        );
        assert!(err.is_err());
    }

    #[test]
    fn import_is_idempotent_non_destructive_and_dangling_safe() {
        let c = mem();
        system(&c, "sys1");
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = RoutineImport {
            routines: vec![
                routine("r1", Some("sys1")),
                routine("r2", Some("ghost-sys")), // link cleared, routine kept
            ],
            logs: vec![
                log("l1", "r1", "2026-02-01", "complete"),
                log("l-ghost", "no-routine", "2026-02-01", "complete"), // dropped
            ],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.routines_imported, 2);
        assert_eq!(r1.logs_imported, 1, "dangling log dropped");
        assert_eq!(r1.system_links_cleared, 1);
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            let r2 = g.routines.iter().find(|x| x.id == "r2").unwrap();
            assert!(
                r2.related_system_id.is_none(),
                "dangling system link cleared"
            );
        }

        // mutate, re-import: no-op that preserves the edit
        {
            let conn = db.0.lock().unwrap();
            conn.execute("UPDATE routines SET title = 'EDITED' WHERE id = 'r1'", [])
                .unwrap();
        }
        let imp2 = RoutineImport {
            routines: vec![routine("r1", Some("sys1"))],
            logs: vec![],
        };
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp2).unwrap()
        };
        assert!(!r2.ran);
        {
            let conn = db.0.lock().unwrap();
            assert_eq!(load_inner(&conn).unwrap().routines[0].title, "EDITED");
        }
    }

    #[test]
    fn upsert_preserves_created_at_on_update() {
        let c = mem();
        routine_upsert_inner(&c, &routine("r1", None)).unwrap();
        let mut edited = routine("r1", None);
        edited.title = "Renamed".into();
        edited.created_at = "2099-12-31".into();
        routine_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.routines[0].title, "Renamed");
        assert_eq!(g.routines[0].created_at, "2026-01-01");
    }

    #[test]
    fn log_upsert_updates_state_without_creating_a_duplicate() {
        let c = mem();
        routine_upsert_inner(&c, &routine("r1", None)).unwrap();
        log_upsert_inner(&c, &log("l1", "r1", "2026-02-01", "partial")).unwrap();
        let mut changed = log("l1", "r1", "2026-02-01", "complete");
        changed.created_at = "2099-01-01".into();
        log_upsert_inner(&c, &changed).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.logs.len(), 1, "same id → one canonical log");
        assert_eq!(g.logs[0].state, "complete");
        assert_eq!(g.logs[0].created_at, "2026-02-01", "created_at preserved");
    }
}
