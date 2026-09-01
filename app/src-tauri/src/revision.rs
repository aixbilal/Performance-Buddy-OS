//! Batch 8 — the general cross-domain revision / audit event store. Thin,
//! append-only data-access over the `revision_events` table (migration v10).
//!
//! Product model (`docs/32` data class 3, audit finding P1-20):
//!   an important user-visible change in ANY domain appends ONE immutable row
//!   here — domain / entity / operation / source / a short human summary, plus
//!   a SMALL optional `metadata` blob for a targeted before/after. This is a
//!   history log the user can inspect; it is never authoritative domain state
//!   and never a full entity snapshot.
//!
//!   APPEND-ONLY BY SHAPE: the only write is `revision_append` (INSERT OR
//!   IGNORE — a retried append with the same id is a no-op, so a store that
//!   fires the same event twice never double-records). There is deliberately
//!   no update-one / delete-one command. `revision_reset_for_test` is
//!   debug-only, like every other domain's.
//!
//!   The AI decision trail keeps its own `ai_decision_events` table; an
//!   AI-applied canonical mutation appends here too with `source =
//!   "ai-applied"` so one screen can show every domain's changes, but the two
//!   tables are not merged.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionEventRow {
    pub id: String,
    pub domain: String,
    pub entity_type: String,
    pub entity_id: String,
    pub operation: String,
    pub source: String,
    pub summary: String,
    /// Small opaque JSON produced on the TS side — a targeted before/after,
    /// never a full entity dump.
    pub metadata: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionQuery {
    pub domain: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    /// Hard cap on rows returned (newest first). Defaults to 200.
    pub limit: Option<u32>,
}

// ---------------------------------------------------------------------------
// Inner (testable without Tauri)
// ---------------------------------------------------------------------------

fn append_inner(conn: &Connection, e: &RevisionEventRow) -> DbResult<bool> {
    let n = conn.execute(
        "INSERT OR IGNORE INTO revision_events
            (id,domain,entity_type,entity_id,operation,source,summary,metadata,created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            e.id,
            e.domain,
            e.entity_type,
            e.entity_id,
            e.operation,
            e.source,
            e.summary,
            e.metadata,
            e.created_at,
        ],
    )?;
    Ok(n == 1)
}

