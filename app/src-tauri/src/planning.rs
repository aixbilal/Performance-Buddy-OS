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
}
