//! Batch 2A — canonical relational persistence for the Academic domain
//! (Semester -> Course -> {Topic, Assessment, Attempt}). Thin data-access over
//! the SQLite tables created in migration v3 (see `db.rs`).
//!
//! Relationship truth (one source each, no reverse-collection columns):
//!   semester -> course     : `academic_courses.semester_id` (FK; NULL = unassigned)
//!   course   -> topic      : `academic_topics.course_id` (FK; CASCADE)
//!   course   -> assessment : `academic_assessments.course_id` (FK; CASCADE)
//!   course   -> attempt    : `academic_attempts.course_id` (FK; CASCADE)
//!   academic topic <-> knowledge concept : `academic_topics.knowledge_topic_id`
//!       (FK -> knowledge_topics.id; ON DELETE SET NULL). This is the ONE
//!       cross-domain link. Mastery for a linked academic topic is READ from the
//!       knowledge concept's evidence-derived state in the TS engine — it is
//!       NEVER stored a second time in `academic_topics`.
//!
//! What is NOT encoded here (docs/13.09, 13.10 mark both RESEARCH REQUIRED):
//! no score -> letter-grade thresholds, and no repeat/replacement policy for
//! CGPA inclusion. `target_grade` / `projected_grade` / `final_grade` hold a
//! user-entered letter or NULL. `mastery_self_assessed` is legacy-only:
//! migrated from the pre-2A seed model, never written by the app, never
//! aggregated into a deterministic result, and superseded by the linked
//! knowledge concept when one is present.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_ACAD_IMPORT: &str = "academic_relational_import";

