//! Batch 2A — canonical relational persistence for the Knowledge domain
//! (Topic -> Source, Topic -> Evidence). Thin data-access over the SQLite
//! tables created in migration v3 (see `db.rs`).
//!
//! Knowledge state (New/Learning/Developing/Strong) and mastery are DERIVED
//! from recorded evidence in the TS engine — never stored here. Saving or
//! linking a source is not evidence of understanding (docs/15.08).
//!
//! Relationship truth:
//!   topic -> source   : `knowledge_sources.topic_id` (FK; CASCADE)
//!   topic -> evidence : `knowledge_evidence.topic_id` (FK; CASCADE)

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_KNOW_IMPORT: &str = "knowledge_relational_import";

// ---------------------------------------------------------------------------
// Row types crossing the Tauri boundary (camelCase to match the TS repo)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeTopicRow {
    pub id: String,
    pub title: String,
    pub category: String,
    pub context: String,
    pub last_studied: Option<String>,
    pub next_review_date: Option<String>,
    pub related_goal_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSourceRow {
    pub id: String,
    pub topic_id: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub title: String,
    pub reference: String,
    pub added_date: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeEvidenceRow {
    pub id: String,
    pub topic_id: String,
    #[serde(rename = "type")]
    pub evidence_type: String,
    pub title: String,
    pub score: f64,
    pub max_score: f64,
    pub date: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraph {
    pub topics: Vec<KnowledgeTopicRow>,
    pub sources: Vec<KnowledgeSourceRow>,
    pub evidence: Vec<KnowledgeEvidenceRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeImport {
    pub topics: Vec<KnowledgeTopicRow>,
    pub sources: Vec<KnowledgeSourceRow>,
    pub evidence: Vec<KnowledgeEvidenceRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeImportReport {
    pub ran: bool,
    pub topics_imported: usize,
    pub sources_imported: usize,
    pub evidence_imported: usize,
    pub topics_skipped_existing: usize,
    pub sources_skipped_existing: usize,
    pub evidence_skipped_existing: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<KnowledgeGraph> {
    let mut tstmt = conn.prepare(
        "SELECT id,title,category,context,last_studied,next_review_date,related_goal_id,created_at,updated_at
         FROM knowledge_topics ORDER BY created_at",
    )?;
    let topics = tstmt
        .query_map([], |r| {
            Ok(KnowledgeTopicRow {
                id: r.get(0)?,
                title: r.get(1)?,
                category: r.get(2)?,
                context: r.get(3)?,
                last_studied: r.get(4)?,
                next_review_date: r.get(5)?,
                related_goal_id: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut sstmt = conn.prepare(
        "SELECT id,topic_id,type,title,reference,added_date,created_at,updated_at
         FROM knowledge_sources ORDER BY added_date, created_at",
    )?;
    let sources = sstmt
        .query_map([], |r| {
            Ok(KnowledgeSourceRow {
                id: r.get(0)?,
                topic_id: r.get(1)?,
                source_type: r.get(2)?,
                title: r.get(3)?,
                reference: r.get(4)?,
                added_date: r.get(5)?,
                created_at: r.get(6)?,
                updated_at: r.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut estmt = conn.prepare(
        "SELECT id,topic_id,type,title,score,max_score,date,created_at,updated_at
         FROM knowledge_evidence ORDER BY date, created_at",
    )?;
    let evidence = estmt
        .query_map([], |r| {
            Ok(KnowledgeEvidenceRow {
                id: r.get(0)?,
                topic_id: r.get(1)?,
                evidence_type: r.get(2)?,
                title: r.get(3)?,
                score: r.get(4)?,
                max_score: r.get(5)?,
                date: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(KnowledgeGraph {
        topics,
        sources,
        evidence,
    })
}

// ---------------------------------------------------------------------------
// Writes (upsert = create-or-replace by id, preserving created_at on update)
// ---------------------------------------------------------------------------

fn topic_upsert_inner(conn: &Connection, t: &KnowledgeTopicRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO knowledge_topics
            (id,title,category,context,last_studied,next_review_date,related_goal_id,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, category=excluded.category, context=excluded.context,
            last_studied=excluded.last_studied, next_review_date=excluded.next_review_date,
            related_goal_id=excluded.related_goal_id, updated_at=excluded.updated_at",
        params![
            t.id, t.title, t.category, t.context, t.last_studied, t.next_review_date,
            t.related_goal_id, t.created_at, t.updated_at
        ],
    )?;
    Ok(())
}

fn source_upsert_inner(conn: &Connection, s: &KnowledgeSourceRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO knowledge_sources
            (id,topic_id,type,title,reference,added_date,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(id) DO UPDATE SET
            topic_id=excluded.topic_id, type=excluded.type, title=excluded.title,
            reference=excluded.reference, added_date=excluded.added_date, updated_at=excluded.updated_at",
        params![
            s.id, s.topic_id, s.source_type, s.title, s.reference, s.added_date,
            s.created_at, s.updated_at
        ],
    )?;
    Ok(())
}

fn evidence_upsert_inner(conn: &Connection, e: &KnowledgeEvidenceRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO knowledge_evidence
            (id,topic_id,type,title,score,max_score,date,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            topic_id=excluded.topic_id, type=excluded.type, title=excluded.title,
            score=excluded.score, max_score=excluded.max_score, date=excluded.date,
            updated_at=excluded.updated_at",
        params![
            e.id,
            e.topic_id,
            e.evidence_type,
            e.title,
            e.score,
            e.max_score,
            e.date,
            e.created_at,
            e.updated_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: KnowledgeImport) -> DbResult<KnowledgeImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_KNOW_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(KnowledgeImportReport {
            ran: false,
            topics_imported: 0,
            sources_imported: 0,
            evidence_imported: 0,
            topics_skipped_existing: 0,
            sources_skipped_existing: 0,
            evidence_skipped_existing: 0,
        });
    }

    let mut r = KnowledgeImportReport {
        ran: true,
        topics_imported: 0,
        sources_imported: 0,
        evidence_imported: 0,
        topics_skipped_existing: 0,
        sources_skipped_existing: 0,
        evidence_skipped_existing: 0,
    };

    let tx = conn.transaction()?;
    for t in &import.topics {
        let n = tx.execute(
            "INSERT OR IGNORE INTO knowledge_topics
                (id,title,category,context,last_studied,next_review_date,related_goal_id,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                t.id, t.title, t.category, t.context, t.last_studied, t.next_review_date,
                t.related_goal_id, t.created_at, t.updated_at
            ],
        )?;
        if n == 1 {
            r.topics_imported += 1
        } else {
            r.topics_skipped_existing += 1
        }
    }
    for s in &import.sources {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM knowledge_topics WHERE id = ?1",
                params![s.topic_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue; // dangling source dropped — the TS resolver reports it
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO knowledge_sources
                (id,topic_id,type,title,reference,added_date,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                s.id,
                s.topic_id,
                s.source_type,
                s.title,
                s.reference,
                s.added_date,
                s.created_at,
                s.updated_at
            ],
        )?;
        if n == 1 {
            r.sources_imported += 1
        } else {
            r.sources_skipped_existing += 1
        }
    }
    for e in &import.evidence {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM knowledge_topics WHERE id = ?1",
                params![e.topic_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO knowledge_evidence
                (id,topic_id,type,title,score,max_score,date,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                e.id,
                e.topic_id,
                e.evidence_type,
                e.title,
                e.score,
                e.max_score,
                e.date,
                e.created_at,
                e.updated_at
            ],
        )?;
        if n == 1 {
            r.evidence_imported += 1
        } else {
            r.evidence_skipped_existing += 1
        }
    }

    let marker = serde_json::json!({
        "version": 1,
        "topicsImported": r.topics_imported,
        "sourcesImported": r.sources_imported,
        "evidenceImported": r.evidence_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_KNOW_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn know_load(db: State<'_, Db>) -> DbResult<KnowledgeGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn know_topic_upsert(db: State<'_, Db>, topic: KnowledgeTopicRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    topic_upsert_inner(&conn, &topic)
}

#[tauri::command]
pub fn know_topic_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // sources + evidence CASCADE; any academic_topics.knowledge_topic_id SET NULL.
    conn.execute("DELETE FROM knowledge_topics WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn know_source_upsert(db: State<'_, Db>, source: KnowledgeSourceRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    source_upsert_inner(&conn, &source)
}

#[tauri::command]
pub fn know_source_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM knowledge_sources WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn know_evidence_upsert(db: State<'_, Db>, evidence: KnowledgeEvidenceRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    evidence_upsert_inner(&conn, &evidence)
}

#[tauri::command]
pub fn know_evidence_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM knowledge_evidence WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn know_import_graph(
    db: State<'_, Db>,
    import: KnowledgeImport,
) -> DbResult<KnowledgeImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Knowledge graph + its import marker so native E2E can
/// run the real-user scenario from a clean state.
#[tauri::command]
pub fn know_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "know_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM knowledge_evidence;
         DELETE FROM knowledge_sources;
         DELETE FROM knowledge_topics;
         DELETE FROM kv_store WHERE key IN
           ('pbos:knowledge-topics','pbos:knowledge-sources','pbos:knowledge-evidence');
         INSERT INTO meta (key,value) VALUES ('knowledge_relational_import','{\"version\":1,\"reset\":true}')
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

    fn topic(id: &str, title: &str) -> KnowledgeTopicRow {
        KnowledgeTopicRow {
            id: id.into(),
            title: title.into(),
            category: "academic".into(),
            context: "Data Structures".into(),
            last_studied: None,
            next_review_date: None,
            related_goal_id: None,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn source(id: &str, topic_id: &str) -> KnowledgeSourceRow {
        KnowledgeSourceRow {
            id: id.into(),
            topic_id: topic_id.into(),
            source_type: "article".into(),
            title: format!("Source {id}"),
            reference: "path/to/thing".into(),
            added_date: "2026-01-02".into(),
            created_at: "2026-01-02".into(),
            updated_at: "2026-01-02".into(),
        }
    }
    fn evidence(id: &str, topic_id: &str, score: f64) -> KnowledgeEvidenceRow {
        KnowledgeEvidenceRow {
            id: id.into(),
            topic_id: topic_id.into(),
            evidence_type: "recall".into(),
            title: format!("Recall {id}"),
            score,
            max_score: 10.0,
            date: "2026-01-03".into(),
            created_at: "2026-01-03".into(),
            updated_at: "2026-01-03".into(),
        }
    }

    #[test]
    fn crud_and_cascade_delete() {
        let c = mem();
        topic_upsert_inner(&c, &topic("t1", "Binary Trees")).unwrap();
        source_upsert_inner(&c, &source("s1", "t1")).unwrap();
        evidence_upsert_inner(&c, &evidence("e1", "t1", 8.0)).unwrap();

        let g = load_inner(&c).unwrap();
        assert_eq!(g.topics.len(), 1);
        assert_eq!(g.sources.len(), 1);
        assert_eq!(g.evidence.len(), 1);

        c.execute("DELETE FROM knowledge_topics WHERE id = 't1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.topics.len(), 0);
        assert_eq!(g.sources.len(), 0, "sources cascade with the topic");
        assert_eq!(g.evidence.len(), 0, "evidence cascades with the topic");
    }

    #[test]
    fn fk_rejects_orphan_source() {
        let c = mem();
        let err = c.execute(
            "INSERT INTO knowledge_sources (id,topic_id,type,title,reference,added_date,created_at,updated_at)
             VALUES ('s1','ghost','article','x','y','2026-01-01','2026-01-01','2026-01-01')",
            [],
        );
        assert!(
            err.is_err(),
            "FK must reject a source pointing at a missing topic"
        );
    }

    #[test]
    fn import_is_idempotent_and_non_destructive() {
        let c = mem();
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = KnowledgeImport {
            topics: vec![topic("t1", "Binary Trees")],
            sources: vec![source("s1", "t1"), source("s2", "ghost")],
            evidence: vec![evidence("e1", "t1", 7.0), evidence("e2", "ghost", 5.0)],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.topics_imported, 1);
        assert_eq!(
            r1.sources_imported, 1,
            "the dangling source to 'ghost' is dropped"
        );
        assert_eq!(
            r1.evidence_imported, 1,
            "the dangling evidence to 'ghost' is dropped"
        );

        // Mutate a canonical record, then re-import: must be a no-op.
        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE knowledge_topics SET title = 'EDITED' WHERE id = 't1'",
                [],
            )
            .unwrap();
        }
        let imp2 = KnowledgeImport {
            topics: vec![topic("t1", "Binary Trees")],
            sources: vec![],
            evidence: vec![],
        };
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp2).unwrap()
        };
        assert!(!r2.ran);
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            assert_eq!(
                g.topics[0].title, "EDITED",
                "re-import must not clobber newer canonical data"
            );
        }
    }
}
