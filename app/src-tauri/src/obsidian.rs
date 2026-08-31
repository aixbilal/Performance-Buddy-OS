//! Batch 5 — the KNOWLEDGE / OBSIDIAN boundary.
//!
//! Ownership lock (docs 16.01): Obsidian owns the authoritative Markdown note
//! body; PBOS owns metadata, references and intelligence. This module therefore:
//!
//!   * reads a user-selected vault directory READ-ONLY (indexing never writes),
//!   * stores METADATA ONLY in `obsidian_notes` (path / title / mtime marker /
//!     size / existence) — there is no `content` column; a preview is streamed
//!     from disk on demand and never cached as a second truth,
//!   * treats the index as DISPOSABLE — a rescan wipes and rebuilds it with no
//!     data loss,
//!   * keeps `knowledge_topic_note_links` as a GOVERNED REFERENCE keyed by the
//!     stable relative path, so a Knowledge Topic (and its Evidence / mastery)
//!     is NEVER touched because a file moved or disappeared.
//!
//! Filesystem access is least-privilege (docs 16.04): every path is resolved
//! against the canonical vault root, `..` / absolute / rooted paths are
//! rejected, and symlink/junction escapes are caught by canonicalising and
//! re-checking containment. The scanner never executes files.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

/// Directories never traversed (generated / private / VCS).
const IGNORED_DIRS: &[&str] = &[
    ".git",
    ".obsidian",
    ".trash",
    ".stfolder",
    ".stversions",
    "node_modules",
    ".vite",
    ".cache",
];
/// Markdown extensions we index.
const MD_EXTS: &[&str] = &["md", "markdown"];
/// Bounded recursion so a pathological vault can't hang the scan.
const MAX_DEPTH: usize = 16;
/// On-demand preview cap — we never stream an unbounded file into the UI.
const PREVIEW_MAX_BYTES: usize = 64 * 1024;

