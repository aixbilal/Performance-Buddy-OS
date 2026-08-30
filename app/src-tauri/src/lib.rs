mod db;

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
            db::kv_get_all,
            db::kv_set,
            db::kv_delete,
            db::db_status,
            db::migrate_from_localstorage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
