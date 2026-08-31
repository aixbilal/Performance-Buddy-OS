//! Batch 3 — durable Quick Capture inbox. Thin data-access over the
//! `capture_inbox` table in migration v5 (see `db.rs`).
//!
//! Product model (Global Quick Capture / Capture Inbox decision specs):
//!   RAW TEXT -> INTERPRETATION -> PROPOSAL -> DETERMINISTIC VALIDATION ->
//!   USER CONFIRMATION -> EXISTING DOMAIN ENGINE -> CANONICAL ENTITY.
//!
//!   The inbox owns UNRESOLVED raw capture ONLY. It is never a second Action /
//!   Transaction / Knowledge / Routine store — a confirmed capture is delegated
//!   to the existing canonical domain engine (on the TS side) and the inbox row
//!   is marked resolved; it does not hold the resulting entity.
//!
//!   Quick Capture works WITHOUT AI: an unclassifiable capture is still
//!   persisted here for later manual classification. No input loss.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_CAPTURE_IMPORT: &str = "capture_relational_import";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureInboxRow {
    pub id: String,
    pub raw_text: String,
    pub proposed_type: Option<String>,
    /// Opaque JSON string produced by the deterministic classifier; never a
    /// stored AI conversation.
    pub parsed_payload: Option<String>,
    pub status: String,
    pub resolution: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureImport {
    pub items: Vec<CaptureInboxRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureImportReport {
    pub ran: bool,
    pub items_imported: usize,
    pub items_skipped_existing: usize,
}

// ---------------------------------------------------------------------------
// Load / writes
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<Vec<CaptureInboxRow>> {
    let mut s = conn.prepare(
        "SELECT id,raw_text,proposed_type,parsed_payload,status,resolution,created_at,updated_at
         FROM capture_inbox ORDER BY created_at DESC",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(CaptureInboxRow {
                id: r.get(0)?,
                raw_text: r.get(1)?,
                proposed_type: r.get(2)?,
                parsed_payload: r.get(3)?,
                status: r.get(4)?,
                resolution: r.get(5)?,
                created_at: r.get(6)?,
                updated_at: r.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn upsert_inner(conn: &Connection, i: &CaptureInboxRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO capture_inbox
            (id,raw_text,proposed_type,parsed_payload,status,resolution,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(id) DO UPDATE SET
            raw_text=excluded.raw_text, proposed_type=excluded.proposed_type,
            parsed_payload=excluded.parsed_payload, status=excluded.status,
            resolution=excluded.resolution, updated_at=excluded.updated_at",
        params![
            i.id,
            i.raw_text,
            i.proposed_type,
            i.parsed_payload,
            i.status,
            i.resolution,
            i.created_at,
            i.updated_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: CaptureImport) -> DbResult<CaptureImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_CAPTURE_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(CaptureImportReport {
            ran: false,
            items_imported: 0,
            items_skipped_existing: 0,
        });
    }

    let mut r = CaptureImportReport {
        ran: true,
        items_imported: 0,
        items_skipped_existing: 0,
    };

    let tx = conn.transaction()?;
    for it in &import.items {
        let n = tx.execute(
            "INSERT OR IGNORE INTO capture_inbox
                (id,raw_text,proposed_type,parsed_payload,status,resolution,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                it.id,
                it.raw_text,
                it.proposed_type,
                it.parsed_payload,
                it.status,
                it.resolution,
                it.created_at,
                it.updated_at
            ],
        )?;
        if n == 1 {
            r.items_imported += 1
        } else {
            r.items_skipped_existing += 1
        }
    }

    let marker = serde_json::json!({ "version": 1, "itemsImported": r.items_imported });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_CAPTURE_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn capture_load(db: State<'_, Db>) -> DbResult<Vec<CaptureInboxRow>> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn capture_upsert(db: State<'_, Db>, item: CaptureInboxRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    upsert_inner(&conn, &item)
}

#[tauri::command]
pub fn capture_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM capture_inbox WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn capture_import(db: State<'_, Db>, import: CaptureImport) -> DbResult<CaptureImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the capture inbox + its import marker.
#[tauri::command]
pub fn capture_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "capture_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM capture_inbox;
         DELETE FROM kv_store WHERE key = 'pbos:capture-inbox';
         INSERT INTO meta (key,value) VALUES ('capture_relational_import','{\"version\":1,\"reset\":true}')
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

    fn item(id: &str, status: &str) -> CaptureInboxRow {
        CaptureInboxRow {
            id: id.into(),
            raw_text: "Spent 1200 on food".into(),
            proposed_type: Some("expense".into()),
            parsed_payload: Some("{\"amount\":1200}".into()),
            status: status.into(),
            resolution: None,
            created_at: "2026-01-01T00:00:00.000Z".into(),
            updated_at: "2026-01-01T00:00:00.000Z".into(),
        }
    }

    #[test]
    fn raw_capture_persists_and_reloads() {
        let c = mem();
        upsert_inner(&c, &item("c1", "unprocessed")).unwrap();
        let rows = load_inner(&c).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].raw_text, "Spent 1200 on food");
        assert_eq!(rows[0].proposed_type.as_deref(), Some("expense"));
    }

    #[test]
    fn classify_updates_in_place_without_a_duplicate() {
        let c = mem();
        upsert_inner(&c, &item("c1", "unprocessed")).unwrap();
        let mut resolved = item("c1", "resolved");
        resolved.resolution = Some("confirmed:action".into());
        resolved.created_at = "2099-01-01".into();
        upsert_inner(&c, &resolved).unwrap();
        let rows = load_inner(&c).unwrap();
        assert_eq!(rows.len(), 1, "same id → one row");
        assert_eq!(rows[0].status, "resolved");
        assert_eq!(
            rows[0].created_at, "2026-01-01T00:00:00.000Z",
            "created_at preserved"
        );
    }

    #[test]
    fn delete_removes_the_row() {
        let c = mem();
        upsert_inner(&c, &item("c1", "unprocessed")).unwrap();
        c.execute("DELETE FROM capture_inbox WHERE id = 'c1'", [])
            .unwrap();
        assert_eq!(load_inner(&c).unwrap().len(), 0);
    }

    #[test]
    fn import_is_idempotent_and_non_destructive() {
        let c = mem();
        let mut db = Db(std::sync::Mutex::new(c));
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(
                conn,
                CaptureImport {
                    items: vec![item("c1", "unprocessed"), item("c2", "proposed")],
                },
            )
            .unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.items_imported, 2);

        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE capture_inbox SET status = 'resolved' WHERE id = 'c1'",
                [],
            )
            .unwrap();
        }
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(
                conn,
                CaptureImport {
                    items: vec![item("c1", "unprocessed")],
                },
            )
            .unwrap()
        };
        assert!(!r2.ran);
        {
            let conn = db.0.lock().unwrap();
            let rows = load_inner(&conn).unwrap();
            assert_eq!(
                rows.iter().find(|r| r.id == "c1").unwrap().status,
                "resolved"
            );
        }
    }
}
