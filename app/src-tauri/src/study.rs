//! Batch 4 — the ACADEMIC EXECUTION loop: durable Focus session history and
//! personal Mastery Checks. Thin data-access over the SQLite tables in
//! migration v6 (see `db.rs`).
//!
//! Product locks enforced by shape:
//!   FOCUS TIME ≠ MASTERY — `focus_sessions` is ACTIVITY evidence (duration +
//!     method); `recall_score` is set only when a genuine recall check was done.
//!     Context links (course / academic topic / knowledge topic / action /
//!     block) are optional and SET NULL on delete — the session is its own
//!     record, never a copy.
//!   ACADEMIC ASSESSMENT ≠ MASTERY CHECK — `mastery_checks` is a PERSONAL
//!     learning check, never a grade. It carries a score but NO academic mastery
//!     column; the Academic Topic still has no mastery of its own.
//!   KNOWLEDGE EVIDENCE owns mastery — `mastery_checks.evidence_id` is the
//!     idempotency guard for the ONE evidence row a check may produce: set once
//!     by `mastery_link_evidence`, never overwritten.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_STUDY_IMPORT: &str = "study_relational_import";

// ---------------------------------------------------------------------------
// Row types (camelCase across the Tauri boundary)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionRow {
    pub id: String,
    pub title: String,
    pub status: String,
    pub method: String,
    pub course_id: Option<String>,
    pub academic_topic_id: Option<String>,
    pub knowledge_topic_id: Option<String>,
    pub action_id: Option<String>,
    pub planning_block_id: Option<String>,
    pub target_minutes: i64,
    pub duration_minutes: i64,
    pub recall_score: Option<f64>,
    pub recall_max: f64,
    pub notes: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MasteryCheckRow {
    pub id: String,
    pub academic_topic_id: Option<String>,
    pub knowledge_topic_id: Option<String>,
    pub course_id: Option<String>,
    pub topic_title: String,
    pub kind: String,
    /// JSON string of the raw check items.
    pub items: String,
    pub score: f64,
    pub max_score: f64,
    pub status: String,
    pub evidence_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyGraph {
    pub focus_sessions: Vec<FocusSessionRow>,
    pub mastery_checks: Vec<MasteryCheckRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyImport {
    pub focus_sessions: Vec<FocusSessionRow>,
    pub mastery_checks: Vec<MasteryCheckRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyImportReport {
    pub ran: bool,
    pub focus_sessions_imported: usize,
    pub mastery_checks_imported: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<StudyGraph> {
    let mut fs = conn.prepare(
        "SELECT id,title,status,method,course_id,academic_topic_id,knowledge_topic_id,action_id,
                planning_block_id,target_minutes,duration_minutes,recall_score,recall_max,notes,
                started_at,completed_at,created_at,updated_at
         FROM focus_sessions ORDER BY created_at DESC",
    )?;
    let focus_sessions = fs
        .query_map([], |r| {
            Ok(FocusSessionRow {
                id: r.get(0)?,
                title: r.get(1)?,
                status: r.get(2)?,
                method: r.get(3)?,
                course_id: r.get(4)?,
                academic_topic_id: r.get(5)?,
                knowledge_topic_id: r.get(6)?,
                action_id: r.get(7)?,
                planning_block_id: r.get(8)?,
                target_minutes: r.get(9)?,
                duration_minutes: r.get(10)?,
                recall_score: r.get(11)?,
                recall_max: r.get(12)?,
                notes: r.get(13)?,
                started_at: r.get(14)?,
                completed_at: r.get(15)?,
                created_at: r.get(16)?,
                updated_at: r.get(17)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ms = conn.prepare(
        "SELECT id,academic_topic_id,knowledge_topic_id,course_id,topic_title,kind,items,score,
                max_score,status,evidence_id,created_at,updated_at,completed_at
         FROM mastery_checks ORDER BY created_at DESC",
    )?;
    let mastery_checks = ms
        .query_map([], |r| {
            Ok(MasteryCheckRow {
                id: r.get(0)?,
                academic_topic_id: r.get(1)?,
                knowledge_topic_id: r.get(2)?,
                course_id: r.get(3)?,
                topic_title: r.get(4)?,
                kind: r.get(5)?,
                items: r.get(6)?,
                score: r.get(7)?,
                max_score: r.get(8)?,
                status: r.get(9)?,
                evidence_id: r.get(10)?,
                created_at: r.get(11)?,
                updated_at: r.get(12)?,
                completed_at: r.get(13)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(StudyGraph {
        focus_sessions,
        mastery_checks,
    })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/// Resolve a candidate id to `Some(id)` only if the row exists — a dangling
/// reference is stored NULL, not rejected by the FK.
fn resolve(conn: &Connection, table: &str, candidate: &Option<String>) -> Option<String> {
    match candidate {
        Some(id) if !id.is_empty() => conn
            .query_row(
                &format!("SELECT id FROM {table} WHERE id = ?1"),
                params![id],
                |row| row.get(0),
            )
            .ok(),
        _ => None,
    }
}

fn focus_session_upsert_inner(conn: &Connection, s: &FocusSessionRow) -> DbResult<()> {
    let course = resolve(conn, "academic_courses", &s.course_id);
    let atopic = resolve(conn, "academic_topics", &s.academic_topic_id);
    let ktopic = resolve(conn, "knowledge_topics", &s.knowledge_topic_id);
    let action = resolve(conn, "actions", &s.action_id);
    let block = resolve(conn, "planning_blocks", &s.planning_block_id);
    conn.execute(
        "INSERT INTO focus_sessions
            (id,title,status,method,course_id,academic_topic_id,knowledge_topic_id,action_id,
             planning_block_id,target_minutes,duration_minutes,recall_score,recall_max,notes,
             started_at,completed_at,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, status=excluded.status, method=excluded.method,
            course_id=excluded.course_id, academic_topic_id=excluded.academic_topic_id,
            knowledge_topic_id=excluded.knowledge_topic_id, action_id=excluded.action_id,
            planning_block_id=excluded.planning_block_id, target_minutes=excluded.target_minutes,
            duration_minutes=excluded.duration_minutes, recall_score=excluded.recall_score,
            recall_max=excluded.recall_max, notes=excluded.notes, started_at=excluded.started_at,
            completed_at=excluded.completed_at, updated_at=excluded.updated_at",
        params![
            s.id,
            s.title,
            s.status,
            s.method,
            course,
            atopic,
            ktopic,
            action,
            block,
            s.target_minutes,
            s.duration_minutes,
            s.recall_score,
            s.recall_max,
            s.notes,
            s.started_at,
            s.completed_at,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

fn mastery_check_upsert_inner(conn: &Connection, m: &MasteryCheckRow) -> DbResult<()> {
    let atopic = resolve(conn, "academic_topics", &m.academic_topic_id);
    let ktopic = resolve(conn, "knowledge_topics", &m.knowledge_topic_id);
    let course = resolve(conn, "academic_courses", &m.course_id);
    // NOTE: evidence_id is deliberately NOT set here — it is owned by
    // `mastery_link_evidence` so the "set once" idempotency guarantee holds.
    conn.execute(
        "INSERT INTO mastery_checks
            (id,academic_topic_id,knowledge_topic_id,course_id,topic_title,kind,items,score,
             max_score,status,evidence_id,created_at,updated_at,completed_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,NULL,?11,?12,?13)
         ON CONFLICT(id) DO UPDATE SET
            academic_topic_id=excluded.academic_topic_id,
            knowledge_topic_id=excluded.knowledge_topic_id, course_id=excluded.course_id,
            topic_title=excluded.topic_title, kind=excluded.kind, items=excluded.items,
            score=excluded.score, max_score=excluded.max_score, status=excluded.status,
            updated_at=excluded.updated_at, completed_at=excluded.completed_at",
        params![
            m.id,
            atopic,
            ktopic,
            course,
            m.topic_title,
            m.kind,
            m.items,
            m.score,
            m.max_score,
            m.status,
            m.created_at,
            m.updated_at,
            m.completed_at
        ],
    )?;
    Ok(())
}

/// Idempotent evidence handoff: sets `evidence_id` only if it is currently NULL.
/// Returns the effective evidence id (the existing one if already set).
fn mastery_link_evidence_inner(
    conn: &Connection,
    check_id: &str,
    evidence_id: &str,
) -> DbResult<Option<String>> {
    let current: Option<Option<String>> = conn
        .query_row(
            "SELECT evidence_id FROM mastery_checks WHERE id = ?1",
            params![check_id],
            |r| r.get(0),
        )
        .optional()?;
    match current {
        None => Ok(None),                           // no such check
        Some(Some(existing)) => Ok(Some(existing)), // already linked — do not overwrite
        Some(None) => {
            conn.execute(
                "UPDATE mastery_checks SET evidence_id = ?2, updated_at = datetime('now')
                 WHERE id = ?1 AND evidence_id IS NULL",
                params![check_id, evidence_id],
            )?;
            Ok(Some(evidence_id.to_string()))
        }
    }
}

fn import_inner(conn: &mut Connection, import: StudyImport) -> DbResult<StudyImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_STUDY_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(StudyImportReport {
            ran: false,
            focus_sessions_imported: 0,
            mastery_checks_imported: 0,
        });
    }
    let mut r = StudyImportReport {
        ran: true,
        focus_sessions_imported: 0,
        mastery_checks_imported: 0,
    };
    let tx = conn.transaction()?;
    for s in &import.focus_sessions {
        let n = tx.execute(
            "INSERT OR IGNORE INTO focus_sessions
                (id,title,status,method,course_id,academic_topic_id,knowledge_topic_id,action_id,
                 planning_block_id,target_minutes,duration_minutes,recall_score,recall_max,notes,
                 started_at,completed_at,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
            params![
                s.id,
                s.title,
                s.status,
                s.method,
                s.course_id,
                s.academic_topic_id,
                s.knowledge_topic_id,
                s.action_id,
                s.planning_block_id,
                s.target_minutes,
                s.duration_minutes,
                s.recall_score,
                s.recall_max,
                s.notes,
                s.started_at,
                s.completed_at,
                s.created_at,
                s.updated_at
            ],
        )?;
        r.focus_sessions_imported += n;
    }
    for m in &import.mastery_checks {
        let n = tx.execute(
            "INSERT OR IGNORE INTO mastery_checks
                (id,academic_topic_id,knowledge_topic_id,course_id,topic_title,kind,items,score,
                 max_score,status,evidence_id,created_at,updated_at,completed_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                m.id,
                m.academic_topic_id,
                m.knowledge_topic_id,
                m.course_id,
                m.topic_title,
                m.kind,
                m.items,
                m.score,
                m.max_score,
                m.status,
                m.evidence_id,
                m.created_at,
                m.updated_at,
                m.completed_at
            ],
        )?;
        r.mastery_checks_imported += n;
    }
    let marker = serde_json::json!({
        "version": 1,
        "focusSessionsImported": r.focus_sessions_imported,
        "masteryChecksImported": r.mastery_checks_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_STUDY_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn study_load(db: State<'_, Db>) -> DbResult<StudyGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn study_focus_session_upsert(db: State<'_, Db>, session: FocusSessionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    focus_session_upsert_inner(&conn, &session)
}

#[tauri::command]
pub fn study_focus_session_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM focus_sessions WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn study_mastery_check_upsert(db: State<'_, Db>, check: MasteryCheckRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    mastery_check_upsert_inner(&conn, &check)
}

#[tauri::command]
pub fn study_mastery_check_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM mastery_checks WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn study_mastery_link_evidence(
    db: State<'_, Db>,
    check_id: String,
    evidence_id: String,
) -> DbResult<Option<String>> {
    let conn = db.0.lock().unwrap();
    mastery_link_evidence_inner(&conn, &check_id, &evidence_id)
}

#[tauri::command]
pub fn study_import_graph(db: State<'_, Db>, import: StudyImport) -> DbResult<StudyImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes Batch 4 study state + its import marker.
#[tauri::command]
pub fn study_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "study_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM mastery_checks;
         DELETE FROM focus_sessions;
         DELETE FROM kv_store WHERE key IN ('pbos:focus-sessions','pbos:mastery-checks');
         INSERT INTO meta (key,value) VALUES ('study_relational_import','{\"version\":1,\"reset\":true}')
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

    fn ktopic(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO knowledge_topics (id,title,category,context,created_at,updated_at)
             VALUES (?1,'Binary Trees','academic','DS','2026-01-01','2026-01-01')",
            params![id],
        )
        .unwrap();
    }
    fn evidence(conn: &Connection, id: &str, topic: &str) {
        conn.execute(
            "INSERT INTO knowledge_evidence (id,topic_id,type,title,score,max_score,date,created_at,updated_at)
             VALUES (?1,?2,'recall','Mastery Check',8,10,'2026-02-01','2026-02-01','2026-02-01')",
            params![id, topic],
        )
        .unwrap();
    }

    fn session(id: &str, ktopic: Option<&str>, recall: Option<f64>) -> FocusSessionRow {
        FocusSessionRow {
            id: id.into(),
            title: "Study: Binary Trees".into(),
            status: "completed".into(),
            method: "problem-set".into(),
            course_id: None,
            academic_topic_id: None,
            knowledge_topic_id: ktopic.map(String::from),
            action_id: None,
            planning_block_id: None,
            target_minutes: 25,
            duration_minutes: 24,
            recall_score: recall,
            recall_max: 10.0,
            notes: String::new(),
            started_at: Some("2026-02-01T08:00:00Z".into()),
            completed_at: Some("2026-02-01T08:24:00Z".into()),
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
        }
    }
    fn check(id: &str, ktopic: Option<&str>) -> MasteryCheckRow {
        MasteryCheckRow {
            id: id.into(),
            academic_topic_id: None,
            knowledge_topic_id: ktopic.map(String::from),
            course_id: None,
            topic_title: "Binary Trees".into(),
            kind: "self-check".into(),
            items: "[]".into(),
            score: 7.0,
            max_score: 10.0,
            status: "completed".into(),
            evidence_id: None,
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
            completed_at: Some("2026-02-01".into()),
        }
    }

    #[test]
    fn focus_session_persists_with_optional_context_and_no_mastery_column() {
        let c = mem();
        ktopic(&c, "kt1");
        focus_session_upsert_inner(&c, &session("s1", Some("kt1"), None)).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.focus_sessions.len(), 1);
        assert_eq!(
            g.focus_sessions[0].knowledge_topic_id.as_deref(),
            Some("kt1")
        );
        // time alone: recall_score stays NULL
        assert!(g.focus_sessions[0].recall_score.is_none());

        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('focus_sessions')")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for banned in ["mastery", "mastery_percent", "confidence_score"] {
            assert!(
                !cols.iter().any(|c| c == banned),
                "focus_sessions must not have `{banned}`"
            );
        }
    }

    #[test]
    fn deleting_a_knowledge_topic_nulls_the_session_link_but_keeps_the_session() {
        let c = mem();
        ktopic(&c, "kt1");
        focus_session_upsert_inner(&c, &session("s1", Some("kt1"), Some(9.0))).unwrap();
        c.execute("DELETE FROM knowledge_topics WHERE id = 'kt1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(
            g.focus_sessions.len(),
            1,
            "session survives its linked topic"
        );
        assert!(g.focus_sessions[0].knowledge_topic_id.is_none());
    }

    #[test]
    fn mastery_check_has_no_academic_mastery_column() {
        let c = mem();
        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('mastery_checks')")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for banned in ["mastery_percent", "academic_mastery", "grade"] {
            assert!(
                !cols.iter().any(|c| c == banned),
                "mastery_checks must not have `{banned}`"
            );
        }
        assert!(cols.contains(&"score".to_string()));
        assert!(cols.contains(&"evidence_id".to_string()));
    }

    #[test]
    fn evidence_handoff_is_idempotent_set_once_never_overwritten() {
        let c = mem();
        ktopic(&c, "kt1");
        mastery_check_upsert_inner(&c, &check("m1", Some("kt1"))).unwrap();
        evidence(&c, "e1", "kt1");
        evidence(&c, "e2", "kt1");

        let first = mastery_link_evidence_inner(&c, "m1", "e1").unwrap();
        assert_eq!(first.as_deref(), Some("e1"));
        // a second attempt with a DIFFERENT evidence id must NOT overwrite
        let second = mastery_link_evidence_inner(&c, "m1", "e2").unwrap();
        assert_eq!(
            second.as_deref(),
            Some("e1"),
            "evidence_id is set once, never overwritten"
        );
        let g = load_inner(&c).unwrap();
        assert_eq!(g.mastery_checks[0].evidence_id.as_deref(), Some("e1"));

        // linking an unknown check returns None
        assert!(mastery_link_evidence_inner(&c, "ghost", "e1")
            .unwrap()
            .is_none());
    }

    #[test]
    fn deleting_the_linked_evidence_nulls_the_check_link_but_keeps_the_check() {
        let c = mem();
        ktopic(&c, "kt1");
        mastery_check_upsert_inner(&c, &check("m1", Some("kt1"))).unwrap();
        evidence(&c, "e1", "kt1");
        mastery_link_evidence_inner(&c, "m1", "e1").unwrap();
        c.execute("DELETE FROM knowledge_evidence WHERE id = 'e1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.mastery_checks.len(), 1);
        assert!(g.mastery_checks[0].evidence_id.is_none());
    }

    #[test]
    fn upsert_does_not_touch_evidence_id() {
        let c = mem();
        ktopic(&c, "kt1");
        mastery_check_upsert_inner(&c, &check("m1", Some("kt1"))).unwrap();
        evidence(&c, "e1", "kt1");
        mastery_link_evidence_inner(&c, "m1", "e1").unwrap();
        // re-upsert the whole row (e.g. status change) — evidence_id survives
        let mut edited = check("m1", Some("kt1"));
        edited.status = "completed".into();
        edited.evidence_id = None; // caller doesn't own this field
        mastery_check_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.mastery_checks[0].evidence_id.as_deref(), Some("e1"));
    }

    #[test]
    fn import_is_idempotent() {
        let c = mem();
        let mut db = Db(std::sync::Mutex::new(c));
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(
                conn,
                StudyImport {
                    focus_sessions: vec![session("s1", None, None)],
                    mastery_checks: vec![check("m1", None)],
                },
            )
            .unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.focus_sessions_imported, 1);
        assert_eq!(r1.mastery_checks_imported, 1);
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(
                conn,
                StudyImport {
                    focus_sessions: vec![session("s2", None, None)],
                    mastery_checks: vec![],
                },
            )
            .unwrap()
        };
        assert!(!r2.ran);
        let conn = db.0.lock().unwrap();
        assert_eq!(load_inner(&conn).unwrap().focus_sessions.len(), 1);
    }
}
