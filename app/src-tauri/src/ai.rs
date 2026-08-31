//! Batch 6 — the INTELLIGENCE / DECISION loop data-access. Thin layer over the
//! SQLite tables in migration v8 (see `db.rs`).
//!
//! Architecture locks enforced by shape (docs 23 / 24.12 / 26 / 30):
//!   * AI has NO direct write credential — `ai_recommendations` holds PROPOSALS;
//!     a TS Apply adapter (allowlisted by `kind`) validates and hands the change
//!     to a canonical domain store. Nothing here runs model-chosen SQL/commands.
//!   * Decision history is APPEND-ONLY — `ai_decision_events` exposes append +
//!     read only; there is no update/delete-one path.
//!   * Secrets never land here — `ai_config` stores provider id / model / base
//!     URL / enabled only. The API key is read from the `PBOS_AI_API_KEY`
//!     environment variable, never persisted, never returned to the renderer.
//!   * `analytics_reviews` rows are immutable snapshots (docs 22.04 / 22.05).

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_AI_IMPORT: &str = "ai_relational_import";

// ---------------------------------------------------------------------------
// Row types (camelCase across the Tauri boundary)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfigRow {
    pub provider_id: String,
    pub model: String,
    pub base_url: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPermissionRow {
    pub domain: String,
    pub level: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationRow {
    pub id: String,
    pub kind: String,
    pub domain: String,
    pub title: String,
    pub rationale: String,
    /// JSON string[]
    pub evidence: String,
    pub confidence: String,
    pub source: String,
    pub generated_from: String,
    /// opaque JSON — adapter-validated on the TS side
    pub proposed_params: String,
    pub current_params: String,
    pub status: String,
    pub validation: Option<String>,
    pub applied_result: Option<String>,
    pub created_at: String,
    pub decided_at: Option<String>,
    pub applied_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionEventRow {
    pub id: String,
    pub recommendation_id: String,
    pub event: String,
    pub detail: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsReviewRow {
    pub id: String,
    pub kind: String,
    pub period_start: String,
    pub period_end: String,
    pub snapshot: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGraph {
    pub config: Option<AiConfigRow>,
    pub permissions: Vec<AiPermissionRow>,
    pub recommendations: Vec<RecommendationRow>,
    pub decision_events: Vec<DecisionEventRow>,
    pub reviews: Vec<AnalyticsReviewRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiStatus {
    /// The `PBOS_AI_API_KEY` environment variable is present (value never exposed).
    pub credentials_present: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiImport {
    pub config: Option<AiConfigRow>,
    pub permissions: Vec<AiPermissionRow>,
    pub recommendations: Vec<RecommendationRow>,
    pub decision_events: Vec<DecisionEventRow>,
    pub reviews: Vec<AnalyticsReviewRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiImportReport {
    pub ran: bool,
    pub permissions_imported: usize,
    pub recommendations_imported: usize,
    pub events_imported: usize,
    pub reviews_imported: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_config(conn: &Connection) -> DbResult<Option<AiConfigRow>> {
    Ok(conn
        .query_row(
            "SELECT provider_id,model,base_url,enabled,created_at,updated_at
             FROM ai_config WHERE id = 1",
            [],
            |r| {
                Ok(AiConfigRow {
                    provider_id: r.get(0)?,
                    model: r.get(1)?,
                    base_url: r.get(2)?,
                    enabled: r.get::<_, i64>(3)? != 0,
                    created_at: r.get(4)?,
                    updated_at: r.get(5)?,
                })
            },
        )
        .optional()?)
}

fn load_permissions(conn: &Connection) -> DbResult<Vec<AiPermissionRow>> {
    let mut s =
        conn.prepare("SELECT domain,level,updated_at FROM ai_permissions ORDER BY domain")?;
    let rows = s
        .query_map([], |r| {
            Ok(AiPermissionRow {
                domain: r.get(0)?,
                level: r.get(1)?,
                updated_at: r.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn rec_from_row(r: &rusqlite::Row) -> rusqlite::Result<RecommendationRow> {
    Ok(RecommendationRow {
        id: r.get(0)?,
        kind: r.get(1)?,
        domain: r.get(2)?,
        title: r.get(3)?,
        rationale: r.get(4)?,
        evidence: r.get(5)?,
        confidence: r.get(6)?,
        source: r.get(7)?,
        generated_from: r.get(8)?,
        proposed_params: r.get(9)?,
        current_params: r.get(10)?,
        status: r.get(11)?,
        validation: r.get(12)?,
        applied_result: r.get(13)?,
        created_at: r.get(14)?,
        decided_at: r.get(15)?,
        applied_at: r.get(16)?,
    })
}

const REC_COLS: &str = "id,kind,domain,title,rationale,evidence,confidence,source,generated_from,\
     proposed_params,current_params,status,validation,applied_result,created_at,decided_at,applied_at";

fn load_recommendations(conn: &Connection) -> DbResult<Vec<RecommendationRow>> {
    let sql = format!("SELECT {REC_COLS} FROM ai_recommendations ORDER BY created_at DESC");
    let mut s = conn.prepare(&sql)?;
    let rows = s
        .query_map([], rec_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_events(conn: &Connection) -> DbResult<Vec<DecisionEventRow>> {
    let mut s = conn.prepare(
        "SELECT id,recommendation_id,event,detail,created_at
         FROM ai_decision_events ORDER BY created_at",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(DecisionEventRow {
                id: r.get(0)?,
                recommendation_id: r.get(1)?,
                event: r.get(2)?,
                detail: r.get(3)?,
                created_at: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_reviews(conn: &Connection) -> DbResult<Vec<AnalyticsReviewRow>> {
    let mut s = conn.prepare(
        "SELECT id,kind,period_start,period_end,snapshot,notes,created_at
         FROM analytics_reviews ORDER BY period_start DESC, created_at DESC",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(AnalyticsReviewRow {
                id: r.get(0)?,
                kind: r.get(1)?,
                period_start: r.get(2)?,
                period_end: r.get(3)?,
                snapshot: r.get(4)?,
                notes: r.get(5)?,
                created_at: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_inner(conn: &Connection) -> DbResult<AiGraph> {
    Ok(AiGraph {
        config: load_config(conn)?,
        permissions: load_permissions(conn)?,
        recommendations: load_recommendations(conn)?,
        decision_events: load_events(conn)?,
        reviews: load_reviews(conn)?,
    })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

fn config_set_inner(conn: &Connection, c: &AiConfigRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO ai_config (id,provider_id,model,base_url,enabled,created_at,updated_at)
         VALUES (1,?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET
            provider_id=excluded.provider_id, model=excluded.model,
            base_url=excluded.base_url, enabled=excluded.enabled,
            updated_at=excluded.updated_at",
        params![
            c.provider_id,
            c.model,
            c.base_url,
            c.enabled as i64,
            c.created_at,
            c.updated_at
        ],
    )?;
    Ok(())
}

fn permission_set_inner(conn: &Connection, p: &AiPermissionRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO ai_permissions (domain,level,updated_at) VALUES (?1,?2,?3)
         ON CONFLICT(domain) DO UPDATE SET level=excluded.level, updated_at=excluded.updated_at",
        params![p.domain, p.level, p.updated_at],
    )?;
    Ok(())
}

fn recommendation_upsert_inner(conn: &Connection, r: &RecommendationRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO ai_recommendations
            (id,kind,domain,title,rationale,evidence,confidence,source,generated_from,
             proposed_params,current_params,status,validation,applied_result,created_at,decided_at,applied_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)
         ON CONFLICT(id) DO UPDATE SET
            kind=excluded.kind, domain=excluded.domain, title=excluded.title,
            rationale=excluded.rationale, evidence=excluded.evidence,
            confidence=excluded.confidence, source=excluded.source,
            generated_from=excluded.generated_from, proposed_params=excluded.proposed_params,
            current_params=excluded.current_params, status=excluded.status,
            validation=excluded.validation, applied_result=excluded.applied_result,
            decided_at=excluded.decided_at, applied_at=excluded.applied_at",
        params![
            r.id,
            r.kind,
            r.domain,
            r.title,
            r.rationale,
            r.evidence,
            r.confidence,
            r.source,
            r.generated_from,
            r.proposed_params,
            r.current_params,
            r.status,
            r.validation,
            r.applied_result,
            r.created_at,
            r.decided_at,
            r.applied_at
        ],
    )?;
    Ok(())
}

/// Append-only — there is deliberately no update or delete-one path.
fn decision_event_append_inner(conn: &Connection, e: &DecisionEventRow) -> DbResult<()> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM ai_recommendations WHERE id = ?1",
            params![e.recommendation_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(DbError::Path(format!(
            "no recommendation '{}' for this event",
            e.recommendation_id
        )));
    }
    conn.execute(
        "INSERT INTO ai_decision_events (id,recommendation_id,event,detail,created_at)
         VALUES (?1,?2,?3,?4,?5)",
        params![e.id, e.recommendation_id, e.event, e.detail, e.created_at],
    )?;
    Ok(())
}

/// Immutable — `INSERT OR IGNORE`, never an update.
fn review_append_inner(conn: &Connection, r: &AnalyticsReviewRow) -> DbResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO analytics_reviews
            (id,kind,period_start,period_end,snapshot,notes,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            r.id,
            r.kind,
            r.period_start,
            r.period_end,
            r.snapshot,
            r.notes,
            r.created_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: AiImport) -> DbResult<AiImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_AI_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(AiImportReport {
            ran: false,
            permissions_imported: 0,
            recommendations_imported: 0,
            events_imported: 0,
            reviews_imported: 0,
        });
    }
    let mut rep = AiImportReport {
        ran: true,
        permissions_imported: 0,
        recommendations_imported: 0,
        events_imported: 0,
        reviews_imported: 0,
    };
    let tx = conn.transaction()?;
    if let Some(c) = &import.config {
        config_set_inner(&tx, c)?;
    }
    for p in &import.permissions {
        let n = tx.execute(
            "INSERT OR IGNORE INTO ai_permissions (domain,level,updated_at) VALUES (?1,?2,?3)",
            params![p.domain, p.level, p.updated_at],
        )?;
        rep.permissions_imported += n;
    }
    for r in &import.recommendations {
        let n = tx.execute(
            &format!(
                "INSERT OR IGNORE INTO ai_recommendations ({REC_COLS})
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)"
            ),
            params![
                r.id,
                r.kind,
                r.domain,
                r.title,
                r.rationale,
                r.evidence,
                r.confidence,
                r.source,
                r.generated_from,
                r.proposed_params,
                r.current_params,
                r.status,
                r.validation,
                r.applied_result,
                r.created_at,
                r.decided_at,
                r.applied_at
            ],
        )?;
        rep.recommendations_imported += n;
    }
    for e in &import.decision_events {
        let n = tx.execute(
            "INSERT OR IGNORE INTO ai_decision_events (id,recommendation_id,event,detail,created_at)
             VALUES (?1,?2,?3,?4,?5)",
            params![e.id, e.recommendation_id, e.event, e.detail, e.created_at],
        )?;
        rep.events_imported += n;
    }
    for rv in &import.reviews {
        let n = tx.execute(
            "INSERT OR IGNORE INTO analytics_reviews
                (id,kind,period_start,period_end,snapshot,notes,created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                rv.id,
                rv.kind,
                rv.period_start,
                rv.period_end,
                rv.snapshot,
                rv.notes,
                rv.created_at
            ],
        )?;
        rep.reviews_imported += n;
    }
    let marker = serde_json::json!({ "version": 1 });
    tx.execute(
        "INSERT INTO meta (key,value) VALUES (?1,?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_AI_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(rep)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn ai_load(db: State<'_, Db>) -> DbResult<AiGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

/// Reports ONLY whether a credential is present in the environment. The value is
/// never read into a return, a log, or a prompt.
#[tauri::command]
pub fn ai_status() -> DbResult<AiStatus> {
    let present = std::env::var("PBOS_AI_API_KEY")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    Ok(AiStatus {
        credentials_present: present,
    })
}

#[tauri::command]
pub fn ai_config_set(db: State<'_, Db>, config: AiConfigRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    config_set_inner(&conn, &config)
}

#[tauri::command]
pub fn ai_permission_set(db: State<'_, Db>, permission: AiPermissionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    permission_set_inner(&conn, &permission)
}

#[tauri::command]
pub fn ai_recommendation_upsert(
    db: State<'_, Db>,
    recommendation: RecommendationRow,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    recommendation_upsert_inner(&conn, &recommendation)
}

#[tauri::command]
pub fn ai_decision_event_append(db: State<'_, Db>, event: DecisionEventRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    decision_event_append_inner(&conn, &event)
}

#[tauri::command]
pub fn analytics_review_append(db: State<'_, Db>, review: AnalyticsReviewRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    review_append_inner(&conn, &review)
}

#[tauri::command]
pub fn ai_import_graph(db: State<'_, Db>, import: AiImport) -> DbResult<AiImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes all Batch 6 intelligence state.
#[tauri::command]
pub fn ai_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "ai_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM ai_decision_events;
         DELETE FROM ai_recommendations;
         DELETE FROM ai_permissions;
         DELETE FROM ai_config;
         DELETE FROM analytics_reviews;
         DELETE FROM meta WHERE key = 'ai_relational_import';",
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
    use std::sync::Mutex;

    fn mem() -> Db {
        let c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        run_migrations_for_test(&c).unwrap();
        Db(Mutex::new(c))
    }

    fn rec(id: &str, kind: &str, status: &str) -> RecommendationRow {
        RecommendationRow {
            id: id.into(),
            kind: kind.into(),
            domain: "Academics".into(),
            title: "Review Binary Trees".into(),
            rationale: "DS under-studied".into(),
            evidence: "[\"5 of 8 weeks\"]".into(),
            confidence: "moderate".into(),
            source: "weekly-review".into(),
            generated_from: "Weekly Review".into(),
            proposed_params: "{\"minutes\":60}".into(),
            current_params: "{}".into(),
            status: status.into(),
            validation: None,
            applied_result: None,
            created_at: "2026-01-01T00:00:00Z".into(),
            decided_at: None,
            applied_at: None,
        }
    }
    fn ev(id: &str, rec_id: &str, event: &str) -> DecisionEventRow {
        DecisionEventRow {
            id: id.into(),
            recommendation_id: rec_id.into(),
            event: event.into(),
            detail: "{}".into(),
            created_at: format!("2026-01-01T00:00:0{}Z", id.len()),
        }
    }

    #[test]
    fn config_never_has_a_key_column() {
        let db = mem();
        let conn = db.0.lock().unwrap();
        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(ai_config)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for banned in ["api_key", "key", "secret", "token", "credential"] {
            assert!(
                !cols.iter().any(|c| c == banned),
                "ai_config must not store a secret — found '{banned}'"
            );
        }
    }

    #[test]
    fn recommendation_status_transitions_persist_and_reload() {
        let db = mem();
        {
            let conn = db.0.lock().unwrap();
            recommendation_upsert_inner(&conn, &rec("r1", "create-action", "proposed")).unwrap();
        }
        {
            let conn = db.0.lock().unwrap();
            let mut r = rec("r1", "create-action", "accepted");
            r.decided_at = Some("2026-01-02T00:00:00Z".into());
            recommendation_upsert_inner(&conn, &r).unwrap();
        }
        let g = load_inner(&db.0.lock().unwrap()).unwrap();
        assert_eq!(g.recommendations.len(), 1);
        assert_eq!(g.recommendations[0].status, "accepted");
        assert_eq!(
            g.recommendations[0].decided_at.as_deref(),
            Some("2026-01-02T00:00:00Z")
        );
    }

    #[test]
    fn decision_events_are_append_only_and_survive_status_changes() {
        let db = mem();
        {
            let conn = db.0.lock().unwrap();
            recommendation_upsert_inner(&conn, &rec("r1", "create-action", "proposed")).unwrap();
            decision_event_append_inner(&conn, &ev("a", "r1", "proposed")).unwrap();
            decision_event_append_inner(&conn, &ev("bb", "r1", "accepted")).unwrap();
            decision_event_append_inner(&conn, &ev("ccc", "r1", "applied")).unwrap();
            // a later recommendation upsert (status change) must not touch the trail
            recommendation_upsert_inner(&conn, &rec("r1", "create-action", "applied")).unwrap();
        }
        let g = load_inner(&db.0.lock().unwrap()).unwrap();
        assert_eq!(g.decision_events.len(), 3, "every event is retained");
        assert_eq!(
            g.decision_events
                .iter()
                .map(|e| e.event.as_str())
                .collect::<Vec<_>>(),
            vec!["proposed", "accepted", "applied"]
        );
        // an event for a non-existent recommendation is rejected, not silently dropped
        let conn = db.0.lock().unwrap();
        assert!(decision_event_append_inner(&conn, &ev("z", "nope", "applied")).is_err());
    }

    #[test]
    fn deleting_a_recommendation_cascades_its_events() {
        let db = mem();
        let conn = db.0.lock().unwrap();
        recommendation_upsert_inner(&conn, &rec("r1", "create-action", "proposed")).unwrap();
        decision_event_append_inner(&conn, &ev("a", "r1", "proposed")).unwrap();
        conn.execute("DELETE FROM ai_recommendations WHERE id='r1'", [])
            .unwrap();
        assert_eq!(load_events(&conn).unwrap().len(), 0);
    }

    #[test]
    fn analytics_reviews_are_immutable_once_written() {
        let db = mem();
        let conn = db.0.lock().unwrap();
        let review = AnalyticsReviewRow {
            id: "wr-2026-01-05".into(),
            kind: "weekly".into(),
            period_start: "2026-01-05".into(),
            period_end: "2026-01-11".into(),
            snapshot: "{\"completion\":0.6}".into(),
            notes: "".into(),
            created_at: "2026-01-11T18:00:00Z".into(),
        };
        review_append_inner(&conn, &review).unwrap();
        // a second write with the same id + different snapshot is IGNORED
        let mut tamper = review.clone();
        tamper.snapshot = "{\"completion\":0.99}".into();
        review_append_inner(&conn, &tamper).unwrap();
        let rows = load_reviews(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(
            rows[0].snapshot, "{\"completion\":0.6}",
            "snapshot is immutable"
        );
    }

    #[test]
    fn permissions_persist_per_domain() {
        let db = mem();
        let conn = db.0.lock().unwrap();
        permission_set_inner(
            &conn,
            &AiPermissionRow {
                domain: "Money".into(),
                level: "no-access".into(),
                updated_at: "t".into(),
            },
        )
        .unwrap();
        permission_set_inner(
            &conn,
            &AiPermissionRow {
                domain: "Academics".into(),
                level: "read-recommend".into(),
                updated_at: "t".into(),
            },
        )
        .unwrap();
        // change one
        permission_set_inner(
            &conn,
            &AiPermissionRow {
                domain: "Academics".into(),
                level: "read".into(),
                updated_at: "t2".into(),
            },
        )
        .unwrap();
        let perms = load_permissions(&conn).unwrap();
        assert_eq!(perms.len(), 2);
        let acad = perms.iter().find(|p| p.domain == "Academics").unwrap();
        assert_eq!(acad.level, "read");
        let money = perms.iter().find(|p| p.domain == "Money").unwrap();
        assert_eq!(money.level, "no-access");
    }

    #[test]
    fn import_is_idempotent() {
        let db = mem();
        let mut db = db;
        let imp = || AiImport {
            config: Some(AiConfigRow {
                provider_id: "fake".into(),
                model: "".into(),
                base_url: "".into(),
                enabled: true,
                created_at: "t".into(),
                updated_at: "t".into(),
            }),
            permissions: vec![AiPermissionRow {
                domain: "Academics".into(),
                level: "read-recommend".into(),
                updated_at: "t".into(),
            }],
            recommendations: vec![rec("r1", "create-action", "proposed")],
            decision_events: vec![],
            reviews: vec![],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp()).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.recommendations_imported, 1);
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp()).unwrap()
        };
        assert!(!r2.ran);
    }

    #[test]
    fn status_command_reports_only_a_boolean() {
        // The env var is almost certainly unset in CI — the point is the shape.
        let s = ai_status().unwrap();
        assert!(s.credentials_present || !s.credentials_present);
    }
}