// ---------------------------------------------------------------------------
// Row types crossing the Tauri boundary (camelCase to match the TS repo)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicSemesterRow {
    pub id: String,
    pub label: String,
    pub position: i64,
    pub is_current: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicCourseRow {
    pub id: String,
    pub semester_id: Option<String>,
    pub code: String,
    pub title: String,
    pub credit_hours: f64,
    pub professor_name: String,
    pub status: String,
    pub target_grade: Option<String>,
    pub projected_grade: Option<String>,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicTopicRow {
    pub id: String,
    pub course_id: String,
    pub title: String,
    pub position: i64,
    pub professor_coverage: String,
    pub personal_study_percent: f64,
    /// Legacy self-assessment ONLY — see module header. Never edited in-app.
    pub mastery_self_assessed: Option<f64>,
    /// The ONE cross-domain link. NULL = not linked to a knowledge concept.
    pub knowledge_topic_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicAssessmentRow {
    pub id: String,
    pub course_id: String,
    pub category: String,
    pub title: String,
    pub obtained_marks: Option<f64>,
    pub total_marks: f64,
    pub weight_percent: f64,
    pub date: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicAttemptRow {
    pub id: String,
    pub course_id: String,
    pub attempt_number: i64,
    pub term: String,
    pub final_grade: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicGraph {
    pub semesters: Vec<AcademicSemesterRow>,
    pub courses: Vec<AcademicCourseRow>,
    pub topics: Vec<AcademicTopicRow>,
    pub assessments: Vec<AcademicAssessmentRow>,
    pub attempts: Vec<AcademicAttemptRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicImport {
    pub semesters: Vec<AcademicSemesterRow>,
    pub courses: Vec<AcademicCourseRow>,
    pub topics: Vec<AcademicTopicRow>,
    pub assessments: Vec<AcademicAssessmentRow>,
    pub attempts: Vec<AcademicAttemptRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcademicImportReport {
    /// True only when this call actually wrote rows (false = marker already set).
    pub ran: bool,
    pub semesters_imported: usize,
    pub courses_imported: usize,
    pub topics_imported: usize,
    pub assessments_imported: usize,
    pub attempts_imported: usize,
    pub semesters_skipped_existing: usize,
    pub courses_skipped_existing: usize,
    pub topics_skipped_existing: usize,
    pub assessments_skipped_existing: usize,
    pub attempts_skipped_existing: usize,
    /// Academic topics whose legacy `knowledgeTopicId` pointed at a concept that
    /// does not exist — imported with the link cleared rather than failing.
    pub topic_links_dropped: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<AcademicGraph> {
    let mut sem = conn.prepare(
        "SELECT id,label,position,is_current,created_at,updated_at
         FROM academic_semesters ORDER BY position, created_at",
    )?;
    let semesters = sem
        .query_map([], |r| {
            Ok(AcademicSemesterRow {
                id: r.get(0)?,
                label: r.get(1)?,
                position: r.get(2)?,
                is_current: r.get::<_, i64>(3)? != 0,
                created_at: r.get(4)?,
                updated_at: r.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut crs = conn.prepare(
        "SELECT id,semester_id,code,title,credit_hours,professor_name,status,
                target_grade,projected_grade,archived,created_at,updated_at
         FROM academic_courses ORDER BY created_at",
    )?;
    let courses = crs
        .query_map([], |r| {
            Ok(AcademicCourseRow {
                id: r.get(0)?,
                semester_id: r.get(1)?,
                code: r.get(2)?,
                title: r.get(3)?,
                credit_hours: r.get(4)?,
                professor_name: r.get(5)?,
                status: r.get(6)?,
                target_grade: r.get(7)?,
                projected_grade: r.get(8)?,
                archived: r.get::<_, i64>(9)? != 0,
                created_at: r.get(10)?,
                updated_at: r.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut top = conn.prepare(
        "SELECT id,course_id,title,position,professor_coverage,personal_study_percent,
                mastery_self_assessed,knowledge_topic_id,created_at,updated_at
         FROM academic_topics ORDER BY course_id, position, created_at",
    )?;
    let topics = top
        .query_map([], |r| {
            Ok(AcademicTopicRow {
                id: r.get(0)?,
                course_id: r.get(1)?,
                title: r.get(2)?,
                position: r.get(3)?,
                professor_coverage: r.get(4)?,
                personal_study_percent: r.get(5)?,
                mastery_self_assessed: r.get(6)?,
                knowledge_topic_id: r.get(7)?,
                created_at: r.get(8)?,
                updated_at: r.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut asm = conn.prepare(
        "SELECT id,course_id,category,title,obtained_marks,total_marks,weight_percent,date,created_at,updated_at
         FROM academic_assessments ORDER BY course_id, date, created_at",
    )?;
    let assessments = asm
        .query_map([], |r| {
            Ok(AcademicAssessmentRow {
                id: r.get(0)?,
                course_id: r.get(1)?,
                category: r.get(2)?,
                title: r.get(3)?,
                obtained_marks: r.get(4)?,
                total_marks: r.get(5)?,
                weight_percent: r.get(6)?,
                date: r.get(7)?,
                created_at: r.get(8)?,
                updated_at: r.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut att = conn.prepare(
        "SELECT id,course_id,attempt_number,term,final_grade,created_at,updated_at
         FROM academic_attempts ORDER BY course_id, attempt_number, created_at",
    )?;
    let attempts = att
        .query_map([], |r| {
            Ok(AcademicAttemptRow {
                id: r.get(0)?,
                course_id: r.get(1)?,
                attempt_number: r.get(2)?,
                term: r.get(3)?,
                final_grade: r.get(4)?,
                created_at: r.get(5)?,
                updated_at: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(AcademicGraph {
        semesters,
        courses,
        topics,
        assessments,
        attempts,
    })
}

// ---------------------------------------------------------------------------
// Writes (upsert = create-or-replace by id, preserving created_at on update)
// ---------------------------------------------------------------------------

fn semester_upsert_inner(conn: &Connection, s: &AcademicSemesterRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO academic_semesters (id,label,position,is_current,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET
            label=excluded.label, position=excluded.position,
            is_current=excluded.is_current, updated_at=excluded.updated_at",
        params![
            s.id,
            s.label,
            s.position,
            s.is_current as i64,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

fn course_upsert_inner(conn: &Connection, c: &AcademicCourseRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO academic_courses
            (id,semester_id,code,title,credit_hours,professor_name,status,
             target_grade,projected_grade,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(id) DO UPDATE SET
            semester_id=excluded.semester_id, code=excluded.code, title=excluded.title,
            credit_hours=excluded.credit_hours, professor_name=excluded.professor_name,
            status=excluded.status, target_grade=excluded.target_grade,
            projected_grade=excluded.projected_grade, archived=excluded.archived,
            updated_at=excluded.updated_at",
        params![
            c.id,
            c.semester_id,
            c.code,
            c.title,
            c.credit_hours,
            c.professor_name,
            c.status,
            c.target_grade,
            c.projected_grade,
            c.archived as i64,
            c.created_at,
            c.updated_at
        ],
    )?;
    Ok(())
}

fn topic_upsert_inner(conn: &Connection, t: &AcademicTopicRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO academic_topics
            (id,course_id,title,position,professor_coverage,personal_study_percent,
             mastery_self_assessed,knowledge_topic_id,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            course_id=excluded.course_id, title=excluded.title, position=excluded.position,
            professor_coverage=excluded.professor_coverage,
            personal_study_percent=excluded.personal_study_percent,
            mastery_self_assessed=excluded.mastery_self_assessed,
            knowledge_topic_id=excluded.knowledge_topic_id,
            updated_at=excluded.updated_at",
        params![
            t.id,
            t.course_id,
            t.title,
            t.position,
            t.professor_coverage,
            t.personal_study_percent,
            t.mastery_self_assessed,
            t.knowledge_topic_id,
            t.created_at,
            t.updated_at
        ],
    )?;
    Ok(())
}

fn assessment_upsert_inner(conn: &Connection, a: &AcademicAssessmentRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO academic_assessments
            (id,course_id,category,title,obtained_marks,total_marks,weight_percent,date,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            course_id=excluded.course_id, category=excluded.category, title=excluded.title,
            obtained_marks=excluded.obtained_marks, total_marks=excluded.total_marks,
            weight_percent=excluded.weight_percent, date=excluded.date,
            updated_at=excluded.updated_at",
        params![
            a.id,
            a.course_id,
            a.category,
            a.title,
            a.obtained_marks,
            a.total_marks,
            a.weight_percent,
            a.date,
            a.created_at,
            a.updated_at
        ],
    )?;
    Ok(())
}

fn attempt_upsert_inner(conn: &Connection, a: &AcademicAttemptRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO academic_attempts
            (id,course_id,attempt_number,term,final_grade,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(id) DO UPDATE SET
            course_id=excluded.course_id, attempt_number=excluded.attempt_number,
            term=excluded.term, final_grade=excluded.final_grade,
            updated_at=excluded.updated_at",
        params![
            a.id,
            a.course_id,
            a.attempt_number,
            a.term,
            a.final_grade,
            a.created_at,
            a.updated_at
        ],
    )?;
    Ok(())
}

/// Set or clear the ONE cross-domain link on an academic topic. Passing
/// `knowledge_topic_id = None` unlinks. A non-existent knowledge concept is
/// rejected by the FK (surfaced as a `DbError`) rather than silently stored.
fn topic_link_knowledge_inner(
    conn: &Connection,
    topic_id: &str,
    knowledge_topic_id: Option<&str>,
) -> DbResult<()> {
    let changed = conn.execute(
        "UPDATE academic_topics
         SET knowledge_topic_id = ?2, updated_at = datetime('now')
         WHERE id = ?1",
        params![topic_id, knowledge_topic_id],
    )?;
    if changed == 0 {
        return Err(DbError::Forbidden(format!(
            "academic topic {topic_id} does not exist"
        )));
    }
    Ok(())
}

fn import_inner(conn: &mut Connection, import: AcademicImport) -> DbResult<AcademicImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_ACAD_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(AcademicImportReport {
            ran: false,
            semesters_imported: 0,
            courses_imported: 0,
            topics_imported: 0,
            assessments_imported: 0,
            attempts_imported: 0,
            semesters_skipped_existing: 0,
            courses_skipped_existing: 0,
            topics_skipped_existing: 0,
            assessments_skipped_existing: 0,
            attempts_skipped_existing: 0,
            topic_links_dropped: 0,
        });
    }

    let mut r = AcademicImportReport {
        ran: true,
        semesters_imported: 0,
        courses_imported: 0,
        topics_imported: 0,
        assessments_imported: 0,
        attempts_imported: 0,
        semesters_skipped_existing: 0,
        courses_skipped_existing: 0,
        topics_skipped_existing: 0,
        assessments_skipped_existing: 0,
        attempts_skipped_existing: 0,
        topic_links_dropped: 0,
    };

    let tx = conn.transaction()?;

    for s in &import.semesters {
        let n = tx.execute(
            "INSERT OR IGNORE INTO academic_semesters
                (id,label,position,is_current,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                s.id,
                s.label,
                s.position,
                s.is_current as i64,
                s.created_at,
                s.updated_at
            ],
        )?;
        if n == 1 {
            r.semesters_imported += 1
        } else {
            r.semesters_skipped_existing += 1
        }
    }

    for c in &import.courses {
        // Only keep a semester_id that resolves; otherwise the course is unassigned.
        let sem_ok: Option<String> = match &c.semester_id {
            Some(sid) => tx
                .query_row(
                    "SELECT id FROM academic_semesters WHERE id = ?1",
                    params![sid],
                    |row| row.get(0),
                )
                .ok(),
            None => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO academic_courses
                (id,semester_id,code,title,credit_hours,professor_name,status,
                 target_grade,projected_grade,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                c.id,
                sem_ok,
                c.code,
                c.title,
                c.credit_hours,
                c.professor_name,
                c.status,
                c.target_grade,
                c.projected_grade,
                c.archived as i64,
                c.created_at,
                c.updated_at
            ],
        )?;
        if n == 1 {
            r.courses_imported += 1
        } else {
            r.courses_skipped_existing += 1
        }
    }

    for t in &import.topics {
        // A topic whose parent course is missing is dropped (the TS resolver reports it).
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM academic_courses WHERE id = ?1",
                params![t.course_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        // Keep the knowledge link only if the concept actually exists.
        let link: Option<String> = match &t.knowledge_topic_id {
            Some(kid) => {
                let ok: bool = tx
                    .query_row(
                        "SELECT 1 FROM knowledge_topics WHERE id = ?1",
                        params![kid],
                        |_| Ok(()),
                    )
                    .is_ok();
                if ok {
                    Some(kid.clone())
                } else {
                    r.topic_links_dropped += 1;
                    None
                }
            }
            None => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO academic_topics
                (id,course_id,title,position,professor_coverage,personal_study_percent,
                 mastery_self_assessed,knowledge_topic_id,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                t.id,
                t.course_id,
                t.title,
                t.position,
                t.professor_coverage,
                t.personal_study_percent,
                t.mastery_self_assessed,
                link,
                t.created_at,
                t.updated_at
            ],
        )?;
        if n == 1 {
            r.topics_imported += 1
        } else {
            r.topics_skipped_existing += 1
        }
    }

    for a in &import.assessments {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM academic_courses WHERE id = ?1",
                params![a.course_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO academic_assessments
                (id,course_id,category,title,obtained_marks,total_marks,weight_percent,date,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                a.id, a.course_id, a.category, a.title, a.obtained_marks, a.total_marks,
                a.weight_percent, a.date, a.created_at, a.updated_at
            ],
        )?;
        if n == 1 {
            r.assessments_imported += 1
        } else {
            r.assessments_skipped_existing += 1
        }
    }

    for a in &import.attempts {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM academic_courses WHERE id = ?1",
                params![a.course_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO academic_attempts
                (id,course_id,attempt_number,term,final_grade,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                a.id,
                a.course_id,
                a.attempt_number,
                a.term,
                a.final_grade,
                a.created_at,
                a.updated_at
            ],
        )?;
        if n == 1 {
            r.attempts_imported += 1
        } else {
            r.attempts_skipped_existing += 1
        }
    }

    let marker = serde_json::json!({
        "version": 1,
        "semestersImported": r.semesters_imported,
        "coursesImported": r.courses_imported,
        "topicsImported": r.topics_imported,
        "assessmentsImported": r.assessments_imported,
        "attemptsImported": r.attempts_imported,
        "topicLinksDropped": r.topic_links_dropped,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_ACAD_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn acad_load(db: State<'_, Db>) -> DbResult<AcademicGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn acad_semester_upsert(db: State<'_, Db>, semester: AcademicSemesterRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    semester_upsert_inner(&conn, &semester)
}

#[tauri::command]
pub fn acad_semester_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: academic_courses.semester_id SET NULL (course becomes unassigned).
    conn.execute("DELETE FROM academic_semesters WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn acad_course_upsert(db: State<'_, Db>, course: AcademicCourseRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    course_upsert_inner(&conn, &course)
}

#[tauri::command]
pub fn acad_course_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: topics, assessments, attempts all CASCADE.
    conn.execute("DELETE FROM academic_courses WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn acad_topic_upsert(db: State<'_, Db>, topic: AcademicTopicRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    topic_upsert_inner(&conn, &topic)
}

#[tauri::command]
pub fn acad_topic_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM academic_topics WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn acad_assessment_upsert(
    db: State<'_, Db>,
    assessment: AcademicAssessmentRow,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    assessment_upsert_inner(&conn, &assessment)
}

#[tauri::command]
pub fn acad_assessment_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM academic_assessments WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn acad_attempt_upsert(db: State<'_, Db>, attempt: AcademicAttemptRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    attempt_upsert_inner(&conn, &attempt)
}

#[tauri::command]
pub fn acad_attempt_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM academic_attempts WHERE id = ?1", params![id])?;
    Ok(())
}

/// Link (or, with `knowledgeTopicId = null`, unlink) an academic topic to the
/// canonical knowledge concept. No mastery is copied — see module header.
#[tauri::command]
pub fn acad_topic_link_knowledge(
    db: State<'_, Db>,
    topic_id: String,
    knowledge_topic_id: Option<String>,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    topic_link_knowledge_inner(&conn, &topic_id, knowledge_topic_id.as_deref())
}

/// Idempotent, non-destructive import of an already-resolved Academic graph
/// (the TS side owns legacy-JSON parsing + relationship repair — see
/// `academic/legacyImport.ts`). `INSERT OR IGNORE` per row: never overwrites a
/// canonical record that already exists.
#[tauri::command]
pub fn acad_import_graph(
    db: State<'_, Db>,
    import: AcademicImport,
) -> DbResult<AcademicImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Academic graph + its import marker so native E2E can
/// run the real-user scenario from a clean state. Refuses in a release build.
#[tauri::command]
pub fn acad_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "acad_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM academic_attempts;
         DELETE FROM academic_assessments;
         DELETE FROM academic_topics;
         DELETE FROM academic_courses;
         DELETE FROM academic_semesters;
         DELETE FROM kv_store WHERE key IN
           ('pbos:academic-courses','pbos:academic-topics','pbos:academic-assessments','pbos:academic-attempts');
         INSERT INTO meta (key,value) VALUES ('academic_relational_import','{\"version\":1,\"reset\":true}')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
    )?;
    Ok(())
}

// ===========================================================================
// V2 — Assessment ↔ Academic Topic SCOPE (migration v11, blueprint 07 §6.1 / §9.1)
//
//   `academic_assessment_topics` is the ONLY source of "this topic is on this
//   assessment". Scope is EXPLICIT and never inferred — a topic is not assumed
//   in scope just because it belongs to the same course. SQLite cannot express a
//   cross-table CHECK, so `scope_add_inner` enforces the reverse guard:
//   `topic.course_id == assessment.course_id`. Unknown scope stays unknown
//   (no row), which the study engine reads as "not known to be in scope",
//   NEVER as "not in scope".
// ===========================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentTopicRow {
    pub assessment_id: String,
    pub topic_id: String,
    #[serde(default = "default_scope_source")]
    pub source: String,
    pub created_at: String,
}

fn default_scope_source() -> String {
    "user".into()
}

fn scope_for_assessment_inner(
    conn: &Connection,
    assessment_id: &str,
) -> DbResult<Vec<AssessmentTopicRow>> {
    let mut s = conn.prepare(
        "SELECT assessment_id,topic_id,source,created_at
         FROM academic_assessment_topics WHERE assessment_id = ?1 ORDER BY created_at, topic_id",
    )?;
    let rows = s
        .query_map(params![assessment_id], |r| {
            Ok(AssessmentTopicRow {
                assessment_id: r.get(0)?,
                topic_id: r.get(1)?,
                source: r.get(2)?,
                created_at: r.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn scope_load_all_inner(conn: &Connection) -> DbResult<Vec<AssessmentTopicRow>> {
    let mut s = conn.prepare(
        "SELECT assessment_id,topic_id,source,created_at
         FROM academic_assessment_topics ORDER BY assessment_id, created_at, topic_id",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(AssessmentTopicRow {
                assessment_id: r.get(0)?,
                topic_id: r.get(1)?,
                source: r.get(2)?,
                created_at: r.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// The same-course guard. Rejects a topic that belongs to a different course
/// from the assessment (or a missing assessment/topic).
fn scope_add_inner(conn: &Connection, link: &AssessmentTopicRow) -> DbResult<()> {
    let assessment_course: Option<String> = conn
        .query_row(
            "SELECT course_id FROM academic_assessments WHERE id = ?1",
            params![link.assessment_id],
            |r| r.get(0),
        )
        .optional()?;
    let topic_course: Option<String> = conn
        .query_row(
            "SELECT course_id FROM academic_topics WHERE id = ?1",
            params![link.topic_id],
            |r| r.get(0),
        )
        .optional()?;

    match (assessment_course, topic_course) {
        (Some(ac), Some(tc)) if ac == tc => {}
        (Some(_), Some(_)) => {
            return Err(DbError::Forbidden(
                "assessment scope can only include topics from the same course".into(),
            ))
        }
        _ => {
            return Err(DbError::Forbidden(
                "assessment scope needs an existing assessment and topic".into(),
            ))
        }
    }

    conn.execute(
        "INSERT INTO academic_assessment_topics (assessment_id,topic_id,source,created_at)
         VALUES (?1,?2,?3,?4)
         ON CONFLICT(assessment_id,topic_id) DO UPDATE SET source=excluded.source",
        params![link.assessment_id, link.topic_id, link.source, link.created_at],
    )?;
    Ok(())
}

fn scope_remove_inner(conn: &Connection, assessment_id: &str, topic_id: &str) -> DbResult<()> {
    conn.execute(
        "DELETE FROM academic_assessment_topics WHERE assessment_id = ?1 AND topic_id = ?2",
        params![assessment_id, topic_id],
    )?;
    Ok(())
}

/// Replace the full scope for one assessment in a single transaction — the
/// operation the Assessment scope editor performs on save.
fn scope_set_inner(
    conn: &mut Connection,
    assessment_id: &str,
    topic_ids: &[String],
    source: &str,
    now: &str,
) -> DbResult<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM academic_assessment_topics WHERE assessment_id = ?1",
        params![assessment_id],
    )?;
    for topic_id in topic_ids {
        scope_add_inner(
            &tx,
            &AssessmentTopicRow {
                assessment_id: assessment_id.to_string(),
                topic_id: topic_id.clone(),
                source: source.to_string(),
                created_at: now.to_string(),
            },
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn acad_assessment_scope_load(db: State<'_, Db>) -> DbResult<Vec<AssessmentTopicRow>> {
    let conn = db.0.lock().unwrap();
    scope_load_all_inner(&conn)
}

#[tauri::command]
pub fn acad_assessment_scope_for(
    db: State<'_, Db>,
    assessment_id: String,
) -> DbResult<Vec<AssessmentTopicRow>> {
    let conn = db.0.lock().unwrap();
    scope_for_assessment_inner(&conn, &assessment_id)
}

#[tauri::command]
pub fn acad_assessment_scope_add(db: State<'_, Db>, link: AssessmentTopicRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    scope_add_inner(&conn, &link)
}

#[tauri::command]
pub fn acad_assessment_scope_remove(
    db: State<'_, Db>,
    assessment_id: String,
    topic_id: String,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    scope_remove_inner(&conn, &assessment_id, &topic_id)
}

#[tauri::command]
pub fn acad_assessment_scope_set(
    db: State<'_, Db>,
    assessment_id: String,
    topic_ids: Vec<String>,
    source: String,
    now: String,
) -> DbResult<()> {
    let mut conn = db.0.lock().unwrap();
    scope_set_inner(&mut conn, &assessment_id, &topic_ids, &source, &now)
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

    fn semester(id: &str) -> AcademicSemesterRow {
        AcademicSemesterRow {
            id: id.into(),
            label: format!("Semester {id}"),
            position: 0,
            is_current: true,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn course(id: &str, sem: Option<&str>) -> AcademicCourseRow {
        AcademicCourseRow {
            id: id.into(),
            semester_id: sem.map(String::from),
            code: "CSE 201".into(),
            title: "Data Structures".into(),
            credit_hours: 4.0,
            professor_name: "Prof. Sharma".into(),
            status: "on-track".into(),
            target_grade: Some("A".into()),
            projected_grade: None,
            archived: false,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn topic(id: &str, course_id: &str, know: Option<&str>) -> AcademicTopicRow {
        AcademicTopicRow {
            id: id.into(),
            course_id: course_id.into(),
            title: "Binary Trees".into(),
            position: 0,
            professor_coverage: "taught".into(),
            personal_study_percent: 40.0,
            mastery_self_assessed: None,
            knowledge_topic_id: know.map(String::from),
            created_at: "2026-01-02".into(),
            updated_at: "2026-01-02".into(),
        }
    }
    fn assessment(id: &str, course_id: &str, obtained: Option<f64>) -> AcademicAssessmentRow {
        AcademicAssessmentRow {
            id: id.into(),
            course_id: course_id.into(),
            category: "quiz".into(),
            title: format!("Quiz {id}"),
            obtained_marks: obtained,
            total_marks: 20.0,
            weight_percent: 10.0,
            date: "2026-02-01".into(),
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
        }
    }
    fn attempt(id: &str, course_id: &str, grade: Option<&str>) -> AcademicAttemptRow {
        AcademicAttemptRow {
            id: id.into(),
            course_id: course_id.into(),
            attempt_number: 1,
            term: "Fall 2026".into(),
            final_grade: grade.map(String::from),
            created_at: "2026-06-01".into(),
            updated_at: "2026-06-01".into(),
        }
    }
    fn know_topic(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO knowledge_topics (id,title,category,context,created_at,updated_at)
             VALUES (?1,'Binary Trees','academic','Data Structures','2026-01-01','2026-01-01')",
            params![id],
        )
        .unwrap();
    }

    #[test]
    fn crud_and_cascade_delete() {
        let c = mem();
        semester_upsert_inner(&c, &semester("sem1")).unwrap();
        course_upsert_inner(&c, &course("dsa", Some("sem1"))).unwrap();
        topic_upsert_inner(&c, &topic("t1", "dsa", None)).unwrap();
        assessment_upsert_inner(&c, &assessment("a1", "dsa", Some(18.0))).unwrap();
        attempt_upsert_inner(&c, &attempt("at1", "dsa", None)).unwrap();

        let g = load_inner(&c).unwrap();
        assert_eq!(g.semesters.len(), 1);
        assert_eq!(g.courses.len(), 1);
        assert_eq!(g.topics.len(), 1);
        assert_eq!(g.assessments.len(), 1);
        assert_eq!(g.attempts.len(), 1);

        // Deleting the course cascades topics + assessments + attempts.
        c.execute("DELETE FROM academic_courses WHERE id = 'dsa'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.courses.len(), 0);
        assert_eq!(g.topics.len(), 0, "topics cascade with the course");
        assert_eq!(
            g.assessments.len(),
            0,
            "assessments cascade with the course"
        );
        assert_eq!(g.attempts.len(), 0, "attempts cascade with the course");
    }

    // -- V2 assessment scope (migration v11) ---------------------------

    fn scope_link(assessment_id: &str, topic_id: &str) -> AssessmentTopicRow {
        AssessmentTopicRow {
            assessment_id: assessment_id.into(),
            topic_id: topic_id.into(),
            source: "user".into(),
            created_at: "2026-02-01T00:00:00.000Z".into(),
        }
    }

    fn scope_fixture(c: &Connection) {
        course_upsert_inner(c, &course("dsa", None)).unwrap();
        course_upsert_inner(c, &course("os", None)).unwrap();
        topic_upsert_inner(c, &topic("t1", "dsa", None)).unwrap();
        topic_upsert_inner(c, &topic("t2", "dsa", None)).unwrap();
        topic_upsert_inner(c, &topic("t3", "os", None)).unwrap();
        assessment_upsert_inner(c, &assessment("mid", "dsa", None)).unwrap();
    }

    #[test]
    fn scope_accepts_same_course_topics_and_is_explicit_only() {
        let c = mem();
        scope_fixture(&c);
        // Unknown scope = no rows, never "all course topics".
        assert_eq!(scope_for_assessment_inner(&c, "mid").unwrap().len(), 0);

        scope_add_inner(&c, &scope_link("mid", "t1")).unwrap();
        let rows = scope_for_assessment_inner(&c, "mid").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].topic_id, "t1");
        // t2 is in the course but is NOT in scope until explicitly added.
        assert!(rows.iter().all(|r| r.topic_id != "t2"));
    }

    #[test]
    fn scope_rejects_a_topic_from_a_different_course() {
        let c = mem();
        scope_fixture(&c);
        let err = scope_add_inner(&c, &scope_link("mid", "t3")).unwrap_err();
        assert!(matches!(err, DbError::Forbidden(_)));
        assert_eq!(scope_for_assessment_inner(&c, "mid").unwrap().len(), 0);
    }

    #[test]
    fn scope_rejects_a_missing_assessment_or_topic() {
        let c = mem();
        scope_fixture(&c);
        assert!(scope_add_inner(&c, &scope_link("ghost", "t1")).is_err());
        assert!(scope_add_inner(&c, &scope_link("mid", "ghost")).is_err());
    }

    #[test]
    fn scope_set_replaces_atomically_and_rejects_the_whole_batch_on_a_bad_topic() {
        let mut c = mem();
        scope_fixture(&c);
        scope_set_inner(&mut c, "mid", &["t1".into(), "t2".into()], "user", "2026-02-01")
            .unwrap();
        assert_eq!(scope_for_assessment_inner(&c, "mid").unwrap().len(), 2);

        // A batch containing a cross-course topic must not partially apply.
        let bad = scope_set_inner(
            &mut c,
            "mid",
            &["t1".into(), "t3".into()],
            "user",
            "2026-02-02",
        );
        assert!(bad.is_err());
        let rows = scope_for_assessment_inner(&c, "mid").unwrap();
        assert_eq!(rows.len(), 2, "the failed batch rolled back to the prior scope");
        assert!(rows.iter().any(|r| r.topic_id == "t1"));
        assert!(rows.iter().any(|r| r.topic_id == "t2"));
    }

    #[test]
    fn scope_links_cascade_from_assessment_and_topic() {
        let c = mem();
        scope_fixture(&c);
        scope_add_inner(&c, &scope_link("mid", "t1")).unwrap();
        scope_add_inner(&c, &scope_link("mid", "t2")).unwrap();

        c.execute("DELETE FROM academic_topics WHERE id='t2'", []).unwrap();
        assert_eq!(scope_for_assessment_inner(&c, "mid").unwrap().len(), 1);

        c.execute("DELETE FROM academic_assessments WHERE id='mid'", [])
            .unwrap();
        assert_eq!(scope_load_all_inner(&c).unwrap().len(), 0);
    }

    #[test]
    fn scope_wire_shape_matches_the_frontend_payload() {
        let json = serde_json::json!({
            "assessmentId": "mid",
            "topicId": "t1",
            "source": "capture-approved",
            "createdAt": "2026-02-01T00:00:00.000Z"
        });
        let parsed: AssessmentTopicRow = serde_json::from_value(json).unwrap();
        assert_eq!(parsed.assessment_id, "mid");
        assert_eq!(parsed.source, "capture-approved");
        let back = serde_json::to_value(&parsed).unwrap();
        assert_eq!(back["assessmentId"], "mid");
        assert!(back.get("assessment_id").is_none());
    }

    #[test]
    fn deleting_semester_sets_course_unassigned() {
        let c = mem();
        semester_upsert_inner(&c, &semester("sem1")).unwrap();
        course_upsert_inner(&c, &course("dsa", Some("sem1"))).unwrap();

        c.execute("DELETE FROM academic_semesters WHERE id = 'sem1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.courses.len(), 1, "course survives its semester");
        assert!(
            g.courses[0].semester_id.is_none(),
            "orphaned course becomes unassigned (SET NULL), not deleted"
        );
    }

    #[test]
    fn fk_rejects_topic_on_missing_course() {
        let c = mem();
        let err = c.execute(
            "INSERT INTO academic_topics
                (id,course_id,title,position,professor_coverage,personal_study_percent,created_at,updated_at)
             VALUES ('t1','ghost','x',0,'not-taught',0,'2026-01-01','2026-01-01')",
            [],
        );
        assert!(
            err.is_err(),
            "FK must reject an academic topic pointing at a missing course"
        );
    }

    #[test]
    fn academic_topic_links_to_canonical_knowledge_concept_without_copying_mastery() {
        let c = mem();
        course_upsert_inner(&c, &course("dsa", None)).unwrap();
        know_topic(&c, "know-bt");
        topic_upsert_inner(&c, &topic("t1", "dsa", None)).unwrap();

        // Link.
        topic_link_knowledge_inner(&c, "t1", Some("know-bt")).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.topics[0].knowledge_topic_id.as_deref(), Some("know-bt"));
        assert!(
            g.topics[0].mastery_self_assessed.is_none(),
            "linking must NOT populate any academic-side mastery value"
        );

        // Deleting the knowledge concept SET NULLs the academic link (topic stays).
        c.execute("DELETE FROM knowledge_topics WHERE id = 'know-bt'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.topics.len(), 1, "academic topic survives the concept");
        assert!(
            g.topics[0].knowledge_topic_id.is_none(),
            "link is cleared, not cascaded"
        );

        // Unlink is idempotent no-op-safe.
        topic_link_knowledge_inner(&c, "t1", None).unwrap();
        let g = load_inner(&c).unwrap();
        assert!(g.topics[0].knowledge_topic_id.is_none());
    }

    #[test]
    fn link_to_missing_knowledge_concept_is_rejected() {
        let c = mem();
        course_upsert_inner(&c, &course("dsa", None)).unwrap();
        topic_upsert_inner(&c, &topic("t1", "dsa", None)).unwrap();
        let err = topic_link_knowledge_inner(&c, "t1", Some("ghost-concept"));
        assert!(
            err.is_err(),
            "FK must reject linking an academic topic to a non-existent knowledge concept"
        );
    }

    #[test]
    fn link_on_missing_topic_reports_not_found() {
        let c = mem();
        let err = topic_link_knowledge_inner(&c, "ghost-topic", None);
        assert!(matches!(err, Err(DbError::Forbidden(_))));
    }

    #[test]
    fn no_grade_rule_is_encoded_grades_are_pass_through_or_null() {
        let c = mem();
        course_upsert_inner(&c, &course("dsa", None)).unwrap();
        // An assessment with a high obtained score does NOT create any letter grade.
        assessment_upsert_inner(&c, &assessment("a1", "dsa", Some(20.0))).unwrap();
        attempt_upsert_inner(&c, &attempt("at1", "dsa", None)).unwrap();
        let g = load_inner(&c).unwrap();
        assert!(
            g.attempts[0].final_grade.is_none(),
            "a perfect assessment score must NOT auto-populate a final grade"
        );
        assert!(
            g.courses[0].projected_grade.is_none(),
            "projected grade stays exactly what the user set (here: unset)"
        );
        // A user-entered grade is stored verbatim.
        attempt_upsert_inner(&c, &attempt("at1", "dsa", Some("B+"))).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.attempts[0].final_grade.as_deref(), Some("B+"));
    }

    #[test]
    fn import_is_idempotent_non_destructive_and_dangling_safe() {
        let c = mem();
        know_topic(&c, "know-bt");
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = AcademicImport {
            semesters: vec![semester("sem1")],
            courses: vec![
                course("dsa", Some("sem1")),
                course("orphan", Some("ghost-sem")),
            ],
            topics: vec![
                topic("t1", "dsa", Some("know-bt")),
                topic("t2", "dsa", Some("ghost-concept")), // link dropped, topic kept
                topic("t3", "ghost-course", None),         // parent missing -> dropped
            ],
            assessments: vec![
                assessment("a1", "dsa", Some(18.0)),
                assessment("a2", "ghost-course", Some(5.0)), // dropped
            ],
            attempts: vec![attempt("at1", "dsa", Some("A"))],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.semesters_imported, 1);
        assert_eq!(
            r1.courses_imported, 2,
            "the orphan course imports, unassigned"
        );
        assert_eq!(r1.topics_imported, 2, "t3 (missing course) is dropped");
        assert_eq!(
            r1.topic_links_dropped, 1,
            "t2's dangling knowledge link is cleared"
        );
        assert_eq!(r1.assessments_imported, 1, "a2 (missing course) is dropped");
        assert_eq!(r1.attempts_imported, 1);

        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            let orphan = g.courses.iter().find(|c| c.id == "orphan").unwrap();
            assert!(
                orphan.semester_id.is_none(),
                "unresolved semester -> unassigned"
            );
            let t1 = g.topics.iter().find(|t| t.id == "t1").unwrap();
            assert_eq!(t1.knowledge_topic_id.as_deref(), Some("know-bt"));
            let t2 = g.topics.iter().find(|t| t.id == "t2").unwrap();
            assert!(
                t2.knowledge_topic_id.is_none(),
                "dangling link cleared on import"
            );
        }

        // Mutate a canonical record, then re-import: must be a no-op.
        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE academic_courses SET title = 'EDITED' WHERE id = 'dsa'",
                [],
            )
            .unwrap();
        }
        let imp2 = AcademicImport {
            semesters: vec![],
            courses: vec![course("dsa", Some("sem1"))],
            topics: vec![],
            assessments: vec![],
            attempts: vec![],
        };
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp2).unwrap()
        };
        assert!(!r2.ran, "second import is a no-op once the marker is set");
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            let dsa = g.courses.iter().find(|c| c.id == "dsa").unwrap();
            assert_eq!(
                dsa.title, "EDITED",
                "re-import must not clobber newer canonical data"
            );
        }
    }

    #[test]
    fn upsert_preserves_created_at_on_update() {
        let c = mem();
        course_upsert_inner(&c, &course("dsa", None)).unwrap();
        let mut edited = course("dsa", None);
        edited.title = "Data Structures & Algorithms".into();
        edited.created_at = "2099-12-31".into(); // caller lies about created_at
        course_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.courses[0].title, "Data Structures & Algorithms");
        assert_eq!(
            g.courses[0].created_at, "2026-01-01",
            "created_at is immutable on update"
        );
    }
}