fn query_inner(conn: &Connection, q: &RevisionQuery) -> DbResult<Vec<RevisionEventRow>> {
    let limit = q.limit.unwrap_or(200).min(1000);
    // Build a small dynamic WHERE — every fragment is a bound parameter, no
    // string interpolation of user values.
    let mut sql = String::from(
        "SELECT id,domain,entity_type,entity_id,operation,source,summary,metadata,created_at
         FROM revision_events",
    );
    let mut clauses: Vec<&str> = Vec::new();
    if q.domain.is_some() {
        clauses.push("domain = :domain");
    }
    if q.entity_type.is_some() {
        clauses.push("entity_type = :entity_type");
    }
    if q.entity_id.is_some() {
        clauses.push("entity_id = :entity_id");
    }
    if !clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&clauses.join(" AND "));
    }
    sql.push_str(" ORDER BY created_at DESC, rowid DESC LIMIT :limit");

    let mut stmt = conn.prepare(&sql)?;
    let mut named: Vec<(&str, &dyn rusqlite::ToSql)> = Vec::new();
    if let Some(v) = &q.domain {
        named.push((":domain", v));
    }
    if let Some(v) = &q.entity_type {
        named.push((":entity_type", v));
    }
    if let Some(v) = &q.entity_id {
        named.push((":entity_id", v));
    }
    named.push((":limit", &limit));

    let rows = stmt
        .query_map(named.as_slice(), |r| {
            Ok(RevisionEventRow {
                id: r.get(0)?,
                domain: r.get(1)?,
                entity_type: r.get(2)?,
                entity_id: r.get(3)?,
                operation: r.get(4)?,
                source: r.get(5)?,
                summary: r.get(6)?,
                metadata: r.get(7)?,
                created_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Append one immutable revision event. Returns `true` if a new row was
/// written, `false` if the id already existed (idempotent retry).
#[tauri::command]
pub fn revision_append(db: State<'_, Db>, event: RevisionEventRow) -> DbResult<bool> {
    let conn = db.0.lock().unwrap();
    append_inner(&conn, &event)
}

/// Load revision events (newest first), optionally filtered by domain /
/// entity type / entity id.
#[tauri::command]
pub fn revision_load(
    db: State<'_, Db>,
    query: Option<RevisionQuery>,
) -> DbResult<Vec<RevisionEventRow>> {
    let conn = db.0.lock().unwrap();
    query_inner(
        &conn,
        &query.unwrap_or(RevisionQuery {
            domain: None,
            entity_type: None,
            entity_id: None,
            limit: None,
        }),
    )
}

/// DEBUG ONLY — clears the revision log. Never available in release.
#[tauri::command]
pub fn revision_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "revision_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM revision_events", [])?;
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

    fn ev(id: &str, domain: &str, entity_id: &str, op: &str, at: &str) -> RevisionEventRow {
        RevisionEventRow {
            id: id.into(),
            domain: domain.into(),
            entity_type: "action".into(),
            entity_id: entity_id.into(),
            operation: op.into(),
            source: "user".into(),
            summary: format!("{op} {entity_id}"),
            metadata: "{}".into(),
            created_at: at.into(),
        }
    }

    #[test]
    fn append_persists_and_reloads_newest_first() {
        let c = mem();
        assert!(append_inner(
            &c,
            &ev(
                "r1",
                "performance",
                "a1",
                "create",
                "2026-01-01T00:00:00.000Z"
            )
        )
        .unwrap());
        assert!(append_inner(
            &c,
            &ev(
                "r2",
                "performance",
                "a1",
                "status-change",
                "2026-01-02T00:00:00.000Z"
            )
        )
        .unwrap());
        let all = query_inner(
            &c,
            &RevisionQuery {
                domain: None,
                entity_type: None,
                entity_id: None,
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].id, "r2", "newest first");
        assert_eq!(all[1].id, "r1");
    }

    #[test]
    fn append_is_idempotent_on_id() {
        let c = mem();
        assert!(append_inner(
            &c,
            &ev("r1", "routine", "x", "check-in", "2026-01-01T00:00:00.000Z")
        )
        .unwrap());
        // Same id, different payload — must NOT create a second row and must
        // NOT overwrite the first (append-only).
        let mut dup = ev("r1", "routine", "x", "check-in", "2099-01-01T00:00:00.000Z");
        dup.summary = "tampered".into();
        assert!(!append_inner(&c, &dup).unwrap(), "duplicate id is a no-op");
        let all = query_inner(
            &c,
            &RevisionQuery {
                domain: None,
                entity_type: None,
                entity_id: None,
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].summary, "check-in x", "first write is immutable");
        assert_eq!(all[0].created_at, "2026-01-01T00:00:00.000Z");
    }

    #[test]
    fn query_filters_by_domain_and_entity() {
        let c = mem();
        append_inner(
            &c,
            &ev(
                "r1",
                "performance",
                "a1",
                "create",
                "2026-01-01T00:00:00.000Z",
            ),
        )
        .unwrap();
        append_inner(
            &c,
            &ev(
                "r2",
                "performance",
                "a2",
                "create",
                "2026-01-02T00:00:00.000Z",
            ),
        )
        .unwrap();
        append_inner(
            &c,
            &ev("r3", "money", "t1", "create", "2026-01-03T00:00:00.000Z"),
        )
        .unwrap();

        let perf = query_inner(
            &c,
            &RevisionQuery {
                domain: Some("performance".into()),
                entity_type: None,
                entity_id: None,
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(perf.len(), 2);
        assert!(perf.iter().all(|e| e.domain == "performance"));

        let a1 = query_inner(
            &c,
            &RevisionQuery {
                domain: Some("performance".into()),
                entity_type: Some("action".into()),
                entity_id: Some("a1".into()),
                limit: None,
            },
        )
        .unwrap();
        assert_eq!(a1.len(), 1);
        assert_eq!(a1[0].id, "r1");
    }

    #[test]
    fn query_respects_the_limit_cap() {
        let c = mem();
        for i in 0..10 {
            append_inner(
                &c,
                &ev(
                    &format!("r{i}"),
                    "performance",
                    "a1",
                    "update",
                    &format!("2026-01-{:02}T00:00:00.000Z", i + 1),
                ),
            )
            .unwrap();
        }
        let limited = query_inner(
            &c,
            &RevisionQuery {
                domain: None,
                entity_type: None,
                entity_id: None,
                limit: Some(3),
            },
        )
        .unwrap();
        assert_eq!(limited.len(), 3);
        assert_eq!(limited[0].id, "r9", "newest three");
    }

    #[test]
    fn revision_store_is_not_authoritative_it_only_records() {
        // Sanity: the table carries no derived-truth columns (mastery, grade,
        // balance, score). If a later migration adds one this fails loudly.
        let c = mem();
        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('revision_events')")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for banned in ["mastery", "grade", "balance", "score", "percent"] {
            assert!(
                !cols.iter().any(|c| c.contains(banned)),
                "revision_events must not carry derived domain truth ({banned})"
            );
        }
    }
}
