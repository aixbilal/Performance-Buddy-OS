//! Batch 2 — canonical relational persistence for the Reading & Language
//! Learning domain. Thin data-access over the SQLite tables in migration v4
//! (see `db.rs`).
//!
//! Product boundaries (V1 Day 09 decision specs), enforced by shape here:
//!   Reading & Language = WHAT was read/learned + curriculum/path progress.
//!   Knowledge          = evidence of understanding/retention (its own tables).
//!   Routine            = WHEN / how often practice happens (its own tables).
//!
//!   Path progress and reading progress are DERIVED arithmetic in the TS
//!   engine — never a stored "mastery" number. Cross-domain links are
//!   references only, cleared to NULL if the target is gone:
//!     language_paths.related_routine_id  -> routines(id)      ON DELETE SET NULL
//!     language_units.knowledge_topic_id  -> knowledge_topics  ON DELETE SET NULL
//!     books.knowledge_topic_id           -> knowledge_topics  ON DELETE SET NULL
//!   `books.note_ref` is a free-text pointer only — no Obsidian integration.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_LANG_IMPORT: &str = "language_relational_import";

// ---------------------------------------------------------------------------
// Row types (camelCase across the Tauri boundary)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguagePathRow {
    pub id: String,
    pub language: String,
    pub title: String,
    pub target_level: String,
    pub status: String,
    pub related_routine_id: Option<String>,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageUnitRow {
    pub id: String,
    pub path_id: String,
    pub title: String,
    pub kind: String,
    pub position: i64,
    pub completed: bool,
    pub knowledge_topic_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageSessionRow {
    pub id: String,
    pub path_id: String,
    pub unit_id: Option<String>,
    pub date: String,
    pub duration_minutes: i64,
    pub activity: String,
    pub notes: String,
    pub recall_score: Option<f64>,
    pub recall_max: f64,
    pub completed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookRow {
    pub id: String,
    pub title: String,
    pub author: String,
    pub status: String,
    pub current_page: i64,
    pub total_pages: Option<i64>,
    pub current_chapter: i64,
    pub started_date: Option<String>,
    pub finished_date: Option<String>,
    pub knowledge_topic_id: Option<String>,
    pub note_ref: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingSessionRow {
    pub id: String,
    pub book_id: String,
    pub date: String,
    pub from_page: i64,
    pub to_page: i64,
    pub duration_minutes: i64,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageGraph {
    pub paths: Vec<LanguagePathRow>,
    pub units: Vec<LanguageUnitRow>,
    pub sessions: Vec<LanguageSessionRow>,
    pub books: Vec<BookRow>,
    pub reading_sessions: Vec<ReadingSessionRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageImport {
    pub paths: Vec<LanguagePathRow>,
    pub units: Vec<LanguageUnitRow>,
    pub sessions: Vec<LanguageSessionRow>,
    pub books: Vec<BookRow>,
    pub reading_sessions: Vec<ReadingSessionRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageImportReport {
    pub ran: bool,
    pub paths_imported: usize,
    pub units_imported: usize,
    pub sessions_imported: usize,
    pub books_imported: usize,
    pub reading_sessions_imported: usize,
    pub routine_links_cleared: usize,
    pub knowledge_links_cleared: usize,
}

// ---------------------------------------------------------------------------
// Cross-domain reference resolution
// ---------------------------------------------------------------------------

fn resolve_ref(conn: &Connection, table: &str, candidate: &Option<String>) -> Option<String> {
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

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<LanguageGraph> {
    let mut ps = conn.prepare(
        "SELECT id,language,title,target_level,status,related_routine_id,archived,created_at,updated_at
         FROM language_paths ORDER BY created_at",
    )?;
    let paths = ps
        .query_map([], |r| {
            Ok(LanguagePathRow {
                id: r.get(0)?,
                language: r.get(1)?,
                title: r.get(2)?,
                target_level: r.get(3)?,
                status: r.get(4)?,
                related_routine_id: r.get(5)?,
                archived: r.get::<_, i64>(6)? != 0,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut us = conn.prepare(
        "SELECT id,path_id,title,kind,position,completed,knowledge_topic_id,created_at,updated_at
         FROM language_units ORDER BY path_id, position, created_at",
    )?;
    let units = us
        .query_map([], |r| {
            Ok(LanguageUnitRow {
                id: r.get(0)?,
                path_id: r.get(1)?,
                title: r.get(2)?,
                kind: r.get(3)?,
                position: r.get(4)?,
                completed: r.get::<_, i64>(5)? != 0,
                knowledge_topic_id: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ss = conn.prepare(
        "SELECT id,path_id,unit_id,date,duration_minutes,activity,notes,recall_score,recall_max,completed,created_at,updated_at
         FROM language_sessions ORDER BY date, created_at",
    )?;
    let sessions = ss
        .query_map([], |r| {
            Ok(LanguageSessionRow {
                id: r.get(0)?,
                path_id: r.get(1)?,
                unit_id: r.get(2)?,
                date: r.get(3)?,
                duration_minutes: r.get(4)?,
                activity: r.get(5)?,
                notes: r.get(6)?,
                recall_score: r.get(7)?,
                recall_max: r.get(8)?,
                completed: r.get::<_, i64>(9)? != 0,
                created_at: r.get(10)?,
                updated_at: r.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut bs = conn.prepare(
        "SELECT id,title,author,status,current_page,total_pages,current_chapter,started_date,finished_date,knowledge_topic_id,note_ref,archived,created_at,updated_at
         FROM books ORDER BY created_at",
    )?;
    let books = bs
        .query_map([], |r| {
            Ok(BookRow {
                id: r.get(0)?,
                title: r.get(1)?,
                author: r.get(2)?,
                status: r.get(3)?,
                current_page: r.get(4)?,
                total_pages: r.get(5)?,
                current_chapter: r.get(6)?,
                started_date: r.get(7)?,
                finished_date: r.get(8)?,
                knowledge_topic_id: r.get(9)?,
                note_ref: r.get(10)?,
                archived: r.get::<_, i64>(11)? != 0,
                created_at: r.get(12)?,
                updated_at: r.get(13)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut rs = conn.prepare(
        "SELECT id,book_id,date,from_page,to_page,duration_minutes,notes,created_at,updated_at
         FROM reading_sessions ORDER BY date, created_at",
    )?;
    let reading_sessions = rs
        .query_map([], |r| {
            Ok(ReadingSessionRow {
                id: r.get(0)?,
                book_id: r.get(1)?,
                date: r.get(2)?,
                from_page: r.get(3)?,
                to_page: r.get(4)?,
                duration_minutes: r.get(5)?,
                notes: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(LanguageGraph {
        paths,
        units,
        sessions,
        books,
        reading_sessions,
    })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

fn path_upsert_inner(conn: &Connection, p: &LanguagePathRow) -> DbResult<()> {
    let routine = resolve_ref(conn, "routines", &p.related_routine_id);
    conn.execute(
        "INSERT INTO language_paths
            (id,language,title,target_level,status,related_routine_id,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            language=excluded.language, title=excluded.title, target_level=excluded.target_level,
            status=excluded.status, related_routine_id=excluded.related_routine_id,
            archived=excluded.archived, updated_at=excluded.updated_at",
        params![
            p.id,
            p.language,
            p.title,
            p.target_level,
            p.status,
            routine,
            p.archived as i64,
            p.created_at,
            p.updated_at
        ],
    )?;
    Ok(())
}

fn unit_upsert_inner(conn: &Connection, u: &LanguageUnitRow) -> DbResult<()> {
    let topic = resolve_ref(conn, "knowledge_topics", &u.knowledge_topic_id);
    conn.execute(
        "INSERT INTO language_units
            (id,path_id,title,kind,position,completed,knowledge_topic_id,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            path_id=excluded.path_id, title=excluded.title, kind=excluded.kind,
            position=excluded.position, completed=excluded.completed,
            knowledge_topic_id=excluded.knowledge_topic_id, updated_at=excluded.updated_at",
        params![
            u.id,
            u.path_id,
            u.title,
            u.kind,
            u.position,
            u.completed as i64,
            topic,
            u.created_at,
            u.updated_at
        ],
    )?;
    Ok(())
}

fn session_upsert_inner(conn: &Connection, s: &LanguageSessionRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO language_sessions
            (id,path_id,unit_id,date,duration_minutes,activity,notes,recall_score,recall_max,completed,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(id) DO UPDATE SET
            path_id=excluded.path_id, unit_id=excluded.unit_id, date=excluded.date,
            duration_minutes=excluded.duration_minutes, activity=excluded.activity,
            notes=excluded.notes, recall_score=excluded.recall_score,
            recall_max=excluded.recall_max, completed=excluded.completed,
            updated_at=excluded.updated_at",
        params![
            s.id,
            s.path_id,
            s.unit_id,
            s.date,
            s.duration_minutes,
            s.activity,
            s.notes,
            s.recall_score,
            s.recall_max,
            s.completed as i64,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

fn book_upsert_inner(conn: &Connection, b: &BookRow) -> DbResult<()> {
    let topic = resolve_ref(conn, "knowledge_topics", &b.knowledge_topic_id);
    conn.execute(
        "INSERT INTO books
            (id,title,author,status,current_page,total_pages,current_chapter,started_date,finished_date,knowledge_topic_id,note_ref,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, author=excluded.author, status=excluded.status,
            current_page=excluded.current_page, total_pages=excluded.total_pages,
            current_chapter=excluded.current_chapter, started_date=excluded.started_date,
            finished_date=excluded.finished_date, knowledge_topic_id=excluded.knowledge_topic_id,
            note_ref=excluded.note_ref, archived=excluded.archived, updated_at=excluded.updated_at",
        params![
            b.id,
            b.title,
            b.author,
            b.status,
            b.current_page,
            b.total_pages,
            b.current_chapter,
            b.started_date,
            b.finished_date,
            topic,
            b.note_ref,
            b.archived as i64,
            b.created_at,
            b.updated_at
        ],
    )?;
    Ok(())
}

fn reading_session_upsert_inner(conn: &Connection, s: &ReadingSessionRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO reading_sessions
            (id,book_id,date,from_page,to_page,duration_minutes,notes,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            book_id=excluded.book_id, date=excluded.date, from_page=excluded.from_page,
            to_page=excluded.to_page, duration_minutes=excluded.duration_minutes,
            notes=excluded.notes, updated_at=excluded.updated_at",
        params![
            s.id,
            s.book_id,
            s.date,
            s.from_page,
            s.to_page,
            s.duration_minutes,
            s.notes,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: LanguageImport) -> DbResult<LanguageImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_LANG_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(LanguageImportReport {
            ran: false,
            paths_imported: 0,
            units_imported: 0,
            sessions_imported: 0,
            books_imported: 0,
            reading_sessions_imported: 0,
            routine_links_cleared: 0,
            knowledge_links_cleared: 0,
        });
    }

    let mut r = LanguageImportReport {
        ran: true,
        paths_imported: 0,
        units_imported: 0,
        sessions_imported: 0,
        books_imported: 0,
        reading_sessions_imported: 0,
        routine_links_cleared: 0,
        knowledge_links_cleared: 0,
    };

    let tx = conn.transaction()?;

    for p in &import.paths {
        let routine: Option<String> = match &p.related_routine_id {
            Some(id) if !id.is_empty() => {
                let ok: Option<String> = tx
                    .query_row("SELECT id FROM routines WHERE id = ?1", params![id], |x| {
                        x.get(0)
                    })
                    .ok();
                if ok.is_none() {
                    r.routine_links_cleared += 1;
                }
                ok
            }
            _ => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO language_paths
                (id,language,title,target_level,status,related_routine_id,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                p.id, p.language, p.title, p.target_level, p.status, routine,
                p.archived as i64, p.created_at, p.updated_at
            ],
        )?;
        r.paths_imported += n;
    }

    for u in &import.units {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM language_paths WHERE id = ?1",
                params![u.path_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let topic: Option<String> = match &u.knowledge_topic_id {
            Some(id) if !id.is_empty() => {
                let ok: Option<String> = tx
                    .query_row(
                        "SELECT id FROM knowledge_topics WHERE id = ?1",
                        params![id],
                        |x| x.get(0),
                    )
                    .ok();
                if ok.is_none() {
                    r.knowledge_links_cleared += 1;
                }
                ok
            }
            _ => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO language_units
                (id,path_id,title,kind,position,completed,knowledge_topic_id,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                u.id,
                u.path_id,
                u.title,
                u.kind,
                u.position,
                u.completed as i64,
                topic,
                u.created_at,
                u.updated_at
            ],
        )?;
        r.units_imported += n;
    }

    for s in &import.sessions {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM language_paths WHERE id = ?1",
                params![s.path_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let unit: Option<String> = match &s.unit_id {
            Some(id) => tx
                .query_row(
                    "SELECT id FROM language_units WHERE id = ?1",
                    params![id],
                    |x| x.get(0),
                )
                .ok(),
            None => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO language_sessions
                (id,path_id,unit_id,date,duration_minutes,activity,notes,recall_score,recall_max,completed,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                s.id, s.path_id, unit, s.date, s.duration_minutes, s.activity, s.notes,
                s.recall_score, s.recall_max, s.completed as i64, s.created_at, s.updated_at
            ],
        )?;
        r.sessions_imported += n;
    }

    for b in &import.books {
        let topic: Option<String> = match &b.knowledge_topic_id {
            Some(id) if !id.is_empty() => {
                let ok: Option<String> = tx
                    .query_row(
                        "SELECT id FROM knowledge_topics WHERE id = ?1",
                        params![id],
                        |x| x.get(0),
                    )
                    .ok();
                if ok.is_none() {
                    r.knowledge_links_cleared += 1;
                }
                ok
            }
            _ => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO books
                (id,title,author,status,current_page,total_pages,current_chapter,started_date,finished_date,knowledge_topic_id,note_ref,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![
                b.id, b.title, b.author, b.status, b.current_page, b.total_pages,
                b.current_chapter, b.started_date, b.finished_date, topic, b.note_ref,
                b.archived as i64, b.created_at, b.updated_at
            ],
        )?;
        r.books_imported += n;
    }

    for s in &import.reading_sessions {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM books WHERE id = ?1",
                params![s.book_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO reading_sessions
                (id,book_id,date,from_page,to_page,duration_minutes,notes,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                s.id,
                s.book_id,
                s.date,
                s.from_page,
                s.to_page,
                s.duration_minutes,
                s.notes,
                s.created_at,
                s.updated_at
            ],
        )?;
        r.reading_sessions_imported += n;
    }

    let marker = serde_json::json!({
        "version": 1,
        "pathsImported": r.paths_imported,
        "unitsImported": r.units_imported,
        "sessionsImported": r.sessions_imported,
        "booksImported": r.books_imported,
        "readingSessionsImported": r.reading_sessions_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_LANG_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn lang_load(db: State<'_, Db>) -> DbResult<LanguageGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn lang_path_upsert(db: State<'_, Db>, path: LanguagePathRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    path_upsert_inner(&conn, &path)
}

#[tauri::command]
pub fn lang_path_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: units + sessions CASCADE.
    conn.execute("DELETE FROM language_paths WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn lang_unit_upsert(db: State<'_, Db>, unit: LanguageUnitRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    unit_upsert_inner(&conn, &unit)
}

#[tauri::command]
pub fn lang_unit_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM language_units WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn lang_units_reorder(
    db: State<'_, Db>,
    path_id: String,
    ordered_ids: Vec<String>,
) -> DbResult<()> {
    let mut conn = db.0.lock().unwrap();
    let tx = conn.transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE language_units SET position = ?1, updated_at = datetime('now')
             WHERE id = ?2 AND path_id = ?3",
            params![idx as i64, id, path_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn lang_session_upsert(db: State<'_, Db>, session: LanguageSessionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    session_upsert_inner(&conn, &session)
}

#[tauri::command]
pub fn lang_session_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM language_sessions WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn lang_book_upsert(db: State<'_, Db>, book: BookRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    book_upsert_inner(&conn, &book)
}

#[tauri::command]
pub fn lang_book_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: reading_sessions CASCADE.
    conn.execute("DELETE FROM books WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn lang_reading_session_upsert(db: State<'_, Db>, session: ReadingSessionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    reading_session_upsert_inner(&conn, &session)
}

#[tauri::command]
pub fn lang_reading_session_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM reading_sessions WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn lang_import_graph(
    db: State<'_, Db>,
    import: LanguageImport,
) -> DbResult<LanguageImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Reading & Language graph + its import marker.
#[tauri::command]
pub fn lang_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "lang_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM reading_sessions;
         DELETE FROM books;
         DELETE FROM language_sessions;
         DELETE FROM language_units;
         DELETE FROM language_paths;
         DELETE FROM kv_store WHERE key IN
           ('pbos:language-units','pbos:language-lessons','pbos:language-books',
            'pbos:language-sessions','pbos:language-reading-sessions');
         INSERT INTO meta (key,value) VALUES ('language_relational_import','{\"version\":1,\"reset\":true}')
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

    fn routine(c: &Connection, id: &str) {
        c.execute(
            "INSERT INTO routines
                (id,title,category,time_window,schedule_type,schedule_days,completion_type,priority,paused,archived,created_at,updated_at)
             VALUES (?1,'German Practice','Language','evening','daily','[]','duration','important',0,0,'2026-01-01','2026-01-01')",
            params![id],
        )
        .unwrap();
    }
    fn topic(c: &Connection, id: &str) {
        c.execute(
            "INSERT INTO knowledge_topics (id,title,category,context,created_at,updated_at)
             VALUES (?1,'German Vocab','language','','2026-01-01','2026-01-01')",
            params![id],
        )
        .unwrap();
    }

    fn path(id: &str, routine_id: Option<&str>) -> LanguagePathRow {
        LanguagePathRow {
            id: id.into(),
            language: "German".into(),
            title: "A1 Foundations".into(),
            target_level: "A2".into(),
            status: "active".into(),
            related_routine_id: routine_id.map(String::from),
            archived: false,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn unit(id: &str, path_id: &str, topic_id: Option<&str>) -> LanguageUnitRow {
        LanguageUnitRow {
            id: id.into(),
            path_id: path_id.into(),
            title: "Basic Introductions".into(),
            kind: "lesson".into(),
            position: 0,
            completed: false,
            knowledge_topic_id: topic_id.map(String::from),
            created_at: "2026-01-02".into(),
            updated_at: "2026-01-02".into(),
        }
    }
    fn session(
        id: &str,
        path_id: &str,
        unit_id: Option<&str>,
        recall: Option<f64>,
    ) -> LanguageSessionRow {
        LanguageSessionRow {
            id: id.into(),
            path_id: path_id.into(),
            unit_id: unit_id.map(String::from),
            date: "2026-02-01".into(),
            duration_minutes: 30,
            activity: "lesson".into(),
            notes: String::new(),
            recall_score: recall,
            recall_max: 10.0,
            completed: true,
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
        }
    }
    fn book(id: &str, total: Option<i64>, topic_id: Option<&str>) -> BookRow {
        BookRow {
            id: id.into(),
            title: "Atomic Habits".into(),
            author: "James Clear".into(),
            status: "reading".into(),
            current_page: 40,
            total_pages: total,
            current_chapter: 2,
            started_date: Some("2026-01-10".into()),
            finished_date: None,
            knowledge_topic_id: topic_id.map(String::from),
            note_ref: String::new(),
            archived: false,
            created_at: "2026-01-10".into(),
            updated_at: "2026-01-10".into(),
        }
    }

    #[test]
    fn crud_and_cascade_delete() {
        let c = mem();
        path_upsert_inner(&c, &path("p1", None)).unwrap();
        unit_upsert_inner(&c, &unit("u1", "p1", None)).unwrap();
        session_upsert_inner(&c, &session("s1", "p1", Some("u1"), None)).unwrap();
        book_upsert_inner(&c, &book("b1", Some(320), None)).unwrap();
        reading_session_upsert_inner(
            &c,
            &ReadingSessionRow {
                id: "rs1".into(),
                book_id: "b1".into(),
                date: "2026-01-11".into(),
                from_page: 40,
                to_page: 60,
                duration_minutes: 25,
                notes: String::new(),
                created_at: "2026-01-11".into(),
                updated_at: "2026-01-11".into(),
            },
        )
        .unwrap();

        let g = load_inner(&c).unwrap();
        assert_eq!(g.paths.len(), 1);
        assert_eq!(g.units.len(), 1);
        assert_eq!(g.sessions.len(), 1);
        assert_eq!(g.books.len(), 1);
        assert_eq!(g.reading_sessions.len(), 1);

        // delete the path: units CASCADE, sessions CASCADE
        c.execute("DELETE FROM language_paths WHERE id = 'p1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.paths.len(), 0);
        assert_eq!(g.units.len(), 0, "units cascade with the path");
        assert_eq!(g.sessions.len(), 0, "sessions cascade with the path");

        // delete the book: reading sessions CASCADE
        c.execute("DELETE FROM books WHERE id = 'b1'", []).unwrap();
        assert_eq!(load_inner(&c).unwrap().reading_sessions.len(), 0);
    }

    #[test]
    fn deleting_a_unit_nulls_the_session_link_but_keeps_the_session() {
        let c = mem();
        path_upsert_inner(&c, &path("p1", None)).unwrap();
        unit_upsert_inner(&c, &unit("u1", "p1", None)).unwrap();
        session_upsert_inner(&c, &session("s1", "p1", Some("u1"), None)).unwrap();

        c.execute("DELETE FROM language_units WHERE id = 'u1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.sessions.len(), 1, "session history survives its unit");
        assert!(
            g.sessions[0].unit_id.is_none(),
            "unit_id SET NULL, not deleted"
        );
    }

    #[test]
    fn cross_domain_links_are_cleared_when_the_target_is_gone() {
        let c = mem();
        routine(&c, "rt1");
        topic(&c, "kt1");
        path_upsert_inner(&c, &path("p1", Some("rt1"))).unwrap();
        unit_upsert_inner(&c, &unit("u1", "p1", Some("kt1"))).unwrap();
        book_upsert_inner(&c, &book("b1", Some(320), Some("kt1"))).unwrap();

        c.execute("DELETE FROM routines WHERE id = 'rt1'", [])
            .unwrap();
        c.execute("DELETE FROM knowledge_topics WHERE id = 'kt1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert!(
            g.paths[0].related_routine_id.is_none(),
            "routine link SET NULL"
        );
        assert!(
            g.units[0].knowledge_topic_id.is_none(),
            "knowledge link SET NULL"
        );
        assert!(
            g.books[0].knowledge_topic_id.is_none(),
            "book knowledge link SET NULL"
        );
        assert_eq!(g.paths.len(), 1, "path itself is untouched");
        assert_eq!(g.books.len(), 1, "book itself is untouched");
    }

    #[test]
    fn upsert_stores_a_dangling_link_as_null_not_an_fk_error() {
        let c = mem();
        path_upsert_inner(&c, &path("p1", Some("ghost-routine"))).unwrap();
        book_upsert_inner(&c, &book("b1", Some(100), Some("ghost-topic"))).unwrap();
        let g = load_inner(&c).unwrap();
        assert!(g.paths[0].related_routine_id.is_none());
        assert!(g.books[0].knowledge_topic_id.is_none());
    }

    #[test]
    fn no_mastery_or_progress_column_on_path_or_book() {
        let c = mem();
        for (table, banned) in [
            ("language_paths", ["mastery", "progress_percent", "skill"]),
            ("books", ["mastery", "knowledge_gained", "progress_percent"]),
        ] {
            let cols: Vec<String> = c
                .prepare(&format!("SELECT name FROM pragma_table_info('{table}')"))
                .unwrap()
                .query_map([], |r| r.get(0))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();
            for b in banned {
                assert!(
                    !cols.iter().any(|col| col.contains(b)),
                    "{table} must not store a `{b}` column — progress/mastery is derived"
                );
            }
        }
    }

    #[test]
    fn recall_score_is_optional_minutes_alone_are_not_mastery() {
        let c = mem();
        path_upsert_inner(&c, &path("p1", None)).unwrap();
        // a 30-minute session with NO recall check
        session_upsert_inner(&c, &session("s1", "p1", None, None)).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.sessions[0].duration_minutes, 30);
        assert!(
            g.sessions[0].recall_score.is_none(),
            "no recall check → no evidence signal, regardless of minutes"
        );
    }

    #[test]
    fn fk_rejects_unit_on_missing_path() {
        let c = mem();
        let err = c.execute(
            "INSERT INTO language_units (id,path_id,title,kind,position,completed,created_at,updated_at)
             VALUES ('u1','ghost','x','lesson',0,0,'2026-01-01','2026-01-01')",
            [],
        );
        assert!(err.is_err());
    }

    #[test]
    fn import_is_idempotent_non_destructive_and_dangling_safe() {
        let c = mem();
        routine(&c, "rt1");
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = LanguageImport {
            paths: vec![path("p1", Some("rt1")), path("p2", Some("ghost-rt"))],
            units: vec![
                unit("u1", "p1", Some("ghost-topic")),
                unit("u-ghost", "no-path", None),
            ],
            sessions: vec![
                session("s1", "p1", Some("u1"), Some(8.0)),
                session("s-ghost", "no-path", None, None),
            ],
            books: vec![book("b1", Some(320), Some("ghost-topic"))],
            reading_sessions: vec![],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.paths_imported, 2);
        assert_eq!(r1.units_imported, 1, "u-ghost dropped (missing path)");
        assert_eq!(r1.sessions_imported, 1, "s-ghost dropped (missing path)");
        assert_eq!(r1.books_imported, 1);
        assert_eq!(r1.routine_links_cleared, 1, "p2's dangling routine cleared");
        assert!(
            r1.knowledge_links_cleared >= 2,
            "dangling topic links cleared"
        );
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            assert!(g
                .paths
                .iter()
                .find(|p| p.id == "p2")
                .unwrap()
                .related_routine_id
                .is_none());
            assert!(g.units[0].knowledge_topic_id.is_none());
        }

        // mutate + re-import: no-op preserving the edit
        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE language_paths SET title = 'EDITED' WHERE id = 'p1'",
                [],
            )
            .unwrap();
        }
        let imp2 = LanguageImport {
            paths: vec![path("p1", None)],
            units: vec![],
            sessions: vec![],
            books: vec![],
            reading_sessions: vec![],
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
                    .paths
                    .iter()
                    .find(|p| p.id == "p1")
                    .unwrap()
                    .title,
                "EDITED"
            );
        }
    }

    #[test]
    fn upsert_preserves_created_at_on_update() {
        let c = mem();
        book_upsert_inner(&c, &book("b1", Some(320), None)).unwrap();
        let mut edited = book("b1", Some(320), None);
        edited.title = "Deep Work".into();
        edited.created_at = "2099-12-31".into();
        book_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.books[0].title, "Deep Work");
        assert_eq!(g.books[0].created_at, "2026-01-10");
    }
}
