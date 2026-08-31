//! Batch 2 — canonical relational persistence for the Money OS domain.
//! Thin data-access over the SQLite tables in migration v4 (see `db.rs`).
//!
//! Money OS is lightweight MANUAL personal-finance awareness (V1 Day 10) —
//! not accounting / banking / advisory software. Product locks enforced by
//! the shape here:
//!   ACTUAL TRANSACTION (`money_transactions`) ≠ PLANNED EXPENSE
//!     (`money_planned_expenses`) — distinct rows; a planned expense may link
//!     to the actual transaction that realised it (`transaction_id`, SET NULL)
//!     but is never rewritten into one.
//!   SAVINGS TRANSFER ≠ EXPENSE — a distinct `type`; the TS engine keeps it
//!     out of every spending / budget total.
//!   PBOS BALANCE ≠ VERIFIED BANK BALANCE — nothing here asserts verification;
//!     there is no `bank_verified` column.
//!   Savings-goal progress = `opening_amount` (user-entered) + linked
//!     `savings-transfer` transactions — ONE truth, no stored `current_amount`.
//!   Money is NEVER part of a performance score — no such column exists.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type DbResult<T> = Result<T, DbError>;

const META_MONEY_IMPORT: &str = "money_relational_import";

// ---------------------------------------------------------------------------
// Row types (camelCase across the Tauri boundary)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: String,
    pub date: String,
    #[serde(rename = "type")]
    pub tx_type: String,
    pub amount: f64,
    pub category: String,
    pub description: String,
    pub savings_goal_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedExpenseRow {
    pub id: String,
    pub title: String,
    pub amount: f64,
    pub category: String,
    pub due_date: String,
    pub status: String,
    pub transaction_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetRow {
    pub id: String,
    pub category: String,
    pub period: String,
    pub limit_amount: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavingsGoalRow {
    pub id: String,
    pub title: String,
    pub target_amount: f64,
    pub target_date: Option<String>,
    pub monthly_target: f64,
    pub opening_amount: f64,
    pub status: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoneyGraph {
    pub transactions: Vec<TransactionRow>,
    pub planned_expenses: Vec<PlannedExpenseRow>,
    pub budgets: Vec<BudgetRow>,
    pub savings_goals: Vec<SavingsGoalRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoneyImport {
    pub transactions: Vec<TransactionRow>,
    pub planned_expenses: Vec<PlannedExpenseRow>,
    pub budgets: Vec<BudgetRow>,
    pub savings_goals: Vec<SavingsGoalRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoneyImportReport {
    pub ran: bool,
    pub transactions_imported: usize,
    pub planned_expenses_imported: usize,
    pub budgets_imported: usize,
    pub savings_goals_imported: usize,
    pub goal_links_cleared: usize,
    pub transaction_links_cleared: usize,
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

fn load_inner(conn: &Connection) -> DbResult<MoneyGraph> {
    let mut gs = conn.prepare(
        "SELECT id,title,target_amount,target_date,monthly_target,opening_amount,status,archived,created_at,updated_at
         FROM money_savings_goals ORDER BY created_at",
    )?;
    let savings_goals = gs
        .query_map([], |r| {
            Ok(SavingsGoalRow {
                id: r.get(0)?,
                title: r.get(1)?,
                target_amount: r.get(2)?,
                target_date: r.get(3)?,
                monthly_target: r.get(4)?,
                opening_amount: r.get(5)?,
                status: r.get(6)?,
                archived: r.get::<_, i64>(7)? != 0,
                created_at: r.get(8)?,
                updated_at: r.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ts = conn.prepare(
        "SELECT id,date,type,amount,category,description,savings_goal_id,created_at,updated_at
         FROM money_transactions ORDER BY date, created_at",
    )?;
    let transactions = ts
        .query_map([], |r| {
            Ok(TransactionRow {
                id: r.get(0)?,
                date: r.get(1)?,
                tx_type: r.get(2)?,
                amount: r.get(3)?,
                category: r.get(4)?,
                description: r.get(5)?,
                savings_goal_id: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut ps = conn.prepare(
        "SELECT id,title,amount,category,due_date,status,transaction_id,created_at,updated_at
         FROM money_planned_expenses ORDER BY due_date, created_at",
    )?;
    let planned_expenses = ps
        .query_map([], |r| {
            Ok(PlannedExpenseRow {
                id: r.get(0)?,
                title: r.get(1)?,
                amount: r.get(2)?,
                category: r.get(3)?,
                due_date: r.get(4)?,
                status: r.get(5)?,
                transaction_id: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut bs = conn.prepare(
        "SELECT id,category,period,limit_amount,created_at,updated_at
         FROM money_budgets ORDER BY period, category",
    )?;
    let budgets = bs
        .query_map([], |r| {
            Ok(BudgetRow {
                id: r.get(0)?,
                category: r.get(1)?,
                period: r.get(2)?,
                limit_amount: r.get(3)?,
                created_at: r.get(4)?,
                updated_at: r.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(MoneyGraph {
        transactions,
        planned_expenses,
        budgets,
        savings_goals,
    })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

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

fn savings_goal_upsert_inner(conn: &Connection, g: &SavingsGoalRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO money_savings_goals
            (id,title,target_amount,target_date,monthly_target,opening_amount,status,archived,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, target_amount=excluded.target_amount,
            target_date=excluded.target_date, monthly_target=excluded.monthly_target,
            opening_amount=excluded.opening_amount, status=excluded.status,
            archived=excluded.archived, updated_at=excluded.updated_at",
        params![
            g.id,
            g.title,
            g.target_amount,
            g.target_date,
            g.monthly_target,
            g.opening_amount,
            g.status,
            g.archived as i64,
            g.created_at,
            g.updated_at
        ],
    )?;
    Ok(())
}

fn transaction_upsert_inner(conn: &Connection, t: &TransactionRow) -> DbResult<()> {
    let goal = resolve(conn, "money_savings_goals", &t.savings_goal_id);
    conn.execute(
        "INSERT INTO money_transactions
            (id,date,type,amount,category,description,savings_goal_id,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            date=excluded.date, type=excluded.type, amount=excluded.amount,
            category=excluded.category, description=excluded.description,
            savings_goal_id=excluded.savings_goal_id, updated_at=excluded.updated_at",
        params![
            t.id,
            t.date,
            t.tx_type,
            t.amount,
            t.category,
            t.description,
            goal,
            t.created_at,
            t.updated_at
        ],
    )?;
    Ok(())
}

fn planned_upsert_inner(conn: &Connection, p: &PlannedExpenseRow) -> DbResult<()> {
    let tx = resolve(conn, "money_transactions", &p.transaction_id);
    conn.execute(
        "INSERT INTO money_planned_expenses
            (id,title,amount,category,due_date,status,transaction_id,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, amount=excluded.amount, category=excluded.category,
            due_date=excluded.due_date, status=excluded.status,
            transaction_id=excluded.transaction_id, updated_at=excluded.updated_at",
        params![
            p.id,
            p.title,
            p.amount,
            p.category,
            p.due_date,
            p.status,
            tx,
            p.created_at,
            p.updated_at
        ],
    )?;
    Ok(())
}

fn budget_upsert_inner(conn: &Connection, b: &BudgetRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO money_budgets (id,category,period,limit_amount,created_at,updated_at)
         VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET
            category=excluded.category, period=excluded.period,
            limit_amount=excluded.limit_amount, updated_at=excluded.updated_at",
        params![
            b.id,
            b.category,
            b.period,
            b.limit_amount,
            b.created_at,
            b.updated_at
        ],
    )?;
    Ok(())
}

fn import_inner(conn: &mut Connection, import: MoneyImport) -> DbResult<MoneyImportReport> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM meta WHERE key = ?1",
            params![META_MONEY_IMPORT],
            |r| r.get(0),
        )
        .ok();
    if already.is_some() {
        return Ok(MoneyImportReport {
            ran: false,
            transactions_imported: 0,
            planned_expenses_imported: 0,
            budgets_imported: 0,
            savings_goals_imported: 0,
            goal_links_cleared: 0,
            transaction_links_cleared: 0,
        });
    }

    let mut r = MoneyImportReport {
        ran: true,
        transactions_imported: 0,
        planned_expenses_imported: 0,
        budgets_imported: 0,
        savings_goals_imported: 0,
        goal_links_cleared: 0,
        transaction_links_cleared: 0,
    };

    let tx = conn.transaction()?;

    for g in &import.savings_goals {
        let n = tx.execute(
            "INSERT OR IGNORE INTO money_savings_goals
                (id,title,target_amount,target_date,monthly_target,opening_amount,status,archived,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                g.id, g.title, g.target_amount, g.target_date, g.monthly_target,
                g.opening_amount, g.status, g.archived as i64, g.created_at, g.updated_at
            ],
        )?;
        r.savings_goals_imported += n;
    }

    for t in &import.transactions {
        let goal: Option<String> = match &t.savings_goal_id {
            Some(id) if !id.is_empty() => {
                let ok: Option<String> = tx
                    .query_row(
                        "SELECT id FROM money_savings_goals WHERE id = ?1",
                        params![id],
                        |x| x.get(0),
                    )
                    .ok();
                if ok.is_none() {
                    r.goal_links_cleared += 1;
                }
                ok
            }
            _ => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO money_transactions
                (id,date,type,amount,category,description,savings_goal_id,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                t.id,
                t.date,
                t.tx_type,
                t.amount,
                t.category,
                t.description,
                goal,
                t.created_at,
                t.updated_at
            ],
        )?;
        r.transactions_imported += n;
    }

    for p in &import.planned_expenses {
        let linked: Option<String> = match &p.transaction_id {
            Some(id) if !id.is_empty() => {
                let ok: Option<String> = tx
                    .query_row(
                        "SELECT id FROM money_transactions WHERE id = ?1",
                        params![id],
                        |x| x.get(0),
                    )
                    .ok();
                if ok.is_none() {
                    r.transaction_links_cleared += 1;
                }
                ok
            }
            _ => None,
        };
        let n = tx.execute(
            "INSERT OR IGNORE INTO money_planned_expenses
                (id,title,amount,category,due_date,status,transaction_id,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                p.id,
                p.title,
                p.amount,
                p.category,
                p.due_date,
                p.status,
                linked,
                p.created_at,
                p.updated_at
            ],
        )?;
        r.planned_expenses_imported += n;
    }

    for b in &import.budgets {
        let n = tx.execute(
            "INSERT OR IGNORE INTO money_budgets (id,category,period,limit_amount,created_at,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![b.id, b.category, b.period, b.limit_amount, b.created_at, b.updated_at],
        )?;
        r.budgets_imported += n;
    }

    let marker = serde_json::json!({
        "version": 1,
        "transactionsImported": r.transactions_imported,
        "plannedExpensesImported": r.planned_expenses_imported,
        "budgetsImported": r.budgets_imported,
        "savingsGoalsImported": r.savings_goals_imported,
    });
    tx.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![META_MONEY_IMPORT, marker.to_string()],
    )?;
    tx.commit()?;
    Ok(r)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn money_load(db: State<'_, Db>) -> DbResult<MoneyGraph> {
    let conn = db.0.lock().unwrap();
    load_inner(&conn)
}

#[tauri::command]
pub fn money_transaction_upsert(db: State<'_, Db>, transaction: TransactionRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    transaction_upsert_inner(&conn, &transaction)
}

#[tauri::command]
pub fn money_transaction_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // A planned expense that pointed at this transaction survives, but it is no
    // longer realised — clear the link and return it to "upcoming". planned ≠ actual.
    conn.execute(
        "UPDATE money_planned_expenses SET status = 'upcoming', transaction_id = NULL,
                updated_at = datetime('now')
         WHERE transaction_id = ?1",
        params![id],
    )?;
    conn.execute("DELETE FROM money_transactions WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn money_planned_upsert(db: State<'_, Db>, planned: PlannedExpenseRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    planned_upsert_inner(&conn, &planned)
}

#[tauri::command]
pub fn money_planned_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM money_planned_expenses WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn money_budget_upsert(db: State<'_, Db>, budget: BudgetRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    budget_upsert_inner(&conn, &budget)
}

#[tauri::command]
pub fn money_budget_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM money_budgets WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn money_savings_goal_upsert(db: State<'_, Db>, goal: SavingsGoalRow) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    savings_goal_upsert_inner(&conn, &goal)
}

#[tauri::command]
pub fn money_savings_goal_delete(db: State<'_, Db>, id: String) -> DbResult<()> {
    let conn = db.0.lock().unwrap();
    // FK: money_transactions.savings_goal_id SET NULL (the transfers survive).
    conn.execute("DELETE FROM money_savings_goals WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn money_import_graph(db: State<'_, Db>, import: MoneyImport) -> DbResult<MoneyImportReport> {
    let mut conn = db.0.lock().unwrap();
    import_inner(&mut conn, import)
}

/// DEBUG ONLY — wipes the Money graph + its import marker.
#[tauri::command]
pub fn money_reset_for_test(db: State<'_, Db>) -> DbResult<()> {
    if !cfg!(debug_assertions) {
        return Err(DbError::Forbidden(
            "money_reset_for_test is a debug-only command".into(),
        ));
    }
    let conn = db.0.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM money_planned_expenses;
         DELETE FROM money_transactions;
         DELETE FROM money_budgets;
         DELETE FROM money_savings_goals;
         DELETE FROM kv_store WHERE key IN
           ('pbos:money-transactions','pbos:money-planned-expenses',
            'pbos:money-budgets','pbos:money-savings-goals');
         INSERT INTO meta (key,value) VALUES ('money_relational_import','{\"version\":1,\"reset\":true}')
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

    fn goal(id: &str) -> SavingsGoalRow {
        SavingsGoalRow {
            id: id.into(),
            title: "New Laptop".into(),
            target_amount: 100000.0,
            target_date: None,
            monthly_target: 7500.0,
            opening_amount: 0.0,
            status: "active".into(),
            archived: false,
            created_at: "2026-01-01".into(),
            updated_at: "2026-01-01".into(),
        }
    }
    fn tx(id: &str, ty: &str, amount: f64, goal_id: Option<&str>) -> TransactionRow {
        TransactionRow {
            id: id.into(),
            date: "2026-08-10".into(),
            tx_type: ty.into(),
            amount,
            category: "General".into(),
            description: String::new(),
            savings_goal_id: goal_id.map(String::from),
            created_at: "2026-08-10".into(),
            updated_at: "2026-08-10".into(),
        }
    }
    fn planned(id: &str, tx_id: Option<&str>) -> PlannedExpenseRow {
        PlannedExpenseRow {
            id: id.into(),
            title: "Internet bill".into(),
            amount: 1500.0,
            category: "Utilities".into(),
            due_date: "2026-09-05".into(),
            status: if tx_id.is_some() {
                "realized".into()
            } else {
                "upcoming".into()
            },
            transaction_id: tx_id.map(String::from),
            created_at: "2026-08-20".into(),
            updated_at: "2026-08-20".into(),
        }
    }
    fn budget(id: &str) -> BudgetRow {
        BudgetRow {
            id: id.into(),
            category: "Food & Dining".into(),
            period: "2026-08".into(),
            limit_amount: 5000.0,
            created_at: "2026-08-01".into(),
            updated_at: "2026-08-01".into(),
        }
    }

    #[test]
    fn crud_and_load() {
        let c = mem();
        savings_goal_upsert_inner(&c, &goal("g1")).unwrap();
        transaction_upsert_inner(&c, &tx("t1", "income", 50000.0, None)).unwrap();
        transaction_upsert_inner(&c, &tx("t2", "expense", 10000.0, None)).unwrap();
        transaction_upsert_inner(&c, &tx("t3", "savings-transfer", 15000.0, Some("g1"))).unwrap();
        planned_upsert_inner(&c, &planned("p1", None)).unwrap();
        budget_upsert_inner(&c, &budget("b1")).unwrap();

        let g = load_inner(&c).unwrap();
        assert_eq!(g.transactions.len(), 3);
        assert_eq!(g.planned_expenses.len(), 1);
        assert_eq!(g.budgets.len(), 1);
        assert_eq!(g.savings_goals.len(), 1);
        // the savings-transfer keeps its own type and its goal link
        let transfer = g.transactions.iter().find(|t| t.id == "t3").unwrap();
        assert_eq!(transfer.tx_type, "savings-transfer");
        assert_eq!(transfer.savings_goal_id.as_deref(), Some("g1"));
    }

    #[test]
    fn deleting_a_goal_keeps_its_transfers_and_nulls_the_link() {
        let c = mem();
        savings_goal_upsert_inner(&c, &goal("g1")).unwrap();
        transaction_upsert_inner(&c, &tx("t1", "savings-transfer", 15000.0, Some("g1"))).unwrap();

        c.execute("DELETE FROM money_savings_goals WHERE id = 'g1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.savings_goals.len(), 0);
        assert_eq!(g.transactions.len(), 1, "the transfer transaction survives");
        assert!(
            g.transactions[0].savings_goal_id.is_none(),
            "savings_goal_id is SET NULL, not deleted"
        );
    }

    #[test]
    fn deleting_a_transaction_keeps_a_planned_expense_and_nulls_its_link() {
        let c = mem();
        transaction_upsert_inner(&c, &tx("t1", "expense", 1500.0, None)).unwrap();
        planned_upsert_inner(&c, &planned("p1", Some("t1"))).unwrap();

        c.execute("DELETE FROM money_transactions WHERE id = 't1'", [])
            .unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(
            g.planned_expenses.len(),
            1,
            "planned expense is NOT deleted"
        );
        assert!(
            g.planned_expenses[0].transaction_id.is_none(),
            "the realising-transaction link is SET NULL — planned ≠ actual, never merged"
        );
    }

    #[test]
    fn upsert_stores_a_dangling_goal_link_as_null_not_an_fk_error() {
        let c = mem();
        transaction_upsert_inner(&c, &tx("t1", "savings-transfer", 100.0, Some("ghost"))).unwrap();
        assert!(load_inner(&c).unwrap().transactions[0]
            .savings_goal_id
            .is_none());
    }

    #[test]
    fn no_bank_verification_or_performance_score_column_anywhere() {
        let c = mem();
        for table in [
            "money_transactions",
            "money_budgets",
            "money_savings_goals",
            "money_planned_expenses",
        ] {
            let cols: Vec<String> = c
                .prepare(&format!("SELECT name FROM pragma_table_info('{table}')"))
                .unwrap()
                .query_map([], |r| r.get(0))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();
            for banned in ["verified", "bank", "score", "performance", "current_amount"] {
                assert!(
                    !cols.iter().any(|c| c.contains(banned)),
                    "{table} must not have a `{banned}` column"
                );
            }
        }
    }

    #[test]
    fn fk_rejects_planned_expense_on_a_bogus_direct_insert() {
        let c = mem();
        let err = c.execute(
            "INSERT INTO money_planned_expenses (id,title,amount,category,due_date,status,transaction_id,created_at,updated_at)
             VALUES ('p1','x',1.0,'y','2026-01-01','upcoming','ghost-tx','2026-01-01','2026-01-01')",
            [],
        );
        assert!(err.is_err());
    }

    #[test]
    fn import_is_idempotent_non_destructive_and_dangling_safe() {
        let c = mem();
        let mut db = Db(std::sync::Mutex::new(c));

        let imp = MoneyImport {
            savings_goals: vec![goal("g1")],
            transactions: vec![
                tx("t1", "income", 50000.0, None),
                tx("t2", "savings-transfer", 15000.0, Some("g1")),
                tx("t3", "savings-transfer", 999.0, Some("ghost-goal")), // link cleared
            ],
            planned_expenses: vec![
                planned("p1", None),
                planned("p2", Some("ghost-tx")), // link cleared, planned kept
            ],
            budgets: vec![budget("b1")],
        };
        let r1 = {
            let conn = db.0.get_mut().unwrap();
            import_inner(conn, imp).unwrap()
        };
        assert!(r1.ran);
        assert_eq!(r1.transactions_imported, 3);
        assert_eq!(r1.planned_expenses_imported, 2);
        assert_eq!(r1.budgets_imported, 1);
        assert_eq!(r1.savings_goals_imported, 1);
        assert_eq!(r1.goal_links_cleared, 1);
        assert_eq!(r1.transaction_links_cleared, 1);
        {
            let conn = db.0.lock().unwrap();
            let g = load_inner(&conn).unwrap();
            assert!(g
                .transactions
                .iter()
                .find(|t| t.id == "t3")
                .unwrap()
                .savings_goal_id
                .is_none());
            assert!(g
                .planned_expenses
                .iter()
                .find(|p| p.id == "p2")
                .unwrap()
                .transaction_id
                .is_none());
        }

        // mutate + re-import: no-op preserving the edit
        {
            let conn = db.0.lock().unwrap();
            conn.execute(
                "UPDATE money_transactions SET amount = 12345 WHERE id = 't1'",
                [],
            )
            .unwrap();
        }
        let imp2 = MoneyImport {
            savings_goals: vec![],
            transactions: vec![tx("t1", "income", 50000.0, None)],
            planned_expenses: vec![],
            budgets: vec![],
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
                    .transactions
                    .iter()
                    .find(|t| t.id == "t1")
                    .unwrap()
                    .amount,
                12345.0
            );
        }
    }

    #[test]
    fn upsert_preserves_created_at_on_update() {
        let c = mem();
        budget_upsert_inner(&c, &budget("b1")).unwrap();
        let mut edited = budget("b1");
        edited.limit_amount = 9999.0;
        edited.created_at = "2099-12-31".into();
        budget_upsert_inner(&c, &edited).unwrap();
        let g = load_inner(&c).unwrap();
        assert_eq!(g.budgets[0].limit_amount, 9999.0);
        assert_eq!(g.budgets[0].created_at, "2026-08-01");
    }
}
