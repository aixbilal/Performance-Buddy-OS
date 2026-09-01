//! Batch 3 — canonical relational persistence for the Planning & Calendar
//! domain (the PLAN stage of the operating loop). Thin data-access over the
//! SQLite tables in migration v5 (see `db.rs`).
//!
//! Product model (Planner / Calendar / Plan Builder decision specs):
//!   ACTION ≠ PLANNING BLOCK ≠ CALENDAR EVENT ≠ COMPLETION.
//!   A `planning_block` is scheduled time/intention. It MAY reference the
//!   canonical Action it schedules (`planning_blocks.action_id` -> `actions.id`,
//!   ON DELETE SET NULL) — an Action has zero or more blocks, and deleting the
//!   Action keeps the planning history with the link nulled. The block never
//!   duplicates Action title/status/deadline as authoritative state.
//!
//!   `status` here is block-local ('scheduled'|'done'|'skipped') — it is NOT
//!   Action completion. `locked` marks a manual decision that survives plan
//!   regeneration. Conflict/capacity is DERIVED in the TS engine, never stored.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_PLANNING_IMPORT: &str = "planning_relational_import";
const CAPACITY_ID: &str = "default";

// ---------------------------------------------------------------------------
// Row types (camelCase across the Tauri boundary)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningBlockRow {
    pub id: String,
    pub title: String,
    pub domain: String,
    pub action_id: Option<String>,
    // The canonical frontend model (`app/src/domains/planning/types.ts`) names
    // these `day` and `type`; the SQLite columns are `day_of_week` / `block_type`.
    // The wire names MUST match the frontend or `plan_block_upsert` /
    // `plan_import_graph` fail to deserialize and no block is ever persisted.
    #[serde(rename = "day")]
    pub day_of_week: i64,
    pub date: Option<String>,
    pub start_minute: i64,
    pub end_minute: i64,
    #[serde(rename = "type")]
    pub block_type: String,
    pub locked: bool,
    pub source: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapacityRow {
    pub daily_minutes: i64,
    pub weekly_minutes: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningGraph {
    pub blocks: Vec<PlanningBlockRow>,
    pub capacity: CapacityRow,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningImport {
    pub blocks: Vec<PlanningBlockRow>,
    pub capacity: Option<CapacityRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningImportReport {
    pub ran: bool,
    pub blocks_imported: usize,
    pub blocks_skipped_existing: usize,
    pub action_links_cleared: usize,
    pub capacity_imported: bool,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_capacity(conn: &Connection) -> DbResult<CapacityRow> {
    let row = conn
        .query_row(
            "SELECT daily_minutes, weekly_minutes FROM planning_capacity WHERE id = ?1",
            params![CAPACITY_ID],
            |r| {
                Ok(CapacityRow {
                    daily_minutes: r.get(0)?,
                    weekly_minutes: r.get(1)?,
                })
            },
        )
        .optional()?;
    Ok(row.unwrap_or(CapacityRow {
        daily_minutes: 150,
        weekly_minutes: 840,
    }))
}

fn load_inner(conn: &Connection) -> DbResult<PlanningGraph> {
    let mut bs = conn.prepare(
        "SELECT id,title,domain,action_id,day_of_week,date,start_minute,end_minute,
                block_type,locked,source,status,created_at,updated_at
         FROM planning_blocks ORDER BY day_of_week, start_minute, created_at",
    )?;
    let blocks = bs
        .query_map([], |r| {
            Ok(PlanningBlockRow {
                id: r.get(0)?,
                title: r.get(1)?,
                domain: r.get(2)?,
                action_id: r.get(3)?,
                day_of_week: r.get(4)?,
                date: r.get(5)?,
                start_minute: r.get(6)?,
                end_minute: r.get(7)?,
                block_type: r.get(8)?,
                locked: r.get::<_, i64>(9)? != 0,
                source: r.get(10)?,
                status: r.get(11)?,
                created_at: r.get(12)?,
                updated_at: r.get(13)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(PlanningGraph {
        blocks,
        capacity: load_capacity(conn)?,
    })
}

// ---------------------------------------------------------------------------
// Writes (upsert = create-or-replace by id, preserving created_at on update)
// ---------------------------------------------------------------------------

/// Resolve a candidate Action id to `Some(id)` only if that Action exists,
/// otherwise `None` — a dangling reference is stored as NULL, not rejected.
fn resolve_action(conn: &Connection, candidate: &Option<String>) -> Option<String> {
    match candidate {
        Some(id) if !id.is_empty() => conn
            .query_row("SELECT id FROM actions WHERE id = ?1", params![id], |row| {
                row.get(0)
            })
            .ok(),
        _ => None,
    }
}

fn block_upsert_inner(conn: &Connection, b: &PlanningBlockRow) -> DbResult<()> {
    let action = resolve_action(conn, &b.action_id);
    conn.execute(
        "INSERT INTO planning_blocks
            (id,title,domain,action_id,day_of_week,date,start_minute,end_minute,
             block_type,locked,source,status,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, domain=excluded.domain, action_id=excluded.action_id,
            day_of_week=excluded.day_of_week, date=excluded.date,
            start_minute=excluded.start_minute, end_minute=excluded.end_minute,
            block_type=excluded.block_type, locked=excluded.locked,
            source=excluded.source, status=excluded.status, updated_at=excluded.updated_at",
        params![
            b.id,
            b.title,
            b.domain,
            action,
            b.day_of_week,
            b.date,
            b.start_minute,
            b.end_minute,
            b.block_type,
            b.locked as i64,
            b.source,
            b.status,
            b.created_at,
            b.updated_at
        ],
    )?;
    Ok(())
}

fn capacity_set_inner(conn: &Connection, c: &CapacityRow, now: &str) -> DbResult<()> {
    conn.execute(
        "INSERT INTO planning_capacity (id, daily_minutes, weekly_minutes, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
            daily_minutes=excluded.daily_minutes,
            weekly_minutes=excluded.weekly_minutes,
            updated_at=excluded.updated_at",
        params![CAPACITY_ID, c.daily_minutes, c.weekly_minutes, now],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: PlanningImport) -> DbResult<PlanningImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_PLANNING_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(PlanningImportReport {
            ran: false,
            blocks_imported: 0,
            blocks_skipped_existing: 0,
            action_links_cleared: 0,
            capacity_imported: false,
        });
    }

    let mut r = PlanningImportReport {
        ran: true,
        blocks_imported: 0,
        blocks_skipped_existing: 0,
        action_links_cleared: 0,
        capacity_imported: false,
    };

    let tx = conn.transaction()?;

    for b in &import.blocks {
        let action: Option<String> = match &b.action_id {
            Some(id) if !id.is_empty() => {
                let ok: Option<String> = tx
                    .query_row("SELECT id FROM actions WHERE id = ?1", params![id], |row| {
                        row.get(0)
                    })
                    .ok();
                if ok.is_none() {
                    r.action_links_cleared += 1;
                }
                ok
            }
            _ => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO planning_blocks
                (id,title,domain,action_id,day_of_week,date,start_minute,end_minute,
                 block_type,locked,source,status,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                b.id,
                b.title,
                b.domain,
                action,
                b.day_of_week,
                b.date,
                b.start_minute,
                b.end_minute,
                b.block_type,
                b.locked as i64,
                b.source,
                b.status,
                b.created_at,
                b.updated_at
            ],
        )?;
        if n == 1 {
            r.blocks_imported += 1
        } else {
            r.blocks_skipped_existing += 1
        }
    }

    if let Some(cap) = &import.capacity {
        let exists: bool = tx
            .query_row(
                "SELECT 1 FROM planning_capacity WHERE id = ?1",
                params![CAPACITY_ID],
                |_| Ok(()),
            )
            .optional()?
            .is_some();
        if !exists {
            capacity_set_inner(&tx, cap, "1970-01-01T00:00:00.000Z")?;
            r.capacity_imported = true;
        }
    }

    let marker = serde_json::json!({
        "version": 1,
        "blocksImported": r.blocks_imported,
        "actionLinksCleared": r.action_links_cleared,
        "capacityImported": r.capacity_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_PLANNING_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn plan_load(db: State<'_, Db>) -> DbResult<PlanningGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn plan_block_upsert(db: State<'_, Db>, block: PlanningBlockRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    block_upsert_inner(&conn, &block)
}

#[tauri::command]
pub fn plan_block_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM planning_blocks WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn plan_capacity_set(db: State<'_, Db>, capacity: CapacityRow, now: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    capacity_set_inner(&conn, &capacity, &now)
}

#[tauri::command]
pub fn plan_import_graph(
    db: State<'_, Db>,
    import: PlanningImport,
) -> DbResult<PlanningImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Planning graph + its import marker so native E2E can
/// run the real-user scenario from a clean state.
#[tauri::command]
pub fn plan_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "plan_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM planning_blocks;
         DELETE FROM planning_capacity;
         DELETE FROM kv_store WHERE key IN ('pbos:planning-blocks','pbos:planning-capacity');
         INSERT INTO meta (key,value) VALUES ('planning_relational_import','{\"version\":1,\"reset\":true}')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
    )?;
    Ok(())
}

// ===========================================================================
// V2 — Adaptive Planning persistence (migration v11, blueprint 07 §6.3–§6.5,
// §10). Three slices, all layered ON the one canonical `planning_blocks`
// schedule — none of them is a second calendar.
//
//   `action_scheduling_constraints` : structured scheduling metadata for a
//       canonical Action (1:1, CASCADE). Not a task list; does not restate
//       `actions.est_minutes`. `splittable` defaults to 0 — work is never
//       assumed fragmentable.
//   `planning_occurrence_exceptions` : the state of ONE date of a recurring
//       block WITHOUT mutating the recurring template. A one-off move points
//       `replacement_block_id` at a concrete date-pinned block.
//   `planning_change_sets` : the durable Planning Diff — proposed + inverse
//       changes for review / audit / undo only. `changes_json` is opaque here
//       and typed at the TS boundary.
// ===========================================================================

const PREFERRED_WINDOWS: [&str; 4] = ["morning", "day", "evening", "anytime"];
const OCCURRENCE_STATES: [&str; 3] = ["skipped", "done", "deferred"];
const CHANGE_SET_SCOPES: [&str; 3] = ["micro", "day", "week"];
const CHANGE_SET_STATUS: [&str; 5] = ["proposed", "applied", "rejected", "apply-failed", "undone"];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionSchedulingConstraintRow {
    pub action_id: String,
    pub required_before: Option<String>,
    pub earliest_date: Option<String>,
    pub preferred_time_window: Option<String>,
    pub minimum_block_minutes: Option<i64>,
    #[serde(default)]
    pub splittable: bool,
    #[serde(default = "default_user_source")]
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OccurrenceExceptionRow {
    pub id: String,
    pub block_id: String,
    pub occurrence_date: String,
    pub state: String,
    pub replacement_block_id: Option<String>,
    #[serde(default = "default_user_source")]
    pub source: String,
    #[serde(default)]
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanningChangeSetRow {
    pub id: String,
    pub scope: String,
    pub status: String,
    pub target_start_date: Option<String>,
    pub target_end_date: Option<String>,
    #[serde(default)]
    pub rationale: String,
    #[serde(default = "default_json_array")]
    pub reason_codes_json: String,
    #[serde(default = "default_json_array")]
    pub changes_json: String,
    #[serde(default = "default_json_array")]
    pub inverse_changes_json: String,
    #[serde(default = "default_change_set_source")]
    pub source: String,
    pub created_at: String,
    pub decided_at: Option<String>,
    pub applied_at: Option<String>,
    pub undone_at: Option<String>,
}

fn default_user_source() -> String {
    "user".into()
}
fn default_change_set_source() -> String {
    "adaptive-planning".into()
}
fn default_json_array() -> String {
    "[]".into()
}

// -- action_scheduling_constraints -----------------------------------------

fn constraints_load_inner(conn: &Connection) -> DbResult<Vec<ActionSchedulingConstraintRow>> {
    let mut s = conn.prepare(
        "SELECT action_id,required_before,earliest_date,preferred_time_window,minimum_block_minutes,
                splittable,source,created_at,updated_at
         FROM action_scheduling_constraints ORDER BY action_id",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(ActionSchedulingConstraintRow {
                action_id: r.get(0)?,
                required_before: r.get(1)?,
                earliest_date: r.get(2)?,
                preferred_time_window: r.get(3)?,
                minimum_block_minutes: r.get(4)?,
                splittable: r.get::<_, i64>(5)? != 0,
                source: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn constraint_upsert_inner(conn: &Connection, c: &ActionSchedulingConstraintRow) -> DbResult<()> {
    if let Some(w) = &c.preferred_time_window {
        if !PREFERRED_WINDOWS.contains(&w.as_str()) {
            return Err(DbError::Forbidden(format!(
                "preferred_time_window must be one of {PREFERRED_WINDOWS:?}, got `{w}`"
            )));
        }
    }
    // A dangling Action reference is rejected by the FK — the constraint is
    // meaningless without its Action (unlike a planning block, which survives).
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM actions WHERE id = ?1",
            params![c.action_id],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    if !exists {
        return Err(DbError::Forbidden(
            "action_scheduling_constraints needs an existing Action".into(),
        ));
    }
    conn.execute(
        "INSERT INTO action_scheduling_constraints
            (action_id,required_before,earliest_date,preferred_time_window,minimum_block_minutes,
             splittable,source,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(action_id) DO UPDATE SET
            required_before=excluded.required_before, earliest_date=excluded.earliest_date,
            preferred_time_window=excluded.preferred_time_window,
            minimum_block_minutes=excluded.minimum_block_minutes,
            splittable=excluded.splittable, source=excluded.source,
            updated_at=excluded.updated_at",
        params![
            c.action_id,
            c.required_before,
            c.earliest_date,
            c.preferred_time_window,
            c.minimum_block_minutes,
            c.splittable as i64,
            c.source,
            c.created_at,
            c.updated_at
        ],
    )?;
    Ok(())
}

// -- planning_occurrence_exceptions --------------------------------------

fn occurrences_load_inner(conn: &Connection) -> DbResult<Vec<OccurrenceExceptionRow>> {
    let mut s = conn.prepare(
        "SELECT id,block_id,occurrence_date,state,replacement_block_id,source,note,created_at,updated_at
         FROM planning_occurrence_exceptions ORDER BY occurrence_date, block_id",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(OccurrenceExceptionRow {
                id: r.get(0)?,
                block_id: r.get(1)?,
                occurrence_date: r.get(2)?,
                state: r.get(3)?,
                replacement_block_id: r.get(4)?,
                source: r.get(5)?,
                note: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn occurrence_upsert_inner(conn: &Connection, e: &OccurrenceExceptionRow) -> DbResult<()> {
    if !OCCURRENCE_STATES.contains(&e.state.as_str()) {
        return Err(DbError::Forbidden(format!(
            "occurrence state must be one of {OCCURRENCE_STATES:?}, got `{}`",
            e.state
        )));
    }
    let replacement = resolve_block(conn, &e.replacement_block_id);
    conn.execute(
        "INSERT INTO planning_occurrence_exceptions
            (id,block_id,occurrence_date,state,replacement_block_id,source,note,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(block_id,occurrence_date) DO UPDATE SET
            state=excluded.state, replacement_block_id=excluded.replacement_block_id,
            source=excluded.source, note=excluded.note, updated_at=excluded.updated_at",
        params![
            e.id,
            e.block_id,
            e.occurrence_date,
            e.state,
            replacement,
            e.source,
            e.note,
            e.created_at,
            e.updated_at
        ],
    )?;
    Ok(())
}

fn resolve_block(conn: &Connection, candidate: &Option<String>) -> Option<String> {
    match candidate {
        Some(id) if !id.is_empty() => conn
            .query_row(
                "SELECT id FROM planning_blocks WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .ok(),
        _ => None,
    }
}

// -- planning_change_sets ----------------------------------------------

fn change_sets_load_inner(conn: &Connection) -> DbResult<Vec<PlanningChangeSetRow>> {
    let mut s = conn.prepare(
        "SELECT id,scope,status,target_start_date,target_end_date,rationale,reason_codes_json,
                changes_json,inverse_changes_json,source,created_at,decided_at,applied_at,undone_at
         FROM planning_change_sets ORDER BY created_at DESC, id",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(PlanningChangeSetRow {
                id: r.get(0)?,
                scope: r.get(1)?,
                status: r.get(2)?,
                target_start_date: r.get(3)?,
                target_end_date: r.get(4)?,
                rationale: r.get(5)?,
                reason_codes_json: r.get(6)?,
                changes_json: r.get(7)?,
                inverse_changes_json: r.get(8)?,
                source: r.get(9)?,
                created_at: r.get(10)?,
                decided_at: r.get(11)?,
                applied_at: r.get(12)?,
                undone_at: r.get(13)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn change_set_upsert_inner(conn: &Connection, cs: &PlanningChangeSetRow) -> DbResult<()> {
    if !CHANGE_SET_SCOPES.contains(&cs.scope.as_str()) {
        return Err(DbError::Forbidden(format!(
            "change set scope must be one of {CHANGE_SET_SCOPES:?}, got `{}`",
            cs.scope
        )));
    }
    if !CHANGE_SET_STATUS.contains(&cs.status.as_str()) {
        return Err(DbError::Forbidden(format!(
            "change set status must be one of {CHANGE_SET_STATUS:?}, got `{}`",
            cs.status
        )));
    }
    for (label, json) in [
        ("changes_json", &cs.changes_json),
        ("inverse_changes_json", &cs.inverse_changes_json),
        ("reason_codes_json", &cs.reason_codes_json),
    ] {
        if serde_json::from_str::<serde_json::Value>(json).is_err() {
            return Err(DbError::Forbidden(format!("{label} must be valid JSON")));
        }
    }
    conn.execute(
        "INSERT INTO planning_change_sets
            (id,scope,status,target_start_date,target_end_date,rationale,reason_codes_json,
             changes_json,inverse_changes_json,source,created_at,decided_at,applied_at,undone_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
         ON CONFLICT(id) DO UPDATE SET
            scope=excluded.scope, status=excluded.status,
            target_start_date=excluded.target_start_date, target_end_date=excluded.target_end_date,
            rationale=excluded.rationale, reason_codes_json=excluded.reason_codes_json,
            changes_json=excluded.changes_json, inverse_changes_json=excluded.inverse_changes_json,
            source=excluded.source, decided_at=excluded.decided_at,
            applied_at=excluded.applied_at, undone_at=excluded.undone_at",
        params![
            cs.id,
            cs.scope,
            cs.status,
            cs.target_start_date,
            cs.target_end_date,
            cs.rationale,
            cs.reason_codes_json,
            cs.changes_json,
            cs.inverse_changes_json,
            cs.source,
            cs.created_at,
            cs.decided_at,
            cs.applied_at,
            cs.undone_at
        ],
    )?;
    Ok(())
}

// -- Tauri commands ------------------------------------------------------

#[tauri::command]
pub fn plan_action_constraints_load(
    db: State<'_, Db>,
) -> DbResult<Vec<ActionSchedulingConstraintRow>> {
    let conn = db.0.lock().unwrap();
    constraints_load_inner(&conn)
}

#[tauri::command]
pub fn plan_action_constraint_upsert(
    db: State<'_, Db>,
    constraint: ActionSchedulingConstraintRow,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    constraint_upsert_inner(&conn, &constraint)
}

#[tauri::command]
pub fn plan_action_constraint_delete(db: State<'_, Db>, action_id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM action_scheduling_constraints WHERE action_id = ?1",
        params![action_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn plan_occurrences_load(db: State<'_, Db>) -> DbResult<Vec<OccurrenceExceptionRow>> {
    let conn = db.0.lock().unwrap();
    occurrences_load_inner(&conn)
}

#[tauri::command]
pub fn plan_occurrence_upsert(
    db: State<'_, Db>,
    exception: OccurrenceExceptionRow,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    occurrence_upsert_inner(&conn, &exception)
}

#[tauri::command]
pub fn plan_occurrence_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM planning_occurrence_exceptions WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn plan_change_sets_load(db: State<'_, Db>) -> DbResult<Vec<PlanningChangeSetRow>> {
    let conn = db.0.lock().unwrap();
    change_sets_load_inner(&conn)
}

#[tauri::command]
pub fn plan_change_set_upsert(
    db: State<'_, Db>,
    change_set: PlanningChangeSetRow,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    change_set_upsert_inner(&conn, &change_set)
}

#[tauri::command]
pub fn plan_change_set_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM planning_change_sets WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

// ===========================================================================
// V2 hardening — TRANSACTIONAL Planning Diff apply / undo.
//
// The renderer sends a TYPED, allowlisted op list (never SQL). Rust
// re-validates the critical invariants, does a deterministic expected-before
// check for stale plan state, then applies every op inside ONE SQLite
// transaction: commit only if all succeed, automatic rollback on any error.
// The user never sees "applied" if only part persisted.
//
// Allowed forward ops mirror the persisted change vocabulary. `remove-block`
// is restricted to a `source = 'generated'`, unlocked block (so it can be the
// inverse of an `add` and nothing else); `clear-occurrence` deletes an
// exception (inverse of a `skip`/`done`/`defer`).
// ===========================================================================

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase")]
pub enum PlanChangeOp {
    Keep {
        #[allow(dead_code)]
        block_id: String,
    },
    Add {
        block: PlanningBlockRow,
    },
    Move {
        block_id: String,
        to_start_minute: i64,
    },
    Shorten {
        block_id: String,
        to_end_minute: i64,
    },
    RemoveBlock {
        block_id: String,
    },
    Defer {
        exception: OccurrenceExceptionRow,
        /// Concrete date-pinned replacement created for the deferred date.
        replacement: PlanningBlockRow,
    },
    DropOccurrence {
        exception: OccurrenceExceptionRow,
    },
    MarkOccurrenceDone {
        exception: OccurrenceExceptionRow,
    },
    MarkOccurrenceSkipped {
        exception: OccurrenceExceptionRow,
    },
    ClearOccurrence {
        block_id: String,
        occurrence_date: String,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedBlock {
    pub id: String,
    pub start_minute: i64,
    pub end_minute: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyChangeSetRequest {
    pub change_set: PlanningChangeSetRow,
    pub ops: Vec<PlanChangeOp>,
    /// Rows whose current (start,end) must still match, or the apply is refused
    /// as stale. Empty = no stale check requested.
    #[serde(default)]
    pub expected: Vec<ExpectedBlock>,
    pub now: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoChangeSetRequest {
    pub change_set_id: String,
    pub ops: Vec<PlanChangeOp>,
    pub now: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSetApplyReport {
    pub ok: bool,
    pub change_set_id: String,
    pub applied_ops: usize,
}

fn block_exists(conn: &Connection, id: &str) -> bool {
    conn.query_row("SELECT 1 FROM planning_blocks WHERE id = ?1", params![id], |_| Ok(()))
        .optional()
        .ok()
        .flatten()
        .is_some()
}

fn require_removable_generated_block(conn: &Connection, id: &str) -> DbResult<()> {
    let row: Option<(String, i64)> = conn
        .query_row(
            "SELECT source, locked FROM planning_blocks WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    match row {
        None => Err(DbError::Forbidden(format!("block `{id}` not found"))),
        Some((source, locked)) if source == "generated" && locked == 0 => Ok(()),
        Some(_) => Err(DbError::Forbidden(format!(
            "block `{id}` is not a removable generated block"
        ))),
    }
}

/// Re-validate the critical invariants of one op against current state. Does no
/// writes. Runs before the transaction so a clearly bad request is rejected
/// without opening one.
fn validate_op(conn: &Connection, op: &PlanChangeOp) -> DbResult<()> {
    match op {
        PlanChangeOp::Keep { .. } => Ok(()),
        PlanChangeOp::Add { block } => {
            if block.id.trim().is_empty() {
                return Err(DbError::Forbidden("add op needs a block id".into()));
            }
            if block.source != "generated" {
                return Err(DbError::Forbidden(
                    "an added block must have source = 'generated'".into(),
                ));
            }
            if block.end_minute <= block.start_minute {
                return Err(DbError::Forbidden("added block has an impossible time range".into()));
            }
            Ok(())
        }
        PlanChangeOp::Move {
            block_id,
            to_start_minute,
        } => {
            if !block_exists(conn, block_id) {
                return Err(DbError::Forbidden(format!("move: block `{block_id}` not found")));
            }
            if *to_start_minute < 0 || *to_start_minute >= 24 * 60 {
                return Err(DbError::Forbidden("move: start minute out of range".into()));
            }
            // fixed/locked blocks are never moved by an adaptive apply
            let (bt, locked): (String, i64) = conn.query_row(
                "SELECT block_type, locked FROM planning_blocks WHERE id = ?1",
                params![block_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?;
            if bt == "fixed" || locked != 0 {
                return Err(DbError::Forbidden(format!(
                    "move: block `{block_id}` is fixed or locked and cannot be moved"
                )));
            }
            Ok(())
        }
        PlanChangeOp::Shorten {
            block_id,
            to_end_minute,
        } => {
            let start: Option<i64> = conn
                .query_row(
                    "SELECT start_minute FROM planning_blocks WHERE id = ?1",
                    params![block_id],
                    |r| r.get(0),
                )
                .optional()?;
            match start {
                None => Err(DbError::Forbidden(format!("shorten: block `{block_id}` not found"))),
                Some(s) if *to_end_minute > s => Ok(()),
                Some(_) => Err(DbError::Forbidden("shorten: end must stay after start".into())),
            }
        }
        PlanChangeOp::RemoveBlock { block_id } => require_removable_generated_block(conn, block_id),
        PlanChangeOp::Defer {
            exception,
            replacement,
        } => {
            if !OCCURRENCE_STATES.contains(&exception.state.as_str()) {
                return Err(DbError::Forbidden("defer: bad occurrence state".into()));
            }
            if !block_exists(conn, &exception.block_id) {
                return Err(DbError::Forbidden("defer: recurring block not found".into()));
            }
            if replacement.id.trim().is_empty() || replacement.source != "generated" {
                return Err(DbError::Forbidden(
                    "defer: replacement must be a generated block with an id".into(),
                ));
            }
            Ok(())
        }
        PlanChangeOp::DropOccurrence { exception }
        | PlanChangeOp::MarkOccurrenceDone { exception }
        | PlanChangeOp::MarkOccurrenceSkipped { exception } => {
            if !OCCURRENCE_STATES.contains(&exception.state.as_str()) {
                return Err(DbError::Forbidden("occurrence op: bad state".into()));
            }
            if !block_exists(conn, &exception.block_id) {
                return Err(DbError::Forbidden("occurrence op: block not found".into()));
            }
            Ok(())
        }
        PlanChangeOp::ClearOccurrence { .. } => Ok(()),
    }
}

fn apply_op(conn: &Connection, op: &PlanChangeOp) -> DbResult<()> {
    match op {
        PlanChangeOp::Keep { .. } => Ok(()),
        PlanChangeOp::Add { block } => block_upsert_inner(conn, block),
        PlanChangeOp::Move {
            block_id,
            to_start_minute,
        } => {
            let (start, end): (i64, i64) = conn.query_row(
                "SELECT start_minute, end_minute FROM planning_blocks WHERE id = ?1",
                params![block_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?;
            let dur = end - start;
            conn.execute(
                "UPDATE planning_blocks SET start_minute = ?1, end_minute = ?2, updated_at = ?3 WHERE id = ?4",
                params![to_start_minute, to_start_minute + dur, now_or_epoch(), block_id],
            )?;
            Ok(())
        }
        PlanChangeOp::Shorten {
            block_id,
            to_end_minute,
        } => {
            conn.execute(
                "UPDATE planning_blocks SET end_minute = ?1, updated_at = ?2 WHERE id = ?3",
                params![to_end_minute, now_or_epoch(), block_id],
            )?;
            Ok(())
        }
        PlanChangeOp::RemoveBlock { block_id } => {
            conn.execute("DELETE FROM planning_blocks WHERE id = ?1", params![block_id])?;
            Ok(())
        }
        PlanChangeOp::Defer {
            exception,
            replacement,
        } => {
            block_upsert_inner(conn, replacement)?;
            occurrence_upsert_inner(conn, exception)?;
            Ok(())
        }
        PlanChangeOp::DropOccurrence { exception }
        | PlanChangeOp::MarkOccurrenceDone { exception }
        | PlanChangeOp::MarkOccurrenceSkipped { exception } => occurrence_upsert_inner(conn, exception),
        PlanChangeOp::ClearOccurrence {
            block_id,
            occurrence_date,
        } => {
            conn.execute(
                "DELETE FROM planning_occurrence_exceptions WHERE block_id = ?1 AND occurrence_date = ?2",
                params![block_id, occurrence_date],
            )?;
            Ok(())
        }
    }
}

fn now_or_epoch() -> String {
    "1970-01-01T00:00:00.000Z".to_string()
}

fn stale_check(conn: &Connection, expected: &[ExpectedBlock]) -> DbResult<()> {
    for e in expected {
        let cur: Option<(i64, i64)> = conn
            .query_row(
                "SELECT start_minute, end_minute FROM planning_blocks WHERE id = ?1",
                params![e.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        match cur {
            Some((s, en)) if s == e.start_minute && en == e.end_minute => {}
            Some(_) => {
                return Err(DbError::Forbidden(format!(
                    "stale-plan: block `{}` changed since this diff was reviewed — regenerate it",
                    e.id
                )))
            }
            None => {
                return Err(DbError::Forbidden(format!(
                    "stale-plan: block `{}` no longer exists — regenerate the diff",
                    e.id
                )))
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn plan_apply_change_set(
    db: State<'_, Db>,
    request: ApplyChangeSetRequest,
) -> DbResult<ChangeSetApplyReport> {
    let mut conn = db.0.lock().unwrap();

    if request.change_set.status != "applied" {
        return Err(DbError::Forbidden(
            "apply request's change_set must carry status 'applied'".into(),
        ));
    }
    // 1. re-validate every op against current state (no writes)
    for op in &request.ops {
        validate_op(&conn, op)?;
    }
    // 2. deterministic expected-before check
    stale_check(&conn, &request.expected)?;

    // 3. one transaction — commit only if all ops + the status update succeed
    let tx = conn.transaction()?;
    let mut applied = 0usize;
    for op in &request.ops {
        apply_op(&tx, op)?;
        applied += 1;
    }
    let mut cs = request.change_set;
    cs.status = "applied".into();
    cs.applied_at = Some(request.now.clone());
    change_set_upsert_inner(&tx, &cs)?;
    tx.commit()?;

    Ok(ChangeSetApplyReport {
        ok: true,
        change_set_id: cs.id,
        applied_ops: applied,
    })
}

#[tauri::command]
pub fn plan_undo_change_set(
    db: State<'_, Db>,
    request: UndoChangeSetRequest,
) -> DbResult<ChangeSetApplyReport> {
    let mut conn = db.0.lock().unwrap();

    let cs: Option<PlanningChangeSetRow> = conn
        .query_row(
            "SELECT id,scope,status,target_start_date,target_end_date,rationale,reason_codes_json,
                    changes_json,inverse_changes_json,source,created_at,decided_at,applied_at,undone_at
             FROM planning_change_sets WHERE id = ?1",
            params![request.change_set_id],
            |r| {
                Ok(PlanningChangeSetRow {
                    id: r.get(0)?,
                    scope: r.get(1)?,
                    status: r.get(2)?,
                    target_start_date: r.get(3)?,
                    target_end_date: r.get(4)?,
                    rationale: r.get(5)?,
                    reason_codes_json: r.get(6)?,
                    changes_json: r.get(7)?,
                    inverse_changes_json: r.get(8)?,
                    source: r.get(9)?,
                    created_at: r.get(10)?,
                    decided_at: r.get(11)?,
                    applied_at: r.get(12)?,
                    undone_at: r.get(13)?,
                })
            },
        )
        .optional()?;
    let mut cs = match cs {
        Some(c) => c,
        None => return Err(DbError::Forbidden("undo: change set not found".into())),
    };
    if cs.status != "applied" {
        return Err(DbError::Forbidden(
            "undo: only an applied change set can be undone".into(),
        ));
    }
    for op in &request.ops {
        validate_op(&conn, op)?;
    }

    let tx = conn.transaction()?;
    let mut applied = 0usize;
    for op in &request.ops {
        apply_op(&tx, op)?;
        applied += 1;
    }
    cs.status = "undone".into();
    cs.undone_at = Some(request.now.clone());
    change_set_upsert_inner(&tx, &cs)?;
    tx.commit()?;

    Ok(ChangeSetApplyReport {
        ok: true,
        change_set_id: cs.id,
        applied_ops: applied,
    })
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

    fn action(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO actions (id,system_id,title,context,status,est_minutes,priority,timing,position,created_at,updated_at)
             VALUES (?1,NULL,'Revise Binary Trees','','todo',30,'medium','',0,'2026-01-01','2026-01-01')",
            params![id],
        )
        .unwrap();
    }

    fn block(id: &str, action_id: Option<&str>) -> PlanningBlockRow {
        PlanningBlockRow {
            id: id.into(),
            title: "DS Mastery".into(),
            domain: "Academics".into(),
            action_id: action_id.map(String::from),
            day_of_week: 5,
            date: None,
            start_minute: 14 * 60,
            end_minute: 15 * 60 + 30,
            block_type: "flexible".into(),
            locked: false,
            source: "manual".into(),
            status: "scheduled".into(),
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }

    #[test]
    fn crud_and_default_capacity() {
        let c = mem();
        block_upsert_inner(&c, &block("b1", None)).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.blocks.len(), 1);
        // capacity falls back to the documented default when unset
        assert_eq!(g.capacity.daily_minutes, 150);
        assert_eq!(g.capacity.weekly_minutes, 840);

        capacity_set_inner(
            &c,
            &CapacityRow {
                daily_minutes: 180,
                weekly_minutes: 900,
            },
            "2026-02-01",
        )
        .unwrap();
        assert_eq!(load_inner(&c).unwrap().capacity.daily_minutes, 180);
    }

    #[test]
    fn block_links_to_a_canonical_action_and_survives_its_deletion() {
        let c = mem();
        action(&c, "act-1");
        block_upsert_inner(&c, &block("b1", Some("act-1"))).unwrap();
        assert_eq!(
            load_inner(&c).unwrap().blocks[0].action_id.as_deref(),
            Some("act-1")
        );

        c.execute("DELETE FROM actions WHERE id = 'act-1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.blocks.len(), 1, "planning history survives the Action");
        assert!(
            g.blocks[0].action_id.is_none(),
            "action_id is SET NULL — the block is not deleted with the Action"
        );
    }

    #[test]
    fn upsert_stores_a_dangling_action_link_as_null_not_an_fk_error() {
        let c = mem();
        block_upsert_inner(&c, &block("b1", Some("ghost-act"))).unwrap();
        assert!(load_inner(&c).unwrap().blocks[0].action_id.is_none());
    }

    #[test]
    fn no_action_status_or_completion_column_on_a_block() {
        let c = mem();
        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('planning_blocks')")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        // A block schedules time; it does not own Action completion.
        for banned in [
            "action_status",
            "action_done",
            "completed_action",
            "deadline",
        ] {
            assert!(
                !cols.iter().any(|c| c == banned),
                "planning_blocks must not have a `{banned}` column"
            );
        }
        assert!(cols.contains(&"status".to_string()));
        assert!(cols.contains(&"locked".to_string()));
    }

    #[test]
    fn upsert_preserves_created_at_on_update() {
        let c = mem();
        block_upsert_inner(&c, &block("b1", None)).unwrap();
        let mut edited = block("b1", None);
        edited.title = "Renamed".into();
        edited.created_at = "2099-12-31".into();
        block_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.blocks[0].title, "Renamed");
        assert_eq!(g.blocks[0].created_at, "2026-01-01");
    }

    #[test]
    fn import_is_idempotent_non_destructive_and_dangling_safe() {
        let c = mem();
        action(&c, "act-1");
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = PlanningImport {
            blocks: vec![
                block("b1", Some("act-1")),
                block("b2", Some("ghost-act")), // link cleared, block kept
            ],
            capacity: Some(CapacityRow {
                daily_minutes: 120,
                weekly_minutes: 700,
            }),
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.blocks_imported, 2);
        assert_eq!(r1.action_links_cleared, 1);
        assert!(r1.capacity_imported);
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            assert!(g
                .blocks
                .iter()
                .find(|b| b.id == "b2")
                .unwrap()
                .action_id
                .is_none());
            assert_eq!(g.capacity.daily_minutes, 120);
        }

        // mutate + re-import: no-op preserving the edit
        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE planning_blocks SET title = 'EDITED' WHERE id = 'b1'",
                [],
            )
            .unwrap();
        }
        let imp2 = PlanningImport {
            blocks: vec![block("b1", Some("act-1"))],
            capacity: None,
        };
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp2).unwrap()
        };
        assert!(!r2.ran);
        {
            let conn = db.0.lock().unwrap();
            assert_eq!(
                load_inner(&conn)
                    .unwrap()
                    .blocks
                    .iter()
                    .find(|b| b.id == "b1")
                    .unwrap()
                    .title,
                "EDITED"
            );
        }
    }

    // -- RC1 release-blocker regression -----------------------------------
    // A Planner/Calendar block created in the installed app vanished on the
    // next launch. Root cause: the Tauri wire struct expected `dayOfWeek` /
    // `blockType`, but the frontend model sends `day` / `type` — so
    // `plan_block_upsert` failed to deserialize and nothing was ever written
    // to SQLite. Every prior planning test constructed `PlanningBlockRow` in
    // Rust directly (or exercised the localStorage repo), so the wire contract
    // was never covered.

    /// The EXACT JSON `SqliteRepo.blockUpsert` sends over `invoke`.
    fn frontend_block_json(id: &str, locked: bool) -> serde_json::Value {
        serde_json::json!({
            "id": id,
            "title": "Deep work",
            "domain": "Planning",
            "actionId": null,
            "day": 1,
            "date": "2026-09-01",
            "startMinute": 540,
            "endMinute": 600,
            "type": "fixed",
            "locked": locked,
            "source": "manual",
            "status": "scheduled",
            "createdAt": "2026-09-01T09:00:00.000Z",
            "updatedAt": "2026-09-01T09:00:00.000Z"
        })
    }

    fn temp_db_path(tag: &str) -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("pbos-planning-{tag}-{}-{nanos}.sqlite3", std::process::id()))
    }

    #[test]
    fn frontend_wire_shape_deserializes_and_survives_db_close_and_reopen() {
        // 1. The frontend payload deserializes into the wire struct at all.
        let block: PlanningBlockRow = serde_json::from_value(frontend_block_json("blk_1", true))
            .expect("frontend `day`/`type` payload must deserialize — this is the RC1 bug");
        assert_eq!(block.day_of_week, 1);
        assert_eq!(block.block_type, "fixed");
        assert!(block.locked);

        let path = temp_db_path("reopen");

        // 2. Open a real file DB, migrate, write the block, then DROP the connection.
        {
            let conn = Connection::open(&path).unwrap();
            conn.pragma_update(None, "journal_mode", "WAL").unwrap();
            conn.pragma_update(None, "foreign_keys", "ON").unwrap();
            run_migrations_for_test(&conn).unwrap();
            block_upsert_inner(&conn, &block).unwrap();
        } // connection closed here — mirrors "fully exit PBOS"

        // 3. Reopen the SAME file in a fresh connection — mirrors "relaunch".
        let restored = {
            let conn = Connection::open(&path).unwrap();
            conn.pragma_update(None, "foreign_keys", "ON").unwrap();
            load_inner(&conn).unwrap()
        };

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("sqlite3-wal"));
        let _ = std::fs::remove_file(path.with_extension("sqlite3-shm"));

        assert_eq!(restored.blocks.len(), 1, "block must survive close + reopen");
        let b = &restored.blocks[0];
        assert_eq!(b.id, "blk_1");
        assert_eq!(b.day_of_week, 1);
        assert_eq!(b.block_type, "fixed");
        assert_eq!(b.date.as_deref(), Some("2026-09-01"));
        assert!(b.locked, "lock state must survive relaunch");
        assert_eq!(b.source, "manual", "manual provenance must survive relaunch");
    }

    #[test]
    fn plan_load_emits_the_field_names_the_frontend_reads() {
        let c = mem();
        let block: PlanningBlockRow =
            serde_json::from_value(frontend_block_json("blk_2", false)).unwrap();
        block_upsert_inner(&c, &block).unwrap();

        let graph = load_inner(&c).unwrap();
        let json = serde_json::to_value(&graph).unwrap();
        let wire = &json["blocks"][0];

        // The frontend reads `block.day` / `block.type`; anything else renders
        // the block on no weekday and it "disappears".
        assert_eq!(wire["day"], 1);
        assert_eq!(wire["type"], "fixed");
        assert!(wire.get("dayOfWeek").is_none());
        assert!(wire.get("blockType").is_none());
        assert_eq!(wire["startMinute"], 540);
        assert_eq!(wire["actionId"], serde_json::Value::Null);
    }

    // === V2 — Adaptive Planning persistence (migration v11) ==============

    fn recurring(id: &str) -> PlanningBlockRow {
        let mut b = block(id, None);
        b.day_of_week = 1;
        b.date = None; // recurs weekly
        b
    }
    fn pinned(id: &str, date: &str) -> PlanningBlockRow {
        let mut b = block(id, None);
        b.day_of_week = 0;
        b.date = Some(date.into());
        b.source = "generated".into();
        b
    }

    fn constraint(action_id: &str) -> ActionSchedulingConstraintRow {
        ActionSchedulingConstraintRow {
            action_id: action_id.into(),
            required_before: Some("2026-09-12".into()),
            earliest_date: Some("2026-09-05".into()),
            preferred_time_window: Some("morning".into()),
            minimum_block_minutes: Some(45),
            splittable: false,
            source: "user".into(),
            created_at: "2026-09-01".into(),
            updated_at: "2026-09-01".into(),
        }
    }

    #[test]
    fn action_constraint_round_trips_and_defaults_to_unsplittable() {
        let c = mem();
        action(&c, "act1");
        constraint_upsert_inner(&c, &constraint("act1")).unwrap();
        let rows = constraints_load_inner(&c).unwrap();
        assert_eq!(rows.len(), 1);
        assert!(!rows[0].splittable, "work is not assumed fragmentable");
        assert_eq!(rows[0].minimum_block_minutes, Some(45));
        assert_eq!(rows[0].preferred_time_window.as_deref(), Some("morning"));
    }

    #[test]
    fn action_constraint_cascades_with_its_action_and_rejects_a_ghost() {
        let c = mem();
        action(&c, "act1");
        constraint_upsert_inner(&c, &constraint("act1")).unwrap();
        c.execute("DELETE FROM actions WHERE id='act1'", []).unwrap();
        assert_eq!(constraints_load_inner(&c).unwrap().len(), 0);
        // Unlike a planning block, a constraint with no Action is meaningless.
        assert!(constraint_upsert_inner(&c, &constraint("ghost")).is_err());
    }

    #[test]
    fn action_constraint_rejects_an_unknown_time_window() {
        let c = mem();
        action(&c, "act1");
        let mut bad = constraint("act1");
        bad.preferred_time_window = Some("midnight".into());
        assert!(constraint_upsert_inner(&c, &bad).is_err());
    }

    #[test]
    fn skip_one_occurrence_does_not_touch_the_recurring_template() {
        let c = mem();
        block_upsert_inner(&c, &recurring("rec1")).unwrap();
        occurrence_upsert_inner(
            &c,
            &OccurrenceExceptionRow {
                id: "ex1".into(),
                block_id: "rec1".into(),
                occurrence_date: "2026-09-08".into(),
                state: "skipped".into(),
                replacement_block_id: None,
                source: "user".into(),
                note: String::new(),
                created_at: "2026-09-01".into(),
                updated_at: "2026-09-01".into(),
            },
        )
        .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.blocks.len(), 1, "template still there");
        assert!(g.blocks[0].date.is_none(), "template still recurs weekly");
        let ex = occurrences_load_inner(&c).unwrap();
        assert_eq!(ex.len(), 1);
        assert_eq!(ex[0].state, "skipped");
    }

    #[test]
    fn defer_one_occurrence_links_a_pinned_replacement_that_set_nulls_on_delete() {
        let c = mem();
        block_upsert_inner(&c, &recurring("rec1")).unwrap();
        block_upsert_inner(&c, &pinned("repl1", "2026-09-08")).unwrap();
        occurrence_upsert_inner(
            &c,
            &OccurrenceExceptionRow {
                id: "ex1".into(),
                block_id: "rec1".into(),
                occurrence_date: "2026-09-08".into(),
                state: "deferred".into(),
                replacement_block_id: Some("repl1".into()),
                source: "user".into(),
                note: "moved to Sunday".into(),
                created_at: "2026-09-01".into(),
                updated_at: "2026-09-01".into(),
            },
        )
        .unwrap();
        assert_eq!(
            occurrences_load_inner(&c).unwrap()[0]
                .replacement_block_id
                .as_deref(),
            Some("repl1")
        );

        c.execute("DELETE FROM planning_blocks WHERE id='repl1'", [])
            .unwrap();
        let ex = occurrences_load_inner(&c).unwrap();
        assert_eq!(ex.len(), 1, "the exception survives losing its replacement");
        assert!(ex[0].replacement_block_id.is_none());

        c.execute("DELETE FROM planning_blocks WHERE id='rec1'", [])
            .unwrap();
        assert_eq!(occurrences_load_inner(&c).unwrap().len(), 0, "cascades with template");
    }

    #[test]
    fn occurrence_upsert_is_unique_per_block_date_and_rejects_a_bad_state() {
        let c = mem();
        block_upsert_inner(&c, &recurring("rec1")).unwrap();
        let base = OccurrenceExceptionRow {
            id: "ex1".into(),
            block_id: "rec1".into(),
            occurrence_date: "2026-09-08".into(),
            state: "skipped".into(),
            replacement_block_id: None,
            source: "user".into(),
            note: String::new(),
            created_at: "2026-09-01".into(),
            updated_at: "2026-09-01".into(),
        };
        occurrence_upsert_inner(&c, &base).unwrap();
        // Same (block, date) with a different id → UPSERT on the unique key.
        let mut again = base.clone();
        again.id = "ex2".into();
        again.state = "done".into();
        again.updated_at = "2026-09-02".into();
        occurrence_upsert_inner(&c, &again).unwrap();
        let ex = occurrences_load_inner(&c).unwrap();
        assert_eq!(ex.len(), 1);
        assert_eq!(ex[0].state, "done");

        let mut bad = base.clone();
        bad.occurrence_date = "2026-09-15".into();
        bad.state = "cancelled".into();
        assert!(occurrence_upsert_inner(&c, &bad).is_err());
    }

    #[test]
    fn change_set_stores_only_changes_and_inverse_changes_with_valid_json() {
        let c = mem();
        let cs = PlanningChangeSetRow {
            id: "cs1".into(),
            scope: "day".into(),
            status: "proposed".into(),
            target_start_date: Some("2026-09-08".into()),
            target_end_date: Some("2026-09-08".into()),
            rationale: "a block elapsed unresolved".into(),
            reason_codes_json: "[\"ELAPSED_UNRESOLVED\"]".into(),
            changes_json: "[{\"kind\":\"move\",\"blockId\":\"b1\",\"toStartMinute\":600}]".into(),
            inverse_changes_json: "[{\"kind\":\"move\",\"blockId\":\"b1\",\"toStartMinute\":540}]"
                .into(),
            source: "adaptive-planning".into(),
            created_at: "2026-09-08T10:00:00.000Z".into(),
            decided_at: None,
            applied_at: None,
            undone_at: None,
        };
        change_set_upsert_inner(&c, &cs).unwrap();
        let rows = change_sets_load_inner(&c).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].scope, "day");
        assert!(rows[0].changes_json.contains("\"kind\":\"move\""));
        assert!(rows[0].inverse_changes_json.contains("540"));

        // Apply → Undo lifecycle is just a status move on the same row.
        let mut applied = cs.clone();
        applied.status = "applied".into();
        applied.applied_at = Some("2026-09-08T10:05:00.000Z".into());
        change_set_upsert_inner(&c, &applied).unwrap();
        let mut undone = applied.clone();
        undone.status = "undone".into();
        undone.undone_at = Some("2026-09-08T11:00:00.000Z".into());
        change_set_upsert_inner(&c, &undone).unwrap();
        let rows = change_sets_load_inner(&c).unwrap();
        assert_eq!(rows.len(), 1, "one durable diff row through its whole lifecycle");
        assert_eq!(rows[0].status, "undone");
    }

    #[test]
    fn change_set_rejects_a_bad_scope_status_or_malformed_json() {
        let c = mem();
        let good = PlanningChangeSetRow {
            id: "cs1".into(),
            scope: "week".into(),
            status: "proposed".into(),
            target_start_date: None,
            target_end_date: None,
            rationale: String::new(),
            reason_codes_json: "[]".into(),
            changes_json: "[]".into(),
            inverse_changes_json: "[]".into(),
            source: "adaptive-planning".into(),
            created_at: "2026-09-08".into(),
            decided_at: None,
            applied_at: None,
            undone_at: None,
        };
        let mut bad = good.clone();
        bad.scope = "year".into();
        assert!(change_set_upsert_inner(&c, &bad).is_err());
        bad = good.clone();
        bad.status = "maybe".into();
        assert!(change_set_upsert_inner(&c, &bad).is_err());
        bad = good.clone();
        bad.changes_json = "{not json".into();
        assert!(change_set_upsert_inner(&c, &bad).is_err());
    }

    #[test]
    fn v2_planning_wire_shapes_match_the_frontend_payloads() {
        let constraint_json = serde_json::json!({
            "actionId": "act1",
            "requiredBefore": "2026-09-12",
            "earliestDate": "2026-09-05",
            "preferredTimeWindow": "morning",
            "minimumBlockMinutes": 45,
            "splittable": false,
            "source": "user",
            "createdAt": "2026-09-01",
            "updatedAt": "2026-09-01"
        });
        let c: ActionSchedulingConstraintRow =
            serde_json::from_value(constraint_json).unwrap();
        assert_eq!(c.action_id, "act1");
        assert!(!c.splittable);
        let back = serde_json::to_value(&c).unwrap();
        assert_eq!(back["actionId"], "act1");
        assert!(back.get("action_id").is_none());
        assert!(back.get("minimum_block_minutes").is_none());

        let occ_json = serde_json::json!({
            "id": "ex1",
            "blockId": "rec1",
            "occurrenceDate": "2026-09-08",
            "state": "deferred",
            "replacementBlockId": "repl1",
            "source": "user",
            "note": "moved",
            "createdAt": "2026-09-01",
            "updatedAt": "2026-09-01"
        });
        let e: OccurrenceExceptionRow = serde_json::from_value(occ_json).unwrap();
        assert_eq!(e.block_id, "rec1");
        let back = serde_json::to_value(&e).unwrap();
        assert_eq!(back["blockId"], "rec1");
        assert_eq!(back["occurrenceDate"], "2026-09-08");

        let cs_json = serde_json::json!({
            "id": "cs1",
            "scope": "micro",
            "status": "proposed",
            "targetStartDate": null,
            "targetEndDate": null,
            "rationale": "",
            "reasonCodesJson": "[]",
            "changesJson": "[]",
            "inverseChangesJson": "[]",
            "source": "adaptive-planning",
            "createdAt": "2026-09-08",
            "decidedAt": null,
            "appliedAt": null,
            "undoneAt": null
        });
        let cs: PlanningChangeSetRow = serde_json::from_value(cs_json).unwrap();
        assert_eq!(cs.scope, "micro");
        let back = serde_json::to_value(&cs).unwrap();
        assert_eq!(back["inverseChangesJson"], "[]");
        assert!(back.get("inverse_changes_json").is_none());
    }

    // === V2 hardening — transactional change-set apply / undo ============

    fn change_set(id: &str, status: &str) -> PlanningChangeSetRow {
        PlanningChangeSetRow {
            id: id.into(),
            scope: "week".into(),
            status: status.into(),
            target_start_date: Some("2026-09-07".into()),
            target_end_date: Some("2026-09-13".into()),
            rationale: "adapt the week".into(),
            reason_codes_json: "[]".into(),
            changes_json: "[]".into(),
            inverse_changes_json: "[]".into(),
            source: "adaptive-planning".into(),
            created_at: "2026-09-06T10:00:00.000Z".into(),
            decided_at: Some("2026-09-06T10:00:00.000Z".into()),
            applied_at: None,
            undone_at: None,
        }
    }

    fn count_blocks(c: &Connection) -> i64 {
        c.query_row("SELECT COUNT(*) FROM planning_blocks", [], |r| r.get(0)).unwrap()
    }
    fn count_occ(c: &Connection) -> i64 {
        c.query_row("SELECT COUNT(*) FROM planning_occurrence_exceptions", [], |r| r.get(0))
            .unwrap()
    }
    fn block_start(c: &Connection, id: &str) -> i64 {
        c.query_row(
            "SELECT start_minute FROM planning_blocks WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .unwrap()
    }
    fn cs_status(c: &Connection, id: &str) -> String {
        c.query_row(
            "SELECT status FROM planning_change_sets WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .unwrap()
    }

    fn apply_req(cs_id: &str, ops: Vec<PlanChangeOp>, expected: Vec<ExpectedBlock>) -> ApplyChangeSetRequest {
        ApplyChangeSetRequest {
            change_set: change_set(cs_id, "applied"),
            ops,
            expected,
            now: "2026-09-07T09:00:00.000Z".into(),
        }
    }

    // The Tauri command takes `State<'_, Db>`; these tests exercise the pure
    // pieces (`validate_op`, `apply_op`, `stale_check`, one `conn.transaction()`)
    // directly, which is exactly what the command composes.
    #[test]
    fn apply_ops_commit_together_or_roll_back_together() {
        let mut c = mem();
        let mut existing = pinned("b_exist", "2026-09-07");
        existing.start_minute = 9 * 60;
        existing.end_minute = 10 * 60;
        block_upsert_inner(&c, &existing).unwrap();
        change_set_upsert_inner(&c, &change_set("cs1", "proposed")).unwrap();

        let mut added = pinned("b_new", "2026-09-08");
        added.start_minute = 14 * 60;
        added.end_minute = 15 * 60;

        // success: add + move commit together, change set flips to applied
        {
            let ops = vec![
                PlanChangeOp::Add { block: added.clone() },
                PlanChangeOp::Move { block_id: "b_exist".into(), to_start_minute: 11 * 60 },
            ];
            for op in &ops {
                validate_op(&c, op).unwrap();
            }
            let tx = c.transaction().unwrap();
            for op in &ops {
                apply_op(&tx, op).unwrap();
            }
            let mut cs = change_set("cs1", "applied");
            cs.applied_at = Some("2026-09-07".into());
            change_set_upsert_inner(&tx, &cs).unwrap();
            tx.commit().unwrap();
        }
        assert_eq!(count_blocks(&c), 2);
        assert_eq!(block_start(&c, "b_exist"), 11 * 60);
        assert_eq!(cs_status(&c, "cs1"), "applied");

        // failure mid-way: a second add + a bad move → nothing from THIS tx persists
        let before_blocks = count_blocks(&c);
        let before_start = block_start(&c, "b_exist");
        {
            let bad_ops = vec![
                PlanChangeOp::Add { block: pinned("b_x", "2026-09-09") },
                PlanChangeOp::Move { block_id: "does_not_exist".into(), to_start_minute: 600 },
            ];
            let tx = c.transaction().unwrap();
            let mut err = None;
            for op in &bad_ops {
                if let Err(e) = apply_op(&tx, op) {
                    err = Some(e);
                    break;
                }
            }
            assert!(err.is_some(), "the bad move must error");
            drop(tx); // rolls back
        }
        assert_eq!(count_blocks(&c), before_blocks, "failed tx added nothing");
        assert_eq!(block_start(&c, "b_exist"), before_start, "failed tx moved nothing");
    }

    #[test]
    fn stale_expected_state_is_refused_before_any_write() {
        let c = mem();
        let mut b = pinned("b1", "2026-09-07");
        b.start_minute = 9 * 60;
        b.end_minute = 10 * 60;
        block_upsert_inner(&c, &b).unwrap();

        // reviewed at 9:00–10:00, but someone moved it to 12:00 since
        conn_move(&c, "b1", 12 * 60);
        let expected = vec![ExpectedBlock {
            id: "b1".into(),
            start_minute: 9 * 60,
            end_minute: 10 * 60,
        }];
        let err = stale_check(&c, &expected).unwrap_err();
        assert!(matches!(err, DbError::Forbidden(m) if m.contains("stale-plan")));

        // a matching expected passes
        let ok_expected = vec![ExpectedBlock {
            id: "b1".into(),
            start_minute: 12 * 60,
            end_minute: 13 * 60,
        }];
        stale_check(&c, &ok_expected).unwrap();
    }

    fn conn_move(c: &Connection, id: &str, to_start: i64) {
        let (s, e): (i64, i64) = c
            .query_row(
                "SELECT start_minute,end_minute FROM planning_blocks WHERE id=?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        let dur = e - s;
        c.execute(
            "UPDATE planning_blocks SET start_minute=?1,end_minute=?2 WHERE id=?3",
            params![to_start, to_start + dur, id],
        )
        .unwrap();
    }

    #[test]
    fn defer_occurrence_and_its_replacement_are_atomic() {
        let mut c = mem();
        block_upsert_inner(&c, &recurring("rec1")).unwrap();
        let replacement = pinned("repl1", "2026-09-10");
        let ex = OccurrenceExceptionRow {
            id: "ex1".into(),
            block_id: "rec1".into(),
            occurrence_date: "2026-09-08".into(),
            state: "deferred".into(),
            replacement_block_id: Some("repl1".into()),
            source: "user".into(),
            note: String::new(),
            created_at: "2026-09-07".into(),
            updated_at: "2026-09-07".into(),
        };
        let op = PlanChangeOp::Defer { exception: ex, replacement };
        validate_op(&c, &op).unwrap();
        let tx = c.transaction().unwrap();
        apply_op(&tx, &op).unwrap();
        tx.commit().unwrap();

        assert!(block_exists(&c, "repl1"));
        let (state, repl): (String, Option<String>) = c
            .query_row(
                "SELECT state,replacement_block_id FROM planning_occurrence_exceptions WHERE block_id='rec1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(state, "deferred");
        assert_eq!(repl.as_deref(), Some("repl1"));
        // the recurring template is untouched
        assert_eq!(
            c.query_row(
                "SELECT COUNT(*) FROM planning_blocks WHERE id='rec1' AND date IS NULL",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            1
        );
    }

    #[test]
    fn undo_atomically_reverses_an_add_and_a_move_and_survives_reopen() {
        let path = std::env::temp_dir().join(format!(
            "pbos-undo-{}-{}.sqlite3",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        {
            let mut c = Connection::open(&path).unwrap();
            c.pragma_update(None, "foreign_keys", "ON").unwrap();
            run_migrations_for_test(&c).unwrap();

            let mut existing = pinned("b_exist", "2026-09-07");
            existing.start_minute = 9 * 60;
            existing.end_minute = 10 * 60;
            block_upsert_inner(&c, &existing).unwrap();
            let added = {
                let mut a = pinned("b_new", "2026-09-08");
                a.start_minute = 14 * 60;
                a.end_minute = 15 * 60;
                a
            };
            change_set_upsert_inner(&c, &change_set("cs1", "proposed")).unwrap();

            // forward: add + move
            let tx = c.transaction().unwrap();
            apply_op(&tx, &PlanChangeOp::Add { block: added }).unwrap();
            apply_op(
                &tx,
                &PlanChangeOp::Move { block_id: "b_exist".into(), to_start_minute: 11 * 60 },
            )
            .unwrap();
            let mut cs = change_set("cs1", "applied");
            cs.applied_at = Some("2026-09-07".into());
            change_set_upsert_inner(&tx, &cs).unwrap();
            tx.commit().unwrap();
            assert_eq!(count_blocks(&c), 2);

            // undo: remove-block + move-back
            let tx = c.transaction().unwrap();
            apply_op(&tx, &PlanChangeOp::RemoveBlock { block_id: "b_new".into() }).unwrap();
            apply_op(
                &tx,
                &PlanChangeOp::Move { block_id: "b_exist".into(), to_start_minute: 9 * 60 },
            )
            .unwrap();
            let mut undone = change_set("cs1", "undone");
            undone.applied_at = Some("2026-09-07".into());
            undone.undone_at = Some("2026-09-07T12:00:00.000Z".into());
            change_set_upsert_inner(&tx, &undone).unwrap();
            tx.commit().unwrap();
        }
        // reopen — the undone state persists
        let c = Connection::open(&path).unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        assert_eq!(count_blocks(&c), 1, "the added block is gone after undo");
        assert_eq!(block_start(&c, "b_exist"), 9 * 60, "the move was reversed");
        assert_eq!(cs_status(&c, "cs1"), "undone");

        drop(c);
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("sqlite3-wal"));
        let _ = std::fs::remove_file(path.with_extension("sqlite3-shm"));
    }

    #[test]
    fn validate_op_rejects_moving_a_fixed_or_locked_block_and_removing_a_manual_one() {
        let c = mem();
        let mut fixed = pinned("fx", "2026-09-07");
        fixed.block_type = "fixed".into();
        block_upsert_inner(&c, &fixed).unwrap();
        let mut manual = pinned("mn", "2026-09-07");
        manual.source = "manual".into();
        block_upsert_inner(&c, &manual).unwrap();

        assert!(validate_op(
            &c,
            &PlanChangeOp::Move { block_id: "fx".into(), to_start_minute: 600 }
        )
        .is_err());
        assert!(validate_op(&c, &PlanChangeOp::RemoveBlock { block_id: "mn".into() }).is_err());
        // a generated unlocked block IS removable
        let gen = pinned("gn", "2026-09-07");
        block_upsert_inner(&c, &gen).unwrap();
        validate_op(&c, &PlanChangeOp::RemoveBlock { block_id: "gn".into() }).unwrap();
    }

    #[test]
    fn apply_change_set_wire_shape_deserializes_the_typed_op_list() {
        let json = serde_json::json!({
            "changeSet": {
                "id": "cs1", "scope": "day", "status": "applied",
                "targetStartDate": "2026-09-07", "targetEndDate": "2026-09-07",
                "rationale": "", "reasonCodesJson": "[]", "changesJson": "[]",
                "inverseChangesJson": "[]", "source": "adaptive-planning",
                "createdAt": "2026-09-06", "decidedAt": null, "appliedAt": null, "undoneAt": null
            },
            "ops": [
                { "kind": "keep", "blockId": "b1" },
                { "kind": "move", "blockId": "b2", "toStartMinute": 600 },
                { "kind": "shorten", "blockId": "b3", "toEndMinute": 630 },
                { "kind": "drop-occurrence", "exception": {
                    "id": "ex1", "blockId": "rec1", "occurrenceDate": "2026-09-08",
                    "state": "skipped", "replacementBlockId": null, "source": "user",
                    "note": "", "createdAt": "t", "updatedAt": "t"
                }},
                { "kind": "clear-occurrence", "blockId": "rec1", "occurrenceDate": "2026-09-08" }
            ],
            "expected": [{ "id": "b2", "startMinute": 540, "endMinute": 600 }],
            "now": "2026-09-07T09:00:00.000Z"
        });
        let req: ApplyChangeSetRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.ops.len(), 5);
        assert_eq!(req.expected.len(), 1);
        // an unknown kind is rejected by serde (fails closed)
        let bad = serde_json::json!({
            "changeSet": serde_json::to_value(change_set("cs1", "applied")).unwrap(),
            "ops": [{ "kind": "exec-sql", "sql": "DROP TABLE planning_blocks" }],
            "now": "t"
        });
        assert!(serde_json::from_value::<ApplyChangeSetRequest>(bad).is_err());
    }

}