// ---------------------------------------------------------------------------
// Row types (camelCase across the Tauri boundary)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianConfigRow {
    pub vault_path: String,
    pub vault_id: String,
    pub status: String,
    pub connected_at: Option<String>,
    pub last_scan_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianNoteRow {
    pub id: String,
    pub relative_path: String,
    pub title: String,
    pub filename: String,
    pub modified_at: Option<String>,
    pub size_bytes: i64,
    pub exists_on_disk: bool,
    pub indexed_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteLinkRow {
    pub id: String,
    pub topic_id: String,
    pub relative_path: String,
    pub title: String,
    pub linked_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianGraph {
    pub config: Option<ObsidianConfigRow>,
    pub notes: Vec<ObsidianNoteRow>,
    pub links: Vec<NoteLinkRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    /// Files present on disk and indexed this pass.
    pub indexed: usize,
    /// Previously-indexed notes now missing but kept because a Topic links them.
    pub stale: usize,
    /// Non-Markdown files encountered and skipped.
    pub skipped_non_md: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotePreview {
    pub relative_path: String,
    pub content: String,
    pub truncated: bool,
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/// Validate + canonicalise a user-chosen vault directory.
fn canonical_vault(path: &str) -> DbResult<PathBuf> {
    let raw = path.trim();
    if raw.is_empty() {
        return Err(DbError::Path("no vault path given".into()));
    }
    let p = Path::new(raw);
    let canon = p
        .canonicalize()
        .map_err(|e| DbError::Path(format!("vault path is unavailable: {e}")))?;
    if !canon.is_dir() {
        return Err(DbError::Path("vault path is not a directory".into()));
    }
    Ok(canon)
}

/// Resolve `relative` against the canonical vault root, rejecting every escape
/// vector: absolute paths, rooted paths, `..` traversal, and — via
/// `canonicalize` + containment re-check — symlink / junction escapes.
fn safe_join(root_canon: &Path, relative: &str) -> DbResult<PathBuf> {
    let rel = Path::new(relative.trim());
    if rel.as_os_str().is_empty() {
        return Err(DbError::Forbidden("empty note path".into()));
    }
    for comp in rel.components() {
        match comp {
            Component::ParentDir => {
                return Err(DbError::Forbidden("path traversal ('..') rejected".into()))
            }
            Component::Prefix(_) | Component::RootDir => {
                return Err(DbError::Forbidden(
                    "absolute / rooted note path rejected".into(),
                ))
            }
            _ => {}
        }
    }
    let joined = root_canon.join(rel);
    let canon = joined
        .canonicalize()
        .map_err(|_| DbError::Path("note file is missing from the vault".into()))?;
    if !canon.starts_with(root_canon) {
        return Err(DbError::Forbidden(
            "note path escapes the approved vault scope".into(),
        ));
    }
    Ok(canon)
}

// ---------------------------------------------------------------------------
// Scanning (pure filesystem, no DB)
// ---------------------------------------------------------------------------

struct ScannedNote {
    relative_path: String,
    title: String,
    filename: String,
    modified_at: Option<String>,
    size_bytes: i64,
}

fn is_ignored_dir(name: &str) -> bool {
    IGNORED_DIRS.contains(&name)
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MD_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Prefer the first ATX `# ` heading; fall back to the filename stem.
fn title_for(path: &Path, first_kb: &str) -> String {
    for line in first_kb.lines().take(40) {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix("# ") {
            let h = rest.trim().trim_end_matches('#').trim();
            if !h.is_empty() {
                return h.to_string();
            }
        }
    }
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

fn mtime_marker(meta: &fs::Metadata) -> Option<String> {
    meta.modified()
        .ok()
        .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis().to_string())
}

fn to_relative(root: &Path, file: &Path) -> String {
    file.strip_prefix(root)
        .unwrap_or(file)
        .to_string_lossy()
        .replace('\\', "/")
}

fn scan_vault(root: &Path) -> DbResult<(Vec<ScannedNote>, usize)> {
    let mut out: Vec<ScannedNote> = Vec::new();
    let mut skipped_non_md = 0usize;
    // manual stack walk — no external walkdir dependency
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];
    while let Some((dir, depth)) = stack.pop() {
        if depth > MAX_DEPTH {
            continue;
        }
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue, // unreadable dir is isolated, not fatal
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            let name = entry.file_name().to_string_lossy().to_string();
            if file_type.is_dir() {
                if !is_ignored_dir(&name) {
                    stack.push((path, depth + 1));
                }
                continue;
            }
            // Only follow regular files. A symlinked file is read via its target
            // but safe_join re-checks containment before any on-demand read.
            if !is_markdown(&path) {
                if !name.starts_with('.') {
                    skipped_non_md += 1;
                }
                continue;
            }
            let meta = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            let head = read_head(&path, 4096);
            out.push(ScannedNote {
                relative_path: to_relative(root, &path),
                title: title_for(&path, &head),
                filename: name,
                modified_at: mtime_marker(&meta),
                size_bytes: meta.len() as i64,
            });
        }
    }
    out.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok((out, skipped_non_md))
}

/// Read at most `n` bytes of a file as lossy UTF-8 (encoding-preserving: a
/// decode error yields replacement chars, never a destructive rewrite).
fn read_head(path: &Path, n: usize) -> String {
    match fs::read(path) {
        Ok(bytes) => {
            let take = bytes.len().min(n);
            String::from_utf8_lossy(&bytes[..take]).into_owned()
        }
        Err(_) => String::new(),
    }
}

fn stable_note_id(relative_path: &str) -> String {
    let mut h = DefaultHasher::new();
    relative_path.hash(&mut h);
    format!("note_{:016x}", h.finish())
}

// ---------------------------------------------------------------------------
// DB layer
// ---------------------------------------------------------------------------

fn load_config(conn: &Connection) -> DbResult<Option<ObsidianConfigRow>> {
    let row = conn
        .query_row(
            "SELECT vault_path,vault_id,status,connected_at,last_scan_at,created_at,updated_at
             FROM obsidian_config WHERE id = 1",
            [],
            |r| {
                Ok(ObsidianConfigRow {
                    vault_path: r.get(0)?,
                    vault_id: r.get(1)?,
                    status: r.get(2)?,
                    connected_at: r.get(3)?,
                    last_scan_at: r.get(4)?,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

fn load_notes(conn: &Connection) -> DbResult<Vec<ObsidianNoteRow>> {
    let mut s = conn.prepare(
        "SELECT id,relative_path,title,filename,modified_at,size_bytes,exists_on_disk,indexed_at
         FROM obsidian_notes ORDER BY relative_path",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(ObsidianNoteRow {
                id: r.get(0)?,
                relative_path: r.get(1)?,
                title: r.get(2)?,
                filename: r.get(3)?,
                modified_at: r.get(4)?,
                size_bytes: r.get(5)?,
                exists_on_disk: r.get::<_, i64>(6)? != 0,
                indexed_at: r.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_links(conn: &Connection) -> DbResult<Vec<NoteLinkRow>> {
    let mut s = conn.prepare(
        "SELECT id,topic_id,relative_path,title,linked_at
         FROM knowledge_topic_note_links ORDER BY linked_at DESC",
    )?;
    let rows = s
        .query_map([], |r| {
            Ok(NoteLinkRow {
                id: r.get(0)?,
                topic_id: r.get(1)?,
                relative_path: r.get(2)?,
                title: r.get(3)?,
                linked_at: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_inner(conn: &Connection) -> DbResult<ObsidianGraph> {
    Ok(ObsidianGraph {
        config: load_config(conn)?,
        notes: load_notes(conn)?,
        links: load_links(conn)?,
    })
}

fn now() -> String {
    // RFC3339-ish UTC without a chrono dependency.
    let d = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", d.as_millis())
}

fn connect_inner(conn: &Connection, path: &str) -> DbResult<ObsidianConfigRow> {
    let canon = canonical_vault(path)?;
    let canon_str = canon.to_string_lossy().to_string();
    let vault_id = format!(
        "vault_{}",
        stable_note_id(&canon_str).trim_start_matches("note_")
    );
    let ts = now();
    conn.execute(
        "INSERT INTO obsidian_config
            (id,vault_path,vault_id,status,connected_at,last_scan_at,created_at,updated_at)
         VALUES (1,?1,?2,'connected',?3,NULL,?3,?3)
         ON CONFLICT(id) DO UPDATE SET
            vault_path=excluded.vault_path, vault_id=excluded.vault_id,
            status='connected', connected_at=excluded.connected_at, updated_at=excluded.updated_at",
        params![canon_str, vault_id, ts],
    )?;
    load_config(conn).map(|c| c.expect("config just written"))
}

fn disconnect_inner(conn: &Connection) -> DbResult<()> {
    // The Markdown files are never touched. The index is disposable, so we drop
    // it; the Knowledge ↔ note links are kept (they become 'unavailable' until a
    // vault is reconnected and rescanned).
    let ts = now();
    conn.execute(
        "UPDATE obsidian_config SET status='disconnected', last_scan_at=NULL, updated_at=?1 WHERE id=1",
        params![ts],
    )?;
    conn.execute("DELETE FROM obsidian_notes", [])?;
    Ok(())
}

fn linked_paths(conn: &Connection) -> DbResult<std::collections::HashSet<String>> {
    let mut s = conn.prepare("SELECT DISTINCT relative_path FROM knowledge_topic_note_links")?;
    let rows = s
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<Result<std::collections::HashSet<_>, _>>()?;
    Ok(rows)
}

fn scan_and_index_inner(conn: &mut Connection, root: &Path) -> DbResult<ScanReport> {
    let (found, skipped_non_md) = scan_vault(root)?;
    let keep = linked_paths(conn)?;
    let ts = now();

    let tx = conn.transaction()?;
    // 1. tombstone everything; step 2 revives what is still on disk.
    tx.execute("UPDATE obsidian_notes SET exists_on_disk = 0", [])?;
    for n in &found {
        let id = stable_note_id(&n.relative_path);
        tx.execute(
            "INSERT INTO obsidian_notes
                (id,relative_path,title,filename,modified_at,size_bytes,exists_on_disk,indexed_at,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,1,?7,?7,?7)
             ON CONFLICT(id) DO UPDATE SET
                relative_path=excluded.relative_path, title=excluded.title,
                filename=excluded.filename, modified_at=excluded.modified_at,
                size_bytes=excluded.size_bytes, exists_on_disk=1,
                indexed_at=excluded.indexed_at, updated_at=excluded.updated_at",
            params![
                id,
                n.relative_path,
                n.title,
                n.filename,
                n.modified_at,
                n.size_bytes,
                ts
            ],
        )?;
    }
    // 3. purge tombstones that nothing links; keep the rest as visible 'stale'.
    let mut stale = 0usize;
    {
        let mut s =
            tx.prepare("SELECT relative_path FROM obsidian_notes WHERE exists_on_disk = 0")?;
        let gone: Vec<String> = s
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<Result<_, _>>()?;
        drop(s);
        for path in gone {
            if keep.contains(&path) {
                stale += 1;
            } else {
                tx.execute(
                    "DELETE FROM obsidian_notes WHERE relative_path = ?1",
                    params![path],
                )?;
            }
        }
    }
    tx.execute(
        "UPDATE obsidian_config SET status='connected', last_scan_at=?1, updated_at=?1 WHERE id=1",
        params![ts],
    )?;
    tx.commit()?;

    Ok(ScanReport {
        indexed: found.len(),
        stale,
        skipped_non_md,
    })
}

fn link_note_inner(conn: &Connection, topic_id: &str, relative_path: &str) -> DbResult<()> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM knowledge_topics WHERE id = ?1",
            params![topic_id],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);
    if !exists {
        return Err(DbError::Path(format!(
            "no Knowledge topic '{topic_id}' to link"
        )));
    }
    let rel = relative_path.trim().replace('\\', "/");
    if rel.is_empty() {
        return Err(DbError::Path("no note path given".into()));
    }
    let title: String = conn
        .query_row(
            "SELECT title FROM obsidian_notes WHERE relative_path = ?1",
            params![rel],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or_else(|| {
            Path::new(&rel)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&rel)
                .to_string()
        });
    let ts = now();
    let id = format!(
        "lnk_{}",
        stable_note_id(&format!("{topic_id}|{rel}")).trim_start_matches("note_")
    );
    conn.execute(
        "INSERT INTO knowledge_topic_note_links
            (id,topic_id,relative_path,title,linked_at,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?5,?5)
         ON CONFLICT(topic_id,relative_path) DO UPDATE SET
            title=excluded.title, updated_at=excluded.updated_at",
        params![id, topic_id, rel, title, ts],
    )?;
    Ok(())
}

fn note_abs_path_inner(conn: &Connection, relative_path: &str) -> DbResult<PathBuf> {
    let cfg =
        load_config(conn)?.ok_or_else(|| DbError::Path("no Obsidian vault is connected".into()))?;
    if cfg.status != "connected" {
        return Err(DbError::Path("the Obsidian vault is disconnected".into()));
    }
    let root = canonical_vault(&cfg.vault_path)?;
    safe_join(&root, relative_path)
}

fn read_note_inner(conn: &Connection, relative_path: &str) -> DbResult<NotePreview> {
    let abs = note_abs_path_inner(conn, relative_path)?;
    let bytes = fs::read(&abs).map_err(DbError::Io)?;
    let truncated = bytes.len() > PREVIEW_MAX_BYTES;
    let take = bytes.len().min(PREVIEW_MAX_BYTES);
    Ok(NotePreview {
        relative_path: relative_path.trim().replace('\\', "/"),
        content: String::from_utf8_lossy(&bytes[..take]).into_owned(),
        truncated,
    })
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn obsidian_load(db: State<'_, Db>) -> DbResult<ObsidianGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn obsidian_connect_vault(db: State<'_, Db>, path: String) -> DbResult<ObsidianConfigRow> {
    let conn = db.0.lock().unwrap();
    connect_inner(&conn, &path)
}

#[tauri::command]
pub fn obsidian_disconnect_vault(db: State<'_, Db>) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    disconnect_inner(&conn)
}

#[tauri::command]
pub fn obsidian_scan(db: State<'_, Db>) -> DbResult<ScanReport> {
    let mut conn = db.0.lock().unwrap();
    let cfg = load_config(&conn)?
        .ok_or_else(|| DbError::Path("no Obsidian vault is connected".into()))?;
    let root = canonical_vault(&cfg.vault_path).map_err(|_| {
        // vault has gone offline — record that, keep links, don't purge blindly
        let _ = conn.execute(
            "UPDATE obsidian_config SET status='missing', updated_at=?1 WHERE id=1",
            params![now()],
        );
        DbError::Path("the configured vault is offline or missing".into())
    })?;
    scan_and_index_inner(&mut conn, &root)
}

#[tauri::command]
pub fn obsidian_link_note(
    db: State<'_, Db>,
    topic_id: String,
    relative_path: String,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    link_note_inner(&conn, &topic_id, &relative_path)
}

#[tauri::command]
pub fn obsidian_unlink_note(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM knowledge_topic_note_links WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn obsidian_read_note(db: State<'_, Db>, relative_path: String) -> DbResult<NotePreview> {
    let conn = db.0.lock().unwrap();
    read_note_inner(&conn, &relative_path)
}

#[tauri::command]
pub fn obsidian_open_note(db: State<'_, Db>, relative_path: String) -> DbResult<()> {
    let abs = {
        let conn = db.0.lock().unwrap();
        note_abs_path_inner(&conn, &relative_path)?
    };
    open_in_os(&abs, false)
}

#[tauri::command]
pub fn obsidian_reveal_note(db: State<'_, Db>, relative_path: String) -> DbResult<()> {
    let abs = {
        let conn = db.0.lock().unwrap();
        note_abs_path_inner(&conn, &relative_path)?
    };
    open_in_os(&abs, true)
}

/// Hand the validated absolute path to the OS default handler (open) or file
/// manager (reveal). Never called from unit tests — those exercise the path
/// validation only.
fn open_in_os(abs: &Path, reveal: bool) -> DbResult<()> {
    use std::process::Command;
    let spawn = |mut c: Command| {
        c.spawn()
            .map(|_| ())
            .map_err(|e| DbError::Path(format!("could not open the file: {e}")))
    };
    #[cfg(target_os = "windows")]
    {
        let mut c = Command::new("explorer");
        if reveal {
            c.arg(format!("/select,{}", abs.display()));
        } else {
            c.arg(abs);
        }
        return spawn(c);
    }
    #[cfg(target_os = "macos")]
    {
        let mut c = Command::new("open");
        if reveal {
            c.arg("-R");
        }
        c.arg(abs);
        return spawn(c);
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let target = if reveal {
            abs.parent().unwrap_or(abs)
        } else {
            abs
        };
        let mut c = Command::new("xdg-open");
        c.arg(target);
        return spawn(c);
    }
    #[allow(unreachable_code)]
    Err(DbError::Path("opening files is not supported here".into()))
}

/// DEBUG ONLY — wipes all Obsidian config, index and links.
#[tauri::command]
pub fn obsidian_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "obsidian_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM knowledge_topic_note_links;
         DELETE FROM obsidian_notes;
         DELETE FROM obsidian_config;",
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Rust unit tests — no Tauri, real temp-dir vaults
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

    /// A throwaway vault under the OS temp dir. Dropped (recursively removed) at
    /// end of scope so no test artifacts remain.
    struct TempVault(PathBuf);
    impl TempVault {
        fn new(tag: &str) -> Self {
            let mut p = std::env::temp_dir();
            let uniq = format!("pbos_vault_{tag}_{}_{}", std::process::id(), now());
            p.push(uniq);
            fs::create_dir_all(&p).unwrap();
            TempVault(p)
        }
        fn write(&self, rel: &str, body: &str) {
            let full = self.0.join(rel);
            fs::create_dir_all(full.parent().unwrap()).unwrap();
            fs::write(full, body).unwrap();
        }
        fn path(&self) -> String {
            self.0.to_string_lossy().to_string()
        }
    }
    impl Drop for TempVault {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn seed_topic(db: &Db, id: &str, title: &str) {
        let conn = db.0.lock().unwrap();
        conn.execute(
            "INSERT INTO knowledge_topics
                (id,title,category,context,last_studied,next_review_date,related_goal_id,created_at,updated_at)
             VALUES (?1,?2,'academic','',NULL,NULL,NULL,'t','t')",
            params![id, title],
        )
        .unwrap();
    }

    #[test]
    fn connect_rejects_a_missing_directory() {
        let db = mem();
        let conn = db.0.lock().unwrap();
        let missing = std::env::temp_dir().join("pbos_definitely_not_here_xyz");
        let err = connect_inner(&conn, &missing.to_string_lossy());
        assert!(err.is_err(), "a non-existent path must not connect");
    }

    #[test]
    fn connect_rejects_a_file_that_is_not_a_directory() {
        let v = TempVault::new("notdir");
        v.write("a-file.md", "# hi");
        let db = mem();
        let conn = db.0.lock().unwrap();
        let file = format!("{}/a-file.md", v.path());
        assert!(connect_inner(&conn, &file).is_err());
    }

    #[test]
    fn scan_indexes_nested_markdown_only_and_ignores_dot_dirs() {
        let v = TempVault::new("nested");
        v.write("Binary Trees.md", "# Binary Trees\nnotes");
        v.write("React/Hooks.md", "# Hooks");
        v.write("React/deep/Effects.md", "no heading here");
        v.write("notes.txt", "not markdown");
        v.write("attachments/pic.png", "binary-ish");
        v.write(".obsidian/workspace.json", "{}");
        v.write(".git/config", "[core]");

        let db = mem();
        let root = {
            let conn = db.0.lock().unwrap();
            connect_inner(&conn, &v.path()).unwrap();
            canonical_vault(&v.path()).unwrap()
        };
        let report = {
            let mut conn = db.0.lock().unwrap();
            scan_and_index_inner(&mut conn, &root).unwrap()
        };
        assert_eq!(report.indexed, 3, "3 .md files across nested folders");
        assert!(
            report.skipped_non_md >= 1,
            "notes.txt / png counted as skipped"
        );

        let conn = db.0.lock().unwrap();
        let notes = load_notes(&conn).unwrap();
        let paths: Vec<&str> = notes.iter().map(|n| n.relative_path.as_str()).collect();
        assert!(paths.contains(&"Binary Trees.md"));
        assert!(paths.contains(&"React/Hooks.md"));
        assert!(paths.contains(&"React/deep/Effects.md"));
        assert!(!paths.iter().any(|p| p.contains(".obsidian")));
        assert!(!paths.iter().any(|p| p.contains(".git")));
        // title = first '# ' heading, else filename stem
        let hooks = notes
            .iter()
            .find(|n| n.relative_path == "React/Hooks.md")
            .unwrap();
        assert_eq!(hooks.title, "Hooks");
        let effects = notes
            .iter()
            .find(|n| n.relative_path == "React/deep/Effects.md")
            .unwrap();
        assert_eq!(effects.title, "Effects", "no heading -> filename stem");
    }

    #[test]
    fn no_content_column_exists_on_the_note_index() {
        let db = mem();
        let conn = db.0.lock().unwrap();
        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(obsidian_notes)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for banned in ["content", "body", "markdown", "text"] {
            assert!(
                !cols.iter().any(|c| c == banned),
                "obsidian_notes must store metadata only — found '{banned}'"
            );
        }
    }

    #[test]
    fn safe_join_rejects_traversal_and_absolute_and_escape() {
        let v = TempVault::new("safe");
        v.write("ok.md", "# ok");
        let root = canonical_vault(&v.path()).unwrap();

        assert!(safe_join(&root, "../outside.md").is_err(), "..  rejected");
        assert!(
            safe_join(&root, "a/../../b.md").is_err(),
            "embedded .. rejected"
        );
        #[cfg(windows)]
        assert!(
            safe_join(&root, "C:/Windows/win.ini").is_err(),
            "drive path rejected"
        );
        #[cfg(unix)]
        assert!(
            safe_join(&root, "/etc/passwd").is_err(),
            "absolute path rejected"
        );
        assert!(
            safe_join(&root, "ok.md").is_ok(),
            "an in-vault file resolves"
        );
        assert!(
            safe_join(&root, "nope.md").is_err(),
            "a missing in-vault file is reported, not resolved"
        );
    }

    #[test]
    fn a_link_survives_rescan_and_a_deleted_file_becomes_stale_not_gone() {
        let v = TempVault::new("stale");
        v.write("Binary Trees.md", "# Binary Trees");
        v.write("Graphs.md", "# Graphs");
        let db = mem();
        seed_topic(&db, "kt1", "Binary Trees");

        let root = {
            let conn = db.0.lock().unwrap();
            connect_inner(&conn, &v.path()).unwrap();
            canonical_vault(&v.path()).unwrap()
        };
        {
            let mut conn = db.0.lock().unwrap();
            scan_and_index_inner(&mut conn, &root).unwrap();
        }
        {
            let conn = db.0.lock().unwrap();
            link_note_inner(&conn, "kt1", "Binary Trees.md").unwrap();
        }

        // externally delete the linked file + rescan
        fs::remove_file(v.0.join("Binary Trees.md")).unwrap();
        let report = {
            let mut conn = db.0.lock().unwrap();
            scan_and_index_inner(&mut conn, &root).unwrap()
        };
        assert_eq!(report.indexed, 1, "only Graphs.md remains on disk");
        assert_eq!(
            report.stale, 1,
            "the linked-but-missing note is kept as stale"
        );

        let conn = db.0.lock().unwrap();
        // link row still present
        let links = load_links(&conn).unwrap();
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].relative_path, "Binary Trees.md");
        // topic + its (empty) evidence untouched — the Knowledge row is intact
        let topic_still_there: bool = conn
            .query_row("SELECT 1 FROM knowledge_topics WHERE id='kt1'", [], |_| {
                Ok(true)
            })
            .unwrap();
        assert!(topic_still_there);
        // the note is marked missing, not deleted
        let bt = load_notes(&conn)
            .unwrap()
            .into_iter()
            .find(|n| n.relative_path == "Binary Trees.md")
            .unwrap();
        assert!(
            !bt.exists_on_disk,
            "stale note flagged exists_on_disk = false"
        );
    }

    #[test]
    fn deleting_a_topic_cascades_its_note_links_but_never_the_vault() {
        let v = TempVault::new("cascade");
        v.write("Note.md", "# Note");
        let db = mem();
        seed_topic(&db, "kt1", "T");
        let root = canonical_vault(&v.path()).unwrap();
        {
            let conn = db.0.lock().unwrap();
            connect_inner(&conn, &v.path()).unwrap();
        }
        {
            let mut conn = db.0.lock().unwrap();
            scan_and_index_inner(&mut conn, &root).unwrap();
        }
        {
            let conn = db.0.lock().unwrap();
            link_note_inner(&conn, "kt1", "Note.md").unwrap();
            conn.execute("DELETE FROM knowledge_topics WHERE id='kt1'", [])
                .unwrap();
            assert_eq!(load_links(&conn).unwrap().len(), 0, "link cascaded away");
        }
        // the real file is still on disk
        assert!(
            v.0.join("Note.md").exists(),
            "disconnecting knowledge never deletes files"
        );
    }

    #[test]
    fn disconnect_drops_the_disposable_index_but_keeps_links_and_files() {
        let v = TempVault::new("disc");
        v.write("A.md", "# A");
        let db = mem();
        seed_topic(&db, "kt1", "T");
        let root = canonical_vault(&v.path()).unwrap();
        {
            let conn = db.0.lock().unwrap();
            connect_inner(&conn, &v.path()).unwrap();
        }
        {
            let mut conn = db.0.lock().unwrap();
            scan_and_index_inner(&mut conn, &root).unwrap();
        }
        {
            let conn = db.0.lock().unwrap();
            link_note_inner(&conn, "kt1", "A.md").unwrap();
            disconnect_inner(&conn).unwrap();
            assert_eq!(load_notes(&conn).unwrap().len(), 0, "index cleared");
            assert_eq!(
                load_links(&conn).unwrap().len(),
                1,
                "governed reference kept"
            );
            assert_eq!(load_config(&conn).unwrap().unwrap().status, "disconnected");
        }
        assert!(
            v.0.join("A.md").exists(),
            "vault file untouched by disconnect"
        );
    }

    #[test]
    fn read_note_preview_is_bounded_and_scoped() {
        let v = TempVault::new("preview");
        v.write("Big.md", &"x".repeat(PREVIEW_MAX_BYTES + 5000));
        let db = mem();
        let conn = db.0.lock().unwrap();
        connect_inner(&conn, &v.path()).unwrap();
        let p = read_note_inner(&conn, "Big.md").unwrap();
        assert!(p.truncated);
        assert_eq!(p.content.len(), PREVIEW_MAX_BYTES);
        // escape attempt is refused
        assert!(read_note_inner(&conn, "../secret.md").is_err());
    }

    #[test]
    fn reset_for_test_clears_everything() {
        let v = TempVault::new("reset");
        v.write("A.md", "# A");
        let db = mem();
        seed_topic(&db, "kt1", "T");
        let root = canonical_vault(&v.path()).unwrap();
        {
            let conn = db.0.lock().unwrap();
            connect_inner(&conn, &v.path()).unwrap();
        }
        {
            let mut conn = db.0.lock().unwrap();
            scan_and_index_inner(&mut conn, &root).unwrap();
        }
        {
            let conn = db.0.lock().unwrap();
            link_note_inner(&conn, "kt1", "A.md").unwrap();
        }
        {
            let conn = db.0.lock().unwrap();
            conn.execute_batch(
                "DELETE FROM knowledge_topic_note_links;
                 DELETE FROM obsidian_notes;
                 DELETE FROM obsidian_config;",
            )
            .unwrap();
            let g = load_inner(&conn).unwrap();
            assert!(g.config.is_none() && g.notes.is_empty() && g.links.is_empty());
        }
    }
}
