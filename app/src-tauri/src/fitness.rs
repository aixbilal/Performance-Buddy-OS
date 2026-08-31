//! Batch 2B — canonical relational persistence for the Fitness & Recovery
//! domain. Thin data-access over the SQLite tables in migration v4 (see `db.rs`).
//!
//! Master Handoff §15 — three separate, immutable records:
//!   BASE PLAN (`fitness_plans` + `fitness_planned_sessions`)
//!     ≠ ACTUAL SESSION (`fitness_workout_sessions` — independent row, never
//!       rewrites the plan; `plan_id` / `planned_session_id` are SET NULL FKs)
//!     ≠ EVIDENCE / readiness (derived in the TS engine from
//!       `fitness_recovery_checkins`; NO readiness score is stored).
//!
//! Exercise structure crosses the boundary as a JSON array string in
//! `exercises` (planned) / `exercises_performed` (actual) — it is opaque to
//! SQL and shaped by the TS types.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_FIT_IMPORT: &str = "fitness_relational_import";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanRow {
    pub id: String,
    pub title: String,
    pub status: String,
    pub current_week: i64,
    pub total_weeks: i64,
    pub days_per_week: i64,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedSessionRow {
    pub id: String,
    pub plan_id: String,
    pub day_of_week: i64,
    pub title: String,
    /// JSON array string of planned exercises.
    pub exercises: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionRow {
    pub id: String,
    pub plan_id: Option<String>,
    pub planned_session_id: Option<String>,
    pub date: String,
    pub title: String,
    /// JSON array string of actual performed results.
    pub exercises_performed: String,
    pub notes: String,
    pub completed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCheckinRow {
    pub id: String,
    pub date: String,
    pub sleep_hours: f64,
    pub soreness: String,
    pub energy: String,
    pub motivation: String,
    pub stress_level: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FitnessGraph {
    pub plans: Vec<PlanRow>,
    pub planned_sessions: Vec<PlannedSessionRow>,
    pub workout_sessions: Vec<WorkoutSessionRow>,
    pub checkins: Vec<RecoveryCheckinRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FitnessImport {
    pub plans: Vec<PlanRow>,
    pub planned_sessions: Vec<PlannedSessionRow>,
    pub workout_sessions: Vec<WorkoutSessionRow>,
    pub checkins: Vec<RecoveryCheckinRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FitnessImportReport {
    pub ran: bool,
    pub plans_imported: usize,
    pub planned_sessions_imported: usize,
    pub workout_sessions_imported: usize,
    pub checkins_imported: usize,
    pub plans_skipped_existing: usize,
    pub planned_sessions_skipped_existing: usize,
    pub workout_sessions_skipped_existing: usize,
    pub checkins_skipped_existing: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<FitnessGraph> {
    let mut ps = conn.prepare(
        "SELECT id,title,status,current_week,total_weeks,days_per_week,archived,created_at,updated_at
         FROM fitness_plans ORDER BY created_at",
    )?;
    let plans = ps
        .query_map([], |r| {
            Ok(PlanRow {
                id: r.get(0)?,
                title: r.get(1)?,
                status: r.get(2)?,
                current_week: r.get(3)?,
                total_weeks: r.get(4)?,
                days_per_week: r.get(5)?,
                archived: r.get::<_, i64>(6)? != 0,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut sess = conn.prepare(
        "SELECT id,plan_id,day_of_week,title,exercises,created_at,updated_at
         FROM fitness_planned_sessions ORDER BY plan_id, day_of_week, created_at",
    )?;
    let planned_sessions = sess
        .query_map([], |r| {
            Ok(PlannedSessionRow {
                id: r.get(0)?,
                plan_id: r.get(1)?,
                day_of_week: r.get(2)?,
                title: r.get(3)?,
                exercises: r.get(4)?,
                created_at: r.get(5)?,
                updated_at: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut w = conn.prepare(
        "SELECT id,plan_id,planned_session_id,date,title,exercises_performed,notes,completed,created_at,updated_at
         FROM fitness_workout_sessions ORDER BY date, created_at",
    )?;
    let workout_sessions = w
        .query_map([], |r| {
            Ok(WorkoutSessionRow {
                id: r.get(0)?,
                plan_id: r.get(1)?,
                planned_session_id: r.get(2)?,
                date: r.get(3)?,
                title: r.get(4)?,
                exercises_performed: r.get(5)?,
                notes: r.get(6)?,
                completed: r.get::<_, i64>(7)? != 0,
                created_at: r.get(8)?,
                updated_at: r.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut c = conn.prepare(
        "SELECT id,date,sleep_hours,soreness,energy,motivation,stress_level,created_at,updated_at
         FROM fitness_recovery_checkins ORDER BY date, created_at",
    )?;
    let checkins = c
        .query_map([], |r| {
            Ok(RecoveryCheckinRow {
                id: r.get(0)?,
                date: r.get(1)?,
                sleep_hours: r.get(2)?,
                soreness: r.get(3)?,
                energy: r.get(4)?,
                motivation: r.get(5)?,
                stress_level: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(FitnessGraph {
        plans,
        planned_sessions,
        workout_sessions,
        checkins,
    })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

fn plan_upsert_inner(conn: &Connection, p: &PlanRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO fitness_plans
            (id,title,status,current_week,total_weeks,days_per_week,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, status=excluded.status, current_week=excluded.current_week,
            total_weeks=excluded.total_weeks, days_per_week=excluded.days_per_week,
            archived=excluded.archived, updated_at=excluded.updated_at",
        params![
            p.id,
            p.title,
            p.status,
            p.current_week,
            p.total_weeks,
            p.days_per_week,
            p.archived as i64,
            p.created_at,
            p.updated_at
        ],
    )?;
    Ok(())
}

fn planned_session_upsert_inner(conn: &Connection, s: &PlannedSessionRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO fitness_planned_sessions
            (id,plan_id,day_of_week,title,exercises,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(id) DO UPDATE SET
            plan_id=excluded.plan_id, day_of_week=excluded.day_of_week, title=excluded.title,
            exercises=excluded.exercises, updated_at=excluded.updated_at",
        params![
            s.id,
            s.plan_id,
            s.day_of_week,
            s.title,
            s.exercises,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

fn workout_upsert_inner(conn: &Connection, w: &WorkoutSessionRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO fitness_workout_sessions
            (id,plan_id,planned_session_id,date,title,exercises_performed,notes,completed,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            plan_id=excluded.plan_id, planned_session_id=excluded.planned_session_id,
            date=excluded.date, title=excluded.title,
            exercises_performed=excluded.exercises_performed, notes=excluded.notes,
            completed=excluded.completed, updated_at=excluded.updated_at",
        params![
            w.id,
            w.plan_id,
            w.planned_session_id,
            w.date,
            w.title,
            w.exercises_performed,
            w.notes,
            w.completed as i64,
            w.created_at,
            w.updated_at
        ],
    )?;
    Ok(())
}

fn checkin_upsert_inner(conn: &Connection, c: &RecoveryCheckinRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO fitness_recovery_checkins
            (id,date,sleep_hours,soreness,energy,motivation,stress_level,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            date=excluded.date, sleep_hours=excluded.sleep_hours, soreness=excluded.soreness,
            energy=excluded.energy, motivation=excluded.motivation,
            stress_level=excluded.stress_level, updated_at=excluded.updated_at",
        params![
            c.id,
            c.date,
            c.sleep_hours,
            c.soreness,
            c.energy,
            c.motivation,
            c.stress_level,
            c.created_at,
            c.updated_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: FitnessImport) -> DbResult<FitnessImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_FIT_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(FitnessImportReport {
            ran: false,
            plans_imported: 0,
            planned_sessions_imported: 0,
            workout_sessions_imported: 0,
            checkins_imported: 0,
            plans_skipped_existing: 0,
            planned_sessions_skipped_existing: 0,
            workout_sessions_skipped_existing: 0,
            checkins_skipped_existing: 0,
        });
    }

    let mut r = FitnessImportReport {
        ran: true,
        plans_imported: 0,
        planned_sessions_imported: 0,
        workout_sessions_imported: 0,
        checkins_imported: 0,
        plans_skipped_existing: 0,
        planned_sessions_skipped_existing: 0,
        workout_sessions_skipped_existing: 0,
        checkins_skipped_existing: 0,
    };

    let tx = conn.transaction()?;

    for p in &import.plans {
        let n = tx.execute(
            "INSERT OR IGNORE INTO fitness_plans
                (id,title,status,current_week,total_weeks,days_per_week,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                p.id, p.title, p.status, p.current_week, p.total_weeks, p.days_per_week,
                p.archived as i64, p.created_at, p.updated_at
            ],
        )?;
        if n == 1 {
            r.plans_imported += 1
        } else {
            r.plans_skipped_existing += 1
        }
    }

    for s in &import.planned_sessions {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM fitness_plans WHERE id = ?1",
                params![s.plan_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO fitness_planned_sessions
                (id,plan_id,day_of_week,title,exercises,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                s.id,
                s.plan_id,
                s.day_of_week,
                s.title,
                s.exercises,
                s.created_at,
                s.updated_at
            ],
        )?;
        if n == 1 {
            r.planned_sessions_imported += 1
        } else {
            r.planned_sessions_skipped_existing += 1
        }
    }

    for w in &import.workout_sessions {
        // Actual sessions survive even if their plan is gone — keep the row,
        // NULL the dangling FKs (history is never destroyed).
        let plan: Option<String> = match &w.plan_id {
            Some(id) => tx
                .query_row(
                    "SELECT id FROM fitness_plans WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .ok(),
            None => None,
        };
        let planned: Option<String> = match &w.planned_session_id {
            Some(id) => tx
                .query_row(
                    "SELECT id FROM fitness_planned_sessions WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .ok(),
            None => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO fitness_workout_sessions
                (id,plan_id,planned_session_id,date,title,exercises_performed,notes,completed,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                w.id, plan, planned, w.date, w.title, w.exercises_performed, w.notes,
                w.completed as i64, w.created_at, w.updated_at
            ],
        )?;
        if n == 1 {
            r.workout_sessions_imported += 1
        } else {
            r.workout_sessions_skipped_existing += 1
        }
    }

    for c in &import.checkins {
        let n = tx.execute(
            "INSERT OR IGNORE INTO fitness_recovery_checkins
                (id,date,sleep_hours,soreness,energy,motivation,stress_level,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                c.id,
                c.date,
                c.sleep_hours,
                c.soreness,
                c.energy,
                c.motivation,
                c.stress_level,
                c.created_at,
                c.updated_at
            ],
        )?;
        if n == 1 {
            r.checkins_imported += 1
        } else {
            r.checkins_skipped_existing += 1
        }
    }

    let marker = serde_json::json!({
        "version": 1,
        "plansImported": r.plans_imported,
        "plannedSessionsImported": r.planned_sessions_imported,
        "workoutSessionsImported": r.workout_sessions_imported,
        "checkinsImported": r.checkins_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_FIT_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn fit_load(db: State<'_, Db>) -> DbResult<FitnessGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn fit_plan_upsert(db: State<'_, Db>, plan: PlanRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    plan_upsert_inner(&conn, &plan)
}

#[tauri::command]
pub fn fit_plan_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: planned_sessions CASCADE; workout_sessions.plan_id SET NULL (history kept).
    conn.execute("DELETE FROM fitness_plans WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn fit_planned_session_upsert(db: State<'_, Db>, session: PlannedSessionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    planned_session_upsert_inner(&conn, &session)
}

#[tauri::command]
pub fn fit_planned_session_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM fitness_planned_sessions WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn fit_workout_upsert(db: State<'_, Db>, workout: WorkoutSessionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    workout_upsert_inner(&conn, &workout)
}

#[tauri::command]
pub fn fit_workout_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM fitness_workout_sessions WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn fit_checkin_upsert(db: State<'_, Db>, checkin: RecoveryCheckinRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    checkin_upsert_inner(&conn, &checkin)
}

#[tauri::command]
pub fn fit_checkin_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM fitness_recovery_checkins WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn fit_import_graph(db: State<'_, Db>, import: FitnessImport) -> DbResult<FitnessImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Fitness graph + its import marker for native E2E.
#[tauri::command]
pub fn fit_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "fit_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM fitness_workout_sessions;
         DELETE FROM fitness_planned_sessions;
         DELETE FROM fitness_plans;
         DELETE FROM fitness_recovery_checkins;
         DELETE FROM kv_store WHERE key IN
           ('pbos:fitness-plan','pbos:fitness-sessions','pbos:fitness-prescriptions','pbos:fitness-checkins');
         INSERT INTO meta (key,value) VALUES ('fitness_relational_import','{\"version\":1,\"reset\":true}')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Rust unit tests
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

    fn plan(id: &str) -> PlanRow {
        PlanRow {
            id: id.into(),
            title: "Weekly Training".into(),
            status: "active".into(),
            current_week: 1,
            total_weeks: 8,
            days_per_week: 3,
            archived: false,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn planned(id: &str, plan_id: &str, exercises: &str) -> PlannedSessionRow {
        PlannedSessionRow {
            id: id.into(),
            plan_id: plan_id.into(),
            day_of_week: 0,
            title: "Upper Body".into(),
            exercises: exercises.into(),
            created_at: "2026-01-02".into(),
            updated_at: "2026-01-02".into(),
        }
    }
    fn workout(id: &str, plan_id: Option<&str>, performed: &str) -> WorkoutSessionRow {
        WorkoutSessionRow {
            id: id.into(),
            plan_id: plan_id.map(String::from),
            planned_session_id: None,
            date: "2026-02-01".into(),
            title: "Upper Body".into(),
            exercises_performed: performed.into(),
            notes: String::new(),
            completed: true,
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
        }
    }
    fn checkin(id: &str) -> RecoveryCheckinRow {
        RecoveryCheckinRow {
            id: id.into(),
            date: "2026-02-01".into(),
            sleep_hours: 7.5,
            soreness: "none".into(),
            energy: "high".into(),
            motivation: "high".into(),
            stress_level: "normal".into(),
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
        }
    }

    #[test]
    fn base_plan_is_untouched_by_recording_an_actual_session() {
        let c = mem();
        plan_upsert_inner(&c, &plan("p1")).unwrap();
        let base = r#"[{"name":"Push-ups","sets":3,"reps":"15"}]"#;
        planned_session_upsert_inner(&c, &planned("s1", "p1", base)).unwrap();

        // record an ACTUAL that differs from the prescription
        workout_upsert_inner(
            &c,
            &WorkoutSessionRow {
                planned_session_id: Some("s1".into()),
                ..workout(
                    "w1",
                    Some("p1"),
                    r#"[{"name":"Push-ups","setsCompleted":3,"repsCompleted":"15,14,11"}]"#,
                )
            },
        )
        .unwrap();

        let g = load_inner(&c).unwrap();
        // the planned session's prescription is byte-for-byte unchanged
        assert_eq!(g.planned_sessions[0].exercises, base);
        assert_eq!(g.workout_sessions.len(), 1);
        assert!(g.workout_sessions[0]
            .exercises_performed
            .contains("15,14,11"));
        assert_eq!(
            g.workout_sessions[0].planned_session_id.as_deref(),
            Some("s1")
        );
    }

    #[test]
    fn deleting_a_plan_keeps_actual_history_and_nulls_the_fks() {
        let c = mem();
        plan_upsert_inner(&c, &plan("p1")).unwrap();
        planned_session_upsert_inner(&c, &planned("s1", "p1", "[]")).unwrap();
        workout_upsert_inner(&c, &workout("w1", Some("p1"), "[]")).unwrap();

        c.execute("DELETE FROM fitness_plans WHERE id = 'p1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.plans.len(), 0);
        assert_eq!(g.planned_sessions.len(), 0, "planned sessions cascade");
        assert_eq!(g.workout_sessions.len(), 1, "actual history survives");
        assert!(
            g.workout_sessions[0].plan_id.is_none(),
            "dangling plan FK is SET NULL, history not deleted"
        );
    }

    #[test]
    fn fk_rejects_planned_session_on_missing_plan() {
        let c = mem();
        let err = c.execute(
            "INSERT INTO fitness_planned_sessions (id,plan_id,day_of_week,title,exercises,created_at,updated_at)
             VALUES ('s1','ghost',0,'x','[]','2026-01-01','2026-01-01')",
            [],
        );
        assert!(err.is_err());
    }

    #[test]
    fn no_readiness_column_exists_readiness_is_derived() {
        let c = mem();
        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('fitness_recovery_checkins')")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(!cols
            .iter()
            .any(|c| c.contains("readiness") || c.contains("score")));
        assert!(cols.contains(&"sleep_hours".to_string()));
    }

    #[test]
    fn import_is_idempotent_non_destructive_and_dangling_safe() {
        let c = mem();
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = FitnessImport {
            plans: vec![plan("p1")],
            planned_sessions: vec![
                planned("s1", "p1", "[]"),
                planned("s-ghost", "no-plan", "[]"),
            ],
            workout_sessions: vec![
                workout("w1", Some("p1"), "[]"),
                workout("w2", Some("ghost"), "[]"),
            ],
            checkins: vec![checkin("c1")],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.plans_imported, 1);
        assert_eq!(r1.planned_sessions_imported, 1, "s-ghost dropped");
        assert_eq!(r1.workout_sessions_imported, 2, "w2 kept with NULL plan_id");
        assert_eq!(r1.checkins_imported, 1);
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            let w2 = g.workout_sessions.iter().find(|w| w.id == "w2").unwrap();
            assert!(w2.plan_id.is_none());
        }

        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE fitness_plans SET title = 'EDITED' WHERE id = 'p1'",
                [],
            )
            .unwrap();
        }
        let imp2 = FitnessImport {
            plans: vec![plan("p1")],
            planned_sessions: vec![],
            workout_sessions: vec![],
            checkins: vec![],
        };
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp2).unwrap()
        };
        assert!(!r2.ran);
        {
            let conn = db.0.lock().unwrap();
            assert_eq!(load_inner(&conn).unwrap().plans[0].title, "EDITED");
        }
    }

    #[test]
    fn upsert_preserves_created_at_on_update() {
        let c = mem();
        plan_upsert_inner(&c, &plan("p1")).unwrap();
        let mut edited = plan("p1");
        edited.title = "Renamed".into();
        edited.created_at = "2099-12-31".into();
        plan_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.plans[0].title, "Renamed");
        assert_eq!(g.plans[0].created_at, "2026-01-01");
    }
}
