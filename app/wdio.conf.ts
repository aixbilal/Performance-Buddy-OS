import type { Options } from "@wdio/types";
import { createTauriCapabilities } from "@wdio/tauri-service";

/**
 * WebdriverIO + @wdio/tauri-service — native desktop E2E that drives the REAL
 * Performance Buddy OS renderer (Batch 0).
 *
 * Provider: `external` (tauri-driver + msedgedriver). Renderer interaction goes
 * through `browser.tauri.execute(fn)`, which runs JS inside the real PBOS
 * frontend via `tauri-plugin-wdio` — reliable on Windows/WebView2 where the raw
 * WebDriver DOM context is not. The plugin is compiled into the debug binary
 * and registered only under `#[cfg(debug_assertions)]` (see
 * app/src-tauri/src/lib.rs); it is entirely absent from `npm run build` /
 * release.
 *
 * Prerequisites (all satisfied here — see V1-COMPLETION-TRACKER.md):
 *   - Rust stable x86_64-pc-windows-msvc + MSVC build tools
 *   - Microsoft Edge WebView2 runtime
 *   - `tauri-driver` on PATH: `cargo install tauri-driver --locked`
 *   - `msedgedriver.exe` matching the WebView2 runtime on PATH (~/.local/bin);
 *     the service's own downloader is unreliable on this network, so a manual
 *     copy is kept there and tauri-driver picks it up
 *   - a debug build embedding a dev-mode frontend:
 *       npm run pretest:e2e:tauri   (build:e2e + tauri:build:debug)
 *
 * Run:  npm run test:e2e:tauri
 */
const TAURI_APP_BINARY =
  process.platform === "win32"
    ? "./src-tauri/target/debug/app.exe"
    : "./src-tauri/target/debug/app";

export const config: Options.Testrunner = {
  runner: "local",
  specs: ["./wdio/specs/**/*.e2e.ts"],
  maxInstances: 1,

  capabilities: [
    createTauriCapabilities(TAURI_APP_BINARY, {
      driverProvider: "external",
      autoInstallTauriDriver: true,
    }),
  ],

  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: TAURI_APP_BINARY,
        driverProvider: "external",
        autoInstallTauriDriver: true,
        autoDownloadEdgeDriver: true,
        captureBackendLogs: true,
        captureFrontendLogs: true,
      },
    ],
  ],

  logLevel: "warn",
  bail: 0,
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },
};
