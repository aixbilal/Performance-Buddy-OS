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

// ===========================================================================
// V2 — Capture Proposals (migration v11, blueprint 07 §4.1 / §6.2 / §7)
//
//   One `capture_inbox` row may own many REVIEWABLE proposals. A proposal is a
//   `fact` ("You said") or an `interpretation` ("PBOS interpreted") — never a
//   "PBOS recommends" (that is a separate Intelligence Recommendation). The
//   inbox still owns nothing downstream: an accepted proposal is applied through
//   the shared canonical mutation registry (Phase C) and this row keeps only the
//   decision / validation / applied-result trail. Proposals CASCADE with their
//   inbox row.
// ===========================================================================

const CAPTURE_PROPOSAL_CLASSES: [&str; 2] = ["fact", "interpretation"];
const CAPTURE_PROPOSAL_CONFIDENCE: [&str; 3] = ["clear", "needs-review", "ambiguous"];
const CAPTURE_PROPOSAL_STATUS: [&str; 6] = [
    "proposed",
    "accepted",
    "modified",
    "rejected",
    "applied",
    "apply-failed",
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureProposalRow {
    pub id: String,
    pub capture_id: String,
    pub proposal_class: String,
    pub domain: String,
    pub mutation_kind: String,
    pub title: String,
    #[serde(default)]
    pub source_text: String,
    #[serde(default = "default_confidence")]
    pub confidence: String,
    pub ambiguity_reason: Option<String>,
    #[serde(default)]
    pub rationale: String,
    /// JSON string[] — short human evidence lines.
    #[serde(default = "default_json_array")]
    pub evidence_json: String,
    /// Opaque JSON — the params as first proposed.
    #[serde(default = "default_json_object")]
    pub original_params_json: String,
    /// Opaque JSON — the params after any user edit (what Apply will use).
    #[serde(default = "default_json_object")]
    pub effective_params_json: String,
    #[serde(default = "default_status")]
    pub status: String,
    pub validation_json: Option<String>,
    pub applied_result_json: Option<String>,
    pub created_at: String,
    pub decided_at: Option<String>,
    pub applied_at: Option<String>,
}

fn default_confidence() -> String {
    "needs-review".into()
}
fn default_status() -> String {
    "proposed".into()
}
fn default_json_array() -> String {
    "[]".into()
}
fn default_json_object() -> String {
    "{}".into()
}

fn proposal_validate(p: &CaptureProposalRow) -> DbResult<()> {
    if !CAPTURE_PROPOSAL_CLASSES.contains(&p.proposal_class.as_str()) {
        return Err(DbError::Forbidden(format!(
            "proposal_class must be one of {CAPTURE_PROPOSAL_CLASSES:?}, got `{}`",
            p.proposal_class
        )));
    }
    if !CAPTURE_PROPOSAL_CONFIDENCE.contains(&p.confidence.as_str()) {
        return Err(DbError::Forbidden(format!(
            "confidence must be one of {CAPTURE_PROPOSAL_CONFIDENCE:?}, got `{}`",
            p.confidence
        )));
    }
    if !CAPTURE_PROPOSAL_STATUS.contains(&p.status.as_str()) {
        return Err(DbError::Forbidden(format!(
            "status must be one of {CAPTURE_PROPOSAL_STATUS:?}, got `{}`",
            p.status
        )));
    }
    Ok(())
}

fn proposals_load_inner(conn: &Connection, capture_id: &str) -> DbResult<Vec<CaptureProposalRow>> {
    let mut s = conn.prepare(
        "SELECT id,capture_id,proposal_class,domain,mutation_kind,title,source_text,confidence,
                ambiguity_reason,rationale,evidence_json,original_params_json,effective_params_json,
                status,validation_json,applied_result_json,created_at,decided_at,applied_at
         FROM capture_proposals WHERE capture_id = ?1 ORDER BY created_at, id",
    )?;
    let rows = s
        .query_map(params![capture_id], row_to_proposal)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn proposals_load_all_inner(conn: &Connection) -> DbResult<Vec<CaptureProposalRow>> {
    let mut s = conn.prepare(
        "SELECT id,capture_id,proposal_class,domain,mutation_kind,title,source_text,confidence,
                ambiguity_reason,rationale,evidence_json,original_params_json,effective_params_json,
                status,validation_json,applied_result_json,created_at,decided_at,applied_at
         FROM capture_proposals ORDER BY created_at, id",
    )?;
    let rows = s
        .query_map([], row_to_proposal)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn row_to_proposal(r: &rusqlite::Row<'_>) -> rusqlite::Result<CaptureProposalRow> {
    Ok(CaptureProposalRow {
        id: r.get(0)?,
        capture_id: r.get(1)?,
        proposal_class: r.get(2)?,
        domain: r.get(3)?,
        mutation_kind: r.get(4)?,
        title: r.get(5)?,
        source_text: r.get(6)?,
        confidence: r.get(7)?,
        ambiguity_reason: r.get(8)?,
        rationale: r.get(9)?,
        evidence_json: r.get(10)?,
        original_params_json: r.get(11)?,
        effective_params_json: r.get(12)?,
        status: r.get(13)?,
        validation_json: r.get(14)?,
        applied_result_json: r.get(15)?,
        created_at: r.get(16)?,
        decided_at: r.get(17)?,
        applied_at: r.get(18)?,
    })
}

fn proposal_upsert_inner(conn: &Connection, p: &CaptureProposalRow) -> DbResult<()> {
    proposal_validate(p)?;
    conn.execute(
        "INSERT INTO capture_proposals
            (id,capture_id,proposal_class,domain,mutation_kind,title,source_text,confidence,
             ambiguity_reason,rationale,evidence_json,original_params_json,effective_params_json,
             status,validation_json,applied_result_json,created_at,decided_at,applied_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)
         ON CONFLICT(id) DO UPDATE SET
            proposal_class=excluded.proposal_class, domain=excluded.domain,
            mutation_kind=excluded.mutation_kind, title=excluded.title,
            source_text=excluded.source_text, confidence=excluded.confidence,
            ambiguity_reason=excluded.ambiguity_reason, rationale=excluded.rationale,
            evidence_json=excluded.evidence_json,
            original_params_json=excluded.original_params_json,
            effective_params_json=excluded.effective_params_json,
            status=excluded.status, validation_json=excluded.validation_json,
            applied_result_json=excluded.applied_result_json,
            decided_at=excluded.decided_at, applied_at=excluded.applied_at",
        params![
            p.id,
            p.capture_id,
            p.proposal_class,
            p.domain,
            p.mutation_kind,
            p.title,
            p.source_text,
            p.confidence,
            p.ambiguity_reason,
            p.rationale,
            p.evidence_json,
            p.original_params_json,
            p.effective_params_json,
            p.status,
            p.validation_json,
            p.applied_result_json,
            p.created_at,
            p.decided_at,
            p.applied_at
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn capture_proposals_load(db: State<'_, Db>) -> DbResult<Vec<CaptureProposalRow>> {
    let conn = db.0.lock().unwrap();
    proposals_load_all_inner(&conn)
}

#[tauri::command]
pub fn capture_proposals_for(
    db: State<'_, Db>,
    capture_id: String,
) -> DbResult<Vec<CaptureProposalRow>> {
    let conn = db.0.lock().unwrap();
    proposals_load_inner(&conn, &capture_id)
}

#[tauri::command]
pub fn capture_proposal_upsert(db: State<'_, Db>, proposal: CaptureProposalRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    proposal_upsert_inner(&conn, &proposal)
}

#[tauri::command]
pub fn capture_proposal_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM capture_proposals WHERE id = ?1", params![id])?;
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

    // -- V2 capture proposals (migration v11) ---------------------------

    fn proposal(id: &str, capture_id: &str, class: &str) -> CaptureProposalRow {
        CaptureProposalRow {
            id: id.into(),
            capture_id: capture_id.into(),
            proposal_class: class.into(),
            domain: "Academics".into(),
            mutation_kind: "set-professor-coverage".into(),
            title: "Prof covered AVL trees".into(),
            source_text: "prof covered avl today".into(),
            confidence: "clear".into(),
            ambiguity_reason: None,
            rationale: "Matched an existing topic in DSA".into(),
            evidence_json: "[\"topic: AVL trees\"]".into(),
            original_params_json: "{\"topicId\":\"t1\",\"coverage\":\"covered\"}".into(),
            effective_params_json: "{\"topicId\":\"t1\",\"coverage\":\"covered\"}".into(),
            status: "proposed".into(),
            validation_json: None,
            applied_result_json: None,
            created_at: "2026-09-01T08:00:00.000Z".into(),
            decided_at: None,
            applied_at: None,
        }
    }

    #[test]
    fn one_capture_owns_many_fact_and_interpretation_proposals() {
        let c = mem();
        upsert_inner(&c, &item("cap1", "proposed")).unwrap();
        proposal_upsert_inner(&c, &proposal("p1", "cap1", "fact")).unwrap();
        let mut p2 = proposal("p2", "cap1", "interpretation");
        p2.domain = "Money".into();
        p2.mutation_kind = "create-expense".into();
        p2.confidence = "needs-review".into();
        proposal_upsert_inner(&c, &p2).unwrap();

        let all = proposals_load_inner(&c, "cap1").unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].proposal_class, "fact");
        assert_eq!(all[1].proposal_class, "interpretation");
    }

    #[test]
    fn proposals_cascade_when_the_inbox_row_is_deleted() {
        let c = mem();
        upsert_inner(&c, &item("cap1", "proposed")).unwrap();
        proposal_upsert_inner(&c, &proposal("p1", "cap1", "fact")).unwrap();
        c.execute("DELETE FROM capture_inbox WHERE id='cap1'", []).unwrap();
        assert_eq!(proposals_load_all_inner(&c).unwrap().len(), 0);
    }

    #[test]
    fn proposal_upsert_preserves_created_at_and_moves_status() {
        let c = mem();
        upsert_inner(&c, &item("cap1", "proposed")).unwrap();
        proposal_upsert_inner(&c, &proposal("p1", "cap1", "fact")).unwrap();
        let mut decided = proposal("p1", "cap1", "fact");
        decided.status = "accepted".into();
        decided.decided_at = Some("2026-09-01T09:00:00.000Z".into());
        decided.created_at = "2099-01-01".into(); // must be ignored on update
        proposal_upsert_inner(&c, &decided).unwrap();
        let rows = proposals_load_inner(&c, "cap1").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].status, "accepted");
        assert_eq!(rows[0].created_at, "2026-09-01T08:00:00.000Z");
    }

    #[test]
    fn proposal_rejects_unknown_class_confidence_or_status() {
        let c = mem();
        upsert_inner(&c, &item("cap1", "proposed")).unwrap();
        let mut bad = proposal("p1", "cap1", "recommendation"); // not a capture class
        assert!(proposal_upsert_inner(&c, &bad).is_err());
        bad.proposal_class = "fact".into();
        bad.confidence = "0.87".into(); // no fake numeric confidence
        assert!(proposal_upsert_inner(&c, &bad).is_err());
        bad.confidence = "clear".into();
        bad.status = "done".into();
        assert!(proposal_upsert_inner(&c, &bad).is_err());
    }

    #[test]
    fn proposal_wire_shape_matches_the_frontend_payload() {
        let json = serde_json::json!({
            "id": "p1",
            "captureId": "cap1",
            "proposalClass": "interpretation",
            "domain": "Reading & Language",
            "mutationKind": "create-language-session",
            "title": "German study 25m",
            "sourceText": "did 25 min of german",
            "confidence": "needs-review",
            "ambiguityReason": null,
            "rationale": "",
            "evidenceJson": "[]",
            "originalParamsJson": "{}",
            "effectiveParamsJson": "{}",
            "status": "proposed",
            "validationJson": null,
            "appliedResultJson": null,
            "createdAt": "2026-09-01T08:00:00.000Z",
            "decidedAt": null,
            "appliedAt": null
        });
        let parsed: CaptureProposalRow = serde_json::from_value(json).unwrap();
        assert_eq!(parsed.proposal_class, "interpretation");
        assert_eq!(parsed.mutation_kind, "create-language-session");
        let back = serde_json::to_value(&parsed).unwrap();
        assert_eq!(back["proposalClass"], "interpretation");
        assert!(back.get("proposal_class").is_none());
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
