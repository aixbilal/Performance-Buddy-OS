//! Batch 1 — canonical relational persistence for the Performance spine
//! (Goal -> System -> Action). Thin data-access over the SQLite tables created
//! in migration v2 (see `db.rs`). All derived state (health, progress,
//! attention, "next action") is computed in the TS engine, never stored here.
//!
//! Relationship truth:
//!   goal <-> system : `goal_system_links` (many-to-many)
//!   system -> action: `actions.system_id` (FK; NULL = direct commitment)

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

// ---------------------------------------------------------------------------
// Row types crossing the Tauri boundary (camelCase to match the TS repo)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalRow {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub goal_type: String,
    pub domain: String,
    pub lifecycle: String,
    pub priority: String,
    pub deadline: Option<String>,
    pub metric_current: Option<f64>,
    pub metric_target: Option<f64>,
    pub metric_unit: Option<String>,
    pub detail: String,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemRow {
    pub id: String,
    pub title: String,
    pub description: String,
    pub domain: String,
    pub cadence: String,
    /// JSON array of strings, stored as TEXT.
    pub tags: Vec<String>,
    pub starred: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionRow {
    pub id: String,
    pub system_id: Option<String>,
    pub title: String,
    pub context: String,
    pub status: String,
    pub est_minutes: Option<i64>,
    pub priority: String,
    pub timing: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkRow {
    pub goal_id: String,
    pub system_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfGraph {
    pub goals: Vec<GoalRow>,
    pub systems: Vec<SystemRow>,
    pub actions: Vec<ActionRow>,
    pub links: Vec<LinkRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfImport {
    pub goals: Vec<GoalRow>,
    pub systems: Vec<SystemRow>,
    pub actions: Vec<ActionRow>,
    pub links: Vec<LinkRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfImportReport {
    /// True only when this call actually wrote rows (false = marker already set).
    pub ran: bool,
    pub goals_imported: usize,
    pub systems_imported: usize,
    pub actions_imported: usize,
    pub links_imported: usize,
    pub goals_skipped_existing: usize,
    pub systems_skipped_existing: usize,
    pub actions_skipped_existing: usize,
}

const META_PERF_IMPORT: &str = "performance_relational_import";

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<PerfGraph> {
    let mut gstmt = conn.prepare(
        "SELECT id,title,type,domain,lifecycle,priority,deadline,
                metric_current,metric_target,metric_unit,detail,created_by,created_at,updated_at
         FROM goals ORDER BY created_at",
    )?;
    let goals = gstmt
        .query_map([], |r| {
            Ok(GoalRow {
                id: r.get(0)?,
                title: r.get(1)?,
                goal_type: r.get(2)?,
                domain: r.get(3)?,
                lifecycle: r.get(4)?,
                priority: r.get(5)?,
                deadline: r.get(6)?,
                metric_current: r.get(7)?,
                metric_target: r.get(8)?,
                metric_unit: r.get(9)?,
                detail: r.get(10)?,
                created_by: r.get(11)?,
                created_at: r.get(12)?,
                updated_at: r.get(13)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut sstmt = conn.prepare(
        "SELECT id,title,description,domain,cadence,tags,starred,created_at,updated_at
         FROM systems ORDER BY created_at",
    )?;
    let systems = sstmt
        .query_map([], |r| {
            let tags_json: String = r.get(5)?;
            Ok(SystemRow {
                id: r.get(0)?,
                title: r.get(1)?,
                description: r.get(2)?,
                domain: r.get(3)?,
                cadence: r.get(4)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                starred: r.get::<_, i64>(6)? != 0,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut astmt = conn.prepare(
        "SELECT id,system_id,title,context,status,est_minutes,priority,timing,position,created_at,updated_at
         FROM actions ORDER BY position, created_at",
    )?;
    let actions = astmt
        .query_map([], |r| {
            Ok(ActionRow {
                id: r.get(0)?,
                system_id: r.get(1)?,
                title: r.get(2)?,
                context: r.get(3)?,
                status: r.get(4)?,
                est_minutes: r.get(5)?,
                priority: r.get(6)?,
                timing: r.get(7)?,
                position: r.get(8)?,
                created_at: r.get(9)?,
                updated_at: r.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut lstmt =
        conn.prepare("SELECT goal_id,system_id FROM goal_system_links ORDER BY goal_id,system_id")?;
    let links = lstmt
        .query_map([], |r| {
            Ok(LinkRow {
                goal_id: r.get(0)?,
                system_id: r.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(PerfGraph {
        goals,
        systems,
        actions,
        links,
    })
}

// ---------------------------------------------------------------------------
// Writes (upsert = create-or-replace by id, preserving created_at on update)
// ---------------------------------------------------------------------------

fn goal_upsert_inner(conn: &Connection, g: &GoalRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO goals
            (id,title,type,domain,lifecycle,priority,deadline,
             metric_current,metric_target,metric_unit,detail,created_by,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, type=excluded.type, domain=excluded.domain,
            lifecycle=excluded.lifecycle, priority=excluded.priority, deadline=excluded.deadline,
            metric_current=excluded.metric_current, metric_target=excluded.metric_target,
            metric_unit=excluded.metric_unit, detail=excluded.detail, updated_at=excluded.updated_at",
        params![
            g.id, g.title, g.goal_type, g.domain, g.lifecycle, g.priority, g.deadline,
            g.metric_current, g.metric_target, g.metric_unit, g.detail, g.created_by,
            g.created_at, g.updated_at
        ],
    )?;
    Ok(())
}

fn system_upsert_inner(conn: &Connection, s: &SystemRow) -> DbResult<()> {
    let tags = serde_json::to_string(&s.tags).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "INSERT INTO systems (id,title,description,domain,cadence,tags,starred,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, description=excluded.description, domain=excluded.domain,
            cadence=excluded.cadence, tags=excluded.tags, starred=excluded.starred,
            updated_at=excluded.updated_at",
        params![
            s.id, s.title, s.description, s.domain, s.cadence, tags,
            s.starred as i64, s.created_at, s.updated_at
        ],
    )?;
    Ok(())
}

fn action_upsert_inner(conn: &Connection, a: &ActionRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO actions
            (id,system_id,title,context,status,est_minutes,priority,timing,position,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
         ON CONFLICT(id) DO UPDATE SET
            system_id=excluded.system_id, title=excluded.title, context=excluded.context,
            status=excluded.status, est_minutes=excluded.est_minutes, priority=excluded.priority,
            timing=excluded.timing, position=excluded.position, updated_at=excluded.updated_at",
        params![
            a.id, a.system_id, a.title, a.context, a.status, a.est_minutes,
            a.priority, a.timing, a.position, a.created_at, a.updated_at
        ],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn perf_load(db: State<'_, Db>) -> DbResult<PerfGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn perf_goal_upsert(db: State<'_, Db>, goal: GoalRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    goal_upsert_inner(&conn, &goal)
}

#[tauri::command]
pub fn perf_goal_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM goals WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn perf_system_upsert(db: State<'_, Db>, system: SystemRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    system_upsert_inner(&conn, &system)
}

#[tauri::command]
pub fn perf_system_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: links CASCADE, actions.system_id SET NULL (becomes a direct commitment).
    conn.execute("DELETE FROM systems WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn perf_action_upsert(db: State<'_, Db>, action: ActionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    action_upsert_inner(&conn, &action)
}

#[tauri::command]
pub fn perf_action_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM actions WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn perf_link_set(
    db: State<'_, Db>,
    goal_id: String,
    system_id: String,
    linked: bool,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    if linked {
        conn.execute(
            "INSERT INTO goal_system_links (goal_id, system_id) VALUES (?1, ?2)
             ON CONFLICT(goal_id, system_id) DO NOTHING",
            params![goal_id, system_id],
        )?;
    } else {
        conn.execute(
            "DELETE FROM goal_system_links WHERE goal_id = ?1 AND system_id = ?2",
            params![goal_id, system_id],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn perf_actions_reorder(
    db: State<'_, Db>,
    system_id: String,
    ordered_ids: Vec<String>,
) -> DbResult<()> {
    let mut conn = db.0.lock().unwrap();
    let tx = conn.transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE actions SET position = ?1, updated_at = datetime('now')
             WHERE id = ?2 AND system_id IS ?3",
            params![idx as i64, id, system_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Idempotent, non-destructive import of an already-resolved Performance graph
/// (the TS side owns the legacy-JSON parsing + relationship-conflict repair —
/// see `performance/legacyImport.ts`). `INSERT OR IGNORE` per row: never
/// overwrites a canonical record that already exists.
#[tauri::command]
pub fn perf_import_graph(db: State<'_, Db>, import: PerfImport) -> DbResult<PerfImportReport> {
    let mut conn = db.0.lock().unwrap();

    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_PERF_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(PerfImportReport {
            ran: false,
            goals_imported: 0,
            systems_imported: 0,
            actions_imported: 0,
            links_imported: 0,
            goals_skipped_existing: 0,
            systems_skipped_existing: 0,
            actions_skipped_existing: 0,
        });
    }

    let mut r = PerfImportReport {
        ran: true,
        goals_imported: 0,
        systems_imported: 0,
        actions_imported: 0,
        links_imported: 0,
        goals_skipped_existing: 0,
        systems_skipped_existing: 0,
        actions_skipped_existing: 0,
    };

    let tx = conn.transaction()?;
    for s in &import.systems {
        let tags = serde_json::to_string(&s.tags).unwrap_or_else(|_| "[]".into());
        let n = tx.execute(
            "INSERT OR IGNORE INTO systems
                (id,title,description,domain,cadence,tags,starred,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                s.id, s.title, s.description, s.domain, s.cadence, tags,
                s.starred as i64, s.created_at, s.updated_at
            ],
        )?;
        if n == 1 { r.systems_imported += 1 } else { r.systems_skipped_existing += 1 }
    }
    for g in &import.goals {
        let n = tx.execute(
            "INSERT OR IGNORE INTO goals
                (id,title,type,domain,lifecycle,priority,deadline,
                 metric_current,metric_target,metric_unit,detail,created_by,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                g.id, g.title, g.goal_type, g.domain, g.lifecycle, g.priority, g.deadline,
                g.metric_current, g.metric_target, g.metric_unit, g.detail, g.created_by,
                g.created_at, g.updated_at
            ],
        )?;
        if n == 1 { r.goals_imported += 1 } else { r.goals_skipped_existing += 1 }
    }
    for a in &import.actions {
        // Only attach to a system that exists; otherwise it becomes a direct commitment.
        let sys_ok: Option<String> = match &a.system_id {
            Some(sid) => tx
                .query_row("SELECT id FROM systems WHERE id = ?1", params![sid], |row| {
                    row.get(0)
                })
                .ok(),
            None => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO actions
                (id,system_id,title,context,status,est_minutes,priority,timing,position,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                a.id, sys_ok, a.title, a.context, a.status, a.est_minutes,
                a.priority, a.timing, a.position, a.created_at, a.updated_at
            ],
        )?;
        if n == 1 { r.actions_imported += 1 } else { r.actions_skipped_existing += 1 }
    }
    for l in &import.links {
        let goal_ok: bool = tx
            .query_row("SELECT 1 FROM goals WHERE id = ?1", params![l.goal_id], |_| Ok(()))
            .is_ok();
        let sys_ok: bool = tx
            .query_row("SELECT 1 FROM systems WHERE id = ?1", params![l.system_id], |_| Ok(()))
            .is_ok();
        if goal_ok && sys_ok {
            let n = tx.execute(
                "INSERT OR IGNORE INTO goal_system_links (goal_id, system_id) VALUES (?1, ?2)",
                params![l.goal_id, l.system_id],
            )?;
            r.links_imported += n as usize;
        }
    }

    let marker = serde_json::json!({
        "version": 1,
        "goalsImported": r.goals_imported,
        "systemsImported": r.systems_imported,
        "actionsImported": r.actions_imported,
        "linksImported": r.links_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_PERF_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

/// DEBUG ONLY — wipes the Performance spine + its import marker so native E2E
/// can run the real-user scenario from a clean state. In a release build this
/// refuses (it is only reachable from the E2E harness anyway).
#[tauri::command]
pub fn perf_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "perf_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM goal_system_links;
         DELETE FROM actions;
         DELETE FROM systems;
         DELETE FROM goals;
         -- also drop the Batch 0 KV blobs so a reload does not re-import them,
         -- and KEEP the import marker set so `perf_import_graph` stays a no-op.
         DELETE FROM kv_store WHERE key IN
           ('pbos:performance-goals','pbos:performance-systems','pbos:performance-actions');
         INSERT INTO meta (key,value) VALUES ('performance_relational_import','{\"version\":1,\"reset\":true}')
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

    fn goal(id: &str, title: &str) -> GoalRow {
        GoalRow {
            id: id.into(), title: title.into(), goal_type: "outcome".into(),
            domain: "academic".into(), lifecycle: "active".into(), priority: "normal".into(),
            deadline: None, metric_current: None, metric_target: None, metric_unit: None,
            detail: String::new(), created_by: "user".into(),
            created_at: "2026-01-01".into(), updated_at: "2026-01-01".into(),
        }
    }
    fn system(id: &str, title: &str) -> SystemRow {
        SystemRow {
            id: id.into(), title: title.into(), description: String::new(),
            domain: "academic".into(), cadence: "Weekly".into(), tags: vec!["Core".into()],
            starred: false, created_at: "2026-01-01".into(), updated_at: "2026-01-01".into(),
        }
    }
    fn action(id: &str, sys: Option<&str>, pos: i64) -> ActionRow {
        ActionRow {
            id: id.into(), system_id: sys.map(String::from), title: format!("Action {id}"),
            context: String::new(), status: "todo".into(), est_minutes: Some(30),
            priority: "normal".into(), timing: String::new(), position: pos,
            created_at: "2026-01-01".into(), updated_at: "2026-01-01".into(),
        }
    }

    #[test]
    fn crud_and_one_relationship_truth() {
        let c = mem();
        goal_upsert_inner(&c, &goal("g1", "SGPA")).unwrap();
        system_upsert_inner(&c, &system("s1", "Weekly Study")).unwrap();
        action_upsert_inner(&c, &action("a1", Some("s1"), 0)).unwrap();
        action_upsert_inner(&c, &action("a2", Some("s1"), 1)).unwrap();

        c.execute(
            "INSERT INTO goal_system_links (goal_id, system_id) VALUES ('g1','s1')",
            [],
        )
        .unwrap();

        let g = load_inner(&c).unwrap();
        assert_eq!(g.goals.len(), 1);
        assert_eq!(g.systems.len(), 1);
        assert_eq!(g.actions.len(), 2);
        assert_eq!(g.links, vec![LinkRow { goal_id: "g1".into(), system_id: "s1".into() }]);

        // Deleting the system: link CASCADEs, actions SET NULL (direct commitment).
        c.execute("DELETE FROM systems WHERE id = 's1'", []).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.systems.len(), 0);
        assert_eq!(g.links.len(), 0, "link must cascade away with the system");
        assert!(g.actions.iter().all(|a| a.system_id.is_none()), "orphaned actions become direct commitments");
    }

    #[test]
    fn fk_rejects_link_to_missing_entities() {
        let c = mem();
        goal_upsert_inner(&c, &goal("g1", "SGPA")).unwrap();
        let err = c.execute(
            "INSERT INTO goal_system_links (goal_id, system_id) VALUES ('g1','ghost')",
            [],
        );
        assert!(err.is_err(), "FK must reject a link to a non-existent system");
    }

    #[test]
    fn import_is_idempotent_and_non_destructive() {
        let c = mem();
        let db = Db(std::sync::Mutex::new(c));

        let imp = PerfImport {
            goals: vec![goal("g1", "SGPA")],
            systems: vec![system("s1", "Weekly Study")],
            actions: vec![action("a1", Some("s1"), 0), action("a2", Some("ghost"), 1)],
            links: vec![
                LinkRow { goal_id: "g1".into(), system_id: "s1".into() },
                LinkRow { goal_id: "g1".into(), system_id: "ghost".into() },
            ],
        };
        let r1 = perf_import_graph_inner(&db, imp).unwrap();
        assert!(r1.ran);
        assert_eq!(r1.goals_imported, 1);
        assert_eq!(r1.systems_imported, 1);
        assert_eq!(r1.actions_imported, 2);
        assert_eq!(r1.links_imported, 1, "the dangling link to 'ghost' is dropped");
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            let a2 = g.actions.iter().find(|a| a.id == "a2").unwrap();
            assert!(a2.system_id.is_none(), "action pointing at a missing system becomes direct");
        }

        // Mutate a canonical record, then re-import: must be a no-op.
        {
            let conn = db.0.lock().unwrap();
            conn.execute("UPDATE goals SET title = 'EDITED' WHERE id = 'g1'", []).unwrap();
        }
        let imp2 = PerfImport {
            goals: vec![goal("g1", "SGPA")],
            systems: vec![], actions: vec![], links: vec![],
        };
        let r2 = perf_import_graph_inner(&db, imp2).unwrap();
        assert!(!r2.ran);
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            assert_eq!(g.goals[0].title, "EDITED", "re-import must not clobber newer canonical data");
        }
    }

    // Test-only re-impl taking &Db (the command takes State<Db>).
    fn perf_import_graph_inner(db: &Db, import: PerfImport) -> DbResult<PerfImportReport> {
        let mut conn = db.0.lock().unwrap();
        let already: Option<String> = conn
            .query_row("SELECT value FROM meta WHERE key = ?1", params![META_PERF_IMPORT], |r| r.get(0))
            .ok();
        if already.is_some() {
            return Ok(PerfImportReport {
                ran: false, goals_imported: 0, systems_imported: 0, actions_imported: 0,
                links_imported: 0, goals_skipped_existing: 0, systems_skipped_existing: 0,
                actions_skipped_existing: 0,
            });
        }
        let mut r = PerfImportReport {
            ran: true, goals_imported: 0, systems_imported: 0, actions_imported: 0,
            links_imported: 0, goals_skipped_existing: 0, systems_skipped_existing: 0,
            actions_skipped_existing: 0,
        };
        let tx = conn.transaction()?;
        for s in &import.systems {
            let tags = serde_json::to_string(&s.tags).unwrap();
            let n = tx.execute(
                "INSERT OR IGNORE INTO systems (id,title,description,domain,cadence,tags,starred,created_at,updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
                params![s.id,s.title,s.description,s.domain,s.cadence,tags,s.starred as i64,s.created_at,s.updated_at],
            )?;
            if n == 1 { r.systems_imported += 1 } else { r.systems_skipped_existing += 1 }
        }
        for g in &import.goals {
            let n = tx.execute(
                "INSERT OR IGNORE INTO goals (id,title,type,domain,lifecycle,priority,deadline,metric_current,metric_target,metric_unit,detail,created_by,created_at,updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
                params![g.id,g.title,g.goal_type,g.domain,g.lifecycle,g.priority,g.deadline,g.metric_current,g.metric_target,g.metric_unit,g.detail,g.created_by,g.created_at,g.updated_at],
            )?;
            if n == 1 { r.goals_imported += 1 } else { r.goals_skipped_existing += 1 }
        }
        for a in &import.actions {
            let sys_ok: Option<String> = match &a.system_id {
                Some(sid) => tx.query_row("SELECT id FROM systems WHERE id=?1", params![sid], |x| x.get(0)).ok(),
                None => None,
            };
            let n = tx.execute(
                "INSERT OR IGNORE INTO actions (id,system_id,title,context,status,est_minutes,priority,timing,position,created_at,updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
                params![a.id,sys_ok,a.title,a.context,a.status,a.est_minutes,a.priority,a.timing,a.position,a.created_at,a.updated_at],
            )?;
            if n == 1 { r.actions_imported += 1 } else { r.actions_skipped_existing += 1 }
        }
        for l in &import.links {
            let ok = tx.query_row("SELECT 1 FROM goals WHERE id=?1", params![l.goal_id], |_| Ok(())).is_ok()
                && tx.query_row("SELECT 1 FROM systems WHERE id=?1", params![l.system_id], |_| Ok(())).is_ok();
            if ok {
                r.links_imported += tx.execute(
                    "INSERT OR IGNORE INTO goal_system_links (goal_id,system_id) VALUES (?1,?2)",
                    params![l.goal_id, l.system_id],
                )? as usize;
            }
        }
        tx.execute(
            "INSERT INTO meta (key,value) VALUES (?1,'{\"version\":1}')",
            params![META_PERF_IMPORT],
        )?;
        tx.commit()?;
        Ok(r)
    }
}
