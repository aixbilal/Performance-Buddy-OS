mod academic;
mod capture;
mod db;
mod development;
mod fitness;
mod knowledge;
mod language;
mod money;
mod performance;
mod planning;
mod routine;
mod study;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `mut` is only used by the debug-only wdio plugin registration below.
    #[cfg_attr(not(debug_assertions), allow(unused_mut))]
    let mut builder = tauri::Builder::default();

    // WebdriverIO renderer E2E support (`browser.tauri.execute`). Registered
    // ONLY in debug builds so it is entirely absent from production, per
    // @wdio/tauri-service docs. The crate is compiled in both profiles (its
    // ACL manifest must resolve for `capabilities/default.json`) but nothing
    // is wired at runtime in release. See app/wdio.conf.ts.
    //
    // NOTE: the previous `tauri-plugin-log` boilerplate was removed — the wdio
    // plugin installs its own `log` logger and the `log` crate permits only
    // one global logger, so initialising both panicked the app at startup.
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_wdio::init());
    }

    builder
        .setup(|app| {
            // Open the durable SQLite store and run migrations before any
            // window logic. A failure here is fatal and surfaced honestly
            // rather than silently degrading to volatile storage.
            let conn = db::open_and_migrate(app.handle())
                .expect("PBOS: failed to open/migrate the SQLite database");
            app.manage(db::Db(Mutex::new(conn)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Batch 0 — transitional KV store
            db::kv_get_all,
            db::kv_set,
            db::kv_delete,
            db::db_status,
            db::migrate_from_localstorage,
            // Batch 1 — canonical relational Performance spine
            performance::perf_load,
            performance::perf_goal_upsert,
            performance::perf_goal_delete,
            performance::perf_system_upsert,
            performance::perf_system_delete,
            performance::perf_action_upsert,
            performance::perf_action_delete,
            performance::perf_link_set,
            performance::perf_actions_reorder,
            performance::perf_import_graph,
            performance::perf_reset_for_test,
            // Batch 2A — canonical relational Knowledge domain
            knowledge::know_load,
            knowledge::know_topic_upsert,
            knowledge::know_topic_delete,
            knowledge::know_source_upsert,
            knowledge::know_source_delete,
            knowledge::know_evidence_upsert,
            knowledge::know_evidence_delete,
            knowledge::know_import_graph,
            knowledge::know_reset_for_test,
            // Batch 2A — canonical relational Academic domain
            academic::acad_load,
            academic::acad_semester_upsert,
            academic::acad_semester_delete,
            academic::acad_course_upsert,
            academic::acad_course_delete,
            academic::acad_topic_upsert,
            academic::acad_topic_delete,
            academic::acad_assessment_upsert,
            academic::acad_assessment_delete,
            academic::acad_attempt_upsert,
            academic::acad_attempt_delete,
            academic::acad_topic_link_knowledge,
            academic::acad_import_graph,
            academic::acad_reset_for_test,
            // Batch 2B — canonical relational Development domain
            development::dev_load,
            development::dev_project_upsert,
            development::dev_project_delete,
            development::dev_skill_upsert,
            development::dev_skill_delete,
            development::dev_milestone_upsert,
            development::dev_milestone_delete,
            development::dev_milestones_reorder,
            development::dev_evidence_upsert,
            development::dev_evidence_delete,
            development::dev_link_set,
            development::dev_import_graph,
            development::dev_reset_for_test,
            // Batch 2B — canonical relational Fitness & Recovery domain
            fitness::fit_load,
            fitness::fit_plan_upsert,
            fitness::fit_plan_delete,
            fitness::fit_planned_session_upsert,
            fitness::fit_planned_session_delete,
            fitness::fit_workout_upsert,
            fitness::fit_workout_delete,
            fitness::fit_checkin_upsert,
            fitness::fit_checkin_delete,
            fitness::fit_import_graph,
            fitness::fit_reset_for_test,
            // Batch 2B — canonical relational Routines & Daily Life domain
            routine::rtn_load,
            routine::rtn_routine_upsert,
            routine::rtn_routine_delete,
            routine::rtn_log_upsert,
            routine::rtn_log_delete,
            routine::rtn_import_graph,
            routine::rtn_reset_for_test,
            // Batch 2 — canonical relational Reading & Language Learning domain
            language::lang_load,
            language::lang_path_upsert,
            language::lang_path_delete,
            language::lang_unit_upsert,
            language::lang_unit_delete,
            language::lang_units_reorder,
            language::lang_session_upsert,
            language::lang_session_delete,
            language::lang_book_upsert,
            language::lang_book_delete,
            language::lang_reading_session_upsert,
            language::lang_reading_session_delete,
            language::lang_import_graph,
            language::lang_reset_for_test,
            // Batch 2 — canonical relational Money OS domain
            money::money_load,
            money::money_transaction_upsert,
            money::money_transaction_delete,
            money::money_planned_upsert,
            money::money_planned_delete,
            money::money_budget_upsert,
            money::money_budget_delete,
            money::money_savings_goal_upsert,
            money::money_savings_goal_delete,
            money::money_import_graph,
            money::money_reset_for_test,
            // Batch 3 — canonical relational Planning & Calendar domain
            planning::plan_load,
            planning::plan_block_upsert,
            planning::plan_block_delete,
            planning::plan_capacity_set,
            planning::plan_import_graph,
            planning::plan_reset_for_test,
            // Batch 3 — durable Quick Capture inbox
            capture::capture_load,
            capture::capture_upsert,
            capture::capture_delete,
            capture::capture_import,
            capture::capture_reset_for_test,
            // Batch 4 — Academic execution: Focus session history + Mastery checks
            study::study_load,
            study::study_focus_session_upsert,
            study::study_focus_session_delete,
            study::study_mastery_check_upsert,
            study::study_mastery_check_delete,
            study::study_mastery_link_evidence,
            study::study_import_graph,
            study::study_reset_for_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
