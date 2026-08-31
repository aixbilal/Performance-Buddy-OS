//! Batch 2B — canonical relational persistence for the Development domain
//! (Project -> Milestone, Skill -> Evidence, Project <-> Skill). Thin
//! data-access over the SQLite tables created in migration v4 (see `db.rs`).
//!
//! Product locks enforced by the shape here:
//!   - Project progress, Skill capability and Knowledge mastery are separate.
//!     A Skill has three independent axes (knowledge / practice / evidence);
//!     `evidencePercent` is DERIVED from provenance-weighted evidence in the TS
//!     engine and is NEVER stored (Master Handoff §14).
//!   - Evidence carries a `provenance` (independent / ai-assisted-reviewed /
//!     ai-assisted) so "AI built it" is not silently counted as independent
//!     capability.
//!
//! Relationship truth (one source each, no reverse-collection columns):
//!   project -> milestone : `development_milestones.project_id` (FK; CASCADE)
//!   skill   -> evidence  : `development_skill_evidence.skill_id` (FK; CASCADE)
//!   evidence -> project  : `development_skill_evidence.project_id` (FK; SET NULL)
//!   project <-> skill    : `development_project_skill_links` (many-to-many)

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_DEV_IMPORT: &str = "development_relational_import";

// ---------------------------------------------------------------------------
// Row types crossing the Tauri boundary (camelCase to match the TS repo)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow {
    pub id: String,
    pub title: String,
    pub status: String,
    pub description: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRow {
    pub id: String,
    pub title: String,
    pub category: String,
    pub knowledge_percent: f64,
    pub practice_percent: f64,
    pub roadmap_position: Option<i64>,
    pub roadmap_target_level: Option<String>,
    /// Batch 5 — optional REFERENCE to one canonical Knowledge concept. Owned by
    /// `dev_skill_link_knowledge`; `skill_upsert` never writes it. Development
    /// still owns practice/capability; Knowledge still owns conceptual mastery.
    pub knowledge_topic_id: Option<String>,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneRow {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub completed: bool,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillEvidenceRow {
    pub id: String,
    pub skill_id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub provenance: String,
    pub date: String,
    /// Batch 5 — the ONE Knowledge Evidence row this skill-evidence was handed
    /// to, if any. Set-once by `dev_skill_evidence_link_knowledge`; SET NULL if
    /// that evidence is deleted. `evidence_upsert` never writes it.
    pub knowledge_evidence_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkRow {
    pub project_id: String,
    pub skill_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevGraph {
    pub projects: Vec<ProjectRow>,
    pub skills: Vec<SkillRow>,
    pub milestones: Vec<MilestoneRow>,
    pub evidence: Vec<SkillEvidenceRow>,
    pub links: Vec<LinkRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevImport {
    pub projects: Vec<ProjectRow>,
    pub skills: Vec<SkillRow>,
    pub milestones: Vec<MilestoneRow>,
    pub evidence: Vec<SkillEvidenceRow>,
    pub links: Vec<LinkRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevImportReport {
    pub ran: bool,
    pub projects_imported: usize,
    pub skills_imported: usize,
    pub milestones_imported: usize,
    pub evidence_imported: usize,
    pub links_imported: usize,
    pub projects_skipped_existing: usize,
    pub skills_skipped_existing: usize,
    pub milestones_skipped_existing: usize,
    pub evidence_skipped_existing: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<DevGraph> {
    let mut ps = conn.prepare(
        "SELECT id,title,status,description,archived,created_at,updated_at
         FROM development_projects ORDER BY created_at",
    )?;
    let projects = ps
        .query_map([], |r| {
            Ok(ProjectRow {
                id: r.get(0)?,
                title: r.get(1)?,
                status: r.get(2)?,
                description: r.get(3)?,
                archived: r.get::<_, i64>(4)? != 0,
                created_at: r.get(5)?,
                updated_at: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ss = conn.prepare(
        "SELECT id,title,category,knowledge_percent,practice_percent,
                roadmap_position,roadmap_target_level,knowledge_topic_id,archived,created_at,updated_at
         FROM development_skills ORDER BY created_at",
    )?;
    let skills = ss
        .query_map([], |r| {
            Ok(SkillRow {
                id: r.get(0)?,
                title: r.get(1)?,
                category: r.get(2)?,
                knowledge_percent: r.get(3)?,
                practice_percent: r.get(4)?,
                roadmap_position: r.get(5)?,
                roadmap_target_level: r.get(6)?,
                knowledge_topic_id: r.get(7)?,
                archived: r.get::<_, i64>(8)? != 0,
                created_at: r.get(9)?,
                updated_at: r.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ms = conn.prepare(
        "SELECT id,project_id,title,completed,position,created_at,updated_at
         FROM development_milestones ORDER BY project_id, position, created_at",
    )?;
    let milestones = ms
        .query_map([], |r| {
            Ok(MilestoneRow {
                id: r.get(0)?,
                project_id: r.get(1)?,
                title: r.get(2)?,
                completed: r.get::<_, i64>(3)? != 0,
                position: r.get(4)?,
                created_at: r.get(5)?,
                updated_at: r.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut es = conn.prepare(
        "SELECT id,skill_id,project_id,title,provenance,date,knowledge_evidence_id,created_at,updated_at
         FROM development_skill_evidence ORDER BY skill_id, date, created_at",
    )?;
    let evidence = es
        .query_map([], |r| {
            Ok(SkillEvidenceRow {
                id: r.get(0)?,
                skill_id: r.get(1)?,
                project_id: r.get(2)?,
                title: r.get(3)?,
                provenance: r.get(4)?,
                date: r.get(5)?,
                knowledge_evidence_id: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ls = conn.prepare(
        "SELECT project_id,skill_id FROM development_project_skill_links
         ORDER BY project_id, skill_id",
    )?;
    let links = ls
        .query_map([], |r| {
            Ok(LinkRow {
                project_id: r.get(0)?,
                skill_id: r.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(DevGraph {
        projects,
        skills,
        milestones,
        evidence,
        links,
    })
}

// ---------------------------------------------------------------------------
// Writes (upsert = create-or-replace by id, preserving created_at on update)
// ---------------------------------------------------------------------------

fn project_upsert_inner(conn: &Connection, p: &ProjectRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO development_projects (id,title,status,description,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, status=excluded.status, description=excluded.description,
            archived=excluded.archived, updated_at=excluded.updated_at",
        params![
            p.id,
            p.title,
            p.status,
            p.description,
            p.archived as i64,
            p.created_at,
            p.updated_at
        ],
    )?;
    Ok(())
}

fn skill_upsert_inner(conn: &Connection, s: &SkillRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO development_skills
            (id,title,category,knowledge_percent,practice_percent,
             roadmap_position,roadmap_target_level,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, category=excluded.category,
            knowledge_percent=excluded.knowledge_percent,
            practice_percent=excluded.practice_percent,
            roadmap_position=excluded.roadmap_position,
            roadmap_target_level=excluded.roadmap_target_level,
            archived=excluded.archived, updated_at=excluded.updated_at",
        params![
            s.id,
            s.title,
            s.category,
            s.knowledge_percent,
            s.practice_percent,
            s.roadmap_position,
            s.roadmap_target_level,
            s.archived as i64,
            s.created_at,
            s.updated_at
        ],
    )?;
    Ok(())
}

fn milestone_upsert_inner(conn: &Connection, m: &MilestoneRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO development_milestones (id,project_id,title,completed,position,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(id) DO UPDATE SET
            project_id=excluded.project_id, title=excluded.title,
            completed=excluded.completed, position=excluded.position,
            updated_at=excluded.updated_at",
        params![
            m.id,
            m.project_id,
            m.title,
            m.completed as i64,
            m.position,
            m.created_at,
            m.updated_at
        ],
    )?;
    Ok(())
}

fn evidence_upsert_inner(conn: &Connection, e: &SkillEvidenceRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO development_skill_evidence
            (id,skill_id,project_id,title,provenance,date,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(id) DO UPDATE SET
            skill_id=excluded.skill_id, project_id=excluded.project_id,
            title=excluded.title, provenance=excluded.provenance, date=excluded.date,
            updated_at=excluded.updated_at",
        params![
            e.id,
            e.skill_id,
            e.project_id,
            e.title,
            e.provenance,
            e.date,
            e.created_at,
            e.updated_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: DevImport) -> DbResult<DevImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_DEV_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(DevImportReport {
            ran: false,
            projects_imported: 0,
            skills_imported: 0,
            milestones_imported: 0,
            evidence_imported: 0,
            links_imported: 0,
            projects_skipped_existing: 0,
            skills_skipped_existing: 0,
            milestones_skipped_existing: 0,
            evidence_skipped_existing: 0,
        });
    }

    let mut r = DevImportReport {
        ran: true,
        projects_imported: 0,
        skills_imported: 0,
        milestones_imported: 0,
        evidence_imported: 0,
        links_imported: 0,
        projects_skipped_existing: 0,
        skills_skipped_existing: 0,
        milestones_skipped_existing: 0,
        evidence_skipped_existing: 0,
    };

    let tx = conn.transaction()?;

    for p in &import.projects {
        let n = tx.execute(
            "INSERT OR IGNORE INTO development_projects
                (id,title,status,description,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                p.id,
                p.title,
                p.status,
                p.description,
                p.archived as i64,
                p.created_at,
                p.updated_at
            ],
        )?;
        if n == 1 {
            r.projects_imported += 1
        } else {
            r.projects_skipped_existing += 1
        }
    }

    for s in &import.skills {
        let n = tx.execute(
            "INSERT OR IGNORE INTO development_skills
                (id,title,category,knowledge_percent,practice_percent,
                 roadmap_position,roadmap_target_level,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                s.id,
                s.title,
                s.category,
                s.knowledge_percent,
                s.practice_percent,
                s.roadmap_position,
                s.roadmap_target_level,
                s.archived as i64,
                s.created_at,
                s.updated_at
            ],
        )?;
        if n == 1 {
            r.skills_imported += 1
        } else {
            r.skills_skipped_existing += 1
        }
    }

    for m in &import.milestones {
        let parent_ok: bool = tx
            .query_row(
                "SELECT 1 FROM development_projects WHERE id = ?1",
                params![m.project_id],
                |_| Ok(()),
            )
            .is_ok();
        if !parent_ok {
            continue;
        }
        let n = tx.execute(
            "INSERT OR IGNORE INTO development_milestones
                (id,project_id,title,completed,position,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                m.id,
                m.project_id,
                m.title,
                m.completed as i64,
                m.position,
                m.created_at,
                m.updated_at
            ],
        )?;
        if n == 1 {
            r.milestones_imported += 1
        } else {
            r.milestones_skipped_existing += 1
        }
    }

    for e in &import.evidence {
        let skill_ok: bool = tx
            .query_row(
                "SELECT 1 FROM development_skills WHERE id = ?1",
                params![e.skill_id],
                |_| Ok(()),
            )
            .is_ok();
        if !skill_ok {
            continue;
        }
        // Keep the project link only if that project exists; otherwise NULL.
        let proj: Option<String> = match &e.project_id {
            Some(pid) => tx
                .query_row(
                    "SELECT id FROM development_projects WHERE id = ?1",
                    params![pid],
                    |row| row.get(0),
                )
                .ok(),
            None => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO development_skill_evidence
                (id,skill_id,project_id,title,provenance,date,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                e.id,
                e.skill_id,
                proj,
                e.title,
                e.provenance,
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

    for l in &import.links {
        let ok = tx
            .query_row(
                "SELECT 1 FROM development_projects WHERE id = ?1",
                params![l.project_id],
                |_| Ok(()),
            )
            .is_ok()
            && tx
                .query_row(
                    "SELECT 1 FROM development_skills WHERE id = ?1",
                    params![l.skill_id],
                    |_| Ok(()),
                )
                .is_ok();
        if ok {
            let n = tx.execute(
                "INSERT OR IGNORE INTO development_project_skill_links (project_id, skill_id)
                 VALUES (?1, ?2)",
                params![l.project_id, l.skill_id],
            )?;
            r.links_imported += n;
        }
    }

    let marker = serde_json::json!({
        "version": 1,
        "projectsImported": r.projects_imported,
        "skillsImported": r.skills_imported,
        "milestonesImported": r.milestones_imported,
        "evidenceImported": r.evidence_imported,
        "linksImported": r.links_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_DEV_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn dev_load(db: State<'_, Db>) -> DbResult<DevGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn dev_project_upsert(db: State<'_, Db>, project: ProjectRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    project_upsert_inner(&conn, &project)
}

#[tauri::command]
pub fn dev_project_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: milestones CASCADE; links CASCADE; evidence.project_id SET NULL.
    conn.execute(
        "DELETE FROM development_projects WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn dev_skill_upsert(db: State<'_, Db>, skill: SkillRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    skill_upsert_inner(&conn, &skill)
}

#[tauri::command]
pub fn dev_skill_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: evidence CASCADE; links CASCADE.
    conn.execute("DELETE FROM development_skills WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn dev_milestone_upsert(db: State<'_, Db>, milestone: MilestoneRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    milestone_upsert_inner(&conn, &milestone)
}

#[tauri::command]
pub fn dev_milestone_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM development_milestones WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn dev_milestones_reorder(
    db: State<'_, Db>,
    project_id: String,
    ordered_ids: Vec<String>,
) -> DbResult<()> {
    let mut conn = db.0.lock().unwrap();
    let tx = conn.transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE development_milestones SET position = ?1, updated_at = datetime('now')
             WHERE id = ?2 AND project_id = ?3",
            params![idx as i64, id, project_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn dev_evidence_upsert(db: State<'_, Db>, evidence: SkillEvidenceRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    evidence_upsert_inner(&conn, &evidence)
}

#[tauri::command]
pub fn dev_evidence_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM development_skill_evidence WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

// --- Batch 5: Development ↔ Knowledge -----------------------------------------

/// Set (or clear, with `topic_id == None`) a Skill's optional Knowledge concept
/// reference. A non-existent topic is stored as NULL, never an FK error — the
/// same dangling-safe posture used elsewhere.
fn skill_link_knowledge_inner(
    conn: &Connection,
    skill_id: &str,
    topic_id: Option<&str>,
) -> DbResult<()> {
    let resolved: Option<String> = match topic_id {
        Some(id) if !id.is_empty() => conn
            .query_row(
                "SELECT id FROM knowledge_topics WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .optional()?,
        _ => None,
    };
    let n = conn.execute(
        "UPDATE development_skills SET knowledge_topic_id = ?2, updated_at = datetime('now')
         WHERE id = ?1",
        params![skill_id, resolved],
    )?;
    if n == 0 {
        return Err(DbError::Path(format!("no skill '{skill_id}'")));
    }
    Ok(())
}

/// Idempotent, set-once handoff: records which ONE Knowledge Evidence row this
/// skill-evidence produced. Returns the effective id (the existing one if a
/// link was already recorded). Mirrors `study::mastery_link_evidence`.
fn skill_evidence_link_knowledge_inner(
    conn: &Connection,
    evidence_id: &str,
    knowledge_evidence_id: &str,
) -> DbResult<Option<String>> {
    let current: Option<Option<String>> = conn
        .query_row(
            "SELECT knowledge_evidence_id FROM development_skill_evidence WHERE id = ?1",
            params![evidence_id],
            |r| r.get(0),
        )
        .optional()?;
    match current {
        None => Ok(None),                           // no such evidence row
        Some(Some(existing)) => Ok(Some(existing)), // already handed off — never overwrite
        Some(None) => {
            conn.execute(
                "UPDATE development_skill_evidence
                 SET knowledge_evidence_id = ?2, updated_at = datetime('now')
                 WHERE id = ?1 AND knowledge_evidence_id IS NULL",
                params![evidence_id, knowledge_evidence_id],
            )?;
            Ok(Some(knowledge_evidence_id.to_string()))
        }
    }
}

#[tauri::command]
pub fn dev_skill_link_knowledge(
    db: State<'_, Db>,
    skill_id: String,
    topic_id: Option<String>,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    skill_link_knowledge_inner(&conn, &skill_id, topic_id.as_deref())
}

#[tauri::command]
pub fn dev_skill_evidence_link_knowledge(
    db: State<'_, Db>,
    evidence_id: String,
    knowledge_evidence_id: String,
) -> DbResult<Option<String>> {
    let conn = db.0.lock().unwrap();
    skill_evidence_link_knowledge_inner(&conn, &evidence_id, &knowledge_evidence_id)
}

#[tauri::command]
pub fn dev_link_set(
    db: State<'_, Db>,
    project_id: String,
    skill_id: String,
    linked: bool,
) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    if linked {
        conn.execute(
            "INSERT INTO development_project_skill_links (project_id, skill_id) VALUES (?1, ?2)
             ON CONFLICT(project_id, skill_id) DO NOTHING",
            params![project_id, skill_id],
        )?;
    } else {
        conn.execute(
            "DELETE FROM development_project_skill_links WHERE project_id = ?1 AND skill_id = ?2",
            params![project_id, skill_id],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn dev_import_graph(db: State<'_, Db>, import: DevImport) -> DbResult<DevImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Development graph + its import marker so native E2E
/// can run the real-user scenario from a clean state.
#[tauri::command]
pub fn dev_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "dev_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM development_project_skill_links;
         DELETE FROM development_skill_evidence;
         DELETE FROM development_milestones;
         DELETE FROM development_skills;
         DELETE FROM development_projects;
         DELETE FROM kv_store WHERE key IN
           ('pbos:development-projects','pbos:development-skills',
            'pbos:development-milestones','pbos:development-evidence');
         INSERT INTO meta (key,value) VALUES ('development_relational_import','{\"version\":1,\"reset\":true}')
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

    fn project(id: &str) -> ProjectRow {
        ProjectRow {
            id: id.into(),
            title: format!("Project {id}"),
            status: "active".into(),
            description: String::new(),
            archived: false,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn skill(id: &str) -> SkillRow {
        SkillRow {
            id: id.into(),
            title: format!("Skill {id}"),
            category: "Backend".into(),
            knowledge_percent: 40.0,
            practice_percent: 20.0,
            roadmap_position: None,
            roadmap_target_level: None,
            knowledge_topic_id: None,
            archived: false,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn milestone(id: &str, project_id: &str) -> MilestoneRow {
        MilestoneRow {
            id: id.into(),
            project_id: project_id.into(),
            title: format!("Milestone {id}"),
            completed: false,
            position: 0,
            created_at: "2026-01-02".into(),
            updated_at: "2026-01-02".into(),
        }
    }
    fn evidence(
        id: &str,
        skill_id: &str,
        project_id: Option<&str>,
        prov: &str,
    ) -> SkillEvidenceRow {
        SkillEvidenceRow {
            id: id.into(),
            skill_id: skill_id.into(),
            project_id: project_id.map(String::from),
            title: format!("Evidence {id}"),
            provenance: prov.into(),
            date: "2026-02-01".into(),
            knowledge_evidence_id: None,
            created_at: "2026-02-01".into(),
            updated_at: "2026-02-01".into(),
        }
    }

    fn seed_knowledge(c: &Connection, id: &str, title: &str) {
        c.execute(
            "INSERT INTO knowledge_topics
                (id,title,category,context,last_studied,next_review_date,related_goal_id,created_at,updated_at)
             VALUES (?1,?2,'development','',NULL,NULL,NULL,'t','t')",
            params![id, title],
        )
        .unwrap();
    }
    fn seed_knowledge_evidence(c: &Connection, id: &str, topic_id: &str) {
        c.execute(
            "INSERT INTO knowledge_evidence
                (id,topic_id,type,title,score,max_score,date,created_at,updated_at)
             VALUES (?1,?2,'practice','ev',1,1,'2026-02-02','t','t')",
            params![id, topic_id],
        )
        .unwrap();
    }

    #[test]
    fn a_skill_references_one_knowledge_concept_and_survives_its_deletion() {
        let c = mem();
        skill_upsert_inner(&c, &skill("s1")).unwrap();
        seed_knowledge(&c, "kt1", "React Hooks");

        skill_link_knowledge_inner(&c, "s1", Some("kt1")).unwrap();
        assert_eq!(
            load_inner(&c).unwrap().skills[0]
                .knowledge_topic_id
                .as_deref(),
            Some("kt1")
        );

        // a full skill re-upsert must NOT clobber the reference
        skill_upsert_inner(&c, &skill("s1")).unwrap();
        assert_eq!(
            load_inner(&c).unwrap().skills[0]
                .knowledge_topic_id
                .as_deref(),
            Some("kt1"),
            "skill_upsert never writes knowledge_topic_id"
        );

        // deleting the concept SET NULLs the link; the skill stays
        c.execute("DELETE FROM knowledge_topics WHERE id = 'kt1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.skills.len(), 1);
        assert!(g.skills[0].knowledge_topic_id.is_none());

        // clearing + a dangling id both land as NULL, never an FK error
        skill_link_knowledge_inner(&c, "s1", Some("kt1")).unwrap(); // kt1 gone -> NULL
        assert!(load_inner(&c).unwrap().skills[0]
            .knowledge_topic_id
            .is_none());
    }

    #[test]
    fn skill_evidence_handoff_to_knowledge_is_set_once() {
        let c = mem();
        skill_upsert_inner(&c, &skill("s1")).unwrap();
        seed_knowledge(&c, "kt1", "React Hooks");
        seed_knowledge_evidence(&c, "ke1", "kt1");
        seed_knowledge_evidence(&c, "ke2", "kt1");
        evidence_upsert_inner(&c, &evidence("e1", "s1", None, "independent")).unwrap();

        let first = skill_evidence_link_knowledge_inner(&c, "e1", "ke1").unwrap();
        assert_eq!(first.as_deref(), Some("ke1"));
        // a second attempt with a different id returns the first, never overwrites
        let second = skill_evidence_link_knowledge_inner(&c, "e1", "ke2").unwrap();
        assert_eq!(second.as_deref(), Some("ke1"));
        assert_eq!(
            load_inner(&c).unwrap().evidence[0]
                .knowledge_evidence_id
                .as_deref(),
            Some("ke1")
        );
        // a full evidence re-upsert never touches the handoff column
        evidence_upsert_inner(&c, &evidence("e1", "s1", None, "independent")).unwrap();
        assert_eq!(
            load_inner(&c).unwrap().evidence[0]
                .knowledge_evidence_id
                .as_deref(),
            Some("ke1")
        );
        // deleting that Knowledge evidence SET NULLs the link; the skill-evidence stays
        c.execute("DELETE FROM knowledge_evidence WHERE id = 'ke1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.evidence.len(), 1);
        assert!(g.evidence[0].knowledge_evidence_id.is_none());
        // unknown ids are reported, not panicked
        assert!(skill_evidence_link_knowledge_inner(&c, "nope", "ke2")
            .unwrap()
            .is_none());
    }

    #[test]
    fn crud_and_cascade_delete() {
        let c = mem();
        project_upsert_inner(&c, &project("p1")).unwrap();
        skill_upsert_inner(&c, &skill("s1")).unwrap();
        milestone_upsert_inner(&c, &milestone("m1", "p1")).unwrap();
        evidence_upsert_inner(&c, &evidence("e1", "s1", Some("p1"), "independent")).unwrap();
        c.execute(
            "INSERT INTO development_project_skill_links (project_id, skill_id) VALUES ('p1','s1')",
            [],
        )
        .unwrap();

        let g = load_inner(&c).unwrap();
        assert_eq!(g.projects.len(), 1);
        assert_eq!(g.skills.len(), 1);
        assert_eq!(g.milestones.len(), 1);
        assert_eq!(g.evidence.len(), 1);
        assert_eq!(g.links.len(), 1);

        // Delete the project: milestones + links CASCADE, evidence.project_id -> NULL.
        c.execute("DELETE FROM development_projects WHERE id = 'p1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.projects.len(), 0);
        assert_eq!(g.milestones.len(), 0, "milestones cascade with the project");
        assert_eq!(g.links.len(), 0, "links cascade with the project");
        assert_eq!(g.evidence.len(), 1, "evidence survives its project");
        assert!(
            g.evidence[0].project_id.is_none(),
            "evidence.project_id is SET NULL, not deleted"
        );

        // Delete the skill: its evidence CASCADEs.
        c.execute("DELETE FROM development_skills WHERE id = 's1'", [])
            .unwrap();
        assert_eq!(load_inner(&c).unwrap().evidence.len(), 0);
    }

    #[test]
    fn evidence_percent_is_not_a_column() {
        let c = mem();
        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('development_skills')")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(
            !cols.iter().any(|c| c.contains("evidence")),
            "skills must not store any evidence/capability number — it is derived"
        );
        assert!(cols.contains(&"knowledge_percent".to_string()));
        assert!(cols.contains(&"practice_percent".to_string()));
    }

    #[test]
    fn fk_rejects_milestone_on_missing_project() {
        let c = mem();
        let err = c.execute(
            "INSERT INTO development_milestones (id,project_id,title,completed,position,created_at,updated_at)
             VALUES ('m1','ghost','x',0,0,'2026-01-01','2026-01-01')",
            [],
        );
        assert!(err.is_err());
    }

    #[test]
    fn import_is_idempotent_non_destructive_and_dangling_safe() {
        let c = mem();
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = DevImport {
            projects: vec![project("p1")],
            skills: vec![skill("s1")],
            milestones: vec![milestone("m1", "p1"), milestone("m-ghost", "no-project")],
            evidence: vec![
                evidence("e1", "s1", Some("p1"), "independent"),
                evidence("e2", "s1", Some("ghost-proj"), "ai-assisted"), // project -> NULL
                evidence("e3", "ghost-skill", None, "independent"),      // dropped
            ],
            links: vec![
                LinkRow {
                    project_id: "p1".into(),
                    skill_id: "s1".into(),
                },
                LinkRow {
                    project_id: "p1".into(),
                    skill_id: "ghost".into(),
                },
            ],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.projects_imported, 1);
        assert_eq!(r1.milestones_imported, 1, "m-ghost dropped");
        assert_eq!(r1.evidence_imported, 2, "e3 (missing skill) dropped");
        assert_eq!(r1.links_imported, 1, "dangling link dropped");
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            let e2 = g.evidence.iter().find(|e| e.id == "e2").unwrap();
            assert!(
                e2.project_id.is_none(),
                "unresolved project -> NULL on import"
            );
        }

        // mutate, re-import: no-op
        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE development_projects SET title = 'EDITED' WHERE id = 'p1'",
                [],
            )
            .unwrap();
        }
        let imp2 = DevImport {
            projects: vec![project("p1")],
            skills: vec![],
            milestones: vec![],
            evidence: vec![],
            links: vec![],
        };
        let r2 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp2).unwrap()
        };
        assert!(!r2.ran);
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            assert_eq!(g.projects[0].title, "EDITED");
        }
    }

    #[test]
    fn upsert_preserves_created_at_on_update() {
        let c = mem();
        project_upsert_inner(&c, &project("p1")).unwrap();
        let mut edited = project("p1");
        edited.title = "Renamed".into();
        edited.created_at = "2099-12-31".into();
        project_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.projects[0].title, "Renamed");
        assert_eq!(g.projects[0].created_at, "2026-01-01");
    }
}
